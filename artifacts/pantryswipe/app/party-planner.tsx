import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

// ── C palette (inline) ─────────────────────────────────────────────────────
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
  saveBlue:           "#5B8EF5",
  danger:             "#E84040",
} as const;

const cardShadow = Platform.select({
  ios:     { shadowColor: "rgba(131,85,0,1)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
  android: { elevation: 4 },
  web:     { boxShadow: "0 4px 16px rgba(131,85,0,0.08)" },
}) as object;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 3) / 2;

// ── API base ───────────────────────────────────────────────────────────────
const API_BASE =
  Platform.OS !== "web"
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? process.env.EXPO_PUBLIC_API_DOMAIN ?? "793ecd86-87bd-45bf-a997-455057de1a61-00-14m4lfwa4iiar.pike.replit.dev"}`
    : "";

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Constants ──────────────────────────────────────────────────────────────
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

const SERVING_STYLE_META: Record<string, { bg: string; iconColor: string; feather: "coffee" | "grid" | "scissors" | "users" }> = {
  Buffet:         { bg: C.primary,                   iconColor: "#FFFFFF",  feather: "coffee"   },
  "Finger Food":  { bg: C.secondary,                 iconColor: "#FFFFFF",  feather: "grid"     },
  Plated:         { bg: C.saveBlue,                  iconColor: "#FFFFFF",  feather: "scissors" },
  "Family Style": { bg: "rgba(245,166,35,0.2)",      iconColor: C.primary,  feather: "users"    },
};

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

// ── Time slots ─────────────────────────────────────────────────────────────
function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let h = 10; h <= 23; h++) {
    for (const m of [0, 30]) {
      const period  = h < 12 ? "AM" : "PM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label   = `${displayH}:${m === 0 ? "00" : "30"} ${period}`;
      const value   = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
      slots.push({ label, value });
    }
  }
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

// ── Plan parser ────────────────────────────────────────────────────────────
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

// ── Restriction audit ──────────────────────────────────────────────────────
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
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  // ── Wizard state ──────────────────────────────────────────────────────────
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
  const [budgetFocused,      setBudgetFocused]      = useState(false);

  const totalSteps = 7;
  const isWide     = width > 600;

  // ── Animation refs ────────────────────────────────────────────────────────
  const progressAnim  = useRef(new Animated.Value((1 / totalSteps) * 100)).current;
  const inputScale    = useSharedValue(1);
  const countScale    = useSharedValue(1);
  const inputAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: inputScale.value }] }));
  const countAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: countScale.value }] }));

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (wizardStep / totalSteps) * 100,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [wizardStep]);

  useEffect(() => {
    countScale.value = withSpring(1.18, { damping: 5 }, () => {
      countScale.value = withSpring(1.0);
    });
  }, [form.guestCount]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep(): boolean {
    setStepError("");
    switch (wizardStep) {
      case 1: if (!form.occasion)                              { setStepError("Please select an occasion.");                       return false; } break;
      case 2: if (form.guestCount < 1 || form.guestCount > 99) { setStepError("Guest count must be between 1 and 99.");           return false; } break;
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

  // ── API call ──────────────────────────────────────────────────────────────
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

  // ── Progress percent ───────────────────────────────────────────────────────
  const pct = Math.round((wizardStep / totalSteps) * 100);

  // ── Wizard top bar ─────────────────────────────────────────────────────────
  function renderWizardTopBar() {
    return (
      <View style={[s.wizTopBar, { paddingTop: insets.top + 10, backgroundColor: C.background }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={s.wizTopBtn}
          onPress={wizardStep > 1 ? goBack : () => router.back()}
        >
          <Feather
            name={wizardStep > 1 ? "arrow-left" : "x"}
            size={22}
            color={C.textMuted}
          />
        </TouchableOpacity>

        {/* Animated progress bar */}
        <View style={s.progressTrack}>
          <Animated.View
            style={[
              s.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>

        {/* Spacer keeps bar centred */}
        <View style={{ width: 44 }} />
      </View>
    );
  }

  // ── Step label ─────────────────────────────────────────────────────────────
  function renderStepLabel(label: string) {
    return (
      <View style={s.stepLabelWrap}>
        <View style={s.stepMetaRow}>
          <Text style={s.stepCounter}>STEP {wizardStep} OF {totalSteps}</Text>
          <Text style={s.stepPercent}>{pct}% COMPLETE</Text>
        </View>
        <Text style={s.stepTitle}>{label}</Text>
        {STEP_META[wizardStep - 1]?.hint ? (
          <Text style={s.stepHint}>{STEP_META[wizardStep - 1]?.hint}</Text>
        ) : null}
      </View>
    );
  }

  // ── Step router ────────────────────────────────────────────────────────────
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

  // ── Step 1: Occasion ───────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <View>
        {renderStepLabel("What's the occasion?")}

        {/* Compact occasion strip */}
        <View style={s.occasionStrip}>
          <View>
            <Text style={s.occasionStripCount}>8 occasions</Text>
            <Text style={s.occasionStripSub}>Tap one to get started</Text>
          </View>
          <View style={s.occasionStripEmojis}>
            {["🎂","🍽️","☀️","🎬"].map((e, i) => (
              <View key={i} style={s.occasionStripBubble}>
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.occasionGrid}>
          {OCCASIONS.map((o, index) => {
            const active = form.occasion === o.label;
            return (
              <Reanimated.View
                key={o.label}
                entering={FadeInDown.delay(index * 80).springify()}
                style={[s.occasionCardWrap, cardShadow]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[s.occasionCard, active ? s.occasionCardActive : s.occasionCardInactive]}
                  onPress={() => {
                    setForm((f) => ({ ...f, occasion: o.label }));
                    setStepError("");
                    Haptics.selectionAsync();
                  }}
                >
                  <View style={[s.occasionIconCircle, active ? s.occasionIconActive : s.occasionIconInactive]}>
                    <Feather name={o.icon} size={28} color={active ? "#FFFFFF" : "#633F00"} />
                  </View>
                  <Text style={[s.occasionLabel, active && s.occasionLabelActive]} numberOfLines={2}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              </Reanimated.View>
            );
          })}
        </View>
      </View>
    );
  }

  // ── Step 2: Guest count ────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <View>
        {renderStepLabel("Who's coming?")}

        {/* Hero */}
        <LinearGradient
          colors={[C.surfaceHigh, C.surfaceLow]}
          style={[s.heroPlaceholder, { height: 200, marginBottom: 32 }]}
        >
          <Feather name="users" size={48} color={C.primary} />
          <Text style={s.heroPlaceholderText}>Guest count</Text>
        </LinearGradient>

        {/* Stepper */}
        <View style={s.counterRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.counterRoundBtn, s.counterBtnMinus, form.guestCount <= 1 && s.counterBtnDisabled]}
            onPress={() => form.guestCount > 1 && setForm((f) => ({ ...f, guestCount: f.guestCount - 1 }))}
          >
            <Feather name="minus" size={28} color={form.guestCount <= 1 ? C.textMuted : C.primary} />
          </TouchableOpacity>

          <View style={s.counterCenter}>
            <Reanimated.View style={countAnimStyle}>
              <Text style={s.counterNum}>{form.guestCount}</Text>
            </Reanimated.View>
            <Text style={s.counterNumLabel}>GUESTS</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.counterRoundBtn, s.counterBtnPlus, form.guestCount >= 99 && s.counterBtnDisabled]}
            onPress={() => form.guestCount < 99 && setForm((f) => ({ ...f, guestCount: f.guestCount + 1 }))}
          >
            <Feather name="plus" size={28} color={form.guestCount >= 99 ? C.textMuted : "#FFFFFF"} />
          </TouchableOpacity>
        </View>

        {/* Quick add chips */}
        <View style={s.quickAddRow}>
          {GUEST_QUICK_ADD.map((n) => (
            <TouchableOpacity
              key={n}
              activeOpacity={0.75}
              style={s.quickAddBtn}
              onPress={() => { setForm((f) => ({ ...f, guestCount: Math.min(f.guestCount + n, 99) })); Haptics.selectionAsync(); }}
            >
              <Text style={s.quickAddText}>+{n}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            activeOpacity={0.75}
            style={s.quickAddBtn}
            onPress={() => { setForm((f) => ({ ...f, guestCount: 10 })); Haptics.selectionAsync(); }}
          >
            <Text style={[s.quickAddText, { color: C.textMuted }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Capacity note */}
        {form.guestCount > 8 && (
          <View style={s.capacityNote}>
            <Feather name="info" size={18} color={C.secondary} />
            <Text style={s.capacityNoteText}>
              For {form.guestCount}+ guests, consider a buffet or family-style setup for easier service.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Step 3: Budget ─────────────────────────────────────────────────────────
  function renderStep3() {
    const perGuest = form.guestCount > 0 && form.budget > 0
      ? (form.budget / form.guestCount).toFixed(2)
      : "0.00";

    return (
      <View>
        {renderStepLabel("What's your budget?")}

        {/* Hero with guest chip */}
        <View style={s.budgetHero}>
          <LinearGradient colors={[C.surfaceHigh, C.surfaceLow]} style={StyleSheet.absoluteFillObject} />
          <View style={s.budgetHeroChip}>
            <Text style={s.budgetHeroChipText}>Planning for {form.guestCount} Guests</Text>
          </View>
        </View>

        {/* Input card with focus animation */}
        <Reanimated.View style={[s.budgetCard, budgetFocused && s.budgetCardFocused, cardShadow, inputAnimStyle]}>
          <Text style={s.budgetInputLabel}>ENTER AMOUNT</Text>
          <View style={s.budgetAmountRow}>
            <Text style={s.budgetCurrencyPrefix}>$</Text>
            <TextInput
              style={s.budgetInput}
              value={budgetText}
              onChangeText={(v) => {
                setBudgetText(v);
                const n = parseFloat(v);
                if (!isNaN(n) && n > 0) { setForm((f) => ({ ...f, budget: n })); setStepError(""); }
                else setForm((f) => ({ ...f, budget: 0 }));
              }}
              placeholder="500"
              placeholderTextColor={C.outlineVariant}
              keyboardType="decimal-pad"
              onFocus={() => { setBudgetFocused(true); inputScale.value = withSpring(1.02); }}
              onBlur={() => { setBudgetFocused(false); inputScale.value = withSpring(1.0); }}
            />
          </View>
        </Reanimated.View>

        {/* Preset chips */}
        <View style={s.presetRow}>
          {BUDGET_PRESETS.map((amt) => {
            const active = form.budget === amt;
            return (
              <TouchableOpacity
                key={amt}
                activeOpacity={0.75}
                style={[s.presetChip, active ? s.presetChipActive : s.presetChipInactive]}
                onPress={() => {
                  setBudgetText(String(amt));
                  setForm((f) => ({ ...f, budget: amt }));
                  setStepError("");
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[s.presetChipText, active && s.presetChipTextActive]}>${amt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Per-guest summary */}
        <View style={s.perGuestRow}>
          <View>
            <Text style={s.perGuestLabel}>ESTIMATED PER GUEST</Text>
            <Text style={s.perGuestValue}>${perGuest}</Text>
          </View>
          <TouchableOpacity style={s.perGuestNextBtn} onPress={goNext} activeOpacity={0.8}>
            <Text style={s.perGuestNextText}>Next Step</Text>
            <Feather name="arrow-right" size={14} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step 4: Serving style ──────────────────────────────────────────────────
  function renderStep4() {
    return (
      <View>
        {renderStepLabel("How will you serve food?")}
        <View style={s.servingGrid}>
          {SERVING_STYLES.map((style) => {
            const active = form.servingStyle === style.label;
            const meta   = SERVING_STYLE_META[style.label];
            return (
              <TouchableOpacity
                key={style.label}
                activeOpacity={0.8}
                style={[s.servingCard, active ? s.servingCardActive : s.servingCardInactive, cardShadow]}
                onPress={() => {
                  setForm((f) => ({ ...f, servingStyle: style.label }));
                  setStepError("");
                  Haptics.selectionAsync();
                }}
              >
                <View style={[s.servingIconSquare, { backgroundColor: meta?.bg ?? C.primary }]}>
                  <Feather name={meta?.feather ?? style.icon} size={22} color={meta?.iconColor ?? "#FFFFFF"} />
                </View>
                <Text style={[s.servingLabel, active && s.servingLabelActive]}>{style.label}</Text>
                <Text style={s.servingDesc}>{style.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // ── Step 5: Dietary restrictions ───────────────────────────────────────────
  function renderStep5() {
    return (
      <View>
        {renderStepLabel("Any dietary restrictions?")}
        <Text style={s.stepSubHint}>Select all that apply</Text>
        <View style={s.restrictionList}>
          {RESTRICTIONS.map((tag) => {
            const active = form.restrictions.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                activeOpacity={0.75}
                style={[s.restrictionRow, active ? s.restrictionRowActive : s.restrictionRowInactive]}
                onPress={() => { toggleRestriction(tag); Haptics.selectionAsync(); }}
              >
                <View style={[s.restrictionIconCircle]}>
                  <Feather name="check" size={16} color={active ? C.secondary : C.outlineVariant} />
                </View>
                <Text style={[s.restrictionLabel, active && s.restrictionLabelActive]}>{tag}</Text>
                {active && <Feather name="check-circle" size={20} color={C.secondary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Pro tip */}
        <View style={s.proTipCard}>
          <Feather name="info" size={18} color={C.secondary} />
          <Text style={s.proTipText}>
            Tip: Select "None" if your guests have no dietary requirements. The AI will plan a varied menu.
          </Text>
        </View>
      </View>
    );
  }

  // ── Step 6: Arrival time ───────────────────────────────────────────────────
  function renderStep6() {
    return (
      <View>
        {renderStepLabel("When are guests arriving?")}
        <Text style={s.stepSubHint}>Tap a time — used to build your prep timeline</Text>
        <View style={s.timeGrid}>
          {TIME_SLOTS.map((slot) => {
            const selected = form.arrivalTime === slot.value;
            return (
              <TouchableOpacity
                key={slot.value}
                activeOpacity={0.75}
                onPress={() => { setForm((f) => ({ ...f, arrivalTime: slot.value })); setStepError(""); Haptics.selectionAsync(); }}
                style={[s.timeChip, selected ? s.timeChipActive : s.timeChipInactive]}
              >
                <Text style={[s.timeChipText, selected ? s.timeChipTextActive : s.timeChipTextInactive]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // ── Step 7: Additional preferences ────────────────────────────────────────
  function renderStep7() {
    return (
      <View>
        {renderStepLabel("Anything else to know?")}
        <Text style={s.stepSubHint}>Optional — kids attending, favourite dishes, spice level…</Text>
        <TextInput
          style={s.prefInput}
          value={form.additionalPreferences}
          onChangeText={(v) => setForm((f) => ({ ...f, additionalPreferences: v }))}
          placeholder="e.g. Kids attending, guests love spicy food, thinking of a cheese platter"
          placeholderTextColor={C.textMuted}
          multiline
          numberOfLines={4}
        />
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  function renderLoading() {
    return (
      <View style={s.loadingWrap}>
        <LinearGradient
          colors={[C.surfaceHigh, C.surfaceLow]}
          style={s.loadingHero}
        >
          <Text style={s.loadingEmoji}>🎉</Text>
        </LinearGradient>
        <Text style={s.loadingAppName}>PantrySwipe AI</Text>
        <ActivityIndicator size="large" color={C.primary} style={{ marginVertical: 20 }} />
        <Text style={s.loadingTitle}>Crafting your perfect party plan…</Text>
        <Text style={s.loadingSub}>Personalised just for you ✨</Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  function renderError() {
    return (
      <View style={s.errorWrap}>
        <Feather name="alert-circle" size={48} color={C.danger} />
        <Text style={s.errorTitle}>Something went wrong.</Text>
        <Text style={s.errorMsg}>{errorMessage}</Text>
        <TouchableOpacity activeOpacity={0.8} style={s.primaryBtn} onPress={() => submitPlan()}>
          <Text style={s.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          style={s.secondaryBtn}
          onPress={() => { setAppState("wizard"); setWizardStep(1); }}
        >
          <Feather name="edit-2" size={15} color={C.textPrimary} />
          <Text style={s.secondaryBtnText}>Edit Preferences</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Plan card shell ────────────────────────────────────────────────────────
  function planCard(sectionKey: string, emoji: string, title: string, children: React.ReactNode) {
    const accent = SECTION_ACCENT[sectionKey] ?? C.primary;
    return (
      <View style={[s.planCard, cardShadow]}>
        <View style={[s.planCardHeader, { backgroundColor: accent }]}>
          <Text style={s.planCardHeaderEmoji}>{emoji}</Text>
          <Text style={s.planCardHeaderTitle}>{title}</Text>
        </View>
        <View style={s.planCardBody}>{children}</View>
      </View>
    );
  }

  // ── Party Overview ─────────────────────────────────────────────────────────
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
            <View key={i} style={s.overviewCell}>
              <Text style={s.overviewKey}>{key?.trim()}</Text>
              <Text style={s.overviewVal}>{value}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  // ── Menu (tabbed) ──────────────────────────────────────────────────────────
  function renderMenuCard(sections: Record<string, string>) {
    const availableTabs = MENU_TABS.filter((t) => sections[t]);
    const activeText    = sections[menuTab] ?? "";
    const tabAccent     = SECTION_ACCENT[menuTab] ?? C.primary;

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
            <View key={i} style={[s.menuRow, { borderLeftColor: tabAccent }]}>
              <Text style={s.menuName}>{name}</Text>
              {reason ? <Text style={s.menuReason}>{reason}</Text> : null}
              <View style={s.menuMeta}>
                {qty  ? <Text style={s.menuQty}>{qty}</Text> : null}
                {cost ? (
                  <View style={[s.menuCostBadge, { backgroundColor: tabAccent + "18" }]}>
                    <Text style={[s.menuCost, { color: tabAccent }]}>{cost}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }
        return <Text key={i} style={s.menuPlain}>{line}</Text>;
      });
    }

    return planCard("MAINS", "🍽️", "Recommended Menu",
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll}>
          {availableTabs.map((tab) => {
            const tabActive = menuTab === tab;
            const accent    = SECTION_ACCENT[tab] ?? C.primary;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.75}
                style={[s.tab, { backgroundColor: tabActive ? accent : C.surfaceHighest, borderColor: tabActive ? accent : "transparent" }]}
                onPress={() => { setMenuTab(tab); Haptics.selectionAsync(); }}
              >
                <Text style={[s.tabText, { color: tabActive ? "#fff" : C.textMuted }]}>
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

  // ── Shopping list ──────────────────────────────────────────────────────────
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
              <View style={s.shopCatHeader}>
                <Text style={[s.shopCatTitle, { color: allChecked ? C.secondary : C.textPrimary }]}>{cat}</Text>
                {allChecked && <Feather name="check-circle" size={14} color={C.secondary} />}
              </View>
              {items.map((item) => {
                const key     = `${cat}:${item}`;
                const checked = !!checkedItems[key];
                return (
                  <TouchableOpacity key={key} style={s.shopRow} onPress={() => toggleCheck(key)} activeOpacity={0.7}>
                    <Feather
                      name={checked ? "check-square" : "square"}
                      size={22}
                      color={checked ? C.secondary : C.outlineVariant}
                    />
                    <Text style={[s.shopItem, checked && s.shopItemChecked]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </>
    );
  }

  // ── Budget breakdown ───────────────────────────────────────────────────────
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
    const total      = parseAmt(totalLine);
    const remaining  = parseAmt(remainingLine);
    const overBudget = remaining < 0;
    return planCard("BUDGET BREAKDOWN", "💰", "Budget Breakdown",
      <>
        {rows.map(({ label, amount }) => {
          const pct2     = Math.min((amount / budgetCeiling) * 100, 100);
          const barColor = BUDGET_BAR_COLORS[label] ?? C.primary;
          return (
            <View key={label} style={s.budgetBarRow}>
              <View style={s.budgetLabelRow}>
                <View style={[s.budgetDot, { backgroundColor: barColor }]} />
                <Text style={s.budgetLabel}>{label}</Text>
                <Text style={[s.budgetAmt, { color: barColor }]}>SGD ${amount.toFixed(2)}</Text>
              </View>
              <View style={s.budgetBarBg}>
                <View style={[s.budgetBarFill, { width: `${pct2}%` as `${number}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })}
        <View style={s.budgetSummary}>
          <View style={s.budgetSumRow}>
            <Text style={s.budgetSumLabel}>Total Estimated Spend</Text>
            <Text style={[s.budgetSumAmt, { fontFamily: "Epilogue_700Bold" }]}>SGD ${total.toFixed(2)}</Text>
          </View>
          <View style={s.budgetSumRow}>
            <Text style={[s.budgetSumLabel, { color: overBudget ? C.danger : C.secondary }]}>
              {overBudget ? "Over Budget" : "Remaining Budget"}
            </Text>
            <Text style={[s.budgetSumAmt, { color: overBudget ? C.danger : C.secondary, fontFamily: "Epilogue_700Bold" }]}>
              SGD ${Math.abs(remaining).toFixed(2)}
            </Text>
          </View>
        </View>
      </>
    );
  }

  // ── Preparation timeline ───────────────────────────────────────────────────
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
                    ? { backgroundColor: C.secondary, width: 14, height: 14, borderRadius: 7 }
                    : { backgroundColor: SECTION_ACCENT["PREPARATION TIMELINE"] },
                ]} />
                {!isLast && <View style={s.timelineLine} />}
              </View>
              <View style={s.timelineContent}>
                {time ? <Text style={[s.timelineTime, { color: SECTION_ACCENT["PREPARATION TIMELINE"] }]}>{time}</Text> : null}
                <Text style={[s.timelineAction, isLast && { color: C.secondary, fontFamily: "Epilogue_700Bold" }]}>
                  {action}
                </Text>
              </View>
            </View>
          );
        })}
      </>
    );
  }

  // ── Host tips ──────────────────────────────────────────────────────────────
  function renderTipsCard(text: string) {
    return planCard("HOST TIPS", "💡", "Host Tips",
      <>
        {text.split("\n").filter(Boolean).map((line, i) => (
          <View key={i} style={s.tipRow}>
            <View style={s.tipBullet} />
            <Text style={s.tipText}>{line.replace(/^[-•*]\s*/, "")}</Text>
          </View>
        ))}
      </>
    );
  }

  // ── Validation checklist ───────────────────────────────────────────────────
  function renderChecklistCard(text: string) {
    return planCard("VALIDATION CHECKLIST", "✅", "Dietary Validation",
      <>
        {text.split("\n").filter(Boolean).map((line, i) => (
          <View key={i} style={s.checklistRow}>
            <Feather name="check-circle" size={16} color={C.secondary} />
            <Text style={s.checklistText}>
              {line.replace(/^✓\s*/, "").replace(/\*\*/g, "")}
            </Text>
          </View>
        ))}
      </>
    );
  }

  // ── Full plan ──────────────────────────────────────────────────────────────
  function renderPlan() {
    if (!planSections) return null;

    // Stats bento — values from form/planMeta (never hardcoded)
    const statOccasion   = planMeta?.occasion   ?? form.occasion;
    const statGuests     = planMeta?.guestCount ?? form.guestCount;
    const statBudget     = planMeta?.budget     ?? form.budget;
    const statDietary    = (planMeta?.restrictions ?? form.restrictions).filter((r) => r !== "None").join(", ") || "None";

    const STATS = [
      { icon: "star" as const,        label: "EVENT TYPE",   value: statOccasion || "—"      },
      { icon: "users" as const,       label: "GUESTS",       value: String(statGuests)        },
      { icon: "credit-card" as const, label: "BUDGET",       value: `SGD $${statBudget}`      },
      { icon: "heart" as const,       label: "DIETARY",      value: statDietary               },
    ];

    return (
      <View>
        {/* Back row */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={s.planBackRow}
          onPress={() => { setAppState("wizard"); setWizardStep(1); }}
        >
          <Feather name="arrow-left" size={15} color={C.textMuted} />
          <Text style={s.planBackText}>Edit preferences</Text>
        </TouchableOpacity>

        {/* Party badge */}
        <View style={s.partyBadge}>
          <Feather name="star" size={14} color={C.primary} />
          <Text style={s.partyBadgeText}>{statOccasion.toUpperCase() || "YOUR PARTY"}</Text>
        </View>

        <Text style={s.planHeadline}>Your Curated Celebration Plan</Text>
        <Text style={s.planSubtitle}>
          {statGuests} guests · SGD ${statBudget} budget · {form.servingStyle || "Custom"} style
        </Text>

        {/* Stats bento */}
        <View style={s.statsBento}>
          {STATS.map((stat) => (
            <View key={stat.label} style={[s.statCell, cardShadow]}>
              <Feather name={stat.icon} size={20} color={C.primary} style={{ marginBottom: 8 }} />
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statValue} numberOfLines={1}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Warning */}
        {restrictionWarning && (
          <View style={s.warnBanner}>
            <Feather name="alert-triangle" size={16} color="#F9A825" />
            <Text style={s.warnText}>
              Some items may need review. Please check the Dietary Validation section below.
            </Text>
          </View>
        )}

        {/* Plan section cards */}
        {planSections["PARTY OVERVIEW"]       ? renderOverviewCard(planSections["PARTY OVERVIEW"])                  : null}
        {renderMenuCard(planSections)}
        {planSections["SHOPPING LIST"]        ? renderShoppingCard(planSections["SHOPPING LIST"])                    : null}
        {planSections["BUDGET BREAKDOWN"] && planMeta
          ? renderBudgetCard(planSections["BUDGET BREAKDOWN"], planMeta)                                              : null}
        {planSections["PREPARATION TIMELINE"] ? renderTimelineCard(planSections["PREPARATION TIMELINE"])             : null}
        {planSections["HOST TIPS"]            ? renderTipsCard(planSections["HOST TIPS"])                             : null}
        {planSections["VALIDATION CHECKLIST"] ? renderChecklistCard(planSections["VALIDATION CHECKLIST"])            : null}

        {/* CTA buttons */}
        <View style={s.planActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.primaryBtn, { opacity: regenLoading ? 0.7 : 1 }]}
            onPress={() => submitPlan(true)}
            disabled={regenLoading}
          >
            {regenLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="refresh-cw" size={16} color="#fff" />}
            <Text style={s.primaryBtnText}>{regenLoading ? "Regenerating…" : "Regenerate Plan"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={s.secondaryBtn}
            onPress={() => { setAppState("wizard"); setWizardStep(1); }}
          >
            <Feather name="edit-2" size={15} color={C.textPrimary} />
            <Text style={s.secondaryBtnText}>Edit Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  const contentMaxWidth = isWide ? (appState === "plan" ? 800 : 600) : undefined;
  const cwStyle = contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: "center" as const, width: "100%" as const } : {};

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>

      {/* Wizard top bar (inline, safe-area baked in) */}
      {appState === "wizard" && renderWizardTopBar()}

      {/* Non-wizard: consume safe-area space */}
      {appState !== "wizard" && <View style={{ height: insets.top }} />}

      {/* Shared scroll */}
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

      {/* Wizard sticky footer */}
      {appState === "wizard" && (
        <View style={[s.wizFooter, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: C.background }]}>
          {stepError ? (
            <Text style={s.stepError}>{stepError}</Text>
          ) : null}

          <View style={s.footerBtnRow}>
            {wizardStep > 1 && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={s.backBtn}
                onPress={goBack}
              >
                <Text style={s.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            {wizardStep < totalSteps ? (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[s.primaryBtn, { flex: 1 }, !form.occasion && wizardStep === 1 && s.primaryBtnDisabled]}
                onPress={goNext}
              >
                <Text style={s.primaryBtnText}>Continue</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[s.primaryBtn, { flex: 1 }]}
                onPress={() => submitPlan()}
              >
                <Text style={s.primaryBtnText}>Generate My Plan</Text>
                <Text style={{ fontSize: 18 }}>🎉</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.stepIndicatorText}>Step {wizardStep} of {totalSteps}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
  centerWrap: { gap: 16 },

  // ── Wizard top bar ──────────────────────────────────────────────────────
  wizTopBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  wizTopBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

  // Progress bar
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EEE0D2",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#F5A623",
    ...Platform.select({
      ios:     { shadowColor: "#F5A623", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 2 },
    }),
  },

  // ── Scroll areas ────────────────────────────────────────────────────────
  wizardScrollContent: { paddingHorizontal: 20, paddingTop: 8,  paddingBottom: 16 },
  planScrollContent:   { paddingHorizontal: 16, paddingTop: 4,  paddingBottom: 32 },

  // ── Step label ──────────────────────────────────────────────────────────
  stepLabelWrap: { marginBottom: 24, gap: 6 },
  stepMetaRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  stepCounter:   { fontSize: 12, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5, color: "#F5A623", textTransform: "uppercase" },
  stepPercent:   { fontSize: 12, fontFamily: "Epilogue_400Regular", color: "#7A7570" },
  stepTitle:     { fontSize: 28, fontFamily: "Epilogue_700Bold", color: "#141210", lineHeight: 34 },
  stepHint:      { fontSize: 16, fontFamily: "Epilogue_400Regular", color: "#7A7570", lineHeight: 24 },
  stepSubHint:   { fontSize: 14, fontFamily: "Epilogue_400Regular", color: "#7A7570", lineHeight: 20, marginTop: -16, marginBottom: 12 },
  stepError:     { fontSize: 13, fontFamily: "Epilogue_700Bold", color: "#E84040" },

  // ── Hero placeholders ───────────────────────────────────────────────────
  heroPlaceholder: {
    height: 160, borderRadius: 16, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    marginTop: 24, marginBottom: 24, gap: 10,
  },
  heroPlaceholderText: { fontFamily: "Epilogue_700Bold", fontSize: 16, color: "#141210" },

  // ── Occasion strip ──────────────────────────────────────────────────────
  occasionStrip: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FFF1E4", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    marginBottom: 20,
  },
  occasionStripCount: { fontFamily: "Epilogue_700Bold", fontSize: 18, color: "#141210" },
  occasionStripSub:   { fontFamily: "Epilogue_400Regular", fontSize: 13, color: "#7A7570", marginTop: 2 },
  occasionStripEmojis:{ flexDirection: "row", gap: 6 },
  occasionStripBubble:{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },

  // ── Occasion grid ───────────────────────────────────────────────────────
  occasionGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  occasionCardWrap:     { width: "47%", borderRadius: 16 },
  occasionCard:         { width: "100%", borderRadius: 16, borderWidth: 2, padding: 20, alignItems: "center", gap: 12, minHeight: 44 },
  occasionCardActive:   { backgroundColor: "#F4E6D8", borderColor: "#F5A623" },
  occasionCardInactive: { backgroundColor: "#FFF1E4", borderColor: "transparent" },
  occasionIconCircle:   { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  occasionIconActive:   { backgroundColor: "#F5A623" },
  occasionIconInactive: { backgroundColor: "#FFDDB4" },
  occasionLabel:        { fontFamily: "Epilogue_700Bold", fontSize: 14, color: "#141210", textAlign: "center" },
  occasionLabelActive:  { color: "#141210" },

  // ── Guest counter ───────────────────────────────────────────────────────
  counterRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, marginBottom: 24 },
  counterCenter:  { alignItems: "center" },
  counterNum:     { fontFamily: "Epilogue_700Bold", fontSize: 56, color: "#F5A623", lineHeight: 64 },
  counterNumLabel:{ fontFamily: "Epilogue_700Bold", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#7A7570", marginTop: 4 },
  counterRoundBtn:{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  counterBtnMinus:{ backgroundColor: "#F4E6D8" },
  counterBtnPlus: {
    backgroundColor: "#F5A623",
    ...Platform.select({
      ios:     { shadowColor: "#F5A623", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  counterBtnDisabled: { opacity: 0.4 },
  quickAddRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  quickAddBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: "#D7C3AE", backgroundColor: "#FFF1E4", minHeight: 44, justifyContent: "center" },
  quickAddText:{ fontSize: 14, fontFamily: "Epilogue_700Bold", color: "#F5A623" },
  capacityNote:{ flexDirection: "row", gap: 12, backgroundColor: "#FFF1E4", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#D7C3AE", marginTop: 8, alignItems: "flex-start" },
  capacityNoteText: { flex: 1, fontSize: 13, fontFamily: "Epilogue_400Regular", color: "#7A7570" },

  // ── Budget ──────────────────────────────────────────────────────────────
  budgetHero: {
    height: 180, borderRadius: 16, overflow: "hidden",
    alignItems: "flex-start", justifyContent: "flex-end",
    padding: 16, marginBottom: 20,
  },
  budgetHeroChip: {
    backgroundColor: "#F5A623", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
  },
  budgetHeroChipText: { fontFamily: "Epilogue_700Bold", fontSize: 12, color: "#644000" },
  budgetCard: {
    backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24,
    borderWidth: 2, borderColor: "#D7C3AE", marginBottom: 24,
  },
  budgetCardFocused: { borderColor: "#F5A623" },
  budgetInputLabel:  { fontSize: 11, fontFamily: "Epilogue_700Bold", letterSpacing: 2, color: "#7A7570", textTransform: "uppercase", marginBottom: 12 },
  budgetAmountRow:   { flexDirection: "row", alignItems: "center" },
  budgetCurrencyPrefix: { fontFamily: "Epilogue_700Bold", fontSize: 40, color: "#F5A623", marginRight: 8 },
  budgetInput:       { flex: 1, fontSize: 40, fontFamily: "Epilogue_700Bold", color: "#141210", backgroundColor: "transparent" },
  presetRow:         { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  presetChip:        { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, minHeight: 44, justifyContent: "center" },
  presetChipActive:  { backgroundColor: "#F5A623" },
  presetChipInactive:{ backgroundColor: "#EEE0D2", borderWidth: 1, borderColor: "#D7C3AE" },
  presetChipText:    { fontSize: 15, fontFamily: "Epilogue_400Regular", color: "#7A7570" },
  presetChipTextActive: { fontFamily: "Epilogue_700Bold", color: "#644000" },
  perGuestRow: {
    backgroundColor: "#FFF1E4", borderRadius: 16, padding: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  perGuestLabel: { fontSize: 11, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5, color: "#7A7570", textTransform: "uppercase", marginBottom: 4 },
  perGuestValue: { fontFamily: "Epilogue_700Bold", fontSize: 24, color: "#4CAF76" },
  perGuestNextBtn:{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, minHeight: 44 },
  perGuestNextText: { fontFamily: "Epilogue_700Bold", fontSize: 13, color: "#F5A623" },

  // ── Serving style ───────────────────────────────────────────────────────
  servingGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  servingCard:         { width: CARD_WIDTH, borderRadius: 16, borderWidth: 2, padding: 20, gap: 8, minHeight: 44 },
  servingCardActive:   { backgroundColor: "#FAEBDD", borderColor: "#141210" },
  servingCardInactive: { backgroundColor: "#FFF1E4", borderColor: "transparent" },
  servingIconSquare:   { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  servingLabel:        { fontFamily: "Epilogue_700Bold", fontSize: 16, color: "#141210" },
  servingLabelActive:  { color: "#141210" },
  servingDesc:         { fontFamily: "Epilogue_400Regular", fontSize: 13, color: "#7A7570", lineHeight: 18 },

  // ── Dietary restrictions ────────────────────────────────────────────────
  restrictionList:        { gap: 8, marginBottom: 16 },
  restrictionRow:         { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 2, gap: 12, minHeight: 52 },
  restrictionRowActive:   { backgroundColor: "rgba(76,175,118,0.12)", borderColor: "#4CAF76" },
  restrictionRowInactive: { backgroundColor: "#FFF1E4", borderColor: "transparent" },
  restrictionIconCircle:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  restrictionLabel:       { flex: 1, fontFamily: "Epilogue_700Bold", fontSize: 14, color: "#141210" },
  restrictionLabelActive: { color: "#141210" },
  proTipCard: {
    flexDirection: "row", gap: 12, backgroundColor: "rgba(76,175,118,0.08)",
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(76,175,118,0.15)",
    alignItems: "flex-start",
  },
  proTipText: { flex: 1, fontSize: 13, fontFamily: "Epilogue_400Regular", color: "#7A7570" },

  // ── Time chips ──────────────────────────────────────────────────────────
  timeGrid:           { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  timeChip:           { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11, minWidth: "22%", alignItems: "center", minHeight: 44, justifyContent: "center" },
  timeChipActive:     { backgroundColor: "#F5A623", borderColor: "#F5A623" },
  timeChipInactive:   { backgroundColor: "#FFF1E4", borderColor: "#D7C3AE" },
  timeChipText:       { fontSize: 13, fontFamily: "Epilogue_700Bold", textAlign: "center" },
  timeChipTextActive: { color: "#FFFFFF" },
  timeChipTextInactive:{ color: "#141210" },

  // ── Preferences ─────────────────────────────────────────────────────────
  prefInput: {
    borderRadius: 16, borderWidth: 1.5, borderColor: "#D7C3AE",
    padding: 16, fontSize: 15, minHeight: 110, textAlignVertical: "top",
    lineHeight: 22, backgroundColor: "#FFFFFF", color: "#141210",
    fontFamily: "Epilogue_400Regular",
  },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingWrap:    { flex: 1, alignItems: "center", paddingVertical: 40, gap: 6 },
  loadingHero:    { width: 160, height: 160, borderRadius: 80, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  loadingEmoji:   { fontSize: 60 },
  loadingAppName: { fontFamily: "Epilogue_700Bold", fontSize: 24, color: "#F5A623" },
  loadingTitle:   { fontFamily: "Epilogue_700Bold", fontSize: 18, color: "#141210", textAlign: "center", marginTop: 8 },
  loadingSub:     { fontFamily: "Epilogue_400Regular", fontSize: 15, color: "#7A7570", textAlign: "center" },

  // ── Error ────────────────────────────────────────────────────────────────
  errorWrap:  { alignItems: "center", padding: 32, borderRadius: 20, borderWidth: 1, borderColor: "#D7C3AE", backgroundColor: "#FFFFFF", gap: 12, marginTop: 32 },
  errorTitle: { fontFamily: "Epilogue_700Bold", fontSize: 20, color: "#141210" },
  errorMsg:   { fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#7A7570", textAlign: "center", lineHeight: 20 },

  // ── Plan back row ────────────────────────────────────────────────────────
  planBackRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 14, marginBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "#D7C3AE",
    minHeight: 44,
  },
  planBackText: { fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#7A7570" },

  // ── Plan hero ────────────────────────────────────────────────────────────
  partyBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(245,166,35,0.12)", borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start",
    marginBottom: 8,
  },
  partyBadgeText: { fontFamily: "Epilogue_700Bold", fontSize: 11, letterSpacing: 1.5, color: "#F5A623" },
  planHeadline:   { fontFamily: "Epilogue_700Bold", fontSize: 28, color: "#141210", letterSpacing: -0.5, marginBottom: 6 },
  planSubtitle:   { fontFamily: "Epilogue_400Regular", fontSize: 15, color: "#7A7570", marginBottom: 20 },

  // Stats bento
  statsBento: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  statCell: {
    width: "47%", height: 112, borderRadius: 16,
    backgroundColor: "#FFF1E4", padding: 16, justifyContent: "center",
  },
  statLabel: { fontFamily: "Epilogue_700Bold", fontSize: 10, letterSpacing: 1.5, color: "#7A7570", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontFamily: "Epilogue_700Bold", fontSize: 16, color: "#141210" },

  // ── Plan card shell ──────────────────────────────────────────────────────
  planCard:          { borderRadius: 18, overflow: "hidden", marginBottom: 16 },
  planCardHeader:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 15, gap: 10 },
  planCardHeaderEmoji:{ fontSize: 22 },
  planCardHeaderTitle:{ fontFamily: "Epilogue_700Bold", fontSize: 17, color: "#fff", flex: 1 },
  planCardBody:      { padding: 16, gap: 10, backgroundColor: "#FFFFFF" },

  // ── Overview ─────────────────────────────────────────────────────────────
  overviewGrid: { gap: 0 },
  overviewCell: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#D7C3AE", gap: 12 },
  overviewKey:  { fontFamily: "Epilogue_400Regular", fontSize: 13, color: "#7A7570", flex: 1 },
  overviewVal:  { fontFamily: "Epilogue_700Bold",    fontSize: 13, color: "#141210", flex: 2, textAlign: "right" },

  // ── Menu tabs ────────────────────────────────────────────────────────────
  tabScroll: { marginHorizontal: -4, marginBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, marginHorizontal: 4, minHeight: 38, justifyContent: "center" },
  tabText: { fontFamily: "Epilogue_700Bold", fontSize: 13 },
  menuRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#D7C3AE", borderLeftWidth: 3, paddingLeft: 12, gap: 4 },
  menuName:   { fontFamily: "Epilogue_700Bold", fontSize: 15, color: "#141210" },
  menuReason: { fontFamily: "Epilogue_400Regular", fontSize: 13, color: "#7A7570", lineHeight: 18 },
  menuMeta:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  menuQty:    { fontFamily: "Epilogue_400Regular", fontSize: 13, color: "#7A7570" },
  menuCostBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  menuCost:   { fontFamily: "Epilogue_700Bold", fontSize: 13 },
  menuPlain:  { fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#141210", paddingVertical: 8, lineHeight: 20 },

  // ── Shopping ─────────────────────────────────────────────────────────────
  shopCat: { marginBottom: 14 },
  shopCatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#D7C3AE", marginBottom: 6 },
  shopCatTitle: { fontFamily: "Epilogue_700Bold", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.8, color: "#141210" },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, minHeight: 44 },
  shopItem: { fontFamily: "Epilogue_400Regular", fontSize: 14, flex: 1, lineHeight: 20, color: "#141210" },
  shopItemChecked: { textDecorationLine: "line-through", opacity: 0.5 },

  // ── Budget bars ──────────────────────────────────────────────────────────
  budgetBarRow: { gap: 7, marginBottom: 10 },
  budgetLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetDot:   { width: 8, height: 8, borderRadius: 4 },
  budgetLabel: { fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#141210", flex: 1 },
  budgetAmt:   { fontFamily: "Epilogue_700Bold",   fontSize: 14 },
  budgetBarBg:   { height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#EEE0D2" },
  budgetBarFill: { height: 10, borderRadius: 5 },
  budgetSummary: { borderTopWidth: 1, borderTopColor: "#D7C3AE", paddingTop: 14, marginTop: 4, gap: 8 },
  budgetSumRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetSumLabel:{ fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#141210" },
  budgetSumAmt:  { fontFamily: "Epilogue_400Regular", fontSize: 15, color: "#141210" },

  // ── Timeline ─────────────────────────────────────────────────────────────
  timelineRow:     { flexDirection: "row", gap: 14, minHeight: 44 },
  timelineDotCol:  { alignItems: "center", width: 18 },
  timelineDot:     { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine:    { width: 2, flex: 1, marginTop: 4, backgroundColor: "#D7C3AE" },
  timelineContent: { flex: 1, paddingBottom: 18, gap: 3 },
  timelineTime:    { fontFamily: "Epilogue_700Bold", fontSize: 14 },
  timelineAction:  { fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#141210", lineHeight: 20 },

  // ── Host tips ─────────────────────────────────────────────────────────────
  tipRow:    { flexDirection: "row", gap: 12, paddingVertical: 6, alignItems: "flex-start" },
  tipBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: "#FFA726" },
  tipText:   { flex: 1, fontFamily: "Epilogue_400Regular", fontSize: 14, lineHeight: 21, color: "#141210" },

  // ── Validation checklist ──────────────────────────────────────────────────
  checklistRow:  { flexDirection: "row", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#D7C3AE", alignItems: "flex-start" },
  checklistText: { flex: 1, fontFamily: "Epilogue_400Regular", fontSize: 14, color: "#141210", lineHeight: 20 },

  // ── Warning banner ────────────────────────────────────────────────────────
  warnBanner: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#F9A825", backgroundColor: "#FFF8E1", alignItems: "flex-start", marginBottom: 12 },
  warnText:   { flex: 1, fontFamily: "Epilogue_400Regular", fontSize: 13, color: "#E65100", lineHeight: 18 },

  // ── Plan actions ──────────────────────────────────────────────────────────
  planActions: { gap: 10, marginTop: 8 },

  // ── Shared buttons ────────────────────────────────────────────────────────
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 17, borderRadius: 999, minHeight: 54, gap: 8,
    backgroundColor: "#F5A623",
  },
  primaryBtnDisabled: { opacity: 0.35, backgroundColor: "#7A7570" },
  primaryBtnText: { fontFamily: "Epilogue_700Bold", fontSize: 16, color: "#FFFFFF" },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 999, borderWidth: 1.5,
    borderColor: "#D7C3AE", minHeight: 54,
  },
  secondaryBtnText: { fontFamily: "Epilogue_700Bold", fontSize: 15, color: "#141210" },

  // ── Wizard footer ─────────────────────────────────────────────────────────
  wizFooter: {
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: "#D7C3AE", gap: 8,
  },
  footerBtnRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:          { backgroundColor: "#EEE0D2", borderRadius: 999, paddingVertical: 16, paddingHorizontal: 24, minHeight: 54, justifyContent: "center" },
  backBtnText:      { fontFamily: "Epilogue_700Bold", fontSize: 16, color: "#141210" },
  stepIndicatorText:{ fontFamily: "Epilogue_400Regular", fontSize: 12, color: "#7A7570", textAlign: "center" },
});
