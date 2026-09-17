import type { TextStyle } from "react-native";
// utils/format has no imports of its own, so the theme can depend on it
// without a cycle — checked when `clamp` was given one home.
import { clamp } from "@/utils/format";

/**
 * Single source of truth for the app's dark theme — every screen/component
 * reads from here, no hardcoded colors elsewhere.
 *
 * "Aurora Theater": midnight-navy surfaces, electric violet for ACTIONS,
 * crimson reserved for the brand wordmark, gold for premium, emerald for money.
 * Token key names are stable — new tokens are ADDED, never renamed, so no call
 * site ever breaks when the palette shifts.
 */
export const theme = {
  colors: {
    /* ---- surfaces ---- */
    background: "#0E1018",
    surface: "#151823",
    surfaceElevated: "#1B1F2C",
    surfaceSunken: "#0B0D14",
    popover: "#161A25",
    secondary: "#232838",
    /** Violet-tinted "selected/active" fill — pairs with `primary` text. */
    accent: "#241E3C",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    /** Hairline ring drawn on top of artwork so images never touch the page. */
    ring: "rgba(255,255,255,0.10)",
    skeleton: "#1E2331",

    /* ---- actions ---- */
    /** ELECTRIC VIOLET — actions only: buttons, active tab, focus, scrubber, selection. */
    primary: "#9A7CF7",
    primarySoft: "rgba(154,124,247,0.16)",
    /** Foreground on solid violet — near-black, never white. */
    onPrimary: "#141024",

    /* ---- identity ---- */
    /** CRIMSON — the logo/wordmark ONLY. Nothing else. */
    brand: "#E0181F",
    brandSoft: "rgba(224,24,31,0.16)",

    /* ---- roles ---- */
    /** GOLD — premium/subscription badges, ratings, crowns. */
    premium: "#E9B949",
    premiumSoft: "rgba(233,185,73,0.16)",
    onPremium: "#2B1F02",
    /** EMERALD — wallet, money, credits. */
    finance: "#3DD68C",
    financeSoft: "rgba(61,214,140,0.16)",
    onFinance: "#04241A",
    success: "#3DD68C",
    successSoft: "rgba(61,214,140,0.16)",
    warning: "#E8A33D",
    warningSoft: "rgba(232,163,61,0.16)",
    onWarning: "#2A1B02",
    danger: "#F0555C",
    dangerSoft: "rgba(240,85,92,0.16)",
    onDanger: "#2C0508",
    info: "#5AB8F0",
    infoSoft: "rgba(90,184,240,0.16)",
    onInfo: "#04202F",

    /* ---- text ---- */
    text: "#F5F6FA",
    textMuted: "#9AA0B4",
    textFaint: "#6B7185",

    /* ---- scrims ---- */
    overlay: "rgba(8,10,17,0.62)",
    scrim: "rgba(8,10,17,0.88)",
    scrimSoft: "rgba(8,10,17,0.35)",

    /** Aurora wash hues — backdrops only, always used at low alpha. */
    aurora: {
      violet: "#6B4BD8",
      indigo: "#3B3E8F",
      emerald: "#1C7A55",
      gold: "#8A6A16",
      crimson: "#8E1420",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    xs: 5,
    sm: 7,
    md: 10,
    lg: 12,
    /** The artwork radius of the signature MediaCard. */
    card: 14,
    xl: 17,
    "2xl": 22,
    "3xl": 28,
    pill: 999,
  },
  shadow: {
    sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
    md: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
    lg: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 },
  },
  /**
   * Type scale — size + lineHeight + weight per role. This is the ONLY place a
   * text size is defined: `ThemedText` resolves every one of its variants from
   * here (its variant names map 1:1 onto these roles, plus the `heading` alias
   * for `display`), so editing a role here changes what actually renders. Reach
   * for the raw numbers directly only when you need to measure (e.g. reserving
   * space for a hero title). `weight` keys index `theme.font`.
   */
  type: {
    display: { fontSize: 30, lineHeight: 36, weight: "bold", letterSpacing: -0.4 },
    title: { fontSize: 20, lineHeight: 26, weight: "bold", letterSpacing: -0.2 },
    section: { fontSize: 17, lineHeight: 22, weight: "semibold", letterSpacing: -0.1 },
    body: { fontSize: 15, lineHeight: 21, weight: "regular", letterSpacing: 0 },
    /** Quieter secondary copy — a notch under body. */
    muted: { fontSize: 14, lineHeight: 19, weight: "regular", letterSpacing: 0 },
    /** Meta lines under titles. */
    caption: { fontSize: 13, lineHeight: 18, weight: "regular", letterSpacing: 0 },
    /** Form labels, chips and small emphasised keys. */
    label: { fontSize: 12, lineHeight: 16, weight: "semibold", letterSpacing: 0.6 },
    overline: { fontSize: 11, lineHeight: 14, weight: "bold", letterSpacing: 0.9 },
  },
  /** Shared layout constants so screens don't re-invent the tab-bar clearance. */
  layout: {
    screenPadding: 20,
    tabBarHeight: 64,
    /** Bottom padding a scrollable root screen needs to clear the floating tab bar. */
    tabBarClearance: 112,
    minTouch: 44,
  },
  font: {
    // Loaded via @expo-google-fonts/noto-sans-myanmar in App.tsx — covers
    // Myanmar glyphs and renders Latin text acceptably too, so ThemedText
    // uses this everywhere instead of switching fonts per language.
    regular: "NotoSansMyanmar_400Regular",
    medium: "NotoSansMyanmar_500Medium",
    semibold: "NotoSansMyanmar_600SemiBold",
    bold: "NotoSansMyanmar_700Bold",
  },
} as const;

