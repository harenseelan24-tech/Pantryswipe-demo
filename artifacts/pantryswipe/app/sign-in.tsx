import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 6 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }
        router.replace("/onboarding");
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) { setError(signInErr.message); setLoading(false); return; }
        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_complete")
            .eq("id", data.user.id)
            .single() as { data: { onboarding_complete: boolean } | null };
          if (profile?.onboarding_complete) {
            router.replace("/(tabs)");
          } else {
            router.replace("/onboarding");
          }
        }
      }
    } catch {
      setError("Unable to connect. Check your internet connection and try again.");
      setLoading(false);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.inner, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[s.title, { color: colors.text }]}>
            {isSignUp ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={[s.sub, { color: colors.textSecondary }]}>
            {isSignUp
              ? "Sign up to save your pantry, recipes, and progress."
              : "Sign in to access your pantry and saved recipes."}
          </Text>

          {/* Tab toggle */}
          <View style={[s.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[s.tab, !isSignUp && { backgroundColor: colors.saffron }]}
              onPress={() => { setIsSignUp(false); setError(""); }}
            >
              <Text style={[s.tabTxt, { color: !isSignUp ? "#fff" : colors.textSecondary }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, isSignUp && { backgroundColor: colors.saffron }]}
              onPress={() => { setIsSignUp(true); setError(""); }}
            >
              <Text style={[s.tabTxt, { color: isSignUp ? "#fff" : colors.textSecondary }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <Text style={[s.label, { color: colors.textSecondary }]}>Email</Text>
          <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: error && !emailOk ? "#E84040" : colors.border }]}>
            <Feather name="mail" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.input, { color: colors.text }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailOk && <Feather name="check-circle" size={16} color={colors.herbGreen} />}
          </View>

          {/* Password */}
          <Text style={[s.label, { color: colors.textSecondary }]}>Password</Text>
          <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="lock" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.input, { color: colors.text }]}
              placeholder={isSignUp ? "Create a password (6+ characters)" : "Your password"}
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Feather name={showPw ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color="#E84040" />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.saffron, opacity: canSubmit ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitTxt}>{isSignUp ? "Create Account" : "Sign In"}</Text>
            )}
          </TouchableOpacity>

          {!isSignUp && (
            <TouchableOpacity style={{ alignSelf: "center", marginTop: 8 }}>
              <Text style={[s.forgotTxt, { color: colors.textSecondary }]}>Forgot password?</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24, flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  backBtn: { padding: 4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8, marginBottom: 8 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  tabs: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 28,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabTxt: { fontSize: 15, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 16 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorTxt: { color: "#E84040", fontSize: 13, flex: 1 },
  submitBtn: {
    height: 54,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  submitTxt: { color: "#fff", fontSize: 17, fontWeight: "700" },
  forgotTxt: { fontSize: 14, textDecorationLine: "underline" },
});
