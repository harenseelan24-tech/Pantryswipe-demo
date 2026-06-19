import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_SOCIAL_POSTS, SocialPost } from "@/data/mockData";
import { getSocialImageSource } from "@/constants/recipeImages";

const DISCOVERY_TABS = ["For You", "Following", "Trending", "Near Me"];
const CUISINE_FILTERS = ["All", "Italian", "Japanese", "Korean", "Indian", "Mexican", "Thai", "Vegan"];

type Comment = { id: string; user: string; text: string; avatar: string; timeAgo: string };

const SEED_COMMENTS: Record<string, Comment[]> = {
  s1: [
    { id: "c1", user: "pasta_lover", text: "This looks incredible! What brand of pancetta do you use?", avatar: "P", timeAgo: "1h ago" },
    { id: "c2", user: "homecook22", text: "Made this last night, absolute perfection 🍝", avatar: "H", timeAgo: "45m ago" },
  ],
  s2: [
    { id: "c1", user: "seafood_fan", text: "The garlic butter sauce really makes it!", avatar: "S", timeAgo: "2h ago" },
  ],
  s3: [],
  s4: [{ id: "c1", user: "kfoodie", text: "Stone pot is a MUST, you're 100% right!", avatar: "K", timeAgo: "3h ago" }],
  s5: [],
};

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", Vietnamese: "🍜", Singaporean: "🦀",
};

