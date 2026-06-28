import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { BADGES } from "@/data/mockData";
import { useRouter } from "expo-router";
import { useSubscription } from "@/lib/revenuecat";
import { getRecipeImageSource } from "@/constants/recipeImages";

const { width: SCREEN_W } = Dimensions.get("window");
const BIO_LIMIT = 80;

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", Vietnamese: "🍜", International: "🍽",
};

// ── Brand colours — exact match to all other tabs ─────────────────────────────
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
  danger:             "#E84040",
  saveBlue:           "#5B8EF5",
} as const;

// ── Cross-platform shadow helpers ─────────────────────────────────────────────
const cardShadow = Platform.select({
  ios: {
    shadowColor: "#835500",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  android: { elevation: 4 },
  web: { boxShadow: "0 8px 24px rgba(131,85,0,0.08)" },
}) as object;

// ── Achievement tint by icon ──────────────────────────────────────────────────
function getAchievementTint(icon: string): { bg: string; color: string } {
  const cooking = ["award", "check-circle", "camera", "coffee"];
  const fire    = ["star", "dollar-sign", "zap"];
  const eco     = ["globe", "wind", "sun", "compass"];
  if (cooking.includes(icon)) return { bg: "rgba(76,175,118,0.15)",  color: "#4CAF76" };
  if (fire.includes(icon))    return { bg: "rgba(245,166,35,0.20)",   color: "#F5A623" };
  if (eco.includes(icon))     return { bg: "rgba(91,142,245,0.15)",   color: "#5B8EF5" };
  return                             { bg: "rgba(200,196,190,0.20)",  color: "#7A7570" };
}

// ── Achievement card with Reanimated press scale ──────────────────────────────
function AchievementCard({ badge }: { badge: (typeof BADGES)[number] }) {
  const scale    = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const tint = getAchievementTint(badge.icon);

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.92, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={styles.achievementItem}
    >
      <Reanimated.View style={[styles.achievementItemInner, animStyle]}>
        <View
          style={[
            styles.achievementCircle,
            badge.earned
              ? { backgroundColor: tint.bg, ...(cardShadow as object) }
              : { backgroundColor: C.surfaceHigh, opacity: 0.4 },
          ]}
        >
          <Feather
            name={badge.earned ? (badge.icon as any) : "lock"}
            size={28}
            color={badge.earned ? tint.color : C.textMuted}
          />
        </View>
        <Text
          style={[
            styles.achievementLabel,
            { color: badge.earned ? C.textPrimary : C.textMuted },
          ]}
          numberOfLines={2}
        >
          {badge.name}
        </Text>
      </Reanimated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();

  const {
    userProfile, updateProfile, stats,
    savedRecipes, cookedRecipes, liveRecipes, signOut,
  } = useApp();
  const { isSubscribed } = useSubscription();

  // ── Scroll parallax ──────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroTranslate = scrollY.interpolate({
    inputRange:   [0, 200],
    outputRange:  [0, -80],
    extrapolate:  "clamp",
  });

  // ── XP bar width animation ────────────────────────────────────────────────
  const xpBarAnim = useRef(new Animated.Value(0)).current;

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<"saved" | "cooked">("saved");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName,     setEditName]     = useState(userProfile.name);
  const [editBio,      setEditBio]      = useState(userProfile.bio ?? "");
  const [signingOut,   setSigningOut]   = useState(false);

  // ── Computed values (all from AppContext — no hardcoding) ─────────────────
  const xp       = stats.xp ?? 0;
  const level    = stats.level ?? 1;
  // xpToNextLevel doesn't exist in AppContext; compute it the same way the
  // original XPBar sub-component did.
  const nextXp   = Math.max(Math.ceil((xp + 1) / 1000) * 1000, 1000);
  const xpPercent = Math.min((xp / nextXp) * 100, 100);

  const savedRecipesList  = liveRecipes.filter((r) => savedRecipes.includes(r.id));
  const cookedRecipesList = liveRecipes.filter((r) => cookedRecipes.includes(r.id));
  const recipesList       = activeTab === "saved" ? savedRecipesList : cookedRecipesList;

  const bioOverLimit    = editBio.length > BIO_LIMIT;
  const canSaveProfile  = editName.trim().length > 0 && !bioOverLimit;

  const initials = (userProfile.name ?? "U")
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Animate XP bar on mount / xp change ──────────────────────────────────
  useEffect(() => {
    Animated.timing(xpBarAnim, {
      toValue:        xpPercent,
      duration:       800,
      useNativeDriver: false, // width cannot use native driver
    }).start();
  }, [xpPercent]);

  const xpFillStyle = {
    width: xpBarAnim.interpolate({
      inputRange:  [0, 100],
      outputRange: ["0%", "100%"],
    }),
  };

  // ── Handlers (navigation & logic preserved exactly) ───────────────────────
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/welcome");
  };

  const handlePickPhoto = async () => {
    Alert.alert("Change Profile Photo", "Choose a source", [
      {
        text: "Take Photo",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Please allow camera access in Settings to take a photo.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.8,
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
            mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            updateProfile({ photoUri: result.assets[0].uri });
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ── SCROLL CONTENT ─────────────────────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >

        {/* ── HERO — warm cream, consistent with all other tabs ───────────── */}
        <View style={[styles.heroContainer, { height: insets.top + 320 }]}>

          {/* Parallax bg — cream gradient */}
          <Animated.View
            style={[styles.heroBg, { transform: [{ translateY: heroTranslate }] }]}
          >
            <LinearGradient
              colors={[C.surfaceHighest, C.surfaceLow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.bokeh0} />
            <View style={styles.bokeh1} />
          </Animated.View>

          {/* Hero content — top-aligned */}
          <View style={[styles.heroContent, { paddingTop: insets.top + 8 }]}>

            {/* Top row: settings icon right-aligned */}
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => router.push("/settings")}
                activeOpacity={0.8}
              >
                <Feather name="settings" size={21} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Avatar — tappable for photo change */}
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.85} style={styles.avatarWrap}>
              {userProfile.photoUri ? (
                <Image
                  source={{ uri: userProfile.photoUri }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              {/* Camera badge */}
              <View style={styles.avatarCamBtn}>
                <Feather name="camera" size={12} color={C.textPrimary} />
              </View>
              {/* Pro badge */}
              {isSubscribed && (
                <View style={styles.proBadge}>
                  <Feather name="star" size={11} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.heroName} numberOfLines={1}>
              {userProfile.name}
            </Text>

            {/* Bio / handle */}
            <Text style={styles.heroTagline} numberOfLines={2}>
              {userProfile.bio
                ? userProfile.bio
                : `@${userProfile.name.toLowerCase().replace(/\s+/g, "_")}`}
            </Text>

            {/* Skill + goal meta chips */}
            <View style={styles.heroMeta}>
              <View style={styles.heroMetaChip}>
                <Feather name="zap" size={10} color={C.primary} />
                <Text style={styles.heroMetaText}>{userProfile.skillLevel}</Text>
              </View>
              <View style={styles.heroMetaDot} />
              <View style={styles.heroMetaChip}>
                <Feather name="target" size={10} color={C.secondary} />
                <Text style={styles.heroMetaText}>{userProfile.goal}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroEditBtn}
                onPress={openEditModal}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={14} color={C.textPrimary} />
                <Text style={styles.heroEditBtnText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroPartyBtn}
                onPress={() => router.push("/party-planner")}
                activeOpacity={0.8}
              >
                <Feather name="star" size={14} color={C.primary} />
                <Text style={styles.heroPartyBtnText}>Party Planner</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── XP PROGRESS CARD ────────────────────────────────────────────── */}
        <View style={styles.xpCardWrap}>
          <View style={[styles.xpCard, cardShadow as object]}>
            <View style={styles.xpTopRow}>
              <View style={styles.xpLevelPill}>
                <Text style={styles.xpLevelLabel}>LEVEL {level}</Text>
              </View>
              <Text style={styles.xpCountText}>{xp.toLocaleString()} / {nextXp.toLocaleString()} XP</Text>
            </View>
            <View style={styles.xpTrack}>
              <Animated.View style={[styles.xpFill, xpFillStyle]} />
            </View>
            <View style={styles.xpBottomRow}>
              <Text style={styles.xpNextText}>{(nextXp - xp).toLocaleString()} XP to Level {level + 1}</Text>
              <Text style={styles.xpPctText}>{Math.round(xpPercent)}% there</Text>
            </View>
          </View>
        </View>

        {/* ── STATS BENTO ─────────────────────────────────────────────────── */}
        <View style={styles.statsBento}>
          {/* Large left cell — cooking streak */}
          <View style={[styles.statCellLarge, cardShadow as object]}>
            <Text style={styles.statStreakNum}>{stats.streak ?? 0} 🔥</Text>
            <Text style={styles.statCellLabel}>Day Streak</Text>
            {(stats.streak ?? 0) > 0 && (
              <Text style={styles.statCellSub}>Keep it up!</Text>
            )}
          </View>

          {/* Right column — 2 smaller cells */}
          <View style={styles.statsBentoRight}>
            <View style={[styles.statCellSmall, { backgroundColor: "#4CAF7612", borderColor: "#4CAF7630" }]}>
              <Text style={[styles.statCellNum, { color: C.secondary }]}>{cookedRecipes.length}</Text>
              <Text style={styles.statCellLabel}>Cooked</Text>
            </View>
            <View style={[styles.statCellSmall, { backgroundColor: "#5B8EF512", borderColor: "#5B8EF530" }]}>
              <Text style={[styles.statCellNum, { color: C.saveBlue }]}>{savedRecipes.length}</Text>
              <Text style={styles.statCellLabel}>Saved</Text>
            </View>
          </View>
        </View>

        {/* ── PREMIUM UPGRADE BANNER (preserved) ──────────────────────────── */}
        {!isSubscribed && (
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={() => router.push("/paywall")}
            activeOpacity={0.88}
          >
            <View style={styles.upgradeLeft}>
              <View style={styles.upgradeIconBox}>
                <Text style={{ fontSize: 18 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeTitle}>Unlock Premium</Text>
                <Text style={styles.upgradeSub}>Unlimited AI · Smart expiry · S$4.99/mo</Text>
              </View>
            </View>
            <View style={styles.upgradeArrow}>
              <Feather name="arrow-right" size={14} color={C.textPrimary} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── ACHIEVEMENTS (maps over BADGES from mockData) ───────────────── */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementCountPill}>
              <Text style={styles.achievementCountText}>
                {BADGES.filter((b) => b.earned).length} / {BADGES.length}
              </Text>
            </View>
          </View>
          <View style={styles.achievementsGrid}>
            {BADGES.map((badge) => (
              <AchievementCard key={badge.id} badge={badge} />
            ))}
          </View>
        </View>

        {/* ── RECIPE TABS (Saved / Cooked) ────────────────────────────────── */}
        <View style={styles.tabsSection}>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {(["saved", "cooked"] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      isActive ? styles.tabBtnTextActive : styles.tabBtnTextInactive,
                    ]}
                  >
                    {tab === "saved"
                    ? `Saved (${savedRecipesList.length})`
                    : `Cooked (${cookedRecipesList.length})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Recipe grid or empty state */}
          {recipesList.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather
                name={activeTab === "saved" ? "bookmark" : "check-circle"}
                size={48}
                color={C.textMuted}
              />
              <Text style={styles.emptyText}>No recipes yet</Text>
            </View>
          ) : (
            <View style={styles.recipeGrid}>
              {Array.from(
                { length: Math.ceil(recipesList.length / 2) },
                (_, ri) => (
                  <View key={ri} style={styles.recipeRow}>
                    {recipesList.slice(ri * 2, ri * 2 + 2).map((recipe) => {
                      const imgSrc = getRecipeImageSource(recipe.image, recipe.id);
                      return (
                        <TouchableOpacity
                          key={recipe.id}
                          style={styles.recipeCard}
                          onPress={() => router.push(`/recipe/${recipe.id}`)}
                          activeOpacity={0.88}
                        >
                          {imgSrc ? (
                            <Image
                              source={imgSrc}
                              style={styles.recipeCardImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.recipeCardImage, styles.recipeCardFallback]}>
                              <Text style={{ fontSize: 34 }}>
                                {CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}
                              </Text>
                            </View>
                          )}

                          {/* Gradient overlay */}
                          <LinearGradient
                            colors={["transparent", "rgba(0,0,0,0.6)"]}
                            style={styles.recipeCardOverlay}
                            pointerEvents="none"
                          />

                          <Text style={styles.recipeCardName} numberOfLines={2}>
                            {recipe.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {recipesList.slice(ri * 2, ri * 2 + 2).length < 2 && (
                      <View style={{ flex: 1, margin: 6 }} />
                    )}
                  </View>
                )
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>


      {/* ── EDIT PROFILE MODAL (preserved exactly) ──────────────────────────── */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.editModal, { backgroundColor: C.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Drag handle */}
          <View style={[styles.editModalHandle, { backgroundColor: C.surfaceHigh }]} />

          {/* Header */}
          <View style={styles.editModalHeader}>
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.editModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={!canSaveProfile}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.editModalSave, { color: canSaveProfile ? C.primary : C.textMuted }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 20, paddingBottom: 40 }}
          >
            {/* Photo picker */}
            <TouchableOpacity
              style={styles.editAvatarWrap}
              onPress={handlePickPhoto}
              activeOpacity={0.8}
            >
              <View style={styles.editAvatarPhotoWrap}>
                {userProfile.photoUri ? (
                  <Image
                    source={{ uri: userProfile.photoUri }}
                    style={styles.editAvatarPhoto}
                  />
                ) : (
                  <View style={[styles.editAvatarCircle, { backgroundColor: C.primary }]}>
                    <Text style={styles.editAvatarLetter}>
                      {(editName[0] ?? userProfile.name[0] ?? "?").toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={[styles.editAvatarCamBadge, { backgroundColor: C.surface, borderColor: C.surfaceHigh }]}>
                  <Feather name="camera" size={14} color={C.textPrimary} />
                </View>
              </View>
              <Text style={styles.editAvatarHint}>Tap to change photo</Text>
            </TouchableOpacity>

            {/* Name field */}
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={C.textMuted}
                style={[styles.editFieldInput, { color: C.textPrimary }]}
                maxLength={40}
                returnKeyType="next"
              />
            </View>

            {/* Bio field */}
            <View style={styles.editField}>
              <View style={styles.editFieldLabelRow}>
                <Text style={styles.editFieldLabel}>Bio</Text>
                <Text style={[styles.editFieldCounter, { color: bioOverLimit ? C.danger : editBio.length > BIO_LIMIT * 0.85 ? C.primary : C.textMuted }]}>
                  {editBio.length}/{BIO_LIMIT}
                </Text>
              </View>
              <TextInput
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell people about your cooking style…"
                placeholderTextColor={C.textMuted}
                style={[
                  styles.editFieldInput,
                  styles.editFieldTextArea,
                  {
                    color: C.textPrimary,
                    borderColor: bioOverLimit ? C.danger : C.surfaceHigh,
                  },
                ]}
                multiline
                numberOfLines={3}
                maxLength={BIO_LIMIT + 10}
              />
            </View>

            {/* Read-only info card */}
            <View style={[styles.editInfoCard, { borderColor: C.surfaceHigh }]}>
              <View style={styles.editInfoRow}>
                <Text style={styles.editInfoLabel}>Skill Level</Text>
                <Text style={styles.editInfoValue}>{userProfile.skillLevel}</Text>
              </View>
              <View style={[styles.editInfoDivider, { backgroundColor: C.surfaceHigh }]} />
              <View style={styles.editInfoRow}>
                <Text style={styles.editInfoLabel}>Goal</Text>
                <Text style={styles.editInfoValue}>{userProfile.goal}</Text>
              </View>
              <View style={[styles.editInfoDivider, { backgroundColor: C.surfaceHigh }]} />
              <View style={styles.editInfoRow}>
                <Text style={styles.editInfoLabel}>Diet</Text>
                <Text style={styles.editInfoValue}>{userProfile.dietType.join(", ")}</Text>
              </View>
              <View style={[styles.editInfoDivider, { backgroundColor: C.surfaceHigh }]} />
              <View style={styles.editInfoRow}>
                <Text style={styles.editInfoLabel}>Household</Text>
                <Text style={styles.editInfoValue}>
                  {userProfile.householdSize}{" "}
                  {userProfile.householdSize === 1 ? "person" : "people"}
                </Text>
              </View>
            </View>

            {/* Sign out */}
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.75}
              disabled={signingOut}
            >
              <Feather name="log-out" size={15} color={C.danger} />
              <Text style={styles.signOutText}>
                {signingOut ? "Signing out…" : "Sign Out"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: { overflow: "hidden" }, // height set inline (insets.top + 320)
  heroBg: {
    position: "absolute", top: -40, left: -20, right: -20, bottom: -40,
  },
  bokeh0: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(245,166,35,0.10)", top: -30, right: -40,
  },
  bokeh1: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(76,175,118,0.07)", bottom: 20, left: -20,
  },
  heroContent: {
    flex: 1, alignItems: "center", justifyContent: "flex-start",
    paddingHorizontal: 24,
  },
  heroTopRow: {
    flexDirection: "row", alignItems: "center",
    width: "100%", marginBottom: 6, height: 40,
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(122,117,112,0.10)",
  },

  // Avatar
  avatarWrap: {
    marginBottom: 10, position: "relative",
    alignItems: "center",
  },
  avatarImg: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: C.surface,
  },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: C.surface,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 28, fontFamily: "Epilogue_700Bold", color: "#FFFFFF",
  },
  avatarCamBtn: {
    position: "absolute", bottom: 0, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.surfaceHighest,
    borderWidth: 2, borderColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  proBadge: {
    position: "absolute", top: 0, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.secondary, borderWidth: 2, borderColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },

  heroName: {
    fontFamily: "Epilogue_700Bold", fontSize: 26, color: C.textPrimary,
    textAlign: "center",
  },
  heroTagline: {
    fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular",
    textAlign: "center", marginTop: 4, marginBottom: 10,
    lineHeight: 20,
  },
  heroMeta: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14,
  },
  heroMetaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.surface,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 0.5, borderColor: C.outlineVariant,
  },
  heroMetaText: {
    fontSize: 11, fontFamily: "Epilogue_700Bold",
    color: C.textPrimary, letterSpacing: 0.2,
  },
  heroMetaDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: C.outlineVariant,
  },
  heroActions: { flexDirection: "row", gap: 10 },
  heroEditBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 0.5, borderColor: C.outlineVariant,
    minHeight: 44,
  },
  heroEditBtnText: {
    fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },
  heroPartyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surfaceLow,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: C.primary + "55", minHeight: 44,
  },
  heroPartyBtnText: {
    fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.primary,
  },

  // ── XP Progress Card ──────────────────────────────────────────────────────
  xpCardWrap: { marginTop: 16, paddingHorizontal: 16 },
  xpCard: { backgroundColor: C.surface, borderRadius: 20, padding: 16 },
  xpTopRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  xpLevelPill: {
    backgroundColor: C.surfaceLow, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.primary + "50",
  },
  xpLevelLabel: {
    fontSize: 11, fontFamily: "Epilogue_700Bold",
    letterSpacing: 1.2, color: C.primary,
  },
  xpCountText: {
    fontSize: 12, color: C.textMuted, fontFamily: "Epilogue_400Regular",
  },
  xpTrack: {
    height: 10, borderRadius: 5,
    backgroundColor: C.surfaceHigh, overflow: "hidden",
  },
  xpFill: {
    height: "100%" as any, borderRadius: 5, backgroundColor: C.primary,
  },
  xpBottomRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 8,
  },
  xpNextText: {
    fontSize: 11, color: C.textMuted, fontFamily: "Epilogue_400Regular",
  },
  xpPctText: {
    fontSize: 11, color: C.primary, fontFamily: "Epilogue_700Bold",
  },

  // ── Stats Bento ───────────────────────────────────────────────────────────
  statsBento: {
    flexDirection: "row", marginTop: 16, paddingHorizontal: 16, gap: 10,
  },
  statCellLarge: {
    flex: 1.2, backgroundColor: C.surfaceLow,
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: C.primary + "30",
    justifyContent: "center",
  },
  statsBentoRight: { flex: 1, gap: 10 },
  statCellSmall: {
    flex: 1, borderRadius: 20, padding: 14,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  statStreakNum: {
    fontSize: 30, fontFamily: "Epilogue_700Bold", color: C.primary,
  },
  statCellNum: {
    fontSize: 24, fontFamily: "Epilogue_700Bold",
  },
  statCellLabel: {
    fontSize: 11, color: C.textMuted, marginTop: 4,
    fontFamily: "Epilogue_400Regular",
  },
  statCellSub: {
    fontSize: 10, color: C.primary, marginTop: 2,
    fontFamily: "Epilogue_700Bold", letterSpacing: 0.3,
  },

  // ── Upgrade card ──────────────────────────────────────────────────────────
  upgradeCard: {
    marginTop: 16, marginHorizontal: 16, borderRadius: 16, padding: 16,
    backgroundColor: C.textPrimary,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  upgradeLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  upgradeIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary + "25",
  },
  upgradeTitle: {
    fontSize: 15, fontFamily: "Epilogue_700Bold", color: C.background,
  },
  upgradeSub: {
    fontSize: 12, fontFamily: "Epilogue_400Regular",
    color: C.background + "99", marginTop: 2,
  },
  upgradeArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },

  // ── Achievements ──────────────────────────────────────────────────────────
  achievementsSection: { marginTop: 32, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22, fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },
  achievementCountPill: {
    backgroundColor: C.surfaceLow, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.outlineVariant,
  },
  achievementCountText: {
    fontSize: 12, fontFamily: "Epilogue_700Bold", color: C.textMuted,
  },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap" },
  achievementItem: {
    width: (SCREEN_W - 32) / 3,
    alignItems: "center", marginBottom: 16,
    minHeight: 44,
  },
  achievementItemInner: { alignItems: "center" },
  achievementCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  achievementLabel: {
    fontSize: 12, textAlign: "center", marginTop: 8,
    fontFamily: "Epilogue_400Regular",
    paddingHorizontal: 4,
  },

  // ── Recipe Tabs ───────────────────────────────────────────────────────────
  tabsSection: { marginTop: 32 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: "rgba(215,195,174,0.3)",
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1, paddingVertical: 16, alignItems: "center", minHeight: 44,
  },
  tabBtnActive: {
    borderBottomWidth: 3, borderBottomColor: C.primary,
  },
  tabBtnText: { fontSize: 14, letterSpacing: 0.5 },
  tabBtnTextActive: {
    fontFamily: "Epilogue_700Bold", color: C.primary,
  },
  tabBtnTextInactive: {
    fontFamily: "Epilogue_400Regular", color: C.textMuted,
  },

  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: {
    fontSize: 16, color: C.textMuted, marginTop: 12,
    fontFamily: "Epilogue_400Regular",
  },

  recipeGrid: { padding: 10 },
  recipeRow:  { flexDirection: "row" },
  recipeCard: {
    flex: 1, margin: 6, borderRadius: 16,
    overflow: "hidden", aspectRatio: 1,
    backgroundColor: C.surfaceLow,
  },
  recipeCardImage: { ...StyleSheet.absoluteFillObject },
  recipeCardFallback: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary + "18",
  },
  recipeCardOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 60,
  },
  recipeCardName: {
    position: "absolute", bottom: 12, left: 12, right: 12,
    fontSize: 12, color: "#FFFFFF", fontFamily: "Epilogue_700Bold",
  },

  // ── Edit Modal ────────────────────────────────────────────────────────────
  editModal: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  editModalHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 20,
  },
  editModalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 28,
  },
  editModalTitle: {
    fontSize: 17, fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },
  editModalCancel: {
    fontSize: 15, fontFamily: "Epilogue_400Regular", color: C.textMuted,
  },
  editModalSave: {
    fontSize: 15, fontFamily: "Epilogue_700Bold",
  },

  editAvatarWrap:      { alignItems: "center", gap: 10 },
  editAvatarPhotoWrap: { position: "relative" },
  editAvatarPhoto:     { width: 90, height: 90, borderRadius: 45 },
  editAvatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: "center", justifyContent: "center",
  },
  editAvatarLetter: {
    color: "#fff", fontSize: 36, fontFamily: "Epilogue_700Bold",
  },
  editAvatarCamBadge: {
    position: "absolute", bottom: -4, right: -4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  editAvatarHint: {
    fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular",
  },

  editField:         { gap: 8 },
  editFieldLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editFieldLabel: {
    fontSize: 12, fontFamily: "Epilogue_700Bold", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  editFieldCounter: { fontSize: 12, fontFamily: "Epilogue_400Regular" },
  editFieldInput: {
    borderWidth: 1, borderRadius: 14, borderColor: C.surfaceHigh,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    fontFamily: "Epilogue_400Regular", backgroundColor: C.surfaceLow,
  },
  editFieldTextArea: { minHeight: 80, textAlignVertical: "top" },

  editInfoCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  editInfoRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  editInfoLabel: {
    fontSize: 14, color: C.textMuted, fontFamily: "Epilogue_400Regular",
  },
  editInfoValue: {
    fontSize: 14, color: C.textPrimary, fontFamily: "Epilogue_700Bold",
  },
  editInfoDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  signOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    justifyContent: "center", paddingVertical: 16, borderRadius: 12,
    borderWidth: 1, borderColor: C.danger + "40",
    backgroundColor: C.danger + "08",
  },
  signOutText: {
    fontSize: 15, fontFamily: "Epilogue_700Bold", color: C.danger,
  },
});
