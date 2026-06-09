import React, { useRef, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { StatusBar } from "expo-status-bar";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background image */}
      <View style={StyleSheet.absoluteFill}>
        {(() => {
          try {
            return (
              <Image
                source={require("@/assets/images/hero-food.png")}
                style={styles.bgImage}
                resizeMode="cover"
              />
            );
          } catch {
            return <View style={[styles.bgFallback, { backgroundColor: "#1a0d00" }]} />;
          }
        })()}
        <View style={styles.overlay} />
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: topPadding + 40,
            paddingBottom: bottomPadding + 24,
          },
        ]}
      >
        {/* Logo area */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, { backgroundColor: colors.saffron }]}>
            <Text style={styles.logoEmoji}>🍳</Text>
          </View>
          <Text style={styles.appName}>PantrySwipe</Text>
          <Text style={styles.tagline}>Cook what you already have.</Text>
        </View>

        {/* Bottom CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.saffron }]}
            onPress={() => router.push("/onboarding")}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141210",
  },
  bgImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  bgFallback: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  logoContainer: {
    alignItems: "center",
    gap: 16,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  tagline: {
    fontSize: 18,
    color: "rgba(255,255,255,0.80)",
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 26,
  },
  ctaContainer: {
    gap: 14,
  },
  primaryButton: {
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  legalText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 16,
  },
});
