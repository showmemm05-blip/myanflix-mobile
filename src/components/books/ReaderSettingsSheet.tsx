import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { IconButton } from "@/components/ui/IconButton";
import { Slider } from "@/components/ui/Slider";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  SIZE_PRESETS,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  useReaderPrefsStore,
  type ReaderFontFamily,
  type ReaderLineHeight,
  type ReaderMargins,
  type ReaderPageBackground,
  type ReaderTheme,
  type ReaderWidth,
} from "@/store/readerPrefsStore";
import { READER_THEMES, THEME_ORDER } from "@/components/books/readerThemes";
import { ReaderSegments } from "@/components/books/ReaderSegments";
import { theme } from "@/theme";

/** Zoom/rotation live in per-book view memory, not global prefs — the page
 *  reader passes its own handlers and the rows render only when it does. */
export interface ReaderPagesControls {
  /** Multiplier over the fitted size (1–3). */
  zoom: number;
  /**
   * False in the scrolling layout, which zooms by fit only: the steppers and
   * "Actual size" are drawn disabled there instead of silently doing nothing.
   * Rotate works in every layout. Defaults to true.
   */
  zoomEnabled?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotate: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** "text" (ChapterReader) or "pages" (PageReader). "pdf" is the pre-v2 alias for "pages". */
  mode: "text" | "pages" | "pdf";
  /** Page readers only — enables the zoom and rotate rows. */
  pagesControls?: ReaderPagesControls;
}

type SectionId = "appearance" | "layout" | "behavior";

const SIZE_PRESET_ORDER = ["s", "m", "l", "xl"] as const;
/** Visual "A" sizes for the four preset tiles. */
const SIZE_PRESET_GLYPH: Record<(typeof SIZE_PRESET_ORDER)[number], number> = { s: 13, m: 16, l: 19, xl: 23 };
const PAGE_BG_ORDER: ReaderPageBackground[] = ["theme", "black", "gray", "white"];

/**
 * The one settings surface both readers share (BookReader.dc.html /
 * PageReader.dc.html "settings") — three collapsible sections. The text
 * reader opens on Appearance, the page reader on Page (its main controls);
 * expansion is plain state, never persisted. Writes readerPrefsStore;
 * sliders commit ONCE on release, not per frame.
 */
