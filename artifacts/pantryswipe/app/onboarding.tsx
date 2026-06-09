import React, { useState, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 6;

const SKILL_LEVELS = ["Beginner", "Home Cook", "Confident", "Advanced"];
const DIET_TYPES = ["Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Keto", "Paleo"];
const ALLERGIES = ["Nuts", "Dairy", "Gluten", "Shellfish", "Eggs", "Soy"];
const GOALS = ["Eat Healthier", "Build Muscle", "Save Money", "Cook Faster", "Explore Cuisines", "Cook for Others"];
const CUISINES = [
  { name: "Italian", flag: "🇮🇹" },
  { name: "Japanese", flag: "🇯🇵" },
  { name: "Korean", flag: "🇰🇷" },
  { name: "Indian", flag: "🇮🇳" },
  { name: "Chinese", flag: "🇨🇳" },
  { name: "Thai", flag: "🇹🇭" },
  { name: "Mexican", flag: "🇲🇽" },
  { name: "American", flag: "🇺🇸" },
  { name: "French", flag: "🇫🇷" },
  { name: "Vietnamese", flag: "🇻🇳" },
  { name: "Singaporean", flag: "🇸🇬" },
  { name: "Malaysian", flag: "🇲🇾" },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile, completeSetup } = useApp();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Home Cook");
  const [dietTypes, setDietTypes] = useState<string[]>(["Omnivore"]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [goal, setGoal] = useState("Eat Healthier");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(["Italian", "Japanese"]);
  const [householdSize, setHouseholdSize] = useState(2);
  const [weeklyBudget, setWeeklyBudget] = useState(100);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      Animated.timing(slideAnim, {
        toValue: -(step + 1) * width,
        duration: 320,
        useNativeDriver: true,
      }).start();
      setStep(step + 1);
    } else {
      updateProfile({
        name: name || "Alex",
        skillLevel,
        dietType: dietTypes,
        allergies,
        goal,
        cuisinePreferences: selectedCuisines,
        householdSize,
        weeklyBudget,
      });
      completeSetup();
      router.replace("/(tabs)");
    }
  };

  const goBack = () => {
    if (step > 0) {
      Animated.timing(slideAnim, {
        toValue: -(step - 1) * width,
        duration: 320,
        useNativeDriver: true,
      }).start();
      setStep(step - 1);
    }
  };

  const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        )}
        <View style={styles.progressDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.saffron : colors.border,
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <TouchableOpacity onPress={goNext}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <Animated.View
        style={[styles.slidesContainer, { transform: [{ translateX: slideAnim }] }]}
      >
        {/* Step 0 — Who are you? */}
        <View style={styles.slide}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Welcome!{"\n"}What's your name?
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            We'll personalize your experience
          </Text>
          <TextInput
            style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Your first name"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Household size</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperBtn, { borderColor: colors.border }]}
              onPress={() => setHouseholdSize(Math.max(1, householdSize - 1))}
            >
              <Feather name="minus" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: colors.foreground }]}>{householdSize}</Text>
            <TouchableOpacity
              style={[styles.stepperBtn, { borderColor: colors.border }]}
              onPress={() => setHouseholdSize(Math.min(10, householdSize + 1))}
            >
              <Feather name="plus" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 1 — Cooking style */}
        <View style={styles.slide}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Your cooking style</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            We'll match recipe difficulty to your level
          </Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Skill level</Text>
          <View style={styles.chipGrid}>
            {SKILL_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.chip,
                  {
                    backgroundColor: skillLevel === level ? colors.saffron : colors.card,
                    borderColor: skillLevel === level ? colors.saffron : colors.border,
                  },
                ]}
                onPress={() => setSkillLevel(level)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: skillLevel === level ? "#fff" : colors.foreground },
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Weekly budget</Text>
          <View style={styles.budgetRow}>
            <Text style={[styles.budgetValue, { color: colors.saffron }]}>${weeklyBudget}</Text>
            <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>/week</Text>
          </View>
          <View style={styles.budgetButtons}>
            {[50, 75, 100, 150, 200].map((v) => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.budgetBtn,
                  {
                    backgroundColor: weeklyBudget === v ? colors.saffron : colors.card,
                    borderColor: weeklyBudget === v ? colors.saffron : colors.border,
                  },
                ]}
                onPress={() => setWeeklyBudget(v)}
              >
                <Text style={{ color: weeklyBudget === v ? "#fff" : colors.foreground, fontWeight: "600" }}>
                  ${v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 2 — Dietary profile */}
        <View style={styles.slide}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Dietary profile</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            Select all that apply
          </Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Diet type</Text>
          <View style={styles.chipGrid}>
            {DIET_TYPES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.chip,
                  {
                    backgroundColor: dietTypes.includes(d) ? colors.saffron : colors.card,
                    borderColor: dietTypes.includes(d) ? colors.saffron : colors.border,
                  },
                ]}
                onPress={() => toggleItem(d, dietTypes, setDietTypes)}
              >
                <Text style={{ color: dietTypes.includes(d) ? "#fff" : colors.foreground, fontWeight: "500", fontSize: 13 }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Allergies</Text>
          <View style={styles.chipGrid}>
            {ALLERGIES.map((a) => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.chip,
                  {
                    backgroundColor: allergies.includes(a) ? colors.destructive : colors.card,
                    borderColor: allergies.includes(a) ? colors.destructive : colors.border,
                  },
                ]}
                onPress={() => toggleItem(a, allergies, setAllergies)}
              >
                <Text style={{ color: allergies.includes(a) ? "#fff" : colors.foreground, fontWeight: "500", fontSize: 13 }}>
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 3 — Goals */}
        <View style={styles.slide}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Your goal</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            We'll tailor your recipe recommendations
          </Text>
          <View style={styles.goalGrid}>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.goalCard,
                  {
                    backgroundColor: goal === g ? colors.saffron + "18" : colors.card,
                    borderColor: goal === g ? colors.saffron : colors.border,
                    borderWidth: goal === g ? 2 : 1,
                  },
                ]}
                onPress={() => setGoal(g)}
              >
                <Text style={[styles.goalText, { color: goal === g ? colors.saffron : colors.foreground }]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 4 — Cuisines */}
        <View style={styles.slide}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Which cuisines excite you?
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            Pick at least one
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.cuisineGrid}>
              {CUISINES.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={[
                    styles.cuisineCard,
                    {
                      backgroundColor: selectedCuisines.includes(c.name) ? colors.saffron + "18" : colors.card,
                      borderColor: selectedCuisines.includes(c.name) ? colors.saffron : colors.border,
                      borderWidth: selectedCuisines.includes(c.name) ? 2 : 1,
                    },
                  ]}
                  onPress={() => toggleItem(c.name, selectedCuisines, setSelectedCuisines)}
                >
                  <Text style={styles.cuisineFlag}>{c.flag}</Text>
                  <Text style={[styles.cuisineName, { color: colors.foreground }]}>{c.name}</Text>
                  {selectedCuisines.includes(c.name) && (
                    <View style={[styles.cuisineCheck, { backgroundColor: colors.saffron }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Step 5 — Pantry start */}
        <View style={styles.slide}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Your pantry starts here
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            What's in your kitchen right now?
          </Text>
          <View style={styles.pantryOptions}>
            <TouchableOpacity
              style={[styles.pantryOption, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={goNext}
            >
              <View style={[styles.pantryIconBg, { backgroundColor: colors.saffron + "20" }]}>
                <Feather name="camera" size={28} color={colors.saffron} />
              </View>
              <Text style={[styles.pantryOptionTitle, { color: colors.foreground }]}>Scan Fridge</Text>
              <Text style={[styles.pantryOptionSub, { color: colors.mutedForeground }]}>Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pantryOption, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={goNext}
            >
              <View style={[styles.pantryIconBg, { backgroundColor: colors.secondary + "20" }]}>
                <Feather name="file-text" size={28} color={colors.secondary} />
              </View>
              <Text style={[styles.pantryOptionTitle, { color: colors.foreground }]}>Scan Receipt</Text>
              <Text style={[styles.pantryOptionSub, { color: colors.mutedForeground }]}>Import groceries</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pantryOption, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={goNext}
            >
              <View style={[styles.pantryIconBg, { backgroundColor: colors.saveBlue + "20" }]}>
                <Feather name="edit-3" size={28} color={colors.saveBlue} />
              </View>
              <Text style={[styles.pantryOptionTitle, { color: colors.foreground }]}>Type It In</Text>
              <Text style={[styles.pantryOptionSub, { color: colors.mutedForeground }]}>Add manually</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.skipLink} onPress={goNext}>
            <Text style={[styles.skipLinkText, { color: colors.mutedForeground }]}>
              I'll add later
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Bottom CTA */}
      <View style={[styles.bottomContainer, { paddingBottom: bottomPadding + 16 }]}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.saffron }]}
          onPress={goNext}
          activeOpacity={0.88}
        >
          <Text style={styles.nextButtonText}>
            {step === TOTAL_STEPS - 1 ? "Start Cooking" : "Continue"}
          </Text>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDots: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  skipText: { fontSize: 15, fontWeight: "500" },
  slidesContainer: {
    flex: 1,
    flexDirection: "row",
    width: width * TOTAL_STEPS,
  },
  slide: {
    width,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nameInput: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 17,
    marginBottom: 28,
    fontWeight: "500",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 28,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  chipText: {
    fontWeight: "600",
    fontSize: 14,
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 16,
  },
  budgetValue: { fontSize: 40, fontWeight: "800" },
  budgetLabel: { fontSize: 18, fontWeight: "500" },
  budgetButtons: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  budgetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  goalGrid: {
    gap: 12,
  },
  goalCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
  },
  goalText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cuisineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 20,
  },
  cuisineCard: {
    width: (width - 68) / 3,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  cuisineFlag: { fontSize: 28 },
  cuisineName: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  cuisineCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  pantryOptions: {
    flexDirection: "row",
    gap: 12,
  },
  pantryOption: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  pantryIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pantryOptionTitle: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  pantryOptionSub: { fontSize: 11, textAlign: "center" },
  skipLink: { paddingTop: 20, alignItems: "center" },
  skipLinkText: { fontSize: 15 },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
