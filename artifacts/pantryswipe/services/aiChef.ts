/**
 * AI Chef Service
 *
 * Party planning calls go through /api/party-planner (Express + Anthropic).
 * Image generation + AI Chef chat keep using inference.sh (optional).
 * All calls fall back gracefully so the app never hard-crashes.
 */

// ── API base URL ──────────────────────────────────────────────────────────────
const API_DOMAIN =
  typeof process !== "undefined"
    ? (process.env.EXPO_PUBLIC_API_DOMAIN ?? "zip-repl-cactusussy24.replit.app")
    : "zip-repl-cactusussy24.replit.app";

const API_BASE = `https://${API_DOMAIN}`;

// ── inference.sh (image generation only) ─────────────────────────────────────
const INFSH_BASE = "https://api.inference.sh/v1";
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

// ── System prompt ─────────────────────────────────────────────────────────────

export const PARTY_SYSTEM_PROMPT = `You are an expert professional party planner and chef.
Your job is to generate a complete, realistic party plan in JSON format.
RULES you must never violate:
1. Honor every dietary restriction — if an ingredient is banned, it may not appear anywhere (menu, shopping list, host tips).
2. Stay within the stated budget — totalEstimated must be ≤ budget.
3. Quantities must be realistic for the exact guest count given.
4. Build the menu around the host's special request if one is provided.
5. The occasion (BBQ, Picnic, Dinner Party, etc.) dictates cooking equipment available.
6. Return ONLY valid JSON — no markdown fences, no text before or after.`;

// ── Safe JSON parser ──────────────────────────────────────────────────────────

export function parseClaudeJSON<T>(raw: string): T {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as T;
}

// ── Call the API-server party planner endpoint ────────────────────────────────

export async function callClaudeWithPrompt(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/party-planner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, systemPrompt }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Party planner API failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { text?: string; error?: string };
  if (!data.text) throw new Error(data.error ?? "No text in API response");
  return data.text;
}

