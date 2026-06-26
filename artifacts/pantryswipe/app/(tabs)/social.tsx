import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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

// ── Brand palette ─────────────────────────────────────────────────────────────
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

// ── Cross-platform helpers ────────────────────────────────────────────────────
const cardShadow = Platform.select({
  ios:     { shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24 },
  android: { elevation: 4 },
  web:     { boxShadow: "0 8px 24px rgba(131,85,0,0.08)" },
});

const { width: screenWidth } = Dimensions.get("window");
const CARD_WIDTH = (screenWidth - 16 * 3) / 2;

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

const mockDistance = (id: string): string => {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((h % 48) / 10 + 0.3).toFixed(1);
};

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

// ─── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard({ shimmer }: { shimmer: Animated.Value }) {
  return (
    <Animated.View style={[skeletonStyles.card, { opacity: shimmer }]}>
      <View style={skeletonStyles.header}>
        <View style={skeletonStyles.avatar} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={[skeletonStyles.line, { width: "55%" }]} />
          <View style={[skeletonStyles.line, { width: "30%" }]} />
        </View>
      </View>
      <View style={skeletonStyles.image} />
      <View style={{ padding: 16, gap: 9 }}>
        <View style={skeletonStyles.line} />
        <View style={[skeletonStyles.line, { width: "75%" }]} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card:   { borderRadius: 24, overflow: "hidden", marginHorizontal: 16, marginBottom: 20, backgroundColor: C.surfaceHighest },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.outlineVariant },
  line:   { height: 12, borderRadius: 6, backgroundColor: C.outlineVariant },
  image:  { width: "100%", height: 200, backgroundColor: C.surfaceHigh },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { liveRecipes, savedRecipes, followingList, followUser, isFollowing, toggleSavePost, isPostSaved } = useApp();

  // Scroll-driven header shadow
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerShadow = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 0.10], extrapolate: "clamp" });

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

  // Follow flash confirmations
  const [followedHandles, setFollowedHandles] = useState<Record<string, boolean>>({});

  // Near Me
  const [locationPermission, setLocationPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  // Compose input ref
  const composeInputRef = useRef<TextInput>(null);

  // Double-tap like animation
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const [heartPostId, setHeartPostId] = useState<string | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});

  // Shimmer for skeleton
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

  // ── Trending grouped by cuisine ────────────────────────────────────────────
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

    // Initials avatar color per index
    const avatarColors = [C.primary, "#8B6CF5", "#E84040", C.secondary, "#F59623"];
    const avatarBg = avatarColors[index % avatarColors.length];

    return (
      <View style={styles.postCard}>
        {/* ── Post Header ── */}
        <View style={styles.postHeader}>
          <View style={styles.postHeaderLeft}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>{item.userAvatar}</Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>@{item.username}</Text>
              <Text style={styles.authorMeta}>
                {item.timeAgo}
                {isNearMe ? `  •  📍 ${mockDistance(item.id)} km` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.postHeaderRight}>
            {!isMe && !alreadyFollowing && !justFollowed && (
              <TouchableOpacity
                style={styles.followBtnActive}
                onPress={() => handleFollow(item.username)}
              >
                <Text style={styles.followBtnActiveText}>+ Follow</Text>
              </TouchableOpacity>
            )}
            {!isMe && justFollowed && (
              <View style={styles.followBtnInactive}>
                <Feather name="check" size={12} color={C.textMuted} />
                <Text style={styles.followBtnInactiveText}>Following</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Post Image ── */}
        <Pressable onPress={() => handleDoubleTap(item.id)}>
          <View style={styles.postImageContainer}>
            {imageSource ? (
              <Image source={imageSource} style={styles.postImage} resizeMode="cover" />
            ) : (
              <View style={styles.postImagePlaceholder}>
                <Text style={{ fontSize: 52 }}>{CUISINE_EMOJIS[item.cuisine ?? ""] ?? "🍽"}</Text>
                <Text style={styles.postImagePlaceholderText}>{item.recipeName ?? "Food"}</Text>
              </View>
            )}

            {/* Trending badge */}
            {isTrending && (
              <View style={styles.trendingBadge}>
                <Feather name="zap" size={11} color={C.primary} />
                <Text style={styles.trendingBadgeText}>Trending</Text>
              </View>
            )}

            {/* Double-tap heart overlay */}
            {isHeartShowing && (
              <Animated.View style={[styles.heartOverlay, { opacity: heartAnim, transform: [{ scale: heartScaleAnim }] }]}>
                <Text style={styles.heartOverlayEmoji}>❤️</Text>
              </Animated.View>
            )}
          </View>
        </Pressable>

        {/* ── Actions Row (below image) ── */}
        <View style={styles.actionsRow}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item.id)}>
              <Feather name="heart" size={22} color={item.liked ? C.danger : C.textMuted} />
              <Text style={styles.actionCount}>{formatCount(item.likes)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentModalPost(item)}>
              <Feather name="message-circle" size={22} color={C.textMuted} />
              <Text style={styles.actionCount}>{postComments.length || item.comments}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsRight}>
            <TouchableOpacity style={styles.iconAction} onPress={() => handleShare(item)}>
              <Feather name="share-2" size={22} color={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconAction} onPress={() => handleSave(item.id)}>
              <Feather name="bookmark" size={22} color={savedPost ? C.primary : C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Post Content ── */}
        <View style={styles.postContent}>
          {item.recipeName && (
            <Text style={styles.postTitle} numberOfLines={2}>{item.recipeName}</Text>
          )}
          <Text style={styles.postCaption} numberOfLines={2}>
            <Text style={styles.postCaptionUsername}>@{item.username} </Text>
            {item.caption}
          </Text>

          {/* Tags */}
          {item.cuisine && (
            <View style={styles.tagRow}>
              <View style={styles.cuisineTag}>
                <Text style={styles.cuisineTagText}>{CUISINE_EMOJIS[item.cuisine] ?? "🍽️"} {item.cuisine.toUpperCase()}</Text>
              </View>
            </View>
          )}

          {/* View Recipe CTA */}
          {item.recipeId && (
            <TouchableOpacity
              style={styles.viewRecipeBtn}
              onPress={() => item.recipeId && router.push(`/recipe/${item.recipeId}`)}
            >
              <Text style={styles.viewRecipeBtnText}>View Recipe</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [posts, comments, followingList, followedHandles, heartPostId, activeTab, locationPermission]);

  // ── Sub-components ─────────────────────────────────────────────────────────
  const FollowingEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Feather name="user-plus" size={32} color={C.primary} />
      </View>
      <Text style={styles.emptyTitle}>No one yet</Text>
      <Text style={styles.emptyText}>Follow chefs you love and their posts will appear here</Text>
      <TouchableOpacity style={styles.emptyCTA} onPress={() => setActiveTab("For You")}>
        <Text style={styles.emptyCTAText}>Discover Chefs</Text>
      </TouchableOpacity>
    </View>
  );

  const NearMeDenied = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Feather name="map-pin" size={32} color={C.primary} />
      </View>
      <Text style={styles.emptyTitle}>Location access needed</Text>
      <Text style={styles.emptyText}>Enable location in your settings to see what people are cooking near you</Text>
    </View>
  );

  const NoResults = () => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 44 }}>👨‍🍳</Text>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptyText}>
        {selectedCuisines.length > 0
          ? `No ${selectedCuisines.join(" or ")} posts yet. Be the first to share!`
          : "Nothing here yet."}
      </Text>
    </View>
  );

  const TrendingHeader = () => (
    <View style={{ marginBottom: 8 }}>
      {/* Section accent header */}
      <View style={styles.sectionAccentRow}>
        <View style={styles.sectionAccentBar} />
        <Text style={styles.sectionAccentLabel}>TRENDING CUISINES</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 4 }}>
        {trendingByCuisine.map((p, i) => {
          const imgSrc = getSocialImageSource(p.image, i, undefined);
          const cuisineColors = ["#F4E6D8", "#E8F4E8", "#E8E8F4", "#F4E8E8", "#F4F0E4"];
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.cuisineCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/cuisine/${encodeURIComponent(p.cuisine ?? "")}`); }}
              activeOpacity={0.85}
            >
              <View style={styles.cuisineCardImage}>
                {imgSrc ? (
                  <Image source={imgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: cuisineColors[i % cuisineColors.length], alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontSize: 40 }}>{CUISINE_EMOJIS[p.cuisine ?? ""] ?? "🍽"}</Text>
                  </View>
                )}
              </View>
              <View style={styles.cuisineCardBody}>
                <Text style={styles.cuisineCardName} numberOfLines={1}>{p.cuisine ?? "Mixed"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="zap" size={12} color={C.primary} />
                  <Text style={styles.cuisineCardCount}>{formatCount(p.likes)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Divider + "All Trending" label */}
      <View style={styles.trendingDivider} />
      <View style={[styles.sectionAccentRow, { marginBottom: 4 }]}>
        <View style={[styles.sectionAccentBar, { backgroundColor: C.outlineVariant }]} />
        <Text style={[styles.sectionAccentLabel, { color: C.textMuted }]}>ALL TRENDING</Text>
      </View>
    </View>
  );

  const NearMeHeader = () => (
    <View style={styles.nearMeHeader}>
      <View style={styles.nearMeAccentBar} />
      <View style={styles.nearMeInner}>
        <View style={styles.nearMeIconBox}>
          <Feather name="map-pin" size={14} color={C.secondary} />
        </View>
        <Text style={styles.nearMeText}>Showing results near you</Text>
        <View style={styles.nearMeSuburbPill}>
          <Text style={styles.nearMeSuburbText}>{NEAR_ME_SUBURB}</Text>
        </View>
      </View>
    </View>
  );

  const emptyComponent = useMemo(() => {
    if (activeTab === "Following" && filteredPosts.length === 0 && selectedCuisines.length === 0) {
      return <FollowingEmpty />;
    }
    if (activeTab === "Near Me" && locationPermission === "denied") {
      return <NearMeDenied />;
    }
    return <NoResults />;
  }, [activeTab, filteredPosts.length, selectedCuisines.length, locationPermission]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>

      {/* ── HEADER ── */}
      <Animated.View style={[styles.header, { paddingTop: topPadding + 8, shadowOpacity: headerShadow }]}>
        {/* Left: compose button */}
        <TouchableOpacity style={styles.headerComposeBtn} onPress={openCompose}>
          <Feather name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Center: title */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>FOOD COMMUNITY</Text>
          <Text style={styles.headerTitle}>Social</Text>
        </View>

        {/* Right: notifications */}
        <View style={{ position: "relative" }}>
          <TouchableOpacity
            style={styles.headerNotifBtn}
            onPress={() => { setShowNotifications(true); setNotifCount(0); }}
          >
            <Feather name="heart" size={20} color={C.textMuted} />
          </TouchableOpacity>
          {notifCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{notifCount}</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── TAB BAR ── */}
      <View style={styles.tabBar}>
        {DISCOVERY_TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextInactive]}>
                {tab}
              </Text>
              {active && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── CUISINE FILTER PILLS ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillStrip}
        style={styles.pillScrollView}
      >
        {CUISINE_FILTERS.map((c) => {
          const active = isCuisineActive(c);
          return (
            <TouchableOpacity
              key={c}
              style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillInactive]}
              onPress={() => toggleCuisine(c)}
            >
              <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── FEED ── */}
      {isLoading ? (
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <SkeletonCard shimmer={shimmerAnim} />
          <SkeletonCard shimmer={shimmerAnim} />
          <SkeletonCard shimmer={shimmerAnim} />
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
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
          ListHeaderComponent={
            activeTab === "Trending" && filteredPosts.length > 0 ? <TrendingHeader /> :
            activeTab === "Near Me" && locationPermission === "granted" ? <NearMeHeader /> : null
          }
          ListEmptyComponent={emptyComponent}
        />
      )}

      {/* ── SHARE TOAST ── */}
      {shareToast ? (
        <View style={styles.shareToast}>
          <Feather name="check" size={16} color="#FFFFFF" />
          <Text style={styles.shareToastText}>{shareToast}</Text>
        </View>
      ) : null}

      {/* ── CREATE POST MODAL ── */}
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowCreatePost(false)}
        onShow={() => { setTimeout(() => composeInputRef.current?.focus(), 150); }}
      >
        <KeyboardAvoidingView
          style={[composeStyles.container, { backgroundColor: C.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={[composeStyles.header, { borderBottomColor: C.outlineVariant }]}>
            <TouchableOpacity onPress={() => setShowCreatePost(false)} style={composeStyles.headerSide}>
              <Text style={[composeStyles.cancelText, { color: C.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={composeStyles.title}>New Post</Text>
            <TouchableOpacity onPress={handleSubmitPost} style={[composeStyles.headerSide, { alignItems: "flex-end" }]}>
              <View style={[composeStyles.shareBtn, { backgroundColor: newCaption.trim() ? C.primary : C.surfaceHighest }]}>
                <Text style={[composeStyles.shareBtnText, { color: newCaption.trim() ? "#FFFFFF" : C.textMuted }]}>Share</Text>
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={composeStyles.body} keyboardShouldPersistTaps="handled">
            <View style={composeStyles.inputRow}>
              <View style={[composeStyles.avatar, { backgroundColor: C.primary }]}>
                <Text style={[{ color: "#fff", fontSize: 16, fontFamily: "Epilogue_700Bold" }]}>Y</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[composeStyles.input, { color: C.textPrimary }]}
                  placeholder="Share what you cooked…"
                  placeholderTextColor={C.textMuted}
                  ref={composeInputRef}
                  value={newCaption}
                  onChangeText={setNewCaption}
                  multiline
                  maxLength={280}
                  textAlignVertical="top"
                />
                <View style={composeStyles.inputFooter}>
                  <TouchableOpacity onPress={handleAISuggest} style={[composeStyles.aiBtn, { backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }]}>
                    <Text style={{ fontSize: 13 }}>✨</Text>
                    <Text style={[{ fontSize: 11, color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>AI caption</Text>
                  </TouchableOpacity>
                  <Text style={[composeStyles.charCount, {
                    color: newCaption.length >= 270 ? C.danger : newCaption.length >= 240 ? C.primary : C.textMuted,
                    fontFamily: "Epilogue_400Regular",
                  }]}>{newCaption.length}/280</Text>
                </View>
              </View>
            </View>

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

            {(newCuisine || composerRecipe || composerLocation) && (
              <View style={composeStyles.tagsRow}>
                {newCuisine && (
                  <View style={[composeStyles.tag, { backgroundColor: C.primary + "20", borderColor: C.primary + "50" }]}>
                    <Text style={{ fontSize: 13 }}>{CUISINE_EMOJIS[newCuisine] ?? "🍽️"}</Text>
                    <Text style={[composeStyles.tagText, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>{newCuisine}</Text>
                    <TouchableOpacity onPress={() => setNewCuisine(undefined)}>
                      <Feather name="x" size={13} color={C.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {composerLocation && (
                  <View style={[composeStyles.tag, { backgroundColor: C.secondary + "20", borderColor: C.secondary + "50" }]}>
                    <Feather name="map-pin" size={12} color={C.secondary} />
                    <Text style={[composeStyles.tagText, { color: C.secondary, fontFamily: "Epilogue_700Bold" }]}>{NEAR_ME_SUBURB}</Text>
                    <TouchableOpacity onPress={() => setComposerLocation(false)}>
                      <Feather name="x" size={13} color={C.secondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {composerRecipe && (
              <View style={[composeStyles.recipeCard, { backgroundColor: C.surface, borderColor: C.outlineVariant }]}>
                <View style={[composeStyles.recipeCardThumb, { backgroundColor: C.surfaceLow }]}>
                  {composerRecipe.image ? (
                    <Image source={getRecipeImageSource(composerRecipe.image, composerRecipe.id) as any} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 22 }}>🍽</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.textPrimary }]} numberOfLines={1}>{composerRecipe.title}</Text>
                  <Text style={[{ fontSize: 11, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 }]}>Linked recipe</Text>
                </View>
                <TouchableOpacity onPress={() => setComposerRecipe(null)}>
                  <Feather name="x" size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            <View style={[composeStyles.toolbar, { borderTopColor: C.outlineVariant }]}>
              <TouchableOpacity
                style={[composeStyles.toolBtn, { backgroundColor: composerPhotos.length >= 4 ? C.surfaceHighest : C.surface, borderColor: C.outlineVariant, opacity: composerPhotos.length >= 4 ? 0.5 : 1 }]}
                onPress={handlePickPhoto}
                disabled={composerPhotos.length >= 4}
              >
                <Feather name="camera" size={15} color={C.textPrimary} />
                <Text style={[composeStyles.toolBtnText, { color: C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>
                  {composerPhotos.length >= 4 ? "Max photos" : "Photo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[composeStyles.toolBtn, { backgroundColor: newCuisine ? C.primary + "20" : C.surface, borderColor: newCuisine ? C.primary + "50" : C.outlineVariant }]}
                onPress={() => setShowCuisineSheet(true)}
              >
                <Text style={{ fontSize: 14 }}>🏷️</Text>
                <Text style={[composeStyles.toolBtnText, { color: newCuisine ? C.primary : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>Cuisine</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[composeStyles.toolBtn, { backgroundColor: composerRecipe ? C.saveBlue + "20" : C.surface, borderColor: composerRecipe ? C.saveBlue + "50" : C.outlineVariant }]}
                onPress={() => setShowRecipeSheet(true)}
              >
                <Feather name="book-open" size={15} color={composerRecipe ? C.saveBlue : C.textPrimary} />
                <Text style={[composeStyles.toolBtnText, { color: composerRecipe ? C.saveBlue : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>Recipe</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[composeStyles.locationRow, { borderTopColor: C.outlineVariant }]}
              onPress={() => setComposerLocation((v) => !v)}
            >
              <Feather name="map-pin" size={15} color={composerLocation ? C.secondary : C.textMuted} />
              <Text style={[composeStyles.locationText, { color: composerLocation ? C.secondary : C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                {composerLocation ? `📍 ${NEAR_ME_SUBURB}` : "Add location"}
              </Text>
              {composerLocation && <Feather name="check-circle" size={15} color={C.secondary} style={{ marginLeft: "auto" }} />}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CUISINE PICKER MODAL ── */}
      <Modal visible={showCuisineSheet} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowCuisineSheet(false)}>
        <View style={[styles.sheetModal, { backgroundColor: C.background }]}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetHeader, { marginBottom: 16 }]}>
            <TouchableOpacity onPress={() => setShowCuisineSheet(false)}>
              <Text style={[styles.sheetCancelText, { color: C.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Tag Cuisine</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView>
            <View style={styles.cuisineGrid}>
              {COMPOSE_CUISINES.map((c) => {
                const selected = newCuisine === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.cuisineGridItem, {
                      backgroundColor: selected ? C.primary + "20" : C.surface,
                      borderColor: selected ? C.primary : C.outlineVariant,
                    }]}
                    onPress={() => { setNewCuisine(c); setShowCuisineSheet(false); }}
                  >
                    <Text style={{ fontSize: 26 }}>{CUISINE_EMOJIS[c] ?? "🍽️"}</Text>
                    <Text style={[styles.cuisineGridItemText, { color: selected ? C.primary : C.textPrimary }]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── RECIPE PICKER MODAL ── */}
      <Modal visible={showRecipeSheet} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowRecipeSheet(false)}>
        <View style={[styles.sheetModal, { backgroundColor: C.background }]}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetHeader, { marginBottom: 12 }]}>
            <TouchableOpacity onPress={() => setShowRecipeSheet(false)}>
              <Text style={[styles.sheetCancelText, { color: C.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Link a Recipe</Text>
            <View style={{ width: 60 }} />
          </View>
          <FlatList
            data={savedRecipesList}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ gap: 10, padding: 16 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 36 }}>🍽</Text>
                <Text style={styles.emptyTitle}>No saved recipes</Text>
                <Text style={styles.emptyText}>Save recipes from Discover to link them to your posts</Text>
              </View>
            }
            renderItem={({ item }) => {
              const imgSrc = item.image ? { uri: item.image } : null;
              return (
                <TouchableOpacity
                  style={[styles.recipePickerItem, { backgroundColor: C.surface, borderColor: C.outlineVariant }]}
                  onPress={() => {
                    setComposerRecipe({ id: item.id, title: item.title, image: item.image ?? null });
                    setShowRecipeSheet(false);
                  }}
                >
                  <View style={[styles.recipePickerThumb, { backgroundColor: C.surfaceLow }]}>
                    {imgSrc ? (
                      <Image source={imgSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 24 }}>🍽</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recipePickerTitle]} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.recipePickerMeta}>{item.cuisine} · {item.calories} kcal</Text>
                  </View>
                  <Feather name="plus-circle" size={20} color={C.primary} />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowNotifications(false)}>
        <View style={[styles.sheetModal, { backgroundColor: C.background }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { marginBottom: 16 }]}>Notifications</Text>
          {[
            { icon: "heart", color: C.danger, user: "kimchi_queen", action: "liked your post", time: "2m ago" },
            { icon: "message-circle", color: C.saveBlue, user: "pasta_lover", action: "commented: \"Looks incredible!\"", time: "15m ago" },
            { icon: "user-plus", color: C.secondary, user: "ramen_master", action: "started following you", time: "1h ago" },
          ].map((n, i) => (
            <View key={i} style={[styles.notifRow, { borderBottomColor: C.outlineVariant }]}>
              <View style={[styles.notifIconCircle, { backgroundColor: n.color + "20" }]}>
                <Feather name={n.icon as "heart"} size={16} color={n.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifText}>
                  <Text style={styles.notifUser}>@{n.user} </Text>{n.action}
                </Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </Modal>

      {/* ── COMMENT MODAL ── */}
      <Modal visible={!!commentModalPost} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setCommentModalPost(null)}>
        <View style={[styles.sheetModal, { backgroundColor: C.background }]}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={[styles.sheetTitle, { marginBottom: 0 }]}>Comments</Text>
            <TouchableOpacity onPress={() => setCommentModalPost(null)}>
              <Feather name="x" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments[commentModalPost?.id || ""] || []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ gap: 14, paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.noComments}>
                <Text style={{ fontSize: 32 }}>💬</Text>
                <Text style={styles.noCommentsText}>No comments yet. Be first!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <View style={[styles.commentAvatar, { backgroundColor: C.primary }]}>
                  <Text style={styles.commentAvatarText}>{item.avatar}</Text>
                </View>
                <View style={[styles.commentBubble, { backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }]}>
                  <Text style={styles.commentUser}>@{item.user}</Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                  <Text style={styles.commentTime}>{item.timeAgo}</Text>
                </View>
              </View>
            )}
          />

          <View style={[styles.commentInput, { backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }]}>
            <TextInput
              style={styles.commentInputText}
              placeholder="Add a comment…"
              placeholderTextColor={C.textMuted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, { backgroundColor: newComment.trim() ? C.primary : C.surfaceHighest }]}
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Feather name="send" size={16} color={newComment.trim() ? "#FFFFFF" : C.textMuted} />
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

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingBottom: 12, zIndex: 50,
    backgroundColor: "rgba(250,250,248,0.97)",
    shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
  },
  headerComposeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  headerCenter:    { alignItems: "center", gap: 1 },
  headerEyebrow:   { fontSize: 11, letterSpacing: 2, fontFamily: "Epilogue_700Bold", color: C.textMuted, textTransform: "uppercase" },
  headerTitle:     { fontSize: 28, letterSpacing: -0.5, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  headerNotifBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surfaceHighest, alignItems: "center", justifyContent: "center" },
  notifBadge:      { position: "absolute", top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, borderWidth: 2, borderColor: C.background, alignItems: "center", justifyContent: "center" },
  notifBadgeText:  { fontSize: 10, fontFamily: "Epilogue_700Bold", color: C.onPrimaryContainer, textAlign: "center" },

  // Tab bar
  tabBar:       { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 0, borderBottomWidth: 0.5, borderBottomColor: C.outlineVariant },
  tabItem:      { flex: 1, alignItems: "center", paddingVertical: 10, minHeight: 44 },
  tabText:      { fontSize: 14 },
  tabTextActive: { fontFamily: "Epilogue_700Bold", color: C.primary },
  tabTextInactive: { fontFamily: "Epilogue_400Regular", color: C.textMuted },
  tabUnderline:  { height: 3, width: "60%", borderRadius: 2, backgroundColor: C.primary, marginTop: 4, alignSelf: "center" },

  // Cuisine filter pills
  pillScrollView: { flexGrow: 0, flexShrink: 0 },
  pillStrip:      { paddingHorizontal: 16, gap: 10, paddingVertical: 12, alignItems: "center" },
  filterPill:     { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
  filterPillActive:   { backgroundColor: C.primary },
  filterPillInactive: { backgroundColor: C.surfaceHighest, borderWidth: 1, borderColor: C.outlineVariant },
  filterPillText:     { fontSize: 13 },
  filterPillTextActive:   { fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },
  filterPillTextInactive: { fontFamily: "Epilogue_400Regular", color: C.textMuted },

  // Feed
  feedContent: { paddingTop: 8, paddingBottom: 100 },

  // Post card
  postCard:      { backgroundColor: C.surface, borderRadius: 24, overflow: "hidden", marginHorizontal: 16, marginBottom: 20, ...cardShadow },
  postHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  postHeaderLeft: { flexDirection: "row", gap: 14, alignItems: "center", flex: 1 },
  postHeaderRight: { alignItems: "flex-end" },
  avatar:        { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText:    { color: "#fff", fontSize: 16, fontFamily: "Epilogue_700Bold" },
  authorInfo:    { flex: 1 },
  authorName:    { fontSize: 14, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  authorMeta:    { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted, marginTop: 1 },

  // Follow buttons
  followBtnActive:     { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, minHeight: 44, justifyContent: "center" },
  followBtnActiveText: { fontFamily: "Epilogue_700Bold", fontSize: 13, color: "#FFFFFF" },
  followBtnInactive:   { backgroundColor: C.surfaceHighest, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, justifyContent: "center" },
  followBtnInactiveText: { fontFamily: "Epilogue_700Bold", fontSize: 13, color: C.textMuted },

  // Post image
  postImageContainer:     { width: "100%", height: 300, backgroundColor: C.surfaceHigh },
  postImage:              { width: "100%", height: "100%", position: "absolute" },
  postImagePlaceholder:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  postImagePlaceholderText: { color: C.textMuted, fontSize: 13, fontFamily: "Epilogue_400Regular" },

  // Trending badge
  trendingBadge:     { position: "absolute", top: 12, left: 12, backgroundColor: C.surfaceLow, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  trendingBadgeText: { fontSize: 12, fontFamily: "Epilogue_700Bold", color: C.primary },

  // Heart overlay
  heartOverlay:      { position: "absolute", alignItems: "center", justifyContent: "center", top: 0, left: 0, right: 0, bottom: 0 },
  heartOverlayEmoji: { fontSize: 80 },

  // Actions row (below image)
  actionsRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16 },
  actionsLeft:  { flexDirection: "row", gap: 20 },
  actionsRight: { flexDirection: "row", gap: 16 },
  actionBtn:    { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  actionCount:  { fontFamily: "Epilogue_700Bold", fontSize: 14, color: C.textPrimary },
  iconAction:   { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },

  // Post content
  postContent:   { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12 },
  postTitle:     { fontFamily: "Epilogue_700Bold", fontSize: 20, color: C.textPrimary, marginBottom: 8, letterSpacing: -0.3 },
  postCaption:   { fontFamily: "Epilogue_400Regular", fontSize: 15, color: C.textMuted, lineHeight: 22, marginBottom: 12 },
  postCaptionUsername: { fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  tagRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  cuisineTag:    { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.surfaceHigh, borderRadius: 8 },
  cuisineTagText: { fontSize: 11, fontFamily: "Epilogue_700Bold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  viewRecipeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, alignSelf: "flex-start", shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4, minHeight: 44 },
  viewRecipeBtnText: { fontFamily: "Epilogue_700Bold", fontSize: 13, color: "#FFFFFF" },

  // Trending cuisine cards
  sectionAccentRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, paddingHorizontal: 16 },
  sectionAccentBar:  { width: 4, height: 24, borderRadius: 2, backgroundColor: C.primary },
  sectionAccentLabel: { fontFamily: "Epilogue_700Bold", fontSize: 12, letterSpacing: 1.8, color: C.textMuted, textTransform: "uppercase" },
  cuisineCard:       { width: 176, borderRadius: 16, overflow: "hidden", backgroundColor: C.surfaceHigh, ...cardShadow },
  cuisineCardImage:  { width: 176, height: 128, backgroundColor: C.surfaceHigh },
  cuisineCardBody:   { padding: 10 },
  cuisineCardName:   { fontFamily: "Epilogue_700Bold", fontSize: 16, color: C.textPrimary, marginBottom: 4 },
  cuisineCardCount:  { fontFamily: "Epilogue_700Bold", fontSize: 12, color: C.primary },
  trendingDivider:   { height: StyleSheet.hairlineWidth, backgroundColor: C.outlineVariant, marginVertical: 10, marginHorizontal: 16 },

  // Near Me header
  nearMeHeader:    { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(76,175,118,0.06)", borderColor: "rgba(76,175,118,0.25)", borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: "hidden" },
  nearMeAccentBar: { width: 4, alignSelf: "stretch", backgroundColor: C.secondary },
  nearMeInner:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  nearMeIconBox:   { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(76,175,118,0.15)", alignItems: "center", justifyContent: "center" },
  nearMeText:      { flex: 1, fontSize: 13, color: C.textPrimary, fontFamily: "Epilogue_400Regular" },
  nearMeSuburbPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, backgroundColor: "rgba(76,175,118,0.15)", borderColor: "rgba(76,175,118,0.35)" },
  nearMeSuburbText: { fontSize: 11, color: C.secondary, fontFamily: "Epilogue_700Bold" },

  // Empty states
  emptyState:     { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 14 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surfaceLow, alignItems: "center", justifyContent: "center" },
  emptyTitle:     { fontSize: 20, textAlign: "center", fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  emptyText:      { fontSize: 14, textAlign: "center", lineHeight: 21, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  emptyCTA:       { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 100, marginTop: 8, backgroundColor: C.primary, minHeight: 44 },
  emptyCTAText:   { fontSize: 15, fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },

  // Share toast
  shareToast:     { position: "absolute", bottom: 100, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, backgroundColor: C.primary },
  shareToastText: { fontSize: 14, fontFamily: "Epilogue_700Bold", color: "#FFFFFF" },

  // Sheet modals (cuisine/recipe/notifications/comments)
  sheetModal:    { flex: 1, padding: 20 },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16, backgroundColor: C.outlineVariant },
  sheetHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle:    { fontSize: 20, fontFamily: "Epilogue_700Bold", color: C.textPrimary, textAlign: "center", flex: 1 },
  sheetCancelText: { fontSize: 15, fontFamily: "Epilogue_400Regular" },

  // Cuisine picker grid
  cuisineGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4 },
  cuisineGridItem:   { width: "30%", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  cuisineGridItemText: { fontSize: 12, fontFamily: "Epilogue_700Bold", textAlign: "center" },

  // Recipe picker
  recipePickerItem:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  recipePickerThumb: { width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  recipePickerTitle: { fontSize: 14, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  recipePickerMeta:  { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted, marginTop: 2 },

  // Notifications
  notifRow:       { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  notifIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  notifText:      { fontSize: 14, fontFamily: "Epilogue_400Regular", color: C.textPrimary },
  notifUser:      { fontFamily: "Epilogue_700Bold" },
  notifTime:      { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted, marginTop: 2 },

  // Comments
  noComments:      { alignItems: "center", paddingVertical: 40, gap: 10 },
  noCommentsText:  { fontSize: 15, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  commentRow:      { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  commentAvatar:   { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  commentAvatarText: { color: "#fff", fontSize: 13, fontFamily: "Epilogue_700Bold" },
  commentBubble:   { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  commentUser:     { fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.primary },
  commentText:     { fontSize: 14, lineHeight: 19, fontFamily: "Epilogue_400Regular", color: C.textPrimary },
  commentTime:     { fontSize: 11, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  commentInput:    { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  commentInputText: { flex: 1, fontSize: 15, maxHeight: 80, fontFamily: "Epilogue_400Regular", color: C.textPrimary },
  commentSendBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

// ─── Compose screen styles ────────────────────────────────────────────────────
const composeStyles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide: { minWidth: 70 },
  title:      { fontSize: 17, fontFamily: "Epilogue_700Bold", color: C.textPrimary, letterSpacing: -0.2, textAlign: "center", flex: 1 },
  cancelText: { fontSize: 16, fontFamily: "Epilogue_400Regular" },
  shareBtn:   { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100, alignSelf: "flex-end" },
  shareBtnText: { fontSize: 15, fontFamily: "Epilogue_700Bold" },

  body:       { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 6 },

  inputRow:   { flexDirection: "row", gap: 13, paddingVertical: 16, alignItems: "flex-start" },
  avatar:     { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: 2 },
  input:      { fontSize: 17, lineHeight: 24, minHeight: 100, fontFamily: "Epilogue_400Regular" },
  inputFooter: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  aiBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  charCount:  { fontSize: 13, marginLeft: "auto" },

  photosRow:    { gap: 10, paddingVertical: 8, paddingBottom: 12 },
  photoThumb:   { width: 90, height: 90, borderRadius: 12, overflow: "hidden", position: "relative" },
  photoThumbImg: { width: "100%", height: "100%" },
  photoRemove:  { position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },

  tagsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 6 },
  tag:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  tagText:    { fontSize: 13 },

  recipeCard:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginVertical: 8 },
  recipeCardThumb: { width: 50, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },

  toolbar:     { flexDirection: "row", gap: 8, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  toolBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1 },
  toolBtnText: { fontSize: 14 },

  locationRow:  { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  locationText: { fontSize: 14 },
});
