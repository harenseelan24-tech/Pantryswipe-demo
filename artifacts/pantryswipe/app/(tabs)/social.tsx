import React, { useState } from "react";
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

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

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
          {item.recipeName && (
            <TouchableOpacity
              style={[styles.recipeChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "35" }]}
              onPress={() => item.recipeId && router.push(`/recipe/${item.recipeId}`)}
            >
              <Feather name="book-open" size={12} color={colors.primary} />
              <Text style={[styles.recipeChipText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{item.recipeName}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Social</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="camera" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Discovery tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryTabs}>
        {DISCOVERY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.discoveryTab,
              activeTab === tab
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.discoveryTabText,
              {
                color: activeTab === tab ? colors.primaryForeground : colors.foreground,
                fontFamily: activeTab === tab ? "Inter_700Bold" : "Inter_500Medium",
              },
            ]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Cuisine filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuisineFilters}>
        {CUISINE_FILTERS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.cuisineFilter, { backgroundColor: activeCuisine === c ? colors.primary : colors.card, borderColor: activeCuisine === c ? colors.primary : colors.border }]}
            onPress={() => setActiveCuisine(c)}
          >
            <Text style={[styles.cuisineFilterText, { color: activeCuisine === c ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={posts}
        keyExtractor={(i) => i.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
      />

      {/* Share toast */}
      {shareToast && (
        <View style={[styles.shareToast, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check" size={16} color={colors.primary} />
          <Text style={[styles.shareToastText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Link copied to clipboard!</Text>
        </View>
      )}

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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 26, letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  discoveryTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  discoveryTab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 100 },
  discoveryTabText: { fontSize: 14 },
  cuisineFilters: { paddingHorizontal: 20, gap: 8, paddingVertical: 10, alignItems: "center", height: 50 },
  cuisineFilter: { height: 30, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cuisineFilterText: { fontSize: 12 },
  feedContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 16 },
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
  recipeChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
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
