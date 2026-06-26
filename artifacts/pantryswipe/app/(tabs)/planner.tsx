import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_RECIPES } from "@/data/mockData";
import { useRouter } from "expo-router";

// ── Brand palette (light, matches Profile / Pantry) ───────────────────────────
const C = {
  primary:          "#F5A623",
  secondary:        "#4CAF76",
  textPrimary:      "#141210",
  textMuted:        "#7A7570",
  surface:          "#FFFFFF",
  background:       "#FAFAF8",
  surfaceLow:       "#FFF1E4",
  surfaceHigh:      "#F4E6D8",
  surfaceHighest:   "#EEE0D2",
  onPrimaryContainer: "#644000",
  outlineVariant:   "#D7C3AE",
  saveBlue:         "#5B8EF5",
  danger:           "#E84040",
} as const;

// ── Cross-platform shadows ────────────────────────────────────────────────────
const cardShadow = Platform.select({
  ios:     { shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24 },
  android: { elevation: 4 },
  web:     { boxShadow: "0 8px 24px rgba(131,85,0,0.08)" },
});
const fabShadow = Platform.select({
  ios:     { shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
  android: { elevation: 8 },
  web:     { boxShadow: "0 4px 12px rgba(245,166,35,0.35)" },
});

// ── Types & Constants ─────────────────────────────────────────────────────────
type MealType = "Breakfast" | "Lunch" | "Dinner";
type MealPlan = Record<string, Record<MealType, string | null>>;
type ViewType = "Day" | "Week" | "Month";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS: MealType[] = ["Breakfast", "Lunch", "Dinner"];
const MEAL_ICONS: Record<MealType, string>  = { Breakfast: "sunrise", Lunch: "sun",    Dinner: "moon" };
const MEAL_EMOJI: Record<MealType, string>  = { Breakfast: "🌅",      Lunch: "☀️",    Dinner: "🌙" };
const MEAL_COLORS: Record<MealType, string> = { Breakfast: "#F97316", Lunch: "#F5A623", Dinner: "#8B5CF6" };

const EMPTY_PLAN: MealPlan = {
  Mon: { Breakfast: null, Lunch: null, Dinner: null },
  Tue: { Breakfast: null, Lunch: null, Dinner: null },
  Wed: { Breakfast: null, Lunch: null, Dinner: null },
  Thu: { Breakfast: null, Lunch: null, Dinner: null },
  Fri: { Breakfast: null, Lunch: null, Dinner: null },
  Sat: { Breakfast: null, Lunch: null, Dinner: null },
  Sun: { Breakfast: null, Lunch: null, Dinner: null },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeekDates(weekOffset: number) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  return DAYS_SHORT.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatWeekRange(dates: Date[]) {
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(dates[0])} – ${fmt(dates[6])}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PlannerScreen() {
  const colors = useColors(); // kept in scope — used by legacy hooks if needed
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cookingHistory, liveRecipes } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const previewOpacity = useRef(new Animated.Value(0)).current;

  // ── State (all preserved from original) ──────────────────────────────────
  const [view, setView]                     = useState<ViewType>("Week");
  const [mealPlan, setMealPlan]             = useState<MealPlan>(EMPTY_PLAN);
  const [generating, setGenerating]         = useState(false);
  const [weekOffset, setWeekOffset]         = useState(0);
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null);
  const [selectedMeal, setSelectedMeal]     = useState<{ day: string; meal: MealType; recipeId: string } | null>(null);
  const [noHistoryMsg, setNoHistoryMsg]     = useState("");
  // Week view: which day pill is active (0=Mon…6=Sun)
  const [selectedWeekDayIdx, setSelectedWeekDayIdx] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  // Month view: selected day number + month navigation
  const [selectedMonthDay, setSelectedMonthDay] = useState<number | null>(null);
  const [monthOffset, setMonthOffset]           = useState(0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const weekDates  = getWeekDates(weekOffset);

  const allRecipes = useMemo(() => [...MOCK_RECIPES, ...liveRecipes], [liveRecipes]);
  const findRecipe = (id: string | null) => id ? allRecipes.find(r => r.id === id) ?? null : null;

  // Auto-populate mealPlan from cookingHistory (original logic — unchanged)
  useEffect(() => {
    if (cookingHistory.length === 0) return;
    const weekDateStrings = weekDates.map((d) => d.toISOString().split("T")[0]);
    setMealPlan((prev) => {
      const next: MealPlan = JSON.parse(JSON.stringify(prev));
      cookingHistory.forEach((entry) => {
        const weekIdx = weekDateStrings.indexOf(entry.date);
        if (weekIdx === -1) return;
        const dayKey = DAYS_SHORT[weekIdx];
        if (!dayKey) return;
        if (!next[dayKey][entry.mealType]) {
          const exists = allRecipes.find((r) => r.id === entry.recipeId);
          if (exists) next[dayKey][entry.mealType] = entry.recipeId;
        }
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookingHistory, weekDates]);

  // Period stats (original logic — unchanged)
  const { periodKcal, periodMeals, totalCookedMeals } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekDateStrings = weekDates.map((d) => d.toISOString().split("T")[0]);
    let kcal = 0; let meals = 0;
    cookingHistory.forEach((entry) => {
      const recipe = allRecipes.find((r) => r.id === entry.recipeId);
      if (!recipe) return;
      let include = false;
      if (view === "Day")        include = entry.date === todayStr;
      else if (view === "Week")  include = weekDateStrings.includes(entry.date);
      else {
        const d = new Date(entry.date + "T00:00:00");
        include = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      }
      if (include) { kcal += recipe.calories; meals++; }
    });
    return { periodKcal: kcal, periodMeals: meals, totalCookedMeals: cookingHistory.length };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookingHistory, view, weekDates, liveRecipes]);

  // Today's nutrition — derived from cookingHistory + recipe data (AppContext only)
  const todayNutrition = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let protein = 0, carbs = 0, fat = 0, totalKcal = 0, totalPrep = 0;
    cookingHistory.forEach((entry) => {
      if (entry.date !== todayStr) return;
      const recipe = allRecipes.find((r) => r.id === entry.recipeId);
      if (!recipe) return;
      protein   += recipe.nutrition?.protein ?? 0;
      carbs     += recipe.nutrition?.carbs   ?? 0;
      fat       += recipe.nutrition?.fat     ?? 0;
      totalKcal += recipe.calories;
      totalPrep += (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
    });
    return { protein, carbs, fat, totalKcal, totalPrep };
  }, [cookingHistory, allRecipes]);

  const kcalLabel  = view === "Day" ? "kcal today" : view === "Week" ? "kcal this week" : "kcal this month";
  const mealsLabel = view === "Day" ? "cooked today" : view === "Week" ? "cooked this week" : "cooked this month";

  const plannedCount = useMemo(() => {
    let count = 0;
    Object.values(mealPlan).forEach((day) => Object.values(day).forEach((id) => { if (id) count++; }));
    return count;
  }, [mealPlan]);

  const isPlanEmpty = plannedCount === 0;

  // handleAutoFill (original logic — unchanged)
  const handleAutoFill = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGenerating(true);
    setTimeout(() => {
      const weekDateStrings = weekDates.map((d) => d.toISOString().split("T")[0]);
      if (cookingHistory.length === 0) {
        setGenerating(false);
        setNoHistoryMsg("Cook some meals first — your history will fill in here automatically!");
        setTimeout(() => setNoHistoryMsg(""), 3500);
        return;
      }
      const newPlan: MealPlan = JSON.parse(JSON.stringify(EMPTY_PLAN));
      cookingHistory.forEach((entry) => {
        const weekIdx = weekDateStrings.indexOf(entry.date);
        if (weekIdx === -1) return;
        const dayKey = DAYS_SHORT[weekIdx];
        if (!dayKey) return;
        if (!newPlan[dayKey][entry.mealType]) {
          const exists = findRecipe(entry.recipeId);
          if (exists) newPlan[dayKey][entry.mealType] = entry.recipeId;
        }
      });
      const filled = Object.values(newPlan).reduce(
        (sum, day) => sum + Object.values(day).filter(Boolean).length, 0
      );
      if (filled === 0) {
        setGenerating(false);
        setNoHistoryMsg("No meals cooked this week yet. Cook something and come back!");
        setTimeout(() => setNoHistoryMsg(""), 3500);
        return;
      }
      setMealPlan(newPlan);
      setGenerating(false);
    }, 600);
  };

  // removeFromPlan (original logic — unchanged)
  const removeFromPlan = (day: string, meal: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMealPlan((prev) => ({ ...prev, [day]: { ...prev[day], [meal]: null } }));
  };

  const todayIndex   = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const todayKey     = DAYS_SHORT[todayIndex] || "Mon";
  const selectedRecipe = selectedMeal ? findRecipe(selectedMeal.recipeId) : null;

  // Month view date math
  const today = new Date();
  const monthDate      = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthYear      = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDayOfWeek = monthDate.getDay(); // 0=Sun
  const firstDayMon    = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday-based
  const daysInMonth    = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const prevMonthDays  = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate();

  // Month preview animation
  const animatePreview = useCallback((day: number) => {
    setSelectedMonthDay(day);
    previewOpacity.setValue(0);
    Animated.timing(previewOpacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();
  }, [previewOpacity]);

  // Image source helper — handles require() (number) or URI (string)
  const imgSrc = (image: unknown) => {
    if (!image) return null;
    if (typeof image === "number") return image as number;
    if (typeof image === "string") return { uri: image };
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <Text style={styles.headerTitle}>Meal Planner</Text>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: generating ? C.surfaceHigh : C.primary }, !generating && (fabShadow as object)]}
          onPress={handleAutoFill}
          disabled={generating}
        >
          <Feather name="zap" size={15} color={generating ? C.textMuted : "#fff"} />
          <Text style={[styles.generateBtnText, { color: generating ? C.textMuted : "#fff" }]}>
            {generating ? "Filling…" : "Auto-Fill"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* No-history toast */}
      {noHistoryMsg.length > 0 && (
        <View style={styles.noHistoryBanner}>
          <Feather name="info" size={14} color={C.textMuted} />
          <Text style={styles.noHistoryText}>{noHistoryMsg}</Text>
        </View>
      )}

      {/* ── Segmented Control ─────────────────────────────────────────────── */}
      <View style={styles.segmentContainer}>
        {(["Day", "Week", "Month"] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.segmentPill, view === v ? styles.segmentPillActive : styles.segmentPillInactive]}
            onPress={() => { setView(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.segmentText, view === v ? styles.segmentTextActive : styles.segmentTextInactive]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Main Scroll ───────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
      >
        {/* Week / Day nav bar */}
        {view !== "Month" && (() => {
          const navLabel = view === "Day"
            ? new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
            : formatWeekRange(weekDates);
          return (
            <View style={styles.weekNav}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setWeekOffset((w) => w - 1)}>
                <Feather name="chevron-left" size={20} color={C.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.weekLabel}>{navLabel}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => setWeekOffset((w) => w + 1)}>
                <Feather name="chevron-right" size={20} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Stats bento row */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: C.primary + "1A" }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: C.primary + "33" }]}>
              <Feather name="zap" size={15} color={C.primary} />
            </View>
            <Text style={[styles.summaryValue, { color: C.primary }]}>
              {periodKcal > 0 ? periodKcal.toLocaleString() : "—"}
            </Text>
            <Text style={styles.summaryLabel}>{kcalLabel}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: C.saveBlue + "1A" }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: C.saveBlue + "33" }]}>
              <Feather name="check-circle" size={15} color={C.saveBlue} />
            </View>
            <Text style={[styles.summaryValue, { color: C.saveBlue }]}>{totalCookedMeals}</Text>
            <Text style={styles.summaryLabel}>meals total</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: C.secondary + "1A" }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: C.secondary + "33" }]}>
              <Feather name="calendar" size={15} color={C.secondary} />
            </View>
            <Text style={[styles.summaryValue, { color: C.secondary }]}>{periodMeals}</Text>
            <Text style={styles.summaryLabel}>{mealsLabel}</Text>
          </View>
        </View>

        {/* Meal type filter pills */}
        <View style={styles.mealTypeRow}>
          {MEALS.map((meal) => {
            const isActive  = activeMealType === meal;
            const mealColor = MEAL_COLORS[meal];
            return (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.mealTypePill,
                  { backgroundColor: isActive ? mealColor : C.surfaceLow, borderColor: isActive ? mealColor : C.surfaceHigh },
                ]}
                onPress={() => { setActiveMealType(isActive ? null : meal); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={{ fontSize: 16 }}>{MEAL_EMOJI[meal]}</Text>
                <Text style={[styles.mealTypePillText, { color: isActive ? "#fff" : C.textMuted, fontFamily: isActive ? "Epilogue_700Bold" : "Epilogue_400Regular" }]}>
                  {meal}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ━━━━━━━━━━━━━━ DAY VIEW ━━━━━━━━━━━━━━ */}
        {view === "Day" && (
          <View style={styles.dayView}>
            <Text style={styles.dayViewTitle}>Today — {DAYS_FULL[todayIndex]}</Text>

            {/* Bento summary row */}
            <View style={styles.bentoRow}>
              <View style={[styles.bentoCard, { backgroundColor: C.primary + "1A" }]}>
                <Text style={[styles.bentoLabel, { color: C.primary }]}>TOTAL CALORIES</Text>
                <Text style={[styles.bentoValue, { color: C.primary }]}>
                  {todayNutrition.totalKcal > 0 ? todayNutrition.totalKcal.toLocaleString() : "—"}
                </Text>
                <Text style={styles.bentoSub}>kcal for the day</Text>
              </View>
              <View style={[styles.bentoCard, { backgroundColor: C.secondary + "1A" }]}>
                <Text style={[styles.bentoLabel, { color: C.secondary }]}>PREP TIME</Text>
                <Text style={[styles.bentoValue, { color: C.secondary }]}>
                  {todayNutrition.totalPrep > 0 ? String(todayNutrition.totalPrep) : "—"}
                </Text>
                <Text style={styles.bentoSub}>min total prep</Text>
              </View>
            </View>

            {/* Meal cards */}
            {(activeMealType ? [activeMealType] : MEALS).map((meal) => {
              const recipeId  = mealPlan[todayKey]?.[meal];
              const recipe    = recipeId ? findRecipe(recipeId) : null;
              const mealColor = MEAL_COLORS[meal];
              const src       = recipe ? imgSrc(recipe.image) : null;
              return (
                <View key={meal}>
                  {/* Section header */}
                  <View style={styles.mealSectionHeader}>
                    <Feather name={MEAL_ICONS[meal] as any} size={18} color={mealColor} />
                    <Text style={[styles.mealSectionLabel, { color: mealColor }]}>{meal}</Text>
                  </View>

                  {recipe ? (
                    /* Hero card */
                    <TouchableOpacity
                      style={[styles.heroCard, cardShadow as object]}
                      onPress={() => { if (recipe && recipeId) setSelectedMeal({ day: todayKey, meal, recipeId }); }}
                      activeOpacity={0.9}
                    >
                      {src ? (
                        <Image source={src as any} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: mealColor + "33", alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 64 }}>{MEAL_EMOJI[meal]}</Text>
                        </View>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.85)"]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0.4 }}
                        end={{ x: 0, y: 1 }}
                      />
                      <View style={styles.heroCardContent}>
                        {meal === "Dinner" && (
                          <View style={styles.chefsBadge}>
                            <Text style={styles.chefsBadgeText}>CHEF'S CHOICE</Text>
                          </View>
                        )}
                        <Text style={styles.heroCardTitle} numberOfLines={2}>{recipe.title}</Text>
                        <View style={styles.heroCardMeta}>
                          <Feather name="clock" size={13} color="rgba(255,255,255,0.85)" />
                          <Text style={styles.heroCardMetaText}>{recipe.prepTime + recipe.cookTime}m</Text>
                          <Feather name="zap" size={13} color="rgba(255,255,255,0.85)" />
                          <Text style={styles.heroCardMetaText}>{recipe.calories} kcal</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.dayMealEmpty}>
                      <Feather name="plus-circle" size={20} color={C.textMuted} />
                      <Text style={styles.dayMealEmptyText}>Cook a meal to fill this slot</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ━━━━━━━━━━━━━━ WEEK VIEW ━━━━━━━━━━━━━━ */}
        {view === "Week" && (
          <View>
            {/* Section header */}
            <View style={styles.weekSectionHeader}>
              <View>
                <Text style={styles.weekSectionTitle}>This Week's Plan</Text>
                <Text style={styles.weekSectionSub}>
                  {periodKcal > 0 ? `${periodKcal.toLocaleString()} kcal logged` : "No meals logged yet"}
                </Text>
              </View>
              <TouchableOpacity style={styles.autoGenBtn} onPress={handleAutoFill} disabled={generating}>
                <Feather name="zap" size={16} color={C.primary} />
                <Text style={styles.autoGenBtnText}>{generating ? "Filling…" : "Auto-Fill"}</Text>
              </TouchableOpacity>
            </View>

            {/* Horizontal day selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
              contentContainerStyle={styles.daySelectorContent}
            >
              {DAYS_SHORT.map((day, idx) => {
                const isActive = idx === selectedWeekDayIdx;
                const isToday  = idx === todayIndex;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayPill, isActive ? styles.dayPillActive : styles.dayPillInactive]}
                    onPress={() => { setSelectedWeekDayIdx(idx); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={[styles.dayPillDay, isActive ? styles.dayPillTextActive : styles.dayPillTextInactive]}>
                      {day}{isToday ? " ·" : ""}
                    </Text>
                    <Text style={[styles.dayPillDate, isActive ? styles.dayPillTextActive : styles.dayPillTextInactive]}>
                      {weekDates[idx]?.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Empty state */}
            {isPlanEmpty ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🗓️</Text>
                <Text style={styles.emptyStateTitle}>Your week is wide open</Text>
                <Text style={styles.emptyStateText}>
                  Cook meals and tap{" "}
                  <Text style={{ fontFamily: "Epilogue_700Bold", color: C.primary }}>Auto-Fill</Text>
                  {" "}above — we'll fill in everything you've actually cooked this week.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyStateCTA, { backgroundColor: C.primary }]}
                  onPress={handleAutoFill}
                  disabled={generating}
                >
                  <Feather name="zap" size={15} color="#fff" />
                  <Text style={styles.emptyStateCTAText}>{generating ? "Filling…" : "Auto-Fill My Week"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Meal cards for selected day */
              <View style={{ gap: 12 }}>
                {(activeMealType ? [activeMealType] : MEALS).map((meal) => {
                  const selectedDayKey = DAYS_SHORT[selectedWeekDayIdx] || todayKey;
                  const recipeId  = mealPlan[selectedDayKey]?.[meal];
                  const recipe    = recipeId ? findRecipe(recipeId) : null;
                  const mealColor = MEAL_COLORS[meal];
                  const src       = recipe ? imgSrc(recipe.image) : null;

                  if (!recipe) {
                    return (
                      <View key={meal} style={[styles.weekMealEmpty, { borderColor: C.outlineVariant }]}>
                        <View style={[styles.weekMealEmptyIcon, { backgroundColor: mealColor + "22" }]}>
                          <Text style={{ fontSize: 22 }}>{MEAL_EMOJI[meal]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.weekMealEmptyType, { color: mealColor }]}>{meal}</Text>
                          <Text style={styles.weekMealEmptyHint}>Nothing planned</Text>
                        </View>
                        <Feather name="plus" size={18} color={C.textMuted} />
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={meal}
                      style={[styles.weekMealCard, cardShadow as object]}
                      onPress={() => recipe && recipeId ? setSelectedMeal({ day: selectedDayKey, meal, recipeId }) : undefined}
                      onLongPress={() => recipe ? removeFromPlan(selectedDayKey, meal) : undefined}
                      activeOpacity={0.85}
                    >
                      {src ? (
                        <Image source={src as any} style={styles.weekMealThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.weekMealThumb, { backgroundColor: mealColor + "25", alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 32 }}>{MEAL_EMOJI[meal]}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.weekMealDayLabel, { color: mealColor }]}>{meal.toUpperCase()}</Text>
                        <Text style={styles.weekMealName} numberOfLines={2}>{recipe.title}</Text>
                        <View style={styles.weekMealMeta}>
                          <Feather name="zap" size={14} color={C.textMuted} />
                          <Text style={styles.weekMealMetaText}>{recipe.calories} kcal</Text>
                          <Text style={styles.weekMealMetaText}> · {recipe.prepTime + recipe.cookTime}m</Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={20} color={C.outlineVariant} />
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.gridHint}>Tap a meal to view · long-press to remove</Text>
              </View>
            )}
          </View>
        )}

        {/* ━━━━━━━━━━━━━━ MONTH VIEW ━━━━━━━━━━━━━━ */}
        {view === "Month" && (
          <View style={styles.monthView}>
            {/* Month header */}
            <View style={styles.monthHeader}>
              <Text style={styles.monthTitle}>{monthYear}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={styles.monthNavBtn} onPress={() => setMonthOffset((m) => m - 1)}>
                  <Feather name="chevron-left" size={20} color={C.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.monthNavBtn} onPress={() => setMonthOffset((m) => m + 1)}>
                  <Feather name="chevron-right" size={20} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Day-of-week labels */}
            <View style={styles.monthDowRow}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Text key={i} style={styles.monthDowLabel}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.monthGrid}>
              {/* Leading prev-month cells */}
              {[...Array(firstDayMon)].map((_, i) => (
                <View key={`prev-${i}`} style={styles.monthCell}>
                  <Text style={styles.monthPrevDayNum}>{prevMonthDays - firstDayMon + 1 + i}</Text>
                </View>
              ))}
              {/* Current month days — dynamically generated from Date() */}
              {[...Array(daysInMonth)].map((_, i) => {
                const dayNum    = i + 1;
                const dayKey    = DAYS_SHORT[i % 7];
                const dayPlan   = mealPlan[dayKey];
                const hasMeals  = dayPlan && Object.values(dayPlan).some(Boolean);
                const isToday   = dayNum === today.getDate() && monthOffset === 0;
                const isSelected = dayNum === selectedMonthDay;
                return (
                  <TouchableOpacity
                    key={dayNum}
                    style={[
                      styles.monthCell,
                      isToday    && styles.monthCellToday,
                      isSelected && !isToday && styles.monthCellSelected,
                    ]}
                    onPress={() => animatePreview(dayNum)}
                  >
                    <Text style={[styles.monthDayNum, isToday && styles.monthDayNumToday]}>{dayNum}</Text>
                    {hasMeals && (
                      <View style={[styles.monthDot, { backgroundColor: isToday ? "rgba(255,255,255,0.8)" : C.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Day preview panel */}
            {selectedMonthDay !== null && (
              <Animated.View style={[styles.monthPreview, { opacity: previewOpacity }]}>
                <Text style={styles.monthPreviewHeader}>
                  {monthDate.toLocaleDateString("en-US", { month: "long" })} {selectedMonthDay}
                </Text>
                {(() => {
                  const dayKey  = DAYS_SHORT[(selectedMonthDay - 1) % 7];
                  const dayPlan = mealPlan[dayKey];
                  const dayMeals = MEALS
                    .map((m) => ({ meal: m, recipeId: dayPlan?.[m] ?? null }))
                    .filter((x) => x.recipeId);
                  if (dayMeals.length === 0) {
                    return <Text style={styles.monthPreviewEmpty}>No meals planned for this day.</Text>;
                  }
                  return dayMeals.map(({ meal, recipeId }) => {
                    const recipe    = findRecipe(recipeId);
                    if (!recipe) return null;
                    const mealColor = MEAL_COLORS[meal];
                    return (
                      <TouchableOpacity
                        key={meal}
                        style={[styles.weekMealCard, cardShadow as object, { marginBottom: 8 }]}
                        onPress={() => recipeId ? setSelectedMeal({ day: dayKey, meal, recipeId }) : undefined}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.weekMealThumb, { backgroundColor: mealColor + "25", alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 28 }}>{MEAL_EMOJI[meal]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.weekMealDayLabel, { color: mealColor }]}>{meal.toUpperCase()}</Text>
                          <Text style={styles.weekMealName} numberOfLines={1}>{recipe.title}</Text>
                          <View style={styles.weekMealMeta}>
                            <Feather name="zap" size={13} color={C.textMuted} />
                            <Text style={styles.weekMealMetaText}>{recipe.calories} kcal</Text>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={18} color={C.outlineVariant} />
                      </TouchableOpacity>
                    );
                  });
                })()}
              </Animated.View>
            )}

            {/* Weekly Summary card */}
            <View style={[styles.goalsCard, cardShadow as object]}>
              <View style={styles.goalsDecorCircle} />
              <Text style={styles.goalsTitle}>Weekly Summary</Text>
              <Text style={styles.goalsSub}>Macro distribution this week</Text>
              <View style={styles.macroGrid}>
                {([
                  { label: "PROTEIN", value: todayNutrition.protein, color: C.secondary, target: 150 },
                  { label: "CARBS",   value: todayNutrition.carbs,   color: C.primary,   target: 250 },
                  { label: "FAT",     value: todayNutrition.fat,     color: C.saveBlue,  target: 80  },
                ] as const).map(({ label, value, color, target }) => {
                  const pct = target > 0 ? Math.min(value / target, 1) : 0;
                  return (
                    <View key={label} style={styles.macroCol}>
                      <Text style={[styles.macroLabel, { color }]}>{label}</Text>
                      <Text style={styles.macroValue}>{value > 0 ? `${Math.round(value)}g` : "—"}</Text>
                      <View style={styles.macroBarTrack}>
                        <View style={[styles.macroBarFill, { backgroundColor: color, width: `${Math.round(pct * 100)}%` as any }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.goalsTotalRow}>
                <Text style={styles.goalsTotalLabel}>Total Calories</Text>
                <Text style={styles.goalsTotalValue}>{periodKcal > 0 ? `${periodKcal.toLocaleString()} kcal` : "—"}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Meal Detail Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedMeal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setSelectedMeal(null)}
      >
        <View style={[styles.modal, { backgroundColor: C.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHandle, { backgroundColor: C.outlineVariant }]} />
          {selectedRecipe && selectedMeal && (
            <>
              {/* Eyebrow */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <View style={[styles.mealDetailDot, { backgroundColor: MEAL_COLORS[selectedMeal.meal] }]} />
                <Text style={[styles.mealDetailEyebrow, { color: MEAL_COLORS[selectedMeal.meal] }]}>MEAL PLAN</Text>
              </View>
              {/* Badge row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <View style={[styles.mealDetailBadge, { backgroundColor: MEAL_COLORS[selectedMeal.meal] + "18", borderColor: MEAL_COLORS[selectedMeal.meal] + "40" }]}>
                  <Text style={{ fontSize: 14 }}>{MEAL_EMOJI[selectedMeal.meal]}</Text>
                  <Text style={[styles.mealDetailBadgeText, { color: MEAL_COLORS[selectedMeal.meal] }]}>{selectedMeal.meal}</Text>
                </View>
                <Text style={styles.mealDetailDay}>{selectedMeal.day}</Text>
              </View>
              <Text style={styles.mealDetailTitle}>{selectedRecipe.title}</Text>
              {/* Stats */}
              <View style={styles.mealDetailStats}>
                {([
                  { label: "Calories", value: `${selectedRecipe.calories}`,                          icon: "zap",   color: C.primary   },
                  { label: "Time",     value: `${selectedRecipe.prepTime + selectedRecipe.cookTime}m`, icon: "clock", color: C.saveBlue  },
                  { label: "Servings", value: `${selectedRecipe.servings}`,                            icon: "users", color: C.secondary },
                ] as const).map((s) => (
                  <View key={s.label} style={[styles.mealDetailStat, { backgroundColor: s.color + "0C", borderColor: s.color + "28" }]}>
                    <View style={[styles.mealDetailStatIcon, { backgroundColor: s.color + "22" }]}>
                      <Feather name={s.icon as any} size={13} color={s.color} />
                    </View>
                    <Text style={styles.mealDetailStatVal}>{s.value}</Text>
                    <Text style={styles.mealDetailStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              {/* Action buttons */}
              <View style={styles.mealDetailBtns}>
                <TouchableOpacity
                  style={[styles.mealDetailBtn, { backgroundColor: C.surfaceLow }]}
                  onPress={() => { if (selectedMeal) removeFromPlan(selectedMeal.day, selectedMeal.meal); setSelectedMeal(null); }}
                >
                  <Feather name="trash-2" size={16} color={C.danger} />
                  <Text style={[styles.mealDetailBtnText, { color: C.danger }]}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mealDetailBtn, { backgroundColor: MEAL_COLORS[selectedMeal.meal] }]}
                  onPress={() => { setSelectedMeal(null); router.push(`/recipe/${selectedRecipe.id}`); }}
                >
                  <Feather name="book-open" size={16} color="#fff" />
                  <Text style={[styles.mealDetailBtnText, { color: "#fff" }]}>View Recipe</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1 },

  // Header
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle:     { fontSize: 28, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.5 },
  generateBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, minHeight: 44 },
  generateBtnText: { fontSize: 13, fontFamily: "Epilogue_700Bold" },

  // Toast banner
  noHistoryBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, backgroundColor: C.surfaceLow, borderColor: C.outlineVariant },
  noHistoryText:   { flex: 1, fontSize: 12, lineHeight: 17, color: C.textMuted, fontFamily: "Epilogue_400Regular" },

  // Segmented control
  segmentContainer:    { flexDirection: "row", marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surfaceHigh, borderRadius: 999, padding: 4 },
  segmentPill:         { flex: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center", minHeight: 44, justifyContent: "center" },
  segmentPillActive:   { backgroundColor: C.primary, shadowColor: "rgba(131,85,0,1)", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  segmentPillInactive: {},
  segmentText:         { fontSize: 14, letterSpacing: 0.5 },
  segmentTextActive:   { fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },
  segmentTextInactive: { fontFamily: "Epilogue_400Regular", color: C.textMuted },

  // Scroll
  scrollContent: { paddingHorizontal: 20 },

  // Week / Day nav bar
  weekNav:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navBtn:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.outlineVariant },
  weekLabel: { fontSize: 15, fontFamily: "Epilogue_700Bold", color: C.textPrimary },

  // Stats row
  summaryRow:    { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard:   { flex: 1, alignItems: "center", paddingVertical: 16, borderRadius: 20, gap: 4 },
  summaryIconBox:{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryValue:  { fontSize: 22, fontFamily: "Epilogue_700Bold", letterSpacing: -0.5 },
  summaryLabel:  { fontSize: 11, textAlign: "center", color: C.textMuted, fontFamily: "Epilogue_400Regular" },

  // Meal type filter pills
  mealTypeRow:     { flexDirection: "row", gap: 10, marginBottom: 20 },
  mealTypePill:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 16, borderWidth: 1, minHeight: 44 },
  mealTypePillText:{ fontSize: 13 },

  // ── DAY VIEW ──────────────────────────────────────────────────────────────
  dayView:          { gap: 16 },
  dayViewTitle:     { fontSize: 24, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.3 },
  bentoRow:         { flexDirection: "row", gap: 12 },
  bentoCard:        { flex: 1, borderRadius: 24, padding: 20 },
  bentoLabel:       { fontSize: 11, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  bentoValue:       { fontSize: 28, fontFamily: "Epilogue_700Bold", letterSpacing: -0.5 },
  bentoSub:         { fontSize: 12, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 },
  mealSectionHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  mealSectionLabel: { fontSize: 20, fontFamily: "Epilogue_700Bold" },
  heroCard:         { height: 200, borderRadius: 20, overflow: "hidden", marginBottom: 4 },
  heroCardContent:  { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16 },
  heroCardTitle:    { fontSize: 20, fontFamily: "Epilogue_700Bold", color: "#FFFFFF", marginBottom: 6 },
  heroCardMeta:     { flexDirection: "row", alignItems: "center", gap: 6 },
  heroCardMetaText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Epilogue_400Regular" },
  chefsBadge:       { alignSelf: "flex-start", backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  chefsBadgeText:   { fontSize: 10, fontFamily: "Epilogue_700Bold", color: "#644000", textTransform: "uppercase" },
  dayMealEmpty:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: C.outlineVariant },
  dayMealEmptyText: { fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular" },

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────
  weekSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  weekSectionTitle:  { fontSize: 22, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  weekSectionSub:    { fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 },
  autoGenBtn:        { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primary + "25", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  autoGenBtnText:    { fontSize: 13, fontFamily: "Epilogue_700Bold", color: "#644000" },
  daySelectorContent:{ paddingVertical: 4, gap: 8, flexDirection: "row" },
  dayPill:           { alignItems: "center", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, minHeight: 44, justifyContent: "center", minWidth: 56 },
  dayPillActive:     { backgroundColor: C.primary, shadowColor: C.primary, shadowOpacity: 0.20, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  dayPillInactive:   { backgroundColor: C.surfaceHigh },
  dayPillDay:        { fontSize: 12, fontFamily: "Epilogue_700Bold" },
  dayPillDate:       { fontSize: 14, fontFamily: "Epilogue_700Bold" },
  dayPillTextActive: { color: "#FFFFFF" },
  dayPillTextInactive:{ color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  weekMealCard:      { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.surfaceLow, borderRadius: 20, padding: 16 },
  weekMealThumb:     { width: 80, height: 80, borderRadius: 12, overflow: "hidden" },
  weekMealDayLabel:  { fontSize: 11, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5 },
  weekMealName:      { fontSize: 17, fontFamily: "Epilogue_700Bold", color: C.textPrimary, marginTop: 4 },
  weekMealMeta:      { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  weekMealMetaText:  { fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  weekMealEmpty:     { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.surface, borderRadius: 20, padding: 16, borderWidth: 1, minHeight: 72 },
  weekMealEmptyIcon: { width: 56, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  weekMealEmptyType: { fontSize: 13, fontFamily: "Epilogue_700Bold" },
  weekMealEmptyHint: { fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 },
  gridHint:          { fontSize: 12, textAlign: "center", color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 4, marginBottom: 8 },

  // Empty state
  emptyState:     { borderRadius: 18, borderWidth: 1, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 12, marginBottom: 16, backgroundColor: C.primary + "0D", borderColor: C.primary + "30" },
  emptyStateEmoji:{ fontSize: 48 },
  emptyStateTitle:{ fontSize: 22, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.3 },
  emptyStateText: { fontSize: 15, lineHeight: 22, textAlign: "center", color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  emptyStateCTA:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 100, marginTop: 8, minHeight: 44 },
  emptyStateCTAText: { color: "#fff", fontSize: 16, fontFamily: "Epilogue_700Bold" },

  // ── MONTH VIEW ────────────────────────────────────────────────────────────
  monthView:       { gap: 16 },
  monthHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthTitle:      { fontSize: 28, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.5 },
  monthNavBtn:     { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.outlineVariant, alignItems: "center", justifyContent: "center" },
  monthDowRow:     { flexDirection: "row" },
  monthDowLabel:   { flex: 1, textAlign: "center", fontSize: 12, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5, color: C.outlineVariant, textTransform: "uppercase", paddingVertical: 8 },
  monthGrid:       { flexDirection: "row", flexWrap: "wrap" },
  monthCell:       { width: "14.28%" as any, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  monthCellToday:  { backgroundColor: C.primary, borderRadius: 12 },
  monthCellSelected:{ borderWidth: 2, borderColor: C.primary, borderRadius: 12 },
  monthDayNum:     { fontSize: 14, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  monthDayNumToday:{ color: "#FFFFFF" },
  monthPrevDayNum: { fontSize: 13, color: C.outlineVariant, fontFamily: "Epilogue_400Regular" },
  monthDot:        { width: 6, height: 6, borderRadius: 3, position: "absolute", bottom: 6 },
  monthPreview:    { backgroundColor: C.surfaceLow, borderRadius: 20, padding: 20 },
  monthPreviewHeader: { fontSize: 20, fontFamily: "Epilogue_700Bold", color: C.textPrimary, marginBottom: 16 },
  monthPreviewEmpty:  { fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular" },

  // Weekly summary card
  goalsCard:        { backgroundColor: C.surfaceHighest, borderRadius: 20, padding: 24, overflow: "hidden" },
  goalsDecorCircle: { position: "absolute", top: -32, right: -32, width: 96, height: 96, borderRadius: 48, backgroundColor: C.primary + "1F" },
  goalsTitle:       { fontSize: 24, fontFamily: "Epilogue_700Bold", color: C.textPrimary, marginBottom: 4 },
  goalsSub:         { fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginBottom: 20 },
  macroGrid:        { flexDirection: "row", gap: 12, marginBottom: 16 },
  macroCol:         { flex: 1, backgroundColor: C.surfaceLow, borderRadius: 16, padding: 16, alignItems: "center" },
  macroLabel:       { fontSize: 11, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  macroValue:       { fontSize: 22, fontFamily: "Epilogue_700Bold", color: C.textPrimary, marginBottom: 8 },
  macroBarTrack:    { height: 4, borderRadius: 2, backgroundColor: C.outlineVariant, width: "100%", overflow: "hidden" },
  macroBarFill:     { height: 4, borderRadius: 2 },
  goalsTotalRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.outlineVariant, paddingTop: 16 },
  goalsTotalLabel:  { fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  goalsTotalValue:  { fontSize: 20, fontFamily: "Epilogue_700Bold", color: C.textPrimary },

  // ── MODAL ─────────────────────────────────────────────────────────────────
  modal:              { flex: 1, padding: 24 },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  mealDetailDot:      { width: 6, height: 6, borderRadius: 3 },
  mealDetailEyebrow:  { fontSize: 10, letterSpacing: 1, fontFamily: "Epilogue_700Bold" },
  mealDetailBadge:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  mealDetailBadgeText:{ fontSize: 12, fontFamily: "Epilogue_700Bold" },
  mealDetailDay:      { fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  mealDetailTitle:    { fontSize: 26, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.4, marginBottom: 18 },
  mealDetailStats:    { flexDirection: "row", gap: 10, marginBottom: 24 },
  mealDetailStat:     { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  mealDetailStatIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  mealDetailStatVal:  { fontSize: 17, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  mealDetailStatLabel:{ fontSize: 11, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  mealDetailBtns:     { flexDirection: "row", gap: 12 },
  mealDetailBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, minHeight: 44 },
  mealDetailBtnText:  { fontSize: 15, fontFamily: "Epilogue_700Bold" },
});
