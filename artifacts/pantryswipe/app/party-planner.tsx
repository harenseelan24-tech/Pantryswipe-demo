import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
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
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useColors } from "@/hooks/useColors";
import {
  generatePartyMenu,
  callClaudeWithPrompt,
  parseClaudeJSON,
  PARTY_SYSTEM_PROMPT,
  PartyPlan,
  MenuItem,
  MenuCourse,
} from "@/services/aiChef";

// DateTimePicker — lazy-loaded: not available on web or if package is missing
let DateTimePicker: React.ComponentType<any> | null = null;
try {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
} catch {}

// ── Constants (defined outside component — never inside render) ───────────────

const DIETARY_TAGS = [
  "No pork",
  "No beef",
  "No shellfish",
  "No alcohol",
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
  "Low spice",
] as const;
type DietaryTag = (typeof DIETARY_TAGS)[number];

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

const SAMPLE_PLAN: PartyPlan = {
  menu: [
    {
      course: "Mains",
      items: [
        { name: "Grilled chicken thighs", quantity: "3kg", estimatedCost: 22.0, prepNote: "Marinate 2hrs, grill 25min" },
        { name: "Beef sausages", quantity: "2kg", estimatedCost: 14.0, prepNote: "Grill 15min, turning regularly" },
      ],
    },
    {
      course: "Sides",
      items: [
        { name: "Coleslaw", quantity: "1.5kg tub", estimatedCost: 8.0, prepNote: "Ready-made, serve cold" },
        { name: "Bread rolls", quantity: "20 pack", estimatedCost: 5.0, prepNote: "Slice and butter ahead" },
      ],
    },
    {
      course: "Drinks",
      items: [
        { name: "Soft drinks assorted", quantity: "4x 1.5L bottles", estimatedCost: 12.0, prepNote: "Chill in ice bucket" },
      ],
    },
    {
      course: "Desserts",
      items: [
        { name: "Watermelon slices", quantity: "2 melons", estimatedCost: 10.0, prepNote: "Pre-slice, keep cool" },
      ],
    },
  ],
  shoppingList: [
    { item: "Chicken thighs", quantity: "3kg", estimatedCost: 22.0 },
    { item: "Beef sausages", quantity: "2kg", estimatedCost: 14.0 },
    { item: "Coleslaw", quantity: "1.5kg tub", estimatedCost: 8.0 },
    { item: "Bread rolls", quantity: "20 pack", estimatedCost: 5.0 },
    { item: "Soft drinks", quantity: "4x 1.5L", estimatedCost: 12.0 },
    { item: "Watermelon", quantity: "2 melons", estimatedCost: 10.0 },
  ],
  timeline: [
    { hoursBeforeArrival: 24, task: "Buy all groceries" },
    { hoursBeforeArrival: 2, task: "Marinate chicken thighs" },
    { hoursBeforeArrival: 1, task: "Prep coleslaw and slice bread rolls" },
    { hoursBeforeArrival: 0.5, task: "Light the grill" },
    { hoursBeforeArrival: 0.25, task: "Start grilling sausages" },
  ],
  costBreakdown: { totalEstimated: 71.0, budgetRemaining: 79.0, costPerPerson: 4.73 },
  hostTips: [
    "Set up a self-serve drink station so you can stay at the grill",
    "Pre-cut watermelon the night before and refrigerate",
  ],
};

const PARTY_NOTIF_KEY = "partyPlannerNotifIds";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

const clearPartyNotifications = async () => {
  try {
    const raw = await AsyncStorage.getItem(PARTY_NOTIF_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    await AsyncStorage.removeItem(PARTY_NOTIF_KEY);
  } catch {
    /* ignore — best effort */
  }
};

const requestAndGetPushToken = async (): Promise<string | null> => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Notifications] Permission denied — skipping push token");
    return null;
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[Notifications] No EAS projectId found in app config");
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    console.error("[Notifications] Push token fetch failed:", e);
    return null;
  }
};

