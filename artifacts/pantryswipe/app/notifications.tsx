import React, { useEffect } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/hooks/useNotifications";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/constants/storageKeys";

// ── Intent key shared with index.tsx ─────────────────────────────────────────
const INTENT_KEY = STORAGE_KEYS.PENDING_INTENT;

// ── Types ─────────────────────────────────────────────────────────────────────
type Action =
  | { kind: "intent"; type: "mealType"; value: "Breakfast" | "Lunch" | "Dinner" }
  | { kind: "intent"; type: "ingredient"; value: string }
  | { kind: "recipe"; id: string }
  | { kind: "tab"; path: string };

interface AppNotif {
  id: string;
  featherIcon?: string;
  emoji?: string;
  color: string;
  title: string;
  body: string;
  hoursBack: number;
  action: Action;
  section: "meal" | "activity";
  mealLabel?: string;
}

// ── Time helper ───────────────────────────────────────────────────────────────
function timeAgo(hoursBack: number): string {
  if (hoursBack <= 0) return "Just now";
  if (hoursBack < 1) return "Less than an hour ago";
  if (hoursBack < 2) return "1 hour ago";
  if (hoursBack < 24) return `${Math.floor(hoursBack)}h ago`;
  const days = Math.floor(hoursBack / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

// ── Build notification list ───────────────────────────────────────────────────
function buildNotifications(expiringItems: Array<{ name: string; status: string }>): AppNotif[] {
  const h = new Date().getHours();
  const notifs: AppNotif[] = [];

  // Meal-time notifications (only show ones that already fired today)
  if (h >= 7) notifs.push({
    id: "m_breakfast", emoji: "🍳", color: "#F5A623",
    title: "Good morning! 🍳", body: "Shall we see what we can make for breakfast today?",
    hoursBack: Math.max(0, h - 7.5), section: "meal", mealLabel: "Breakfast",
    action: { kind: "intent", type: "mealType", value: "Breakfast" },
  });
  if (h >= 12) notifs.push({
    id: "m_lunch", emoji: "🥗", color: "#4CAF76",
    title: "Lunchtime! 🥗", body: "Shall we see what we can have for lunch? Your pantry has ideas.",
    hoursBack: Math.max(0, h - 12), section: "meal", mealLabel: "Lunch",
    action: { kind: "intent", type: "mealType", value: "Lunch" },
  });
  if (h >= 15) notifs.push({
    id: "m_snack", emoji: "🍿", color: "#9B6DFF",
    title: "Snack time! 🍿", body: "Feeling peckish? Let's find something quick and tasty.",
    hoursBack: Math.max(0, h - 15), section: "meal", mealLabel: "Snack",
    action: { kind: "intent", type: "mealType", value: "Lunch" },
  });
  if (h >= 18) notifs.push({
    id: "m_dinner", emoji: "🍽️", color: "#5B8EF5",
    title: "Dinner time! 🍽️", body: "Shall we see what we can cook for dinner tonight?",
    hoursBack: Math.max(0, h - 18.5), section: "meal", mealLabel: "Dinner",
    action: { kind: "intent", type: "mealType", value: "Dinner" },
  });

  // If no meal notifs have fired yet (early morning) show yesterday's dinner
  if (notifs.length === 0) notifs.push({
    id: "m_dinner_prev", emoji: "🍽️", color: "#5B8EF5",
    title: "Dinner time! 🍽️", body: "Shall we see what we can cook for dinner tonight?",
    hoursBack: h + 5.5, section: "meal", mealLabel: "Dinner",
    action: { kind: "intent", type: "mealType", value: "Dinner" },
  });

  // Reverse meal notifs so most recent is first
  notifs.reverse();

  // ── Expiry alerts from real pantry data (most urgent first) ──
  expiringItems.forEach((item, idx) => {
    const isExpired = item.status === "Expired";
    notifs.push({
      id: `a_expiry_${item.name.toLowerCase().replace(/\s+/g, "_")}`,
      featherIcon: "alert-triangle",
      color: isExpired ? "#E84040" : "#F59E0B",
      title: isExpired
        ? `${item.name} has expired ⚠️`
        : `${item.name} expires soon ⏰`,
      body: isExpired
        ? `${item.name} is past its date. Use it up now or it'll go to waste — tap to find recipes.`
        : `${item.name} is expiring soon. Tap to see what you can cook with it before it's too late.`,
      hoursBack: isExpired ? idx * 2 : idx * 3 + 1,
      section: "activity",
      action: { kind: "intent", type: "ingredient", value: item.name },
    });
  });

  // ── Static activity notifications ──
  notifs.push(
    {
      id: "a_carbonara", featherIcon: "check-circle", color: "#4CAF76",
      title: "Carbonara is ready to cook! 🍝", body: "You now have all the ingredients. Ready to start cooking?",
      hoursBack: 3, section: "activity",
      action: { kind: "recipe", id: "1" },
    },
    {
      id: "a_like", featherIcon: "heart", color: "#E84040",
      title: "Chef Marco liked your post", body: "Your Spaghetti photo got a reaction! 😍",
      hoursBack: 6, section: "activity",
      action: { kind: "tab", path: "/(tabs)/social" },
    },
    {
      id: "a_streak", featherIcon: "zap", color: "#F5A623",
      title: "7-day cooking streak! 🔥", body: "You're on fire! Cook tonight to keep your streak alive.",
      hoursBack: 8, section: "activity",
      action: { kind: "tab", path: "/(tabs)/profile" },
    },
    {
      id: "a_plan", featherIcon: "calendar", color: "#5B8EF5",
      title: "Your weekly meal plan is ready", body: "AI-generated meals based on what's in your pantry — tap to view.",
      hoursBack: 24, section: "activity",
      action: { kind: "tab", path: "/(tabs)/planner" },
    },
    {
      id: "a_salmon", featherIcon: "user", color: "#9B6DFF",
      title: "Chef Marco cooked Teriyaki Salmon", body: "See how their dish turned out — tap to view.",
      hoursBack: 26, section: "activity",
      action: { kind: "tab", path: "/(tabs)/social" },
    },
  );

  return notifs;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const { markAllRead, clearAll, cleared } = useNotifications();
  const { pantryItems } = useApp();

  const expiringItems = pantryItems.filter(
    (i) => i.status === "Expiring" || i.status === "Expired"
  );

  // Mark all read as soon as screen opens
  useEffect(() => { markAllRead(); }, []);

  const handleTap = async (action: Action) => {
    if (action.kind === "intent") {
      await AsyncStorage.setItem(INTENT_KEY, JSON.stringify({ type: action.type, value: action.value }));
      router.navigate("/(tabs)/" as any);
    } else if (action.kind === "recipe") {
      router.push(`/recipe/${action.id}` as any);
    } else if (action.kind === "tab") {
      router.navigate(action.path as any);
    }
  };

  const handleClearAll = async () => {
    await clearAll();
  };

  const notifs = buildNotifications(expiringItems);
  const mealNotifs = notifs.filter((n) => n.section === "meal");
  const activityNotifs = notifs.filter((n) => n.section === "activity");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Notifications
        </Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
          <Text style={[styles.clearBtnText, { color: "#E84040", fontFamily: "Inter_600SemiBold" }]}>
            Clear all
          </Text>
        </TouchableOpacity>
      </View>

      {/* Empty state */}
      {cleared ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>🔔</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            All caught up!
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            No notifications right now.{"\n"}New ones will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* TODAY — meal notifications */}
          {mealNotifs.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                TODAY
              </Text>
              {mealNotifs.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.saffron + "45" }]}
                  onPress={() => handleTap(n.action)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconBg, { backgroundColor: colors.saffron + "20" }]}>
                    <Text style={{ fontSize: 22 }}>{n.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {n.title}
                    </Text>
                    <Text style={[styles.cardBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {n.body}
                    </Text>
                    <View style={styles.cardMeta}>
                      <Text style={[styles.cardTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {timeAgo(n.hoursBack)}
                      </Text>
                      {n.mealLabel && (
                        <View style={[styles.mealTag, { backgroundColor: colors.saffron + "22" }]}>
                          <Text style={[styles.mealTagText, { color: colors.saffron, fontFamily: "Inter_600SemiBold" }]}>
                            {n.mealLabel}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ACTIVITY notifications */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>
            ACTIVITY
          </Text>
          {activityNotifs.map((n) => {
            const isExpiry = n.featherIcon === "alert-triangle";
            const isReady = n.featherIcon === "check-circle";
            const isRecipe = n.action.kind === "recipe";

            let actionHint = "Open";
            if (isExpiry) actionHint = "Find recipes";
            else if (isReady || isRecipe) actionHint = "Start cooking";
            else if (n.action.kind === "tab" && (n.action as any).path?.includes("social")) actionHint = "View feed";
            else if (n.action.kind === "tab" && (n.action as any).path?.includes("profile")) actionHint = "View profile";
            else if (n.action.kind === "tab" && (n.action as any).path?.includes("planner")) actionHint = "View plan";

            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleTap(n.action)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconBg, { backgroundColor: n.color + "20" }]}>
                  <Feather name={n.featherIcon as any} size={20} color={n.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {n.title}
                  </Text>
                  <Text style={[styles.cardBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {n.body}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {timeAgo(n.hoursBack)}
                    </Text>
                    <View style={[styles.actionHintTag, { backgroundColor: n.color + "15", borderColor: n.color + "30" }]}>
                      <Text style={[styles.actionHintText, { color: n.color, fontFamily: "Inter_600SemiBold" }]}>
                        {actionHint} →
                      </Text>
                    </View>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20 },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 14 },

  content: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.1, marginBottom: 10, marginTop: 4, paddingHorizontal: 2 },

  card: {
    flexDirection: "row", alignItems: "center",
    gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
  },
  iconBg: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: 14, marginBottom: 3 },
  cardBody: { fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  cardTime: { fontSize: 11 },

  mealTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  mealTagText: { fontSize: 11 },

  actionHintTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  actionHintText: { fontSize: 11 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 24, marginBottom: 10 },
  emptyBody: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
