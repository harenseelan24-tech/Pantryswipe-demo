import React, { useState } from "react";
import {
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
import { BADGES, MOCK_RECIPES } from "@/data/mockData";

const PROFILE_TABS = ["Recipes", "Saved", "Stats", "Badges"] as const;

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userProfile, stats, savedRecipes, cookedRecipes } = useApp();
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]>("Stats");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const savedRecipesList = MOCK_RECIPES.filter((r) => savedRecipes.includes(r.id));
  const cookedRecipesList = MOCK_RECIPES.filter((r) => cookedRecipes.includes(r.id));
  const level = Math.floor(stats.xp / 200);
  const xpInLevel = stats.xp % 200;
  const xpProgress = xpInLevel / 200;

  const CUISINE_EMOJIS: Record<string, string> = {
    Italian: "🇮🇹",
    Japanese: "🇯🇵",
    Korean: "🇰🇷",
    American: "🇺🇸",
    Indian: "🇮🇳",
    Mediterranean: "🌊",
  };

  const topCuisines = ["Italian", "Japanese", "Korean"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
        {/* Header section */}
        <View style={[styles.profileHeader, { paddingTop: topPadding + 8 }]}>
          {/* Cover */}
          <View style={[styles.coverPhoto, { backgroundColor: colors.saffron + "40" }]}>
            <TouchableOpacity style={[styles.editCoverBtn, { backgroundColor: colors.card }]}>
              <Feather name="camera" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.saffron }]}>
              <Text style={styles.avatarText}>{userProfile.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.levelText, { color: colors.saffron }]}>Lv.{level}</Text>
            </View>
          </View>

          {/* Profile info */}
          <View style={styles.profileInfo}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>{userProfile.name}</Text>
            <Text style={[styles.username, { color: colors.mutedForeground }]}>@{userProfile.name.toLowerCase().replace(/\s/g, "_")}</Text>

            {/* Diet tags */}
            <View style={styles.dietTags}>
              {userProfile.dietType.slice(0, 3).map((d) => (
                <View key={d} style={[styles.dietTag, { backgroundColor: colors.secondary + "20" }]}>
                  <Text style={[styles.dietTagText, { color: colors.secondary }]}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{cookedRecipes.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Cooked</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>48</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Followers</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>103</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Following</Text>
              </View>
            </View>

            {/* XP bar */}
            <View style={styles.xpContainer}>
              <View style={styles.xpLabelRow}>
                <Text style={[styles.xpLabel, { color: colors.mutedForeground }]}>
                  {stats.xp} XP
                </Text>
                <Text style={[styles.xpLabel, { color: colors.mutedForeground }]}>
                  Next: {(level + 1) * 200} XP
                </Text>
              </View>
              <View style={[styles.xpBar, { backgroundColor: colors.muted }]}>
                <View style={[styles.xpFill, { backgroundColor: colors.saffron, width: `${xpProgress * 100}%` }]} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.editProfileBtn, { borderColor: colors.border }]}
            >
              <Feather name="edit-2" size={14} color={colors.foreground} />
              <Text style={[styles.editProfileText, { color: colors.foreground }]}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {PROFILE_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === tab ? colors.foreground : colors.mutedForeground,
                    fontWeight: activeTab === tab ? "700" : "500",
                  },
                ]}
              >
                {tab}
              </Text>
              {activeTab === tab && (
                <View style={[styles.tabIndicator, { backgroundColor: colors.saffron }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {/* Stats tab */}
          {activeTab === "Stats" && (
            <View style={styles.statsContent}>
              {/* Streak card */}
              <View style={[styles.streakCard, { backgroundColor: colors.saffron + "15", borderColor: colors.saffron + "30" }]}>
                <View style={styles.streakLeft}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <View>
                    <Text style={[styles.streakNumber, { color: colors.foreground }]}>{stats.streak}</Text>
                    <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>Day Streak</Text>
                  </View>
                </View>
                <Text style={[styles.streakMotivation, { color: colors.saffron }]}>Keep it up!</Text>
              </View>

              {/* Stats grid */}
              <View style={styles.statsGrid}>
                {[
                  { label: "Meals Cooked", value: stats.mealsCoooked.toString(), icon: "coffee", color: colors.saffron },
                  { label: "Money Saved", value: `$${stats.moneySaved}`, icon: "dollar-sign", color: colors.secondary },
                  { label: "Waste Reduced", value: `${stats.wasteReduced}kg`, icon: "leaf", color: "#4CAF76" },
                  { label: "Level", value: `Lv.${level}`, icon: "award", color: colors.saveBlue },
                ].map((s) => (
                  <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name={s.icon as any} size={22} color={s.color} />
                    <Text style={[styles.statCardValue, { color: colors.foreground }]}>{s.value}</Text>
                    <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                  </View>
                ))}
              </View>

              {/* Top cuisines */}
              <View style={[styles.topCuisinesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Cuisines</Text>
                {topCuisines.map((c, i) => (
                  <View key={c} style={styles.cuisineRow}>
                    <Text style={styles.cuisineRank}>#{i + 1}</Text>
                    <Text style={styles.cuisineFlag}>{CUISINE_EMOJIS[c] || "🌍"}</Text>
                    <Text style={[styles.cuisineName, { color: colors.foreground }]}>{c}</Text>
                    <View style={[styles.cuisineBar, { backgroundColor: colors.muted }]}>
                      <View
                        style={[
                          styles.cuisineBarFill,
                          { backgroundColor: colors.saffron, width: `${(3 - i) * 30 + 20}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Saved tab */}
          {activeTab === "Saved" && (
            <View style={styles.recipeGrid}>
              {savedRecipesList.map((recipe) => (
                <View key={recipe.id} style={[styles.recipeGridItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.recipeGridImage, { backgroundColor: colors.muted }]}>
                    <Text style={{ fontSize: 36 }}>
                      {recipe.cuisine === "Italian" ? "🍝" : recipe.cuisine === "Japanese" ? "🍜" : "🍽"}
                    </Text>
                  </View>
                  <Text style={[styles.recipeGridTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                  <Text style={[styles.recipeGridMeta, { color: colors.mutedForeground }]}>
                    {recipe.calories} kcal · {recipe.prepTime + recipe.cookTime}m
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Recipes tab */}
          {activeTab === "Recipes" && (
            <View style={styles.recipeGrid}>
              {cookedRecipesList.map((recipe) => (
                <View key={recipe.id} style={[styles.recipeGridItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.recipeGridImage, { backgroundColor: colors.muted }]}>
                    <Text style={{ fontSize: 36 }}>
                      {recipe.cuisine === "Italian" ? "🍝" : recipe.cuisine === "Japanese" ? "🍜" : "🍽"}
                    </Text>
                  </View>
                  <Text style={[styles.recipeGridTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                  <Text style={[styles.recipeGridMeta, { color: colors.mutedForeground }]}>
                    {recipe.calories} kcal · {recipe.prepTime + recipe.cookTime}m
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Badges tab */}
          {activeTab === "Badges" && (
            <View style={styles.badgesGrid}>
              {BADGES.map((badge) => (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: badge.earned ? colors.card : colors.muted,
                      borderColor: badge.earned ? colors.saffron + "40" : colors.border,
                      opacity: badge.earned ? 1 : 0.5,
                    },
                  ]}
                >
                  <View style={[styles.badgeIcon, { backgroundColor: badge.earned ? colors.saffron + "20" : colors.border }]}>
                    <Feather name={badge.icon as any} size={24} color={badge.earned ? colors.saffron : colors.mutedForeground} />
                  </View>
                  <Text style={[styles.badgeName, { color: colors.foreground }]}>{badge.name}</Text>
                  <Text style={[styles.badgeDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {badge.description}
                  </Text>
                  {badge.earned && (
                    <View style={[styles.earnedBadge, { backgroundColor: colors.secondary + "20" }]}>
                      <Feather name="check" size={10} color={colors.secondary} />
                      <Text style={[styles.earnedText, { color: colors.secondary }]}>Earned</Text>
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
  coverPhoto: {
    height: 120,
    position: "relative",
  },
  editCoverBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarContainer: {
    marginTop: -40,
    marginLeft: 20,
    position: "relative",
    alignSelf: "flex-start",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  levelText: { fontSize: 11, fontWeight: "700" },
  profileInfo: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10 },
  displayName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  username: { fontSize: 14, marginTop: -6 },
  dietTags: { flexDirection: "row", gap: 8 },
  dietTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  dietTagText: { fontSize: 12, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  statItem: { alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  xpContainer: { gap: 6 },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLabel: { fontSize: 12 },
  xpBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 3 },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  editProfileText: { fontSize: 14, fontWeight: "600" },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    position: "relative",
  },
  tabText: { fontSize: 14 },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 2,
    borderRadius: 1,
  },
  tabContent: { padding: 16 },
  statsContent: { gap: 14 },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  streakLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  streakEmoji: { fontSize: 36 },
  streakNumber: { fontSize: 36, fontWeight: "800" },
  streakLabel: { fontSize: 14 },
  streakMotivation: { fontSize: 16, fontWeight: "700" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47.5%",
    alignItems: "center",
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  statCardValue: { fontSize: 22, fontWeight: "800" },
  statCardLabel: { fontSize: 13 },
  topCuisinesCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  cuisineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cuisineRank: { fontSize: 13, fontWeight: "700", color: "#999", width: 24 },
  cuisineFlag: { fontSize: 20 },
  cuisineName: { fontSize: 14, fontWeight: "600", width: 80 },
  cuisineBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  cuisineBarFill: { height: "100%", borderRadius: 3 },
  recipeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recipeGridItem: {
    width: "47.5%",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 12,
  },
  recipeGridImage: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recipeGridTitle: { fontSize: 13, fontWeight: "700", paddingHorizontal: 10 },
  recipeGridMeta: { fontSize: 12, paddingHorizontal: 10, marginTop: 4 },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: {
    width: "47.5%",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  badgeDesc: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  earnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  earnedText: { fontSize: 11, fontWeight: "700" },
});
