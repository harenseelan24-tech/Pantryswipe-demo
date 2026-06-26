import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
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

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  primary:            "#F5A623",
  secondary:          "#4CAF76",
  textPrimary:        "#141210",
  textMuted:          "#7A7570",
  surface:            "#FFFFFF",
  background:         "#FAFAF8",
  surfaceLow:         "#FFF1E4",
  surfaceHigh:        "#F4E6D8",
  surfaceHighest:     "#EEE0D2",
  onPrimaryContainer: "#644000",
  outlineVariant:     "#D7C3AE",
  saveBlue:           "#5B8EF5",
  danger:             "#E84040",
} as const;

const cardShadow = Platform.select({
  ios:     { shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24 },
  android: { elevation: 4 },
  web:     { boxShadow: "0 8px 24px rgba(131,85,0,0.08)" },
});

const { width: screenWidth } = Dimensions.get("window");
const CARD_W = (screenWidth - 16 * 3) / 2;

// ─── Per-cuisine data ──────────────────────────────────────────────────────────
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

// ─── Comment type ──────────────────────────────────────────────────────────────
interface LocalComment {
  id: string; user: string; avatar: string; text: string; timeAgo: string;
}

// ─── Post card ────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: SocialPost;
  index: number;
  accent: string;
  colors: ReturnType<typeof useColors>;
  isLast: boolean;
}

