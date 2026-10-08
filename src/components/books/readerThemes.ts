import { theme, withAlpha } from "@/theme";
import type { ReaderTheme } from "@/store/readerPrefsStore";
import type { HighlightColor } from "@/store/readerAnnotationsStore";

/**
 * The page inks both readers share. These are PAGE colours, not app
 * theme tokens — a book page is paper first, app surface second, which is why
 * they live here and not in src/theme.
 */
export interface ReaderThemeColors {
  bg: string;
  ink: string;
  /** Secondary ink — folios, ornaments, quiet lines. */
  muted: string;
  /** Hairlines — blockquote rails, horizontal rules. */
  rule: string;
  /** Inline code / code block fill. */
  codeBg: string;
  /**
   * Link words. The app's `link` (#FF4D55) is tuned for the dark ground and is
   * only ~3:1 on the light pages, so paper and sepia take a deep crimson
   * (6.6:1 on paper, 5.7:1 on sepia); night and amoled keep `link` (5.5:1 and
   * 6.4:1).
   */
  link: string;
  /** expo-status-bar style while this page colour owns the screen. */
  barStyle: "dark" | "light";
}

/** Marquee crimson, deepened until it reads as text on a light page. */
const LIGHT_PAGE_LINK = "#B0141B";

function build(bg: string, ink: string, night: boolean): ReaderThemeColors {
  return {
    bg,
    ink,
    muted: withAlpha(ink, 0.6),
    rule: withAlpha(ink, 0.14),
    codeBg: night ? withAlpha("#ffffff", 0.08) : withAlpha("#000000", 0.06),
    link: night ? theme.colors.link : LIGHT_PAGE_LINK,
    barStyle: night ? "light" : "dark",
  };
}

export const READER_THEMES: Record<ReaderTheme, ReaderThemeColors> = {
  paper: build("#faf7f1", "#1c1a17", false),
  sepia: build("#f2e5cf", "#3a2f22", false),
  night: build("#16161a", "#ddd8d0", true),
  /** True black for OLED — the brief's fourth theme. */
  amoled: build("#000000", "#d9d4cb", true),
};

/** Swatch/picker order everywhere a theme is chosen. */
export const THEME_ORDER: ReaderTheme[] = ["paper", "sepia", "night", "amoled"];

/**
 * Base hues for paragraph highlights and their list dots. Painted onto the
 * page at theme-tuned alpha (lower on night/amoled so ink stays readable).
 */
export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  pink: "#ec4899",
};

/** Alpha a highlight fill should use over the given theme's paper. */
export function highlightAlpha(theme: ReaderTheme): number {
  return theme === "night" || theme === "amoled" ? 0.28 : 0.38;
}