export function ReaderSettingsSheet({ visible, onClose, mode: rawMode, pagesControls }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const mode: "text" | "pages" = rawMode === "text" ? "text" : "pages";
  const { height: windowHeight } = useWindowDimensions();

  const prefs = useReaderPrefsStore();

  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    appearance: mode === "text",
    layout: mode === "pages",
    behavior: false,
  });
  const toggleSection = (id: SectionId) => setOpen((current) => ({ ...current, [id]: !current[id] }));

  // Live slider readouts without per-frame store writes (the commit contract).
  const [pendingScale, setPendingScale] = useState<number | null>(null);
  const [pendingBrightness, setPendingBrightness] = useState<number | null>(null);
  const shownScale = pendingScale ?? prefs.textScale;
  const shownBrightness = pendingBrightness ?? prefs.brightness;

  const themeLabels: Record<ReaderTheme, string> = {
    paper: r.themes.paper,
    sepia: r.themes.sepia,
    night: r.themes.night,
    amoled: r.themes.amoled,
  };
  const sizeLabels: Record<(typeof SIZE_PRESET_ORDER)[number], string> = {
    s: r.sizeSmall,
    m: r.sizeMedium,
    l: r.sizeLarge,
    xl: r.sizeXL,
  };
  const lineOptions: { value: ReaderLineHeight; label: string }[] = [
    { value: "compact", label: r.lineCompact },
    { value: "normal", label: r.lineNormal },
    { value: "relaxed", label: r.lineRelaxed },
  ];
  const widthOptions: { value: ReaderWidth; label: string }[] = [
    { value: "narrow", label: r.widthNarrow },
    { value: "medium", label: r.widthMedium },
    { value: "wide", label: r.widthWide },
    { value: "full", label: r.widthFull },
  ];
  const marginOptions: { value: ReaderMargins; label: string }[] = [
    { value: "s", label: r.marginSmall },
    { value: "m", label: r.marginMedium },
    { value: "l", label: r.marginLarge },
  ];
  const fontOptions: { value: ReaderFontFamily; label: string }[] = [
    { value: "serif", label: r.fontSerif },
    { value: "sans", label: r.fontSans },
    { value: "dyslexic", label: r.fontDyslexic },
  ];
  const pageBgOptions = PAGE_BG_ORDER.map((value) => ({
    value,
    label: { theme: r.bgTheme, black: r.bgBlack, gray: r.bgGray, white: r.bgWhite }[value],
  }));

  // "Fit height" is meaningless while the list scrolls vertically.
  const fitOptions = [
    { value: "width", label: r.fitWidth },
    ...(prefs.pageMode === "scroll" ? [] : [{ value: "height", label: r.fitHeight }]),
    { value: "screen", label: r.fitScreen },
  ];
  const zoomEnabled = pagesControls?.zoomEnabled ?? true;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={r.settingsTitle}
      showClose
      snapHeight={Math.round(windowHeight * 0.85)}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ================= Appearance ================= */}
        <Section title={r.sectionAppearance} open={open.appearance} onToggle={() => toggleSection("appearance")} first>
          <View style={styles.swatchRow}>
            {THEME_ORDER.map((value) => {
              const swatch = READER_THEMES[value];
              const selected = prefs.readerTheme === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => prefs.setReaderTheme(value)}
                  accessibilityRole="button"
                  accessibilityLabel={themeLabels[value]}
                  accessibilityState={{ selected }}
                  style={styles.swatchWrap}
                >
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: swatch.bg },
                      selected ? styles.swatchSelected : styles.swatchIdle,
                    ]}
                  >
                    <Text style={[styles.swatchGlyph, { color: swatch.ink }]} allowFontScaling={false}>
                      Aa
                    </Text>
                  </View>
                  <ThemedText
                    variant="caption"
                    weight="bold"
                    color={selected ? theme.colors.link : theme.colors.textMuted}
                    numberOfLines={2}
                    style={styles.swatchLabel}
                  >
                    {themeLabels[value]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {mode === "text" && (
            <Group label={r.fontFamily}>
              <ReaderSegments
                options={fontOptions}
                value={prefs.fontFamily}
                onChange={(value) => prefs.setFontFamily(value as ReaderFontFamily)}
              />
            </Group>
          )}

          {mode === "text" && (
            <Group label={r.textSize}>
              <View style={styles.presetRow}>
                {SIZE_PRESET_ORDER.map((preset) => {
                  const value = SIZE_PRESETS[preset];
                  const selected = Math.abs(shownScale - value) < 0.001;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => prefs.setTextScale(value)}
                      accessibilityRole="button"
                      accessibilityLabel={sizeLabels[preset]}
                      accessibilityState={{ selected }}
                      style={[styles.presetTile, selected ? styles.presetSelected : styles.presetIdle]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.presetGlyph,
                          { fontSize: SIZE_PRESET_GLYPH[preset] },
                          { color: selected ? theme.colors.link : theme.colors.textMuted },
                        ]}
                      >
                        A
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.sliderRow}>
                <IconButton
                  icon="remove"
                  variant="ghost"
                  size="sm"
                  onPress={() => prefs.setTextScale(prefs.textScale - TEXT_SCALE_STEP)}
                  disabled={prefs.textScale <= TEXT_SCALE_MIN + 1e-6}
                  accessibilityLabel={r.smaller}
                />
                <Slider
                  value={shownScale}
                  min={TEXT_SCALE_MIN}
                  max={TEXT_SCALE_MAX}
                  step={TEXT_SCALE_STEP}
                  onChange={setPendingScale}
                  onChangeEnd={(value) => {
                    setPendingScale(null);
                    prefs.setTextScale(value);
                  }}
                  accessibilityLabel={r.textSize}
                  style={styles.slider}
                />
                <IconButton
                  icon="add"
                  variant="ghost"
                  size="sm"
                  onPress={() => prefs.setTextScale(prefs.textScale + TEXT_SCALE_STEP)}
                  disabled={prefs.textScale >= TEXT_SCALE_MAX - 1e-6}
                  accessibilityLabel={r.larger}
                />
                <ThemedText variant="caption" weight="bold" tabular style={styles.readout}>
                  {`${Math.round(shownScale * 100)}%`}
                </ThemedText>
              </View>
            </Group>
          )}

          <Group label={r.brightness}>
            <View style={styles.sliderRow}>
              <Ionicons name="moon-outline" size={18} color={theme.colors.textMuted} />
              <Slider
                value={shownBrightness}
                min={BRIGHTNESS_MIN}
                max={BRIGHTNESS_MAX}
                step={0.05}
                onChange={setPendingBrightness}
                onChangeEnd={(value) => {
                  setPendingBrightness(null);
                  prefs.setBrightness(value);
                }}
                accessibilityLabel={r.brightness}
                style={styles.slider}
              />
              <Ionicons name="sunny-outline" size={18} color={theme.colors.textMuted} />
              <ThemedText variant="caption" weight="bold" tabular style={styles.readout}>
                {`${Math.round(shownBrightness * 100)}%`}
              </ThemedText>
            </View>
          </Group>
        </Section>

        {/* ================= Layout (text) / Page (pages) ================= */}
        <Section
          title={mode === "text" ? r.sectionLayout : r.sectionPage}
          open={open.layout}
          onToggle={() => toggleSection("layout")}
        >
          {mode === "text" ? (
            <>
              <Group label={r.lineSpacing}>
                <ReaderSegments
                  options={lineOptions}
                  value={prefs.lineHeight}
                  onChange={(value) => prefs.setLineHeight(value as ReaderLineHeight)}
                />
              </Group>
              <Group label={r.readingWidth}>
                <ReaderSegments
                  options={widthOptions}
                  value={prefs.width}
                  onChange={(value) => prefs.setWidth(value as ReaderWidth)}
                />
              </Group>
              <Group label={r.margins}>
                <ReaderSegments
                  options={marginOptions}
                  value={prefs.margins}
                  onChange={(value) => prefs.setMargins(value as ReaderMargins)}
                />
              </Group>
              <Group label={r.alignment}>
                <ReaderSegments
                  options={[
                    { value: "justify", label: r.alignJustify },
                    { value: "left", label: r.alignLeft },
                  ]}
                  value={prefs.textAlign}
                  onChange={(value) => prefs.setTextAlign(value as "justify" | "left")}
                />
              </Group>
              <SwitchRow
                label={r.chapterTitleToggle}
                value={prefs.showChapterTitle}
                onChange={prefs.setShowChapterTitle}
              />
            </>
          ) : (
            <>
              <Group label={r.pageLayout}>
                <ReaderSegments
                  options={[
                    { value: "single", label: r.layoutSingle },
                    { value: "double", label: r.layoutDouble },
                    { value: "scroll", label: r.layoutScroll },
                  ]}
                  value={prefs.pageMode}
                  onChange={(value) => prefs.setPageMode(value as "scroll" | "single" | "double")}
                />
              </Group>
              <Group label={r.fit}>
                <ReaderSegments
                  options={fitOptions}
                  value={prefs.fitMode === "height" && prefs.pageMode === "scroll" ? "width" : prefs.fitMode}
                  onChange={(value) => prefs.setFitMode(value as "width" | "height" | "screen")}
                />
              </Group>
              {pagesControls && (
                <Group label={r.zoom}>
                  <View style={styles.zoomRow}>
                    <IconButton
                      icon="remove"
                      variant="tonal"
                      size="sm"
                      onPress={pagesControls.onZoomOut}
                      disabled={!zoomEnabled}
                      accessibilityLabel={r.zoomOut}
                    />
                    <ThemedText
                      variant="body"
                      weight="extrabold"
                      tabular
                      color={zoomEnabled ? theme.colors.text : theme.colors.textFaint}
                      style={styles.zoomReadout}
                    >
                      {`${Math.round(pagesControls.zoom * 100)}%`}
                    </ThemedText>
                    <IconButton
                      icon="add"
                      variant="tonal"
                      size="sm"
                      onPress={pagesControls.onZoomIn}
                      disabled={!zoomEnabled}
                      accessibilityLabel={r.zoomIn}
                    />
                    <PillButton label={r.zoomReset} onPress={pagesControls.onZoomReset} disabled={!zoomEnabled} />
                    <View style={styles.rowSpacer} />
                    <IconButton
                      icon="refresh-outline"
                      variant="tonal"
                      size="sm"
                      onPress={pagesControls.onRotate}
                      accessibilityLabel={r.rotate}
                    />
                  </View>
                </Group>
              )}
              <Group label={r.direction}>
                <ReaderSegments
                  options={[
                    { value: "ltr", label: r.dirLtr },
                    { value: "rtl", label: r.dirRtl },
                  ]}
                  value={prefs.pageDirection}
                  onChange={(value) => prefs.setPageDirection(value as "ltr" | "rtl")}
                />
              </Group>
              <Group label={r.background}>
                <ReaderSegments
                  options={pageBgOptions}
                  value={prefs.pageBackground}
                  onChange={(value) => prefs.setPageBackground(value as ReaderPageBackground)}
                />
              </Group>
            </>
          )}
        </Section>

        {/* ================= Behavior ================= */}
        <Section title={r.sectionBehavior} open={open.behavior} onToggle={() => toggleSection("behavior")}>
          <SwitchRow label={r.keepAwake} value={prefs.keepAwake} onChange={prefs.setKeepAwake} />
          <SwitchRow label={r.autoHideControls} value={prefs.autoHideChrome} onChange={prefs.setAutoHideChrome} />
          <SwitchRow label={r.fullscreen} value={prefs.fullscreen} onChange={prefs.setFullscreen} />
          {mode === "text" && (
            <SwitchRow
              label={r.textSelection}
              hint={r.textSelectionHint}
              value={prefs.textSelection}
              onChange={prefs.setTextSelection}
            />
          )}
        </Section>
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */

interface SectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** The first section has no hairline above it. */
  first?: boolean;
  children: ReactNode;
}

