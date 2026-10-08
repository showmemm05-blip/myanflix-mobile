import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MenuRow, MENU_ROW_HEIGHT, MENU_ROW_HEIGHT_COMPACT } from "@/components/player/MenuRow";
import { SidePanel } from "@/components/player/SidePanel";
import { useLanguage } from "@/localization/LanguageProvider";
import { isSameSubtitleTrack, subtitleTrackLabel } from "@/video/subtitleTracks";
import { usePlayerPrefsStore, type SubtitleSize } from "@/store/playerPrefsStore";
import { theme } from "@/theme";
import type { StreamQuality, StreamSubtitle } from "@/types/video";

export type SettingsTab = "speed" | "quality" | "subtitles";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_TILE_HEIGHT = 56;
const GRID_GAP = 10;

/** Header estimate for the portrait sheet's height: grabber block + the 44pt tabs + rule. */
const SHEET_HEADER_HEIGHT = 8 + 4 + 8 + 44 + 1;
/** The size and background rows under the subtitle list, with their rule and gaps. */
const STYLE_BLOCK_HEIGHT = 12 + 1 + 12 + 44 + 10 + 44;

interface Props {
  /** The tab the control that opened this asked for. */
  initialTab: SettingsTab;
  /** "panel" in fullscreen (the right-side panel), "sheet" in portrait. */
  layout: "panel" | "sheet";
  onClose: () => void;

  speed: number;
  onSelectSpeed: (speed: number) => void;

  /** The title's ladder, best-first — ordered by the backend, never re-sorted here. Empty hides the tab. */
  qualities: StreamQuality[];
  /** The label currently PLAYING, or `null` for the Auto row. */
  qualityValue: string | null;
  onSelectQuality: (label: string | null) => void;

  /** The title's own subtitles from the stream response. Empty hides the tab. */
  tracks: StreamSubtitle[];
  /** The subtitle currently displayed — `null` is the "Off" row. */
  subtitleValue: StreamSubtitle | null;
  onSelectSubtitle: (track: StreamSubtitle | null) => void;
}

/**
 * Playback speed, quality and subtitles in ONE tabbed panel
 * (PlayerSettings.dc.html). The three used to be three separate bottom
 * sheets; the rows, the options and what a pick does are exactly theirs:
 *
 * - Speed: 0.5x–2x as a 3-column grid; the chosen rate is white.
 * - Quality: "Auto" first (the master playlist, the only row that adapts),
 *   then the title's rungs verbatim ("720p"). The tab only exists when the
 *   title has a ladder.
 * - Subtitles: "Off", then the title's tracks; while one is on, the caption's
 *   size and background follow — read and written straight from the prefs
 *   store, as before. The tab only exists when the title has subtitles.
 *
 * Picking a speed, a quality or a track applies it AND closes the panel, as
 * each sheet did. The size/background switches apply without closing.
 *
 * Fullscreen opens it as the board's right-side panel; portrait as a bottom
 * sheet with the same tabs and rows (AREA-NOTES, Player). Either way the body
 * scrolls, so a long ladder or a large text size never pushes rows out of
 * reach — the low rungs a viewer on a weak connection opens this for.
 */
