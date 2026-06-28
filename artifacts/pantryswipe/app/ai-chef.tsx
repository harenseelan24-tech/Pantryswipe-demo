import React, { useState, useRef, useEffect } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useApp } from "@/context/AppContext";
import { PremiumBottomSheet } from "@/components/PremiumBottomSheet";
import { useAIChefUsage, FREE_DAILY_LIMIT } from "@/hooks/useAIChefUsage";
import { useSubscription } from "@/lib/revenuecat";
import { PantryItem } from "@/data/mockData";
import { callAIChef } from "@/services/aiChef";

// ── Dark palette (AI Chef is dark-mode only) ───────────────────────────────
const D = {
  background:   "#141210",
  surface:      "#1E1E1E",
  input:        "#2A2A2A",
  border:       "rgba(255,255,255,0.08)",
  text:         "#E6D8CA",
  textMuted:    "rgba(230,216,202,0.55)",
  overlay:      "rgba(0,0,0,0.40)",
  primary:      "#F5A623",
  secondary:    "#4CAF76",
  danger:       "#E84040",
} as const;

// ── Header height constant ─────────────────────────────────────────────────
const HEADER_H = 72;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isPremium?: boolean;
}

interface UserProfileShape {
  name: string;
  dietType: string[];
  allergies: string[];
  skillLevel: string;
  cuisinePreferences: string[];
  goal: string;
}

const QUICK_PROMPTS = [
  "What can I make tonight?",
  "I have 10 minutes",
  "High protein dinner",
  "Use expiring ingredients",
  "Something impressive",
];

const INITIAL_MESSAGE: Message = {
  id: "0",
  role: "assistant",
  content: "Hi! I'm your AI Chef. I know what's in your pantry and can suggest personalized recipes, modify dishes for your diet, or help you plan your next meal. What can I help you cook?",
  timestamp: new Date(),
};

