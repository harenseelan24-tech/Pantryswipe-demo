import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Brand palette (inline, same as all other screens) ─────────────────────────
const C = {
  primary:        "#F5A623",
  textMuted:      "#7A7570",
  background:     "#FAFAF8",
  surfaceLow:     "#FFF1E4",
  outlineVariant: "#D7C3AE",
} as const;

// ── Tab icon with amber pill indicator when active ────────────────────────────
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
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  wrapActive: {
    backgroundColor: C.surfaceLow,
  },
});

// ─── Tab layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Block Android hardware back from popping tabs to blank index screen
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  // Web: fixed compact height. Native: icon area + safe area, pulled slightly tighter.
  const tabHeight = isWeb
    ? 66
    : 54 + Math.max(insets.bottom - 2, 0);

  const bottomPad = isWeb
    ? 10
    : Math.max(insets.bottom - 2, 4);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "rgba(250,250,248,0.97)",
          borderTopWidth: 0,
          elevation: 0,
          height: tabHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
          // Amber-tinted upward shadow — matches screen header pattern
          shadowColor: "rgba(131,85,0,1)",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(250,250,248,0.97)",
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: C.outlineVariant,
              },
            ]}
          />
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
