import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const HERB = "#4CAF76";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: HERB }]}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.body, { color: colors.textSecondary }]}>{children}</Text>;
}

function Bullet({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: HERB }]}>•</Text>
      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Privacy Policy
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={[styles.lastUpdated, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          Last Updated: June 2026
        </Text>

        <Section title="1. Introduction">
          <Body>
            PantrySwipe is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use the PantrySwipe mobile application.{"\n\n"}By using PantrySwipe, you agree to the collection and use of information in accordance with this policy. We will never sell your personal data to third parties.
          </Body>
        </Section>

        <Section title="2. Information We Collect">
          <Body>We may collect the following information when you use PantrySwipe:</Body>
          <Bullet text="Name and email address (for account creation)" />
          <Bullet text="Pantry inventory and ingredient lists" />
          <Bullet text="Barcode scan history" />
          <Bullet text="Saved and favourite recipes" />
          <Bullet text="Notification preferences" />
          <Bullet text="Device information (model, OS version, app version)" />
          <Bullet text="Crash reports and error logs" />
          <Bullet text="Anonymous usage analytics" />
        </Section>

        <Section title="3. How We Use Your Information">
          <Body>The information we collect is used to:</Body>
          <Bullet text="Create and manage your PantrySwipe account" />
          <Bullet text="Synchronise your pantry across devices" />
          <Bullet text="Generate personalised AI recipe suggestions" />
          <Bullet text="Improve barcode recognition accuracy" />
          <Bullet text="Send expiry reminders and notifications" />
          <Bullet text="Improve overall app performance and reliability" />
          <Bullet text="Provide customer support when requested" />
        </Section>

        <Section title="4. Third-Party Services">
          <Body>
            PantrySwipe may integrate with the following third-party services, each of which has its own privacy policy:
          </Body>
          <Bullet text="Supabase — secure database and authentication" />
          <Bullet text="Open Food Facts — open-source food product database" />
          <Bullet text="UPCitemDB — barcode lookup database" />
          <Bullet text="OpenAI (or other AI providers) — recipe generation" />
          <Bullet text="Google Firebase — analytics and crash reporting (if enabled)" />
          <Bullet text="Apple Push Notification Service — expiry reminders (iOS)" />
          <Bullet text="Google Play Services — notifications and services (Android)" />
          <Body>
            {"\n"}We encourage you to review the privacy policies of these third-party providers. We are not responsible for their data practices.
          </Body>
        </Section>

        <Section title="5. Data Storage & Security">
          <Body>
            Your pantry information and personal data are securely stored using encrypted databases. We implement industry-standard security measures including encryption in transit (TLS) and at rest to protect your information from unauthorised access.{"\n\n"}While we strive to use commercially acceptable means to protect your data, no method of transmission over the internet is 100% secure.
          </Body>
        </Section>

        <Section title="6. Your Rights">
          <Body>You have the right to:</Body>
          <Bullet text="View all personal information we hold about you" />
          <Bullet text="Update or correct your account information" />
          <Bullet text="Delete individual pantry items at any time" />
          <Bullet text="Delete your PantrySwipe account entirely" />
          <Bullet text="Request removal of all stored personal data" />
          <Body>
            {"\n"}To exercise any of these rights, please contact us at support@pantryswipe.app. We will respond to all requests within 30 days.
          </Body>
        </Section>

        <Section title="7. Cookies & Analytics">
          <Body>
            PantrySwipe may collect anonymous usage statistics to help us understand how the app is used and how to improve it. This data is aggregated and does not personally identify you.{"\n\n"}You can opt out of analytics collection at any time in Settings → Privacy → Analytics.
          </Body>
        </Section>

        <Section title="8. Children's Privacy">
          <Body>
            PantrySwipe is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately so we can delete it.
          </Body>
        </Section>

        <Section title="9. Changes to This Policy">
          <Body>
            We may update this Privacy Policy from time to time. When we do, we will notify you through the app and update the "Last Updated" date at the top of this page.{"\n\n"}Continued use of PantrySwipe after changes are made constitutes your acceptance of the revised policy.
          </Body>
        </Section>

        <Section title="10. Contact Us">
          <Body>
            If you have any questions or concerns about this Privacy Policy, please contact us at:
          </Body>
          <Text style={[styles.contactEmail, { color: HERB, fontFamily: "SpaceGrotesk_600SemiBold" }]}>
            support@pantryswipe.app
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 20, letterSpacing: -0.3 },
  scroll: { paddingTop: 8, paddingHorizontal: 16, gap: 12 },
  lastUpdated: { fontSize: 12, textAlign: "center", paddingVertical: 10 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  contactEmail: {
    fontSize: 15,
    marginTop: 4,
  },
});
