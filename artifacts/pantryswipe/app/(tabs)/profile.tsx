import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { BADGES } from "@/data/mockData";
import { useRouter } from "expo-router";

const RECIPE_IMAGES: Record<string, ReturnType<typeof require>> = {
  "recipe-pasta": require("@/assets/images/recipe-pasta.png"),
  "recipe-salmon": require("@/assets/images/recipe-salmon.png"),
  "recipe-bowl": require("@/assets/images/recipe-bowl.png"),
  "recipe-bibimbap": require("@/assets/images/recipe-bibimbap.png"),
};

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", Vietnamese: "🍜", International: "🍽",
};

const PROFILE_TABS = ["Recipes", "Saved", "Stats", "Badges"] as const;
const RECIPE_SUBTABS = ["Saved Later", "Made", "To Cook"] as const;

const ALL_CUISINES = [
  { name: "Italian", flag: "🇮🇹", count: 18 },
  { name: "Japanese", flag: "🇯🇵", count: 14 },
  { name: "Korean", flag: "🇰🇷", count: 11 },
  { name: "American", flag: "🇺🇸", count: 9 },
  { name: "Indian", flag: "🇮🇳", count: 7 },
  { name: "Mediterranean", flag: "🌊", count: 5 },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, stats, savedRecipes, cookedRecipes, liveRecipes } = useApp();
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]>("Recipes");
  const [recipeSubtab, setRecipeSubtab] = useState<(typeof RECIPE_SUBTABS)[number]>("Saved Later");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const savedRecipesList = liveRecipes.filter((r) => savedRecipes.includes(r.id));
  const cookedRecipesList = liveRecipes.filter((r) => cookedRecipes.includes(r.id));
  const toCookList = liveRecipes.filter((r) => !cookedRecipes.includes(r.id) && !savedRecipes.includes(r.id)).slice(0, 4);

  const recipesList = recipeSubtab === "Saved Later" ? savedRecipesList : recipeSubtab === "Made" ? cookedRecipesList : toCookList;

  const CUISINE_EMOJI: Record<string, string> = { Italian: "🇮🇹", Japanese: "🇯🇵", Korean: "🇰🇷", American: "🇺🇸", Indian: "🇮🇳", Mediterranean: "🌊" };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { paddingTop: topPadding }]}>
          {/* Cover */}
          <View style={[styles.coverPhoto, { backgroundColor: colors.primary + "30" }]}>
            <View style={styles.coverOverlay}>
              {["🍝", "🥗", "🍣", "🥘", "🍜"].map((e, i) => (
                <Text key={i} style={[styles.coverEmoji, { opacity: 0.4 + i * 0.1 }]}>{e}</Text>
              ))}
            </View>
            <View style={styles.coverActions}>
              <TouchableOpacity style={[styles.coverActionBtn, { backgroundColor: colors.card }]}>
                <Feather name="camera" size={14} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.coverActionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/settings")}>
                <Feather name="settings" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { fontFamily: "Fraunces_700Bold" }]}>{userProfile.name[0]?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={[styles.editProfileBtn, { borderColor: colors.border }]}>
              <Feather name="edit-2" size={13} color={colors.foreground} />
              <Text style={[styles.editProfileText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.profileInfo}>
            <Text style={[styles.displayName, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>{userProfile.name}</Text>
            <Text style={[styles.username, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              @{userProfile.name.toLowerCase().replace(/\s/g, "_")}
            </Text>

            <View style={styles.dietTags}>
              {userProfile.dietType.slice(0, 3).map((d) => (
                <View key={d} style={[styles.dietTag, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.dietTagText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => { setActiveTab("Recipes"); setRecipeSubtab("Made"); }}>
                <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{cookedRecipes.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Cooked</Text>
              </TouchableOpacity>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>48</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Followers</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>103</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Following</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs — sticky */}
        <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
            {PROFILE_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: isActive ? colors.primary : colors.card,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: isActive ? "#fff" : colors.textSecondary, fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium" }]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>

          {/* ── RECIPES TAB ── */}
          {activeTab === "Recipes" && (
            <View style={{ gap: 14 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subtabRow}>
                {RECIPE_SUBTABS.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subtab, { backgroundColor: recipeSubtab === sub ? colors.primary : colors.card, borderColor: recipeSubtab === sub ? colors.primary : colors.border }]}
                    onPress={() => setRecipeSubtab(sub)}
                  >
                    <Text style={[styles.subtabText, { color: recipeSubtab === sub ? colors.primaryForeground : colors.textSecondary, fontFamily: recipeSubtab === sub ? "Inter_600SemiBold" : "Inter_500Medium" }]}>{sub}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {recipesList.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Text style={{ fontSize: 36 }}>🍽</Text>
                  <Text style={[styles.emptyTabText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {recipeSubtab === "Saved Later" ? "Save recipes from the Discover tab" : recipeSubtab === "Made" ? "Cook recipes to see them here" : "No suggestions yet"}
                  </Text>
                </View>
              ) : (
                <View style={styles.recipeGrid}>
                  {recipesList.map((recipe) => {
                    const imgSrc = recipe.image
                      ? recipe.image.startsWith("http") ? { uri: recipe.image } : (RECIPE_IMAGES[recipe.image] ?? null)
                      : null;
                    return (
                    <TouchableOpacity key={recipe.id} style={[styles.recipeGridItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                      <View style={[styles.recipeGridImage, { backgroundColor: colors.primary + "20", overflow: "hidden" }]}>
                        {imgSrc ? (
                          <Image source={imgSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 32 }}>{CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}</Text>
                        )}
                      </View>
                      <Text style={[styles.recipeGridTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>{recipe.title}</Text>
                      <Text style={[styles.recipeGridMeta, { color: colors.textSecondary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{recipe.calories} kcal · {recipe.prepTime + recipe.cookTime}m</Text>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── SAVED TAB ── */}
          {activeTab === "Saved" && (
            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Recipes you've saved</Text>
              {savedRecipesList.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Text style={{ fontSize: 36 }}>🔖</Text>
                  <Text style={[styles.emptyTabText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Swipe up on a recipe to save it here</Text>
                </View>
              ) : (
                <View style={styles.recipeGrid}>
                  {savedRecipesList.map((recipe) => {
                    const imgSrc = recipe.image
                      ? recipe.image.startsWith("http") ? { uri: recipe.image } : (RECIPE_IMAGES[recipe.image] ?? null)
                      : null;
                    return (
                    <TouchableOpacity key={recipe.id} style={[styles.recipeGridItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                      <View style={[styles.recipeGridImage, { backgroundColor: colors.saveBlue + "20", overflow: "hidden" }]}>
                        {imgSrc ? (
                          <Image source={imgSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 32 }}>{CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}</Text>
                        )}
                      </View>
                      <Text style={[styles.recipeGridTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>{recipe.title}</Text>
                      <Text style={[styles.recipeGridMeta, { color: colors.textSecondary, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{recipe.calories} kcal</Text>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── STATS TAB ── */}
          {activeTab === "Stats" && (
            <View style={styles.statsContent}>
              {/* Streak */}
              <View style={[styles.streakCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "35" }]}>
                <View style={styles.streakLeft}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <View>
                    <Text style={[styles.streakNumber, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{stats.streak}</Text>
                    <Text style={[styles.streakLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Day Streak</Text>
                  </View>
                </View>
                <Text style={[styles.streakMotivation, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>Keep it up!</Text>
              </View>

              {/* Stats grid — no XP/Level */}
              <View style={styles.statsGrid}>
                {[
                  { label: "Meals Cooked", value: stats.mealsCoooked.toString(), icon: "coffee", color: colors.primary },
                  { label: "Cuisines Tried", value: `${new Set(liveRecipes.filter(r => cookedRecipes.includes(r.id)).map(r => r.cuisine)).size}`, icon: "globe", color: "#00C9B1" },
                  { label: "Waste Reduced", value: `${stats.wasteReduced}kg`, icon: "wind", color: "#4CAF76" },
                  { label: "Recipes Saved", value: `${savedRecipes.length}`, icon: "bookmark", color: colors.saveBlue },
                ].map((s) => (
                  <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name={s.icon as any} size={20} color={s.color} />
                    <Text style={[styles.statCardValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{s.value}</Text>
                    <Text style={[styles.statCardLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                  </View>
                ))}
              </View>

              {/* Top Cuisines — scrollable */}
              <View style={[styles.topCuisinesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 12 }]}>Top Cuisines</Text>
                {ALL_CUISINES.map((c, i) => (
                  <View key={c.name} style={styles.cuisineRow}>
                    <Text style={[styles.cuisineRank, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>#{i + 1}</Text>
                    <Text style={styles.cuisineFlag}>{c.flag}</Text>
                    <Text style={[styles.cuisineName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
                    <View style={[styles.cuisineBar, { backgroundColor: colors.muted }]}>
                      <View style={[styles.cuisineBarFill, { backgroundColor: colors.primary, width: `${Math.round((c.count / 18) * 100)}%` }]} />
                    </View>
                    <Text style={[styles.cuisineCount, { color: colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{c.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── BADGES TAB ── */}
          {activeTab === "Badges" && (
            <View style={styles.badgesGrid}>
              {BADGES.map((badge) => (
                <View
                  key={badge.id}
                  style={[styles.badgeCard, { backgroundColor: badge.earned ? colors.card : colors.muted, borderColor: badge.earned ? colors.primary + "50" : colors.border, opacity: badge.earned ? 1 : 0.55 }]}
                >
                  <View style={[styles.badgeIcon, { backgroundColor: badge.earned ? colors.primary + "20" : colors.border }]}>
                    <Feather name={badge.icon === "flame" ? "zap" : badge.icon === "trophy" ? "award" : badge.icon === "leaf" ? "wind" : badge.icon as any} size={24} color={badge.earned ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={[styles.badgeName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{badge.name}</Text>
                  <Text style={[styles.badgeDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>{badge.description}</Text>
                  {badge.earned && (
                    <View style={[styles.earnedBadge, { backgroundColor: colors.primary + "20" }]}>
                      <Feather name="check" size={10} color={colors.primary} />
                      <Text style={[styles.earnedText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Earned</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: {},
  coverPhoto: { height: 130, position: "relative", overflow: "hidden" },
  coverOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 20 },
  coverEmoji: { fontSize: 32 },
  coverActions: { position: "absolute", top: 12, right: 12, flexDirection: "row", gap: 8 },
  coverActionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, marginTop: -36 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  avatarText: { color: "#fff", fontSize: 28 },
  editProfileBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, marginBottom: 4 },
  editProfileText: { fontSize: 13 },
  profileInfo: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, gap: 8 },
  displayName: { fontSize: 22, letterSpacing: -0.3 },
  username: { fontSize: 14, marginTop: -4 },
  dietTags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  dietTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  dietTagText: { fontSize: 12 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  statItem: { alignItems: "center", gap: 2 },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 28 },
  tabsContainer: { borderBottomWidth: 1 },
  tabsScrollContent: { paddingHorizontal: 16, gap: 8, alignItems: "center", height: 54, paddingVertical: 9 },
  tab: { height: 36, paddingHorizontal: 18, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14 },
  tabIndicator: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  tabContent: { padding: 16, paddingBottom: 80 },
  subtabRow: { gap: 8, paddingRight: 8, alignItems: "center", height: 42 },
  subtab: { height: 32, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subtabText: { fontSize: 13 },
  emptyTab: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTabText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  recipeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  recipeGridItem: { width: "47.5%", borderRadius: 14, borderWidth: 1, overflow: "hidden", paddingBottom: 12 },
  recipeGridImage: { aspectRatio: 1, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  recipeGridTitle: { fontSize: 13, paddingHorizontal: 10 },
  recipeGridMeta: { fontSize: 11, paddingHorizontal: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14 },
  statsContent: { gap: 14 },
  streakCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 16, borderWidth: 1 },
  streakLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  streakEmoji: { fontSize: 32 },
  streakNumber: { fontSize: 34 },
  streakLabel: { fontSize: 13 },
  streakMotivation: { fontSize: 15 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47.5%", alignItems: "center", paddingVertical: 18, borderRadius: 16, borderWidth: 1, gap: 6 },
  statCardValue: { fontSize: 20 },
  statCardLabel: { fontSize: 12 },
  topCuisinesCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  cuisineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cuisineRank: { fontSize: 12, color: "#999", width: 22 },
  cuisineFlag: { fontSize: 18 },
  cuisineName: { fontSize: 13, width: 82 },
  cuisineBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  cuisineBarFill: { height: "100%", borderRadius: 3 },
  cuisineCount: { fontSize: 12, width: 22, textAlign: "right" },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: { width: "47.5%", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, gap: 7 },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  badgeName: { fontSize: 12, textAlign: "center" },
  badgeDesc: { fontSize: 10, textAlign: "center", lineHeight: 14 },
  earnedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  earnedText: { fontSize: 10 },
});
