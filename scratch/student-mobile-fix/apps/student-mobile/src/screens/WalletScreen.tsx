import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { Dialog } from "../components/Dialog";
import { AppText, Badge, Banner, Button, Card } from "../components/ui";
import { MobileApiClient } from "../lib/api-client";
import { formatNumber } from "../lib/format";
import { openWebLink, WebLinks } from "../lib/links";
import { useTheme } from "../theme/ThemeProvider";
import { elevation, layout, radii, spacing } from "../theme/tokens";

/** Same packages as the web wallet (`apps/student-web/src/types/coins.ts`). */
const COIN_PACKAGES = [
  { id: "tier1", coins: 100, priceInr: 299, name: "Basic Pack" },
  { id: "tier2", coins: 500, priceInr: 1499, name: "Popular Pack" },
  { id: "tier3", coins: 1000, priceInr: 2999, name: "Pro Pack" },
] as const;

export function WalletScreen() {
  const { colors, scheme } = useTheme();
  const { coinBalance, setCoinBalance } = useAuth();
  const [coinValueInr, setCoinValueInr] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const result = await MobileApiClient.getCoinBalance();
        setCoinBalance(result.balance);
        setCoinValueInr(result.coinUnitValueInr);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't refresh your balance.");
      } finally {
        setRefreshing(false);
      }
    },
    [setCoinBalance]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.action} colors={[colors.action]} />}
      >
        <AppText variant="h1">Wallet</AppText>
        <AppText tone="muted" style={styles.subtitle}>
          Manage your coins for booking lessons.
        </AppText>

        {error ? <Banner tone="alert" message={error} actionLabel="Try again" onAction={() => void load(false)} /> : null}

        <View style={[styles.balanceCard, { backgroundColor: colors.brandSolid }, elevation(scheme, colors, 2)]}>
          <AppText variant="label" tone="onBrand" style={{ opacity: 0.8 }}>
            Current balance
          </AppText>
          <AppText variant="display" tone="onBrand" style={styles.balance}>
            🪙 {formatNumber(coinBalance)}
          </AppText>
          <AppText variant="small" tone="onBrand" style={{ opacity: 0.8 }}>
            ≈ ₹{formatNumber(Math.round(coinBalance * coinValueInr))} · Coins never expire
          </AppText>
          <Button label="Top up coins" onPress={() => setShowTopUp(true)} style={styles.topUpButton} />
        </View>

        <AppText variant="h2" style={styles.sectionTitle}>
          Coin packages
        </AppText>
        {COIN_PACKAGES.map((pkg) => (
          <Pressable key={pkg.id} accessibilityRole="button" onPress={() => setShowTopUp(true)}>
            {({ pressed }) => (
              <Card style={[styles.packCard, pressed ? { opacity: 0.85 } : null]}>
                <View style={{ flex: 1 }}>
                  {pkg.id === "tier2" ? <Badge label="Most popular" tone="action" style={{ marginBottom: spacing.xs }} /> : null}
                  <AppText variant="h3">{pkg.name}</AppText>
                  <AppText variant="small" tone="muted">
                    🪙 {formatNumber(pkg.coins)} coins
                  </AppText>
                </View>
                <AppText variant="h2">₹{formatNumber(pkg.priceInr)}</AppText>
              </Card>
            )}
          </Pressable>
        ))}

        <AppText variant="caption" tone="subtle" style={styles.footnote}>
          Payments are secured by Razorpay and processed on the Language Metrics student portal. Your balance
          here updates as soon as the payment is confirmed — pull down to refresh.
        </AppText>
      </ScrollView>

      <Dialog
        visible={showTopUp}
        title="Top up on the student portal"
        message="Coin purchases are completed securely on the Language Metrics student portal. Sign in there with this same account, choose a package, then come back and pull down to refresh your balance."
        onDismiss={() => setShowTopUp(false)}
        actions={[
          {
            label: "Open wallet",
            onPress: async () => {
              setShowTopUp(false);
              const opened = await openWebLink(WebLinks.wallet);
              if (!opened) setError("Couldn't open your browser. Visit the student portal to top up.");
            },
          },
          { label: "Not now", variant: "outline", onPress: () => setShowTopUp(false) },
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
  balanceCard: {
    borderRadius: radii.xl,
    padding: spacing.xxl,
  },
  balance: { marginVertical: spacing.sm, fontVariant: ["tabular-nums"] },
  topUpButton: { marginTop: spacing.xl },
  sectionTitle: { marginTop: spacing["3xl"], marginBottom: spacing.md },
  packCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  footnote: { marginTop: spacing.md },
});
