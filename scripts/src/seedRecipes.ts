/**
 * PantrySwipe Recipe Seeder
 *
 * Sources:
 *  1. TheMealDB (free, no key) — 9 cuisines, up to 25 recipes each
 *  2. Claude AI generation — Korean, Thai, Singaporean (20 recipes each)
 *
 * Run with:  pnpm --filter @workspace/scripts run seed:recipes
 */

import { db, recipes } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { sql } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractTimerFromStep(instruction: string): number | null {
  const min = instruction.match(/(\d+)[\s-]?(?:minutes?|mins?)/i);
  const hr = instruction.match(/(\d+)[\s-]?hours?/i);
  const sec = instruction.match(/(\d+)[\s-]?seconds?/i);
  if (hr) return parseInt(hr[1]) * 3600;
  if (min) return parseInt(min[1]) * 60;
  if (sec) return parseInt(sec[1]);
  return null;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ─── TheMealDB cuisines ────────────────────────────────────────────────────────
const THEMEALDB_CUISINES: Record<string, string> = {
  Italian: "Italian",
  Japanese: "Japanese",
  Chinese: "Chinese",
  Indian: "Indian",
  American: "American",
  French: "French",
  Mexican: "Mexican",
  Vietnamese: "Vietnamese",
  Malaysian: "Malaysian",
};

// ─── Cuisines to generate with Claude ─────────────────────────────────────────
const CLAUDE_CUISINES = ["Korean", "Thai", "Singaporean"];

// ─── Batch Claude enrichment (5 recipes per call) ─────────────────────────────
interface EnrichmentInput {
  name: string;
  ingredients: string[];
  instructionsSnippet: string;
}

interface EnrichmentResult {
  difficulty: string;
  cook_time_mins: number;
  calories: number;
  macros: { protein: number; carbs: number; fat: number; fibre: number };
  dietary_flags: string[];
  allergens: string[];
  tags: string[];
  event_types: string[];
}

async function batchEnrich(items: EnrichmentInput[]): Promise<EnrichmentResult[]> {
  const itemsText = items
    .map(
      (r, i) =>
        `Recipe ${i + 1}: "${r.name}"\nIngredients: ${r.ingredients.slice(0, 15).join(", ")}\nInstructions (excerpt): ${r.instructionsSnippet.substring(0, 300)}`
    )
    .join("\n\n");

  const prompt = `For each of the following ${items.length} recipes, return enrichment metadata.

${itemsText}

Return a JSON array of exactly ${items.length} objects in the same order. Each object must have:
{
  "difficulty": "Easy" | "Medium" | "Hard",
  "cook_time_mins": integer (total cook time),
  "calories": integer (kcal per serving),
  "macros": { "protein": int, "carbs": int, "fat": int, "fibre": int },
  "dietary_flags": string[] from ["vegan","vegetarian","pescatarian","halal","gluten-free","dairy-free","nut-free","keto","paleo"],
  "allergens": string[] from ["peanuts","tree-nuts","dairy","gluten","eggs","shellfish","fish","soy","sesame"],
  "tags": string[] of 3-4 descriptive tags,
  "event_types": string[] from ["just-me","date-night","family","friends","movie-night","watch-party","meal-prep","birthday","brunch"]
}

Return ONLY the JSON array, no explanation.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return items.map(() => defaultEnrichment());

  const cleaned = textBlock.text.trim().replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return items.map(() => defaultEnrichment());

  try {
    const parsed: EnrichmentResult[] = JSON.parse(match[0]);
    // Pad if Claude returned fewer items than expected
    while (parsed.length < items.length) parsed.push(defaultEnrichment());
    return parsed;
  } catch {
    return items.map(() => defaultEnrichment());
  }
}

function defaultEnrichment(): EnrichmentResult {
  return {
    difficulty: "Medium",
    cook_time_mins: 30,
    calories: 450,
    macros: { protein: 25, carbs: 40, fat: 15, fibre: 5 },
    dietary_flags: [],
    allergens: [],
    tags: ["home cooking"],
    event_types: ["just-me", "family"],
  };
}

// ─── TheMealDB seeder ─────────────────────────────────────────────────────────
async function seedFromTheMealDB(cuisine: string, areaName: string): Promise<number> {
  console.log(`\n[TheMealDB] Fetching ${cuisine}...`);

  let listData: any;
  try {
    listData = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${areaName}`);
  } catch (err: any) {
    console.error(`[TheMealDB] Failed to list ${cuisine}: ${err.message}`);
    return 0;
  }

  const meals: Array<{ idMeal: string; strMeal: string }> = listData.meals ?? [];
  console.log(`[TheMealDB] Found ${meals.length} ${cuisine} meals`);

  // Fetch full details for up to 25 meals
  const detailBatch: any[] = [];
  for (const meal of meals.slice(0, 25)) {
    try {
      const detail = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
      const m = detail.meals?.[0];
      if (m) detailBatch.push(m);
    } catch {
      // skip this meal
    }
    await sleep(100);
  }

  console.log(`[TheMealDB] Enriching ${detailBatch.length} ${cuisine} recipes with Claude (batches of 5)...`);

  let saved = 0;
  const BATCH = 5;

  for (let i = 0; i < detailBatch.length; i += BATCH) {
    const batch = detailBatch.slice(i, i + BATCH);

    const enrichInputs: EnrichmentInput[] = batch.map((m) => {
      const ingredients: string[] = [];
      for (let j = 1; j <= 20; j++) {
        const name = m[`strIngredient${j}`]?.trim();
        const measure = m[`strMeasure${j}`]?.trim();
        if (name) ingredients.push(`${measure ?? ""} ${name}`.trim());
      }
      return {
        name: m.strMeal,
        ingredients,
        instructionsSnippet: (m.strInstructions ?? "").substring(0, 400),
      };
    });

    let enrichments: EnrichmentResult[];
    try {
      enrichments = await batchEnrich(enrichInputs);
    } catch {
      enrichments = enrichInputs.map(() => defaultEnrichment());
    }

    for (let j = 0; j < batch.length; j++) {
      const m = batch[j];
      const e = enrichments[j] ?? defaultEnrichment();

      const ingredients: string[] = [];
      const ingredientsJson = [];
      for (let k = 1; k <= 20; k++) {
        const name = m[`strIngredient${k}`]?.trim();
        const measure = m[`strMeasure${k}`]?.trim() ?? "";
        if (!name) continue;
        ingredients.push(`${measure} ${name}`.trim());
        const parts = measure.split(" ");
        const qty = parseFloat(parts[0]) || 1;
        const unit = parts.slice(1).join(" ").trim() || "piece";
        ingredientsJson.push({ name, quantity: `${qty} ${unit}`, unit, inPantry: false });
      }

      const steps = (m.strInstructions ?? "")
        .split(/\r\n|\n|\r/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 10)
        .map((instruction: string, idx: number) => ({
          step_number: idx + 1,
          instruction,
          timer_seconds: extractTimerFromStep(instruction),
        }));

      const sourceId = `mealdb_${m.idMeal}`;
      const rating = (3.8 + Math.random() * 1.2).toFixed(1);

      try {
        await db
          .insert(recipes)
          .values({
            name: m.strMeal,
            cuisine,
            source: "themealdb",
            source_id: sourceId,
            image_url: m.strMealThumb,
            difficulty: e.difficulty,
            cook_time_mins: e.cook_time_mins,
            servings: 2,
            calories: e.calories,
            macros_json: { ...e.macros, calories: e.calories },
            ingredients_json: ingredientsJson,
            steps_json: steps,
            tags: e.tags,
            event_types: e.event_types,
            dietary_flags: e.dietary_flags,
            allergens: e.allergens,
            rating,
            ai_generated: false,
          })
          .onConflictDoNothing();

        console.log(`  ✅ ${m.strMeal}`);
        saved++;
      } catch (err: any) {
        console.error(`  ❌ ${m.strMeal}: ${err.message}`);
      }
    }

    await sleep(500); // rate limit between Claude batches
  }

  return saved;
}

