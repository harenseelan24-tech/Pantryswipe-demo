import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { getRecipeImageSource } from "@/constants/recipeImages";

const API_BASE = Platform.OS !== "web"
  ? `https://${process.env.EXPO_PUBLIC_API_DOMAIN ?? "zip-repl-cactusussy24.replit.app"}/api`
  : "/api";

const AI_VARIATIONS = [
  { label: "High Protein",      icon: "trending-up" as const,  color: "#5B8EF5" },
  { label: "Spicier",           icon: "zap" as const,           color: "#E84040" },
  { label: "Make Vegetarian",   icon: "wind" as const,          color: "#4CAF76" },
  { label: "Make Halal",        icon: "check-circle" as const,  color: "#9B6DFF" },
  { label: "Budget Version",    icon: "dollar-sign" as const,   color: "#F5A623" },
  { label: "Faster Version",    icon: "clock" as const,         color: "#00C9B1" },
];

// ── Local variation engine (always works offline) ─────────────────────────────
const MEAT_TERMS = ["pancetta","guanciale","bacon","chicken","beef","pork","fish","shrimp","prawn","lamb","turkey","ham","sausage","tuna","salmon","anchovy","meat","mince","steak","brisket","ribs","lard"];

const VEGETARIAN_SUBS: Record<string, string> = {
  pancetta: "Smoked tempeh", guanciale: "Smoked tofu", bacon: "Coconut bacon",
  chicken: "Firm tofu", beef: "Portobello mushrooms", pork: "Seitan",
  fish: "Hearts of palm", shrimp: "King oyster mushrooms", prawn: "King oyster mushrooms",
  lamb: "Jackfruit", turkey: "Cauliflower", ham: "Smoked tofu",
  sausage: "Plant-based sausage", tuna: "Chickpeas", salmon: "Marinated tofu",
  anchovy: "Capers", mince: "Lentils", steak: "Portobello steak",
  brisket: "Jackfruit", ribs: "Cauliflower ribs", lard: "Coconut oil",
  meat: "Tempeh",
};

const HALAL_SUBS: Record<string, string> = {
  pork: "Beef", pancetta: "Turkey bacon", guanciale: "Beef bacon",
  bacon: "Turkey bacon", ham: "Halal beef ham", lard: "Ghee",
  sausage: "Halal chicken sausage",
};

const BUDGET_SUBS: Record<string, string> = {
  parmesan: "Nutritional yeast", "pecorino romano": "Parmesan",
  truffle: "Mushroom powder", beef: "Lentils", salmon: "Canned tuna",
  shrimp: "Frozen prawns", mozzarella: "Ricotta", pancetta: "Regular bacon",
  "pine nuts": "Sunflower seeds", "heavy cream": "Whole milk",
};

function detectMeat(name: string): string | null {
  const n = name.toLowerCase();
  for (const term of MEAT_TERMS) {
    if (n.includes(term)) return term;
  }
  return null;
}

