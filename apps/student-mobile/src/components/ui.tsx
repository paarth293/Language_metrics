/**
 * Shared mobile UI primitives — the React Native counterparts of the web
 * components in `apps/student-web/src/components/ui` (Button, Card, Input,
 * Badge, Avatar, StatusBadge). All colours come from the active theme.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Coins, Moon, Sun, type LucideIcon } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { elevation, fonts, layout, radii, spacing, typography, type ThemeColors } from "../theme/tokens";
import type { ThemePreference } from "../lib/preferences";

// ── Text ─────────────────────────────────────────────────────────────────
type TextVariant = "display" | "h1" | "h2" | "h3" | "body" | "small" | "caption" | "label";
type TextTone = "default" | "secondary" | "muted" | "subtle" | "action" | "trust" | "alert" | "brand" | "onAction" | "onBrand";

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: "400" | "500" | "600" | "700" | "800";
}

function toneColor(tone: TextTone, colors: ThemeColors): string {
  switch (tone) {
    case "secondary":
      return colors.textSecondary;
    case "muted":
      return colors.textMuted;
    case "subtle":
      return colors.textSubtle;
    case "action":
      return colors.actionText;
    case "trust":
      return colors.trustText;
    case "alert":
      return colors.alert;
    case "brand":
      return colors.brandText;
    case "onAction":
      return colors.actionOn;
    case "onBrand":
      return colors.brandOn;
    default:
      return colors.text;
  }
}

export function AppText({ variant = "body", tone = "default", weight, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const isDisplay = variant === "display" || variant === "h1" || variant === "h2";
  const base: TextStyle = {
    ...typography[variant],
    color: toneColor(tone, colors),
    fontFamily: isDisplay ? fonts.display : fonts.body,
    fontWeight: weight ?? (isDisplay ? "700" : variant === "h3" ? "700" : variant === "label" ? "700" : "400"),
    ...(variant === "label" ? { textTransform: "uppercase" } : null),
  };
  return <Text {...rest} style={[base, style]} />;
}

/**
 * An icon followed by text on one line. React Native cannot nest an SVG
 * inside <Text>, so inline icons (the coin before an amount) use this row.
 * The icon takes the text's tone unless `iconColor` says otherwise.
 */
export function IconText({
  icon: Icon,
  iconColor,
  iconSize = 16,
  containerStyle,
  ...text
}: AppTextProps & { icon: LucideIcon; iconColor?: string; iconSize?: number; containerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconText, { gap: Math.round(iconSize / 3) }, containerStyle]}>
      <Icon size={iconSize} color={iconColor ?? toneColor(text.tone ?? "default", colors)} />
      <AppText {...text} />
    </View>
  );
}

/** A coin amount: the gold Coins icon followed by the text. */
export function CoinText(props: AppTextProps & { iconColor?: string; iconSize?: number; containerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <IconText icon={Coins} iconColor={colors.actionText} {...props} />;
}

// ── Button ───────────────────────────────────────────────────────────────
type ButtonVariant = "action" | "brand" | "outline" | "ghost" | "danger";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "sm";
  /** Lucide icon shown after the label. */
  trailing?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = "action",
  loading = false,
  disabled = false,
  size = "md",
  trailing: Trailing,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    action: { bg: colors.action, fg: colors.actionOn, border: colors.action },
    brand: { bg: colors.brandSolid, fg: colors.brandOn, border: colors.brandSolid },
    outline: { bg: "transparent", fg: colors.text, border: colors.borderStrong },
    ghost: { bg: "transparent", fg: colors.actionText, border: "transparent" },
    danger: { bg: "transparent", fg: colors.alert, border: colors.alert },
  };
  const { bg, fg, border } = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === "sm" ? styles.buttonSm : null,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        pressed && !isDisabled ? { transform: [{ scale: 0.98 }] } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          <Text style={[styles.buttonLabel, size === "sm" ? styles.buttonLabelSm : null, { color: fg }]}>{label}</Text>
          {Trailing ? <Trailing size={size === "sm" ? 15 : 17} color={fg} style={{ marginLeft: spacing.sm }} /> : null}
        </>
      )}
    </Pressable>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(scheme, colors, 1),
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── TextField ────────────────────────────────────────────────────────────
interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  labelAccessory?: React.ReactNode;
  secureToggle?: boolean;
  invalid?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Lucide icon shown inside the field, before the text. */
  leading?: LucideIcon;
  /** React 19: `ref` is a regular prop on function components. */
  ref?: React.Ref<TextInput>;
}

