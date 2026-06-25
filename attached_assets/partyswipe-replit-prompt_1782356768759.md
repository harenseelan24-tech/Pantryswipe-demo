# PartySwipe AI Party Planner — Replit Agent Prompt

## TASK
Rebuild the Party Planner feature cleanly inside this existing PartySwipe app.
Do NOT touch any other existing pages, routes, components, or API endpoints.
Keep all existing navigation, styling, and structure intact.
Only rebuild the party planner feature end-to-end so it fully works.

---

## STEP 0 — READ THE CODEBASE FIRST

Before writing any code:
1. Read the existing file structure, especially the pages/routes directory
2. Identify the existing party planner page file(s) and their current route paths
3. Identify the existing state management pattern (React context, Zustand, props, etc.)
4. Identify the existing UI component library being used (buttons, cards, inputs, etc.)
5. Identify how other existing API routes are structured and follow the exact same pattern
6. Do NOT create a new routing pattern — wire into the existing one

---

## TECH STACK
- Framework: TypeScript / Node.js (existing repo structure)
- AI: Anthropic Claude API, model: claude-sonnet-4-6
- Use ANTHROPIC_API_KEY from Replit Secrets (process.env.ANTHROPIC_API_KEY)
- NEVER expose ANTHROPIC_API_KEY in any client-side file, component, or bundle

---

## STEP 1 — BACKEND API ROUTE

Create a single backend POST endpoint: /api/generate-party-plan

### Request validation (run BEFORE calling Claude)
Return HTTP 400 with JSON error if any of these fail:
- occasion: must be one of: BBQ, Birthday Party, Family Gathering, Dinner Party, Movie Night, Brunch, Holiday Fest, Wedding
- guestCount: must be an integer between 1 and 500
- budget: must be a number greater than 0
- servingStyle: must be one of: Buffet, Finger Food, Plated, Family Style
- restrictions: must be an array (can be empty)
- arrivalTime: must be a non-empty string
- additionalPreferences: optional string, default to empty string if missing

### Arrival time conversion
Before building the user message, convert arrivalTime from 12h AM/PM format to 24h HH:MM format.
Use the converted value in the Claude message so timeline arithmetic is unambiguous.

### Build the user message dynamically

```
I need a complete party plan for the following event:

- Occasion: [occasion]
- Number of Guests: [guestCount]
- Total Budget: SGD $[budget]
- Serving Style: [servingStyle]
- Dietary Restrictions (HARD RULES — violating any of these is not permitted): [restrictions joined by ", " or "None — no restrictions apply"]
- Guest Arrival Time: [arrivalTime in 24h format, e.g. 17:00]
- Additional Preferences: [additionalPreferences or "None"]

IMPORTANT: The dietary restrictions above are non-negotiable hard rules. Before writing your final output, audit every single menu item against the restrictions list and remove any item that violates even one rule. Do not include any item that contains or is derived from a restricted ingredient.

Please generate the full party plan following your output format exactly, using the section headers as specified.
```

### Claude API call settings

```typescript
{
  model: "claude-sonnet-4-6",
  max_tokens: 4000,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userMessage }]
}
```

Set a server-side timeout of 55 seconds. If it times out, return HTTP 504 with:
`{ "error": "Plan generation timed out. Please try again." }`

### Return format on success (HTTP 200)

```json
{
  "success": true,
  "plan": "<full Claude response text>",
  "metadata": {
    "occasion": "...",
    "guestCount": 10,
    "budget": 300,
    "restrictions": ["Halal", "No Pork"]
  }
}
```

Return HTTP 500 with `{ "success": false, "error": "..." }` for Claude API errors.
Always set `Content-Type: application/json` on all responses.
Set CORS to same-origin only on this route.

### System prompt — paste this verbatim as the system parameter

```
You are PartySwipe AI, an expert event planner, catering consultant, menu designer, budgeting specialist, and hosting assistant.

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
[If no restrictions: ✓ No dietary restrictions — All items permitted]
```

---

## STEP 2 — WIZARD FORM (client-side)

Use the existing state management pattern identified in Step 0. Store all wizard answers in a single state object. Never reset state between steps.

### Wizard state object

```typescript
interface PartyPlanForm {
  occasion: string;
  guestCount: number;
  budget: number;
  servingStyle: string;
  restrictions: string[];
  arrivalTime: string;
  additionalPreferences: string;
}
```

