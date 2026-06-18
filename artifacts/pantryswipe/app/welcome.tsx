import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { StatusBar } from "expo-status-bar";
import { TextType } from "@/components/TextType";
import { DecryptedText } from "@/components/DecryptedText";

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [screenKey, setScreenKey] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => {
      setScreenKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, delay: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

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

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: topPadding + 12,
            paddingBottom: bottomPadding + 8,
          },
        ]}
      >
        {/* Logo block — icon + name + tagline grouped tightly */}
        <View style={styles.logoBlock}>
          <Image
            source={require("@/assets/images/app-logo.png")}
            style={styles.logoIcon}
            resizeMode="contain"
          />

          <TextType
            key={`title-${screenKey}`}
            text="PantrySwipe"
            typingSpeed={90}
            loop={false}
            showCursor={true}
            cursorCharacter="|"
            cursorBlinkDuration={0.5}
            style={styles.appName}
          />

          <DecryptedText
            key={`tagline-${screenKey}`}
            text="Cook what you already have."
            animateOn="view"
            speed={90}
            maxIterations={14}
            sequential={true}
            revealDirection="start"
            characters="abcdefghijklmnopqrstuvwxyz"
            style={styles.tagline}
          />
        </View>

        {/* Spacer pushes CTA to bottom */}
        <View style={{ flex: 1 }} />

        {/* CTA buttons */}
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
            onPress={() => router.push("/sign-in")}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            By continuing, you agree to our{" "}
            <Text style={styles.legalLink} onPress={() => router.push("/terms-of-service")}>
              Terms of Service
            </Text>
            {" & "}
            <Text style={styles.legalLink} onPress={() => router.push("/privacy-policy")}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141210" },
  bgImage: { width: "100%", height: "100%", position: "absolute" },
  bgFallback: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.52)" },

  content: {
    flex: 1,
    paddingHorizontal: 28,
  },

  /* Logo block: icon → small gap → title → tiny gap → tagline */
  logoBlock: {
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },


  appName: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.5,
    textAlign: "center",
    lineHeight: 46,
  },
  tagline: {
    fontSize: 18,
    color: "rgba(255,255,255,0.80)",
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 24,
  },

  /* Spacer + CTA */
  ctaContainer: { gap: 12 },
  primaryButton: {
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
  secondaryButton: {
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  secondaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  legalText: { fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 16 },
  legalLink: { color: "rgba(255,255,255,0.75)", fontWeight: "600", textDecorationLine: "underline" },
});
