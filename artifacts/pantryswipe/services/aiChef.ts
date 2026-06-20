/**
 * AI Chef Service — inference.sh REST API integration
 *
 * Uses the inference.sh REST API (https://api.inference.sh/v1/) to call:
 *   - openrouter/claude-sonnet-45 for pantry-aware cooking advice
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

export interface AiChefOptions {
  prompt: string;
  pantryItems: string[];
  dietType?: string[];
  allergies?: string[];
  skillLevel?: string;
  cuisinePreferences?: string[];
  goal?: string;
}

export interface PartyMenuResult {
  menu: Array<{ course: string; name: string; time: string }>;
  timeline: Array<{ time: string; task: string }>;
}

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
  ].filter(Boolean).join(" ");

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
 * Generate a full party menu + timeline with Claude via inference.sh.
 * Throws on failure — callers should catch and fall back to SAMPLE_MENU.
 */
export async function generatePartyMenu(options: {
  eventType: string;
  guestCount: number;
  servingStyle: string;
  budget: number;
}): Promise<PartyMenuResult> {
  const perPerson = Math.round(options.budget / options.guestCount);
  const prompt = [
    `Create a detailed party menu and timeline for:`,
    `- Event type: ${options.eventType}`,
    `- Guests: ${options.guestCount} people`,
    `- Serving style: ${options.servingStyle}`,
    `- Total budget: $${options.budget} (~$${perPerson}/person)`,
    ``,
    `Return ONLY valid JSON with this exact structure (no markdown, no explanation):`,
    `{"menu":[{"course":"Starter","name":"Dish name here","time":"30 min"}],"timeline":[{"time":"Day before","task":"Task description"}]}`,
    `Include 5-7 menu courses and 5-6 timeline entries. Each entry must be specific to the event type and budget.`,
  ].join("\n");

  const output = await runApp(LLM_APP, { prompt });
  const text = extractText(output);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in party planner response");

  const parsed = JSON.parse(jsonMatch[0]) as Partial<PartyMenuResult>;
  if (!Array.isArray(parsed.menu) || !Array.isArray(parsed.timeline)) {
    throw new Error("Invalid party menu structure from AI");
  }
  return { menu: parsed.menu, timeline: parsed.timeline };
}