Initialize with safe defaults: guestCount = 10, budget = 0, restrictions = [], all strings = "".

### Progress bar
Show a filled progress bar at the top: current step / 7. No library needed — a simple styled div is fine.

### Step navigation
- Back button on steps 2–7: go to previous step, preserve all answers
- Next button on steps 1–6: validate current step before advancing
  - Step 1: occasion must be selected
  - Step 2: guestCount must be 1–500
  - Step 3: budget must be greater than 0
  - Step 4: servingStyle must be selected
  - Step 5: no validation (optional)
  - Step 6: arrivalTime must be filled
  - Step 7: no validation (optional)
- Show an inline error message below the field if validation fails
- Generate button appears on step 7 only

### The 7 steps

**Step 1 — Occasion**
"What's the occasion?"
Grid of 8 clickable cards. Selecting one highlights it.
Options: BBQ, Birthday Party, Family Gathering, Dinner Party, Movie Night, Brunch, Holiday Fest, Wedding.

**Step 2 — Guest Count**
"How many guests are you expecting?"
A − button, a number display, and a + button. Min 1, max 500. Clicking − at 1 does nothing.

**Step 3 — Budget**
"What is your total budget?"
Text input with "SGD $" prefix. Accept positive numbers only. Placeholder: "e.g. 300".
Show error if 0, negative, or non-numeric.

**Step 4 — Serving Style**
"How will you serve food?"
Grid of 4 clickable cards: Buffet, Finger Food, Plated, Family Style.

**Step 5 — Dietary Restrictions**
"Any dietary restrictions? (Select all that apply)"
Multi-select checkbox list: None, Halal, No Pork, No Beef, No Shellfish, No Alcohol, Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Low Spice.
Logic: selecting "None" deselects all others. Selecting any other option deselects "None".

**Step 6 — Arrival Time**
"When are guests arriving?"
Native time input (type="time") styled to match the app. Store as "HH:MM AM/PM" string.

**Step 7 — Additional Preferences**
"Anything else we should know? (optional)"
Textarea. Placeholder: "e.g. Kids attending, guest loves spicy food, thinking of a cheese platter"

---

## STEP 3 — API CALL AND VALIDATION

On "Generate My Party Plan":
1. Set loading = true, show loading overlay
2. POST to /api/generate-party-plan with full wizard state as JSON
3. On success: run client-side restriction audit, then parse and render the plan
4. On error: hide overlay, show error state
5. Set loading = false when done

### Client-side restriction audit
After receiving the plan text, before rendering:
- Build a keyword blocklist from the restrictions array:
  - No Pork / Halal → flag lines containing: pork, bacon, ham, lard, prosciutto
  - No Beef → flag lines containing: beef, brisket, wagyu
  - No Shellfish → flag lines containing: prawn, crab, lobster, scallop, clam, shrimp
  - Vegetarian / Vegan → flag lines containing: chicken, duck, pork, beef, lamb, fish
- Search only the MAINS, SIDES, SNACKS, DESSERTS sections
- If any flagged items are found, show a yellow warning banner above the plan:
  "⚠️ Some items may need review against your dietary restrictions. Please check the Validation Checklist below."
- Always still render the full plan — do not block rendering

### Loading overlay
Render as a full-height in-flow div (NOT position:fixed — this breaks in Replit iframes):
- App name / logo
- Text: "PartySwipe AI is crafting your perfect party plan…"
- Animated spinner
- Subtext: "This usually takes 20–30 seconds"

### Error state
Centered card with:
- Error icon
- "Something went wrong. Please try again."
- Specific error message from the API response if available
- "Try Again" button that re-submits the same form data without going back through the wizard

---

## STEP 4 — PLAN RENDERING

### Section parser
Use this exact function:

```typescript
function parsePlan(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const sectionKeys = [
    'PARTY OVERVIEW', 'MAINS', 'SIDES', 'SNACKS',
    'DRINKS', 'DESSERTS', 'SHOPPING LIST',
    'BUDGET BREAKDOWN', 'PREPARATION TIMELINE',
    'HOST TIPS', 'VALIDATION CHECKLIST'
  ];

  const parts = text.split(/^##\s+/m);

  for (const part of parts) {
    const firstLine = part.split('\n')[0].trim().toUpperCase();
    const matched = sectionKeys.find(k => firstLine.includes(k));
    if (matched) {
      sections[matched] = part.substring(part.indexOf('\n') + 1).trim();
    }
  }

  if (Object.keys(sections).length < 5) {
    throw new Error('Plan format could not be parsed. Please regenerate.');
  }

  return sections;
}
```

