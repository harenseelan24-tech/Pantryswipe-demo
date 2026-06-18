import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const startedAt = Date.now();

/**
 * Liveness — "is the process alive?"
 *
 * Orchestrators (Kubernetes, ECS) hit this to decide whether to RESTART
 * the container. It must be cheap: no external I/O, no DB call.
 * If you add a DB call here a slow database will trigger unnecessary restarts.
 */
router.get("/healthz/live", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  });
});

/**
 * Readiness — "can this instance serve traffic?"
 *
 * Load balancers and service meshes hit this to decide whether to ROUTE
 * traffic to this instance. A 503 here removes the pod from rotation without
 * restarting it — correct behaviour when the DB is temporarily unreachable.
 */
router.get("/healthz/ready", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", checks: { db: "pass" } });
  } catch (err) {
    res.status(503).json({ status: "degraded", checks: { db: "fail" } });
  }
});

/**
 * Legacy path — preserved for backward compatibility with existing probes.
 * New code should prefer /healthz/live or /healthz/ready.
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
