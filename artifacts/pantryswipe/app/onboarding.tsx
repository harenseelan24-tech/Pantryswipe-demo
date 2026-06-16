import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const { width, height: screenHeight } = Dimensions.get("window");
const TOTAL_STEPS = 9;

type ScanItem = { id: string; emoji: string; name: string; qty: string; unit: string; category: string };
type PantryFlow = "fridge" | "receipt" | "manual" | null;
type UnitOption = "pieces" | "g" | "kg" | "ml" | "L" | "pack" | "can" | "bunch" | "tbsp" | "cup";
const UNITS: UnitOption[] = ["pieces", "g", "kg", "ml", "L", "pack", "can", "bunch", "tbsp", "cup"];
const CATEGORIES = ["Produce", "Dairy", "Meat", "Grains", "Condiments", "Sauces", "Spices", "Beverages", "Snacks", "Frozen"];

const MOCK_FRIDGE_ITEMS: ScanItem[] = [
  { id: "f1", emoji: "🥦", name: "Broccoli", qty: "1", unit: "head", category: "Produce" },
  { id: "f2", emoji: "🥛", name: "Milk", qty: "1", unit: "carton", category: "Dairy" },
  { id: "f3", emoji: "🧀", name: "Cheddar", qty: "200", unit: "g", category: "Dairy" },
  { id: "f4", emoji: "🥚", name: "Eggs", qty: "6", unit: "pieces", category: "Produce" },
  { id: "f5", emoji: "🍅", name: "Tomatoes", qty: "4", unit: "pieces", category: "Produce" },
];
const MOCK_RECEIPT_ITEMS: ScanItem[] = [
  { id: "r1", emoji: "🥛", name: "Full Cream Milk 2L", qty: "1", unit: "pack", category: "Dairy" },
  { id: "r2", emoji: "🍞", name: "Sourdough Bread", qty: "1", unit: "pack", category: "Grains" },
  { id: "r3", emoji: "🧈", name: "Unsalted Butter", qty: "250", unit: "g", category: "Dairy" },
  { id: "r4", emoji: "🍗", name: "Chicken Breast", qty: "500", unit: "g", category: "Meat" },
  { id: "r5", emoji: "🫘", name: "Black Beans (can)", qty: "1", unit: "can", category: "Grains" },
];

// ─── Data ─────────────────────────────────────────────────────────────────────
const PROFANITY_LIST = [
  "fuck", "shit", "ass", "bitch", "bastard", "crap", "piss", "cock", "dick",
  "cunt", "whore", "slut", "nigger", "nigga", "faggot", "fag", "retard",
  "asshole", "motherfucker", "bullshit", "dumbass", "jackass", "wanker", "twat", "tosser",
];

const HOUSEHOLD_LABELS: Record<number, string> = {
  1: "🧍 Just You — solo portions, minimal waste",
  2: "👫 Couple — intimate meals, perfect for two",
  3: "👨‍👩‍👦 Small Family — easy weeknight dinners",
  4: "👨‍👩‍👧‍👦 Family of Four — crowd-pleasing recipes",
  5: "🏠 Big Household — batch cooking friendly",
  6: "🎉 Large Group — meal prep & sharing meals",
};

const SKILL_LEVELS = [
  { id: "Beginner", icon: "🥄", title: "Beginner", desc: "I follow recipes step by step and keep it simple" },
  { id: "Home Cook", icon: "🍳", title: "Home Cook", desc: "I'm comfortable in the kitchen with most techniques" },
  { id: "Confident", icon: "👨‍🍳", title: "Confident Cook", desc: "I experiment and enjoy a challenge" },
  { id: "Advanced", icon: "⭐", title: "Advanced", desc: "I know my way around a professional kitchen" },
];

const BUDGETS = [
  { id: 50, label: "Under $50/week", desc: "Budget-friendly meals, pantry staples, minimal waste", color: "#10B981" },
  { id: 75, label: "$50–$75/week", desc: "Smart spending with variety", color: "#14B8A6" },
  { id: 100, label: "$75–$100/week", desc: "Balanced meals with quality ingredients", color: "#2B7FFF" },
  { id: 150, label: "$100–$150/week", desc: "More variety, premium cuts, diverse cuisines", color: "#6366F1" },
  { id: 200, label: "$150–$200+/week", desc: "No compromise — quality-first cooking", color: "#8B5CF6" },
];

const DIET_OPTIONS = [
  { id: "Omnivore", emoji: "🥩", label: "Omnivore", desc: "I eat everything — no restrictions", exclusive: true },
  { id: "Vegetarian", emoji: "🥗", label: "Vegetarian", desc: "No meat or fish, but dairy & eggs are fine" },
  { id: "Vegan", emoji: "🌿", label: "Vegan", desc: "No animal products at all" },
  { id: "Pescatarian", emoji: "🐟", label: "Pescatarian", desc: "No meat, but fish and seafood are fine" },
  { id: "Halal", emoji: "☪️", label: "Halal", desc: "No pork, lard, or non-halal slaughtered meat" },
  { id: "Kosher", emoji: "✡️", label: "Kosher", desc: "Jewish dietary laws" },
  { id: "Keto", emoji: "🥑", label: "Keto", desc: "High fat, very low carb (under 20g net carbs)" },
  { id: "Paleo", emoji: "🍖", label: "Paleo", desc: "Whole foods — no grains, legumes, dairy" },
];

const ALLERGY_OPTIONS = [
  { id: "Peanuts", emoji: "🥜" }, { id: "Tree Nuts", emoji: "🌰" }, { id: "Dairy", emoji: "🥛" },
  { id: "Gluten", emoji: "🌾" }, { id: "Eggs", emoji: "🥚" }, { id: "Shellfish", emoji: "🦐" },
  { id: "Fish", emoji: "🐟" }, { id: "Soy", emoji: "🫘" }, { id: "Sesame", emoji: "🌻" },
  { id: "Sulphites", emoji: "🐝" }, { id: "Corn", emoji: "🌽" }, { id: "Fruit", emoji: "🍓" },
];

const ALLERGY_SWAPS: Record<string, { title: string; swaps: string[] }> = {
  Peanuts: { title: "🥜 Peanuts — common swaps we'll suggest:", swaps: ["Peanut butter → Sunflower seed butter (SunButter)", "Peanuts in stir-fry → Toasted pumpkin seeds", "Satay sauce → Tahini-based sauce"] },
  Dairy: { title: "🥛 Dairy — swaps we'll use:", swaps: ["Milk → Oat milk, almond milk, coconut milk", "Butter → Vegan butter, coconut oil, olive oil", "Cream → Full-fat coconut cream", "Greek yogurt → Coconut yogurt"] },
  Gluten: { title: "🌾 Gluten — swaps we'll use:", swaps: ["Flour → Almond flour, rice flour, tapioca starch", "Soy sauce → Tamari (GF) or coconut aminos", "Pasta → Rice noodles, zucchini noodles, chickpea pasta"] },
  Eggs: { title: "🥚 Eggs — swaps we'll use:", swaps: ["1 egg → 1 tbsp ground flaxseed + 3 tbsp water", "Egg wash → Brushed olive oil or plant milk", "Scrambled eggs → Silken tofu scramble"] },
};