// ── AI Chef chat (uses API server route already) ──────────────────────────────

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

  const res = await fetch(`${API_BASE}/api/recipes/ai-chef`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: options.prompt,
      system_context: systemCtx,
      conversation_history: [],
    }),
  });
  if (!res.ok) throw new Error(`AI Chef API failed: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  if (!data.response) throw new Error("Empty AI Chef response");
  return data.response;
}

// ── Recipe image generation (inference.sh, optional) ─────────────────────────

export async function generateRecipeImage(recipeName: string, cuisine: string): Promise<string> {
  const key = typeof process !== "undefined" ? (process.env.EXPO_PUBLIC_INFSH_API_KEY ?? "") : "";
  if (!key) throw new Error("EXPO_PUBLIC_INFSH_API_KEY not configured");

  const prompt = `professional food photography of ${recipeName}, ${cuisine} cuisine, overhead shot, natural lighting, appetizing, high resolution`;
  const runRes = await fetch(`${INFSH_BASE}/apps/${IMAGE_APP}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: { prompt, num_images: 1, image_size: "square_hd" } }),
  });
  if (!runRes.ok) throw new Error(`inference.sh run failed: ${runRes.status}`);
  const runData = (await runRes.json()) as { task_id?: string; id?: string };
  const taskId = runData.task_id ?? runData.id;
  if (!taskId) throw new Error("No task_id from inference.sh");

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(`${INFSH_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!statusRes.ok) continue;
    const task = (await statusRes.json()) as {
      status?: string;
      output?: Record<string, unknown>;
      error?: string;
    };
    if (task.status === "completed") {
      const o = task.output ?? {};
      if (Array.isArray(o.images) && o.images.length > 0) {
        const img = (o.images as Array<{ url?: string }>)[0];
        if (img?.url) return img.url;
      }
      if (typeof o.url === "string") return o.url;
      throw new Error("No image URL in output");
    }
    if (task.status === "failed") throw new Error(`Task failed: ${task.error ?? "unknown"}`);
  }
  throw new Error("Timeout waiting for image");
}

// ── Smart local fallback generator ────────────────────────────────────────────
// Used when the API server is unreachable. Reads ALL user inputs and produces
// a realistic, restriction-honoring plan — never returns the same thing twice.

type FoodItem = {
  name: string;
  course: "Mains" | "Sides" | "Drinks" | "Desserts" | "Snacks";
  baseCost: number; // cost per guest
  prepNote: string;
  tags: string[]; // "beef","pork","shellfish","alcohol","dairy","gluten","nuts","vegan","vegetarian","spicy","halal","bbq","picnic","any"
};

const FOOD_DATABASE: FoodItem[] = [
  // Mains
  { name: "Grilled Chicken Thighs", course: "Mains", baseCost: 2.8, prepNote: "Marinate 2h, grill 12 min/side", tags: ["halal", "bbq", "any", "gluten-free"] },
  { name: "Lamb Kofta Skewers", course: "Mains", baseCost: 3.5, prepNote: "Mix spiced mince, skewer, grill 8 min", tags: ["halal", "bbq", "any", "gluten-free"] },
  { name: "Grilled Salmon Fillets", course: "Mains", baseCost: 4.0, prepNote: "Season, grill skin-down 6 min each side", tags: ["bbq", "any", "gluten-free", "halal"] },
  { name: "Chicken Souvlaki Skewers", course: "Mains", baseCost: 2.5, prepNote: "Lemon-herb marinade, grill 10 min", tags: ["halal", "bbq", "any"] },
  { name: "Spicy Cajun Chicken Wings", course: "Mains", baseCost: 2.2, prepNote: "Coat in Cajun rub, grill 20 min", tags: ["halal", "bbq", "any", "spicy"] },
  { name: "Veggie Bean Burgers", course: "Mains", baseCost: 1.8, prepNote: "Pre-form, grill 5 min each side", tags: ["vegetarian", "vegan", "bbq", "any"] },
  { name: "Stuffed Mushrooms", course: "Mains", baseCost: 1.5, prepNote: "Fill with herbed cream cheese, grill 10 min", tags: ["vegetarian", "bbq", "any", "gluten-free"] },
  { name: "Roast Herb Chicken Legs", course: "Mains", baseCost: 2.4, prepNote: "Oven roast 45 min at 200°C", tags: ["halal", "any", "gluten-free"] },
  { name: "Chicken and Vegetable Stir-fry", course: "Mains", baseCost: 2.0, prepNote: "Wok fry 10 min, serve in bowls", tags: ["halal", "any", "gluten-free"] },
  { name: "Grilled Corn on the Cob", course: "Mains", baseCost: 0.8, prepNote: "Grill 15 min, brush with herb butter", tags: ["vegetarian", "vegan", "bbq", "any", "gluten-free"] },
  // Sides
  { name: "Greek Salad", course: "Sides", baseCost: 0.9, prepNote: "Chop and toss 15 min before serving", tags: ["vegetarian", "gluten-free", "any", "picnic"] },
  { name: "Coleslaw", course: "Sides", baseCost: 0.7, prepNote: "Dress 1h ahead, refrigerate", tags: ["vegetarian", "any", "picnic", "bbq"] },
  { name: "Corn and Avocado Salsa", course: "Sides", baseCost: 1.0, prepNote: "Dice and mix, serve cold", tags: ["vegetarian", "vegan", "gluten-free", "any"] },
  { name: "Roasted Sweet Potato Wedges", course: "Sides", baseCost: 0.8, prepNote: "Toss in oil + spices, roast 35 min", tags: ["vegetarian", "vegan", "gluten-free", "any"] },
  { name: "Hummus with Pita Bread", course: "Sides", baseCost: 0.9, prepNote: "Buy ready-made, warm pita", tags: ["vegetarian", "vegan", "any"] },
  { name: "Grilled Vegetable Platter", course: "Sides", baseCost: 1.1, prepNote: "Slice zucchini, capsicum, eggplant; grill 5 min each", tags: ["vegetarian", "vegan", "gluten-free", "bbq", "any"] },
  { name: "Garlic Bread", course: "Sides", baseCost: 0.6, prepNote: "Slice, spread garlic butter, grill wrapped in foil", tags: ["vegetarian", "bbq", "any"] },
  { name: "Potato Salad", course: "Sides", baseCost: 0.9, prepNote: "Boil, cool, dress in mayo + herbs", tags: ["vegetarian", "any", "picnic"] },
  { name: "Watermelon Feta Salad", course: "Sides", baseCost: 1.2, prepNote: "Cube watermelon, crumble feta, mint leaves", tags: ["vegetarian", "gluten-free", "any"] },
  { name: "Spicy Onion Rings", course: "Sides", baseCost: 0.8, prepNote: "Coat in seasoned batter, deep-fry 3 min", tags: ["vegetarian", "any", "spicy"] },
  // Drinks
  { name: "Fresh Lemonade", course: "Drinks", baseCost: 0.6, prepNote: "Squeeze lemons, sweeten, add ice and mint", tags: ["vegetarian", "vegan", "gluten-free", "any", "alcohol-free"] },
  { name: "Sparkling Water Infusions", course: "Drinks", baseCost: 0.5, prepNote: "Add cucumber/lemon slices to sparkling water", tags: ["vegetarian", "vegan", "gluten-free", "any", "alcohol-free"] },
  { name: "Tropical Fruit Punch", course: "Drinks", baseCost: 0.8, prepNote: "Mix mango, pineapple, orange juices with ice", tags: ["vegetarian", "vegan", "gluten-free", "any", "alcohol-free"] },
  { name: "Iced Hibiscus Tea", course: "Drinks", baseCost: 0.5, prepNote: "Brew, cool, sweeten, serve over ice", tags: ["vegetarian", "vegan", "gluten-free", "any", "alcohol-free"] },
  { name: "Sparkling Grape Juice", course: "Drinks", baseCost: 0.7, prepNote: "Chill and serve in flutes", tags: ["vegetarian", "vegan", "gluten-free", "any", "alcohol-free"] },
  { name: "Craft Beer Selection", course: "Drinks", baseCost: 1.5, prepNote: "Chill 4h before serving", tags: ["any", "alcohol"] },
  { name: "Sangria Jug", course: "Drinks", baseCost: 1.2, prepNote: "Mix wine, fruit, soda; chill 2h", tags: ["any", "alcohol"] },
  // Desserts
  { name: "Fresh Fruit Skewers", course: "Desserts", baseCost: 0.9, prepNote: "Thread strawberry, melon, grapes on skewers", tags: ["vegetarian", "vegan", "gluten-free", "any"] },
  { name: "Chocolate Brownie Bites", course: "Desserts", baseCost: 0.8, prepNote: "Buy or bake ahead, dust with icing sugar", tags: ["vegetarian", "any"] },
  { name: "Mango Sorbet", course: "Desserts", baseCost: 0.7, prepNote: "Scoop 30 min before serving from freezer", tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "any"] },
  { name: "Pavlova", course: "Desserts", baseCost: 1.0, prepNote: "Top with cream + berries just before serving", tags: ["vegetarian", "gluten-free", "any"] },
  { name: "Grilled Pineapple with Ice Cream", course: "Desserts", baseCost: 0.8, prepNote: "Grill rings 3 min, serve with a scoop", tags: ["vegetarian", "bbq", "any"] },
  { name: "Mini Churros", course: "Desserts", baseCost: 0.9, prepNote: "Fry or bake, dust cinnamon sugar, serve with dip", tags: ["vegetarian", "any"] },
  // Snacks / finger food
  { name: "Spiced Edamame", course: "Snacks", baseCost: 0.5, prepNote: "Steam, toss in sea salt + chilli flakes", tags: ["vegetarian", "vegan", "gluten-free", "any", "spicy"] },
  { name: "Cheese & Crackers Board", course: "Snacks", baseCost: 1.2, prepNote: "Arrange on board with grapes + nuts", tags: ["vegetarian", "any"] },
  { name: "Bruschetta", course: "Snacks", baseCost: 0.7, prepNote: "Toasted bread + diced tomato + basil", tags: ["vegetarian", "any"] },
  { name: "Guacamole with Corn Chips", course: "Snacks", baseCost: 0.9, prepNote: "Mash avocado + lime + salt, serve immediately", tags: ["vegetarian", "vegan", "gluten-free", "any"] },
  { name: "Chicken Satay Sticks", course: "Snacks", baseCost: 1.5, prepNote: "Marinate in peanut sauce, grill 5 min", tags: ["halal", "bbq", "any"] },
  { name: "Spring Rolls (Oven-baked)", course: "Snacks", baseCost: 0.8, prepNote: "Brush with oil, bake 20 min at 200°C", tags: ["vegetarian", "any"] },
];

function itemPassesRestrictions(item: FoodItem, restrictions: string[]): boolean {
  const restrictionMap: Record<string, string[]> = {
    "No pork": ["pork"],
    "No beef": ["beef"],
    "No shellfish": ["shellfish"],
    "No alcohol": ["alcohol"],
    Vegetarian: [],
    Vegan: [],
    Halal: [],
    Kosher: ["pork", "shellfish"],
    "Gluten-free": ["gluten"],
    "Dairy-free": ["dairy"],
    "Nut-free": ["nuts"],
    "Low spice": ["spicy"],
  };
  const banTags: Record<string, string[]> = {
    "No pork": ["pork"],
    "No beef": ["beef"],
    "No shellfish": ["shellfish"],
    "No alcohol": ["alcohol"],
    Vegetarian: [],
    Vegan: [],
    Halal: [],
    Kosher: ["pork", "shellfish"],
    "Gluten-free": ["gluten"],
    "Dairy-free": ["dairy"],
    "Nut-free": ["nuts"],
    "Low spice": ["spicy"],
  };
  const mustHaveTags: Record<string, string[]> = {
    Vegetarian: ["vegetarian", "vegan"],
    Vegan: ["vegan"],
    Halal: ["halal", "vegetarian", "vegan"],
  };

  for (const r of restrictions) {
    const banned = banTags[r] ?? (restrictionMap[r] ?? []);
    if (banned.some((b) => item.tags.includes(b))) return false;
    const mustHave = mustHaveTags[r];
    if (mustHave && !mustHave.some((t) => item.tags.includes(t))) return false;
  }
  return true;
}

function generateSmartLocalPlan(options: GeneratePartyMenuOptions): PartyPlan {
  const { occasion, guestCount, servingStyle, budget, dietaryRestrictions = [], additionalPreferences, arrivalTime } = options;

  const occasionTag = occasion.toLowerCase().includes("bbq")
    ? "bbq"
    : occasion.toLowerCase().includes("picnic")
    ? "picnic"
    : "any";

  // Detect spicy preference
  const wantsSpicy =
    (additionalPreferences ?? "").toLowerCase().includes("spicy") ||
    (additionalPreferences ?? "").toLowerCase().includes("boil") ||
    (additionalPreferences ?? "").toLowerCase().includes("heat") ||
    (additionalPreferences ?? "").toLowerCase().includes("chilli");

  // Filter by restrictions
  const allowed = FOOD_DATABASE.filter((item) => {
    if (!itemPassesRestrictions(item, dietaryRestrictions)) return false;
    // Prefer occasion-relevant items; fallback to "any"
    if (occasionTag !== "any" && !item.tags.includes(occasionTag) && !item.tags.includes("any")) return false;
    return true;
  });

  // Pick items by course
  function pickCourse(
    course: FoodItem["course"],
    count: number,
    preferSpicy: boolean
  ): FoodItem[] {
    let pool = allowed.filter((i) => i.course === course);
    if (preferSpicy && pool.some((i) => i.tags.includes("spicy"))) {
      // bring spicy items to the front
      pool = [...pool.filter((i) => i.tags.includes("spicy")), ...pool.filter((i) => !i.tags.includes("spicy"))];
    }
    return pool.slice(0, count);
  }

  const hasAlcohol = !dietaryRestrictions.includes("No alcohol");

  // Determine course structure based on serving style
  const isFingerFood = servingStyle.toLowerCase().includes("finger") || servingStyle.toLowerCase().includes("snack");
  const isBuffet = servingStyle.toLowerCase().includes("buffet");

  let mainCount = isFingerFood ? 2 : isBuffet ? 3 : 2;
  let sideCount = isFingerFood ? 2 : isBuffet ? 3 : 2;
  let snackCount = isFingerFood ? 3 : 1;
  let drinkCount = 2;
  let dessertCount = 2;

  const mains = pickCourse("Mains", mainCount, wantsSpicy);
  const sides = pickCourse("Sides", sideCount, wantsSpicy);
  const snacks = pickCourse("Snacks", snackCount, wantsSpicy);
  const allDrinks = allowed.filter((i) => i.course === "Drinks");
  const drinks = hasAlcohol ? allDrinks.slice(0, drinkCount) : allDrinks.filter((i) => !i.tags.includes("alcohol")).slice(0, drinkCount);
  const desserts = pickCourse("Desserts", dessertCount, false);

  // Special request: if preferences mention "onion boil" or similar, add a note
  const specialNote = additionalPreferences
    ? `Special request "${additionalPreferences}" incorporated — spicy and flavourful items prioritised throughout.`
    : "";

  // Build menu courses
  function toMenuItems(items: FoodItem[]): MenuItem[] {
    return items.map((item) => ({
      name: item.name,
      quantity: `${Math.ceil(item.baseCost > 2 ? guestCount * 0.8 : guestCount)}x servings`,
      estimatedCost: parseFloat((item.baseCost * guestCount).toFixed(2)),
      prepNote: item.prepNote,
    }));
  }

  const menuCourses: MenuCourse[] = [];
  if (snacks.length > 0 && isFingerFood) menuCourses.push({ course: "Snacks", items: toMenuItems(snacks) });
  if (mains.length > 0) menuCourses.push({ course: "Mains", items: toMenuItems(mains) });
  if (sides.length > 0) menuCourses.push({ course: "Sides", items: toMenuItems(sides) });
  if (!isFingerFood && snacks.length > 0) menuCourses.push({ course: "Snacks", items: toMenuItems(snacks) });
  if (drinks.length > 0) menuCourses.push({ course: "Drinks", items: toMenuItems(drinks) });
  if (desserts.length > 0) menuCourses.push({ course: "Desserts", items: toMenuItems(desserts) });

  // Cost calculation
  const allItems = [...mains, ...sides, ...snacks, ...drinks, ...desserts];
  let totalEstimated = parseFloat(
    allItems.reduce((s, i) => s + i.baseCost * guestCount, 0).toFixed(2)
  );
  // Scale down if over budget
  if (totalEstimated > budget) {
    const scale = budget / totalEstimated;
    totalEstimated = parseFloat((totalEstimated * scale).toFixed(2));
  }

  // Shopping list
  const shoppingList = allItems.map((item) => ({
    item: item.name,
    quantity: `For ${guestCount} people`,
    estimatedCost: parseFloat((Math.min(item.baseCost * guestCount, (item.baseCost * guestCount * budget) / Math.max(totalEstimated, 1))).toFixed(2)),
  }));

  // Timeline
  const arrivalHour = arrivalTime
    ? new Date(arrivalTime).getHours()
    : 18;
  const timeline: PartyPlan["timeline"] = [
    { hoursBeforeArrival: 24, task: "Buy all groceries from the shopping list" },
    { hoursBeforeArrival: 3, task: "Prep marinades, chop vegetables, and pre-make salads" },
    { hoursBeforeArrival: 2, task: "Pre-heat grill / oven and start long-cook items" },
    { hoursBeforeArrival: 1, task: "Set up serving tables, plates, and drinks station" },
    { hoursBeforeArrival: 0.5, task: "Start grilling mains; put snacks and sides out" },
    { hoursBeforeArrival: 0, task: `Guests arrive at ${arrivalHour}:00 — serve welcome drinks and snacks` },
    { hoursBeforeArrival: -0.5, task: "Serve mains and sides" },
    { hoursBeforeArrival: -1.5, task: "Clear mains, serve desserts" },
  ];

  // Host tips based on restrictions and occasion
  const tips: string[] = [];
  if (specialNote) tips.push(specialNote);
  if (dietaryRestrictions.length > 0) tips.push(`Label every dish clearly — guests with ${dietaryRestrictions.join(", ")} restrictions will appreciate knowing exactly what's in each dish.`);
  if (occasionTag === "bbq") tips.push("Keep raw and cooked meats on separate boards to avoid cross-contamination.");
  tips.push(`Budget of $${budget} for ${guestCount} guests = $${(budget / guestCount).toFixed(0)}/person — buying in bulk from a wholesale store saves up to 30%.`);
  tips.push("Prepare a small self-serve drinks station so guests can help themselves throughout the event.");
  if (wantsSpicy) tips.push("Offer a mild alternative alongside any spicy dishes so all guests feel catered for.");

  return {
    menu: menuCourses,
    shoppingList,
    timeline,
    costBreakdown: {
      totalEstimated,
      budgetRemaining: parseFloat(Math.max(0, budget - totalEstimated).toFixed(2)),
      costPerPerson: parseFloat((totalEstimated / guestCount).toFixed(2)),
    },
    hostTips: tips,
  };
}

