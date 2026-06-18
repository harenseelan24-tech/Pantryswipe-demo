import React, { useState, useMemo } from "react";
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
  const { cookedRecipes, cookingHistory, liveRecipes, userProfile } = useApp();

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

  const { cookedKcalPerDay, totalCookedMeals } = useMemo(() => {
    let cals = 0;
    cookedRecipes.forEach((id) => {
      const r = findRecipe(id);
      if (r) cals += r.calories;
    });
    return {
      cookedKcalPerDay: cookedRecipes.length > 0 ? Math.round(cals / 7) : 0,
      totalCookedMeals: cookedRecipes.length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookedRecipes, liveRecipes]);

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
          <Text style={[styles.headerSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{formatWeekRange(weekDates)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: generating ? colors.muted : colors.primary }]}
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
        <View style={styles.weekNav}>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setWeekOffset((w) => w - 1)}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.weekLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{formatWeekRange(weekDates)}</Text>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setWeekOffset((w) => w + 1)}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="zap" size={16} color={colors.primary} />
            <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
              {cookedKcalPerDay > 0 ? cookedKcalPerDay : "—"}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>kcal/day</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={16} color={colors.saveBlue} />
            <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{totalCookedMeals}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>meals cooked</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={16} color={colors.herbGreen || "#4CAF76"} />
            <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{plannedCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>this week</Text>
          </View>
        </View>

        {/* Budget awareness banner */}
        {userProfile.weeklyBudget > 0 && (
          <View style={[styles.budgetBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="dollar-sign" size={14} color={colors.primary} />
            <Text style={[styles.budgetBannerText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Weekly grocery budget:{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>
                ${userProfile.weeklyBudget}
              </Text>
            </Text>
            {userProfile.goal ? (
              <View style={[styles.budgetGoalPill, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 }]}>
                  Goal: {userProfile.goal}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Meal type filter pills */}
        <View style={styles.mealTypeRow}>
          {MEALS.map((meal) => {
            const isActive = activeMealType === meal;
            return (
              <TouchableOpacity
                key={meal}
                style={[styles.mealTypePill, { backgroundColor: isActive ? colors.primary : colors.card, borderColor: isActive ? colors.primary : colors.border }]}
                onPress={() => { setActiveMealType(isActive ? null : meal); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={{ fontSize: 13 }}>{MEAL_EMOJI[meal]}</Text>
                <Text style={[styles.mealTypePillText, { color: isActive ? colors.primaryForeground : colors.textSecondary, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" }]}>{meal}</Text>
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
              return (
                <TouchableOpacity
                  key={meal}
                  style={[styles.dayMealRow, { backgroundColor: colors.card, borderColor: recipe ? colors.primary + "50" : colors.border }]}
                  onPress={() => { if (recipe && recipeId) setSelectedMeal({ day: todayKey, meal, recipeId }); }}
                >
                  <View style={[styles.dayMealIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={{ fontSize: 16 }}>{MEAL_EMOJI[meal]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayMealType, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{meal}</Text>
                    {recipe ? (
                      <Text style={[styles.dayMealName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{recipe.title}</Text>
                    ) : (
                      <Text style={[styles.dayMealEmpty, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Cook a meal to fill this slot</Text>
                    )}
                  </View>
                  {recipe && <Text style={[styles.dayMealCals, { color: colors.primary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{recipe.calories} kcal</Text>}
                  {recipe ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : <Feather name="plus-circle" size={18} color={colors.textMuted} />}
                </TouchableOpacity>
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
                        return (
                          <TouchableOpacity
                            key={meal}
                            style={[styles.mealCell, { backgroundColor: recipe ? colors.primary + "12" : colors.card, borderColor: recipe ? colors.primary + "40" : colors.border }]}
                            onPress={() => recipe && recipeId ? setSelectedMeal({ day, meal, recipeId }) : undefined}
                            onLongPress={() => recipe ? removeFromPlan(day, meal) : undefined}
                          >
                            {recipe ? (
                              <>
                                <Text style={{ fontSize: 10 }}>{MEAL_EMOJI[meal]}</Text>
                                <Text style={[styles.mealRecipeName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>{recipe.title}</Text>
                                <Text style={[styles.mealCalories, { color: colors.primary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{recipe.calories}</Text>
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
      </ScrollView>

      {/* ── Meal Detail Modal ── */}
      <Modal visible={!!selectedMeal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setSelectedMeal(null)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          {selectedRecipe && (
            <>
              <Text style={[styles.mealDetailMealType, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                {selectedMeal?.meal} · {selectedMeal?.day}
              </Text>
              <Text style={[styles.mealDetailTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{selectedRecipe.title}</Text>
              <View style={styles.mealDetailStats}>
                {[
                  { label: "Calories", value: `${selectedRecipe.calories}`, icon: "zap" },
                  { label: "Prep", value: `${selectedRecipe.prepTime + selectedRecipe.cookTime}m`, icon: "clock" },
                  { label: "Servings", value: `${selectedRecipe.servings}`, icon: "users" },
                ].map((s) => (
                  <View key={s.label} style={[styles.mealDetailStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name={s.icon as any} size={14} color={colors.primary} />
                    <Text style={[styles.mealDetailStatVal, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{s.value}</Text>
                    <Text style={[styles.mealDetailStatLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.mealDetailBtns}>
                <TouchableOpacity style={[styles.mealDetailBtn, { backgroundColor: colors.muted }]} onPress={() => { if (selectedMeal) removeFromPlan(selectedMeal.day, selectedMeal.meal); setSelectedMeal(null); }}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={[styles.mealDetailBtnText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mealDetailBtn, { backgroundColor: colors.primary }]} onPress={() => { setSelectedMeal(null); router.push(`/recipe/${selectedRecipe.id}`); }}>
                  <Feather name="book-open" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.mealDetailBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>View Recipe</Text>
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
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 3 },
  summaryValue: { fontSize: 18 },
  summaryLabel: { fontSize: 10, textAlign: "center" },
  budgetBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, flexWrap: "wrap" },
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

  modal: { flex: 1, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  mealDetailMealType: { fontSize: 13, marginBottom: 4 },
  mealDetailTitle: { fontSize: 26, letterSpacing: -0.4, marginBottom: 18 },
  mealDetailStats: { flexDirection: "row", gap: 10, marginBottom: 24 },
  mealDetailStat: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  mealDetailStatVal: { fontSize: 17 },
  mealDetailStatLabel: { fontSize: 11 },
  mealDetailBtns: { flexDirection: "row", gap: 12 },
  mealDetailBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  mealDetailBtnText: { fontSize: 15 },
});
