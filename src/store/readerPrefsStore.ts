import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Reader page inks — see READER_THEMES in components/books for the colours. */
export type ReaderTheme = "paper" | "sepia" | "night" | "amoled";

/**
 * PageReader sheet sizing. "page" is the LEGACY pre-v2 value — hydration maps
 * it to "screen", but it stays in the union so pre-v2 call sites keep
 * compiling until the pages builder switches over.
 */
export type ReaderFitMode = "width" | "height" | "screen" | "page";

export type ReaderFontFamily = "serif" | "sans" | "dyslexic";
export type ReaderLineHeight = "compact" | "normal" | "relaxed";
export type ReaderWidth = "narrow" | "medium" | "wide" | "full";
export type ReaderMargins = "s" | "m" | "l";
export type ReaderTextAlign = "justify" | "left";
export type ReaderPageMode = "scroll" | "single" | "double";
export type ReaderPageBackground = "theme" | "black" | "gray" | "white";
export type ReaderPageDirection = "ltr" | "rtl";

export const TEXT_SCALE_MIN = 0.85;
export const TEXT_SCALE_MAX = 1.6;
export const TEXT_SCALE_STEP = 0.05;

export const BRIGHTNESS_MIN = 0.4;
export const BRIGHTNESS_MAX = 1;

/** Preset chips are sugar over the continuous scale — the slider stays. */
export const SIZE_PRESETS: Record<"s" | "m" | "l" | "xl", number> = {
  s: 0.9,
  m: 1.0,
  l: 1.15,
  xl: 1.35,
};

/** Body-leading multipliers. Myanmar blocks floor at 1.8 regardless (RichText). */
export const READER_LINE_HEIGHTS: Record<ReaderLineHeight, number> = {
  compact: 1.5,
  normal: 1.65,
  relaxed: 1.85,
};

/** Text column max width in points; null = no cap. medium = today's value. */
export const READER_MAX_WIDTH: Record<ReaderWidth, number | null> = {
  narrow: 520,
  medium: 680,
  wide: 840,
  full: null,
};

/** Horizontal padding of the text column / page stage. */
export const READER_PADDING_H: Record<ReaderMargins, number> = {
  s: 12,
  m: 20,
  l: 32,
};

/** Stage colour behind page sheets; null = the reader theme's own paper. */
export const PAGE_BACKGROUND_COLOR: Record<ReaderPageBackground, string | null> = {
  theme: null,
  black: "#000000",
  gray: "#52525b",
  white: "#ffffff",
};

interface ReaderPrefsData {
  /** Page theme, both readers. */
  readerTheme: ReaderTheme;
  /** Text multiplier, clamped 0.85–1.6 in 0.05 steps. */
  textScale: number;
  /** Text reader typeface. Burmese always renders a Myanmar-capable face. */
  fontFamily: ReaderFontFamily;
  lineHeight: ReaderLineHeight;
  width: ReaderWidth;
  margins: ReaderMargins;
  /** Myanmar blocks are ALWAYS left-aligned regardless of this. */
  textAlign: ReaderTextAlign;
  showChapterTitle: boolean;
  /** In-reader dim overlay strength; 1 = overlay absent. NOT OS brightness. */
  brightness: number;
  keepAwake: boolean;
  /** false = bars stay until explicitly toggled. Idle timer also never arms under OS reduce-motion. */
  autoHideChrome: boolean;
  /** Immersive reading: hides the status bar (expo-status-bar only — JS-only law). */
  fullscreen: boolean;
  /**
   * Text reader: native text selection ON disables long-press paragraph
   * highlighting (the two gestures conflict — one at a time).
   */
  textSelection: boolean;
  /** PageReader layout. */
  pageMode: ReaderPageMode;
  /** PageReader sheet fit. */
  fitMode: ReaderFitMode;
  pageBackground: ReaderPageBackground;
  /** Turn semantics in single/double modes; no effect in scroll. */
  pageDirection: ReaderPageDirection;
  /**
   * The cross-book edition-language preference — null until the reader ever
   * picks one. Always validated against what a given book actually offers via
   * pickEdition().
   */
  readingLanguage: string | null;
}