// ─── Premium response generator ────────────────────────────────────────────
function buildPremiumResponse(
  query: string,
  pantryItems: PantryItem[],
  profile: UserProfileShape
): string {
  const now = new Date();
  const twoDays = new Date(now.getTime() + 2 * 86_400_000);
  const sevenDays = new Date(now.getTime() + 7 * 86_400_000);

  const expiring = pantryItems.filter((i) => {
    if (!i.expiryDate) return false;
    const expDate = new Date(i.expiryDate);
    return expDate >= now && expDate <= twoDays;
  });
  const useSoon = pantryItems.filter((i) => {
    if (!i.expiryDate) return false;
    const d = new Date(i.expiryDate);
    return d > twoDays && d <= sevenDays;
  });

  const q = query.toLowerCase();

  if (q.includes("expir") || q.includes("use up") || q.includes("going off") || q.includes("leftover")) {
    if (expiring.length === 0 && useSoon.length === 0) {
      return `✨ Good news — your pantry is in great shape! Nothing is expiring in the next 7 days.\n\nYour freshest items right now:\n${pantryItems.slice(0, 5).map((i) => `• ${i.emoji} ${i.name} (${i.quantity} ${i.unit})`).join("\n")}\n\nWant me to suggest a recipe using what you have?`;
    }

    const urgentList = expiring.map((i) => `• ${i.emoji} ${i.name} — expires ${formatExpiry(i.expiryDate!)}`).join("\n");
    const soonList = useSoon.slice(0, 3).map((i) => `• ${i.emoji} ${i.name} — ${i.quantity} ${i.unit}`).join("\n");

    const recipe = pickRecipeForIngredients(expiring.concat(useSoon), profile);

    return [
      `🔍 Pantry scan complete! Here's what needs attention:\n`,
      expiring.length > 0 ? `⚠️ Expiring within 2 days:\n${urgentList}` : null,
      useSoon.length > 0 ? `\n📅 Use within a week:\n${soonList}` : null,
      `\n💡 Best recipe to use these up:\n**${recipe.name}**`,
      `⏱ ${recipe.time} mins  •  🔥 ${recipe.cal} kcal  •  💰 Saves ~S$${recipe.savings} vs delivery`,
      `\n${recipe.steps}`,
      `\n🧊 Premium tip: ${recipe.storeTip}`,
    ].filter(Boolean).join("\n");
  }

  if (q.includes("10 minute") || q.includes("quick") || q.includes("fast") || q.includes("no time")) {
    const items = pantryItems.slice(0, 6);
    const r = QUICK_RECIPES[profile.dietType[0]?.toLowerCase()] ?? QUICK_RECIPES.default;
    const available = items.filter((i) => r.uses.some((u) => i.name.toLowerCase().includes(u)));
    const match = Math.min(100, Math.round((available.length / r.uses.length) * 100));

    return [
      `⚡ Ultra-fast pick for you (${r.time} mins):`,
      `\n**${r.name}**`,
      `🥘 Pantry match: ${match}% — you have: ${available.map((i) => i.emoji + " " + i.name).join(", ") || "most of what you need"}`,
      ``,
      r.steps,
      ``,
      `🔥 ${r.cal} kcal  •  💰 ~S$${r.cost} to make vs S$${r.delivery} on GrabFood`,
      `\n✨ Premium tip: ${r.tip}`,
    ].join("\n");
  }

  if (q.includes("protein") || q.includes("muscle") || q.includes("gym") || q.includes("macro")) {
    const proteinItems = pantryItems.filter((i) =>
      ["chicken", "egg", "tuna", "beef", "tofu", "salmon", "shrimp", "lentil", "greek yogurt", "cheese"]
        .some((p) => i.name.toLowerCase().includes(p))
    );
    const itemList = proteinItems.length > 0
      ? proteinItems.map((i) => `${i.emoji} ${i.name} (${i.quantity} ${i.unit})`).join(", ")
      : "chicken breast, eggs (check your pantry for more)";

    return [
      `💪 High-protein build based on your pantry:`,
      ``,
      `**Protein Bowl with ${proteinItems[0]?.name ?? "Chicken"}**`,
      `📊 Macros: ~580 kcal  |  52g protein  |  38g carbs  |  18g fat`,
      ``,
      `Protein sources I see in your pantry:\n${itemList}`,
      ``,
      `Steps (prep in 20 mins):`,
      `1. Season ${proteinItems[0]?.name ?? "chicken"} with garlic, paprika, salt`,
      `2. Sear on high heat 4 mins each side`,
      `3. Rest 5 mins, slice thin`,
      `4. Build bowl: brown rice base, greens, protein, drizzle olive oil + lemon`,
      ``,
      `💰 Estimated cost: ~S$4.50 vs S$16 delivered`,
      `\n✨ Premium tip: Batch cook your protein on Sundays — prep 4 portions at once and refrigerate. Saves ~S$60/week.`,
    ].join("\n");
  }

  const topItems = pantryItems.slice(0, 8);
  const expiringNote = expiring.length > 0
    ? `\n⚠️ Prioritising your expiring items: ${expiring.map((i) => i.emoji + " " + i.name).join(", ")}`
    : "";

  return [
    `👨‍🍳 Based on your ${pantryItems.length} pantry items, here's tonight's best option:`,
    expiringNote,
    ``,
    `**${getMainRecipeName(topItems, profile)}**`,
    ``,
    `🥘 Ingredients you have: ${topItems.slice(0, 5).map((i) => i.emoji + " " + i.name).join(", ")}`,
    `⏱ 25 mins  •  🔥 490 kcal  •  💰 Saves ~S$12 vs GrabFood`,
    ``,
    `Steps:`,
    `1. Prep your aromatics — dice onion and garlic, sauté in olive oil 3 mins`,
    `2. Add your protein, cook through (6–8 mins)`,
    `3. Add vegetables and seasoning, toss well`,
    `4. Finish with a squeeze of lemon and fresh herbs`,
    `5. Plate and garnish`,
    ``,
    `✨ Premium insight: Your pantry is at ${Math.round((pantryItems.length / 25) * 100)}% capacity. ${
      expiring.length > 0 ? `Use your ${expiring.map((i) => i.name).join(" and ")} first — they expire soon!` : "Everything is fresh — great meal prep window!"
    }`,
  ].join("\n");
}

