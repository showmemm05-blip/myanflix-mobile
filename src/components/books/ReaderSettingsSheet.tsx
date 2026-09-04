import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Slider } from "@/components/ui/Slider";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
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
import { PAGE_BACKGROUND_COLOR } from "@/store/readerPrefsStore";
import { READER_THEMES, THEME_ORDER } from "@/components/books/readerThemes";
import { theme } from "@/theme";

/** Zoom/rotation live in per-book view memory, not global prefs — the page
 *  reader passes its own handlers and the rows render only when it does. */
export interface ReaderPagesControls {
  /** Multiplier over the fitted size (1–3). */
  zoom: number;
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
/** Visual "A" sizes for the four preset chips. */
const SIZE_PRESET_GLYPH: Record<(typeof SIZE_PRESET_ORDER)[number], number> = { s: 13, m: 16, l: 19, xl: 23 };
const PAGE_BG_ORDER: ReaderPageBackground[] = ["theme", "black", "gray", "white"];

/**
 * The one settings surface both readers share — three collapsible sections
 * (Appearance open by default; expansion is plain state, never persisted).
 * Writes readerPrefsStore; sliders commit ONCE on release, not per frame.
 */
export function ReaderSettingsSheet({ visible, onClose, mode: rawMode, pagesControls }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const mode: "text" | "pages" = rawMode === "text" ? "text" : "pages";

  const prefs = useReaderPrefsStore();

  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    appearance: true,
    layout: false,
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
  const pageBgLabels: Record<ReaderPageBackground, string> = {
    theme: r.bgTheme,
    black: r.bgBlack,
    gray: r.bgGray,
    white: r.bgWhite,
  };

  // "Fit height" is meaningless while the list scrolls vertically.
  const fitOptions = [
    { value: "width", label: r.fitWidth },
    ...(prefs.pageMode === "scroll" ? [] : [{ value: "height", label: r.fitHeight }]),
    { value: "screen", label: r.fitScreen },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={r.settingsTitle} showClose snapHeight={560}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ================= Appearance ================= */}
        <Section title={r.sectionAppearance} open={open.appearance} onToggle={() => toggleSection("appearance")}>
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
                    <Text style={[styles.swatchGlyph, { color: swatch.ink }]}>Aa</Text>
                  </View>
                  <ThemedText
                    variant="caption"
                    color={selected ? theme.colors.primary : theme.colors.textMuted}
                    numberOfLines={1}
                  >
                    {themeLabels[value]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {mode === "text" && (
            <View style={styles.group}>
              <ThemedText variant="overline">{r.fontFamily.toUpperCase()}</ThemedText>
              <SegmentedControl
                options={fontOptions}
                value={prefs.fontFamily}
                onChange={(value) => prefs.setFontFamily(value as ReaderFontFamily)}
              />
            </View>
          )}

          {mode === "text" && (
            <View style={styles.group}>
              <ThemedText variant="overline">{r.textSize.toUpperCase()}</ThemedText>
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
                      style={[styles.presetChip, selected ? styles.presetSelected : styles.presetIdle]}
                    >
                      <Text
                        style={[
                          styles.presetGlyph,
                          { fontSize: SIZE_PRESET_GLYPH[preset] },
                          { color: selected ? theme.colors.primary : theme.colors.textMuted },
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
                <ThemedText variant="caption" tabular style={styles.readout}>
                  {`${Math.round(shownScale * 100)}%`}
                </ThemedText>
              </View>
            </View>
          )}

          <View style={styles.group}>
            <ThemedText variant="overline">{r.brightness.toUpperCase()}</ThemedText>
            <View style={styles.sliderRow}>
              <Ionicons name="moon-outline" size={16} color={theme.colors.textMuted} />
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
              <Ionicons name="sunny-outline" size={16} color={theme.colors.textMuted} />
              <ThemedText variant="caption" tabular style={styles.readout}>
                {`${Math.round(shownBrightness * 100)}%`}
              </ThemedText>
            </View>
          </View>
        </Section>

        {/* ================= Layout (text) / Page (pages) ================= */}
        <Section
          title={mode === "text" ? r.sectionLayout : r.sectionPage}
          open={open.layout}
          onToggle={() => toggleSection("layout")}
        >
          {mode === "text" ? (
            <>
              <ChipGroup
                label={r.lineSpacing}
                options={lineOptions}
                value={prefs.lineHeight}
                onChange={(value) => prefs.setLineHeight(value as ReaderLineHeight)}
              />
              <ChipGroup
                label={r.readingWidth}
                options={widthOptions}
                value={prefs.width}
                onChange={(value) => prefs.setWidth(value as ReaderWidth)}
              />
              <ChipGroup
                label={r.margins}
                options={marginOptions}
                value={prefs.margins}
                onChange={(value) => prefs.setMargins(value as ReaderMargins)}
              />
              <View style={styles.group}>
                <ThemedText variant="overline">{r.alignment.toUpperCase()}</ThemedText>
                <SegmentedControl
                  options={[
                    { value: "justify", label: r.alignJustify },
                    { value: "left", label: r.alignLeft },
                  ]}
                  value={prefs.textAlign}
                  onChange={(value) => prefs.setTextAlign(value as "justify" | "left")}
                />
              </View>
              <SwitchRow
                label={r.chapterTitleToggle}
                value={prefs.showChapterTitle}
                onChange={prefs.setShowChapterTitle}
              />
            </>
          ) : (
            <>
              <View style={styles.group}>
                <ThemedText variant="overline">{r.pageLayout.toUpperCase()}</ThemedText>
                <SegmentedControl
                  options={[
                    { value: "single", label: r.layoutSingle },
                    { value: "double", label: r.layoutDouble },
                    { value: "scroll", label: r.layoutScroll },
                  ]}
                  value={prefs.pageMode}
                  onChange={(value) => prefs.setPageMode(value as "scroll" | "single" | "double")}
                />
              </View>
              <View style={styles.group}>
                <SegmentedControl
                  options={fitOptions}
                  value={prefs.fitMode === "height" && prefs.pageMode === "scroll" ? "width" : prefs.fitMode}
                  onChange={(value) => prefs.setFitMode(value as "width" | "height" | "screen")}
                />
              </View>
              {pagesControls && (
                <View style={styles.group}>
                  <ThemedText variant="overline">{r.zoom.toUpperCase()}</ThemedText>
                  <View style={styles.sliderRow}>
                    <IconButton
                      icon="remove"
                      variant="outline"
                      size="sm"
                      onPress={pagesControls.onZoomOut}
                      accessibilityLabel={r.zoomOut}
                    />
                    <ThemedText variant="section" tabular style={styles.readout}>
                      {`${Math.round(pagesControls.zoom * 100)}%`}
                    </ThemedText>
                    <IconButton
                      icon="add"
                      variant="outline"
                      size="sm"
                      onPress={pagesControls.onZoomIn}
                      accessibilityLabel={r.zoomIn}
                    />
                    <View style={styles.rowSpacer} />
                    <IconButton
                      icon="contract-outline"
                      variant="ghost"
                      size="sm"
                      onPress={pagesControls.onZoomReset}
                      accessibilityLabel={r.zoomReset}
                    />
                    <IconButton
                      icon="refresh-outline"
                      variant="ghost"
                      size="sm"
                      onPress={pagesControls.onRotate}
                      accessibilityLabel={r.rotate}
                    />
                  </View>
                </View>
              )}
              <View style={styles.group}>
                <ThemedText variant="overline">{r.direction.toUpperCase()}</ThemedText>
                <SegmentedControl
                  options={[
                    { value: "ltr", label: r.dirLtr },
                    { value: "rtl", label: r.dirRtl },
                  ]}
                  value={prefs.pageDirection}
                  onChange={(value) => prefs.setPageDirection(value as "ltr" | "rtl")}
                />
              </View>
              <View style={styles.group}>
                <ThemedText variant="overline">{r.background.toUpperCase()}</ThemedText>
                <View style={styles.swatchRow}>
                  {PAGE_BG_ORDER.map((value) => {
                    const selected = prefs.pageBackground === value;
                    const fill = PAGE_BACKGROUND_COLOR[value] ?? READER_THEMES[prefs.readerTheme].bg;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => prefs.setPageBackground(value)}
                        accessibilityRole="button"
                        accessibilityLabel={pageBgLabels[value]}
                        accessibilityState={{ selected }}
                        style={styles.swatchWrap}
                      >
                        <View
                          style={[
                            styles.swatch,
                            { backgroundColor: fill },
                            selected ? styles.swatchSelected : styles.swatchIdle,
                          ]}
                        />
                        <ThemedText
                          variant="caption"
                          color={selected ? theme.colors.primary : theme.colors.textMuted}
                          numberOfLines={1}
                        >
                          {pageBgLabels[value]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
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
  children: ReactNode;
}

/** Collapsible section — plain conditional render, no LayoutAnimation (RM law). */
function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
      >
        <ThemedText variant="section">{title}</ThemedText>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

interface ChipGroupProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

function ChipGroup({ label, options, value, onChange }: ChipGroupProps) {
  return (
    <View style={styles.group}>
      <ThemedText variant="overline">{label.toUpperCase()}</ThemedText>
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
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
        <ThemedText variant="body">{label}</ThemedText>
        {hint && <ThemedText variant="caption">{hint}</ThemedText>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.surfaceSunken, true: theme.colors.primary }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.lg, gap: theme.spacing.sm },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: theme.layout.minTouch,
  },
  sectionBody: { gap: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  group: { gap: theme.spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  swatchRow: { flexDirection: "row", gap: theme.spacing.md },
  swatchWrap: { alignItems: "center", gap: theme.spacing.xs, flex: 1 },
  swatch: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchIdle: { borderWidth: 1, borderColor: theme.colors.borderStrong },
  swatchSelected: { borderWidth: 2, borderColor: theme.colors.primary },
  swatchGlyph: { fontSize: 15, fontFamily: theme.font.semibold },
  presetRow: { flexDirection: "row", gap: theme.spacing.sm },
  presetChip: {
    flex: 1,
    minHeight: theme.layout.minTouch,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetIdle: { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
  presetSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary },
  presetGlyph: { fontFamily: theme.font.semibold },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  slider: { flex: 1 },
  readout: { minWidth: 48, textAlign: "center" },
  rowSpacer: { flex: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    minHeight: theme.layout.minTouch,
  },
  switchLabel: { flex: 1, gap: 2 },
});
