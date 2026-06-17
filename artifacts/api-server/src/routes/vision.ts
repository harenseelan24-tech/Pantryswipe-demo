import { Router, type IRouter, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import { visionLimiter } from "../middleware/rateLimiters";
import {
  ImageBodySchema,
  VisionItemArraySchema,
  BulkAddSchema,
  type VisionItem,
} from "../lib/schemas";

const router: IRouter = Router();

const ITEM_EMOJIS: Record<string, string> = {
  dairy: "🥛", produce: "🥦", meat: "🥩", seafood: "🐟",
  frozen: "❄️", grains: "🌾", condiments: "🧂", sauces: "🫙",
  spices: "🌶️", drinks: "🍷", snacks: "🍫", baking: "🥄", other: "📦",
};

function assignEmoji(category: string): string {
  return ITEM_EMOJIS[category?.toLowerCase()] ?? "🍽️";
}

// ─── Claude vision call ────────────────────────────────────────────────────────
async function callClaude(
  prompt: string,
  imageBase64: string,
  mediaType: AnthropicMediaType = "image/jpeg",
): Promise<VisionItem[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imageBase64 },
        },
        { type: "text", text: prompt },
      ],
    }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  // Extract the first JSON array from Claude's response
  const jsonMatch = textBlock.text.trim().match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return []; // malformed JSON from Claude — return empty rather than crashing
  }

  // Validate and coerce each item through the schema (strips unknown fields, enforces types)
  const result = VisionItemArraySchema.safeParse(parsed);
  if (!result.success) return [];
  return result.data;
}

// ─── Shared request handler logic ─────────────────────────────────────────────
/** Supported media types for Anthropic's vision API */
type AnthropicMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Strip data-URI prefix and whitespace, then auto-detect the image format
 * from the base64 magic bytes so Anthropic decodes it correctly.
 */
function parseAndStripImage(rawImage: string): { data: string; mediaType: AnthropicMediaType } {
  const data = rawImage
    .replace(/^data:image\/[a-z+]+;base64,/i, "")
    .replace(/\s/g, ""); // remove MIME line-wrap newlines

  // Detect format from base64-encoded magic bytes
  let mediaType: AnthropicMediaType = "image/jpeg"; // safe default
  if (data.startsWith("iVBOR")) mediaType = "image/png";   // PNG: 89 50 4E 47
  else if (data.startsWith("R0lG")) mediaType = "image/gif"; // GIF: 47 49 46
  else if (data.startsWith("UklG")) mediaType = "image/webp"; // RIFF/WEBP
  // JPEG starts with /9j/ — already the default

  return { data, mediaType };
}

// ─── POST /api/vision/scan-pantry ─────────────────────────────────────────────
router.post("/vision/scan-pantry", visionLimiter, async (req: Request, res: Response) => {
  const parsed = ImageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }

  const { data: base64, mediaType } = parseAndStripImage(parsed.data.image);

  const prompt = `You are a pantry inventory AI. Identify every visible food item in this image.
Return ONLY a valid JSON array, no markdown, no explanation. Each object must have:
- name (string, clean common name, max 80 chars)
- quantity (number, estimate 1 if unclear)
- unit (one of: pieces/g/kg/ml/L/pack/bunch/bottle/can/bag/tbsp/tsp/cup/oz/lb)
- category (one of: dairy/produce/meat/seafood/frozen/grains/condiments/sauces/spices/drinks/snacks/baking/other)
- location (one of: fridge/freezer/pantry/spice-rack — infer from item type)
If no food items are visible, return [].`;

  try {
    const items = await callClaude(prompt, base64, mediaType);
    res.json({ items: items.map((item) => ({ ...item, emoji: assignEmoji(item.category) })) });
  } catch (err) {
    logger.error({ err }, "scan-pantry vision error");
    res.json({ items: [] });
  }
});

// ─── POST /api/vision/scan-receipt ────────────────────────────────────────────
router.post("/vision/scan-receipt", visionLimiter, async (req: Request, res: Response) => {
  const parsed = ImageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }

  const { data: base64, mediaType } = parseAndStripImage(parsed.data.image);

  const prompt = `You are a grocery receipt parser. Read this receipt image carefully.
Extract every food and grocery item. Ignore non-food items (bags, batteries, cleaning products).
Return ONLY a valid JSON array, no markdown, no explanation. Each object must have:
- name (string, clean readable product name, max 80 chars — not a barcode or SKU)
- quantity (number — if receipt shows "2x Milk" use 2, else default to 1)
- unit (one of: pieces/g/kg/ml/L/pack/can/bottle/bag/tbsp/tsp/cup/oz/lb)
- category (one of: dairy/produce/meat/seafood/frozen/grains/condiments/sauces/spices/drinks/snacks/baking/other)
- location (one of: fridge/freezer/pantry/spice-rack — infer from product)
- estimated_price (number, the price shown next to the item, or null if not visible)
If the image is not a readable receipt, return [].`;

  try {
    const items = await callClaude(prompt, base64, mediaType);
    res.json({ items: items.map((item) => ({ ...item, emoji: assignEmoji(item.category) })) });
  } catch (err) {
    logger.error({ err }, "scan-receipt vision error");
    res.json({ items: [] });
  }
});

// ─── POST /api/pantry/bulk-add ────────────────────────────────────────────────
// Acknowledgement endpoint — actual persistence is client-side via AsyncStorage.
router.post("/pantry/bulk-add", (req: Request, res: Response) => {
  const parsed = BulkAddSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  res.json({ success: true, count: parsed.data.items.length });
});

export default router;
