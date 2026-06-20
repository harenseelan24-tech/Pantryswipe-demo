import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { BADGES } from "@/data/mockData";
import { useRouter } from "expo-router";
import { useSubscription } from "@/lib/revenuecat";
import { getRecipeImageSource } from "@/constants/recipeImages";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 48) / 2;

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", Vietnamese: "🍜", International: "🍽",
};

const BIO_LIMIT = 80;

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

function XPBar({ xp, nextXp, level, colors }: { xp: number; nextXp: number; level: number; colors: any }) {
  const pct = Math.min(xp / nextXp, 1);
  return (
    <View style={xpStyles.container}>
      <View style={xpStyles.labelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={[xpStyles.lvlBadge, { backgroundColor: "#4CAF7622", borderColor: "#4CAF7650" }]}>
            <Text style={[xpStyles.lvlText, { color: "#4CAF76", fontFamily: "SpaceGrotesk_700Bold" }]}>Lv {level}</Text>
          </View>
          <Text style={[xpStyles.xpLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
            Home Cook
          </Text>
        </View>
        <Text style={[xpStyles.xpCount, { color: colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
          {xp.toLocaleString()} / {nextXp.toLocaleString()} XP
        </Text>
      </View>
      <View style={[xpStyles.track, { backgroundColor: colors.muted }]}>
        <View style={[xpStyles.fill, { backgroundColor: "#4CAF76", width: `${Math.round(pct * 100)}%` as any }]} />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, updateProfile, stats, savedRecipes, cookedRecipes, liveRecipes, signOut, followingList } = useApp();
  const { isSubscribed } = useSubscription();
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]>("Recipes");
  const [recipeSubtab, setRecipeSubtab] = useState<(typeof RECIPE_SUBTABS)[number]>("Saved Later");
  const [showAllergies, setShowAllergies] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Edit profile modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editBio, setEditBio] = useState(userProfile.bio ?? "");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/welcome");
  };

  // ── Photo picker ──────────────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    // Show action sheet to choose source
    Alert.alert(
      "Change Profile Photo",
      "Choose a source",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Please allow camera access in Settings to take a photo.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: "images",
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              updateProfile({ photoUri: result.assets[0].uri });
            }
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Please allow photo library access in Settings to choose a photo.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: "images",
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              updateProfile({ photoUri: result.assets[0].uri });
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // ── Save edit profile ─────────────────────────────────────────────────────
  const bioOverLimit = editBio.length > BIO_LIMIT;
  const canSaveProfile = editName.trim().length > 0 && !bioOverLimit;

  const handleSaveProfile = () => {
    if (!canSaveProfile) return;
    updateProfile({ name: editName.trim(), bio: editBio.trim() });
    setShowEditModal(false);
  };

  const openEditModal = () => {
    setEditName(userProfile.name);
    setEditBio(userProfile.bio ?? "");
    setShowEditModal(true);
  };

  const savedRecipesList = liveRecipes.filter((r) => savedRecipes.includes(r.id));
  const cookedRecipesList = liveRecipes.filter((r) => cookedRecipes.includes(r.id));
  const toCookList = liveRecipes.filter((r) => !cookedRecipes.includes(r.id) && !savedRecipes.includes(r.id)).slice(0, 4);
  const recipesList = recipeSubtab === "Saved Later" ? savedRecipesList : recipeSubtab === "Made" ? cookedRecipesList : toCookList;

  const xp = stats.xp ?? 2340;
  const level = stats.level ?? 5;
  const nextXp = Math.ceil(xp / 1000) * 1000 + 1000;

  const streakActive = (stats.streak ?? 0) > 0;
  const coverEmojis = userProfile.cuisinePreferences.length > 0
    ? userProfile.cuisinePreferences.slice(0, 5).map((c) => CUISINE_EMOJIS[c] ?? "🍽")
    : ["🍝", "🍜", "🥘", "🍛", "🌮"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>

        {/* ── Profile Header ────────────────────────────────────────────────── */}
        <View style={styles.profileHeader}>

          {/* Cover — personal cuisine mural */}
          <View style={[styles.cover, { paddingTop: topPadding, backgroundColor: colors.foreground + "0D" }]}>
            {/* Saffron tint layer */}
            <View style={[styles.coverTint, { backgroundColor: colors.primary + "18" }]} />
            {/* Bokeh emojis — user's own cuisine prefs */}
            <Text style={[styles.coverEmoji0]}>{coverEmojis[0] ?? "🍝"}</Text>
            <Text style={[styles.coverEmoji1]}>{coverEmojis[1] ?? "🍜"}</Text>
            <Text style={[styles.coverEmoji2]}>{coverEmojis[2] ?? "🥘"}</Text>
            <Text style={[styles.coverEmoji3]}>{coverEmojis[3] ?? "🍛"}</Text>
            <Text style={[styles.coverEmoji4]}>{coverEmojis[4] ?? "🌮"}</Text>
            {/* Vignette bottom fade */}
            <View style={[styles.coverVignette, { backgroundColor: colors.background }]} />
          </View>

          {/* Avatar row */}
          <View style={styles.avatarRow}>
            {/* Avatar — tappable to change profile photo */}
            <TouchableOpacity activeOpacity={0.8} onPress={handlePickPhoto}>
              <View style={styles.avatarRingOuter}>
                <View style={[styles.avatarTrack, { borderColor: streakActive ? colors.primary + "30" : colors.border }]} />
                {streakActive && (
                  <View style={[styles.avatarArc, { borderColor: colors.primary, borderTopColor: "transparent" }]} />
                )}
                {/* Show real photo if set, otherwise initials */}
                {userProfile.photoUri ? (
                  <Image source={{ uri: userProfile.photoUri }} style={styles.avatarPhoto} />
                ) : (
                  <View style={[styles.avatarInner, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.avatarLetter, { fontFamily: "Inter_700Bold" }]}>
                      {userProfile.name[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                {streakActive && (
                  <View style={[styles.streakBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={styles.streakBadgeEmoji}>🔥</Text>
                    <Text style={[styles.streakBadgeNum, { color: colors.primary, fontFamily: "SpaceGrotesk_700Bold" }]}>
                      {stats.streak}
                    </Text>
                  </View>
                )}
                {/* Camera badge overlay */}
                <View style={[styles.cameraBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="camera" size={11} color={colors.foreground} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Edit Profile + Settings */}
            <View style={styles.editRow}>
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={openEditModal}
                activeOpacity={0.75}
              >
                <Feather name="edit-2" size={13} color={colors.foreground} />
                <Text style={[styles.editBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.settingsBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/settings")} activeOpacity={0.75}>
                <Feather name="settings" size={15} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Identity block */}
          <View style={styles.identityBlock}>
            {/* Name + premium */}
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]} numberOfLines={1}>
                {userProfile.name}
              </Text>
              {isSubscribed && (
                <View style={[styles.premiumChip, { backgroundColor: "#4CAF76" }]}>
                  <Feather name="zap" size={9} color="#fff" />
                  <Text style={[styles.premiumChipText, { fontFamily: "Inter_700Bold" }]}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={[styles.handle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={1} ellipsizeMode="tail">
              @{userProfile.name.toLowerCase().replace(/\s/g, "_")}
              {userProfile.bio ? ` | ${userProfile.bio}` : ""}
            </Text>

            {/* Diet tags */}
            {userProfile.dietType.length > 0 && (
              <View style={styles.tagRow}>
                {userProfile.dietType.slice(0, 3).map((d) => (
                  <View key={d} style={[styles.dietChip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}>
                    <Text style={[styles.dietChipText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{d}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Skill / goal / budget pills */}
            {(userProfile.skillLevel || userProfile.goal || userProfile.weeklyBudget > 0) && (
              <View style={styles.tagRow}>
                {userProfile.skillLevel ? (() => {
                  const b = SKILL_BADGE[userProfile.skillLevel] ?? { emoji: "🍳", color: "#F5A623" };
                  return (
                    <View key="skill" style={[styles.metaChip, { backgroundColor: b.color + "18", borderColor: b.color + "35" }]}>
                      <Text style={{ fontSize: 11 }}>{b.emoji}</Text>
                      <Text style={[styles.metaChipText, { color: b.color, fontFamily: "Inter_600SemiBold" }]}>{userProfile.skillLevel}</Text>
                    </View>
                  );
                })() : null}
                {userProfile.goal ? (
                  <View key="goal" style={[styles.metaChip, { backgroundColor: colors.saveBlue + "15", borderColor: colors.saveBlue + "30" }]}>
                    <Text style={{ fontSize: 11 }}>{GOAL_EMOJI[userProfile.goal] ?? "🎯"}</Text>
                    <Text style={[styles.metaChipText, { color: colors.saveBlue, fontFamily: "Inter_600SemiBold" }]}>{userProfile.goal}</Text>
                  </View>
                ) : null}
                {userProfile.weeklyBudget > 0 ? (
                  <View key="budget" style={[styles.metaChip, { backgroundColor: "#4CAF7618", borderColor: "#4CAF7630" }]}>
                    <Feather name="dollar-sign" size={10} color="#4CAF76" />
                    <Text style={[styles.metaChipText, { color: "#4CAF76", fontFamily: "Inter_600SemiBold" }]}>${userProfile.weeklyBudget}/wk</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Allergies collapsible */}
            {userProfile.allergies.length > 0 && (
              <View style={styles.allergySection}>
                <TouchableOpacity style={styles.allergyToggle} onPress={() => setShowAllergies((v) => !v)} activeOpacity={0.7}>
                  <Feather name={showAllergies ? "eye" : "eye-off"} size={13} color={colors.textSecondary} />
                  <Text style={[styles.allergyToggleText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                    Allergies ({userProfile.allergies.length})
                  </Text>
                  <Feather name={showAllergies ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
                </TouchableOpacity>
                {showAllergies && (
                  <View style={styles.tagRow}>
                    {userProfile.allergies.map((a) => (
                      <View key={a} style={[styles.allergyChip, { backgroundColor: "#E8404012", borderColor: "#E8404035" }]}>
                        <Text style={{ fontSize: 10 }}>⚠️</Text>
                        <Text style={[styles.allergyChipText, { color: "#E84040", fontFamily: "Inter_600SemiBold" }]}>{a}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Cuisine preferences horizontal scroll */}
            {userProfile.cuisinePreferences.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cuisinePrefScroll} contentContainerStyle={styles.cuisinePrefContent}>
                {userProfile.cuisinePreferences.map((c) => (
                  <View key={c} style={[styles.cuisinePrefChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 14 }}>{CUISINE_EMOJIS[c] ?? "🍽️"}</Text>
                    <Text style={[styles.cuisinePrefText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{c}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Stats — billboard numbers */}
            <View style={[styles.statsRow, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => { setActiveTab("Recipes"); setRecipeSubtab("Made"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
              >
                <Text style={[styles.statBig, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{cookedRecipes.length}</Text>
                <Text style={[styles.statSmall, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Cooked</Text>
              </TouchableOpacity>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statBig, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>48</Text>
                <Text style={[styles.statSmall, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Followers</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statBig, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{followingList.length}</Text>
                <Text style={[styles.statSmall, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Following</Text>
              </View>
            </View>

            {/* XP / Level progress bar */}
            <XPBar xp={xp} nextXp={nextXp} level={level} colors={colors} />
          </View>

          {/* Premium upgrade banner */}
          {!isSubscribed && (
            <TouchableOpacity
              style={[styles.upgradeCard, { backgroundColor: colors.foreground, borderColor: colors.foreground }]}
              onPress={() => router.push("/paywall")}
              activeOpacity={0.88}
            >
              <View style={styles.upgradeLeft}>
                <View style={[styles.upgradeIconBox, { backgroundColor: colors.primary + "25" }]}>
                  <Text style={{ fontSize: 18 }}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upgradeTitle, { color: colors.background, fontFamily: "SpaceGrotesk_700Bold" }]}>Unlock Premium</Text>
                  <Text style={[styles.upgradeSub, { color: colors.background + "99", fontFamily: "Inter_400Regular" }]}>
                    Unlimited AI · Smart expiry · S$4.99/mo
                  </Text>
                </View>
              </View>
              <View style={[styles.upgradeArrow, { backgroundColor: colors.primary }]}>
                <Feather name="arrow-right" size={14} color="#141210" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sticky Tabs — underline style ────────────────────────────────── */}
        <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {PROFILE_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={styles.tabItem}
                onPress={() => { setActiveTab(tab); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
              >
                <Text style={[styles.tabLabel, {
                  color: isActive ? colors.foreground : colors.textSecondary,
                  fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                }]}>
                  {tab}
                </Text>
                {isActive && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab Content ───────────────────────────────────────────────────── */}
        <View style={styles.tabContent}>

          {/* RECIPES TAB */}
          {activeTab === "Recipes" && (
            <View style={{ gap: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subtabRow}>
                {RECIPE_SUBTABS.map((sub) => {
                  const isActive = recipeSubtab === sub;
                  return (
                    <TouchableOpacity
                      key={sub}
                      style={[
                        styles.subtab,
                        isActive
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                              shadowColor: colors.primary,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 0.4,
                              shadowRadius: 8,
                              elevation: 4,
                            }
                          : { backgroundColor: "transparent", borderColor: colors.border },
                      ]}
                      onPress={() => setRecipeSubtab(sub)}
                    >
                      <Text style={[styles.subtabText, {
                        color: isActive ? colors.primaryForeground : colors.textSecondary,
                        fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                      }]}>
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {recipesList.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 40 }}>🍽</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {recipeSubtab === "Saved Later" ? "No saved recipes yet" : recipeSubtab === "Made" ? "Nothing cooked yet" : "No suggestions yet"}
                  </Text>
                  <Text style={[styles.emptyBody, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {recipeSubtab === "Saved Later" ? "Swipe up on a recipe to save it" : recipeSubtab === "Made" ? "Cook a recipe to see it here" : "Swipe through the Discover tab"}
                  </Text>
                </View>
              ) : (
                <View style={styles.recipeGrid}>
                  {Array.from({ length: Math.ceil(recipesList.length / 2) }, (_, ri) => (
                    <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                      {recipesList.slice(ri * 2, ri * 2 + 2).map((recipe) => {
                        const imgSrc = getRecipeImageSource(recipe.image, recipe.id);
                        return (
                          <TouchableOpacity
                            key={recipe.id}
                            style={[styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => router.push(`/recipe/${recipe.id}`)}
                            activeOpacity={0.88}
                          >
                            <View style={[styles.recipeCardImg, { backgroundColor: colors.primary + "18", overflow: "hidden" }]}>
                              {imgSrc
                                ? <Image source={imgSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                : <Text style={{ fontSize: 34 }}>{CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}</Text>
                              }
                              {/* Title overlay on image */}
                              <View style={styles.recipeCardOverlay}>
                                <Text style={[styles.recipeCardOverlayText, { fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>
                                  {recipe.title}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.recipeCardMeta}>
                              <Text style={[styles.recipeCardCalories, { color: colors.primary, fontFamily: "SpaceGrotesk_700Bold" }]}>
                                {recipe.calories}
                              </Text>
                              <Text style={[styles.recipeCardKcal, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>kcal</Text>
                              <View style={[styles.recipeCardDot, { backgroundColor: colors.border }]} />
                              <Feather name="clock" size={11} color={colors.textMuted} />
                              <Text style={[styles.recipeCardTime, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                                {recipe.prepTime + recipe.cookTime}m
                              </Text>
                            </View>
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

          {/* SAVED TAB */}
          {activeTab === "Saved" && (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: colors.saveBlue }} />
                <Text style={{ fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_600SemiBold", color: colors.saveBlue, textTransform: "uppercase" }}>
                  {savedRecipesList.length > 0 ? `${savedRecipesList.length} Bookmarked` : "Your Cookbook"}
                </Text>
              </View>
              {savedRecipesList.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 40 }}>🔖</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Nothing saved yet</Text>
                  <Text style={[styles.emptyBody, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Swipe up on a recipe to save it here</Text>
                </View>
              ) : (
                <View style={styles.recipeGrid}>
                  {Array.from({ length: Math.ceil(savedRecipesList.length / 2) }, (_, ri) => (
                    <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                      {savedRecipesList.slice(ri * 2, ri * 2 + 2).map((recipe) => {
                        const imgSrc = getRecipeImageSource(recipe.image, recipe.id);
                        return (
                          <TouchableOpacity
                            key={recipe.id}
                            style={[styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => router.push(`/recipe/${recipe.id}`)}
                            activeOpacity={0.88}
                          >
                            <View style={[styles.recipeCardImg, { backgroundColor: colors.saveBlue + "18", overflow: "hidden" }]}>
                              {imgSrc
                                ? <Image source={imgSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                : <Text style={{ fontSize: 34 }}>{CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}</Text>
                              }
                              <View style={styles.recipeCardOverlay}>
                                <Text style={[styles.recipeCardOverlayText, { fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>{recipe.title}</Text>
                              </View>
                            </View>
                            <View style={styles.recipeCardMeta}>
                              <Text style={[styles.recipeCardCalories, { color: colors.saveBlue, fontFamily: "SpaceGrotesk_700Bold" }]}>{recipe.calories}</Text>
                              <Text style={[styles.recipeCardKcal, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>kcal</Text>
                            </View>
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

          {/* STATS TAB */}
          {activeTab === "Stats" && (
            <View style={{ gap: 14 }}>
              {/* Streak hero card */}
              <View style={[styles.streakHero, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30", overflow: "hidden" }]}>
                {/* Saffron top accent bar */}
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.primary }} />
                <View style={styles.streakLeft}>
                  <View style={[styles.streakEmojiBox, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={styles.streakEmojiText}>🔥</Text>
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.streakNum, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>
                      {stats.streak ?? 0}
                    </Text>
                    <Text style={[styles.streakLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Day Streak</Text>
                  </View>
                </View>
                <View style={styles.streakRight}>
                  <Text style={[styles.streakMotivation, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                    {(stats.streak ?? 0) >= 7 ? "On fire! 🏆" : (stats.streak ?? 0) >= 3 ? "Keep it up!" : "Start cooking!"}
                  </Text>
                  <Text style={[styles.streakSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    Cook today to extend
                  </Text>
                </View>
              </View>

              {/* 2×2 stat cards */}
              {(() => {
                const STAT_ITEMS = [
                  { label: "Meals Cooked", value: String(stats.mealsCooked ?? 0), icon: "coffee" as const, color: colors.primary },
                  { label: "Cuisines", value: String(new Set(liveRecipes.filter((r) => cookedRecipes.includes(r.id)).map((r) => r.cuisine)).size), icon: "globe" as const, color: "#00C9B1" },
                  { label: "Waste Saved", value: `${stats.wasteReduced ?? 0}kg`, icon: "wind" as const, color: "#4CAF76" },
                  { label: "Bookmarked", value: String(savedRecipes.length), icon: "bookmark" as const, color: colors.saveBlue },
                ];
                return (
                  <View style={{ gap: 10 }}>
                    {[STAT_ITEMS.slice(0, 2), STAT_ITEMS.slice(2, 4)].map((row, ri) => (
                      <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                        {row.map((s) => (
                          <View key={s.label} style={[styles.statCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.statIconBox, { backgroundColor: s.color + "18" }]}>
                              <Feather name={s.icon} size={18} color={s.color} />
                            </View>
                            <Text style={[styles.statCardNum, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{s.value}</Text>
                            <Text style={[styles.statCardLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Top cuisines */}
              <View style={[styles.cuisineCard, { backgroundColor: colors.card, borderColor: colors.border, overflow: "hidden" }]}>
                {/* Saffron top accent bar */}
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.primary }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 2 }}>
                  <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: colors.primary }} />
                  <Text style={{ fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_600SemiBold", color: colors.primary, textTransform: "uppercase" }}>
                    Top Cuisines
                  </Text>
                </View>
                {ALL_CUISINES.map((c, i) => (
                  <View key={c.name} style={styles.cuisineRow}>
                    <Text style={[styles.cuisineRank, { color: colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                    <Text style={styles.cuisineFlag}>{c.flag}</Text>
                    <Text style={[styles.cuisineName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
                    <View style={[styles.cuisineTrack, { backgroundColor: colors.muted }]}>
                      <View style={[styles.cuisineFill, { backgroundColor: colors.primary, width: `${Math.round((c.count / 18) * 100)}%` as any }]} />
                    </View>
                    <Text style={[styles.cuisineCount, { color: colors.textMuted, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{c.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* BADGES TAB */}
          {activeTab === "Badges" && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_600SemiBold", color: colors.primary, textTransform: "uppercase" }}>
                  {BADGES.filter((b) => b.earned).length} of {BADGES.length} Earned
                </Text>
              </View>
              <View style={styles.badgesGrid}>
                {Array.from({ length: Math.ceil(BADGES.length / 2) }, (_, ri) => (
                  <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
                    {BADGES.slice(ri * 2, ri * 2 + 2).map((badge) => (
                      <View
                        key={badge.id}
                        style={[
                          styles.badgeCard,
                          {
                            flex: 1,
                            backgroundColor: badge.earned ? colors.card : colors.muted + "80",
                            borderColor: badge.earned ? colors.primary + "55" : colors.border,
                            opacity: badge.earned ? 1 : 0.5,
                          },
                        ]}
                      >
                        <View style={[styles.badgeIconBox, {
                          backgroundColor: badge.earned ? colors.primary + "18" : colors.border + "40",
                          borderWidth: badge.earned ? 1.5 : 0,
                          borderColor: badge.earned ? colors.primary + "40" : "transparent",
                        }]}>
                          <Feather
                            name={badge.icon === "flame" ? "zap" : badge.icon === "trophy" ? "award" : badge.icon === "leaf" ? "wind" : badge.icon as any}
                            size={22}
                            color={badge.earned ? colors.primary : colors.textMuted}
                          />
                        </View>
                        <Text style={[styles.badgeName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{badge.name}</Text>
                        <Text style={[styles.badgeDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                          {badge.description}
                        </Text>
                        {badge.earned ? (
                          <View style={[styles.earnedPill, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
                            <Feather name="check" size={10} color={colors.primary} />
                            <Text style={[styles.earnedPillText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Earned</Text>
                          </View>
                        ) : (
                          <View style={[styles.earnedPill, { backgroundColor: colors.muted, borderColor: "transparent" }]}>
                            <Feather name="lock" size={10} color={colors.textMuted} />
                            <Text style={[styles.earnedPillText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Locked</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    {BADGES.slice(ri * 2, ri * 2 + 2).length < 2 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Edit Profile Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.editModal, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Handle */}
          <View style={[styles.editModalHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.editModalCancel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.editModalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={!canSaveProfile} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.editModalSave, { color: canSaveProfile ? colors.primary : colors.textMuted, fontFamily: "Inter_700Bold" }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
            {/* Profile photo tap in modal too */}
            <TouchableOpacity style={styles.editAvatarWrap} onPress={handlePickPhoto} activeOpacity={0.8}>
              {userProfile.photoUri ? (
                <Image source={{ uri: userProfile.photoUri }} style={styles.editAvatarPhoto} />
              ) : (
                <View style={[styles.editAvatarCircle, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.editAvatarLetter, { fontFamily: "Inter_700Bold" }]}>
                    {(editName[0] ?? userProfile.name[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.editAvatarCamBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="camera" size={14} color={colors.foreground} />
              </View>
              <Text style={[styles.editAvatarHint, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Tap to change photo
              </Text>
            </TouchableOpacity>

            {/* Name field */}
            <View style={styles.editField}>
              <Text style={[styles.editFieldLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                style={[styles.editFieldInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                maxLength={40}
                returnKeyType="next"
              />
            </View>

            {/* Bio field */}
            <View style={styles.editField}>
              <Text style={[styles.editFieldLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>Bio</Text>
              <TextInput
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell people about your cooking style…"
                placeholderTextColor={colors.textMuted}
                style={[styles.editFieldInput, styles.editFieldTextArea, { backgroundColor: colors.card, borderColor: bioOverLimit ? "#E84040" : colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                multiline
                numberOfLines={3}
              />
              <Text style={[styles.editFieldCounter, { color: bioOverLimit ? "#E84040" : editBio.length > BIO_LIMIT * 0.85 ? "#F5A623" : colors.textMuted, fontFamily: "Inter_500Medium" }]}>
                {editBio.length}/{BIO_LIMIT}
              </Text>
            </View>

            {/* Read-only info */}
            <View style={[styles.editInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.editInfoRow}>
                <Text style={[styles.editInfoLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Skill Level</Text>
                <Text style={[styles.editInfoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{userProfile.skillLevel}</Text>
              </View>
              <View style={[styles.editInfoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.editInfoRow}>
                <Text style={[styles.editInfoLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Goal</Text>
                <Text style={[styles.editInfoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{userProfile.goal}</Text>
              </View>
              <View style={[styles.editInfoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.editInfoRow}>
                <Text style={[styles.editInfoLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Diet</Text>
                <Text style={[styles.editInfoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{userProfile.dietType.join(", ")}</Text>
              </View>
              <View style={[styles.editInfoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.editInfoRow}>
                <Text style={[styles.editInfoLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Household</Text>
                <Text style={[styles.editInfoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{userProfile.householdSize} {userProfile.householdSize === 1 ? "person" : "people"}</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── XP bar sub-component styles ───────────────────────────────────────────────
const xpStyles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lvlBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  lvlText: { fontSize: 11, letterSpacing: 0.2 },
  xpLabel: { fontSize: 12 },
  xpCount: { fontSize: 11 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Profile header ──────────────────────────────────────────────────────────
  profileHeader: { paddingBottom: 8 },

  cover: { height: 178, overflow: "hidden", position: "relative" },
  coverTint: { ...StyleSheet.absoluteFillObject },
  coverEmoji0: { position: "absolute", fontSize: 90, bottom: -10, left: -8, opacity: 0.13 },
  coverEmoji1: { position: "absolute", fontSize: 70, top: 10, right: 20, opacity: 0.11 },
  coverEmoji2: { position: "absolute", fontSize: 56, bottom: 5, right: 80, opacity: 0.14 },
  coverEmoji3: { position: "absolute", fontSize: 44, top: 30, left: 70, opacity: 0.10 },
  coverEmoji4: { position: "absolute", fontSize: 36, bottom: 20, left: 120, opacity: 0.12 },
  coverVignette: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 48, opacity: 0.85,
  },
  // ── Avatar with streak ring ─────────────────────────────────────────────────
  avatarRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, marginTop: -44 },
  avatarRingOuter: { width: 92, height: 92, position: "relative", alignItems: "center", justifyContent: "center" },
  avatarTrack: { position: "absolute", width: 92, height: 92, borderRadius: 46, borderWidth: 3 },
  avatarArc: {
    position: "absolute", width: 92, height: 92, borderRadius: 46,
    borderWidth: 3, borderColor: "#F5A623",
    borderTopColor: "transparent",
  },
  avatarInner: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  avatarPhoto: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, borderColor: "#fff" },
  avatarLetter: { color: "#fff", fontSize: 32 },
  streakBadge: {
    position: "absolute", bottom: -2, right: -2,
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100, borderWidth: 1.5,
  },
  streakBadgeEmoji: { fontSize: 11 },
  streakBadgeNum: { fontSize: 12 },

  cameraBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5 },
  editBtnText: { fontSize: 13 },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },

  // ── Identity block ──────────────────────────────────────────────────────────
  identityBlock: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  displayName: { fontSize: 26, letterSpacing: -0.5, flexShrink: 1 },
  handle: { fontSize: 14, marginTop: -4 },
  premiumChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  premiumChipText: { color: "#fff", fontSize: 10, letterSpacing: 0.5 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  dietChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  dietChipText: { fontSize: 12 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  metaChipText: { fontSize: 12 },

  allergySection: { gap: 7 },
  allergyToggle: { flexDirection: "row", alignItems: "center", gap: 5 },
  allergyToggleText: { fontSize: 12 },
  allergyChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  allergyChipText: { fontSize: 11 },

  cuisinePrefScroll: { marginHorizontal: -20 },
  cuisinePrefContent: { paddingHorizontal: 20, gap: 7, paddingRight: 20 },
  cuisinePrefChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  cuisinePrefText: { fontSize: 12 },

  // ── Stats row ───────────────────────────────────────────────────────────────
  statsRow: { flexDirection: "row", alignItems: "center", gap: 0, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginTop: 2 },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3 },
  statBig: { fontSize: 24, letterSpacing: -0.5 },
  statSmall: { fontSize: 11 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 36 },

  // ── Upgrade card ────────────────────────────────────────────────────────────
  upgradeCard: { marginHorizontal: 20, marginTop: 14, marginBottom: 4, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  upgradeLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  upgradeIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  upgradeTitle: { fontSize: 16, letterSpacing: -0.2 },
  upgradeSub: { fontSize: 12, marginTop: 2 },
  upgradeArrow: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 13, position: "relative" },
  tabLabel: { fontSize: 13, letterSpacing: -0.1 },
  tabUnderline: { position: "absolute", bottom: 0, left: 10, right: 10, height: 2.5, borderRadius: 2 },

  tabContent: { padding: 16, paddingBottom: 90, gap: 14 },

  // ── Subtabs ─────────────────────────────────────────────────────────────────
  subtabRow: { gap: 8, paddingRight: 4 },
  subtab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  subtabText: { fontSize: 13 },

  // ── Recipe grid ─────────────────────────────────────────────────────────────
  recipeGrid: { gap: 10 },
  recipeCard: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  recipeCardImg: { aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  recipeCardOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingBottom: 8, paddingTop: 28,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  recipeCardOverlayText: { fontSize: 12, color: "#fff", lineHeight: 16 },
  recipeCardMeta: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 9, gap: 4 },
  recipeCardCalories: { fontSize: 14, letterSpacing: -0.2 },
  recipeCardKcal: { fontSize: 11 },
  recipeCardDot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 2 },
  recipeCardTime: { fontSize: 11 },

  // ── Empty states ─────────────────────────────────────────────────────────────
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, letterSpacing: -0.3 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 240 },

  sectionLabel: { fontSize: 13, letterSpacing: 0.1 },

  // ── Stats tab ───────────────────────────────────────────────────────────────
  streakHero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderRadius: 20, borderWidth: 1 },
  streakLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  streakEmojiBox: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  streakEmojiText: { fontSize: 28 },
  streakNum: { fontSize: 36, letterSpacing: -1 },
  streakLabel: { fontSize: 13 },
  streakRight: { alignItems: "flex-end", gap: 4 },
  streakMotivation: { fontSize: 15 },
  streakSub: { fontSize: 11 },

  statCard: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, gap: 8 },
  statIconBox: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statCardNum: { fontSize: 26, letterSpacing: -0.5 },
  statCardLabel: { fontSize: 12, textAlign: "center" },

  cuisineCard: { padding: 18, borderRadius: 18, borderWidth: 1, gap: 12 },
  cuisineCardTitle: { fontSize: 16, letterSpacing: -0.3, marginBottom: 2 },
  cuisineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cuisineRank: { fontSize: 11, width: 22 },
  cuisineFlag: { fontSize: 18 },
  cuisineName: { fontSize: 13, width: 90 },
  cuisineTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  cuisineFill: { height: 6, borderRadius: 3 },
  cuisineCount: { fontSize: 12, width: 22, textAlign: "right" },

  // ── Badges tab ───────────────────────────────────────────────────────────────
  badgesGrid: { gap: 10 },
  badgeCard: { alignItems: "center", padding: 16, borderRadius: 18, borderWidth: 1, gap: 8 },
  badgeIconBox: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  badgeName: { fontSize: 13, textAlign: "center" },
  badgeDesc: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  earnedPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, marginTop: 2 },
  earnedPillText: { fontSize: 10 },

  // ── Edit Profile Modal ────────────────────────────────────────────────────────
  editModal: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  editModalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  editModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  editModalTitle: { fontSize: 17 },
  editModalCancel: { fontSize: 15 },
  editModalSave: { fontSize: 15 },

  editAvatarWrap: { alignItems: "center", gap: 10, position: "relative" },
  editAvatarPhoto: { width: 90, height: 90, borderRadius: 45 },
  editAvatarCircle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  editAvatarLetter: { color: "#fff", fontSize: 36 },
  editAvatarCamBadge: {
    position: "absolute", bottom: 26, right: "33%",
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", borderWidth: 1.5,
  },
  editAvatarHint: { fontSize: 13 },

  editField: { gap: 8 },
  editFieldLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  editFieldInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  editFieldTextArea: { minHeight: 80, textAlignVertical: "top" },
  editFieldCounter: { fontSize: 12, textAlign: "right" },

  editInfoCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  editInfoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  editInfoLabel: { fontSize: 14 },
  editInfoValue: { fontSize: 14 },
  editInfoDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
