import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { generatePartyMenu, PartyMenuResult } from "@/services/aiChef";

const EVENT_TYPES = [
  { label: "Birthday", icon: "gift" as const },
  { label: "BBQ", icon: "sun" as const },
  { label: "Dinner Party", icon: "moon" as const },
  { label: "Holiday Feast", icon: "star" as const },
  { label: "Graduation", icon: "award" as const },
  { label: "Movie Night", icon: "film" as const },
  { label: "Brunch", icon: "coffee" as const },
  { label: "Wedding", icon: "heart" as const },
];

const SERVING_STYLES = ["Buffet", "Plated", "Finger Food", "Family Style"];
const SAMPLE_MENU = [
  { course: "Starter", name: "Bruschetta & Antipasto", time: "30 min" },
  { course: "Main", name: "BBQ Chicken with Herb Marinade", time: "45 min" },
  { course: "Side 1", name: "Roasted Vegetable Medley", time: "35 min" },
  { course: "Side 2", name: "Caesar Salad", time: "15 min" },
  { course: "Dessert", name: "Lemon Tart", time: "60 min" },
  { course: "Drinks", name: "Sparkling Citrus Punch", time: "10 min" },
];

export default function PartyPlannerScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [eventType, setEventType] = useState("Birthday");
  const [guestCount, setGuestCount] = useState(12);
  const [servingStyle, setServingStyle] = useState("Buffet");
  const [budget, setBudget] = useState(200);
  const [generated, setGenerating] = useState(false);
  const [aiMenu, setAiMenu] = useState<PartyMenuResult | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleGenerate = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGenerating(true);
    // Try real AI generation via inference.sh; fall back to SAMPLE_MENU on failure
    try {
      const result = await generatePartyMenu({ eventType, guestCount, servingStyle, budget });
      setAiMenu(result);
    } catch {
      setAiMenu(null);
    }
    setStep(2);
    setGenerating(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Party Planner</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}>
        {step === 0 && (
          <>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>What's the occasion?</Text>
            <View style={styles.eventGrid}>
              {EVENT_TYPES.map((e) => (
                <TouchableOpacity
                  key={e.label}
                  style={[
                    styles.eventCard,
                    {
                      backgroundColor: eventType === e.label ? colors.saffron + "15" : colors.card,
                      borderColor: eventType === e.label ? colors.saffron : colors.border,
                      borderWidth: eventType === e.label ? 2 : 1,
                    },
                  ]}
                  onPress={() => setEventType(e.label)}
                >
                  <Feather name={e.icon} size={24} color={eventType === e.label ? colors.saffron : colors.mutedForeground} />
                  <Text style={[styles.eventCardLabel, { color: eventType === e.label ? colors.saffron : colors.foreground }]}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Number of guests</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepperBtn, { borderColor: colors.border }]}
                onPress={() => setGuestCount(Math.max(2, guestCount - 1))}
              >
                <Feather name="minus" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: colors.foreground }]}>{guestCount}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { borderColor: colors.border }]}
                onPress={() => setGuestCount(Math.min(100, guestCount + 1))}
              >
                <Feather name="plus" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.saffron }]}
              onPress={() => setStep(1)}
            >
              <Text style={styles.nextBtnText}>Next: Menu Preferences</Text>
              <Feather name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Menu preferences</Text>

            <Text style={[styles.label, { color: colors.foreground }]}>Serving style</Text>
            <View style={styles.chipRow}>
              {SERVING_STYLES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: servingStyle === s ? colors.saffron : colors.card,
                      borderColor: servingStyle === s ? colors.saffron : colors.border,
                    },
                  ]}
                  onPress={() => setServingStyle(s)}
                >
                  <Text style={{ color: servingStyle === s ? "#fff" : colors.foreground, fontWeight: "600" }}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Total budget</Text>
            <View style={styles.budgetDisplay}>
              <Text style={[styles.budgetAmount, { color: colors.saffron }]}>${budget}</Text>
              <Text style={[styles.budgetPer, { color: colors.mutedForeground }]}>
                (${Math.round(budget / guestCount)}/person)
              </Text>
            </View>
            <View style={styles.budgetButtons}>
              {[100, 150, 200, 300, 500].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.budgetBtn,
                    {
                      backgroundColor: budget === v ? colors.saffron : colors.card,
                      borderColor: budget === v ? colors.saffron : colors.border,
                    },
                  ]}
                  onPress={() => setBudget(v)}
                >
                  <Text style={{ color: budget === v ? "#fff" : colors.foreground, fontWeight: "600" }}>
                    ${v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.saffron, opacity: generated ? 0.7 : 1 }]}
              onPress={handleGenerate}
              disabled={generated}
            >
              {generated ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="zap" size={20} color="#fff" />
              )}
              <Text style={styles.nextBtnText}>
                {generated ? "Generating..." : "Generate Party Plan"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={[styles.partyHeader, { backgroundColor: colors.saffron + "15", borderColor: colors.saffron + "30" }]}>
              <Text style={styles.partyHeaderEmoji}>🎉</Text>
              <View>
                <Text style={[styles.partyHeaderTitle, { color: colors.foreground }]}>
                  {eventType} for {guestCount} guests
                </Text>
                <Text style={[styles.partyHeaderSub, { color: colors.mutedForeground }]}>
                  {servingStyle} · ${budget} budget
                </Text>
              </View>
            </View>

            {aiMenu && (
              <View style={[styles.aiBadge, { backgroundColor: colors.saffron + "18", borderColor: colors.saffron + "40" }]}>
                <Feather name="zap" size={12} color={colors.saffron} />
                <Text style={[styles.aiBadgeText, { color: colors.saffron }]}>AI-generated menu</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Menu</Text>
            {(aiMenu?.menu ?? SAMPLE_MENU).map((item) => (
              <View key={item.course} style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.courseBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.courseLabel, { color: colors.mutedForeground }]}>{item.course}</Text>
                </View>
                <Text style={[styles.menuItemName, { color: colors.foreground }]}>{item.name}</Text>
                <View style={styles.menuItemMeta}>
                  <Feather name="clock" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.menuItemTime, { color: colors.mutedForeground }]}>{item.time}</Text>
                </View>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
            <View style={[styles.timeline, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(aiMenu?.timeline ?? [
                { time: "Day before", task: "Marinate proteins · Make desserts" },
                { time: "3h before", task: "Prep vegetables · Set up buffet station" },
                { time: "1h before", task: "Start mains · Arrange appetizers" },
                { time: "30m before", task: "Final seasoning · Plate garnishes" },
              ]).map((t, i) => (
                <View key={i} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.saffron }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timelineTime, { color: colors.saffron }]}>{t.time}</Text>
                    <Text style={[styles.timelineTask, { color: colors.foreground }]}>{t.task}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.actionBtns}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.saffron }]}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Save Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
                <Feather name="share-2" size={18} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
  content: { paddingHorizontal: 20, gap: 20 },
  stepTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  eventGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  eventCard: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  eventCardLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  label: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 24 },
  stepperBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 32, fontWeight: "800", minWidth: 60, textAlign: "center" },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 100,
    marginTop: 8,
  },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  budgetDisplay: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  budgetAmount: { fontSize: 40, fontWeight: "800" },
  budgetPer: { fontSize: 16 },
  budgetButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  budgetBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  partyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  partyHeaderEmoji: { fontSize: 40 },
  partyHeaderTitle: { fontSize: 18, fontWeight: "700" },
  partyHeaderSub: { fontSize: 14, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  menuItem: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  courseBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  courseLabel: { fontSize: 11, fontWeight: "700" },
  menuItemName: { flex: 1, fontSize: 15, fontWeight: "600" },
  menuItemMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuItemTime: { fontSize: 12 },
  timeline: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  timelineTime: { fontSize: 13, fontWeight: "700" },
  timelineTask: { fontSize: 14, marginTop: 2 },
  actionBtns: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 100,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  aiBadgeText: { fontSize: 12, fontWeight: "600" },
});
