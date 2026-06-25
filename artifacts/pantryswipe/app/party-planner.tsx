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

// ── API base ──────────────────────────────────────────────────────────────────
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
  { label: "BBQ",              icon: "sun"    as const },
  { label: "Birthday Party",   icon: "gift"   as const },
  { label: "Family Gathering", icon: "users"  as const },
  { label: "Dinner Party",     icon: "moon"   as const },
  { label: "Movie Night",      icon: "film"   as const },
  { label: "Brunch",           icon: "coffee" as const },
  { label: "Holiday Fest",     icon: "star"   as const },
  { label: "Wedding",          icon: "heart"  as const },
];

const SERVING_STYLES = [
  { label: "Buffet",       icon: "grid"     as const, desc: "Self-serve stations, great for 20+" },
  { label: "Finger Food",  icon: "layers"   as const, desc: "No cutlery needed, easy mingling"   },
  { label: "Plated",       icon: "circle"   as const, desc: "Individual portions, formal feel"    },
  { label: "Family Style", icon: "share-2"  as const, desc: "Shared platters at the table"        },
];

const RESTRICTIONS = [
  "None","Halal","No Pork","No Beef","No Shellfish",
  "No Alcohol","Vegetarian","Vegan","Gluten-Free","Dairy-Free","Nut-Free","Low Spice",
];

const MENU_TABS   = ["MAINS","SIDES","SNACKS","DRINKS","DESSERTS"];
const SECTION_KEYS = [
  "PARTY OVERVIEW","MAINS","SIDES","SNACKS","DRINKS","DESSERTS",
  "SHOPPING LIST","BUDGET BREAKDOWN","PREPARATION TIMELINE","HOST TIPS","VALIDATION CHECKLIST",
];

const STEP_META = [
  { emoji: "🎊", hint: "What are you celebrating?" },
  { emoji: "👥", hint: "How many guests are coming?" },
  { emoji: "💰", hint: "What's your total spend?"   },
  { emoji: "🍽️", hint: "How will food be served?"  },
  { emoji: "🥗", hint: "Any dietary needs to note?" },
  { emoji: "⏰", hint: "When are guests arriving?"  },
  { emoji: "✨", hint: "Final personal touches"      },
];

const SECTION_ACCENT: Record<string, string> = {
  "PARTY OVERVIEW":      "#F5A623",
  "MAINS":               "#4CAF76",
  "SIDES":               "#5B8EF5",
  "SNACKS":              "#FF7043",
  "DRINKS":              "#29B6F6",
  "DESSERTS":            "#EC407A",
  "SHOPPING LIST":       "#66BB6A",
  "BUDGET BREAKDOWN":    "#AB47BC",
  "PREPARATION TIMELINE":"#26C6DA",
  "HOST TIPS":           "#FFA726",
  "VALIDATION CHECKLIST":"#4CAF76",
};

const BUDGET_BAR_COLORS: Record<string, string> = {
  Mains: "#4CAF76", Sides: "#5B8EF5", Snacks: "#FF7043", Drinks: "#29B6F6", Desserts: "#EC407A",
};

const BUDGET_PRESETS  = [100, 200, 500, 1000];
const GUEST_QUICK_ADD = [5, 10, 20, 50];

const INITIAL_FORM: PartyPlanForm = {
  occasion: "", guestCount: 10, budget: 0,
  servingStyle: "", restrictions: [], arrivalTime: "", additionalPreferences: "",
};

// ── Time slots ────────────────────────────────────────────────────────────────
function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let h = 10; h <= 23; h++) {
    for (const m of [0, 30]) {
      const period = h < 12 ? "AM" : "PM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label = `${displayH}:${m === 0 ? "00" : "30"} ${period}`;
      const value = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
      slots.push({ label, value });
    }
  }
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

// ── Plan parser ───────────────────────────────────────────────────────────────
function parsePlan(text: string): Record<string, string> {
  const parts = text.split(/^##\s+/m);
  const sections: Record<string, string> = {};
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const rawHeader = part.slice(0, nl).trim().toUpperCase();
    const body = part
      .slice(nl + 1)
      .split("\n")
      .filter((l) => !/^-{3,}$/.test(l.trim()) && !/^>\s*⚠/.test(l.trim()))
      .join("\n")
      .trim();
    const key = SECTION_KEYS.find((k) => rawHeader.includes(k));
    if (key && body) sections[key] = body;
  }
  return sections;
}

// ── Restriction audit ─────────────────────────────────────────────────────────
const RESTRICTION_BLOCKLIST: Record<string, string[]> = {
  "No Pork":    ["pork","bacon","ham","lard","prosciutto"],
  Halal:        ["pork","bacon","ham","lard","prosciutto"],
  "No Beef":    ["beef","brisket","wagyu"],
  "No Shellfish":["prawn","crab","lobster","scallop","clam","shrimp"],
  Vegetarian:   ["chicken","duck","pork","beef","lamb","fish"],
  Vegan:        ["chicken","duck","pork","beef","lamb","fish"],
};

