import React, { useRef, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Recipe } from "@/data/mockData";
import { useApp } from "@/context/AppContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.26;
const SWIPE_UP_THRESHOLD = -70;
const MAX_ROTATION = 12;
const CARD_BASE_WIDTH = SCREEN_WIDTH - 16;

const RECIPE_IMAGES: Record<string, ReturnType<typeof require>> = {
  "recipe-pasta": require("@/assets/images/recipe-pasta.png"),
  "recipe-salmon": require("@/assets/images/recipe-salmon.png"),
  "recipe-bowl": require("@/assets/images/recipe-bowl.png"),
  "recipe-bibimbap": require("@/assets/images/recipe-bibimbap.png"),
};

const CUISINE_FLAGS: Record<string, string> = {
  Italian: "🇮🇹", Japanese: "🇯🇵", Korean: "🇰🇷", Mexican: "🇲🇽",
  Indian: "🇮🇳", Chinese: "🇨🇳", Thai: "🇹🇭", American: "🇺🇸",
  French: "🇫🇷", Mediterranean: "🌊", "Middle Eastern": "🌙", Vietnamese: "🇻🇳",
  Singaporean: "🇸🇬",
};

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", "Middle Eastern": "🧆", Vietnamese: "🍜",
  Singaporean: "🦀",
};

interface SwipeCardProps {
  recipe: Recipe;
  pantryMatchScore: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  isTop: boolean;
  index: number;
  containerHeight: number;
  programmaticSwipe?: "left" | "right" | "up" | null;
}

