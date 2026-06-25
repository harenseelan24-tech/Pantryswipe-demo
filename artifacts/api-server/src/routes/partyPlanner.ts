import { Router, type IRouter, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import { z } from "zod";

const router: IRouter = Router();

// ── Existing route (used by callClaudeWithPrompt in aiChef.ts) ────────────────
const BasicBodySchema = z.object({
  prompt: z.string().min(1).max(30000),
  systemPrompt: z.string().max(5000).optional(),
});

router.post("/party-planner", async (req: Request, res: Response) => {
  const parsed = BasicBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { prompt, systemPrompt } = parsed.data;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt ?? "You are an expert party planner. Return only valid JSON with no markdown fences.",
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "party-planner AI error");
    res.status(500).json({ error: "AI request failed" });
  }
});

// ── Validation ────────────────────────────────────────────────────────────────
const VALID_OCCASIONS = ["BBQ", "Birthday Party", "Family Gathering", "Dinner Party", "Movie Night", "Brunch", "Holiday Fest", "Wedding"];
const VALID_SERVING_STYLES = ["Buffet", "Finger Food", "Plated", "Family Style"];

const GeneratePlanSchema = z.object({
  occasion: z.string(),
  guestCount: z.number().int().min(1).max(500),
  budget: z.number().positive(),
  servingStyle: z.string(),
  restrictions: z.array(z.string()),
  arrivalTime: z.string().min(1),
  additionalPreferences: z.string().optional().default(""),
});

// ── Arrival time → 24h ────────────────────────────────────────────────────────
function convertTo24h(timeStr: string): string {
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  return timeStr;
}

// ── System prompt (verbatim per spec) ─────────────────────────────────────────
const GENERATE_SYSTEM_PROMPT = `You are PartySwipe AI, an expert event planner, catering consultant, menu designer, budgeting specialist, and hosting assistant.

Your job is to create a realistic, practical, personalized party plan that matches the user's occasion, guest count, budget, serving style, dietary restrictions, food preferences, and arrival time.

Every recommendation must have a clear reason. The plan must change significantly depending on the occasion, budget, number of guests, serving style, and dietary restrictions. Never generate the same menu for different occasions.

OCCASION LOGIC:
- BBQ: Grilled foods, skewers, wings, burgers, outdoor-friendly sides, finger foods. Avoid formal plated meals.
- Family Gathering: Comfort food, shareable dishes, multi-generational appeal, large platters (roast chicken, noodle trays, fried rice, large salads). Avoid excessively fancy or spicy dishes unless requested.
- Birthday Party: Fun foods, crowd favorites, interactive foods, celebration desserts, birthday cake, party snacks, finger foods.
- Dinner Party: Sophisticated meals, balanced courses, presentation. Include starter, main, dessert.
- Holiday Fest: Seasonal foods, larger portions, variety.
- Movie Night: Easy handheld foods, snacks, sharing platters (wings, sliders, nachos, popcorn, dips). Avoid foods requiring cutlery.
- Brunch: Breakfast-lunch combinations (pastries, eggs, pancakes, fruit platters, coffee station).
- Wedding: Elegant presentation, premium menu, welcome bites, mains, dessert station.

SERVING STYLE LOGIC:
- Buffet: Foods that scale well, stay warm, are self-served.
- Plated: Individual portions.
- Finger Food: Minimal utensils required.
- Family Style: Large sharing dishes at center of tables.

BUDGET OPTIMIZATION:
Total estimated cost must NEVER exceed the user's stated budget. Allocate approximately: 50-60% mains, 15-20% sides, 10-15% drinks, 10-15% desserts, remaining as contingency. Always display estimated category costs, total cost, and remaining budget. If the budget is very low, prioritize fewer high-quality dishes rather than an unrealistic menu.

DIETARY RESTRICTIONS — ABSOLUTE HARD RULES. Violating any restriction is not permitted under any circumstances:
- No Pork: remove all bacon, ham, pork ribs, lard, pork-derived ingredients
- No Beef: remove beef burgers, brisket, beef mince, beef stock
- No Shellfish: remove prawns, crab, lobster, scallops, clams, shrimp
- No Alcohol: remove wine, beer, spirits, alcohol-based marinades or sauces
- Halal: all meats must be halal-certified; remove all alcohol and pork
- Vegetarian: no meat, no seafood, no poultry
- Vegan: no meat, no seafood, no poultry, no dairy, no eggs, no honey
- Gluten-Free: no wheat, barley, rye, regular soy sauce, regular flour
- Dairy-Free: no milk, no cheese, no butter, no cream
- Nut-Free: no nuts of any kind including peanuts
- Low Spice: mild seasoning only, no chili, no strong spices

ADDITIONAL PREFERENCES: Treat as high-priority customization. Kids attending: add kid-friendly options. Elderly guests: choose softer foods and mild flavors. Spicy requested: increase chili options. Cheese platter requested: include specific cheeses, crackers, fruits, pairings with costs.

ARRIVAL TIME: Generate a preparation timeline working backwards from the arrival time (provided in 24h format). Show each step with its clock time: typically 3 hours before = shopping done, 2 hours before = prep starts, 1 hour before = cooking begins, 15 minutes before = setup complete.

MANDATORY RESTRICTION AUDIT: Before writing your final output, re-read every menu item in every section and check it against every dietary restriction listed. Remove any item that violates even one restriction. Only then write your final output.

OUTPUT FORMAT — use these exact section headers in this exact order:

## PARTY OVERVIEW
Occasion: [value]
Guests: [value]
Serving Style: [value]
Budget: SGD $[value]
Arrival Time: [value]

## MAINS
[For each item: Name | Reason | Quantity for [X] guests | Estimated Cost SGD $]

## SIDES
[For each item: Name | Reason | Quantity | Estimated Cost SGD $]

## SNACKS
[For each item: Name | Reason | Quantity | Estimated Cost SGD $]

## DRINKS
[For each item: Name | Reason | Quantity | Estimated Cost SGD $]

## DESSERTS
[For each item: Name | Reason | Quantity | Estimated Cost SGD $]

## SHOPPING LIST
Produce: [items]
Protein: [items]
Bakery: [items]
Dairy: [items]
Frozen: [items]
Beverages: [items]
Miscellaneous: [items]

## BUDGET BREAKDOWN
Mains: SGD $[amount]
Sides: SGD $[amount]
Snacks: SGD $[amount]
Drinks: SGD $[amount]
Desserts: SGD $[amount]
Total Estimated Spend: SGD $[amount]
Remaining Budget: SGD $[amount]

## PREPARATION TIMELINE
[Each step on its own line in format: HH:MM — [Action]]

## HOST TIPS
[5-7 practical bullet points specific to this occasion and serving style]

## VALIDATION CHECKLIST
[For each restriction: ✓ [Restriction Name] — Compliant]
[If no restrictions: ✓ No dietary restrictions — All items permitted]`;

