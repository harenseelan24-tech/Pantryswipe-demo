import React, { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { MOCK_SOCIAL_POSTS, SocialPost } from "@/data/mockData";

const DISCOVERY_TABS = ["For You", "Following", "Trending", "Near Me"];
const CUISINE_FILTERS = ["All", "Italian", "Japanese", "Korean", "Indian", "Mexican", "Thai", "Vegan"];

const RECIPE_IMAGES: Record<string, ReturnType<typeof require>> = {
  "recipe-pasta": require("@/assets/images/recipe-pasta.png"),
  "recipe-salmon": require("@/assets/images/recipe-salmon.png"),
  "recipe-bowl": require("@/assets/images/recipe-bowl.png"),
  "recipe-bibimbap": require("@/assets/images/recipe-bibimbap.png"),
};

export default function SocialScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("For You");
  const [activeCuisine, setActiveCuisine] = useState("All");
  const [posts, setPosts] = useState<SocialPost[]>(MOCK_SOCIAL_POSTS);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const toggleLike = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const toggleSave = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p))
    );
  };

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const renderPost = ({ item }: { item: SocialPost }) => {
    const imageSource = item.image ? RECIPE_IMAGES[item.image] : null;

    return (
      <View style={[styles.postCard, { backgroundColor: colors.card }]}>
        {/* Post header */}
        <View style={styles.postHeader}>
          <View style={[styles.userAvatar, { backgroundColor: colors.saffron }]}>
            <Text style={styles.userAvatarText}>{item.userAvatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.username, { color: colors.foreground }]}>@{item.username}</Text>
            <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>{item.timeAgo}</Text>
          </View>
          <TouchableOpacity
            style={[styles.followBtn, { borderColor: colors.saffron }]}
          >
            <Text style={[styles.followBtnText, { color: colors.saffron }]}>Follow</Text>
          </TouchableOpacity>
        </View>

        {/* Post image */}
        {imageSource ? (
          <Image source={imageSource} style={styles.postImage} resizeMode="cover" />
        ) : (
          <View style={[styles.postImagePlaceholder, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={40} color={colors.mutedForeground} />
          </View>
        )}

        {/* Actions row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionItem} onPress={() => toggleLike(item.id)}>
            <Feather
              name="heart"
              size={22}
              color={item.liked ? "#E84040" : colors.foreground}
              fill={item.liked ? "#E84040" : "none"}
            />
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
              {formatCount(item.likes)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <Feather name="message-circle" size={22} color={colors.foreground} />
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
              {item.comments}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <Feather name="share-2" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => toggleSave(item.id)}>
            <Feather
              name="bookmark"
              size={22}
              color={item.saved ? colors.saveBlue : colors.foreground}
            />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <View style={styles.captionContainer}>
          <Text style={[styles.caption, { color: colors.foreground }]}>
            <Text style={styles.captionUsername}>@{item.username} </Text>
            {item.caption}
          </Text>
          {item.recipeName && (
            <TouchableOpacity
              style={[styles.recipeChip, { backgroundColor: colors.saffron + "15", borderColor: colors.saffron + "30" }]}
              onPress={() => item.recipeId && router.push(`/recipe/${item.recipeId}`)}
            >
              <Feather name="book-open" size={12} color={colors.saffron} />
              <Text style={[styles.recipeChipText, { color: colors.saffron }]}>{item.recipeName}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Social</Text>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
          <Feather name="send" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Cuisine filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cuisineFilters}
      >
        {CUISINE_FILTERS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.cuisineFilter,
              {
                backgroundColor: activeCuisine === c ? colors.saffron : colors.card,
                borderColor: activeCuisine === c ? colors.saffron : colors.border,
              },
            ]}
            onPress={() => setActiveCuisine(c)}
          >
            <Text style={[styles.cuisineFilterText, { color: activeCuisine === c ? "#fff" : colors.foreground }]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Discovery tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.discoveryTabs}
      >
        {DISCOVERY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.discoveryTab}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.discoveryTabText,
                {
                  color: activeTab === tab ? colors.foreground : colors.mutedForeground,
                  fontWeight: activeTab === tab ? "700" : "500",
                },
              ]}
            >
              {tab}
            </Text>
            {activeTab === tab && (
              <View style={[styles.discoveryTabIndicator, { backgroundColor: colors.saffron }]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={posts}
        keyExtractor={(i) => i.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cuisineFilters: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  cuisineFilter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  cuisineFilterText: { fontSize: 13, fontWeight: "600" },
  discoveryTabs: { paddingHorizontal: 20, gap: 24, paddingBottom: 4 },
  discoveryTab: { paddingBottom: 10, alignItems: "center", position: "relative" },
  discoveryTabText: { fontSize: 15 },
  discoveryTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  feedContent: { paddingBottom: 100 },
  postCard: { paddingBottom: 4 },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  username: { fontSize: 15, fontWeight: "700" },
  timeAgo: { fontSize: 13 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  followBtnText: { fontSize: 13, fontWeight: "700" },
  postImage: { width: "100%", aspectRatio: 1 },
  postImagePlaceholder: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 20,
  },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, fontWeight: "600" },
  captionContainer: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  caption: { fontSize: 14, lineHeight: 20 },
  captionUsername: { fontWeight: "700" },
  recipeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  recipeChipText: { fontSize: 13, fontWeight: "600" },
});
