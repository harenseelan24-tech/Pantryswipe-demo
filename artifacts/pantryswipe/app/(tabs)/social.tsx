import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_SOCIAL_POSTS, SocialPost } from "@/data/mockData";
import { getSocialImageSource, getRecipeImageSource } from "@/constants/recipeImages";

// ─── Constants ────────────────────────────────────────────────────────────────
const DISCOVERY_TABS = ["For You", "Following", "Trending", "Near Me"] as const;
type DiscoveryTab = (typeof DISCOVERY_TABS)[number];
const CUISINE_FILTERS = ["All", "Italian", "Japanese", "Korean", "Indian", "Mexican", "Thai", "Vegan"];
const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", Vegan: "🌱", Singaporean: "🦀",
};
const COMPOSE_CUISINES = ["Italian", "Japanese", "Korean", "Mexican", "Indian", "Chinese", "Thai", "Vegan", "American", "French", "Mediterranean", "Other"];
const NEAR_ME_SUBURB = "Sengkang, SG";

// ─── Types ────────────────────────────────────────────────────────────────────
type Comment = { id: string; user: string; text: string; avatar: string; timeAgo: string };

// Stable hash-based mock distance so the same post always has the same distance
const mockDistance = (id: string): string => {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((h % 48) / 10 + 0.3).toFixed(1);
};

