/**
 * AI Chef Service — inference.sh REST API integration
 *
 * Uses the inference.sh REST API (https://api.inference.sh/v1/) to call:
 *   - openrouter/claude-sonnet-45 for pantry-aware cooking advice + party planning
 *   - falai/flux-dev-lora for AI recipe image generation
 *
 * Requires EXPO_PUBLIC_INFSH_API_KEY to be set. All calls throw on failure
 * so callers can fall back to mock responses gracefully.
 */

const INFSH_BASE = "https://api.inference.sh/v1";
const LLM_APP = "openrouter/claude-sonnet-45";
const IMAGE_APP = "falai/flux-dev-lora";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 20;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiChefOptions {
  prompt: string;
  pantryItems: string[];
  dietType?: string[];
  allergies?: string[];
  skillLevel?: string;
  cuisinePreferences?: string[];
  goal?: string;
}

export interface MenuItem {
  name: string;
  quantity: string;
  estimatedCost: number;
  prepNote: string;
}

export interface MenuCourse {
  course: string;
  items: MenuItem[];
}

export interface PartyPlan {
  menu: MenuCourse[];
  shoppingList: { item: string; quantity: string; estimatedCost: number }[];
  timeline: { hoursBeforeArrival: number; task: string }[];
  costBreakdown: {
    totalEstimated: number;
    budgetRemaining: number;
    costPerPerson: number;
  };
  hostTips: string[];
}

export type PartyMenuResult = PartyPlan;

export interface GeneratePartyMenuOptions {
  occasion: string;
  guestCount: number;
  servingStyle: string;
  budget: number;
  dietaryRestrictions?: string[];
  additionalPreferences?: string;
  arrivalTime?: number;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_INFSH_API_KEY ?? "";
  if (!key) throw new Error("EXPO_PUBLIC_INFSH_API_KEY is not configured");
  return key;
}

async function runApp(appSlug: string, input: Record<string, unknown>): Promise<unknown> {
  const apiKey = getApiKey();

  const runRes = await fetch(`${INFSH_BASE}/apps/${appSlug}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input }),
  });

  if (!runRes.ok) {
    const body = await runRes.text().catch(() => "");
    throw new Error(`inference.sh run failed (${runRes.status}): ${body}`);
  }

  const runData = (await runRes.json()) as { task_id?: string; id?: string };
  const taskId = runData.task_id ?? runData.id;
  if (!taskId) throw new Error("No task_id in inference.sh response");

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(`${INFSH_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusRes.ok) continue;
    const task = (await statusRes.json()) as {
      status?: string;
      output?: unknown;
      error?: string;
    };
    if (task.status === "completed") return task.output;
    if (task.status === "failed") throw new Error(`Task failed: ${task.error ?? "unknown"}`);
  }
  throw new Error("Timeout: AI response took too long");
}

function extractText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.response === "string") return o.response;
    if (typeof o.content === "string") return o.content;
    if (Array.isArray(o.choices)) {
      const first = (o.choices as Array<{ message?: { content?: string } }>)[0];
      if (first?.message?.content) return first.message.content;
    }
  }
  throw new Error("Unexpected output format from inference.sh");
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Strip markdown fences Claude sometimes adds despite instructions, then parse JSON.
 */
export function parseClaudeJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error("[PartyPlanner] JSON parse failed. Raw response:", raw);
    throw new Error("Party plan could not be parsed. Please try again.");
  }
}

export const PARTY_SYSTEM_PROMPT = `You are an expert party planner and caterer. Follow ALL rules below without exception.

RULE 1 — OCCASION REALISM:
Before suggesting any food item, ask yourself: "Can this realistically be prepared and served at this exact type of event using only the equipment present there?"

Occasion equipment guide (strict — never exceed this):
- BBQ / Grill: grill only. Cold prep (salads, dips, sliced fruit) is fine. NO oven, NO stove, NO baking, NO tarts, NO soufflés, NO anything requiring kitchen equipment.
- Picnic: cold or room-temp foods only. Pre-made or assembly foods. NO hot cooking.
- Dinner party: full kitchen assumed. Plated courses fine.
- Birthday party: casual crowd-pleasing foods. Mixed ages assumed.
- Cocktail party: finger foods and canapés only. No full meals or cutlery-required items.
- Other occasions: use strict common sense about what equipment is available.

RULE 2 — BUDGET IS A HARD MAXIMUM:
Calculate a realistic per-person cost. If budget / guests < $8, suggest budget staples only (sausages, bread rolls, coleslaw, chips). If < $15, no premium cuts of meat. Never suggest ingredients whose retail cost would exceed the stated budget.

RULE 3 — DIETARY RESTRICTIONS ARE ABSOLUTE:
Each restriction means zero of that item in any form:
- No pork → no bacon, ham, prosciutto, lard, pork sausages, pork ribs
- No beef → no burgers, steak, beef mince, beef stock
- No shellfish → no prawns, crab, lobster, oysters, mussels
- Vegetarian → no meat or fish of any kind
- Vegan → no meat, fish, dairy, eggs, or honey
- Halal → all meat must be explicitly halal; no alcohol in cooking
- Kosher → follow kosher food separation rules
- Gluten-free → no wheat, barley, rye, or hidden gluten sources
- Dairy-free → no milk, butter, cream, cheese, or ghee
- Nut-free → no nuts or nut oils in any item

RULE 4 — SERVING STYLE:
- Finger food: every item must be bite-sized, no cutlery needed
- Buffet: items must hold temperature well in trays for 1+ hour
- Plated: individual portioned servings

RULE 5 — OUTPUT FORMAT:
Return ONLY valid JSON matching the schema exactly as specified in the user message. No markdown. No prose. No comments inside the JSON. Numbers must be plain numbers (not strings). Costs in USD as plain floats rounded to 2 decimal places.`;

