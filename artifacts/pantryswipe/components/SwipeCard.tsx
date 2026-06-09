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
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_UP_THRESHOLD = -SCREEN_HEIGHT * 0.2;

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
}

export default function SwipeCard({
  recipe,
  pantryMatchScore,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  isTop,
  index,
}: SwipeCardProps) {
  const colors = useColors();
  const pan = useRef(new Animated.ValueXY()).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-8deg", "0deg", "8deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const saveOpacity = pan.y.interpolate({
    inputRange: [-SCREEN_HEIGHT / 4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      isTop && (Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8),
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > SWIPE_THRESHOLD) {
        Animated.timing(pan, {
          toValue: { x: SCREEN_WIDTH * 1.5, y: gestureState.dy },
          duration: 300,
          useNativeDriver: false,
        }).start(onSwipeRight);
      } else if (gestureState.dx < -SWIPE_THRESHOLD) {
        Animated.timing(pan, {
          toValue: { x: -SCREEN_WIDTH * 1.5, y: gestureState.dy },
          duration: 300,
          useNativeDriver: false,
        }).start(onSwipeLeft);
      } else if (gestureState.dy < SWIPE_UP_THRESHOLD) {
        Animated.timing(pan, {
          toValue: { x: gestureState.dx, y: -SCREEN_HEIGHT * 1.5 },
          duration: 300,
          useNativeDriver: false,
        }).start(onSwipeUp);
      } else {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          tension: 40,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const cardScale = isTop ? 1 : 1 - index * 0.04;
  const cardTranslateY = isTop ? 0 : index * 10;
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
          backgroundColor: colors.card,
          shadowColor: "#000",
          transform: isTop
            ? [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate },
              ]
            : [{ scale: cardScale }, { translateY: cardTranslateY }],
        },
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* Food Image */}
      <View style={styles.imageContainer}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Text style={[styles.placeholderEmoji]}>
              {recipe.cuisine === "Italian" ? "🍝" :
               recipe.cuisine === "Japanese" ? "🍜" :
               recipe.cuisine === "Korean" ? "🥘" :
               recipe.cuisine === "Mexican" ? "🌮" :
               recipe.cuisine === "Indian" ? "🍛" : "🍽"}
            </Text>
          </View>
        )}
        <View style={styles.imageGradient} />

        {/* Difficulty badge */}
        <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
          <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
        </View>

        {/* Swipe indicators */}
        {isTop && (
          <>
            <Animated.View style={[styles.indicator, styles.likeIndicator, { opacity: likeOpacity }]}>
              <Feather name="check-circle" size={28} color="#fff" />
              <Text style={styles.indicatorText}>COOK</Text>
            </Animated.View>
            <Animated.View style={[styles.indicator, styles.nopeIndicator, { opacity: nopeOpacity }]}>
              <Feather name="x-circle" size={28} color="#fff" />
              <Text style={styles.indicatorText}>SKIP</Text>
            </Animated.View>
            <Animated.View style={[styles.indicator, styles.saveIndicator, { opacity: saveOpacity }]}>
              <Feather name="bookmark" size={28} color="#fff" />
              <Text style={styles.indicatorText}>SAVE</Text>
            </Animated.View>
          </>
        )}
      </View>

      {/* Card Info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.recipeTitle, { color: colors.foreground }]} numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {recipe.cuisine}
          </Text>
          <View style={styles.dot} />
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {recipe.prepTime + recipe.cookTime}m
          </Text>
          <View style={styles.dot} />
          <Feather name="zap" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {recipe.calories} kcal
          </Text>
          <View style={styles.dot} />
          <Feather name="star" size={12} color={colors.saffron} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {recipe.rating}
          </Text>
        </View>
        <View style={styles.matchRow}>
          <View style={[styles.matchBadge, { backgroundColor: colors.secondary + "20" }]}>
            <Feather name="check" size={12} color={colors.secondary} />
            <Text style={[styles.matchText, { color: colors.secondary }]}>
              {matchedCount}/{recipe.ingredients.length} in pantry
            </Text>
          </View>
          {missingCount > 0 && (
            <View style={[styles.missingBadge, { backgroundColor: colors.saffron + "20" }]}>
              <Text style={[styles.matchText, { color: colors.saffron }]}>
                +{missingCount} needed
              </Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 32,
    borderRadius: 24,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  imageContainer: {
    height: SCREEN_HEIGHT * 0.38,
    position: "relative",
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
  placeholderEmoji: {
    fontSize: 80,
  },
  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  difficultyBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  difficultyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  indicator: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    top: 20,
  },
  likeIndicator: {
    left: 16,
    backgroundColor: "rgba(76, 175, 118, 0.85)",
  },
  nopeIndicator: {
    right: 16,
    backgroundColor: "rgba(232, 64, 64, 0.85)",
  },
  saveIndicator: {
    left: "50%",
    transform: [{ translateX: -60 }],
    backgroundColor: "rgba(91, 142, 245, 0.85)",
  },
  indicatorText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 1,
  },
  infoContainer: {
    padding: 20,
    paddingBottom: 16,
    gap: 10,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#ccc",
  },
  matchRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  missingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  matchText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