const GOALS = [
  { id: "Eat Healthier", emoji: "🥦", title: "Eat Healthier", desc: "Better nutrients, less processed food, more balance" },
  { id: "Build Muscle", emoji: "💪", title: "Build Muscle", desc: "High protein meals to support training and gains" },
  { id: "Save Money", emoji: "💰", title: "Save Money", desc: "Cook well without breaking the bank" },
  { id: "Cook Faster", emoji: "⚡", title: "Cook Faster", desc: "Weeknight-friendly meals, minimal time" },
  { id: "Explore Cuisines", emoji: "🌍", title: "Explore Cuisines", desc: "Discover new flavours and culinary traditions" },
  { id: "Cook for Others", emoji: "👨‍👩‍👧", title: "Cook for Others", desc: "Impress guests, cook for family, host with confidence" },
];

const CUISINES = [
  { id: "Italian", flag: "🇮🇹" }, { id: "Japanese", flag: "🇯🇵" }, { id: "Korean", flag: "🇰🇷" },
  { id: "Indian", flag: "🇮🇳" }, { id: "Thai", flag: "🇹🇭" }, { id: "Mexican", flag: "🇲🇽" },
  { id: "American", flag: "🇺🇸" }, { id: "French", flag: "🇫🇷" }, { id: "Vietnamese", flag: "🇻🇳" },
  { id: "Chinese", flag: "🇨🇳" }, { id: "Singaporean", flag: "🇸🇬" }, { id: "Malaysian", flag: "🇲🇾" },
];

const LOADING_MESSAGES = [
  "Setting up your profile...",
  "Learning your taste preferences...",
  "Stocking your recipe engine...",
  "Filtering for your dietary needs...",
  "Personalising your swipe deck...",
  "Almost ready to cook! 🍳",
];

