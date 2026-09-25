import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { elevation, radii, spacing } from "../theme/tokens";
import { AppText, Button } from "./ui";

/**
 * Themed confirmation dialog.
 * (React Native's `Alert.alert` is a no-op on Expo web, so the app never relies on it.)
 */
export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: "action" | "brand" | "outline" | "danger";
  loading?: boolean;
}

export function Dialog({
  visible,
  title,
  message,
  actions,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message: string;
  actions: DialogAction[];
  onDismiss: () => void;
}) {
  const { colors, scheme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
        onPress={onDismiss}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(scheme, colors, 2)]}
        >
          <AppText variant="h2">{title}</AppText>
          <AppText tone="muted" style={styles.message}>
            {message}
          </AppText>
          <View style={styles.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                onPress={action.onPress}
                variant={action.variant ?? "action"}
                loading={action.loading}
                style={styles.actionButton}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xxl,
  },
  message: {
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  actionButton: {
    alignSelf: "stretch",
  },
});