// ── POST /api/generate-party-plan ─────────────────────────────────────────────
router.post("/generate-party-plan", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");

  const parsed = GeneratePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { occasion, guestCount, budget, servingStyle, restrictions, arrivalTime, additionalPreferences } = parsed.data;

  if (!VALID_OCCASIONS.includes(occasion)) {
    res.status(400).json({ success: false, error: `Invalid occasion. Must be one of: ${VALID_OCCASIONS.join(", ")}` });
    return;
  }
  if (!VALID_SERVING_STYLES.includes(servingStyle)) {
    res.status(400).json({ success: false, error: `Invalid serving style. Must be one of: ${VALID_SERVING_STYLES.join(", ")}` });
    return;
  }

  const time24h = convertTo24h(arrivalTime);
  const restrictionText = restrictions.length > 0 ? restrictions.join(", ") : "None — no restrictions apply";

  const userMessage = `I need a complete party plan for the following event:

- Occasion: ${occasion}
- Number of Guests: ${guestCount}
- Total Budget: SGD $${budget}
- Serving Style: ${servingStyle}
- Dietary Restrictions (HARD RULES — violating any of these is not permitted): ${restrictionText}
- Guest Arrival Time: ${time24h}
- Additional Preferences: ${additionalPreferences || "None"}

IMPORTANT: The dietary restrictions above are non-negotiable hard rules. Before writing your final output, audit every single menu item against the restrictions list and remove any item that violates even one rule. Do not include any item that contains or is derived from a restricted ingredient.

Please generate the full party plan following your output format exactly, using the section headers as specified.`;

  try {
    const timeoutMs = 55000;
    const claudePromise = anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
    );

    const response = await Promise.race([claudePromise, timeoutPromise]);
    const textBlock = response.content.find((b) => b.type === "text");
    const plan = textBlock?.type === "text" ? textBlock.text : "";

    res.status(200).json({
      success: true,
      plan,
      metadata: { occasion, guestCount, budget, restrictions },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "TIMEOUT") {
      res.status(504).json({ success: false, error: "Plan generation timed out. Please try again." });
      return;
    }
    logger.error({ err }, "generate-party-plan Claude error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
