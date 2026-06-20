import React, { useRef, useEffect, useState, memo } from "react";
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
import { getRecipeImageSource } from "@/constants/recipeImages";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.26;
const SWIPE_UP_THRESHOLD = -70;
const MAX_ROTATION = 12;
const CARD_BASE_WIDTH = SCREEN_WIDTH - 16;

// ── Brand constants ────────────────────────────────────────────────────────
const C = {
  saffron:   "#F5A623",
  green:     "#4CAF76",
  red:       "#E84040",
  blue:      "#5B8EF5",
  darkWarm:  "#1C1410",   // warm dark base for card info section
  darkWarm2: "#241A12",   // slightly lighter warm dark
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

function SwipeCard({
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

  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;
  const onSwipeUpRef = useRef(onSwipeUp);
  onSwipeUpRef.current = onSwipeUp;

  // ── Programmatic swipe ──────────────────────────────────────────────────
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
      if (programmaticSwipe === "left")       onSwipeLeftRef.current();
      else if (programmaticSwipe === "right") onSwipeRightRef.current();
      else if (programmaticSwipe === "up")    onSwipeUpRef.current();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmaticSwipe]);

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [`-${MAX_ROTATION}deg`, "0deg", `${MAX_ROTATION}deg`],
    extrapolate: "clamp",
  });

  // Stamp overlay opacities
  const cookOpacity = pan.x.interpolate({ inputRange: [20, 70],   outputRange: [0, 1], extrapolate: "clamp" });
  const nopeOpacity = pan.x.interpolate({ inputRange: [-70, -20], outputRange: [1, 0], extrapolate: "clamp" });
  const saveOpacity = pan.y.interpolate({ inputRange: [-100, -25], outputRange: [1, 0], extrapolate: "clamp" });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTopRef.current,
      onMoveShouldSetPanResponder: (_, gs) =>
        isTopRef.current && (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5),
      onPanResponderGrant: () => { pan.extractOffset(); },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        if (gs.vx > 0.5 || gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, { toValue: { x: SCREEN_WIDTH * 1.5, y: gs.dy * 1.2 }, duration: 240, useNativeDriver: false })
            .start(() => onSwipeRightRef.current());
        } else if (gs.vx < -0.5 || gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, { toValue: { x: -SCREEN_WIDTH * 1.5, y: gs.dy * 1.2 }, duration: 240, useNativeDriver: false })
            .start(() => onSwipeLeftRef.current());
        } else if (gs.vy < -0.5 || gs.dy < SWIPE_UP_THRESHOLD) {
          Animated.timing(pan, { toValue: { x: gs.dx, y: -SCREEN_HEIGHT }, duration: 260, useNativeDriver: false })
            .start(() => onSwipeUpRef.current());
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 50, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 50, useNativeDriver: false }).start();
      },
    })
  ).current;

  // Card stack effect
  const stackScale         = index === 0 ? 1    : index === 1 ? 0.94 : 0.88;
  const stackOffsetY       = index === 0 ? 0    : index === 1 ? 10   : 22;
  const cardOpacity        = index === 0 ? 1    : index === 1 ? 0.75 : 0.45;
  const stackWidthReduction = index === 0 ? 0   : index === 1 ? 20   : 36;
  const cardWidth = CARD_BASE_WIDTH - stackWidthReduction;

  const [imageError, setImageError] = useState(false);

  const { getIngredientMatches } = useApp();
  const enrichedIngredients = getIngredientMatches(recipe);
  const matchedCount = enrichedIngredients.filter((i) => i.inPantry).length;
  const missingCount = enrichedIngredients.filter((i) => !i.inPantry).length;

  // Brand-aligned difficulty colors
  const difficultyColor =
    recipe.difficulty === "Easy"   ? C.green :
    recipe.difficulty === "Medium" ? C.saffron : C.red;

  const cuisineFlag  = CUISINE_FLAGS[recipe.cuisine]  ?? "🌍";
  const cuisineEmoji = CUISINE_EMOJIS[recipe.cuisine] ?? "🍽";
  const imageSource = getRecipeImageSource(recipe.image, recipe.id);

  // Pantry match pill color
  const matchColor  = pantryMatchScore >= 70 ? C.green : pantryMatchScore >= 40 ? C.saffron : "#888";
  const matchBgRgba = pantryMatchScore >= 70
    ? "rgba(76,175,118,0.20)"
    : pantryMatchScore >= 40
    ? "rgba(245,166,35,0.20)"
    : "rgba(136,136,136,0.18)";

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: cardWidth,
          height: cardHeight,
          opacity: cardOpacity,
          shadowColor: C.saffron,
          transform: isTop
            ? [{ translateX: pan.x }, { translateY: pan.y }, { rotate }]
            : [{ scale: stackScale }, { translateY: stackOffsetY }],
        },
        Platform.OS === "web" && isTop
          ? ({ userSelect: "none", WebkitUserSelect: "none", cursor: "grab" } as object)
          : null,
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* ── FULL-CARD IMAGE ── */}
      {imageSource && !imageError ? (
        <Image
          source={imageSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.emojiPlaceholder, { backgroundColor: C.darkWarm }]}>
          <Text style={styles.placeholderEmoji}>{cuisineEmoji}</Text>
        </View>
      )}

      {/* ── TOP BADGES ── */}
      <View style={styles.topRow}>
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineBadgeText}>{cuisineFlag} {recipe.cuisine}</Text>
        </View>
        <View style={[styles.diffBadge, { backgroundColor: difficultyColor }]}>
          <Text style={styles.diffBadgeText}>{recipe.difficulty}</Text>
        </View>
      </View>

      {/* ── BOTTOM INFO OVERLAY ── */}
      <View style={styles.infoOverlay}>
        {/* Dark scrim behind text */}
        <View style={styles.infoScrim} />

        <View style={styles.infoContent}>
          {/* Pantry match pill */}
          <View style={[styles.matchPill, { backgroundColor: matchBgRgba, borderColor: matchColor + "55" }]}>
            <View style={[styles.matchDot, { backgroundColor: matchColor }]} />
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
              <View style={[styles.tagPillAmber, { backgroundColor: "rgba(245,166,35,0.18)", borderColor: "rgba(245,166,35,0.40)" }]}>
                <Text style={styles.tagText}>+{missingCount} to buy</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── SWIPE STAMP OVERLAYS ── */}
      {isTop && (
        <>
          {/* COOK → (swipe right) */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.stampOverlay,
              { backgroundColor: "rgba(76,175,118,0.22)", opacity: cookOpacity, pointerEvents: "none" }]}
          >
            <View style={[styles.stampWrap, styles.stampLeft]}>
              <Text style={[styles.stamp, { color: C.green, borderColor: C.green }]}>COOK ✓</Text>
            </View>
          </Animated.View>

          {/* NOPE ← (swipe left) */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.stampOverlay,
              { backgroundColor: "rgba(232,64,64,0.22)", opacity: nopeOpacity, pointerEvents: "none" }]}
          >
            <View style={[styles.stampWrap, styles.stampRight]}>
              <Text style={[styles.stamp, { color: C.red, borderColor: C.red }]}>NOPE ✗</Text>
            </View>
          </Animated.View>

          {/* SAVED ↑ (swipe up) */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.stampOverlay,
              { backgroundColor: "rgba(91,142,245,0.22)", opacity: saveOpacity, pointerEvents: "none" }]}
          >
            <View style={[styles.stampWrap, styles.stampCenter]}>
              <Text style={[styles.stamp, { color: C.blue, borderColor: C.blue }]}>SAVED 🔖</Text>
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
    borderRadius: 28,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  emojiPlaceholder: {
    flex: 1,
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
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
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
  infoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  infoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,6,4,0.62)",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  infoContent: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 18,
    gap: 7,
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    color: "rgba(255,255,255,0.62)",
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
    borderColor: "rgba(255,255,255,0.20)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagPillAmber: {
    borderWidth: 1,
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
    borderRadius: 28,
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

// Wrap with React.memo so unchanged card props don't trigger re-renders
// when the parent swipe deck updates (e.g. matchCount changes on another card).
export default memo(SwipeCard);
