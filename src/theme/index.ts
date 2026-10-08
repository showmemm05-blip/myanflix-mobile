import type { TextStyle } from "react-native";
// utils/format has no imports of its own, so the theme can depend on it
// without a cycle — checked when `clamp` was given one home.
import { clamp } from "@/utils/format";

/**
 * The floating dock's geometry (DesignSystem.dc.html, "Navigation dock"):
 * 64pt tall, 16pt in from each side, 20pt above the safe-area bottom inset,
 * and scrolling content keeps another 20pt of air above it.
 */
const DOCK_HEIGHT = 64;
const DOCK_SIDE_INSET = 16;
const DOCK_BOTTOM_GAP = 20;
const DOCK_CONTENT_GAP = 20;
/**
 * The tallest bottom inset a phone realistically reports: Android's
 * three-button navigation bar (48dp) under edge-to-edge. iPhones report 34,
 * Android gesture navigation ~16–24. The STATIC `tabBarClearance` assumes this
 * worst case so nothing is ever hidden behind the dock; `dockClearance()` and
 * `useDockClearance()` give the exact figure for the current device.
 */
const WORST_CASE_BOTTOM_INSET = 48;

/**
 * Single source of truth for the app's dark theme — every screen/component
 * reads from here, no hardcoded colors elsewhere.
 *
 * "Marquee" (approved 2026-10-02, docs/mobile-marquee-redesign-2026-10-01):
 * a near-black ground, CRIMSON for the brand and for everything active —
 * focus, progress, the selected dock tab and commit actions — WHITE for the
 * primary "Play" action and for selected chips, gold for Premium, green for
 * money. Flat: no gradient washes, no card borders, no card shadows.
 *
 * Token key names are stable — new tokens are ADDED, never renamed, so no call
 * site ever breaks when the palette shifts.
 *
 * Contrast (WCAG, composited over the #08080B ground):
 *  - white on crimson 4.86:1 · #08080B on white 20:1 · #1F1600 on gold 11:1
 *  - #04241A on green 8.2:1 · #2A1B02 on amber 8.2:1 · white on dangerStrong 6.5:1
 *  - #2C0508 on danger 6.1:1 · #04202F on info 7.4:1
 *  - every tone on its own *Soft fill ≥ 5.5:1, EXCEPT crimson: crimson TEXT is
 *    4.1:1 on the ground and 3.7:1 on primarySoft/brandSoft. Words drawn in
 *    crimson therefore use `link` (#FF4D55: 6.1:1 on the ground, 5.6:1 on
 *    primarySoft, 5.4:1 on accent); `primary` as ink is for icons, bars and
 *    rings only, where 3:1 is the bar.
 */