/**
 * Call Claude via inference.sh with an arbitrary prompt.
 * Used by generatePartyMenu and section regeneration.
 * Throws on failure — callers should catch.
 */
export async function callClaudeWithPrompt(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const input: Record<string, unknown> = { prompt };
  if (systemPrompt) input.system = systemPrompt;
  const output = await runApp(LLM_APP, input);
  return extractText(output);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call Claude via inference.sh with full pantry + profile context.
 * Throws on failure — callers should catch and fall back to mock responses.
 */
export async function callAIChef(options: AiChefOptions): Promise<string> {
  const systemCtx = [
    "You are a world-class AI Chef. Be concise, warm, and practical.",
    `User pantry: ${options.pantryItems.slice(0, 20).join(", ") || "not specified"}.`,
    options.dietType?.length ? `Diet: ${options.dietType.join(", ")}.` : "",
    options.allergies?.length ? `Allergies: ${options.allergies.join(", ")}.` : "",
    options.skillLevel ? `Cooking skill: ${options.skillLevel}.` : "",
    options.cuisinePreferences?.length ? `Loves: ${options.cuisinePreferences.join(", ")}.` : "",
    options.goal ? `Cooking goal: ${options.goal}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fullPrompt = `${systemCtx}\n\nUser: ${options.prompt}`;
  const output = await runApp(LLM_APP, { prompt: fullPrompt });
  return extractText(output);
}

/**
 * Generate a recipe photo with FLUX via inference.sh.
 * Returns the image URL. Throws on failure.
 */
export async function generateRecipeImage(recipeName: string, cuisine: string): Promise<string> {
  const prompt = `professional food photography of ${recipeName}, ${cuisine} cuisine, overhead shot, natural lighting, appetizing, high resolution, on a beautiful plate`;
  const output = await runApp(IMAGE_APP, { prompt, num_images: 1, image_size: "square_hd" });

  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (Array.isArray(o.images) && o.images.length > 0) {
      const img = (o.images as Array<{ url?: string }>)[0];
      if (img?.url) return img.url;
    }
    if (typeof o.url === "string") return o.url;
  }
  throw new Error("No image URL returned by inference.sh");
}

/**
 * Generate a full party plan with Claude via inference.sh.
 * Throws on failure — callers should catch and fall back to SAMPLE_PLAN.
 */
export async function generatePartyMenu(
  options: GeneratePartyMenuOptions
): Promise<PartyPlan> {
  const { occasion, guestCount, servingStyle, budget, dietaryRestrictions, additionalPreferences, arrivalTime } =
    options;

  const safePreferences = (additionalPreferences ?? "").replace(/[`"\\]/g, " ").trim();
  const safeRestrictions =
    (dietaryRestrictions ?? [])
      .map((r) => r.replace(/[`"\\]/g, "").trim())
      .filter(Boolean)
      .join(", ") || "None";

  console.log(
    "[PartyPlanner] prompt:",
    JSON.stringify({ occasion, guestCount, servingStyle, budget, dietaryRestrictions, additionalPreferences, arrivalTime })
  );

  // Build dietary block — each restriction gets its own explicit "NO X" line so Claude can't miss it
  const dietaryBlock =
    (dietaryRestrictions ?? []).length > 0
      ? `
━━━ DIETARY RESTRICTIONS — ABSOLUTE HARD RULES — ZERO EXCEPTIONS ━━━
${(dietaryRestrictions ?? [])
  .map((r) => {
    const expansions: Record<string, string> = {
      "No pork": "NO PORK — no bacon, ham, prosciutto, lard, pork sausages, pork ribs, chorizo",
      "No beef": "NO BEEF — no beef sausages, burgers, steak, mince, brisket, beef stock, anything from cows",
      "No shellfish": "NO SHELLFISH — no prawns, shrimp, crab, lobster, oysters, mussels, clams",
      "No alcohol": "NO ALCOHOL — no wine, beer, spirits in cooking or as drinks",
      Vegetarian: "VEGETARIAN — no meat or fish of any kind whatsoever",
      Vegan: "VEGAN — no meat, fish, dairy, eggs, honey, or any animal product",
      Halal: "HALAL — all meat must be explicitly halal; absolutely no alcohol in cooking or drinks",
      Kosher: "KOSHER — follow strict kosher rules including no pork, no shellfish, no mixing of meat and dairy",
      "Gluten-free": "GLUTEN-FREE — no wheat, barley, rye, standard soy sauce, or any hidden gluten",
      "Dairy-free": "DAIRY-FREE — no milk, butter, cream, cheese, yoghurt, ghee",
      "Nut-free": "NUT-FREE — no nuts or nut oils (peanuts, almonds, cashews, etc.) anywhere",
      "Low spice": "LOW SPICE — no chilli, hot sauce, pepper, or any significant heat",
    };
    return `⛔ ${expansions[r] ?? `NO ${r.toUpperCase()}`}`;
  })
  .join("\n")}

CHECK EVERY SINGLE ITEM in menu, shoppingList, and hostTips against the rules above.
If ANY restricted ingredient appears anywhere in your response, that response is INVALID.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : "";

  // Build preferences block — make it a central design brief, not a footnote
  const preferencesBlock = safePreferences
    ? `
━━━ HOST'S SPECIAL REQUEST — BUILD THE ENTIRE MENU AROUND THIS ━━━
"${safePreferences}"
This is the host's vision. Every section (Mains, Sides, Drinks, Desserts) should reflect or complement this request.
Do NOT treat it as optional. If it names a dish style or technique, make that the centrepiece.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  // Occasion-specific cooking equipment rules
  const occasionRules: Record<string, string> = {
    BBQ: "BBQ means GRILL ONLY. No oven, no stove, no baking. Cold-prep sides (salads, dips, sliced fruit) are fine. No tarts, soufflés, or anything needing indoor kitchen equipment.",
    Picnic: "Picnic means cold or room-temperature foods only. Everything must be pre-made or assembly-based. No hot cooking equipment available.",
    "Dinner Party": "Full kitchen with oven, stove, and all equipment assumed. Plated courses are appropriate.",
    "Movie Night": "Simple, hand-held snacks. Minimal prep. No formal courses needed.",
    Brunch: "Brunch foods only — eggs, pastries, fruit, lighter fare. Suitable for mid-morning serving.",
  };
  const occasionRule = occasionRules[occasion] ?? "";

  const userPrompt = `You are an expert party planner. Generate a complete, realistic party plan.
${dietaryBlock}
${preferencesBlock}
━━━ EVENT DETAILS ━━━
Occasion: ${occasion}${occasionRule ? `\nOccasion rule: ${occasionRule}` : ""}
Number of guests: ${guestCount}
Serving style: ${servingStyle}
Total budget: $${budget} USD — this is the HARD MAXIMUM. Your totalEstimated MUST be ≤ $${budget}.
Guest arrival time: ${arrivalTime ? new Date(arrivalTime).toLocaleString() : "Not specified"}

━━━ JSON OUTPUT ━━━
Return ONLY a JSON object with this exact structure:
{
  "menu": [
    {
      "course": "string — one of: Mains, Sides, Drinks, Desserts, Snacks",
      "items": [
        {
          "name": "string",
          "quantity": "string e.g. 3kg for 15 people",
          "estimatedCost": number,
          "prepNote": "string — brief cook/prep instruction"
        }
      ]
    }
  ],
  "shoppingList": [
    { "item": "string", "quantity": "string", "estimatedCost": number }
  ],
  "timeline": [
    { "hoursBeforeArrival": number, "task": "string" }
  ],
  "costBreakdown": {
    "totalEstimated": number,
    "budgetRemaining": number,
    "costPerPerson": number
  },
  "hostTips": ["string"]
}
All number fields must be plain JSON numbers, never strings. Costs are USD floats rounded to 2 decimal places.
Return ONLY a JSON object. No markdown fences. No text before or after the JSON.`;

  const raw = await callClaudeWithPrompt(userPrompt, PARTY_SYSTEM_PROMPT);
  const parsed = parseClaudeJSON<PartyPlan>(raw);

  if (!Array.isArray(parsed.menu) || !Array.isArray(parsed.timeline)) {
    throw new Error("Invalid party plan structure from AI");
  }
  return parsed;
}
