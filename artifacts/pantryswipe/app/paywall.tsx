import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import { ElectricBorder } from "@/components/ElectricBorder";

const HERB = "#4CAF76";
const SAFFRON = "#F5A623";

const FEATURES = [
  {
    icon: "zap",
    title: "Smart AI Chef",
    free: "5 recipes/day",
    premium: "Unlimited + pantry-aware suggestions",
  },
  {
    icon: "clock",
    title: "Expiry Prediction",
    free: "Fixed dates only",
    premium: "AI predicts freshness + freeze alerts",
  },
  {
    icon: "calendar",
    title: "Meal Planner",
    free: "Manual planning",
    premium: "Full auto-generation from your pantry",
  },
  {
    icon: "users",
    title: "Household Sharing",
    free: "Single device",
    premium: "Sync pantry with family in real time",
  },
  {
    icon: "bar-chart-2",
    title: "Nutrition Insights",
    free: "Basic calories",
    premium: "Detailed macros + weekly reports",
  },
];

function PurchaseConfirmModal({
  visible,
  price,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  price: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Start Premium?
          </Text>
          <Text style={[styles.modalBody, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            You'll be charged {price}/month using the test store. This is a simulated purchase — no real money will be charged.
          </Text>
          <TouchableOpacity
            style={[styles.modalConfirm, { backgroundColor: HERB }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Text style={[styles.modalConfirmText, { fontFamily: "Inter_700Bold" }]}>Yes, Subscribe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={onCancel} activeOpacity={0.75}>
            <Text style={[styles.modalCancelText, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { offerings, isSubscribed, purchase, restore, isPurchasing, isRestoring } = useSubscription();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const currentOffering = offerings?.current;
  const packageToPurchase = currentOffering?.availablePackages[0];
  const price = packageToPurchase?.product.priceString ?? "S$4.99";

  const handleSubscribe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowConfirm(true);
  };

  const handleConfirmPurchase = async () => {
    setShowConfirm(false);
    setError(null);
    try {
      await purchase(packageToPurchase);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (!e?.userCancelled) {
        setError("Purchase failed. Please try again.");
      }
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    try {
      await restore();
      if (isSubscribed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        setError("No active subscription found.");
      }
    } catch {
      setError("Restore failed. Please try again.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PurchaseConfirmModal
        visible={showConfirm}
        price={price}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          PantrySwipe Premium
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 32 }]}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: HERB + "12" }]}>
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Save more than {price} every month
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Stop ordering GrabFood. Use what's already in your pantry.
          </Text>
        </View>

        {/* Price card — ElectricBorder glow */}
        <ElectricBorder color={HERB} speed={0.75} chaos={0.12} borderRadius={16}>
          <View style={[styles.priceCard, { backgroundColor: "#071A0D", shadowColor: HERB }]}>
            <View style={styles.priceRow}>
              <View>
                <Text style={[styles.priceLabel, { color: "#fff" }]}>PantrySwipe Premium</Text>
                <Text style={[styles.priceSub, { color: "rgba(255,255,255,0.6)" }]}>Cancel anytime</Text>
              </View>
              <View style={styles.priceRight}>
                <Text style={[styles.priceAmount, { color: HERB }]}>{price}</Text>
                <Text style={[styles.pricePer, { color: "rgba(255,255,255,0.6)" }]}>/month</Text>
              </View>
            </View>
          </View>
        </ElectricBorder>

        {/* Feature comparison */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>
          WHAT YOU GET
        </Text>
        <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {FEATURES.map((f, i) => (
            <View
              key={f.title}
              style={[
                styles.featureRow,
                { borderBottomColor: colors.border },
                i === FEATURES.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={[styles.featureIcon, { backgroundColor: HERB + "18" }]}>
                <Feather name={f.icon as any} size={16} color={HERB} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {f.title}
                </Text>
                <View style={styles.featureTiers}>
                  <View style={styles.featureTierRow}>
                    <Feather name="minus" size={10} color={colors.textMuted} />
                    <Text style={[styles.featureFree, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                      {f.free}
                    </Text>
                  </View>
                  <View style={styles.featureTierRow}>
                    <Feather name="check" size={10} color={HERB} />
                    <Text style={[styles.featurePremium, { color: HERB, fontFamily: "Inter_500Medium" }]}>
                      {f.premium}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {error && (
          <Text style={[styles.errorText, { color: "#E84040", fontFamily: "Inter_400Regular" }]}>{error}</Text>
        )}

        {/* Subscribe button */}
        <TouchableOpacity
          style={[styles.subscribeBtn, { backgroundColor: HERB, opacity: isPurchasing ? 0.7 : 1 }]}
          onPress={handleSubscribe}
          activeOpacity={0.85}
          disabled={isPurchasing || isRestoring}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.subscribeBtnText, { fontFamily: "Inter_700Bold" }]}>
              Start Premium — {price}/month
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          activeOpacity={0.7}
          disabled={isPurchasing || isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={[styles.restoreText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              Restore purchases
            </Text>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <Text style={[styles.legalText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          By subscribing you agree to our{" "}
          <Text style={{ color: HERB }} onPress={() => router.push("/terms-of-service")}>
            Terms of Service
          </Text>
          {" & "}
          <Text style={{ color: HERB }} onPress={() => router.push("/privacy-policy")}>
            Privacy Policy
          </Text>
          . Subscription renews automatically monthly. Cancel anytime in your App Store or Play Store settings.
        </Text>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  hero: { borderRadius: 16, padding: 20, alignItems: "center", gap: 8 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 24, letterSpacing: -0.6, textAlign: "center", lineHeight: 32 },
  heroSub: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  priceCard: {
    borderRadius: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  priceSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", marginTop: 2 },
  priceRight: { alignItems: "flex-end" },
  priceAmount: { fontSize: 30, fontFamily: "SpaceGrotesk_600SemiBold", color: "#fff", letterSpacing: -1 },
  pricePer: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginTop: 4 },
  featuresCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  featureIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 2 },
  featureText: { flex: 1, gap: 6 },
  featureTitle: { fontSize: 14 },
  featureTiers: { gap: 3 },
  featureTierRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  featureFree: { fontSize: 12 },
  featurePremium: { fontSize: 12 },
  errorText: { fontSize: 13, textAlign: "center" },
  subscribeBtn: {
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: HERB,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  subscribeBtnText: { color: "#fff", fontSize: 17 },
  restoreBtn: { alignItems: "center", paddingVertical: 8 },
  restoreText: { fontSize: 14 },
  legalText: { fontSize: 11, textAlign: "center", lineHeight: 17 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalCard: { borderRadius: 20, padding: 24, borderWidth: 1, gap: 16, width: "100%" },
  modalTitle: { fontSize: 20, letterSpacing: -0.3 },
  modalBody: { fontSize: 14, lineHeight: 21 },
  modalConfirm: { height: 50, borderRadius: 100, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: "#fff", fontSize: 16 },
  modalCancel: { alignItems: "center", paddingVertical: 4 },
  modalCancelText: { fontSize: 15 },
});
