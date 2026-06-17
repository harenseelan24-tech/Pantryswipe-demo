import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./middleware/rateLimiters";

// ─── Allowed origins ───────────────────────────────────────────────────────────
// Expo Go on native doesn't send an Origin header, so we allow undefined (null).
// On web, restrict to Replit preview/deploy domains and localhost.
const ALLOWED_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|\.replit\.(dev|app)$/;

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // native mobile apps, curl, server-to-server
  return ALLOWED_ORIGIN_RE.test(origin);
}

const app: Express = express();

// ─── Trust proxy (Replit reverse-proxy sets X-Forwarded-For) ─────────────────
// Required so express-rate-limit can identify clients by real IP, not proxy IP.
app.set("trust proxy", 1);

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // API-only server, no HTML served
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 h preflight cache
  })
);

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

// ─── Body parsing — 10 MB cap (vision endpoints need base64 images) ───────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Global rate limit (defence-in-depth before per-route limiters) ───────────
app.use(globalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // CORS rejections surface here
  if (err instanceof Error && err.message.startsWith("CORS:")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