function auditRestrictions(planText: string, restrictions: string[]): boolean {
  const parts = planText.split(/^##\s+/m);
  const foodSections = ["MAINS","SIDES","SNACKS","DESSERTS"];
  const foodText = parts
    .filter((p) => foodSections.some((s) => p.split("\n")[0].trim().toUpperCase().includes(s)))
    .join("\n").toLowerCase();
  for (const r of restrictions) {
    for (const kw of RESTRICTION_BLOCKLIST[r] ?? []) {
      if (foodText.includes(kw)) return true;
    }
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════
export default function PartyPlannerScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef  = useRef<ScrollView>(null);

  const [appState,   setAppState]   = useState<AppState>("wizard");
  const [wizardStep, setWizardStep] = useState(1);
  const [form,       setForm]       = useState<PartyPlanForm>(INITIAL_FORM);
  const [stepError,  setStepError]  = useState("");
  const [budgetText, setBudgetText] = useState("");

  const [planSections,       setPlanSections]       = useState<Record<string, string> | null>(null);
  const [planMeta,           setPlanMeta]           = useState<PlanMeta | null>(null);
  const [errorMessage,       setErrorMessage]       = useState("");
  const [restrictionWarning, setRestrictionWarning] = useState(false);
  const [menuTab,            setMenuTab]            = useState("MAINS");
  const [checkedItems,       setCheckedItems]       = useState<Record<string, boolean>>({});
  const [generatedAt,        setGeneratedAt]        = useState<string | null>(null);
  const [regenLoading,       setRegenLoading]       = useState(false);

  const totalSteps = 7;
  const isWide     = width > 600;

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateStep(): boolean {
    setStepError("");
    switch (wizardStep) {
      case 1: if (!form.occasion)                              { setStepError("Please select an occasion.");                       return false; } break;
      case 2: if (form.guestCount < 1 || form.guestCount > 500) { setStepError("Guest count must be between 1 and 500.");         return false; } break;
      case 3: if (!form.budget || form.budget <= 0)            { setStepError("Please enter a budget greater than SGD $0.");      return false; } break;
      case 4: if (!form.servingStyle)                          { setStepError("Please select a serving style.");                  return false; } break;
      case 6: if (!form.arrivalTime.trim())                    { setStepError("Please select a guest arrival time.");             return false; } break;
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

  // ── API call ────────────────────────────────────────────────────────────────
  async function submitPlan(regen = false) {
    if (!validateStep() && wizardStep === totalSteps) return;
    regen ? setRegenLoading(true) : setAppState("loading");
    setStepError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate-party-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: form.occasion, guestCount: form.guestCount,
          budget: form.budget, servingStyle: form.servingStyle,
          restrictions: form.restrictions.filter((r) => r !== "None"),
          arrivalTime: form.arrivalTime, additionalPreferences: form.additionalPreferences,
        }),
      });
      const data = await res.json() as { success?: boolean; plan?: string; metadata?: PlanMeta; error?: string };
      if (!res.ok || !data.success || !data.plan) throw new Error(data.error ?? `Server error ${res.status}`);
      const sections   = parsePlan(data.plan);
      const hasWarning = auditRestrictions(data.plan, form.restrictions.filter((r) => r !== "None"));
      setPlanSections(sections);
      setPlanMeta(data.metadata ?? null);
      setRestrictionWarning(hasWarning);
      setMenuTab("MAINS");
      setCheckedItems({});
      setGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setAppState("plan");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setAppState("error");
    } finally {
      setRegenLoading(false);
    }
  }

  function toggleRestriction(tag: string) {
    setForm((prev) => {
      if (tag === "None") return { ...prev, restrictions: ["None"] };
      const without = prev.restrictions.filter((r) => r !== "None" && r !== tag);
      return { ...prev, restrictions: prev.restrictions.includes(tag) ? without : [...without, tag] };
    });
  }

  function toggleCheck(key: string) {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // WIZARD: inline top bar (replaces the old header)
  // ────────────────────────────────────────────────────────────────────────────
  function renderWizardTopBar() {
    return (
      <View style={[s.wizTopBar, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={s.wizTopBtn}
          onPress={wizardStep > 1 ? goBack : () => router.back()}
        >
          <Feather
            name={wizardStep > 1 ? "arrow-left" : "x"}
            size={20}
            color={colors.foreground}
          />
        </TouchableOpacity>

        {/* Progress dots */}
        <View style={s.wizTopDots}>
          {Array.from({ length: totalSteps }, (_, i) => {
            const step   = i + 1;
            const done   = step < wizardStep;
            const active = step === wizardStep;
            return (
              <View
                key={step}
                style={[
                  s.dot,
                  done   && { backgroundColor: colors.primary,         width: 8,  height: 8  },
                  active && { backgroundColor: colors.primary,         width: 22, height: 8, borderRadius: 4 },
                  !done && !active && { backgroundColor: colors.muted, width: 8,  height: 8  },
                ]}
              />
            );
          })}
        </View>

        {/* Right spacer keeps dots centred */}
        <View style={{ width: 44 }} />
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // WIZARD: step label (emoji + question)
  // ────────────────────────────────────────────────────────────────────────────
  function renderStepLabel(label: string) {
    const meta = STEP_META[wizardStep - 1];
    return (
      <View style={s.stepLabelWrap}>
        <Text style={s.stepEmoji}>{meta?.emoji ?? "✨"}</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>{label}</Text>
      </View>
    );
  }

  // ── Step routers ─────────────────────────────────────────────────────────────
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
                activeOpacity={0.75}
                style={[s.occasionCard, {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor:     active ? colors.primary : colors.border,
                  shadowColor:     active ? colors.primary : "transparent",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: active ? 0.35 : 0,
                  shadowRadius:  8,
                  elevation: active ? 6 : 0,
                }]}
                onPress={() => { setForm((f) => ({ ...f, occasion: o.label })); setStepError(""); Haptics.selectionAsync(); }}
              >
                <Feather name={o.icon} size={26} color={active ? "#fff" : colors.mutedForeground} />
                <Text style={[s.occasionLabel, { color: active ? "#fff" : colors.foreground }]}>{o.label}</Text>
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
        {renderStepLabel("How many guests?")}
        <View style={[s.counterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.counterBtn, { backgroundColor: form.guestCount <= 1 ? colors.muted : colors.primary }]}
            onPress={() => form.guestCount > 1 && setForm((f) => ({ ...f, guestCount: f.guestCount - 1 }))}
          >
            <Feather name="minus" size={22} color={form.guestCount <= 1 ? colors.mutedForeground : "#fff"} />
          </TouchableOpacity>
          <View style={s.counterNumWrap}>
            <Text style={[s.counterNum, { color: colors.foreground }]}>{form.guestCount}</Text>
            <Text style={[s.counterNumLabel, { color: colors.mutedForeground }]}>guests</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.counterBtn, { backgroundColor: form.guestCount >= 500 ? colors.muted : colors.primary }]}
            onPress={() => form.guestCount < 500 && setForm((f) => ({ ...f, guestCount: f.guestCount + 1 }))}
          >
            <Feather name="plus" size={22} color={form.guestCount >= 500 ? colors.mutedForeground : "#fff"} />
          </TouchableOpacity>
        </View>
        <View style={s.quickAddRow}>
          {GUEST_QUICK_ADD.map((n) => (
            <TouchableOpacity key={n} activeOpacity={0.75}
              style={[s.quickAddBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => { setForm((f) => ({ ...f, guestCount: Math.min(f.guestCount + n, 500) })); Haptics.selectionAsync(); }}
            >
              <Text style={[s.quickAddText, { color: colors.primary }]}>+{n}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity activeOpacity={0.75}
            style={[s.quickAddBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => { setForm((f) => ({ ...f, guestCount: 10 })); Haptics.selectionAsync(); }}
          >
            <Text style={[s.quickAddText, { color: colors.mutedForeground }]}>Reset</Text>
          </TouchableOpacity>
        </View>
        <Text style={[s.stepHint, { color: colors.mutedForeground, textAlign: "center" }]}>1 – 500 guests</Text>
      </View>
    );
  }

  // Step 3 – Budget
  function renderStep3() {
    return (
      <View>
        {renderStepLabel("What's your budget?")}
        <View style={[s.budgetInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
        <View style={s.presetRow}>
          {BUDGET_PRESETS.map((amt) => {
            const active = form.budget === amt;
            return (
              <TouchableOpacity key={amt} activeOpacity={0.75}
                style={[s.presetBtn, {
                  borderColor:     active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary + "18" : colors.card,
                }]}
                onPress={() => { setBudgetText(String(amt)); setForm((f) => ({ ...f, budget: amt })); setStepError(""); Haptics.selectionAsync(); }}
              >
                <Text style={[s.presetText, { color: active ? colors.primary : colors.foreground }]}>${amt}</Text>
              </TouchableOpacity>
            );
          })}
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
          {SERVING_STYLES.map((style) => {
            const active = form.servingStyle === style.label;
            return (
              <TouchableOpacity key={style.label} activeOpacity={0.75}
                style={[s.servingCard, {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor:     active ? colors.primary : colors.border,
                  shadowColor:     active ? colors.primary : "transparent",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: active ? 0.3 : 0,
                  shadowRadius:  8,
                  elevation: active ? 6 : 0,
                }]}
                onPress={() => { setForm((f) => ({ ...f, servingStyle: style.label })); setStepError(""); Haptics.selectionAsync(); }}
              >
                <Feather name={style.icon} size={26} color={active ? "#fff" : colors.mutedForeground} />
                <Text style={[s.servingLabel, { color: active ? "#fff" : colors.foreground }]}>{style.label}</Text>
                <Text style={[s.servingDesc, { color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>{style.desc}</Text>
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
              <TouchableOpacity key={tag} activeOpacity={0.75}
                style={[s.restrictionRow, {
                  backgroundColor: active ? colors.primary + "14" : colors.card,
                  borderColor:     active ? colors.primary : colors.border,
                }]}
                onPress={() => { toggleRestriction(tag); Haptics.selectionAsync(); }}
              >
                <View style={[s.checkbox, {
                  backgroundColor: active ? colors.primary : "transparent",
                  borderColor:     active ? colors.primary : colors.border,
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

  // Step 6 – Arrival time
  function renderStep6() {
    return (
      <View>
        {renderStepLabel("When are guests arriving?")}
        <Text style={[s.stepHint, { color: colors.mutedForeground, marginBottom: 16 }]}>
          Tap a time — used to build your prep timeline
        </Text>
        <View style={s.timeGrid}>
          {TIME_SLOTS.map((slot) => {
            const selected = form.arrivalTime === slot.value;
            return (
              <TouchableOpacity key={slot.value} activeOpacity={0.75}
                onPress={() => { setForm((f) => ({ ...f, arrivalTime: slot.value })); setStepError(""); Haptics.selectionAsync(); }}
                style={[s.timeChip, {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor:     selected ? colors.primary : colors.border,
                  shadowColor:     selected ? colors.primary : "transparent",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: selected ? 0.3 : 0,
                  shadowRadius:  4,
                  elevation: selected ? 3 : 0,
                }]}
              >
                <Text style={[s.timeChipText, { color: selected ? "#fff" : colors.foreground }]}>{slot.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Step 7 – Additional preferences
  function renderStep7() {
    return (
      <View>
        {renderStepLabel("Anything else to know?")}
        <Text style={[s.stepHint, { color: colors.mutedForeground }]}>
          Optional — kids attending, favourite dishes, spice level…
        </Text>
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

  // ────────────────────────────────────────────────────────────────────────────
  // LOADING
  // ────────────────────────────────────────────────────────────────────────────
  function renderLoading() {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.loadingEmoji}>🎉</Text>
        <Text style={[s.loadingAppName, { color: colors.primary }]}>PartySwipe AI</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
        <Text style={[s.loadingTitle, { color: colors.foreground }]}>Crafting your perfect party plan…</Text>
        <Text style={[s.loadingSub,   { color: colors.mutedForeground }]}>Personalised just for you ✨</Text>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ERROR
  // ────────────────────────────────────────────────────────────────────────────
  function renderError() {
    return (
      <View style={[s.errorWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="alert-circle" size={48} color={colors.danger} />
        <Text style={[s.errorTitle, { color: colors.foreground }]}>Something went wrong.</Text>
        <Text style={[s.errorMsg, { color: colors.mutedForeground }]}>{errorMessage}</Text>
        <TouchableOpacity activeOpacity={0.8}
          style={[s.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => submitPlan()}
        >
          <Text style={s.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8}
          style={[s.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => { setAppState("wizard"); setWizardStep(1); }}
        >
          <Feather name="edit-2" size={15} color={colors.foreground} />
          <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>Edit Preferences</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PLAN CARDS
  // ────────────────────────────────────────────────────────────────────────────
  function planCard(sectionKey: string, emoji: string, title: string, children: React.ReactNode) {
    const accent = SECTION_ACCENT[sectionKey] ?? colors.primary;
    return (
      <View style={[s.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.planCardHeader, { backgroundColor: accent }]}>
          <Text style={s.planCardHeaderEmoji}>{emoji}</Text>
          <Text style={s.planCardHeaderTitle}>{title}</Text>
        </View>
        <View style={s.planCardBody}>{children}</View>
      </View>
    );
  }

  // Party Overview
  function renderOverviewCard(text: string) {
    const rows = text.split("\n").filter(Boolean);
    const allRows = generatedAt ? [...rows, `Generated At: ${generatedAt}`] : rows;
    return planCard("PARTY OVERVIEW", "🎊", "Party Overview",
      <View style={s.overviewGrid}>
        {allRows.map((row, i) => {
          const [key, ...rest] = row.split(":");
          const value = rest.join(":").trim();
          if (!value) return null;
          return (
            <View key={i} style={[s.overviewCell, { borderBottomColor: colors.border }]}>
              <Text style={[s.overviewKey, { color: colors.mutedForeground }]}>{key?.trim()}</Text>
              <Text style={[s.overviewVal, { color: colors.foreground }]}>{value}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  // Menu (tabbed)
  function renderMenuCard(sections: Record<string, string>) {
    const availableTabs = MENU_TABS.filter((t) => sections[t]);
    const activeText    = sections[menuTab] ?? "";
    const tabAccent     = SECTION_ACCENT[menuTab] ?? colors.primary;

    function renderMenuItems(text: string) {
      return text.split("\n").filter(Boolean).map((line, i) => {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 2) {
          const name      = (parts[0] ?? "").replace(/\*\*/g, "").trim();
          const reason    = parts[1] ?? "";
          const qty       = parts[2] ?? "";
          const rawCost   = parts[3] ?? "";
          const costMatch = rawCost.match(/SGD\s*\$?([\d.,]+)/i);
          const cost      = costMatch ? `SGD $${costMatch[1]}` : rawCost.replace(/Estimated Cost:\s*/i, "");
          return (
            <View key={i} style={[s.menuRow, { borderBottomColor: colors.border, borderLeftColor: tabAccent }]}>
              <Text style={[s.menuName,   { color: colors.foreground }]}>{name}</Text>
              {reason ? <Text style={[s.menuReason, { color: colors.mutedForeground }]}>{reason}</Text> : null}
              <View style={s.menuMeta}>
                {qty  ? <Text style={[s.menuQty, { color: colors.mutedForeground }]}>{qty}</Text> : null}
                {cost ? (
                  <View style={[s.menuCostBadge, { backgroundColor: tabAccent + "18" }]}>
                    <Text style={[s.menuCost, { color: tabAccent }]}>{cost}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }
        return <Text key={i} style={[s.menuPlain, { color: colors.foreground }]}>{line}</Text>;
      });
    }

    return planCard("MAINS", "🍽️", "Recommended Menu",
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll}>
          {availableTabs.map((tab) => {
            const tabActive = menuTab === tab;
            const accent    = SECTION_ACCENT[tab] ?? colors.primary;
            return (
              <TouchableOpacity key={tab} activeOpacity={0.75}
                style={[s.tab, {
                  backgroundColor: tabActive ? accent : colors.muted,
                  borderColor:     tabActive ? accent : "transparent",
                }]}
                onPress={() => { setMenuTab(tab); Haptics.selectionAsync(); }}
              >
                <Text style={[s.tabText, { color: tabActive ? "#fff" : colors.mutedForeground }]}>
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ marginTop: 4 }}>{renderMenuItems(activeText)}</View>
      </>
    );
  }

  // Shopping List
  function renderShoppingCard(text: string) {
    const CATEGORIES = ["Produce","Protein","Bakery","Dairy","Frozen","Beverages","Miscellaneous"];
    const lines = text.split("\n").filter(Boolean);
    const grouped: Record<string, string[]> = {};
    let current = "Miscellaneous";
    for (const line of lines) {
      const catMatch = CATEGORIES.find((c) => line.startsWith(c + ":"));
      if (catMatch) {
        current = catMatch;
        const rest = line.replace(catMatch + ":", "").trim();
        if (rest) { if (!grouped[current]) grouped[current] = []; grouped[current].push(...rest.split(",").map((x) => x.trim()).filter(Boolean)); }
      } else if (line.startsWith("-") || line.startsWith("•")) {
        if (!grouped[current]) grouped[current] = [];
        grouped[current].push(line.replace(/^[-•]\s*/, "").trim());
      } else if (line.trim()) {
        if (!grouped[current]) grouped[current] = [];
        grouped[current].push(line.trim());
      }
    }
    return planCard("SHOPPING LIST", "🛒", "Shopping List",
      <>
        {Object.entries(grouped).map(([cat, items]) => {
          if (!items.length) return null;
          const allChecked = items.every((item) => checkedItems[`${cat}:${item}`]);
          return (
            <View key={cat} style={s.shopCat}>
              <View style={[s.shopCatHeader, { borderBottomColor: colors.border }]}>
                <Text style={[s.shopCatTitle, { color: allChecked ? colors.secondary : colors.foreground }]}>{cat}</Text>
                {allChecked && <Feather name="check-circle" size={14} color={colors.secondary} />}
              </View>
              {items.map((item) => {
                const key     = `${cat}:${item}`;
                const checked = !!checkedItems[key];
                return (
                  <TouchableOpacity key={key} style={s.shopRow} onPress={() => toggleCheck(key)} activeOpacity={0.7}>
                    <View style={[s.shopCheck, {
                      backgroundColor: checked ? colors.secondary : "transparent",
                      borderColor:     checked ? colors.secondary : colors.border,
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

  // Budget Breakdown
  function renderBudgetCard(text: string, meta: PlanMeta) {
    const lines        = text.split("\n").filter(Boolean);
    const budgetCeiling = meta.budget;
    let totalLine: string | null = null;
    let remainingLine: string | null = null;
    const rows: { label: string; amount: number }[] = [];
    for (const line of lines) {
      const match = line.match(/^(.+?):\s*SGD\s*\$?([\d.,]+)/i);
      if (!match) continue;
      const label  = match[1].trim().replace(/\*\*/g, "");
      const amount = parseFloat(match[2].replace(",", ""));
      if (label.toLowerCase().includes("total"))     { totalLine     = line; continue; }
      if (label.toLowerCase().includes("remaining")) { remainingLine = line; continue; }
      rows.push({ label, amount });
    }
    function parseAmt(line: string | null) {
      if (!line) return 0;
      const m = line.match(/SGD\s*\$?([\d.,]+)/i);
      return m ? parseFloat(m[1].replace(",", "")) : 0;
    }
    const total     = parseAmt(totalLine);
    const remaining = parseAmt(remainingLine);
    const overBudget = remaining < 0;
    return planCard("BUDGET BREAKDOWN", "💰", "Budget Breakdown",
      <>
        {rows.map(({ label, amount }) => {
          const pct      = Math.min((amount / budgetCeiling) * 100, 100);
          const barColor = BUDGET_BAR_COLORS[label] ?? colors.primary;
          return (
            <View key={label} style={s.budgetBarRow}>
              <View style={s.budgetLabelRow}>
                <View style={[s.budgetDot, { backgroundColor: barColor }]} />
                <Text style={[s.budgetLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[s.budgetAmt,   { color: barColor }]}>SGD ${amount.toFixed(2)}</Text>
              </View>
              <View style={[s.budgetBarBg, { backgroundColor: colors.muted }]}>
                <View style={[s.budgetBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })}
        <View style={[s.budgetSummary, { borderTopColor: colors.border }]}>
          <View style={s.budgetSumRow}>
            <Text style={[s.budgetSumLabel, { color: colors.foreground }]}>Total Estimated Spend</Text>
            <Text style={[s.budgetSumAmt,   { color: colors.foreground, fontWeight: "700" }]}>SGD ${total.toFixed(2)}</Text>
          </View>
          <View style={s.budgetSumRow}>
            <Text style={[s.budgetSumLabel, { color: overBudget ? colors.danger : colors.secondary }]}>
              {overBudget ? "Over Budget" : "Remaining Budget"}
            </Text>
            <Text style={[s.budgetSumAmt, { color: overBudget ? colors.danger : colors.secondary, fontWeight: "700" }]}>
              SGD ${Math.abs(remaining).toFixed(2)}
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Preparation Timeline
  function renderTimelineCard(text: string) {
    const lines = text.split("\n").filter((l) => l.trim() && l.match(/\d{1,2}:\d{2}/));
    return planCard("PREPARATION TIMELINE", "⏰", "Preparation Timeline",
      <>
        {lines.map((line, i) => {
          const match  = line.match(/^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/);
          const time   = match ? match[1] : "";
          const action = match ? match[2] : line.trim();
          const isLast = i === lines.length - 1;
          return (
            <View key={i} style={s.timelineRow}>
              <View style={s.timelineDotCol}>
                <View style={[
                  s.timelineDot,
                  isLast
                    ? { backgroundColor: colors.secondary, width: 14, height: 14, borderRadius: 7 }
                    : { backgroundColor: SECTION_ACCENT["PREPARATION TIMELINE"] },
                ]} />
                {!isLast && <View style={[s.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={s.timelineContent}>
                {time ? <Text style={[s.timelineTime, { color: SECTION_ACCENT["PREPARATION TIMELINE"] }]}>{time}</Text> : null}
                <Text style={[s.timelineAction, {
                  color:      isLast ? colors.secondary : colors.foreground,
                  fontWeight: isLast ? "700" : "400",
                }]}>{action}</Text>
              </View>
            </View>
          );
        })}
      </>
    );
  }

  // Host Tips
  function renderTipsCard(text: string) {
    const accent = SECTION_ACCENT["HOST TIPS"] ?? colors.primary;
    return planCard("HOST TIPS", "💡", "Host Tips",
      <>
        {text.split("\n").filter(Boolean).map((line, i) => (
          <View key={i} style={s.tipRow}>
            <View style={[s.tipBullet, { backgroundColor: accent }]} />
            <Text style={[s.tipText, { color: colors.foreground }]}>{line.replace(/^[-•*]\s*/, "")}</Text>
          </View>
        ))}
      </>
    );
  }

  // Validation Checklist
  function renderChecklistCard(text: string) {
    return planCard("VALIDATION CHECKLIST", "✅", "Dietary Validation",
      <>
        {text.split("\n").filter(Boolean).map((line, i) => (
          <View key={i} style={[s.checklistRow, { borderBottomColor: colors.border }]}>
            <Feather name="check-circle" size={16} color={colors.secondary} />
            <Text style={[s.checklistText, { color: colors.foreground }]}>
              {line.replace(/^✓\s*/, "").replace(/\*\*/g, "")}
            </Text>
          </View>
        ))}
      </>
    );
  }

  // Full plan
  function renderPlan() {
    if (!planSections) return null;
    return (
      <View>
        {/* Inline back row — replaces the removed header on plan screen */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={[s.planBackRow, { borderBottomColor: colors.border }]}
          onPress={() => { setAppState("wizard"); setWizardStep(1); }}
        >
          <Feather name="arrow-left" size={15} color={colors.mutedForeground} />
          <Text style={[s.planBackText, { color: colors.mutedForeground }]}>Edit setup</Text>
        </TouchableOpacity>

        {restrictionWarning && (
          <View style={[s.warnBanner, { backgroundColor: "#FFF8E1", borderColor: "#F9A825" }]}>
            <Feather name="alert-triangle" size={16} color="#F9A825" />
            <Text style={s.warnText}>
              Some items may need review. Please check the Dietary Validation section below.
            </Text>
          </View>
        )}

        {planSections["PARTY OVERVIEW"]      ? renderOverviewCard(planSections["PARTY OVERVIEW"])           : null}
        {renderMenuCard(planSections)}
        {planSections["SHOPPING LIST"]       ? renderShoppingCard(planSections["SHOPPING LIST"])            : null}
        {planSections["BUDGET BREAKDOWN"] && planMeta
          ? renderBudgetCard(planSections["BUDGET BREAKDOWN"], planMeta) : null}
        {planSections["PREPARATION TIMELINE"]? renderTimelineCard(planSections["PREPARATION TIMELINE"])    : null}
        {planSections["HOST TIPS"]           ? renderTipsCard(planSections["HOST TIPS"])                    : null}
        {planSections["VALIDATION CHECKLIST"]? renderChecklistCard(planSections["VALIDATION CHECKLIST"])   : null}

        <View style={s.planActions}>
          <TouchableOpacity activeOpacity={0.8}
            style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: regenLoading ? 0.7 : 1 }]}
            onPress={() => submitPlan(true)} disabled={regenLoading}
          >
            {regenLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="refresh-cw" size={16} color="#fff" />}
            <Text style={s.primaryBtnText}>{regenLoading ? "Regenerating…" : "Regenerate Plan"}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8}
            style={[s.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => { setAppState("wizard"); setWizardStep(1); }}
          >
            <Feather name="edit-2" size={15} color={colors.foreground} />
            <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>Edit Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER — headerless layout
  // ────────────────────────────────────────────────────────────────────────────
  const contentMaxWidth = isWide ? (appState === "plan" ? 800 : 600) : undefined;
  const cwStyle = contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: "center" as const, width: "100%" as const } : {};

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>

      {/* ── Wizard: inline top bar with safe-area padding baked in ── */}
      {appState === "wizard" && renderWizardTopBar()}

      {/* ── Non-wizard: just consume the safe-area space ── */}
      {appState !== "wizard" && <View style={{ height: insets.top }} />}

      {/* ── Single shared scroll view ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          appState === "wizard" ? s.wizardScrollContent : s.planScrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + (appState === "wizard" ? 0 : 32) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.centerWrap, cwStyle]}>
          {appState === "wizard"  && renderStep()}
          {appState === "loading" && renderLoading()}
          {appState === "error"   && renderError()}
          {appState === "plan"    && renderPlan()}
        </View>
      </ScrollView>

      {/* ── Wizard: sticky footer with error + forward CTA ── */}
      {appState === "wizard" && (
        <View style={[s.wizFooter, {
          backgroundColor: colors.background,
          borderTopColor:  colors.border,
          paddingBottom:   Math.max(insets.bottom, 20),
        }]}>
          {stepError ? (
            <Text style={[s.stepError, { color: colors.danger }]}>{stepError}</Text>
          ) : null}
          {wizardStep < totalSteps ? (
            <TouchableOpacity activeOpacity={0.8}
              style={[s.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={goNext}
            >
              <Text style={s.primaryBtnText}>Continue</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity activeOpacity={0.8}
              style={[s.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => submitPlan()}
            >
              <Text style={s.primaryBtnText}>Generate My Plan</Text>
              <Text style={{ fontSize: 18 }}>🎉</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Wizard top bar (replaces header) ──────────────────────────────────────
  wizTopBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  wizTopBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  wizTopDots: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44 },
  dot: { borderRadius: 4 },

  // ── Wizard sticky footer ────────────────────────────────────────────────
  wizFooter: {
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, gap: 8,
  },

  // ── Scroll areas ─────────────────────────────────────────────────────────
  wizardScrollContent: { paddingHorizontal: 20, paddingTop: 8,  paddingBottom: 16 },
  planScrollContent:   { paddingHorizontal: 16, paddingTop: 4,  paddingBottom: 32 },
  centerWrap: { gap: 16 },

  // ── Step label ───────────────────────────────────────────────────────────
  stepLabelWrap: { marginBottom: 24, gap: 6 },
  stepEmoji: { fontSize: 44, marginBottom: 4 },
  stepTitle: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  stepHint:  { fontSize: 14, lineHeight: 20, marginTop: -16, marginBottom: 12 },
  stepError: { fontSize: 13, fontWeight: "600" },

  // ── Occasion grid ────────────────────────────────────────────────────────
  occasionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  occasionCard: { width: "47%", aspectRatio: 1.2, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1.5, gap: 10, minHeight: 44 },
  occasionLabel: { fontSize: 13, fontWeight: "700", textAlign: "center" },

  // ── Guest counter ────────────────────────────────────────────────────────
  counterCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, borderWidth: 1.5, padding: 20 },
  counterBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  counterNumWrap: { alignItems: "center" },
  counterNum: { fontSize: 52, fontWeight: "800", lineHeight: 56, minWidth: 80, textAlign: "center" },
  counterNumLabel: { fontSize: 13, fontWeight: "500", marginTop: -4 },
  quickAddRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  quickAddBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, minHeight: 40 },
  quickAddText: { fontSize: 14, fontWeight: "700" },

  // ── Budget ───────────────────────────────────────────────────────────────
  budgetInputRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
  budgetPrefix: { fontSize: 22, fontWeight: "700" },
  budgetInput: { flex: 1, fontSize: 22, fontWeight: "600" },
  presetRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  presetBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, minHeight: 40 },
  presetText: { fontSize: 14, fontWeight: "700" },

  // ── Serving style ────────────────────────────────────────────────────────
  servingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servingCard: { width: "47%", alignItems: "center", paddingVertical: 22, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, gap: 8, minHeight: 44 },
  servingLabel: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  servingDesc:  { fontSize: 12, textAlign: "center", lineHeight: 16 },

  // ── Restrictions ─────────────────────────────────────────────────────────
  restrictionList: { gap: 8 },
  restrictionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 12, minHeight: 52 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  restrictionLabel: { fontSize: 15, fontWeight: "600", flex: 1 },

  // ── Time chips ───────────────────────────────────────────────────────────
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  timeChip: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11, minWidth: "22%" },
  timeChipText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  // ── Preferences ──────────────────────────────────────────────────────────
  prefInput: { borderRadius: 14, borderWidth: 1.5, padding: 16, fontSize: 15, minHeight: 110, textAlignVertical: "top", lineHeight: 22 },

  // ── Shared buttons ───────────────────────────────────────────────────────
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, borderRadius: 100, minHeight: 54, gap: 8 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 100, borderWidth: 1.5, minHeight: 54 },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 6 },
  loadingEmoji: { fontSize: 60, marginBottom: 8 },
  loadingAppName: { fontSize: 24, fontWeight: "800" },
  loadingTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 8 },
  loadingSub:   { fontSize: 15, textAlign: "center" },

  // ── Error ────────────────────────────────────────────────────────────────
  errorWrap: { alignItems: "center", padding: 32, borderRadius: 20, borderWidth: 1, gap: 12, marginTop: 32 },
  errorTitle: { fontSize: 20, fontWeight: "700" },
  errorMsg:   { fontSize: 14, textAlign: "center", lineHeight: 20 },

  // ── Plan back row ────────────────────────────────────────────────────────
  planBackRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 14, marginBottom: 8,
    borderBottomWidth: 1,
  },
  planBackText: { fontSize: 14, fontWeight: "500" },

  // ── Plan cards ───────────────────────────────────────────────────────────
  planCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  planCardHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 15, gap: 10 },
  planCardHeaderEmoji: { fontSize: 22 },
  planCardHeaderTitle: { fontSize: 17, fontWeight: "800", color: "#fff", flex: 1 },
  planCardBody: { padding: 16, gap: 10 },

  // ── Overview ─────────────────────────────────────────────────────────────
  overviewGrid: { gap: 0 },
  overviewCell: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 11, borderBottomWidth: 1, gap: 12 },
  overviewKey: { fontSize: 13, fontWeight: "600", flex: 1 },
  overviewVal: { fontSize: 13, fontWeight: "700", flex: 2, textAlign: "right" },

  // ── Menu tabs ────────────────────────────────────────────────────────────
  tabScroll: { marginHorizontal: -4, marginBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, marginHorizontal: 4, minHeight: 38, justifyContent: "center" },
  tabText: { fontSize: 13, fontWeight: "700" },
  menuRow: { paddingVertical: 14, borderBottomWidth: 1, borderLeftWidth: 3, paddingLeft: 12, gap: 4 },
  menuName:   { fontSize: 15, fontWeight: "700" },
  menuReason: { fontSize: 13, lineHeight: 18 },
  menuMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  menuQty:  { fontSize: 13, fontWeight: "500" },
  menuCostBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  menuCost: { fontSize: 13, fontWeight: "700" },
  menuPlain: { fontSize: 14, paddingVertical: 8, lineHeight: 20 },

  // ── Shopping ─────────────────────────────────────────────────────────────
  shopCat: { marginBottom: 14 },
  shopCatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 6, borderBottomWidth: 1, marginBottom: 6 },
  shopCatTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, minHeight: 44 },
  shopCheck: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  shopItem: { fontSize: 14, flex: 1, lineHeight: 20 },

  // ── Budget bars ──────────────────────────────────────────────────────────
  budgetBarRow: { gap: 7, marginBottom: 10 },
  budgetLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetDot: { width: 8, height: 8, borderRadius: 4 },
  budgetLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
  budgetAmt:   { fontSize: 14, fontWeight: "700" },
  budgetBarBg:   { height: 10, borderRadius: 5, overflow: "hidden" },
  budgetBarFill: { height: 10, borderRadius: 5 },
  budgetSummary: { borderTopWidth: 1, paddingTop: 14, marginTop: 4, gap: 8 },
  budgetSumRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetSumLabel: { fontSize: 14, fontWeight: "600" },
  budgetSumAmt:   { fontSize: 15 },

  // ── Timeline ─────────────────────────────────────────────────────────────
  timelineRow: { flexDirection: "row", gap: 14, minHeight: 44 },
  timelineDotCol: { alignItems: "center", width: 18 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 18, gap: 3 },
  timelineTime:   { fontSize: 14, fontWeight: "800" },
  timelineAction: { fontSize: 14, lineHeight: 20 },

  // ── Host tips ────────────────────────────────────────────────────────────
  tipRow: { flexDirection: "row", gap: 12, paddingVertical: 6, alignItems: "flex-start" },
  tipBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 21 },

  // ── Validation checklist ─────────────────────────────────────────────────
  checklistRow: { flexDirection: "row", gap: 10, paddingVertical: 9, borderBottomWidth: 1, alignItems: "flex-start" },
  checklistText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // ── Warning banner ───────────────────────────────────────────────────────
  warnBanner: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: "flex-start" },
  warnText: { flex: 1, fontSize: 13, color: "#E65100", lineHeight: 18 },

  // ── Plan actions ─────────────────────────────────────────────────────────
  planActions: { gap: 10, marginTop: 8 },
});
