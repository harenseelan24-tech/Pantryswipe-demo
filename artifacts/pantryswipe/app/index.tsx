import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "@/context/AppContext";

export default function RootIndex() {
  const { authUser, isLoadingAuth, supabaseProfile } = useApp();

  useEffect(() => {
    if (isLoadingAuth) return;

    requestAnimationFrame(() => {
      if (!authUser) {
        router.replace("/welcome");
      } else if (!supabaseProfile || !supabaseProfile.onboarding_complete) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    });
  }, [isLoadingAuth, authUser, supabaseProfile]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#141210" }}>
      <ActivityIndicator size="large" color="#F5A623" />
    </View>
  );
}
