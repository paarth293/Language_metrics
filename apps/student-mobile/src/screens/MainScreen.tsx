import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TeacherCard } from "@repo/api-contracts";
import { useAuth } from "../auth/AuthProvider";
import { BrandMark, Wordmark } from "../components/ui";
import { formatNumber } from "../lib/format";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radii, spacing } from "../theme/tokens";
import { BookingSheet } from "./BookingSheet";
import { ClassesScreen } from "./ClassesScreen";
import { DiscoverScreen } from "./DiscoverScreen";
import { ProfileScreen } from "./ProfileScreen";
import { WalletScreen } from "./WalletScreen";

export type Tab = "discover" | "classes" | "wallet" | "profile";

const TABS: ReadonlyArray<{ key: Tab; label: string; icon: string }> = [
  { key: "discover", label: "Discover", icon: "🔎" },
  { key: "classes", label: "Classes", icon: "🗓️" },
  { key: "wallet", label: "Wallet", icon: "🪙" },
  { key: "profile", label: "Profile", icon: "👤" },
];

/** Signed-in shell: app bar with live coin balance, the four student tabs, and the booking sheet. */
export function MainScreen() {
  const { colors } = useTheme();
  const { coinBalance } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("discover");
  const [bookingTeacher, setBookingTeacher] = useState<TeacherCard | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* App bar */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.brandRow}>
          <BrandMark size={36} />
          <View style={{ marginLeft: spacing.md }}>
            <Wordmark />
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Student</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Coin balance ${coinBalance}. Open wallet`}
          onPress={() => setTab("wallet")}
          style={({ pressed }) => [
            styles.coinPill,
            { backgroundColor: colors.actionSubtle, borderColor: colors.action + "55", opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={[styles.coinText, { color: colors.text }]}>{formatNumber(coinBalance)}</Text>
        </Pressable>
      </View>

      {/* Active tab (mounting a tab refetches its data, like navigating on web) */}
      <View style={styles.body}>
        {tab === "discover" && <DiscoverScreen onBook={setBookingTeacher} />}
        {tab === "classes" && <ClassesScreen onBrowseTeachers={() => setTab("discover")} />}
        {tab === "wallet" && <WalletScreen />}
        {tab === "profile" && <ProfileScreen />}
      </View>

      {/* Bottom tab bar */}
      <View
        accessibilityRole="tablist"
        style={[
          styles.tabBar,
          { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              style={styles.tabItem}
            >
              <View style={[styles.tabIconWrap, active ? { backgroundColor: colors.actionSubtle } : null]}>
                <Text style={[styles.tabIcon, { opacity: active ? 1 : 0.55 }]}>{item.icon}</Text>
              </View>
              <Text style={[styles.tabLabel, { color: active ? colors.text : colors.textSubtle, fontWeight: active ? "700" : "500" }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <BookingSheet
        teacher={bookingTeacher}
        onClose={() => setBookingTeacher(null)}
        onViewClasses={() => {
          setBookingTeacher(null);
          setTab("classes");
        }}
        onTopUp={() => {
          setBookingTeacher(null);
          setTab("wallet");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  coinIcon: { fontSize: 15, marginRight: spacing.xs + 2 },
  coinText: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  body: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.minTouchTarget + 8,
  },
  tabIconWrap: {
    width: 44,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: { fontSize: 17 },
  tabLabel: { fontSize: 11, marginTop: 2 },
});