export const theme = {
  colors: {
    /* ---- surfaces ---- */
    /** The page ground. */
    background: "#08080B",
    /** Sheets and grouped panels. */
    surface: "#121217",
    /** Raised: fields, chips, skeleton blocks. */
    surfaceElevated: "#1C1C23",
    surfaceSunken: "#050507",
    popover: "#16161C",
    secondary: "#1C1C23",
    /**
     * Crimson-tinted "selected" fill (a selected row, an active cell). Pairs
     * with `text` (17.6:1) or `link` (5.4:1) ink — crimson `primary` WORDS on
     * it are 3.6:1, too low for text.
     */
    accent: "#2A1215",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    /** Hairline ring for the few places a hairline is still drawn (Marquee artwork has none). */
    ring: "rgba(255,255,255,0.10)",
    skeleton: "#1C1C23",

    /* ---- actions ---- */
    /**
     * CRIMSON — active, focus, progress, the selected dock tab and the commit
     * actions (Continue, Save, Confirm). As ink it is for icons/bars only;
     * crimson WORDS use `link`.
     */
    primary: "#E0181F",
    primarySoft: "rgba(224,24,31,0.16)",
    /** Foreground on solid crimson — white (4.86:1). */
    onPrimary: "#FFFFFF",
    /**
     * The fill that carries white ink — in Marquee the same crimson as
     * `primary` (the wallet's Deposit circle and the money flows' pinned buttons).
     */
    primaryStrong: "#E0181F",
    onPrimaryStrong: "#FFFFFF",
    /** Quiet neutral fill for round secondary controls (IconButton, share) — no border, no shadow. */
    tonal: "rgba(255,255,255,0.12)",
    /** Crimson that reads as TEXT on the page — links, "See all", Clear, Retry. */
    link: "#FF4D55",

    /** WHITE — the primary "Play" action and a selected chip/segment. */
    play: "#FFFFFF",
    /** Ink on `play` — the ground colour (20:1). */
    onPlay: "#08080B",
    /** The secondary button fill (My List, All games) — white at 16%. */
    tonalStrong: "rgba(255,255,255,0.16)",
    /** The 40pt back-button disc on the ground, a sheet's close button. */
    tonalSoft: "rgba(255,255,255,0.08)",
    /** Round controls over artwork (back / share on a hero) — under a blur. */
    onArt: "rgba(8,8,11,0.5)",
    /** Small chips stamped ON a poster (Premium crown, quality, episode tag). */
    artBadge: "rgba(8,8,11,0.72)",
    /** The unfilled part of a progress line. */
    track: "rgba(255,255,255,0.25)",
    /** A bottom sheet's drag grabber. */
    grabber: "rgba(255,255,255,0.24)",
    /** The floating dock's fill, laid over a blur. */
    dock: "rgba(22,22,28,0.92)",
    /**
     * The frosted top bar's tint over its blur (components/layout/GlassBar):
     * the ground at 40% — "a little dark", never solid (the owner, 2026-10-02).
     */
    glassTint: "rgba(8,8,11,0.4)",

    /* ---- identity ---- */
    /** CRIMSON — the wordmark bar. In Marquee the brand and the action colour are one hue. */
    brand: "#E0181F",
    brandSoft: "rgba(224,24,31,0.16)",
    /** An initials avatar's disc and ink (the signed-in user's avatar in the app bar). */
    avatar: "#2B1A1E",
    onAvatar: "#FF8A8F",

    /* ---- roles ---- */
    /** GOLD — premium/subscription badges, ratings, crowns, the Subscribe button. */
    premium: "#F5C451",
    premiumSoft: "rgba(245,196,81,0.16)",
    onPremium: "#1F1600",
    /** GREEN — wallet, money, credits. */
    finance: "#2FD07E",
    financeSoft: "rgba(47,208,126,0.16)",
    onFinance: "#04241A",
    success: "#2FD07E",
    successSoft: "rgba(47,208,126,0.16)",
    warning: "#F5A524",
    warningSoft: "rgba(245,165,36,0.16)",
    onWarning: "#2A1B02",
    /** Errors as TEXT and icons (6.5:1 on the ground). */
    danger: "#FF5A5F",
    dangerSoft: "rgba(255,90,95,0.16)",
    onDanger: "#2C0508",
    /** FILLED destructive buttons (Delete account) — carries white ink (6.5:1). */
    dangerStrong: "#B3262C",
    onDangerStrong: "#FFFFFF",
    info: "#4DB3FF",
    infoSoft: "rgba(77,179,255,0.16)",
    onInfo: "#04202F",

    /* ---- text ---- */
    /** Titles. */
    text: "#FFFFFF",
    /** Long-form body copy (synopsis, comments) — a step under white. */
    textBody: "#D9D9E0",
    /** Secondary: meta lines, body on raised fills. */
    textMuted: "#B3B3BD",
    /** Captions, placeholders, inactive dock icons (5.1:1 even on raised fills). */
    textFaint: "#8C8C99",
    /** Decoration ONLY — "·" separators, outlined numerals. Never words (3:1). */
    textDecor: "#5E5E6A",

    /* ---- scrims ---- */
    overlay: "rgba(0,0,0,0.6)",
    scrim: "rgba(0,0,0,0.88)",
    scrimSoft: "rgba(0,0,0,0.35)",

    /**
     * Legacy "Aurora" wash hues. Marquee draws no washes and AuroraBackdrop
     * has been deleted, so nothing reads these; the keys stay because theme
     * token names are never renamed or removed.
     */
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
    /** Landscape cards, panels' inner tiles. */
    lg: 12,
    /** The poster radius of the signature MediaCard. */
    card: 10,
    /** Chips and pills (34pt tall → fully round). */
    xl: 17,
    "2xl": 22,
    "3xl": 28,
    pill: 999,
    /** Every rectangular button (Play, Continue, Subscribe, Delete). */
    button: 12,
    /** A bottom sheet's top corners. */
    sheet: 24,
    /** The floating dock capsule. */
    dock: 32,
  },
  shadow: {
    sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
    md: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
    lg: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 },
    /** The one lifted thing in Marquee: the floating dock (0 12 32 rgba(0,0,0,0.55)). */
    dock: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 14 },
  },
  /**
   * Type scale — size + lineHeight + weight per role. This is the ONLY place a
   * text size is defined: `ThemedText` resolves every one of its variants from
   * here (its variant names map 1:1 onto these roles, plus the `heading` alias
   * for `display`), so editing a role here changes what actually renders. Reach
   * for the raw numbers directly only when you need to measure (e.g. reserving
   * space for a hero title). `weight` keys index `theme.font`.
   *
   * Myanmar text is never letter-spaced and gets +4 line height (ThemedText).
   */
  type: {
    display: { fontSize: 34, lineHeight: 38, weight: "black", letterSpacing: -1 },
    title: { fontSize: 24, lineHeight: 30, weight: "extrabold", letterSpacing: -0.5 },
    section: { fontSize: 19, lineHeight: 26, weight: "extrabold", letterSpacing: -0.2 },
    body: { fontSize: 15, lineHeight: 23, weight: "regular", letterSpacing: 0 },
    /** Quieter secondary copy — a notch under body. */
    muted: { fontSize: 14, lineHeight: 20, weight: "regular", letterSpacing: 0 },
    /** Meta lines under titles. */
    caption: { fontSize: 13, lineHeight: 18, weight: "medium", letterSpacing: 0 },
    /** Form labels, chips and small emphasised keys. */
    label: { fontSize: 12, lineHeight: 16, weight: "semibold", letterSpacing: 0.4 },
    overline: { fontSize: 11, lineHeight: 14, weight: "extrabold", letterSpacing: 0.9 },
  },
  /** Shared layout constants so screens don't re-invent the dock clearance. */
  layout: {
    screenPadding: 16,
    /** The floating dock's height. */
    tabBarHeight: DOCK_HEIGHT,
    /**
     * Bottom padding a scrollable root screen needs to clear the floating dock
     * on ANY phone: dock + its 20pt lift + 20pt of air + the worst-case 48dp
     * bottom inset. Static so StyleSheets can use it; for the exact per-device
     * figure use `useDockClearance()` (hooks/useDockClearance).
     */
    tabBarClearance: WORST_CASE_BOTTOM_INSET + DOCK_BOTTOM_GAP + DOCK_HEIGHT + DOCK_CONTENT_GAP,
    /** The dock floats this far in from the screen's left and right edges. */
    dockSideInset: DOCK_SIDE_INSET,
    /** …and this far above the safe-area bottom inset. */
    dockBottomGap: DOCK_BOTTOM_GAP,
    /** Air kept between the last row of content and the top of the dock. */
    dockContentGap: DOCK_CONTENT_GAP,
    minTouch: 44,
  },
  font: {
    // Loaded via @expo-google-fonts/noto-sans-myanmar in App.tsx — covers
    // Myanmar glyphs and renders Latin text acceptably too, so ThemedText
    // uses this everywhere instead of switching fonts per language. Every key
    // here must be loaded there.
    regular: "NotoSansMyanmar_400Regular",
    medium: "NotoSansMyanmar_500Medium",
    semibold: "NotoSansMyanmar_600SemiBold",
    bold: "NotoSansMyanmar_700Bold",
    extrabold: "NotoSansMyanmar_800ExtraBold",
    black: "NotoSansMyanmar_900Black",
  },
} as const;

