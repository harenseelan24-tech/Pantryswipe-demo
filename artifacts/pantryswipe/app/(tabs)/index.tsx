import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import SwipeCard from "@/components/SwipeCard";
import { BlurText } from "@/components/BlurText";
import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/hooks/useNotifications";
import { useApp } from "@/context/AppContext";
import { Recipe } from "@/data/mockData";
import { STORAGE_KEYS } from "@/constants/storageKeys";

// ── Brand palette ─────────────────────────────────────────────────────────────
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
  ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24 },
  android: { elevation: 8 },
  web:     { boxShadow: "0 12px 24px rgba(0,0,0,0.18)" },
});
const navShadow = Platform.select({
  ios:     { shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 24 },
  android: { elevation: 12 },
  web:     { boxShadow: "0 -8px 24px rgba(131,85,0,0.08)" },
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const INTENT_KEY = STORAGE_KEYS.PENDING_INTENT;
const CARD_WIDTH = SCREEN_WIDTH - 16;

const MOODS = [
  { label: "🍽️ Just Me", filter: (r: Recipe) => r.eventTypes?.includes("just-me") || r.prepTime + r.cookTime <= 25 },
  { label: "💑 Date Night", filter: (r: Recipe) => r.eventTypes?.includes("date-night") || (r.rating >= 4.8 && r.difficulty !== "Easy") },
  { label: "👨‍👩‍👧 Family", filter: (r: Recipe) => r.eventTypes?.includes("family-dinner") || r.servings >= 3 },
  { label: "👯 Friends", filter: (r: Recipe) => r.eventTypes?.includes("friends") || r.servings >= 4 },
  { label: "🎬 Movie Night", filter: (r: Recipe) => r.eventTypes?.includes("movie-night") || r.prepTime + r.cookTime <= 20 },
  { label: "🏈 Watch Party", filter: (r: Recipe) => r.eventTypes?.includes("watch-party") || r.tags.includes("party") },
  { label: "🎂 Birthday", filter: (r: Recipe) => r.eventTypes?.includes("birthday") || r.rating >= 4.9 },
  { label: "🥗 Meal Prep", filter: (r: Recipe) => r.eventTypes?.includes("meal-prep") || r.tags.includes("meal-prep") },
  { label: "🌅 Brunch", filter: (r: Recipe) => r.eventTypes?.includes("brunch") || r.tags.includes("breakfast") },
  { label: "💪 Gym Fuel", filter: (r: Recipe) => r.nutrition.protein >= 30 },
  { label: "⚡ Quick", filter: (r: Recipe) => r.prepTime + r.cookTime <= 20 },
  { label: "🎲 Surprise", filter: (_r: Recipe) => Math.random() > 0.4 },
];

const SEARCH_VARIANTS: { label: string; subtitle: string; recipeId: string }[] = [
  { label: "Spaghetti Carbonara", subtitle: "Classic Roman · 830 kcal", recipeId: "1" },
  { label: "Garlic Butter Salmon", subtitle: "Mediterranean · 660 kcal", recipeId: "2" },
  { label: "Buddha Bowl", subtitle: "Vegan · 720 kcal", recipeId: "3" },
  { label: "Beef Bibimbap", subtitle: "Korean · 760 kcal", recipeId: "4" },
  { label: "Avocado Toast", subtitle: "Breakfast · 720 kcal", recipeId: "5" },
  { label: "Chicken Tikka Masala", subtitle: "Indian · 540 kcal", recipeId: "6" },
  { label: "Tacos al Pastor", subtitle: "Mexican · 450 kcal", recipeId: "7" },
  { label: "Beef Ramen", subtitle: "Japanese · 580 kcal", recipeId: "9" },
  { label: "Overnight Oats", subtitle: "Meal prep · 430 kcal", recipeId: "10" },
];

const MEAL_TYPE_FILTERS: Record<string, (r: Recipe) => boolean> = {
  Breakfast: (r) => r.calories < 500 || r.tags.some((t) => ["breakfast", "brunch", "morning", "oats", "eggs"].includes(t.toLowerCase())),
  Lunch: (r) => r.tags.some((t) => ["lunch", "salad", "sandwich", "soup", "light", "bowl"].includes(t.toLowerCase())) || (r.calories >= 300 && r.calories <= 700),
  Dinner: (r) => r.calories > 500 || r.tags.some((t) => ["dinner", "main", "supper", "hearty", "pasta", "steak"].includes(t.toLowerCase())),
};

const TUTORIAL_STEPS = [
  { direction: "left" as const, arrow: "←", title: "Swipe LEFT to skip", subtitle: "Not feeling this one? Swipe left to pass.", color: "#EF4444", tint: "rgba(239,68,68,0.18)", stamp: "NOPE ✗", targetX: -260, targetY: 0 },
  { direction: "right" as const, arrow: "→", title: "Swipe RIGHT to cook", subtitle: "Love it? Swipe right to start cooking now.", color: "#10B981", tint: "rgba(16,185,129,0.18)", stamp: "COOK ✓", targetX: 260, targetY: 0 },
  { direction: "up" as const, arrow: "↑", title: "Swipe UP to save", subtitle: "Looks great but not now? Save it for later.", color: "#5B8EF5", tint: "rgba(91,142,245,0.18)", stamp: "SAVED 🔖", targetX: 0, targetY: -300 },
] as const;

type Particle = { id: string; emoji: string; anim: Animated.ValueXY; opacity: Animated.Value };

const HEADER_CONTENT_H = 58;
const SEARCH_H = 54;
const MOOD_H = 48;
const TAB_BAR_H = Platform.OS === "web" ? 68 : 60;

export default function HomeScreen() {
  const colors = useColors();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, getPantryMatchScore, saveRecipe, pantryItems, liveRecipes, getPersonalizedRecipes, trackSwipe } = useApp();

  const topPadding   = Platform.OS === "web" ? 67 : insets.top;
  const HEADER_TOTAL  = topPadding - 8 + HEADER_CONTENT_H + 10; // sit closer to DI safe boundary
  const MEAL_SEG_H   = 54; // mealTypeSegment with its marginBottom
  const SWIPE_INST_H = 28; // swipe instruction row
  const deckHeight = Math.max(280, SCREEN_HEIGHT - HEADER_TOTAL - SEARCH_H - MOOD_H - MEAL_SEG_H - SWIPE_INST_H - TAB_BAR_H - 4);

  // ── Reanimated pulse for swipe instruction ──────────────────────────────────
  const pulseOpacity = useSharedValue(0.4);
  useEffect(() => {
    pulseOpacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  // ── State (all preserved from original) ─────────────────────────────────────
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>(() => getPersonalizedRecipes(liveRecipes));
  const getPersonalizedRecipesRef = useRef(getPersonalizedRecipes);
  useEffect(() => { getPersonalizedRecipesRef.current = getPersonalizedRecipes; }, [getPersonalizedRecipes]);

  useEffect(() => {
    if (!activeMood) {
      setFilteredRecipes(getPersonalizedRecipesRef.current(liveRecipes));
      setCurrentIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRecipes]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [saveToast, setSaveToast] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMealType, setActiveMealType] = useState<"Breakfast" | "Lunch" | "Dinner" | null>(null);
  const [activeIngredient, setActiveIngredient] = useState<string | null>(null);
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [pendingSwipeRecipe, setPendingSwipeRecipe] = useState<Recipe | null>(null);
  const [selectedServings, setSelectedServings] = useState(2);
  const [customServingMode, setCustomServingMode] = useState(false);
  const [customServingInput, setCustomServingInput] = useState("");
  const [programmaticSwipe, setProgrammaticSwipe] = useState<"left" | "right" | "up" | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [deckH, setDeckH] = useState(0);

  // ── Tutorial state ──────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutStep, setTutStep] = useState(0);
  const tutCardX = useRef(new Animated.Value(0)).current;
  const tutCardY = useRef(new Animated.Value(0)).current;
  const tutCardRotate = tutCardX.interpolate({ inputRange: [-260, 0, 260], outputRange: ["-18deg", "0deg", "18deg"], extrapolate: "clamp" });
  const tutStampOpacity = useRef(new Animated.Value(0)).current;
  const tutLabelOpacity = useRef(new Animated.Value(0)).current;
  const tutOverlayOpacity = useRef(new Animated.Value(0)).current;
  const tutStepRef = useRef(0);
  const tutRunning = useRef(false);

  const saveToastAnim = useRef(new Animated.Value(0)).current;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  const visibleRecipes = filteredRecipes.slice(currentIndex, currentIndex + 3);
  const matchCount = filteredRecipes.filter((r) => getPantryMatchScore(r) >= 60).length;
  const expiringItems = pantryItems.filter((i) => i.status === "Expiring" || i.status === "Expired");
  const noMoreCards = currentIndex >= filteredRecipes.length;

  // ── Tutorial logic (verbatim) ───────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_SEEN).then((val) => {
      if (!val) {
        setTimeout(() => {
          setShowTutorial(true);
          Animated.timing(tutOverlayOpacity, { toValue: 1, duration: 350, useNativeDriver: false }).start(() => {
            runTutorialStep(0);
          });
        }, 600);
      }
    });
  }, []);

  const runTutorialStep = (step: number) => {
    if (step >= TUTORIAL_STEPS.length) {
      Animated.timing(tutOverlayOpacity, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
        setShowTutorial(false);
        AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_SEEN, "1");
      });
      return;
    }
    tutStepRef.current = step;
    setTutStep(step);
    const { targetX, targetY } = TUTORIAL_STEPS[step];
    tutCardX.setValue(0);
    tutCardY.setValue(0);
    tutStampOpacity.setValue(0);
    tutLabelOpacity.setValue(0);
    Animated.timing(tutLabelOpacity, { toValue: 1, duration: 280, useNativeDriver: false }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(tutCardX, { toValue: targetX, duration: 520, useNativeDriver: false }),
        Animated.timing(tutCardY, { toValue: targetY, duration: 520, useNativeDriver: false }),
        Animated.timing(tutStampOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start(() => {
        setTimeout(() => { runTutorialStep(step + 1); }, 500);
      });
    }, 900);
  };

  const dismissTutorial = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_SEEN, "1");
    Animated.timing(tutOverlayOpacity, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
      setShowTutorial(false);
    });
  };

  // ── Handlers (all verbatim) ─────────────────────────────────────────────────
  const applyMood = useCallback((mood: string) => {
    const moodObj = MOODS.find((m) => m.label === mood);
    if (!moodObj) return;
    const personalized = getPersonalizedRecipes(liveRecipes);
    const filtered = personalized.filter(moodObj.filter);
    setFilteredRecipes(filtered.length > 0 ? filtered : personalized);
    setCurrentIndex(0);
  }, [liveRecipes, getPersonalizedRecipes]);

  const triggerParticles = useCallback((type: "right" | "left" | "up") => {
    const emojis =
      type === "right" ? ["🧄", "🫙", "🥚", "🧅", "🧀", "🍋", "🌿", "🧂"]
        : type === "up" ? ["✦", "✦", "✦", "✦", "✦", "✦"]
          : ["●", "●", "●"];
    const newParticles: Particle[] = emojis.map((emoji, i) => {
      const angle = (i / emojis.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const distance = 90 + Math.random() * 70;
      const anim = new Animated.ValueXY({ x: 0, y: 0 });
      const opacity = new Animated.Value(1);
      Animated.parallel([
        Animated.timing(anim, { toValue: { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }, duration: 620, useNativeDriver: false }),
        Animated.sequence([Animated.delay(200), Animated.timing(opacity, { toValue: 0, duration: 420, useNativeDriver: false })]),
      ]).start();
      return { id: `${Date.now()}-${i}`, emoji, anim, opacity };
    });
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 720);
  }, []);

  const showSaveToast = useCallback(() => {
    setSaveToast(true);
    saveToastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(saveToastAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
      Animated.delay(1200),
      Animated.timing(saveToastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setSaveToast(false));
  }, [saveToastAnim]);

  const handleSwipeLeft = useCallback(() => {
    setProgrammaticSwipe(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerParticles("left");
    const recipe = filteredRecipes[currentIndex];
    if (recipe) trackSwipe(recipe, "left");
    setCurrentIndex((prev) => Math.min(prev + 1, filteredRecipes.length));
  }, [filteredRecipes, currentIndex, triggerParticles, trackSwipe]);

  const handleSwipeRight = useCallback(() => {
    setProgrammaticSwipe(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerParticles("right");
    const recipe = filteredRecipes[currentIndex];
    if (recipe) trackSwipe(recipe, "right");
    setCurrentIndex((prev) => Math.min(prev + 1, filteredRecipes.length));
    if (recipe) { setPendingSwipeRecipe(recipe); setSelectedServings(2); setShowServingsModal(true); }
  }, [filteredRecipes, currentIndex, triggerParticles, trackSwipe]);

  const handleSwipeUp = useCallback(() => {
    setProgrammaticSwipe(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const recipe = filteredRecipes[currentIndex];
    if (recipe) { saveRecipe(recipe.id); trackSwipe(recipe, "up"); }
    triggerParticles("up");
    showSaveToast();
    setCurrentIndex((prev) => Math.min(prev + 1, filteredRecipes.length));
  }, [filteredRecipes, currentIndex, saveRecipe, trackSwipe, triggerParticles, showSaveToast]);

  useFocusEffect(
    useCallback(() => {
      const applyIntent = async () => {
        try {
          const raw = await AsyncStorage.getItem(INTENT_KEY);
          if (!raw) return;
          await AsyncStorage.removeItem(INTENT_KEY);
          const intent = JSON.parse(raw) as { type: string; value: string };
          if (intent.type === "mealType") {
            const mealType = intent.value as "Breakfast" | "Lunch" | "Dinner";
            const f = MEAL_TYPE_FILTERS[mealType];
            const personalized = getPersonalizedRecipes(liveRecipes);
            const r = personalized.filter(f);
            setActiveMealType(mealType);
            setActiveMood(null);
            setActiveIngredient(null);
            setFilteredRecipes(r.length >= 3 ? r : personalized);
            setCurrentIndex(0);
          } else if (intent.type === "ingredient") {
            const ing = intent.value.toLowerCase();
            const personalized = getPersonalizedRecipes(liveRecipes);
            const r = personalized.filter((recipe) =>
              recipe.ingredients.some((i) => i.name.toLowerCase().includes(ing)) ||
              recipe.title.toLowerCase().includes(ing) ||
              recipe.tags.some((t) => t.toLowerCase().includes(ing))
            );
            setActiveIngredient(intent.value);
            setActiveMealType(null);
            setActiveMood(null);
            setFilteredRecipes(r.length >= 2 ? r : personalized);
            setCurrentIndex(0);
          }
        } catch {}
      };
      applyIntent();
      setFocusKey((k) => k + 1);
    }, [liveRecipes])
  );

  const resetCards = useCallback(() => {
    setFilteredRecipes(getPersonalizedRecipes(liveRecipes));
    setCurrentIndex(0);
    setActiveMood(null);
    setActiveMealType(null);
    setActiveIngredient(null);
  }, [liveRecipes, getPersonalizedRecipes]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return liveRecipes
      .filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))
      )
      .slice(0, 20)
      .map((r) => ({ label: r.title, subtitle: `${r.cuisine} · ${r.calories} kcal`, recipeId: r.id }));
  }, [searchQuery, liveRecipes]);

  const currentTutStep = TUTORIAL_STEPS[Math.min(tutStep, TUTORIAL_STEPS.length - 1)];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: topPadding - 8 }]}>
        <View>
          <Text style={styles.greeting}>
            {greeting}, {userProfile.name} 👋
          </Text>
          <BlurText
            key={focusKey}
            text="What are we cooking?"
            delay={120}
            direction="top"
            style={{ fontSize: 26, letterSpacing: -0.5, color: C.textPrimary, fontFamily: "Epilogue_700Bold" }}
          />
          {matchCount > 0 && (
            <View style={styles.pantryMatchLine}>
              <Feather name="check-circle" size={11} color={C.secondary} />
              <Text style={styles.pantryMatchText}>{matchCount} match your pantry</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.aiChefBtn} onPress={() => router.push("/ai-chef")}>
            <Text style={{ fontSize: 19 }}>👨‍🍳</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={20} color={C.textMuted} />
            {(unreadCount + expiringItems.length) > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {(unreadCount + expiringItems.length) > 9 ? "9+" : unreadCount + expiringItems.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => { setSearchQuery(""); setSearchVisible(true); }}
        activeOpacity={0.8}
      >
        <Feather name="search" size={20} color="#857462" />
        <Text style={styles.searchPlaceholder}>
          Search recipes, ingredients, cuisine…
        </Text>
        <View style={styles.searchFilterBtn}>
          <Feather name="sliders" size={18} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* ── ACTIVE FILTER BREADCRUMB ── */}
      {(activeMood || activeMealType || activeIngredient) && (
        <TouchableOpacity style={styles.activeFilterPill} onPress={resetCards} activeOpacity={0.8}>
          <Feather name="filter" size={11} color={C.primary} />
          <Text style={styles.activeFilterText} numberOfLines={1}>
            {activeMood ?? activeMealType ?? activeIngredient}
          </Text>
          <View style={styles.activeFilterX}>
            <Feather name="x" size={11} color={C.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── OCCASION CHIPS ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.moodScrollView}
        contentContainerStyle={styles.moodStrip}
      >
        {MOODS.map((mood) => {
          const isActive = activeMood === mood.label;
          return (
            <TouchableOpacity
              key={mood.label}
              style={[styles.moodChip, isActive ? styles.moodChipActive : styles.moodChipInactive]}
              onPress={() => {
                if (isActive) { resetCards(); }
                else { setActiveMood(mood.label); applyMood(mood.label); }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[styles.moodChipText, isActive ? styles.moodChipTextActive : styles.moodChipTextInactive]}>
                {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── MEAL TYPE TABS ── */}
      <View style={styles.mealTypeSegment}>
        {(["🌅 Breakfast", "☀️ Lunch", "🌙 Dinner"] as const).map((label, idx) => {
          const type = label.split(" ")[1] as "Breakfast" | "Lunch" | "Dinner";
          const isActive = activeMealType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.mealTypeTab, isActive ? styles.mealTypeTabActive : styles.mealTypeTabInactive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const next = isActive ? null : type;
                setActiveMealType(next);
                setActiveMood(null);
                setActiveIngredient(null);
                if (next) {
                  const f = MEAL_TYPE_FILTERS[next];
                  const r = liveRecipes.filter(f);
                  setFilteredRecipes(r.length >= 3 ? r : liveRecipes);
                } else {
                  setFilteredRecipes(liveRecipes);
                }
                setCurrentIndex(0);
              }}
            >
              <Text style={[styles.mealTypeTabEmoji, { opacity: isActive ? 1 : 0.7 }]}>{label.split(" ")[0]}</Text>
              <Text style={[styles.mealTypeTabText, isActive ? styles.mealTypeTabTextActive : styles.mealTypeTabTextInactive]}>
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── SWIPE DECK ── */}
      <View
        style={styles.deckWrapper}
        onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 50) setDeckH(h); }}
      >
        {noMoreCards ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🍽</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>
              {activeMood ? "Try a different mood filter" : "Add more ingredients to unlock recipes"}
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={resetCards}>
              <Text style={styles.emptyBtnText}>See All Recipes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.cardStack, { width: CARD_WIDTH, height: deckH || deckHeight }]}>
            {visibleRecipes.map((recipe, i) => (
              <SwipeCard
                key={recipe.id}
                recipe={recipe}
                pantryMatchScore={getPantryMatchScore(recipe)}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                isTop={i === 0}
                index={i}
                containerHeight={(deckH || deckHeight) + 8}
                programmaticSwipe={i === 0 ? programmaticSwipe : null}
              />
            )).reverse()}
          </View>
        )}

        {/* Particle burst */}
        {particles.map((p) => (
          <Animated.Text
            key={p.id}
            style={[styles.particle, { transform: [{ translateX: p.anim.x }, { translateY: p.anim.y }], opacity: p.opacity }]}
          >
            {p.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* ── SWIPE INSTRUCTION ── */}
      {!noMoreCards && (
        <Reanimated.View style={[styles.swipeInstruction, pulseStyle]}>
          <View style={styles.swipeHintRow}>
            <View style={[styles.swipeHintChip, { backgroundColor: "rgba(232,64,64,0.10)" }]}>
              <Text style={[styles.swipeHintArrow, { color: C.danger }]}>←</Text>
              <Text style={[styles.swipeHintLabel, { color: C.danger }]}>Skip</Text>
            </View>
            <View style={[styles.swipeHintChip, { backgroundColor: "rgba(76,175,118,0.10)" }]}>
              <Text style={[styles.swipeHintArrow, { color: C.secondary }]}>→</Text>
              <Text style={[styles.swipeHintLabel, { color: C.secondary }]}>Cook</Text>
            </View>
            <View style={[styles.swipeHintChip, { backgroundColor: "rgba(91,142,245,0.10)" }]}>
              <Text style={[styles.swipeHintArrow, { color: C.saveBlue }]}>↑</Text>
              <Text style={[styles.swipeHintLabel, { color: C.saveBlue }]}>Save</Text>
            </View>
          </View>
        </Reanimated.View>
      )}

      {/* ── SAVE TOAST ── */}
      {saveToast && (
        <Animated.View
          style={[
            styles.saveToast,
            {
              opacity: saveToastAnim,
              transform: [{ translateY: saveToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <Text style={styles.saveToastText}>Saved for later 🔖</Text>
        </Animated.View>
      )}

      {/* ── SWIPE TUTORIAL OVERLAY ── */}
      {showTutorial && (
        <Animated.View style={[styles.tutOverlay, { opacity: tutOverlayOpacity }]}>
          <Animated.View style={[styles.tutContent, { opacity: tutLabelOpacity }]}>
            <Text style={[styles.tutArrow, { color: currentTutStep.color }]}>{currentTutStep.arrow}</Text>
            <Text style={styles.tutTitle}>{currentTutStep.title}</Text>
            <Text style={styles.tutSubtitle}>{currentTutStep.subtitle}</Text>
            <View style={styles.tutDots}>
              {TUTORIAL_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.tutDot, { backgroundColor: i === tutStep ? currentTutStep.color : "rgba(255,255,255,0.3)", width: i === tutStep ? 20 : 8 }]}
                />
              ))}
            </View>
          </Animated.View>
          <View style={styles.tutCardArea}>
            <Animated.View
              style={[styles.tutCard, { transform: [{ translateX: tutCardX }, { translateY: tutCardY }, { rotate: tutCardRotate }] }]}
            >
              <View style={styles.tutCardImage}>
                <Text style={styles.tutCardEmoji}>🍝</Text>
              </View>
              <View style={styles.tutCardInfo}>
                <Text style={styles.tutCardTitle} numberOfLines={1}>Spaghetti Carbonara</Text>
                <Text style={styles.tutCardMeta}>Italian · 30m · 830 kcal</Text>
              </View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.tutStampOverlay, { backgroundColor: currentTutStep.tint, opacity: tutStampOpacity }]}>
                <Text style={[styles.tutStamp, { color: currentTutStep.color, borderColor: currentTutStep.color }]}>{currentTutStep.stamp}</Text>
              </Animated.View>
            </Animated.View>
          </View>
          <TouchableOpacity style={styles.tutSkipBtn} onPress={dismissTutorial}>
            <Text style={styles.tutSkipText}>Got it, let's cook! 🍳</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── SEARCH MODAL ── */}
      <Modal visible={searchVisible} animationType="slide" transparent onRequestClose={() => setSearchVisible(false)}>
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModalContainer, { backgroundColor: C.background }]}>
            <View style={styles.searchModalBar}>
              <Feather name="search" size={18} color={C.primary} />
              <TextInput
                style={styles.searchModalInput}
                placeholder="Search recipes…"
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              <TouchableOpacity onPress={() => setSearchVisible(false)}>
                <Text style={styles.searchCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            {searchQuery.length === 0 ? (
              <View style={styles.searchSuggestions}>
                <Text style={styles.searchHintText}>Try "carbonara", "salmon", "quick" or any ingredient</Text>
                <View style={styles.searchTags}>
                  {["🍝 Pasta", "🐟 Seafood", "🥗 Vegan", "⚡ Quick", "💪 High Protein"].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.searchTag}
                      onPress={() => setSearchQuery(tag.replace(/^\S+\s/, ""))}
                    >
                      <Text style={styles.searchTagText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>No recipes found for "{searchQuery}"</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultRow}
                    onPress={() => { setSearchVisible(false); router.push(`/recipe/${item.recipeId}`); }}
                  >
                    <View style={styles.searchResultIcon}>
                      <Feather name="book-open" size={16} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultTitle}>{item.label}</Text>
                      <Text style={styles.searchResultSub}>{item.subtitle}</Text>
                    </View>
                    <Feather name="arrow-right" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── SERVINGS PICKER MODAL ── */}
      <Modal visible={showServingsModal} transparent animationType="slide" onRequestClose={() => setShowServingsModal(false)}>
        <View style={styles.servingsOverlay}>
          <View style={[styles.servingsSheet, { backgroundColor: C.background }]}>
            <View style={styles.servingsHandle} />
            <Text style={styles.servingsTitle}>How many people? 👨‍🍳</Text>
            <Text style={styles.servingsSub} numberOfLines={1}>{pendingSwipeRecipe?.title}</Text>
            <View style={styles.servingsBtnRow}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => {
                const active = selectedServings === n && !customServingMode;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.servingsNumBtn, { backgroundColor: active ? C.primary : C.surface, borderColor: active ? C.primary : C.outlineVariant }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedServings(n); setCustomServingMode(false); }}
                  >
                    <Text style={[styles.servingsNumText, { color: active ? "#fff" : C.textPrimary, fontFamily: active ? "Epilogue_700Bold" : "Epilogue_400Regular" }]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.servingsNumBtn, {
                  backgroundColor: customServingMode ? C.primary : C.surface,
                  borderColor: customServingMode ? C.primary : C.outlineVariant,
                  flexDirection: "row", width: "auto" as any, paddingHorizontal: 14, gap: 5,
                }]}
                onPress={() => { setCustomServingMode(true); setCustomServingInput(""); }}
              >
                <Feather name="edit-2" size={14} color={customServingMode ? "#fff" : C.textMuted} />
                <Text style={[styles.servingsNumText, { color: customServingMode ? "#fff" : C.textMuted }]}>
                  {customServingMode && customServingInput ? customServingInput : "Custom"}
                </Text>
              </TouchableOpacity>
            </View>
            {customServingMode && (
              <TextInput
                style={[styles.servingsCustomInput, { backgroundColor: C.surface, borderColor: C.primary, color: C.textPrimary }]}
                value={customServingInput}
                onChangeText={setCustomServingInput}
                keyboardType="number-pad"
                placeholder="Enter number of servings…"
                placeholderTextColor={C.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => { const n = parseInt(customServingInput, 10); if (!isNaN(n) && n > 0) setSelectedServings(Math.min(n, 99)); }}
                onBlur={() => { const n = parseInt(customServingInput, 10); if (!isNaN(n) && n > 0) setSelectedServings(Math.min(n, 99)); }}
              />
            )}
            <TouchableOpacity
              style={styles.servingsCookBtn}
              onPress={() => {
                setShowServingsModal(false);
                setCustomServingMode(false);
                if (pendingSwipeRecipe) {
                  router.push(`/recipe/${pendingSwipeRecipe.id}?servings=${selectedServings}&mealType=${activeMealType ?? "Dinner"}`);
                }
              }}
            >
              <Text style={styles.servingsCookBtnText}>Let's Cook! 🍳</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.servingsSkipBtn} onPress={() => setShowServingsModal(false)}>
              <Text style={styles.servingsSkipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 },
  greeting:    { fontSize: 14, fontFamily: "Epilogue_400Regular", color: C.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiChefBtn:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38, shadowRadius: 10, elevation: 6 },
  iconBtn:     { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceLow, position: "relative" },
  notifBadge:  { position: "absolute", top: 5, right: 5, minWidth: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, backgroundColor: C.danger, borderWidth: 2, borderColor: C.background },
  notifBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Epilogue_700Bold" },

  // Search bar
  searchBar:          { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: C.surfaceLow, borderRadius: 999, borderWidth: 1, borderColor: "rgba(215,195,174,0.3)", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchPlaceholder:  { flex: 1, fontSize: 16, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  searchFilterBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },

  // Mood chips
  moodScrollView: { height: 48, flexGrow: 0, flexShrink: 0 },
  moodStrip:      { paddingHorizontal: 16, gap: 10, alignItems: "center", height: 48 },
  moodChip:       { height: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center", minHeight: 44 },
  moodChipActive: { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  moodChipInactive: { backgroundColor: C.surfaceHighest },
  moodChipText:     { fontSize: 13 },
  moodChipTextActive:   { fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },
  moodChipTextInactive: { fontFamily: "Epilogue_400Regular", color: C.textMuted },

  // Meal type segmented control
  mealTypeSegment:     { flexDirection: "row", marginHorizontal: 16, marginBottom: 6, backgroundColor: C.surfaceHighest, borderRadius: 999, padding: 4 },
  mealTypeTab:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 999, minHeight: 44 },
  mealTypeTabActive:   { backgroundColor: C.surface, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  mealTypeTabInactive: {},
  mealTypeTabEmoji:    { fontSize: 14 },
  mealTypeTabText:     { fontSize: 13 },
  mealTypeTabTextActive:   { fontFamily: "Epilogue_700Bold", color: C.primary },
  mealTypeTabTextInactive: { fontFamily: "Epilogue_400Regular", color: C.textMuted },

  // Deck
  deckWrapper: { alignItems: "center", position: "relative", flex: 1 },
  cardStack:   { position: "relative" },
  emptyState:  { width: SCREEN_WIDTH - 64, paddingVertical: 48, paddingHorizontal: 32, borderRadius: 24, borderWidth: 1, alignItems: "center", gap: 12, marginTop: 32, backgroundColor: C.surface, borderColor: C.outlineVariant },
  emptyTitle:  { fontSize: 20, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  emptyText:   { fontSize: 14, textAlign: "center", lineHeight: 20, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  emptyBtn:    { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 6, backgroundColor: C.primary, minHeight: 44 },
  emptyBtnText:{ color: "#fff", fontSize: 15, fontFamily: "Epilogue_700Bold" },
  particle:    { position: "absolute", fontSize: 22, zIndex: 999 },

  // Pantry match context
  pantryMatchLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  pantryMatchText: { fontSize: 12, color: C.secondary, fontFamily: "Epilogue_700Bold" },

  // Active filter breadcrumb pill
  activeFilterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 16, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: C.surfaceLow, borderRadius: 100,
    borderWidth: 1, borderColor: C.primary + "44",
    alignSelf: "flex-start",
  },
  activeFilterText: {
    fontSize: 13, fontFamily: "Epilogue_700Bold",
    color: C.primary, maxWidth: 220,
  },
  activeFilterX: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.surfaceHighest,
    alignItems: "center", justifyContent: "center",
  },

  // Swipe instruction chips
  swipeInstruction: { paddingHorizontal: 16, paddingVertical: 6, alignItems: "center" },
  swipeHintRow:  { flexDirection: "row", gap: 8, alignItems: "center" },
  swipeHintChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100 },
  swipeHintArrow: { fontSize: 15, fontFamily: "Epilogue_700Bold" },
  swipeHintLabel: { fontSize: 12, fontFamily: "Epilogue_700Bold" },

  // Save toast
  saveToast:     { position: "absolute", top: Platform.OS === "web" ? 80 : 90, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, zIndex: 9999, backgroundColor: C.primary },
  saveToastText: { color: "#fff", fontSize: 14, fontFamily: "Epilogue_700Bold" },

  // Tutorial overlay (unchanged visuals, updated fonts)
  tutOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20, 14, 10, 0.92)", zIndex: 1000, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  tutContent:     { alignItems: "center", gap: 10, marginBottom: 28 },
  tutArrow:       { fontSize: 64, fontFamily: "Epilogue_700Bold", lineHeight: 72 },
  tutTitle:       { fontSize: 22, color: "#fff", fontFamily: "Epilogue_700Bold", textAlign: "center", letterSpacing: -0.3 },
  tutSubtitle:    { fontSize: 14, color: "rgba(255,255,255,0.65)", fontFamily: "Epilogue_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 240, marginTop: 2 },
  tutDots:        { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 8 },
  tutDot:         { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" },
  tutCardArea:    { width: SCREEN_WIDTH - 80, height: 220, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 32 },
  tutCard:        { width: SCREEN_WIDTH - 100, height: 210, borderRadius: 20, overflow: "hidden", backgroundColor: "#1C1410", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  tutCardImage:   { height: 120, backgroundColor: "#241A12", alignItems: "center", justifyContent: "center" },
  tutCardEmoji:   { fontSize: 56 },
  tutCardInfo:    { flex: 1, backgroundColor: "#1C1410", paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  tutCardTitle:   { color: "#fff", fontSize: 16, fontFamily: "Epilogue_700Bold" },
  tutCardMeta:    { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Epilogue_400Regular" },
  tutStampOverlay:{ borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tutStamp:       { fontSize: 18, fontFamily: "Epilogue_700Bold", borderWidth: 2.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, letterSpacing: 2, overflow: "hidden" },
  tutSkipBtn:     { backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 100, minHeight: 44, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  tutSkipText:    { color: "#fff", fontSize: 16, fontFamily: "Epilogue_700Bold" },

  // Search modal
  searchModalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  searchModalContainer: { flex: 1, marginTop: Platform.OS === "web" ? 60 : 80, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  searchModalBar:       { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, paddingHorizontal: 14, height: 48, borderRadius: 14, borderWidth: 1, backgroundColor: C.surfaceLow, borderColor: C.outlineVariant },
  searchModalInput:     { flex: 1, fontSize: 16, color: C.textPrimary, fontFamily: "Epilogue_400Regular" },
  searchCancelText:     { fontSize: 15, color: C.primary, fontFamily: "Epilogue_700Bold" },
  searchSuggestions:    { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  searchHintText:       { fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  searchTags:           { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  searchTag:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, backgroundColor: C.surfaceLow, borderColor: C.outlineVariant, minHeight: 44, justifyContent: "center" },
  searchTagText:        { fontSize: 13, color: C.textPrimary, fontFamily: "Epilogue_400Regular" },
  searchResultRow:      { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.surfaceHigh, minHeight: 44 },
  searchResultIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceLow },
  searchResultTitle:    { fontSize: 15, marginBottom: 2, color: C.textPrimary, fontFamily: "Epilogue_700Bold" },
  searchResultSub:      { fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  noResults:            { paddingTop: 40, alignItems: "center" },
  noResultsText:        { fontSize: 15, color: C.textMuted, fontFamily: "Epilogue_400Regular" },

  // Servings modal
  servingsOverlay:     { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  servingsSheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  servingsHandle:      { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20, backgroundColor: C.outlineVariant },
  servingsTitle:       { fontSize: 24, letterSpacing: -0.3, marginBottom: 6, textAlign: "center", fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  servingsSub:         { fontSize: 14, textAlign: "center", marginBottom: 24, color: C.textMuted, fontFamily: "Epilogue_400Regular" },
  servingsBtnRow:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24, justifyContent: "center" },
  servingsNumBtn:      { width: 56, height: 56, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  servingsNumText:     { fontSize: 20 },
  servingsCookBtn:     { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 4, backgroundColor: C.primary, minHeight: 44 },
  servingsCookBtnText: { fontSize: 16, color: "#fff", fontFamily: "Epilogue_700Bold" },
  servingsSkipBtn:     { paddingVertical: 12, alignItems: "center" },
  servingsSkipText:    { fontSize: 14, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  servingsCustomInput: { height: 50, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 17, fontFamily: "Epilogue_400Regular", marginBottom: 12 },
});