function formatExpiry(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "today (urgent!)";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}

function getMainRecipeName(items: PantryItem[], profile: UserProfileShape): string {
  const hasChicken = items.some((i) => i.name.toLowerCase().includes("chicken"));
  const hasEggs = items.some((i) => i.name.toLowerCase().includes("egg"));
  const hasPasta = items.some((i) => i.name.toLowerCase().includes("pasta"));
  const hasRice = items.some((i) => i.name.toLowerCase().includes("rice"));
  const isVeg = profile.dietType.some((d) => d.toLowerCase().includes("vegetarian") || d.toLowerCase().includes("vegan"));

  if (isVeg && hasEggs) return "Herb Fried Rice with Soft-Scrambled Eggs";
  if (hasChicken && hasRice) return "Garlic Ginger Chicken Rice";
  if (hasChicken && hasPasta) return "Lemon Chicken Pasta";
  if (hasPasta) return "Aglio e Olio with Pantry Extras";
  if (hasRice) return "Fried Rice with What You Have";
  return "Stir-Fry with Your Freshest Ingredients";
}

function pickRecipeForIngredients(
  items: PantryItem[],
  profile: UserProfileShape
): { name: string; time: number; cal: number; savings: number; steps: string; storeTip: string } {
  const hasEggs = items.some((i) => i.name.toLowerCase().includes("egg"));
  const hasChicken = items.some((i) => i.name.toLowerCase().includes("chicken"));

  if (hasEggs) {
    return {
      name: "Spanish Tortilla (Potato & Egg)",
      time: 30,
      cal: 380,
      savings: 11,
      steps: "1. Slice potatoes thin, cook in olive oil 15 mins\n2. Beat 4 eggs with salt, add potatoes\n3. Cook on low 8 mins, flip carefully\n4. Finish 5 mins, slice into wedges",
      storeTip: "Eggs keep 2 weeks if unwashed. Move them to the fridge door where it's coolest.",
    };
  }
  if (hasChicken) {
    return {
      name: "Pantry Chicken Stir-Fry",
      time: 20,
      cal: 420,
      savings: 13,
      steps: "1. Marinate chicken: soy sauce, garlic, ginger (5 mins)\n2. High heat wok, cook chicken 6 mins\n3. Add veg, toss 3 mins\n4. Sauce: oyster sauce + sesame oil, coat everything",
      storeTip: "Chicken breast stays good for 2 days in the fridge. Freeze it today to extend by 3 months.",
    };
  }
  return {
    name: "Vegetable Frittata",
    time: 25,
    cal: 310,
    savings: 10,
    steps: "1. Sauté all your veg in oven-safe pan\n2. Beat 5 eggs with seasoning, pour over\n3. Cook 5 mins on stove, transfer to 180°C oven\n4. Bake 12 mins until set. Rest 5 mins, slice",
    storeTip: "Cut and refrigerate leftovers — frittata keeps for 4 days and is great cold.",
  };
}

const QUICK_RECIPES: Record<string, {
  name: string; time: number; cal: number; cost: number; delivery: number; uses: string[]; steps: string; tip: string;
}> = {
  vegetarian: {
    name: "5-Minute Egg Fried Rice",
    time: 8,
    cal: 390,
    cost: 2,
    delivery: 14,
    uses: ["egg", "rice", "onion", "garlic"],
    steps: "1. Heat oil, scramble 2 eggs, push to side\n2. Add cold rice, break up\n3. Add garlic, soy sauce, sesame oil\n4. Toss everything together 2 mins",
    tip: "Use day-old rice — fresh rice is too wet and clumps.",
  },
  default: {
    name: "Garlic Butter Chicken Wrap",
    time: 10,
    cal: 450,
    cost: 3,
    delivery: 15,
    uses: ["chicken", "garlic", "butter", "bread"],
    steps: "1. Slice chicken thin, cook in butter + garlic 4 mins\n2. Season with salt, pepper, paprika\n3. Warm wrap/bread 30 sec\n4. Fill, roll, done",
    tip: "Slice the chicken breast while slightly frozen — it cuts much thinner and cooks faster.",
  },
};