export default function SwipeCard({
  recipe,
  pantryMatchScore,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  isTop,
  index,
  containerHeight,
  programmaticSwipe,
}: SwipeCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const cardHeight = containerHeight > 0 ? containerHeight - 8 : SCREEN_HEIGHT * 0.62;

  // Mirror dynamic props into refs so the frozen PanResponder closure always reads live values
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;
  const onSwipeUpRef = useRef(onSwipeUp);
  onSwipeUpRef.current = onSwipeUp;

  // ── Programmatic swipe (for action buttons on web) ──────────────────────────
  useEffect(() => {
    if (!programmaticSwipe || !isTopRef.current) return;
    const targets = {
      left:  { x: -SCREEN_WIDTH * 1.5, y: 0 },
      right: { x:  SCREEN_WIDTH * 1.5, y: 0 },
      up:    { x: 0, y: -SCREEN_HEIGHT * 1.2 },
    };
    Animated.timing(pan, {
      toValue: targets[programmaticSwipe],
      duration: programmaticSwipe === "up" ? 260 : 240,
      useNativeDriver: false,
    }).start(() => {
      if (programmaticSwipe === "left")  onSwipeLeftRef.current();
      else if (programmaticSwipe === "right") onSwipeRightRef.current();
      else if (programmaticSwipe === "up")   onSwipeUpRef.current();
    });
  // Only fire when programmaticSwipe value changes to a non-null direction
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmaticSwipe]);

  // Image section = top 58%, info section = bottom 42%
  const imageSectionH = cardHeight * 0.58;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [`-${MAX_ROTATION}deg`, "0deg", `${MAX_ROTATION}deg`],
    extrapolate: "clamp",
  });

  // Simplified: 3 overlay opacities (one per direction)
  const cookOpacity = pan.x.interpolate({
    inputRange: [20, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = pan.x.interpolate({
    inputRange: [-70, -20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const saveOpacity = pan.y.interpolate({
    inputRange: [-100, -25],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTopRef.current,
      onMoveShouldSetPanResponder: (_, gs) =>
        isTopRef.current && (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5),
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        if (gs.vx > 0.5 || gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: SCREEN_WIDTH * 1.5, y: gs.dy * 1.2 },
            duration: 240,
            useNativeDriver: false,
          }).start(() => onSwipeRightRef.current());
        } else if (gs.vx < -0.5 || gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: -SCREEN_WIDTH * 1.5, y: gs.dy * 1.2 },
            duration: 240,
            useNativeDriver: false,
          }).start(() => onSwipeLeftRef.current());
        } else if (gs.vy < -0.5 || gs.dy < SWIPE_UP_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: gs.dx, y: -SCREEN_HEIGHT },
            duration: 260,
            useNativeDriver: false,
          }).start(() => onSwipeUpRef.current());
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 50,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 7,
          tension: 50,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const stackScale = index === 0 ? 1 : index === 1 ? 0.94 : 0.88;
  const stackOffsetY = index === 0 ? 0 : index === 1 ? 10 : 22;
  const cardOpacity = index === 0 ? 1 : index === 1 ? 0.75 : 0.45;
  const stackWidthReduction = index === 0 ? 0 : index === 1 ? 20 : 36;
  const cardWidth = CARD_BASE_WIDTH - stackWidthReduction;

  const { getIngredientMatches } = useApp();
  const enrichedIngredients = getIngredientMatches(recipe);
  const matchedCount = enrichedIngredients.filter((i) => i.inPantry).length;
  const missingCount = enrichedIngredients.filter((i) => !i.inPantry).length;

  const difficultyColor =
    recipe.difficulty === "Easy" ? "#10B981"
      : recipe.difficulty === "Medium" ? "#2B7FFF"
        : "#EF4444";

  const cuisineFlag = CUISINE_FLAGS[recipe.cuisine] ?? "🌍";
  const cuisineEmoji = CUISINE_EMOJIS[recipe.cuisine] ?? "🍽";
  const imageSource = recipe.image
    ? recipe.image.startsWith("http")
      ? { uri: recipe.image }
      : (RECIPE_IMAGES[recipe.image] ?? null)
    : null;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: cardWidth,
          height: cardHeight,
          opacity: cardOpacity,
          shadowColor: "#2B7FFF",
          transform: isTop
            ? [{ translateX: pan.x }, { translateY: pan.y }, { rotate }]
            : [{ scale: stackScale }, { translateY: stackOffsetY }],
        },
        // On web: prevent browser text/image selection from stealing drag events
        Platform.OS === "web" && isTop
          ? ({ userSelect: "none", WebkitUserSelect: "none", cursor: "grab" } as object)
          : null,
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* ── IMAGE SECTION (top 58%) ── */}
      <View style={{ height: imageSectionH, width: "100%", overflow: "hidden", backgroundColor: "#1A2436" }}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.emojiPlaceholder}>
            <Text style={styles.placeholderEmoji}>{cuisineEmoji}</Text>
          </View>
        )}

        {/* Top badges row (cuisine + difficulty) */}
        <View style={styles.topRow}>
          <View style={styles.cuisineBadge}>
            <Text style={styles.cuisineBadgeText}>{cuisineFlag} {recipe.cuisine}</Text>
          </View>
          <View style={[styles.diffBadge, { backgroundColor: difficultyColor }]}>
            <Text style={styles.diffBadgeText}>{recipe.difficulty}</Text>
          </View>
        </View>

        {/* Bottom fade from image into dark info section */}
        <View style={styles.imageFade} />
      </View>

      {/* ── INFO SECTION (bottom 42%) ── */}
      <View style={styles.infoSection}>
        {/* Pantry match pill */}
        <View style={styles.matchPill}>
          <View style={styles.matchDot} />
          <Text style={styles.matchPillText}>{pantryMatchScore}% pantry match</Text>
        </View>

        {/* Recipe title */}
        <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.title}</Text>

        {/* Meta row */}
        <Text style={styles.metaRow} numberOfLines={1}>
          {recipe.cuisine} · ⏱ {recipe.prepTime + recipe.cookTime}m · 🔥 {recipe.calories} kcal · ⭐ {recipe.rating}
        </Text>

        {/* Pantry / shopping tags */}
        <View style={styles.tagsRow}>
          <View style={styles.tagPill}>
            <Text style={styles.tagText}>✓ {matchedCount}/{recipe.ingredients.length} in pantry</Text>
          </View>
          {missingCount > 0 && (
            <View style={styles.tagPillAmber}>
              <Text style={styles.tagText}>+{missingCount} to buy</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── SWIPE STAMP OVERLAYS (full card) ── */}
      {isTop && (
        <>
          {/* COOK → (swipe right) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.stampOverlay,
              { backgroundColor: "rgba(16,185,129,0.22)", opacity: cookOpacity, pointerEvents: "none" },
            ]}
          >
            <View style={[styles.stampWrap, styles.stampLeft]}>
              <Text style={[styles.stamp, { color: "#10B981", borderColor: "#10B981" }]}>COOK ✓</Text>
            </View>
          </Animated.View>

          {/* NOPE ← (swipe left) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.stampOverlay,
              { backgroundColor: "rgba(239,68,68,0.22)", opacity: nopeOpacity, pointerEvents: "none" },
            ]}
          >
            <View style={[styles.stampWrap, styles.stampRight]}>
              <Text style={[styles.stamp, { color: "#EF4444", borderColor: "#EF4444" }]}>NOPE ✗</Text>
            </View>
          </Animated.View>

          {/* SAVED ↑ (swipe up) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.stampOverlay,
              { backgroundColor: "rgba(43,127,255,0.22)", opacity: saveOpacity, pointerEvents: "none" },
            ]}
          >
            <View style={[styles.stampWrap, styles.stampCenter]}>
              <Text style={[styles.stamp, { color: "#5A9FFF", borderColor: "#5A9FFF" }]}>SAVED 🔖</Text>
            </View>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    borderRadius: 24,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  emojiPlaceholder: {
    flex: 1,
    backgroundColor: "#0D1A30",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 80 },
  topRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cuisineBadge: {
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cuisineBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  diffBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  diffBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  imageFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: "rgba(13,26,48,0.6)",
  },
  infoSection: {
    flex: 1,
    backgroundColor: "#0D1A30",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 7,
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.18)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.38)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  matchPillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  recipeTitle: {
    fontSize: 21,
    color: "#fff",
    lineHeight: 27,
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  metaRow: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tagPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagPillAmber: {
    backgroundColor: "rgba(245,158,11,0.18)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  stampOverlay: {
    borderRadius: 24,
    zIndex: 10,
  },
  stampWrap: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
  },
  stampLeft: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    transform: [{ rotate: "-14deg" }],
  },
  stampRight: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    transform: [{ rotate: "14deg" }],
  },
  stampCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  stamp: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    letterSpacing: 2,
    overflow: "hidden",
  },
});
