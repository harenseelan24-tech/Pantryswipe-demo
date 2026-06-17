import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const API_BASE = Platform.OS !== "web"
  ? `https://${process.env.EXPO_PUBLIC_API_DOMAIN ?? "zip-repl-cactusussy24.replit.app"}/api`
  : "/api";

const RECIPE_IMAGES: Record<string, ReturnType<typeof require>> = {
  "recipe-pasta": require("@/assets/images/recipe-pasta.png"),
  "recipe-salmon": require("@/assets/images/recipe-salmon.png"),
  "recipe-bowl": require("@/assets/images/recipe-bowl.png"),
  "recipe-bibimbap": require("@/assets/images/recipe-bibimbap.png"),
};

const AI_VARIATIONS = [
  { label: "Make Vegetarian", icon: "wind" as const, color: "#4CAF76" },
  { label: "Budget Version", icon: "dollar-sign" as const, color: "#F5A623" },
  { label: "High Protein", icon: "trending-up" as const, color: "#5B8EF5" },
  { label: "Spicier", icon: "zap" as const, color: "#E84040" },
  { label: "Make Halal", icon: "check-circle" as const, color: "#9B6DFF" },
  { label: "Faster Version", icon: "clock" as const, color: "#F5A623" },
];

type MealType = "Breakfast" | "Lunch" | "Dinner";

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

  // ── Servings & meal type (from swipe params) ─────────────────────────────────
  const [selectedServings, setSelectedServings] = useState(recipe?.servings ?? 2);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Dinner");

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

  // ── AI Variations state ──────────────────────────────────────────────────────
  const [variationLoading, setVariationLoading] = useState<string | null>(null);
  const [appliedVariation, setAppliedVariation] = useState<string | null>(null);
  const [varIngredients, setVarIngredients] = useState<Array<{ name: string; amount: string; inPantry: boolean }> | null>(null);
  const [varSteps, setVarSteps] = useState<Array<{ step: number; instruction: string; timerMinutes?: number }> | null>(null);
  const [varNotes, setVarNotes] = useState<string | null>(null);

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

  // ── AI Variation handler ─────────────────────────────────────────────────────
  const handleVariation = async (variationType: string) => {
    if (!recipe || variationLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVariationLoading(variationType);
    try {
      const res = await fetch(`${API_BASE}/recipes/vary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variation: variationType,
          recipe: {
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
          },
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setVarIngredients(data.ingredients ?? null);
      setVarSteps(data.steps ?? null);
      setVarNotes(data.notes ?? null);
      setAppliedVariation(variationType);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // silently ignore - user can retry
    } finally {
      setVariationLoading(null);
    }
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
  const displayIngredients = varIngredients ?? recipe.ingredients;
  const displaySteps = varSteps ?? recipe.steps;

  const imageSource = recipe.image
    ? recipe.image.startsWith("http")
      ? { uri: recipe.image }
      : (RECIPE_IMAGES[recipe.image] ?? null)
    : null;

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

  // ── Cook Mode ────────────────────────────────────────────────────────────────
  if (cookMode) {
    const currentStep = displaySteps[cookModeStep];
    const isLast = cookModeStep === displaySteps.length - 1;
    return (
      <View style={[styles.cookMode, { backgroundColor: "#141210" }]}>
        <View style={[styles.cookModeHeader, { paddingTop: topPadding + 8 }]}>
          <TouchableOpacity onPress={() => setCookMode(false)}>
            <Feather name="x" size={24} color="#F0EDE8" />
          </TouchableOpacity>
          <Text style={styles.cookModeTitle}>Cook Mode</Text>
          <Text style={styles.cookModeProgress}>{cookModeStep + 1}/{displaySteps.length}</Text>
        </View>
        {timerSeconds !== null && (
          <Animated.View style={[styles.cookModeTimerPill, { opacity: timerPillAnim, transform: [{ scale: timerPillAnim }] }]}>
            <Feather name="clock" size={15} color={timerSeconds === 0 ? "#fff" : colors.saffron} />
            <Text style={[styles.cookModeTimerPillLabel, { color: timerSeconds === 0 ? "#fff" : "#F0EDE8" }]} numberOfLines={1}>{timerLabel}</Text>
            <Text style={[styles.cookModeTimerPillTime, { color: timerSeconds === 0 ? "#00BFA5" : colors.saffron }]}>
              {timerSeconds === 0 ? "Done! 🎉" : formatTime(timerSeconds)}
            </Text>
            <TouchableOpacity onPress={() => setTimerRunning((r) => !r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name={timerRunning ? "pause" : "play"} size={15} color="#9E9E9E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelTimer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={15} color="#666" />
            </TouchableOpacity>
          </Animated.View>
        )}
        <View style={styles.cookModeContent}>
          <View style={[styles.cookModeStepNum, { backgroundColor: colors.saffron }]}>
            <Text style={styles.cookModeStepNumText}>{currentStep.step}</Text>
          </View>
          <Text style={styles.cookModeInstruction}>{currentStep.instruction}</Text>
          {currentStep.timerMinutes && (
            <TouchableOpacity
              style={[styles.cookModeTimer, { backgroundColor: timerRunning && timerLabel === `Step ${currentStep.step}` ? colors.saffron + "25" : "#1E1B18" }]}
              onPress={() => startTimer(currentStep.timerMinutes!, `Step ${currentStep.step}`)}
            >
              <Feather name="clock" size={20} color={colors.saffron} />
              <Text style={[styles.cookModeTimerText, { color: colors.saffron }]}>
                {timerRunning && timerLabel === `Step ${currentStep.step}`
                  ? `Running: ${formatTime(timerSeconds ?? 0)}`
                  : `Start ${currentStep.timerMinutes} min Timer`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.cookModeFooter, { paddingBottom: bottomPadding + 16 }]}>
          {cookModeStep > 0 && (
            <TouchableOpacity style={[styles.cookModeBtn, { backgroundColor: "#1E1B18" }]} onPress={() => setCookModeStep((s) => s - 1)}>
              <Feather name="arrow-left" size={22} color="#F0EDE8" />
              <Text style={styles.cookModeBtnText}>Previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.cookModeBtn, styles.cookModeNextBtn, { backgroundColor: isLast ? "#4CAF76" : colors.saffron }]}
            onPress={() => {
              if (isLast) {
                const deducted = cookDish(recipe, selectedMealType, selectedServings);
                setCelebrationData({
                  deducted,
                  used: pantryIngredients.map((i) => ({ name: i.name, amount: i.amount })),
                  needStock: missingIngredients.map((i) => ({ name: i.name, amount: i.amount })),
                });
                setCookMode(false);
                setShowCelebration(true);
              } else {
                setCookModeStep((s) => s + 1);
              }
            }}
          >
            <Text style={[styles.cookModeBtnText, { color: "#fff" }]}>
              {isLast ? "Done Cooking! 🎉" : "Next Step"}
            </Text>
            {!isLast && <Feather name="arrow-right" size={22} color="#fff" />}
          </TouchableOpacity>
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

          {/* Servings adjuster */}
          <View style={[styles.servingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.servingsLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Servings</Text>
              <Text style={[styles.servingsMealType, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {selectedMealType} · Ingredients scaled automatically
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.servingsBtn, { backgroundColor: colors.muted }]}
              onPress={() => setSelectedServings((s) => Math.max(1, s - 1))}
            >
              <Feather name="minus" size={16} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.servingsCount, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
              {selectedServings}
            </Text>
            <TouchableOpacity
              style={[styles.servingsBtn, { backgroundColor: colors.muted }]}
              onPress={() => setSelectedServings((s) => Math.min(12, s + 1))}
            >
              <Feather name="plus" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Pantry Match Panel */}
          <View style={[styles.matchPanel, { backgroundColor: colors.secondary + "10", borderColor: colors.secondary + "30" }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Pantry Match</Text>
            <View style={[styles.matchScore, { backgroundColor: colors.secondary }]}>
              <Text style={styles.matchScoreText}>{matchScore}% match</Text>
            </View>
            <View style={styles.matchColumns}>
              {pantryIngredients.length > 0 && (
                <View style={styles.matchColumn}>
                  <Text style={[styles.matchColumnHeader, { color: colors.secondary }]}>
                    You Have ({pantryIngredients.length})
                  </Text>
                  {pantryIngredients.map((ing) => (
                    <View key={ing.name} style={styles.ingredientRow}>
                      <Feather name="check" size={14} color={colors.secondary} />
                      <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                        {ing.name} · {scaleAmount(ing.amount, servingRatio)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {missingIngredients.length > 0 && (
                <View style={styles.matchColumn}>
                  <Text style={[styles.matchColumnHeader, { color: colors.saffron }]}>
                    You Need ({missingIngredients.length})
                  </Text>
                  {missingIngredients.map((ing) => (
                    <View key={ing.name} style={styles.ingredientRow}>
                      <Feather name="shopping-cart" size={14} color={colors.saffron} />
                      <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                        {ing.name} · {scaleAmount(ing.amount, servingRatio)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity style={[styles.shoppingListBtn, { backgroundColor: colors.saffron }]}>
              <Feather name="shopping-cart" size={16} color="#fff" />
              <Text style={styles.shoppingListBtnText}>Generate Shopping List</Text>
            </TouchableOpacity>
          </View>

          {/* AI Variations */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>AI Variations</Text>
            {varNotes && appliedVariation && (
              <View style={[styles.varNoteBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <Feather name="check-circle" size={14} color="#4CAF76" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.varNoteTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {appliedVariation} applied
                    </Text>
                    <Text style={[styles.varNoteText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{varNotes}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setAppliedVariation(null); setVarIngredients(null); setVarSteps(null); setVarNotes(null); }}>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {/* Pantry match for variation ingredients */}
                {varIngredients && varIngredients.length > 0 && (() => {
                  const have = varIngredients.filter((i) => i.inPantry);
                  const need = varIngredients.filter((i) => !i.inPantry);
                  return (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {have.length > 0 && (
                        <View>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#4CAF76", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            ✅ You have ({have.length})
                          </Text>
                          {have.map((ing) => (
                            <Text key={ing.name} style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
                              · {ing.name} — {ing.amount}
                            </Text>
                          ))}
                        </View>
                      )}
                      {need.length > 0 && (
                        <View>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.saffron, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            🛒 Need to buy ({need.length})
                          </Text>
                          {need.map((ing) => (
                            <Text key={ing.name} style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
                              · {ing.name} — {ing.amount}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {AI_VARIATIONS.map((v) => {
                const isApplied = appliedVariation === v.label;
                const isLoading = variationLoading === v.label;
                return (
                  <TouchableOpacity
                    key={v.label}
                    style={[
                      styles.variationChip,
                      {
                        backgroundColor: isApplied ? v.color + "25" : v.color + "15",
                        borderColor: isApplied ? v.color : v.color + "30",
                        opacity: variationLoading && !isLoading ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => handleVariation(v.label)}
                    disabled={!!variationLoading}
                  >
                    {isLoading ? (
                      <Feather name="loader" size={14} color={v.color} />
                    ) : (
                      <Feather name={isApplied ? "check" : v.icon} size={14} color={v.color} />
                    )}
                    <Text style={[styles.variationText, { color: v.color }]}>
                      {isLoading ? "Working…" : v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Cooking Steps */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cooking Instructions</Text>
            {displaySteps.map((step) => {
              const done = completedSteps.includes(step.step);
              return (
                <TouchableOpacity
                  key={step.step}
                  style={[
                    styles.stepCard,
                    { backgroundColor: done ? colors.secondary + "10" : colors.card, borderColor: done ? colors.secondary + "30" : colors.border },
                  ]}
                  onPress={() => toggleStep(step.step)}
                >
                  <View style={[styles.stepNum, { backgroundColor: done ? colors.secondary : colors.muted }]}>
                    {done ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : (
                      <Text style={[styles.stepNumText, { color: colors.foreground }]}>{step.step}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepInstruction, { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" }]}>
                      {step.instruction}
                    </Text>
                    {step.timerMinutes && !done && (
                      <TouchableOpacity
                        style={[styles.timerBtn, { backgroundColor: colors.saffron + "15" }]}
                        onPress={() => startTimer(step.timerMinutes!, `Step ${step.step}`)}
                      >
                        <Feather name="clock" size={12} color={colors.saffron} />
                        <Text style={[styles.timerBtnText, { color: colors.saffron }]}>▶ {step.timerMinutes} min timer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Nutrition */}
          <View style={[styles.nutritionPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nutrition</Text>
            <View style={styles.macroRow}>
              {[
                { label: "Protein", value: recipe.nutrition.protein, unit: "g", color: "#5B8EF5" },
                { label: "Carbs", value: recipe.nutrition.carbs, unit: "g", color: colors.saffron },
                { label: "Fat", value: recipe.nutrition.fat, unit: "g", color: "#E84040" },
                { label: "Fiber", value: recipe.nutrition.fiber, unit: "g", color: colors.secondary },
              ].map((m) => (
                <View key={m.label} style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: m.color }]}>{Math.round(m.value * servingRatio)}{m.unit}</Text>
                  <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.calorieRow, { backgroundColor: colors.muted }]}>
              <Feather name="zap" size={16} color={colors.saffron} />
              <Text style={[styles.calorieText, { color: colors.foreground }]}>
                <Text style={{ fontWeight: "700", color: colors.saffron }}>{Math.round(recipe.calories * servingRatio)} kcal</Text> for {selectedServings} serving{selectedServings !== 1 ? "s" : ""}
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
            <Text style={[styles.celebrationTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>
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

            {/* Ingredient breakdown */}
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
  recipeTitle: { fontSize: 26, letterSpacing: -0.5, marginBottom: 12, fontFamily: "Fraunces_700Bold" },
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

  servingsRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  servingsLabel: { fontSize: 15 },
  servingsMealType: { fontSize: 12, marginTop: 2 },
  servingsBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  servingsCount: { fontSize: 22, minWidth: 28, textAlign: "center" },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Fraunces_700Bold", marginBottom: 14, letterSpacing: -0.3 },

  matchPanel: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  matchScore: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginBottom: 14 },
  matchScoreText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  matchColumns: { flexDirection: "row", gap: 16, marginBottom: 14 },
  matchColumn: { flex: 1, gap: 8 },
  matchColumnHeader: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ingredientText: { fontSize: 13, flex: 1 },
  shoppingListBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  shoppingListBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  varNoteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  varNoteTitle: { fontSize: 13, marginBottom: 2 },
  varNoteText: { fontSize: 12, lineHeight: 17 },

  variationChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1,
  },
  variationText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  stepCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
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
  calorieText: { fontSize: 14 },

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
  cookModeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  cookModeTitle: { color: "#F0EDE8", fontSize: 18, fontFamily: "Fraunces_700Bold" },
  cookModeProgress: { color: "#9E9E9E", fontSize: 14, fontFamily: "Inter_500Medium" },
  cookModeTimerPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: "#1E1B18",
  },
  cookModeTimerPillLabel: { flex: 1, fontSize: 13 },
  cookModeTimerPillTime: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  cookModeContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  cookModeStepNum: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  cookModeStepNumText: { color: "#fff", fontSize: 18, fontFamily: "SpaceGrotesk_600SemiBold" },
  cookModeInstruction: { color: "#F0EDE8", fontSize: 22, lineHeight: 33, fontFamily: "Fraunces_700Bold", letterSpacing: -0.3 },
  cookModeTimer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, padding: 16, borderRadius: 14 },
  cookModeTimerText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cookModeFooter: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  cookModeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 14 },
  cookModeNextBtn: { flex: 1, justifyContent: "center" },
  cookModeBtnText: { color: "#F0EDE8", fontSize: 17, fontFamily: "Inter_700Bold" },

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
});