// ── Reanimated: single bouncing dot ─────────────────────────────────────────
function BounceDot({ index }: { index: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1,
        false
      )
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Reanimated.View style={[styles.typingDot, dotStyle]} />;
}

// ── Reanimated: pulsing status dot ──────────────────────────────────────────
function PulseDot() {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1000 }),
        withTiming(1.0, { duration: 1000 })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000 }),
        withTiming(1.0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return <Reanimated.View style={[styles.pulseDot, pulseStyle]} />;
}

// ── Inline bold parser: **text** → bold segments ────────────────────────────
function BoldText({ text, style }: { text: string; style: object }) {
  const parts = text.split("**");
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: "Epilogue_700Bold" }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
export default function AIChefScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, pantryItems } = useApp();
  const { isSubscribed } = useSubscription();
  const { usageCount, isAtLimit, increment, loaded } = useAIChefUsage();
  const [showGate, setShowGate] = useState(false);
  const conversationRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const isSendingRef = useRef(false);

  const API_BASE = Platform.OS !== "web"
    ? `https://${process.env.EXPO_PUBLIC_API_DOMAIN ?? "zip-repl-cactusussy24.replit.app"}/api`
    : "/api";

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const listRef = useRef<FlatList>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const remaining = Math.max(0, FREE_DAILY_LIMIT - usageCount);

  // Scroll to end whenever messages or typing state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const sendMessage = async (text: string = input.trim()) => {
    if (!text || isTyping || isSendingRef.current) return;

    if (!isSubscribed && isAtLimit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowGate(true);
      return;
    }

    isSendingRef.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const history = conversationRef.current.slice(-10);

    try {
      let aiText = "";

      let realAiSucceeded = false;
      try {
        aiText = await callAIChef({
          prompt: text,
          pantryItems: pantryItems.map((i) => i.name),
          dietType: userProfile.dietType,
          allergies: userProfile.allergies,
          skillLevel: userProfile.skillLevel,
          cuisinePreferences: userProfile.cuisinePreferences,
          goal: userProfile.goal,
        });
        realAiSucceeded = true;
      } catch {
        // API key not configured or network error — fall through to mock
      }

      if (!realAiSucceeded) {
        if (isSubscribed) {
          await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
          aiText = buildPremiumResponse(text, pantryItems, userProfile as UserProfileShape);
        } else {
          const res = await fetch(`${API_BASE}/recipes/ai-chef`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              conversation_history: history,
              pantry_items: pantryItems.map((i) => i.name),
              user_profile: {
                dietType: userProfile.dietType,
                allergies: userProfile.allergies,
                skillLevel: userProfile.skillLevel,
                cuisinePreferences: userProfile.cuisinePreferences,
                goal: userProfile.goal,
                name: userProfile.name,
              },
            }),
          });
          const data = await res.json().catch(() => ({ response: null }));
          aiText = (data.response as string | null) ?? "I'm having a moment — please try again!";
        }
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiText,
        timestamp: new Date(),
        isPremium: isSubscribed,
      };
      setMessages((prev) => [...prev, aiMsg]);
      conversationRef.current = [
        ...history,
        { role: "user" as const, content: text },
        { role: "assistant" as const, content: aiMsg.content },
      ].slice(-10);

      if (!isSubscribed && remaining === 1) {
        // nothing — let them see the response first
      }
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Looks like I lost my connection. Check your network and try again!",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      if (!isSubscribed) await increment();
      isSendingRef.current = false;
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.container}>
      <PremiumBottomSheet
        visible={showGate}
        usedCount={usageCount}
        freeLimit={FREE_DAILY_LIMIT}
        onDismiss={() => setShowGate(false)}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPadding + 10 }]}>
          {/* Left group: back + title */}
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>PantrySwipe</Text>
              <View style={styles.headerStatusRow}>
                <PulseDot />
                <Text style={styles.headerStatusText}>POWERED BY YOUR PANTRY</Text>
              </View>
            </View>
          </View>

          {/* Right: more options */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="more-vertical" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── Context banner ── */}
        <View style={[styles.contextBanner, { backgroundColor: isSubscribed ? D.secondary + "18" : D.primary + "18" }]}>
          <Feather name="box" size={13} color={isSubscribed ? D.secondary : D.primary} />
          <Text style={[styles.contextText, { color: isSubscribed ? D.secondary : D.primary }]}>
            {pantryItems.length} pantry items loaded · {userProfile.dietType[0]} diet
          </Text>
          {!isSubscribed && loaded && (
            <View style={styles.usageChip}>
              <Text style={styles.usageChipText}>
                {remaining}/{FREE_DAILY_LIMIT} left today
              </Text>
            </View>
          )}
        </View>

        {/* ── Warn when 1 left ── */}
        {!isSubscribed && loaded && remaining === 1 && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => setShowGate(true)}
            activeOpacity={0.85}
          >
            <Feather name="alert-circle" size={13} color={D.danger} />
            <Text style={styles.warningText}>Last free recipe today — </Text>
            <Text style={[styles.warningText, { color: D.secondary, textDecorationLine: "underline" }]}>
              Upgrade for unlimited
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Message list ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.messagesList,
            { paddingTop: 16, paddingBottom: 20 },
          ]}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingRow}>
                {/* AI avatar */}
                <View style={styles.aiAvatar}>
                  <Feather name="cpu" size={20} color="rgba(230,216,202,0.35)" />
                </View>
                {/* Bouncing dots bubble */}
                <View style={styles.typingBubble}>
                  <View style={styles.typingDotsRow}>
                    <BounceDot index={0} />
                    <BounceDot index={1} />
                    <BounceDot index={2} />
                  </View>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            item.role === "assistant" ? (
              /* ── AI bubble ── */
              <View style={styles.aiRow}>
                <View style={styles.aiAvatar}>
                  <Feather name="coffee" size={20} color={D.primary} />
                </View>
                <View style={styles.aiBubble}>
                  {item.isPremium && (
                    <View style={styles.premiumTag}>
                      <Feather name="zap" size={9} color={D.secondary} />
                      <Text style={styles.premiumTagText}>Premium response</Text>
                    </View>
                  )}
                  <BoldText
                    text={item.content}
                    style={styles.aiMessageText}
                  />
                  <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
                </View>
              </View>
            ) : (
              /* ── User bubble ── */
              <View style={styles.userRow}>
                <View style={styles.userBubble}>
                  <BoldText
                    text={item.content}
                    style={styles.userMessageText}
                  />
                  <Text style={styles.messageTimeUser}>{formatTime(item.timestamp)}</Text>
                </View>
              </View>
            )
          )}
        />

        {/* ── Bottom input area ── */}
        <View style={[styles.inputArea, { paddingBottom: bottomPadding + 8 }]}>

          {/* Limit banner */}
          {!isSubscribed && isAtLimit && loaded && (
            <TouchableOpacity
              style={styles.limitBanner}
              onPress={() => setShowGate(true)}
              activeOpacity={0.85}
            >
              <Feather name="lock" size={13} color={D.danger} />
              <Text style={styles.limitBannerText}>Daily limit reached · </Text>
              <Text style={[styles.limitBannerText, { color: D.secondary }]}>Upgrade to continue</Text>
            </TouchableOpacity>
          )}

          {/* Quick prompt chips — only shown on first message */}
          {messages.length === 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {QUICK_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.chip}
                  onPress={() => sendMessage(p)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.chipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Input bar */}
          <View
            style={[
              styles.inputBar,
              isFocused ? styles.inputBarFocused : null,
              { opacity: !isSubscribed && isAtLimit ? 0.5 : 1 },
            ]}
          >
            {/* Left add button */}
            <TouchableOpacity style={styles.inputIconBtn}>
              <Feather name="plus-circle" size={22} color="rgba(230,216,202,0.45)" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder={
                !isSubscribed && isAtLimit
                  ? "Daily limit reached — upgrade for more"
                  : "Ask your chef anything..."
              }
              placeholderTextColor="rgba(230,216,202,0.4)"
              value={input}
              onChangeText={setInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              multiline={false}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              editable={isSubscribed || !isAtLimit}
              autoCorrect={false}
              autoCapitalize="none"
            />

            {/* Send button */}
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => (!isSubscribed && isAtLimit) ? setShowGate(true) : sendMessage()}
              disabled={!input.trim() && !(isAtLimit && !isSubscribed)}
              activeOpacity={0.8}
            >
              <Feather
                name={!isSubscribed && isAtLimit ? "lock" : "send"}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.background },
  flex: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "rgba(20,18,16,0.92)",
    zIndex: 50,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconBtn: {
    minWidth: 44, minHeight: 44,
    alignItems: "center", justifyContent: "center",
  },
  headerTitleCol: { gap: 2 },
  headerTitle: {
    fontFamily: "Epilogue_700Bold",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerStatusText: {
    fontSize: 11,
    fontFamily: "Epilogue_700Bold",
    letterSpacing: 1.5,
    color: "#4CAF76",
    textTransform: "uppercase",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF76",
  },

  // ── Context banner ────────────────────────────────────────────────────────
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  contextText: {
    fontSize: 13,
    fontFamily: "Epilogue_400Regular",
    flex: 1,
  },
  usageChip: {
    backgroundColor: "#2A2724",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  usageChipText: { color: D.text, fontSize: 11, fontFamily: "Epilogue_400Regular" },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E84040" + "12",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  warningText: { color: D.danger, fontSize: 12, fontFamily: "Epilogue_400Regular" },

  // ── Message list ──────────────────────────────────────────────────────────
  messagesList: { paddingHorizontal: 20, gap: 4 },

  // AI message row
  aiRow: { flexDirection: "row", gap: 12, maxWidth: "88%", marginBottom: 20 },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: D.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aiBubble: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    padding: 16,
    flex: 1,
    gap: 6,
  },
  aiMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: D.text,
    fontFamily: "Epilogue_400Regular",
  },

  // User message row
  userRow: { alignItems: "flex-end", marginBottom: 20 },
  userBubble: {
    backgroundColor: "#F5A623",
    borderRadius: 20,
    borderTopRightRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: "80%",
    gap: 4,
  },
  userMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#644000",
    fontFamily: "Epilogue_400Regular",
  },

  messageTime: {
    fontSize: 11,
    color: "rgba(230,216,202,0.4)",
    alignSelf: "flex-end",
    fontFamily: "Epilogue_400Regular",
  },
  messageTimeUser: {
    fontSize: 11,
    color: "rgba(100,64,0,0.55)",
    alignSelf: "flex-end",
    fontFamily: "Epilogue_400Regular",
  },

  // Premium tag
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4CAF76" + "20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    alignSelf: "flex-start",
  },
  premiumTagText: { color: "#4CAF76", fontSize: 10, fontFamily: "Epilogue_700Bold" },

  // ── Typing indicator ──────────────────────────────────────────────────────
  typingRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  typingBubble: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  typingDotsRow: { flexDirection: "row", alignItems: "center" },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(230,216,202,0.6)",
    marginHorizontal: 2,
  },

  // ── Bottom input area ─────────────────────────────────────────────────────
  inputArea: {
    backgroundColor: D.background,
    paddingTop: 4,
  },

  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  limitBannerText: { color: D.danger, fontSize: 13, fontFamily: "Epilogue_400Regular" },

  chipsRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingVertical: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Epilogue_400Regular",
    color: "#FFFFFF",
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#2A2A2A",
    borderWidth: 1.5,
    borderColor: D.border,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  inputBarFocused: {
    borderColor: "rgba(245,166,35,0.5)",
  },
  inputIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    color: "#FFFFFF",
    fontFamily: "Epilogue_400Regular",
    fontSize: 15,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios:     { shadowColor: "#F5A623", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
      web:     { boxShadow: "0 2px 8px rgba(245,166,35,0.35)" },
    }),
  },
});
