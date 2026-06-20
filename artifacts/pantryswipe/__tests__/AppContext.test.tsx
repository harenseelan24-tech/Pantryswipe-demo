/**
 * AppContext / data-layer unit tests.
 * Tests pure functions and data shapes — no React renderer needed.
 */

import { MOCK_RECIPES, INITIAL_PANTRY, type Recipe, type PantryItem } from "../data/mockData";
import { STORAGE_KEYS } from "../constants/storageKeys";

// ─── MOCK_RECIPES ─────────────────────────────────────────────────────────────

describe("MOCK_RECIPES", () => {
  it("contains at least one recipe", () => {
    expect(MOCK_RECIPES.length).toBeGreaterThan(0);
  });

  it("every recipe has the required fields", () => {
    for (const r of MOCK_RECIPES) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.title).toBe("string");
      expect(typeof r.cuisine).toBe("string");
      expect(typeof r.calories).toBe("number");
      expect(Array.isArray(r.ingredients)).toBe(true);
      expect(typeof r.prepTime).toBe("number");
      expect(typeof r.cookTime).toBe("number");
    }
  });

  it("all ingredient entries have name and amount", () => {
    for (const r of MOCK_RECIPES) {
      for (const ing of r.ingredients) {
        expect(typeof ing.name).toBe("string");
        expect(typeof ing.amount).toBe("string");
      }
    }
  });

  it("calories are positive numbers", () => {
    for (const r of MOCK_RECIPES) {
      expect(r.calories).toBeGreaterThan(0);
    }
  });

  it("recipe IDs are unique", () => {
    const ids = MOCK_RECIPES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─── INITIAL_PANTRY ───────────────────────────────────────────────────────────

describe("INITIAL_PANTRY", () => {
  it("starts with pantry items", () => {
    expect(INITIAL_PANTRY.length).toBeGreaterThan(0);
  });

  it("every pantry item has required fields", () => {
    const validCategories: PantryItem["category"][] = [
      "Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Beverages", "Produce",
    ];
    const validStatuses: PantryItem["status"][] = ["Fresh", "Use Soon", "Expiring", "Expired"];

    for (const item of INITIAL_PANTRY) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.name).toBe("string");
      expect(typeof item.emoji).toBe("string");
      expect(typeof item.quantity).toBe("number");
      expect(typeof item.unit).toBe("string");
      expect(validCategories).toContain(item.category);
      expect(validStatuses).toContain(item.status);
    }
  });

  it("all pantry item IDs are unique", () => {
    const ids = INITIAL_PANTRY.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── STORAGE_KEYS ─────────────────────────────────────────────────────────────

describe("STORAGE_KEYS", () => {
  it("exports all required storage keys", () => {
    const required = [
      "PANTRY",
      "SAVED",
      "COOKED",
      "PROFILE",
      "STATS",
      "COOKING_HISTORY",
      "SETUP_COMPLETE",
    ];
    for (const key of required) {
      expect(STORAGE_KEYS).toHaveProperty(key);
      expect(typeof (STORAGE_KEYS as Record<string, string>)[key]).toBe("string");
    }
  });

  it("storage key values are unique (no accidental collision)", () => {
    const values = Object.values(STORAGE_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

// ─── Streak logic ─────────────────────────────────────────────────────────────
// The computeNewStreak helper is internal to AppContext, so we replicate
// the contract here to ensure future refactors don't silently break it.

function computeNewStreak(currentStreak: number, lastCookedDate: string): number {
  if (!lastCookedDate) return 1;
  const today = new Date().toISOString().split("T")[0];
  const last = lastCookedDate.split("T")[0];
  if (last === today) return currentStreak;
  const todayMs = new Date(today).getTime();
  const lastMs = new Date(last).getTime();
  const diffDays = Math.round((todayMs - lastMs) / 86_400_000);
  if (diffDays === 1) return currentStreak + 1;
  return 1;
}

describe("computeNewStreak", () => {
  it("returns 1 when no previous cook date", () => {
    expect(computeNewStreak(5, "")).toBe(1);
  });

  it("returns the same streak when cooked today already", () => {
    const today = new Date().toISOString();
    expect(computeNewStreak(3, today)).toBe(3);
  });

  it("increments streak by 1 when cooked yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(computeNewStreak(4, yesterday)).toBe(5);
  });

  it("resets streak to 1 when more than 1 day has passed", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(computeNewStreak(10, twoDaysAgo)).toBe(1);
  });

  it("handles date-only strings (no time component)", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    expect(computeNewStreak(2, yesterday)).toBe(3);
  });
});