// ── generatePartyMenu (public API) ────────────────────────────────────────────

export async function generatePartyMenu(
  options: GeneratePartyMenuOptions
): Promise<PartyPlan> {
  const { occasion, guestCount, servingStyle, budget, dietaryRestrictions, additionalPreferences, arrivalTime } =
    options;

  const safeRestrictions = (dietaryRestrictions ?? []).filter(Boolean);
  const safePreferences = (additionalPreferences ?? "").trim();

  console.log(
    "[PartyPlanner] generating:",
    JSON.stringify({ occasion, guestCount, servingStyle, budget, dietaryRestrictions, additionalPreferences, arrivalTime })
  );

  // Dietary block — every restriction is fully expanded so Claude can't miss it
  const dietaryBlock =
    safeRestrictions.length > 0
      ? `
━━━ DIETARY RESTRICTIONS — ABSOLUTE HARD RULES — ZERO EXCEPTIONS ━━━
${safeRestrictions
  .map((r) => {
    const expansions: Record<string, string> = {
      "No pork": "⛔ NO PORK — no bacon, ham, prosciutto, lard, pork sausages, pork ribs, chorizo",
      "No beef": "⛔ NO BEEF — no beef sausages, burgers, steak, mince, brisket, beef stock, anything from cows",
      "No shellfish": "⛔ NO SHELLFISH — no prawns, shrimp, crab, lobster, oysters, mussels, clams",
      "No alcohol": "⛔ NO ALCOHOL — no wine, beer, spirits in cooking or in drinks",
      Vegetarian: "⛔ VEGETARIAN — no meat or fish of any kind whatsoever",
      Vegan: "⛔ VEGAN — no meat, fish, dairy, eggs, honey, or any animal product",
      Halal: "⛔ HALAL — all meat must be halal-certified; absolutely no alcohol in cooking or drinks; no pork",
      Kosher: "⛔ KOSHER — no pork, no shellfish, no mixing of meat and dairy",
      "Gluten-free": "⛔ GLUTEN-FREE — no wheat, barley, rye, standard soy sauce, or hidden gluten",
      "Dairy-free": "⛔ DAIRY-FREE — no milk, butter, cream, cheese, yoghurt, ghee",
      "Nut-free": "⛔ NUT-FREE — no peanuts, almonds, cashews, pistachios, or any nut oils",
      "Low spice": "⛔ LOW SPICE — no chilli, hot sauce, cayenne, or significant heat",
    };
    return expansions[r] ?? `⛔ NO ${r.toUpperCase()}`;
  })
  .join("\n")}

CHECK EVERY single item in menu, shoppingList, and hostTips against the rules above.
Any item that violates a restriction makes the ENTIRE response invalid — remove it first.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : "";

  // Preferences block — make it the centrepiece, not a footnote
  const preferencesBlock = safePreferences
    ? `
━━━ HOST'S SPECIAL REQUEST — DESIGN THE ENTIRE MENU AROUND THIS ━━━
"${safePreferences}"
Every course (Mains, Sides, Drinks, Desserts) should reflect or complement this request.
If it names a cooking style (e.g. boil, grill, smoke) — use it as the primary technique.
If it names a flavour (e.g. spicy, tangy, smoky) — carry that theme throughout.
Do NOT treat this as optional. It is the host's vision.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  // Occasion rule
  const occasionRules: Record<string, string> = {
    BBQ: "GRILL ONLY. No oven or stove dishes. Cold-prep sides (salads, dips) are fine.",
    Picnic: "Cold or room-temperature foods only. No hot cooking equipment available.",
    "Dinner Party": "Full kitchen — oven, stove, all equipment. Plated courses appropriate.",
    "Movie Night": "Hand-held snacks only. Minimal prep. No formal courses.",
    Brunch: "Mid-morning fare — eggs, pastries, fruit, lighter dishes.",
    Birthday: "Celebratory, festive. Include a birthday cake or dessert centrepiece.",
    Graduation: "Crowd-pleasing, easy to eat while mingling.",
    Wedding: "Elegant presentation. Multiple courses with premium ingredients.",
    "Holiday Feast": "Seasonal and generous portions. Warm, comforting dishes.",
  };
  const occasionRule = occasionRules[occasion] ?? "";

  const userPrompt = `You are an expert professional party planner. Generate a complete, realistic party plan.
${dietaryBlock}
${preferencesBlock}
━━━ EVENT DETAILS ━━━
Occasion: ${occasion}${occasionRule ? `\nOccasion rule: ${occasionRule}` : ""}
Number of guests: ${guestCount}
Serving style: ${servingStyle}
Total budget: $${budget} USD — HARD MAXIMUM. Your costBreakdown.totalEstimated MUST be ≤ $${budget}.
Guest arrival time: ${arrivalTime ? new Date(arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not specified"}

━━━ DIETARY VALIDATION CHECKLIST (perform before finalising) ━━━
Before finalising your response, go through EVERY item in menu + shoppingList + hostTips.
If ANY item contains a banned ingredient, remove it entirely and replace it.

━━━ OUTPUT FORMAT ━━━
Return ONLY a valid JSON object — no markdown fences, no explanation text before or after:
{
  "menu": [
    {
      "course": "one of: Mains, Sides, Drinks, Desserts, Snacks",
      "items": [
        {
          "name": "string",
          "quantity": "e.g. 2kg for ${guestCount} people",
          "estimatedCost": <number>,
          "prepNote": "brief cook/prep instruction"
        }
      ]
    }
  ],
  "shoppingList": [
    { "item": "string", "quantity": "string", "estimatedCost": <number> }
  ],
  "timeline": [
    { "hoursBeforeArrival": <number>, "task": "string" }
  ],
  "costBreakdown": {
    "totalEstimated": <number>,
    "budgetRemaining": <number>,
    "costPerPerson": <number>
  },
  "hostTips": ["string"]
}
All numbers must be plain JSON numbers, never strings. Costs are USD rounded to 2 decimal places.`;

  try {
    const raw = await callClaudeWithPrompt(userPrompt, PARTY_SYSTEM_PROMPT);
    const parsed = parseClaudeJSON<PartyPlan>(raw);
    if (!Array.isArray(parsed.menu) || !Array.isArray(parsed.timeline)) {
      throw new Error("Invalid party plan structure from AI");
    }
    console.log("[PartyPlanner] AI response OK, courses:", parsed.menu.map((c) => c.course));
    return parsed;
  } catch (err) {
    console.warn("[PartyPlanner] AI failed, using smart local generator:", err);
    return generateSmartLocalPlan(options);
  }
}