/**
 * Where the dock's bottom edge sits, measured up from the screen's bottom edge.
 * `bottomInset` is safe-area-context's `insets.bottom`.
 */
export function dockBottomOffset(bottomInset: number): number {
  return bottomInset + DOCK_BOTTOM_GAP;
}

/**
 * The exact bottom padding a scrolling root needs on THIS device so its last
 * row clears the dock with 20pt of air: inset + 20 + 64 + 20 (104pt above the
 * inset, as the design states).
 */
export function dockClearance(bottomInset: number): number {
  return dockBottomOffset(bottomInset) + DOCK_HEIGHT + DOCK_CONTENT_GAP;
}

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
 * and icon colour through this instead of hardcoding `onPrimary` — white is
 * right on crimson, but unreadable on white, gold or green.
 *
 * `primary`, `primaryStrong` and `brand` are one crimson in Marquee, so the
 * first case covers all three. Unknown/custom accents fall back to `onPrimary`
 * (white).
 */
export function onSolid(accent: string): string {
  switch (accent) {
    case theme.colors.primaryStrong:
      return theme.colors.onPrimaryStrong;
    case theme.colors.play:
      return theme.colors.onPlay;
    case theme.colors.premium:
      return theme.colors.onPremium;
    // `finance` and `success` are the same hue, so one case covers both.
    case theme.colors.finance:
      return theme.colors.onFinance;
    case theme.colors.warning:
      return theme.colors.onWarning;
    case theme.colors.danger:
      return theme.colors.onDanger;
    case theme.colors.dangerStrong:
      return theme.colors.onDangerStrong;
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
