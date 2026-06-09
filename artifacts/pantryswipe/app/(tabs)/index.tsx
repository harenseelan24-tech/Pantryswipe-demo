import React, { useState, useRef, useCallback, useEffect } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MOODS = [
  "✦ Date Night",
  "Family Dinner",
  "Quick Meal",
  "Gym Fuel",
  "Cheat Meal",
  "Party Mode",
  "Meal Prep",
  "Surprise Me",
];

type Particle = {
  id: string;
  emoji: string;
  anim: Animated.ValueXY;
  opacity: Animated.Value;
};

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, getPantryMatchScore, saveRecipe, pantryItems } = useApp();

  const [recipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [deckHeight, setDeckHeight] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [saveToast, setSaveToast] = useState(false);
  const saveToastAnim = useRef(new Animated.Value(0)).current;
  const matchCountAnim = useRef(new Animated.Value(0)).current;
  const [displayMatchCount, setDisplayMatchCount] = useState(0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const visibleRecipes = recipes.slice(currentIndex, currentIndex + 3);
  const matchCount = MOCK_RECIPES.filter((r) => getPantryMatchScore(r) >= 60).length;

  const noMoreCards = currentIndex >= recipes.length;

  useEffect(() => {
    if (matchCount === 0) return;
    matchCountAnim.setValue(0);
    const listener = matchCountAnim.addListener(({ value }) => {
      setDisplayMatchCount(Math.round(value));
    });
    Animated.timing(matchCountAnim, {
      toValue: matchCount,
      duration: 900,
      useNativeDriver: false,
    }).start();
    return () => matchCountAnim.removeListener(listener);
  }, [matchCount]);

  const triggerParticles = useCallback(
    (type: "right" | "left" | "up") => {
      const emojis =
        type === "right"
          ? ["🧄", "🫙", "🥚", "🧅", "🧀", "🍋", "🌿", "🧂"]
          : type === "up"
          ? ["✦", "✦", "✦", "✦", "✦", "✦"]
          : ["●", "●", "●"];

      const newParticles: Particle[] = emojis.map((emoji, i) => {
        const count = emojis.length;
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const distance = 90 + Math.random() * 70;
        const anim = new Animated.ValueXY({ x: 0, y: 0 });
        const opacity = new Animated.Value(1);

        Animated.parallel([
          Animated.timing(anim, {
            toValue: {
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
            },
            duration: 620,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.delay(200),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 420,
              useNativeDriver: false,
            }),
          ]),
        ]).start();

        return { id: `${Date.now()}-${i}`, emoji, anim, opacity };
      });

      setParticles(newParticles);
      setTimeout(() => setParticles([]), 720);
    },
    []
  );

  const showSaveToast = useCallback(() => {
    setSaveToast(true);
    saveToastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(saveToastAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.delay(1200),
      Animated.timing(saveToastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setSaveToast(false));
  }, [saveToastAnim]);

  const handleSwipeLeft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerParticles("left");
    setCurrentIndex((prev) => Math.min(prev + 1, recipes.length));
  }, [recipes.length, triggerParticles]);

  const handleSwipeRight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerParticles("right");
    const recipe = recipes[currentIndex];
    setTimeout(() => {
      if (recipe) router.push(`/recipe/${recipe.id}`);
    }, 350);
    setCurrentIndex((prev) => Math.min(prev + 1, recipes.length));
  }, [recipes, currentIndex, router, triggerParticles]);

  const handleSwipeUp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const recipe = recipes[currentIndex];
    if (recipe) saveRecipe(recipe.id);
    triggerParticles("up");
    showSaveToast();
    setCurrentIndex((prev) => Math.min(prev + 1, recipes.length));
  }, [recipes, currentIndex, saveRecipe, triggerParticles, showSaveToast]);

  const resetCards = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const particleColor =
    particles.length > 0
      ? particles[0].emoji === "●"
        ? "#9E9E9E"
        : particles[0].emoji === "✦"
        ? "#5B8EF5"
        : "#F5A623"
      : "#F5A623";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
            {greeting}, {userProfile.name}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>
            Discover Recipes
          </Text>
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
            <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>
              {userProfile.name[0]?.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        <Feather name="search" size={16} color={colors.textMuted} />
        <Text style={[styles.searchPlaceholder, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          Ingredient, dish, cuisine, mood...
        </Text>
      </TouchableOpacity>

      {/* Mood Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moodStrip}
      >
        {MOODS.map((mood) => {
          const isActive = activeMood === mood;
          return (
            <TouchableOpacity
              key={mood}
              style={[
                styles.moodChip,
                isActive
                  ? { backgroundColor: colors.saffron, borderColor: colors.saffron }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                setActiveMood(isActive ? null : mood);
                if (mood === "Surprise Me") resetCards();
              }}
            >
              <Text
                style={[
                  styles.moodChipText,
                  { color: isActive ? "#0D0B09" : colors.textSecondary, fontFamily: "Inter_500Medium" },
                ]}
              >
                {mood}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pantry match banner */}
      {pantryItems.length > 0 && (
        <View style={[styles.matchBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check-circle" size={14} color={colors.secondary} />
          <Text style={[styles.matchBannerText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
            You can cook{" "}
            <Text style={[styles.matchCount, { color: colors.secondary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
              {displayMatchCount}
            </Text>{" "}
            recipes from your pantry right now
          </Text>
        </View>
      )}

      {/* Swipe Deck */}
      <View
        style={styles.deckContainer}
        onLayout={(e) => setDeckHeight(e.nativeEvent.layout.height)}
      >
        {noMoreCards ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="coffee" size={36} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>
              All caught up!
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              Add more ingredients to unlock new recipes
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.saffron }]}
              onPress={resetCards}
            >
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_700Bold" }]}>See Recipes Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          deckHeight > 0 &&
          visibleRecipes
            .map((recipe, i) => (
              <SwipeCard
                key={recipe.id}
                recipe={recipe}
                pantryMatchScore={getPantryMatchScore(recipe)}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                isTop={i === 0}
                index={i}
                containerHeight={deckHeight}
              />
            ))
            .reverse()
        )}

        {/* Particle burst */}
        {particles.map((p) => (
          <Animated.Text
            key={p.id}
            style={[
              styles.particle,
              {
                color: particleColor,
                transform: [
                  { translateX: p.anim.x },
                  { translateY: p.anim.y },
                ],
                opacity: p.opacity,
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Action Buttons */}
      {!noMoreCards && (
        <View style={styles.actionButtons}>
          {/* Skip */}
          <View style={styles.btnWrapper}>
            <TouchableOpacity
              style={[styles.skipBtn, { backgroundColor: colors.skipRed + "18", borderColor: colors.skipRed + "50" }]}
              onPress={handleSwipeLeft}
            >
              <Feather name="x" size={22} color={colors.skipRed} />
            </TouchableOpacity>
            <Text style={[styles.btnLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>Skip</Text>
          </View>

          {/* Cook This — primary, elevated */}
          <View style={[styles.btnWrapper, styles.cookWrapper]}>
            <TouchableOpacity
              style={[
                styles.cookBtn,
                {
                  backgroundColor: colors.saffron,
                  shadowColor: colors.saffron,
                },
              ]}
              onPress={handleSwipeRight}
            >
              <Feather name="heart" size={26} color="#0D0B09" />
            </TouchableOpacity>
            <Text style={[styles.btnLabel, { color: colors.saffron, fontFamily: "Inter_600SemiBold" }]}>
              Cook This
            </Text>
          </View>

          {/* Save */}
          <View style={styles.btnWrapper}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.saveBlue + "18", borderColor: colors.saveBlue + "50" }]}
              onPress={handleSwipeUp}
            >
              <Feather name="bookmark" size={20} color={colors.saveBlue} />
            </TouchableOpacity>
            <Text style={[styles.btnLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>Save</Text>
          </View>
        </View>
      )}

      {/* Save toast */}
      {saveToast && (
        <Animated.View
          style={[
            styles.saveToast,
            {
              backgroundColor: colors.saveBlue,
              opacity: saveToastAnim,
              transform: [
                {
                  translateY: saveToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.saveToastText, { fontFamily: "Inter_600SemiBold" }]}>Saved for later 🔖</Text>
        </Animated.View>
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
    paddingBottom: 12,
    height: 60 + (Platform.OS === "web" ? 67 : 44),
  },
  greeting: { fontSize: 12, marginBottom: 2 },
  headerTitle: { fontSize: 22, letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#0D0B09", fontSize: 15 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchPlaceholder: { fontSize: 14, flex: 1 },
  moodStrip: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
    height: 48,
    alignItems: "center",
  },
  moodChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  moodChipText: { fontSize: 13 },
  matchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  matchBannerText: { flex: 1, fontSize: 13 },
  matchCount: { fontSize: 15 },
  deckContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptyState: {
    width: SCREEN_WIDTH - 64,
    paddingVertical: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 22 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 100,
    marginTop: 8,
  },
  emptyBtnText: { color: "#0D0B09", fontSize: 15 },
  particle: {
    position: "absolute",
    fontSize: 22,
    zIndex: 999,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 28,
    paddingTop: 6,
    paddingBottom: 14,
    paddingHorizontal: 32,
    height: 80,
  },
  btnWrapper: {
    alignItems: "center",
    gap: 6,
  },
  cookWrapper: {
    transform: [{ translateY: -8 }],
  },
  btnLabel: { fontSize: 11, letterSpacing: 0.2 },
  skipBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  cookBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  saveBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  saveToast: {
    position: "absolute",
    top: Platform.OS === "web" ? 80 : 90,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    zIndex: 9999,
  },
  saveToastText: { color: "#FFFFFF", fontSize: 14 },
});
