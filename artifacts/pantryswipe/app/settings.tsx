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
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { useSubscription } from "@/lib/revenuecat";

// ── Brand palette — exact match to all other tabs ──────────────────────────────
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

const cardShadow = Platform.select({
  ios:     { shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
  android: { elevation: 4 },
  web:     { boxShadow: "0 4px 16px rgba(131,85,0,0.08)" },
}) as object;

// ── Persisted settings ─────────────────────────────────────────────────────────
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

// ── Option lists ───────────────────────────────────────────────────────────────
const DIET_OPTIONS = ["Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Keto", "Gluten-Free", "Paleo"];
const ALLERGEN_OPTIONS = ["Peanuts", "Tree Nuts", "Dairy", "Gluten", "Eggs", "Shellfish", "Fish", "Soy", "Sesame", "Sulphites", "Corn"];
const CUISINE_OPTIONS = ["Italian", "Japanese", "Korean", "American", "Indian", "Mediterranean", "Chinese", "Thai", "Mexican", "French", "Vietnamese", "Middle Eastern", "Singaporean"];
const GOAL_OPTIONS = ["Build Muscle", "Eat Healthier", "Save Money", "Cook Faster", "Explore Cuisines", "Cook for Others", "Meal Prep", "Reduce Waste", "Lose Weight"];
const SKILL_OPTIONS = ["Beginner", "Home Cook", "Confident", "Advanced"];
const PROTEIN_OPTIONS_LIST = ["Chicken", "Beef", "Pork", "Fish", "Lamb", "Seafood", "Turkey", "Tofu", "Eggs", "Duck"];

type ModalType = "name" | "diet" | "allergens" | "proteins" | "household" | "budget" | "cuisine" | "goal" | "skill" | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { userProfile, updateProfile } = useApp();
  const { isSubscribed, restore, isRestoring } = useSubscription();

  const [settings,    setSettings]    = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const [editName,      setEditName]      = useState(userProfile.name);
  const [editDiet,      setEditDiet]      = useState<string[]>(userProfile.dietType);
  const [editAllergens, setEditAllergens] = useState<string[]>(userProfile.allergies);
  const [editProteins,  setEditProteins]  = useState<string[]>(userProfile.proteinPreferences ?? []);
  const [editHousehold, setEditHousehold] = useState(userProfile.householdSize);
  const [editBudget,    setEditBudget]    = useState(String(userProfile.weeklyBudget));
  const [editCuisines,  setEditCuisines]  = useState<string[]>(userProfile.cuisinePreferences);
  const [editGoal,      setEditGoal]      = useState(userProfile.goal);
  const [editSkill,     setEditSkill]     = useState(userProfile.skillLevel);

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

  // ── Open modal helpers ──────────────────────────────────────────────────────
  const openModal = (type: ModalType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === "name")      setEditName(userProfile.name);
    if (type === "diet")      setEditDiet(userProfile.dietType);
    if (type === "allergens") setEditAllergens(userProfile.allergies);
    if (type === "proteins")  setEditProteins(userProfile.proteinPreferences ?? []);
    if (type === "household") setEditHousehold(userProfile.householdSize);
    if (type === "budget")    setEditBudget(String(userProfile.weeklyBudget || ""));
    if (type === "cuisine")   setEditCuisines(userProfile.cuisinePreferences);
    if (type === "goal")      setEditGoal(userProfile.goal);
    if (type === "skill")     setEditSkill(userProfile.skillLevel);
    setActiveModal(type);
  };

  // ── Save helpers ───────────────────────────────────────────────────────────
  const saveName      = () => { if (editName.trim()) { updateProfile({ name: editName.trim() }); } setActiveModal(null); };
  const saveDiet      = () => { const resolved = editDiet.length === 0 ? ["Omnivore"] : editDiet; updateProfile({ dietType: resolved }); setActiveModal(null); };
  const saveAllergens = () => { updateProfile({ allergies: editAllergens }); setActiveModal(null); };
  const saveProteins  = () => { updateProfile({ proteinPreferences: editProteins }); setActiveModal(null); };
  const saveHousehold = () => { updateProfile({ householdSize: editHousehold }); setActiveModal(null); };
  const saveBudget    = () => { updateProfile({ weeklyBudget: parseFloat(editBudget) || 0 }); setActiveModal(null); };
  const saveCuisines  = () => { updateProfile({ cuisinePreferences: editCuisines }); setActiveModal(null); };
  const saveGoal      = () => { updateProfile({ goal: editGoal }); setActiveModal(null); };
  const saveSkill     = () => { updateProfile({ skillLevel: editSkill }); setActiveModal(null); };

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
  const SectionHeader = ({ title, emoji }: { title: string; emoji?: string }) => (
    <View style={styles.sectionHeaderWrap}>
      {emoji ? <Text style={styles.sectionHeaderEmoji}>{emoji}</Text> : null}
      <Text style={styles.sectionHeader}>{title}</Text>
    </View>
  );

  const SettingRow = ({
    icon, label, value, onPress, danger = false, last = false,
  }: { icon: string; label: string; value?: string; onPress: () => void; danger?: boolean; last?: boolean }) => (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? "rgba(232,64,64,0.10)" : C.surfaceLow }]}>
        <Feather name={icon as any} size={16} color={danger ? C.danger : C.primary} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: C.danger }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {!danger && <Feather name="chevron-right" size={15} color={C.outlineVariant} />}
      </View>
    </TouchableOpacity>
  );

  const ToggleRow = ({
    icon, label, subtitle, value, onChange, last = false,
  }: { icon: string; label: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) => (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: C.surfaceLow }]}>
        <Feather name={icon as any} size={16} color={C.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
        trackColor={{ false: C.surfaceHigh, true: C.primary }}
        thumbColor="#fff"
        ios_backgroundColor={C.surfaceHigh}
      />
    </View>
  );

  // ── Bottom sheet modal ─────────────────────────────────────────────────────
  const Sheet = ({ visible, onClose, title, onSave, children }: {
    visible: boolean; onClose: () => void; title: string; onSave?: () => void; children: React.ReactNode;
  }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {onSave ? (
            <TouchableOpacity onPress={onSave} style={styles.sheetSaveBtn}>
              <Text style={styles.sheetSaveText}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
              <Feather name="x" size={18} color={C.textMuted} />
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
              style={[styles.optionChip, active ? styles.optionChipActive : styles.optionChipInactive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(opt); }}
            >
              <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : styles.optionChipTextInactive]}>
                {opt}
              </Text>
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
            style={[styles.singleRow, i < options.length - 1 && styles.singleRowBorder]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(opt); }}
          >
            <Text style={[styles.singleRowText, active && { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>{opt}</Text>
            {active && <Feather name="check" size={18} color={C.primary} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Derived display values ─────────────────────────────────────────────────
  const allergenDisplay = userProfile.allergies.length > 0 ? userProfile.allergies.join(", ") : "None";
  const proteinDisplay  = (userProfile.proteinPreferences?.length ?? 0) > 0 ? userProfile.proteinPreferences.join(", ") : "All proteins";
  const dietDisplay     = userProfile.dietType.join(", ");
  const cuisineDisplay  = userProfile.cuisinePreferences.length > 0 ? `${userProfile.cuisinePreferences.length} selected` : "All cuisines";
  const budgetDisplay   = userProfile.weeklyBudget > 0 ? `$${userProfile.weeklyBudget}/wk` : "Not set";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPadding + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={20} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Subscription card ── */}
        {isSubscribed ? (
          <View style={[styles.premiumCard, cardShadow]}>
            <View style={styles.premiumLeft}>
              <View style={styles.premiumBadge}>
                <Feather name="zap" size={15} color="#fff" />
              </View>
              <View>
                <Text style={styles.premiumTitle}>Premium Active ✨</Text>
                <Text style={styles.premiumSub}>Unlimited AI Chef · Full features</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); restore(); }}
              disabled={isRestoring}
            >
              <Text style={styles.manageBtnText}>{isRestoring ? "…" : "Manage"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.upgradeCard, cardShadow]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/paywall"); }}
            activeOpacity={0.85}
          >
            <View style={styles.upgradeLeft}>
              <View style={styles.upgradeIconBox}>
                <Text style={{ fontSize: 20 }}>✨</Text>
              </View>
              <View>
                <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                <Text style={styles.upgradeSub}>Unlimited AI · Smart expiry · S$4.99/mo</Text>
              </View>
            </View>
            <View style={styles.chevronCircle}>
              <Feather name="arrow-right" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* ── ACCOUNT ── */}
        <SectionHeader title="Account" emoji="👤" />
        <View style={[styles.section, cardShadow]}>
          <SettingRow icon="user"         label="Name"                value={userProfile.name}                        onPress={() => openModal("name")} />
          <SettingRow icon="heart"        label="Dietary Preferences" value={dietDisplay}                             onPress={() => openModal("diet")} />
          <SettingRow icon="alert-circle" label="Allergens"           value={allergenDisplay}                         onPress={() => openModal("allergens")} />
          <SettingRow icon="layers"       label="Protein Preferences" value={proteinDisplay}                          onPress={() => openModal("proteins")} />
          <SettingRow icon="users"        label="Household Size"      value={`${userProfile.householdSize} people`}   onPress={() => openModal("household")} />
          <SettingRow icon="dollar-sign"  label="Weekly Budget"       value={budgetDisplay}                           onPress={() => openModal("budget")} last />
        </View>

        {/* ── NOTIFICATIONS ── */}
        <SectionHeader title="Notifications" emoji="🔔" />
        <View style={[styles.section, cardShadow]}>
          <ToggleRow icon="bell"    label="Expiry Alerts"   subtitle="Warn when ingredients are about to expire"  value={settings.notifExpiryAlerts}   onChange={(v) => updateSetting("notifExpiryAlerts", v)} />
          <ToggleRow icon="clock"   label="Meal Reminders"  subtitle="Daily reminder to check today's meals"      value={settings.notifMealReminders}  onChange={(v) => updateSetting("notifMealReminders", v)} />
          <ToggleRow icon="mail"    label="Weekly Digest"   subtitle="Summary of your cooking week every Sunday"  value={settings.notifWeeklyDigest}   onChange={(v) => updateSetting("notifWeeklyDigest", v)} />
          <ToggleRow icon="users"   label="Social Activity" subtitle="Likes, comments, and new followers"         value={settings.notifSocialActivity} onChange={(v) => updateSetting("notifSocialActivity", v)} last />
        </View>

        {/* ── PANTRY ── */}
        <SectionHeader title="Pantry" emoji="🥫" />
        <View style={[styles.section, cardShadow]}>
          {/* Expiry warning stepper */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: C.surfaceLow }]}>
              <Feather name="alert-triangle" size={16} color={C.primary} />
            </View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Expiry Warning</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSetting("expiryWarningDays", Math.max(1, settings.expiryWarningDays - 1)); }}
              >
                <Feather name="minus" size={13} color={C.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.stepVal}>{settings.expiryWarningDays}d</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSetting("expiryWarningDays", Math.min(14, settings.expiryWarningDays + 1)); }}
              >
                <Feather name="plus" size={13} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ToggleRow icon="shopping-cart" label="Auto Shopping List" subtitle="Add expiring items to shopping list automatically" value={settings.autoAddToShopping} onChange={(v) => updateSetting("autoAddToShopping", v)} />

          {/* Measurement system */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: C.surfaceLow }]}>
              <Feather name="activity" size={16} color={C.primary} />
            </View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Measurements</Text>
            <View style={styles.segmented}>
              {(["Metric", "Imperial"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segBtn, settings.measurementSystem === m && styles.segBtnActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSetting("measurementSystem", m); }}
                >
                  <Text style={[styles.segBtnText, settings.measurementSystem === m && styles.segBtnTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── DISCOVER ── */}
        <SectionHeader title="Discover" emoji="🍽️" />
        <View style={[styles.section, cardShadow]}>
          <SettingRow icon="globe"       label="Cuisine Preferences" value={cuisineDisplay}         onPress={() => openModal("cuisine")} />
          <SettingRow icon="target"      label="Cooking Goal"        value={userProfile.goal}       onPress={() => openModal("goal")} />
          <SettingRow icon="bar-chart-2" label="Skill Level"         value={userProfile.skillLevel} onPress={() => openModal("skill")} last />
        </View>

        {/* ── PRIVACY ── */}
        <SectionHeader title="Privacy" emoji="🔒" />
        <View style={[styles.section, cardShadow]}>
          <ToggleRow icon="share-2"     label="Data Sharing" subtitle="Share anonymised usage data to improve recipes" value={settings.dataSharing} onChange={(v) => updateSetting("dataSharing", v)} />
          <ToggleRow icon="trending-up" label="Analytics"    subtitle="Help us understand how you use PantrySwipe"     value={settings.analytics}   onChange={(v) => updateSetting("analytics", v)} last />
        </View>

        {/* ── ABOUT ── */}
        <SectionHeader title="About" emoji="ℹ️" />
        <View style={[styles.section, cardShadow]}>
          <SettingRow icon="info"        label="Version"          value="1.0.0" onPress={() => {}} />
          <SettingRow icon="file-text"   label="Terms of Service"              onPress={() => router.push("/terms-of-service")} />
          <SettingRow icon="shield"      label="Privacy Policy"                onPress={() => router.push("/privacy-policy")} />
          <SettingRow icon="star"        label="Rate PantrySwipe"              onPress={() => Linking.openURL("https://apps.apple.com/").catch(() => {})} />
          <SettingRow icon="help-circle" label="Help & Support"                onPress={() => Linking.openURL("mailto:support@pantryswipe.app").catch(() => {})} last />
        </View>

        {/* ── ACCOUNT ACTIONS ── */}
        <SectionHeader title="Account Actions" emoji="⚠️" />
        <View style={[styles.section, cardShadow]}>
          <SettingRow icon="log-out" label="Sign Out"       onPress={handleSignOut}   danger />
          <SettingRow icon="trash-2" label="Clear All Data" onPress={handleClearData} danger last />
        </View>

      </ScrollView>

      {/* ══════════════════════════ MODALS ══════════════════════════════════════ */}

      {/* Name */}
      <Sheet visible={activeModal === "name"} onClose={() => setActiveModal(null)} title="Your Name" onSave={saveName}>
        <TextInput
          style={styles.textInput}
          value={editName}
          onChangeText={setEditName}
          placeholder="Enter your name"
          placeholderTextColor={C.textMuted}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveName}
        />
      </Sheet>

      {/* Diet */}
      <Sheet visible={activeModal === "diet"} onClose={() => setActiveModal(null)} title="Dietary Preferences" onSave={saveDiet}>
        <Text style={styles.sheetHint}>Select all that apply. This filters your recipe deck.</Text>
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
        <Text style={styles.sheetHint}>Recipes containing these ingredients will be hidden.</Text>
        <MultiSelect
          options={ALLERGEN_OPTIONS}
          selected={editAllergens}
          onToggle={(v) => setEditAllergens((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])}
        />
      </Sheet>

      {/* Protein preferences */}
      <Sheet visible={activeModal === "proteins"} onClose={() => setActiveModal(null)} title="Protein Preferences" onSave={saveProteins}>
        <Text style={styles.sheetHint}>Only recipes with these proteins will appear in your deck. Leave blank to show all.</Text>
        <MultiSelect
          options={PROTEIN_OPTIONS_LIST}
          selected={editProteins}
          onToggle={(v) => setEditProteins((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])}
        />
      </Sheet>

      {/* Household size */}
      <Sheet visible={activeModal === "household"} onClose={() => setActiveModal(null)} title="Household Size" onSave={saveHousehold}>
        <Text style={styles.sheetHint}>Used to suggest default serving sizes when cooking.</Text>
        <View style={styles.householdStepper}>
          <TouchableOpacity
            style={[styles.householdBtn, { opacity: editHousehold <= 1 ? 0.4 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditHousehold((h) => Math.max(1, h - 1)); }}
            disabled={editHousehold <= 1}
          >
            <Feather name="minus" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.householdNum}>{editHousehold}</Text>
          <TouchableOpacity
            style={[styles.householdBtn, { opacity: editHousehold >= 12 ? 0.4 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditHousehold((h) => Math.min(12, h + 1)); }}
            disabled={editHousehold >= 12}
          >
            <Feather name="plus" size={22} color={C.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.householdLabel}>
          {editHousehold === 1 ? "Just me" : editHousehold >= 12 ? "12+ people" : `${editHousehold} people`}
        </Text>
      </Sheet>

      {/* Weekly budget */}
      <Sheet visible={activeModal === "budget"} onClose={() => setActiveModal(null)} title="Weekly Food Budget" onSave={saveBudget}>
        <Text style={styles.sheetHint}>Set a weekly grocery budget. Leave blank to skip.</Text>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetCurrency}>$</Text>
          <TextInput
            style={styles.budgetInput}
            value={editBudget}
            onChangeText={(t) => setEditBudget(t.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            autoFocus
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={saveBudget}
          />
          <Text style={styles.budgetSuffix}>/week</Text>
        </View>
      </Sheet>

      {/* Cuisine preferences */}
      <Sheet visible={activeModal === "cuisine"} onClose={() => setActiveModal(null)} title="Cuisine Preferences" onSave={saveCuisines}>
        <Text style={styles.sheetHint}>Select what you enjoy. Your deck is ranked by preference.</Text>
        <MultiSelect
          options={CUISINE_OPTIONS}
          selected={editCuisines}
          onToggle={(v) => setEditCuisines((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])}
        />
      </Sheet>

      {/* Cooking goal */}
      <Sheet visible={activeModal === "goal"} onClose={() => setActiveModal(null)} title="Cooking Goal" onSave={saveGoal}>
        <Text style={styles.sheetHint}>Recipes in your deck are scored to match your goal.</Text>
        <SingleSelect options={GOAL_OPTIONS} selected={editGoal} onSelect={(v) => { setEditGoal(v); }} />
      </Sheet>

      {/* Skill level */}
      <Sheet visible={activeModal === "skill"} onClose={() => setActiveModal(null)} title="Skill Level" onSave={saveSkill}>
        <Text style={styles.sheetHint}>Harder recipes are hidden when set to Beginner or Home Cook.</Text>
        <SingleSelect options={SKILL_OPTIONS} selected={editSkill} onSelect={(v) => { setEditSkill(v); }} />
      </Sheet>

    </View>
  );
}

// ── StyleSheet ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.surfaceHighest,
  },
  headerTitle: {
    fontSize: 20, fontFamily: "Epilogue_700Bold",
    color: C.textPrimary, letterSpacing: -0.3,
  },

  // Section headers
  sectionHeaderWrap: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10,
  },
  sectionHeaderEmoji: { fontSize: 14 },
  sectionHeader: {
    fontSize: 13, fontFamily: "Epilogue_700Bold",
    color: C.onPrimaryContainer, letterSpacing: 0.3,
  },

  // Section card
  section: {
    marginHorizontal: 16, borderRadius: 20,
    backgroundColor: C.surface, overflow: "hidden",
  },

  // Rows
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.surfaceHigh,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: {
    flex: 1, fontSize: 15,
    fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },
  rowSub: {
    fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted,
  },
  rowRight: {
    flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "45%",
  },
  rowValue: {
    fontSize: 13, textAlign: "right", flexShrink: 1,
    fontFamily: "Epilogue_400Regular", color: C.textMuted,
  },

  // Stepper (expiry days)
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: C.outlineVariant,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.surfaceHighest,
  },
  stepVal: {
    fontSize: 14, minWidth: 28, textAlign: "center",
    fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },

  // Segmented control (measurements)
  segmented: {
    flexDirection: "row", borderRadius: 10,
    borderWidth: 1, borderColor: C.outlineVariant,
    overflow: "hidden", backgroundColor: C.surfaceHighest,
  },
  segBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  segBtnActive:   { backgroundColor: C.primary },
  segBtnText:     { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted },
  segBtnTextActive: { fontFamily: "Epilogue_700Bold", color: "#fff" },

  // Premium card (subscribed)
  premiumCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 16, gap: 12,
    backgroundColor: "#4CAF7612",
    borderWidth: 1, borderColor: "#4CAF7630",
  },
  premiumLeft:  { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  premiumBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.secondary, alignItems: "center", justifyContent: "center" },
  premiumTitle: { fontSize: 15, fontFamily: "Epilogue_700Bold", color: C.textPrimary },
  premiumSub:   { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted, marginTop: 2 },
  manageBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: C.secondary },
  manageBtnText: { color: C.secondary, fontFamily: "Epilogue_700Bold", fontSize: 13 },

  // Upgrade card (not subscribed)
  upgradeCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 16, gap: 12,
    backgroundColor: C.textPrimary,
  },
  upgradeLeft:   { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  upgradeIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary + "25",
  },
  upgradeTitle: { fontSize: 15, fontFamily: "Epilogue_700Bold", color: C.background },
  upgradeSub:   { fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.background + "99", marginTop: 2 },
  chevronCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },

  // Bottom sheet modal
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: "75%", backgroundColor: C.background,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 16,
    backgroundColor: C.outlineVariant,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18, fontFamily: "Epilogue_700Bold",
    color: C.textPrimary, letterSpacing: -0.2,
  },
  sheetSaveBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 100, backgroundColor: C.primary,
  },
  sheetSaveText: { fontSize: 14, fontFamily: "Epilogue_700Bold", color: "#fff" },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.surfaceHighest,
  },
  sheetHint: {
    fontSize: 13, lineHeight: 18, marginBottom: 14,
    fontFamily: "Epilogue_400Regular", color: C.textMuted,
  },

  // Text input
  textInput: {
    borderWidth: 1, borderRadius: 14, borderColor: C.outlineVariant,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 17, marginBottom: 12,
    fontFamily: "Epilogue_400Regular", color: C.textPrimary,
    backgroundColor: C.surfaceLow,
  },

  // MultiSelect chips
  optionGrid:            { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },
  optionChip:            { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1, minHeight: 44, alignItems: "center", justifyContent: "center" },
  optionChipActive:      { backgroundColor: C.primary, borderColor: C.primary },
  optionChipInactive:    { backgroundColor: C.surfaceHighest, borderColor: C.outlineVariant },
  optionChipText:        { fontSize: 13 },
  optionChipTextActive:  { fontFamily: "Epilogue_700Bold", color: "#fff" },
  optionChipTextInactive:{ fontFamily: "Epilogue_400Regular", color: C.textPrimary },

  // SingleSelect rows
  singleRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 14, minHeight: 44,
  },
  singleRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surfaceHigh },
  singleRowText:   { fontSize: 16, fontFamily: "Epilogue_400Regular", color: C.textPrimary },

  // Household stepper
  householdStepper: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 32, marginVertical: 24,
  },
  householdBtn: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: C.outlineVariant,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.surfaceHighest,
  },
  householdNum: {
    fontSize: 48, lineHeight: 56,
    fontFamily: "Epilogue_700Bold", color: C.textPrimary,
  },
  householdLabel: {
    textAlign: "center", fontSize: 15, marginBottom: 8,
    fontFamily: "Epilogue_400Regular", color: C.textMuted,
  },

  // Budget input
  budgetRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  budgetCurrency:{ fontSize: 24, fontFamily: "Epilogue_700Bold", color: C.textMuted },
  budgetInput: {
    flex: 1, borderWidth: 1, borderRadius: 14, borderColor: C.outlineVariant,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 28, textAlign: "center",
    fontFamily: "Epilogue_700Bold", color: C.textPrimary,
    backgroundColor: C.surfaceLow,
  },
  budgetSuffix: { fontSize: 16, fontFamily: "Epilogue_400Regular", color: C.textMuted },
});
