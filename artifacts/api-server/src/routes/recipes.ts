import { Router, type IRouter, type Request, type Response } from "express";
import { db, recipes, type DbRecipe } from "@workspace/db";
import { eq, ilike, sql, and, or, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import { z } from "zod";
import { aiLimiter } from "../middleware/rateLimiters";

const router: IRouter = Router();

// ─── Pantry match calculator ──────────────────────────────────────────────────
function calcPantryMatch(recipe: DbRecipe, pantryNames: string[]): number {
  const ingredients = (recipe.ingredients_json ?? []) as Array<{ name: string }>;
  if (ingredients.length === 0) return 0;
  const matched = ingredients.filter((ing) =>
    pantryNames.some(
      (p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p)
    )
  ).length;
  return Math.round((matched / ingredients.length) * 100);
}

// ─── GET /api/recipes/count ───────────────────────────────────────────────────
router.get("/recipes/count", async (_req: Request, res: Response) => {
  try {
    const result = await db.select({ count: sql<number>`COUNT(*)` }).from(recipes);
    res.json({ count: Number(result[0]?.count ?? 0) });
  } catch (err) {
    logger.error({ err }, "recipes/count error");
    res.json({ count: 0 });
  }
});

// ─── GET /api/recipes/swipe ───────────────────────────────────────────────────
// Powers the swipe deck — returns shuffled recipes with optional filters
router.get("/recipes/swipe", async (req: Request, res: Response) => {
  try {
    const {
      cuisines: cuisinesQ,
      dietary,
      allergies: allergiesQ,
      pantry: pantryQ,
      limit: limitQ = "20",
      offset: offsetQ = "0",
    } = req.query as Record<string, string>;

    const cuisineList = cuisinesQ?.split(",").map((c) => c.trim()).filter(Boolean) ?? [];
    const allergyList = allergiesQ?.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean) ?? [];
    const pantryList = pantryQ?.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean) ?? [];
    const limit = Math.min(parseInt(limitQ) || 20, 50);
    const offset = parseInt(offsetQ) || 0;

    const conditions: ReturnType<typeof eq>[] = [];

    if (cuisineList.length === 1) {
      conditions.push(eq(recipes.cuisine, cuisineList[0]) as any);
    } else if (cuisineList.length > 1) {
      conditions.push(inArray(recipes.cuisine, cuisineList) as any);
    }

    if (dietary) {
      const d = dietary.toLowerCase();
      if (d === "vegan") {
        conditions.push(sql`'vegan' = ANY(${recipes.dietary_flags})` as any);
      } else if (d === "vegetarian") {
        conditions.push(sql`('vegan' = ANY(${recipes.dietary_flags}) OR 'vegetarian' = ANY(${recipes.dietary_flags}))` as any);
      } else if (d === "gluten-free") {
        conditions.push(sql`'gluten-free' = ANY(${recipes.dietary_flags})` as any);
      }
    }

    for (const allergen of allergyList) {
      conditions.push(sql`NOT (${allergen} = ANY(${recipes.allergens}))` as any);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(recipes)
      .where(where)
      .orderBy(sql`RANDOM()`)
      .limit(limit)
      .offset(offset);

    const result = rows.map((r) => ({
      ...r,
      pantry_match_percent: pantryList.length > 0 ? calcPantryMatch(r, pantryList) : undefined,
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "recipes/swipe error");
    res.json([]);
  }
});

// ─── GET /api/recipes/search ──────────────────────────────────────────────────
router.get("/recipes/search", async (req: Request, res: Response) => {
  try {
    const { q, cuisine } = req.query as Record<string, string>;

    if (!q || q.trim().length < 2) {
      res.json([]);
      return;
    }

    const term = q.trim();
    const conditions: any[] = [
      or(
        ilike(recipes.name, `%${term}%`),
        ilike(recipes.cuisine, `%${term}%`),
        sql`${recipes.tags}::text ILIKE ${"%" + term + "%"}`,
      ),
    ];

    if (cuisine) conditions.push(eq(recipes.cuisine, cuisine));

    const result = await db
      .select()
      .from(recipes)
      .where(and(...conditions))
      .orderBy(sql`${recipes.rating} DESC NULLS LAST`)
      .limit(20);

    res.json(result);
  } catch (err) {
    logger.error({ err }, "recipes/search error");
    res.json([]);
  }
});

// ─── GET /api/recipes/what-can-i-make ────────────────────────────────────────
router.get("/recipes/what-can-i-make", async (req: Request, res: Response) => {
  try {
    const {
      pantry: pantryQ,
      dietary,
      allergies: allergiesQ,
      min_match: minMatchQ = "50",
    } = req.query as Record<string, string>;

    const pantryList = pantryQ?.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean) ?? [];
    const allergyList = allergiesQ?.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean) ?? [];
    const minMatch = parseInt(minMatchQ) || 50;

    if (pantryList.length === 0) {
      res.json({ count: 0, recipes: [], grouped: {} });
      return;
    }

    const conditions: any[] = [];
    for (const allergen of allergyList) {
      conditions.push(sql`NOT (${allergen} = ANY(${recipes.allergens}))`);
    }
    if (dietary) {
      const d = dietary.toLowerCase();
      if (d === "vegan") conditions.push(sql`'vegan' = ANY(${recipes.dietary_flags})`);
      else if (d === "vegetarian") conditions.push(sql`('vegan' = ANY(${recipes.dietary_flags}) OR 'vegetarian' = ANY(${recipes.dietary_flags}))`);
    }

    const allRecipes = await db
      .select()
      .from(recipes)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const scored = allRecipes
      .map((r) => {
        const matchPercent = calcPantryMatch(r, pantryList);
        const ingredients = (r.ingredients_json ?? []) as Array<{ name: string }>;
        const missing = ingredients
          .filter((ing) => !pantryList.some((p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p)))
          .map((i) => i.name);
        return { ...r, match_percent: matchPercent, missing_ingredients: missing };
      })
      .filter((r) => r.match_percent >= minMatch)
      .sort((a, b) => b.match_percent - a.match_percent);

    const grouped = {
      quick_and_easy: scored.filter((r) => (r.cook_time_mins ?? 99) <= 20 || r.difficulty === "Easy").slice(0, 10),
      high_protein: scored.filter((r) => ((r.macros_json as any)?.protein ?? 0) >= 25).slice(0, 10),
      light_and_healthy: scored.filter((r) => (r.calories ?? 9999) <= 450).slice(0, 10),
      comfort_food: scored.filter((r) => r.tags?.includes("comfort food") ?? false).slice(0, 10),
      plant_based: scored.filter((r) => r.dietary_flags?.some((f: string) => ["vegan", "vegetarian"].includes(f)) ?? false).slice(0, 10),
    };

    res.json({ count: scored.length, recipes: scored.slice(0, 50), grouped });
  } catch (err) {
    logger.error({ err }, "recipes/what-can-i-make error");
    res.json({ count: 0, recipes: [], grouped: {} });
  }
});

