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

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedRecipes, saveRecipe, unsaveRecipe, markCooked, getPantryMatchScore, liveRecipes } = useApp();

  const recipe = liveRecipes.find((r) => r.id === id);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [cookMode, setCookMode] = useState(false);
  const [cookModeStep, setCookModeStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLabel, setTimerLabel] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (timerRunning && timerSeconds !== null && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerRunning(false);
            return 0;
          }
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
  const pantryIngredients = recipe.ingredients.filter((i) => i.inPantry);
  const missingIngredients = recipe.ingredients.filter((i) => !i.inPantry);
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

  // Cook Mode
  if (cookMode) {
    const currentStep = recipe.steps[cookModeStep];
    const isLast = cookModeStep === recipe.steps.length - 1;
    return (
      <View style={[styles.cookMode, { backgroundColor: "#141210" }]}>
        <View style={[styles.cookModeHeader, { paddingTop: topPadding + 8 }]}>
          <TouchableOpacity onPress={() => setCookMode(false)}>
            <Feather name="x" size={24} color="#F0EDE8" />
          </TouchableOpacity>
          <Text style={styles.cookModeTitle}>Cook Mode</Text>
          <Text style={styles.cookModeProgress}>
            {cookModeStep + 1}/{recipe.steps.length}
          </Text>
        </View>
        {/* Live timer pill */}
        {timerSeconds !== null && (
          <Animated.View style={[styles.cookModeTimerPill, { opacity: timerPillAnim, transform: [{ scale: timerPillAnim }] }]}>
            <Feather name="clock" size={15} color={timerSeconds === 0 ? "#fff" : colors.saffron} />
            <Text style={[styles.cookModeTimerPillLabel, { color: timerSeconds === 0 ? "#fff" : "#F0EDE8" }]} numberOfLines={1}>
              {timerLabel}
            </Text>
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
            <TouchableOpacity
              style={[styles.cookModeBtn, { backgroundColor: "#1E1B18" }]}
              onPress={() => setCookModeStep((s) => s - 1)}
            >
              <Feather name="arrow-left" size={22} color="#F0EDE8" />
              <Text style={styles.cookModeBtnText}>Previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.cookModeBtn, styles.cookModeNextBtn, { backgroundColor: colors.saffron }]}
            onPress={() => {
              if (isLast) {
                markCooked(recipe.id);
                setCookMode(false);
              } else {
                setCookModeStep((s) => s + 1);
              }
            }}
          >
            <Text style={[styles.cookModeBtnText, { color: "#fff" }]}>
              {isLast ? "Done Cooking!" : "Next Step"}
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

          {/* Navigation */}
          <View style={[styles.heroNav, { top: topPadding + 12 }]}>
            <TouchableOpacity
              style={[styles.heroNavBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroNavBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            >
              <Feather name="share-2" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Info pill */}
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
            <Text style={[styles.creatorName, { color: colors.mutedForeground }]}>
              @{recipe.creator}
            </Text>
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

          {/* Cuisine tags */}
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Pantry Match</Text>
            <View style={[styles.matchScore, { backgroundColor: colors.secondary }]}>
              <Text style={styles.matchScoreText}>{matchScore}% match</Text>
            </View>
            <View style={styles.matchColumns}>
              <View style={styles.matchColumn}>
                <Text style={[styles.matchColumnHeader, { color: colors.secondary }]}>
                  You Have ({pantryIngredients.length})
                </Text>
                {pantryIngredients.map((ing) => (
                  <View key={ing.name} style={styles.ingredientRow}>
                    <Feather name="check" size={14} color={colors.secondary} />
                    <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                      {ing.name} · {ing.amount}
                    </Text>
                  </View>
                ))}
              </View>
              {missingIngredients.length > 0 && (
                <View style={styles.matchColumn}>
                  <Text style={[styles.matchColumnHeader, { color: colors.saffron }]}>
                    You Need ({missingIngredients.length})
                  </Text>
                  {missingIngredients.map((ing) => (
                    <View key={ing.name} style={styles.ingredientRow}>
                      <Feather name="shopping-cart" size={14} color={colors.saffron} />
                      <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                        {ing.name} · {ing.amount}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {AI_VARIATIONS.map((v) => (
                <TouchableOpacity
                  key={v.label}
                  style={[styles.variationChip, { backgroundColor: v.color + "15", borderColor: v.color + "30" }]}
                >
                  <Feather name={v.icon} size={14} color={v.color} />
                  <Text style={[styles.variationText, { color: v.color }]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Cooking Steps */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cooking Instructions</Text>
            {recipe.steps.map((step) => {
              const done = completedSteps.includes(step.step);
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
                  <View style={[styles.stepNum, { backgroundColor: done ? colors.secondary : colors.muted }]}>
                    {done ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : (
                      <Text style={[styles.stepNumText, { color: colors.foreground }]}>{step.step}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.stepInstruction,
                        { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" },
                      ]}
                    >
                      {step.instruction}
                    </Text>
                    {step.timerMinutes && !done && (
                      <TouchableOpacity
                        style={[styles.timerBtn, { backgroundColor: colors.saffron + "15" }]}
                        onPress={() => startTimer(step.timerMinutes!, `Step ${step.step}`)}
                      >
                        <Feather name="clock" size={12} color={colors.saffron} />
                        <Text style={[styles.timerBtnText, { color: colors.saffron }]}>
                          ▶ {step.timerMinutes} min timer
                        </Text>
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
                  <Text style={[styles.macroValue, { color: m.color }]}>{m.value}{m.unit}</Text>
                  <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.calorieRow, { backgroundColor: colors.muted }]}>
              <Feather name="zap" size={16} color={colors.saffron} />
              <Text style={[styles.calorieText, { color: colors.foreground }]}>
                <Text style={{ fontWeight: "700", color: colors.saffron }}>{recipe.calories} kcal</Text> per serving
              </Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Floating timer pill — appears when a timer is active */}
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
        <TouchableOpacity
          style={[styles.stickyBarCookBtn, { backgroundColor: colors.saffron }]}
          onPress={handleCookNow}
        >
          <Text style={styles.stickyBarCookText}>Cook This Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.stickyBarBtn, { backgroundColor: colors.muted }]}>
          <Feather name="share-2" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: { height: 280, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 80 },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  heroNav: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfoPill: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
  },
  heroPillText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  pillDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.5)" },
  content: { padding: 20, gap: 20 },
  recipeTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.7, lineHeight: 32 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  creatorAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  creatorAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  creatorName: { fontSize: 14 },
  followSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  followSmallText: { fontSize: 12, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  ratingText: { fontSize: 13, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  tagText: { fontSize: 12, fontWeight: "600" },
  matchPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  matchScore: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  matchScoreText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  matchColumns: { flexDirection: "row", gap: 16 },
  matchColumn: { flex: 1, gap: 6 },
  matchColumnHeader: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ingredientText: { fontSize: 13, flex: 1 },
  shoppingListBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shoppingListBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  section: { gap: 12 },
  variationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
  },
  variationText: { fontSize: 13, fontWeight: "600" },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumText: { fontSize: 14, fontWeight: "700" },
  stepInstruction: { fontSize: 15, lineHeight: 22 },
  timerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  timerBtnText: { fontSize: 12, fontWeight: "600" },
  nutritionPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  macroRow: { flexDirection: "row", justifyContent: "space-around" },
  macroItem: { alignItems: "center", gap: 4 },
  macroValue: { fontSize: 22, fontWeight: "800" },
  macroLabel: { fontSize: 12, fontWeight: "500" },
  calorieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  calorieText: { fontSize: 14 },
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  stickyBarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyBarCookBtn: {
    flex: 1,
    height: 52,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  stickyBarCookText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  floatingTimerPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(20, 18, 16, 0.95)",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 9,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxWidth: 300,
  },
  floatingTimerLabel: { color: "#E0DDD8", fontSize: 12, fontWeight: "600", flex: 1 },
  floatingTimerTime: { fontSize: 14, fontWeight: "700" },
  cookModeTimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: "#1E1B18",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2A2520",
  },
  cookModeTimerPillLabel: { fontSize: 13, flex: 1 },
  cookModeTimerPillTime: { fontSize: 15, fontWeight: "700" },
  cookMode: { flex: 1 },
  cookModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cookModeTitle: { color: "#F0EDE8", fontSize: 18, fontWeight: "700" },
  cookModeProgress: { color: "#9E9E9E", fontSize: 16 },
  cookModeContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  cookModeStepNum: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cookModeStepNumText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  cookModeInstruction: {
    color: "#F0EDE8",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 34,
  },
  cookModeTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 100,
  },
  cookModeTimerText: { fontSize: 16, fontWeight: "700" },
  cookModeFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cookModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 100,
  },
  cookModeNextBtn: {},
  cookModeBtnText: { color: "#F0EDE8", fontWeight: "700", fontSize: 16 },
});
