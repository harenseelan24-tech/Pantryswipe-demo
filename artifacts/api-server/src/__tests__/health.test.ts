import { describe, it, expect, vi, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";

// ── /api/healthz/live ────────────────────────────────────────────────────────
// Liveness must succeed without any external dependencies.
describe("GET /api/healthz/live", () => {
  it("responds 200 with status ok", async () => {
    const res = await request(app).get("/api/healthz/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("includes a numeric uptime field", async () => {
    const res = await request(app).get("/api/healthz/live");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ── /api/healthz (legacy) ────────────────────────────────────────────────────
describe("GET /api/healthz", () => {
  it("responds 200 with status ok for backward compat", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ── /api/healthz/ready ───────────────────────────────────────────────────────
// Readiness depends on the DB.  Mock the db module so this test is
// runnable without a real Postgres instance (unit test).
// The CI job runs the full integration version against the real DB.
describe("GET /api/healthz/ready", () => {
  it("responds 200 when DB is reachable", async () => {
    vi.mock("@workspace/db", () => ({
      db: { execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]) },
    }));

    const res = await request(app).get("/api/healthz/ready");
    expect(res.status).toBe(200);
    expect(res.body.checks.db).toBe("pass");

    vi.restoreAllMocks();
  });

  it("responds 503 when DB is unreachable", async () => {
    vi.mock("@workspace/db", () => ({
      db: { execute: vi.fn().mockRejectedValue(new Error("Connection refused")) },
    }));

    const res = await request(app).get("/api/healthz/ready");
    expect(res.status).toBe(503);
    expect(res.body.checks.db).toBe("fail");

    vi.restoreAllMocks();
  });
});

// ── 404 handler ──────────────────────────────────────────────────────────────
describe("Unknown routes", () => {
  it("returns 404 for unregistered paths", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });
});
