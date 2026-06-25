import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

// ── API base: relative on web (proxy handles routing), full HTTPS on native ────
// EXPO_PUBLIC_DOMAIN is always injected by the dev script as $REPLIT_DEV_DOMAIN
const API_BASE =
  Platform.OS !== "web"
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? process.env.EXPO_PUBLIC_API_DOMAIN ?? "793ecd86-87bd-45bf-a997-455057de1a61-00-14m4lfwa4iiar.pike.replit.dev"}`
    : "";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PartyPlanForm {
  occasion: string;
  guestCount: number;
  budget: number;
  servingStyle: string;
  restrictions: string[];
  arrivalTime: string;
  additionalPreferences: string;
}

interface PlanMeta {
  occasion: string;
  guestCount: number;
  budget: number;
  restrictions: string[];
}

type AppState = "wizard" | "loading" | "error" | "plan";

// ── Constants ─────────────────────────────────────────────────────────────────
const OCCASIONS = [
  { label: "BBQ", icon: "sun" as const },
  { label: "Birthday Party", icon: "gift" as const },
  { label: "Family Gathering", icon: "users" as const },
  { label: "Dinner Party", icon: "moon" as const },
  { label: "Movie Night", icon: "film" as const },
  { label: "Brunch", icon: "coffee" as const },
  { label: "Holiday Fest", icon: "star" as const },
  { label: "Wedding", icon: "heart" as const },
];

const SERVING_STYLES = [
  { label: "Buffet", icon: "grid" as const },
  { label: "Finger Food", icon: "layers" as const },
  { label: "Plated", icon: "circle" as const },
  { label: "Family Style", icon: "share-2" as const },
];

const RESTRICTIONS = [
  "None",
  "Halal",
  "No Pork",
  "No Beef",
  "No Shellfish",
  "No Alcohol",
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Low Spice",
];

const MENU_TABS = ["MAINS", "SIDES", "SNACKS", "DRINKS", "DESSERTS"];
const SECTION_KEYS = [
  "PARTY OVERVIEW", "MAINS", "SIDES", "SNACKS",
  "DRINKS", "DESSERTS", "SHOPPING LIST",
  "BUDGET BREAKDOWN", "PREPARATION TIMELINE",
  "HOST TIPS", "VALIDATION CHECKLIST",
];

const INITIAL_FORM: PartyPlanForm = {
  occasion: "",
  guestCount: 10,
  budget: 0,
  servingStyle: "",
  restrictions: [],
  arrivalTime: "",
  additionalPreferences: "",
};

// ── Time slot picker helpers ───────────────────────────────────────────────────
function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let h = 10; h <= 23; h++) {
    for (const m of [0, 30]) {
      const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const period = h < 12 ? "AM" : "PM";
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
      slots.push({ label, value });
    }
  }
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

// ── parsePlan (exact per spec) ────────────────────────────────────────────────
function parsePlan(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = text.split(/^##\s+/m);
  for (const part of parts) {
    const firstLine = part.split("\n")[0].trim().toUpperCase();
    const matched = SECTION_KEYS.find((k) => firstLine.includes(k));
    if (matched) {
      sections[matched] = part.substring(part.indexOf("\n") + 1).trim();
    }
  }
  if (Object.keys(sections).length < 5) {
    throw new Error("Plan format could not be parsed. Please regenerate.");
  }
  return sections;
}

// ── Client-side restriction audit ─────────────────────────────────────────────
const RESTRICTION_BLOCKLIST: Record<string, string[]> = {
  "No Pork": ["pork", "bacon", "ham", "lard", "prosciutto"],
  Halal: ["pork", "bacon", "ham", "lard", "prosciutto"],
  "No Beef": ["beef", "brisket", "wagyu"],
  "No Shellfish": ["prawn", "crab", "lobster", "scallop", "clam", "shrimp"],
  Vegetarian: ["chicken", "duck", "pork", "beef", "lamb", "fish"],
  Vegan: ["chicken", "duck", "pork", "beef", "lamb", "fish"],
};

function auditRestrictions(planText: string, restrictions: string[]): boolean {
  const parts = planText.split(/^##\s+/m);
  const foodSections = ["MAINS", "SIDES", "SNACKS", "DESSERTS"];
  const foodText = parts
    .filter((p) => foodSections.some((s) => p.split("\n")[0].trim().toUpperCase().includes(s)))
    .join("\n")
    .toLowerCase();
  for (const r of restrictions) {
    const keywords = RESTRICTION_BLOCKLIST[r] ?? [];
    for (const kw of keywords) {
      if (foodText.includes(kw)) return true;
    }
  }
  return false;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PartyPlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  // App state
  const [appState, setAppState] = useState<AppState>("wizard");
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<PartyPlanForm>(INITIAL_FORM);
  const [stepError, setStepError] = useState("");
  const [budgetText, setBudgetText] = useState("");

  // Plan state
  const [planSections, setPlanSections] = useState<Record<string, string> | null>(null);
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [restrictionWarning, setRestrictionWarning] = useState(false);
  const [menuTab, setMenuTab] = useState("MAINS");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);

  const totalSteps = 7;
  const isWide = width > 600;

  // ── Step validation ───────────────────────────────────────────────────────
  function validateStep(): boolean {
    setStepError("");
    switch (wizardStep) {
      case 1:
        if (!form.occasion) { setStepError("Please select an occasion."); return false; }
        break;
      case 2:
        if (form.guestCount < 1 || form.guestCount > 500) {
          setStepError("Guest count must be between 1 and 500."); return false;
        }
        break;
      case 3:
        if (!form.budget || form.budget <= 0) {
          setStepError("Please enter a budget greater than SGD $0."); return false;
        }
        break;
      case 4:
        if (!form.servingStyle) { setStepError("Please select a serving style."); return false; }
        break;
      case 6:
        if (!form.arrivalTime.trim()) { setStepError("Please enter a guest arrival time."); return false; }
        break;
    }
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    Haptics.selectionAsync();
    setWizardStep((s) => Math.min(s + 1, totalSteps));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function goBack() {
    setStepError("");
    Haptics.selectionAsync();
    setWizardStep((s) => Math.max(s - 1, 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function submitPlan(regen = false) {
    if (!validateStep() && wizardStep === totalSteps) return;
    if (regen) {
      setRegenLoading(true);
    } else {
      setAppState("loading");
    }
    setStepError("");

    try {
      const res = await fetch(`${API_BASE}/api/generate-party-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: form.occasion,
          guestCount: form.guestCount,
          budget: form.budget,
          servingStyle: form.servingStyle,
          restrictions: form.restrictions.filter((r) => r !== "None"),
          arrivalTime: form.arrivalTime,
          additionalPreferences: form.additionalPreferences,
        }),
      });

      const data = await res.json() as {
        success?: boolean; plan?: string; metadata?: PlanMeta; error?: string;
      };

      if (!res.ok || !data.success || !data.plan) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      const sections = parsePlan(data.plan);
      const hasWarning = auditRestrictions(data.plan, form.restrictions.filter((r) => r !== "None"));

      setPlanSections(sections);
      setPlanMeta(data.metadata ?? null);
      setRestrictionWarning(hasWarning);
      setMenuTab("MAINS");
      setCheckedItems({});
      setGeneratedAt(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      setAppState("plan");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMessage(msg);
      setAppState("error");
    } finally {
      setRegenLoading(false);
    }
  }

  // ── Restriction toggle ────────────────────────────────────────────────────
  function toggleRestriction(tag: string) {
    setForm((prev) => {
      if (tag === "None") return { ...prev, restrictions: ["None"] };
      const without = prev.restrictions.filter((r) => r !== "None" && r !== tag);
      const hasTag = prev.restrictions.includes(tag);
      return { ...prev, restrictions: hasTag ? without : [...without, tag] };
    });
  }

  // ── Shopping list checkbox ────────────────────────────────────────────────
  function toggleCheck(key: string) {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: header
  // ────────────────────────────────────────────────────────────────────────
  function renderHeader(title: string, showBack = true) {
    return (
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        {showBack ? (
          <TouchableOpacity onPress={() => {
            if (appState === "wizard" && wizardStep > 1) goBack();
            else if (appState === "plan" || appState === "error") {
              setAppState("wizard"); setWizardStep(1);
            }
            else router.back();
          }} style={s.headerBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : <View style={s.headerBtn} />}
        <Text style={[s.headerTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={s.headerBtn} />
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: progress bar
  // ────────────────────────────────────────────────────────────────────────
  function renderProgress() {
    const pct = (wizardStep / totalSteps) * 100;
    return (
      <View style={[s.progressWrap, { backgroundColor: colors.muted }]}>
        <View style={[s.progressBar, { width: `${pct}%` as any, backgroundColor: colors.primary }]} />
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: wizard steps
  // ────────────────────────────────────────────────────────────────────────
  function renderStep() {
    switch (wizardStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  }

  function renderStepLabel(label: string) {
    return (
      <View style={s.stepLabelRow}>
        <Text style={[s.stepCounter, { color: colors.mutedForeground }]}>
          Step {wizardStep} of {totalSteps}
        </Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>{label}</Text>
      </View>
    );
  }

  // Step 1 – Occasion
  function renderStep1() {
    return (
      <View>
        {renderStepLabel("What's the occasion?")}
        <View style={s.occasionGrid}>
          {OCCASIONS.map((o) => {
            const active = form.occasion === o.label;
            return (
              <TouchableOpacity
                key={o.label}
                style={[s.occasionCard, {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }]}
                onPress={() => { setForm((f) => ({ ...f, occasion: o.label })); setStepError(""); }}
              >
                <Feather name={o.icon} size={24} color={active ? "#fff" : colors.mutedForeground} />
                <Text style={[s.occasionLabel, { color: active ? "#fff" : colors.foreground }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Step 2 – Guest count
  function renderStep2() {
    return (
      <View>
        {renderStepLabel("How many guests are you expecting?")}
        <View style={[s.counterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[s.counterBtn, { backgroundColor: form.guestCount <= 1 ? colors.muted : colors.primary }]}
            onPress={() => form.guestCount > 1 && setForm((f) => ({ ...f, guestCount: f.guestCount - 1 }))}
          >
            <Feather name="minus" size={20} color={form.guestCount <= 1 ? colors.mutedForeground : "#fff"} />
          </TouchableOpacity>
          <Text style={[s.counterNum, { color: colors.foreground }]}>{form.guestCount}</Text>
          <TouchableOpacity
            style={[s.counterBtn, { backgroundColor: form.guestCount >= 500 ? colors.muted : colors.primary }]}
            onPress={() => form.guestCount < 500 && setForm((f) => ({ ...f, guestCount: f.guestCount + 1 }))}
          >
            <Feather name="plus" size={20} color={form.guestCount >= 500 ? colors.mutedForeground : "#fff"} />
          </TouchableOpacity>
        </View>
        <Text style={[s.counterHint, { color: colors.mutedForeground }]}>Min 1 · Max 500</Text>
      </View>
    );
  }

  // Step 3 – Budget
  function renderStep3() {
    return (
      <View>
        {renderStepLabel("What is your total budget?")}
        <View style={[s.budgetRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.budgetPrefix, { color: colors.primary }]}>SGD $</Text>
          <TextInput
            style={[s.budgetInput, { color: colors.foreground }]}
            value={budgetText}
            onChangeText={(v) => {
              setBudgetText(v);
              const n = parseFloat(v);
              if (!isNaN(n) && n > 0) { setForm((f) => ({ ...f, budget: n })); setStepError(""); }
              else setForm((f) => ({ ...f, budget: 0 }));
            }}
            placeholder="e.g. 300"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    );
  }

  // Step 4 – Serving style
  function renderStep4() {
    return (
      <View>
        {renderStepLabel("How will you serve food?")}
        <View style={s.servingGrid}>
          {SERVING_STYLES.map((s_) => {
            const active = form.servingStyle === s_.label;
            return (
              <TouchableOpacity
                key={s_.label}
                style={[s.servingCard, {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }]}
                onPress={() => { setForm((f) => ({ ...f, servingStyle: s_.label })); setStepError(""); }}
              >
                <Feather name={s_.icon} size={22} color={active ? "#fff" : colors.mutedForeground} />
                <Text style={[s.servingLabel, { color: active ? "#fff" : colors.foreground }]}>
                  {s_.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Step 5 – Dietary restrictions
  function renderStep5() {
    return (
      <View>
        {renderStepLabel("Any dietary restrictions?")}
        <Text style={[s.stepHint, { color: colors.mutedForeground }]}>Select all that apply</Text>
        <View style={s.restrictionList}>
          {RESTRICTIONS.map((tag) => {
            const active = form.restrictions.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[s.restrictionRow, {
                  backgroundColor: active ? colors.primary + "18" : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }]}
                onPress={() => toggleRestriction(tag)}
              >
                <View style={[s.checkbox, {
                  backgroundColor: active ? colors.primary : "transparent",
                  borderColor: active ? colors.primary : colors.border,
                }]}>
                  {active && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={[s.restrictionLabel, { color: colors.foreground }]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Step 6 – Arrival time (tap-to-select chip grid)
  function renderStep6() {
    return (
      <View>
        {renderStepLabel("When are guests arriving?")}
        <Text style={[s.stepHint, { color: colors.mutedForeground, marginBottom: 16 }]}>
          Tap to pick guest arrival time
        </Text>
        <View style={s.timeGrid}>
          {TIME_SLOTS.map((slot) => {
            const selected = form.arrivalTime === slot.value;
            return (
              <TouchableOpacity
                key={slot.value}
                onPress={() => {
                  setForm((f) => ({ ...f, arrivalTime: slot.value }));
                  setStepError("");
                  Haptics.selectionAsync();
                }}
                style={[
                  s.timeChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[s.timeChipText, { color: selected ? "#fff" : colors.foreground }]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[s.stepHint, { color: colors.mutedForeground, marginTop: 12 }]}>
          Used to build your preparation timeline
        </Text>
      </View>
    );
  }

  // Step 7 – Additional preferences
  function renderStep7() {
    return (
      <View>
        {renderStepLabel("Anything else we should know?")}
        <Text style={[s.stepHint, { color: colors.mutedForeground }]}>Optional</Text>
        <TextInput
          style={[s.prefInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={form.additionalPreferences}
          onChangeText={(v) => setForm((f) => ({ ...f, additionalPreferences: v }))}
          placeholder="e.g. Kids attending, guests love spicy food, thinking of a cheese platter"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
        />
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: loading overlay (in-flow, NOT position:fixed)
  // ────────────────────────────────────────────────────────────────────────
  function renderLoading() {
    return (
      <View style={[s.loadingWrap, { backgroundColor: colors.background }]}>
        <Text style={[s.loadingAppName, { color: colors.primary }]}>🎉 PartySwipe AI</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
        <Text style={[s.loadingTitle, { color: colors.foreground }]}>
          Crafting your perfect party plan…
        </Text>
        <Text style={[s.loadingSub, { color: colors.mutedForeground }]}>
          This usually takes 20–30 seconds
        </Text>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: error state
  // ────────────────────────────────────────────────────────────────────────
  function renderError() {
    return (
      <View style={[s.errorWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="alert-circle" size={48} color={colors.danger} />
        <Text style={[s.errorTitle, { color: colors.foreground }]}>Something went wrong.</Text>
        <Text style={[s.errorMsg, { color: colors.mutedForeground }]}>{errorMessage}</Text>
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => submitPlan()}
        >
          <Text style={s.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => { setAppState("wizard"); setWizardStep(1); }}
        >
          <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>✏️ Edit Preferences</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: plan cards
  // ────────────────────────────────────────────────────────────────────────
  function card(children: React.ReactNode, key?: string) {
    return (
      <View key={key} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    );
  }

  function cardTitle(icon: string, title: string) {
    return (
      <View style={s.cardTitleRow}>
        <Text style={s.cardTitleIcon}>{icon}</Text>
        <Text style={[s.cardTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
    );
  }

  // Card 1 – Party Overview
  function renderOverviewCard(text: string) {
    const rows = text.split("\n").filter(Boolean);
    const generatedLine = generatedAt ? `Generated At: ${generatedAt}` : null;
    const allRows = generatedLine ? [...rows, generatedLine] : rows;
    return card(
      <>
        {cardTitle("🎉", "Party Overview")}
        <View style={s.overviewGrid}>
          {allRows.map((row, i) => {
            const [key, ...rest] = row.split(":");
            const value = rest.join(":").trim();
            if (!value) return null;
            return (
              <View key={i} style={[s.overviewCell, { borderBottomColor: colors.border }]}>
                <Text style={[s.overviewKey, { color: colors.mutedForeground }]}>{key.trim()}</Text>
                <Text style={[s.overviewVal, { color: colors.foreground }]}>{value}</Text>
              </View>
            );
          })}
        </View>
      </>
    );
  }

  // Card 2 – Menu (tabs)
  function renderMenuCard(sections: Record<string, string>) {
    const availableTabs = MENU_TABS.filter((t) => sections[t]);
    const activeText = sections[menuTab] ?? "";

    function renderMenuItems(text: string) {
      return text.split("\n").filter(Boolean).map((line, i) => {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 2) {
          return (
            <View key={i} style={[s.menuRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.menuName, { color: colors.foreground }]}>{parts[0]}</Text>
              {parts[1] && <Text style={[s.menuReason, { color: colors.mutedForeground }]}>{parts[1]}</Text>}
              <View style={s.menuMeta}>
                {parts[2] && <Text style={[s.menuQty, { color: colors.foreground }]}>{parts[2]}</Text>}
                {parts[3] && <Text style={[s.menuCost, { color: colors.primary }]}>{parts[3]}</Text>}
              </View>
            </View>
          );
        }
        return (
          <Text key={i} style={[s.menuPlain, { color: colors.foreground }]}>{line}</Text>
        );
      });
    }

    return card(
      <>
        {cardTitle("🍽️", "Recommended Menu")}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll}>
          {availableTabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, {
                backgroundColor: menuTab === tab ? colors.primary : "transparent",
                borderColor: menuTab === tab ? colors.primary : colors.border,
              }]}
              onPress={() => setMenuTab(tab)}
            >
              <Text style={[s.tabText, { color: menuTab === tab ? "#fff" : colors.mutedForeground }]}>
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ marginTop: 12 }}>
          {renderMenuItems(activeText)}
        </View>
      </>
    );
  }

  // Card 3 – Shopping List (with checkboxes)
  function renderShoppingCard(text: string) {
    const CATEGORIES = ["Produce", "Protein", "Bakery", "Dairy", "Frozen", "Beverages", "Miscellaneous"];
    const lines = text.split("\n").filter(Boolean);
    const grouped: Record<string, string[]> = {};
    let current = "Miscellaneous";
    for (const line of lines) {
      const catMatch = CATEGORIES.find((c) => line.startsWith(c + ":"));
      if (catMatch) {
        current = catMatch;
        const rest = line.replace(catMatch + ":", "").trim();
        if (rest) {
          if (!grouped[current]) grouped[current] = [];
          grouped[current].push(...rest.split(",").map((x) => x.trim()).filter(Boolean));
        }
      } else if (line.startsWith("-") || line.startsWith("•")) {
        if (!grouped[current]) grouped[current] = [];
        grouped[current].push(line.replace(/^[-•]\s*/, "").trim());
      } else if (line.trim()) {
        if (!grouped[current]) grouped[current] = [];
        grouped[current].push(line.trim());
      }
    }

    return card(
      <>
        {cardTitle("🛒", "Shopping List")}
        {Object.entries(grouped).map(([cat, items]) => {
          if (!items.length) return null;
          const allChecked = items.every((item) => checkedItems[`${cat}:${item}`]);
          return (
            <View key={cat} style={s.shopCat}>
              <Text style={[s.shopCatTitle, { color: allChecked ? colors.secondary : colors.foreground }]}>
                {cat} {allChecked ? "✓" : ""}
              </Text>
              {items.map((item) => {
                const key = `${cat}:${item}`;
                const checked = !!checkedItems[key];
                return (
                  <TouchableOpacity key={key} style={s.shopRow} onPress={() => toggleCheck(key)}>
                    <View style={[s.shopCheck, {
                      backgroundColor: checked ? colors.secondary : "transparent",
                      borderColor: checked ? colors.secondary : colors.border,
                    }]}>
                      {checked && <Feather name="check" size={11} color="#fff" />}
                    </View>
                    <Text style={[s.shopItem, {
                      color: checked ? colors.mutedForeground : colors.foreground,
                      textDecorationLine: checked ? "line-through" : "none",
                    }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </>
    );
  }

  // Card 4 – Budget Breakdown (bars)
  function renderBudgetCard(text: string, meta: PlanMeta) {
    const lines = text.split("\n").filter(Boolean);
    const budgetCeiling = meta.budget;
    let totalLine: string | null = null;
    let remainingLine: string | null = null;
    const rows: { label: string; amount: number; raw: string }[] = [];

    for (const line of lines) {
      const match = line.match(/^(.+?):\s*SGD\s*\$?([\d.,]+)/i);
      if (!match) continue;
      const label = match[1].trim();
      const amount = parseFloat(match[2].replace(",", ""));
      if (label.toLowerCase().includes("total")) { totalLine = line; continue; }
      if (label.toLowerCase().includes("remaining")) { remainingLine = line; continue; }
      rows.push({ label, amount, raw: line });
    }

    function parseAmt(line: string | null): number {
      if (!line) return 0;
      const m = line.match(/SGD\s*\$?([\d.,]+)/i);
      return m ? parseFloat(m[1].replace(",", "")) : 0;
    }
    const total = parseAmt(totalLine);
    const remaining = parseAmt(remainingLine);
    const overBudget = remaining < 0;

    return card(
      <>
        {cardTitle("💰", "Budget Breakdown")}
        {rows.map(({ label, amount }) => {
          const pct = Math.min((amount / budgetCeiling) * 100, 100);
          return (
            <View key={label} style={s.budgetBarRow}>
              <View style={s.budgetLabelRow}>
                <Text style={[s.budgetLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[s.budgetAmt, { color: colors.foreground }]}>SGD ${amount.toFixed(2)}</Text>
              </View>
              <View style={[s.budgetBarBg, { backgroundColor: colors.muted }]}>
                <View style={[s.budgetBarFill, { width: `${pct}%` as any, backgroundColor: colors.primary }]} />
              </View>
            </View>
          );
        })}
        <View style={[s.budgetSummary, { borderTopColor: colors.border }]}>
          <View style={s.budgetSumRow}>
            <Text style={[s.budgetSumLabel, { color: colors.foreground }]}>Total Estimated Spend</Text>
            <Text style={[s.budgetSumAmt, { color: colors.foreground }]}>SGD ${total.toFixed(2)}</Text>
          </View>
          <View style={s.budgetSumRow}>
            <Text style={[s.budgetSumLabel, { color: overBudget ? colors.danger : colors.secondary }]}>
              Remaining Budget
            </Text>
            <Text style={[s.budgetSumAmt, { color: overBudget ? colors.danger : colors.secondary, fontWeight: "700" }]}>
              SGD ${remaining.toFixed(2)}
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Card 5 – Preparation Timeline
  function renderTimelineCard(text: string) {
    const lines = text.split("\n").filter((l) => l.trim() && l.match(/\d{1,2}:\d{2}/));
    return card(
      <>
        {cardTitle("⏰", "Preparation Timeline")}
        {lines.map((line, i) => {
          const match = line.match(/^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/);
          const time = match ? match[1] : "";
          const action = match ? match[2] : line.trim();
          const isLast = i === lines.length - 1;
          return (
            <View key={i} style={s.timelineRow}>
              <View style={s.timelineDotCol}>
                <View style={[s.timelineDot, { backgroundColor: colors.primary }]} />
                {!isLast && <View style={[s.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={s.timelineContent}>
                {time ? <Text style={[s.timelineTime, { color: colors.primary }]}>{time}</Text> : null}
                <Text style={[s.timelineAction, { color: colors.foreground }]}>{action}</Text>
              </View>
            </View>
          );
        })}
      </>
    );
  }

  // Card 6 – Host Tips
  function renderTipsCard(text: string) {
    const lines = text.split("\n").filter(Boolean);
    return card(
      <>
        {cardTitle("💡", "Host Tips")}
        {lines.map((line, i) => (
          <View key={i} style={s.tipRow}>
            <Feather name="check-circle" size={15} color={colors.secondary} style={{ marginTop: 2 }} />
            <Text style={[s.tipText, { color: colors.foreground }]}>
              {line.replace(/^[-•*]\s*/, "")}
            </Text>
          </View>
        ))}
      </>
    );
  }

  // Card 7 – Validation Checklist
  function renderChecklistCard(text: string) {
    const lines = text.split("\n").filter(Boolean);
    return card(
      <>
        {cardTitle("✅", "Dietary Validation")}
        {lines.map((line, i) => (
          <View key={i} style={s.checklistRow}>
            <Text style={[s.checklistIcon, { color: colors.secondary }]}>✓</Text>
            <Text style={[s.checklistText, { color: colors.foreground }]}>
              {line.replace(/^✓\s*/, "")}
            </Text>
          </View>
        ))}
      </>
    );
  }

  // Full plan render
  function renderPlan() {
    if (!planSections) return null;
    return (
      <View>
        {restrictionWarning && (
          <View style={[s.warnBanner, { backgroundColor: "#FFF8E1", borderColor: "#F9A825" }]}>
            <Feather name="alert-triangle" size={16} color="#F9A825" />
            <Text style={s.warnText}>
              ⚠️ Some items may need review against your dietary restrictions. Please check the Validation Checklist below.
            </Text>
          </View>
        )}
        {planSections["PARTY OVERVIEW"] ? renderOverviewCard(planSections["PARTY OVERVIEW"]) : null}
        {renderMenuCard(planSections)}
        {planSections["SHOPPING LIST"] ? renderShoppingCard(planSections["SHOPPING LIST"]) : null}
        {planSections["BUDGET BREAKDOWN"] && planMeta
          ? renderBudgetCard(planSections["BUDGET BREAKDOWN"], planMeta)
          : null}
        {planSections["PREPARATION TIMELINE"] ? renderTimelineCard(planSections["PREPARATION TIMELINE"]) : null}
        {planSections["HOST TIPS"] ? renderTipsCard(planSections["HOST TIPS"]) : null}
        {planSections["VALIDATION CHECKLIST"] ? renderChecklistCard(planSections["VALIDATION CHECKLIST"]) : null}

        {/* Action buttons */}
        <View style={s.planActions}>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: regenLoading ? 0.7 : 1 }]}
            onPress={() => submitPlan(true)}
            disabled={regenLoading}
          >
            {regenLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ marginRight: 6 }}>🔄</Text>
            }
            <Text style={s.primaryBtnText}>{regenLoading ? "Regenerating…" : "Regenerate Plan"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => { setAppState("wizard"); setWizardStep(1); }}
          >
            <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>✏️ Edit Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ────────────────────────────────────────────────────────────────────────
  const contentMaxWidth = isWide ? (appState === "plan" ? 800 : 600) : undefined;

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {renderHeader(
        appState === "plan" ? "Your Party Plan" : "Party Planner",
        appState !== "loading"
      )}

      {appState === "wizard" && renderProgress()}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.centerWrap, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : {}]}>

          {appState === "wizard" && (
            <>
              {renderStep()}
              {stepError ? (
                <Text style={[s.stepError, { color: colors.danger }]}>{stepError}</Text>
              ) : null}
              <View style={s.navRow}>
                {wizardStep > 1 && (
                  <TouchableOpacity style={[s.backBtn, { borderColor: colors.border }]} onPress={goBack}>
                    <Feather name="arrow-left" size={16} color={colors.foreground} />
                    <Text style={[s.backBtnText, { color: colors.foreground }]}>Back</Text>
                  </TouchableOpacity>
                )}
                {wizardStep < totalSteps ? (
                  <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary, flex: 1, marginLeft: wizardStep > 1 ? 10 : 0 }]} onPress={goNext}>
                    <Text style={s.primaryBtnText}>Next →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: colors.primary, flex: 1, marginLeft: wizardStep > 1 ? 10 : 0 }]}
                    onPress={() => submitPlan()}
                  >
                    <Text style={s.primaryBtnText}>🎉 Generate My Party Plan</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {appState === "loading" && renderLoading()}
          {appState === "error" && renderError()}
          {appState === "plan" && renderPlan()}

        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  progressWrap: { height: 4 },
  progressBar: { height: 4, borderRadius: 2 },
  scrollContent: { padding: 16 },
  centerWrap: { gap: 16 },

  // Wizard step
  stepLabelRow: { marginBottom: 16, gap: 4 },
  stepCounter: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  stepTitle: { fontSize: 22, fontWeight: "800" },
  stepHint: { fontSize: 13, marginBottom: 12, marginTop: -8 },
  stepError: { fontSize: 13, fontWeight: "600", marginTop: -8 },

  // Occasion grid
  occasionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  occasionCard: { width: "47%", aspectRatio: 1.3, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1.5, gap: 8, minHeight: 44 },
  occasionLabel: { fontSize: 13, fontWeight: "700", textAlign: "center" },

  // Guest counter
  counterCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1.5, padding: 20 },
  counterBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  counterNum: { fontSize: 42, fontWeight: "800", minWidth: 80, textAlign: "center" },
  counterHint: { fontSize: 12, textAlign: "center", marginTop: 8 },

  // Budget
  budgetRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  budgetPrefix: { fontSize: 20, fontWeight: "700" },
  budgetInput: { flex: 1, fontSize: 20, fontWeight: "600" },

  // Serving style
  servingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servingCard: { width: "47%", alignItems: "center", paddingVertical: 20, borderRadius: 14, borderWidth: 1.5, gap: 10, minHeight: 44 },
  servingLabel: { fontSize: 14, fontWeight: "700" },

  // Restrictions
  restrictionList: { gap: 8 },
  restrictionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 12, minHeight: 44 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  restrictionLabel: { fontSize: 15, fontWeight: "600" },

  // Arrival time
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeChip: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, minWidth: "22%" },
  timeChipText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  // Preferences
  prefInput: { borderRadius: 14, borderWidth: 1.5, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: "top" },

  // Nav
  navRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, minHeight: 44 },
  backBtnText: { fontSize: 15, fontWeight: "600" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 100, minHeight: 44, gap: 8 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { alignItems: "center", paddingVertical: 14, borderRadius: 100, borderWidth: 1.5, minHeight: 44 },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },

  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 8 },
  loadingAppName: { fontSize: 22, fontWeight: "800" },
  loadingTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  loadingSub: { fontSize: 14, textAlign: "center", marginTop: 8 },

  // Error
  errorWrap: { alignItems: "center", padding: 32, borderRadius: 20, borderWidth: 1, gap: 12, marginTop: 32 },
  errorTitle: { fontSize: 20, fontWeight: "700" },
  errorMsg: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Plan cards
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitleIcon: { fontSize: 20 },
  cardTitle: { fontSize: 17, fontWeight: "800" },

  // Overview
  overviewGrid: { gap: 0 },
  overviewCell: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  overviewKey: { fontSize: 13, fontWeight: "600", flex: 1 },
  overviewVal: { fontSize: 13, fontWeight: "700", flex: 2, textAlign: "right" },

  // Menu tabs
  tabScroll: { marginHorizontal: -4 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, marginHorizontal: 4, minHeight: 44, justifyContent: "center" },
  tabText: { fontSize: 13, fontWeight: "700" },
  menuRow: { paddingVertical: 12, borderBottomWidth: 1, gap: 4 },
  menuName: { fontSize: 15, fontWeight: "700" },
  menuReason: { fontSize: 13, lineHeight: 18 },
  menuMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  menuQty: { fontSize: 13, fontWeight: "600" },
  menuCost: { fontSize: 13, fontWeight: "700" },
  menuPlain: { fontSize: 14, paddingVertical: 8 },

  // Shopping
  shopCat: { marginBottom: 12 },
  shopCatTitle: { fontSize: 14, fontWeight: "800", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, minHeight: 44 },
  shopCheck: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  shopItem: { fontSize: 14, flex: 1 },

  // Budget breakdown bars
  budgetBarRow: { gap: 6, marginBottom: 8 },
  budgetLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetLabel: { fontSize: 14, fontWeight: "600" },
  budgetAmt: { fontSize: 14, fontWeight: "700" },
  budgetBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  budgetBarFill: { height: 8, borderRadius: 4 },
  budgetSummary: { borderTopWidth: 1, paddingTop: 12, marginTop: 4, gap: 8 },
  budgetSumRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetSumLabel: { fontSize: 14, fontWeight: "600" },
  budgetSumAmt: { fontSize: 14 },

  // Timeline
  timelineRow: { flexDirection: "row", gap: 12, minHeight: 44 },
  timelineDotCol: { alignItems: "center", width: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 16, gap: 2 },
  timelineTime: { fontSize: 13, fontWeight: "800" },
  timelineAction: { fontSize: 14, lineHeight: 20 },

  // Host tips
  tipRow: { flexDirection: "row", gap: 10, paddingVertical: 4, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Validation checklist
  checklistRow: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  checklistIcon: { fontSize: 16, fontWeight: "700" },
  checklistText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Warning banner
  warnBanner: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: "flex-start" },
  warnText: { flex: 1, fontSize: 13, color: "#E65100", lineHeight: 18 },

  // Plan actions
  planActions: { gap: 10, marginTop: 8 },
});
