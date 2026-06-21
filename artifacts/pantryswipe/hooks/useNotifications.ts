import { useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const UNREAD_KEY    = "@pantryswipe:notif_unread";
const CLEARED_KEY   = "@pantryswipe:notif_cleared";
// Bump version → forces cancelAll + re-schedule once on next launch,
// clearing any duplicate notifications from the old race-condition bug.
const SCHEDULED_KEY = "@pantryswipe:notif_scheduled_v3";

const MEAL_SCHEDULE = [
  { id: "notif_breakfast", hour: 7,  minute: 30, title: "Good morning! 🍳", body: "Shall we see what we can make for breakfast today?" },
  { id: "notif_lunch",     hour: 12, minute: 0,  title: "Lunchtime! 🥗",   body: "Shall we see what we can have for lunch? Your pantry has ideas." },
  { id: "notif_snack",     hour: 15, minute: 0,  title: "Snack time! 🍿",  body: "Feeling peckish? Let's find something quick and tasty." },
  { id: "notif_dinner",    hour: 18, minute: 30, title: "Dinner time! 🍽️", body: "Shall we see what we can cook for dinner tonight?" },
];

// ─── Module-level singleton ────────────────────────────────────────────────────
// No matter how many components call useNotifications(), scheduling runs exactly
// once per app session. The promise is shared — concurrent callers await the same
// work instead of each starting their own copy.
let _schedulePromise: Promise<void> | null = null;

async function _doSchedule(): Promise<void> {
  try {
    if (Platform.OS === "web") return;

    const existing = await Notifications.getPermissionsAsync();
    let granted = !!(existing as { granted?: boolean }).granted;
    if (!granted) {
      const result = await Notifications.requestPermissionsAsync();
      granted = !!(result as { granted?: boolean }).granted;
    }
    if (!granted) return;

    const alreadyScheduled = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (alreadyScheduled) return;

    // Cancel everything first — clears any duplicates from previous runs.
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const meal of MEAL_SCHEDULE) {
      await Notifications.scheduleNotificationAsync({
        identifier: meal.id,
        content: { title: meal.title, body: meal.body, sound: true, data: { mealType: meal.id } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: meal.hour,
          minute: meal.minute,
        },
      });
    }

    await AsyncStorage.setItem(SCHEDULED_KEY, "1");
  } catch (e) {
    console.warn("[PantrySwipe] Notification scheduling error:", e);
  }
}

function ensureScheduled(): Promise<void> {
  if (!_schedulePromise) {
    _schedulePromise = _doSchedule();
  }
  return _schedulePromise;
}
// ──────────────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadState();

    if (Platform.OS === "web") return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      bumpCount();
    });

    // Kick off scheduling via the singleton — safe to call from multiple components.
    ensureScheduled().then(() => setPermissionGranted(true)).catch(() => {});

    return () => receivedSub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadState = async () => {
    try {
      const [countVal, clearedVal] = await Promise.all([
        AsyncStorage.getItem(UNREAD_KEY),
        AsyncStorage.getItem(CLEARED_KEY),
      ]);
      setUnreadCount(countVal ? Math.max(0, parseInt(countVal, 10)) : 0);
      setCleared(clearedVal === "1");
    } catch {}
  };

  const bumpCount = async () => {
    try {
      const v = await AsyncStorage.getItem(UNREAD_KEY);
      const next = (v ? parseInt(v, 10) : 0) + 1;
      await Promise.all([
        AsyncStorage.setItem(UNREAD_KEY, String(next)),
        AsyncStorage.removeItem(CLEARED_KEY),
      ]);
      setUnreadCount(next);
      setCleared(false);
    } catch {}
  };

  const markAllRead = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(UNREAD_KEY, "0"),
        AsyncStorage.removeItem(CLEARED_KEY),
      ]);
      setUnreadCount(0);
      setCleared(false);
    } catch {}
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(CLEARED_KEY, "1"),
        AsyncStorage.setItem(UNREAD_KEY, "0"),
      ]);
      setCleared(true);
      setUnreadCount(0);
    } catch {}
  }, []);

  return { unreadCount, cleared, markAllRead, clearAll, permissionGranted };
}
