import React, { useMemo } from "react";
import {
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_SOCIAL_POSTS, SocialPost } from "@/data/mockData";
import {
  getRecipeImageSource,
  getSocialImageSource,
} from "@/constants/recipeImages";

// ─── Per-cuisine data ─────────────────────────────────────────────────────────

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", Vegan: "🌱", Singaporean: "🦀",
  "Middle Eastern": "🥙", Other: "🍽️",
};

const CUISINE_ACCENTS: Record<string, string> = {
  Italian: "#C0392B", Japanese: "#C2185B", Korean: "#E64A19",
  Mexican: "#E65100", Indian: "#F57F17", Chinese: "#C62828",
  Thai: "#2E7D32", American: "#1565C0", French: "#6A1B9A",
  Mediterranean: "#01579B", Vegan: "#1B5E20", Singaporean: "#B71C1C",
  "Middle Eastern": "#4A148C", Other: "#37474F",
};

const CUISINE_DESCRIPTIONS: Record<string, string> = {
  Italian: "Rich pastas, aged cheese, and timeless flavours from the Italian heartland.",
  Japanese: "Elegant umami-forward dishes balancing freshness, technique, and tradition.",
  Korean: "Bold, spicy, fermented — Korean cooking packs every bite with big flavour.",
  Mexican: "Vibrant colours, smoky chillis, and centuries of culinary heritage.",
  Indian: "A universe of spice, aromatics, and deeply satisfying comfort food.",
  Chinese: "Wok-kissed depth, regional variety, and masterful balance of flavour.",
  Thai: "Sweet, sour, salty, spicy — Thai cuisine hits all four notes at once.",
  American: "Generous portions, comfort classics, and crowd-pleasing favourites.",
  French: "Refined technique, buttery richness, and the gold standard of cuisine.",
  Mediterranean: "Olive oil, fresh vegetables, and the healthy flavours of the sea.",
  Vegan: "Plant-powered dishes that prove you never have to sacrifice flavour.",
  Singaporean: "A melting pot of Malay, Chinese, and Indian flavours at its finest.",
  "Middle Eastern": "Warm spices, tahini, and the generous hospitality of the Levant.",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "#4CAF76", Medium: "#F5A623", Hard: "#E84040",
};

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ─── Post card component ──────────────────────────────────────────────────────

interface PostCardProps {
  post: SocialPost;
  index: number;
  accent: string;
  colors: ReturnType<typeof useColors>;
  onRecipePress: (id: string) => void;
  isLast: boolean;
}

