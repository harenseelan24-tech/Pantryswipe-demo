import React, { useState, useRef, useCallback } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import SwipeCard from "@/components/SwipeCard";
import AIChefButton from "@/components/AIChefButton";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_RECIPES, Recipe } from "@/data/mockData";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_HEIGHT = SCREEN_HEIGHT * 0.6;

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, getPantryMatchScore, saveRecipe, pantryItems } = useApp();

  const [recipes, setRecipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const visibleRecipes = recipes.slice(currentIndex, currentIndex + 3);
  const matchCount = MOCK_RECIPES.filter((r) => getPantryMatchScore(r) >= 60).length;

  const handleSwipeLeft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLastAction("Skipped");
    setCurrentIndex((prev) => Math.min(prev + 1, recipes.length));
    setSwipeCount((c) => c + 1);
    setTimeout(() => setLastAction(null), 1500);
  }, [recipes.length]);

  const handleSwipeRight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLastAction("Cooking this!");
    const recipe = recipes[currentIndex];
    if (recipe) router.push(`/recipe/${recipe.id}`);
    setCurrentIndex((prev) => Math.min(prev + 1, recipes.length));
    setSwipeCount((c) => c + 1);
    setTimeout(() => setLastAction(null), 1500);
  }, [recipes, currentIndex, router]);

  const handleSwipeUp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const recipe = recipes[currentIndex];
    if (recipe) saveRecipe(recipe.id);
    setLastAction("Saved!");
    setCurrentIndex((prev) => Math.min(prev + 1, recipes.length));
    setSwipeCount((c) => c + 1);
    setTimeout(() => setLastAction(null), 1500);
  }, [recipes, currentIndex, saveRecipe]);

  const resetCards = () => {
    setCurrentIndex(0);
    setSwipeCount(0);
  };

  const noMoreCards = currentIndex >= recipes.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting}, {userProfile.name}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Discover Recipes</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={20} color={colors.foreground} />
            <View style={[styles.notifDot, { backgroundColor: colors.saffron }]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatar, { backgroundColor: colors.saffron }]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.avatarText}>{userProfile.name[0]?.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {}}
        activeOpacity={0.7}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>
          Ingredient, dish, cuisine, mood...
        </Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActions}
      >
        {[
          { label: "Scan Fridge", icon: "camera" as const, color: colors.saffron },
          { label: "Add Ingredient", icon: "plus-circle" as const, color: colors.secondary },
          { label: "Party Planner", icon: "users" as const, color: colors.saveBlue },
          { label: "Meal Plan", icon: "calendar" as const, color: "#9B6DFF" },
          { label: "Surprise Me", icon: "zap" as const, color: "#E84040" },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[styles.quickActionPill, { backgroundColor: action.color + "15", borderColor: action.color + "30" }]}
            onPress={() => {
              if (action.label === "Party Planner") router.push("/party-planner");
              else if (action.label === "Meal Plan") router.push("/(tabs)/planner");
              else if (action.label === "Surprise Me") resetCards();
            }}
          >
            <Feather name={action.icon} size={15} color={action.color} />
            <Text style={[styles.quickActionText, { color: action.color }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pantry match banner */}
      {pantryItems.length > 0 && (
        <TouchableOpacity style={[styles.matchBanner, { backgroundColor: colors.secondary + "15", borderColor: colors.secondary + "30" }]}>
          <Feather name="check-circle" size={16} color={colors.secondary} />
          <Text style={[styles.matchBannerText, { color: colors.secondary }]}>
            You have {pantryItems.length} ingredients. {matchCount} recipes match right now.
          </Text>
          <Text style={[styles.matchBannerCTA, { color: colors.secondary }]}>View →</Text>
        </TouchableOpacity>
      )}

      {/* Swipe Deck */}
      <View style={[styles.deckContainer, { height: CARD_HEIGHT }]}>
        {noMoreCards ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="coffee" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All caught up!</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add more ingredients to unlock new recipes
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.saffron }]}
              onPress={resetCards}
            >
              <Text style={styles.emptyBtnText}>See Recipes Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          visibleRecipes.map((recipe, i) => (
            <SwipeCard
              key={recipe.id}
              recipe={recipe}
              pantryMatchScore={getPantryMatchScore(recipe)}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onSwipeUp={handleSwipeUp}
              isTop={i === 0}
              index={i}
            />
          )).reverse()
        )}

        {/* Action feedback */}
        {lastAction && (
          <View style={[styles.actionFeedback, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.actionFeedbackText, { color: colors.background }]}>{lastAction}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {!noMoreCards && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.skipBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
            onPress={handleSwipeLeft}
          >
            <Feather name="x" size={26} color={colors.destructive} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.cookBtn, { backgroundColor: colors.saffron }]}
            onPress={handleSwipeRight}
          >
            <Feather name="check" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.saveBtn, { backgroundColor: colors.saveBlue + "15", borderColor: colors.saveBlue + "30" }]}
            onPress={handleSwipeUp}
          >
            <Feather name="bookmark" size={22} color={colors.saveBlue} />
          </TouchableOpacity>
        </View>
      )}

      <AIChefButton />
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
  greeting: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchPlaceholder: { fontSize: 15, flex: 1 },
  quickActions: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 14,
  },
  quickActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
  },
  quickActionText: { fontSize: 13, fontWeight: "600" },
  matchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  matchBannerText: { flex: 1, fontSize: 13, fontWeight: "500" },
  matchBannerCTA: { fontSize: 13, fontWeight: "700" },
  deckContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginHorizontal: 16,
  },
  emptyState: {
    width: SCREEN_WIDTH - 64,
    paddingVertical: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700" },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  actionFeedback: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    zIndex: 999,
  },
  actionFeedbackText: { fontWeight: "700", fontSize: 14 },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 50,
  },
  skipBtn: { width: 56, height: 56, borderRadius: 28 },
  cookBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 0,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtn: { width: 56, height: 56, borderRadius: 28 },
});
