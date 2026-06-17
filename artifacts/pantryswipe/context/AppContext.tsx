import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { INITIAL_PANTRY, MOCK_RECIPES, PantryItem, Recipe } from "@/data/mockData";

// ─── Pantry quantity-aware ingredient matching helpers ───────────────────────
function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (["g", "gram", "grams", "gr"].includes(u)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["ml", "milliliter", "milliliters", "millilitre"].includes(u)) return "ml";
  if (["l", "liter", "liters", "litre", "ltr"].includes(u)) return "l";
  if (["cup", "cups"].includes(u)) return "cup";
  if (["tbsp", "tablespoon", "tablespoons"].includes(u)) return "tbsp";
  if (["tsp", "teaspoon", "teaspoons"].includes(u)) return "tsp";
  if (["piece", "pieces", "pcs", "pc", ""].includes(u)) return "piece";
  if (["can", "cans"].includes(u)) return "can";
  if (["clove", "cloves"].includes(u)) return "clove";
  return u;
}

function parseIngredientAmount(str: string): { value: number; unit: string } | null {
  if (!str) return null;
  const m = str.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
  if (!m || !m[1]) return null;
  return { value: parseFloat(m[1]), unit: normalizeUnit(m[2] || "") };
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ─── API recipe shape returned by the server ──────────────────────────────────
interface ApiRecipe {
  id: number;
  name: string;
  cuisine: string | null;
  difficulty: string | null;
  cook_time_mins: number | null;
  servings: number | null;
  calories: number | null;
  rating: string | null;
  macros_json: { protein: number; carbs: number; fat: number; fibre: number } | null;
  ingredients_json: Array<{ name: string; quantity: string; unit: string }> | null;
  steps_json: Array<{ step_number: number; instruction: string; timer_seconds: number | null }> | null;
  tags: string[] | null;
  event_types: string[] | null;
  dietary_flags: string[] | null;
  allergens: string[] | null;
  image_url: string | null;
  source: string | null;
  pantry_match_percent?: number;
}

/** Map an API recipe response to the app's frontend Recipe type */
function mapApiRecipe(r: ApiRecipe): Recipe {
  const totalTime = r.cook_time_mins ?? 30;
  const prepTime = Math.round(totalTime * 0.3);
  const cookTime = totalTime - prepTime;
  const macros = r.macros_json ?? { protein: 0, carbs: 0, fat: 0, fibre: 0 };

  return {
    id: `api_${r.id}`,
    title: r.name,
    description: r.tags?.slice(0, 3).join(" · ") || `${r.cuisine ?? "World"} cuisine`,
    cuisine: r.cuisine ?? "International",
    difficulty: (["Easy", "Medium", "Hard"].includes(r.difficulty ?? "")
      ? r.difficulty
      : "Medium") as "Easy" | "Medium" | "Hard",
    prepTime,
    cookTime,
    servings: r.servings ?? 2,
    calories: r.calories ?? 0,
    rating: Math.round(parseFloat(r.rating ?? "4.0") * 10) / 10,
    reviewCount: Math.max(50, Math.round(parseFloat(r.rating ?? "4.0") * 120 + (r.id % 200))),
    ingredients: (r.ingredients_json ?? []).map((ing) => ({
      name: ing.name,
      amount: ing.quantity || "1",
      inPantry: false,
    })),
    steps: (r.steps_json ?? []).map((s) => ({
      step: s.step_number,
      instruction: s.instruction,
      timerMinutes: s.timer_seconds ? Math.round(s.timer_seconds / 60) : undefined,
    })),
    nutrition: {
      protein: macros.protein ?? 0,
      carbs: macros.carbs ?? 0,
      fat: macros.fat ?? 0,
      fiber: (macros as any).fibre ?? 0,
    },
    tags: r.tags ?? [],
    image: r.image_url ?? null,
    creator: r.source === "themealdb" ? "TheMealDB" : "AI Chef",
    creatorAvatar: "",
    dietTags: r.dietary_flags ?? [],
    eventTypes: r.event_types ?? [],
  };
}

// ─── Context types ────────────────────────────────────────────────────────────
interface UserProfile {
  name: string;
  email: string;
  country: string;
  skillLevel: string;
  dietType: string[];
  allergies: string[];
  householdSize: number;
  cuisinePreferences: string[];
  goal: string;
  weeklyBudget: number;
  setupComplete: boolean;
}

interface CookingStats {
  mealsCoooked: number;
  streak: number;
  lastCookedDate: string;
  xp: number;
  level: number;
  moneySaved: number;
  wasteReduced: number;
}

interface AppContextType {
  userProfile: UserProfile;
  pantryItems: PantryItem[];
  savedRecipes: string[];
  cookedRecipes: string[];
  stats: CookingStats;
  isSetupComplete: boolean;
  liveRecipes: Recipe[];
  recipesLoading: boolean;
  updateProfile: (profile: Partial<UserProfile>) => void;
  completeSetup: () => void;
  addToPantry: (item: PantryItem) => void;
  removeFromPantry: (id: string) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  saveRecipe: (id: string) => void;
  unsaveRecipe: (id: string) => void;
  markCooked: (id: string) => void;
  getMatchingRecipes: () => Recipe[];
  getPantryMatchScore: (recipe: Recipe) => number;
  getIngredientMatches: (recipe: Recipe) => Array<{ name: string; amount: string; inPantry: boolean; sufficient: boolean }>;
  refreshRecipes: () => void;
}

const defaultProfile: UserProfile = {
  name: "Alex",
  email: "",
  country: "United States",
  skillLevel: "Home Cook",
  dietType: ["Omnivore"],
  allergies: [],
  householdSize: 2,
  cuisinePreferences: ["Italian", "Japanese", "Korean"],
  goal: "Eat Healthier",
  weeklyBudget: 100,
  setupComplete: false,
};

const defaultStats: CookingStats = {
  mealsCoooked: 24,
  streak: 7,
  lastCookedDate: new Date().toISOString(),
  xp: 1250,
  level: 8,
  moneySaved: 340,
  wasteReduced: 12,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(INITIAL_PANTRY);
  const [savedRecipes, setSavedRecipes] = useState<string[]>(["1", "3"]);
  const [cookedRecipes, setCookedRecipes] = useState<string[]>(["1", "2", "4"]);
  const [stats, setStats] = useState<CookingStats>(defaultStats);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Live recipes from API — falls back to MOCK_RECIPES when not yet loaded
  const [liveRecipes, setLiveRecipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [recipesLoading, setRecipesLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileData, pantryData, savedData, cookedData, statsData, setupData] = await Promise.all([
        AsyncStorage.getItem("pantryswipe_profile"),
        AsyncStorage.getItem("pantryswipe_pantry"),
        AsyncStorage.getItem("pantryswipe_saved"),
        AsyncStorage.getItem("pantryswipe_cooked"),
        AsyncStorage.getItem("pantryswipe_stats"),
        AsyncStorage.getItem("pantryswipe_setup_complete"),
      ]);

      const loadedProfile: UserProfile | undefined = profileData
        ? (JSON.parse(profileData) as UserProfile)
        : undefined;

      if (loadedProfile) setUserProfile(loadedProfile);
      if (pantryData) setPantryItems(JSON.parse(pantryData));
      if (savedData) setSavedRecipes(JSON.parse(savedData));
      if (cookedData) setCookedRecipes(JSON.parse(cookedData));
      if (statsData) setStats(JSON.parse(statsData));
      if (setupData) setIsSetupComplete(JSON.parse(setupData));

      // Pass loaded profile so we use correct saved cuisine prefs, not the
      // stale default profile from the first render closure.
      fetchLiveRecipes(loadedProfile);
    } catch {
      // Use defaults on error — still attempt to fetch live recipes
      fetchLiveRecipes();
    }
  };

  const isFetchingRef = React.useRef(false);

  const fetchLiveRecipes = useCallback(async (profile?: UserProfile) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setRecipesLoading(true);
    try {
      const prefs = profile ?? userProfile;
      const params = new URLSearchParams();
      if (prefs.cuisinePreferences?.length) {
        params.set("cuisines", prefs.cuisinePreferences.join(","));
      }
      if (prefs.allergies?.length) {
        params.set("allergies", prefs.allergies.join(","));
      }
      params.set("limit", "60");

      const res = await fetch(`${API_BASE}/recipes/swipe?${params.toString()}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return;
      const data: ApiRecipe[] = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setLiveRecipes(data.map(mapApiRecipe));
      }
      // If API returns empty (not yet seeded), MOCK_RECIPES remain as fallback
    } catch {
      // Network error — keep current recipes (mock or previously loaded)
    } finally {
      isFetchingRef.current = false;
      setRecipesLoading(false);
    }
  }, [userProfile]);

  const saveData = async (key: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    const newProfile = { ...userProfile, ...updates };
    setUserProfile(newProfile);
    saveData("pantryswipe_profile", newProfile);
  };

  const completeSetup = () => {
    setIsSetupComplete(true);
    saveData("pantryswipe_setup_complete", true);
    const updated = { ...userProfile, setupComplete: true };
    setUserProfile(updated);
    saveData("pantryswipe_profile", updated);
    // Refresh recipes with the newly saved profile preferences
    fetchLiveRecipes(updated);
  };

  const addToPantry = (item: PantryItem) => {
    const updated = [...pantryItems, item];
    setPantryItems(updated);
    saveData("pantryswipe_pantry", updated);
  };

  const removeFromPantry = (id: string) => {
    const updated = pantryItems.filter((i) => i.id !== id);
    setPantryItems(updated);
    saveData("pantryswipe_pantry", updated);
  };

  const updatePantryItem = (id: string, updates: Partial<PantryItem>) => {
    const updated = pantryItems.map((i) => (i.id === id ? { ...i, ...updates } : i));
    setPantryItems(updated);
    saveData("pantryswipe_pantry", updated);
  };

  const saveRecipe = (id: string) => {
    if (!savedRecipes.includes(id)) {
      const updated = [...savedRecipes, id];
      setSavedRecipes(updated);
      saveData("pantryswipe_saved", updated);
    }
  };

  const unsaveRecipe = (id: string) => {
    const updated = savedRecipes.filter((r) => r !== id);
    setSavedRecipes(updated);
    saveData("pantryswipe_saved", updated);
  };

  const markCooked = (id: string) => {
    if (!cookedRecipes.includes(id)) {
      const updated = [...cookedRecipes, id];
      setCookedRecipes(updated);
      saveData("pantryswipe_cooked", updated);
      const newStats = {
        ...stats,
        mealsCoooked: stats.mealsCoooked + 1,
        xp: stats.xp + 50,
        streak: stats.streak + 1,
        moneySaved: stats.moneySaved + 12,
      };
      setStats(newStats);
      saveData("pantryswipe_stats", newStats);
    }
  };

  const getIngredientMatches = useCallback((recipe: Recipe) => {
    return recipe.ingredients.map((ing) => {
      const ingName = ing.name.toLowerCase();
      const pantryItem = pantryItems.find((p) => {
        const pName = p.name.toLowerCase();
        return pName.includes(ingName) || ingName.includes(pName);
      });
      if (!pantryItem) return { name: ing.name, amount: ing.amount, inPantry: false, sufficient: false };

      const needed = parseIngredientAmount(ing.amount);
      const haveUnit = normalizeUnit(pantryItem.unit);
      let sufficient = true;
      if (needed && needed.unit && needed.unit !== "piece" && haveUnit && needed.unit === haveUnit) {
        sufficient = pantryItem.quantity >= needed.value;
      }
      return { name: ing.name, amount: ing.amount, inPantry: sufficient, sufficient };
    });
  }, [pantryItems]);

  const getPantryMatchScore = (recipe: Recipe): number => {
    const pantryNames = pantryItems.map((p) => p.name.toLowerCase());
    if (recipe.ingredients.length === 0) return 0;
    const matching = recipe.ingredients.filter((ing) =>
      pantryNames.some((p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p))
    );
    return Math.round((matching.length / recipe.ingredients.length) * 100);
  };

  const getMatchingRecipes = (): Recipe[] => {
    return [...liveRecipes].sort((a, b) => getPantryMatchScore(b) - getPantryMatchScore(a));
  };

  const refreshRecipes = useCallback(() => {
    fetchLiveRecipes();
  }, [fetchLiveRecipes]);

  return (
    <AppContext.Provider
      value={{
        userProfile,
        pantryItems,
        savedRecipes,
        cookedRecipes,
        stats,
        isSetupComplete,
        liveRecipes,
        recipesLoading,
        updateProfile,
        completeSetup,
        addToPantry,
        removeFromPantry,
        updatePantryItem,
        saveRecipe,
        unsaveRecipe,
        markCooked,
        getMatchingRecipes,
        getPantryMatchScore,
        getIngredientMatches,
        refreshRecipes,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
