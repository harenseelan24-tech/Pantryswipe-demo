import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { PantryItem, Recipe } from "@/data/mockData";
import { lookupBarcode, type BarcodeProduct } from "@/services/barcodeService";
import ScanReceiptModal from "@/components/ScanReceiptModal";
import ConfirmationEditScreen from "@/components/ConfirmationEditScreen";
import { getItemEmoji } from "@/utils/emojiLookup";
import type { DetectedItem } from "@/types/scanning";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Brand palette (matches Profile light design) ──────────────────────────────
const C = {
  primary:     "#F5A623",
  secondary:   "#4CAF76",
  textPrimary: "#141210",
  textMuted:   "#7A7570",
  surface:     "#FFFFFF",
  background:  "#FAFAF8",
  surfaceLow:  "#F5F3EF",
  surfaceHigh: "#E8E4DE",
  skipRed:     "#E84040",
  saveBlue:    "#5B8EF5",
};

const CATEGORIES = ["All", "Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;
const UNITS = ["g", "kg", "ml", "L", "cups", "pieces", "tbsp", "tsp", "cans", "slices", "cloves", "bunches"];
const CATEGORY_ITEMS = ["Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;

const STATUS_BG: Record<string, string> = {
  Fresh: "#E8F7EF",
  "Use Soon": "#FFF8EB",
  Expiring: "#FDEAEA",
  Expired: "#F5F3EF",
};
const STATUS_BG_DARK: Record<string, string> = {
  Fresh: "rgba(76,175,118,0.18)",
  "Use Soon": "rgba(245,166,35,0.18)",
  Expiring: "rgba(232,64,64,0.18)",
  Expired: "rgba(160,152,144,0.12)",
};
const STATUS_TEXT: Record<string, string> = {
  Fresh: "#2E8A57",
  "Use Soon": "#B87A10",
  Expiring: "#C43030",
  Expired: "#6B6560",
};
const STATUS_DOT: Record<string, string> = {
  Fresh: "#4CAF76",
  "Use Soon": "#F5A623",
  Expiring: "#E84040",
  Expired: "#A09890",
};

const CUISINE_EMOJIS: Record<string, string> = {
  Italian: "🍝", Japanese: "🍜", Korean: "🥘", Mexican: "🌮",
  Indian: "🍛", Chinese: "🥡", Thai: "🍲", American: "🍔",
  French: "🥐", Mediterranean: "🫒", "Middle Eastern": "🧆", Vietnamese: "🍜",
};

const RECIPE_GROUPS = [
  { label: "⚡ Quick & Easy", filter: (r: Recipe) => r.prepTime + r.cookTime <= 20 },
  { label: "💪 High Protein", filter: (r: Recipe) => r.nutrition.protein >= 25 },
  { label: "🥗 Light & Healthy", filter: (r: Recipe) => r.calories <= 450 },
  { label: "🍲 Comfort Food", filter: (r: Recipe) => r.calories > 450 && r.rating >= 4.7 },
  { label: "🌱 Plant-Based", filter: (r: Recipe) => r.tags.some((t) => t.includes("vegan") || t.includes("vegetarian")) },
];

type BarcodePhase = "camera" | "loading" | "found" | "not_found";

function mapToAppCategory(category?: string | null): typeof CATEGORY_ITEMS[number] {
  if (!category) return "Pantry";
  const l = category.toLowerCase();
  if (l.includes("dairy") || l.includes("milk") || l.includes("yogurt") || l.includes("cheese") || l.includes("beverage") || l.includes("drink") || l.includes("juice") || l.includes("beer") || l.includes("wine") || l.includes("soda")) return "Fridge";
  if (l.includes("frozen") || l.includes("ice cream")) return "Freezer";
  if (l.includes("spice") || l.includes("herb") || l.includes("seasoning") || l.includes("salt") || l.includes("pepper")) return "Spices";
  if (l.includes("sauce") || l.includes("condiment") || l.includes("ketchup") || l.includes("mustard") || l.includes("dressing") || l.includes("vinegar")) return "Sauces";
  if (l.includes("fruit") || l.includes("vegetable") || l.includes("produce") || l.includes("fresh") || l.includes("plant")) return "Produce";
  return "Pantry";
}

function categoryToEmoji(cat: typeof CATEGORY_ITEMS[number]): string {
  const map: Record<typeof CATEGORY_ITEMS[number], string> = {
    Fridge: "🧊", Freezer: "❄️", Pantry: "🥫", Spices: "🌶️", Sauces: "🫙", Produce: "🥦",
  };
  return map[cat] ?? "🛒";
}

// ── Expiry helpers ────────────────────────────────────────────────────────────
const CATEGORY_SHELF_DAYS: Record<string, number> = {
  Fridge: 10, Produce: 7, Freezer: 90, Pantry: 180, Spices: 365, Sauces: 120, Beverages: 30,
};

function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCountdown(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`;
  if (days === 0) return "⚡ Expires today!";
  if (days === 1) return "⏰ 1 day left";
  return `⏱ ${days} days left`;
}

function isNearExpiry(item: PantryItem): boolean {
  if (item.status === "Expired") return true;
  if (!item.expiryDate) return item.status === "Expiring";
  const daysLeft = getDaysUntilExpiry(item.expiryDate);
  if (daysLeft < 0) return true;
  const shelfLife = CATEGORY_SHELF_DAYS[item.category] ?? 30;
  return daysLeft <= Math.max(2, Math.floor(shelfLife * 0.25));
}

// ── Card design helpers ───────────────────────────────────────────────────────
const CATEGORY_TINTS: Record<string, string> = {
  Fridge:    "rgba(245, 166, 35, 0.10)",
  Freezer:   "rgba(91, 142, 245, 0.10)",
  Pantry:    "rgba(245, 166, 35, 0.08)",
  Spices:    "rgba(232, 64, 64, 0.08)",
  Sauces:    "rgba(232, 64, 64, 0.08)",
  Produce:   "rgba(76, 175, 118, 0.12)",
  Beverages: "rgba(91, 142, 245, 0.10)",
  default:   "rgba(200, 196, 190, 0.15)",
};

const STATUS_COLORS: Record<string, string> = {
  Fresh:      "#4CAF76",
  "Use Soon": "#F5A623",
  Expiring:   "#E84040",
  Expired:    "#A09890",
};

const CAT_EMOJI: Record<string, string> = {
  All: "✦", Fridge: "🧊", Freezer: "❄️", Pantry: "🥫", Spices: "🌶️", Sauces: "🫙", Produce: "🥦",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#A09890";
}

const cardShadow = Platform.select({
  ios:     { shadowColor: "#835500", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 },
  android: { elevation: 2 },
  default: {},
}) as object;

const fabShadow = Platform.select({
  ios:     { shadowColor: "#F5A623", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14 },
  android: { elevation: 8 },
  default: {},
}) as object;

// ── SwipeableRow ──────────────────────────────────────────────────────────────
function SwipeableRow({
  children,
  onDelete,
  colors,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const REVEAL = 80;
  const pr = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) tx.setValue(Math.max(g.dx, -REVEAL));
      },
      onPanResponderRelease: (_, g) => {
        Animated.spring(tx, {
          toValue: g.dx < -REVEAL / 2 ? -REVEAL : 0,
          useNativeDriver: Platform.OS !== "web",
        }).start();
      },
    })
  ).current;

  return (
    <View style={{ overflow: "hidden", borderRadius: 16 }}>
      <View
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: REVEAL,
          backgroundColor: "#E84040", alignItems: "center", justifyContent: "center",
          borderTopRightRadius: 16, borderBottomRightRadius: 16,
        }}
      >
        <TouchableOpacity
          style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 4 }}
          onPress={() => { Animated.spring(tx, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start(); onDelete(); }}
        >
          <Feather name="trash-2" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Inter_500Medium" }}>Remove</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pr.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ── PantryCard ────────────────────────────────────────────────────────────────
type ColorsType = ReturnType<typeof import("@/hooks/useColors").useColors>;

function StatusRow({ status, statusColor }: { status: string; statusColor: string }) {
  return (
    <View style={cardStyles.statusRow}>
      <View style={[cardStyles.statusDotSmall, { backgroundColor: statusColor }]} />
      <Text style={[cardStyles.statusLabel, { color: statusColor }]}>{status}</Text>
    </View>
  );
}

const PantryCard = React.memo(function PantryCard({
  item,
  onDelete,
  colors,
}: {
  item: PantryItem;
  onDelete: () => void;
  colors: ColorsType;
}) {
  const tint = CATEGORY_TINTS[item.category] ?? CATEGORY_TINTS.default;
  const statusColor = getStatusColor(item.status);
  return (
    <View style={[cardStyles.card, cardShadow, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceHigh }]}>
      <View style={[cardStyles.statusDot, { backgroundColor: statusColor }]} />
      <View style={[cardStyles.iconCircle, { backgroundColor: tint }]}>
        <Text style={cardStyles.cardEmoji}>{item.emoji}</Text>
      </View>
      <Text style={[cardStyles.itemName, { color: C.textPrimary }]} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[cardStyles.itemQty, { color: C.textMuted }]}>
        {item.quantity} {item.unit}
      </Text>
      <View style={cardStyles.cardBottom}>
        <StatusRow status={item.status} statusColor={statusColor} />
        <TouchableOpacity
          style={cardStyles.actionIcon}
          onPress={onDelete}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Feather name="trash-2" size={14} color={C.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    margin: 6,
    position: "relative",
  },
  statusDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardEmoji: { fontSize: 26 },
  itemName: {
    fontSize: 14,
    fontFamily: "Epilogue_700Bold",
    lineHeight: 20,
    marginBottom: 2,
  },
  itemQty: {
    fontSize: 12,
    fontFamily: "Epilogue_400Regular",
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontFamily: "Epilogue_400Regular", fontWeight: "600" },
  actionIcon: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PantryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pantryItems, addToPantry, removeFromPantry, getPantryMatchScore, liveRecipes } = useApp();

  const isDark = colors.background === "#07101E";

  const [showWhatCanIMake, setShowWhatCanIMake] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddChoiceModal, setShowAddChoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showReceiptConfirm, setShowReceiptConfirm] = useState(false);
  const [scannedReceiptItems, setScannedReceiptItems] = useState<DetectedItem[]>([]);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [restoredItems, setRestoredItems] = useState<Set<string>>(new Set());
  const [showUncheckedWarning, setShowUncheckedWarning] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("pieces");
  const [newItemCategory, setNewItemCategory] = useState<typeof CATEGORY_ITEMS[number]>("Pantry");

  // Barcode scanner state machine
  const [barcodePhase, setBarcodePhase] = useState<BarcodePhase>("camera");
  const [barcodeStatusMsg, setBarcodeStatusMsg] = useState("Searching Database");
  const [foundProduct, setFoundProduct] = useState<BarcodeProduct | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [barcodeQty, setBarcodeQty] = useState("1");
  const [barcodeUnit, setBarcodeUnit] = useState("pieces");
  const [barcodeExpiry, setBarcodeExpiry] = useState("");
  const [barcodeCategory, setBarcodeCategory] = useState<typeof CATEGORY_ITEMS[number]>("Pantry");
  // Manual entry fallback
  const [manualName, setManualName] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCategory, setManualCategory] = useState<typeof CATEGORY_ITEMS[number]>("Pantry");
  const [manualExpiry, setManualExpiry] = useState("");

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const barcodeScanLock = useRef(false);

  const TAB_BAR_H = Platform.OS === "web" ? 68 : 60;
  const NATIVE_DRIVER = Platform.OS !== "web";
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  // Animate scan line while camera is live
  useEffect(() => {
    if (!showBarcodeModal || barcodePhase !== "camera") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [showBarcodeModal, barcodePhase]);

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 180] });

  const filtered = pantryItems.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const expiringItems = pantryItems.filter(isNearExpiry);

  const isLowStock = (item: PantryItem): boolean => {
    if (item.quantity === 0) return false;
    const unit = item.unit.toLowerCase().trim();
    if (["g", "gram", "grams", "gr"].includes(unit)) return item.quantity < 50;
    if (["kg", "kilogram", "kilograms"].includes(unit)) return item.quantity < 0.2;
    if (["ml", "milliliter", "milliliters"].includes(unit)) return item.quantity < 50;
    if (["l", "liter", "liters"].includes(unit)) return item.quantity < 0.25;
    return item.quantity <= 1;
  };
  const ranOutItems = pantryItems.filter((i) => i.quantity === 0);
  const lowStockItems = pantryItems.filter(isLowStock);
  const allRestockNeeded = [
    ...ranOutItems,
    ...lowStockItems.filter((i) => !ranOutItems.some((r) => r.id === i.id)),
  ];
  const needRestockItems = allRestockNeeded.filter((i) => !restoredItems.has(i.id));
  const activeRanOut = ranOutItems.filter((i) => !restoredItems.has(i.id));

  const completeRecipes = liveRecipes.filter((r) => getPantryMatchScore(r) >= 80).length;
  const oneIngredientAway = liveRecipes.filter((r) => {
    const names = pantryItems.map((p) => p.name.toLowerCase());
    const missing = r.ingredients.filter(
      (ing) => !names.some((n) => n.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(n))
    );
    return missing.length === 1;
  }).length;
  const freshPct = pantryItems.length > 0
    ? Math.round(pantryItems.filter((i) => i.status === "Fresh").length / pantryItems.length * 100)
    : 100;
  const expiringWithin3 = pantryItems.filter((i) => {
    if (!i.expiryDate) return false;
    const d = getDaysUntilExpiry(i.expiryDate);
    return d >= 0 && d <= 3;
  }).length;
  const matchableRecipes = liveRecipes
    .map((r) => ({ recipe: r, score: getPantryMatchScore(r) }))
    .filter(({ score }) => score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const newItem: PantryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: newItemName.trim(),
      quantity: parseFloat(newItemQty) || 1,
      unit: newItemUnit,
      category: newItemCategory,
      status: "Fresh",
      emoji: getItemEmoji(newItemName.trim(), newItemCategory),
    };
    addToPantry(newItem);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemUnit("pieces");
    setShowAddModal(false);
  };

  // ── Barcode lookup helpers ──────────────────────────────────────────────

  const resetBarcodeModal = () => {
    barcodeScanLock.current = false;
    setBarcodePhase("camera");
    setBarcodeStatusMsg("Searching Database");
    setFoundProduct(null);
    setScannedBarcode("");
    setBarcodeQty("1");
    setBarcodeUnit("pieces");
    setBarcodeExpiry("");
    setBarcodeCategory("Pantry");
    setManualName("");
    setManualBrand("");
    setManualCategory("Pantry");
    setManualExpiry("");
  };

  const doLookup = async (barcode: string) => {
    setScannedBarcode(barcode);
    setBarcodePhase("loading");
    setBarcodeStatusMsg("Searching Database");

    const STATUS_SEQUENCE = [
      "Searching Database",
      "Searching Open Food Facts",
      "Searching UPCitemDB",
    ] as const;
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, STATUS_SEQUENCE.length - 1);
      setBarcodeStatusMsg(STATUS_SEQUENCE[msgIdx]);
    }, 1800);

    try {
      const product = await lookupBarcode(barcode);
      clearInterval(interval);
      if (product) {
        const cat = mapToAppCategory(product.category);
        setFoundProduct(product);
        setBarcodeCategory(cat);
        setBarcodePhase("found");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setBarcodePhase("not_found");
      }
    } catch {
      clearInterval(interval);
      setBarcodePhase("not_found");
    }
  };

  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    if (barcodeScanLock.current || barcodePhase !== "camera") return;
    barcodeScanLock.current = true;
    doLookup(data);
  };

  const handleDemoScan = () => {
    if (barcodeScanLock.current) return;
    barcodeScanLock.current = true;
    // Coca-Cola Original 330ml — real Open Food Facts barcode
    doLookup("5000159407236");
  };

  const handleAddFound = () => {
    if (!foundProduct) return;
    const newItem: PantryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: foundProduct.name,
      quantity: parseFloat(barcodeQty) || 1,
      unit: barcodeUnit,
      category: barcodeCategory,
      status: "Fresh",
      emoji: getItemEmoji(foundProduct.name, barcodeCategory),
    };
    addToPantry(newItem);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowBarcodeModal(false);
    resetBarcodeModal();
  };

  const handleReceiptScanDone = (items: DetectedItem[]) => {
    setShowReceiptModal(false);
    setScannedReceiptItems(items);
    setShowReceiptConfirm(true);
  };

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    const newItem: PantryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: manualName.trim(),
      quantity: 1,
      unit: "pieces",
      category: manualCategory,
      status: "Fresh",
      emoji: getItemEmoji(manualName.trim(), manualCategory),
    };
    addToPantry(newItem);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowBarcodeModal(false);
    resetBarcodeModal();
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* ── MAIN GRID ── */}
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PantryCard
            item={item}
            colors={colors}
            onDelete={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              removeFromPantry(item.id);
            }}
          />
        )}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <View>
            {/* ── HEADER ── */}
            <View style={[styles.header, { paddingTop: topPadding + 6 }]}>
              <View>
                <Text style={[styles.headerTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
                  My Pantry
                </Text>
                <Text style={[styles.headerSub, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                  {pantryItems.length} items tracked
                </Text>
              </View>
              <View style={styles.headerBtns}>
                <TouchableOpacity
                  style={[styles.scanBtn, { backgroundColor: C.surface, borderColor: C.surfaceHigh, borderWidth: 1 }]}
                  onPress={() => { resetBarcodeModal(); setShowBarcodeModal(true); }}
                >
                  <Feather name="camera" size={18} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: C.primary }]}
                  onPress={() => setShowAddChoiceModal(true)}
                >
                  <Feather name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── SEARCH ── */}
            <View style={[styles.searchContainer, { backgroundColor: C.surfaceLow, borderColor: C.surfaceHigh }]}>
              <Feather name="search" size={15} color={C.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: C.textPrimary, fontFamily: "Epilogue_400Regular" }]}
                placeholder="Search ingredients…"
                placeholderTextColor={C.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Feather name="x" size={15} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* ── EXPIRY ALERT ── */}
            {expiringItems.length > 0 && (
              <TouchableOpacity
                style={styles.expiryAlertWrap}
                onPress={() => setShowExpiryModal(true)}
                activeOpacity={0.85}
              >
                <View style={styles.expiryAlertAccent} />
                <View style={styles.expiryAlertBody}>
                  <Text style={{ fontSize: 14 }}>⚠️</Text>
                  <Text style={[styles.expiryAlertText, { fontFamily: "Inter_600SemiBold" }]}>
                    {expiringItems.length} {expiringItems.length === 1 ? "item" : "items"} expiring soon
                  </Text>
                  <Text style={[styles.expiryViewLink, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>
                    View →
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── LOW STOCK ALERT ── */}
            {needRestockItems.length > 0 && (
              <TouchableOpacity
                style={styles.lowStockBanner}
                onPress={() => { setShowLowStockModal(true); setShowUncheckedWarning(false); }}
                activeOpacity={0.85}
              >
                <View style={styles.lowStockAccent} />
                <View style={styles.lowStockBody}>
                  <Text style={{ fontSize: 14 }}>{activeRanOut.length > 0 ? "⚠️" : "📉"}</Text>
                  <Text style={[styles.lowStockText, { fontFamily: "Inter_400Regular" }]}>
                    <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                      {needRestockItems.length} item{needRestockItems.length !== 1 ? "s" : ""}
                      {activeRanOut.length > 0 ? ` · ${activeRanOut.length} ran out` : " running low"}
                    </Text>{" "}— tap to build your shopping list
                  </Text>
                  <Text style={[styles.lowStockLink, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>
                    List →
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── PANTRY INTELLIGENCE BANNER ── */}
            <LinearGradient
              colors={["#F5A623", "#E8C46A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <Text style={styles.bannerLabel}>PANTRY INTELLIGENCE</Text>
              <Text style={styles.bannerHeadline}>
                {completeRecipes} recipe{completeRecipes !== 1 ? "s" : ""} ready to cook
              </Text>
              <Text style={styles.bannerBody}>
                {oneIngredientAway > 0
                  ? `${oneIngredientAway} more just 1 ingredient away`
                  : "Your pantry is well stocked"}
                {expiringWithin3 > 0
                  ? ` · ⚠️ ${expiringWithin3} expiring soon`
                  : ` · ${freshPct}% fresh`}
              </Text>
            </LinearGradient>

            {/* ── WHAT CAN I MAKE ── */}
            <TouchableOpacity
              style={[styles.whatCanIMakeCard, { backgroundColor: C.surface, borderColor: C.surfaceHigh }]}
              onPress={() => { setShowWhatCanIMake(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.85}
            >
              <View style={[styles.whatCanIMakeIcon, { backgroundColor: C.primary + "20" }]}>
                <Text style={{ fontSize: 22 }}>🍳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.whatCanIMakeEyebrow, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>
                  PANTRY MATCH
                </Text>
                <Text style={[styles.whatCanIMakeTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
                  What Can I Make?
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                  <Text style={[styles.whatCanIMakeCount, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>
                    {matchableRecipes.length}
                  </Text>
                  <Text style={[styles.whatCanIMakeSub, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                    dishes you can cook now
                  </Text>
                </View>
              </View>
              <View style={[styles.stickyChevron, { backgroundColor: C.primary + "18" }]}>
                <Feather name="chevron-right" size={16} color={C.primary} />
              </View>
            </TouchableOpacity>

            {/* ── CATEGORY TABS ── */}
            <View style={{ height: 50, overflow: "hidden" }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={styles.categoriesContainer}
              >
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryTab,
                        isActive
                          ? { backgroundColor: C.textPrimary, borderColor: C.textPrimary }
                          : { backgroundColor: C.surfaceLow, borderColor: C.surfaceHigh },
                      ]}
                      onPress={() => setActiveCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryTabText,
                          {
                            color: isActive ? C.background : C.textMuted,
                            fontFamily: isActive ? "Epilogue_700Bold" : "Epilogue_400Regular",
                          },
                        ]}
                      >
                        {CAT_EMOJI[cat]} {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── SECTION HEADER ── */}
            <View style={styles.sectionRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>My Pantry</Text>
                <Text style={[styles.sectionSubtitle, { color: C.textMuted }]}>
                  {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.surfaceLow, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
              <Feather name="shopping-bag" size={32} color={C.textMuted} />
            </View>
            <Text style={[styles.emptyText, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
              No items in {activeCategory === "All" ? "pantry" : activeCategory}
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular", textAlign: "center" }}>
              Add your first ingredient to get started
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: C.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={[styles.emptyBtnText, { fontFamily: "Epilogue_700Bold" }]}>Add Item</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingBottom: TAB_BAR_H + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, fabShadow]}
        onPress={() => setShowAddChoiceModal(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ── "WHAT CAN I MAKE?" BOTTOM SHEET ── */}
      <Modal
        visible={showWhatCanIMake}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWhatCanIMake(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowWhatCanIMake(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: C.background }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.surfaceHigh }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
                What Can I Make?
              </Text>
              <View style={[styles.sheetCountPill, { backgroundColor: C.primary + "18" }]}>
                <Text style={[styles.sheetCountText, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>
                  {matchableRecipes.length} dishes
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWhatCanIMake(false)} style={{ marginLeft: "auto" }}>
                <Feather name="x" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {RECIPE_GROUPS.map((group) => {
                const groupItems = matchableRecipes.filter(({ recipe }) => group.filter(recipe));
                if (groupItems.length === 0) return null;
                return (
                  <View key={group.label} style={styles.sheetGroup}>
                    <Text style={[styles.sheetGroupLabel, { color: C.textMuted, fontFamily: "Epilogue_700Bold" }]}>
                      {group.label}
                    </Text>
                    {groupItems.slice(0, 5).map(({ recipe, score }) => (
                      <TouchableOpacity
                        key={recipe.id}
                        style={[styles.sheetRow, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceHigh }]}
                        onPress={() => { setShowWhatCanIMake(false); router.push(`/recipe/${recipe.id}`); }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.sheetRowIcon, { backgroundColor: C.surfaceLow }]}>
                          <Text style={{ fontSize: 20 }}>{CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sheetRowName, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]} numberOfLines={1}>
                            {recipe.title}
                          </Text>
                          <Text style={[styles.sheetRowMeta, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                            {recipe.ingredients.filter((i) => i.inPantry).length}/{recipe.ingredients.length} ingredients · {recipe.prepTime + recipe.cookTime} min
                          </Text>
                        </View>
                        <View style={[styles.sheetScore, { backgroundColor: score >= 80 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" }]}>
                          <Text style={[styles.sheetScoreText, { color: score >= 80 ? "#059669" : "#D97706", fontFamily: "Epilogue_700Bold" }]}>
                            ✓ {score}%
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={14} color={C.textMuted} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ADD ITEM MODAL ── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddModal(false)}>
        <View style={[styles.modal, { backgroundColor: C.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: C.surfaceHigh }]} />
          <Text style={[styles.modalTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Add Pantry Item</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
            <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Ingredient name</Text>
            <TextInput
              style={[styles.modalInput, { color: C.textPrimary, borderColor: C.surfaceHigh, backgroundColor: C.surface, fontFamily: "Epilogue_400Regular" }]}
              placeholder="e.g. Chicken Breast"
              placeholderTextColor={C.textMuted}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Quantity</Text>
                <TextInput
                  style={[styles.modalInput, { color: C.textPrimary, borderColor: C.surfaceHigh, backgroundColor: C.surface, fontFamily: "Epilogue_400Regular" }]}
                  placeholder="1"
                  placeholderTextColor={C.textMuted}
                  value={newItemQty}
                  onChangeText={setNewItemQty}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitScroll}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitPill, { backgroundColor: newItemUnit === u ? C.primary : C.surfaceLow, borderColor: newItemUnit === u ? C.primary : C.surfaceHigh }]}
                      onPress={() => setNewItemUnit(u)}
                    >
                      <Text style={[styles.unitPillText, { color: newItemUnit === u ? "#fff" : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_ITEMS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, { backgroundColor: newItemCategory === cat ? C.primary : C.surfaceLow, borderColor: newItemCategory === cat ? C.primary : C.surfaceHigh }]}
                  onPress={() => setNewItemCategory(cat)}
                >
                  <Text style={[styles.categoryPillText, { color: newItemCategory === cat ? "#fff" : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.surfaceLow }]} onPress={() => setShowAddModal(false)}>
              <Text style={[styles.modalBtnText, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.primary }]} onPress={handleAddItem}>
              <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Epilogue_700Bold" }]}>Add to Pantry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── EXPIRY MODAL ── */}
      <Modal visible={showExpiryModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowExpiryModal(false)}>
        <View style={[styles.modal, { backgroundColor: C.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: C.surfaceHigh }]} />

          {/* ── Header ── */}
          <View style={[styles.expiryModalAccentBar, { backgroundColor: "#EF4444" }]} />
          <View style={styles.expiryModalHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <View style={[styles.intelligenceEyebrowDot, { backgroundColor: "#EF4444" }]} />
                <Text style={{ fontSize: 10, letterSpacing: 1, fontFamily: "Epilogue_700Bold", color: "#EF4444" }}>USE THESE FIRST</Text>
              </View>
              <Text style={[styles.modalTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold", marginBottom: 0 }]}>
                Expiring Soon
              </Text>
            </View>
            <View style={[styles.expiryCountPill, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
              <Text style={{ fontSize: 13, fontFamily: "Epilogue_700Bold", color: "#DC2626" }}>{expiringItems.length}</Text>
              <Text style={{ fontSize: 11, fontFamily: "Epilogue_400Regular", color: "#EF4444" }}> item{expiringItems.length !== 1 ? "s" : ""}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            {expiringItems.map((item) => {
              const daysLeft = item.expiryDate ? getDaysUntilExpiry(item.expiryDate) : null;
              const isExpired = daysLeft !== null && daysLeft < 0;
              const accentColor = isExpired ? "#9CA3AF" : daysLeft !== null && daysLeft <= 1 ? "#DC2626" : "#EF4444";
              return (
                <SwipeableRow
                  key={item.id}
                  colors={colors}
                  onDelete={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    removeFromPantry(item.id);
                  }}
                >
                  {/* Left accent bar + card */}
                  <View style={{ flexDirection: "row", borderRadius: 16, overflow: "hidden" }}>
                    <View style={{ width: 4, backgroundColor: accentColor }} />
                    <View style={[styles.expiryItemInner, { backgroundColor: C.surface, borderColor: isExpired ? C.surfaceHigh : "#EF444330" }]}>
                      <View style={[styles.expiryEmojiBox, { backgroundColor: isExpired ? C.surfaceLow : "#FEF2F2" }]}>
                        <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>{item.name}</Text>
                        <Text style={[styles.itemDetail, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                          {item.quantity} {item.unit} · {item.category}
                        </Text>
                        {daysLeft !== null && (
                          <Text style={{ fontSize: 13, fontFamily: "Epilogue_700Bold", marginTop: 3, color: accentColor }}>
                            {formatCountdown(daysLeft)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: isExpired ? C.surfaceLow : "#FEF2F2" }]}>
                        <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
                        <Text style={{ fontSize: 11, fontFamily: "Epilogue_700Bold", color: isExpired ? C.textMuted : "#DC2626" }}>
                          {isExpired ? "Expired" : "Expiring"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </SwipeableRow>
              );
            })}

            {/* Suggested recipes section */}
            {liveRecipes.filter((r: import("@/data/mockData").Recipe) =>
              r.ingredients.some((ing: { name: string }) => expiringItems.some((e) => e.name.toLowerCase().includes(ing.name.toLowerCase().split(" ")[0])))
            ).slice(0, 3).length > 0 && (
              <View style={[styles.expiryRecipeSection, { backgroundColor: C.surface, borderColor: C.surfaceHigh }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={[styles.intelligenceIcon, { backgroundColor: C.primary + "18" }]}>
                    <Feather name="book-open" size={14} color={C.primary} />
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: "Epilogue_700Bold", color: C.primary, letterSpacing: 0.5 }}>
                    RECIPES THAT USE THESE
                  </Text>
                </View>
                {liveRecipes.filter((r: import("@/data/mockData").Recipe) =>
                  r.ingredients.some((ing: { name: string }) => expiringItems.some((e) => e.name.toLowerCase().includes(ing.name.toLowerCase().split(" ")[0])))
                ).slice(0, 3).map((r: import("@/data/mockData").Recipe) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.expiryRecipeRow, { borderColor: C.surfaceHigh }]}
                    onPress={() => { setShowExpiryModal(false); router.push(`/recipe/${r.id}`); }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.expiryRecipeIcon, { backgroundColor: C.primary + "14" }]}>
                      <Text style={{ fontSize: 18 }}>{CUISINE_EMOJIS[r.cuisine] ?? "🍽"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]} numberOfLines={1}>{r.title}</Text>
                      <Text style={[styles.itemDetail, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                        {r.prepTime + r.cookTime} min · {r.calories} kcal
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={15} color={C.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={[styles.modalBtnFull, { backgroundColor: "#EF4444" }]} onPress={() => setShowExpiryModal(false)}>
            <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Epilogue_700Bold" }]}>Got it, I'll use these first ✓</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── BARCODE SCANNER MODAL ── */}
      <Modal
        visible={showBarcodeModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => {
          setShowBarcodeModal(false);
          resetBarcodeModal();
        }}
      >
        <View style={[styles.modal, { backgroundColor: C.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: C.surfaceHigh }]} />

          {/* Header row */}
          <View style={styles.barcodeHeader}>
            <Text style={[styles.modalTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold", marginBottom: 0 }]}>
              {barcodePhase === "found" ? "Product Found 🎉" :
               barcodePhase === "not_found" ? "Product Not Found" :
               barcodePhase === "loading" ? "Looking Up Barcode" :
               "Scan Barcode 📷"}
            </Text>
            <TouchableOpacity
              onPress={() => { setShowBarcodeModal(false); resetBarcodeModal(); }}
              style={styles.barcodeCloseBtn}
            >
              <Feather name="x" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── LOADING PHASE ── */}
          {barcodePhase === "loading" && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={C.primary} style={{ marginBottom: 20 }} />
              <Text style={[styles.loadingStatus, { color: C.primary, fontFamily: "Epilogue_700Bold" }]}>
                {barcodeStatusMsg}
              </Text>
              <Text style={[styles.loadingBarcode, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                {scannedBarcode}
              </Text>
            </View>
          )}

          {/* ── FOUND PHASE ── */}
          {barcodePhase === "found" && foundProduct && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.foundContent}>
              {/* Product image or placeholder */}
              {foundProduct.imageUrl ? (
                <Image source={{ uri: foundProduct.imageUrl }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <View style={[styles.productImagePlaceholder, { backgroundColor: C.surfaceLow, borderColor: C.surfaceHigh }]}>
                  <Text style={{ fontSize: 48 }}>{categoryToEmoji(barcodeCategory)}</Text>
                </View>
              )}

              {/* Source badge */}
              {foundProduct.source && (
                <View style={[styles.sourceBadge, { backgroundColor: C.primary + "15" }]}>
                  <Feather name="database" size={12} color={C.primary} />
                  <Text style={[styles.sourceBadgeText, { color: C.primary, fontFamily: "Epilogue_400Regular" }]}>
                    {foundProduct.source}
                  </Text>
                </View>
              )}

              <Text style={[styles.foundProductName, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
                {foundProduct.name}
              </Text>
              {foundProduct.brand && (
                <Text style={[styles.foundProductBrand, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                  {foundProduct.brand}
                </Text>
              )}

              {/* Quantity row */}
              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold", marginTop: 16 }]}>Quantity</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, { backgroundColor: C.surfaceLow, borderColor: C.surfaceHigh }]}
                  onPress={() => setBarcodeQty(q => String(Math.max(1, Number(q) - 1)))}
                >
                  <Feather name="minus" size={18} color={C.primary} />
                </TouchableOpacity>
                <TextInput
                  value={barcodeQty}
                  onChangeText={setBarcodeQty}
                  keyboardType="numeric"
                  style={[styles.qtyInput, { color: C.textPrimary, borderColor: C.surfaceHigh, fontFamily: "Epilogue_700Bold" }]}
                />
                <TouchableOpacity
                  style={[styles.qtyBtn, { backgroundColor: C.surfaceLow, borderColor: C.surfaceHigh }]}
                  onPress={() => setBarcodeQty(q => String(Number(q) + 1))}
                >
                  <Feather name="plus" size={18} color={C.primary} />
                </TouchableOpacity>
              </View>

              {/* Unit */}
              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitScroll}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitPill, { backgroundColor: barcodeUnit === u ? C.primary : C.surfaceLow, borderColor: barcodeUnit === u ? C.primary : C.surfaceHigh }]}
                    onPress={() => setBarcodeUnit(u)}
                  >
                    <Text style={[styles.unitPillText, { color: barcodeUnit === u ? "#fff" : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category */}
              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORY_ITEMS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, { backgroundColor: barcodeCategory === cat ? C.primary : C.surfaceLow, borderColor: barcodeCategory === cat ? C.primary : C.surfaceHigh }]}
                    onPress={() => setBarcodeCategory(cat)}
                  >
                    <Text style={[styles.categoryPillText, { color: barcodeCategory === cat ? "#fff" : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Expiry date */}
              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Expiry Date (optional)</Text>
              <TextInput
                style={[styles.modalInput, { color: C.textPrimary, borderColor: C.surfaceHigh, backgroundColor: C.surface, fontFamily: "Epilogue_400Regular" }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.textMuted}
                value={barcodeExpiry}
                onChangeText={setBarcodeExpiry}
              />

              {/* Actions */}
              <View style={[styles.modalButtons, { marginTop: 8 }]}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.surfaceLow }]} onPress={resetBarcodeModal}>
                  <Text style={[styles.modalBtnText, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.primary }]} onPress={handleAddFound}>
                  <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Epilogue_700Bold" }]}>Add to Pantry</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── NOT FOUND PHASE — manual entry form ── */}
          {barcodePhase === "not_found" && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.foundContent}>
              <View style={[styles.notFoundBox, { backgroundColor: C.surfaceLow, borderColor: C.surfaceHigh }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🔍</Text>
                <Text style={[styles.notFoundTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
                  No product found
                </Text>
                <Text style={[styles.notFoundSub, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                  Barcode: {scannedBarcode}
                </Text>
                <Text style={[styles.notFoundSub, { color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 4 }]}>
                  Not in Database, Open Food Facts, or UPCitemDB. Add it manually:
                </Text>
              </View>

              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold", marginTop: 16 }]}>
                Product Name *
              </Text>
              <TextInput
                style={[styles.modalInput, { color: C.textPrimary, borderColor: C.surfaceHigh, backgroundColor: C.surface, fontFamily: "Epilogue_400Regular" }]}
                placeholder="e.g. Organic Almond Milk"
                placeholderTextColor={C.textMuted}
                value={manualName}
                onChangeText={setManualName}
                autoFocus
              />

              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Brand</Text>
              <TextInput
                style={[styles.modalInput, { color: C.textPrimary, borderColor: C.surfaceHigh, backgroundColor: C.surface, fontFamily: "Epilogue_400Regular" }]}
                placeholder="e.g. Oatly"
                placeholderTextColor={C.textMuted}
                value={manualBrand}
                onChangeText={setManualBrand}
              />

              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORY_ITEMS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, { backgroundColor: manualCategory === cat ? C.primary : C.surfaceLow, borderColor: manualCategory === cat ? C.primary : C.surfaceHigh }]}
                    onPress={() => setManualCategory(cat)}
                  >
                    <Text style={[styles.categoryPillText, { color: manualCategory === cat ? "#fff" : C.textPrimary, fontFamily: "Epilogue_400Regular" }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Expiry Date (optional)</Text>
              <TextInput
                style={[styles.modalInput, { color: C.textPrimary, borderColor: C.surfaceHigh, backgroundColor: C.surface, fontFamily: "Epilogue_400Regular" }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.textMuted}
                value={manualExpiry}
                onChangeText={setManualExpiry}
              />

              <View style={[styles.modalButtons, { marginTop: 8 }]}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.surfaceLow }]} onPress={resetBarcodeModal}>
                  <Text style={[styles.modalBtnText, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: manualName.trim() ? C.primary : C.surfaceLow }]}
                  onPress={handleAddManual}
                  disabled={!manualName.trim()}
                >
                  <Text style={[styles.modalBtnText, { color: manualName.trim() ? "#fff" : C.textMuted, fontFamily: "Epilogue_700Bold" }]}>
                    Add to Pantry
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── CAMERA PHASE ── */}
          {barcodePhase === "camera" && (
            <>
              {Platform.OS === "web" ? (
                /* Web: can't access camera for barcode scanning */
                <>
                  <View style={[styles.viewfinder, { backgroundColor: "#0A0A0A" }]}>
                    <View style={styles.viewfinderCorners}>
                      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                        <View key={corner} style={[styles.corner, styles[`corner_${corner}` as keyof typeof styles] as any, { borderColor: C.primary }]} />
                      ))}
                    </View>
                    <Animated.View style={[styles.scanLine, { backgroundColor: C.primary, top: scanLineY }]} />
                    <Text style={[styles.viewfinderText, { color: "#aaa", fontFamily: "Epilogue_400Regular" }]}>
                      Use Expo Go on your phone to scan real barcodes
                    </Text>
                  </View>
                  <Text style={[styles.scanHint, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                    Tap below to demo a real Open Food Facts lookup.
                  </Text>
                  <TouchableOpacity
                    style={[styles.scanStartBtn, { backgroundColor: C.primary }]}
                    onPress={handleDemoScan}
                  >
                    <Feather name="zap" size={18} color="#fff" />
                    <Text style={[styles.scanStartText, { color: "#fff", fontFamily: "Epilogue_700Bold" }]}>
                      Demo Scan (Coca-Cola)
                    </Text>
                  </TouchableOpacity>
                </>
              ) : !cameraPermission ? (
                <View style={styles.permissionBox}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={[styles.permissionText, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                    Checking camera access…
                  </Text>
                </View>
              ) : !cameraPermission.granted ? (
                <View style={styles.permissionBox}>
                  <View style={[styles.permissionIconWrap, { backgroundColor: C.primary + "18" }]}>
                    <Feather name="camera" size={36} color={C.primary} />
                  </View>
                  <Text style={[styles.permissionTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold" }]}>
                    Camera Access Needed
                  </Text>
                  <Text style={[styles.permissionText, { color: C.textMuted, fontFamily: "Epilogue_400Regular" }]}>
                    Allow PantrySwipe to use your camera so you can scan barcodes to instantly add food items to your pantry.
                  </Text>
                  {cameraPermission.canAskAgain ? (
                    <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: C.primary }]} onPress={requestCameraPermission}>
                      <Feather name="camera" size={18} color="#fff" />
                      <Text style={[styles.permissionBtnText, { color: "#fff", fontFamily: "Epilogue_700Bold" }]}>Allow Camera</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <Text style={[styles.permissionDenied, { color: "#EF4444", fontFamily: "Epilogue_400Regular" }]}>
                        Camera permission was denied. Open Settings to enable it.
                      </Text>
                      <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: C.primary }]} onPress={() => { try { Linking.openSettings(); } catch {} }}>
                        <Feather name="settings" size={18} color="#fff" />
                        <Text style={[styles.permissionBtnText, { color: "#fff", fontFamily: "Epilogue_700Bold" }]}>Open Settings</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.cameraWrapper}>
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a", "upc_e", "code39"],
                    }}
                  />
                  <View style={styles.cameraOverlay}>
                    <View style={styles.viewfinderCorners}>
                      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                        <View key={corner} style={[styles.corner, styles[`corner_${corner}` as keyof typeof styles] as any, { borderColor: "#fff" }]} />
                      ))}
                    </View>
                    <Animated.View style={[styles.scanLine, { backgroundColor: "rgba(255,255,255,0.7)", top: scanLineY }]} />
                  </View>
                  <Text style={[styles.cameraHintText, { fontFamily: "Inter_500Medium" }]}>
                    Point camera at a barcode
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* ── ADD CHOICE SHEET ── */}
      <Modal visible={showAddChoiceModal} animationType="slide" transparent onRequestClose={() => setShowAddChoiceModal(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowAddChoiceModal(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: C.background, paddingBottom: 48, paddingHorizontal: 20, gap: 12 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.surfaceHigh }]} />
            <Text style={[styles.sheetTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold", paddingBottom: 8 }]}>Add to Pantry</Text>

            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceHigh }}
              onPress={() => { setShowAddChoiceModal(false); setShowReceiptModal(true); }}
              activeOpacity={0.8}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary + "22", alignItems: "center", justifyContent: "center" }}>
                <Feather name="camera" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: "Epilogue_700Bold", color: C.textPrimary }}>Scan Receipt</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 }}>AI reads your grocery receipt automatically</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceHigh }}
              onPress={() => { setShowAddChoiceModal(false); setShowAddModal(true); }}
              activeOpacity={0.8}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.saveBlue + "22", alignItems: "center", justifyContent: "center" }}>
                <Feather name="edit-2" size={20} color={C.saveBlue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: "Epilogue_700Bold", color: C.textPrimary }}>Add Manually</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 }}>Type in item name, quantity and category</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── RECEIPT SCANNER ── */}
      <ScanReceiptModal
        visible={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onDone={handleReceiptScanDone}
      />

      {/* ── RECEIPT REVIEW/CONFIRM ── */}
      <ConfirmationEditScreen
        visible={showReceiptConfirm}
        items={scannedReceiptItems}
        source="receipt-scan"
        onClose={() => setShowReceiptConfirm(false)}
        onSuccess={() => {
          setShowReceiptConfirm(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* ── LOW STOCK SHOPPING LIST MODAL ── */}
      <Modal
        visible={showLowStockModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (checkedItems.size > 0) setRestoredItems((prev) => new Set([...prev, ...checkedItems]));
          setCheckedItems(new Set());
          setShowLowStockModal(false);
          setShowUncheckedWarning(false);
        }}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: C.background, paddingHorizontal: 20, paddingBottom: 36, maxHeight: "85%" }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.surfaceHigh }]} />

            {/* Header row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 }}>
              <View>
                <Text style={[styles.sheetTitle, { color: C.textPrimary, fontFamily: "Epilogue_700Bold", fontSize: 22 }]}>
                  Shopping List 🛒
                </Text>
                <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "Epilogue_400Regular", marginTop: 2 }}>
                  {needRestockItems.filter((i) => !checkedItems.has(i.id)).length} item{needRestockItems.filter((i) => !checkedItems.has(i.id)).length !== 1 ? "s" : ""} left to grab
                </Text>
              </View>
              {checkedItems.size > 0 && (
                <TouchableOpacity
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: C.surfaceLow }}
                  onPress={() => { setCheckedItems(new Set()); setShowUncheckedWarning(false); }}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Epilogue_400Regular", color: C.textMuted }}>Uncheck all</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Status summary pills */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {activeRanOut.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#DC2626" }} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>{activeRanOut.length} ran out</Text>
                </View>
              )}
              {needRestockItems.filter(i => i.quantity > 0).length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#D97706" }} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#B45309" }}>{needRestockItems.filter(i => i.quantity > 0).length} running low</Text>
                </View>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: C.surfaceHigh, marginBottom: 14 }} />

            {/* Unchecked warning */}
            {showUncheckedWarning && (
              <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#92400E" }}>
                    {needRestockItems.filter((i) => !checkedItems.has(i.id)).length} item{needRestockItems.filter((i) => !checkedItems.has(i.id)).length !== 1 ? "s" : ""} still unchecked
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#78350F", marginTop: 2 }}>
                    The alert will stay until all items are restocked.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (checkedItems.size > 0) setRestoredItems((prev) => new Set([...prev, ...checkedItems]));
                    setCheckedItems(new Set());
                    setShowLowStockModal(false);
                    setShowUncheckedWarning(false);
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400E" }}>Close anyway</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Items list */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {needRestockItems.map((item) => {
                const isChecked = checkedItems.has(item.id);
                const isRanOut = item.quantity === 0;
                const accentColor = isRanOut ? "#DC2626" : "#F59E0B";
                return (
                  <SwipeableRow
                    key={item.id}
                    colors={colors}
                    onDelete={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRestoredItems((prev) => new Set([...prev, item.id]));
                      setCheckedItems((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
                    }}
                  >
                    {/* Left accent bar + row */}
                    <View style={{ flexDirection: "row", borderRadius: 16, overflow: "hidden", opacity: isChecked ? 0.55 : 1 }}>
                      <View style={{ width: 4, backgroundColor: isChecked ? C.surfaceHigh : accentColor }} />
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCheckedItems((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                          setShowUncheckedWarning(false);
                        }}
                        style={[
                          styles.shoppingRowInner,
                          {
                            backgroundColor: isChecked ? C.surfaceLow : C.surface,
                            borderColor: C.surfaceHigh,
                          },
                        ]}
                      >
                        <View style={[styles.shoppingCheckbox, { backgroundColor: isChecked ? C.secondary : "transparent", borderColor: isChecked ? C.secondary : C.surfaceHigh }]}>
                          {isChecked && <Feather name="check" size={12} color="#fff" />}
                        </View>
                        <Text style={{ fontSize: 22, marginRight: 4 }}>{item.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[{ fontSize: 15, fontFamily: "Epilogue_700Bold", color: C.textPrimary }, isChecked && { textDecorationLine: "line-through", color: C.textMuted }]}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 12, marginTop: 2, color: C.textMuted, fontFamily: "Epilogue_400Regular" }}>
                            {isRanOut ? "Out of stock" : `${item.quantity} ${item.unit} left`} · {item.category}
                          </Text>
                        </View>
                        {!isChecked && (
                          <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: isRanOut ? "#FEF2F2" : "#FFFBEB", borderWidth: 1, borderColor: isRanOut ? "#FECACA" : "#FDE68A" }}>
                            <Text style={{ fontSize: 11, color: isRanOut ? "#DC2626" : "#B45309", fontFamily: "Epilogue_700Bold" }}>
                              {isRanOut ? "Out" : "Low"}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </SwipeableRow>
                );
              })}
            </ScrollView>

            {/* Done button */}
            <TouchableOpacity
              style={{ paddingVertical: 16, borderRadius: 14, alignItems: "center", backgroundColor: C.primary, marginTop: 16 }}
              onPress={() => {
                const uncheckedCount = needRestockItems.filter((i) => !checkedItems.has(i.id)).length;
                if (checkedItems.size > 0 && uncheckedCount > 0) {
                  setShowUncheckedWarning(true);
                } else {
                  if (checkedItems.size > 0) setRestoredItems((prev) => new Set([...prev, ...checkedItems]));
                  setCheckedItems(new Set());
                  setShowLowStockModal(false);
                  setShowUncheckedWarning(false);
                }
              }}
            >
              <Text style={{ fontSize: 16, color: "#fff", fontFamily: "Epilogue_700Bold" }}>
                {checkedItems.size > 0 ? `Done — ${checkedItems.size} item${checkedItems.size !== 1 ? "s" : ""} grabbed ✓` : "Done"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 10 },
  scanBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  addBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  searchContainer: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, paddingHorizontal: 14, height: 48,
    borderRadius: 100, borderWidth: 1, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  expiryAlertWrap: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, overflow: "hidden",
    backgroundColor: "#FFF1F2", borderWidth: 1, borderColor: "#FECACA",
  },
  expiryAlertAccent: { width: 4, backgroundColor: "#EF4444" },
  expiryAlertBody: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  expiryAlertText: { flex: 1, fontSize: 13, color: "#EF4444" },
  expiryViewLink: { fontSize: 13 },
  lowStockBanner: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, overflow: "hidden",
    backgroundColor: "#FFF1F0", borderWidth: 1, borderColor: "#FECACA",
  },
  lowStockAccent: { width: 4, backgroundColor: "#E84040" },
  lowStockBody: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  lowStockText: { flex: 1, fontSize: 13, color: "#78180F" },
  lowStockLink: { fontSize: 13 },

  // ── Pantry Intelligence Banner ──
  banner: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 20, padding: 20,
  },
  bannerLabel: {
    fontSize: 10, fontFamily: "Epilogue_700Bold", letterSpacing: 1.5,
    color: "rgba(0,0,0,0.40)", textTransform: "uppercase", marginBottom: 8,
  },
  bannerHeadline: {
    fontSize: 22, fontFamily: "Epilogue_700Bold", color: "#141210", marginBottom: 6,
  },
  bannerBody: {
    fontSize: 13, lineHeight: 20, color: "#3D3520",
  },

  // ── What Can I Make card ──
  whatCanIMakeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 18, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  whatCanIMakeIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  whatCanIMakeEyebrow: { fontSize: 10, letterSpacing: 1, marginBottom: 2 },
  whatCanIMakeTitle: { fontSize: 16 },
  whatCanIMakeCount: { fontSize: 24 },
  whatCanIMakeSub: { fontSize: 12 },

  // ── Category tabs ──
  categoriesContainer: { paddingHorizontal: 16, gap: 8, paddingBottom: 10, alignItems: "center", height: 50 },
  categoryTab: { height: 34, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  categoryTabText: { fontSize: 13 },

  // ── Section header ──
  sectionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
  },
  sectionTitle: { fontSize: 20, fontFamily: "Epilogue_700Bold" },
  sectionSubtitle: { fontSize: 13, fontFamily: "Epilogue_400Regular", marginTop: 2 },

  // ── FlatList grid ──
  columnWrapper: { paddingHorizontal: 10 },

  // ── FAB ──
  fab: {
    position: "absolute", bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#F5A623",
    alignItems: "center", justifyContent: "center",
  },

  // ── Shared item styles (used by modals) ──
  itemName: { fontSize: 15 },
  itemDetail: { fontSize: 12 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11 },

  // ── Empty state ──
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontSize: 15 },

  // ── Intelligence icon (used in modals) ──
  intelligenceEyebrowDot: { width: 5, height: 5, borderRadius: 3 },
  intelligenceIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  // ── Sticky chevron ──
  stickyChevron: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },

  // ── Bottom sheet ──
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.65, paddingTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  sheetTitle: { fontSize: 18 },
  sheetCountPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sheetCountText: { fontSize: 12 },
  sheetGroup: { paddingHorizontal: 16, marginBottom: 4 },
  sheetGroupLabel: { fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, marginTop: 12 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12, marginBottom: 8 },
  sheetRowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sheetRowName: { fontSize: 14, marginBottom: 2 },
  sheetRowMeta: { fontSize: 12, lineHeight: 16 },
  sheetScore: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sheetScoreText: { fontSize: 12 },

  // ── Modal ──
  modal: { flex: 1, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, marginBottom: 20 },
  modalForm: { gap: 16, paddingBottom: 20 },
  inputLabel: { fontSize: 13, marginBottom: 6 },
  modalInput: { height: 48, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  row: { flexDirection: "row", gap: 12 },
  unitScroll: { gap: 8, paddingRight: 8, height: 48, alignItems: "center" },
  unitPill: { height: 34, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  unitPillText: { fontSize: 13 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  categoryPillText: { fontSize: 13 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalBtnFull: { height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalBtn: { flex: 1, height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontSize: 15 },

  // ── Expiry modal ──
  expiryItemInner: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, paddingRight: 14,
    borderTopRightRadius: 16, borderBottomRightRadius: 16,
    borderWidth: 1, borderLeftWidth: 0, minHeight: 70,
  },
  expiryEmojiBox: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  expiryModalAccentBar: { height: 3, marginBottom: 16 },
  expiryModalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 18,
  },
  expiryCountPill: {
    flexDirection: "row", alignItems: "baseline",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1,
  },
  expiryRecipeSection: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 4,
  },
  expiryRecipeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  expiryRecipeIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },

  // ── Shopping list ──
  shoppingCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  shoppingRowInner: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderTopRightRadius: 16, borderBottomRightRadius: 16,
    borderWidth: 1, borderLeftWidth: 0,
  },

  // ── Barcode modal ──
  barcodeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  barcodeCloseBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  // Loading
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  loadingStatus: { fontSize: 16, marginBottom: 8 },
  loadingBarcode: { fontSize: 12 },

  // Found
  foundContent: { gap: 0, paddingBottom: 32 },
  productImage: { width: "100%", height: 180, borderRadius: 16, marginBottom: 16 },
  productImagePlaceholder: { width: "100%", height: 140, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1 },
  sourceBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, marginBottom: 12 },
  sourceBadgeText: { fontSize: 12 },
  foundProductName: { fontSize: 22, marginBottom: 4 },
  foundProductBrand: { fontSize: 14, marginBottom: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, textAlign: "center", fontSize: 18 },

  // Not found
  notFoundBox: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: "center", marginBottom: 8 },
  notFoundTitle: { fontSize: 16, marginBottom: 4 },
  notFoundSub: { fontSize: 12, textAlign: "center" },

  // Camera
  viewfinder: { height: 220, borderRadius: 16, marginBottom: 16, position: "relative", alignItems: "center", justifyContent: "flex-end", overflow: "hidden", paddingBottom: 16 },
  viewfinderCorners: { position: "absolute", top: 16, left: 16, right: 16, bottom: 16 },
  corner: { position: "absolute", width: 24, height: 24, borderWidth: 3 },
  corner_tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  corner_tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  corner_bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  corner_br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { position: "absolute", left: 16, right: 16, height: 2, opacity: 0.8 },
  viewfinderText: { fontSize: 13, opacity: 0.7 },
  scanHint: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  scanStartBtn: { flexDirection: "row", gap: 10, height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  scanStartText: { fontSize: 15 },
  cameraWrapper: { flex: 1, borderRadius: 16, overflow: "hidden", position: "relative", minHeight: 300 },
  cameraOverlay: { position: "absolute", top: 16, left: 16, right: 16, bottom: 40 },
  cameraHintText: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 14 },

  // Permission
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 8, paddingBottom: 40 },
  permissionIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  permissionTitle: { fontSize: 22, textAlign: "center" },
  permissionText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  permissionDenied: { fontSize: 13, textAlign: "center" },
  permissionBtn: { flexDirection: "row", gap: 8, height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, marginTop: 4 },
  permissionBtnText: { fontSize: 15 },
});
