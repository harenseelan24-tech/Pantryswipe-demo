import React, { useState, useMemo, useEffect } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_RECIPES } from "@/data/mockData";
import { useRouter } from "expo-router";

type MealType = "Breakfast" | "Lunch" | "Dinner";
type MealPlan = Record<string, Record<MealType, string | null>>;
type ViewType = "Day" | "Week" | "Month";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS: MealType[] = ["Breakfast", "Lunch", "Dinner"];
const MEAL_ICONS: Record<MealType, string> = { Breakfast: "sun", Lunch: "clock", Dinner: "moon" };
const MEAL_EMOJI: Record<MealType, string> = { Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙" };
const MEAL_COLORS: Record<MealType, string> = { Breakfast: "#F97316", Lunch: "#F5A623", Dinner: "#8B5CF6" };
const MEAL_BG: Record<MealType, string> = { Breakfast: "#FFF7ED", Lunch: "#FFFBEB", Dinner: "#F5F3FF" };

const EMPTY_PLAN: MealPlan = {
  Mon: { Breakfast: null, Lunch: null, Dinner: null },
  Tue: { Breakfast: null, Lunch: null, Dinner: null },
  Wed: { Breakfast: null, Lunch: null, Dinner: null },
  Thu: { Breakfast: null, Lunch: null, Dinner: null },
  Fri: { Breakfast: null, Lunch: null, Dinner: null },
  Sat: { Breakfast: null, Lunch: null, Dinner: null },
  Sun: { Breakfast: null, Lunch: null, Dinner: null },
};

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

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cookingHistory, liveRecipes } = useApp();

  const [view, setView] = useState<ViewType>("Week");
  const [mealPlan, setMealPlan] = useState<MealPlan>(EMPTY_PLAN);
  const [generating, setGenerating] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<{ day: string; meal: MealType; recipeId: string } | null>(null);
  const [noHistoryMsg, setNoHistoryMsg] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const weekDates = getWeekDates(weekOffset);

  const allRecipes = useMemo(() => [...MOCK_RECIPES, ...liveRecipes], [liveRecipes]);
  const findRecipe = (id: string | null) => id ? allRecipes.find(r => r.id === id) ?? null : null;

  /** Auto-populate mealPlan from cookingHistory whenever history changes or week changes. */
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

  /** Calories and meal counts for the selected view period. */
  const { periodKcal, periodMeals, totalCookedMeals } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekDateStrings = weekDates.map((d) => d.toISOString().split("T")[0]);

    let kcal = 0;
    let meals = 0;

    cookingHistory.forEach((entry) => {
      const recipe = allRecipes.find((r) => r.id === entry.recipeId);
      if (!recipe) return;

      let include = false;
      if (view === "Day") {
        include = entry.date === todayStr;
      } else if (view === "Week") {
        include = weekDateStrings.includes(entry.date);
      } else {
        const d = new Date(entry.date + "T00:00:00");
        include = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      }

      if (include) {
        kcal += recipe.calories;
        meals++;
      }
    });

    return { periodKcal: kcal, periodMeals: meals, totalCookedMeals: cookingHistory.length };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookingHistory, view, weekDates, liveRecipes]);

  const kcalLabel = view === "Day" ? "kcal today" : view === "Week" ? "kcal this week" : "kcal this month";
  const mealsLabel = view === "Day" ? "cooked today" : view === "Week" ? "cooked this week" : "cooked this month";

  const plannedCount = useMemo(() => {
    let count = 0;
    Object.values(mealPlan).forEach((day) => Object.values(day).forEach((id) => { if (id) count++; }));
    return count;
  }, [mealPlan]);

  const isPlanEmpty = plannedCount === 0;

  /** Auto-fill from real cooking history for the displayed week. */
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

  const removeFromPlan = (day: string, meal: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMealPlan((prev) => ({ ...prev, [day]: { ...prev[day], [meal]: null } }));
  };

  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const todayKey = DAYS_SHORT[todayIndex] || "Mon";
  const selectedRecipe = selectedMeal ? findRecipe(selectedMeal.recipeId) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Meal Planner</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.generateBtn,
            {
              backgroundColor: generating ? colors.muted : colors.primary,
              shadowColor: generating ? "transparent" : colors.primary,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: generating ? 0 : 0.35,
              shadowRadius: 8,
              elevation: generating ? 0 : 4,
            },
          ]}
          onPress={handleAutoFill}
          disabled={generating}
        >
          <Feather name="zap" size={15} color={generating ? colors.textMuted : colors.primaryForeground} />
          <Text style={[styles.generateBtnText, { color: generating ? colors.textMuted : colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
            {generating ? "Filling…" : "Auto-Fill"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* No-history toast */}
      {noHistoryMsg.length > 0 && (
        <View style={[styles.noHistoryBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.textSecondary} />
          <Text style={[styles.noHistoryText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {noHistoryMsg}
          </Text>
        </View>
      )}

      {/* View toggle */}
      <View style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["Day", "Week", "Month"] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.viewBtn, { backgroundColor: view === v ? colors.primary : "transparent" }]}
            onPress={() => { setView(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.viewBtnText, { color: view === v ? colors.primaryForeground : colors.textSecondary, fontFamily: view === v ? "Inter_600SemiBold" : "Inter_500Medium" }]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Week navigation */}
        {(() => {
          const today = new Date();
          const navLabel =
            view === "Day"
              ? today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
              : view === "Month"
              ? weekDates[0].toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : formatWeekRange(weekDates);
          return (
            <View style={styles.weekNav}>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setWeekOffset((w) => w - 1)}>
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.weekLabel, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{navLabel}</Text>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setWeekOffset((w) => w + 1)}>
                <Feather name="chevron-right" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Stats */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.primary + "0C", borderColor: colors.primary + "28" }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="zap" size={15} color={colors.primary} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>
              {periodKcal > 0 ? periodKcal.toLocaleString() : "—"}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{kcalLabel}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.saveBlue + "0C", borderColor: colors.saveBlue + "28" }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: colors.saveBlue + "20" }]}>
              <Feather name="check-circle" size={15} color={colors.saveBlue} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{totalCookedMeals}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>meals total</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#4CAF7610", borderColor: "#4CAF7630" }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: "#4CAF7622" }]}>
              <Feather name="calendar" size={15} color="#4CAF76" />
            </View>
            <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{periodMeals}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{mealsLabel}</Text>
          </View>
        </View>

        {/* Meal type filter pills */}
        <View style={styles.mealTypeRow}>
          {MEALS.map((meal) => {
            const isActive = activeMealType === meal;
            const mealColor = MEAL_COLORS[meal];
            return (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.mealTypePill,
                  isActive
                    ? {
                        backgroundColor: mealColor,
                        borderColor: mealColor,
                        shadowColor: mealColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.45,
                        shadowRadius: 8,
                        elevation: 4,
                      }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => { setActiveMealType(isActive ? null : meal); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={{ fontSize: 13 }}>{MEAL_EMOJI[meal]}</Text>
                <Text style={[styles.mealTypePillText, { color: isActive ? "#fff" : colors.textSecondary, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" }]}>{meal}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── DAY VIEW ── */}
        {view === "Day" && (
          <View style={styles.dayView}>
            <Text style={[styles.dayViewTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Today — {DAYS_FULL[todayIndex]}</Text>
            {(activeMealType ? [activeMealType] : MEALS).map((meal) => {
              const recipeId = mealPlan[todayKey]?.[meal];
              const recipe = recipeId ? findRecipe(recipeId) : null;
              const mealColor = MEAL_COLORS[meal];
              return (
                <View key={meal} style={{ borderRadius: 16, overflow: "hidden" }}>
                  {/* Left meal-type accent bar */}
                  <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: mealColor, zIndex: 1 }} />
                  <TouchableOpacity
                    style={[
                      styles.dayMealRow,
                      {
                        backgroundColor: recipe ? MEAL_BG[meal] : colors.card,
                        borderColor: recipe ? mealColor + "50" : colors.border,
                        paddingLeft: 18,
                      },
                    ]}
                    onPress={() => { if (recipe && recipeId) setSelectedMeal({ day: todayKey, meal, recipeId }); }}
                  >
                    <View style={[styles.dayMealIcon, { backgroundColor: mealColor + "20" }]}>
                      <Text style={{ fontSize: 16 }}>{MEAL_EMOJI[meal]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dayMealType, { color: mealColor, fontFamily: "Inter_600SemiBold" }]}>{meal}</Text>
                      {recipe ? (
                        <Text style={[styles.dayMealName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{recipe.title}</Text>
                      ) : (
                        <Text style={[styles.dayMealEmpty, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Cook a meal to fill this slot</Text>
                      )}
                    </View>
                    {recipe && <Text style={[styles.dayMealCals, { color: mealColor, fontFamily: "SpaceGrotesk_700Bold" }]}>{recipe.calories} kcal</Text>}
                    {recipe ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : <Feather name="plus-circle" size={18} color={colors.textMuted} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── WEEK VIEW ── */}
        {view === "Week" && (
          <>
            {isPlanEmpty && (
              <View style={[styles.emptyState, { backgroundColor: colors.primary + "0D", borderColor: colors.primary + "30" }]}>
                <Text style={styles.emptyStateEmoji}>🗓️</Text>
                <Text style={[styles.emptyStateTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Your week is wide open</Text>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  Cook meals and tap <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>Auto-Fill</Text> above — we'll fill in everything you've actually cooked this week.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyStateCTA, { backgroundColor: colors.primary }]}
                  onPress={handleAutoFill}
                  disabled={generating}
                >
                  <Feather name="zap" size={15} color="#fff" />
                  <Text style={[styles.emptyStateCTAText, { fontFamily: "Inter_700Bold" }]}>
                    {generating ? "Filling…" : "Auto-Fill My Week"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!isPlanEmpty && (
              <>
                <View style={styles.grid}>
                  {DAYS_SHORT.map((day, dayIdx) => (
                    <View key={day} style={styles.dayColumn}>
                      <View style={[styles.dayHeader, { backgroundColor: day === todayKey ? colors.primary : "transparent" }]}>
                        <Text style={[styles.dayLabel, { color: day === todayKey ? colors.primaryForeground : colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>{day}</Text>
                        <Text style={[styles.dayDate, { color: day === todayKey ? colors.primaryForeground : colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                          {weekDates[dayIdx]?.getDate()}
                        </Text>
                      </View>
                      {(activeMealType ? [activeMealType] : MEALS).map((meal) => {
                        const recipeId = mealPlan[day]?.[meal];
                        const recipe = recipeId ? findRecipe(recipeId) : null;
                        const mealColor = MEAL_COLORS[meal];
                        return (
                          <TouchableOpacity
                            key={meal}
                            style={[
                              styles.mealCell,
                              recipe
                                ? { backgroundColor: MEAL_BG[meal], borderColor: mealColor + "50", overflow: "hidden" }
                                : { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                            onPress={() => recipe && recipeId ? setSelectedMeal({ day, meal, recipeId }) : undefined}
                            onLongPress={() => recipe ? removeFromPlan(day, meal) : undefined}
                          >
                            {recipe ? (
                              <>
                                {/* Meal-type color accent bar — the signature element */}
                                <View style={[styles.mealCellAccent, { backgroundColor: mealColor }]} />
                                <Text style={{ fontSize: 9, marginTop: 2 }}>{MEAL_EMOJI[meal]}</Text>
                                <Text style={[styles.mealRecipeName, { color: "#1a1a1a", fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>{recipe.title}</Text>
                                <Text style={[styles.mealCalories, { color: mealColor, fontFamily: "SpaceGrotesk_700Bold" }]}>{recipe.calories}</Text>
                              </>
                            ) : (
                              <Feather name="plus" size={14} color={colors.textMuted} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
                <Text style={[styles.gridHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Tap a meal to view · long-press to remove</Text>
              </>
            )}
          </>
        )}

        {/* ── MONTH VIEW ── */}
        {view === "Month" && (
          <View style={styles.monthView}>
            <Text style={[styles.monthTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <View style={styles.monthGrid}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Text key={i} style={[styles.monthDayHeader, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>{d}</Text>
              ))}
              {[...Array(1)].map((_, i) => <View key={`empty-${i}`} style={styles.monthCell} />)}
              {[...Array(30)].map((_, i) => {
                const dayNum = i + 1;
                const dayKey = DAYS_SHORT[i % 7];
                const dayPlan = mealPlan[dayKey];
                const hasMeals = dayPlan && Object.values(dayPlan).some(Boolean);
                const isToday = dayNum === new Date().getDate();
                return (
                  <View key={dayNum} style={[styles.monthCell, isToday && { backgroundColor: colors.primary + "20", borderRadius: 8 }]}>
                    <Text style={[styles.monthDayNum, { color: isToday ? colors.primary : colors.foreground, fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular" }]}>{dayNum}</Text>
                    {hasMeals && <View style={[styles.monthDot, { backgroundColor: colors.primary }]} />}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── PARTY PLANNER CARD ── */}
        <TouchableOpacity
          style={styles.partyCard}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/party-planner"); }}
          activeOpacity={0.88}
        >
          <View style={styles.partyCardIcon}>
            <Text style={{ fontSize: 26 }}>🎉</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.partyCardNewBadge}>
              <Text style={styles.partyCardNewText}>NEW</Text>
            </View>
            <Text style={[styles.partyCardTitle, { fontFamily: "Inter_700Bold" }]}>Party Planner</Text>
            <Text style={[styles.partyCardSub, { fontFamily: "Inter_400Regular" }]}>
              Build a full event menu — starters, mains, desserts & timeline
            </Text>
          </View>
          <View style={styles.partyCardArrow}>
            <Feather name="chevron-right" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Meal Detail Modal ── */}
      <Modal visible={!!selectedMeal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setSelectedMeal(null)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          {selectedRecipe && selectedMeal && (
            <>
              {/* Meal-type accent bar */}
              <View style={[styles.mealDetailAccentBar, { backgroundColor: MEAL_COLORS[selectedMeal.meal] }]} />
              {/* Eyebrow + context */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <View style={[styles.mealDetailEyebrowDot, { backgroundColor: MEAL_COLORS[selectedMeal.meal] }]} />
                <Text style={{ fontSize: 10, letterSpacing: 1, fontFamily: "Inter_600SemiBold", color: MEAL_COLORS[selectedMeal.meal] }}>
                  MEAL PLAN
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <View style={[styles.mealDetailMealBadge, { backgroundColor: MEAL_COLORS[selectedMeal.meal] + "18", borderColor: MEAL_COLORS[selectedMeal.meal] + "40" }]}>
                  <Text style={{ fontSize: 14 }}>{MEAL_EMOJI[selectedMeal.meal]}</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: MEAL_COLORS[selectedMeal.meal] }}>{selectedMeal.meal}</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: "Inter_400Regular" }}>·</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>{selectedMeal.day}</Text>
              </View>
              <Text style={[styles.mealDetailTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{selectedRecipe.title}</Text>
              <View style={styles.mealDetailStats}>
                {[
                  { label: "Calories", value: `${selectedRecipe.calories}`, icon: "zap", color: colors.primary },
                  { label: "Prep", value: `${selectedRecipe.prepTime + selectedRecipe.cookTime}m`, icon: "clock", color: colors.saveBlue },
                  { label: "Servings", value: `${selectedRecipe.servings}`, icon: "users", color: "#4CAF76" },
                ].map((s) => (
                  <View key={s.label} style={[styles.mealDetailStat, { backgroundColor: s.color + "0C", borderColor: s.color + "28" }]}>
                    <View style={[styles.mealDetailStatIcon, { backgroundColor: s.color + "20" }]}>
                      <Feather name={s.icon as any} size={13} color={s.color} />
                    </View>
                    <Text style={[styles.mealDetailStatVal, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{s.value}</Text>
                    <Text style={[styles.mealDetailStatLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.mealDetailBtns}>
                <TouchableOpacity style={[styles.mealDetailBtn, { backgroundColor: colors.muted }]} onPress={() => { if (selectedMeal) removeFromPlan(selectedMeal.day, selectedMeal.meal); setSelectedMeal(null); }}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={[styles.mealDetailBtnText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mealDetailBtn, { backgroundColor: MEAL_COLORS[selectedMeal.meal] }]} onPress={() => { setSelectedMeal(null); router.push(`/recipe/${selectedRecipe.id}`); }}>
                  <Feather name="book-open" size={16} color="#fff" />
                  <Text style={[styles.mealDetailBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>View Recipe</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 26, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2 },
  generateBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100 },
  generateBtnText: { fontSize: 13 },
  noHistoryBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  noHistoryText: { flex: 1, fontSize: 12, lineHeight: 17 },
  viewToggle: { flexDirection: "row", marginHorizontal: 20, borderRadius: 12, padding: 3, marginBottom: 16, borderWidth: 1 },
  viewBtn: { flex: 1, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  viewBtnText: { fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  weekLabel: { fontSize: 14 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  summaryIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 22 },
  summaryLabel: { fontSize: 10, textAlign: "center" },
  budgetBanner: { flexDirection: "row", borderRadius: 12, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  budgetAccent: { width: 4 },
  budgetBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  budgetIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  budgetBannerText: { flex: 1, fontSize: 13 },
  budgetGoalPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  mealTypeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  mealTypePill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  mealTypePillText: { fontSize: 12 },

  emptyState: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: "center", gap: 10, marginBottom: 16 },
  emptyStateEmoji: { fontSize: 44 },
  emptyStateTitle: { fontSize: 20, letterSpacing: -0.3 },
  emptyStateText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  emptyStateCTA: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 100, marginTop: 4 },
  emptyStateCTAText: { color: "#fff", fontSize: 15 },

  grid: { flexDirection: "row", gap: 5, marginBottom: 8 },
  dayColumn: { flex: 1, gap: 4 },
  dayHeader: { borderRadius: 8, paddingVertical: 5, alignItems: "center", marginBottom: 2 },
  dayLabel: { fontSize: 10, textTransform: "uppercase" },
  dayDate: { fontSize: 13, marginTop: 1 },
  mealCell: { height: 72, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 4, gap: 2 },
  mealCellAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  mealRecipeName: { fontSize: 8, textAlign: "center", lineHeight: 11 },
  mealCalories: { fontSize: 8, textAlign: "center" },
  gridHint: { fontSize: 11, textAlign: "center", marginBottom: 16 },

  dayView: { gap: 10, marginBottom: 16 },
  dayViewTitle: { fontSize: 20, marginBottom: 4 },
  dayMealRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  dayMealIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dayMealType: { fontSize: 12 },
  dayMealName: { fontSize: 15 },
  dayMealEmpty: { fontSize: 13 },
  dayMealCals: { fontSize: 13 },

  monthView: { marginBottom: 16 },
  monthTitle: { fontSize: 22, marginBottom: 12 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthDayHeader: { width: "14.28%", textAlign: "center", fontSize: 12, paddingVertical: 6 },
  monthCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  monthDayNum: { fontSize: 13 },
  monthDot: { width: 4, height: 4, borderRadius: 2 },

  partyCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
    backgroundColor: "#1E1535",
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: "#7C3AED40",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  partyCardIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: "#2D1B69",
    alignItems: "center", justifyContent: "center",
  },
  partyCardNewBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#7C3AED",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    marginBottom: 5,
  },
  partyCardNewText: {
    color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8,
  },
  partyCardTitle: { color: "#fff", fontSize: 17, marginBottom: 3 },
  partyCardSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  partyCardArrow: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "#7C3AED",
    alignItems: "center", justifyContent: "center",
  },

  modal: { flex: 1, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  mealDetailAccentBar: { height: 4, borderRadius: 2, width: 48, marginBottom: 16 },
  mealDetailEyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  mealDetailMealBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  mealDetailMealType: { fontSize: 13, marginBottom: 4 },
  mealDetailTitle: { fontSize: 26, letterSpacing: -0.4, marginBottom: 18 },
  mealDetailStats: { flexDirection: "row", gap: 10, marginBottom: 24 },
  mealDetailStat: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  mealDetailStatIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  mealDetailStatVal: { fontSize: 17 },
  mealDetailStatLabel: { fontSize: 11 },
  mealDetailBtns: { flexDirection: "row", gap: 12 },
  mealDetailBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  mealDetailBtnText: { fontSize: 15 },
});
