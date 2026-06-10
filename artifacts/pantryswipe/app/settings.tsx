import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, updateProfile } = useApp();

  const [notifExpiryAlerts, setNotifExpiryAlerts] = useState(true);
  const [notifMealReminders, setNotifMealReminders] = useState(true);
  const [notifWeeklyDigest, setNotifWeeklyDigest] = useState(false);
  const [notifSocialActivity, setNotifSocialActivity] = useState(true);
  const [expiryWarningDays, setExpiryWarningDays] = useState(3);
  const [autoAddToShopping, setAutoAddToShopping] = useState(true);
  const [measurementSystem, setMeasurementSystem] = useState<"Metric" | "Imperial">("Metric");
  const [dataSharing, setDataSharing] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.removeItem("pantryswipe_setup_complete");
    router.replace("/welcome");
  };

  const handleClearData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Clear All Data",
      "This will reset your pantry, meal plan, and saved recipes. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => router.replace("/welcome") },
      ]
    );
  };

  const SettingRow = ({ icon, label, value, onPress, danger = false }: { icon: string; label: string; value?: string; onPress: () => void; danger?: boolean }) => (
    <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}>
      <View style={[styles.settingIcon, { backgroundColor: danger ? colors.destructive + "15" : colors.primary + "15" }]}>
        <Feather name={icon as any} size={16} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: danger ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <View style={styles.settingRight}>
        {value && <Text style={[styles.settingValue, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{value}</Text>}
        {!danger && <Feather name="chevron-right" size={16} color={colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  const ToggleRow = ({ icon, label, value, onChange, subtitle }: { icon: string; label: string; value: boolean; onChange: (v: boolean) => void; subtitle?: string }) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.settingIcon, { backgroundColor: colors.primary + "15" }]}>
        <Feather name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>{title}</Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Account */}
        <SectionHeader title="ACCOUNT" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="user" label="Edit Profile" value={userProfile.name} onPress={() => {}} />
          <SettingRow icon="heart" label="Dietary Preferences" value={userProfile.dietType[0]} onPress={() => {}} />
          <SettingRow icon="alert-circle" label="Allergens" value={userProfile.allergies.length > 0 ? userProfile.allergies.join(", ") : "None"} onPress={() => {}} />
          <SettingRow icon="users" label="Household Size" value={`${userProfile.householdSize} people`} onPress={() => {}} />
          <SettingRow icon="dollar-sign" label="Weekly Budget" value={`$${userProfile.weeklyBudget}`} onPress={() => {}} />
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="bell" label="Expiry Alerts" subtitle="Warn when ingredients are about to expire" value={notifExpiryAlerts} onChange={setNotifExpiryAlerts} />
          <ToggleRow icon="clock" label="Meal Plan Reminders" subtitle="Daily reminder to check today's meals" value={notifMealReminders} onChange={setNotifMealReminders} />
          <ToggleRow icon="mail" label="Weekly Digest" subtitle="Summary of your cooking week every Sunday" value={notifWeeklyDigest} onChange={setNotifWeeklyDigest} />
          <ToggleRow icon="users" label="Social Activity" subtitle="Likes, comments, and new followers" value={notifSocialActivity} onChange={setNotifSocialActivity} />
        </View>

        {/* Pantry */}
        <SectionHeader title="PANTRY" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="alert-triangle" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1 }]}>Expiry Warning</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={[styles.stepper, { borderColor: colors.border }]} onPress={() => setExpiryWarningDays((d) => Math.max(1, d - 1))}>
                <Feather name="minus" size={14} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: colors.foreground, fontFamily: "SpaceGrotesk_600SemiBold" }]}>{expiryWarningDays}d</Text>
              <TouchableOpacity style={[styles.stepper, { borderColor: colors.border }]} onPress={() => setExpiryWarningDays((d) => Math.min(14, d + 1))}>
                <Feather name="plus" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
          <ToggleRow icon="shopping-cart" label="Auto Shopping List" subtitle="Automatically add expiring items to shopping list" value={autoAddToShopping} onChange={setAutoAddToShopping} />
          <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="activity" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1 }]}>Measurements</Text>
            <View style={styles.measurementToggle}>
              {(["Metric", "Imperial"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.measurementBtn, { backgroundColor: measurementSystem === m ? colors.primary : "transparent" }]}
                  onPress={() => setMeasurementSystem(m)}
                >
                  <Text style={[styles.measurementBtnText, { color: measurementSystem === m ? colors.primaryForeground : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Discover */}
        <SectionHeader title="DISCOVER" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="globe" label="Cuisine Preferences" value={`${userProfile.cuisinePreferences.length} selected`} onPress={() => {}} />
          <SettingRow icon="target" label="Cooking Goal" value={userProfile.goal} onPress={() => {}} />
          <SettingRow icon="bar-chart-2" label="Skill Level" value={userProfile.skillLevel} onPress={() => {}} />
        </View>

        {/* Privacy */}
        <SectionHeader title="PRIVACY" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="share-2" label="Data Sharing" subtitle="Share anonymised usage data to improve recipes" value={dataSharing} onChange={setDataSharing} />
          <ToggleRow icon="trending-up" label="Analytics" subtitle="Help us understand how you use PantrySwipe" value={analytics} onChange={setAnalytics} />
        </View>

        {/* About */}
        <SectionHeader title="ABOUT" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="info" label="Version" value="1.0.0" onPress={() => {}} />
          <SettingRow icon="file-text" label="Terms of Service" onPress={() => {}} />
          <SettingRow icon="shield" label="Privacy Policy" onPress={() => {}} />
          <SettingRow icon="star" label="Rate PantrySwipe" onPress={() => {}} />
          <SettingRow icon="help-circle" label="Help & Support" onPress={() => {}} />
        </View>

        {/* Danger zone */}
        <SectionHeader title="ACCOUNT ACTIONS" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="log-out" label="Sign Out" onPress={handleSignOut} danger />
          <SettingRow icon="trash-2" label="Clear All Data" onPress={handleClearData} danger />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 22, letterSpacing: -0.3 },
  scrollContent: { paddingBottom: 40 },
  sectionHeader: { fontSize: 11, letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  section: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  settingIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  settingLabel: { flex: 1, fontSize: 15 },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 14 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepper: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  stepperValue: { fontSize: 15, minWidth: 28, textAlign: "center" },
  measurementToggle: { flexDirection: "row", borderRadius: 8, overflow: "hidden" },
  measurementBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  measurementBtnText: { fontSize: 13 },
});
