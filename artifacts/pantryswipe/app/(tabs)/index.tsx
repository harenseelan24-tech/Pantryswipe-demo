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

// ── Tutorial step definitions ──
const TUTORIAL_STEPS = [
  {
    direction: "left" as const,
    arrow: "←",
    title: "Swipe LEFT to skip",
    subtitle: "Not feeling this one? Swipe left to pass.",
    color: "#EF4444",
    tint: "rgba(239,68,68,0.18)",
    stamp: "NOPE ✗",
    targetX: -260,
    targetY: 0,
  },
  {
    direction: "right" as const,
    arrow: "→",
    title: "Swipe RIGHT to cook",
    subtitle: "Love it? Swipe right to start cooking now.",
    color: "#10B981",
    tint: "rgba(16,185,129,0.18)",
    stamp: "COOK ✓",
    targetX: 260,
    targetY: 0,
  },
  {
    direction: "up" as const,
    arrow: "↑",
    title: "Swipe UP to save",
    subtitle: "Looks great but not now? Save it for later.",
    color: "#5B8EF5",
    tint: "rgba(91,142,245,0.18)",
    stamp: "SAVED 🔖",
    targetX: 0,
    targetY: -300,
  },
] as const;

type Particle = { id: string; emoji: string; anim: Animated.ValueXY; opacity: Animated.Value };

const HEADER_CONTENT_H = 58;
const SEARCH_H = 54;
const MOOD_H = 48;
const BANNER_H = 50;
const TAB_BAR_H = Platform.OS === "web" ? 68 : 60;