const FOOD_EMOJIS = ["🥦", "🧄", "🍅", "🧀", "🥕"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function containsProfanity(t: string) {
  const l = t.toLowerCase().replace(/[^a-z]/g, "");
  return PROFANITY_LIST.some((w) => l.includes(w));
}
function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }
function isValidName(n: string) { return /^[a-zA-Z\s\-]+$/.test(n.trim()) && n.trim().length >= 2; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile, completeSetup, addToPantry } = useApp();
  const appColors = useColors();

  const OB = useMemo(() => ({
    bg: appColors.background,
    card: appColors.card,
    blue: appColors.primary,
    blueLight: appColors.cardElevated,
    text: appColors.text,
    muted: appColors.textSecondary,
    border: appColors.border,
    error: appColors.destructive,
    success: appColors.herbGreen,
    amber: appColors.saffron,
    amberLight: appColors.background === "#07101E" ? "#1C1200" : "#FFF8EB",
    red: "#DC2626",
    redLight: "#FEF2F2",
    redBorder: "#FECACA",
  }), [appColors]);

  const styles = useMemo(() => makeStyles(OB), [OB]);

  // Modal-specific stylesheets (depend on OB theme tokens)
  const pm = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "#00000088", alignItems: "center", justifyContent: "center", padding: 32 },
    card: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
    title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
    body: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
    allowBtn: { width: "100%", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
    allowTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
    notNowBtn: { paddingVertical: 12, alignItems: "center", width: "100%" },
    notNowTxt: { fontSize: 14, fontWeight: "500" },
  }), [OB]);

  const cs = useMemo(() => StyleSheet.create({
    targetBox: { position: "absolute", top: "15%", left: "10%", right: "10%", height: "55%", borderWidth: 2, borderColor: "#ffffff99", borderRadius: 16, overflow: "hidden" },
    scanLine: { width: "100%", height: 2, backgroundColor: "#5B8EF5BB" },
    scanInstruction: { position: "absolute", top: "72%", left: 0, right: 0, color: "#fff", textAlign: "center", fontSize: 13, paddingHorizontal: 20 },
    pillsWrap: { position: "absolute", top: 80, left: 16, right: 16, gap: 6 },
    pill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
    pillTxt: { color: "#fff", fontSize: 13, fontWeight: "600" },
    bottomPanel: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 48, gap: 12 },
    itemCount: { fontSize: 13, fontWeight: "500", textAlign: "center" },
    doneBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
    doneTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
    switchTxt: { fontSize: 13, textAlign: "center" },
    receiptFrame: { position: "absolute", top: "15%", left: "10%", right: "10%", height: "55%", borderRadius: 4 },
    corner: { position: "absolute", width: 24, height: 24, borderColor: "#fff" },
    shutter: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E84040" },
    closeBtn: { position: "absolute", top: 52, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "#00000066", alignItems: "center", justifyContent: "center" },
  }), [OB]);

  const rv = useMemo(() => StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, borderBottomWidth: 1 },
    title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
    sub: { fontSize: 13 },
    row: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
    itemName: { fontSize: 15, fontWeight: "600" },
    itemMeta: { fontSize: 12, marginTop: 2 },
    footer: { padding: 20, borderTopWidth: 1 },
    addBtn: { paddingVertical: 15, borderRadius: 12, alignItems: "center" },
    addTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  }), [OB]);

  const me = useMemo(() => StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: "700" },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginRight: 6 },
    chipTxt: { fontSize: 13, fontWeight: "500" },
    addItemBtn: { paddingVertical: 13, borderRadius: 10, alignItems: "center" },
    addItemTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
    listHeader: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    addedRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
    addedName: { fontSize: 14 },
    footer: { padding: 20, borderTopWidth: 1 },
    doneBtn: { paddingVertical: 15, borderRadius: 12, alignItems: "center" },
    doneTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  }), [OB]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const loadingWidth = loadingProgress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const foodAnims = useRef(FOOD_EMOJIS.map(() => new Animated.Value(0))).current;

  const [step, setStep] = useState(0);
  const [showCreating, setShowCreating] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [loadingDone, setLoadingDone] = useState(false);

  // Step 0
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfPw, setShowConfPw] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Steps 1-8
  const [householdSize, setHouseholdSize] = useState(2);
  const [skillLevel, setSkillLevel] = useState("");
  const [weeklyBudget, setWeeklyBudget] = useState(0);
  const [dietTypes, setDietTypes] = useState<string[]>(["Omnivore"]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [cuisineError, setCuisineError] = useState(false);

  // ── Camera / Pantry-flow state ──────────────────────────────────────────────
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showPermModal, setShowPermModal] = useState(false);
  const [pendingFlow, setPendingFlow] = useState<PantryFlow>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [activeFlow, setActiveFlow] = useState<PantryFlow>(null);
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [scanReading, setScanReading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewItems, setReviewItems] = useState<ScanItem[]>([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualUnit, setManualUnit] = useState("pieces");
  const [manualCategory, setManualCategory] = useState("Produce");
  const [manualAdded, setManualAdded] = useState<ScanItem[]>([]);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanIndexRef = useRef(0);

  // Scan line animation (react-native-reanimated, avoids conflict with RN Animated)
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const scanLineStyle = { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, screenHeight * 0.55] }) }] };

  const stopScanTimer = useCallback(() => {
    if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (showCamera && activeFlow === "fridge") {
      scanLineAnim.setValue(0);
      Animated.loop(Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
      scanIndexRef.current = 0;
      setScanItems([]);
      scanTimerRef.current = setInterval(() => {
        setScanItems((prev) => {
          if (scanIndexRef.current < MOCK_FRIDGE_ITEMS.length) {
            const next = MOCK_FRIDGE_ITEMS[scanIndexRef.current];
            scanIndexRef.current++;
            return [...prev, next];
          }
          return prev;
        });
      }, 2500);
    } else {
      stopScanTimer();
    }
    return () => stopScanTimer();
  }, [showCamera, activeFlow]);

  const openCameraFlow = useCallback((flow: "fridge" | "receipt") => {
    setActiveFlow(flow); setScanItems([]); setScanReading(false); setShowCamera(true);
  }, []);

  const handlePantryOption = useCallback((id: string) => {
    if (id === "scan" || id === "receipt") {
      const flow = id === "scan" ? "fridge" : "receipt";
      if (cameraPermission?.granted) { openCameraFlow(flow); }
      else { setPendingFlow(flow); setShowPermModal(true); }
    } else if (id === "type") {
      setManualAdded([]); setManualName(""); setManualQty("1"); setShowManualEntry(true);
    } else if (id === "skip") {
      setShowSkipConfirm(true);
    }
  }, [cameraPermission, openCameraFlow]);

  const handleAllowCamera = useCallback(async () => {
    setShowPermModal(false);
    if (Platform.OS === "web") {
      try {
        await (navigator as Navigator & { mediaDevices: MediaDevices }).mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (pendingFlow && pendingFlow !== "manual") openCameraFlow(pendingFlow);
      } catch {
        Alert.alert("Camera Denied", "Please allow camera access in your browser settings.");
      }
    } else {
      const result = await requestCameraPermission();
      if (result.granted && pendingFlow && pendingFlow !== "manual") { openCameraFlow(pendingFlow); }
      else if (!result.granted && !result.canAskAgain) {
        Alert.alert("Camera Access Required", "Go to Settings → PantrySwipe → Camera → Allow.");
      }
    }
  }, [pendingFlow, openCameraFlow, requestCameraPermission]);

  const handleDoneScan = useCallback(() => {
    stopScanTimer(); setShowCamera(false);
    setReviewTitle("Here's what we found 👀");
    setReviewItems([...scanItems]);
    setShowReview(true);
  }, [scanItems, stopScanTimer]);

  const handleReceiptCapture = useCallback(() => {
    setScanReading(true);
    setTimeout(() => {
      setScanReading(false); setShowCamera(false);
      setReviewTitle("Items from your receipt 🧾");
      setReviewItems([...MOCK_RECEIPT_ITEMS]);
      setShowReview(true);
    }, 2000);
  }, []);

  const handleReceiptGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) {
      setShowCamera(false); setScanReading(true);
      setTimeout(() => {
        setScanReading(false);
        setReviewTitle("Items from your receipt 🧾");
        setReviewItems([...MOCK_RECEIPT_ITEMS]);
        setShowReview(true);
      }, 2000);
    }
  }, []);

  const confirmReview = useCallback(() => {
    reviewItems.forEach((item) => {
      addToPantry({
        id: `${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        name: item.name,
        quantity: parseFloat(item.qty) || 1,
        unit: item.unit,
        category: (["Fridge","Freezer","Pantry","Spices","Sauces","Beverages","Produce"].includes(item.category) ? item.category : "Produce") as "Fridge"|"Freezer"|"Pantry"|"Spices"|"Sauces"|"Beverages"|"Produce",
        status: "Fresh",
        emoji: item.emoji,
      });
    });
    setShowReview(false);
    goNext();
  }, [reviewItems, addToPantry]);

  const addManualItem = useCallback(() => {
    if (!manualName.trim()) return;
    const emojis: Record<string, string> = { Produce: "🥦", Dairy: "🥛", Meat: "🍗", Grains: "🍞", Condiments: "🫙", Sauces: "🍶", Spices: "🧂", Beverages: "🥤", Snacks: "🍿", Frozen: "🧊" };
    setManualAdded((prev) => [...prev, {
      id: `m${Date.now()}`, emoji: emojis[manualCategory] || "🍽️",
      name: manualName.trim(), qty: manualQty, unit: manualUnit, category: manualCategory,
    }]);
    setManualName(""); setManualQty("1");
  }, [manualName, manualQty, manualUnit, manualCategory]);

  const confirmManual = useCallback(() => {
    manualAdded.forEach((item) => {
      addToPantry({
        id: `${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        name: item.name, quantity: parseFloat(item.qty) || 1, unit: item.unit,
        category: (["Fridge","Freezer","Pantry","Spices","Sauces","Beverages","Produce"].includes(item.category) ? item.category : "Produce") as "Fridge"|"Freezer"|"Pantry"|"Spices"|"Sauces"|"Beverages"|"Produce",
        status: "Fresh", emoji: item.emoji,
      });
    });
    setShowManualEntry(false);
    goNext();
  }, [manualAdded, addToPantry]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const pwRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least 1 uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least 1 number", met: /[0-9]/.test(password) },
    { label: "At least 1 special character (!@#$%^&*)", met: /[!@#$%^&*]/.test(password) },
  ];
  const allPwRulesMet = pwRules.every((r) => r.met);

  const nameOk = name.trim().length >= 2 && isValidName(name) && !containsProfanity(name);
  const emailOk = isValidEmail(email);
  const pwMatch = confirmPw === password && confirmPw.length > 0;

  const isStepValid = (s: number) => {
    switch (s) {
      case 0: return nameOk && emailOk && allPwRulesMet && pwMatch && termsChecked;
      case 1: return true;
      case 2: return !!skillLevel;
      case 3: return !!weeklyBudget;
      case 4: return dietTypes.length > 0;
      case 5: return true;
      case 6: return !!goal;
      case 7: return selectedCuisines.length > 0;
      case 8: return true;
      default: return true;
    }
  };

  const goNext = () => {
    if (step === 7 && selectedCuisines.length === 0) { setCuisineError(true); return; }
    if (!isStepValid(step)) { setShowErrors(true); return; }
    setCuisineError(false);
    setShowErrors(false);
    if (step === TOTAL_STEPS - 1) { startCreating(); return; }
    Animated.timing(slideAnim, { toValue: -(step + 1) * width, duration: 320, useNativeDriver: true }).start();
    setStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) {
      Animated.timing(slideAnim, { toValue: -(step - 1) * width, duration: 320, useNativeDriver: true }).start();
      setStep(step - 1);
    }
  };

  const startCreating = () => {
    setShowCreating(true);
    foodAnims.forEach((anim, i) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: -80, duration: 380, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 380, useNativeDriver: true }),
            Animated.delay(500),
          ])
        ).start();
      }, i * 130);
    });
    Animated.timing(loadingProgress, { toValue: 1, duration: 3400, useNativeDriver: false }).start();
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < LOADING_MESSAGES.length) setLoadingMsg(LOADING_MESSAGES[i]);
      else clearInterval(interval);
    }, 580);
    setTimeout(() => {
      clearInterval(interval);
      setLoadingDone(true);
      setTimeout(() => {
        updateProfile({ name: name.trim(), email: email.trim(), skillLevel, dietType: dietTypes, allergies, goal, cuisinePreferences: selectedCuisines, householdSize, weeklyBudget });
        completeSetup();
        router.replace("/(tabs)");
      }, 700);
    }, 3500);
  };

  const toggleDiet = (id: string) => {
    if (id === "Omnivore") { setDietTypes(["Omnivore"]); return; }
    const without = dietTypes.filter((d) => d !== "Omnivore");
    setDietTypes(without.includes(id) ? without.filter((d) => d !== id) || ["Omnivore"] : [...without, id]);
    if (dietTypes.filter((d) => d !== id).length === 0) setDietTypes(["Omnivore"]);
  };

  const pct: `${number}%` = `${Math.round(((step + 1) / TOTAL_STEPS) * 100)}%`;
  const ctaLabel = step === TOTAL_STEPS - 1 ? "Let's Go! 🍳" : step === 5 && allergies.length === 0 ? "Skip — No Allergies" : "Continue";
  const ctaEnabled = isStepValid(step) || step === 5 || step === 8;

  return (
    <View style={[styles.container, { backgroundColor: OB.bg }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View style={styles.headerRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Feather name="arrow-left" size={22} color={OB.text} />
            </TouchableOpacity>
          )}
          <View style={[styles.progressTrack, { marginLeft: step === 0 ? 20 : 8 }]}>
            <View style={[styles.progressFill, { width: pct }]} />
          </View>
          {step > 0 && step < TOTAL_STEPS - 1 && (
            <TouchableOpacity onPress={goNext} style={{ paddingRight: 20 }}>
              <Text style={[styles.skipText, { color: OB.muted }]}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Slides ── */}
      <Animated.View style={[styles.slidesWrap, { transform: [{ translateX: slideAnim }] }]}>

        {/* ── STEP 0: Account ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.bigEmoji}>👋</Text>
          <Text style={styles.stepTitle}>Welcome to{"\n"}PantrySwipe!</Text>
          <Text style={styles.stepSub}>Let's set up your account. This takes about 2 minutes.</Text>

          <Text style={styles.fieldLabel}>Your Name</Text>
          <View style={[styles.inputRow, showErrors && !nameOk && styles.inputRowError]}>
            <TextInput style={styles.inputField} placeholder="e.g. Alex Chen" placeholderTextColor={OB.muted} value={name} onChangeText={(t) => { setName(t); setShowErrors(false); }} autoCapitalize="words" />
            {nameOk && <Feather name="check-circle" size={18} color={OB.success} />}
          </View>
          {showErrors && name.trim().length < 2 && <Text style={styles.errMsg}>Name must be at least 2 characters</Text>}
          {showErrors && name.trim().length >= 2 && !isValidName(name) && <Text style={styles.errMsg}>Only letters, spaces, and hyphens allowed</Text>}
          {showErrors && containsProfanity(name) && <Text style={styles.errMsg}>Please choose an appropriate name 🙂</Text>}

          <Text style={styles.fieldLabel}>Email Address</Text>
          <View style={[styles.inputRow, showErrors && !emailOk && styles.inputRowError]}>
            <TextInput style={styles.inputField} placeholder="you@example.com" placeholderTextColor={OB.muted} value={email} onChangeText={(t) => { setEmail(t); setShowErrors(false); }} keyboardType="email-address" autoCapitalize="none" />
            {emailOk && <Feather name="check-circle" size={18} color={OB.success} />}
          </View>
          {showErrors && !emailOk && <Text style={styles.errMsg}>Please enter a valid email address</Text>}

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.inputRow, showErrors && !allPwRulesMet && styles.inputRowError]}>
            <TextInput style={styles.inputField} placeholder="Create a password" placeholderTextColor={OB.muted} value={password} onChangeText={(t) => { setPassword(t); setShowErrors(false); }} secureTextEntry={!showPw} />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Feather name={showPw ? "eye-off" : "eye"} size={18} color={OB.muted} />
            </TouchableOpacity>
          </View>
          {password.length > 0 && (
            <View style={styles.pwChecklist}>
              {pwRules.map((r) => (
                <View key={r.label} style={styles.pwCheckRow}>
                  <Feather name={r.met ? "check-circle" : "circle"} size={13} color={r.met ? OB.success : OB.muted} />
                  <Text style={[styles.pwCheckText, { color: r.met ? OB.success : OB.muted }]}>{r.label}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>Confirm Password</Text>
          <View style={[styles.inputRow, showErrors && !pwMatch && styles.inputRowError]}>
            <TextInput style={styles.inputField} placeholder="Re-enter your password" placeholderTextColor={OB.muted} value={confirmPw} onChangeText={(t) => { setConfirmPw(t); setShowErrors(false); }} secureTextEntry={!showConfPw} />
            <TouchableOpacity onPress={() => setShowConfPw(!showConfPw)}>
              <Feather name={showConfPw ? "eye-off" : "eye"} size={18} color={OB.muted} />
            </TouchableOpacity>
          </View>
          {confirmPw.length > 0 && !pwMatch && <Text style={styles.errMsg}>Passwords do not match</Text>}
          {pwMatch && (
            <View style={[styles.pwCheckRow, { marginBottom: 8 }]}>
              <Feather name="check-circle" size={13} color={OB.success} />
              <Text style={[styles.pwCheckText, { color: OB.success }]}>Passwords match</Text>
            </View>
          )}

          <TouchableOpacity style={styles.termsRow} onPress={() => setTermsChecked(!termsChecked)}>
            <View style={[styles.checkbox, termsChecked && styles.checkboxOn]}>
              {termsChecked && <Feather name="check" size={12} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={{ color: OB.blue, fontWeight: "600" }}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={{ color: OB.blue, fontWeight: "600" }}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
          {showErrors && !termsChecked && <Text style={styles.errMsg}>Please accept the terms to continue</Text>}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 1: Household Size ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>🏠</Text>
          <Text style={styles.stepTitle}>Who are you{"\n"}cooking for?</Text>
          <Text style={styles.stepSub}>This helps us suggest the right portion sizes.</Text>
          <View style={styles.hhRow}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <TouchableOpacity key={n} style={[styles.hhPill, householdSize === n && styles.hhPillOn]} onPress={() => setHouseholdSize(n)}>
                <Text style={[styles.hhPillText, householdSize === n && styles.hhPillTextOn]}>{n === 6 ? "6+" : n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.hhCard}>
            <Text style={styles.hhCardText}>{HOUSEHOLD_LABELS[Math.min(householdSize, 6)]}</Text>
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 2: Skill Level ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>🍳</Text>
          <Text style={styles.stepTitle}>How confident are{"\n"}you in the kitchen?</Text>
          <Text style={styles.stepSub}>Be honest — we'll tailor recipes to match.</Text>
          <View style={styles.cardStack}>
            {SKILL_LEVELS.map((s) => {
              const on = skillLevel === s.id;
              return (
                <TouchableOpacity key={s.id} style={[styles.selectCard, on && styles.selectCardOn]} onPress={() => setSkillLevel(s.id)}>
                  <View style={[styles.cardIcon, { backgroundColor: on ? OB.blue + "22" : OB.card }]}>
                    <Text style={{ fontSize: 24 }}>{s.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: on ? OB.blue : OB.text }]}>{s.title}</Text>
                    <Text style={styles.cardDesc}>{s.desc}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}
          </View>
          {showErrors && !skillLevel && <Text style={styles.errMsg}>Please select your skill level</Text>}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 3: Budget ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>💰</Text>
          <Text style={styles.stepTitle}>What's your weekly{"\n"}food budget?</Text>
          <Text style={styles.stepSub}>We'll suggest recipes that fit your wallet.</Text>
          <View style={styles.cardStack}>
            {BUDGETS.map((b) => {
              const on = weeklyBudget === b.id;
              return (
                <TouchableOpacity key={b.id} style={[styles.selectCard, on && { borderColor: b.color, backgroundColor: b.color + "12" }]} onPress={() => setWeeklyBudget(b.id)}>
                  <View style={[styles.cardIcon, { backgroundColor: on ? b.color + "22" : OB.card }]}>
                    <Text style={{ fontSize: 22 }}>💵</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: on ? b.color : OB.text }]}>{b.label}</Text>
                    <Text style={styles.cardDesc}>{b.desc}</Text>
                  </View>
                  <View style={[styles.radio, on && { borderColor: b.color, backgroundColor: b.color }]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}
          </View>
          {showErrors && !weeklyBudget && <Text style={styles.errMsg}>Please select your budget</Text>}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 4: Dietary Profile ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>🥗</Text>
          <Text style={styles.stepTitle}>Any dietary{"\n"}requirements?</Text>
          <Text style={styles.stepSub}>We'll only show you food that works for you.</Text>
          <Text style={styles.noteText}>Select all that apply. You can change these anytime in Settings.</Text>
          <View style={styles.dietGrid}>
            {DIET_OPTIONS.map((d) => {
              const on = dietTypes.includes(d.id);
              return (
                <TouchableOpacity key={d.id} style={[styles.dietCard, on && styles.dietCardOn]} onPress={() => toggleDiet(d.id)}>
                  {on && <View style={styles.dietCheckBadge}><Feather name="check" size={10} color="#fff" /></View>}
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{d.emoji}</Text>
                  <Text style={[styles.dietLabel, { color: on ? OB.blue : OB.text }]}>{d.label}</Text>
                  <Text style={styles.dietDesc}>{d.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 5: Allergies ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>⚠️</Text>
          <Text style={styles.stepTitle}>Any food{"\n"}allergies?</Text>
          <View style={styles.allergyWarningBox}>
            <Text style={styles.allergyWarningText}>⚠️ Your safety comes first. Selected allergens will be filtered from ALL recipes, ingredients, and suggestions.</Text>
          </View>
          <Text style={styles.noteText}>Select all that apply. Leave blank if you have no allergies.</Text>
          <View style={styles.allergyGrid}>
            {ALLERGY_OPTIONS.map((a) => {
              const on = allergies.includes(a.id);
              return (
                <TouchableOpacity key={a.id} style={[styles.allergyChip, on && styles.allergyChipOn]} onPress={() => setAllergies((prev) => prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id])}>
                  <Text style={{ fontSize: 16 }}>{a.emoji}</Text>
                  <Text style={[styles.allergyLabel, on && styles.allergyLabelOn]}>{a.id}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {Object.entries(ALLERGY_SWAPS).map(([key, val]) => {
            if (!allergies.includes(key)) return null;
            return (
              <View key={key} style={styles.swapCard}>
                <Text style={styles.swapTitle}>{val.title}</Text>
                {val.swaps.map((s, i) => <Text key={i} style={styles.swapItem}>• {s}</Text>)}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 6: Goal ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>🎯</Text>
          <Text style={styles.stepTitle}>What do you want{"\n"}to achieve?</Text>
          <Text style={styles.stepSub}>Pick your top goal — you can add more later.</Text>
          <View style={styles.cardStack}>
            {GOALS.map((g) => {
              const on = goal === g.id;
              return (
                <TouchableOpacity key={g.id} style={[styles.selectCard, on && styles.selectCardOn]} onPress={() => setGoal(g.id)}>
                  <View style={[styles.cardIcon, { backgroundColor: on ? OB.blue + "22" : OB.card }]}>
                    <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: on ? OB.blue : OB.text }]}>{g.title}</Text>
                    <Text style={styles.cardDesc}>{g.desc}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}
          </View>
          {showErrors && !goal && <Text style={styles.errMsg}>Please select your goal</Text>}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 7: Cuisines ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>🌍</Text>
          <Text style={styles.stepTitle}>What cuisines{"\n"}excite you?</Text>
          <Text style={styles.stepSub}>Pick at least one. Your swipe deck will reflect your taste.</Text>
          <View style={styles.cuisineHeader}>
            <Text style={[styles.cuisineCount, { color: selectedCuisines.length > 0 ? OB.blue : OB.muted }]}>{selectedCuisines.length} selected</Text>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <TouchableOpacity onPress={() => { setSelectedCuisines(CUISINES.map((c) => c.id)); setCuisineError(false); }}>
                <Text style={[styles.cuisineAction, { color: OB.blue }]}>Select All</Text>
              </TouchableOpacity>
              {selectedCuisines.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedCuisines([])}>
                  <Text style={[styles.cuisineAction, { color: OB.muted }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.cuisineGrid}>
            {CUISINES.map((c) => {
              const on = selectedCuisines.includes(c.id);
              return (
                <TouchableOpacity key={c.id} style={[styles.cuisineCard, on && styles.cuisineCardOn]} onPress={() => { setCuisineError(false); setSelectedCuisines((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]); }}>
                  {on && <View style={styles.cuisineCheckBadge}><Feather name="check" size={10} color="#fff" /></View>}
                  <Text style={{ fontSize: 32, marginBottom: 6 }}>{c.flag}</Text>
                  <Text style={[styles.cuisineName, { color: on ? OB.blue : OB.text }]}>{c.id}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {cuisineError && <Text style={[styles.errMsg, { marginTop: 8 }]}>Please select at least one cuisine to continue</Text>}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── STEP 8: Pantry Setup ── */}
        <ScrollView style={styles.slide} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
          <Text style={styles.bigEmoji}>🥦</Text>
          <Text style={styles.stepTitle}>Let's stock{"\n"}your pantry</Text>
          <Text style={styles.stepSub}>The more you add, the better your recipe suggestions.</Text>
          <View style={styles.pantryList}>
            {[
              { id: "scan", emoji: "🤳", bg: OB.blueLight, title: "Scan Fridge / Pantry", desc: "Point your camera at your food — AI will detect it instantly" },
              { id: "receipt", emoji: "🧾", bg: "#E6FAF5", title: "Scan Receipt", desc: "Take a photo of your grocery receipt — we'll read it for you" },
              { id: "type", emoji: "✏️", bg: OB.amberLight, title: "Type It In", desc: "Add ingredients manually at your own pace" },
              { id: "skip", emoji: "⏭️", bg: "#F1F5F9", title: "I'll Add Later", desc: "Skip for now — add from the Pantry tab anytime" },
            ].map((opt) => (
              <TouchableOpacity key={opt.id} style={styles.pantryOption} onPress={() => handlePantryOption(opt.id)}>
                <View style={[styles.pantryIconBox, { backgroundColor: opt.bg }]}>
                  <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pantryOptTitle}>{opt.title}</Text>
                  <Text style={styles.pantryOptDesc}>{opt.desc}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={OB.muted} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>

      </Animated.View>

      {/* ── CTA ── */}
      <View style={[styles.bottom, { paddingBottom: bottomPadding + 16 }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, !ctaEnabled && styles.ctaBtnOff]}
          onPress={goNext}
          activeOpacity={0.88}
        >
          <Text style={[styles.ctaText, !ctaEnabled && styles.ctaTextOff]}>{ctaLabel}</Text>
          <Feather name="arrow-right" size={20} color={ctaEnabled ? "#fff" : OB.muted} />
        </TouchableOpacity>
      </View>

      {/* ── Creating Account Modal ── */}
      <Modal visible={showCreating} animationType="fade" statusBarTranslucent>
        <View style={styles.loadScreen}>
          {!loadingDone ? (
            <View style={styles.loadContent}>
              <Text style={styles.loadTitle}>Creating your account</Text>
              <View style={styles.foodRow}>
                {FOOD_EMOJIS.map((e, i) => (
                  <Animated.Text key={i} style={[styles.foodEmoji, { transform: [{ translateY: foodAnims[i] }] }]}>{e}</Animated.Text>
                ))}
              </View>
              <Text style={styles.wokEmoji}>🍳</Text>
              <View style={styles.loadTrack}>
                <Animated.View style={[styles.loadFill, { width: loadingWidth }]} />
              </View>
              <Text style={styles.loadMsg}>{loadingMsg}</Text>
            </View>
          ) : (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>✅</Text>
              <Text style={styles.doneText}>Account Created!</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* ── 1. CAMERA PERMISSION MODAL ── */}
      <Modal visible={showPermModal} transparent animationType="fade" statusBarTranslucent>
        <View style={pm.overlay}>
          <View style={[pm.card, { backgroundColor: OB.card, borderColor: OB.border }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📷</Text>
            <Text style={[pm.title, { color: OB.text }]}>Camera Access Needed</Text>
            <Text style={[pm.body, { color: OB.muted }]}>PantrySwipe needs your camera to identify food items. We don't store any camera footage.</Text>
            <TouchableOpacity style={[pm.allowBtn, { backgroundColor: OB.blue }]} onPress={handleAllowCamera}>
              <Text style={pm.allowTxt}>Allow Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pm.notNowBtn} onPress={() => setShowPermModal(false)}>
              <Text style={[pm.notNowTxt, { color: OB.muted }]}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 2. CAMERA SCAN MODAL ── */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {Platform.OS !== "web" ? (
            <CameraView style={{ flex: 1 }} facing="back">
              {activeFlow === "fridge" ? (
                <>
                  {/* Targeting overlay */}
                  <View style={cs.targetBox} pointerEvents="none">
                    <Animated.View style={[cs.scanLine, scanLineStyle]} />
                  </View>
                  <Text style={cs.scanInstruction}>Point at food items one by one — hold steady for 2 seconds</Text>
                  {/* Detected pills */}
                  <View style={cs.pillsWrap}>
                    {scanItems.map((item) => (
                      <View key={item.id} style={[cs.pill, { backgroundColor: OB.blue + "CC" }]}>
                        <Text style={cs.pillTxt}>{item.emoji} {item.name} · {item.qty} {item.unit}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Bottom panel */}
                  <View style={[cs.bottomPanel, { backgroundColor: "#000000BB" }]}>
                    <Text style={[cs.itemCount, { color: "#fff" }]}>Items detected: {scanItems.length}</Text>
                    <TouchableOpacity style={[cs.doneBtn, { backgroundColor: OB.blue }]} onPress={handleDoneScan}>
                      <Text style={cs.doneTxt}>Done Scanning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { stopScanTimer(); setActiveFlow("receipt"); }}>
                      <Text style={[cs.switchTxt, { color: OB.muted }]}>Switch to Receipt Scan</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Receipt frame guide */}
                  <View style={cs.receiptFrame} pointerEvents="none">
                    {["tl","tr","bl","br"].map((c) => (
                      <View key={c} style={[cs.corner, {
                        top: c.startsWith("t") ? 0 : undefined, bottom: c.startsWith("b") ? 0 : undefined,
                        left: c.endsWith("l") ? 0 : undefined, right: c.endsWith("r") ? 0 : undefined,
                        borderTopWidth: c.startsWith("t") ? 3 : 0, borderBottomWidth: c.startsWith("b") ? 3 : 0,
                        borderLeftWidth: c.endsWith("l") ? 3 : 0, borderRightWidth: c.endsWith("r") ? 3 : 0,
                      }]} />
                    ))}
                  </View>
                  <Text style={cs.scanInstruction}>Fit your receipt in the frame</Text>
                  {scanReading ? (
                    <View style={[cs.bottomPanel, { backgroundColor: "#000000BB", alignItems: "center", gap: 12 }]}>
                      <Text style={{ fontSize: 32 }}>🧾</Text>
                      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Reading your receipt...</Text>
                    </View>
                  ) : (
                    <View style={[cs.bottomPanel, { backgroundColor: "#000000BB", alignItems: "center", gap: 14 }]}>
                      <TouchableOpacity style={cs.shutter} onPress={handleReceiptCapture}>
                        <View style={cs.shutterInner} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleReceiptGallery}>
                        <Text style={[cs.switchTxt, { color: OB.muted }]}>Or upload from gallery</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </CameraView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
              <Text style={{ fontSize: 48 }}>{activeFlow === "fridge" ? "📷" : "🧾"}</Text>
              <Text style={{ color: "#fff", fontSize: 16, textAlign: "center", paddingHorizontal: 40 }}>Camera is only available on a real device.{"\n"}Tap Done to add mock items.</Text>
              <TouchableOpacity style={[cs.doneBtn, { backgroundColor: OB.blue }]} onPress={activeFlow === "fridge" ? handleDoneScan : handleReceiptCapture}>
                <Text style={cs.doneTxt}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Close button */}
          <TouchableOpacity style={cs.closeBtn} onPress={() => { stopScanTimer(); setShowCamera(false); }}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── 3. REVIEW MODAL ── */}
      <Modal visible={showReview} animationType="slide" statusBarTranslucent>
        <View style={[rv.container, { backgroundColor: OB.bg }]}>
          <View style={[rv.header, { borderBottomColor: OB.border, paddingTop: insets.top + 16 }]}>
            <Text style={[rv.title, { color: OB.text }]}>{reviewTitle}</Text>
            <Text style={[rv.sub, { color: OB.muted }]}>Edit anything that looks wrong, then add to your pantry.</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }}>
            {reviewItems.map((item, i) => (
              <View key={item.id} style={[rv.row, { backgroundColor: OB.card, borderColor: OB.border }]}>
                <Text style={{ fontSize: 28, marginRight: 10 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[rv.itemName, { color: OB.text }]}>{item.name}</Text>
                  <Text style={[rv.itemMeta, { color: OB.muted }]}>{item.qty} {item.unit} · {item.category}</Text>
                </View>
                <TouchableOpacity onPress={() => setReviewItems((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Feather name="trash-2" size={18} color={OB.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={[rv.footer, { borderTopColor: OB.border, paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[rv.addBtn, { backgroundColor: reviewItems.length === 0 ? OB.border : OB.blue }]}
              onPress={confirmReview}
              disabled={reviewItems.length === 0}
            >
              <Text style={rv.addTxt}>Add {reviewItems.length} Item{reviewItems.length !== 1 ? "s" : ""} to Pantry →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 4. MANUAL ENTRY MODAL ── */}
      <Modal visible={showManualEntry} animationType="slide" statusBarTranslucent>
        <View style={[me.container, { backgroundColor: OB.bg }]}>
          <View style={[me.header, { borderBottomColor: OB.border, paddingTop: insets.top + 16 }]}>
            <Text style={[me.title, { color: OB.text }]}>✏️  Type It In</Text>
            <TouchableOpacity onPress={() => setShowManualEntry(false)}>
              <Feather name="x" size={22} color={OB.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
            <TextInput
              style={[me.input, { backgroundColor: OB.card, borderColor: OB.border, color: OB.text }]}
              placeholder="Ingredient name" placeholderTextColor={OB.muted}
              value={manualName} onChangeText={setManualName}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[me.input, { flex: 1, backgroundColor: OB.card, borderColor: OB.border, color: OB.text }]}
                placeholder="Qty" placeholderTextColor={OB.muted} keyboardType="numeric"
                value={manualQty} onChangeText={setManualQty}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 2 }} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
                {UNITS.map((u) => (
                  <TouchableOpacity key={u} style={[me.chip, { backgroundColor: manualUnit === u ? OB.blue : OB.card, borderColor: manualUnit === u ? OB.blue : OB.border }]} onPress={() => setManualUnit(u)}>
                    <Text style={[me.chipTxt, { color: manualUnit === u ? "#fff" : OB.text }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[me.chip, { backgroundColor: manualCategory === c ? OB.blue : OB.card, borderColor: manualCategory === c ? OB.blue : OB.border }]} onPress={() => setManualCategory(c)}>
                  <Text style={[me.chipTxt, { color: manualCategory === c ? "#fff" : OB.text }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[me.addItemBtn, { backgroundColor: manualName.trim() ? OB.blue : OB.border }]} onPress={addManualItem} disabled={!manualName.trim()}>
              <Text style={me.addItemTxt}>+ Add Item</Text>
            </TouchableOpacity>
            {manualAdded.length > 0 && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={[me.listHeader, { color: OB.muted }]}>Added items ({manualAdded.length})</Text>
                {manualAdded.map((item, i) => (
                  <View key={item.id} style={[me.addedRow, { backgroundColor: OB.card, borderColor: OB.border }]}>
                    <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                    <Text style={[me.addedName, { color: OB.text, flex: 1 }]}>{item.name} · {item.qty} {item.unit}</Text>
                    <TouchableOpacity onPress={() => setManualAdded((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Feather name="x" size={16} color={OB.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={[me.footer, { borderTopColor: OB.border, paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[me.doneBtn, { backgroundColor: manualAdded.length === 0 ? OB.border : OB.blue }]}
              onPress={confirmManual}
              disabled={manualAdded.length === 0}
            >
              <Text style={me.doneTxt}>Done — Add {manualAdded.length} Item{manualAdded.length !== 1 ? "s" : ""} to Pantry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 5. SKIP CONFIRM MODAL ── */}
      <Modal visible={showSkipConfirm} transparent animationType="slide" statusBarTranslucent>
        <View style={pm.overlay}>
          <View style={[pm.card, { backgroundColor: OB.card, borderColor: OB.border }]}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🤔</Text>
            <Text style={[pm.title, { color: OB.text }]}>You sure?</Text>
            <Text style={[pm.body, { color: OB.muted }]}>No worries! Head to the Pantry tab anytime to add ingredients. Your recipe suggestions will improve as you add more.</Text>
            <TouchableOpacity style={[pm.allowBtn, { backgroundColor: OB.blue }]} onPress={() => { setShowSkipConfirm(false); goNext(); }}>
              <Text style={pm.allowTxt}>Yes, skip for now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pm.notNowBtn} onPress={() => setShowSkipConfirm(false)}>
              <Text style={[pm.notNowTxt, { color: OB.blue }]}>Actually, let me add some</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

type OBType = {
  bg: string; card: string; blue: string; blueLight: string; text: string;
  muted: string; border: string; error: string; success: string; amber: string;
  amberLight: string; red: string; redLight: string; redBorder: string;
};

function makeStyles(OB: OBType) {
  return StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: { width: 52, height: 36, alignItems: "center", justifyContent: "center" },
  progressTrack: { flex: 1, height: 4, backgroundColor: OB.border, borderRadius: 999, marginRight: 16 },
  progressFill: { height: 4, backgroundColor: OB.blue, borderRadius: 999 },
  skipText: { fontSize: 14, fontWeight: "500" },

  slidesWrap: { flex: 1, flexDirection: "row", width: width * TOTAL_STEPS },
  slide: { width },
  slideContent: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 20 },

  bigEmoji: { fontSize: 48, marginBottom: 10 },
  stepTitle: { fontSize: 28, fontWeight: "800", color: OB.text, letterSpacing: -0.8, lineHeight: 36, marginBottom: 8 },
  stepSub: { fontSize: 15, color: OB.muted, lineHeight: 22, marginBottom: 20 },
  noteText: { fontSize: 13, color: OB.muted, marginBottom: 14 },
  errMsg: { fontSize: 13, color: OB.error, marginBottom: 8, marginTop: 2 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: OB.text, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: OB.border, borderRadius: 14, backgroundColor: OB.card, paddingRight: 12, marginBottom: 14 },
  inputRowError: { borderColor: OB.error },
  inputField: { flex: 1, height: 52, paddingHorizontal: 16, fontSize: 16, color: OB.text },
  pwChecklist: { gap: 5, marginBottom: 14 },
  pwCheckRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pwCheckText: { fontSize: 12 },

  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: OB.border, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  checkboxOn: { backgroundColor: OB.blue, borderColor: OB.blue },
  termsText: { flex: 1, fontSize: 14, color: OB.muted, lineHeight: 20 },

  hhRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  hhPill: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: OB.border, backgroundColor: OB.card, alignItems: "center", justifyContent: "center" },
  hhPillOn: { backgroundColor: OB.blue, borderColor: OB.blue },
  hhPillText: { fontSize: 17, fontWeight: "700", color: OB.text },
  hhPillTextOn: { color: "#fff" },
  hhCard: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: OB.border, backgroundColor: OB.blueLight },
  hhCardText: { fontSize: 15, fontWeight: "600", color: OB.blue, lineHeight: 22 },

  cardStack: { gap: 10 },
  selectCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: OB.border, backgroundColor: OB.card },
  selectCardOn: { borderColor: OB.blue, backgroundColor: OB.blueLight },
  cardIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: OB.text, marginBottom: 3 },
  cardDesc: { fontSize: 13, color: OB.muted, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: OB.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  radioOn: { borderColor: OB.blue, backgroundColor: OB.blue },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },

  dietGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dietCard: { width: (width - 68) / 2, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: OB.border, backgroundColor: OB.card, alignItems: "center", position: "relative" },
  dietCardOn: { borderColor: OB.blue, backgroundColor: OB.blueLight },
  dietLabel: { fontSize: 14, fontWeight: "700", color: OB.text, textAlign: "center", marginBottom: 4 },
  dietDesc: { fontSize: 11, color: OB.muted, textAlign: "center", lineHeight: 15 },
  dietCheckBadge: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: OB.blue, alignItems: "center", justifyContent: "center" },

  allergyWarningBox: { backgroundColor: OB.amberLight, borderLeftWidth: 4, borderLeftColor: OB.amber, borderRadius: 12, padding: 12, marginBottom: 14 },
  allergyWarningText: { fontSize: 13, color: OB.amber, lineHeight: 18 },
  allergyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  allergyChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: OB.border, backgroundColor: OB.card },
  allergyChipOn: { backgroundColor: OB.redLight, borderColor: OB.redBorder },
  allergyLabel: { fontSize: 13, fontWeight: "600", color: OB.text },
  allergyLabelOn: { color: OB.red },
  swapCard: { backgroundColor: OB.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: OB.border },
  swapTitle: { fontSize: 13, fontWeight: "700", color: OB.text, marginBottom: 6 },
  swapItem: { fontSize: 12, color: OB.muted, lineHeight: 18 },

  cuisineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cuisineCount: { fontSize: 14, fontWeight: "600" },
  cuisineAction: { fontSize: 13, fontWeight: "600" },
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cuisineCard: { width: (width - 68) / 3, paddingVertical: 18, borderRadius: 16, borderWidth: 1.5, borderColor: OB.border, backgroundColor: OB.card, alignItems: "center", position: "relative" },
  cuisineCardOn: { borderColor: OB.blue, backgroundColor: OB.blueLight },
  cuisineCheckBadge: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: OB.blue, alignItems: "center", justifyContent: "center" },
  cuisineName: { fontSize: 12, fontWeight: "600", color: OB.text, textAlign: "center" },

  pantryList: { gap: 12 },
  pantryOption: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: OB.border, backgroundColor: OB.card },
  pantryIconBox: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pantryOptTitle: { fontSize: 15, fontWeight: "700", color: OB.text, marginBottom: 2 },
  pantryOptDesc: { fontSize: 13, color: OB.muted, lineHeight: 18 },

  bottom: { paddingHorizontal: 24, paddingTop: 8 },
  ctaBtn: { height: 56, borderRadius: 16, backgroundColor: OB.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaBtnOff: { backgroundColor: OB.border },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  ctaTextOff: { color: OB.muted },

  loadScreen: { flex: 1, backgroundColor: OB.bg, alignItems: "center", justifyContent: "center" },
  loadContent: { width: "100%", paddingHorizontal: 40, alignItems: "center" },
  loadTitle: { fontSize: 24, fontWeight: "800", color: OB.text, letterSpacing: -0.5, marginBottom: 28 },
  foodRow: { flexDirection: "row", gap: 14, marginBottom: 0 },
  foodEmoji: { fontSize: 28 },
  wokEmoji: { fontSize: 60, marginTop: 8, marginBottom: 32 },
  loadTrack: { width: "100%", height: 4, backgroundColor: OB.border, borderRadius: 999, marginBottom: 18, overflow: "hidden" },
  loadFill: { height: 4, backgroundColor: OB.blue, borderRadius: 999 },
  loadMsg: { fontSize: 15, color: OB.muted, textAlign: "center" },
  doneWrap: { alignItems: "center", gap: 16 },
  doneEmoji: { fontSize: 72 },
  doneText: { fontSize: 26, fontWeight: "800", color: OB.text, letterSpacing: -0.5 },
  });
}
