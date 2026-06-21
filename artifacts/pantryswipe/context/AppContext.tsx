import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import { INITIAL_PANTRY, MOCK_RECIPES, PantryItem, Recipe } from "@/data/mockData";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { supabase } from "@/lib/supabase";
import type { SupabaseProfile } from "@/types/supabaseProfile";

// ─── Unit normalisation ───────────────────────────────────────────────────────
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

/**
 * Compute the new streak value given the current streak and the date of the
 * last cook session.
 * - Same calendar day  → unchanged (already counted today)
 * - Previous calendar day → consecutive, increment by 1
 * - Older or empty     → streak broken, reset to 1
 */
function computeNewStreak(currentStreak: number, lastCookedDate: string): number {
  if (!lastCookedDate) return 1;
  const today = new Date().toISOString().split("T")[0];
  const last  = lastCookedDate.split("T")[0]; // tolerates full ISO or date-only strings
  if (last === today) return currentStreak;   // already cooked today — don't double-count
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  if (last === yesterday) return currentStreak + 1; // consecutive day
  return 1; // gap — streak resets
}

const API_BASE = Platform.OS !== "web"
  ? `https://${process.env.EXPO_PUBLIC_API_DOMAIN ?? "zip-repl-cactusussy24.replit.app"}/api`
  : "/api";

// ─── Personalization helpers ──────────────────────────────────────────────────
const ALLERGEN_INGREDIENT_MAP: Record<string, string[]> = {
  "Peanuts":    ["peanut", "peanut butter", "groundnut"],
  "Tree Nuts":  ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "pine nut"],
  "Dairy":      ["milk", "butter", "cream", "cheese", "yogurt", "parmesan", "mozzarella", "ricotta", "feta", "ghee", "paneer"],
  "Gluten":     ["flour", "bread", "pasta", "spaghetti", "noodle", "wheat", "oats", "ramen", "tortilla", "barley", "sourdough", "bun"],
  "Eggs":       ["egg"],
  "Shellfish":  ["shrimp", "prawn", "crab", "lobster", "scallop", "mussel", "clam", "oyster"],
  "Fish":       ["salmon", "tuna", "cod", "fish", "anchovy", "sardine", "halibut", "tilapia", "mackerel"],
  "Soy":        ["soy sauce", "tofu", "edamame", "miso", "tempeh", "soy milk"],
  "Sesame":     ["sesame", "tahini"],
  "Sulphites":  ["wine", "vinegar"],
  "Corn":       ["corn", "cornstarch", "maize"],
};

function recipeContainsAllergen(recipe: Recipe, allergen: string): boolean {
  const keywords = ALLERGEN_INGREDIENT_MAP[allergen] ?? [allergen.toLowerCase()];
  const ingredientText = recipe.ingredients.map((i) => i.name.toLowerCase()).join(" | ");
  return keywords.some((kw) => ingredientText.includes(kw.toLowerCase()));
}

function isDietMatch(recipe: Recipe, dietTypes: string[]): boolean {
  if (!dietTypes.length || dietTypes.includes("Omnivore")) return true;
  if (dietTypes.includes("Vegan"))
    return recipe.dietTags.some((t) => t === "Vegan");
  if (dietTypes.includes("Vegetarian"))
    return recipe.dietTags.some((t) => ["Vegan", "Vegetarian"].includes(t));
  if (dietTypes.includes("Pescatarian"))
    return recipe.dietTags.some((t) => ["Vegan", "Vegetarian", "Pescatarian"].includes(t));
  if (dietTypes.includes("Halal"))
    return recipe.dietTags.some((t) => ["Halal", "Vegan", "Vegetarian"].includes(t));
  if (dietTypes.includes("Keto"))
    return recipe.dietTags.includes("Keto") || (recipe.nutrition.carbs <= 25 && recipe.nutrition.fat >= 20);
  if (dietTypes.includes("Gluten-Free"))
    return recipe.dietTags.includes("Gluten-Free");
  if (dietTypes.includes("Paleo"))
    return recipe.dietTags.includes("Paleo");
  return dietTypes.some((dt) => recipe.dietTags.includes(dt));
}