const schedulePartyNotifications = async (
  timeline: { hoursBeforeArrival: number; task: string }[],
  arrivalTimeMs: number
) => {
  await clearPartyNotifications();
  const scheduledIds: string[] = [];

  for (const entry of timeline) {
    const triggerMs = arrivalTimeMs - entry.hoursBeforeArrival * 3600 * 1000;
    if (triggerMs <= Date.now()) continue;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: "🎉 Party prep reminder", body: entry.task },
        trigger: { date: new Date(triggerMs) } as any,
      });
      scheduledIds.push(id);
    } catch (e) {
      console.warn("[Notifications] Failed to schedule:", entry.task, e);
    }
  }

  await AsyncStorage.setItem(PARTY_NOTIF_KEY, JSON.stringify(scheduledIds));
  requestAndGetPushToken().then((token) => {
    if (token) AsyncStorage.setItem("partyPlannerPushToken", token);
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PartyPlannerScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState("Birthday");
  const [guestCount, setGuestCount] = useState(12);
  const [servingStyle, setServingStyle] = useState("Buffet");
  const [budget, setBudget] = useState(200);
  const [selectedTags, setSelectedTags] = useState<DietaryTag[]>([]);
  const [additionalPreferences, setAdditionalPreferences] = useState("");
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // ── Plan state ─────────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<PartyPlan | null>(null);
  const [isAI, setIsAI] = useState(false);
  const [regeneratingSections, setRegeneratingSections] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ courseIdx: number; itemIdx: number } | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", quantity: "", estimatedCost: "", prepNote: "" });

  // ── Countdown ──────────────────────────────────────────────────────────────
  const [nextTask, setNextTask] = useState<{ label: string; msUntil: number } | null>(null);

  useEffect(() => {
    if (!plan || !arrivalTime) return;
    const computeNext = () => {
      const now = Date.now();
      const arrivalMs = arrivalTime.getTime();
      const upcoming = plan.timeline
        .map((t) => ({ label: t.task, msUntil: arrivalMs - t.hoursBeforeArrival * 3600 * 1000 - now }))
        .filter((t) => t.msUntil > 0)
        .sort((a, b) => a.msUntil - b.msUntil);
      setNextTask(upcoming[0] ?? null);
    };
    computeNext();
    const interval = setInterval(computeNext, 60_000);
    return () => clearInterval(interval); // prevents memory leak
  }, [plan, arrivalTime]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const toggleTag = (tag: DietaryTag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const onDateChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "set" && selected) setArrivalTime(selected);
  };

  const handleGenerate = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGenerating(true);
    setIsAI(false);
    try {
      const result = await generatePartyMenu({
        occasion,
        guestCount,
        servingStyle,
        budget,
        dietaryRestrictions: selectedTags as string[],
        additionalPreferences,
        arrivalTime: arrivalTime?.getTime(),
      });
      setPlan(result);
      setIsAI(true);
    } catch {
      setPlan(SAMPLE_PLAN);
      setIsAI(false);
    }
    setStep(2);
    setGenerating(false);
  };

  const updateMenuItem = (courseIdx: number, itemIdx: number, updates: Partial<MenuItem>) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const newMenu = prev.menu.map((course, ci) =>
        ci !== courseIdx
          ? course
          : { ...course, items: course.items.map((item, ii) => (ii !== itemIdx ? item : { ...item, ...updates })) }
      );
      return { ...prev, menu: newMenu };
    });
    setEditingItem(null);
  };

  const safeRestrictions =
    selectedTags
      .map((r) => r.replace(/[`"\\]/g, "").trim())
      .filter(Boolean)
      .join(", ") || "None";

  const regenerateSection = async (courseName: string) => {
    if (regeneratingSections.has(courseName)) return; // prevent double-tap
    setRegeneratingSections((prev) => new Set(prev).add(courseName));

    try {
      const lockedMenu = plan!.menu
        .filter((c) => c.course !== courseName)
        .map((c) => ({ course: c.course, items: c.items.map((i) => i.name).slice(0, 8) }));

      const regenPrompt = `The following party plan sections are confirmed and must NOT change:
${JSON.stringify(lockedMenu).slice(0, 800)}

Regenerate ONLY the "${courseName}" course with fresh ideas.
All original constraints apply: occasion=${occasion}, guests=${guestCount}, budget=$${budget}, dietary=${safeRestrictions}.
Return ONLY a JSON object:
{ "course": "${courseName}", "items": [ { "name": "string", "quantity": "string", "estimatedCost": number, "prepNote": "string" } ] }
No markdown. No other keys.`;

      const raw = await callClaudeWithPrompt(regenPrompt, PARTY_SYSTEM_PROMPT);
      const newCourse = parseClaudeJSON<MenuCourse>(raw);

      setPlan((prev) => {
        if (!prev) return prev;
        return { ...prev, menu: prev.menu.map((c) => (c.course === courseName ? newCourse : c)) };
      });
    } catch {
      Alert.alert("Could not regenerate", "Please try again.");
    } finally {
      setRegeneratingSections((prev) => {
        const next = new Set(prev);
        next.delete(courseName);
        return next;
      });
    }
  };

  const handleSavePlan = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (plan && arrivalTime && Platform.OS !== "web") {
      try {
        await schedulePartyNotifications(plan.timeline, arrivalTime.getTime());
        Alert.alert("Plan saved!", "Prep reminders scheduled before guest arrival.");
      } catch {
        Alert.alert("Plan saved!", "Could not schedule notifications — check permissions.");
      }
    } else {
      Alert.alert("Plan saved!", "Head to the kitchen and get cooking! 🎉");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const activePlan = plan ?? SAMPLE_PLAN;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => (step > 0 ? setStep(step - 1) : router.back())}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Party Planner</Text>
        <View style={styles.stepDots}>
          {[0, 1, 2].map((s) => (
            <View
              key={s}
              style={[styles.stepDot, { backgroundColor: s <= step ? colors.primary : colors.border }]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 0: Occasion + guest count ─────────────────────────────── */}
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
                      backgroundColor: occasion === e.label ? colors.primary + "18" : colors.card,
                      borderColor: occasion === e.label ? colors.primary : colors.border,
                      borderWidth: occasion === e.label ? 2 : 1,
                    },
                  ]}
                  onPress={() => setOccasion(e.label)}
                >
                  <Feather
                    name={e.icon}
                    size={24}
                    color={occasion === e.label ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.eventCardLabel, { color: occasion === e.label ? colors.primary : colors.foreground }]}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Number of guests</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepperBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setGuestCount(Math.max(2, guestCount - 1))}
              >
                <Feather name="minus" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: colors.foreground }]}>{guestCount}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setGuestCount(Math.min(100, guestCount + 1))}
              >
                <Feather name="plus" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
              onPress={() => setStep(1)}
            >
              <Text style={styles.nextBtnText}>Next: Menu Preferences</Text>
              <Feather name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 1: Preferences ─────────────────────────────────────────── */}
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
                      backgroundColor: servingStyle === s ? colors.primary : colors.card,
                      borderColor: servingStyle === s ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setServingStyle(s)}
                >
                  <Text style={{ color: servingStyle === s ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 14 }}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Total budget</Text>
            <View style={styles.budgetDisplay}>
              <Text style={[styles.budgetAmount, { color: colors.primary }]}>${budget}</Text>
              <Text style={[styles.budgetPer, { color: colors.mutedForeground }]}>
                (${Math.round(budget / guestCount)}/person)
              </Text>
            </View>
            <View style={styles.chipRow}>
              {[100, 150, 200, 300, 500].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: budget === v ? colors.primary : colors.card,
                      borderColor: budget === v ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setBudget(v)}
                >
                  <Text style={{ color: budget === v ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 14 }}>
                    ${v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Dietary restrictions</Text>
            <View style={styles.tagWrap}>
              {DIETARY_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.dietChip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + "18" : colors.card,
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={tag}
                  >
                    {active && <Feather name="check" size={11} color={colors.primary} />}
                    <Text
                      style={{
                        color: active ? colors.primary : colors.mutedForeground,
                        fontSize: 13,
                        fontWeight: active ? "700" : "400",
                      }}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Additional preferences</Text>
            <TextInput
              style={[
                styles.prefInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder='e.g. "guests love very spicy food"'
              placeholderTextColor={colors.mutedForeground}
              value={additionalPreferences}
              onChangeText={setAdditionalPreferences}
              multiline
              numberOfLines={2}
            />

            <Text style={[styles.label, { color: colors.foreground }]}>Guest arrival time</Text>

            {Platform.OS === "web" ? (
              /* Web: native HTML datetime-local input via React Native Web */
              <View style={[styles.dateBtn, { backgroundColor: colors.card, borderColor: arrivalTime ? colors.primary : colors.border }]}>
                <Feather name="clock" size={16} color={arrivalTime ? colors.primary : colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, color: colors.foreground, fontSize: 14, outlineStyle: "none" } as any}
                  placeholderTextColor={colors.mutedForeground}
                  {...{ type: "datetime-local" } as any}
                  value={arrivalTime ? arrivalTime.toISOString().slice(0, 16) : ""}
                  onChange={((e: any) => {
                    const val = e.target?.value ?? e.nativeEvent?.text ?? "";
                    if (val) setArrivalTime(new Date(val));
                    else setArrivalTime(null);
                  }) as any}
                />
                {arrivalTime && (
                  <TouchableOpacity onPress={() => setArrivalTime(null)}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              /* Native iOS / Android */
              <>
                <TouchableOpacity
                  style={[styles.dateBtn, { backgroundColor: colors.card, borderColor: arrivalTime ? colors.primary : colors.border }]}
                  onPress={() => setShowPicker(true)}
                >
                  <Feather name="clock" size={16} color={arrivalTime ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: arrivalTime ? colors.foreground : colors.mutedForeground, flex: 1, fontSize: 14 }}>
                    {arrivalTime ? arrivalTime.toLocaleString() : "Tap to set guest arrival time (optional)"}
                  </Text>
                  {arrivalTime && (
                    <TouchableOpacity onPress={() => setArrivalTime(null)}>
                      <Feather name="x" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {showPicker && DateTimePicker && (
                  <DateTimePicker
                    value={arrivalTime ?? new Date(Date.now() + 3600 * 1000)}
                    mode="datetime"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onDateChange}
                  />
                )}
                {Platform.OS === "ios" && showPicker && (
                  <TouchableOpacity
                    onPress={() => setShowPicker(false)}
                    style={[styles.chip, { alignSelf: "flex-end", backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>Done</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.primary, opacity: generating ? 0.7 : 1 }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="zap" size={20} color="#fff" />
              )}
              <Text style={styles.nextBtnText}>{generating ? "Generating…" : "Generate Party Plan"}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2: Results ─────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            {/* Summary header */}
            <View
              style={[styles.partyHeader, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
            >
              <Text style={styles.partyHeaderEmoji}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partyHeaderTitle, { color: colors.foreground }]}>
                  {occasion} for {guestCount}
                </Text>
                <Text style={[styles.partyHeaderSub, { color: colors.mutedForeground }]}>
                  {servingStyle} · ${budget} budget
                  {selectedTags.length > 0
                    ? ` · ${selectedTags.slice(0, 2).join(", ")}${selectedTags.length > 2 ? ` +${selectedTags.length - 2}` : ""}`
                    : ""}
                </Text>
              </View>
            </View>

            {isAI && (
              <View
                style={[styles.aiBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
              >
                <Feather name="zap" size={12} color={colors.primary} />
                <Text style={[styles.aiBadgeText, { color: colors.primary }]}>AI-generated plan</Text>
              </View>
            )}

            {/* Countdown */}
            {nextTask && (
              <View
                style={[styles.countdownCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
              >
                <Feather name="bell" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.countdownLabel, { color: colors.foreground }]}>
                    Next: {nextTask.label}
                  </Text>
                  <Text style={[styles.countdownSub, { color: colors.primary }]}>
                    In {Math.round(nextTask.msUntil / 60_000)} minutes
                  </Text>
                </View>
              </View>
            )}

            {/* Cost breakdown */}
            {activePlan.costBreakdown && (
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 10 }]}>
                  Cost Breakdown
                </Text>
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.mutedForeground }]}>Total estimated</Text>
                  <Text style={[styles.costValue, { color: colors.foreground }]}>
                    {fmt(activePlan.costBreakdown.totalEstimated)}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.mutedForeground }]}>Budget remaining</Text>
                  <Text
                    style={[
                      styles.costValue,
                      { color: activePlan.costBreakdown.budgetRemaining >= 0 ? colors.secondary : colors.danger },
                    ]}
                  >
                    {fmt(activePlan.costBreakdown.budgetRemaining)}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.mutedForeground }]}>Per person</Text>
                  <Text style={[styles.costValue, { color: colors.foreground }]}>
                    {fmt(activePlan.costBreakdown.costPerPerson)}
                  </Text>
                </View>
              </View>
            )}

            {/* Menu sections */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Menu</Text>
            {activePlan.menu.map((course, ci) => {
              const isRegen = regeneratingSections.has(course.course);
              return (
                <View
                  key={course.course}
                  style={[styles.courseBlock, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.courseHeader}>
                    <Text style={[styles.courseTitle, { color: colors.primary }]}>{course.course}</Text>
                    <TouchableOpacity
                      style={[
                        styles.regenBtn,
                        { borderColor: isRegen ? colors.border : colors.primary + "50", opacity: isRegen ? 0.5 : 1 },
                      ]}
                      onPress={() => regenerateSection(course.course)}
                      disabled={isRegen}
                    >
                      {isRegen ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={11} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>Regenerate</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {course.items.map((item, ii) => {
                    const isEditing = editingItem?.courseIdx === ci && editingItem?.itemIdx === ii;
                    return (
                      <View key={ii}>
                        {isEditing ? (
                          <View
                            style={[
                              styles.editForm,
                              { borderColor: colors.primary + "40", backgroundColor: colors.primary + "08" },
                            ]}
                          >
                            <TextInput
                              style={[
                                styles.editInput,
                                { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground },
                              ]}
                              value={editDraft.name}
                              onChangeText={(v) => setEditDraft((d) => ({ ...d, name: v }))}
                              placeholder="Name"
                              placeholderTextColor={colors.mutedForeground}
                            />
                            <TextInput
                              style={[
                                styles.editInput,
                                { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground },
                              ]}
                              value={editDraft.quantity}
                              onChangeText={(v) => setEditDraft((d) => ({ ...d, quantity: v }))}
                              placeholder="Quantity"
                              placeholderTextColor={colors.mutedForeground}
                            />
                            <TextInput
                              style={[
                                styles.editInput,
                                { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground },
                              ]}
                              value={editDraft.estimatedCost}
                              onChangeText={(v) => setEditDraft((d) => ({ ...d, estimatedCost: v }))}
                              placeholder="Cost (USD)"
                              placeholderTextColor={colors.mutedForeground}
                              keyboardType="decimal-pad"
                            />
                            <TextInput
                              style={[
                                styles.editInput,
                                { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground },
                              ]}
                              value={editDraft.prepNote}
                              onChangeText={(v) => setEditDraft((d) => ({ ...d, prepNote: v }))}
                              placeholder="Prep note"
                              placeholderTextColor={colors.mutedForeground}
                            />
                            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                              <TouchableOpacity
                                style={[styles.editConfirmBtn, { backgroundColor: colors.primary }]}
                                onPress={() =>
                                  updateMenuItem(ci, ii, {
                                    name: editDraft.name,
                                    quantity: editDraft.quantity,
                                    // Note: editing menu item cost here is cosmetic only — shoppingList is source of truth
                                    estimatedCost: parseFloat(editDraft.estimatedCost) || item.estimatedCost,
                                    prepNote: editDraft.prepNote,
                                  })
                                }
                              >
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.editConfirmBtn, { backgroundColor: colors.muted }]}
                                onPress={() => setEditingItem(null)}
                              >
                                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
                                  Cancel
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={[styles.menuItemRow, { borderTopColor: colors.border }]}>
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={[styles.menuItemName, { color: colors.foreground }]}>{item.name}</Text>
                              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.quantity}</Text>
                              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontStyle: "italic" }}>
                                {item.prepNote}
                              </Text>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 6 }}>
                              {/* Note: editing menu item cost here is cosmetic only */}
                              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                                {fmt(item.estimatedCost)}
                              </Text>
                              <TouchableOpacity
                                disabled={isRegen}
                                onPress={() => {
                                  setEditDraft({
                                    name: item.name,
                                    quantity: item.quantity,
                                    estimatedCost: String(item.estimatedCost),
                                    prepNote: item.prepNote,
                                  });
                                  setEditingItem({ courseIdx: ci, itemIdx: ii });
                                }}
                              >
                                <Feather
                                  name="edit-2"
                                  size={13}
                                  color={isRegen ? colors.border : colors.mutedForeground}
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Shopping list */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Shopping List</Text>
            <View style={[styles.courseBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {activePlan.shoppingList.map((sl, i) => (
                <View key={i} style={[styles.menuItemRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemName, { color: colors.foreground }]}>{sl.item}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{sl.quantity}</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                    {fmt(sl.estimatedCost)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Timeline */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Prep Timeline</Text>
            <View style={[styles.courseBlock, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}>
              {activePlan.timeline
                .slice()
                .sort((a, b) => b.hoursBeforeArrival - a.hoursBeforeArrival)
                .map((t, i) => {
                  const h = t.hoursBeforeArrival;
                  const timeLabel =
                    h >= 24
                      ? `${Math.round(h / 24)}d before`
                      : h >= 1
                      ? `${h}h before`
                      : `${Math.round(h * 60)}min before`;
                  return (
                    <View key={i} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.timelineTime, { color: colors.primary }]}>{timeLabel}</Text>
                        <Text style={[styles.timelineTask, { color: colors.foreground }]}>{t.task}</Text>
                      </View>
                    </View>
                  );
                })}
            </View>

            {/* Host tips */}
            {activePlan.hostTips && activePlan.hostTips.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Host Tips</Text>
                <View style={[styles.courseBlock, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
                  {activePlan.hostTips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                      <Text style={{ fontSize: 16 }}>💡</Text>
                      <Text style={{ color: colors.foreground, fontSize: 14, flex: 1, lineHeight: 20 }}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Action buttons */}
            <View style={styles.actionBtns}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleSavePlan}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Save Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                onPress={() => {
                  setStep(1);
                  setPlan(null);
                  setIsAI(false);
                }}
              >
                <Feather name="refresh-cw" size={18} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>New Plan</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  stepDots: { flexDirection: "row", gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },

  content: { paddingHorizontal: 20, gap: 18 },
  stepTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },

  eventGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  eventCard: { width: "22%", aspectRatio: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6 },
  eventCardLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },

  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 24 },
  stepperBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 32, fontWeight: "800", minWidth: 60, textAlign: "center" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5 },

  budgetDisplay: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  budgetAmount: { fontSize: 40, fontWeight: "800" },
  budgetPer: { fontSize: 16 },

  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dietChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  prefInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 64, textAlignVertical: "top" },

  dateBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },

  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 100 },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  partyHeader: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  partyHeaderEmoji: { fontSize: 36 },
  partyHeaderTitle: { fontSize: 17, fontWeight: "700" },
  partyHeaderSub: { fontSize: 13, marginTop: 3 },

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

  countdownCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  countdownLabel: { fontSize: 14, fontWeight: "600" },
  countdownSub: { fontSize: 13, marginTop: 2 },

  infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  costRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  costLabel: { fontSize: 14 },
  costValue: { fontSize: 14, fontWeight: "700" },

  sectionTitle: { fontSize: 17, fontWeight: "700" },

  courseBlock: { borderRadius: 14, borderWidth: 1, padding: 14 },
  courseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  courseTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    minWidth: 32,
    justifyContent: "center",
  },

  menuItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  menuItemName: { fontSize: 14, fontWeight: "600" },

  editForm: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 8, marginVertical: 4 },
  editInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  editConfirmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },

  timelineItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineTime: { fontSize: 12, fontWeight: "700" },
  timelineTask: { fontSize: 14, marginTop: 2, lineHeight: 20 },

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
});