export default function SocialScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { liveRecipes } = useApp();
  const [activeTab, setActiveTab] = useState("For You");
  const [activeCuisine, setActiveCuisine] = useState("All");
  const [posts, setPosts] = useState<SocialPost[]>(MOCK_SOCIAL_POSTS);
  const [comments, setComments] = useState<Record<string, Comment[]>>(SEED_COMMENTS);
  const [commentModalPost, setCommentModalPost] = useState<SocialPost | null>(null);
  const [newComment, setNewComment] = useState("");
  const [shareToast, setShareToast] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [newCaption, setNewCaption] = useState("");
  const [notifCount, setNotifCount] = useState(3);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const FOLLOWING_IDS = ["s2", "s4", "s7", "s10", "s12", "s14"];
  const NEAR_ME_IDS = ["s1", "s3", "s5", "s6", "s11", "s13"];

  const filteredPosts = useMemo(() => {
    let result = [...posts];
    if (activeTab === "Following") result = result.filter((p) => FOLLOWING_IDS.includes(p.id));
    else if (activeTab === "Trending") result = result.sort((a, b) => b.likes - a.likes);
    else if (activeTab === "Near Me") result = result.filter((p) => NEAR_ME_IDS.includes(p.id));
    if (activeCuisine !== "All") result = result.filter((p) => p.cuisine === activeCuisine);
    return result;
  }, [posts, activeTab, activeCuisine]);

  const toggleLike = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const toggleSave = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, saved: !p.saved } : p));
  };

  const handleShare = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
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

  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  const renderPost = ({ item, index }: { item: SocialPost; index: number }) => {
    const linkedRecipe = item.recipeId
      ? liveRecipes.find((r) => r.id === item.recipeId || r.id === `api_${item.recipeId}`)
      : undefined;
    const imageSource = getSocialImageSource(item.image, index, linkedRecipe?.id);
    const postComments = comments[item.id] || [];

    return (
      <View style={[styles.postCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.userAvatarText, { fontFamily: "Inter_700Bold" }]}>{item.userAvatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.username, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>@{item.username}</Text>
            <Text style={[styles.timeAgo, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.timeAgo}</Text>
          </View>
          <TouchableOpacity style={[styles.followBtn, { borderColor: colors.primary }]}>
            <Text style={[styles.followBtnText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>Follow</Text>
          </TouchableOpacity>
        </View>

        {/* Image with overlaid actions */}
        <View style={[styles.postImageContainer, { backgroundColor: colors.muted }]}>
          {imageSource ? (
            <Image source={imageSource} style={styles.postImage} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Text style={{ fontSize: 52 }}>{CUISINE_EMOJIS[item.recipeName?.split(" ").pop() ?? ""] ?? "🍽"}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" }}>{item.recipeName ?? "Food"}</Text>
            </View>
          )}
          {/* Actions overlaid on bottom of image */}
          <View style={styles.actionsOverlay}>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionItem} onPress={() => toggleLike(item.id)}>
                <View style={[styles.actionPill, { backgroundColor: item.liked ? "#E84040" : "rgba(0,0,0,0.45)" }]}>
                  <Feather name="heart" size={18} color="#fff" />
                  <Text style={[styles.actionCount, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>{formatCount(item.likes)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => { setCommentModalPost(item); }}>
                <View style={[styles.actionPill, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <Feather name="message-circle" size={18} color="#fff" />
                  <Text style={[styles.actionCount, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>{(postComments.length || item.comments)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={handleShare}>
                <View style={[styles.actionPill, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <Feather name="share-2" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => toggleSave(item.id)}>
                <View style={[styles.actionPill, { backgroundColor: item.saved ? colors.saveBlue : "rgba(0,0,0,0.45)" }]}>
                  <Feather name="bookmark" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Caption */}
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
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        {/* Left — new post */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => { setNewCaption(""); setShowCreatePost(true); }}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>

        {/* Center — title */}
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Social</Text>

        {/* Right — heart notifications */}
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

      {/* Filter panel */}
      <View style={[styles.filterPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* Discovery tabs — underline style */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoveryTabsRow} contentContainerStyle={styles.discoveryTabs}>
          {DISCOVERY_TABS.map((tab) => (
            <TouchableOpacity key={tab} style={styles.discoveryTab} onPress={() => setActiveTab(tab)}>
              <Text style={[
                styles.discoveryTabText,
                {
                  color: activeTab === tab ? colors.foreground : colors.textSecondary,
                  fontFamily: activeTab === tab ? "Inter_700Bold" : "Inter_500Medium",
                },
              ]}>{tab}</Text>
              {activeTab === tab && <View style={[styles.discoveryTabUnderline, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Hairline */}
        <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

        {/* Cuisine chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cuisineFiltersRow} contentContainerStyle={styles.cuisineFilters}>
          {CUISINE_FILTERS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.cuisineFilter,
                activeCuisine === c
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.background, borderColor: colors.border },
              ]}
              onPress={() => setActiveCuisine(c)}
            >
              <Text style={[styles.cuisineFilterText, { color: activeCuisine === c ? colors.primaryForeground : colors.foreground, fontFamily: activeCuisine === c ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(i) => i.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
        ListEmptyComponent={
          <View style={styles.emptyFeed}>
            <Text style={[styles.emptyFeedText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
              No {activeCuisine !== "All" ? activeCuisine : ""} posts yet
            </Text>
          </View>
        }
      />

      {/* Share toast */}
      {shareToast && (
        <View style={[styles.shareToast, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check" size={16} color={colors.primary} />
          <Text style={[styles.shareToastText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Link copied to clipboard!</Text>
        </View>
      )}

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowCreatePost(false)}>
        <View style={[styles.commentModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.createPostHeader}>
            <TouchableOpacity onPress={() => setShowCreatePost(false)}>
              <Text style={[styles.createPostCancel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.commentModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>New Post</Text>
            <TouchableOpacity
              onPress={() => {
                if (!newCaption.trim()) return;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const newPost: SocialPost = {
                  id: `s_user_${Date.now()}`,
                  username: "you",
                  userAvatar: "Y",
                  image: null,
                  caption: newCaption.trim(),
                  likes: 0,
                  comments: 0,
                  timeAgo: "just now",
                  liked: false,
                  saved: false,
                  cuisine: activeCuisine !== "All" ? activeCuisine : undefined,
                };
                setPosts((prev) => [newPost, ...prev]);
                setShowCreatePost(false);
                setNewCaption("");
              }}
            >
              <Text style={[styles.createPostShare, { color: newCaption.trim() ? colors.primary : colors.textMuted, fontFamily: "Inter_700Bold" }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.createPostBody, { borderColor: colors.border }]}>
            <View style={[styles.createPostAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.userAvatarText, { fontFamily: "Inter_700Bold" }]}>Y</Text>
            </View>
            <TextInput
              style={[styles.createPostInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Share what you cooked…"
              placeholderTextColor={colors.textMuted}
              value={newCaption}
              onChangeText={setNewCaption}
              multiline
              autoFocus
              maxLength={280}
            />
          </View>

          <View style={[styles.createPostFooter, { borderTopColor: colors.border }]}>
            <View style={[styles.createPostChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="image" size={14} color={colors.textSecondary} />
              <Text style={[{ fontSize: 13, color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Photo</Text>
            </View>
            <View style={[styles.createPostChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="tag" size={14} color={colors.textSecondary} />
              <Text style={[{ fontSize: 13, color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Recipe</Text>
            </View>
            <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: "Inter_400Regular", marginLeft: "auto" }]}>{newCaption.length}/280</Text>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
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
                <Feather name={n.icon as any} size={16} color={n.color} />
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

      {/* Comment Modal */}
      <Modal visible={!!commentModalPost} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setCommentModalPost(null)}>
        <View style={[styles.commentModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.commentModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Comments</Text>

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, letterSpacing: -0.3 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  notifBadge: { position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  notifBadgeText: { fontSize: 9, color: "#fff" },
  createPostHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  createPostCancel: { fontSize: 15 },
  createPostShare: { fontSize: 15 },
  createPostBody: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  createPostAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  createPostInput: { flex: 1, fontSize: 16, lineHeight: 22, minHeight: 80 },
  createPostFooter: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  createPostChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  notifIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  filterPanel: { borderBottomWidth: 1 },
  discoveryTabsRow: { height: 46, flexShrink: 0 },
  discoveryTabs: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  discoveryTab: { paddingHorizontal: 16, height: 46, justifyContent: "center", alignItems: "center" },
  discoveryTabText: { fontSize: 14 },
  discoveryTabUnderline: { position: "absolute", bottom: 0, left: 12, right: 12, height: 2, borderRadius: 2 },
  filterDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  cuisineFiltersRow: { height: 44, flexShrink: 0 },
  cuisineFilters: { paddingHorizontal: 16, gap: 7, flexDirection: "row", alignItems: "center" },
  cuisineFilter: { height: 28, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cuisineFilterText: { fontSize: 12 },
  feedContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 16 },
  emptyFeed: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyFeedText: { fontSize: 15 },
  postCard: { borderRadius: 18, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#fff", fontSize: 15 },
  username: { fontSize: 14 },
  timeAgo: { fontSize: 12 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5 },
  followBtnText: { fontSize: 13 },
  postImageContainer: { width: "100%", aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center" },
  postImage: { width: "100%", height: "100%", position: "absolute" },
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
  shareToast: { position: "absolute", bottom: 100, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, borderWidth: 1 },
  shareToastText: { fontSize: 14 },
  commentModal: { flex: 1, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  commentModalTitle: { fontSize: 20, marginBottom: 16 },
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
