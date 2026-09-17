import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MenuRow, menuListStyle, menuSnapHeight } from "@/components/player/MenuRow";
import { useLanguage } from "@/localization/LanguageProvider";
import { isSameSubtitleTrack, subtitleTrackLabel } from "@/video/subtitleTracks";
import { usePlayerPrefsStore, type SubtitleSize } from "@/store/playerPrefsStore";
import { theme } from "@/theme";
import type { StreamSubtitle } from "@/types/video";

/** Two labelled 44pt controls plus their divider and gaps. */
const STYLE_BLOCK_HEIGHT = 168;

interface Props {
  visible: boolean;
  tracks: StreamSubtitle[];
  /** The subtitle currently displayed — `null` is the "Off" row. */
  value: StreamSubtitle | null;
  onSelect: (track: StreamSubtitle | null) => void;
  onClose: () => void;
}

/**
 * Subtitle picker as a bottom sheet — the shared `MenuRow` idiom, with the
 * selected row filled violet. The rows are the title's own subtitles from the
 * stream response (not the manifest's renditions: the app reads the files
 * itself now), plus a leading "Off". Unlike the speed list this one is
 * data-driven, so the body scrolls rather than overflowing the sheet.
 *
 * Below them sit the caption's appearance settings, exactly as the web player
 * puts size and background at the bottom of its subtitle menu. They are read
 * and written straight from the prefs store rather than drilled through the
 * player screen, the way ReaderSettingsSheet does.
 */
export function SubtitleSheet({ visible, tracks, value, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const subtitleSize = usePlayerPrefsStore((s) => s.subtitleSize);
  const setSubtitleSize = usePlayerPrefsStore((s) => s.setSubtitleSize);
  const subtitleBackground = usePlayerPrefsStore((s) => s.subtitleBackground);
  const setSubtitleBackground = usePlayerPrefsStore((s) => s.setSubtitleBackground);

  const rowCount = tracks.length + 1; // + "Off"
  const snapHeight = menuSnapHeight(rowCount, height, value ? STYLE_BLOCK_HEIGHT : 0);

  const choose = (track: StreamSubtitle | null) => {
    onSelect(track);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.player.subtitles}
      showClose
      snapHeight={snapHeight}
    >
      <ScrollView contentContainerStyle={menuListStyle} showsVerticalScrollIndicator={false}>
        <MenuRow label={t.player.subtitlesOff} selected={value === null} onPress={() => choose(null)} />
        {tracks.map((track, index) => (
          <MenuRow
            // `id` is unique per row, but the index (the subtitle's position in
            // the response) completes the key against a duplicated upload.
            key={`${track.id}-${index}`}
            label={subtitleTrackLabel(track)}
            selected={isSameSubtitleTrack(value, track)}
            onPress={() => choose(track)}
          />
        ))}

        {/* Appearance only matters while something is on screen — with
            subtitles Off these would adjust nothing the viewer can see. */}
        {value && (
          <View style={styles.styleBlock}>
            <View style={styles.group}>
              <ThemedText variant="overline">{t.player.subtitleSize.toUpperCase()}</ThemedText>
              <SegmentedControl
                options={[
                  { value: "small", label: t.player.subtitleSizeSmall },
                  { value: "medium", label: t.player.subtitleSizeMedium },
                  { value: "large", label: t.player.subtitleSizeLarge },
                ]}
                value={subtitleSize}
                onChange={(next) => setSubtitleSize(next as SubtitleSize)}
              />
            </View>

            <View style={styles.group}>
              <ThemedText variant="overline">{t.player.subtitleBackground.toUpperCase()}</ThemedText>
              <SegmentedControl
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
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  styleBlock: {
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  group: { gap: theme.spacing.sm },
});
