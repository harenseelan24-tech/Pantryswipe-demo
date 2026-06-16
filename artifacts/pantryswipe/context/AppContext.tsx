import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { INITIAL_PANTRY, MOCK_RECIPES, PantryItem, Recipe } from "@/data/mockData";

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

      if (profileData) setUserProfile(JSON.parse(profileData));
      if (pantryData) setPantryItems(JSON.parse(pantryData));
      if (savedData) setSavedRecipes(JSON.parse(savedData));
      if (cookedData) setCookedRecipes(JSON.parse(cookedData));
      if (statsData) setStats(JSON.parse(statsData));
      if (setupData) setIsSetupComplete(JSON.parse(setupData));
    } catch (e) {
      // Use defaults on error
    }
  };

  const saveData = async (key: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
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

  const getPantryMatchScore = (recipe: Recipe): number => {
    const pantryNames = pantryItems.map((p) => p.name.toLowerCase());
    const matching = recipe.ingredients.filter((ing) =>
      pantryNames.some((p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p))
    );
    return Math.round((matching.length / recipe.ingredients.length) * 100);
  };

  const getMatchingRecipes = (): Recipe[] => {
    return MOCK_RECIPES.sort((a, b) => getPantryMatchScore(b) - getPantryMatchScore(a));
  };

  return (
    <AppContext.Provider
      value={{
        userProfile,
        pantryItems,
        savedRecipes,
        cookedRecipes,
        stats,
        isSetupComplete,
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
