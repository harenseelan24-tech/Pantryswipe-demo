import React, { useState } from "react";
import {
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
import { PantryItem } from "@/data/mockData";

const CATEGORIES = ["All", "Fridge", "Freezer", "Pantry", "Spices", "Sauces", "Produce"] as const;

const STATUS_COLORS: Record<string, string> = {
  Fresh: "#4CAF76",
  "Use Soon": "#F5A623",
  Expiring: "#E84040",
  Expired: "#666",
};

export default function PantryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pantryItems, addToPantry, removeFromPantry, updatePantryItem } = useApp();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("pieces");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const filtered = pantryItems.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const expiringItems = pantryItems.filter((i) => i.status === "Expiring" || i.status === "Expired");

  const completeRecipes = 31;
  const oneIngredientAway = 14;
  const pantryValue = 42;

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const newItem: PantryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: newItemName.trim(),
      quantity: parseFloat(newItemQty) || 1,
      unit: newItemUnit,
      category: "Pantry",
      status: "Fresh",
      emoji: "🥦",
    };
    addToPantry(newItem);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewItemName("");
    setNewItemQty("1");
    setShowAddModal(false);
  };

  const handleRemove = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeFromPantry(id);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Pantry</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.saffron }]}
          onPress={() => setShowAddModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search pantry..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Expiry alert */}
      {expiringItems.length > 0 && (
        <TouchableOpacity style={[styles.expiryAlert, { backgroundColor: "#E84040" + "15", borderColor: "#E84040" + "30" }]}>
          <Feather name="alert-triangle" size={16} color="#E84040" />
          <Text style={[styles.expiryAlertText, { color: "#E84040" }]}>
            {expiringItems.length} items expiring soon — see recipes that use them
          </Text>
          <Text style={{ color: "#E84040", fontWeight: "700" }}>View</Text>
        </TouchableOpacity>
      )}

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryTab,
              {
                backgroundColor: activeCategory === cat ? colors.saffron : colors.card,
                borderColor: activeCategory === cat ? colors.saffron : colors.border,
              },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.categoryTabText,
                { color: activeCategory === cat ? "#fff" : colors.foreground },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items list */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No items found
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.saffron }]}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.pantryItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.itemDetail, { color: colors.mutedForeground }]}>
                {item.quantity} {item.unit} · {item.category}
              </Text>
            </View>
            <View style={styles.itemRight}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + "20" }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                  {item.status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemove(item.id)}>
                <Feather name="trash-2" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={[styles.intelligencePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.intelligenceTitle, { color: colors.foreground }]}>Pantry Intelligence</Text>
            <View style={styles.intelligenceRows}>
              <View style={styles.intelligenceRow}>
                <Feather name="check-circle" size={16} color={colors.secondary} />
                <Text style={[styles.intelligenceText, { color: colors.foreground }]}>
                  You can make <Text style={{ fontWeight: "700", color: colors.secondary }}>{completeRecipes} complete recipes</Text> right now
                </Text>
              </View>
              <View style={styles.intelligenceRow}>
                <Feather name="plus-circle" size={16} color={colors.saffron} />
                <Text style={[styles.intelligenceText, { color: colors.foreground }]}>
                  <Text style={{ fontWeight: "700", color: colors.saffron }}>1 ingredient away</Text> from {oneIngredientAway} more recipes
                </Text>
              </View>
              <View style={styles.intelligenceRow}>
                <Feather name="dollar-sign" size={16} color={colors.saveBlue} />
                <Text style={[styles.intelligenceText, { color: colors.foreground }]}>
                  Estimated pantry value: <Text style={{ fontWeight: "700", color: colors.saveBlue }}>${pantryValue}</Text>
                </Text>
              </View>
            </View>
          </View>
        }
      />

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Pantry Item</Text>
          <View style={styles.modalForm}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Ingredient name</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="e.g. Chicken Breast"
              placeholderTextColor={colors.mutedForeground}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Quantity</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  placeholder="1"
                  placeholderTextColor={colors.mutedForeground}
                  value={newItemQty}
                  onChangeText={setNewItemQty}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Unit</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  placeholder="pieces"
                  placeholderTextColor={colors.mutedForeground}
                  value={newItemUnit}
                  onChangeText={setNewItemUnit}
                />
              </View>
            </View>
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.saffron }]}
              onPress={handleAddItem}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>Add to Pantry</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15 },
  expiryAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  expiryAlertText: { flex: 1, fontSize: 13, fontWeight: "500" },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 14,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  categoryTabText: { fontSize: 13, fontWeight: "600" },
  listContent: { paddingHorizontal: 20, gap: 10, paddingBottom: 120 },
  pantryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  itemEmoji: { fontSize: 28 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 16, fontWeight: "600" },
  itemDetail: { fontSize: 13 },
  itemRight: { alignItems: "flex-end", gap: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 16 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  intelligencePanel: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  intelligenceTitle: { fontSize: 16, fontWeight: "700" },
  intelligenceRows: { gap: 10 },
  intelligenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  intelligenceText: { flex: 1, fontSize: 14, lineHeight: 20 },
  modal: { flex: 1, padding: 24 },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", marginBottom: 24 },
  modalForm: { gap: 16 },
  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  modalInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 12 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 32 },
  modalBtn: { flex: 1, height: 52, borderRadius: 100, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontSize: 16, fontWeight: "700" },
});