export function TextField({
  label,
  labelAccessory,
  secureToggle = false,
  invalid = false,
  containerStyle,
  leading: Leading,
  secureTextEntry,
  ref,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = invalid ? colors.alert : focused ? colors.brand : colors.border;

  return (
    <View style={[styles.fieldContainer, containerStyle]}>
      {(label || labelAccessory) && (
        <View style={styles.fieldLabelRow}>
          {label ? (
            <AppText variant="small" weight="600">
              {label}
            </AppText>
          ) : (
            <View />
          )}
          {labelAccessory}
        </View>
      )}
      <View style={[styles.inputWrap, { backgroundColor: colors.surfaceInset, borderColor }]}>
        {Leading ? <Leading size={18} color={colors.textSubtle} style={styles.inputLeading} /> : null}
        <TextInput
          {...inputProps}
          ref={ref}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          placeholderTextColor={colors.textSubtle}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text }]}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.inputTrailing}
          >
            <AppText variant="small" tone="muted" weight="600">
              {hidden ? "Show" : "Hide"}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────
type BadgeTone = "brand" | "action" | "trust" | "alert" | "neutral";

export function Badge({
  label,
  tone = "neutral",
  icon: Icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    brand: { bg: colors.brandSubtle, fg: colors.brandText },
    action: { bg: colors.actionSubtle, fg: colors.actionText },
    trust: { bg: colors.trustSubtle, fg: colors.trustText },
    alert: { bg: colors.alertSubtle, fg: colors.alert },
    neutral: { bg: colors.bgSubtle, fg: colors.textMuted },
  };
  const { bg, fg } = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {Icon ? <Icon size={12} color={fg} strokeWidth={2.5} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────
export function Avatar({ label, size = 48 }: { label: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ color: colors.brandText, fontWeight: "700", fontSize: size * 0.36 }}>{label}</Text>
    </View>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────
export function Banner({
  tone = "alert",
  message,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
}: {
  tone?: "alert" | "trust" | "action" | "brand";
  message: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const map = {
    alert: { bg: colors.alertSubtle, fg: colors.alert },
    trust: { bg: colors.trustSubtle, fg: colors.trustText },
    action: { bg: colors.actionSubtle, fg: colors.actionText },
    brand: { bg: colors.brandSubtle, fg: colors.brandText },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: bg, borderColor: fg + "33" }]}
    >
      <Text style={[styles.bannerText, { color: fg }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.bannerActionRow}>
          <Text style={[styles.bannerAction, { color: fg }]}>{actionLabel}</Text>
          {ActionIcon ? <ActionIcon size={15} color={fg} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

// ── SegmentedControl ─────────────────────────────────────────────────────
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors, scheme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: colors.surfaceInset, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected ? [{ backgroundColor: colors.surface }, elevation(scheme, colors, 1)] : null,
            ]}
          >
            <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────
export function Chip({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.brandSolid : colors.surface,
          borderColor: selected ? colors.brandSolid : colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.brandOn : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

// ── Empty / loading states ───────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.actionSubtle }]}>
        <Icon size={26} color={colors.actionText} />
      </View>
      <AppText variant="h3" style={styles.centerText}>
        {title}
      </AppText>
      <AppText variant="small" tone="muted" style={[styles.centerText, { marginTop: spacing.xs }]}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
      ) : null}
    </Card>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.action} />
      {label ? (
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

// ── Brand mark ───────────────────────────────────────────────────────────
export function BrandMark({ size = 40 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: colors.action,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel="Language Metrics"
    >
      <Text style={{ color: colors.actionOn, fontWeight: "800", fontSize: size * 0.38 }}>LM</Text>
    </View>
  );
}

export function Wordmark() {
  const { colors } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: colors.text }}>
      Language <Text style={{ color: colors.actionText }}>Metrics</Text>
    </Text>
  );
}

// ── Theme toggle (TopBar parity with web) ────────────────────────────────
export function ThemeToggleButton() {
  const { scheme, colors, setPreference } = useTheme();
  const next: ThemePreference = scheme === "dark" ? "light" : "dark";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onPress={() => setPreference(next)}
      hitSlop={6}
      style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      {scheme === "dark" ? <Sun size={17} color={colors.text} /> : <Moon size={17} color={colors.text} />}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginVertical: spacing.md }} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonSm: {
    minHeight: layout.minTouchTarget - 4,
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: fonts.body,
  },
  buttonLabelSm: {
    fontSize: 14,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: layout.cardPadding,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs + 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: layout.minTouchTarget + 4,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.body,
    paddingVertical: spacing.md,
  },
  inputLeading: {
    marginRight: spacing.sm,
  },
  inputTrailing: {
    paddingLeft: spacing.md,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  banner: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bannerAction: {
    fontSize: 14,
    fontWeight: "700",
  },
  bannerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconText: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  segmented: {
    flexDirection: "row",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    minHeight: 36,
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
  loading: {
    paddingVertical: spacing["4xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
