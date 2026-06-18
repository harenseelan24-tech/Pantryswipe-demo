import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSubscription } from "@/lib/revenuecat";
import { ElectricBorder } from "@/components/ElectricBorder";

const HERB = "#4CAF76";
const SAFFRON = "#F5A623";

const BENEFITS = [
  { icon: "zap", label: "Unlimited AI Chef recipes & pantry insights" },
  { icon: "clock", label: "Smart expiry prediction + freeze alerts" },
  { icon: "calendar", label: "Full auto meal planning from your pantry" },
];

function useResetTimer() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(`${h}h ${m}m`);
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, []);
  return label;
}

interface Props {
  visible: boolean;
  usedCount: number;
  freeLimit: number;
  onDismiss: () => void;
}

export function PremiumBottomSheet({ visible, usedCount, freeLimit, onDismiss }: Props) {
  const router = useRouter();
  const { offerings, purchase, isPurchasing } = useSubscription();
  const resetIn = useResetTimer();

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(500)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const packageToPurchase = offerings?.current?.availablePackages[0];
  const price = packageToPurchase?.product.priceString ?? "S$4.99";

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetAnim, { toValue: 0, tension: 68, friction: 13, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      pulseAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDismiss();
    router.push("/paywall");
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  if (!visible && Platform.OS !== "web") return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Lock badge */}
        <View style={styles.topSection}>
          <View style={styles.lockBadge}>
            <View style={[styles.lockOuter, { borderColor: "#E84040" + "30" }]}>
              <View style={[styles.lockInner, { backgroundColor: "#E84040" + "12" }]}>
                <Feather name="lock" size={22} color="#E84040" />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Daily limit reached</Text>

          {/* Usage pill */}
          <View style={styles.usagePill}>
            {Array.from({ length: freeLimit }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.usageDot,
                  i < usedCount
                    ? { backgroundColor: "#E84040" }
                    : { backgroundColor: "#2A2724" },
                ]}
              />
            ))}
          </View>
          <Text style={styles.usageLabel}>
            {usedCount}/{freeLimit} free recipes used today
          </Text>

          {/* Reset timer */}
          <View style={styles.resetRow}>
            <Feather name="refresh-cw" size={11} color="#9E9E9E" />
            <Text style={styles.resetText}>Resets in {resetIn}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Benefits */}
        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.label} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: HERB + "18" }]}>
                <Feather name={b.icon as any} size={13} color={HERB} />
              </View>
              <Text style={styles.benefitText}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Price strip */}
        <View style={[styles.priceStrip, { backgroundColor: HERB + "12", borderColor: HERB + "30" }]}>
          <Text style={[styles.priceText, { color: HERB }]}>
            {price}<Text style={styles.pricePer}>/month</Text>
          </Text>
          <Text style={styles.priceCompare}>☕ Less than one coffee a month</Text>
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <ElectricBorder color={HERB} speed={1.1} chaos={0.1} borderRadius={100}>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: HERB, opacity: isPurchasing ? 0.7 : 1 }]}
              onPress={handleUpgrade}
              activeOpacity={0.88}
              disabled={isPurchasing}
            >
              <Feather name="zap" size={17} color="#fff" />
              <Text style={styles.ctaBtnText}>Unlock Premium</Text>
            </TouchableOpacity>
          </ElectricBorder>
        </Animated.View>

        {/* Dismiss */}
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} activeOpacity={0.65}>
          <Text style={styles.dismissText}>Not now — wait until tomorrow</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#141210",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: "#2A2724",
  },
  handleContainer: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#3A3530" },

  topSection: { alignItems: "center", paddingTop: 10, paddingBottom: 20, gap: 10 },
  lockBadge: { alignItems: "center", justifyContent: "center" },
  lockOuter: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  lockInner: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    color: "#F0EDE8",
    fontSize: 21,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  usagePill: { flexDirection: "row", gap: 6, alignItems: "center" },
  usageDot: { width: 24, height: 6, borderRadius: 3 },
  usageLabel: { color: "#9E9E9E", fontSize: 13, fontFamily: "Inter_400Regular" },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  resetText: { color: "#9E9E9E", fontSize: 12, fontFamily: "Inter_400Regular" },

  divider: { height: 1, backgroundColor: "#2A2724", marginBottom: 18 },

  benefits: { gap: 11, marginBottom: 18 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  benefitText: { color: "#D4CEC8", fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },

  priceStrip: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12,
    alignItems: "center", gap: 4,
    marginBottom: 16,
  },
  priceText: { fontSize: 24, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: -0.8 },
  pricePer: { fontSize: 13, fontFamily: "Inter_400Regular" },
  priceCompare: { color: "#9E9E9E", fontSize: 12, fontFamily: "Inter_400Regular" },

  ctaBtn: {
    height: 56, borderRadius: 100,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    shadowColor: "#4CAF76",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 6, marginBottom: 14,
  },
  ctaBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },

  dismissBtn: { alignItems: "center", paddingVertical: 4 },
  dismissText: { color: "#666", fontSize: 13, fontFamily: "Inter_400Regular" },
});
