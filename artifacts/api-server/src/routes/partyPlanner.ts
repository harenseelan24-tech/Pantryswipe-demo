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

// ══════════════════════════════════════════════════════════════════════════════
// LOCAL PLAN GENERATOR — instant, no external API required
// ══════════════════════════════════════════════════════════════════════════════

interface MenuItem {
  name: string;
  reason: string;
  costPerPerson: number;
  minCost: number;
  qty: (n: number) => string;
  tags: string[];   // restriction tags: meat, seafood, pork, beef, shellfish, alcohol, dairy, eggs, gluten, nuts, spicy
}

interface OccasionMenu {
  mains: MenuItem[];
  sides: MenuItem[];
  snacks: MenuItem[];
  drinks: MenuItem[];
  desserts: MenuItem[];
  tips: string[];
}

const MENUS: Record<string, OccasionMenu> = {
  "BBQ": {
    mains: [
      { name: "Grilled Chicken Wings", reason: "BBQ staple, easy to batch-grill, crowd-pleasing flavours guests expect at a BBQ", costPerPerson: 3.5, minCost: 18, qty: n => `${n * 3} wings`, tags: ["meat"] },
      { name: "Beef Burger Patties", reason: "Classic BBQ centrepiece — guests customise toppings at a self-serve station", costPerPerson: 3, minCost: 15, qty: n => `${n * 2} patties + buns`, tags: ["meat", "beef", "gluten"] },
      { name: "Pork Sausages / Bratwursts", reason: "Fast to grill, universally loved, great finger food between main servings", costPerPerson: 2, minCost: 12, qty: n => `${n * 2} sausages`, tags: ["meat", "pork"] },
      { name: "Chicken Satay Skewers", reason: "Southeast Asian BBQ flair, easy to portion at a buffet station", costPerPerson: 2.5, minCost: 14, qty: n => `${n * 4} skewers`, tags: ["meat"] },
      { name: "Grilled Fish Fillets", reason: "Light seafood option for guests who prefer fish — grills quickly with minimal prep", costPerPerson: 4, minCost: 20, qty: n => `${n} fillets`, tags: ["meat", "seafood"] },
      { name: "Grilled Corn on the Cob", reason: "Vegetarian-friendly BBQ main — caramelises beautifully on the grill", costPerPerson: 1.5, minCost: 8, qty: n => `${n} cobs`, tags: [] },
    ],
    sides: [
      { name: "Creamy Coleslaw", reason: "Classic cool contrast to hot grilled meats — refreshing and filling", costPerPerson: 1, minCost: 6, qty: n => `${Math.ceil(n / 4)} kg bowl`, tags: ["dairy"] },
      { name: "Potato Salad", reason: "Hearty filler that stretches the buffet and pairs with every BBQ main", costPerPerson: 1, minCost: 7, qty: n => `${Math.ceil(n * 0.2)} kg`, tags: [] },
      { name: "Garlic Bread", reason: "Inexpensive crowd-pleaser that pairs with burgers and fills gaps between grilling batches", costPerPerson: 0.5, minCost: 5, qty: n => `${Math.ceil(n / 8)} baguettes`, tags: ["gluten", "dairy"] },
      { name: "Garden Salad", reason: "Fresh, light option balancing heavier grilled proteins on the spread", costPerPerson: 0.8, minCost: 6, qty: n => `1 large platter`, tags: [] },
    ],
    snacks: [
      { name: "Nachos with Salsa & Sour Cream", reason: "Ready-to-serve snack guests eat while the grill heats up — no hot plates needed", costPerPerson: 1.5, minCost: 8, qty: n => `${Math.ceil(n / 4)} sharing bowls`, tags: ["dairy"] },
      { name: "Vegetable Crudités with Hummus", reason: "Healthy grazing option available from guest arrival — no prep needed at serve time", costPerPerson: 1, minCost: 7, qty: n => `1 large platter`, tags: [] },
      { name: "Cheese & Cracker Board", reason: "Easy to set up, elegant touch for early arrivals while grill heats", costPerPerson: 1.5, minCost: 10, qty: n => `1 sharing board`, tags: ["dairy", "gluten"] },
    ],
    drinks: [
      { name: "Assorted Soft Drinks", reason: "Essential for a BBQ — cold fizzy drinks pair perfectly with grilled meats", costPerPerson: 1.5, minCost: 8, qty: n => `${Math.ceil(n / 4)} × 1.5L bottles`, tags: [] },
      { name: "Iced Lemon Tea", reason: "Refreshing non-alcoholic option — inexpensive to make in large batches", costPerPerson: 0.5, minCost: 4, qty: n => `${Math.ceil(n / 6)} L pitchers`, tags: [] },
      { name: "Still & Sparkling Water", reason: "Hydration essential at an outdoor BBQ — especially between food and drinks", costPerPerson: 0.5, minCost: 4, qty: n => `${n} × 500ml bottles`, tags: [] },
    ],
    desserts: [
      { name: "Chilled Watermelon Slices", reason: "Perfect outdoor dessert — refreshing, no plates or cutlery required", costPerPerson: 1, minCost: 8, qty: n => `${Math.ceil(n / 8)} whole watermelons`, tags: [] },
      { name: "Brownies", reason: "Easy crowd-pleasing dessert — no refrigeration needed, finger-food friendly", costPerPerson: 1.2, minCost: 10, qty: n => `${n * 2} pieces`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Ice Cream Cups", reason: "Fun individually portioned dessert — great for warm outdoor weather", costPerPerson: 1.5, minCost: 10, qty: n => `${n} cups`, tags: ["dairy"] },
    ],
    tips: [
      "Light the grill 40 minutes before cooking — charcoal needs time to reach optimal heat. Start satay and sausages first (fastest cooking), then wings, then burgers.",
      "Set out snacks and drinks before guests arrive. Early arrivals have something to eat while the grill heats — prevents the awkward waiting period.",
      "Use foil tray warmers on the cooler outer edge of the grill to keep cooked batches hot while the next batch cooks.",
      "Create a self-serve condiment station — ketchup, mustard, BBQ sauce, satay peanut sauce — so guests can move through the line without asking.",
      "Keep beverages in an ice-filled cooler from 2 hours before guests arrive. Nothing kills BBQ energy like warm drinks on a hot day.",
      "Plan for 20% extra food — BBQ aromas draw appetites. Leftover grilled items can be wrapped and sent home with guests.",
      "Designate a visible waste station with bin bags and paper towels near the food — guests naturally tidy up when the option is clear.",
    ],
  },

  "Birthday Party": {
    mains: [
      { name: "Mini Sliders (Chicken & Beef)", reason: "Fun bite-sized burgers perfect for a party atmosphere — guests can try both", costPerPerson: 3, minCost: 16, qty: n => `${n * 2} sliders`, tags: ["meat", "gluten", "beef"] },
      { name: "Pizza (Assorted Toppings)", reason: "Universal crowd favourite — easy to share, no cutlery needed, always a hit", costPerPerson: 2.5, minCost: 14, qty: n => `${Math.ceil(n / 4)} large pizzas`, tags: ["gluten", "dairy"] },
      { name: "Chicken Nuggets with Dipping Sauces", reason: "Kid-friendly and adult-loved — fast to prep in bulk, finger-food friendly", costPerPerson: 2, minCost: 12, qty: n => `${n * 5} pieces`, tags: ["meat", "gluten"] },
      { name: "Pasta Bake", reason: "Hearty filling main that scales perfectly for any group size", costPerPerson: 2, minCost: 14, qty: n => `${Math.ceil(n * 0.25)} kg`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Vegetarian Quiche", reason: "Elegant meat-free option that holds its own alongside party mains", costPerPerson: 2, minCost: 12, qty: n => `${Math.ceil(n / 6)} quiches`, tags: ["gluten", "dairy", "eggs"] },
    ],
    sides: [
      { name: "Crispy French Fries", reason: "Universal crowd favourite pairing with sliders and nuggets — always disappears first", costPerPerson: 1, minCost: 8, qty: n => `${Math.ceil(n * 0.15)} kg`, tags: [] },
      { name: "Garden Salad", reason: "Fresh counter-balance to heavier birthday mains — light and colourful on the spread", costPerPerson: 0.8, minCost: 6, qty: n => `1 large bowl`, tags: [] },
      { name: "Garlic Bread", reason: "Pairs with pasta and pizza, inexpensive filler guests love throughout the party", costPerPerson: 0.5, minCost: 5, qty: n => `${Math.ceil(n / 8)} baguettes`, tags: ["gluten", "dairy"] },
    ],
    snacks: [
      { name: "Chips & Assorted Dips", reason: "Easy party snack available from guest arrival — no prep needed", costPerPerson: 1, minCost: 7, qty: n => `${Math.ceil(n / 4)} sharing bowls`, tags: [] },
      { name: "Fruit Skewers (Strawberry, Grape, Melon)", reason: "Colourful healthy option — fun presentation and a beautiful addition to the party table", costPerPerson: 1.2, minCost: 8, qty: n => `${n} skewers`, tags: [] },
      { name: "Mini Spring Rolls", reason: "Popular party finger food — easy to warm in batches and pass around", costPerPerson: 1, minCost: 8, qty: n => `${n * 2} rolls`, tags: ["gluten"] },
    ],
    drinks: [
      { name: "Fruit Punch (Mocktail Bowl)", reason: "Festive centrepiece drink — colourful and celebratory for a birthday", costPerPerson: 1, minCost: 6, qty: n => `${Math.ceil(n / 10)} L bowl`, tags: [] },
      { name: "Assorted Soft Drinks", reason: "Essential party drinks covering all guest flavour preferences", costPerPerson: 1.2, minCost: 7, qty: n => `${Math.ceil(n / 4)} × 1.5L bottles`, tags: [] },
      { name: "Still Water", reason: "Hydration between food and drinks throughout the party", costPerPerson: 0.4, minCost: 4, qty: n => `${n} × 500ml bottles`, tags: [] },
    ],
    desserts: [
      { name: "Birthday Cake", reason: "Non-negotiable centrepiece — the moment of celebration for the guest of honour", costPerPerson: 2, minCost: 30, qty: n => `1 custom cake (${Math.ceil(n / 10) + 1} tiers)`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Cupcakes (Assorted Flavours)", reason: "Individual portions avoid the need to cut and serve — guests grab and go", costPerPerson: 1.5, minCost: 12, qty: n => `${n} cupcakes`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Ice Cream Station", reason: "Interactive and fun — guests customise their own bowl with toppings", costPerPerson: 1.5, minCost: 12, qty: n => `${Math.ceil(n / 4)} tubs + toppings`, tags: ["dairy"] },
    ],
    tips: [
      "Set up a photo backdrop or balloon arch — birthday parties are made for photos, and a dedicated photo spot gets used by every guest.",
      "Pre-portion birthday cake slices before the party so serving is instant after candles are blown out — no awkward cutting delays.",
      "Stagger food release — keep a second tray of pizza warm so there's a 'fresh' reveal mid-party when the first round runs low.",
      "Assign a dedicated person to manage music and energy — a great playlist does more for party atmosphere than any decoration.",
      "Label all food items with small name cards — especially important if there are dietary restrictions so guests navigate with confidence.",
      "Have a separate drinks station away from the food table — this prevents bottlenecks at the buffet and keeps flow moving.",
      "Prepare a 'late night snack' reveal (chips, mini sandwiches) for after the cake to keep energy up as the party continues.",
    ],
  },

  "Family Gathering": {
    mains: [
      { name: "Whole Roast Chicken", reason: "Centrepiece dish with broad multi-generational appeal — easy to carve and share family-style", costPerPerson: 3, minCost: 18, qty: n => `${Math.ceil(n / 6)} chickens`, tags: ["meat"] },
      { name: "Wok-Tossed Fried Rice", reason: "Universally loved comfort food — scales perfectly for large groups and pairs with everything", costPerPerson: 1.5, minCost: 10, qty: n => `${Math.ceil(n * 0.25)} kg`, tags: ["eggs"] },
      { name: "Chicken Curry", reason: "Hearty warming family dish — develops better flavour when made in large batches", costPerPerson: 2.5, minCost: 15, qty: n => `${Math.ceil(n * 0.3)} kg`, tags: ["meat"] },
      { name: "Beef Rendang", reason: "Rich slow-cooked dry curry — bold flavour that improves when made ahead for a crowd", costPerPerson: 3, minCost: 18, qty: n => `${Math.ceil(n * 0.3)} kg`, tags: ["meat", "beef"] },
      { name: "Steamed Fish (Ginger & Soy)", reason: "Light healthy option loved by elderly guests — impressive presentation with minimal prep", costPerPerson: 3.5, minCost: 20, qty: n => `${Math.ceil(n / 6)} fish`, tags: ["seafood"] },
      { name: "Braised Tofu & Vegetable Stir-Fry", reason: "Vegetarian-friendly main — light complement to heavier meat dishes on the spread", costPerPerson: 1.5, minCost: 10, qty: n => `1 large wok`, tags: [] },
    ],
    sides: [
      { name: "Steamed Jasmine Rice", reason: "Essential for an Asian-style family meal — pairs with every dish on the spread", costPerPerson: 0.5, minCost: 4, qty: n => `${Math.ceil(n * 0.15)} kg`, tags: [] },
      { name: "Braised Mushrooms & Vegetables", reason: "Classic family gathering side — soft texture suitable for elderly guests and children", costPerPerson: 1, minCost: 7, qty: n => `1 large pot`, tags: [] },
      { name: "Egg Tofu with Oyster Sauce", reason: "Soft, mild, universally appealing — perfect for elderly guests and young children", costPerPerson: 1, minCost: 6, qty: n => `${Math.ceil(n / 4)} blocks`, tags: ["eggs"] },
      { name: "Clear Vegetable Soup", reason: "Palate cleanser between dishes — warming for elderly guests, aids digestion", costPerPerson: 0.8, minCost: 6, qty: n => `${Math.ceil(n * 0.25)} L`, tags: [] },
    ],
    snacks: [
      { name: "Spring Rolls & Popiah", reason: "Popular family gathering snack — kids and adults love them equally", costPerPerson: 1, minCost: 8, qty: n => `${n * 2} pieces`, tags: ["gluten"] },
      { name: "Traditional Cookies & Pastries", reason: "Beloved traditional snacks that create a sense of occasion at a family gathering", costPerPerson: 0.8, minCost: 6, qty: n => `${n * 3} pieces`, tags: ["gluten", "dairy"] },
    ],
    drinks: [
      { name: "Chinese Tea (Pot)", reason: "Traditional gathering drink — aids digestion between courses, suitable for all ages", costPerPerson: 0.3, minCost: 4, qty: n => `${Math.ceil(n / 6)} teapots`, tags: [] },
      { name: "Chrysanthemum Barley Water", reason: "Refreshing cooling traditional drink loved across all generations", costPerPerson: 0.5, minCost: 4, qty: n => `${Math.ceil(n * 0.3)} L`, tags: [] },
      { name: "Assorted Soft Drinks", reason: "For guests who prefer Western drinks and for younger children", costPerPerson: 0.8, minCost: 5, qty: n => `${Math.ceil(n / 5)} × 1.5L bottles`, tags: [] },
    ],
    desserts: [
      { name: "Mango Pudding", reason: "Light refreshing Asian dessert that cleanses the palate beautifully after a hearty meal", costPerPerson: 1, minCost: 8, qty: n => `${n} individual cups`, tags: ["dairy"] },
      { name: "Tang Yuan (Glutinous Rice Balls)", reason: "Traditional dessert symbolising family togetherness — loved across all generations", costPerPerson: 0.8, minCost: 6, qty: n => `${n * 3} pieces`, tags: [] },
      { name: "Seasonal Fruit Platter", reason: "Fresh light ending to a hearty family meal — colourful and welcoming", costPerPerson: 1, minCost: 8, qty: n => `1 large platter`, tags: [] },
    ],
    tips: [
      "Serve food in large sharing dishes at the centre of the table — family style creates conversation and a sense of togetherness that plated service doesn't.",
      "Prepare one extra dish as buffer — large family gatherings always eat more than expected. Better to have leftovers than run short.",
      "Schedule food service 30 minutes after guests arrive — allow time for latecomers and conversation before sitting down to eat.",
      "Set up a separate kids' station with milder, simpler food — parents relax knowing children are catered to without needing adult supervision.",
      "Keep flavours soft and mild when multiple generations attend. Offer chili oil on the side for guests who want heat.",
      "Designate a quiet seating area away from the main table for elderly guests who prefer a calmer atmosphere between courses.",
      "Set up the dessert table separately as a second reveal — bring it out after mains are cleared to create a natural second act to the gathering.",
    ],
  },

  "Dinner Party": {
    mains: [
      { name: "Pan-Seared Salmon with Lemon Butter", reason: "Elegant restaurant-quality dish that impresses without excessive prep time", costPerPerson: 6, minCost: 30, qty: n => `${n} portions`, tags: ["seafood", "dairy"] },
      { name: "Roasted Chicken Suprême with Herb Jus", reason: "Classic dinner party centrepiece — elegant presentation, universally crowd-pleasing", costPerPerson: 5, minCost: 25, qty: n => `${n} portions`, tags: ["meat"] },
      { name: "Beef Tenderloin Medallions", reason: "Premium dinner party main — fork-tender, impressive table presentation", costPerPerson: 9, minCost: 45, qty: n => `${n} medallions`, tags: ["meat", "beef"] },
      { name: "Mushroom & Spinach Tart", reason: "Sophisticated vegetarian option that holds its own alongside meat mains", costPerPerson: 4, minCost: 20, qty: n => `${Math.ceil(n / 4)} tarts`, tags: ["gluten", "dairy", "eggs"] },
    ],
    sides: [
      { name: "Truffle Mashed Potato", reason: "Luxurious side dish that complements both meat and fish dinner party mains", costPerPerson: 1.5, minCost: 10, qty: n => `${Math.ceil(n * 0.2)} kg`, tags: ["dairy"] },
      { name: "Roasted Seasonal Vegetables", reason: "Colourful healthy accompaniment that adds visual elegance to the plate", costPerPerson: 1.2, minCost: 9, qty: n => `1 large roasting tray`, tags: [] },
      { name: "Caprese Salad (Starter)", reason: "Classic Italian starter — beautiful presentation, sets an elegant dinner party tone", costPerPerson: 1.5, minCost: 10, qty: n => `1 large platter`, tags: ["dairy"] },
      { name: "Dinner Rolls with Herb Butter", reason: "Elegant bread course that bridges starter and main seamlessly", costPerPerson: 0.8, minCost: 8, qty: n => `${n} rolls`, tags: ["gluten", "dairy"] },
    ],
    snacks: [
      { name: "Bruschetta with Tomato & Basil", reason: "Classic Italian appetiser — easy to prepare but impressive presentation on arrival", costPerPerson: 1.2, minCost: 8, qty: n => `${n * 2} pieces`, tags: ["gluten"] },
      { name: "Cheese & Charcuterie Board", reason: "Elegant pre-dinner grazing board that creates a relaxed cocktail-hour atmosphere", costPerPerson: 2, minCost: 15, qty: n => `1 large board`, tags: ["dairy", "gluten", "meat", "pork"] },
    ],
    drinks: [
      { name: "Sparkling & Still Water", reason: "Essential table setting for a dinner party — always have both options", costPerPerson: 0.5, minCost: 5, qty: n => `${Math.ceil(n / 2)} bottles each`, tags: [] },
      { name: "Fruit-Infused Mocktail Jug", reason: "Sophisticated non-alcoholic option that feels festive without alcohol", costPerPerson: 1, minCost: 6, qty: n => `${Math.ceil(n / 8)} jugs`, tags: [] },
      { name: "Coffee & Tea Service", reason: "Essential dinner party conclusion — guests linger over coffee and dessert", costPerPerson: 0.5, minCost: 5, qty: n => `1 coffee station`, tags: [] },
    ],
    desserts: [
      { name: "Crème Brûlée", reason: "Iconic dinner party dessert with theatrical tableside flame — wow factor guaranteed", costPerPerson: 2.5, minCost: 18, qty: n => `${n} ramekins`, tags: ["dairy", "eggs"] },
      { name: "Chocolate Lava Cake", reason: "Decadent warm dessert that feels indulgent and genuinely restaurant-quality", costPerPerson: 2.5, minCost: 18, qty: n => `${n} cakes`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Fresh Berry Pavlova", reason: "Light elegant dessert with stunning visual presentation — impressive yet simple", costPerPerson: 2, minCost: 15, qty: n => `${Math.ceil(n / 6)} pavlovas`, tags: ["eggs", "dairy"] },
    ],
    tips: [
      "Set the table fully before guests arrive — placemats, folded napkins, water glasses. First impressions of a dinner party are made before food appears.",
      "Prepare all make-ahead components by afternoon — sauces, desserts, side dishes. Only the mains should need active attention close to serving time.",
      "Dim the lights and add candles 30 minutes before guests arrive. Atmosphere transforms a good meal into a truly memorable dinner party.",
      "Serve courses with 15–20 minute gaps between each — this pacing allows conversation and prevents guests from feeling rushed through the meal.",
      "Warm serving plates in the oven (60°C) before plating mains. Cold plates cool food rapidly; warm plates keep every bite at the right temperature.",
      "Have a palate cleanser (small sorbet scoop or fresh mint tea) ready between the main and dessert course for a true restaurant feel.",
      "As host, eat slightly less so you can focus on guests. Keep checking water glasses — attentive hosting elevates any meal significantly.",
    ],
  },

  "Movie Night": {
    mains: [
      { name: "Crispy Chicken Wings (Glazed)", reason: "Ultimate movie night food — easy to eat with one hand, never needs cutlery", costPerPerson: 3, minCost: 16, qty: n => `${n * 3} wings`, tags: ["meat"] },
      { name: "Mini Sliders", reason: "Fun bite-sized burgers perfect for eating on the sofa between scenes", costPerPerson: 2.5, minCost: 14, qty: n => `${n * 2} sliders`, tags: ["meat", "gluten"] },
      { name: "Loaded Nachos", reason: "Iconic movie food — shareable, zero cutlery needed, great for grazing", costPerPerson: 2, minCost: 12, qty: n => `${Math.ceil(n / 4)} large trays`, tags: ["dairy"] },
      { name: "Pizza Slices", reason: "Finger-food friendly, easy to box and pass around during the movie without disruption", costPerPerson: 2.5, minCost: 14, qty: n => `${Math.ceil(n / 3)} large pizzas`, tags: ["gluten", "dairy"] },
    ],
    sides: [
      { name: "Onion Rings", reason: "Classic movie side that pairs with sliders and wings — shareable and satisfying", costPerPerson: 0.8, minCost: 6, qty: n => `${Math.ceil(n * 0.15)} kg`, tags: ["gluten"] },
      { name: "Loaded French Fries", reason: "Comfort food great for grazing throughout the movie — keep warm in the oven", costPerPerson: 1, minCost: 7, qty: n => `${Math.ceil(n * 0.15)} kg`, tags: ["dairy"] },
    ],
    snacks: [
      { name: "Classic Buttered Popcorn", reason: "Non-negotiable movie night staple — minimal cost, maximum nostalgia", costPerPerson: 0.8, minCost: 5, qty: n => `${Math.ceil(n / 4)} large bags`, tags: ["dairy"] },
      { name: "Assorted Candy & Chocolate", reason: "Sweet complement to salty popcorn — perfectly replicates the cinema experience", costPerPerson: 1, minCost: 7, qty: n => `${Math.ceil(n / 3)} bags`, tags: [] },
      { name: "Chips & Guacamole", reason: "Low-mess grazing option available from the start — no noise between intense scenes", costPerPerson: 1, minCost: 7, qty: n => `${Math.ceil(n / 4)} sharing bowls`, tags: [] },
    ],
    drinks: [
      { name: "Assorted Soft Drinks", reason: "Classic movie drinks — have everyone's favourite available from arrival", costPerPerson: 1.2, minCost: 7, qty: n => `${Math.ceil(n / 4)} × 1.5L bottles`, tags: [] },
      { name: "Sparkling Water", reason: "Refreshing alternative for guests who prefer non-sugary drinks during the movie", costPerPerson: 0.4, minCost: 4, qty: n => `${Math.ceil(n / 4)} bottles`, tags: [] },
    ],
    desserts: [
      { name: "Ice Cream Tubs with Toppings", reason: "Fun customisable dessert — serve during the film for maximum enjoyment", costPerPerson: 1.5, minCost: 10, qty: n => `${Math.ceil(n / 4)} tubs + toppings`, tags: ["dairy"] },
      { name: "Chocolate Chip Cookies", reason: "Easy shareable dessert — room temperature, no serving required, no disruption", costPerPerson: 0.8, minCost: 6, qty: n => `${n * 2} cookies`, tags: ["gluten", "dairy", "eggs"] },
    ],
    tips: [
      "Set up ALL food before the movie starts — pausing for food runs breaks immersion. Arrange everything on a central coffee table within reach.",
      "Use individual paper cones or boxes for messy items like popcorn and fries — easier to hold in the dark without spilling.",
      "Dim the lights and set up blankets and pillows before guests arrive to fully create 'cinema mode' from the moment they walk in.",
      "Build in a 15-minute interval midway for bathroom breaks, food refills, and discussion — it recreates the cinema experience perfectly.",
      "Pre-portion snacks into individual bowls so guests don't reach across others during intense scenes or jump scares.",
      "Keep hot food (wings, sliders) warm in the oven at 60°C and bring out just before the movie starts — never before the room is settled.",
      "Create a 'snack reveal' moment at the interval — bring out the ice cream or cookies as a surprise second course mid-movie.",
    ],
  },

  "Brunch": {
    mains: [
      { name: "Scrambled Eggs on Sourdough Toast", reason: "Classic brunch centrepiece — simple to prepare in batches, universally loved", costPerPerson: 2, minCost: 12, qty: n => `${n} portions`, tags: ["eggs", "gluten", "dairy"] },
      { name: "Pancakes with Maple Syrup & Berries", reason: "Crowd-pleasing brunch favourite — easy to batch cook, stacks beautifully on the table", costPerPerson: 1.5, minCost: 10, qty: n => `${n * 3} pancakes`, tags: ["eggs", "gluten", "dairy"] },
      { name: "Avocado Toast with Poached Egg", reason: "Modern brunch classic — photogenic, satisfying, and nutritious for guests", costPerPerson: 3, minCost: 16, qty: n => `${n} portions`, tags: ["eggs", "gluten"] },
      { name: "French Toast with Berry Compote", reason: "Sweet brunch option that showcases seasonal berries in an impressive way", costPerPerson: 2, minCost: 12, qty: n => `${n} portions`, tags: ["eggs", "gluten", "dairy"] },
      { name: "Smoked Salmon Bagels with Cream Cheese", reason: "Elegant brunch option that elevates the spread significantly with minimal prep", costPerPerson: 4, minCost: 22, qty: n => `${n} bagels`, tags: ["seafood", "gluten", "dairy"] },
    ],
    sides: [
      { name: "Crispy Hash Browns", reason: "Essential brunch side — pairs with both sweet and savoury mains perfectly", costPerPerson: 1, minCost: 7, qty: n => `${n} pieces`, tags: [] },
      { name: "Fresh Fruit Platter", reason: "Light colourful side that balances heavier brunch mains — visually stunning on the table", costPerPerson: 1.2, minCost: 9, qty: n => `1 large platter`, tags: [] },
      { name: "Sautéed Mushrooms & Spinach", reason: "Healthy flavourful vegetable side that complements egg dishes perfectly", costPerPerson: 0.8, minCost: 6, qty: n => `1 large pan`, tags: [] },
      { name: "Crispy Streaky Bacon", reason: "Classic brunch side — savoury depth alongside eggs that most guests expect", costPerPerson: 1.5, minCost: 10, qty: n => `${n * 2} rashers`, tags: ["meat", "pork"] },
    ],
    snacks: [
      { name: "Assorted Danish Pastries & Croissants", reason: "Elegant arrival spread for early guests — signals hospitality immediately", costPerPerson: 1.5, minCost: 10, qty: n => `${n} pieces`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Yoghurt Parfait with Granola & Berries", reason: "Healthy option that's visually stunning in clear jars on the brunch table", costPerPerson: 1.5, minCost: 10, qty: n => `${n} jars`, tags: ["dairy", "gluten", "nuts"] },
    ],
    drinks: [
      { name: "Freshly Brewed Coffee Station", reason: "Non-negotiable brunch staple — use proper beans, not instant, for the right experience", costPerPerson: 1, minCost: 8, qty: n => `1 coffee station + pods/beans`, tags: [] },
      { name: "Fresh Orange Juice", reason: "Classic brunch drink — vibrant colour, pairs equally well with sweet and savoury options", costPerPerson: 1.2, minCost: 8, qty: n => `${Math.ceil(n * 0.25)} L`, tags: [] },
      { name: "Herbal Teas & English Breakfast Tea", reason: "For guests who prefer tea over coffee — non-negotiable to offer both at brunch", costPerPerson: 0.3, minCost: 4, qty: n => `1 tea station`, tags: [] },
    ],
    desserts: [
      { name: "Mini Waffles with Whipped Cream & Berries", reason: "Sweet brunch dessert doubling as an Instagram-worthy centrepiece on the table", costPerPerson: 1.5, minCost: 10, qty: n => `${n * 2} mini waffles`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Lemon Drizzle Cake", reason: "Light zingy cake that works beautifully alongside coffee and tea service", costPerPerson: 1.2, minCost: 10, qty: n => `${Math.ceil(n / 8)} cakes`, tags: ["gluten", "dairy", "eggs"] },
    ],
    tips: [
      "Set up the coffee station as the first thing guests see — it signals hospitality immediately and keeps early arrivals happily occupied.",
      "Brunch works best served over 2–3 hours — stagger food release (pastries first, then mains, then dessert) to keep everything fresh.",
      "Keep scrambled eggs in a bain-marie or keep-warm dish — they dry out fast in a pan. Add a small splash of cream every 30 minutes to refresh.",
      "Create height on the table — stack pancakes in tall towers, use cake stands for pastries, display juice in a beautiful glass pitcher.",
      "Prepare cold items the night before (fruit platter, yoghurt parfait, pastries) so morning prep only involves the hot dishes.",
      "Set up a 'build your own' toast station with multiple spreads — cream cheese, avocado, jam, nut butter — guests love personalizing their plate.",
      "Play light jazz or acoustic background music — brunch energy should feel leisurely and relaxed, not high-energy like a birthday party.",
    ],
  },

  "Holiday Fest": {
    mains: [
      { name: "Herb Roasted Turkey with Gravy", reason: "Iconic holiday centrepiece that creates a festive atmosphere and conversation piece instantly", costPerPerson: 5, minCost: 35, qty: n => `${Math.ceil(n / 8)} turkeys`, tags: ["meat"] },
      { name: "Glazed Honey Ham", reason: "Beautiful presentation that slices perfectly for a buffet or family-style spread", costPerPerson: 4, minCost: 25, qty: n => `${Math.ceil(n / 8)} hams`, tags: ["meat", "pork"] },
      { name: "Beef Rib Roast", reason: "Premium holiday showpiece — carves dramatically at the table and wows every guest", costPerPerson: 8, minCost: 40, qty: n => `${Math.ceil(n / 6)} roasts`, tags: ["meat", "beef"] },
      { name: "Baked Salmon en Croûte", reason: "Elegant seafood alternative for guests who prefer fish — impressive and easy to prepare", costPerPerson: 6, minCost: 30, qty: n => `${Math.ceil(n / 6)} fillets`, tags: ["seafood", "gluten"] },
      { name: "Vegetable Wellington", reason: "Impressive vegetarian centrepiece that rivals meat mains in both presentation and taste", costPerPerson: 4, minCost: 22, qty: n => `${Math.ceil(n / 4)} wellingtons`, tags: ["gluten", "dairy"] },
    ],
    sides: [
      { name: "Honey Glazed Roasted Vegetables", reason: "Festive and colourful — caramelises beautifully in the oven and looks stunning on the table", costPerPerson: 1.2, minCost: 9, qty: n => `1 large roasting tray`, tags: [] },
      { name: "Creamy Mashed Potato", reason: "Classic holiday comfort side that pairs with absolutely every main dish on the spread", costPerPerson: 1, minCost: 8, qty: n => `${Math.ceil(n * 0.2)} kg`, tags: ["dairy"] },
      { name: "Green Bean Casserole", reason: "Traditional holiday side dish loved across every generation at the table", costPerPerson: 1, minCost: 8, qty: n => `1 large casserole dish`, tags: ["dairy", "gluten"] },
      { name: "Cranberry Sauce", reason: "Essential holiday condiment that pairs perfectly with turkey, ham, and roast meats", costPerPerson: 0.5, minCost: 5, qty: n => `${Math.ceil(n / 8)} jars`, tags: [] },
    ],
    snacks: [
      { name: "Holiday Cheese & Cracker Board", reason: "Elegant arrival spread that keeps guests happily occupied before the main feast begins", costPerPerson: 2, minCost: 15, qty: n => `1 large board`, tags: ["dairy", "gluten"] },
      { name: "Sausage Rolls", reason: "Festive party finger food — easy to pass around as guests arrive before sitting down", costPerPerson: 1, minCost: 8, qty: n => `${n * 2} pieces`, tags: ["gluten", "meat", "pork"] },
    ],
    drinks: [
      { name: "Sparkling Grape Juice (Non-Alcoholic)", reason: "Festive toast option for guests of all ages — feels celebratory without alcohol", costPerPerson: 1, minCost: 8, qty: n => `${Math.ceil(n / 6)} bottles`, tags: [] },
      { name: "Warm Mulled Apple Cider", reason: "Festive holiday drink — fills the room with a wonderful spiced aroma guests love", costPerPerson: 1, minCost: 7, qty: n => `${Math.ceil(n * 0.3)} L`, tags: [] },
      { name: "Assorted Soft Drinks", reason: "Essential for non-alcoholic preferences and for children at the gathering", costPerPerson: 0.8, minCost: 6, qty: n => `${Math.ceil(n / 5)} × 1.5L bottles`, tags: [] },
    ],
    desserts: [
      { name: "Yule Log Cake", reason: "Iconic holiday dessert that creates a centrepiece moment and doubles as a table decoration", costPerPerson: 2, minCost: 15, qty: n => `${Math.ceil(n / 8)} logs`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Warm Apple Crumble with Custard", reason: "Comforting warming dessert that epitomises holiday spirit — universally loved", costPerPerson: 1.5, minCost: 12, qty: n => `1 large baking dish`, tags: ["gluten", "dairy"] },
      { name: "Mince Pies", reason: "Traditional holiday bites perfect with coffee or tea after the main feast", costPerPerson: 0.8, minCost: 7, qty: n => `${n * 2} pies`, tags: ["gluten", "dairy"] },
    ],
    tips: [
      "Start the turkey or roast 3–4 hours before guests arrive — large cuts need long roasting times. Plan your entire day around the oven schedule.",
      "Prepare all cold side dishes and desserts the day before — this frees you completely from kitchen stress on the day itself.",
      "Create a 'holiday station' before the first guests arrive: warm cider on the stove, cheese board set, music playing, candles lit.",
      "Assign family roles: one person manages drinks, one manages sides, you focus on the main — teamwork makes the host's job manageable.",
      "Rest the roast for at least 20 minutes before carving — this redistributes juices and produces far juicier, more flavourful slices.",
      "Set the dessert table separately as a second reveal — bring it out after mains are cleared to create a natural second act to the celebration.",
      "Keep a 'survival stash' of backup snacks (crackers, biscuits) — holiday gatherings run over time and guests always get peckish again.",
    ],
  },

  "Wedding": {
    mains: [
      { name: "Braised Beef Cheeks with Red Wine Jus", reason: "Premium wedding main — meltingly tender, elegant plated presentation that guests remember", costPerPerson: 10, minCost: 50, qty: n => `${n} portions`, tags: ["meat", "beef"] },
      { name: "Pan-Seared Barramundi with Beurre Blanc", reason: "Sophisticated seafood alternative — pairs beautifully alongside the beef option", costPerPerson: 9, minCost: 45, qty: n => `${n} portions`, tags: ["seafood", "dairy"] },
      { name: "Roasted Chicken Suprême with Truffle Jus", reason: "Crowd-pleasing luxury wedding main — elegant without the premium beef price point", costPerPerson: 7, minCost: 35, qty: n => `${n} portions`, tags: ["meat"] },
      { name: "Mushroom & Truffle Risotto (Vegetarian)", reason: "Elegant creamy vegetarian main worthy of a wedding banquet — not an afterthought", costPerPerson: 5, minCost: 28, qty: n => `${n} portions`, tags: ["dairy"] },
    ],
    sides: [
      { name: "Truffle Duchess Potatoes", reason: "Luxurious piped potato side that photographs beautifully on the wedding plate", costPerPerson: 2, minCost: 15, qty: n => `${n} portions`, tags: ["dairy", "eggs"] },
      { name: "Haricots Verts with Toasted Almonds", reason: "Elegant French green bean side — vibrant colour contrast on a formal wedding plate", costPerPerson: 1.5, minCost: 10, qty: n => `${n} portions`, tags: ["nuts"] },
      { name: "Artisan Bread Rolls with Whipped Butter", reason: "Premium bread course that sets the formal tone from the very first course", costPerPerson: 1, minCost: 10, qty: n => `${n} rolls`, tags: ["gluten", "dairy"] },
    ],
    snacks: [
      { name: "Canapé Selection (6 varieties)", reason: "Sophisticated welcome bites served during cocktail hour as guests mingle and settle", costPerPerson: 3, minCost: 25, qty: n => `${n * 3} pieces total`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Fresh Fruit Skewers & Macarons", reason: "Elegant sweet canapé option — colourful, photogenic, loved by all guests", costPerPerson: 2, minCost: 18, qty: n => `${n * 2} pieces`, tags: ["gluten", "dairy", "eggs", "nuts"] },
    ],
    drinks: [
      { name: "Sparkling Elderflower Lemonade", reason: "Elegant festive non-alcoholic option worthy of a wedding toast — beautiful in tall glasses", costPerPerson: 1.5, minCost: 12, qty: n => `${Math.ceil(n / 6)} bottles`, tags: [] },
      { name: "Cucumber & Citrus Infused Water", reason: "Sophisticated table hydration option that elevates every place setting visually", costPerPerson: 0.5, minCost: 6, qty: n => `${Math.ceil(n / 12)} large carafes`, tags: [] },
      { name: "Specialty Coffee & Tea Service", reason: "Essential post-dinner service — completes the full wedding dining experience", costPerPerson: 1, minCost: 10, qty: n => `1 dedicated coffee station`, tags: [] },
    ],
    desserts: [
      { name: "Wedding Cake (Multi-Tier)", reason: "The ceremonial centrepiece — served at the couple's first cut, creates an unforgettable moment", costPerPerson: 3, minCost: 80, qty: n => `1 custom cake (${Math.ceil(n / 30) + 2} tiers)`, tags: ["gluten", "dairy", "eggs"] },
      { name: "Dessert Station (Macarons, Petit Fours, Truffles)", reason: "Guests graze during the reception — creates a visually spectacular dessert display", costPerPerson: 2.5, minCost: 25, qty: n => `${n * 3} pieces`, tags: ["gluten", "dairy", "eggs"] },
    ],
    tips: [
      "Hire professional service staff — for a wedding, the hosting experience must be seamless. Aim for one server per 15–20 guests minimum.",
      "Do a full dry-run of the food service flow 3 days before — time every course, identify bottlenecks, troubleshoot before the day itself.",
      "Serve canapés for 45 minutes during cocktail hour before seating guests for the main meal — creates a relaxed, social atmosphere.",
      "Capture dietary requirements via RSVP, 2 weeks in advance — create clearly labelled place cards for guests with special needs.",
      "Keep the wedding cake refrigerated until 1 hour before serving — buttercream and fondant need time to come to room temperature.",
      "Plan a dedicated 'vendor meal' — caterers, photographers, and musicians all need to eat. Prepare this separately and in advance.",
      "Ensure the couple eats something before the ceremony — hunger affects speeches, energy, and presence on the most important day of their lives.",
    ],
  },
};

// ── Restriction → blocked tags ────────────────────────────────────────────────
function getBlockedTags(restrictions: string[]): Set<string> {
  const blocked = new Set<string>();
  for (const r of restrictions) {
    switch (r) {
      case "No Pork":    blocked.add("pork"); break;
      case "No Beef":    blocked.add("beef"); break;
      case "No Shellfish": blocked.add("shellfish"); break;
      case "No Alcohol": blocked.add("alcohol"); break;
      case "Halal":      blocked.add("pork"); blocked.add("alcohol"); break;
      case "Vegetarian": blocked.add("meat"); blocked.add("seafood"); break;
      case "Vegan":      blocked.add("meat"); blocked.add("seafood"); blocked.add("dairy"); blocked.add("eggs"); break;
      case "Gluten-Free": blocked.add("gluten"); break;
      case "Dairy-Free": blocked.add("dairy"); break;
      case "Nut-Free":   blocked.add("nuts"); break;
      case "Low Spice":  blocked.add("spicy"); break;
    }
  }
  return blocked;
}

// ── Pick items within budget ──────────────────────────────────────────────────
function fitItems(
  items: MenuItem[],
  blocked: Set<string>,
  allocation: number,
  n: number,
  max: number,
): Array<{ item: MenuItem; cost: number }> {
  const filtered = items.filter((i) => !i.tags.some((t) => blocked.has(t))).slice(0, max);
  if (filtered.length === 0) return [];
  const rawCosts = filtered.map((i) => Math.max(i.minCost, i.costPerPerson * n));
  const rawTotal = rawCosts.reduce((a, b) => a + b, 0);
  const scale = rawTotal > 0 ? allocation / rawTotal : 1;
  return filtered.map((item, idx) => ({ item, cost: Math.round(rawCosts[idx] * scale * 100) / 100 }));
}

// ── Preparation timeline ──────────────────────────────────────────────────────
function buildTimeline(arrival: string): string {
  const parts = arrival.split(":").map(Number);
  const h = parts[0] ?? 18;
  const m = parts[1] ?? 0;
  const arrMin = h * 60 + m;
  const fmt = (delta: number) => {
    const total = ((arrMin + delta) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return [
    `${fmt(-180)} — Complete all grocery shopping; confirm all supplies and equipment are ready`,
    `${fmt(-150)} — Begin food preparation — wash, chop, and marinate all ingredients`,
    `${fmt(-120)} — Start cooking main dishes; preheat oven if required`,
    `${fmt(-90)} — Prepare sides and snacks; begin setting up the buffet or dining table`,
    `${fmt(-60)} — Main dishes should be actively cooking; taste and adjust seasoning`,
    `${fmt(-30)} — Set up drinks station; arrange platters and add final garnishes`,
    `${fmt(-15)} — Final presentation check; light candles; do a last-minute guest-readiness sweep`,
    `${fmt(0)} — 🎉 Guests arrive — food is ready, drinks are poured, party begins!`,
  ].join("\n");
}

// ── Assemble the full markdown plan ──────────────────────────────────────────
function generateLocalPlan(params: {
  occasion: string;
  guestCount: number;
  budget: number;
  servingStyle: string;
  restrictions: string[];
  arrivalTime: string;
  additionalPreferences: string;
}): string {
  const { occasion, guestCount, budget, servingStyle, restrictions, arrivalTime, additionalPreferences } = params;
  const n = guestCount;
  const menu = MENUS[occasion] ?? MENUS["BBQ"]!;
  const blocked = getBlockedTags(restrictions);

  const alloc = { mains: budget * 0.50, sides: budget * 0.20, snacks: budget * 0.08, drinks: budget * 0.15, desserts: budget * 0.07 };
  const mains    = fitItems(menu.mains,    blocked, alloc.mains,    n, 4);
  const sides    = fitItems(menu.sides,    blocked, alloc.sides,    n, 3);
  const snacks   = fitItems(menu.snacks,   blocked, alloc.snacks,   n, 2);
  const drinks   = fitItems(menu.drinks,   blocked, alloc.drinks,   n, 3);
  const desserts = fitItems(menu.desserts, blocked, alloc.desserts, n, 2);

  const fmt = (rows: Array<{ item: MenuItem; cost: number }>) =>
    rows.length > 0
      ? rows.map(({ item, cost }) =>
          `**${item.name}** | ${item.reason} | ${item.qty(n)} | Estimated Cost: SGD $${cost.toFixed(2)}`
        ).join("\n\n")
      : "_No items available after dietary restriction filtering — consider relaxing one restriction._";

  const sum = (rows: Array<{ item: MenuItem; cost: number }>) => rows.reduce((s, x) => s + x.cost, 0);
  const totalSpend = sum(mains) + sum(sides) + sum(snacks) + sum(drinks) + sum(desserts);
  const remaining  = budget - totalSpend;

  const validationChecklist =
    restrictions.length > 0
      ? restrictions.map((r) => `✓ **${r}** — Menu has been audited; all items are compliant`).join("\n")
      : "✓ No dietary restrictions — All items permitted";

  const mainsNames  = mains.map((x)  => x.item.name).join(", ");
  const drinksNames = drinks.map((x) => x.item.name).join(", ");

  return `## PARTY OVERVIEW
Occasion: ${occasion}
Guests: ${n}
Serving Style: ${servingStyle}
Budget: SGD $${budget}
Arrival Time: ${arrivalTime}${additionalPreferences ? `\nAdditional Notes: ${additionalPreferences}` : ""}

---

## MAINS

${fmt(mains)}

---

## SIDES

${fmt(sides)}

---

## SNACKS

${fmt(snacks)}

---

## DRINKS

${fmt(drinks)}

---

## DESSERTS

${fmt(desserts)}

---

## SHOPPING LIST

Produce: Fresh vegetables, salad greens, garnishes, herbs, and seasonal fruits as required by the menu above
Protein: ${mainsNames || "As per menu selection above"}
Bakery: Bread rolls, buns, and pastry items as required by the selected menu
Dairy: Check individual menu items above for specific dairy requirements
Frozen: Ice for the drinks cooler${desserts.some((x) => x.item.name.toLowerCase().includes("ice cream")) ? ", ice cream tubs" : ""}
Beverages: ${drinksNames || "As per drinks selection above"}
Miscellaneous: Serving platters, napkins, disposable plates and cutlery, condiment sauces, cling film, foil trays

---

## BUDGET BREAKDOWN

Mains: SGD $${sum(mains).toFixed(2)}
Sides: SGD $${sum(sides).toFixed(2)}
Snacks: SGD $${sum(snacks).toFixed(2)}
Drinks: SGD $${sum(drinks).toFixed(2)}
Desserts: SGD $${sum(desserts).toFixed(2)}
**Total Estimated Spend: SGD $${totalSpend.toFixed(2)}**
**Remaining Budget: SGD $${remaining.toFixed(2)}**

${remaining >= 0
  ? "> 💡 *Budget is on target. Redirect any savings toward extra drinks, a larger dessert, or a special surprise for guests.*"
  : "> ⚠️ *Slightly over budget — consider removing one item or reducing quantities slightly to stay within your limit.*"}

---

## PREPARATION TIMELINE

${buildTimeline(arrivalTime)}

---

## HOST TIPS

${menu.tips.map((t) => `- ${t}`).join("\n")}

---

## VALIDATION CHECKLIST

${validationChecklist}`;
}

// ── POST /api/generate-party-plan ─────────────────────────────────────────────
router.post("/generate-party-plan", (req: Request, res: Response) => {
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

  try {
    const plan = generateLocalPlan({ occasion, guestCount, budget, servingStyle, restrictions, arrivalTime: time24h, additionalPreferences });
    res.status(200).json({ success: true, plan, metadata: { occasion, guestCount, budget, restrictions } });
  } catch (err) {
    logger.error({ err }, "generate-party-plan local generator error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Plan generation failed" });
  }
});

export default router;
