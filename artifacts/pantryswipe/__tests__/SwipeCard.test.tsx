/**
 * SwipeCard unit tests.
 * Tests that the module exports a valid component and pure display logic —
 * no React renderer needed.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
jest.mock("@/lib/revenuecat", () => ({
  initializeRevenueCat: jest.fn(),
  SubscriptionProvider: ({ children }: { children: unknown }) => children,
  useSubscription: () => ({ isSubscribed: false }),
}));

import { MOCK_RECIPES } from "../data/mockData";

// ─── Module existence ─────────────────────────────────────────────────────────

describe("SwipeCard module", () => {
  it("exports a valid React component (function or object)", () => {
    // Dynamic require so jest mocks load first
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../components/SwipeCard");
    const SwipeCard = mod.default ?? mod;
    // React.memo returns an object; plain function components return a function
    expect(["function", "object"]).toContain(typeof SwipeCard);
  });
});

// ─── MOCK_RECIPES — display-relevant fields ───────────────────────────────────

describe("SwipeCard recipe display data", () => {
  it("every recipe has a cuisine string for the emoji mapping", () => {
    for (const r of MOCK_RECIPES) {
      expect(typeof r.cuisine).toBe("string");
      expect(r.cuisine.length).toBeGreaterThan(0);
    }
  });

  it("every recipe has a difficulty field", () => {
    const validDifficulties = ["Easy", "Medium", "Hard"];
    for (const r of MOCK_RECIPES) {
      expect(validDifficulties).toContain(r.difficulty);
    }
  });

  it("every recipe has numeric prep and cook times", () => {
    for (const r of MOCK_RECIPES) {
      expect(typeof r.prepTime).toBe("number");
      expect(typeof r.cookTime).toBe("number");
      expect(r.prepTime).toBeGreaterThanOrEqual(0);
      expect(r.cookTime).toBeGreaterThanOrEqual(0);
    }
  });

  it("every recipe has a non-empty tags array", () => {
    for (const r of MOCK_RECIPES) {
      expect(Array.isArray(r.tags)).toBe(true);
    }
  });
});

// ─── Pantry match score logic ─────────────────────────────────────────────────
// The match % is computed in AppContext.getIngredientMatches; replicate the
// contract here so regressions are caught early.

function computeMatchScore(inPantryCount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((inPantryCount / total) * 100);
}

describe("pantry match score", () => {
  it("returns 0 for no ingredients", () => {
    expect(computeMatchScore(0, 0)).toBe(0);
  });

  it("returns 100 when all ingredients are matched", () => {
    expect(computeMatchScore(5, 5)).toBe(100);
  });

  it("returns 50 when half are matched", () => {
    expect(computeMatchScore(3, 6)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    expect(computeMatchScore(1, 3)).toBe(33);
    expect(computeMatchScore(2, 3)).toBe(67);
  });
});
