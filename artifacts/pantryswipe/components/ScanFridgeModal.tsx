import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Platform, ScrollView, Animated, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCameraStream } from "@/hooks/useCameraStream";
import type { DetectedItem } from "@/types/scanning";
import { CATEGORY_EMOJIS } from "@/types/scanning";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  onDone: (items: DetectedItem[]) => void;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function mergeItems(prev: DetectedItem[], newItems: DetectedItem[]): DetectedItem[] {
  let updated = [...prev];
  for (const ni of newItems) {
    const existing = updated.find((e) => e.name.toLowerCase() === ni.name.toLowerCase());
    if (existing) {
      updated = updated.map((e) =>
        e.name.toLowerCase() === ni.name.toLowerCase()
          ? { ...e, quantity: e.quantity + ni.quantity }
          : e
      );
    } else {
      updated.push({ ...ni, id: generateId(), emoji: CATEGORY_EMOJIS[ni.category?.toLowerCase()] ?? "🍽️" });
    }
  }
  return updated;
}

export default function ScanFridgeModal({ visible, onClose, onDone }: Props) {
  const colors = useColors();
  const { videoRef, isLoading: webLoading, error, startStream, captureFrame, stopStream } = useCameraStream("environment");

  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [noItemsCount, setNoItemsCount] = useState(0);
  const [slowWarning, setSlowWarning] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Native-only state
  const [nativePhase, setNativePhase] = useState<"idle" | "scanning" | "error-perm" | "error-offline" | "error-unknown">("idle");
  const [nativeLoading, setNativeLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pillAnims = useRef<Record<string, Animated.Value>>({});

  const stopScanning = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const handleClose = useCallback(() => {
    stopScanning();
    if (Platform.OS === "web") stopStream();
    setDetectedItems([]);
    setPermDenied(false);
    setOfflineError(false);
    setSlowWarning(false);
    setNativePhase("idle");
    setNativeLoading(false);
    onClose();
  }, [stopScanning, stopStream, onClose]);

  // ── Web: start stream on open ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    (async () => {
      const ok = await startStream();
      if (!ok) setPermDenied(true);
    })();
    return () => { stopScanning(); stopStream(); };
  }, [visible]);

  // ── Web: polling scan loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !scanning || Platform.OS !== "web") return;

    intervalRef.current = setInterval(async () => {
      if (!navigator.onLine) { setOfflineError(true); stopScanning(); return; }

      const frame = captureFrame();
      if (!frame) return;

      const slowTimer = setTimeout(() => setSlowWarning(true), 15000);

      try {
        const res = await fetch(`${API_BASE}/vision/scan-pantry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: frame }),
          signal: AbortSignal.timeout(45000),
        });
        clearTimeout(slowTimer);
        setSlowWarning(false);

        if (!res.ok) return;
        const data = (await res.json()) as { items?: DetectedItem[] };
        const newItems = data.items ?? [];

        if (newItems.length === 0) {
          setNoItemsCount((c) => c + 1);
        } else {
          setNoItemsCount(0);
          setDetectedItems((prev) => {
            const merged = mergeItems(prev, newItems);
            for (const item of merged) {
              if (!pillAnims.current[item.id]) {
                pillAnims.current[item.id] = new Animated.Value(30);
                Animated.spring(pillAnims.current[item.id], { toValue: 0, useNativeDriver: true, tension: 80 }).start();
              }
            }
            return merged;
          });
        }
      } catch {
        clearTimeout(slowTimer);
      }
    }, 2500);

    return () => stopScanning();
  }, [visible, scanning]);

  const handleWebDone = useCallback(() => {
    stopScanning();
    stopStream();
    onDone(detectedItems);
  }, [detectedItems, stopScanning, stopStream, onDone]);

  // ── Native: gallery upload ─────────────────────────────────────────────────
  const handleNativeGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { setNativePhase("error-perm"); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      base64: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const base64 = result.assets[0].base64;
    setNativeLoading(true);
    setNativePhase("scanning");

    try {
      const res = await fetch(`${API_BASE}/vision/scan-pantry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) throw new Error("api-error");
      const data = (await res.json()) as { items?: DetectedItem[] };
      const newItems = data.items ?? [];

      if (newItems.length === 0) {
        setNativePhase("error-unknown");
      } else {
        setDetectedItems((prev) => {
          const merged = mergeItems(prev, newItems);
          for (const item of merged) {
            if (!pillAnims.current[item.id]) {
              pillAnims.current[item.id] = new Animated.Value(30);
              Animated.spring(pillAnims.current[item.id], { toValue: 0, useNativeDriver: true, tension: 80 }).start();
            }
          }
          return merged;
        });
        setNativePhase("idle");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.name : "";
      if (msg === "NetworkError") {
        setNativePhase("error-offline");
      } else {
        setNativePhase("error-unknown");
      }
    } finally {
      setNativeLoading(false);
    }
  }, []);

  // ── Native: take a photo and scan it ──────────────────────────────────────
  const handleNativeScan = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setNativePhase("error-perm");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      base64: true,
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const base64 = result.assets[0].base64;
    setNativeLoading(true);
    setNativePhase("scanning");

    try {
      const res = await fetch(`${API_BASE}/vision/scan-pantry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) throw new Error("api-error");
      const data = (await res.json()) as { items?: DetectedItem[] };
      const newItems = data.items ?? [];

      if (newItems.length === 0) {
        setNativePhase("error-unknown");
      } else {
        setDetectedItems((prev) => {
          const merged = mergeItems(prev, newItems);
          for (const item of merged) {
            if (!pillAnims.current[item.id]) {
              pillAnims.current[item.id] = new Animated.Value(30);
              Animated.spring(pillAnims.current[item.id], { toValue: 0, useNativeDriver: true, tension: 80 }).start();
            }
          }
          return merged;
        });
        setNativePhase("idle");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.name : "";
      if (msg === "NetworkError") {
        setNativePhase("error-offline");
      } else {
        setNativePhase("error-unknown");
      }
    } finally {
      setNativeLoading(false);
    }
  }, []);

  const s = styles(colors);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={s.root}>

        {/* ── WEB ─────────────────────────────────────────────────────── */}
        {Platform.OS === "web" ? (
          <>
            <video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as React.CSSProperties}
              autoPlay playsInline muted
            />

            <View style={s.frameGuide} pointerEvents="none">
              <Animated.View style={s.scanLine} />
            </View>

            <Text style={s.instruction}>Point at food items — hold steady</Text>

            {permDenied && (
              <View style={s.stateCard}>
                <Text style={s.stateTitle}>📷 Camera access denied</Text>
                <Text style={s.stateBody}>
                  Go to your browser settings → Site Settings → Camera → Allow for this site.
                </Text>
                <TouchableOpacity style={[s.stateBtn, { backgroundColor: colors.primary }]} onPress={handleClose}>
                  <Text style={s.stateBtnTxt}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {offlineError && (
              <View style={s.stateCard}>
                <Text style={s.stateTitle}>📡 You're offline</Text>
                <Text style={s.stateBody}>Camera scanning needs an internet connection. Try manual entry instead.</Text>
                <TouchableOpacity style={[s.stateBtn, { backgroundColor: colors.primary }]} onPress={handleClose}>
                  <Text style={s.stateBtnTxt}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {webLoading && !permDenied && (
              <View style={s.stateCard}>
                <Text style={s.stateTitle}>📷 Starting camera...</Text>
              </View>
            )}

            {!permDenied && !offlineError && !webLoading && (
              <View style={s.bottomTray}>
                {slowWarning && <Text style={s.slowTxt}>⏳ Taking longer than usual...</Text>}
                {noItemsCount >= 3 && detectedItems.length === 0 && (
                  <Text style={s.slowTxt}>🔍 Nothing detected yet — move closer and ensure good lighting</Text>
                )}
                <ScrollView style={s.pillScroll} showsVerticalScrollIndicator={false}>
                  {detectedItems.map((item) => (
                    <Animated.View
                      key={item.id}
                      style={[s.pill, { transform: [{ translateY: pillAnims.current[item.id] ?? new Animated.Value(0) }] }]}
                    >
                      <Text style={s.pillTxt}>{item.emoji} {item.name} · {item.quantity} {item.unit}</Text>
                    </Animated.View>
                  ))}
                </ScrollView>

                {!scanning ? (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => setScanning(true)}>
                    <Text style={s.actionBtnTxt}>▶ Start Scanning</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: detectedItems.length > 0 ? colors.primary : colors.border }]}
                    onPress={handleWebDone}
                    disabled={detectedItems.length === 0}
                  >
                    <Text style={s.actionBtnTxt}>Done → {detectedItems.length} item{detectedItems.length !== 1 ? "s" : ""}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        ) : (
          /* ── NATIVE ─────────────────────────────────────────────────── */
          <View style={s.nativeRoot}>
            <Text style={s.nativeTitle}>📸 Scan Your Fridge or Pantry</Text>
            <Text style={s.nativeSubtitle}>
              Take a photo of your fridge shelf, pantry cupboard, or any food items. Claude AI will identify everything.
            </Text>

            {/* Detected items */}
            {detectedItems.length > 0 && (
              <View style={s.nativePillsBox}>
                <Text style={s.nativePillsHeader}>
                  {detectedItems.length} item{detectedItems.length !== 1 ? "s" : ""} detected
                </Text>
                <ScrollView style={s.nativePillScroll} showsVerticalScrollIndicator={false}>
                  {detectedItems.map((item) => (
                    <Animated.View
                      key={item.id}
                      style={[s.nativePill, { transform: [{ translateY: pillAnims.current[item.id] ?? new Animated.Value(0) }] }]}
                    >
                      <Text style={s.nativePillTxt}>{item.emoji} {item.name} · {item.quantity} {item.unit}</Text>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Error states */}
            {nativePhase === "error-perm" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTxt}>📷 Camera permission denied. Go to Settings → PantrySwipe → Camera and enable access.</Text>
              </View>
            )}
            {nativePhase === "error-offline" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTxt}>📡 No internet connection. Connect to Wi-Fi or mobile data and try again.</Text>
              </View>
            )}
            {nativePhase === "error-unknown" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTxt}>⚠️ Scan failed — please try again.</Text>
              </View>
            )}

            {/* Loading overlay */}
            {nativeLoading && (
              <View style={s.nativeLoadingBox}>
                <Text style={{ fontSize: 48, textAlign: "center" }}>🔍</Text>
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 4 }} />
                <Text style={s.nativeLoadingTxt}>AI is identifying your food...</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center" }}>This takes 10–30 seconds</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={s.nativeActions}>
              <TouchableOpacity
                style={[s.nativePrimaryBtn, { backgroundColor: colors.primary, opacity: nativeLoading ? 0.6 : 1 }]}
                onPress={handleNativeScan}
                disabled={nativeLoading}
              >
                <Feather name="camera" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.nativePrimaryBtnTxt}>
                  {detectedItems.length === 0 ? "Take a Photo" : "Scan Another Shelf"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.nativeOutlineBtn, { opacity: nativeLoading ? 0.5 : 1 }]}
                onPress={handleNativeGallery}
                disabled={nativeLoading}
              >
                <Feather name="image" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
                <Text style={s.nativeOutlineBtnTxt}>Choose from Gallery</Text>
              </TouchableOpacity>

              {detectedItems.length > 0 && (
                <TouchableOpacity
                  style={[s.nativeSecondaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => { stopScanning(); onDone(detectedItems); }}
                >
                  <Text style={s.nativeSecondaryBtnTxt}>
                    Done — Add {detectedItems.length} Item{detectedItems.length !== 1 ? "s" : ""} →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Close button */}
        <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function styles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },

    // Web styles
    frameGuide: {
      position: "absolute", top: "15%", left: "10%", right: "10%", height: "55%",
      borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, overflow: "hidden",
    },
    scanLine: { width: "100%", height: 3, backgroundColor: "rgba(91,142,245,0.6)", marginTop: 0 },
    instruction: {
      position: "absolute", top: "11%", left: 0, right: 0,
      color: "#fff", textAlign: "center", fontSize: 14, fontWeight: "600",
      textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
    },
    bottomTray: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: "rgba(0,0,0,0.75)", padding: 20, paddingBottom: 48, gap: 10, maxHeight: "45%",
    },
    pillScroll: { maxHeight: 140 },
    pill: {
      backgroundColor: "rgba(91,142,245,0.85)", borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 6,
    },
    pillTxt: { color: "#fff", fontSize: 13, fontWeight: "600" },
    actionBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
    actionBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
    slowTxt: { color: "#FFD580", fontSize: 12, textAlign: "center" },
    stateCard: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      alignItems: "center", justifyContent: "center",
      padding: 40, backgroundColor: "rgba(0,0,0,0.85)", gap: 12,
    },
    stateTitle: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
    stateBody: { color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", lineHeight: 20 },
    stateBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
    stateBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
    closeBtn: {
      position: "absolute", top: 52, left: 20,
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },

    // Native styles
    nativeRoot: {
      flex: 1, backgroundColor: "#111", paddingTop: 100, paddingHorizontal: 24,
      paddingBottom: 40, gap: 20,
    },
    nativeTitle: {
      color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center",
    },
    nativeSubtitle: {
      color: "rgba(255,255,255,0.65)", fontSize: 14, textAlign: "center", lineHeight: 20,
    },
    nativePillsBox: {
      backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, gap: 8,
    },
    nativePillsHeader: {
      color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5,
    },
    nativePillScroll: { maxHeight: 180 },
    nativePill: {
      backgroundColor: "rgba(91,142,245,0.85)", borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 7, alignSelf: "flex-start", marginBottom: 6,
    },
    nativePillTxt: { color: "#fff", fontSize: 14, fontWeight: "600" },
    nativeError: {
      backgroundColor: "rgba(232,64,64,0.15)", borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: "rgba(232,64,64,0.3)",
    },
    nativeErrorTxt: { color: "#FF8080", fontSize: 13, textAlign: "center", lineHeight: 18 },
    nativeLoadingBox: {
      alignItems: "center", gap: 12, paddingVertical: 8,
    },
    nativeLoadingTxt: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
    nativeActions: { gap: 12, marginTop: "auto" },
    nativePrimaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 16, borderRadius: 14,
    },
    nativePrimaryBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "700" },
    nativeOutlineBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    },
    nativeOutlineBtnTxt: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "600" },
    nativeSecondaryBtn: {
      paddingVertical: 15, borderRadius: 14, alignItems: "center",
    },
    nativeSecondaryBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
