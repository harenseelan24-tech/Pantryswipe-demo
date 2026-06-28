import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  primary:        "#F5A623",
  textMuted:      "#7A7570",
  background:     "#FAFAF8",
  surfaceLow:     "#FFF1E4",
  outlineVariant: "#D7C3AE",
} as const;

// ── Native tab modules (graceful fallback) ─────────────────────────────────────
let isLiquidGlassAvailable: (() => boolean) | null = null;
let NativeTabs: any = null;
let NativeTabsIcon: any = null;
let NativeTabsLabel: any = null;

try {
  const glassEffect = require("expo-glass-effect");
  isLiquidGlassAvailable = glassEffect.isLiquidGlassAvailable;
} catch {
  // expo-glass-effect not available in Expo Go
}

try {
  const nativeTabs = require("expo-router/unstable-native-tabs");
  NativeTabs = nativeTabs.NativeTabs;
  NativeTabsIcon = nativeTabs.Icon;
  NativeTabsLabel = nativeTabs.Label;
} catch {
  // unstable-native-tabs not available in Expo Go
}

// ── iOS 26+ Liquid Glass tab bar (system-managed UI, kept verbatim) ────────────
function NativeTabLayout() {
  if (!NativeTabs) return null;
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabsIcon sf={{ default: "sparkle", selected: "sparkles" }} />
        <NativeTabsLabel>Discover</NativeTabsLabel>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pantry">
        <NativeTabsIcon sf={{ default: "bag", selected: "bag.fill" }} />
        <NativeTabsLabel>Pantry</NativeTabsLabel>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="planner">
        <NativeTabsIcon sf={{ default: "fork.knife", selected: "fork.knife" }} />
        <NativeTabsLabel>Planner</NativeTabsLabel>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="social">
        <NativeTabsIcon sf={{ default: "heart", selected: "heart.fill" }} />
        <NativeTabsLabel>Social</NativeTabsLabel>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabsIcon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
        <NativeTabsLabel>Profile</NativeTabsLabel>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// ── Tab icon: amber pill when active ──────────────────────────────────────────
function TabIcon({ icon, focused }: { icon: React.ComponentProps<typeof Feather>["name"]; focused: boolean }) {
  return (
    <View
      style={[
        tabIconStyles.wrap,
        focused && tabIconStyles.wrapActive,
      ]}
    >
      <Feather name={icon} size={22} color={focused ? C.primary : C.textMuted} />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  wrapActive: {
    backgroundColor: C.surfaceLow,
  },
});

// ── BlurView tab bar (iOS < 26 or without Liquid Glass) ───────────────────────
function ClassicTabLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const tabHeight = 54 + Math.max(insets.bottom - 2, 0);
  const bottomPad = Math.max(insets.bottom - 2, 4);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          height: tabHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
          shadowColor: "rgba(131,85,0,1)",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
        },
        tabBarBackground: () => (
          <>
            <BlurView
              intensity={isDark ? 80 : 100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            {/* Hairline top border over blur */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: StyleSheet.hairlineWidth,
                backgroundColor: C.outlineVariant,
              }}
            />
          </>
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Epilogue_700Bold",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="compass" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="shopping-bag" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="heart" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="user" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const liquidGlass = isLiquidGlassAvailable && NativeTabs && isLiquidGlassAvailable();
  if (liquidGlass) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
