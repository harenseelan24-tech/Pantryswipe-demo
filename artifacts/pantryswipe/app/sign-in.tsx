import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useColors } from "@/hooks/useColors";
import { STORAGE_KEYS } from "@/constants/storageKeys";

const API_BASE =
  Platform.OS !== "web"
    ? `https://${process.env.EXPO_PUBLIC_API_DOMAIN ?? "zip-repl-cactusussy24.replit.app"}/api`
    : "/api";

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 1 && !loading;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed. Please try again.");
        setLoading(false);
        return;
      }
      if (data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
      }
      // Ensure setup complete is set so root guard routes to tabs
      await AsyncStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, "true");
      router.replace("/(tabs)");
    } catch {
      setError("Unable to connect. Check your internet connection and try again.");
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: topPadding + 8,
      paddingBottom: 12,
      gap: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    body: {
      flex: 1,
      paddingHorizontal: 28,
      paddingTop: 32,
    },
    headline: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -1,
      marginBottom: 8,
    },
    sub: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 36,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      letterSpacing: 0.3,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 20,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 52,
      backgroundColor: colors.card,
    },
    inputRowFocused: {
      borderColor: colors.saffron,
    },
    inputRowError: {
      borderColor: colors.destructive,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.foreground,
      height: "100%",
    },
    errorBox: {
      backgroundColor: colors.destructive + "18",
      borderWidth: 1,
      borderColor: colors.destructive + "40",
      borderRadius: 12,
      padding: 14,
      marginTop: 20,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: colors.destructive,
      lineHeight: 20,
    },
    signInBtn: {
      height: 56,
      borderRadius: 100,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 32,
      backgroundColor: colors.saffron,
    },
    signInBtnDisabled: {
      opacity: 0.5,
    },
    signInBtnText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    footerText: {
      textAlign: "center",
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 24,
      lineHeight: 20,
    },
    footerLink: {
      color: colors.saffron,
      fontWeight: "600",
    },
    bottomPad: {
      height: bottomPadding + 16,
    },
  });

  return (
    <View style={s.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Back button */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Sign In</Text>
        </View>

        <View style={s.body}>
          <Text style={s.headline}>Welcome back 👋</Text>
          <Text style={s.sub}>
            Sign in to your PantrySwipe account to pick up right where you left off.
          </Text>

          <Text style={s.label}>Email</Text>
          <View style={[s.inputRow, error ? s.inputRowError : null]}>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            {emailOk && !error && (
              <Feather name="check-circle" size={18} color={colors.herbGreen} />
            )}
          </View>

          <Text style={s.label}>Password</Text>
          <View style={[s.inputRow, error ? s.inputRowError : null]}>
            <TextInput
              style={s.input}
              placeholder="Your password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name={showPw ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error ? (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={16} color={colors.destructive} style={{ marginTop: 2 }} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Sign In button */}
          <TouchableOpacity
            style={[s.signInBtn, !canSubmit && s.signInBtnDisabled]}
            onPress={handleSignIn}
            disabled={!canSubmit}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.signInBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={s.footerText}>
            Don{"'"}t have an account?{" "}
            <Text
              style={s.footerLink}
              onPress={() => router.replace("/onboarding")}
            >
              Get Started
            </Text>
          </Text>
        </View>

        <View style={s.bottomPad} />
      </KeyboardAvoidingView>
    </View>
  );
}