function PostCard({ post, index, accent, isLast }: PostCardProps) {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const imgSrc = getSocialImageSource(post.image, index, post.recipeId);
  const avatarColors = [accent, C.primary, C.secondary, C.saveBlue, "#C2185B"];
  const avatarBg = avatarColors[index % avatarColors.length];

  // ── Local interaction state (all verbatim) ──
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [followed, setFollowed] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [newComment, setNewComment] = useState("");

  // ── Handlers (all verbatim) ──
  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
  };
  const handleSave = () => setSaved((s) => !s);
  const handleFollow = () => setFollowed((f) => !f);
  const handleOpenComments = () => setShowComments(true);
  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const c: LocalComment = {
      id: String(Date.now()),
      user: "you",
      avatar: "Y",
      text: newComment.trim(),
      timeAgo: "just now",
    };
    setComments((prev) => [...prev, c]);
    setCommentCount((n) => n + 1);
    setNewComment("");
  };
  const handleShare = () =>
    Share.share({
      message: `Check out this post by @${post.username} on PantrySwipe!\n\n"${post.caption}"`,
      title: `@${post.username} on PantrySwipe`,
    }).catch(() => null);
  const handleRecipe = () => {
    if (post.recipeId) router.push(`/recipe/${post.recipeId}`);
  };

  return (
    <View style={[postStyles.card, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.outlineVariant }]}>

      {/* ── Header ── */}
      <View style={postStyles.header}>
        <View style={[postStyles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={postStyles.avatarText}>{post.userAvatar}</Text>
        </View>
        <View style={postStyles.meta}>
          <Text style={postStyles.username}>@{post.username}</Text>
          <Text style={postStyles.timeAgo}>{post.timeAgo}</Text>
        </View>
        <TouchableOpacity
          style={[postStyles.followBtn, followed ? postStyles.followBtnActive : postStyles.followBtnInactive]}
          onPress={handleFollow}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Text style={[postStyles.followBtnText, { color: followed ? "#FFFFFF" : C.onPrimaryContainer }]}>
            {followed ? "Following" : "+ Follow"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Image ── */}
      {imgSrc != null && (
        <View style={postStyles.imageWrap}>
          <Image source={imgSrc} style={postStyles.image} resizeMode="cover" />

          {/* Trending badge */}
          <View style={postStyles.trendingBadge}>
            <Feather name="zap" size={11} color={C.primary} />
            <Text style={postStyles.trendingText}>Trending</Text>
          </View>

          {/* Bookmark top-right */}
          <TouchableOpacity style={postStyles.bookmarkBtn} onPress={handleSave} activeOpacity={0.8}>
            <Feather name="bookmark" size={16} color={saved ? C.primary : "#FFFFFF"} />
          </TouchableOpacity>

          {/* Action pill row at bottom */}
          <View style={postStyles.actionsOverlay}>
            <TouchableOpacity style={[postStyles.pill, { backgroundColor: liked ? C.danger : "rgba(0,0,0,0.52)" }]} onPress={handleLike} activeOpacity={0.8}>
              <Feather name="heart" size={15} color="#fff" />
              <Text style={postStyles.pillText}>{formatCount(likeCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[postStyles.pill, { backgroundColor: "rgba(0,0,0,0.52)" }]} onPress={handleOpenComments} activeOpacity={0.8}>
              <Feather name="message-circle" size={15} color="#fff" />
              <Text style={postStyles.pillText}>{formatCount(commentCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[postStyles.pill, { backgroundColor: "rgba(0,0,0,0.52)" }]} onPress={handleShare} activeOpacity={0.8}>
              <Feather name="share-2" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Caption + chips ── */}
      <View style={postStyles.body}>
        <Text style={postStyles.caption} numberOfLines={3}>
          <Text style={postStyles.captionUser}>@{post.username} </Text>
          {post.caption}
        </Text>
        {(post.recipeName != null || post.cuisine != null) && (
          <View style={postStyles.chipRow}>
            {post.recipeName != null && post.recipeId != null && (
              <TouchableOpacity
                style={[postStyles.chip, { backgroundColor: accent + "18", borderColor: accent + "40" }]}
                onPress={handleRecipe}
                activeOpacity={0.75}
              >
                <Feather name="book-open" size={11} color={accent} />
                <Text style={[postStyles.chipText, { color: accent }]} numberOfLines={1}>{post.recipeName}</Text>
              </TouchableOpacity>
            )}
            {post.cuisine != null && (
              <View style={[postStyles.chip, { backgroundColor: C.secondary + "18", borderColor: C.secondary + "40" }]}>
                <Text style={postStyles.chipEmoji}>{CUISINE_EMOJIS[post.cuisine] ?? "🍽️"}</Text>
                <Text style={[postStyles.chipText, { color: C.secondary }]}>{post.cuisine}</Text>
              </View>
            )}
          </View>
        )}

        {/* View Recipe CTA */}
        {post.recipeId != null && (
          <TouchableOpacity style={postStyles.recipeCTA} onPress={handleRecipe} activeOpacity={0.85}>
            <Text style={postStyles.recipeCTAText}>View Recipe</Text>
            <Feather name="arrow-right" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Comment modal ── */}
      <Modal visible={showComments} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowComments(false)}>
        <KeyboardAvoidingView
          style={[commentStyles.modal, { backgroundColor: C.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={commentStyles.handle} />
          <View style={commentStyles.modalHeader}>
            <Text style={commentStyles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ gap: 14, paddingBottom: 20, flexGrow: 1 }}
            ListEmptyComponent={
              <View style={commentStyles.empty}>
                <Text style={{ fontSize: 32 }}>💬</Text>
                <Text style={commentStyles.emptyText}>No comments yet. Be first!</Text>
              </View>
            }
            renderItem={({ item }: { item: LocalComment }) => (
              <View style={commentStyles.row}>
                <View style={[commentStyles.avatar, { backgroundColor: C.primary }]}>
                  <Text style={commentStyles.avatarText}>{item.avatar}</Text>
                </View>
                <View style={commentStyles.bubble}>
                  <Text style={commentStyles.commentUser}>@{item.user}</Text>
                  <Text style={commentStyles.commentText}>{item.text}</Text>
                  <Text style={commentStyles.commentTime}>{item.timeAgo}</Text>
                </View>
              </View>
            )}
          />
          <View style={commentStyles.inputBar}>
            <TextInput
              ref={inputRef}
              style={commentStyles.input}
              placeholder="Add a comment…"
              placeholderTextColor={C.textMuted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleAddComment}
            />
            <TouchableOpacity
              style={[commentStyles.sendBtn, { backgroundColor: newComment.trim() ? C.primary : C.surfaceHighest }]}
              onPress={handleAddComment}
              disabled={!newComment.trim()}
              activeOpacity={0.8}
            >
              <Feather name="send" size={16} color={newComment.trim() ? "#fff" : C.textMuted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  const accent = CUISINE_ACCENTS[cuisineName] ?? C.primary;
  const description =
    CUISINE_DESCRIPTIONS[cuisineName] ??
    `Explore the best ${cuisineName} recipes and posts from the community.`;

  // ── Data (all verbatim) ────────────────────────────────────────────────────
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

  // ── Sub-category filter pills (visual state only) ──────────────────────────
  const [activeFilter, setActiveFilter] = useState("All Recipes");
  const subFilters = useMemo(() => {
    const tags = new Set<string>();
    cuisineRecipes.forEach((r) => r.tags?.slice(0, 3).forEach((t) => tags.add(t)));
    return ["All Recipes", ...Array.from(tags).slice(0, 5)];
  }, [cuisineRecipes]);

  const filteredRecipes = useMemo(() => {
    if (activeFilter === "All Recipes") return cuisineRecipes;
    return cuisineRecipes.filter((r) => r.tags?.includes(activeFilter));
  }, [cuisineRecipes, activeFilter]);

  // ── Community chefs: unique authors from posts ──────────────────────────────
  const communityChefs = useMemo(() => {
    const seen = new Set<string>();
    return cuisinePosts
      .filter((p) => { if (seen.has(p.username)) return false; seen.add(p.username); return true; })
      .slice(0, 6);
  }, [cuisinePosts]);

  // ── Hero image: first social post image or first recipe image ──────────────
  const heroImgSrc = useMemo(() => {
    const firstPost = cuisinePosts[0];
    if (firstPost) return getSocialImageSource(firstPost.image, 0, firstPost.recipeId);
    if (cuisineRecipes[0]) return getRecipeImageSource(null, cuisineRecipes[0].id);
    return null;
  }, [cuisinePosts, cuisineRecipes]);

  // ── Saved heart state ──────────────────────────────────────────────────────
  const [hearted, setHearted] = useState(false);

  // ── List header: hero + pills + recipe grid + chefs ───────────────────────
  const ListHeader = (
    <View>
      {/* ── HERO ── */}
      <View style={styles.hero}>
        {/* Background image or gradient placeholder */}
        {heroImgSrc ? (
          <Image source={heroImgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: accent }]}>
            <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontSize: 80, opacity: 0.25 }}>{emoji}</Text>
            </View>
          </View>
        )}
        {/* Dark gradient overlay at bottom */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.68)"]}
          style={[StyleSheet.absoluteFill, { top: "40%" }]}
        />
        {/* Spacer for header */}
        <View style={{ height: topPadding + 64 }} />
        {/* Content */}
        <View style={styles.heroContent}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Trending Cuisine</Text>
            </View>
            <View style={styles.heroCountRow}>
              <Feather name="zap" size={13} color={C.primary} />
              <Text style={styles.heroCountText}>{formatCount(totalLikes)} cooks this week</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{cuisineName} Culinary Heritage</Text>
          <Text style={styles.heroDesc} numberOfLines={2}>{description}</Text>
        </View>
      </View>

      {/* ── STATS STRIP ── */}
      <View style={styles.statsStrip}>
        <View style={styles.statCell}>
          <Text style={styles.statNum}>{cuisinePosts.length}</Text>
          <Text style={styles.statLbl}>Posts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statNum}>{cuisineRecipes.length}</Text>
          <Text style={styles.statLbl}>Recipes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: C.primary }]}>{formatCount(totalLikes)}</Text>
          <Text style={styles.statLbl}>Likes</Text>
        </View>
      </View>

      {/* ── SUB-CATEGORY FILTER PILLS ── */}
      {subFilters.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillStrip}
          style={styles.pillScroll}
        >
          {subFilters.map((f) => {
            const active = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── 2-COLUMN RECIPE GRID ── */}
      {filteredRecipes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionAccentRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionLabel}>RECIPES</Text>
            <Text style={styles.sectionCount}>{filteredRecipes.length} found</Text>
          </View>

          <View style={styles.recipeGrid}>
            {/* Left column: even-indexed items */}
            <View style={styles.recipeCol}>
              {filteredRecipes.filter((_, i) => i % 2 === 0).map((recipe, ci) => {
                const imgSrc = getRecipeImageSource(null, recipe.id);
                const matchPct = getPantryMatchScore(recipe);
                const totalTime = recipe.prepTime + recipe.cookTime;
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => handleRecipePress(recipe.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.recipeImageWrap}>
                      {imgSrc != null ? (
                        <Image source={imgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: accent + "30", alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 36 }}>{emoji}</Text>
                        </View>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.72)"]}
                        style={styles.recipeGradient}
                      />
                      {/* Bookmark absolute top-right */}
                      <View style={styles.recipeBookmark}>
                        <Feather name="bookmark" size={14} color="#FFFFFF" />
                      </View>
                      {/* Pantry match badge */}
                      {matchPct >= 50 && (
                        <View style={styles.matchBadge}>
                          <Text style={styles.matchBadgeText}>{matchPct}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                      <View style={styles.recipeMetaRow}>
                        <Feather name="star" size={11} color={C.primary} />
                        <Text style={styles.recipeMetaText}>{recipe.rating.toFixed(1)}</Text>
                        <Text style={styles.recipeMetaDot}>·</Text>
                        <Text style={styles.recipeMetaText}>{totalTime}m</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Right column: odd-indexed items — offset down by 24px */}
            <View style={[styles.recipeCol, { marginTop: 24 }]}>
              {filteredRecipes.filter((_, i) => i % 2 === 1).map((recipe) => {
                const imgSrc = getRecipeImageSource(null, recipe.id);
                const matchPct = getPantryMatchScore(recipe);
                const totalTime = recipe.prepTime + recipe.cookTime;
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => handleRecipePress(recipe.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.recipeImageWrap}>
                      {imgSrc != null ? (
                        <Image source={imgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: accent + "30", alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 36 }}>{emoji}</Text>
                        </View>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.72)"]}
                        style={styles.recipeGradient}
                      />
                      <View style={styles.recipeBookmark}>
                        <Feather name="bookmark" size={14} color="#FFFFFF" />
                      </View>
                      {matchPct >= 50 && (
                        <View style={styles.matchBadge}>
                          <Text style={styles.matchBadgeText}>{matchPct}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                      <View style={styles.recipeMetaRow}>
                        <Feather name="star" size={11} color={C.primary} />
                        <Text style={styles.recipeMetaText}>{recipe.rating.toFixed(1)}</Text>
                        <Text style={styles.recipeMetaDot}>·</Text>
                        <Text style={styles.recipeMetaText}>{totalTime}m</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* ── COMMUNITY CHEFS ── */}
      {communityChefs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionAccentRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionLabel}>COMMUNITY CHEFS</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chefsRow}>
            {communityChefs.map((post, i) => {
              const ring = i === 0 ? C.primary : C.outlineVariant;
              return (
                <View key={post.username} style={styles.chefItem}>
                  <View style={[styles.chefRing, { borderColor: ring }]}>
                    <View style={[styles.chefAvatar, { backgroundColor: CUISINE_ACCENTS[cuisineName] ?? C.primary }]}>
                      <Text style={styles.chefAvatarText}>{post.userAvatar}</Text>
                    </View>
                  </View>
                  <Text style={styles.chefName} numberOfLines={1}>@{post.username}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── COMMUNITY POSTS header ── */}
      {cuisinePosts.length > 0 && (
        <View style={[styles.sectionAccentRow, { marginHorizontal: 16, marginTop: 28, marginBottom: 4 }]}>
          <View style={styles.sectionAccentBar} />
          <Text style={styles.sectionLabel}>COMMUNITY POSTS</Text>
          <Text style={styles.sectionCount}>{cuisinePosts.length} posts</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>

      {/* ── FIXED HEADER ── */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={20} color={C.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>{cuisineName}</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setHearted((h) => !h)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.8}
        >
          <Feather name="heart" size={20} color={hearted ? C.danger : C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── FEED ── */}
      <FlatList
        data={cuisinePosts}
        keyExtractor={(item: SocialPost) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 52 }}>{emoji}</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySub}>Be the first to share a {cuisineName} dish!</Text>
          </View>
        }
        renderItem={({ item, index }: { item: SocialPost; index: number }) => (
          <PostCard
            post={item}
            index={index}
            accent={accent}
            colors={colors}
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

  // Fixed header
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, backgroundColor: "rgba(250,250,248,0.97)", position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  headerBtn:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surfaceHighest, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 22, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.4, marginHorizontal: 8 },

  // Hero
  hero:        { width: "100%", height: 280, justifyContent: "flex-end" },
  heroContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  heroBadgeRow:{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  heroBadge:   { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  heroBadgeText: { fontFamily: "Epilogue_700Bold", fontSize: 12, color: C.onPrimaryContainer },
  heroCountRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  heroCountText: { fontSize: 13, fontFamily: "Epilogue_400Regular", color: "#FFFFFF" },
  heroTitle:     { fontSize: 28, fontFamily: "Epilogue_700Bold", color: "#FFFFFF", letterSpacing: -0.5, lineHeight: 34 },
  heroDesc:      { fontSize: 14, fontFamily: "Epilogue_400Regular", color: "rgba(255,255,255,0.80)", lineHeight: 20 },

  // Stats strip
  statsStrip:  { flexDirection: "row", backgroundColor: C.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.outlineVariant },
  statCell:    { flex: 1, alignItems: "center", paddingVertical: 16 },
  statNum:     { fontSize: 22, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  statLbl:     { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: C.outlineVariant, marginVertical: 12 },

  // Filter pills
  pillScroll:  { flexGrow: 0, flexShrink: 0 },
  pillStrip:   { paddingHorizontal: 16, gap: 10, paddingVertical: 14, alignItems: "center" },
  pill:        { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
  pillActive:  { backgroundColor: C.primary },
  pillInactive: { backgroundColor: C.surfaceHighest, borderWidth: 1, borderColor: C.outlineVariant },
  pillText:    { fontSize: 13 },
  pillTextActive:   { fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },
  pillTextInactive: { fontFamily: "Epilogue_400Regular", color: C.textMuted },

  // Section headers
  section:         { paddingHorizontal: 16, marginTop: 24 },
  sectionAccentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionAccentBar: { width: 4, height: 24, borderRadius: 2, backgroundColor: C.primary },
  sectionLabel:    { fontFamily: "Epilogue_700Bold", fontSize: 12, letterSpacing: 1.8, color: C.textMuted, textTransform: "uppercase", flex: 1 },
  sectionCount:    { fontFamily: "Epilogue_700Bold", fontSize: 12, color: C.primary },

  // 2-column recipe grid
  recipeGrid:   { flexDirection: "row", gap: 16 },
  recipeCol:    { flex: 1, gap: 16 },
  recipeCard:   { borderRadius: 16, overflow: "hidden", backgroundColor: C.surfaceHigh, ...cardShadow },
  recipeImageWrap: { width: "100%", height: CARD_W * 1.3, position: "relative" },
  recipeGradient:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 90 },
  recipeBookmark:  { position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  matchBadge:      { position: "absolute", top: 10, left: 10, backgroundColor: C.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  matchBadgeText:  { fontSize: 11, fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },
  recipeInfo:      { padding: 10 },
  recipeTitle:     { fontSize: 14, fontFamily: "Epilogue_700Bold", color: C.textPrimary, marginBottom: 4 },
  recipeMetaRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  recipeMetaText:  { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  recipeMetaDot:   { fontSize: 12, color: C.textMuted },

  // Community chefs
  chefsRow:   { paddingHorizontal: 0, gap: 24, paddingBottom: 4 },
  chefItem:   { alignItems: "center", gap: 8, width: 72 },
  chefRing:   { width: 76, height: 76, borderRadius: 38, borderWidth: 3, padding: 3, alignItems: "center", justifyContent: "center" },
  chefAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  chefAvatarText: { fontSize: 22, fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },
  chefName:   { fontSize: 11, fontFamily: "Epilogue_700Bold", color: C.textPrimary, textAlign: "center" },

  // Empty state
  empty:      { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Epilogue_700Bold", color: C.textPrimary, textAlign: "center" },
  emptySub:   { fontSize: 14, fontFamily: "Epilogue_400Regular", color: C.textMuted, textAlign: "center", lineHeight: 21 },
});

// ─── Post card styles ─────────────────────────────────────────────────────────
const postStyles = StyleSheet.create({
  card:     { marginHorizontal: 16, paddingVertical: 4, backgroundColor: C.surface },
  header:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingVertical: 14 },
  avatar:   { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 15, fontFamily: "Epilogue_700Bold" },
  meta:     { flex: 1 },
  username: { fontSize: 14, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  timeAgo:  { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted, marginTop: 1 },

  followBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, minHeight: 44, justifyContent: "center" },
  followBtnActive: { backgroundColor: C.primary },
  followBtnInactive: { backgroundColor: C.surfaceHighest, borderWidth: 1, borderColor: C.outlineVariant },
  followBtnText:   { fontSize: 13, fontFamily: "Epilogue_700Bold" },

  imageWrap:   { width: "100%", height: 280, position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 4, ...cardShadow },
  image:       { width: "100%", height: "100%", position: "absolute" },

  trendingBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surfaceLow, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  trendingText:  { fontSize: 12, fontFamily: "Epilogue_700Bold", color: C.primary },

  bookmarkBtn: { position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },

  actionsOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  pill:           { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
  pillText:       { fontSize: 13, color: "#fff", fontFamily: "Epilogue_700Bold" },

  body:    { paddingHorizontal: 4, paddingBottom: 14 },
  caption: { fontSize: 14, lineHeight: 20, fontFamily: "Epilogue_400Regular", color: C.textPrimary, marginBottom: 8 },
  captionUser: { fontFamily: "Epilogue_700Bold" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip:    { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Epilogue_700Bold" },
  chipEmoji: { fontSize: 13 },

  recipeCTA:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, alignSelf: "flex-start", minHeight: 44, shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  recipeCTAText: { fontFamily: "Epilogue_700Bold", fontSize: 13, color: "#FFFFFF" },
});

// ─── Comment modal styles ─────────────────────────────────────────────────────
const commentStyles = StyleSheet.create({
  modal:       { flex: 1, padding: 20 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16, backgroundColor: C.outlineVariant },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:  { fontSize: 20, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  empty:       { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText:   { fontSize: 15, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  row:         { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  avatar:      { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText:  { color: "#fff", fontSize: 13, fontFamily: "Epilogue_700Bold" },
  bubble:      { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, gap: 4, backgroundColor: C.surfaceLow, borderColor: C.outlineVariant },
  commentUser: { fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.primary },
  commentText: { fontSize: 14, lineHeight: 19, fontFamily: "Epilogue_400Regular", color: C.textPrimary },
  commentTime: { fontSize: 11, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  inputBar:    { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 8, backgroundColor: C.surfaceLow, borderColor: C.outlineVariant },
  input:       { flex: 1, fontSize: 15, maxHeight: 80, fontFamily: "Epilogue_400Regular", color: C.textPrimary },
  sendBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
