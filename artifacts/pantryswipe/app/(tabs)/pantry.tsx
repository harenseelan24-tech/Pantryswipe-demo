import React, { useRef, useState } from "react";
import {
  Animated,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_RECIPES, PantryItem, Recipe } from "@/data/mockData";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CATEGORIES = ["All", "Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;
const UNITS = ["g", "kg", "ml", "L", "cups", "pieces", "tbsp", "tsp", "cans", "slices", "cloves", "bunches"];
const CATEGORY_ITEMS = ["Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;

const STATUS_BG: Record<string, string> = {
  Fresh: "#ECFDF5",
  "Use Soon": "#FFFBEB",
  Expiring: "#FEF2F2",
  Expired: "#F9FAFB",
};
const STATUS_BG_DARK: Record<string, string> = {
  Fresh: "rgba(16,185,129,0.18)",
  "Use Soon": "rgba(245,158,11,0.18)",
  Expiring: "rgba(239,68,68,0.18)",
  Expired: "rgba(148,163,184,0.12)",
};
const STATUS_TEXT: Record<string, string> = {
  Fresh: "#059669",
  "Use Soon": "#D97706",
  Expiring: "#DC2626",
  Expired: "#6B7280",
};
const STATUS_DOT: Record<string, string> = {
  Fresh: "#10B981",
  "Use Soon": "#F59E0B",
  Expiring: "#EF4444",
  Expired: "#9CA3AF",
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

const BARCODE_DEMOS: { name: string; quantity: number; unit: string; category: typeof CATEGORY_ITEMS[number]; emoji: string }[] = [
  { name: "Himalayan Pink Salt", quantity: 500, unit: "g", category: "Spices", emoji: "🧂" },
  { name: "Heinz Tomato Ketchup", quantity: 570, unit: "ml", category: "Sauces", emoji: "🍅" },
  { name: "Organic Rolled Oats", quantity: 900, unit: "g", category: "Pantry", emoji: "🌾" },
  { name: "Almond Milk", quantity: 1, unit: "L", category: "Fridge", emoji: "🥛" },
  { name: "Soy Sauce", quantity: 250, unit: "ml", category: "Sauces", emoji: "🫙" },
];

export default function PantryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pantryItems, addToPantry, removeFromPantry, getPantryMatchScore } = useApp();

  const isDark = colors.background === "#07101E";

  const [showWhatCanIMake, setShowWhatCanIMake] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("pieces");
  const [newItemCategory, setNewItemCategory] = useState<typeof CATEGORY_ITEMS[number]>("Pantry");
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<typeof BARCODE_DEMOS[number] | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const barcodeScanLock = useRef(false);
  // Use SCREEN_HEIGHT - tab bar height (mirrors Discover tab approach — avoids circular onLayout measurement)
  const TAB_BAR_H = Platform.OS === "web" ? 68 : 60;
  const [topH, setTopH] = useState(0);
  const PANEL_H = 80; // matches stickyPanel explicit height below
  const listHeight = topH > 0 ? Math.max(120, SCREEN_HEIGHT - TAB_BAR_H - topH - PANEL_H) : 0;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const filtered = pantryItems.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const expiringItems = pantryItems.filter((i) => i.status === "Expiring" || i.status === "Expired");
  const completeRecipes = MOCK_RECIPES.filter((r) => r.ingredients.every((i) => i.inPantry)).length;
  const oneIngredientAway = MOCK_RECIPES.filter((r) => r.ingredients.filter((i) => !i.inPantry).length === 1).length;
  const pantryValue = pantryItems.reduce((acc, item) => acc + item.quantity * 0.5, 0).toFixed(0);
  const matchableRecipes = MOCK_RECIPES
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
      emoji: "🛒",
    };
    addToPantry(newItem);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemUnit("pieces");
    setShowAddModal(false);
  };

  const handleScanStart = () => {
    setScanning(true);
    setScannedProduct(null);
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
    setTimeout(() => {
      const product = BARCODE_DEMOS[Math.floor(Math.random() * BARCODE_DEMOS.length)];
      setScannedProduct(product);
      setScanning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2500);
  };

  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    if (barcodeScanLock.current || scannedProduct) return;
    barcodeScanLock.current = true;
    const idx = data.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % BARCODE_DEMOS.length;
    const product = BARCODE_DEMOS[idx];
    setScannedProduct(product);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddScanned = () => {
    if (!scannedProduct) return;
    const newItem: PantryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: scannedProduct.name,
      quantity: scannedProduct.quantity,
      unit: scannedProduct.unit,
      category: scannedProduct.category,
      status: "Fresh",
      emoji: scannedProduct.emoji,
    };
    addToPantry(newItem);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowBarcodeModal(false);
    setScannedProduct(null);
  };

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 180] });

  const itemCardBg = isDark ? colors.card : "#FFFFFF";
  const itemCardBorder = isDark ? colors.border : "#E8EFFE";
  const iconBoxBg = isDark ? colors.cardElevated : "#EEF4FF";

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* ── TOP SECTION (measured to derive list height) ── */}
      <View onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
        {/* ── HEADER ── */}
        <View style={[styles.header, { paddingTop: topPadding + 6 }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>
              My Pantry
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              {pantryItems.length} items tracked
            </Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { setScannedProduct(null); setShowBarcodeModal(true); }}
            >
              <Feather name="camera" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SEARCH ── */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            placeholder="Search pantry..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.textMuted} />
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
              <Text style={[styles.expiryViewLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                View →
              </Text>
            </View>
          </TouchableOpacity>
        )}

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
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      {
                        color: isActive ? "#fff" : colors.textSecondary,
                        fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* ── ITEM LIST — height from onLayout; overflow:hidden clips items at boundary so panel stays visible ── */}
      <View style={{ height: listHeight || SCREEN_HEIGHT * 0.5, overflow: "hidden" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="shopping-bag" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              No items in {activeCategory === "All" ? "pantry" : activeCategory}
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_700Bold" }]}>Add Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((item) => {
            const statusBg = isDark
              ? (STATUS_BG_DARK[item.status] ?? "rgba(148,163,184,0.12)")
              : (STATUS_BG[item.status] ?? "#F9FAFB");
            const txt = STATUS_TEXT[item.status] ?? "#6B7280";
            const dot = STATUS_DOT[item.status] ?? "#9CA3AF";
            return (
              <View key={item.id} style={[styles.pantryItem, { backgroundColor: itemCardBg, borderColor: itemCardBorder }]}>
                <View style={[styles.itemIconBox, { backgroundColor: iconBoxBg }]}>
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemDetail, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    {item.quantity} {item.unit} · {item.category}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <View style={[styles.statusDot, { backgroundColor: dot }]} />
                    <Text style={[styles.statusText, { color: txt, fontFamily: "Inter_500Medium" }]}>{item.status}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); removeFromPantry(item.id); }}>
                    <Feather name="trash-2" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        {/* Pantry Intelligence footer */}
        {filtered.length > 0 && (
          <View style={[styles.intelligencePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.intelligenceTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Pantry Intelligence
            </Text>
            <View style={styles.intelligenceRows}>
              <View style={styles.intelligenceRow}>
                <View style={[styles.intelligenceIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Feather name="check-circle" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.intelligenceText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{completeRecipes} complete recipes</Text>{" "}you can cook right now
                </Text>
              </View>
              <View style={styles.intelligenceRow}>
                <View style={[styles.intelligenceIcon, { backgroundColor: "#F59E0B22" }]}>
                  <Feather name="plus-circle" size={14} color="#F59E0B" />
                </View>
                <Text style={[styles.intelligenceText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  <Text style={{ fontFamily: "Inter_700Bold", color: "#F59E0B" }}>1 ingredient away</Text>{" "}from {oneIngredientAway} more
                </Text>
              </View>
              <View style={styles.intelligenceRow}>
                <View style={[styles.intelligenceIcon, { backgroundColor: colors.saveBlue + "22" }]}>
                  <Feather name="dollar-sign" size={14} color={colors.saveBlue} />
                </View>
                <Text style={[styles.intelligenceText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  Estimated pantry value:{" "}
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.saveBlue }}>${pantryValue}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      </View>

      {/* ── STICKY "WHAT CAN I MAKE?" PANEL ── */}
      <View style={[styles.stickyPanel, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.stickyPanelBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { setShowWhatCanIMake(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 20 }}>🍳</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.stickyPanelTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              What Can I Make?
            </Text>
            <Text style={[styles.stickyPanelSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              {matchableRecipes.length} dishes with your pantry
            </Text>
          </View>
          <View style={[styles.stickyChevron, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="chevron-up" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── "WHAT CAN I MAKE?" BOTTOM SHEET MODAL ── */}
      <Modal
        visible={showWhatCanIMake}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWhatCanIMake(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowWhatCanIMake(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>
                What Can I Make?
              </Text>
              <View style={[styles.sheetCountPill, { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.sheetCountText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  {matchableRecipes.length} dishes
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWhatCanIMake(false)} style={{ marginLeft: "auto" }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Grouped recipe list */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {RECIPE_GROUPS.map((group) => {
                const groupItems = matchableRecipes.filter(({ recipe }) => group.filter(recipe));
                if (groupItems.length === 0) return null;
                return (
                  <View key={group.label} style={styles.sheetGroup}>
                    <Text style={[styles.sheetGroupLabel, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>
                      {group.label}
                    </Text>
                    {groupItems.slice(0, 5).map(({ recipe, score }) => (
                      <TouchableOpacity
                        key={recipe.id}
                        style={[styles.sheetRow, { backgroundColor: colors.card }]}
                        onPress={() => { setShowWhatCanIMake(false); router.push(`/recipe/${recipe.id}`); }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.sheetRowIcon, { backgroundColor: colors.cardElevated }]}>
                          <Text style={{ fontSize: 20 }}>{CUISINE_EMOJIS[recipe.cuisine] ?? "🍽"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.sheetRowName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                            numberOfLines={1}
                          >
                            {recipe.title}
                          </Text>
                          <Text style={[styles.sheetRowMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                            {recipe.ingredients.filter((i) => i.inPantry).length}/{recipe.ingredients.length} ingredients · {recipe.prepTime + recipe.cookTime} min
                          </Text>
                        </View>
                        <View style={[
                          styles.sheetScore,
                          { backgroundColor: score >= 80 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" },
                        ]}>
                          <Text style={[
                            styles.sheetScoreText,
                            { color: score >= 80 ? "#059669" : "#D97706", fontFamily: "Inter_600SemiBold" },
                          ]}>
                            ✓ {score}%
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
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
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Add Pantry Item</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
            <Text style={[styles.inputLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Ingredient name</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
              placeholder="e.g. Chicken Breast"
              placeholderTextColor={colors.textMuted}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Quantity</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  value={newItemQty}
                  onChangeText={setNewItemQty}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Text style={[styles.inputLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitScroll}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitPill, { backgroundColor: newItemUnit === u ? colors.primary : colors.card, borderColor: newItemUnit === u ? colors.primary : colors.border }]}
                      onPress={() => setNewItemUnit(u)}
                    >
                      <Text style={[styles.unitPillText, { color: newItemUnit === u ? "#fff" : colors.foreground, fontFamily: "Inter_500Medium" }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Text style={[styles.inputLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_ITEMS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, { backgroundColor: newItemCategory === cat ? colors.primary : colors.card, borderColor: newItemCategory === cat ? colors.primary : colors.border }]}
                  onPress={() => setNewItemCategory(cat)}
                >
                  <Text style={[styles.categoryPillText, { color: newItemCategory === cat ? "#fff" : colors.foreground, fontFamily: "Inter_500Medium" }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setShowAddModal(false)}>
              <Text style={[styles.modalBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleAddItem}>
              <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Add to Pantry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── EXPIRY MODAL ── */}
      <Modal visible={showExpiryModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowExpiryModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Expiring Soon 🕐</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            {expiringItems.map((item) => (
              <View key={item.id} style={[styles.expiryItem, { backgroundColor: colors.card, borderColor: "#EF444430" }]}>
                <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
                  <Text style={[styles.itemDetail, { color: "#EF4444", fontFamily: "Inter_400Regular" }]}>{item.status} · {item.quantity} {item.unit}</Text>
                </View>
              </View>
            ))}
            <Text style={[styles.expiryHint, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Recipes that use these ingredients:</Text>
            {MOCK_RECIPES.filter((r) =>
              r.ingredients.some((ing) => expiringItems.some((e) => e.name.toLowerCase().includes(ing.name.toLowerCase().split(" ")[0])))
            ).slice(0, 3).map((r) => (
              <View key={r.id} style={[styles.expiryRecipe, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="book-open" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.title}</Text>
                  <Text style={[styles.itemDetail, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{r.prepTime + r.cookTime} min · {r.calories} kcal</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.modalBtnFull, { backgroundColor: colors.primary }]} onPress={() => setShowExpiryModal(false)}>
            <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── BARCODE MODAL ── */}
      <Modal
        visible={showBarcodeModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => {
          barcodeScanLock.current = false;
          setScannedProduct(null);
          setShowBarcodeModal(false);
        }}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Scan Barcode 📷</Text>

          {scannedProduct ? (
            /* ── RESULT VIEW ── */
            <View style={styles.scannedResult}>
              <View style={[styles.scannedIcon, { backgroundColor: colors.card }]}>
                <Text style={{ fontSize: 48 }}>{scannedProduct.emoji}</Text>
              </View>
              <Text style={[styles.scannedLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Product detected</Text>
              <Text style={[styles.scannedName, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>{scannedProduct.name}</Text>
              <Text style={[styles.scannedMeta, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{scannedProduct.quantity} {scannedProduct.unit} · {scannedProduct.category}</Text>
              <View style={styles.scannedActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.muted }]}
                  onPress={() => { barcodeScanLock.current = false; setScannedProduct(null); }}
                >
                  <Text style={[styles.modalBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleAddScanned}>
                  <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Add to Pantry</Text>
                </TouchableOpacity>
              </View>
            </View>

          ) : Platform.OS === "web" ? (
            /* ── WEB FALLBACK: mock scan ── */
            <>
              <View style={[styles.viewfinder, { backgroundColor: "#000" }]}>
                <View style={styles.viewfinderCorners}>
                  {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                    <View key={corner} style={[styles.corner, styles[`corner_${corner}` as keyof typeof styles] as any, { borderColor: colors.primary }]} />
                  ))}
                </View>
                {scanning && <Animated.View style={[styles.scanLine, { backgroundColor: colors.primary, top: scanLineY }]} />}
                <Text style={[styles.viewfinderText, { color: "#fff", fontFamily: "Inter_400Regular" }]}>
                  {scanning ? "Scanning..." : "Camera scanning available on device"}
                </Text>
              </View>
              <Text style={[styles.scanHint, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Use the Expo Go app on your phone to scan real barcodes.
              </Text>
              <TouchableOpacity style={[styles.scanStartBtn, { backgroundColor: colors.primary }]} onPress={handleScanStart} disabled={scanning}>
                <Feather name="camera" size={20} color="#fff" />
                <Text style={[styles.scanStartText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>{scanning ? "Scanning…" : "Demo Scan"}</Text>
              </TouchableOpacity>
            </>

          ) : !cameraPermission ? (
            /* ── PERMISSION LOADING ── */
            <View style={styles.permissionBox}>
              <Text style={[styles.permissionText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Checking camera access…</Text>
            </View>

          ) : !cameraPermission.granted ? (
            /* ── PERMISSION REQUEST ── */
            <View style={styles.permissionBox}>
              <View style={[styles.permissionIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="camera" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.permissionTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Camera Access Needed</Text>
              <Text style={[styles.permissionText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Allow PantrySwipe to use your camera so you can scan barcodes to instantly add food items to your pantry.
              </Text>
              {cameraPermission.canAskAgain ? (
                <TouchableOpacity
                  style={[styles.permissionBtn, { backgroundColor: colors.primary }]}
                  onPress={requestCameraPermission}
                >
                  <Feather name="camera" size={18} color="#fff" />
                  <Text style={[styles.permissionBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Allow Camera</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={[styles.permissionDenied, { color: "#EF4444", fontFamily: "Inter_500Medium" }]}>
                    Camera permission was denied. Open Settings to enable it.
                  </Text>
                  <TouchableOpacity
                    style={[styles.permissionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { try { Linking.openSettings(); } catch {} }}
                  >
                    <Feather name="settings" size={18} color="#fff" />
                    <Text style={[styles.permissionBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Open Settings</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

          ) : (
            /* ── LIVE CAMERA VIEW ── */
            <View style={styles.cameraWrapper}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a", "upc_e", "code39"],
                }}
              />
              {/* Corner brackets overlay */}
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 10 },
  scanBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  addBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  searchContainer: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, paddingHorizontal: 14, height: 46,
    borderRadius: 14, borderWidth: 1, marginBottom: 10,
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
  categoriesContainer: {
    paddingHorizontal: 16, gap: 8, paddingBottom: 10,
    alignItems: "center", height: 50,
  },
  categoryTab: {
    height: 34, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  categoryTabText: { fontSize: 13 },
  listContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  pantryItem: {
    flexDirection: "row", alignItems: "center",
    padding: 12, paddingRight: 14,
    borderRadius: 16, borderWidth: 1, gap: 12, minHeight: 70,
    shadowColor: "#2B7FFF",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  itemIconBox: {
    width: 48, height: 48, minWidth: 48,
    borderRadius: 12, alignItems: "center", justifyContent: "center",
  },
  itemEmoji: { fontSize: 24 },
  itemInfo: { flex: 1, gap: 3, overflow: "hidden" },
  itemName: { fontSize: 15 },
  itemDetail: { fontSize: 12 },
  itemRight: { alignItems: "flex-end", gap: 8, minWidth: 82 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11 },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontSize: 15 },
  intelligencePanel: { marginTop: 4, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, marginBottom: 8 },
  intelligenceTitle: { fontSize: 15, marginBottom: 4 },
  intelligenceRows: { gap: 12 },
  intelligenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  intelligenceIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  intelligenceText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── Sticky panel — explicit height so PANEL_H constant stays exact ──
  stickyPanel: {
    height: 80,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  stickyPanelBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stickyPanelTitle: { fontSize: 15 },
  stickyPanelSub: { fontSize: 12, marginTop: 1 },
  stickyChevron: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },

  // ── Bottom sheet ──
  sheetOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.65, paddingTop: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  sheetTitle: { fontSize: 18 },
  sheetCountPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sheetCountText: { fontSize: 12 },
  sheetGroup: { paddingHorizontal: 16, marginBottom: 4 },
  sheetGroupLabel: {
    fontSize: 11, letterSpacing: 0.5,
    textTransform: "uppercase", marginBottom: 8, marginTop: 12,
  },
  sheetRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 12, marginBottom: 8,
  },
  sheetRowIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  sheetRowName: { fontSize: 14, marginBottom: 2 },
  sheetRowMeta: { fontSize: 12, lineHeight: 16 },
  sheetScore: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sheetScoreText: { fontSize: 12 },

  // ── Modals ──
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
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  categoryPillText: { fontSize: 13 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalBtnFull: { height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalBtn: { flex: 1, height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontSize: 15 },
  expiryItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  expiryHint: { fontSize: 13, marginTop: 8 },
  expiryRecipe: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  viewfinder: {
    height: 220, borderRadius: 16, marginBottom: 16,
    position: "relative", alignItems: "center", justifyContent: "flex-end",
    overflow: "hidden", paddingBottom: 16,
  },
  viewfinderCorners: { position: "absolute", top: 16, left: 16, right: 16, bottom: 16 },
  corner: { position: "absolute", width: 24, height: 24, borderWidth: 3 },
  corner_tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  corner_tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  corner_bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  corner_br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { position: "absolute", left: 16, right: 16, height: 2, opacity: 0.8 },
  viewfinderText: { fontSize: 13, opacity: 0.7 },
  scanHint: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  scanStartBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 100 },
  scanStartText: { fontSize: 16 },
  scannedResult: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  scannedIcon: { width: 100, height: 100, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  scannedLabel: { fontSize: 13 },
  scannedName: { fontSize: 24, textAlign: "center" },
  scannedMeta: { fontSize: 14 },
  scannedActions: { flexDirection: "row", gap: 12, marginTop: 16, width: "100%" },

  // ── Camera & permissions ──
  cameraWrapper: {
    flex: 1, borderRadius: 16, overflow: "hidden",
    marginBottom: 16, position: "relative",
    minHeight: 320,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
  },
  cameraHintText: {
    position: "absolute", bottom: 20,
    alignSelf: "center",
    color: "#fff", fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100,
  },
  permissionBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 16, paddingHorizontal: 8,
  },
  permissionIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  permissionTitle: { fontSize: 22, textAlign: "center" },
  permissionText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  permissionDenied: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  permissionBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 52, paddingHorizontal: 28, borderRadius: 100, marginTop: 4,
  },
  permissionBtnText: { fontSize: 16 },
});