// Replace ingredient terms inside step instruction text (case-insensitive, word-boundary aware)
function substituteInSteps(
  steps: Array<{ step: number; instruction: string; timerMinutes?: number }>,
  subsMap: Record<string, string>
): Array<{ step: number; instruction: string; timerMinutes?: number }> {
  return steps.map((step) => {
    let instruction = step.instruction;
    for (const [original, replacement] of Object.entries(subsMap)) {
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}(?:s|es|ed|ing)?\\b`, "gi");
      instruction = instruction.replace(regex, (match) => {
        const core = replacement;
        if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
          return core.charAt(0).toUpperCase() + core.slice(1);
        }
        return core.toLowerCase();
      });
    }
    return { ...step, instruction };
  });
}

function applyLocalVariation(
  recipe: { title: string; ingredients: Array<{ name: string; amount: string; inPantry: boolean }>; steps: Array<{ step: number; instruction: string; timerMinutes?: number }> },
  variation: string
): { notes: string; ingredients: Array<{ name: string; amount: string; inPantry: boolean }>; steps: typeof recipe.steps } {
  let ingredients = [...recipe.ingredients.map((i) => ({ ...i }))];
  let notes = "";
  let steps = [...recipe.steps.map((s) => ({ ...s }))];
  const changed: string[] = [];

  if (variation === "Make Vegetarian") {
    // Build substitution map for steps
    const stepSubsMap: Record<string, string> = {};
    ingredients = ingredients.map((ing) => {
      const meatKey = detectMeat(ing.name);
      if (meatKey) {
        const sub = VEGETARIAN_SUBS[meatKey] ?? `Plant-based ${ing.name}`;
        changed.push(`${ing.name} → ${sub}`);
        stepSubsMap[meatKey] = sub.toLowerCase();
        return { name: sub, amount: ing.amount, inPantry: false };
      }
      return ing;
    });
    notes = changed.length > 0
      ? `Substituted: ${changed.join("; ")}. The dish stays rich and flavourful with plant-based alternatives — same technique, same satisfaction.`
      : "No meat found — this recipe is already vegetarian-friendly! Added extra vegetables for more colour and texture.";
    if (changed.length === 0) {
      ingredients = [...ingredients, { name: "Roasted cherry tomatoes", amount: "100g", inPantry: false }, { name: "Baby spinach", amount: "40g", inPantry: false }];
    }
    // Apply substitution names into step text
    steps = substituteInSteps(steps, stepSubsMap);
    // Append a plant-based cooking tip to the final step
    if (steps.length > 0) {
      const last = steps[steps.length - 1];
      steps[steps.length - 1] = {
        ...last,
        instruction: last.instruction + "\n💡 Plant-based tip: cook firm tofu or tempeh on high heat without moving it for 2–3 min per side to develop colour and texture similar to the original protein.",
      };
    }

  } else if (variation === "Make Halal") {
    const stepSubsMap: Record<string, string> = {};
    ingredients = ingredients.map((ing) => {
      const n = ing.name.toLowerCase();
      for (const [key, sub] of Object.entries(HALAL_SUBS)) {
        if (n.includes(key)) {
          changed.push(`${ing.name} → ${sub}`);
          stepSubsMap[key] = sub.toLowerCase();
          return { name: sub, amount: ing.amount, inPantry: false };
        }
      }
      return ing;
    });
    notes = changed.length > 0
      ? `Halal swaps: ${changed.join("; ")}. All substitutes are widely available at halal butchers or supermarkets.`
      : "This recipe is already halal-compatible — no pork or alcohol-based ingredients detected.";
    steps = substituteInSteps(steps, stepSubsMap);

  } else if (variation === "High Protein") {
    const additions = [
      { name: "Extra egg whites", amount: "2", inPantry: false },
      { name: "Greek yogurt (stirred in at end)", amount: "80g", inPantry: false },
    ];
    ingredients = [...ingredients, ...additions];
    notes = "Added egg whites and Greek yogurt to boost protein by ~65%. Stir yogurt in off-heat at the very end for creaminess without curdling.";
    // Append a new final step for the protein additions
    const newStepNum = steps.length + 1;
    steps = [
      ...steps,
      {
        step: newStepNum,
        instruction: "Remove the pan from heat. Quickly whisk 2 egg whites until frothy and fold them through the mixture. Stir in 80 g Greek yogurt for extra creaminess. Do not return to heat — the residual warmth is enough to cook the egg whites through.",
        timerMinutes: undefined,
      },
    ];

  } else if (variation === "Spicier") {
    const spiceAdd = [
      { name: "Red chilli flakes", amount: "1 tsp", inPantry: false },
      { name: "Fresh red chilli (sliced)", amount: "1", inPantry: false },
    ];
    ingredients = [...ingredients, ...spiceAdd];
    notes = "Added chilli flakes and fresh chilli. For maximum heat, add the sliced chilli when you first heat the oil. For medium heat, add with the other aromatics.";
    // Inject heat instruction into the first step
    if (steps.length > 0) {
      steps[0] = {
        ...steps[0],
        instruction: "Add 1 tsp red chilli flakes and 1 sliced fresh red chilli to the oil before anything else. Cook 30 seconds until fragrant — this blooms the heat into the fat and infuses the whole dish.\n" + steps[0].instruction,
      };
    }

  } else if (variation === "Budget Version") {
    const stepSubsMap: Record<string, string> = {};
    ingredients = ingredients.map((ing) => {
      const n = ing.name.toLowerCase();
      for (const [key, sub] of Object.entries(BUDGET_SUBS)) {
        if (n.includes(key)) {
          changed.push(`${ing.name} → ${sub}`);
          stepSubsMap[key] = sub.toLowerCase();
          return { name: sub, amount: ing.amount, inPantry: true };
        }
      }
      return ing;
    });
    notes = changed.length > 0
      ? `Budget swaps: ${changed.join("; ")}. Saves ~40% on ingredient cost with minimal flavour difference.`
      : "This recipe is already budget-friendly. Tip: buy ingredients in bulk and freeze portions.";
    steps = substituteInSteps(steps, stepSubsMap);

  } else if (variation === "Faster Version") {
    const fastIngredients = ingredients.map((ing) => {
      if (ing.name.toLowerCase().includes("dried") || ing.name.toLowerCase().includes("from scratch")) {
        return { ...ing, name: ing.name.replace("dried", "canned").replace("from scratch", "ready-made") };
      }
      return ing;
    });
    ingredients = fastIngredients;
    notes = "Speed tips applied: use pre-minced garlic, canned pulses, and a hotter pan. Total time cut by ~35%. Skip resting times and use the microwave where noted.";
    // Shorten timing references and add speed tips to steps
    steps = steps.map((step) => {
      let instruction = step.instruction
        .replace(/\b(\d+)\s*-\s*(\d+)\s*minutes?\b/gi, (_, a, b) => `${Math.round(parseInt(a) * 0.65)}–${Math.round(parseInt(b) * 0.65)} minutes`)
        .replace(/\b(\d+)\s*minutes?\b/gi, (_, n) => parseInt(n) > 5 ? `${Math.round(parseInt(n) * 0.65)} minutes` : `${n} minutes`)
        .replace(/\b1\s*hour\b/gi, "35 minutes")
        .replace(/\bovernight\b/gi, "30 minutes (or skip)")
        .replace(/\bgarlic cloves?,\s*minced\b/gi, "pre-minced garlic (from jar)")
        .replace(/\bdried\b/gi, "canned");
      return { ...step, instruction, timerMinutes: step.timerMinutes ? Math.round(step.timerMinutes * 0.65) : undefined };
    });
  }

  return { notes, ingredients, steps };
}

const SERVING_PRESETS = [1, 2, 4, 6, 8];

const VARIATION_MACRO_ADJUST: Record<string, { protein: number; carbs: number; fat: number; calories: number }> = {
  "High Protein":    { protein: 1.65, carbs: 0.70, fat: 0.85, calories: 1.10 },
  "Make Vegetarian": { protein: 0.75, carbs: 1.20, fat: 0.90, calories: 0.90 },
  "Budget Version":  { protein: 0.88, carbs: 1.10, fat: 1.00, calories: 0.95 },
  "Spicier":         { protein: 1.00, carbs: 1.00, fat: 1.05, calories: 1.03 },
  "Make Halal":      { protein: 1.00, carbs: 1.00, fat: 1.00, calories: 1.00 },
  "Faster Version":  { protein: 0.92, carbs: 0.90, fat: 0.88, calories: 0.92 },
};

type MealType = "Breakfast" | "Lunch" | "Dinner";

function getMealTypeFromTime(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 16) return "Lunch";
  return "Dinner";
}

export default function RecipeDetailScreen() {
  const { id, servings: servingsParam, mealType: mealTypeParam } =
    useLocalSearchParams<{ id: string; servings?: string; mealType?: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    savedRecipes, saveRecipe, unsaveRecipe, cookDish,
    getPantryMatchScore, liveRecipes, getIngredientMatches,
  } = useApp();

  const recipe = liveRecipes.find((r) => r.id === id);

  // ── Core state ───────────────────────────────────────────────────────────────
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [cookMode, setCookMode] = useState(false);
  const [cookModeStep, setCookModeStep] = useState(0);

  // ── Servings & meal type ─────────────────────────────────────────────────────
  const [selectedServings, setSelectedServings] = useState(recipe?.servings ?? 2);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(getMealTypeFromTime);
  const [customServingsMode, setCustomServingsMode] = useState(false);
  const [customServingsInput, setCustomServingsInput] = useState("");
  const [showServingsModal, setShowServingsModal] = useState(false);

  useEffect(() => {
    if (recipe) {
      const sv = servingsParam ? parseInt(servingsParam, 10) : recipe.servings;
      setSelectedServings(isNaN(sv) ? recipe.servings : sv);
    }
  }, [recipe?.id, servingsParam]);

  useEffect(() => {
    const validTypes: MealType[] = ["Breakfast", "Lunch", "Dinner"];
    if (mealTypeParam && validTypes.includes(mealTypeParam as MealType)) {
      setSelectedMealType(mealTypeParam as MealType);
    }
  }, [mealTypeParam]);

  // ── Celebration overlay ──────────────────────────────────────────────────────
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    deducted: number;
    used: Array<{ name: string; amount: string }>;
    needStock: Array<{ name: string; amount: string }>;
  }>({ deducted: 0, used: [], needStock: [] });
  const celebrationScale = useRef(new Animated.Value(0.6)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showCelebration) {
      Animated.parallel([
        Animated.spring(celebrationScale, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 10 }),
        Animated.timing(celebrationOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      celebrationScale.setValue(0.6);
      celebrationOpacity.setValue(0);
    }
  }, [showCelebration]);

  // ── Shopping list ────────────────────────────────────────────────────────────
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [checkedShoppingItems, setCheckedShoppingItems] = useState<Set<string>>(new Set());

  const toggleShoppingItem = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedShoppingItems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── Pantry match expand/collapse ──────────────────────────────────────────────
  const [pantryExpanded, setPantryExpanded] = useState(false);
  const PANTRY_PREVIEW_COUNT = 3;

  // ── AI Variations state ──────────────────────────────────────────────────────
  const [variationLoading, setVariationLoading] = useState<string | null>(null);
  const [appliedVariation, setAppliedVariation] = useState<string | null>(null);
  const [varIngredients, setVarIngredients] = useState<Array<{ name: string; amount: string; inPantry: boolean }> | null>(null);
  const [varSteps, setVarSteps] = useState<Array<{ step: number; instruction: string; timerMinutes?: number }> | null>(null);
  const [varNotes, setVarNotes] = useState<string | null>(null);
  const [varAdditions, setVarAdditions] = useState<Array<{ name: string; amount: string; inPantry: boolean }>>([]);
  const [selectedAdditions, setSelectedAdditions] = useState<Set<string>>(new Set());
  // committed = user pressed "Apply" — the You Have/You Need columns switch to varIngredients
  const [varCommitted, setVarCommitted] = useState(false);

  // ── Timer state ──────────────────────────────────────────────────────────────
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLabel, setTimerLabel] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (timerRunning && timerSeconds !== null && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) { clearInterval(timerRef.current!); setTimerRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  useEffect(() => {
    if (timerSeconds !== null) {
      Animated.spring(timerPillAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
    } else {
      Animated.timing(timerPillAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [timerSeconds !== null]);

  const startTimer = (minutes: number, label: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSeconds(minutes * 60);
    setTimerLabel(label);
    setTimerRunning(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerSeconds(null);
    setTimerLabel("");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  // ── Ingredient scaling helper ────────────────────────────────────────────────
  const scaleAmount = (amount: string, ratio: number): string => {
    if (Math.abs(ratio - 1) < 0.01) return amount;
    const m = amount.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (!m) return amount;
    const num = parseFloat(m[1]) * ratio;
    const unit = (m[2] || "").trim();
    const display = num % 1 === 0 ? `${num}` : num.toFixed(1);
    return unit ? `${display} ${unit}` : display;
  };

  // ── Clear variation helper ───────────────────────────────────────────────────
  const clearVariation = () => {
    setAppliedVariation(null);
    setVarIngredients(null);
    setVarSteps(null);
    setVarNotes(null);
    setVarAdditions([]);
    setSelectedAdditions(new Set());
    setVarCommitted(false);
  };

  // ── Toggle an addition in/out of selected set ────────────────────────────────
  const toggleAddition = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAdditions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── AI Variation handler (with local fallback) ──────────────────────────────
  const handleVariation = async (variationType: string) => {
    if (!recipe || variationLoading) return;
    if (appliedVariation === variationType) { clearVariation(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Always reset committed state when switching to a new variation
    setVarCommitted(false);
    setVariationLoading(variationType);

    let applied = false;

    // Try API first (short timeout so fallback kicks in quickly)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/recipes/vary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          variation: variationType,
          recipe: { title: recipe.title, servings: recipe.servings, ingredients: recipe.ingredients, steps: recipe.steps },
        }),
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const originalNames = new Set(recipe.ingredients.map((i) => i.name.toLowerCase().trim()));
        const additions = (data.ingredients ?? []).filter((ing: { name: string }) => !originalNames.has(ing.name.toLowerCase().trim()));
        setVarIngredients(data.ingredients ?? null);
        setVarSteps(data.steps ?? null);
        setVarNotes(data.notes ?? null);
        setVarAdditions(additions);
        setSelectedAdditions(new Set(additions.map((a: { name: string }) => a.name)));
        setAppliedVariation(variationType);
        applied = true;
      }
    } catch {
      // fall through to local engine
    }

    // Local fallback — always applies a meaningful result.
    // Pass enrichedIngredients (which carry the correct inPantry flag from the actual
    // pantry) so that non-substituted items keep their pantry status after Apply.
    if (!applied) {
      const enrichedRecipe = { ...recipe, ingredients: enrichedIngredients };
      const local = applyLocalVariation(enrichedRecipe, variationType);
      const originalNames = new Set(enrichedIngredients.map((i) => i.name.toLowerCase().trim()));
      const additions = local.ingredients.filter((ing) => !originalNames.has(ing.name.toLowerCase().trim()));
      setVarIngredients(local.ingredients);
      setVarSteps(local.steps);
      setVarNotes(local.notes);
      setVarAdditions(additions);
      setSelectedAdditions(new Set(additions.map((a) => a.name)));
      setAppliedVariation(variationType);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setVariationLoading(null);
  };

  if (!recipe) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.foreground }}>Recipe not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.saffron, marginTop: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSaved = savedRecipes.includes(recipe.id);
  const matchScore = getPantryMatchScore(recipe);
  const enrichedIngredients = getIngredientMatches(recipe);
  const pantryIngredients = enrichedIngredients.filter((i) => i.inPantry);
  const missingIngredients = enrichedIngredients.filter((i) => !i.inPantry);

  const servingRatio = selectedServings / Math.max(1, recipe.servings);
  const displaySteps = varSteps ?? recipe.steps;

  // ── Pantry match with active additions ───────────────────────────────────────
  // When user has committed a variation (pressed Apply), use varIngredients directly
  // (which already has inPantry=false for substituted items, true for unchanged pantry items).
  // Otherwise fall back to original pantry/missing lists + any additions.
  const activeAdditions = varAdditions.filter((a) => selectedAdditions.has(a.name));
  const displayPantryIngredients: Array<{ name: string; amount: string; inPantry: boolean }> =
    varCommitted && varIngredients
      ? varIngredients.filter((i) => i.inPantry)
      : appliedVariation
        ? [...pantryIngredients, ...activeAdditions.filter((a) => a.inPantry)]
        : pantryIngredients;
  const displayMissingIngredients: Array<{ name: string; amount: string; inPantry: boolean }> =
    varCommitted && varIngredients
      ? varIngredients.filter((i) => !i.inPantry)
      : appliedVariation
        ? [...missingIngredients, ...activeAdditions.filter((a) => !a.inPantry)]
        : missingIngredients;
  const totalDisplayIngredients = displayPantryIngredients.length + displayMissingIngredients.length;
  const displayMatchScore = totalDisplayIngredients > 0
    ? Math.round((displayPantryIngredients.length / totalDisplayIngredients) * 100)
    : matchScore;

  // ── Nutrition (always per-serving, adjusted by variation) ─────────────────────
  const macroAdj = appliedVariation ? (VARIATION_MACRO_ADJUST[appliedVariation] ?? null) : null;
  const displayCalories = Math.round(recipe.calories * (macroAdj?.calories ?? 1));
  const displayProtein  = Math.round(recipe.nutrition.protein * (macroAdj?.protein ?? 1));
  const displayCarbs    = Math.round(recipe.nutrition.carbs   * (macroAdj?.carbs   ?? 1));
  const displayFat      = Math.round(recipe.nutrition.fat     * (macroAdj?.fat     ?? 1));
  const displayFiber    = Math.round(recipe.nutrition.fiber);

  const imageSource = getRecipeImageSource(recipe.image, recipe.id);

  const handleToggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isSaved) unsaveRecipe(recipe.id);
    else saveRecipe(recipe.id);
  };

  const handleCookNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCookMode(true);
    setCookModeStep(0);
  };

  const toggleStep = (stepNum: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompletedSteps((prev) =>
      prev.includes(stepNum) ? prev.filter((s) => s !== stepNum) : [...prev, stepNum]
    );
  };

  // ── Split instruction into bullet-point lines ────────────────────────────────
  const splitToPoints = (text: string): string[] => {
    const byNewline = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (byNewline.length > 1) return byNewline;
    // For single-paragraph AI-generated steps: split at ". " before uppercase
    const bySentence = text.split(/\.\s+(?=[A-Z])/).filter(Boolean);
    if (bySentence.length > 1) {
      return bySentence.map((s, i) => (i < bySentence.length - 1 ? s + "." : s));
    }
    return byNewline;
  };

  // ── Render instruction as bullet points ──────────────────────────────────────
  const renderBulletInstruction = (instruction: string, textStyle: object) => {
    const lines = instruction.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      return <Text style={textStyle}>{instruction}</Text>;
    }
    return (
      <View style={{ gap: 6 }}>
        {lines.map((line, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Text style={[textStyle, { color: (textStyle as any).color, lineHeight: 20, marginTop: 1 }]}>•</Text>
            <Text style={[textStyle, { flex: 1 }]}>
              {line.startsWith("•") ? line.slice(1).trim() : line}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Cook Mode ────────────────────────────────────────────────────────────────
  if (cookMode) {
    const currentStep = displaySteps[cookModeStep];
    const isLast = cookModeStep === displaySteps.length - 1;
    const isTimerActiveForStep = timerRunning && timerLabel === `Step ${currentStep.step}`;

    const handleFinishCooking = () => {
      const deducted = cookDish(recipe, selectedMealType, selectedServings);
      setCelebrationData({
        deducted,
        used: pantryIngredients.map((i) => ({ name: i.name, amount: i.amount })),
        needStock: missingIngredients.map((i) => ({ name: i.name, amount: i.amount })),
      });
      setCookMode(false);
      setShowCelebration(true);
    };

    const stepProgress = (cookModeStep + 1) / displaySteps.length;
    const variationColor = varCommitted && appliedVariation
      ? (AI_VARIATIONS.find((v) => v.label === appliedVariation)?.color ?? colors.saffron)
      : null;

    return (
      <View style={[styles.cookMode, { backgroundColor: "#141210" }]}>

        {/* ── Saffron progress rail ── */}
        <View style={styles.cmProgressRail}>
          <View style={[styles.cmProgressFill, { width: `${stepProgress * 100}%` as any }]} />
        </View>

        {/* ── Header: close | recipe title + step dots ── */}
        <View style={[styles.cmHeader, { paddingTop: topPadding + 10 }]}>
          <TouchableOpacity
            style={styles.cmCloseBtn}
            onPress={() => setCookMode(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={18} color="#5A5550" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <Text style={styles.cmRecipeTitle} numberOfLines={1}>{recipe.title}</Text>
            {/* Progress dots — tap to jump to any step */}
            <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              {displaySteps.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { setCookModeStep(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <View style={[
                    styles.cmStepDot,
                    {
                      width: i === cookModeStep ? 20 : 6,
                      backgroundColor: i === cookModeStep
                        ? colors.saffron
                        : i < cookModeStep
                          ? "#4CAF76"
                          : "#2E2B26",
                    },
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.cmCloseBtn} />
        </View>

        {/* ── Timer pill (floating, only when active) ── */}
        {timerSeconds !== null && (
          <Animated.View style={[styles.cmTimerPill, { opacity: timerPillAnim, transform: [{ scale: timerPillAnim }] }]}>
            <Feather name="clock" size={14} color={timerSeconds === 0 ? "#00BFA5" : colors.saffron} />
            <Text style={[styles.cmTimerPillLabel, { color: timerSeconds === 0 ? "#00BFA5" : "#F0EDE8" }]} numberOfLines={1}>{timerLabel}</Text>
            <Text style={[styles.cmTimerPillTime, { color: timerSeconds === 0 ? "#00BFA5" : colors.saffron }]}>
              {timerSeconds === 0 ? "Done! 🎉" : formatTime(timerSeconds)}
            </Text>
            <TouchableOpacity onPress={() => setTimerRunning((r) => !r)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Feather name={timerRunning ? "pause" : "play"} size={14} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelTimer} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Feather name="x" size={14} color="#555" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Step content area ── */}
        <View style={{ flex: 1, overflow: "hidden" }}>
          {/* Ghost step number — design signature: huge ambient digit */}
          <Text style={styles.cmGhostNum} aria-hidden>{currentStep.step}</Text>

          <ScrollView
            style={styles.cmContent}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Step badge row */}
            <View style={styles.cmBadgeRow}>
              <View style={[styles.cmStepBadge, { backgroundColor: variationColor ?? colors.saffron }]}>
                <Text style={styles.cmStepBadgeText}>{currentStep.step}</Text>
              </View>
              <Text style={styles.cmStepOf}>of {displaySteps.length}</Text>
              {variationColor && (
                <View style={[styles.cmVariationTag, { backgroundColor: variationColor + "20" }]}>
                  <Text style={[styles.cmVariationTagText, { color: variationColor }]}>
                    {appliedVariation}
                  </Text>
                </View>
              )}
            </View>

            {/* Instruction lines */}
            <View style={{ gap: 18 }}>
              {splitToPoints(currentStep.instruction).map((line, idx) => (
                <View key={idx} style={styles.cmInstructionRow}>
                  <View style={[styles.cmBulletBar, { backgroundColor: variationColor ?? colors.saffron }]} />
                  <Text style={styles.cmInstructionText}>
                    {line.startsWith("•") ? line.slice(1).trim() : line}
                  </Text>
                </View>
              ))}
            </View>

            {/* Inline timer button */}
            {currentStep.timerMinutes && (
              <TouchableOpacity
                style={[styles.cmInlineTimer, {
                  backgroundColor: isTimerActiveForStep ? "#1E1B18" : "#1A1713",
                  borderColor: isTimerActiveForStep ? colors.saffron : "#2E2B26",
                }]}
                onPress={() => startTimer(currentStep.timerMinutes!, `Step ${currentStep.step}`)}
                activeOpacity={0.8}
              >
                <Feather name="clock" size={17} color={colors.saffron} />
                <Text style={styles.cmInlineTimerText}>
                  {isTimerActiveForStep
                    ? `Running — ${formatTime(timerSeconds ?? 0)} left`
                    : `${currentStep.timerMinutes} min timer`}
                </Text>
                {isTimerActiveForStep && (
                  <TouchableOpacity onPress={cancelTimer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x-circle" size={15} color="#555" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ── Navigation footer — large touch targets ── */}
        <View style={[styles.cmNavFooter, { paddingBottom: bottomPadding + 10 }]}>
          {/* Back button */}
          <TouchableOpacity
            style={[styles.cmNavBack, {
              backgroundColor: cookModeStep === 0 ? "#161310" : "#1E1B18",
              borderColor: "#252219",
              opacity: cookModeStep === 0 ? 0.4 : 1,
            }]}
            onPress={() => {
              if (cookModeStep > 0) {
                setCookModeStep((s) => s - 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            disabled={cookModeStep === 0}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color="#F0EDE8" />
          </TouchableOpacity>

          {/* Primary CTA */}
          {isLast ? (
            <TouchableOpacity
              style={[styles.cmNavMain, { backgroundColor: "#4CAF76" }]}
              onPress={handleFinishCooking}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={22} color="#fff" />
              <Text style={styles.cmNavMainText}>Done Cooking!</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cmNavMain, { backgroundColor: variationColor ?? colors.saffron }]}
              onPress={() => {
                setCookModeStep((s) => s + 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.cmNavMainText}>Next Step</Text>
              <Feather name="arrow-right" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero image */}
        <View style={styles.heroContainer}>
          {imageSource ? (
            <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: colors.muted }]}>
              <Text style={styles.heroEmoji}>
                {recipe.cuisine === "Italian" ? "🍝" : recipe.cuisine === "Japanese" ? "🍜" : "🍽"}
              </Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={[styles.heroNav, { top: topPadding + 12 }]}>
            <TouchableOpacity style={[styles.heroNavBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroNavBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
              <Feather name="share-2" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={[styles.heroInfoPill, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
            <Feather name="clock" size={14} color="#fff" />
            <Text style={styles.heroPillText}>{recipe.prepTime + recipe.cookTime} min</Text>
            <View style={styles.pillDot} />
            <Feather name="zap" size={14} color="#fff" />
            <Text style={styles.heroPillText}>{recipe.calories} kcal</Text>
            <View style={styles.pillDot} />
            <Feather name="users" size={14} color="#fff" />
            <Text style={styles.heroPillText}>Serves {recipe.servings}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Title & Creator */}
          <Text style={[styles.recipeTitle, { color: colors.foreground }]}>{recipe.title}</Text>
          <View style={styles.creatorRow}>
            <View style={[styles.creatorAvatar, { backgroundColor: colors.saffron }]}>
              <Text style={styles.creatorAvatarText}>{recipe.creatorAvatar}</Text>
            </View>
            <Text style={[styles.creatorName, { color: colors.mutedForeground }]}>@{recipe.creator}</Text>
            <TouchableOpacity
              style={[styles.servingsPill, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowServingsModal(true); }}
            >
              <Feather name="users" size={13} color={colors.mutedForeground} />
              <Text style={[styles.servingsPillText, { color: colors.foreground }]}>{selectedServings}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.followSmall, { borderColor: colors.saffron }]}>
              <Text style={[styles.followSmallText, { color: colors.saffron }]}>Follow</Text>
            </TouchableOpacity>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color={colors.saffron} />
              <Text style={[styles.ratingText, { color: colors.foreground }]}>
                {recipe.rating} ({recipe.reviewCount.toLocaleString()})
              </Text>
            </View>
          </View>

          {/* Tags */}
          <View style={styles.tagsRow}>
            {recipe.dietTags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{tag}</Text>
              </View>
            ))}
            <View style={[styles.tag, { backgroundColor: colors.muted }]}>
              <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{recipe.cuisine}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.muted }]}>
              <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{recipe.difficulty}</Text>
            </View>
          </View>

          {/* Pantry Match Panel */}
          <View style={[styles.matchPanel, { backgroundColor: colors.secondary + "10", borderColor: colors.secondary + "30" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Your Pantry Match</Text>
              <View style={[styles.matchScore, { backgroundColor: appliedVariation ? colors.saffron : colors.secondary }]}>
                <Text style={styles.matchScoreText}>{displayMatchScore}% match</Text>
              </View>
            </View>
            {/* Collapsible ingredient columns */}
            <View style={styles.matchColumns}>
              {displayPantryIngredients.length > 0 && (
                <View style={styles.matchColumn}>
                  <Text style={[styles.matchColumnHeader, { color: colors.secondary }]}>
                    You Have ({displayPantryIngredients.length})
                  </Text>
                  {(pantryExpanded ? displayPantryIngredients : displayPantryIngredients.slice(0, PANTRY_PREVIEW_COUNT)).map((ing) => (
                    <View key={ing.name} style={styles.ingredientRow}>
                      <Feather name="check" size={14} color={colors.secondary} />
                      <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                        {ing.name} · {scaleAmount(ing.amount, servingRatio)}
                      </Text>
                    </View>
                  ))}
                  {!pantryExpanded && displayPantryIngredients.length > PANTRY_PREVIEW_COUNT && (
                    <Text style={[styles.ingredientText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }]}>
                      +{displayPantryIngredients.length - PANTRY_PREVIEW_COUNT} more…
                    </Text>
                  )}
                </View>
              )}
              {displayMissingIngredients.length > 0 && (
                <View style={styles.matchColumn}>
                  <Text style={[styles.matchColumnHeader, { color: colors.saffron }]}>
                    You Need ({displayMissingIngredients.length})
                  </Text>
                  {(pantryExpanded ? displayMissingIngredients : displayMissingIngredients.slice(0, PANTRY_PREVIEW_COUNT)).map((ing) => (
                    <View key={ing.name} style={styles.ingredientRow}>
                      <Feather name="shopping-cart" size={14} color={colors.saffron} />
                      <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                        {ing.name} · {scaleAmount(ing.amount, servingRatio)}
                      </Text>
                    </View>
                  ))}
                  {!pantryExpanded && displayMissingIngredients.length > PANTRY_PREVIEW_COUNT && (
                    <Text style={[styles.ingredientText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }]}>
                      +{displayMissingIngredients.length - PANTRY_PREVIEW_COUNT} more…
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Shopping list button */}
            <TouchableOpacity
              style={[styles.shoppingListBtn, { backgroundColor: displayMissingIngredients.length === 0 ? colors.secondary : colors.saffron }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowShoppingList(true); }}
            >
              <Feather name="shopping-cart" size={16} color="#fff" />
              <Text style={styles.shoppingListBtnText}>
                {displayMissingIngredients.length === 0
                  ? "You have everything! 🎉"
                  : `Shopping List · ${displayMissingIngredients.length} item${displayMissingIngredients.length !== 1 ? "s" : ""}`}
              </Text>
            </TouchableOpacity>

            {/* Expand / collapse arrow */}
            {(displayPantryIngredients.length > PANTRY_PREVIEW_COUNT || displayMissingIngredients.length > PANTRY_PREVIEW_COUNT) && (
              <TouchableOpacity
                style={styles.pantryExpandBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPantryExpanded((e) => !e); }}
                activeOpacity={0.7}
              >
                <Feather name={pantryExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                <Text style={[styles.pantryExpandText, { color: colors.mutedForeground }]}>
                  {pantryExpanded ? "Show less" : `Show all ${totalDisplayIngredients} ingredients`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Make It Your Way ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            {/* Section header */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 2 }]}>Make It Your Way</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  Tap a style to adapt ingredients &amp; nutrition
                </Text>
              </View>
              {appliedVariation && (
                <TouchableOpacity
                  style={[styles.clearVariationBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={clearVariation}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.clearVariationText, { color: colors.mutedForeground }]}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Variation pill chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 2 }}
            >
              {AI_VARIATIONS.map((v) => {
                const isApplied = appliedVariation === v.label;
                const isLoading = variationLoading === v.label;
                return (
                  <TouchableOpacity
                    key={v.label}
                    style={[
                      styles.variationChip,
                      {
                        backgroundColor: isApplied ? v.color : v.color + "14",
                        borderColor: isApplied ? v.color : v.color + "40",
                        opacity: variationLoading && !isLoading ? 0.45 : 1,
                        transform: [{ scale: isApplied ? 1.03 : 1 }],
                      },
                    ]}
                    onPress={() => handleVariation(v.label)}
                    disabled={!!variationLoading}
                    activeOpacity={0.75}
                  >
                    {isLoading ? (
                      <Feather name="loader" size={13} color={isApplied ? "#fff" : v.color} />
                    ) : (
                      <Feather name={isApplied ? "check" : v.icon} size={13} color={isApplied ? "#fff" : v.color} />
                    )}
                    <Text style={[styles.variationText, { color: isApplied ? "#fff" : v.color, fontFamily: isApplied ? "Inter_700Bold" : "Inter_600SemiBold" }]}>
                      {isLoading ? "Applying…" : v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Applied variation result card */}
            {varNotes && appliedVariation && (
              <View style={[styles.varNoteBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* What changed header */}
                <View style={styles.varNoteHeader}>
                  <View style={[styles.varNoteDot, { backgroundColor: "#4CAF76" }]} />
                  <Text style={[styles.varNoteTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {appliedVariation} applied
                  </Text>
                </View>
                <Text style={[styles.varNoteText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {varNotes}
                </Text>

                {/* New/swapped ingredients to include/exclude */}
                {varAdditions.length > 0 && (
                  <View style={styles.varAdditionsBlock}>
                    <Text style={[styles.varAdditionsLabel, { color: colors.mutedForeground }]}>
                      New ingredients — tap to add or remove:
                    </Text>
                    <View style={styles.varAdditionsRow}>
                      {varAdditions.map((add) => {
                        const isSelected = selectedAdditions.has(add.name);
                        const chipColor = add.inPantry ? "#4CAF76" : colors.saffron;
                        return (
                          <TouchableOpacity
                            key={add.name}
                            style={[
                              styles.varAddChip,
                              {
                                backgroundColor: isSelected ? chipColor + "18" : colors.muted,
                                borderColor: isSelected ? chipColor : colors.border,
                              },
                            ]}
                            onPress={() => toggleAddition(add.name)}
                            activeOpacity={0.7}
                          >
                            <Feather
                              name={isSelected ? (add.inPantry ? "check" : "shopping-cart") : "plus"}
                              size={11}
                              color={isSelected ? chipColor : colors.mutedForeground}
                            />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: isSelected ? colors.foreground : colors.mutedForeground }}>
                              {add.name}
                            </Text>
                            {isSelected && add.amount ? (
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: chipColor }}>{add.amount}</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={styles.varLegendRow}>
                      <View style={[styles.varLegendDot, { backgroundColor: "#4CAF76" }]} />
                      <Text style={[styles.varLegendText, { color: colors.mutedForeground }]}>In your pantry</Text>
                      <View style={[styles.varLegendDot, { backgroundColor: colors.saffron, marginLeft: 10 }]} />
                      <Text style={[styles.varLegendText, { color: colors.mutedForeground }]}>Need to buy</Text>
                    </View>
                  </View>
                )}

                {/* Nutrition change summary */}
                {(() => {
                  const adj = VARIATION_MACRO_ADJUST[appliedVariation];
                  if (!adj) return null;
                  const changes = [
                    { label: "Protein", mult: adj.protein, color: "#5B8EF5" },
                    { label: "Carbs",   mult: adj.carbs,   color: colors.saffron },
                    { label: "Fat",     mult: adj.fat,     color: "#E84040" },
                    { label: "Cal",     mult: adj.calories, color: "#9B6DFF" },
                  ].filter((c) => Math.abs(c.mult - 1) > 0.01);
                  if (changes.length === 0) return null;
                  return (
                    <View style={[styles.varNutRow, { borderTopColor: colors.border }]}>
                      <Text style={[styles.varNutLabel, { color: colors.mutedForeground }]}>Nutrition shift:</Text>
                      {changes.map((c) => (
                        <View key={c.label} style={[styles.varNutChip, { backgroundColor: c.color + "14", borderColor: c.color + "35" }]}>
                          <Text style={[styles.varNutChipText, { color: c.color }]}>
                            {c.mult > 1 ? "▲" : "▼"} {c.label} {Math.abs(Math.round((c.mult - 1) * 100))}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Apply / Applied button */}
                {varIngredients && (
                  varCommitted ? (
                    <View style={[styles.varApplyBtn, { backgroundColor: colors.secondary + "18", borderColor: colors.secondary + "40" }]}>
                      <Feather name="check-circle" size={15} color={colors.secondary} />
                      <Text style={[styles.varApplyBtnText, { color: colors.secondary, fontFamily: "Inter_600SemiBold" }]}>
                        Applied — You Have / You Need updated
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.varApplyBtn, { backgroundColor: colors.saffron, borderColor: colors.saffron }]}
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setVarCommitted(true);
                        setPantryExpanded(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="check" size={15} color="#fff" />
                      <Text style={[styles.varApplyBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                        Apply Changes to Recipe
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}
          </View>

          {/* Cooking Instructions */}
          <View style={styles.section}>
            {/* Section header with eyebrow + optional "Adapted" badge */}
            <View style={{ marginBottom: 14 }}>
              <Text style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}>STEP BY STEP</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Cooking Instructions</Text>
                {varCommitted && appliedVariation && (() => {
                  const chipColor = AI_VARIATIONS.find((v) => v.label === appliedVariation)?.color ?? colors.saffron;
                  return (
                    <View style={[styles.adaptedBadge, { backgroundColor: chipColor + "18", borderColor: chipColor + "45" }]}>
                      <View style={[styles.adaptedDot, { backgroundColor: chipColor }]} />
                      <Text style={[styles.adaptedBadgeText, { color: chipColor }]}>Adapted</Text>
                    </View>
                  );
                })()}
              </View>
            </View>

            {displaySteps.map((step) => {
              const done = completedSteps.includes(step.step);
              const chipColor = varCommitted && appliedVariation
                ? (AI_VARIATIONS.find((v) => v.label === appliedVariation)?.color ?? colors.saffron)
                : null;
              return (
                <TouchableOpacity
                  key={step.step}
                  style={[
                    styles.stepCard,
                    {
                      backgroundColor: done ? colors.secondary + "10" : colors.card,
                      borderColor: done ? colors.secondary + "30" : colors.border,
                    },
                  ]}
                  onPress={() => toggleStep(step.step)}
                >
                  {/* Thin left accent when variation is committed */}
                  {chipColor && !done && (
                    <View style={[styles.stepAccentBar, { backgroundColor: chipColor }]} />
                  )}
                  <View style={[styles.stepNum, { backgroundColor: done ? colors.secondary : chipColor ? chipColor + "22" : colors.muted }]}>
                    {done ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : (
                      <Text style={[styles.stepNumText, { color: chipColor ?? colors.foreground }]}>{step.step}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    {splitToPoints(step.instruction).map((line, idx) => (
                      <View key={idx} style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
                        <Text style={[styles.stepInstruction, { color: done ? colors.mutedForeground : (chipColor ?? colors.saffron), textDecorationLine: "none", marginTop: 1 }]}>•</Text>
                        <Text style={[styles.stepInstruction, { flex: 1, fontSize: 14, lineHeight: 21, color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" }]}>
                          {line.startsWith("•") ? line.slice(1).trim() : line}
                        </Text>
                      </View>
                    ))}
                    {step.timerMinutes && !done && (
                      <TouchableOpacity
                        style={[styles.timerBtn, { backgroundColor: (chipColor ?? colors.saffron) + "15" }]}
                        onPress={() => startTimer(step.timerMinutes!, `Step ${step.step}`)}
                      >
                        <Feather name="clock" size={12} color={chipColor ?? colors.saffron} />
                        <Text style={[styles.timerBtnText, { color: chipColor ?? colors.saffron }]}>▶ {step.timerMinutes} min timer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Nutrition — always per serving */}
          <View style={[styles.nutritionPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Nutrition</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                per serving{appliedVariation ? ` · ${appliedVariation}` : ""}
              </Text>
            </View>
            <View style={styles.macroRow}>
              {[
                { label: "Protein", value: displayProtein, unit: "g",  color: "#5B8EF5" },
                { label: "Carbs",   value: displayCarbs,   unit: "g",  color: colors.saffron },
                { label: "Fat",     value: displayFat,     unit: "g",  color: "#E84040" },
                { label: "Fiber",   value: displayFiber,   unit: "g",  color: colors.secondary },
              ].map((m) => (
                <View key={m.label} style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: m.color }]}>{m.value}{m.unit}</Text>
                  <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.calorieRow, { backgroundColor: colors.muted }]}>
              <Feather name="zap" size={16} color={colors.saffron} />
              <Text style={[styles.calorieText, { color: colors.foreground }]}>
                <Text style={{ fontWeight: "700", color: colors.saffron }}>{displayCalories} kcal</Text>
                {" per serving"}
                {selectedServings > 1
                  ? ` · ${displayCalories * selectedServings} kcal total for ${selectedServings}`
                  : ""}
              </Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Floating timer pill */}
      {timerSeconds !== null && (
        <Animated.View style={[styles.floatingTimerPill, { top: topPadding + 8, opacity: timerPillAnim, transform: [{ scale: timerPillAnim }] }]}>
          <Feather name="clock" size={14} color={timerSeconds === 0 ? "#00BFA5" : colors.saffron} />
          <Text style={styles.floatingTimerLabel} numberOfLines={1}>{timerLabel}</Text>
          <Text style={[styles.floatingTimerTime, { color: timerSeconds === 0 ? "#00BFA5" : colors.saffron }]}>
            {timerSeconds === 0 ? "Done! 🎉" : formatTime(timerSeconds)}
          </Text>
          <TouchableOpacity onPress={() => setTimerRunning((r) => !r)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name={timerRunning ? "pause" : "play"} size={14} color="#9E9E9E" />
          </TouchableOpacity>
          <TouchableOpacity onPress={cancelTimer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={14} color="#9E9E9E" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Sticky bottom bar */}
      <View style={[styles.stickyBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPadding + 8 }]}>
        <TouchableOpacity
          style={[styles.stickyBarBtn, { backgroundColor: isSaved ? colors.saveBlue + "20" : colors.muted }]}
          onPress={handleToggleSave}
        >
          <Feather name="bookmark" size={20} color={isSaved ? colors.saveBlue : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.stickyBarCookBtn, { backgroundColor: colors.saffron }]} onPress={handleCookNow}>
          <Text style={styles.stickyBarCookText}>Cook This Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.stickyBarBtn, { backgroundColor: colors.muted }]}>
          <Feather name="share-2" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── SERVINGS MODAL ── */}
      <Modal visible={showServingsModal} transparent animationType="slide" onRequestClose={() => setShowServingsModal(false)}>
        <View style={styles.servingsOverlay}>
          <View style={[styles.servingsSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.servingsHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.servingsTitleText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              How many people? 🧑‍🍳
            </Text>
            <Text style={[styles.servingsSubText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
              {recipe?.title} · Ingredients scale automatically
            </Text>
            <View style={styles.servingsBtnRow}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => {
                const active = selectedServings === n && !customServingsMode;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.servingsNumBtn, {
                      backgroundColor: active ? colors.saffron : colors.card,
                      borderColor: active ? colors.saffron : colors.border,
                    }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedServings(n); setCustomServingsMode(false); }}
                  >
                    <Text style={[styles.servingsNumText, { color: active ? "#fff" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.servingsNumBtn, {
                  backgroundColor: customServingsMode ? colors.saffron : colors.card,
                  borderColor: customServingsMode ? colors.saffron : colors.border,
                  flexDirection: "row", width: "auto" as any, paddingHorizontal: 14, gap: 5,
                }]}
                onPress={() => { setCustomServingsMode(true); setCustomServingsInput(""); }}
              >
                <Feather name="edit-2" size={14} color={customServingsMode ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.servingsNumText, { color: customServingsMode ? "#fff" : colors.mutedForeground }]}>
                  {customServingsMode && customServingsInput ? customServingsInput : "Custom"}
                </Text>
              </TouchableOpacity>
            </View>
            {customServingsMode && (
              <TextInput
                style={[styles.servingsCustomInput, { backgroundColor: colors.muted, borderColor: colors.saffron, color: colors.foreground }]}
                value={customServingsInput}
                onChangeText={setCustomServingsInput}
                keyboardType="number-pad"
                placeholder="Enter number of servings…"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => { const n = parseInt(customServingsInput, 10); if (!isNaN(n) && n > 0) setSelectedServings(Math.min(n, 99)); }}
                onBlur={() => { const n = parseInt(customServingsInput, 10); if (!isNaN(n) && n > 0) setSelectedServings(Math.min(n, 99)); }}
              />
            )}
            <TouchableOpacity
              style={[styles.servingsCookBtn, { backgroundColor: colors.saffron }]}
              onPress={() => setShowServingsModal(false)}
            >
              <Text style={[styles.servingsCookBtnText, { fontFamily: "Inter_700Bold" }]}>
                Apply · {selectedServings} serving{selectedServings !== 1 ? "s" : ""} ✓
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 12, alignItems: "center" }} onPress={() => setShowServingsModal(false)}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── SHOPPING LIST MODAL ── */}
      <Modal visible={showShoppingList} transparent animationType="slide" onRequestClose={() => setShowShoppingList(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Shopping List
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {recipe.title}
                  {appliedVariation ? ` · ${appliedVariation}` : ""}
                  {" · "}
                  {selectedServings} serving{selectedServings !== 1 ? "s" : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowShoppingList(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {displayMissingIngredients.length === 0 ? (
                <View style={styles.sheetEmptyState}>
                  <Text style={{ fontSize: 48 }}>🎉</Text>
                  <Text style={[styles.sheetEmptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    You have everything!
                  </Text>
                  <Text style={[styles.sheetEmptyBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    All ingredients for this recipe are already in your pantry.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {/* Items to buy */}
                  <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    TO BUY · {displayMissingIngredients.length} {displayMissingIngredients.length === 1 ? "item" : "items"}
                  </Text>
                  {displayMissingIngredients.map((ing, idx) => {
                    const isChecked = checkedShoppingItems.has(ing.name);
                    return (
                      <TouchableOpacity
                        key={`${ing.name}-${idx}`}
                        style={[
                          styles.sheetIngRow,
                          {
                            backgroundColor: isChecked ? colors.muted : colors.card,
                            borderColor: isChecked ? colors.border : colors.border,
                            opacity: isChecked ? 0.65 : 1,
                          },
                        ]}
                        onPress={() => toggleShoppingItem(ing.name)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.sheetIngIcon, { backgroundColor: isChecked ? "#4CAF7618" : colors.saffron + "18" }]}>
                          <Feather name={isChecked ? "check" : "shopping-cart"} size={14} color={isChecked ? "#4CAF76" : colors.saffron} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sheetIngName, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textDecorationLine: isChecked ? "line-through" : "none" }]}>
                            {ing.name}
                          </Text>
                          <Text style={[styles.sheetIngAmount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textDecorationLine: isChecked ? "line-through" : "none" }]}>
                            {scaleAmount(ing.amount, servingRatio)}
                          </Text>
                        </View>
                        {isChecked && (
                          <Text style={{ fontSize: 11, color: "#4CAF76", fontFamily: "Inter_500Medium" }}>Got it</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* What you already have */}
              {displayPantryIngredients.length > 0 && (
                <View style={{ gap: 8, marginTop: 20 }}>
                  <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    IN YOUR PANTRY · {displayPantryIngredients.length} {displayPantryIngredients.length === 1 ? "item" : "items"}
                  </Text>
                  {displayPantryIngredients.map((ing, idx) => (
                    <View
                      key={`${ing.name}-${idx}`}
                      style={[styles.sheetIngRow, { backgroundColor: colors.muted, borderColor: colors.border, opacity: 0.7 }]}
                    >
                      <View style={[styles.sheetIngIcon, { backgroundColor: "#4CAF7618" }]}>
                        <Feather name="check" size={14} color="#4CAF76" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sheetIngName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                          {ing.name}
                        </Text>
                        <Text style={[styles.sheetIngAmount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {scaleAmount(ing.amount, servingRatio)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.sheetDoneBtn, { backgroundColor: colors.saffron }]}
              onPress={() => setShowShoppingList(false)}
            >
              <Text style={[styles.sheetDoneBtnText, { fontFamily: "Inter_700Bold" }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CELEBRATION OVERLAY ── */}
      {showCelebration && (
        <Animated.View
          style={[
            styles.celebrationOverlay,
            { backgroundColor: colors.background, opacity: celebrationOpacity },
          ]}
        >
          <Animated.View style={[styles.celebrationCard, { transform: [{ scale: celebrationScale }] }]}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={[styles.celebrationTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              You nailed it!
            </Text>
            <Text style={[styles.celebrationRecipe, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {recipe.title}
            </Text>
            <View style={styles.celebrationStats}>
              <View style={[styles.celebrationStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.celebrationStatEmoji}>🥘</Text>
                <Text style={[styles.celebrationStatVal, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                  {celebrationData.deducted}
                </Text>
                <Text style={[styles.celebrationStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  pantry items used
                </Text>
              </View>
              <View style={[styles.celebrationStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.celebrationStatEmoji}>⭐</Text>
                <Text style={[styles.celebrationStatVal, { color: colors.saffron, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                  +50 XP
                </Text>
                <Text style={[styles.celebrationStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  earned
                </Text>
              </View>
            </View>

            {(celebrationData.used.length > 0 || celebrationData.needStock.length > 0) && (
              <View style={{ width: "100%", gap: 10, marginBottom: 4 }}>
                {celebrationData.used.length > 0 && (
                  <View style={[styles.celebIngBlock, { backgroundColor: "#4CAF7615", borderColor: "#4CAF7630" }]}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#4CAF76", marginBottom: 6 }}>
                      ✅ Used from your pantry
                    </Text>
                    {celebrationData.used.map((ing, i) => (
                      <Text key={i} style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
                        · {ing.name}{ing.amount ? ` (${ing.amount})` : ""}
                      </Text>
                    ))}
                  </View>
                )}
                {celebrationData.needStock.length > 0 && (
                  <View style={[styles.celebIngBlock, { backgroundColor: "#F5A62315", borderColor: "#F5A62330" }]}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.saffron, marginBottom: 6 }}>
                      🛒 Stock up on these
                    </Text>
                    {celebrationData.needStock.map((ing, i) => (
                      <Text key={i} style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
                        · {ing.name}{ing.amount ? ` (${ing.amount})` : ""}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.celebrationBtns}>
              <TouchableOpacity
                style={[styles.celebrationBtn, { backgroundColor: colors.muted }]}
                onPress={() => { setShowCelebration(false); router.replace("/(tabs)/pantry"); }}
              >
                <Text style={[styles.celebrationBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  View Pantry 🏪
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.celebrationBtn, { backgroundColor: colors.saffron }]}
                onPress={() => { setShowCelebration(false); router.replace("/(tabs)"); }}
              >
                <Text style={[styles.celebrationBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                  Keep Discovering ✨
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: { height: 280, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 80 },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 120, backgroundColor: "rgba(0,0,0,0.3)" },
  heroNav: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  heroNavBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroInfoPill: {
    position: "absolute", bottom: 16, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100,
  },
  heroPillText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  pillDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.5)" },

  content: { paddingHorizontal: 20, paddingTop: 20 },
  recipeTitle: { fontSize: 28, letterSpacing: -0.7, marginBottom: 12, fontFamily: "Inter_700Bold" },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  creatorAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  creatorAvatarText: { fontSize: 16 },
  creatorName: { fontSize: 13, flex: 1 },
  followSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  followSmallText: { fontSize: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  tagText: { fontSize: 12 },

  servingsPill: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
  },
  servingsPillText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  servingsOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  servingsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  servingsHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center" as const, marginBottom: 22 },
  servingsTitleText: { fontSize: 28, letterSpacing: -0.5, marginBottom: 6 },
  servingsSubText: { fontSize: 14, marginBottom: 22 },
  servingsBtnRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, marginBottom: 16 },
  servingsNumBtn: {
    width: 58, height: 58, borderRadius: 16, borderWidth: 1.5,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  servingsNumText: { fontSize: 18 },
  servingsCookBtn: { paddingVertical: 17, borderRadius: 16, alignItems: "center" as const, marginTop: 8 },
  servingsCookBtnText: { color: "#fff", fontSize: 17 },
  servingsCustomInput: {
    height: 50, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 16, fontSize: 17, fontFamily: "Inter_500Medium", marginBottom: 12,
  },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 14, letterSpacing: -0.3 },

  matchPanel: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  matchScore: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  matchScoreText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  matchColumns: { flexDirection: "row", gap: 16, marginBottom: 14 },
  matchColumn: { flex: 1, gap: 8 },
  matchColumnHeader: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ingredientText: { fontSize: 13, flex: 1 },
  shoppingListBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  shoppingListBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  varNoteBox: {
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12,
  },
  varNoteTitle: { fontSize: 14 },
  varNoteText: { fontSize: 13, lineHeight: 18 },

  variationChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1,
  },
  variationText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  stepCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  stepNumText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  stepInstruction: { fontSize: 14, lineHeight: 21 },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, alignSelf: "flex-start" },
  timerBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  nutritionPanel: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  macroRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  macroItem: { flex: 1, alignItems: "center", gap: 4 },
  macroValue: { fontSize: 18, fontFamily: "SpaceGrotesk_600SemiBold" },
  macroLabel: { fontSize: 11 },
  calorieRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  calorieText: { fontSize: 14, flex: 1 },

  floatingTimerPill: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  floatingTimerLabel: { color: "#fff", fontSize: 13, maxWidth: 120 },
  floatingTimerTime: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },

  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1,
  },
  stickyBarBtn: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stickyBarCookBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stickyBarCookText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  cookMode: { flex: 1 },

  // ── Redesigned Cook Mode (cm* prefix) ──────────────────────────────────────
  cmProgressRail: { height: 3, backgroundColor: "#1E1B18", width: "100%" },
  cmProgressFill: { height: 3, backgroundColor: "#F5A623", borderRadius: 2 },

  cmHeader: {
    flexDirection: "row" as const, alignItems: "center" as const,
    paddingHorizontal: 16, paddingBottom: 14, gap: 8,
  },
  cmCloseBtn: { width: 36, height: 36, alignItems: "center" as const, justifyContent: "center" as const },
  cmRecipeTitle: { color: "#F0EDE8", fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: -0.1 },
  cmStepDot: { height: 6, borderRadius: 3 },

  cmTimerPill: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 7,
    marginHorizontal: 20, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100,
    backgroundColor: "#1A1713", borderWidth: 1, borderColor: "#2A2720",
  },
  cmTimerPillLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  cmTimerPillTime: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },

  cmContent: { flex: 1, paddingHorizontal: 24, paddingTop: 4 },

  // Ghost step number — design signature
  cmGhostNum: {
    position: "absolute" as const, right: -8, top: -16,
    fontSize: 200, fontFamily: "SpaceGrotesk_700Bold",
    color: "#F0EDE8", opacity: 0.03, lineHeight: 220,
    pointerEvents: "none" as any,
  },

  cmBadgeRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 26 },
  cmStepBadge: { width: 42, height: 42, borderRadius: 21, alignItems: "center" as const, justifyContent: "center" as const },
  cmStepBadgeText: { color: "#fff", fontSize: 19, fontFamily: "SpaceGrotesk_700Bold" },
  cmStepOf: { color: "#4A4540", fontSize: 14, fontFamily: "Inter_400Regular" },
  cmVariationTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  cmVariationTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  cmInstructionRow: { flexDirection: "row" as const, gap: 14, alignItems: "flex-start" as const },
  cmBulletBar: { width: 3, borderRadius: 2, minHeight: 22, marginTop: 4, alignSelf: "stretch" as const },
  cmInstructionText: { color: "#F0EDE8", fontSize: 20, lineHeight: 30, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2, flex: 1 },

  cmInlineTimer: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    marginTop: 28, padding: 16, borderRadius: 16, borderWidth: 1,
  },
  cmInlineTimerText: { flex: 1, color: "#F5A623", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  cmNavFooter: {
    flexDirection: "row" as const, gap: 12,
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: "#1A1713",
  },
  cmNavBack: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1,
  },
  cmNavMain: {
    flex: 1, height: 56, borderRadius: 16,
    flexDirection: "row" as const, alignItems: "center" as const,
    justifyContent: "center" as const, gap: 10,
  },
  cmNavMainText: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },

  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 999,
  },
  celebrationCard: { width: "100%", alignItems: "center", gap: 12 },
  celebrationEmoji: { fontSize: 72 },
  celebrationTitle: { fontSize: 36, letterSpacing: -0.5 },
  celebrationRecipe: { fontSize: 16, textAlign: "center" },
  celebrationStats: { flexDirection: "row", gap: 12, marginTop: 8 },
  celebrationStat: {
    flex: 1, alignItems: "center", gap: 6, paddingVertical: 16,
    borderRadius: 16, borderWidth: 1,
  },
  celebrationStatEmoji: { fontSize: 24 },
  celebrationStatVal: { fontSize: 22 },
  celebrationStatLabel: { fontSize: 12, textAlign: "center" },
  celebrationBtns: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  celebrationBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  celebIngBlock: { borderRadius: 12, borderWidth: 1, padding: 12, width: "100%" },
  celebrationBtnText: { fontSize: 15 },

  // ── Cooking Instructions polish ────────────────────────────────────────────
  sectionEyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 4 },
  adaptedBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  adaptedDot: { width: 6, height: 6, borderRadius: 3 },
  adaptedBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stepAccentBar: { position: "absolute" as const, left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },

  // ── Pantry expand/collapse ─────────────────────────────────────────────────
  pantryExpandBtn: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6, paddingVertical: 10, marginTop: 4 },
  pantryExpandText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // ── Variation apply button ─────────────────────────────────────────────────
  varApplyBtn: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  varApplyBtnText: { fontSize: 14 },

  // ── Shopping list sheet ────────────────────────────────────────────────────
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheetContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "85%" as any },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center" as const, marginBottom: 18 },
  sheetHeader: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12, marginBottom: 20 },
  sheetTitle: { fontSize: 22, letterSpacing: -0.4 },
  sheetSubtitle: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  sheetSectionLabel: { fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 },
  sheetIngRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  sheetIngIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center" as const, justifyContent: "center" as const },
  sheetIngName: { fontSize: 15, marginBottom: 2 },
  sheetIngAmount: { fontSize: 13 },
  sheetEmptyState: { alignItems: "center" as const, paddingVertical: 40, gap: 10 },
  sheetEmptyTitle: { fontSize: 20, letterSpacing: -0.3 },
  sheetEmptyBody: { fontSize: 14, textAlign: "center" as const, lineHeight: 20, maxWidth: 260 },
  sheetDoneBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" as const, marginTop: 16 },
  sheetDoneBtnText: { color: "#fff", fontSize: 16 },

  // ── Make It Your Way section ───────────────────────────────────────────────
  sectionHeaderRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 14 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  clearVariationBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  clearVariationText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  varNoteHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  varNoteDot: { width: 8, height: 8, borderRadius: 4 },
  varAdditionsBlock: { gap: 8, marginTop: 4 },
  varAdditionsLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, textTransform: "uppercase" as const },
  varAdditionsRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  varAddChip: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  varLegendRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, marginTop: 4 },
  varLegendDot: { width: 7, height: 7, borderRadius: 3.5 },
  varLegendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  varNutRow: { flexDirection: "row" as const, alignItems: "center" as const, flexWrap: "wrap" as const, gap: 6, paddingTop: 10, marginTop: 4, borderTopWidth: 1 },
  varNutLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  varNutChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  varNutChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