/** Collapsible section — plain conditional render, no LayoutAnimation (RM law). */
function Section({ title, open, onToggle, first, children }: SectionProps) {
  return (
    <View style={!first && styles.sectionRule}>
      <Pressable
        onPress={onToggle}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
      >
        <ThemedText variant="body" weight="extrabold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

/** An overline-labelled control group. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText variant="overline">{label.toUpperCase()}</ThemedText>
      {children}
    </View>
  );
}

/** "Actual size" — a text pill on the raised fill beside the zoom steppers. */
function PillButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.pill,
        pressed && !disabled && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      <ThemedText variant="muted" weight="bold" color={disabled ? theme.colors.textFaint : theme.colors.text} numberOfLines={2}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

interface SwitchRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchLabel}>
        <ThemedText variant="body" weight="semibold">
          {label}
        </ThemedText>
        {hint && (
          <ThemedText variant="label" weight="regular" color={theme.colors.textFaint} style={styles.hint}>
            {hint}
          </ThemedText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.tonalStrong, true: theme.colors.primary }}
        thumbColor={theme.colors.text}
        ios_backgroundColor={theme.colors.tonalStrong}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.lg },
  sectionRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: 52,
  },
  sectionTitle: { flex: 1 },
  sectionBody: { gap: 20, paddingBottom: theme.spacing.md },
  group: { gap: theme.spacing.sm },
  swatchRow: { flexDirection: "row", gap: 10 },
  swatchWrap: { flex: 1, alignItems: "center", gap: 6 },
  swatch: {
    alignSelf: "stretch",
    height: 56,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchIdle: { borderWidth: 1, borderColor: theme.colors.borderStrong },
  swatchSelected: { borderWidth: 2, borderColor: theme.colors.primary },
  swatchGlyph: { fontSize: 18, fontFamily: theme.font.extrabold },
  swatchLabel: { textAlign: "center" },
  presetRow: { flexDirection: "row", gap: theme.spacing.sm },
  presetTile: {
    flex: 1,
    minHeight: theme.layout.minTouch,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  presetIdle: { backgroundColor: theme.colors.surfaceElevated },
  presetSelected: { backgroundColor: theme.colors.primarySoft },
  presetGlyph: { fontFamily: theme.font.extrabold },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, minHeight: theme.layout.minTouch },
  slider: { flex: 1, marginHorizontal: theme.spacing.xs },
  readout: { minWidth: 44, textAlign: "right" },
  zoomRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  zoomReadout: { minWidth: 56, textAlign: "center" },
  rowSpacer: { flex: 1 },
  pill: {
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 14,
    borderRadius: theme.layout.minTouch / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceElevated,
    flexShrink: 1,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 52,
  },
  switchLabel: { flex: 1 },
  hint: { letterSpacing: 0 },
});
