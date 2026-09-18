import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { Dialog } from "../components/Dialog";
import { AppText, Avatar, Badge, Banner, Button, Card, Divider, SegmentedControl } from "../components/ui";
import { APP_VERSION } from "../config/env";
import { formatMemberSince, formatNumber, initials } from "../lib/format";
import { openWebLink, WebLinks } from "../lib/links";
import type { ThemePreference } from "../lib/preferences";
import { useTheme } from "../theme/ThemeProvider";
import { layout, spacing } from "../theme/tokens";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

const STATUS_TONE = { ACTIVE: "trust", SUSPENDED: "alert", BLOCKED: "alert" } as const;

export function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const { student, coinBalance, signOut } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  if (!student) return null;

  const open = async (url: string) => {
    const opened = await openWebLink(url);
    setLinkError(opened ? null : "Couldn't open your browser. Please try again.");
  };

  const rows: Array<{ label: string; value: string }> = [
    { label: "Learning", value: student.languageToLearn },
    { label: "Level", value: student.proficiencyLevel },
    { label: "Coin balance", value: `🪙 ${formatNumber(coinBalance)}` },
    { label: "Member since", value: formatMemberSince(student.joinedAt) },
  ];

  const links: Array<{ label: string; url: string }> = [
    { label: "Help & FAQ", url: WebLinks.faq },
    { label: "Contact support", url: WebLinks.support },
    { label: "Terms of service", url: WebLinks.terms },
    { label: "Privacy policy", url: WebLinks.privacy },
  ];

  return (
    <>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <AppText variant="h1">Profile</AppText>
        <AppText tone="muted" style={styles.subtitle}>
          Your account and app settings.
        </AppText>

        {linkError ? <Banner tone="alert" message={linkError} /> : null}

        <Card>
          <View style={styles.identity}>
            <Avatar label={initials(student.name)} size={60} />
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <AppText variant="h2">{student.name}</AppText>
              <AppText variant="small" tone="muted" numberOfLines={1}>
                {student.email}
              </AppText>
              <Badge
                label={student.status === "ACTIVE" ? "Active student" : student.status.toLowerCase()}
                tone={STATUS_TONE[student.status]}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
          <Divider />
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <AppText tone="muted">{row.label}</AppText>
              <AppText weight="600">{row.value}</AppText>
            </View>
          ))}
        </Card>

        <AppText variant="h3" style={styles.sectionTitle}>
          Appearance
        </AppText>
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />

        <AppText variant="h3" style={styles.sectionTitle}>
          Help & legal
        </AppText>
        <Card style={{ paddingVertical: spacing.xs }}>
          {links.map((link, index) => (
            <Pressable
              key={link.label}
              accessibilityRole="link"
              onPress={() => void open(link.url)}
              style={({ pressed }) => [
                styles.linkRow,
                index < links.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <AppText>{link.label}</AppText>
              <AppText tone="subtle">›</AppText>
            </Pressable>
          ))}
        </Card>

        <Button label="Sign out" variant="danger" onPress={() => setConfirmSignOut(true)} style={styles.signOut} />

        <AppText variant="caption" tone="subtle" style={styles.version}>
          Language Metrics Student · v{APP_VERSION}
        </AppText>
      </ScrollView>

      <Dialog
        visible={confirmSignOut}
        title="Sign out?"
        message="You'll need to sign in again to book lessons and join classes on this device."
        onDismiss={() => setConfirmSignOut(false)}
        actions={[
          {
            label: "Sign out",
            variant: "danger",
            loading: signingOut,
            onPress: async () => {
              setSigningOut(true);
              await signOut();
            },
          },
          { label: "Cancel", variant: "outline", onPress: () => setConfirmSignOut(false) },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing["3xl"],
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  identity: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, gap: spacing.md },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: layout.minTouchTarget + 4,
  },
  signOut: { marginTop: spacing.xxl },
  version: { textAlign: "center", marginTop: spacing.lg },
});
