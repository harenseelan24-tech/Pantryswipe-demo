import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { useSubscription } from "@/lib/revenuecat";

// ── Persisted settings (non-profile preferences) ─────────────────────────────
interface AppSettings {
  notifExpiryAlerts: boolean;
  notifMealReminders: boolean;
  notifWeeklyDigest: boolean;
  notifSocialActivity: boolean;
  expiryWarningDays: number;
  autoAddToShopping: boolean;
  measurementSystem: "Metric" | "Imperial";
  dataSharing: boolean;
  analytics: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifExpiryAlerts: true,
  notifMealReminders: true,
  notifWeeklyDigest: false,
  notifSocialActivity: true,
  expiryWarningDays: 3,
  autoAddToShopping: true,
  measurementSystem: "Metric",
  dataSharing: false,
  analytics: true,
};

// ── Option lists (match onboarding) ──────────────────────────────────────────
const DIET_OPTIONS = ["Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Keto", "Gluten-Free", "Paleo"];
const ALLERGEN_OPTIONS = ["Peanuts", "Tree Nuts", "Dairy", "Gluten", "Eggs", "Shellfish", "Fish", "Soy", "Sesame", "Sulphites", "Corn"];
const CUISINE_OPTIONS = ["Italian", "Japanese", "Korean", "American", "Indian", "Mediterranean", "Chinese", "Thai", "Mexican", "French", "Vietnamese", "Middle Eastern", "Singaporean"];
const GOAL_OPTIONS = ["Build Muscle", "Eat Healthier", "Save Money", "Cook Faster", "Explore Cuisines", "Cook for Others", "Meal Prep", "Reduce Waste", "Lose Weight"];
const SKILL_OPTIONS = ["Beginner", "Home Cook", "Confident", "Advanced"];