// ─── API recipe shape ─────────────────────────────────────────────────────────
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
      timerMinutes: s.timer_seconds ? Math.ceil(s.timer_seconds / 60) : undefined,
    })),
    nutrition: {
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fibre,
    },
    tags: r.tags ?? [],
    image: r.image_url ?? null,
    creator: "PantrySwipe",
    creatorAvatar: "👨‍🍳",
    dietTags: r.dietary_flags ?? [],
    eventTypes: r.event_types ?? [],
  };
}

// ─── Cooking history entry ────────────────────────────────────────────────────
export interface CookingEntry {
  id: string;
  recipeId: string;
  recipeTitle: string;
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  mealType: "Breakfast" | "Lunch" | "Dinner";
  servings: number;
}

// ─── Context types ────────────────────────────────────────────────────────────
interface UserProfile {
  name: string;
  email: string;
  country: string;
  skillLevel: string;
  dietType: string[];
  allergies: string[];
  proteinPreferences: string[];
  householdSize: number;
  cuisinePreferences: string[];
  goal: string;
  weeklyBudget: number;
  setupComplete: boolean;
  photoUri?: string;
  bio?: string;
}

interface CookingStats {
  mealsCooked: number;
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
  cookingHistory: CookingEntry[];
  stats: CookingStats;
  isSetupComplete: boolean;
  liveRecipes: Recipe[];
  recipesLoading: boolean;
  followingList: string[];
  savedPostIds: string[];
  authUser: User | null;
  session: Session | null;
  isLoadingAuth: boolean;
  supabaseProfile: SupabaseProfile | null;
  updateProfile: (profile: Partial<UserProfile>) => void;
  completeSetup: () => void;
  completeOnboarding: (data: {
    name: string; email: string; skillLevel: string; dietType: string[];
    allergies: string[]; proteinPreferences: string[]; goal: string;
    cuisinePreferences: string[]; householdSize: number; weeklyBudget: number;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  addToPantry: (item: PantryItem) => void;
  removeFromPantry: (id: string) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  saveRecipe: (id: string) => void;
  unsaveRecipe: (id: string) => void;
  markCooked: (id: string) => void;
  cookDish: (recipe: Recipe, mealType: "Breakfast" | "Lunch" | "Dinner", servings: number) => number;
  getMatchingRecipes: () => Recipe[];
  getPantryMatchScore: (recipe: Recipe) => number;
  getIngredientMatches: (recipe: Recipe) => Array<{ name: string; amount: string; inPantry: boolean; sufficient: boolean }>;
  refreshRecipes: () => void;
  getPersonalizedRecipes: (pool?: Recipe[]) => Recipe[];
  learningProfile: LearningProfile;
  trackSwipe: (recipe: Recipe, direction: "right" | "left" | "up") => void;
  followUser: (handle: string) => void;
  unfollowUser: (handle: string) => void;
  isFollowing: (handle: string) => boolean;
  toggleSavePost: (postId: string) => void;
  isPostSaved: (postId: string) => boolean;
}

// ─── Learning / adaptive preferences ─────────────────────────────────────────
export interface LearningProfile {
  /** Cuisine → number of right swipes (cook) */
  swipeRights: Record<string, number>;
  /** Cuisine → number of left swipes (skip) */
  swipeLefts: Record<string, number>;
  /** Cuisine → number of up swipes (save) */
  saved: Record<string, number>;
  /** How many swipes total so we know when to start weighting */
  totalSwipes: number;
}

const defaultLearning: LearningProfile = {
  swipeRights: {},
  swipeLefts: {},
  saved: {},
  totalSwipes: 0,
};

const defaultProfile: UserProfile = {
  name: "Alex",
  email: "",
  country: "United States",
  skillLevel: "Home Cook",
  dietType: ["Omnivore"],
  allergies: [],
  proteinPreferences: [],
  householdSize: 2,
  cuisinePreferences: [],
  goal: "Eat Healthier",
  weeklyBudget: 0,
  setupComplete: false,
};

const defaultStats: CookingStats = {
  mealsCooked: 0,
  streak: 0,
  lastCookedDate: "",
  xp: 0,
  level: 1,
  moneySaved: 0,
  wasteReduced: 0,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(INITIAL_PANTRY);
  const [savedRecipes, setSavedRecipes] = useState<string[]>([]);
  const [cookedRecipes, setCookedRecipes] = useState<string[]>([]);
  const [cookingHistory, setCookingHistory] = useState<CookingEntry[]>([]);
  const [stats, setStats] = useState<CookingStats>(defaultStats);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [learningProfile, setLearningProfile] = useState<LearningProfile>(defaultLearning);

  const [liveRecipes, setLiveRecipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [supabaseProfile, setSupabaseProfile] = useState<SupabaseProfile | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error || !data) { setSupabaseProfile(null); return; }
      setSupabaseProfile(data as SupabaseProfile);
    } catch {
      setSupabaseProfile(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) { fetchProfile(s.user.id); }
      else { setIsLoadingAuth(false); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setIsLoadingAuth(false));
      } else {
        setSupabaseProfile(null);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profileData, pantryData, savedData, cookedData, statsData, setupData, historyData, learningData, followingData, savedPostsData] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
          AsyncStorage.getItem(STORAGE_KEYS.PANTRY),
          AsyncStorage.getItem(STORAGE_KEYS.SAVED),
          AsyncStorage.getItem(STORAGE_KEYS.COOKED),
          AsyncStorage.getItem(STORAGE_KEYS.STATS),
          AsyncStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE),
          AsyncStorage.getItem(STORAGE_KEYS.COOKING_HISTORY),
          AsyncStorage.getItem(STORAGE_KEYS.LEARNING),
          AsyncStorage.getItem(STORAGE_KEYS.SOCIAL_FOLLOWING),
          AsyncStorage.getItem(STORAGE_KEYS.SOCIAL_SAVED_POSTS),
        ]);

      const safeParse = <T,>(raw: string | null): T | null => {
        if (!raw) return null;
        try { return JSON.parse(raw) as T; } catch { return null; }
      };

      const loadedProfile = safeParse<UserProfile>(profileData);
      if (loadedProfile) setUserProfile(loadedProfile);
      const parsedPantry = safeParse<typeof INITIAL_PANTRY>(pantryData);
      if (parsedPantry) setPantryItems(parsedPantry);
      const parsedSaved = safeParse<string[]>(savedData);
      if (parsedSaved) setSavedRecipes(parsedSaved);
      const parsedCooked = safeParse<string[]>(cookedData);
      if (parsedCooked) setCookedRecipes(parsedCooked);
      const parsedStats = safeParse<typeof defaultStats>(statsData);
      if (parsedStats) setStats(parsedStats);
      const parsedSetup = safeParse<boolean>(setupData);
      if (parsedSetup !== null) setIsSetupComplete(parsedSetup);
      const parsedHistory = safeParse<unknown[]>(historyData);
      if (parsedHistory) setCookingHistory(parsedHistory as any);
      const parsedLearning = safeParse<typeof defaultLearning>(learningData);
      if (parsedLearning) setLearningProfile(parsedLearning);
      const parsedFollowing = safeParse<string[]>(followingData);
      if (parsedFollowing) setFollowingList(parsedFollowing);
      const parsedSavedPosts = safeParse<string[]>(savedPostsData);
      if (parsedSavedPosts) setSavedPostIds(parsedSavedPosts);

      fetchLiveRecipes(loadedProfile ?? undefined);
    } catch {
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
      if (prefs.cuisinePreferences?.length) params.set("cuisines", prefs.cuisinePreferences.join(","));
      if (prefs.allergies?.length) params.set("allergies", prefs.allergies.join(","));
      params.set("limit", "60");

      const recipeController = new AbortController();
      const recipeTimer = setTimeout(() => recipeController.abort(), 30000);
      const res = await fetch(`${API_BASE}/recipes/swipe?${params.toString()}`, { signal: recipeController.signal });
      clearTimeout(recipeTimer);

      if (!res.ok) return;
      const data: ApiRecipe[] = await res.json();
      if (Array.isArray(data) && data.length > 0) setLiveRecipes(data.map(mapApiRecipe));
    } catch {
      // keep current recipes
    } finally {
      isFetchingRef.current = false;
      setRecipesLoading(false);
    }
  }, [userProfile]);

  const saveData = async (key: string, value: unknown) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    const newProfile = { ...userProfile, ...updates };
    setUserProfile(newProfile);
    saveData(STORAGE_KEYS.PROFILE, newProfile);
  };

  const completeSetup = () => {
    setIsSetupComplete(true);
    saveData(STORAGE_KEYS.SETUP_COMPLETE, true);
    // Use functional update so we get the LATEST state (including any
    // changes from updateProfile called just before this in onboarding).
    setUserProfile((prev) => {
      const updated = { ...prev, setupComplete: true };
      saveData(STORAGE_KEYS.PROFILE, updated);
      fetchLiveRecipes(updated);
      return updated;
    });
  };

  const signOut = async (): Promise<void> => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.SETUP_COMPLETE,
        STORAGE_KEYS.PROFILE,
        STORAGE_KEYS.PANTRY,
        STORAGE_KEYS.SAVED,
        STORAGE_KEYS.COOKED,
        STORAGE_KEYS.STATS,
        STORAGE_KEYS.COOKING_HISTORY,
        STORAGE_KEYS.LEARNING,
        STORAGE_KEYS.SOCIAL_FOLLOWING,
        STORAGE_KEYS.SOCIAL_SAVED_POSTS,
      ]);
    } catch { /* ignore */ }
    setUserProfile(defaultProfile);
    setPantryItems(INITIAL_PANTRY);
    setSavedRecipes([]);
    setCookedRecipes([]);
    setCookingHistory([]);
    setStats(defaultStats);
    setIsSetupComplete(false);
    setLearningProfile(defaultLearning);
    setFollowingList([]);
    setSavedPostIds([]);
    setSupabaseProfile(null);
    setAuthUser(null);
    setSession(null);
  };

  const completeOnboarding = async (data: {
    name: string; email: string; skillLevel: string; dietType: string[];
    allergies: string[]; proteinPreferences: string[]; goal: string;
    cuisinePreferences: string[]; householdSize: number; weeklyBudget: number;
  }): Promise<void> => {
    const userId = authUser?.id;
    if (userId) {
      const profileRow = {
        id: userId,
        display_name: data.name,
        avatar_url: authUser?.user_metadata?.avatar_url ?? null,
        diet_preferences: data.dietType,
        allergies: data.allergies,
        protein_preferences: data.proteinPreferences,
        skill_level: data.skillLevel,
        household_size: data.householdSize,
        cuisine_preferences: data.cuisinePreferences,
        goal: data.goal,
        weekly_budget: data.weeklyBudget,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      };
      const { data: saved } = await (supabase
        .from("profiles") as any)
        .upsert(profileRow, { onConflict: "id" })
        .select()
        .single();
      if (saved) setSupabaseProfile(saved as SupabaseProfile);
    }
    updateProfile({
      name: data.name, email: data.email, skillLevel: data.skillLevel,
      dietType: data.dietType, allergies: data.allergies,
      proteinPreferences: data.proteinPreferences, goal: data.goal,
      cuisinePreferences: data.cuisinePreferences,
      householdSize: data.householdSize, weeklyBudget: data.weeklyBudget,
    });
    await AsyncStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, "true");
    completeSetup();
  };

  const followUser = (handle: string) => {
    if (followingList.includes(handle)) return;
    const updated = [...followingList, handle];
    setFollowingList(updated);
    saveData(STORAGE_KEYS.SOCIAL_FOLLOWING, updated);
  };

  const unfollowUser = (handle: string) => {
    const updated = followingList.filter((h) => h !== handle);
    setFollowingList(updated);
    saveData(STORAGE_KEYS.SOCIAL_FOLLOWING, updated);
  };

  const isFollowing = (handle: string): boolean => followingList.includes(handle);

  const toggleSavePost = (postId: string) => {
    const updated = savedPostIds.includes(postId)
      ? savedPostIds.filter((id) => id !== postId)
      : [...savedPostIds, postId];
    setSavedPostIds(updated);
    saveData(STORAGE_KEYS.SOCIAL_SAVED_POSTS, updated);
  };

  const isPostSaved = (postId: string): boolean => savedPostIds.includes(postId);

  const addToPantry = (item: PantryItem) => {
    const updated = [...pantryItems, item];
    setPantryItems(updated);
    saveData(STORAGE_KEYS.PANTRY, updated);
  };

  const removeFromPantry = (id: string) => {
    const updated = pantryItems.filter((i) => i.id !== id);
    setPantryItems(updated);
    saveData(STORAGE_KEYS.PANTRY, updated);
  };

  const updatePantryItem = (id: string, updates: Partial<PantryItem>) => {
    const updated = pantryItems.map((i) => (i.id === id ? { ...i, ...updates } : i));
    setPantryItems(updated);
    saveData(STORAGE_KEYS.PANTRY, updated);
  };

  const saveRecipe = (id: string) => {
    if (!savedRecipes.includes(id)) {
      const updated = [...savedRecipes, id];
      setSavedRecipes(updated);
      saveData(STORAGE_KEYS.SAVED, updated);
    }
  };

  const unsaveRecipe = (id: string) => {
    const updated = savedRecipes.filter((r) => r !== id);
    setSavedRecipes(updated);
    saveData(STORAGE_KEYS.SAVED, updated);
  };

  const markCooked = (id: string) => {
    if (!cookedRecipes.includes(id)) {
      const updated = [...cookedRecipes, id];
      setCookedRecipes(updated);
      saveData(STORAGE_KEYS.COOKED, updated);
      const today = new Date().toISOString().split("T")[0];
      const newStats = {
        ...stats,
        mealsCooked: stats.mealsCooked + 1,
        xp: stats.xp + 50,
        streak: computeNewStreak(stats.streak, stats.lastCookedDate),
        lastCookedDate: today,
        moneySaved: stats.moneySaved + 12,
      };
      setStats(newStats);
      saveData(STORAGE_KEYS.STATS, newStats);
    }
  };

  /**
   * Cook a dish: logs to history, deducts pantry ingredients, updates stats.
   * Returns the number of pantry items actually deducted.
   */
  const cookDish = useCallback((recipe: Recipe, mealType: "Breakfast" | "Lunch" | "Dinner", servings: number): number => {
    const today = new Date().toISOString().split("T")[0];

    // 1. Log cooking history entry
    const entry: CookingEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      date: today,
      mealType,
      servings,
    };
    const newHistory = [...cookingHistory, entry];
    setCookingHistory(newHistory);
    saveData(STORAGE_KEYS.COOKING_HISTORY, newHistory);

    // 2. Mark as cooked (add to cookedRecipes array)
    const wasCooked = cookedRecipes.includes(recipe.id);
    if (!wasCooked) {
      const updated = [...cookedRecipes, recipe.id];
      setCookedRecipes(updated);
      saveData(STORAGE_KEYS.COOKED, updated);
    }

    // 3. Update stats — use date-aware streak logic so cooking multiple
    //    times in one day only counts as one streak day, and missing a day
    //    correctly resets the streak to 1.
    const newStats = {
      ...stats,
      mealsCooked: stats.mealsCooked + 1,
      xp: stats.xp + 50,
      streak: computeNewStreak(stats.streak, stats.lastCookedDate),
      lastCookedDate: today,
      moneySaved: stats.moneySaved + 12,
    };
    setStats(newStats);
    saveData(STORAGE_KEYS.STATS, newStats);

    // 4. Deduct ingredients from pantry
    const scaleFactor = servings / Math.max(1, recipe.servings);
    let deducted = 0;
    let updatedPantry = [...pantryItems];

    recipe.ingredients.forEach((ing) => {
      const matchIdx = updatedPantry.findIndex((p) => {
        const pName = p.name.toLowerCase();
        const iName = ing.name.toLowerCase();
        return pName.includes(iName) || iName.includes(pName);
      });
      if (matchIdx === -1) return;

      const pantryItem = updatedPantry[matchIdx];
      const needed = parseIngredientAmount(ing.amount);

      let deductQty = 1 * scaleFactor;
      if (needed) {
        const haveUnit = normalizeUnit(pantryItem.unit);
        const needUnit = normalizeUnit(needed.unit || "piece");
        if (haveUnit === needUnit || needUnit === "piece") {
          deductQty = needed.value * scaleFactor;
        } else {
          return; // unit mismatch — skip
        }
      }

      const newQty = Math.max(0, pantryItem.quantity - deductQty);
      updatedPantry[matchIdx] = { ...pantryItem, quantity: +newQty.toFixed(2) };
      deducted++;
    });

    // Remove fully depleted items
    updatedPantry = updatedPantry.filter((p) => p.quantity > 0);
    setPantryItems(updatedPantry);
    saveData(STORAGE_KEYS.PANTRY, updatedPantry);

    return deducted;
  }, [cookingHistory, cookedRecipes, pantryItems, stats]);

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

  const trackSwipe = useCallback((recipe: Recipe, direction: "right" | "left" | "up") => {
    setLearningProfile((prev) => {
      const cuisine = recipe.cuisine;
      const updated: LearningProfile = {
        totalSwipes: prev.totalSwipes + 1,
        swipeRights: direction === "right"
          ? { ...prev.swipeRights, [cuisine]: (prev.swipeRights[cuisine] ?? 0) + 1 }
          : prev.swipeRights,
        swipeLefts: direction === "left"
          ? { ...prev.swipeLefts, [cuisine]: (prev.swipeLefts[cuisine] ?? 0) + 1 }
          : prev.swipeLefts,
        saved: direction === "up"
          ? { ...prev.saved, [cuisine]: (prev.saved[cuisine] ?? 0) + 1 }
          : prev.saved,
      };
      saveData(STORAGE_KEYS.LEARNING, updated);
      return updated;
    });
  }, []);

