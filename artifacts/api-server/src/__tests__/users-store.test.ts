import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Fast bcrypt mock ───────────────────────────────────────────────────────────
// bcrypt.hash with cost=10 takes ~100 ms per call, which would make this suite
// slow. Mock it with a deterministic identity transform so tests run in < 5 ms
// while still validating the correct/incorrect-password paths.
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (password: string) => `hashed::${password}`),
    compare: vi.fn(async (password: string, hash: string) =>
      hash === `hashed::${password}`
    ),
  },
}));

// ── fs mock — in-memory file system ──────────────────────────────────────────
// users-store uses fs to read/write a users.json file. We replace it with an
// in-memory store so tests are hermetic (no disk I/O, no leftover state).

interface MockStore {
  data: string;
  fileExists: boolean;
  dirExists: boolean;
}

const mockStore: MockStore = { data: "[]", fileExists: false, dirExists: true };

vi.mock("fs", () => {
  const fns = {
    existsSync: vi.fn((p: unknown) =>
      String(p).endsWith("users.json") ? mockStore.fileExists : mockStore.dirExists
    ),
    readFileSync: vi.fn(() => mockStore.data),
    writeFileSync: vi.fn((_p: unknown, content: unknown) => {
      mockStore.data = String(content);
      mockStore.fileExists = true;
    }),
    mkdirSync: vi.fn(() => {
      mockStore.dirExists = true;
    }),
  };
  // ESM default + named exports both needed because users-store does
  // `import fs from "fs"` (CJS interop default).
  return { default: fns, ...fns };
});

// Import the store AFTER all vi.mock() declarations so the mocks are in place.
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
} from "../lib/users-store.js";

// ── Reset in-memory store before each test ────────────────────────────────────
beforeEach(() => {
  mockStore.data = "[]";
  mockStore.fileExists = false;
  mockStore.dirExists = true;
});

// ── createUser ────────────────────────────────────────────────────────────────
describe("createUser", () => {
  it("returns a user with the given name and normalised email", async () => {
    const user = await createUser("Alice", "Alice@Example.COM", "Password1!");
    expect(user.name).toBe("Alice");
    expect(user.email).toBe("alice@example.com");
  });

  it("trims whitespace from name", async () => {
    const user = await createUser("  Bob  ", "bob@example.com", "Password1!");
    expect(user.name).toBe("Bob");
  });

  it("assigns a non-empty id and createdAt", async () => {
    const user = await createUser("Carol", "carol@example.com", "Password1!");
    expect(user.id).toBeTruthy();
    expect(user.createdAt).toBeTruthy();
    expect(new Date(user.createdAt).getFullYear()).toBeGreaterThan(2020);
  });

  it("stores a hashed password (not the plain-text password)", async () => {
    const user = await createUser("Dan", "dan@example.com", "MySecret!");
    expect(user.passwordHash).not.toBe("MySecret!");
    expect(user.passwordHash).toBeTruthy();
  });

  it("throws EMAIL_EXISTS when the same email is registered twice", async () => {
    await createUser("Eve", "eve@example.com", "Password1!");
    await expect(
      createUser("Eve2", "eve@example.com", "Password1!")
    ).rejects.toThrow("EMAIL_EXISTS");
  });

  it("throws EMAIL_EXISTS regardless of email case", async () => {
    await createUser("Frank", "frank@example.com", "Password1!");
    await expect(
      createUser("Frank2", "FRANK@EXAMPLE.COM", "Password1!")
    ).rejects.toThrow("EMAIL_EXISTS");
  });

  it("persists the new user so subsequent reads can find it", async () => {
    await createUser("Grace", "grace@example.com", "Password1!");
    const found = findUserByEmail("grace@example.com");
    expect(found).toBeDefined();
  });
});

// ── findUserByEmail ───────────────────────────────────────────────────────────
describe("findUserByEmail", () => {
  it("returns undefined when the store is empty", () => {
    expect(findUserByEmail("nobody@example.com")).toBeUndefined();
  });

  it("returns undefined when the file does not exist yet", () => {
    mockStore.fileExists = false;
    expect(findUserByEmail("test@example.com")).toBeUndefined();
  });

  it("finds a user by exact email after creation", async () => {
    const created = await createUser("Hank", "hank@example.com", "Password1!");
    const found = findUserByEmail("hank@example.com");
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it("is case-insensitive for lookup", async () => {
    await createUser("Ivy", "ivy@example.com", "Password1!");
    expect(findUserByEmail("IVY@EXAMPLE.COM")).toBeDefined();
  });

  it("returns undefined for an email that was never registered", async () => {
    await createUser("Jake", "jake@example.com", "Password1!");
    expect(findUserByEmail("other@example.com")).toBeUndefined();
  });
});

// ── findUserById ──────────────────────────────────────────────────────────────
describe("findUserById", () => {
  it("finds a user by their id", async () => {
    const created = await createUser("Kim", "kim@example.com", "Password1!");
    const found = findUserById(created.id);
    expect(found).toBeDefined();
    expect(found!.email).toBe("kim@example.com");
  });

  it("returns undefined for a non-existent id", () => {
    expect(findUserById("no-such-id")).toBeUndefined();
  });
});

// ── verifyPassword ────────────────────────────────────────────────────────────
describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const user = await createUser("Leo", "leo@example.com", "Password1!");
    expect(await verifyPassword(user, "Password1!")).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const user = await createUser("Mia", "mia@example.com", "Password1!");
    expect(await verifyPassword(user, "wrongpass")).toBe(false);
  });
});

// ── readUsers — error handling ────────────────────────────────────────────────
describe("readUsers (via findUserByEmail) — error paths", () => {
  it("returns empty result when users.json contains invalid JSON", () => {
    mockStore.fileExists = true;
    mockStore.data = "not valid json {{{{";
    // readUsers catches JSON parse errors and returns []
    expect(findUserByEmail("anyone@example.com")).toBeUndefined();
  });

  it("returns empty result when users.json is not an array", () => {
    mockStore.fileExists = true;
    mockStore.data = JSON.stringify({ not: "an array" });
    expect(findUserByEmail("anyone@example.com")).toBeUndefined();
  });
});
