import { z } from "zod";

// ─── Shared enums ─────────────────────────────────────────────────────────────
export const VALID_UNITS = [
  "pieces", "g", "kg", "ml", "L", "pack", "bunch", "bottle",
  "can", "bag", "tbsp", "tsp", "cup", "oz", "lb",
] as const;

export const VALID_CATEGORIES = [
  "dairy", "produce", "meat", "seafood", "frozen", "grains",
  "condiments", "sauces", "spices", "drinks", "snacks", "baking", "other",
] as const;

export const VALID_LOCATIONS = [
  "fridge", "freezer", "pantry", "spice-rack",
] as const;

// ─── Vision endpoints ─────────────────────────────────────────────────────────

// Max raw image: ~7.5 MB  →  base64 adds ~33% overhead  →  ~10 M chars
const MAX_IMAGE_CHARS = 10_000_000;
const MIN_IMAGE_CHARS = 100;

/**
 * Accepts either:
 *  - Pure base64 string (no prefix)
 *  - Data-URI: data:image/<type>;base64,<data>
 */
export const ImageBodySchema = z
  .object({
    image: z
      .string()
      .min(MIN_IMAGE_CHARS, "Image data too short")
      .max(MAX_IMAGE_CHARS, "Image too large — max ~7.5 MB")
      .refine(
        (v) => {
          // Strip data-URI prefix then whitespace (MIME base64 wraps at 76 chars)
          const stripped = v
            .replace(/^data:image\/[a-z+]+;base64,/i, "")
            .replace(/\s/g, "");
          // Validate base64 character set + padding
          return /^[A-Za-z0-9+/]+=*$/.test(stripped) && stripped.length >= 50;
        },
        { message: "image must be valid base64 data" }
      ),
  })
  .strict(); // reject unexpected fields

// ─── Claude response item validation ──────────────────────────────────────────

export const VisionItemSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  quantity: z.number().positive().finite().max(100_000).catch(1),
  unit: z.enum(VALID_UNITS).catch("pieces"),
  category: z.enum(VALID_CATEGORIES).catch("other"),
  location: z.enum(VALID_LOCATIONS).catch("pantry"),
  emoji: z.string().max(10).optional(),
  estimated_price: z.number().nonnegative().finite().max(100_000).nullable().optional(),
});

export type VisionItem = z.infer<typeof VisionItemSchema>;

export const VisionItemArraySchema = z
  .array(VisionItemSchema)
  .max(100, "Too many items returned");

// ─── Bulk-add endpoint ────────────────────────────────────────────────────────

export const BulkAddSchema = z
  .object({
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(120).trim(),
          quantity: z.number().positive().finite().max(100_000),
          unit: z.enum(VALID_UNITS),
          category: z.enum(VALID_CATEGORIES),
          location: z.enum(VALID_LOCATIONS),
          emoji: z.string().max(10).optional(),
          estimated_price: z.number().nonnegative().finite().max(100_000).nullable().optional(),
        })
      )
      .min(1, "At least one item is required")
      .max(100, "Maximum 100 items per request"),
  })
  .strict();

// ─── Barcode endpoint ─────────────────────────────────────────────────────────

/** Standard barcodes: EAN-8, EAN-13, UPC-A, UPC-E, ITF-14 — all numeric, 8–14 digits */
export const BarcodeParamSchema = z.object({
  barcode: z
    .string()
    .regex(/^\d{8,14}$/, "Barcode must be 8–14 digits"),
});