function PostCard({ post, index, accent, colors, onRecipePress, isLast }: PostCardProps) {
  const imgSrc = getSocialImageSource(post.image, index, post.recipeId);
  const avatarColors = [accent, "#F5A623", "#4CAF76", "#5B8EF5", "#C2185B"];
  const avatarBg = avatarColors[index % avatarColors.length];

  return (
    <View style={[styles.postItem, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {/* Header row */}
      <View style={styles.postHeader}>
        <View style={[styles.postAvatarRing, { borderColor: avatarBg + "55" }]}>
          <View style={[styles.postAvatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.postAvatarText}>{post.userAvatar}</Text>
          </View>
        </View>
        <View style={styles.postMeta}>
          <Text style={[styles.postUsername, { color: colors.foreground }]}>
            {post.username}
          </Text>
          <Text style={[styles.postTime, { color: colors.textMuted }]}>{post.timeAgo}</Text>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, { borderColor: accent + "55" }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={[styles.followBtnText, { color: accent }]}>Follow</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      <Text style={[styles.postCaption, { color: colors.textSecondary }]} numberOfLines={3}>
        {post.caption}
      </Text>

      {/* Image */}
      {imgSrc != null && (
        <Image source={imgSrc} style={styles.postImage} resizeMode="cover" />
      )}

      {/* Recipe link */}
      {post.recipeName != null && (
        <TouchableOpacity
          style={[styles.recipeChip, { backgroundColor: accent + "14", borderColor: accent + "35" }]}
          onPress={() => post.recipeId != null && onRecipePress(post.recipeId)}
          activeOpacity={0.75}
        >
          <Feather name="book-open" size={11} color={accent} />
          <Text style={[styles.recipeChipText, { color: accent }]} numberOfLines={1}>
            {post.recipeName}
          </Text>
          <Feather name="chevron-right" size={11} color={accent} />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Feather name="heart" size={18} color={post.liked ? "#E84040" : colors.textMuted} />
          <Text style={[styles.actionCount, { color: colors.textMuted }]}>
            {formatCount(post.likes)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Feather name="message-circle" size={18} color={colors.textMuted} />
          <Text style={[styles.actionCount, { color: colors.textMuted }]}>
            {String(post.comments)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Feather name="share-2" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Feather name="bookmark" size={18} color={post.saved ? accent : colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CuisineDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { liveRecipes, getPantryMatchScore } = useApp();

  const cuisineName = Array.isArray(name) ? name[0] : (name ?? "");
  const emoji = CUISINE_EMOJIS[cuisineName] ?? "🍽️";
  const accent = CUISINE_ACCENTS[cuisineName] ?? "#F5A623";
  const description =
    CUISINE_DESCRIPTIONS[cuisineName] ??
    `Explore the best ${cuisineName} recipes and posts from the community.`;

  const cuisineRecipes = useMemo(
    () => liveRecipes.filter((r) => r.cuisine === cuisineName),
    [liveRecipes, cuisineName],
  );

  const cuisinePosts = useMemo(
    () => MOCK_SOCIAL_POSTS.filter((p) => p.cuisine === cuisineName),
    [cuisineName],
  );

  const totalLikes = useMemo(
    () => cuisinePosts.reduce((sum, p) => sum + p.likes, 0),
    [cuisinePosts],
  );

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleRecipePress = (id: string) => router.push(`/recipe/${id}`);

  // ── List header (hero + stats + recipes) ──────────────────────────────────
  const ListHeader = (
    <View>
      {/* ── Hero gradient ── */}
      <LinearGradient
        colors={[accent, accent + "88", colors.background] as readonly [string, string, string]}
        style={[styles.hero, { paddingTop: topPadding + 8 }]}
      >
        {/* Glow ring behind emoji */}
        <View style={[styles.emojiGlow, { backgroundColor: accent + "33" }]}>
          <View style={[styles.emojiGlowInner, { backgroundColor: accent + "55" }]}>
            <Text style={styles.heroEmoji}>{emoji}</Text>
          </View>
        </View>

        <Text style={styles.heroName}>{cuisineName}</Text>
        <Text style={styles.heroDesc}>{description}</Text>
      </LinearGradient>

      {/* ── Stats strip ── */}
      <View style={[styles.statsStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: colors.foreground }]}>{cuisinePosts.length}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>Posts</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: colors.foreground }]}>{cuisineRecipes.length}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>Recipes</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: accent }]}>{formatCount(totalLikes)}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>Likes</Text>
        </View>
      </View>

      {/* ── Recipes horizontal scroll ── */}
      {cuisineRecipes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RECIPES</Text>
            <Text style={[styles.sectionCount, { color: accent }]}>
              {cuisineRecipes.length} found
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recipesRow}
            decelerationRate="fast"
          >
            {cuisineRecipes.map((recipe) => {
              const imgSrc = getRecipeImageSource(null, recipe.id);
              const matchPct = getPantryMatchScore(recipe);
              const totalTime = recipe.prepTime + recipe.cookTime;
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={[styles.recipeCard, { backgroundColor: colors.card }]}
                  onPress={() => handleRecipePress(recipe.id)}
                  activeOpacity={0.85}
                >
                  {/* Image or placeholder */}
                  <View style={styles.recipeImageWrap}>
                    {imgSrc != null ? (
                      <Image source={imgSrc} style={styles.recipeImage} resizeMode="cover" />
                    ) : (
                      <LinearGradient
                        colors={[accent + "55", accent + "22"] as readonly [string, string]}
                        style={[styles.recipeImage, styles.recipeImagePlaceholder]}
                      >
                        <Text style={styles.recipeImageEmoji}>{emoji}</Text>
                      </LinearGradient>
                    )}
                    {/* Title overlay gradient */}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.78)"] as readonly [string, string]}
                      style={styles.recipeOverlay}
                    >
                      {matchPct >= 50 && (
                        <View style={[styles.matchBadge, { backgroundColor: "#4CAF76" }]}>
                          <Text style={styles.matchBadgeText}>{matchPct}%</Text>
                        </View>
                      )}
                      <Text style={styles.recipeCardTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <View style={styles.recipeCardMeta}>
                        <View style={[styles.diffDot, { backgroundColor: DIFFICULTY_COLORS[recipe.difficulty] ?? "#999" }]} />
                        <Text style={styles.recipeCardMetaText}>
                          {recipe.difficulty} · {totalTime}m
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Calorie footer */}
                  <View style={styles.recipeCardFooter}>
                    <Feather name="zap" size={11} color={colors.textMuted} />
                    <Text style={[styles.recipeCardCal, { color: colors.textMuted }]}>
                      {recipe.calories} kcal
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Feather name="star" size={11} color="#F5A623" />
                    <Text style={[styles.recipeCardCal, { color: colors.textMuted }]}>
                      {recipe.rating.toFixed(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Posts section label ── */}
      {cuisinePosts.length > 0 && (
        <View style={[styles.sectionRow, { marginHorizontal: 20, marginTop: 28, marginBottom: 4 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>COMMUNITY</Text>
          <Text style={[styles.sectionCount, { color: accent }]}>
            {cuisinePosts.length} posts
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating back button — sits above FlatList */}
      <View style={[styles.floatingBackWrap, { top: topPadding + 10 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.floatingBack, { backgroundColor: "rgba(0,0,0,0.45)" }]}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={cuisinePosts}
        keyExtractor={(item: SocialPost) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 52 }}>{emoji}</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts yet</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Be the first to share a {cuisineName} dish!
            </Text>
          </View>
        }
        renderItem={({ item, index }: { item: SocialPost; index: number }) => (
          <PostCard
            post={item}
            index={index}
            accent={accent}
            colors={colors}
            onRecipePress={handleRecipePress}
            isLast={index === cuisinePosts.length - 1}
          />
        )}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Floating back button — explicit 38×38 so it can't intercept touches elsewhere
  floatingBackWrap: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 38,
    height: 38,
  },
  floatingBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero — compact
  hero: {
    alignItems: "center",
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  emojiGlow: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  emojiGlowInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 34 },
  heroName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 290,
  },

  // Stats
  statsStrip: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 18 },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 14 },

  // Section labels
  section: { marginTop: 28 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Recipe cards
  recipesRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  recipeCard: {
    width: 172,
    borderRadius: 16,
    overflow: "hidden",
  },
  recipeImageWrap: { position: "relative" },
  recipeImage: { width: 172, height: 134 },
  recipeImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  recipeImageEmoji: { fontSize: 38 },
  recipeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 32,
    justifyContent: "flex-end",
  },
  matchBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  matchBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  recipeCardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 17,
    marginBottom: 4,
  },
  recipeCardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  diffDot: { width: 5, height: 5, borderRadius: 3 },
  recipeCardMetaText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  recipeCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recipeCardCal: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Post items
  postItem: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  postAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  postAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  postMeta: { flex: 1 },
  postUsername: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  postTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  followBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  followBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  postCaption: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  recipeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  recipeChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 200,
  },
  postActions: { flexDirection: "row", alignItems: "center", gap: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionCount: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // Empty state
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 4 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
