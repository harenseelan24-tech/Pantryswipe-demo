import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

const NOTIFICATIONS = [
  { id: "1", icon: "alert-triangle", color: "#E84040", title: "Milk expires tomorrow", body: "Here are 5 recipes to use it up.", time: "2h ago" },
  { id: "2", icon: "check-circle", color: "#4CAF76", title: "Carbonara ready to cook!", body: "You now have all the ingredients. Ready?", time: "4h ago" },
  { id: "3", icon: "heart", color: "#E84040", title: "Chef Marco liked your post", body: "Your Spaghetti photo got a reaction!", time: "6h ago" },
  { id: "4", icon: "flame", color: "#F5A623", title: "7-day cooking streak!", body: "Amazing! Keep it up tonight.", time: "8h ago" },
  { id: "5", icon: "calendar", color: "#5B8EF5", title: "Weekly meal plan ready", body: "Your personalized plan for next week is here.", time: "1d ago" },
  { id: "6", icon: "user", color: "#9B6DFF", title: "Chef Marco cooked Salmon", body: "Ask them how it turned out!", time: "1d ago" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
        <TouchableOpacity>
          <Text style={[styles.clearAll, { color: colors.saffron }]}>Clear all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {NOTIFICATIONS.map((notif) => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.notifCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconBg, { backgroundColor: notif.color + "20" }]}>
              <Feather name={notif.icon as any} size={20} color={notif.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.notifTitle, { color: colors.foreground }]}>{notif.title}</Text>
              <Text style={[styles.notifBody, { color: colors.mutedForeground }]}>{notif.body}</Text>
              <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{notif.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
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
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  clearAll: { fontSize: 14, fontWeight: "600" },
  content: { paddingHorizontal: 20, gap: 10, paddingBottom: 32 },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  notifTitle: { fontSize: 15, fontWeight: "700" },
  notifBody: { fontSize: 13, lineHeight: 19 },
  notifTime: { fontSize: 12, marginTop: 2 },
});
