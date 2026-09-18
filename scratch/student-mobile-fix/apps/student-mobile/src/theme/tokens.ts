/**
 * Language Metrics — Mobile Design Tokens
 *
 * Mirrors the web design token system v2 in
 * `apps/student-web/src/app/globals.css` (identical in teacher-web):
 *   light  → `:root`              (cream heritage + deep indigo brand + gold action)
 *   dark   → `[data-theme="dark"]` (deep navy-black surfaces, lifted indigo, bright gold)
 *
 * Rules carried over from the web system:
 *   - `action` (gold) is for conversion CTAs only: Sign in, Book lesson, Join class, Top up.
 *   - `trust` (teal) is for verified / success signals only.
 *   - `alert` (coral) is for states that need the user's attention only.
 *   - Components consume semantic tokens, never raw hex values.
 */

import { Platform } from "react-native";

export type ColorScheme = "light" | "dark";

export interface ThemeColors {
  bg: string;
  bgSubtle: string;
  surface: string;
  surface2: string;
  surfaceInset: string;

  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  textDisabled: string;

  brand: string;
  brandHover: string;
  brandSubtle: string;
  brandOn: string;
  /** Filled brand surfaces (selected chips, balance card) — keeps white text ≥ 4.5:1. */
  brandSolid: string;
  /** Brand colour for text/icons on surfaces and `brandSubtle`. */
  brandText: string;

  action: string;
  actionHover: string;
  actionSubtle: string;
  actionOn: string;
  /** Gold used as text/links on light surfaces (readable variant of `action`). */
  actionText: string;

  trust: string;
  trustSubtle: string;
  trustOn: string;
  /** Teal used as text on `trustSubtle` / surfaces. */
  trustText: string;

  alert: string;
  alertSubtle: string;
  alertOn: string;

  info: string;

  /** Tint used for drop shadows (light mode only). */
  shadow: string;
  /** Scrim behind modal sheets. */
  overlay: string;
}

export const lightColors: ThemeColors = {
  bg: "#f8f4ea",
  bgSubtle: "#f2ecdd",
  surface: "#ffffff",
  surface2: "#faf7ef",
  surfaceInset: "#f2ecdd",

  border: "rgba(35, 29, 94, 0.10)",
  borderStrong: "rgba(35, 29, 94, 0.18)",

  text: "#1a1547",
  textSecondary: "#2e2578",
  textMuted: "#4e5674",
  textSubtle: "#8a93a6",
  textDisabled: "#9ca3af",

  brand: "#231d5e",
  brandHover: "#2e2578",
  brandSubtle: "#eeedfd",
  brandOn: "#ffffff",
  brandSolid: "#231d5e",
  brandText: "#231d5e",

  action: "#c7982f",
  actionHover: "#a36e1a",
  actionSubtle: "#faf1d5",
  actionOn: "#0f0c29",
  actionText: "#8a5d15",

  trust: "#0f9d6b",
  trustSubtle: "#d0f5ec",
  trustOn: "#ffffff",
  trustText: "#0f6b58",

  alert: "#dc4c3e",
  alertSubtle: "#fde8e7",
  alertOn: "#ffffff",

  info: "#5046c8",

  shadow: "#231d5e",
  overlay: "rgba(15, 12, 41, 0.45)",
};

export const darkColors: ThemeColors = {
  bg: "#0d1424",
  bgSubtle: "#131c31",
  surface: "#18233c",
  surface2: "#1e2b48",
  surfaceInset: "#0f1728",

  border: "rgba(248, 244, 234, 0.08)",
  borderStrong: "rgba(248, 244, 234, 0.16)",

  text: "#f3efe4",
  textSecondary: "#d4d2f9",
  textMuted: "#9aa6bd",
  textSubtle: "#6b7688",
  textDisabled: "#3d4558",

  brand: "#7b73e4",
  brandHover: "#a9a5f0",
  brandSubtle: "rgba(80, 70, 200, 0.15)",
  brandOn: "#ffffff",
  brandSolid: "#3d32a0",
  brandText: "#a9a5f0",

  action: "#e0b24a",
  actionHover: "#f0cf7e",
  actionSubtle: "rgba(224, 178, 74, 0.12)",
  actionOn: "#0f0c29",
  actionText: "#e0b24a",

  trust: "#34d399",
  trustSubtle: "rgba(52, 211, 153, 0.12)",
  trustOn: "#0a3d34",
  trustText: "#34d399",

  alert: "#f87171",
  alertSubtle: "rgba(248, 113, 113, 0.12)",
  alertOn: "#5c1515",

  info: "#7b73e4",

  shadow: "#000000",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export const palettes: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/** Web `--space-*` scale, in dp. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

/** Web `--radius-*` scale, in dp. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

/**
 * Web uses Fraunces (display) + Manrope (body). Until those font files are bundled
 * with expo-font, headings use the platform serif and body uses the system sans.
 */
export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" }),
  body: Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }),
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34 },
  h1: { fontSize: 24, lineHeight: 30 },
  h2: { fontSize: 20, lineHeight: 26 },
  h3: { fontSize: 17, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
} as const;

export const layout = {
  minTouchTarget: 44,
  screenPadding: 16,
  cardPadding: 16,
  maxContentWidth: 560,
} as const;

/** Soft indigo-tinted elevation in light mode; flat surfaces in dark mode (as on web). */
export function elevation(scheme: ColorScheme, colors: ThemeColors, level: 1 | 2 = 1) {
  if (scheme === "dark") return {};
  return Platform.select({
    web: {
      boxShadow:
        level === 1
          ? "0 4px 20px -4px rgba(35, 29, 94, 0.18)"
          : "0 8px 40px -8px rgba(35, 29, 94, 0.25)",
    },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: level === 1 ? 0.1 : 0.16,
      shadowRadius: level === 1 ? 12 : 20,
      shadowOffset: { width: 0, height: level === 1 ? 4 : 8 },
      elevation: level === 1 ? 2 : 6,
    },
  });
}
