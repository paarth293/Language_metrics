/**
 * Language Metrics Mobile Design System Tokens
 *
 * Aligned with Language Metrics web theme (Tailwind 4 dark palette).
 * Optimized for mobile touch ergonomics (min 44x44 touch targets).
 */

export const colors = {
  // Backgrounds
  background: "#0f0c29",
  backgroundSecondary: "#1a163a",
  surface: "#181434",
  surfaceCard: "#221c47",
  surfaceElevated: "#2d245e",

  // Brand / Accents
  primary: "#f59e0b", // Warm Amber
  primaryHover: "#d97706",
  primaryLight: "rgba(245, 158, 11, 0.15)",
  secondary: "#3b82f6", // Vibrant Blue
  secondaryLight: "rgba(59, 130, 246, 0.15)",
  accent: "#8b5cf6", // Purple
  accentLight: "rgba(139, 92, 246, 0.15)",

  // Typography
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  textDisabled: "#64748b",

  // Semantic Status
  success: "#10b981",
  successLight: "rgba(16, 185, 129, 0.15)",
  warning: "#f59e0b",
  warningLight: "rgba(245, 158, 11, 0.15)",
  error: "#f43f5e",
  errorLight: "rgba(244, 63, 94, 0.15)",
  info: "#0ea5e9",
  infoLight: "rgba(14, 165, 233, 0.15)",

  // Borders & Dividers
  border: "rgba(255, 255, 255, 0.08)",
  borderSubtle: "rgba(255, 255, 255, 0.05)",
  borderFocus: "#f59e0b",
} as const;

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

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  fontFamilies: {
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    "3xl": 28,
  },
  lineHeights: {
    xs: 14,
    sm: 18,
    base: 22,
    lg: 24,
    xl: 28,
    xxl: 32,
    "3xl": 36,
  },
} as const;

export const layout = {
  minTouchTarget: 44,
  headerHeight: 60,
  bottomNavHeight: 64,
  cardPadding: 16,
  screenPadding: 16,
} as const;
