import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Platform, ActivityIndicator,
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

type WebPhase = "preview" | "reading" | "error-unclear" | "error-offline" | "error-denied";
type NativePhase = "idle" | "reading" | "error-unclear" | "error-offline" | "error-perm" | "error-unknown";

export default function ScanReceiptModal({ visible, onClose, onDone }: Props) {
  const colors = useColors();
  const { videoRef, isLoading, startStream, captureFrame, stopStream } = useCameraStream("environment");

  // Web state
  const [webPhase, setWebPhase] = useState<WebPhase>("preview");
  const [torchOn, setTorchOn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Native state
  const [nativePhase, setNativePhase] = useState<NativePhase>("idle");

  const handleClose = useCallback(() => {
    if (Platform.OS === "web") stopStream();
    setWebPhase("preview");
    setNativePhase("idle");
    setTorchOn(false);
    onClose();
  }, [stopStream, onClose]);

  // ── Web: start stream on open ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    (async () => {
      const ok = await startStream();
      if (!ok) setWebPhase("error-denied");
    })();
    return () => stopStream();
  }, [visible]);

  // ── Web: send captured frame to API ───────────────────────────────────────
  const sendImageWeb = useCallback(async (base64: string) => {
    setWebPhase("reading");

    if (!navigator.onLine) { setWebPhase("error-offline"); return; }

    const attemptScan = async (): Promise<DetectedItem[] | null> => {
      try {
        const res = await fetch(`${API_BASE}/vision/scan-receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { items?: DetectedItem[] };
        return data.items ?? [];
      } catch {
        return null;
      }
    };

    const items = await attemptScan();
    if (items === null || items.length === 0) {
      setWebPhase("error-unclear");
      return;
    }

    stopStream();
    const enriched = items.map((item) => ({
      ...item,
      id: generateId(),
      emoji: CATEGORY_EMOJIS[item.category?.toLowerCase()] ?? "🍽️",
    }));
    onDone(enriched);
  }, [stopStream, onDone]);

  const handleWebShutter = useCallback(() => {
    const frame = captureFrame();
    if (!frame) return;
    sendImageWeb(frame);
  }, [captureFrame, sendImageWeb]);

  const handleWebGallery = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.replace(/^data:image\/[a-z]+;base64,/, "");
      sendImageWeb(base64);
    };
    reader.readAsDataURL(file);
  }, [sendImageWeb]);

  const toggleTorch = useCallback(async () => {
    try {
      const tracks = (videoRef.current as HTMLVideoElement & { srcObject: MediaStream | null })
        ?.srcObject?.getVideoTracks?.();
      if (!tracks?.length) return;
      await tracks[0].applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      // device doesn't support torch — ignore
    }
  }, [torchOn, videoRef]);

  // ── Native: launch camera and send to API ─────────────────────────────────
  const handleNativeCapture = useCallback(async () => {
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
    setNativePhase("reading");

    try {
      const res = await fetch(`${API_BASE}/vision/scan-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) { setNativePhase("error-unclear"); return; }
      const data = (await res.json()) as { items?: DetectedItem[] };
      const items = data.items ?? [];

      if (items.length === 0) {
        setNativePhase("error-unclear");
        return;
      }

      const enriched = items.map((item) => ({
        ...item,
        id: generateId(),
        emoji: CATEGORY_EMOJIS[item.category?.toLowerCase()] ?? "🍽️",
      }));
      onDone(enriched);
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") {
        setNativePhase("error-unclear");
      } else {
        setNativePhase("error-offline");
      }
    }
  }, [onDone]);

  const handleNativeGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setNativePhase("error-perm");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      base64: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const base64 = result.assets[0].base64;
    setNativePhase("reading");

    try {
      const res = await fetch(`${API_BASE}/vision/scan-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) { setNativePhase("error-unclear"); return; }
      const data = (await res.json()) as { items?: DetectedItem[] };
      const items = data.items ?? [];

      if (items.length === 0) { setNativePhase("error-unclear"); return; }

      const enriched = items.map((item) => ({
        ...item,
        id: generateId(),
        emoji: CATEGORY_EMOJIS[item.category?.toLowerCase()] ?? "🍽️",
      }));
      onDone(enriched);
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") {
        setNativePhase("error-unclear");
      } else {
        setNativePhase("error-offline");
      }
    }
  }, [onDone]);

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

            {webPhase === "preview" && (
              <>
                <View style={s.receiptFrame} pointerEvents="none">
                  {(["tl", "tr", "bl", "br"] as const).map((c) => (
                    <View key={c} style={[s.corner, {
                      top: c[0] === "t" ? 0 : undefined, bottom: c[0] === "b" ? 0 : undefined,
                      left: c[1] === "l" ? 0 : undefined, right: c[1] === "r" ? 0 : undefined,
                      borderTopWidth: c[0] === "t" ? 3 : 0, borderBottomWidth: c[0] === "b" ? 3 : 0,
                      borderLeftWidth: c[1] === "l" ? 3 : 0, borderRightWidth: c[1] === "r" ? 3 : 0,
                    }]} />
                  ))}
                </View>
                <Text style={s.instruction}>Align receipt in the frame — tap shutter to capture</Text>
                <View style={s.bottomTray}>
                  <TouchableOpacity style={s.shutter} onPress={handleWebShutter}>
                    <View style={s.shutterInner} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleWebGallery}>
                    <Text style={s.galleryTxt}>Upload from gallery</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.torchBtn} onPress={toggleTorch}>
                  <Feather name={torchOn ? "zap" : "zap-off"} size={22} color="#fff" />
                </TouchableOpacity>
              </>
            )}

            {webPhase === "reading" && (
              <View style={s.overlay}>
                <Text style={{ fontSize: 48 }}>🧾</Text>
                <ActivityIndicator color="#fff" size="large" style={{ marginTop: 16 }} />
                <Text style={s.overlayTxt}>Reading your receipt...</Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center" }}>AI is extracting items — this takes 10–30 seconds</Text>
              </View>
            )}

            {webPhase === "error-unclear" && (
              <View style={s.overlay}>
                <Text style={{ fontSize: 40 }}>📄</Text>
                <Text style={s.errorTitle}>Receipt unclear</Text>
                <Text style={s.errorBody}>Try better lighting, flatten the receipt, or move closer.</Text>
                <TouchableOpacity style={[s.errorBtn, { backgroundColor: colors.primary }]} onPress={() => setWebPhase("preview")}>
                  <Text style={s.errorBtnTxt}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={s.galleryTxt}>Type manually instead</Text>
                </TouchableOpacity>
              </View>
            )}

            {webPhase === "error-offline" && (
              <View style={s.overlay}>
                <Text style={s.errorTitle}>📡 You're offline</Text>
                <Text style={s.errorBody}>Camera scanning needs an internet connection.</Text>
                <TouchableOpacity style={[s.errorBtn, { backgroundColor: colors.primary }]} onPress={handleClose}>
                  <Text style={s.errorBtnTxt}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {webPhase === "error-denied" && (
              <View style={s.overlay}>
                <Text style={s.errorTitle}>📷 Camera access denied</Text>
                <Text style={s.errorBody}>Go to your browser settings → Site Settings → Camera → Allow for this site.</Text>
                <TouchableOpacity style={[s.errorBtn, { backgroundColor: colors.primary }]} onPress={handleClose}>
                  <Text style={s.errorBtnTxt}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoading && webPhase === "preview" && (
              <View style={s.overlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={s.overlayTxt}>Starting camera...</Text>
              </View>
            )}

            {typeof document !== "undefined" && (
              <input
                ref={fileInputRef as React.RefObject<HTMLInputElement>}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            )}
          </>
        ) : (
          /* ── NATIVE ─────────────────────────────────────────────────── */
          <View style={s.nativeRoot}>
            <Text style={s.nativeTitle}>🧾 Scan Your Receipt</Text>
            <Text style={s.nativeSubtitle}>
              Take a photo of your grocery receipt and Claude AI will extract all the food items automatically.
            </Text>

            {/* Reading overlay */}
            {nativePhase === "reading" && (
              <View style={s.nativeLoadingBox}>
                <Text style={{ fontSize: 56, textAlign: "center" }}>🧾</Text>
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 8 }} />
                <Text style={s.nativeLoadingTxt}>AI is reading your receipt...</Text>
                <Text style={s.nativeLoadingHint}>This usually takes 10–30 seconds</Text>
                <Text style={[s.nativeLoadingHint, { marginTop: 4 }]}>Claude AI is extracting all food items</Text>
              </View>
            )}

            {/* Error states */}
            {nativePhase === "error-unclear" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTitle}>📄 Couldn't read receipt</Text>
                <Text style={s.nativeErrorTxt}>
                  No items were detected. Try better lighting, flatten the receipt fully, or use "Choose from Gallery" to upload a saved photo.
                </Text>
                <TouchableOpacity
                  style={[s.nativeRetryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setNativePhase("idle")}
                >
                  <Text style={s.nativeRetryBtnTxt}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {nativePhase === "error-perm" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTitle}>📷 Permission denied</Text>
                <Text style={s.nativeErrorTxt}>
                  Go to Settings → PantrySwipe → Camera and enable camera access, then come back.
                </Text>
              </View>
            )}

            {nativePhase === "error-offline" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTitle}>📡 No connection</Text>
                <Text style={s.nativeErrorTxt}>Connect to Wi-Fi or mobile data and try again.</Text>
                <TouchableOpacity
                  style={[s.nativeRetryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setNativePhase("idle")}
                >
                  <Text style={s.nativeRetryBtnTxt}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {nativePhase === "error-unknown" && (
              <View style={s.nativeError}>
                <Text style={s.nativeErrorTitle}>⚠️ Scan failed</Text>
                <Text style={s.nativeErrorTxt}>Something went wrong. Please try again.</Text>
                <TouchableOpacity
                  style={[s.nativeRetryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setNativePhase("idle")}
                >
                  <Text style={s.nativeRetryBtnTxt}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Buttons — shown when not loading */}
            {nativePhase !== "reading" && (
              <View style={s.nativeActions}>
                <TouchableOpacity
                  style={[s.nativePrimaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleNativeCapture}
                >
                  <Feather name="camera" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.nativePrimaryBtnTxt}>Take a Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.nativeSecondaryBtn, { borderColor: "rgba(255,255,255,0.2)" }]}
                  onPress={handleNativeGallery}
                >
                  <Feather name="image" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
                  <Text style={s.nativeSecondaryBtnTxt}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

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
    receiptFrame: {
      position: "absolute", top: "12%", left: "8%", right: "8%", height: "60%", borderRadius: 4,
    },
    corner: { position: "absolute", width: 28, height: 28, borderColor: "#fff" },
    instruction: {
      position: "absolute", top: "8%", left: 0, right: 0,
      color: "#fff", textAlign: "center", fontSize: 14, fontWeight: "600",
      textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
    },
    bottomTray: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: "rgba(0,0,0,0.7)", padding: 28, paddingBottom: 52,
      alignItems: "center", gap: 16,
    },
    shutter: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
      borderWidth: 4, borderColor: "rgba(255,255,255,0.5)",
    },
    shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E84040" },
    galleryTxt: { color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center" },
    torchBtn: {
      position: "absolute", top: 52, right: 20,
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    overlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.88)",
      alignItems: "center", justifyContent: "center", gap: 12, padding: 40,
    },
    overlayTxt: { color: "#fff", fontSize: 18, fontWeight: "600", marginTop: 8 },
    errorTitle: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
    errorBody: { color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", lineHeight: 20 },
    errorBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
    errorBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
    closeBtn: {
      position: "absolute", top: 52, left: 20,
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },

    // Native styles
    nativeRoot: {
      flex: 1, backgroundColor: "#111", paddingTop: 100, paddingHorizontal: 24,
      paddingBottom: 56, gap: 24,
    },
    nativeTitle: {
      color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center",
    },
    nativeSubtitle: {
      color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", lineHeight: 20,
    },
    nativeLoadingBox: {
      flex: 1, alignItems: "center", justifyContent: "center", gap: 12,
    },
    nativeLoadingTxt: { color: "#fff", fontSize: 18, fontWeight: "600" },
    nativeLoadingHint: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
    nativeError: {
      backgroundColor: "rgba(232,64,64,0.12)", borderRadius: 14,
      padding: 18, gap: 10, borderWidth: 1, borderColor: "rgba(232,64,64,0.25)",
    },
    nativeErrorTitle: { color: "#FF8080", fontSize: 16, fontWeight: "700", textAlign: "center" },
    nativeErrorTxt: { color: "rgba(255,255,255,0.65)", fontSize: 13, textAlign: "center", lineHeight: 18 },
    nativeRetryBtn: {
      marginTop: 4, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, alignSelf: "center",
    },
    nativeRetryBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
    nativeActions: { gap: 12, marginTop: "auto" },
    nativePrimaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 17, borderRadius: 14,
    },
    nativePrimaryBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "700" },
    nativeSecondaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 15, borderRadius: 14, borderWidth: 1,
    },
    nativeSecondaryBtnTxt: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "600" },
  });
}
