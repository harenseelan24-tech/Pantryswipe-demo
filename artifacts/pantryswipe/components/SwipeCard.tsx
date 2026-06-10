import React, { useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Recipe } from "@/data/mockData";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_UP_THRESHOLD = -80;
const MAX_ROTATION = 18;
const CARD_BASE_WIDTH = SCREEN_WIDTH - 16;

const RECIPE_IMAGES: Record<string, ReturnType<typeof require>> = {
  "recipe-pasta": require("@/assets/images/recipe-pasta.png"),
  "recipe-salmon": require("@/assets/images/recipe-salmon.png"),
  "recipe-bowl": require("@/assets/images/recipe-bowl.png"),
  "recipe-bibimbap": require("@/assets/images/recipe-bibimbap.png"),
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
}: SwipeCardProps) {
  const colors = useColors();
  const pan = useRef(new Animated.ValueXY()).current;

  const cardHeight = containerHeight > 0 ? containerHeight - 8 : SCREEN_HEIGHT * 0.52;
  const imageHeight = cardHeight * 0.62;

  // Rotation tied to horizontal drag
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [`-${MAX_ROTATION}deg`, "0deg", `${MAX_ROTATION}deg`],
    extrapolate: "clamp",
  });

  // RIGHT overlay — builds from 30px to 80px drag
  const rightTintOpacity = pan.x.interpolate({
    inputRange: [0, 30, 80],
    outputRange: [0, 0, 0.42],
    extrapolate: "clamp",
  });
  const rightIconOpacity = pan.x.interpolate({
    inputRange: [30, 80],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // LEFT overlay — builds from -30px to -80px drag
  const leftTintOpacity = pan.x.interpolate({
    inputRange: [-80, -30, 0],
    outputRange: [0.42, 0, 0],
    extrapolate: "clamp",
  });
  const leftIconOpacity = pan.x.interpolate({
    inputRange: [-80, -30],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // UP overlay — builds from -30px to -100px vertical drag
  const upTintOpacity = pan.y.interpolate({
    inputRange: [-100, -30, 0],
    outputRange: [0.42, 0, 0],
    extrapolate: "clamp",
  });
  const upIconOpacity = pan.y.interpolate({
    inputRange: [-100, -30],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      isTop && (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6),
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > SWIPE_THRESHOLD) {
        Animated.timing(pan, {
          toValue: { x: SCREEN_WIDTH * 1.6, y: gestureState.dy * 1.5 },
          duration: 280,
          useNativeDriver: false,
        }).start(onSwipeRight);
      } else if (gestureState.dx < -SWIPE_THRESHOLD) {
        Animated.timing(pan, {
          toValue: { x: -SCREEN_WIDTH * 1.6, y: gestureState.dy * 1.5 },
          duration: 280,
          useNativeDriver: false,
        }).start(onSwipeLeft);
      } else if (gestureState.dy < SWIPE_UP_THRESHOLD) {
        Animated.timing(pan, {
          toValue: { x: gestureState.dx, y: -SCREEN_HEIGHT },
          duration: 300,
          useNativeDriver: false,
        }).start(onSwipeUp);
      } else {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          tension: 42,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  // Z-stack visual depth
  const stackWidthReduction = index === 0 ? 0 : index === 1 ? 20 : 32;
  const cardWidth = CARD_BASE_WIDTH - stackWidthReduction;
  const cardOpacity = index === 0 ? 1 : index === 1 ? 0.7 : 0.4;
  const stackOffsetY = index === 0 ? 0 : index === 1 ? 8 : 16;

  const matchedCount = recipe.ingredients.filter((i) => i.inPantry).length;
  const missingCount = recipe.ingredients.filter((i) => !i.inPantry).length;
  const difficultyColor =
    recipe.difficulty === "Easy"
      ? colors.secondary
      : recipe.difficulty === "Medium"
      ? colors.saffron
      : colors.destructive;

  const imageSource = recipe.image ? RECIPE_IMAGES[recipe.image] : null;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: cardWidth,
          height: cardHeight,
          backgroundColor: colors.card,
          opacity: cardOpacity,
          shadowColor: "#000",
          transform: isTop
            ? [{ translateX: pan.x }, { translateY: pan.y }, { rotate }]
            : [{ translateY: stackOffsetY }],
        },
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* Food Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Text style={styles.placeholderEmoji}>
              {recipe.cuisine === "Italian"
                ? "🍝"
                : recipe.cuisine === "Japanese"
                ? "🍜"
                : recipe.cuisine === "Korean"
                ? "🥘"
                : recipe.cuisine === "Mexican"
                ? "🌮"
                : recipe.cuisine === "Indian"
                ? "🍛"
                : "🍽"}
            </Text>
          </View>
        )}

        {/* Gradient overlay */}
        <View style={styles.imageGradient} />

        {/* Difficulty badge */}
        <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
          <Text style={[styles.difficultyText, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>
            {recipe.difficulty}
          </Text>
        </View>

        {/* Pantry match % */}
        <View style={[styles.matchPill, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Feather name="check-circle" size={11} color={colors.secondary} />
          <Text style={[styles.matchPillText, { color: colors.secondary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
            {pantryMatchScore}% match
          </Text>
        </View>
      </View>

      {/* Card Info */}
      <View style={styles.infoContainer}>
        <Text
          style={[styles.recipeTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}
          numberOfLines={2}
        >
          {recipe.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
            {recipe.cuisine}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Feather name="clock" size={11} color={colors.textMuted} />
          <Text style={[styles.metaNum, { color: colors.textSecondary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
            {recipe.prepTime + recipe.cookTime}m
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.metaNum, { color: colors.textSecondary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
            {recipe.calories} kcal
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Feather name="star" size={11} color={colors.saffron} />
          <Text style={[styles.metaNum, { color: colors.saffron, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
            {recipe.rating}
          </Text>
        </View>
        <View style={styles.matchRow}>
          <View style={[styles.matchBadge, { backgroundColor: colors.secondary + "22" }]}>
            <Feather name="check" size={11} color={colors.secondary} />
            <Text style={[styles.matchText, { color: colors.secondary, fontFamily: "Inter_600SemiBold" }]}>
              {matchedCount}/{recipe.ingredients.length} in pantry
            </Text>
          </View>
          {missingCount > 0 && (
            <View style={[styles.missingBadge, { backgroundColor: colors.saffron + "22" }]}>
              <Text style={[styles.matchText, { color: colors.saffron, fontFamily: "Inter_600SemiBold" }]}>
                +{missingCount} needed
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Swipe tint overlays — only on top card */}
      {isTop && (
        <>
          {/* Right / Cook */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.tintOverlay,
              { backgroundColor: "#4CAF76", opacity: rightTintOpacity, pointerEvents: "none" },
            ]}
          >
            <Animated.View style={[styles.overlayContent, { opacity: rightIconOpacity }]}>
              <Feather name="check-circle" size={64} color="#fff" />
              <Text style={[styles.overlayLabel, { fontFamily: "Inter_700Bold" }]}>COOK</Text>
            </Animated.View>
          </Animated.View>

          {/* Left / Skip */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.tintOverlay,
              { backgroundColor: "#E84040", opacity: leftTintOpacity, pointerEvents: "none" },
            ]}
          >
            <Animated.View style={[styles.overlayContent, { opacity: leftIconOpacity }]}>
              <Feather name="x-circle" size={64} color="#fff" />
              <Text style={[styles.overlayLabel, { fontFamily: "Inter_700Bold" }]}>SKIP</Text>
            </Animated.View>
          </Animated.View>

          {/* Up / Save */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.tintOverlay,
              { backgroundColor: "#5B8EF5", opacity: upTintOpacity, pointerEvents: "none" },
            ]}
          >
            <Animated.View style={[styles.overlayContent, { opacity: upIconOpacity }]}>
              <Feather name="bookmark" size={64} color="#fff" />
              <Text style={[styles.overlayLabel, { fontFamily: "Inter_700Bold" }]}>SAVE</Text>
            </Animated.View>
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 72 },
  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  difficultyBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 100,
  },
  difficultyText: {
    color: "#fff",
    fontSize: 11,
  },
  matchPill: {
    position: "absolute",
    bottom: 12,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  matchPillText: { fontSize: 11 },
  infoContainer: {
    flex: 1,
    padding: 18,
    paddingBottom: 14,
    gap: 8,
    justifyContent: "center",
  },
  recipeTitle: {
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  metaText: { fontSize: 12 },
  metaNum: { fontSize: 12 },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  matchRow: {
    flexDirection: "row",
    gap: 7,
    flexWrap: "wrap",
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  missingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  matchText: { fontSize: 12 },
  tintOverlay: {
    borderRadius: 24,
    zIndex: 10,
  },
  overlayContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  overlayLabel: {
    color: "#fff",
    fontSize: 20,
    letterSpacing: 3,
  },
});
