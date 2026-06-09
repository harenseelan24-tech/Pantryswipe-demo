import React, { useState } from "react";
import {
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
import { MOCK_RECIPES } from "@/data/mockData";

type MealType = "Breakfast" | "Lunch" | "Dinner";
type MealPlan = Record<string, Record<MealType, string | null>>;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS: MealType[] = ["Breakfast", "Lunch", "Dinner"];

const SAMPLE_PLAN: MealPlan = {
  Mon: { Breakfast: "10", Lunch: "3", Dinner: "6" },
  Tue: { Breakfast: null, Lunch: "5", Dinner: "1" },
  Wed: { Breakfast: "10", Lunch: null, Dinner: "4" },
  Thu: { Breakfast: null, Lunch: "3", Dinner: "2" },
  Fri: { Breakfast: "8", Lunch: "5", Dinner: "7" },
  Sat: { Breakfast: null, Lunch: null, Dinner: "9" },
  Sun: { Breakfast: "10", Lunch: "3", Dinner: "6" },
};

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"Week" | "Day" | "Month">("Week");
  const [mealPlan, setMealPlan] = useState<MealPlan>(SAMPLE_PLAN);
  const [generating, setGenerating] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const totalCalories = Object.values(mealPlan).reduce((acc, day) => {
    return acc + Object.values(day).reduce((dayAcc, recipeId) => {
      if (!recipeId) return dayAcc;
      const recipe = MOCK_RECIPES.find((r) => r.id === recipeId);
      return dayAcc + (recipe?.calories || 0);
    }, 0);
  }, 0);

  const weekCost = Math.round(totalCalories / 100) * 8;

  const handleGenerate = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGenerating(true);
    setTimeout(() => {
      const shuffled = [...MOCK_RECIPES].sort(() => Math.random() - 0.5);
      const newPlan: MealPlan = {};
      DAYS.forEach((day, i) => {
        newPlan[day] = {
          Breakfast: shuffled[(i * 3) % shuffled.length]?.id || null,
          Lunch: shuffled[(i * 3 + 1) % shuffled.length]?.id || null,
          Dinner: shuffled[(i * 3 + 2) % shuffled.length]?.id || null,
        };
      });
      setMealPlan(newPlan);
      setGenerating(false);
    }, 1500);
  };

  const removeFromPlan = (day: string, meal: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMealPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: null },
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Meal Planner</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>June 2026</Text>
        </View>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.saffron }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Feather name="zap" size={16} color="#fff" />
          <Text style={styles.generateBtnText}>
            {generating ? "Generating..." : "Auto-Generate"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* View toggle */}
      <View style={[styles.viewToggle, { backgroundColor: colors.muted }]}>
        {(["Day", "Week", "Month"] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[
              styles.viewBtn,
              { backgroundColor: view === v ? colors.card : "transparent" },
            ]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.viewBtnText, { color: view === v ? colors.foreground : colors.mutedForeground }]}>
              {v}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Week navigation */}
        <View style={styles.weekNav}>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card }]}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.weekLabel, { color: colors.foreground }]}>Jun 9 – Jun 15, 2026</Text>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card }]}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Plan summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="zap" size={18} color={colors.saffron} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{(totalCalories / 7).toFixed(0)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>kcal/day</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="dollar-sign" size={18} color={colors.secondary} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>${weekCost}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>est. cost</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={18} color={colors.saveBlue} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {Object.values(mealPlan).reduce((acc, day) => acc + Object.values(day).filter(Boolean).length, 0)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>meals planned</Text>
          </View>
        </View>

        {/* Weekly grid */}
        <View style={styles.grid}>
          {DAYS.map((day) => (
            <View key={day} style={styles.dayColumn}>
              <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>{day}</Text>
              {MEALS.map((meal) => {
                const recipeId = mealPlan[day]?.[meal];
                const recipe = recipeId ? MOCK_RECIPES.find((r) => r.id === recipeId) : null;
                return (
                  <TouchableOpacity
                    key={meal}
                    style={[
                      styles.mealCell,
                      {
                        backgroundColor: recipe ? colors.saffron + "12" : colors.card,
                        borderColor: recipe ? colors.saffron + "40" : colors.border,
                      },
                    ]}
                    onLongPress={recipe ? () => removeFromPlan(day, meal) : undefined}
                  >
                    {recipe ? (
                      <>
                        <Text style={[styles.mealRecipeName, { color: colors.foreground }]} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                        <Text style={[styles.mealCalories, { color: colors.saffron }]}>
                          {recipe.calories} kcal
                        </Text>
                      </>
                    ) : (
                      <Feather name="plus" size={16} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Meal type labels */}
        <View style={styles.mealTypeLabels}>
          {MEALS.map((meal) => (
            <View key={meal} style={[styles.mealTypeLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather
                name={meal === "Breakfast" ? "sun" : meal === "Lunch" ? "clock" : "moon"}
                size={14}
                color={colors.mutedForeground}
              />
              <Text style={[styles.mealTypeLabelText, { color: colors.mutedForeground }]}>{meal}</Text>
            </View>
          ))}
        </View>

        {/* Shopping list CTA */}
        <TouchableOpacity style={[styles.shoppingCTA, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shoppingCTATitle, { color: colors.foreground }]}>Generate Shopping List</Text>
            <Text style={[styles.shoppingCTASub, { color: colors.mutedForeground }]}>
              Based on your week plan
            </Text>
          </View>
          <View style={[styles.shoppingCTABtn, { backgroundColor: colors.saffron }]}>
            <Feather name="shopping-cart" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 2 },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
  },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  viewToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  viewBtn: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  viewBtnText: { fontSize: 14, fontWeight: "600" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  weekLabel: { fontSize: 15, fontWeight: "600" },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  summaryValue: { fontSize: 20, fontWeight: "700" },
  summaryLabel: { fontSize: 11 },
  grid: { flexDirection: "row", gap: 6, marginBottom: 12 },
  dayColumn: { flex: 1, gap: 4 },
  dayLabel: { fontSize: 11, fontWeight: "700", textAlign: "center", marginBottom: 4, textTransform: "uppercase" },
  mealCell: {
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    gap: 2,
  },
  mealRecipeName: { fontSize: 9, fontWeight: "600", textAlign: "center", lineHeight: 12 },
  mealCalories: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  mealTypeLabels: { flexDirection: "row", gap: 8, marginBottom: 16 },
  mealTypeLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  mealTypeLabelText: { fontSize: 12, fontWeight: "600" },
  shoppingCTA: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  shoppingCTATitle: { fontSize: 16, fontWeight: "700" },
  shoppingCTASub: { fontSize: 13, marginTop: 2 },
  shoppingCTABtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