/**
 * Spread onto any Text style that renders money, durations, counts or times —
 * keeps digits from jittering as values change. Declared outside `theme` so it
 * stays a mutable `TextStyle` (an `as const` array wouldn't satisfy RN's types).
 */
export const tabularNums: TextStyle = { fontVariant: ["tabular-nums"] };

/**
 * Foreground ink for content drawn on a SOLID role-coloured fill.
 *
 * Any control that fills itself with an arbitrary accent (Button/IconButton
 * `variant="solid"` + `color`, selected chips, badges) must resolve its label
 * and icon colour through this instead of hardcoding `onPrimary` — a gold
 * premium or emerald money fill needs its own ink, and near-black-on-violet is
 * unreadable on those. Unknown/custom accents fall back to `onPrimary`.
 */
export function onSolid(accent: string): string {
  switch (accent) {
    case theme.colors.premium:
      return theme.colors.onPremium;
    // `finance` and `success` are the same hue, so one case covers both.
    case theme.colors.finance:
      return theme.colors.onFinance;
    case theme.colors.warning:
      return theme.colors.onWarning;
    case theme.colors.danger:
      return theme.colors.onDanger;
    case theme.colors.info:
      return theme.colors.onInfo;
    default:
      return theme.colors.onPrimary;
  }
}

/**
 * Composites an alpha onto ANY theme colour string — `#RGB`, `#RRGGBB`,
 * `#RRGGBBAA`, `rgb()` or `rgba()`.
 *
 * Use this instead of the `token + "99"` string concatenation that spread
 * through the home page. That shorthand is only valid for 6-digit hex: applied
 * to one of the rgba border tokens it silently produces
 * `"rgba(255,255,255,0.14)99"`, which is not a colour — iOS renders nothing and
 * Android throws. Since the tokens a component picks are usually chosen by
 * STATE, that is a latent crash waiting for a new branch rather than a typo.
 *
 * An existing alpha is multiplied, not replaced, so fading an already-translucent
 * hairline token never makes it more opaque than it started.
 */
export function withAlpha(color: string, value: number): string {
  const target = clamp(value, 0, 1);

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const rgb = hex.length < 6 ? hex.slice(0, 3).replace(/./g, (c) => c + c) : hex.slice(0, 6);
    const base = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    const channel = Math.round(target * base * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${rgb}${channel}`;
  }

  const parts = color.match(/-?[\d.]+/g);
  if (!parts || parts.length < 3) return color;
  const base = parts.length >= 4 ? Number(parts[3]) : 1;
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${Number((target * base).toFixed(4))})`;
}

export type TypeVariant = keyof typeof theme.type;