// ─── Protein keyword map ──────────────────────────────────────────────────────
const PROTEIN_KEYWORDS: Record<string, string[]> = {
  Chicken:  ["chicken", "poultry"],
  Beef:     ["beef", "steak", "mince", "ground beef", "ribeye", "sirloin", "brisket", "veal"],
  Pork:     ["pork", "bacon", "ham", "pancetta", "prosciutto", "chorizo", "sausage"],
  Fish:     ["fish", "salmon", "tuna", "cod", "tilapia", "snapper", "halibut", "mackerel", "sardine"],
  Lamb:     ["lamb", "mutton"],
  Seafood:  ["prawn", "shrimp", "crab", "lobster", "squid", "scallop", "mussel"],
  Turkey:   ["turkey"],
  Tofu:     ["tofu", "tempeh", "seitan"],
  Eggs:     ["egg", "eggs"],
  Duck:     ["duck"],
};

function recipeContainsProtein(recipe: Recipe, protein: string): boolean {
  const keywords = PROTEIN_KEYWORDS[protein] ?? [protein.toLowerCase()];
  const title = recipe.title.toLowerCase();
  const ingredientText = recipe.ingredients.map((i) => i.name.toLowerCase()).join(" ");
  const searchText = `${title} ${ingredientText}`;
  return keywords.some((kw) => searchText.includes(kw));
}

  const getPersonalizedRecipes = useCallback((pool?: Recipe[]): Recipe[] => {
    const source = pool ?? liveRecipes;
    const prefs = userProfile;
    let filtered = [...source];

    // 1. Cuisine filter — only show user's preferred cuisines if they set any.
    // Fallback to full pool ONLY if zero matches (not < 3, which hides valid single results).
    if (prefs.cuisinePreferences?.length > 0) {
      const cuisineFiltered = filtered.filter((r) => prefs.cuisinePreferences.includes(r.cuisine));
      if (cuisineFiltered.length > 0) filtered = cuisineFiltered;
    }

    // 2. Diet type filter
    if (!prefs.dietType.includes("Omnivore") && prefs.dietType.length > 0) {
      const dietFiltered = filtered.filter((r) => isDietMatch(r, prefs.dietType));
      if (dietFiltered.length > 0) filtered = dietFiltered;
    }

    // 3. Allergen filter — remove recipes containing user's allergens
    if (prefs.allergies?.length > 0) {
      filtered = filtered.filter(
        (r) => !prefs.allergies.some((a) => recipeContainsAllergen(r, a))
      );
      // Safety: if all recipes are filtered out, show unfiltered pool
      if (filtered.length === 0) filtered = [...source];
    }

    // 3b. Protein preference filter — only show recipes with at least one selected protein.
    // Empty = no restriction (show all proteins).
    if (prefs.proteinPreferences?.length > 0) {
      const proteinFiltered = filtered.filter((r) =>
        prefs.proteinPreferences.some((p) => recipeContainsProtein(r, p))
      );
      if (proteinFiltered.length > 0) filtered = proteinFiltered;
    }

    // 4. Skill level filter
    if (prefs.skillLevel === "Beginner") {
      const easy = filtered.filter((r) => r.difficulty === "Easy");
      if (easy.length >= 3) filtered = easy;
    } else if (prefs.skillLevel === "Home Cook") {
      const manageable = filtered.filter((r) => r.difficulty !== "Hard");
      if (manageable.length >= 3) filtered = manageable;
    }

    // 5. Combined score: goal signal + learning signal
    // Learning boost: right swipes & saves push cuisine up, left swipes push it down.
    // Only meaningful after 5+ swipes to avoid premature over-fitting.
    const learningWeight = learningProfile.totalSwipes >= 5 ? 1 : 0;

    const score = (r: Recipe): number => {
      let s = 0;
      switch (prefs.goal) {
        case "Build Muscle":    s += r.nutrition.protein * 0.1; break;
        case "Eat Healthier":   s += r.nutrition.fiber * 0.3 - r.calories * 0.001; break;
        case "Cook Faster":     s += -(r.prepTime + r.cookTime) * 0.05; break;
        case "Cook for Others": s += r.servings * 0.2; break;
        case "Save Money":      s += -r.ingredients.length * 0.1; break;
      }
      const cuisine = r.cuisine;
      s += learningWeight * (
        (learningProfile.swipeRights[cuisine] ?? 0) * 1.0 +
        (learningProfile.saved[cuisine] ?? 0) * 1.5 -
        (learningProfile.swipeLefts[cuisine] ?? 0) * 0.8
      );
      return s;
    };

    return [...filtered].sort((a, b) => score(b) - score(a));
  }, [liveRecipes, userProfile, learningProfile]);

  const refreshRecipes = useCallback(() => { fetchLiveRecipes(); }, [fetchLiveRecipes]);

  return (
    <AppContext.Provider
      value={{
        userProfile, pantryItems, savedRecipes, cookedRecipes, cookingHistory,
        stats, isSetupComplete, liveRecipes, recipesLoading,
        followingList, savedPostIds,
        authUser, session, isLoadingAuth, supabaseProfile,
        updateProfile, completeSetup, completeOnboarding, signOut,
        addToPantry, removeFromPantry, updatePantryItem,
        saveRecipe, unsaveRecipe, markCooked, cookDish,
        getMatchingRecipes, getPantryMatchScore, getIngredientMatches, refreshRecipes,
        getPersonalizedRecipes, learningProfile, trackSwipe,
        followUser, unfollowUser, isFollowing, toggleSavePost, isPostSaved,
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