// ─── Seed comments ────────────────────────────────────────────────────────────
const SEED_COMMENTS: Record<string, Comment[]> = {
  s1: [
    { id: "c1", user: "pasta_lover", text: "This looks incredible! What brand of pancetta do you use?", avatar: "P", timeAgo: "1h ago" },
    { id: "c2", user: "homecook22", text: "Made this last night, absolute perfection 🍝", avatar: "H", timeAgo: "45m ago" },
  ],
  s2: [{ id: "c1", user: "seafood_fan", text: "The garlic butter sauce really makes it!", avatar: "S", timeAgo: "2h ago" }],
  s3: [],
  s4: [{ id: "c1", user: "kfoodie", text: "Stone pot is a MUST, you're 100% right!", avatar: "K", timeAgo: "3h ago" }],
  s5: [],
};

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard({ shimmer, colors }: { shimmer: Animated.Value; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <Animated.View style={[skeletonStyles.card, { backgroundColor: colors.card, opacity: shimmer, borderColor: colors.border }]}>
      <View style={skeletonStyles.header}>
        <View style={[skeletonStyles.avatar, { backgroundColor: colors.border }]} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={[skeletonStyles.line, { width: "55%", backgroundColor: colors.border }]} />
          <View style={[skeletonStyles.line, { width: "30%", backgroundColor: colors.border }]} />
        </View>
      </View>
      <View style={[skeletonStyles.image, { backgroundColor: colors.border }]} />
      <View style={{ padding: 14, gap: 9 }}>
        <View style={[skeletonStyles.line, { backgroundColor: colors.border }]} />
        <View style={[skeletonStyles.line, { width: "75%", backgroundColor: colors.border }]} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  line: { height: 12, borderRadius: 6 },
  image: { width: "100%", aspectRatio: 4 / 3 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { liveRecipes, savedRecipes, followingList, followUser, isFollowing, toggleSavePost, isPostSaved } = useApp();

  // Feed state
  const [posts, setPosts] = useState<SocialPost[]>(MOCK_SOCIAL_POSTS);
  const [comments, setComments] = useState<Record<string, Comment[]>>(SEED_COMMENTS);

  // Tab / filter state
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("For You");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentModalPost, setCommentModalPost] = useState<SocialPost | null>(null);
  const [newComment, setNewComment] = useState("");
  const [shareToast, setShareToast] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifCount, setNotifCount] = useState(3);

  // Compose post
  const [newCaption, setNewCaption] = useState("");
  const [newCuisine, setNewCuisine] = useState<string | undefined>(undefined);
  const [showCuisineSheet, setShowCuisineSheet] = useState(false);
  const [composerPhotos, setComposerPhotos] = useState<string[]>([]);
  const [composerRecipe, setComposerRecipe] = useState<{ id: string; title: string; image: string | null } | null>(null);
  const [composerLocation, setComposerLocation] = useState(false);
  const [showRecipeSheet, setShowRecipeSheet] = useState(false);

  // Follow flash confirmations {handle: boolean}
  const [followedHandles, setFollowedHandles] = useState<Record<string, boolean>>({});

  // Near Me
  const [locationPermission, setLocationPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  // Compose input ref (for programmatic focus after modal open on Android)
  const composeInputRef = useRef<TextInput>(null);

  // Double-tap like animation
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const [heartPostId, setHeartPostId] = useState<string | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});

  // Shimmer animation for skeleton
  const shimmerAnim = useRef(new Animated.Value(0.35)).current;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  // ── Skeleton + shimmer ──────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.75, duration: 650, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => { loop.stop(); clearTimeout(t); };
  }, []);

  // ── Near Me: request location when tab is selected ─────────────────────────
  useEffect(() => {
    if (activeTab !== "Near Me") return;
    if (locationPermission !== "unknown") return;
    (async () => {
      if (Platform.OS === "web") { setLocationPermission("granted"); return; }
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted" ? "granted" : "denied");
    })();
  }, [activeTab]);

  // ── Cuisine filter toggle ──────────────────────────────────────────────────
  const toggleCuisine = (c: string) => {
    if (c === "All") { setSelectedCuisines([]); return; }
    setSelectedCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };
  const isCuisineActive = (c: string) =>
    c === "All" ? selectedCuisines.length === 0 : selectedCuisines.includes(c);

  // ── Filtered posts ─────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (activeTab === "Following") {
      result = result.filter((p) => followingList.includes(p.username));
    } else if (activeTab === "Trending") {
      result = result.sort((a, b) => b.likes - a.likes);
    } else if (activeTab === "Near Me") {
      result = result.sort((a, b) => parseFloat(mockDistance(a.id)) - parseFloat(mockDistance(b.id)));
    }

    if (selectedCuisines.length > 0) {
      result = result.filter((p) => p.cuisine && selectedCuisines.includes(p.cuisine));
    }

    return result;
  }, [posts, activeTab, selectedCuisines, followingList]);

  // ── Trending grouped by cuisine (top 1 per cuisine) ──────────────────────
  const trendingByCuisine = useMemo(() => {
    if (activeTab !== "Trending") return [];
    const seen = new Set<string>();
    const byLikes = [...posts].sort((a, b) => b.likes - a.likes);
    const top: SocialPost[] = [];
    for (const p of byLikes) {
      if (p.cuisine && !seen.has(p.cuisine)) { seen.add(p.cuisine); top.push(p); }
      if (top.length >= 5) break;
    }
    return top;
  }, [posts, activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleLike = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts((prev) =>
      prev.map((p) => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p)
    );
  };

  const handleSave = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSavePost(id);
  };

  const handleShare = async (post?: SocialPost) => {
    try {
      await Share.share({
        message: post
          ? `Check out "${post.recipeName ?? "this amazing dish"}" on PantrySwipe! 🍳`
          : "Check out this dish on PantrySwipe! 🍳",
        title: "PantrySwipe",
      });
    } catch {
      setShareToast("Link copied!");
      setTimeout(() => setShareToast(""), 2000);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !commentModalPost) return;
    const c: Comment = {
      id: Date.now().toString(),
      user: "you",
      text: newComment.trim(),
      avatar: "Y",
      timeAgo: "just now",
    };
    setComments((prev) => ({ ...prev, [commentModalPost.id]: [...(prev[commentModalPost.id] || []), c] }));
    setPosts((prev) => prev.map((p) => p.id === commentModalPost.id ? { ...p, comments: p.comments + 1 } : p));
    setNewComment("");
  };

  const handleFollow = (username: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    followUser(username);
    setFollowedHandles((prev) => ({ ...prev, [username]: true }));
    setTimeout(() => setFollowedHandles((prev) => { const n = { ...prev }; delete n[username]; return n; }), 1200);
  };

  const handleDoubleTap = (postId: string) => {
    const now = Date.now();
    const last = lastTapRef.current[postId] ?? 0;
    if (now - last < 320) {
      const post = posts.find((p) => p.id === postId);
      if (!post?.liked) toggleLike(postId);
      setHeartPostId(postId);
      heartAnim.setValue(1);
      heartScaleAnim.setValue(0);
      Animated.sequence([
        Animated.spring(heartScaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 5 }),
        Animated.delay(500),
        Animated.timing(heartAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => { setHeartPostId(null); heartAnim.setValue(0); });
    }
    lastTapRef.current[postId] = now;
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setPosts([...MOCK_SOCIAL_POSTS]);
      setRefreshing(false);
    }, 900);
  }, []);

  const openCompose = () => {
    setNewCaption("");
    setNewCuisine(undefined);
    setComposerPhotos([]);
    setComposerRecipe(null);
    setComposerLocation(false);
    setShowCreatePost(true);
  };

  const handlePickPhoto = async () => {
    if (composerPhotos.length >= 4) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setShareToast("Photo library access denied");
      setTimeout(() => setShareToast(""), 2000);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setComposerPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleAISuggest = () => {
    setShareToast("AI suggestion unavailable — add an API key to enable ✨");
    setTimeout(() => setShareToast(""), 2800);
  };

  const handleSubmitPost = () => {
    if (!newCaption.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newPost: SocialPost = {
      id: `s_user_${Date.now()}`,
      username: "you",
      userAvatar: "Y",
      image: composerPhotos[0] ?? null,
      caption: newCaption.trim() + (composerLocation ? ` 📍 ${NEAR_ME_SUBURB}` : ""),
      likes: 0,
      comments: 0,
      timeAgo: "just now",
      liked: false,
      saved: false,
      cuisine: newCuisine,
      recipeName: composerRecipe?.title,
      recipeId: composerRecipe?.id,
    };
    setPosts((prev) => [newPost, ...prev]);
    setShowCreatePost(false);
    setNewCaption("");
    setNewCuisine(undefined);
    setComposerPhotos([]);
    setComposerRecipe(null);
    setComposerLocation(false);
    setActiveTab("For You");
    setShareToast("Post shared! 🎉");
    setTimeout(() => setShareToast(""), 2500);
  };

  const savedRecipesList = liveRecipes.filter((r) => savedRecipes.includes(r.id));

  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  // ── Render post ──────────────────────────────────────────────────────────────
  const renderPost = useCallback(({ item, index }: { item: SocialPost; index: number }) => {
    const linkedRecipe = item.recipeId
      ? liveRecipes.find((r) => r.id === item.recipeId || r.id === `api_${item.recipeId}`)
      : undefined;
    const imageSource = getSocialImageSource(item.image, index, linkedRecipe?.id);
    const postComments = comments[item.id] || [];
    const isMe = item.username === "you";
    const alreadyFollowing = isFollowing(item.username);
    const justFollowed = followedHandles[item.username] === true;
    const savedPost = isPostSaved(item.id);
    const isTrending = activeTab === "Trending";
    const isNearMe = activeTab === "Near Me" && locationPermission === "granted";
    const isHeartShowing = heartPostId === item.id;

    return (
      <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.userAvatarText, { fontFamily: "Inter_700Bold" }]}>{item.userAvatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.username, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>@{item.username}</Text>
            <Text style={[styles.timeAgo, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.timeAgo}</Text>
            {isNearMe && (
              <Text style={[styles.distanceText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                📍 {mockDistance(item.id)} km away
              </Text>
            )}
          </View>
          {!isMe && !alreadyFollowing && !justFollowed && (
            <TouchableOpacity
              style={[
                styles.followBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35,
                  shadowRadius: 7,
                  elevation: 3,
                },
              ]}
              onPress={() => handleFollow(item.username)}
            >
              <Text style={[styles.followBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>+ Follow</Text>
            </TouchableOpacity>
          )}
          {!isMe && justFollowed && (
            <View style={[styles.followingFlash, { backgroundColor: "#4CAF7620", borderColor: "#4CAF76" }]}>
              <Feather name="check" size={12} color="#4CAF76" />
              <Text style={[styles.followBtnText, { color: "#4CAF76", fontFamily: "Inter_700Bold" }]}>Following</Text>
            </View>
          )}
        </View>

        {/* Image with overlaid actions + double-tap */}
        <Pressable onPress={() => handleDoubleTap(item.id)}>
          <View style={[styles.postImageContainer, { backgroundColor: colors.muted }]}>
            {imageSource ? (
              <Image source={imageSource} style={styles.postImage} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Text style={{ fontSize: 52 }}>{CUISINE_EMOJIS[item.cuisine ?? ""] ?? "🍽"}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" }}>{item.recipeName ?? "Food"}</Text>
              </View>
            )}

            {/* Trending badge */}
            {isTrending && (
              <View style={styles.trendingBadge}>
                <Text style={styles.trendingBadgeText}>🔥 Trending</Text>
              </View>
            )}

            {/* Double-tap heart overlay */}
            {isHeartShowing && (
              <Animated.View style={[styles.heartOverlay, { opacity: heartAnim, transform: [{ scale: heartScaleAnim }] }]}>
                <Text style={styles.heartOverlayEmoji}>❤️</Text>
              </Animated.View>
            )}

            {/* Actions overlaid on bottom of image */}
            <View style={styles.actionsOverlay}>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionItem} onPress={() => toggleLike(item.id)}>
                  <View style={[styles.actionPill, { backgroundColor: item.liked ? "#E84040" : "rgba(0,0,0,0.50)" }]}>
                    <Feather name="heart" size={17} color="#fff" />
                    <Text style={[styles.actionCount, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>{formatCount(item.likes)}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => setCommentModalPost(item)}>
                  <View style={[styles.actionPill, { backgroundColor: "rgba(0,0,0,0.50)" }]}>
                    <Feather name="message-circle" size={17} color="#fff" />
                    <Text style={[styles.actionCount, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                      {postComments.length || item.comments}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => handleShare(item)}>
                  <View style={[styles.actionPill, { backgroundColor: "rgba(0,0,0,0.50)" }]}>
                    <Feather name="share-2" size={17} color="#fff" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => handleSave(item.id)}>
                  <View style={[styles.actionPill, { backgroundColor: savedPost ? "#5B8EF5" : "rgba(0,0,0,0.50)" }]}>
                    <Feather name={savedPost ? "bookmark" : "bookmark"} size={17} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Caption + chips */}
        <View style={styles.captionContainer}>
          <Text style={[styles.caption, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
            <Text style={[styles.captionUsername, { fontFamily: "Inter_700Bold" }]}>@{item.username} </Text>
            {item.caption}
          </Text>
          {(item.recipeName || item.cuisine) && (
            <View style={styles.chipRow}>
              {item.recipeName && (
                <TouchableOpacity
                  style={[styles.recipeChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "35" }]}
                  onPress={() => item.recipeId && router.push(`/recipe/${item.recipeId}`)}
                >
                  <Feather name="book-open" size={12} color={colors.primary} />
                  <Text style={[styles.recipeChipText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{item.recipeName}</Text>
                </TouchableOpacity>
              )}
              {item.cuisine && (
                <View style={[styles.cuisineChip, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}>
                  <Text style={styles.cuisineChipEmoji}>{CUISINE_EMOJIS[item.cuisine] ?? "🍽️"}</Text>
                  <Text style={[styles.cuisineChipText, { color: colors.accent, fontFamily: "Inter_600SemiBold" }]}>{item.cuisine}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [posts, comments, followingList, followedHandles, heartPostId, activeTab, locationPermission, colors]);

  // ── Empty state for Following tab ─────────────────────────────────────────
  const FollowingEmpty = () => (
    <View style={styles.emptyState}>
      <Feather name="user-plus" size={40} color={colors.textMuted} />
      <Text style={[styles.emptyStateTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>No one yet</Text>
      <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
        Follow chefs you love and their posts will appear here
      </Text>
      <TouchableOpacity
        style={[styles.emptyStateCTA, { backgroundColor: colors.primary }]}
        onPress={() => setActiveTab("For You")}
      >
        <Text style={[styles.emptyStateCTAText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
          Discover Chefs
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Near Me denied state ──────────────────────────────────────────────────
  const NearMeDenied = () => (
    <View style={styles.emptyState}>
      <Feather name="map-pin" size={40} color={colors.textMuted} />
      <Text style={[styles.emptyStateTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Location access needed</Text>
      <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
        Enable location in your settings to see what people are cooking near you
      </Text>
    </View>
  );

  // ── No results empty state ────────────────────────────────────────────────
  const NoResults = () => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 40 }}>👨‍🍳</Text>
      <Text style={[styles.emptyStateTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        No posts yet
      </Text>
      <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
        {selectedCuisines.length > 0
          ? `No ${selectedCuisines.join(" or ")} posts yet. Be the first to share!`
          : "Nothing here yet."}
      </Text>
    </View>
  );

  // ── Trending header (top cuisines horizontal scroll) ─────────────────────
  const TrendingHeader = () => (
    <View style={{ marginBottom: 8 }}>
      {/* Eyebrow label */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: colors.primary }} />
        <Text style={{ fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_600SemiBold", color: colors.primary, textTransform: "uppercase" }}>
          Trending Cuisines
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingCuisinesRow}>
        {trendingByCuisine.map((p, i) => {
          const imgSrc = getSocialImageSource(p.image, i, undefined);
          return (
            <View key={p.id} style={[styles.trendingCuisineCard, { backgroundColor: colors.card, borderColor: colors.border, overflow: "hidden" }]}>
              {imgSrc ? (
                <Image source={imgSrc} style={styles.trendingCuisineImage} resizeMode="cover" />
              ) : (
                <View style={[styles.trendingCuisineImage, { backgroundColor: colors.primary + "12", alignItems: "center", justifyContent: "center" }]}>
                  <View style={[styles.trendingEmojiBox, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={{ fontSize: 26 }}>{CUISINE_EMOJIS[p.cuisine ?? ""] ?? "🍽"}</Text>
                  </View>
                </View>
              )}
              {/* Bottom gradient label */}
              <View style={[styles.trendingCuisineLabel, { backgroundColor: colors.card }]}>
                <Text style={[{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }]} numberOfLines={1}>
                  {p.cuisine ?? "Mixed"}
                </Text>
                <Text style={[{ fontSize: 9, color: colors.primary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                  🔥 {formatCount(p.likes)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 }]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: colors.textMuted }} />
        <Text style={{ fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_600SemiBold", color: colors.textMuted, textTransform: "uppercase" }}>
          All Trending
        </Text>
      </View>
    </View>
  );

  // ── Near Me header ────────────────────────────────────────────────────────
  const NearMeHeader = () => (
    <View style={[styles.nearMeHeader, { backgroundColor: "#4CAF760A", borderColor: "#4CAF7630", overflow: "hidden" }]}>
      {/* Herb-green left accent bar */}
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: "#4CAF76" }} />
      <View style={{ marginLeft: 8, flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <View style={[{ width: 30, height: 30, borderRadius: 8, backgroundColor: "#4CAF7620", alignItems: "center", justifyContent: "center" }]}>
          <Feather name="map-pin" size={14} color="#4CAF76" />
        </View>
        <Text style={[{ fontSize: 13, color: "#1a1a1a", fontFamily: "Inter_500Medium", flex: 1 }]}>
          Showing results near you
        </Text>
        <View style={[styles.suburbPill, { backgroundColor: "#4CAF7620", borderColor: "#4CAF7650" }]}>
          <Text style={[{ fontSize: 11, color: "#4CAF76", fontFamily: "Inter_600SemiBold" }]}>{NEAR_ME_SUBURB}</Text>
        </View>
      </View>
    </View>
  );

  // ── Resolve empty state per tab ───────────────────────────────────────────
  const emptyComponent = useMemo(() => {
    if (activeTab === "Following" && filteredPosts.length === 0 && selectedCuisines.length === 0) {
      return <FollowingEmpty />;
    }
    if (activeTab === "Near Me" && locationPermission === "denied") {
      return <NearMeDenied />;
    }
    return <NoResults />;
  }, [activeTab, filteredPosts.length, selectedCuisines.length, locationPermission]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.iconBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 5,
            },
          ]}
          onPress={openCompose}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>

        <View style={{ alignItems: "center", gap: 1 }}>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, fontFamily: "Inter_600SemiBold", color: colors.textMuted, textTransform: "uppercase" }}>
            Food Community
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Social</Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { setShowNotifications(true); setNotifCount(0); }}
        >
          <Feather name="heart" size={18} color={colors.foreground} />
          {notifCount > 0 && (
            <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.notifBadgeText, { fontFamily: "Inter_700Bold" }]}>{notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Filter panel ────────────────────────────────────────────────────── */}
      <View style={[styles.filterPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* Discovery tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoveryTabsRow} contentContainerStyle={styles.discoveryTabs}>
          {DISCOVERY_TABS.map((tab) => (
            <TouchableOpacity key={tab} style={styles.discoveryTab} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.discoveryTabText, {
                color: activeTab === tab ? colors.foreground : colors.textSecondary,
                fontFamily: activeTab === tab ? "Inter_700Bold" : "Inter_500Medium",
              }]}>{tab}</Text>
              {activeTab === tab && <View style={[styles.discoveryTabUnderline, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

        {/* Cuisine multi-select chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cuisineFiltersRow} contentContainerStyle={styles.cuisineFilters}>
          {CUISINE_FILTERS.map((c) => {
            const active = isCuisineActive(c);
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.cuisineFilter,
                  active
                    ? {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 7,
                        elevation: 3,
                      }
                    : { backgroundColor: colors.background, borderColor: colors.border },
                ]}
                onPress={() => toggleCuisine(c)}
              >
                <Text style={[styles.cuisineFilterText, {
                  color: active ? colors.primaryForeground : colors.foreground,
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <ScrollView contentContainerStyle={[styles.feedContent, { gap: 16 }]} showsVerticalScrollIndicator={false}>
          <SkeletonCard shimmer={shimmerAnim} colors={colors} />
          <SkeletonCard shimmer={shimmerAnim} colors={colors} />
          <SkeletonCard shimmer={shimmerAnim} colors={colors} />
        </ScrollView>
      ) : activeTab === "Near Me" && locationPermission === "denied" ? (
        <NearMeDenied />
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(i) => i.id}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feedContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            activeTab === "Trending" && filteredPosts.length > 0 ? <TrendingHeader /> :
            activeTab === "Near Me" && locationPermission === "granted" ? <NearMeHeader /> : null
          }
          ListEmptyComponent={emptyComponent}
        />
      )}

      {/* ── Share toast ──────────────────────────────────────────────────────── */}
      {shareToast ? (
        <View style={[styles.shareToast, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check" size={16} color={colors.primary} />
          <Text style={[styles.shareToastText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{shareToast}</Text>
        </View>
      ) : null}

      {/* ── Create Post Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowCreatePost(false)}
        onShow={() => { setTimeout(() => composeInputRef.current?.focus(), 150); }}
      >
        <KeyboardAvoidingView
          style={[composeStyles.container, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={[composeStyles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreatePost(false)} style={composeStyles.headerSide}>
              <Text style={[composeStyles.cancelText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[composeStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>New Post</Text>
            <TouchableOpacity onPress={handleSubmitPost} style={[composeStyles.headerSide, { alignItems: "flex-end" }]}>
              <View style={[composeStyles.shareBtn, { backgroundColor: newCaption.trim() ? colors.primary : colors.muted }]}>
                <Text style={[composeStyles.shareBtnText, { color: newCaption.trim() ? colors.primaryForeground : colors.textMuted, fontFamily: "Inter_700Bold" }]}>
                  Share
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={composeStyles.body} keyboardShouldPersistTaps="handled">
            {/* Avatar + Input row */}
            <View style={composeStyles.inputRow}>
              <View style={[composeStyles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }]}>Y</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[composeStyles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder="Share what you cooked…"
                  placeholderTextColor={colors.textMuted}
                  ref={composeInputRef}
                  value={newCaption}
                  onChangeText={setNewCaption}
                  multiline
                  maxLength={280}
                  textAlignVertical="top"
                />
                {/* AI + char counter row */}
                <View style={composeStyles.inputFooter}>
                  <TouchableOpacity onPress={handleAISuggest} style={[composeStyles.aiBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 13 }}>✨</Text>
                    <Text style={[{ fontSize: 11, color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>AI caption</Text>
                  </TouchableOpacity>
                  <Text style={[composeStyles.charCount, {
                    color: newCaption.length >= 270 ? "#E84040" : newCaption.length >= 240 ? "#F5A623" : colors.textMuted,
                    fontFamily: "Inter_400Regular",
                  }]}>{newCaption.length}/280</Text>
                </View>
              </View>
            </View>

            {/* Photo thumbnails */}
            {composerPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={composeStyles.photosRow}>
                {composerPhotos.map((uri, i) => (
                  <View key={i} style={composeStyles.photoThumb}>
                    <Image source={{ uri }} style={composeStyles.photoThumbImg} resizeMode="cover" />
                    <TouchableOpacity
                      style={composeStyles.photoRemove}
                      onPress={() => setComposerPhotos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Feather name="x" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Tags row — cuisine + recipe + location */}
            {(newCuisine || composerRecipe || composerLocation) && (
              <View style={composeStyles.tagsRow}>
                {newCuisine && (
                  <View style={[composeStyles.tag, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50" }]}>
                    <Text style={{ fontSize: 13 }}>{CUISINE_EMOJIS[newCuisine] ?? "🍽️"}</Text>
                    <Text style={[composeStyles.tagText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{newCuisine}</Text>
                    <TouchableOpacity onPress={() => setNewCuisine(undefined)}>
                      <Feather name="x" size={13} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {composerLocation && (
                  <View style={[composeStyles.tag, { backgroundColor: "#4CAF7620", borderColor: "#4CAF7650" }]}>
                    <Feather name="map-pin" size={12} color="#4CAF76" />
                    <Text style={[composeStyles.tagText, { color: "#4CAF76", fontFamily: "Inter_600SemiBold" }]}>{NEAR_ME_SUBURB}</Text>
                    <TouchableOpacity onPress={() => setComposerLocation(false)}>
                      <Feather name="x" size={13} color="#4CAF76" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Linked recipe card */}
            {composerRecipe && (
              <View style={[composeStyles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[composeStyles.recipeCardThumb, { backgroundColor: colors.primary + "20" }]}>
                  {composerRecipe.image ? (
                    <Image source={getRecipeImageSource(composerRecipe.image, composerRecipe.id) as any} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 22 }}>🍽</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }]} numberOfLines={1}>{composerRecipe.title}</Text>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 }]}>Linked recipe</Text>
                </View>
                <TouchableOpacity onPress={() => setComposerRecipe(null)}>
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Toolbar */}
            <View style={[composeStyles.toolbar, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[composeStyles.toolBtn, { backgroundColor: composerPhotos.length >= 4 ? colors.muted : colors.card, borderColor: colors.border, opacity: composerPhotos.length >= 4 ? 0.5 : 1 }]}
                onPress={handlePickPhoto}
                disabled={composerPhotos.length >= 4}
              >
                <Feather name="camera" size={15} color={colors.foreground} />
                <Text style={[composeStyles.toolBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {composerPhotos.length >= 4 ? "Max photos" : "Photo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[composeStyles.toolBtn, { backgroundColor: newCuisine ? colors.primary + "20" : colors.card, borderColor: newCuisine ? colors.primary + "50" : colors.border }]}
                onPress={() => setShowCuisineSheet(true)}
              >
                <Text style={{ fontSize: 14 }}>🏷️</Text>
                <Text style={[composeStyles.toolBtnText, { color: newCuisine ? colors.primary : colors.foreground, fontFamily: "Inter_500Medium" }]}>Cuisine</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[composeStyles.toolBtn, { backgroundColor: composerRecipe ? colors.saveBlue + "20" : colors.card, borderColor: composerRecipe ? colors.saveBlue + "50" : colors.border }]}
                onPress={() => setShowRecipeSheet(true)}
              >
                <Feather name="book-open" size={15} color={composerRecipe ? colors.saveBlue : colors.foreground} />
                <Text style={[composeStyles.toolBtnText, { color: composerRecipe ? colors.saveBlue : colors.foreground, fontFamily: "Inter_500Medium" }]}>Recipe</Text>
              </TouchableOpacity>
            </View>

            {/* Location toggle row */}
            <TouchableOpacity
              style={[composeStyles.locationRow, { borderTopColor: colors.border }]}
              onPress={() => setComposerLocation((v) => !v)}
            >
              <Feather name="map-pin" size={15} color={composerLocation ? "#4CAF76" : colors.textSecondary} />
              <Text style={[composeStyles.locationText, { color: composerLocation ? "#4CAF76" : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                {composerLocation ? `📍 ${NEAR_ME_SUBURB}` : "Add location"}
              </Text>
              {composerLocation && <Feather name="check-circle" size={15} color="#4CAF76" style={{ marginLeft: "auto" }} />}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Cuisine picker (sibling of compose modal, not nested) ─────────────── */}
      <Modal visible={showCuisineSheet} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowCuisineSheet(false)}>
        <View style={[styles.commentModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.createPostHeader, { marginBottom: 16 }]}>
            <TouchableOpacity onPress={() => setShowCuisineSheet(false)}>
              <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.commentModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>Tag Cuisine</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView>
            <View style={styles.cuisineGrid}>
              {COMPOSE_CUISINES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.cuisineGridItem, {
                    backgroundColor: newCuisine === c ? colors.primary : colors.card,
                    borderColor: newCuisine === c ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setNewCuisine(c); setShowCuisineSheet(false); }}
                >
                  <Text style={{ fontSize: 20 }}>{CUISINE_EMOJIS[c] ?? "🍽️"}</Text>
                  <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: newCuisine === c ? colors.primaryForeground : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Recipe picker (sibling of compose modal, not nested) ──────────────── */}
      <Modal visible={showRecipeSheet} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowRecipeSheet(false)}>
        <View style={[styles.commentModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.createPostHeader, { marginBottom: 8 }]}>
            <TouchableOpacity onPress={() => setShowRecipeSheet(false)}>
              <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.commentModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>Link a Recipe</Text>
            <View style={{ width: 60 }} />
          </View>
          <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: "Inter_400Regular", marginBottom: 14 }]}>
            Linking a recipe is optional — you can always add it later.
          </Text>
          {savedRecipesList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32 }}>📖</Text>
              <Text style={[styles.emptyStateTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }]}>No saved recipes yet</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontSize: 13 }]}>Save recipes from the Discover tab to link them here</Text>
            </View>
          ) : (
            <FlatList
              data={savedRecipesList}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item }) => {
                const imgSrc = getRecipeImageSource(item.image, item.id);
                const isSelected = composerRecipe?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[composeStyles.recipePickerItem, {
                      backgroundColor: isSelected ? colors.primary + "15" : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }]}
                    onPress={() => { setComposerRecipe({ id: item.id, title: item.title, image: item.image }); setShowRecipeSheet(false); }}
                  >
                    <View style={[composeStyles.recipePickerThumb, { backgroundColor: colors.muted, overflow: "hidden" }]}>
                      {imgSrc ? (
                        <Image source={imgSrc as any} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 20 }}>🍽</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
                      <Text style={[{ fontSize: 12, color: colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 3 }]}>{item.cuisine} · {item.prepTime + item.cookTime}m</Text>
                    </View>
                    {isSelected && <Feather name="check-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* ── Notifications Modal ──────────────────────────────────────────────── */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowNotifications(false)}>
        <View style={[styles.commentModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.commentModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Notifications</Text>
          {[
            { icon: "heart", color: "#E84040", user: "kimchi_queen", action: "liked your post", time: "2m ago" },
            { icon: "message-circle", color: "#5B8EF5", user: "pasta_lover", action: "commented: \"Looks incredible!\"", time: "15m ago" },
            { icon: "user-plus", color: "#4CAF76", user: "ramen_master", action: "started following you", time: "1h ago" },
          ].map((n, i) => (
            <View key={i} style={[styles.notifRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.notifIcon, { backgroundColor: n.color + "20" }]}>
                <Feather name={n.icon as "heart"} size={16} color={n.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  <Text style={{ fontFamily: "Inter_700Bold" }}>@{n.user} </Text>{n.action}
                </Text>
                <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 }]}>{n.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </Modal>

      {/* ── Comment Modal ────────────────────────────────────────────────────── */}
      <Modal visible={!!commentModalPost} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setCommentModalPost(null)}>
        <View style={[styles.commentModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={[styles.commentModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>Comments</Text>
            <TouchableOpacity onPress={() => setCommentModalPost(null)}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments[commentModalPost?.id || ""] || []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ gap: 14, paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.noComments}>
                <Text style={{ fontSize: 32 }}>💬</Text>
                <Text style={[styles.noCommentsText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>No comments yet. Be first!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <View style={[styles.commentAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.commentAvatarText, { fontFamily: "Inter_700Bold" }]}>{item.avatar}</Text>
                </View>
                <View style={[styles.commentBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.commentUser, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>@{item.user}</Text>
                  <Text style={[styles.commentText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{item.text}</Text>
                  <Text style={[styles.commentTime, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{item.timeAgo}</Text>
                </View>
              </View>
            )}
          />

          <View style={[styles.commentInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.commentInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textMuted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, { backgroundColor: newComment.trim() ? colors.primary : colors.muted }]}
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Feather name="send" size={16} color={newComment.trim() ? colors.primaryForeground : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, letterSpacing: -0.3 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  notifBadge: { position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  notifBadgeText: { fontSize: 9, color: "#fff" },

  filterPanel: { borderBottomWidth: 1 },
  discoveryTabsRow: { height: 46, flexShrink: 0 },
  discoveryTabs: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  discoveryTab: { paddingHorizontal: 16, height: 46, justifyContent: "center", alignItems: "center" },
  discoveryTabText: { fontSize: 14 },
  discoveryTabUnderline: { position: "absolute", bottom: 0, left: 12, right: 12, height: 2, borderRadius: 2 },
  filterDivider: { height: StyleSheet.hairlineWidth },
  cuisineFiltersRow: { height: 44, flexShrink: 0 },
  cuisineFilters: { paddingHorizontal: 16, gap: 7, flexDirection: "row", alignItems: "center" },
  cuisineFilter: { height: 28, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cuisineFilterText: { fontSize: 12 },

  feedContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 16 },

  // Post card
  postCard: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#fff", fontSize: 15 },
  username: { fontSize: 14 },
  timeAgo: { fontSize: 12 },
  distanceText: { fontSize: 11, marginTop: 1 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5 },
  followBtnText: { fontSize: 13 },
  followingFlash: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5 },

  postImageContainer: { width: "100%", aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center" },
  postImage: { width: "100%", height: "100%", position: "absolute" },

  // Trending badge
  trendingBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  trendingBadgeText: { fontSize: 12, color: "#fff", fontFamily: "Inter_700Bold" } as const,

  // Double-tap heart overlay
  heartOverlay: { position: "absolute", alignItems: "center", justifyContent: "center", top: 0, left: 0, right: 0, bottom: 0 },
  heartOverlayEmoji: { fontSize: 80 },

  actionsOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 40 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionItem: { flexDirection: "row", alignItems: "center" },
  actionPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
  actionCount: { fontSize: 13, color: "#fff" },

  captionContainer: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  caption: { fontSize: 14, lineHeight: 20 },
  captionUsername: { fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recipeChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  cuisineChip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  cuisineChipEmoji: { fontSize: 13 },
  cuisineChipText: { fontSize: 12 },
  recipeChipText: { fontSize: 12 },

  // Trending section
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", paddingHorizontal: 0, marginBottom: 10 },
  trendingCuisinesRow: { gap: 10, paddingBottom: 4 },
  trendingCuisineCard: { width: 108, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  trendingCuisineImage: { width: "100%", height: 76 },
  trendingEmojiBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  trendingCuisineLabel: { paddingHorizontal: 8, paddingVertical: 7, gap: 2 },

  // Near Me header
  nearMeHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  suburbPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, marginLeft: "auto" },

  // Empty states
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 14 },
  emptyStateTitle: { fontSize: 20, textAlign: "center" },
  emptyStateText: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  emptyStateCTA: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 100, marginTop: 8 },
  emptyStateCTAText: { fontSize: 15 },

  // Toast
  shareToast: { position: "absolute", bottom: 100, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, borderWidth: 1 },
  shareToastText: { fontSize: 14 },

  // Modals
  commentModal: { flex: 1, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  commentModalTitle: { fontSize: 20, marginBottom: 16 },
  createPostHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 16 },
  createPostCancel: { fontSize: 15 },
  createPostShare: { fontSize: 15 },
  createPostBody: { flexDirection: "row", gap: 12, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  createPostAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  createPostInput: { flex: 1, fontSize: 16, lineHeight: 22, minHeight: 80 },
  createPostFooter: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  createPostChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  selectedCuisineRow: { paddingVertical: 10, paddingHorizontal: 2 },
  selectedCuisineTag: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4 },
  cuisineGridItem: { width: "30%", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },

  notifRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  notifIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  commentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  commentAvatarText: { color: "#fff", fontSize: 13 },
  commentBubble: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  commentUser: { fontSize: 13 },
  commentText: { fontSize: 14, lineHeight: 19 },
  commentTime: { fontSize: 11 },
  noComments: { alignItems: "center", paddingVertical: 40, gap: 10 },
  noCommentsText: { fontSize: 15 },
  commentInput: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  commentInputText: { flex: 1, fontSize: 15, maxHeight: 80 },
  commentSendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

// ─── Compose screen styles ────────────────────────────────────────────────────
const composeStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { minWidth: 70 },
  title: { fontSize: 17, letterSpacing: -0.2 },
  cancelText: { fontSize: 16 },
  shareBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100, alignSelf: "flex-end" },
  shareBtnText: { fontSize: 15 },

  body: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 6 },

  inputRow: { flexDirection: "row", gap: 13, paddingVertical: 16, alignItems: "flex-start" },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: 2 },
  input: { fontSize: 17, lineHeight: 24, minHeight: 100 },
  inputFooter: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  charCount: { fontSize: 13, marginLeft: "auto" },

  photosRow: { gap: 10, paddingVertical: 8, paddingBottom: 12 },
  photoThumb: { width: 90, height: 90, borderRadius: 12, overflow: "hidden", position: "relative" },
  photoThumbImg: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  tagText: { fontSize: 13 },

  recipeCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 14, borderWidth: 1, marginVertical: 8,
  },
  recipeCardThumb: { width: 50, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },

  toolbar: {
    flexDirection: "row", gap: 8, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8,
  },
  toolBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1,
  },
  toolBtnText: { fontSize: 14 },

  locationRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth,
  },
  locationText: { fontSize: 14 },

  recipePickerItem: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 14, borderWidth: 1,
  },
  recipePickerThumb: { width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