// ─── POST /api/recipes/ai-chef ────────────────────────────────────────────────
router.post("/recipes/ai-chef", aiLimiter, async (req: Request, res: Response) => {
  const BodySchema = z.object({
    message: z.string().min(1).max(2000),
    conversation_history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
      .max(20)
      .default([]),
    pantry_items: z.array(z.string().max(80)).max(200).default([]),
    user_profile: z
      .object({
        dietType: z.array(z.string()).default([]),
        allergies: z.array(z.string()).default([]),
        skillLevel: z.string().default("Home Cook"),
        cuisinePreferences: z.array(z.string()).default([]),
        goal: z.string().default(""),
        name: z.string().default("Chef"),
      })
      .default({}),
  });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { message, conversation_history, pantry_items, user_profile } = parsed.data;

  const pantryContext =
    pantry_items.length > 0
      ? `Current pantry (${pantry_items.length} items): ${pantry_items.slice(0, 40).join(", ")}`
      : "Pantry is currently empty.";

  const systemPrompt = `You are the PantrySwipe AI Chef — a warm, encouraging, and knowledgeable cooking assistant. You help users discover recipes, improve cooking skills, manage their pantry, and reduce food waste.

User profile:
- Name: ${user_profile.name}
- Dietary preferences: ${user_profile.dietType.join(", ") || "None specified"}
- Allergies: ${user_profile.allergies.join(", ") || "None"}
- Skill level: ${user_profile.skillLevel}
- Favourite cuisines: ${user_profile.cuisinePreferences.join(", ") || "All cuisines"}
- Goal: ${user_profile.goal || "Eat well and enjoy cooking"}
- ${pantryContext}

Rules:
1. NEVER suggest foods the user is allergic to — this is non-negotiable
2. Match recipe complexity to their skill level
3. Prioritise using pantry ingredients to reduce waste when relevant
4. Be specific: give real ingredient amounts and cooking times when suggesting recipes
5. Keep responses under 200 words — concise and actionable
6. Be warm and encouraging, like a friend who loves cooking`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...conversation_history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "I'm having a moment — try asking again!";
    res.json({ response: text });
  } catch (err) {
    logger.error({ err }, "recipes/ai-chef error");
    res.json({ response: "I'm having trouble connecting right now. Give it a moment and try again!" });
  }
});

// ─── GET /api/recipes/:id ─────────────────────────────────────────────────────
// Must be LAST to avoid catching /swipe, /search etc.
router.get("/recipes/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid recipe id" });
      return;
    }
    const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    if (!result.length) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    res.json(result[0]);
  } catch (err) {
    logger.error({ err }, "recipes/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