type ModalType = "name" | "diet" | "allergens" | "household" | "budget" | "cuisine" | "goal" | "skill" | null;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, updateProfile } = useApp();
  const { isSubscribed, restore, isRestoring } = useSubscription();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Temporary edit state for the currently open modal
  const [editName, setEditName] = useState(userProfile.name);
  const [editDiet, setEditDiet] = useState<string[]>(userProfile.dietType);
  const [editAllergens, setEditAllergens] = useState<string[]>(userProfile.allergies);
  const [editHousehold, setEditHousehold] = useState(userProfile.householdSize);
  const [editBudget, setEditBudget] = useState(String(userProfile.weeklyBudget));
  const [editCuisines, setEditCuisines] = useState<string[]>(userProfile.cuisinePreferences);
  const [editGoal, setEditGoal] = useState(userProfile.goal);
  const [editSkill, setEditSkill] = useState(userProfile.skillLevel);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  // ── Load / save persisted settings ─────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.SETTINGS).then((raw) => {
      if (raw) {
        try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); } catch { /* use defaults */ }
      }
    });
  }, []);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Open modal helpers (seed temp state from current profile) ──────────────
  const openModal = (type: ModalType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === "name")      setEditName(userProfile.name);
    if (type === "diet")      setEditDiet(userProfile.dietType);
    if (type === "allergens") setEditAllergens(userProfile.allergies);
    if (type === "household") setEditHousehold(userProfile.householdSize);
    if (type === "budget")    setEditBudget(String(userProfile.weeklyBudget || ""));
    if (type === "cuisine")   setEditCuisines(userProfile.cuisinePreferences);
    if (type === "goal")      setEditGoal(userProfile.goal);
    if (type === "skill")     setEditSkill(userProfile.skillLevel);
    setActiveModal(type);
  };

  // ── Save helpers ───────────────────────────────────────────────────────────
  const saveName = () => {
    if (editName.trim()) { updateProfile({ name: editName.trim() }); }
    setActiveModal(null);
  };
  const saveDiet = () => {
    const resolved = editDiet.length === 0 ? ["Omnivore"] : editDiet;
    updateProfile({ dietType: resolved });
    setActiveModal(null);
  };
  const saveAllergens = () => { updateProfile({ allergies: editAllergens }); setActiveModal(null); };
  const saveHousehold = () => { updateProfile({ householdSize: editHousehold }); setActiveModal(null); };
  const saveBudget = () => { updateProfile({ weeklyBudget: parseFloat(editBudget) || 0 }); setActiveModal(null); };
  const saveCuisines = () => { updateProfile({ cuisinePreferences: editCuisines }); setActiveModal(null); };
  const saveGoal = () => { updateProfile({ goal: editGoal }); setActiveModal(null); };
  const saveSkill = () => { updateProfile({ skillLevel: editSkill }); setActiveModal(null); };

  // ── Account actions ────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.removeItem(STORAGE_KEYS.SETUP_COMPLETE);
    router.replace("/welcome");
  };

  const handleClearData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Clear All Data",
      "This permanently deletes your pantry, recipes, stats, and all preferences. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
            router.replace("/welcome");
          },
        },
      ]
    );
  };

  // ── UI sub-components ──────────────────────────────────────────────────────
  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>{title}</Text>
  );

  const SettingRow = ({
    icon, label, value, onPress, danger = false, last = false,
  }: { icon: string; label: string; value?: string; onPress: () => void; danger?: boolean; last?: boolean }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? "#E8404015" : colors.primary + "15" }]}>
        <Feather name={icon as any} size={16} color={danger ? "#E84040" : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? "#E84040" : colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={[styles.rowValue, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{value}</Text>}
        {!danger && <Feather name="chevron-right" size={15} color={colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  const ToggleRow = ({
    icon, label, subtitle, value, onChange, last = false,
  }: { icon: string; label: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) => (
    <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primary + "15" }]}>
        <Feather name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
        {subtitle && <Text style={[styles.rowSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        ios_backgroundColor={colors.border}
      />
    </View>
  );

  // ── Sheet wrapper for all modals ───────────────────────────────────────────
  const Sheet = ({ visible, onClose, title, onSave, children }: {
    visible: boolean; onClose: () => void; title: string; onSave?: () => void; children: React.ReactNode;
  }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{title}</Text>
          {onSave ? (
            <TouchableOpacity onPress={onSave}>
              <Text style={[styles.sheetSave, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {children}
      </View>
    </Modal>
  );

  const MultiSelect = ({ options, selected, onToggle }: {
    options: string[]; selected: string[]; onToggle: (v: string) => void;
  }) => (
    <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
      <View style={styles.optionGrid}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.optionChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(opt); }}
            >
              <Text style={[styles.optionChipText, { color: active ? "#fff" : colors.foreground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const SingleSelect = ({ options, selected, onSelect }: {
    options: string[]; selected: string; onSelect: (v: string) => void;
  }) => (
    <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
      {options.map((opt, i) => {
        const active = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.singleRow, { borderBottomColor: colors.border, borderBottomWidth: i < options.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(opt); }}
          >
            <Text style={[styles.singleRowText, { color: active ? colors.primary : colors.foreground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{opt}</Text>
            {active && <Feather name="check" size={18} color={colors.primary} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Derived display values ─────────────────────────────────────────────────
  const allergenDisplay = userProfile.allergies.length > 0 ? userProfile.allergies.join(", ") : "None";
  const dietDisplay = userProfile.dietType.join(", ");
  const cuisineDisplay = userProfile.cuisinePreferences.length > 0
    ? `${userProfile.cuisinePreferences.length} selected`
    : "All cuisines";
  const budgetDisplay = userProfile.weeklyBudget > 0 ? `$${userProfile.weeklyBudget}/wk` : "Not set";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Subscription card ── */}
        {isSubscribed ? (
          <View style={[styles.premiumCard, { backgroundColor: "#4CAF7612", borderColor: "#4CAF7635" }]}>
            <View style={styles.premiumLeft}>
              <View style={[styles.premiumBadge, { backgroundColor: "#4CAF76" }]}>
                <Feather name="zap" size={14} color="#fff" />
              </View>
              <View>
                <Text style={[styles.premiumTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Premium Active ✨</Text>
                <Text style={[styles.premiumSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Unlimited AI Chef · Full features</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: "#4CAF76" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); restore(); }}
              disabled={isRestoring}
            >
              <Text style={[{ color: "#4CAF76", fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>
                {isRestoring ? "…" : "Manage"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.upgradeCard, { backgroundColor: "#F5A6230E", borderColor: "#F5A62340" }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/paywall"); }}
            activeOpacity={0.85}
          >
            <View style={styles.upgradeLeft}>
              <Text style={{ fontSize: 26 }}>✨</Text>
              <View>
                <Text style={[styles.premiumTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Upgrade to Premium</Text>
                <Text style={[styles.premiumSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Unlimited AI · Smart expiry · S$4.99/mo</Text>
              </View>
            </View>
            <View style={[styles.chevronCircle, { backgroundColor: "#F5A623" }]}>
              <Feather name="chevron-right" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* ── ACCOUNT ── */}
        <SectionHeader title="ACCOUNT" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="user"         label="Name"                 value={userProfile.name}         onPress={() => openModal("name")} />
          <SettingRow icon="heart"        label="Dietary Preferences"  value={dietDisplay}              onPress={() => openModal("diet")} />
          <SettingRow icon="alert-circle" label="Allergens"            value={allergenDisplay}          onPress={() => openModal("allergens")} />
          <SettingRow icon="users"        label="Household Size"       value={`${userProfile.householdSize} people`} onPress={() => openModal("household")} />
          <SettingRow icon="dollar-sign" label="Weekly Budget"        value={budgetDisplay}            onPress={() => openModal("budget")} last />
        </View>

        {/* ── NOTIFICATIONS ── */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="bell"    label="Expiry Alerts"       subtitle="Warn when ingredients are about to expire"    value={settings.notifExpiryAlerts}    onChange={(v) => updateSetting("notifExpiryAlerts", v)} />
          <ToggleRow icon="clock"   label="Meal Reminders"      subtitle="Daily reminder to check today's meals"        value={settings.notifMealReminders}   onChange={(v) => updateSetting("notifMealReminders", v)} />
          <ToggleRow icon="mail"    label="Weekly Digest"       subtitle="Summary of your cooking week every Sunday"    value={settings.notifWeeklyDigest}    onChange={(v) => updateSetting("notifWeeklyDigest", v)} />
          <ToggleRow icon="users"   label="Social Activity"     subtitle="Likes, comments, and new followers"           value={settings.notifSocialActivity}  onChange={(v) => updateSetting("notifSocialActivity", v)} last />
        </View>

        {/* ── PANTRY ── */}
        <SectionHeader title="PANTRY" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Expiry warning stepper */}
          <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="alert-triangle" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1 }]}>Expiry Warning</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSetting("expiryWarningDays", Math.max(1, settings.expiryWarningDays - 1)); }}
              >
                <Feather name="minus" size={13} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.stepVal, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{settings.expiryWarningDays}d</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSetting("expiryWarningDays", Math.min(14, settings.expiryWarningDays + 1)); }}
              >
                <Feather name="plus" size={13} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <ToggleRow icon="shopping-cart" label="Auto Shopping List" subtitle="Add expiring items to shopping list automatically" value={settings.autoAddToShopping} onChange={(v) => updateSetting("autoAddToShopping", v)} />

          {/* Measurement system toggle */}
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="activity" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1 }]}>Measurements</Text>
            <View style={[styles.segmented, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {(["Metric", "Imperial"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segBtn, settings.measurementSystem === m && { backgroundColor: colors.primary }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSetting("measurementSystem", m); }}
                >
                  <Text style={[styles.segBtnText, { color: settings.measurementSystem === m ? "#fff" : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── DISCOVER ── */}
        <SectionHeader title="DISCOVER" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="globe"       label="Cuisine Preferences" value={cuisineDisplay}           onPress={() => openModal("cuisine")} />
          <SettingRow icon="target"      label="Cooking Goal"        value={userProfile.goal}         onPress={() => openModal("goal")} />
          <SettingRow icon="bar-chart-2" label="Skill Level"         value={userProfile.skillLevel}   onPress={() => openModal("skill")} last />
        </View>

        {/* ── PRIVACY ── */}
        <SectionHeader title="PRIVACY" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="share-2"     label="Data Sharing" subtitle="Share anonymised usage data to improve recipes" value={settings.dataSharing} onChange={(v) => updateSetting("dataSharing", v)} />
          <ToggleRow icon="trending-up" label="Analytics"    subtitle="Help us understand how you use PantrySwipe"     value={settings.analytics}   onChange={(v) => updateSetting("analytics", v)} last />
        </View>

        {/* ── ABOUT ── */}
        <SectionHeader title="ABOUT" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="info"        label="Version"          value="1.0.0"  onPress={() => {}} />
          <SettingRow icon="file-text"   label="Terms of Service"               onPress={() => router.push("/terms-of-service")} />
          <SettingRow icon="shield"      label="Privacy Policy"                 onPress={() => router.push("/privacy-policy")} />
          <SettingRow icon="star"        label="Rate PantrySwipe"               onPress={() => Linking.openURL("https://apps.apple.com/").catch(() => {})} />
          <SettingRow icon="help-circle" label="Help & Support"                 onPress={() => Linking.openURL("mailto:support@pantryswipe.app").catch(() => {})} last />
        </View>

        {/* ── ACCOUNT ACTIONS ── */}
        <SectionHeader title="ACCOUNT ACTIONS" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="log-out" label="Sign Out"       onPress={handleSignOut}    danger />
          <SettingRow icon="trash-2" label="Clear All Data" onPress={handleClearData}  danger last />
        </View>

      </ScrollView>

      {/* ═══════════════════════════════ MODALS ════════════════════════════════ */}

      {/* Name */}
      <Sheet visible={activeModal === "name"} onClose={() => setActiveModal(null)} title="Your Name" onSave={saveName}>
        <TextInput
          style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, fontFamily: "Inter_400Regular" }]}
          value={editName}
          onChangeText={setEditName}
          placeholder="Enter your name"
          placeholderTextColor={colors.textMuted}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveName}
        />
      </Sheet>

      {/* Diet */}
      <Sheet visible={activeModal === "diet"} onClose={() => setActiveModal(null)} title="Dietary Preferences" onSave={saveDiet}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Select all that apply. This filters your recipe deck.</Text>
        <MultiSelect
          options={DIET_OPTIONS}
          selected={editDiet}
          onToggle={(v) => setEditDiet((prev) =>
            prev.includes(v) ? prev.filter((x) => x !== v) : [...prev.filter((x) => x !== "Omnivore"), v].filter(Boolean)
          )}
        />
      </Sheet>

      {/* Allergens */}
      <Sheet visible={activeModal === "allergens"} onClose={() => setActiveModal(null)} title="Allergens" onSave={saveAllergens}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Recipes containing these ingredients will be hidden.</Text>
        <MultiSelect
          options={ALLERGEN_OPTIONS}
          selected={editAllergens}
          onToggle={(v) => setEditAllergens((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])}
        />
      </Sheet>

      {/* Household size */}
      <Sheet visible={activeModal === "household"} onClose={() => setActiveModal(null)} title="Household Size" onSave={saveHousehold}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Used to suggest default serving sizes when cooking.</Text>
        <View style={styles.householdStepper}>
          <TouchableOpacity
            style={[styles.householdBtn, { borderColor: colors.border, opacity: editHousehold <= 1 ? 0.4 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditHousehold((h) => Math.max(1, h - 1)); }}
            disabled={editHousehold <= 1}
          >
            <Feather name="minus" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.householdNum, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{editHousehold}</Text>
          <TouchableOpacity
            style={[styles.householdBtn, { borderColor: colors.border, opacity: editHousehold >= 12 ? 0.4 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditHousehold((h) => Math.min(12, h + 1)); }}
            disabled={editHousehold >= 12}
          >
            <Feather name="plus" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.householdLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          {editHousehold === 1 ? "Just me" : editHousehold >= 12 ? "12+ people" : `${editHousehold} people`}
        </Text>
      </Sheet>

      {/* Weekly budget */}
      <Sheet visible={activeModal === "budget"} onClose={() => setActiveModal(null)} title="Weekly Food Budget" onSave={saveBudget}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Set a weekly grocery budget. Leave blank to skip.</Text>
        <View style={styles.budgetRow}>
          <Text style={[styles.budgetCurrency, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>$</Text>
          <TextInput
            style={[styles.budgetInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, fontFamily: "SpaceGrotesk_600SemiBold" }]}
            value={editBudget}
            onChangeText={(t) => setEditBudget(t.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveBudget}
          />
          <Text style={[styles.budgetSuffix, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>/week</Text>
        </View>
      </Sheet>

      {/* Cuisine preferences */}
      <Sheet visible={activeModal === "cuisine"} onClose={() => setActiveModal(null)} title="Cuisine Preferences" onSave={saveCuisines}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Select what you enjoy. Your deck is ranked by preference.</Text>
        <MultiSelect
          options={CUISINE_OPTIONS}
          selected={editCuisines}
          onToggle={(v) => setEditCuisines((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])}
        />
      </Sheet>

      {/* Cooking goal */}
      <Sheet visible={activeModal === "goal"} onClose={() => setActiveModal(null)} title="Cooking Goal" onSave={saveGoal}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Recipes in your deck are scored to match your goal.</Text>
        <SingleSelect options={GOAL_OPTIONS} selected={editGoal} onSelect={(v) => { setEditGoal(v); }} />
      </Sheet>

      {/* Skill level */}
      <Sheet visible={activeModal === "skill"} onClose={() => setActiveModal(null)} title="Skill Level" onSave={saveSkill}>
        <Text style={[styles.sheetHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Harder recipes are hidden when set to Beginner or Home Cook.</Text>
        <SingleSelect options={SKILL_OPTIONS} selected={editSkill} onSelect={(v) => { setEditSkill(v); }} />
      </Sheet>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 20, letterSpacing: -0.3 },
  sectionHeader: { fontSize: 11, letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 },
  section: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15 },
  rowSub: { fontSize: 12 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "45%" },
  rowValue: { fontSize: 13, textAlign: "right", flexShrink: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepVal: { fontSize: 14, minWidth: 28, textAlign: "center" },
  segmented: { flexDirection: "row", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  segBtn: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 7 },
  segBtnText: { fontSize: 12 },
  premiumCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  premiumLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  premiumBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  premiumTitle: { fontSize: 15 },
  premiumSub: { fontSize: 12, marginTop: 2 },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5 },
  upgradeCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  upgradeLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  chevronCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: "75%",
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 18, letterSpacing: -0.2 },
  sheetSave: { fontSize: 16 },
  sheetHint: { fontSize: 13, lineHeight: 18, marginBottom: 14, opacity: 0.8 },
  textInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 17, marginBottom: 12,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  optionChipText: { fontSize: 13 },
  singleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14,
  },
  singleRowText: { fontSize: 16 },
  householdStepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32, marginVertical: 24 },
  householdBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  householdNum: { fontSize: 48, lineHeight: 56 },
  householdLabel: { textAlign: "center", fontSize: 15, marginBottom: 8 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  budgetCurrency: { fontSize: 24 },
  budgetInput: {
    flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 28, textAlign: "center",
  },
  budgetSuffix: { fontSize: 16 },
});
