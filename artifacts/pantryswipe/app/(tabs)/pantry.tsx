import React, { useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
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
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { MOCK_RECIPES, PantryItem } from "@/data/mockData";

const CATEGORIES = ["All", "Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;
const UNITS = ["g", "kg", "ml", "L", "cups", "pieces", "tbsp", "tsp", "cans", "slices", "cloves", "bunches"];
const CATEGORY_ITEMS = ["Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;

const STATUS_COLORS: Record<string, string> = {
  Fresh: "#00BFA5",
  "Use Soon": "#F5A623",
  Expiring: "#E84040",
  Expired: "#666",
};

// Simulated barcode scan results
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
  const { pantryItems, addToPantry, removeFromPantry } = useApp();

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
  const scanLineAnim = useState(new Animated.Value(0))[0];

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
    // Animate scan line
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
    // Simulate barcode detection after 2.5s
    setTimeout(() => {
      const product = BARCODE_DEMOS[Math.floor(Math.random() * BARCODE_DEMOS.length)];
      setScannedProduct(product);
      setScanning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2500);
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

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 180],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>My Pantry</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
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
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
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

      {/* Expiry alert */}
      {expiringItems.length > 0 && (
        <TouchableOpacity
          style={[styles.expiryAlert, { backgroundColor: "#E84040" + "12", borderColor: "#E84040" + "35" }]}
          onPress={() => setShowExpiryModal(true)}
        >
          <Feather name="alert-triangle" size={14} color="#E84040" />
          <Text style={[styles.expiryAlertText, { color: "#E84040", fontFamily: "Inter_500Medium" }]}>
            {expiringItems.length} {expiringItems.length === 1 ? "item" : "items"} expiring soon
          </Text>
          <Text style={[styles.expiryView, { color: "#E84040", fontFamily: "Inter_700Bold" }]}>View →</Text>
        </TouchableOpacity>
      )}

      {/* Category tabs — fixed height pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
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
              <Text style={[styles.categoryTabText, { color: isActive ? colors.primaryForeground : colors.foreground, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Items list */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="shopping-bag" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>No items in {activeCategory === "All" ? "pantry" : activeCategory}</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddModal(true)}>
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_700Bold" }]}>Add Item</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.pantryItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
              <Text style={[styles.itemDetail, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {item.quantity} {item.unit} · {item.category}
              </Text>
            </View>
            <View style={styles.itemRight}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + "20" }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status], fontFamily: "SpaceGrotesk_600SemiBold" }]}>{item.status}</Text>
              </View>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); removeFromPantry(item.id); }}>
                <Feather name="trash-2" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={[styles.intelligencePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.intelligenceTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Pantry Intelligence</Text>
            <View style={styles.intelligenceRows}>
              <View style={styles.intelligenceRow}>
                <View style={[styles.intelligenceIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="check-circle" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.intelligenceText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{completeRecipes} complete recipes</Text> you can cook right now
                </Text>
              </View>
              <View style={styles.intelligenceRow}>
                <View style={[styles.intelligenceIcon, { backgroundColor: "#F5A623" + "20" }]}>
                  <Feather name="plus-circle" size={14} color="#F5A623" />
                </View>
                <Text style={[styles.intelligenceText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  <Text style={{ fontFamily: "Inter_700Bold", color: "#F5A623" }}>1 ingredient away</Text> from {oneIngredientAway} more
                </Text>
              </View>
              <View style={styles.intelligenceRow}>
                <View style={[styles.intelligenceIcon, { backgroundColor: colors.saveBlue + "20" }]}>
                  <Feather name="dollar-sign" size={14} color={colors.saveBlue} />
                </View>
                <Text style={[styles.intelligenceText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  Estimated pantry value: <Text style={{ fontFamily: "SpaceGrotesk_600SemiBold", color: colors.saveBlue }}>${pantryValue}</Text>
                </Text>
              </View>
            </View>
          </View>
        }
      />

      {/* ── Add Item Modal ── */}
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
                      <Text style={[styles.unitPillText, { color: newItemUnit === u ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>{u}</Text>
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
                  <Text style={[styles.categoryPillText, { color: newItemCategory === cat ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setShowAddModal(false)}>
              <Text style={[styles.modalBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleAddItem}>
              <Text style={[styles.modalBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Add to Pantry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Expiry Modal ── */}
      <Modal visible={showExpiryModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowExpiryModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Expiring Soon 🕐</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            {expiringItems.map((item) => (
              <View key={item.id} style={[styles.expiryItem, { backgroundColor: colors.card, borderColor: "#E84040" + "30" }]}>
                <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
                  <Text style={[styles.itemDetail, { color: "#E84040", fontFamily: "Inter_400Regular" }]}>
                    {item.status} · {item.quantity} {item.unit}
                  </Text>
                </View>
              </View>
            ))}

            <Text style={[styles.expiryHint, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              Recipes that use these ingredients:
            </Text>
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
            <Text style={[styles.modalBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Barcode Scanner Modal ── */}
      <Modal visible={showBarcodeModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowBarcodeModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>Scan Barcode 📷</Text>

          {!scannedProduct ? (
            <>
              {/* Camera viewfinder */}
              <View style={[styles.viewfinder, { backgroundColor: "#000" }]}>
                <View style={styles.viewfinderCorners}>
                  {["tl", "tr", "bl", "br"].map((corner) => (
                    <View key={corner} style={[styles.corner, styles[`corner_${corner}` as keyof typeof styles] as any, { borderColor: colors.primary }]} />
                  ))}
                </View>
                {scanning && (
                  <Animated.View style={[styles.scanLine, { backgroundColor: colors.primary, top: scanLineY }]} />
                )}
                <Text style={[styles.viewfinderText, { color: "#fff", fontFamily: "Inter_400Regular" }]}>
                  {scanning ? "Scanning..." : "Point camera at barcode"}
                </Text>
              </View>

              <Text style={[styles.scanHint, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Barcode detected items will automatically populate name, quantity, and nutritional info.
              </Text>

              <TouchableOpacity
                style={[styles.scanStartBtn, { backgroundColor: colors.primary }]}
                onPress={handleScanStart}
                disabled={scanning}
              >
                <Feather name="camera" size={20} color={colors.primaryForeground} />
                <Text style={[styles.scanStartText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                  {scanning ? "Scanning…" : "Start Scan"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.scannedResult}>
              <View style={[styles.scannedIcon, { backgroundColor: colors.primary + "20" }]}>
                <Text style={{ fontSize: 48 }}>{scannedProduct.emoji}</Text>
              </View>
              <Text style={[styles.scannedLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Product detected</Text>
              <Text style={[styles.scannedName, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>{scannedProduct.name}</Text>
              <Text style={[styles.scannedMeta, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {scannedProduct.quantity} {scannedProduct.unit} · {scannedProduct.category}
              </Text>

              <View style={styles.scannedActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setScannedProduct(null)}>
                  <Text style={[styles.modalBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleAddScanned}>
                  <Text style={[styles.modalBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Add to Pantry</Text>
                </TouchableOpacity>
              </View>
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
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },
  expiryAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  expiryAlertText: { flex: 1, fontSize: 13 },
  expiryView: { fontSize: 13 },
  categoriesContainer: { paddingHorizontal: 20, gap: 8, paddingBottom: 12, alignItems: "center", height: 50 },
  categoryTab: { height: 32, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  categoryTabText: { fontSize: 13 },
  listContent: { paddingHorizontal: 20, gap: 10, paddingBottom: 120 },
  pantryItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  itemEmoji: { fontSize: 26 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 15 },
  itemDetail: { fontSize: 13 },
  itemRight: { alignItems: "flex-end", gap: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11 },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontSize: 15 },
  intelligencePanel: { marginTop: 8, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  intelligenceTitle: { fontSize: 15, marginBottom: 4 },
  intelligenceRows: { gap: 12 },
  intelligenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  intelligenceIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  intelligenceText: { flex: 1, fontSize: 13, lineHeight: 19 },
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
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: 16,
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
});