export default function HomeScreen() {
  const colors = useColors();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, getPantryMatchScore, saveRecipe, pantryItems, liveRecipes, getPersonalizedRecipes, trackSwipe } = useApp();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const hasBanner = pantryItems.length > 0;

  const HEADER_TOTAL = topPadding + 14 + HEADER_CONTENT_H;
  const deckHeight = Math.max(
    300,
    SCREEN_HEIGHT - HEADER_TOTAL - SEARCH_H - MOOD_H - (hasBanner ? BANNER_H : 0) - TAB_BAR_H - 12
  );

  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>(() => getPersonalizedRecipes(liveRecipes));

  // Keep a stable ref so effects can call the latest version without listing it
  // as a dependency (prevents deck-reset on every trackSwipe call).
  const getPersonalizedRecipesRef = useRef(getPersonalizedRecipes);
  useEffect(() => { getPersonalizedRecipesRef.current = getPersonalizedRecipes; }, [getPersonalizedRecipes]);

  // Reload deck ONLY when the fetched recipe pool changes — NOT on every swipe
  // (learning signal updates getPersonalizedRecipes reference but should not reset the deck mid-session).
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
  const [expiryDismissed, setExpiryDismissed] = useState(false);
  const [showExpiryRecipes, setShowExpiryRecipes] = useState(false);

  // ── Tutorial state ──
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutStep, setTutStep] = useState(0);
  const tutCardX = useRef(new Animated.Value(0)).current;
  const tutCardY = useRef(new Animated.Value(0)).current;
  const tutCardRotate = tutCardX.interpolate({
    inputRange: [-260, 0, 260],
    outputRange: ["-18deg", "0deg", "18deg"],
    extrapolate: "clamp",
  });
  const tutStampOpacity = useRef(new Animated.Value(0)).current;
  const tutLabelOpacity = useRef(new Animated.Value(0)).current;
  const tutOverlayOpacity = useRef(new Animated.Value(0)).current;
  const tutStepRef = useRef(0);
  const tutRunning = useRef(false);

  const saveToastAnim = useRef(new Animated.Value(0)).current;
  const matchCountAnim = useRef(new Animated.Value(0)).current;
  const [displayMatchCount, setDisplayMatchCount] = useState(0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  const visibleRecipes = filteredRecipes.slice(currentIndex, currentIndex + 3);
  const matchCount = filteredRecipes.filter((r) => getPantryMatchScore(r) >= 60).length;
  const expiringItems = pantryItems.filter((i) => i.status === "Expiring" || i.status === "Expired");
  const expiryIngredient = expiringItems[0]?.name ?? "";
  const expiryRecipes = expiryIngredient
    ? liveRecipes
        .filter((r) => r.ingredients.some((ing) => ing.name.toLowerCase().includes(expiryIngredient.toLowerCase())))
        .slice(0, 8)
    : [];
  const noMoreCards = currentIndex >= filteredRecipes.length;

  // ── Check if tutorial has been seen ──
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_SEEN).then((val) => {
      if (!val) {
        setTimeout(() => {
          setShowTutorial(true);
          // useNativeDriver: false required on web — native driver doesn't call
          // .start() callbacks on web, leaving the overlay stuck and blocking swipes.
          Animated.timing(tutOverlayOpacity, { toValue: 1, duration: 350, useNativeDriver: false }).start(() => {
            runTutorialStep(0);
          });
        }, 600);
      }
    });
  }, []);

  const runTutorialStep = (step: number) => {
    if (step >= TUTORIAL_STEPS.length) {
      // All steps done → fade out
      Animated.timing(tutOverlayOpacity, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
        setShowTutorial(false);
        AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_SEEN, "1");
      });
      return;
    }
    tutStepRef.current = step;
    setTutStep(step);
    const { targetX, targetY } = TUTORIAL_STEPS[step];

    // Reset card position
    tutCardX.setValue(0);
    tutCardY.setValue(0);
    tutStampOpacity.setValue(0);
    tutLabelOpacity.setValue(0);

    // Fade in label
    Animated.timing(tutLabelOpacity, { toValue: 1, duration: 280, useNativeDriver: false }).start();

    // Pause then animate card out
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(tutCardX, { toValue: targetX, duration: 520, useNativeDriver: false }),
        Animated.timing(tutCardY, { toValue: targetY, duration: 520, useNativeDriver: false }),
        Animated.timing(tutStampOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start(() => {
        // Pause then go to next step
        setTimeout(() => {
          runTutorialStep(step + 1);
        }, 500);
      });
    }, 900);
  };

  const dismissTutorial = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_SEEN, "1");
    Animated.timing(tutOverlayOpacity, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
      setShowTutorial(false);
    });
  };

  useEffect(() => {
    if (matchCount === 0) return;
    matchCountAnim.setValue(0);
    const listener = matchCountAnim.addListener(({ value }) => setDisplayMatchCount(Math.round(value)));
    Animated.timing(matchCountAnim, { toValue: matchCount, duration: 900, useNativeDriver: false }).start();
    return () => matchCountAnim.removeListener(listener);
  }, [matchCount]);

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
    if (recipe) {
      setPendingSwipeRecipe(recipe);
      setSelectedServings(2);
      setShowServingsModal(true);
    }
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

  // ── Deep-link intent from notifications ──────────────────────────────────────
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
      .map((r) => ({
        label: r.title,
        subtitle: `${r.cuisine} · ${r.calories} kcal`,
        recipeId: r.id,
      }));
  }, [searchQuery, liveRecipes]);

  const currentTutStep = TUTORIAL_STEPS[Math.min(tutStep, TUTORIAL_STEPS.length - 1)];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: topPadding + 6, paddingBottom: 10 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>
            {greeting}, {userProfile.name} 👋
          </Text>
          <BlurText
            key={focusKey}
            text="What are we cooking?"
            delay={120}
            direction="top"
            style={{ fontSize: 22, letterSpacing: -0.4, color: colors.foreground, fontFamily: "Inter_700Bold" }}
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.aiChefBtn} onPress={() => router.push("/ai-chef")}>
            <Text style={{ fontSize: 19 }}>👨‍🍳</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={18} color={colors.primary} />
            {unreadCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => { setSearchQuery(""); setSearchVisible(true); }}
        activeOpacity={0.8}
      >
        <Feather name="search" size={15} color={colors.textMuted} />
        <Text style={[styles.searchPlaceholder, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          Search recipes, ingredients, cuisine…
        </Text>
        <View style={[styles.searchFilterBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}>
          <Feather name="sliders" size={13} color={colors.primary} />
        </View>
      </TouchableOpacity>

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
              style={[
                styles.moodChip,
                isActive
                  ? {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.45,
                      shadowRadius: 8,
                      elevation: 5,
                    }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                if (isActive) { resetCards(); }
                else { setActiveMood(mood.label); applyMood(mood.label); }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text
                style={[
                  styles.moodChipText,
                  { color: isActive ? "#fff" : colors.textSecondary, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" },
                ]}
              >
                {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── MEAL TYPE FILTER — segmented control ── */}
      <View style={[styles.mealTypeSegment, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(["🌅 Breakfast", "☀️ Lunch", "🌙 Dinner"] as const).map((label, idx) => {
          const type = label.split(" ")[1] as "Breakfast" | "Lunch" | "Dinner";
          const isActive = activeMealType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.mealTypeTab,
                isActive && { backgroundColor: colors.primary },
                idx > 0 && { borderLeftWidth: 1, borderLeftColor: isActive ? colors.primary : colors.border },
              ]}
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
              <Text style={[styles.mealTypeTabText, { color: isActive ? "#fff" : colors.textSecondary, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── INGREDIENT FILTER BANNER ── */}
      {activeIngredient && (
        <TouchableOpacity
          style={[styles.ingredientBanner, { backgroundColor: colors.herbGreen + "20", borderColor: colors.herbGreen + "45" }]}
          onPress={resetCards}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15 }}>🌿</Text>
          <Text style={[styles.ingredientBannerText, { color: colors.herbGreen, fontFamily: "Inter_500Medium" }]}>
            Showing recipes with{" "}
            <Text style={{ fontFamily: "Inter_700Bold" }}>{activeIngredient}</Text>
          </Text>
          <Feather name="x" size={14} color={colors.herbGreen} />
        </TouchableOpacity>
      )}

      {/* ── SMART BANNER ── */}
      {!activeIngredient && expiringItems.length > 0 && !expiryDismissed ? (
        <TouchableOpacity
          style={styles.expiryBannerWrap}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExpiryRecipes(true); }}
          activeOpacity={0.85}
        >
          <View style={styles.expiryBannerAccent} />
          <View style={styles.expiryBannerBody}>
            <Text style={{ fontSize: 15 }}>⚠️</Text>
            <Text style={[styles.expiryBannerText, { fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
              <Text style={{ fontFamily: "Inter_600SemiBold", color: "#78480C" }}>{expiringItems[0].name}</Text>
              {expiringItems.length > 1 ? ` +${expiringItems.length - 1} more` : ""}{" "}
              expiring soon — see recipes!
            </Text>
          </View>
          <TouchableOpacity
            style={styles.expiryBannerClose}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpiryDismissed(true); }}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Feather name="x" size={15} color="#92400E" />
          </TouchableOpacity>
        </TouchableOpacity>
      ) : !activeIngredient && hasBanner ? (
        <View style={[styles.matchBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.matchBannerAccent, { backgroundColor: colors.primary }]} />
          <View style={styles.matchBannerBody}>
            <Text style={[styles.matchBannerCount, { color: colors.primary, fontFamily: "SpaceGrotesk_700Bold" }]}>
              {displayMatchCount}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.matchBannerLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                recipes you can cook right now
              </Text>
              <Text style={[styles.matchBannerSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                based on what's in your pantry
              </Text>
            </View>
            <View style={[styles.matchBannerBadge, { backgroundColor: colors.primary + "18" }]}>
              <Text style={{ fontSize: 16 }}>🥘</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ── SWIPE DECK ── */}
      <View style={styles.deckWrapper}>
        {noMoreCards ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48 }}>🍽</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              All caught up!
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {activeMood ? "Try a different mood filter" : "Add more ingredients to unlock recipes"}
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={resetCards}>
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_700Bold" }]}>See All Recipes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.cardStack, { width: CARD_WIDTH, height: deckHeight }]}>
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
                containerHeight={deckHeight + 8}
                programmaticSwipe={i === 0 ? programmaticSwipe : null}
              />
            )).reverse()}
          </View>
        )}

        {/* Particle burst */}
        {particles.map((p) => (
          <Animated.Text
            key={p.id}
            style={[
              styles.particle,
              { transform: [{ translateX: p.anim.x }, { translateY: p.anim.y }], opacity: p.opacity },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* ── SAVE TOAST ── */}
      {saveToast && (
        <Animated.View
          style={[
            styles.saveToast,
            {
              backgroundColor: colors.primary,
              opacity: saveToastAnim,
              transform: [{ translateY: saveToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <Text style={[styles.saveToastText, { fontFamily: "Inter_600SemiBold" }]}>Saved for later 🔖</Text>
        </Animated.View>
      )}

      {/* ── SWIPE TUTORIAL OVERLAY ── */}
      {showTutorial && (
        <Animated.View style={[styles.tutOverlay, { opacity: tutOverlayOpacity }]}>
          {/* Step content */}
          <Animated.View style={[styles.tutContent, { opacity: tutLabelOpacity }]}>
            {/* Big directional arrow */}
            <Text style={[styles.tutArrow, { color: currentTutStep.color }]}>
              {currentTutStep.arrow}
            </Text>

            {/* Title + subtitle */}
            <Text style={styles.tutTitle}>{currentTutStep.title}</Text>
            <Text style={styles.tutSubtitle}>{currentTutStep.subtitle}</Text>

            {/* Progress dots */}
            <View style={styles.tutDots}>
              {TUTORIAL_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tutDot,
                    {
                      backgroundColor: i === tutStep ? currentTutStep.color : "rgba(255,255,255,0.3)",
                      width: i === tutStep ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Animated mini card */}
          <View style={styles.tutCardArea}>
            <Animated.View
              style={[
                styles.tutCard,
                {
                  transform: [
                    { translateX: tutCardX },
                    { translateY: tutCardY },
                    { rotate: tutCardRotate },
                  ],
                },
              ]}
            >
              {/* Card image placeholder */}
              <View style={styles.tutCardImage}>
                <Text style={styles.tutCardEmoji}>🍝</Text>
              </View>
              {/* Card info strip */}
              <View style={styles.tutCardInfo}>
                <Text style={styles.tutCardTitle} numberOfLines={1}>Spaghetti Carbonara</Text>
                <Text style={styles.tutCardMeta}>Italian · 30m · 830 kcal</Text>
              </View>
              {/* Stamp overlay on card */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.tutStampOverlay,
                  { backgroundColor: currentTutStep.tint, opacity: tutStampOpacity },
                ]}
              >
                <Text style={[styles.tutStamp, { color: currentTutStep.color, borderColor: currentTutStep.color }]}>
                  {currentTutStep.stamp}
                </Text>
              </Animated.View>
            </Animated.View>
          </View>

          {/* Skip / Got it button */}
          <TouchableOpacity style={styles.tutSkipBtn} onPress={dismissTutorial}>
            <Text style={styles.tutSkipText}>Got it, let's cook! 🍳</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── EXPIRY RECIPES MODAL ── */}
      <Modal visible={showExpiryRecipes} transparent animationType="slide" onRequestClose={() => setShowExpiryRecipes(false)}>
        <TouchableOpacity style={styles.expiryModalOverlay} activeOpacity={1} onPress={() => setShowExpiryRecipes(false)} />
        <View style={[styles.expiryModalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.expiryModalHandle, { backgroundColor: colors.border }]} />
          {/* Header */}
          <View style={styles.expiryModalHeader}>
            <View>
              <Text style={[styles.expiryModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Use up your {expiryIngredient}
              </Text>
              <Text style={[styles.expiryModalSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                {expiryRecipes.length > 0 ? `${expiryRecipes.length} recipes found` : "No matching recipes yet"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.expiryModalCloseBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowExpiryRecipes(false)}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {expiryRecipes.length === 0 ? (
            <View style={styles.expiryModalEmpty}>
              <Text style={{ fontSize: 40 }}>🤷</Text>
              <Text style={[styles.expiryModalEmptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                No recipes found for {expiryIngredient}.{"\n"}Try adding more pantry items!
              </Text>
            </View>
          ) : (
            <FlatList
              data={expiryRecipes}
              keyExtractor={(r) => r.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.expiryModalList}
              renderItem={({ item }) => {
                const match = getPantryMatchScore(item);
                return (
                  <TouchableOpacity
                    style={[styles.expiryRecipeRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => { setShowExpiryRecipes(false); router.push(`/recipe/${item.id}`); }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.expiryRecipeEmoji}>
                      <Text style={{ fontSize: 28 }}>🍽️</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.expiryRecipeName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.expiryRecipeMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                        {item.cuisine} · {item.prepTime + item.cookTime}m · {item.calories} kcal
                      </Text>
                    </View>
                    <View style={[styles.expiryMatchPill, { backgroundColor: match >= 60 ? "#4CAF7620" : colors.border }]}>
                      <Text style={[styles.expiryMatchText, { color: match >= 60 ? "#4CAF76" : colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                        {match}%
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* ── SEARCH MODAL ── */}
      <Modal
        visible={searchVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSearchVisible(false)}
      >
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.searchModalBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={18} color={colors.primary} />
              <TextInput
                style={[styles.searchModalInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="Search recipes…"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              <TouchableOpacity onPress={() => setSearchVisible(false)}>
                <Text style={[styles.searchCancelText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            {searchQuery.length === 0 ? (
              <View style={styles.searchSuggestions}>
                <Text style={[styles.searchHintText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                  Try "carbonara", "salmon", "quick" or any ingredient
                </Text>
                <View style={styles.searchTags}>
                  {["🍝 Pasta", "🐟 Seafood", "🥗 Vegan", "⚡ Quick", "💪 High Protein"].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.searchTag, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => setSearchQuery(tag.replace(/^\S+\s/, ""))}
                    >
                      <Text style={[styles.searchTagText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                        {tag}
                      </Text>
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
                    <Text style={[styles.noResultsText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      No recipes found for "{searchQuery}"
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.searchResultRow, { borderBottomColor: colors.border }]}
                    onPress={() => { setSearchVisible(false); router.push(`/recipe/${item.recipeId}`); }}
                  >
                    <View style={[styles.searchResultIcon, { backgroundColor: colors.card }]}>
                      <Feather name="book-open" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.searchResultTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.searchResultSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Feather name="arrow-right" size={16} color={colors.textMuted} />
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
          <View style={[styles.servingsSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.servingsHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.servingsTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              How many people? 👨‍🍳
            </Text>
            <Text style={[styles.servingsSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
              {pendingSwipeRecipe?.title}
            </Text>
            <View style={styles.servingsBtnRow}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => {
                const active = selectedServings === n && !customServingMode;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.servingsNumBtn, {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedServings(n); setCustomServingMode(false); }}
                  >
                    <Text style={[styles.servingsNumText, { color: active ? "#fff" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.servingsNumBtn, {
                  backgroundColor: customServingMode ? colors.primary : colors.card,
                  borderColor: customServingMode ? colors.primary : colors.border,
                  flexDirection: "row", width: "auto" as any, paddingHorizontal: 14, gap: 5,
                }]}
                onPress={() => { setCustomServingMode(true); setCustomServingInput(""); }}
              >
                <Feather name="edit-2" size={14} color={customServingMode ? "#fff" : colors.textMuted} />
                <Text style={[styles.servingsNumText, { color: customServingMode ? "#fff" : colors.textMuted }]}>
                  {customServingMode && customServingInput ? customServingInput : "Custom"}
                </Text>
              </TouchableOpacity>
            </View>
            {customServingMode && (
              <TextInput
                style={[styles.servingsCustomInput, { backgroundColor: colors.card, borderColor: colors.primary, color: colors.foreground }]}
                value={customServingInput}
                onChangeText={setCustomServingInput}
                keyboardType="number-pad"
                placeholder="Enter number of servings…"
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => { const n = parseInt(customServingInput, 10); if (!isNaN(n) && n > 0) setSelectedServings(Math.min(n, 99)); }}
                onBlur={() => { const n = parseInt(customServingInput, 10); if (!isNaN(n) && n > 0) setSelectedServings(Math.min(n, 99)); }}
              />
            )}
            <TouchableOpacity
              style={[styles.servingsCookBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowServingsModal(false);
                setCustomServingMode(false);
                if (pendingSwipeRecipe) {
                  router.push(`/recipe/${pendingSwipeRecipe.id}?servings=${selectedServings}&mealType=${activeMealType ?? "Dinner"}`);
                }
              }}
            >
              <Text style={[styles.servingsCookBtnText, { fontFamily: "Inter_700Bold" }]}>
                Let's Cook! 🍳
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: "center" }}
              onPress={() => setShowServingsModal(false)}
            >
              <Text style={[{ fontSize: 14, fontFamily: "Inter_400Regular" }, { color: colors.textMuted }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  greeting: { fontSize: 12, marginBottom: 2 },
  headerTitle: { fontSize: 22, letterSpacing: -0.4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiChefBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#F5A623",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 10, elevation: 6,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  notifDot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
  },
  notifBadge: {
    position: "absolute", top: 5, right: 5,
    minWidth: 17, height: 17, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 14 },

  // ── Search ──
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, paddingHorizontal: 16,
    height: 48, borderRadius: 100, borderWidth: 1, marginBottom: 8,
  },
  searchPlaceholder: { fontSize: 13, flex: 1 },
  searchFilterBadge: {
    width: 28, height: 28, borderRadius: 100, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  // ── Mood chips ──
  moodScrollView: { height: 48, flexGrow: 0, flexShrink: 0 },
  moodStrip: { paddingHorizontal: 16, gap: 8, alignItems: "center", height: 48 },
  moodChip: {
    height: 34, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  moodChipText: { fontSize: 13 },

  // ── Meal type — segmented control ──
  mealTypeSegment: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  mealTypeTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10,
  },
  mealTypeTabEmoji: { fontSize: 14 },
  mealTypeTabText: { fontSize: 12 },

  // ── Servings modal ──
  servingsOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  servingsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  servingsHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  servingsTitle: { fontSize: 24, letterSpacing: -0.3, marginBottom: 6, textAlign: "center" },
  servingsSub: { fontSize: 14, textAlign: "center", marginBottom: 24 },
  servingsBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24, justifyContent: "center" },
  servingsNumBtn: { width: 56, height: 56, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  servingsNumText: { fontSize: 20 },
  servingsCookBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 4 },
  servingsCookBtnText: { fontSize: 16, color: "#fff" },
  servingsCustomInput: {
    height: 50, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 16, fontSize: 17, fontFamily: "Inter_500Medium", marginBottom: 12,
  },

  // ── Ingredient filter banner ──
  ingredientBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  ingredientBannerText: { flex: 1, fontSize: 13 },

  // ── Expiry banner ──
  expiryBannerWrap: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, overflow: "hidden",
    backgroundColor: "#FFF8EB", borderWidth: 1, borderColor: "#FDE68A",
  },
  expiryBannerAccent: { width: 4, alignSelf: "stretch", backgroundColor: "#F59E0B" },
  expiryBannerBody: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 12, paddingVertical: 11,
  },
  expiryBannerText: { flex: 1, fontSize: 13, color: "#78480C" },
  expiryBannerClose: {
    paddingHorizontal: 12, paddingVertical: 11, alignItems: "center", justifyContent: "center",
  },

  // ── Expiry recipes modal ──
  expiryModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  expiryModalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16, maxHeight: "72%",
  },
  expiryModalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  expiryModalHeader: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16,
  },
  expiryModalTitle: { fontSize: 20, letterSpacing: -0.3 },
  expiryModalSub: { fontSize: 13, marginTop: 3 },
  expiryModalCloseBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  expiryModalEmpty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  expiryModalEmptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  expiryModalList: { gap: 10, paddingBottom: 40 },
  expiryRecipeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  expiryRecipeEmoji: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: "#F5A62315", alignItems: "center", justifyContent: "center",
  },
  expiryRecipeName: { fontSize: 15 },
  expiryRecipeMeta: { fontSize: 12 },
  expiryMatchPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  expiryMatchText: { fontSize: 12 },

  // ── Pantry match banner — bold stat card ──
  matchBanner: {
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  matchBannerAccent: { height: 3, width: "100%" },
  matchBannerBody: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  matchBannerCount: { fontSize: 36, lineHeight: 40, letterSpacing: -1 },
  matchBannerLabel: { fontSize: 13, marginBottom: 2 },
  matchBannerSub: { fontSize: 11 },
  matchBannerBadge: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  // ── Deck ──
  deckWrapper: { alignItems: "center", position: "relative", flex: 1 },
  cardStack: { position: "relative" },
  emptyState: {
    width: SCREEN_WIDTH - 64,
    paddingVertical: 48, paddingHorizontal: 32,
    borderRadius: 24, borderWidth: 1,
    alignItems: "center", gap: 12, marginTop: 32,
  },
  emptyTitle: { fontSize: 20 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 6 },
  emptyBtnText: { color: "#fff", fontSize: 15 },
  particle: { position: "absolute", fontSize: 22, zIndex: 999 },

  // ── Save toast ──
  saveToast: {
    position: "absolute",
    top: Platform.OS === "web" ? 80 : 90,
    alignSelf: "center",
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 100, zIndex: 9999,
  },
  saveToastText: { color: "#fff", fontSize: 14 },

  // ── Tutorial overlay ──
  tutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 14, 10, 0.92)",
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 0,
  },
  tutContent: {
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  tutArrow: {
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    lineHeight: 72,
  },
  tutTitle: {
    fontSize: 22,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  tutSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
    marginTop: 2,
  },
  tutDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginTop: 8,
  },
  tutDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tutCardArea: {
    width: SCREEN_WIDTH - 80,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 32,
  },
  tutCard: {
    width: SCREEN_WIDTH - 100,
    height: 210,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1C1410",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  tutCardImage: {
    height: 120,
    backgroundColor: "#241A12",
    alignItems: "center",
    justifyContent: "center",
  },
  tutCardEmoji: { fontSize: 56 },
  tutCardInfo: {
    flex: 1,
    backgroundColor: "#1C1410",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  tutCardTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  tutCardMeta: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tutStampOverlay: {
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tutStamp: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    borderWidth: 2.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    letterSpacing: 2,
    overflow: "hidden",
  },
  tutSkipBtn: {
    backgroundColor: "#F5A623",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 100,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  tutSkipText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },

  // ── Search Modal ──
  searchModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  searchModalContainer: {
    flex: 1,
    marginTop: Platform.OS === "web" ? 60 : 80,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: "hidden",
  },
  searchModalBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, paddingHorizontal: 14, height: 48,
    borderRadius: 14, borderWidth: 1,
  },
  searchModalInput: { flex: 1, fontSize: 16 },
  searchCancelText: { fontSize: 15 },
  searchSuggestions: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  searchHintText: { fontSize: 14 },
  searchTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  searchTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  searchTagText: { fontSize: 13 },
  searchResultRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  searchResultIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  searchResultTitle: { fontSize: 15, marginBottom: 2 },
  searchResultSub: { fontSize: 13 },
  noResults: { paddingTop: 40, alignItems: "center" },
  noResultsText: { fontSize: 15 },
});
