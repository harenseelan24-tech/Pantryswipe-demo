import React, { useRef, useState } from "react";
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
import { useSubscription } from "@/lib/revenuecat";

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

const GOAL_EMOJI: Record<string, string> = {
  "Build Muscle": "💪", "Eat Healthier": "🥗", "Save Money": "💰",
  "Cook Faster": "⚡", "Explore Cuisines": "🌍", "Cook for Others": "👨‍👩‍👧",
  "Meal Prep": "🥡", "Reduce Waste": "♻️", "Lose Weight": "🏃",
};

const SKILL_BADGE: Record<string, { emoji: string; color: string }> = {
  "Beginner":   { emoji: "🌱", color: "#4CAF76" },
  "Home Cook":  { emoji: "🍳", color: "#F5A623" },
  "Confident":  { emoji: "👨‍🍳", color: "#5B8EF5" },
  "Advanced":   { emoji: "⭐", color: "#E84040" },
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, stats, savedRecipes, cookedRecipes, liveRecipes, signOut } = useApp();
  const { isSubscribed } = useSubscription();
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]>("Recipes");
  const [recipeSubtab, setRecipeSubtab] = useState<(typeof RECIPE_SUBTABS)[number]>("Saved Later");
  const [showAllergies, setShowAllergies] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/welcome");
  };

  const savedRecipesList = liveRecipes.filter((r) => savedRecipes.includes(r.id));
  const cookedRecipesList = liveRecipes.filter((r) => cookedRecipes.includes(r.id));
  const toCookList = liveRecipes.filter((r) => !cookedRecipes.includes(r.id) && !savedRecipes.includes(r.id)).slice(0, 4);

  const recipesList = recipeSubtab === "Saved Later" ? savedRecipesList : recipeSubtab === "Made" ? cookedRecipesList : toCookList;

  const CUISINE_EMOJI: Record<string, string> = { Italian: "🇮🇹", Japanese: "🇯🇵", Korean: "🇰🇷", American: "🇺🇸", Indian: "🇮🇳", Mediterranean: "🌊" };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
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
              <TouchableOpacity
                style={[styles.coverActionBtn, { backgroundColor: colors.card }]}
                onPress={handleSignOut}
                disabled={signingOut}
              >
                <Feather name="log-out" size={14} color={signingOut ? colors.textSecondary : "#E84040"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>{userProfile.name[0]?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={[styles.editProfileBtn, { borderColor: colors.border }]}>
              <Feather name="edit-2" size={13} color={colors.foreground} />
              <Text style={[styles.editProfileText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.profileInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.displayName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{userProfile.name}</Text>
              {isSubscribed && (
                <View style={[styles.premiumBadge, { backgroundColor: "#4CAF76" }]}>
                  <Feather name="zap" size={9} color="#fff" />
                  <Text style={[styles.premiumBadgeText, { fontFamily: "Inter_700Bold" }]}>PREMIUM</Text>
                </View>
              )}
            </View>
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

            {/* Skill level + Goal badges */}
            {(userProfile.skillLevel || userProfile.goal) ? (
              <View style={styles.profileBadgeRow}>
                {userProfile.skillLevel ? (() => {
                  const badge = SKILL_BADGE[userProfile.skillLevel] ?? { emoji: "🍳", color: "#F5A623" };
                  return (
                    <View style={[styles.profileBadge, { backgroundColor: badge.color + "20", borderColor: badge.color + "40" }]}>
                      <Text style={{ fontSize: 12 }}>{badge.emoji}</Text>
                      <Text style={[styles.profileBadgeText, { color: badge.color, fontFamily: "Inter_600SemiBold" }]}>
                        {userProfile.skillLevel}
                      </Text>
                    </View>
                  );
                })() : null}
                {userProfile.goal ? (
                  <View style={[styles.profileBadge, { backgroundColor: colors.saveBlue + "15", borderColor: colors.saveBlue + "30" }]}>
                    <Text style={{ fontSize: 12 }}>{GOAL_EMOJI[userProfile.goal] ?? "🎯"}</Text>
                    <Text style={[styles.profileBadgeText, { color: colors.saveBlue, fontFamily: "Inter_600SemiBold" }]}>
                      {userProfile.goal}
                    </Text>
                  </View>
                ) : null}
                {userProfile.weeklyBudget > 0 ? (
                  <View style={[styles.profileBadge, { backgroundColor: "#4CAF7620", borderColor: "#4CAF7640" }]}>
                    <Feather name="dollar-sign" size={11} color="#4CAF76" />
                    <Text style={[styles.profileBadgeText, { color: "#4CAF76", fontFamily: "Inter_600SemiBold" }]}>
                      ${userProfile.weeklyBudget}/wk
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Allergies with show/hide toggle */}
            {userProfile.allergies.length > 0 ? (
              <View style={styles.allergySection}>
                <TouchableOpacity
                  style={styles.allergyToggle}
                  onPress={() => setShowAllergies(!showAllergies)}
                  activeOpacity={0.7}
                >
                  <Feather name={showAllergies ? "eye" : "eye-off"} size={13} color={colors.textSecondary} />
                  <Text style={[styles.allergyToggleText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                    Allergies ({userProfile.allergies.length})
                  </Text>
                </TouchableOpacity>
                {showAllergies ? (
                  <View style={styles.allergyTags}>
                    {userProfile.allergies.map((a) => (
                      <View key={a} style={[styles.allergyTag, { backgroundColor: "#E8404015", borderColor: "#E8404040" }]}>
                        <Text style={{ fontSize: 10 }}>⚠️</Text>
                        <Text style={[styles.allergyTagText, { color: "#E84040", fontFamily: "Inter_600SemiBold" }]}>{a}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Cuisine preferences */}
            {userProfile.cuisinePreferences.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -20, paddingLeft: 20 }} contentContainerStyle={styles.cuisinePrefRow}>
                {userProfile.cuisinePreferences.map((c) => (
                  <View key={c} style={[styles.cuisinePrefTag, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 13 }}>{CUISINE_EMOJIS[c] ?? "🍽️"}</Text>
                    <Text style={[styles.cuisinePrefText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{c}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => { setActiveTab("Recipes"); setRecipeSubtab("Made"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}>
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

          {/* Premium upgrade banner — free users only */}
          {!isSubscribed && (
            <TouchableOpacity
              style={styles.upgradeCard}
              onPress={() => router.push("/paywall")}
              activeOpacity={0.85}
            >
              <View style={styles.upgradeLeft}>
                <Text style={styles.upgradeEmoji}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upgradeTitle, { color: "#141210", fontFamily: "Inter_700Bold" }]}>Unlock Premium</Text>
                  <Text style={[styles.upgradeSub, { fontFamily: "Inter_400Regular" }]}>Unlimited AI · Smart expiry · S$4.99/mo</Text>
                </View>
              </View>
              <View style={styles.upgradeArrow}>
                <Feather name="arrow-right" size={14} color="#141210" />
              </View>
            </TouchableOpacity>
          )}
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
                  onPress={() => { setActiveTab(tab); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
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
                  {Array.from({ length: Math.ceil(recipesList.length / 2) }, (_, ri) => (
                    <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                      {recipesList.slice(ri * 2, ri * 2 + 2).map((recipe) => {
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
                      {recipesList.slice(ri * 2, ri * 2 + 2).length < 2 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
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
                  {Array.from({ length: Math.ceil(savedRecipesList.length / 2) }, (_, ri) => (
                    <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                      {savedRecipesList.slice(ri * 2, ri * 2 + 2).map((recipe) => {
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
                      {savedRecipesList.slice(ri * 2, ri * 2 + 2).length < 2 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
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

              {/* Stats grid — 2×2 using flex rows (no % strings) */}
              {(() => {
                const STAT_ITEMS = [
                  { label: "Meals Cooked", value: String(stats.mealsCooked ?? 0), icon: "coffee", color: colors.primary },
                  { label: "Cuisines Tried", value: String(new Set(liveRecipes.filter(r => cookedRecipes.includes(r.id)).map(r => r.cuisine)).size), icon: "globe", color: "#00C9B1" },
                  { label: "Waste Reduced", value: `${stats.wasteReduced ?? 0}kg`, icon: "wind", color: "#4CAF76" },
                  { label: "Recipes Saved", value: String(savedRecipes.length), icon: "bookmark", color: colors.saveBlue },
                ];
                return (
                  <View style={{ gap: 10 }}>
                    {[STAT_ITEMS.slice(0, 2), STAT_ITEMS.slice(2, 4)].map((row, ri) => (
                      <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                        {row.map((s) => (
                          <View key={s.label} style={[styles.statCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Feather name={s.icon as any} size={20} color={s.color} />
                            <Text style={[styles.statCardValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{s.value}</Text>
                            <Text style={[styles.statCardLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Top Cuisines — scrollable */}
              <View style={[styles.topCuisinesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 12 }]}>Top Cuisines</Text>
                {ALL_CUISINES.map((c, i) => (
                  <View key={c.name} style={styles.cuisineRow}>
                    <Text style={[styles.cuisineRank, { fontFamily: "SpaceGrotesk_600SemiBold" }]}>#{i + 1}</Text>
                    <Text style={styles.cuisineFlag}>{c.flag}</Text>
                    <Text style={[styles.cuisineName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
                    <View style={[styles.cuisineBar, { backgroundColor: colors.muted }]}>
                      <View style={[styles.cuisineBarFill, { backgroundColor: colors.primary, flex: c.count }]} />
                      <View style={{ flex: 18 - c.count }} />
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
              {Array.from({ length: Math.ceil(BADGES.length / 2) }, (_, ri) => (
                <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                  {BADGES.slice(ri * 2, ri * 2 + 2).map((badge) => (
                    <View
                      key={badge.id}
                      style={[styles.badgeCard, { flex: 1, backgroundColor: badge.earned ? colors.card : colors.muted, borderColor: badge.earned ? colors.primary + "50" : colors.border, opacity: badge.earned ? 1 : 0.55 }]}
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
                  {BADGES.slice(ri * 2, ri * 2 + 2).length < 2 && <View style={{ flex: 1 }} />}
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
  displayName: { fontSize: 24, letterSpacing: -0.5 },
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
  recipeGrid: { gap: 10 },
  recipeGridItem: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: "hidden", paddingBottom: 12 },
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
  statsGrid: { gap: 10 },
  statCard: { alignItems: "center", paddingVertical: 18, borderRadius: 16, borderWidth: 1, gap: 6 },
  statCardValue: { fontSize: 20 },
  statCardLabel: { fontSize: 12 },
  topCuisinesCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  cuisineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cuisineRank: { fontSize: 12, color: "#999", width: 22 },
  cuisineFlag: { fontSize: 18 },
  cuisineName: { fontSize: 13, width: 82 },
  cuisineBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden", flexDirection: "row" },
  cuisineBarFill: { height: 6, borderRadius: 3 },
  cuisineCount: { fontSize: 12, width: 22, textAlign: "right" },
  badgesGrid: { gap: 10 },
  badgeCard: { alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, gap: 7 },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  badgeName: { fontSize: 12, textAlign: "center" },
  badgeDesc: { fontSize: 10, textAlign: "center", lineHeight: 14 },
  earnedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  earnedText: { fontSize: 10 },

  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  premiumBadgeText: { color: "#fff", fontSize: 9, letterSpacing: 0.4 },

  profileBadgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  profileBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  profileBadgeText: { fontSize: 12 },

  allergySection: { gap: 6 },
  allergyToggle: { flexDirection: "row", alignItems: "center", gap: 5 },
  allergyToggleText: { fontSize: 12 },
  allergyTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  allergyTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  allergyTagText: { fontSize: 11 },

  cuisinePrefRow: { gap: 8, paddingRight: 20, paddingVertical: 2 },
  cuisinePrefTag: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  cuisinePrefText: { fontSize: 12 },

  upgradeCard: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: "#F5A623",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  upgradeLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  upgradeEmoji: { fontSize: 24 },
  upgradeTitle: { fontSize: 15 },
  upgradeSub: { color: "rgba(20,18,16,0.65)", fontSize: 12, marginTop: 1 },
  upgradeArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(20,18,16,0.12)",
    alignItems: "center", justifyContent: "center",
  },
});