interface ReaderPrefsState extends ReaderPrefsData {
  setReaderTheme: (readerTheme: ReaderTheme) => void;
  setTextScale: (textScale: number) => void;
  setFontFamily: (fontFamily: ReaderFontFamily) => void;
  setLineHeight: (lineHeight: ReaderLineHeight) => void;
  setWidth: (width: ReaderWidth) => void;
  setMargins: (margins: ReaderMargins) => void;
  setTextAlign: (textAlign: ReaderTextAlign) => void;
  setShowChapterTitle: (showChapterTitle: boolean) => void;
  setBrightness: (brightness: number) => void;
  setKeepAwake: (keepAwake: boolean) => void;
  setAutoHideChrome: (autoHideChrome: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setTextSelection: (textSelection: boolean) => void;
  setPageMode: (pageMode: ReaderPageMode) => void;
  setFitMode: (fitMode: ReaderFitMode) => void;
  setPageBackground: (pageBackground: ReaderPageBackground) => void;
  setPageDirection: (pageDirection: ReaderPageDirection) => void;
  setReadingLanguage: (readingLanguage: string | null) => void;
}

export const DEFAULT_READER_PREFS: ReaderPrefsData = {
  readerTheme: "paper",
  textScale: 1,
  fontFamily: "serif",
  lineHeight: "normal",
  width: "medium",
  margins: "m",
  textAlign: "justify",
  showChapterTitle: true,
  brightness: 1,
  keepAwake: true,
  autoHideChrome: true,
  fullscreen: false,
  textSelection: false,
  pageMode: "scroll",
  fitMode: "width",
  pageBackground: "theme",
  pageDirection: "ltr",
  readingLanguage: null,
};

function clampTextScale(value: number): number {
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

function clampBrightness(value: number): number {
  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, value));
}

/** Legacy "page" collapses into "screen" — one id, zero behaviour change. */
function normalizeFit(value: ReaderFitMode): Exclude<ReaderFitMode, "page"> {
  return value === "page" ? "screen" : value;
}

/**
 * Per-user reading preferences shared by BOTH readers. v2 dropped the zustand
 * persist middleware: hydration and flushing are explicit so the storage key
 * can follow the signed-in user ("anon" when signed out).
 */
