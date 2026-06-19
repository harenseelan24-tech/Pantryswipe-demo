import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Module mocks ──────────────────────────────────────────────────────────────
// Same workspace mocks as health.test.ts — all routes are loaded eagerly via
// routes/index.ts, so every @workspace/* dep must be intercepted here before
// `app` is first imported.

vi.mock("@workspace/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue({
      rows: [{ "?column?": 1 }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
        })),
      })),
    })),
  },
  recipes: {},
  productsTable: {},
  insertProductSchema: { parse: vi.fn() },
  pool: { end: vi.fn() },
  sql: vi.fn(),
}));

vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "mock response" }],
      }),
    },
  },
}));

// Mock the users-store so no real file I/O or bcrypt happens in auth route tests.
vi.mock("../lib/users-store", () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  verifyPassword: vi.fn(),
}));

import app from "../app.js";
import * as usersStore from "../lib/users-store.js";

// ── Fixture ───────────────────────────────────────────────────────────────────
const mockUser = {
  id: "abc-123-def-456",
  name: "Test User",
  email: "test@example.com",
  passwordHash: "$2b$10$fakehash",
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("returns 201 with a JWT token and public user fields on success", async () => {
    vi.mocked(usersStore.createUser).mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.user.id).toBe(mockUser.id);
    expect(res.body.user.name).toBe("Test User");
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test", email: "not-an-email", password: "Password1!" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@example.com", password: "short" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 409 when the email is already registered", async () => {
    vi.mocked(usersStore.createUser).mockRejectedValue(new Error("EMAIL_EXISTS"));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("returns 500 on unexpected store errors", async () => {
    vi.mocked(usersStore.createUser).mockRejectedValue(new Error("Disk full"));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("returns 200 with a token and public user fields on valid credentials", async () => {
    vi.mocked(usersStore.findUserByEmail).mockReturnValue(mockUser);
    vi.mocked(usersStore.verifyPassword).mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.name).toBe("Test User");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 when the email is not registered", async () => {
    vi.mocked(usersStore.findUserByEmail).mockReturnValue(undefined);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Password1!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no account found/i);
  });

  it("returns 401 when the password is incorrect", async () => {
    vi.mocked(usersStore.findUserByEmail).mockReturnValue(mockUser);
    vi.mocked(usersStore.verifyPassword).mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect password/i);
  });

  it("returns 400 when email is not a valid email address", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "Password1!" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
  });
});
