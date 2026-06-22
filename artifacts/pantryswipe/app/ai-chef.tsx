import React, { useState, useRef } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { PremiumBottomSheet } from "@/components/PremiumBottomSheet";
import { useAIChefUsage, FREE_DAILY_LIMIT } from "@/hooks/useAIChefUsage";
import { useSubscription } from "@/lib/revenuecat";
import { PantryItem } from "@/data/mockData";
import { callAIChef } from "@/services/aiChef";

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

  // Expiry-focused queries
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

  // Speed-focused queries
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

  // Protein-focused queries
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

  // "What can I make" / general
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
// ──────────────────────────────────────────────────────────────────────────

export default function AIChefScreen() {
  const colors = useColors();
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
  const listRef = useRef<FlatList>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const remaining = Math.max(0, FREE_DAILY_LIMIT - usageCount);

  const sendMessage = async (text: string = input.trim()) => {
    if (!text || isTyping || isSendingRef.current) return;

    // Gate check for free users
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

    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setIsTyping(true);

    const history = conversationRef.current.slice(-10);

    try {
      let aiText = "";

      // ── Try real AI via inference.sh (callAIChef) first ──────────────────
      // Falls back to existing premium/free mock if EXPO_PUBLIC_INFSH_API_KEY
      // is not set or the request fails — the app never crashes.
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
          // Premium: generate rich pantry-aware response
          await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
          aiText = buildPremiumResponse(text, pantryItems, userProfile as UserProfileShape);
        } else {
          // Free: use the backend API
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
      setMessages((prev) => [aiMsg, ...prev]);
      conversationRef.current = [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: aiMsg.content },
      ].slice(-10);

      // Show gate preemptively when 1 remaining (after this one is used)
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
      setMessages((prev) => [errMsg, ...prev]);
    } finally {
      setIsTyping(false);
      if (!isSubscribed) await increment();
      isSendingRef.current = false;
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.container, { backgroundColor: "#141210" }]}>
      <PremiumBottomSheet
        visible={showGate}
        usedCount={usageCount}
        freeLimit={FREE_DAILY_LIMIT}
        onDismiss={() => setShowGate(false)}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color="#F0EDE8" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.chefAvatar, { backgroundColor: isSubscribed ? "#4CAF76" : "#F5A623" }]}>
            <Text style={styles.chefAvatarEmoji}>{isSubscribed ? "⭐" : "👨‍🍳"}</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>
              AI Chef{isSubscribed ? " ✨" : ""}
            </Text>
            <Text style={styles.headerSub}>
              {isSubscribed ? "Premium · Unlimited recipes" : "Knows your pantry · Always ready"}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Context banner */}
      <View style={[styles.contextBanner, { backgroundColor: isSubscribed ? "#4CAF76" + "15" : "#F5A623" + "15" }]}>
        <Feather name="box" size={14} color={isSubscribed ? "#4CAF76" : "#F5A623"} />
        <Text style={[styles.contextText, { color: isSubscribed ? "#4CAF76" : "#F5A623" }]}>
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

      {/* Warn when 1 left */}
      {!isSubscribed && loaded && remaining === 1 && (
        <TouchableOpacity
          style={styles.warningBanner}
          onPress={() => setShowGate(true)}
          activeOpacity={0.85}
        >
          <Feather name="alert-circle" size={13} color="#E84040" />
          <Text style={styles.warningText}>Last free recipe today — </Text>
          <Text style={[styles.warningText, { color: "#4CAF76", textDecorationLine: "underline" }]}>Upgrade for unlimited</Text>
        </TouchableOpacity>
      )}

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={
            isTyping ? (
              <View style={[styles.typingIndicator, { backgroundColor: "#1E1B18" }]}>
                <Text style={styles.typingDots}>• • •</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.role === "user"
                  ? [styles.userBubble, { backgroundColor: "#F5A623" }]
                  : [styles.aiBubble, { backgroundColor: "#1E1B18" }],
              ]}
            >
              {item.isPremium && (
                <View style={styles.premiumTag}>
                  <Feather name="zap" size={9} color="#4CAF76" />
                  <Text style={styles.premiumTagText}>Premium response</Text>
                </View>
              )}
              <Text
                style={[
                  styles.messageText,
                  { color: item.role === "user" ? "#fff" : "#F0EDE8" },
                ]}
              >
                {item.content}
              </Text>
              <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
            </View>
          )}
        />

        {/* Quick prompts */}
        {messages.length === 1 && (
          <View style={styles.quickPrompts}>
            <ScrollRowChips prompts={QUICK_PROMPTS} onSelect={sendMessage} />
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: bottomPadding + 8, backgroundColor: "#141210" }]}>
          {/* Upgrade nudge when at limit */}
          {!isSubscribed && isAtLimit && loaded && (
            <TouchableOpacity
              style={styles.limitBanner}
              onPress={() => setShowGate(true)}
              activeOpacity={0.85}
            >
              <Feather name="lock" size={13} color="#E84040" />
              <Text style={styles.limitBannerText}>Daily limit reached · </Text>
              <Text style={[styles.limitBannerText, { color: "#4CAF76" }]}>Upgrade to continue</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.inputRow, { backgroundColor: "#1E1B18", opacity: !isSubscribed && isAtLimit ? 0.45 : 1 }]}>
            <TextInput
              style={[styles.textInput, { color: "#F0EDE8" }]}
              placeholder={!isSubscribed && isAtLimit ? "Daily limit reached — upgrade for more" : "Ask about recipes, ingredients..."}
              placeholderTextColor="#9E9E9E"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              editable={isSubscribed || !isAtLimit}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? "#F5A623" : "#2A2724" }]}
              onPress={() => (!isSubscribed && isAtLimit) ? setShowGate(true) : sendMessage()}
              disabled={!input.trim() && !(isAtLimit && !isSubscribed)}
            >
              <Feather name={!isSubscribed && isAtLimit ? "lock" : "send"} size={18} color={input.trim() ? "#fff" : "#666"} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ScrollRowChips({ prompts, onSelect }: { prompts: string[]; onSelect: (p: string) => void }) {
  return (
    <View style={chipStyles.container}>
      {prompts.map((p) => (
        <TouchableOpacity
          key={p}
          style={[chipStyles.chip, { backgroundColor: "#1E1B18", borderColor: "#2A2724" }]}
          onPress={() => onSelect(p)}
        >
          <Text style={chipStyles.chipText}>{p}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1 },
  chipText: { color: "#F0EDE8", fontSize: 13, fontWeight: "500" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  chefAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  chefAvatarEmoji: { fontSize: 22 },
  headerTitle: { color: "#F0EDE8", fontSize: 16, fontWeight: "700" },
  headerSub: { color: "#9E9E9E", fontSize: 12 },
  contextBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  contextText: { fontSize: 13, fontWeight: "500", flex: 1 },
  usageChip: {
    backgroundColor: "#2A2724", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  usageChipText: { color: "#F0EDE8", fontSize: 11, fontFamily: "Inter_500Medium" },
  warningBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#E84040" + "12", paddingHorizontal: 16, paddingVertical: 8,
  },
  warningText: { color: "#E84040", fontSize: 12, fontFamily: "Inter_400Regular" },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  messageBubble: { maxWidth: "82%", padding: 14, borderRadius: 18, gap: 6 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  premiumTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#4CAF76" + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, alignSelf: "flex-start",
  },
  premiumTagText: { color: "#4CAF76", fontSize: 10, fontFamily: "Inter_500Medium" },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTime: { fontSize: 11, color: "rgba(255,255,255,0.4)", alignSelf: "flex-end" },
  typingIndicator: {
    alignSelf: "flex-start", padding: 14, borderRadius: 18, borderBottomLeftRadius: 4, marginBottom: 8,
  },
  typingDots: { color: "#9E9E9E", fontSize: 18, letterSpacing: 4 },
  quickPrompts: { paddingTop: 4 },
  inputContainer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#2A2724" },
  limitBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 8, marginBottom: 8,
  },
  limitBannerText: { color: "#E84040", fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", borderRadius: 24,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8,
  },
  textInput: { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: 8, lineHeight: 22 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
