import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { AppText, Banner, BrandMark, Button, Card, TextField, ThemeToggleButton } from "../components/ui";
import { openWebLink, WebLinks } from "../lib/links";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radii, spacing } from "../theme/tokens";

/**
 * Student sign-in — same flow and copy as `apps/student-web/src/app/login/page.tsx`:
 *   "Welcome back" → email + password (show/hide) → "Forgot password?" →
 *   gold "Sign in as Student" CTA → "Don't have an account? Sign up as Student".
 *
 * Authenticates against POST /api/v1/auth/mobile/login (students only; unverified or
 * suspended accounts get the server's message). No demo fallback: a failed sign-in
 * never creates a session.
 */
export function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isLoading) return;
    setError(null);
    clearNotice();

    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setIsLoading(true);
    const outcome = await signIn(email, password);
    if (!outcome.ok) {
      setError(outcome.message ?? "Login failed.");
      setIsLoading(false);
    }
    // On success the root navigator swaps this screen out.
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <ThemeToggleButton />
        </View>

        <View style={styles.column}>
          <View style={styles.hero}>
            <View style={[styles.iconTile, { backgroundColor: colors.actionSubtle }]}>
              <BrandMark size={36} />
            </View>
            <AppText variant="display" style={styles.center}>
              Welcome back
            </AppText>
            <AppText tone="muted" style={[styles.center, { marginTop: spacing.sm }]}>
              Sign in to continue your learning journey
            </AppText>
          </View>

          <Card style={styles.formCard}>
            {notice ? <Banner tone="action" message={notice} /> : null}
            {error ? <Banner tone="alert" message={error} /> : null}

            <TextField
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isLoading}
              invalid={Boolean(error) && !email.trim()}
            />

            <TextField
              ref={passwordRef}
              label="Password"
              labelAccessory={
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openWebLink(WebLinks.forgotPassword)}
                  hitSlop={8}
                >
                  <AppText variant="caption" tone="action" weight="600">
                    Forgot password?
                  </AppText>
                </Pressable>
              }
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              editable={!isLoading}
              invalid={Boolean(error) && !password}
            />

            <Button
              label="Sign in as Student"
              trailing="→"
              onPress={handleSubmit}
              loading={isLoading}
              style={{ marginTop: spacing.xs }}
            />
          </Card>

          <View style={styles.footer}>
            <AppText variant="small" tone="muted">
              Don&apos;t have an account?{" "}
            </AppText>
            <Pressable accessibilityRole="link" onPress={() => void openWebLink(WebLinks.register)} hitSlop={8}>
              <AppText variant="small" tone="action" weight="600">
                Sign up as Student
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  center: { textAlign: "center" },
  formCard: {
    padding: spacing.xxl,
    borderRadius: radii.xl,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: spacing.xxl,
  },
});
