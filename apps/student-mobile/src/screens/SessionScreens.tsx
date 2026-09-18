import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { AppText, BrandMark, Button, Wordmark } from "../components/ui";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/tokens";

/** Shown while the refresh token from the secure enclave is being rotated on launch. */
export function RestoringScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]} accessibilityLabel="Restoring your session">
      <BrandMark size={64} />
      <View style={{ marginTop: spacing.lg }}>
        <Wordmark />
      </View>
      <ActivityIndicator color={colors.action} style={{ marginTop: spacing.xxl }} />
    </View>
  );
}

/** A saved session exists but the API can't be reached. Retrying keeps the session. */
export function OfflineScreen() {
  const { colors } = useTheme();
  const { retryRestore, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <View
      style={[
        styles.center,
        { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.content}>
        <BrandMark size={56} />
        <AppText variant="h1" style={[styles.text, { marginTop: spacing.xl }]}>
          You&apos;re offline
        </AppText>
        <AppText tone="muted" style={[styles.text, { marginTop: spacing.sm }]}>
          We couldn&apos;t reach Language Metrics to restore your session. Check your internet
          connection and try again.
        </AppText>
        <Button
          label="Try again"
          loading={retrying}
          onPress={async () => {
            setRetrying(true);
            await retryRestore();
            setRetrying(false);
          }}
          style={styles.button}
        />
        <Button
          label="Sign in with a different account"
          variant="outline"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
          style={{ marginTop: spacing.sm, alignSelf: "stretch" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  text: {
    textAlign: "center",
  },
  button: {
    marginTop: spacing.xxl,
    alignSelf: "stretch",
  },
});