Wrap in try/catch. If it throws, show the error state with the message.

### Render each section as a card

**Card 1 — 🎉 Party Overview**
Parse key: value lines. Render as a 2-column summary grid (1-column on mobile).

**Card 2 — 🍽️ Recommended Menu**
Tabs or accordion: Mains / Sides / Snacks / Drinks / Desserts.
Each item line format: Name | Reason | Quantity | Cost — split on "|" and render as a 4-column table row.
If a line does not match the pipe format, render it as a plain text row. Do not crash.

**Card 3 — 🛒 Shopping List**
Parse each category label (Produce:, Protein:, etc.) and its items.
Render each item with a checkbox. Store checkbox state in React component state (in-memory, not localStorage).
When all items in a category are checked, visually mark that category complete.

**Card 4 — 💰 Budget Breakdown**
Parse each "Category: SGD $amount" line.
Render a table with a horizontal bar per category showing proportion of the total user budget.
Use metadata.budget as the ceiling for bar width calculation.
Total Estimated Spend and Remaining Budget in a highlighted summary row.
Remaining Budget: green if positive, red if zero or negative.

**Card 5 — ⏰ Preparation Timeline**
Parse each "HH:MM — Action" line.
Render as a vertical timeline: time on the left, action on the right, connected by a vertical line with a dot at each step.

**Card 6 — 💡 Host Tips**
Parse as a bullet list. Render as styled tip cards or a clean bulleted list.

**Card 7 — ✅ Validation Checklist**
Parse each "✓ [restriction] — Compliant" line. Render with a green checkmark icon.

### Below the plan
Show two buttons:

1. **"🔄 Regenerate Plan"** — re-POSTs the same form data. Shows its own loading state. On the new plan, shows a small "Generated at HH:MM" timestamp in the Party Overview card so the user knows a new plan was produced.

2. **"✏️ Edit Preferences"** — navigates back to step 1 of the wizard, pre-populated with all previous answers.

---

## STYLE AND LAYOUT

- Use the existing app's color tokens, font sizes, border radius, and component patterns
- Do NOT introduce a new UI library unless one is already used
- Mobile-first:
  - Wizard: full width on mobile, max-width 600px centered on desktop
  - Plan cards: full width on mobile, max-width 800px centered on desktop
  - Menu tabs: scroll horizontally on mobile, do not wrap to multiple rows
  - Budget bars: stack vertically on mobile, no horizontal overflow
  - Timeline: single column on all screen sizes
- All interactive elements: minimum 44×44px touch target on mobile

---

## FINAL CHECKLIST — DO NOT MARK DONE UNTIL ALL PASS

- [ ] Codebase fully read before writing any code
- [ ] ANTHROPIC_API_KEY is server-side only — not in any client bundle
- [ ] Request body validated server-side before calling Claude
- [ ] max_tokens set to 4000 on all Claude API calls
- [ ] Arrival time converted to 24h before sending to Claude
- [ ] Server-side 55-second timeout implemented
- [ ] Section parser uses the exact function provided above
- [ ] Parser has try/catch — shows error state if fewer than 5 sections parse
- [ ] Dietary restrictions passed as HARD RULES in the user message
- [ ] Client-side restriction audit runs after generation and shows warning banner if violations found
- [ ] Wizard state object holds all 7 answers and never resets between steps
- [ ] Step validation blocks advancing on steps 1, 2, 3, 4, 6 with inline error messages
- [ ] "None" restriction deselects all others; any other option deselects "None"
- [ ] Loading overlay uses in-flow div, NOT position:fixed
- [ ] Loading overlay shows "This usually takes 20–30 seconds"
- [ ] Error state shows specific error message and "Try Again" button
- [ ] Shopping list checkboxes tracked in component state
- [ ] Budget bar uses metadata.budget as the ceiling for bar width
- [ ] Remaining Budget is green (positive) or red (over budget)
- [ ] Regenerate shows its own loading state and a timestamp on the new plan
- [ ] Edit Preferences restores wizard pre-populated with previous answers
- [ ] Menu items that don't match pipe format render as plain text, not a crash
- [ ] No horizontal overflow on any card or section on mobile
- [ ] No existing routes, pages, or components modified or broken