export function PlayerSettingsSheet({
  initialTab,
  layout,
  onClose,
  speed,
  onSelectSpeed,
  qualities,
  qualityValue,
  onSelectQuality,
  tracks,
  subtitleValue,
  onSelectSubtitle,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const subtitleSize = usePlayerPrefsStore((s) => s.subtitleSize);
  const setSubtitleSize = usePlayerPrefsStore((s) => s.setSubtitleSize);
  const subtitleBackground = usePlayerPrefsStore((s) => s.subtitleBackground);
  const setSubtitleBackground = usePlayerPrefsStore((s) => s.setSubtitleBackground);

  const tabs: { key: SettingsTab; label: string }[] = [{ key: "speed", label: t.movie.speed }];
  if (qualities.length > 0) tabs.push({ key: "quality", label: t.player.quality });
  if (tracks.length > 0) tabs.push({ key: "subtitles", label: t.player.subtitles });

  const [tab, setTab] = useState<SettingsTab>(initialTab);
  // A tab the title does not offer (its list arrived empty) falls back to speed.
  const activeTab: SettingsTab = tabs.some((item) => item.key === tab) ? tab : "speed";

  const chooseSpeed = (value: number) => {
    onSelectSpeed(value);
    onClose();
  };
  const chooseQuality = (label: string | null) => {
    onSelectQuality(label);
    onClose();
  };
  const chooseSubtitle = (track: StreamSubtitle | null) => {
    onSelectSubtitle(track);
    onClose();
  };

  const header = (
    <View>
      {layout === "sheet" && <View style={styles.grabber} />}
      <View style={styles.headerRow}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {tabs.map((item) => {
            const selected = item.key === activeTab;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
                style={styles.tab}
              >
                <ThemedText
                  weight="extrabold"
                  color={selected ? theme.colors.text : theme.colors.textFaint}
                  style={styles.tabLabel}
                >
                  {item.label}
                </ThemedText>
                {selected && <View style={styles.tabBar} />}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          style={({ pressed }) => [styles.close, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}
        >
          <View style={styles.closeDisc}>
            <Ionicons name="close" size={18} color={theme.colors.text} />
          </View>
        </Pressable>
      </View>
      <View style={styles.rule} />
    </View>
  );

  const body = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View key={activeTab} entering={reduceMotion ? undefined : FadeIn.duration(200)}>
        {activeTab === "speed" && (
          <View style={styles.speedGrid} accessibilityRole="radiogroup" accessibilityLabel={t.movie.speed}>
            {SPEEDS.map((value) => {
              const selected = value === speed;
              return (
                <Pressable
                  key={value}
                  onPress={() => chooseSpeed(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${value}x`}
                  style={({ pressed }) => [
                    styles.speedTile,
                    selected ? styles.speedTileSelected : styles.speedTileIdle,
                    pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
                  ]}
                >
                  <ThemedText
                    weight="extrabold"
                    tabular
                    color={selected ? theme.colors.onPlay : theme.colors.text}
                    style={styles.speedLabel}
                  >
                    {`${value}x`}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {activeTab === "quality" && (
          <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t.player.quality}>
            <MenuRow
              label={t.player.qualityAuto}
              selected={qualityValue === null}
              onPress={() => chooseQuality(null)}
              tabular
            />
            {qualities.map((option) => (
              <MenuRow
                key={option.label}
                label={option.label}
                selected={option.label === qualityValue}
                onPress={() => chooseQuality(option.label)}
                tabular
              />
            ))}
          </View>
        )}

        {activeTab === "subtitles" && (
          <View>
            <View style={styles.listTight} accessibilityRole="radiogroup" accessibilityLabel={t.player.subtitles}>
              <MenuRow
                label={t.player.subtitlesOff}
                selected={subtitleValue === null}
                onPress={() => chooseSubtitle(null)}
                compact
              />
              {tracks.map((track, index) => (
                <MenuRow
                  // `id` is unique per row, but the index (the subtitle's position in
                  // the response) completes the key against a duplicated upload.
                  key={`${track.id}-${index}`}
                  label={subtitleTrackLabel(track)}
                  selected={isSameSubtitleTrack(subtitleValue, track)}
                  onPress={() => chooseSubtitle(track)}
                  compact
                />
              ))}
            </View>

            {/* Appearance only matters while something is on screen — with
                subtitles Off these would adjust nothing the viewer can see. */}
            {subtitleValue && (
              <View style={styles.styleBlock}>
                <View style={styles.styleRow}>
                  <ThemedText variant="caption" weight="semibold" style={styles.styleLabel}>
                    {t.player.subtitleSize}
                  </ThemedText>
                  <SegmentedControl
                    compact
                    wrap
                    style={styles.styleControl}
                    options={[
                      { value: "small", label: t.player.subtitleSizeSmall },
                      { value: "medium", label: t.player.subtitleSizeMedium },
                      { value: "large", label: t.player.subtitleSizeLarge },
                    ]}
                    value={subtitleSize}
                    onChange={(next) => setSubtitleSize(next as SubtitleSize)}
                  />
                </View>
                <View style={styles.styleRow}>
                  <ThemedText variant="caption" weight="semibold" style={styles.styleLabel}>
                    {t.player.subtitleBackground}
                  </ThemedText>
                  <SegmentedControl
                    compact
                    wrap
                    style={styles.styleControl}
                    // A segmented control rather than a Switch so the website's own
                    // "On"/"Off" wording is what the viewer actually reads.
                    options={[
                      { value: "on", label: t.player.subtitleBackgroundOn },
                      { value: "off", label: t.player.subtitleBackgroundOff },
                    ]}
                    value={subtitleBackground ? "on" : "off"}
                    onChange={(next) => setSubtitleBackground(next === "on")}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );

  if (layout === "panel") {
    return (
      <SidePanel onClose={onClose} accessibilityLabel={t.player.settingsTitle} header={header}>
        {body}
      </SidePanel>
    );
  }

  // Sized for the tallest tab the title offers, so switching tabs never
  // resizes the sheet; capped at 80% of the window, past which the body scrolls.
  const speedBody = 20 + SPEED_TILE_HEIGHT * 2 + GRID_GAP;
  const qualityBody = qualities.length > 0 ? 12 + (qualities.length + 1) * (MENU_ROW_HEIGHT + 4) : 0;
  const subtitleBody =
    tracks.length > 0
      ? 12 + (tracks.length + 1) * (MENU_ROW_HEIGHT_COMPACT + 2) + (subtitleValue ? STYLE_BLOCK_HEIGHT : 0)
      : 0;
  const bodyHeight = Math.max(speedBody, qualityBody, subtitleBody) + theme.spacing.lg;
  const snapHeight = Math.min(
    SHEET_HEADER_HEIGHT + bodyHeight + Math.max(insets.bottom, theme.spacing.md),
    windowHeight * 0.8,
  );

  return (
    <BottomSheet visible onClose={onClose} header={header} snapHeight={snapHeight}>
      {body}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /** DesignSystem: 36×4, white at 24% — the sheet's own grabber, replaced by this header. */
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.grabber,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  // Tabs wrap rather than truncate: three long Burmese labels in a narrow panel take two lines.
  tabs: { flexDirection: "row", flexWrap: "wrap", columnGap: theme.spacing.md, flexShrink: 1 },
  tab: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingBottom: 4 },
  tabLabel: { fontSize: 14 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  close: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  closeDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
  rule: { height: 1, marginTop: 4, backgroundColor: theme.colors.border },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: theme.spacing.md },
  speedGrid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginTop: 20 },
  speedTile: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: SPEED_TILE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
  },
  speedTileIdle: { backgroundColor: theme.colors.surfaceElevated },
  speedTileSelected: { backgroundColor: theme.colors.play },
  speedLabel: { fontSize: 17 },
  list: { gap: 4, marginTop: 12 },
  listTight: { gap: 2, marginTop: 12 },
  styleBlock: {
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  // The label and its switch share a row while they fit; a long Burmese label
  // or a large text size drops the switch onto its own line instead of
  // truncating either.
  styleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: theme.layout.minTouch,
  },
  styleLabel: { flexShrink: 1 },
  styleControl: { flexGrow: 1, maxWidth: 240, minWidth: 180 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.72 },
});