export const useReaderPrefsStore = create<ReaderPrefsState>()((set) => ({
  ...DEFAULT_READER_PREFS,
  setReaderTheme: (readerTheme) => set({ readerTheme }),
  setTextScale: (textScale) => set({ textScale: clampTextScale(textScale) }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setLineHeight: (lineHeight) => set({ lineHeight }),
  setWidth: (width) => set({ width }),
  setMargins: (margins) => set({ margins }),
  setTextAlign: (textAlign) => set({ textAlign }),
  setShowChapterTitle: (showChapterTitle) => set({ showChapterTitle }),
  setBrightness: (brightness) => set({ brightness: clampBrightness(brightness) }),
  setKeepAwake: (keepAwake) => set({ keepAwake }),
  setAutoHideChrome: (autoHideChrome) => set({ autoHideChrome }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setTextSelection: (textSelection) => set({ textSelection }),
  setPageMode: (pageMode) => set({ pageMode }),
  setFitMode: (fitMode) => set({ fitMode: normalizeFit(fitMode) }),
  setPageBackground: (pageBackground) => set({ pageBackground }),
  setPageDirection: (pageDirection) => set({ pageDirection }),
  setReadingLanguage: (readingLanguage) => set({ readingLanguage }),
}));

/* ------------------------------------------------------------------ */
/* Persistence: explicit per-user hydrate + debounced write-through.   */
/* ------------------------------------------------------------------ */

const LEGACY_KEY = "myanflix-reader-prefs";
const FLUSH_DEBOUNCE_MS = 300;

function keyFor(userId: string | null): string {
  return `myanflix-reader-prefs:v2:${userId ?? "anon"}`;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Fills defaults and validates every field — stored blobs are data, never trusted. */
function sanitize(raw: Record<string, unknown>): ReaderPrefsData {
  const d = DEFAULT_READER_PREFS;
  return {
    readerTheme: oneOf(raw.readerTheme, ["paper", "sepia", "night", "amoled"] as const, d.readerTheme),
    textScale: typeof raw.textScale === "number" ? clampTextScale(raw.textScale) : d.textScale,
    fontFamily: oneOf(raw.fontFamily, ["serif", "sans", "dyslexic"] as const, d.fontFamily),
    lineHeight: oneOf(raw.lineHeight, ["compact", "normal", "relaxed"] as const, d.lineHeight),
    width: oneOf(raw.width, ["narrow", "medium", "wide", "full"] as const, d.width),
    margins: oneOf(raw.margins, ["s", "m", "l"] as const, d.margins),
    textAlign: oneOf(raw.textAlign, ["justify", "left"] as const, d.textAlign),
    showChapterTitle: bool(raw.showChapterTitle, d.showChapterTitle),
    brightness: typeof raw.brightness === "number" ? clampBrightness(raw.brightness) : d.brightness,
    keepAwake: bool(raw.keepAwake, d.keepAwake),
    autoHideChrome: bool(raw.autoHideChrome, d.autoHideChrome),
    fullscreen: bool(raw.fullscreen, d.fullscreen),
    textSelection: bool(raw.textSelection, d.textSelection),
    pageMode: oneOf(raw.pageMode, ["scroll", "single", "double"] as const, d.pageMode),
    fitMode: normalizeFit(oneOf(raw.fitMode, ["width", "height", "screen", "page"] as const, "width")),
    pageBackground: oneOf(raw.pageBackground, ["theme", "black", "gray", "white"] as const, d.pageBackground),
    pageDirection: oneOf(raw.pageDirection, ["ltr", "rtl"] as const, d.pageDirection),
    readingLanguage: typeof raw.readingLanguage === "string" ? raw.readingLanguage : null,
  };
}

function snapshot(state: ReaderPrefsState): ReaderPrefsData {
  return {
    readerTheme: state.readerTheme,
    textScale: state.textScale,
    fontFamily: state.fontFamily,
    lineHeight: state.lineHeight,
    width: state.width,
    margins: state.margins,
    textAlign: state.textAlign,
    showChapterTitle: state.showChapterTitle,
    brightness: state.brightness,
    keepAwake: state.keepAwake,
    autoHideChrome: state.autoHideChrome,
    fullscreen: state.fullscreen,
    textSelection: state.textSelection,
    pageMode: state.pageMode,
    fitMode: state.fitMode,
    pageBackground: state.pageBackground,
    pageDirection: state.pageDirection,
    readingLanguage: state.readingLanguage,
  };
}

/** Null until the first hydrate — the flusher never writes defaults over an unread blob. */
let activeKey: string | null = null;
/** True while hydrateReaderPrefs applies a loaded blob, so the flush skips it. */
let applying = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(state: ReaderPrefsState) {
  if (!activeKey) return;
  const key = activeKey;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    AsyncStorage.setItem(key, JSON.stringify({ version: 2, ...snapshot(state) })).catch(() => {
      // Storage full/unavailable — prefs quietly stay in memory for the session.
    });
  }, FLUSH_DEBOUNCE_MS);
}

useReaderPrefsStore.subscribe((state) => {
  if (applying) return;
  scheduleFlush(state);
});

/**
 * Loads the given user's prefs into the store: v2 per-user key first; if
 * absent, seeds ONCE from the legacy zustand-persist blob (fitMode
 * "page" -> "screen"); defaults otherwise. The legacy key is never written
 * again and never deleted — other users on the device may still migrate.
 *
 * Call site: RootNavigator on [user?.id] — NOT BookReader, which is no longer
 * the only consumer (BookDetails picks its edition from readingLanguage and
 * writes it back). Hydrating there armed `activeKey` too late: the first book
 * of a session saw defaults, its write was dropped, and after a logout the
 * key still pointed at the previous user. languageStore continues to own the
 * app language.
 */
export async function hydrateReaderPrefs(userId: string | null): Promise<void> {
  const key = keyFor(userId);
  let loaded: Record<string, unknown> | null = null;
  let hadV2 = false;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        loaded = parsed as Record<string, unknown>;
        hadV2 = true;
      }
    }
  } catch {
    // Unreadable blob — fall through to legacy/defaults.
  }

  if (!loaded) {
    try {
      const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const envelope = JSON.parse(legacyRaw) as { state?: unknown };
        if (envelope?.state && typeof envelope.state === "object") {
          loaded = envelope.state as Record<string, unknown>;
        }
      }
    } catch {
      // Same rule: corrupt legacy data means defaults, never a crash.
    }
  }

  const data = sanitize(loaded ?? {});
  applying = true;
  activeKey = key;
  useReaderPrefsStore.setState(data);
  applying = false;

  // Materialise the v2 key on first migration/first run so the next launch
  // reads it directly (and a later legacy-format change can't regress us).
  if (!hadV2) {
    AsyncStorage.setItem(key, JSON.stringify({ version: 2, ...data })).catch(() => {});
  }
}
