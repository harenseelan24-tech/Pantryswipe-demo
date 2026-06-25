import rateLimit from "express-rate-limit";

const isDev = process.env["NODE_ENV"] === "development";

function make429(message: string) {
  return (_req: unknown, res: { status: (c: number) => { json: (b: object) => void } }) => {
    res.status(429).json({ error: message, retryAfter: "See Retry-After header" });
  };
}

/**
 * Global catch-all — 300 requests per 15 minutes per IP.
 * Applied in app.ts before all routes.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10_000 : 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: make429("Too many requests — please slow down and try again in a few minutes."),
});

/**
 * Vision endpoints (Claude AI calls) — 20 requests per hour per IP.
 * Expensive: each call invokes Anthropic and processes a full image.
 */
export const visionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 10_000 : 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: make429("AI scan limit reached — maximum 100 scans per hour per device. Try again later."),
});

/**
 * Barcode lookup — 60 requests per 15 minutes per IP.
 */
export const barcodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10_000 : 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: make429("Barcode lookup limit reached — please wait a few minutes before scanning more."),
});

/**
 * AI/LLM endpoints (ai-chef, party-planner, recipe vary) — 30 requests per hour per IP.
 * Each request invokes a paid Anthropic model; this limiter prevents cost-exhaustion abuse.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 10_000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: make429("AI request limit reached — maximum 30 AI requests per hour per device. Try again later."),
});
