import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";

let KeyboardProvider: React.ComponentType<{ children: React.ReactNode }> | null = null;
try {
  KeyboardProvider = require("react-native-keyboard-controller").KeyboardProvider;
} catch {
  // react-native-keyboard-controller not available in Expo Go
}

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: "none" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="recipe/[id]" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="ai-chef" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="party-planner" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="settings" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="terms-of-service" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="cuisine/[name]" options={{ headerShown: false, animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <SubscriptionProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                {KeyboardProvider ? (
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                ) : (
                  <RootLayoutNav />
                )}
              </GestureHandlerRootView>
            </SubscriptionProvider>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