// ─── Claude recipe generator ──────────────────────────────────────────────────
async function seedFromClaude(cuisine: string, count = 20): Promise<number> {
  console.log(`\n[Claude] Generating ${count} ${cuisine} recipes...`);

  const prompt = `Generate ${count} authentic, well-known ${cuisine} home-cooked recipes. Include a mix of difficulty levels and dish types (soups, mains, stir-fries, snacks, etc.).

Return ONLY a valid JSON array of exactly ${count} objects. Each object:
{
  "name": "Recipe Name",
  "difficulty": "Easy" | "Medium" | "Hard",
  "cook_time_mins": integer,
  "servings": 2,
  "calories": integer per serving,
  "macros": { "protein": int, "carbs": int, "fat": int, "fibre": int },
  "ingredients": [
    { "name": "ingredient", "quantity": "amount unit", "unit": "unit", "inPantry": false }
  ],
  "steps": [
    { "step_number": 1, "instruction": "Detailed step with temperatures and times.", "timer_seconds": null }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "event_types": ["just-me", "family"],
  "dietary_flags": [],
  "allergens": [],
  "image_search_term": "dish name food photography"
}

Make instructions genuinely useful — real temperatures, timings, and techniques. Macros should be realistic.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return 0;

  const cleaned = textBlock.text.trim().replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return 0;

  let generated: any[];
  try {
    generated = JSON.parse(match[0]);
  } catch {
    console.error(`[Claude] Failed to parse JSON for ${cuisine}`);
    return 0;
  }

  let saved = 0;
  for (const r of generated) {
    const sourceId = `claude_${cuisine.toLowerCase()}_${r.name.replace(/\s+/g, "_").toLowerCase().substring(0, 60)}`;
    const rating = (4.0 + Math.random() * 0.8).toFixed(1);
    // Use Unsplash source for images (free, no key, cuisine-based fallback)
    const imageUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent((r.image_search_term ?? r.name) + " food")}`;

    try {
      await db
        .insert(recipes)
        .values({
          name: r.name,
          cuisine,
          source: "claude_generated",
          source_id: sourceId,
          image_url: imageUrl,
          difficulty: r.difficulty ?? "Medium",
          cook_time_mins: r.cook_time_mins ?? 30,
          servings: r.servings ?? 2,
          calories: r.calories ?? 0,
          macros_json: { ...r.macros, calories: r.calories ?? 0 },
          ingredients_json: r.ingredients ?? [],
          steps_json: r.steps ?? [],
          tags: r.tags ?? [],
          event_types: r.event_types ?? [],
          dietary_flags: r.dietary_flags ?? [],
          allergens: r.allergens ?? [],
          rating,
          ai_generated: true,
        })
        .onConflictDoNothing();

      console.log(`  ✅ ${r.name}`);
      saved++;
    } catch (err: any) {
      console.error(`  ❌ ${r.name}: ${err.message}`);
    }
  }

  return saved;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🍳 PantrySwipe Recipe Seeder\n");

  // Check current count
  const countRes = await db.select({ count: sql<number>`COUNT(*)` }).from(recipes);
  const existing = Number(countRes[0]?.count ?? 0);
  console.log(`Current recipes in DB: ${existing}`);

  if (existing > 0) {
    console.log("⚠️  Recipes already exist. Running in upsert mode (skips duplicates by source_id).\n");
  }

  let total = 0;

  // 1. TheMealDB cuisines
  for (const [cuisine, area] of Object.entries(THEMEALDB_CUISINES)) {
    const added = await seedFromTheMealDB(cuisine, area);
    total += added;
    await sleep(800);
  }

  // 2. Claude-generated cuisines (no TheMealDB coverage)
  for (const cuisine of CLAUDE_CUISINES) {
    const added = await seedFromClaude(cuisine, 20);
    total += added;
    await sleep(1000);
  }

  // Final count
  const finalRes = await db.select({ count: sql<number>`COUNT(*)` }).from(recipes);
  const finalCount = Number(finalRes[0]?.count ?? 0);

  console.log(`\n✅ Seeding complete!`);
  console.log(`   Added this run:  ${total}`);
  console.log(`   Total in DB:     ${finalCount}`);

  process.exit(0);
}

// Force unbuffered stdout for nohup/background runs
if (process.stdout.isTTY === false) {
  const origLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    origLog(...args);
    process.stdout.write("");
  };
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

main().catch((err) => {
  console.error("Seeder failed:", err);
  process.exit(1);
});
