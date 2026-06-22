import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React from "react";
import { StyleSheet, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

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

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.saffron,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={100}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <SymbolView name="sparkles" tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          tabBarIcon: ({ color }) => (
            <SymbolView name="bag.fill" tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color }) => (
            <SymbolView name="fork.knife" tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ color }) => (
            <SymbolView name="heart.fill" tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <SymbolView name="person.crop.circle.fill" tintColor={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const liquidGlass = isLiquidGlassAvailable && NativeTabs && isLiquidGlassAvailable();
  if (liquidGlass) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
