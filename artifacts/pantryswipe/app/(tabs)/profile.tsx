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
import { BlurView } from "expo-blur";
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

// ── Brand colours (inline so this file has no external color dependency) ──────
const C = {
  primary:     "#F5A623",
  secondary:   "#4CAF76",
  textPrimary: "#141210",
  textMuted:   "#7A7570",
  surface:     "#FFFFFF",
  background:  "#FAFAF8",
  surfaceLow:  "#F5F3EF",
  surfaceHigh: "#E8E4DE",
  danger:      "#E84040",
  saveBlue:    "#5B8EF5",
};

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

        {/* ── HERO (320px, parallax bg) ─────────────────────────────────── */}
        <View style={styles.heroContainer}>

          {/* Parallax background layer */}
          <Animated.View
            style={[styles.heroBg, { transform: [{ translateY: heroTranslate }] }]}
          >
            <LinearGradient
              colors={[C.primary + "EE", "#3B1F00"]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Subtle bokeh circles for texture */}
            <View style={styles.bokeh0} />
            <View style={styles.bokeh1} />
          </Animated.View>

          {/* Dark gradient overlay (bottom fade to background) */}
          <View pointerEvents="none" style={styles.heroOverlayWrap}>
            <LinearGradient
              colors={["transparent", "rgba(20,18,16,0.55)", C.background]}
              locations={[0, 0.6, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          {/* Hero content — avatar, name, tagline, actions */}
          <View style={[styles.heroContent, { paddingTop: insets.top + 64 }]}>

            {/* Avatar */}
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.85}>
              <View style={styles.avatarWrap}>
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

                {/* Pro badge — bottom-right of avatar */}
                {isSubscribed && (
                  <View style={styles.proBadge}>
                    <Feather name="star" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.heroName} numberOfLines={1}>
              {userProfile.name}
            </Text>

            {/* Tagline */}
            <Text style={styles.heroTagline} numberOfLines={2}>
              {userProfile.bio
                ? userProfile.bio
                : `@${userProfile.name.toLowerCase().replace(/\s+/g, "_")}`}
            </Text>

            {/* Action buttons row */}
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

        {/* ── XP PROGRESS CARD (overlaps hero by -32px) ───────────────────── */}
        <View style={styles.xpCardWrap}>
          <View style={[styles.xpCard, cardShadow as object]}>
            <View style={styles.xpTopRow}>
              <Text style={styles.xpLevelLabel}>LEVEL {level}</Text>
              <Text style={styles.xpCountText}>
                {xp} / {nextXp} XP to Level {level + 1}
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <Animated.View style={[styles.xpFill, xpFillStyle]} />
            </View>
          </View>
        </View>

        {/* ── STATS ROW (3 chips — all from AppContext) ───────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            {/* recipes cooked = cookedRecipes.length from AppContext */}
            <Text style={styles.statNumber}>{cookedRecipes.length}</Text>
            <Text style={styles.statLabel}>Recipes Cooked</Text>
          </View>

          <View style={styles.statChip}>
            {/* cookingStreak = stats.streak from AppContext */}
            <Text style={styles.statNumber}>{stats.streak ?? 0} 🔥</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={styles.statChip}>
            {/* gourmetLevel = stats.level from AppContext */}
            <Text style={styles.statNumber}>{level}</Text>
            <Text style={styles.statLabel}>Gourmet Level</Text>
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
          <Text style={styles.sectionTitle}>Achievements</Text>
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
                    {tab === "saved" ? "Saved" : "Cooked"}
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

      {/* ── HEADER BAR (absolute, always on top) ────────────────────────────── */}
      <View style={[styles.headerBarWrap, { height: insets.top + 56 }]}>
        {Platform.OS === "ios" ? (
          <BlurView
            tint="light"
            intensity={80}
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.headerBarBg]} />
        )}
        <View style={[styles.headerBarRow, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={C.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/settings")}
          >
            <Feather name="settings" size={24} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

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

  // ── Header bar ────────────────────────────────────────────────────────────
  headerBarWrap: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
    overflow: "hidden",
  },
  headerBarBg: { backgroundColor: "rgba(250,250,248,0.92)" },
  headerBarRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24,
  },
  iconBtn: {
    padding: 8, borderRadius: 20,
    minHeight: 44, minWidth: 44,
    alignItems: "center", justifyContent: "center",
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: { height: 320, overflow: "hidden" },
  heroBg: {
    position: "absolute", top: -40, left: -20, right: -20, bottom: -40,
  },
  bokeh0: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.06)", top: -20, right: -30,
  },
  bokeh1: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: 10, left: 20,
  },
  heroOverlayWrap: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 220,
  },
  heroContent: {
    flex: 1, alignItems: "center", justifyContent: "flex-end",
    paddingBottom: 24, paddingHorizontal: 24,
  },

  // Avatar
  avatarWrap: { marginBottom: 12, position: "relative" },
  avatarImg: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 4, borderColor: C.surface,
  },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 4, borderColor: C.surface,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 32, fontFamily: "Epilogue_700Bold", color: "#FFFFFF",
  },
  proBadge: {
    position: "absolute", bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.secondary, borderWidth: 2, borderColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },

  heroName: {
    fontFamily: "Epilogue_700Bold", fontSize: 28, color: C.surface,
    textAlign: "center",
  },
  heroTagline: {
    fontSize: 16, color: "rgba(255,255,255,0.75)",
    textAlign: "center", marginTop: 4, marginBottom: 16,
  },
  heroActions: { flexDirection: "row", gap: 12 },
  heroEditBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    minHeight: 44,
  },
  heroEditBtnText: {
    fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },
  heroPartyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.primary + "22",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: C.primary + "55", minHeight: 44,
  },
  heroPartyBtnText: {
    fontSize: 13, fontFamily: "Epilogue_700Bold", color: C.primary,
  },

  // ── XP Progress Card ──────────────────────────────────────────────────────
  xpCardWrap: { marginTop: -32, zIndex: 20, paddingHorizontal: 16 },
  xpCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },
  xpTopRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  xpLevelLabel: {
    fontSize: 12, fontFamily: "Epilogue_700Bold",
    letterSpacing: 1.5, color: C.primary,
  },
  xpCountText: {
    fontSize: 11, color: C.textMuted, fontFamily: "Epilogue_400Regular",
  },
  xpTrack: {
    height: 12, borderRadius: 6,
    backgroundColor: C.surfaceHigh, overflow: "hidden",
  },
  xpFill: {
    height: "100%" as any, borderRadius: 6, backgroundColor: C.primary,
  },

  // ── Stats Row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row", marginTop: 24, paddingHorizontal: 16, gap: 12,
  },
  statChip: {
    flex: 1, backgroundColor: C.surfaceLow,
    borderRadius: 16, padding: 16, alignItems: "center",
    borderWidth: 0.5, borderColor: "rgba(215,195,174,0.3)",
  },
  statNumber: {
    fontSize: 24, fontFamily: "Epilogue_700Bold", color: C.primary,
  },
  statLabel: {
    fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 4,
    fontFamily: "Epilogue_400Regular",
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
  sectionTitle: {
    fontSize: 24, fontFamily: "Epilogue_700Bold",
    color: C.textPrimary, marginBottom: 24,
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
