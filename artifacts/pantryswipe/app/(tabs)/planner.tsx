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

const SAMPLE_PLAN: MealPlan = {
  Mon: { Breakfast: "10", Lunch: "3", Dinner: "1" },
  Tue: { Breakfast: null, Lunch: "5", Dinner: "2" },
  Wed: { Breakfast: "8", Lunch: null, Dinner: "4" },
  Thu: { Breakfast: null, Lunch: "3", Dinner: "6" },
  Fri: { Breakfast: "10", Lunch: "5", Dinner: "7" },
  Sat: { Breakfast: null, Lunch: null, Dinner: "9" },
  Sun: { Breakfast: "8", Lunch: "3", Dinner: "1" },
};

// Get week dates starting from a given offset (0 = current week)
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
  const { pantryItems } = useApp();

  const [view, setView] = useState<ViewType>("Week");
  const [mealPlan, setMealPlan] = useState<MealPlan>(SAMPLE_PLAN);
  const [generating, setGenerating] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<{ day: string; meal: MealType; recipeId: string } | null>(null);
  const [showShoppingList, setShowShoppingList] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const weekDates = getWeekDates(weekOffset);

  // Stats derived from mealPlan
  const { totalCalories, totalMeals, estCost } = useMemo(() => {
    let cals = 0, meals = 0;
    Object.values(mealPlan).forEach((day) => {
      Object.values(day).forEach((id) => {
        if (id) {
          const r = MOCK_RECIPES.find((r) => r.id === id);
          if (r) { cals += r.calories; meals++; }
        }
      });
    });
    return { totalCalories: cals, totalMeals: meals, estCost: Math.round(meals * 4.5) };
  }, [mealPlan]);

  const kcalPerDay = totalMeals > 0 ? Math.round(totalCalories / 7) : 0;

  // Shopping list: ingredients from plan not in pantry
  const shoppingList = useMemo(() => {
    const needed: { name: string; amount: string; recipe: string }[] = [];
    const pantryNames = pantryItems.map((p) => p.name.toLowerCase());
    Object.values(mealPlan).forEach((day) => {
      Object.values(day).forEach((id) => {
        if (id) {
          const r = MOCK_RECIPES.find((r) => r.id === id);
          r?.ingredients.filter((i) => !i.inPantry && !pantryNames.some((p) => p.includes(i.name.toLowerCase()))).forEach((i) => {
            if (!needed.find((n) => n.name === i.name)) {
              needed.push({ name: i.name, amount: i.amount, recipe: r.title });
            }
          });
        }
      });
    });
    return needed;
  }, [mealPlan, pantryItems]);

  const handleGenerate = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGenerating(true);
    setTimeout(() => {
      const shuffled = [...MOCK_RECIPES].sort(() => Math.random() - 0.5);
      const newPlan: MealPlan = {};
      DAYS_SHORT.forEach((day, i) => {
        newPlan[day] = {
          Breakfast: shuffled[(i * 3) % shuffled.length]?.id || null,
          Lunch: shuffled[(i * 3 + 1) % shuffled.length]?.id || null,
          Dinner: shuffled[(i * 3 + 2) % shuffled.length]?.id || null,
        };
      });
      setMealPlan(newPlan);
      setGenerating(false);
    }, 1200);
  };

  const removeFromPlan = (day: string, meal: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMealPlan((prev) => ({ ...prev, [day]: { ...prev[day], [meal]: null } }));
  };

  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const todayKey = DAYS_SHORT[todayIndex] || "Mon";

  const selectedRecipe = selectedMeal ? MOCK_RECIPES.find((r) => r.id === selectedMeal.recipeId) : null;

  const filteredDays = activeMealType ? DAYS_SHORT : DAYS_SHORT;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Meal Planner</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{formatWeekRange(weekDates)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: generating ? colors.muted : colors.primary }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Feather name="zap" size={15} color={generating ? colors.textMuted : colors.primaryForeground} />
          <Text style={[styles.generateBtnText, { color: generating ? colors.textMuted : colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
            {generating ? "Generating…" : "Auto-Fill"}
          </Text>
        </TouchableOpacity>
      </View>

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
          {[
            { icon: "zap", value: `${kcalPerDay}`, label: "kcal/day", color: colors.primary },
            { icon: "dollar-sign", value: `$${estCost}`, label: "est. cost", color: "#00BFA5" },
            { icon: "check-circle", value: `${totalMeals}`, label: "meals planned", color: colors.saveBlue },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={s.icon as any} size={16} color={s.color} />
              <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{s.value}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
            </View>
          ))}
        </View>

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
                <Feather name={MEAL_ICONS[meal] as any} size={13} color={isActive ? colors.primaryForeground : colors.textSecondary} />
                <Text style={[styles.mealTypePillText, { color: isActive ? colors.primaryForeground : colors.textSecondary, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" }]}>{meal}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── DAY VIEW ── */}
        {view === "Day" && (
          <View style={styles.dayView}>
            <Text style={[styles.dayViewTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Today — {DAYS_FULL[todayIndex]}</Text>
            {(activeMealType ? [activeMealType] : MEALS).map((meal) => {
              const recipeId = mealPlan[todayKey]?.[meal];
              const recipe = recipeId ? MOCK_RECIPES.find((r) => r.id === recipeId) : null;
              return (
                <TouchableOpacity
                  key={meal}
                  style={[styles.dayMealRow, { backgroundColor: colors.card, borderColor: recipe ? colors.primary + "50" : colors.border }]}
                  onPress={() => { if (recipe) setSelectedMeal({ day: todayKey, meal, recipeId }); }}
                >
                  <View style={[styles.dayMealIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Feather name={MEAL_ICONS[meal] as any} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayMealType, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{meal}</Text>
                    {recipe ? (
                      <Text style={[styles.dayMealName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{recipe.title}</Text>
                    ) : (
                      <Text style={[styles.dayMealEmpty, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Not planned</Text>
                    )}
                  </View>
                  {recipe && <Text style={[styles.dayMealCals, { color: colors.primary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{recipe.calories} kcal</Text>}
                  {recipe && <Feather name="chevron-right" size={16} color={colors.textMuted} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── WEEK VIEW ── */}
        {view === "Week" && (
          <>
            <View style={styles.grid}>
              {filteredDays.map((day, dayIdx) => (
                <View key={day} style={styles.dayColumn}>
                  <View style={[styles.dayHeader, { backgroundColor: day === todayKey ? colors.primary : "transparent" }]}>
                    <Text style={[styles.dayLabel, { color: day === todayKey ? colors.primaryForeground : colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>{day}</Text>
                    <Text style={[styles.dayDate, { color: day === todayKey ? colors.primaryForeground : colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                      {weekDates[dayIdx]?.getDate()}
                    </Text>
                  </View>
                  {(activeMealType ? [activeMealType] : MEALS).map((meal) => {
                    const recipeId = mealPlan[day]?.[meal];
                    const recipe = recipeId ? MOCK_RECIPES.find((r) => r.id === recipeId) : null;
                    return (
                      <TouchableOpacity
                        key={meal}
                        style={[styles.mealCell, { backgroundColor: recipe ? colors.primary + "12" : colors.card, borderColor: recipe ? colors.primary + "40" : colors.border }]}
                        onPress={() => recipe ? setSelectedMeal({ day, meal, recipeId }) : undefined}
                        onLongPress={() => recipe ? removeFromPlan(day, meal) : undefined}
                      >
                        {recipe ? (
                          <>
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

        {/* ── MONTH VIEW ── */}
        {view === "Month" && (
          <View style={styles.monthView}>
            <Text style={[styles.monthTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>June 2026</Text>
            <View style={styles.monthGrid}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Text key={i} style={[styles.monthDayHeader, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>{d}</Text>
              ))}
              {/* Placeholder offset + days */}
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

        {/* Shopping list CTA */}
        <TouchableOpacity
          style={[styles.shoppingCTA, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowShoppingList(true); }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.shoppingCTATitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Generate Shopping List</Text>
            <Text style={[styles.shoppingCTASub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {shoppingList.length} item{shoppingList.length !== 1 ? "s" : ""} needed from your meal plan
            </Text>
          </View>
          <View style={[styles.shoppingCTABtn, { backgroundColor: colors.primary }]}>
            <Feather name="shopping-cart" size={18} color={colors.primaryForeground} />
          </View>
        </TouchableOpacity>
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
              <Text style={[styles.mealDetailTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>{selectedRecipe.title}</Text>
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

      {/* ── Shopping List Modal ── */}
      <Modal visible={showShoppingList} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowShoppingList(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Shopping List 🛒</Text>
          <Text style={[styles.shoppingSubtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Based on your week plan · {shoppingList.length} items needed
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
            {shoppingList.length === 0 ? (
              <View style={styles.shoppingEmpty}>
                <Text style={{ fontSize: 40 }}>✅</Text>
                <Text style={[styles.shoppingEmptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  You have everything you need!
                </Text>
              </View>
            ) : (
              shoppingList.map((item, i) => (
                <View key={i} style={[styles.shoppingItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.shoppingCheck, { borderColor: colors.border }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shoppingItemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
                    <Text style={[styles.shoppingItemDetail, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.amount} · for {item.recipe}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={[styles.modalBtnFull, { backgroundColor: colors.primary }]} onPress={() => setShowShoppingList(false)}>
            <Text style={[styles.modalBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Done</Text>
          </TouchableOpacity>
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
  summaryLabel: { fontSize: 10 },
  mealTypeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  mealTypePill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  mealTypePillText: { fontSize: 12 },
  grid: { flexDirection: "row", gap: 5, marginBottom: 8 },
  dayColumn: { flex: 1, gap: 4 },
  dayHeader: { borderRadius: 8, paddingVertical: 5, alignItems: "center", marginBottom: 2 },
  dayLabel: { fontSize: 10, textTransform: "uppercase" },
  dayDate: { fontSize: 13, marginTop: 1 },
  mealCell: { height: 68, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 5, gap: 2 },
  mealRecipeName: { fontSize: 8, textAlign: "center", lineHeight: 11 },
  mealCalories: { fontSize: 8, textAlign: "center" },
  gridHint: { fontSize: 11, textAlign: "center", marginBottom: 16 },
  dayView: { gap: 10, marginBottom: 16 },
  dayViewTitle: { fontSize: 20, marginBottom: 4 },
  dayMealRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  dayMealIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dayMealType: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  dayMealName: { fontSize: 15, marginTop: 2 },
  dayMealEmpty: { fontSize: 14, marginTop: 2 },
  dayMealCals: { fontSize: 13 },
  monthView: { gap: 12 },
  monthTitle: { fontSize: 20 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthDayHeader: { width: "14.28%", textAlign: "center", fontSize: 11, paddingVertical: 6 },
  monthCell: { width: "14.28%", alignItems: "center", paddingVertical: 8, gap: 3 },
  monthDayNum: { fontSize: 13 },
  monthDot: { width: 5, height: 5, borderRadius: 2.5 },
  shoppingCTA: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, marginTop: 8 },
  shoppingCTATitle: { fontSize: 15 },
  shoppingCTASub: { fontSize: 13, marginTop: 2 },
  shoppingCTABtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  modal: { flex: 1, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, marginBottom: 4 },
  modalBtnFull: { height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalBtnText: { fontSize: 15 },
  mealDetailMealType: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  mealDetailTitle: { fontSize: 26, letterSpacing: -0.3, marginBottom: 16 },
  mealDetailStats: { flexDirection: "row", gap: 10, marginBottom: 24 },
  mealDetailStat: { flex: 1, alignItems: "center", gap: 4, padding: 12, borderRadius: 12, borderWidth: 1 },
  mealDetailStatVal: { fontSize: 16 },
  mealDetailStatLabel: { fontSize: 11 },
  mealDetailBtns: { flexDirection: "row", gap: 12 },
  mealDetailBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 100 },
  mealDetailBtnText: { fontSize: 15 },
  shoppingSubtitle: { fontSize: 14, marginBottom: 16 },
  shoppingItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  shoppingCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  shoppingItemName: { fontSize: 15 },
  shoppingItemDetail: { fontSize: 13, marginTop: 2 },
  shoppingEmpty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  shoppingEmptyText: { fontSize: 16, textAlign: "center" },
});
