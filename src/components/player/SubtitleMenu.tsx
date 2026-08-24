import { Pressable, ScrollView, View, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SubtitleTrack } from "expo-video";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLanguage } from "@/localization/LanguageProvider";
import { isSameSubtitleTrack, subtitleTrackLabel } from "@/video/subtitleTracks";
import { theme } from "@/theme";

const ROW_HEIGHT = 52;

interface Props {
  visible: boolean;
  tracks: SubtitleTrack[];
  /** The rendition currently displayed — `null` is the "Off" row. */
  value: SubtitleTrack | null;
  onSelect: (track: SubtitleTrack | null) => void;
  onClose: () => void;
}

/**
 * Subtitle picker as a bottom sheet — same idiom as `SpeedMenu`, with the
 * selected row filled violet. The rows come from the HLS renditions the player
 * found in the manifest, plus a leading "Off". Unlike the speed list this one
 * is data-driven, so the body scrolls rather than overflowing the sheet.
 */
export function SubtitleMenu({ visible, tracks, value, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();

  const rowCount = tracks.length + 1; // + "Off"
  const snapHeight = Math.min(rowCount * (ROW_HEIGHT + theme.spacing.sm) + 140, height * 0.8);

  const choose = (track: SubtitleTrack | null) => {
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
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Row label={t.player.subtitlesOff} selected={value === null} onPress={() => choose(null)} />
        {tracks.map((track, index) => (
          <Row
            // `id` is Android-only and can repeat/blank elsewhere, so the index
            // (the track's position in the manifest) completes the key.
            key={`${track.id}-${track.language}-${index}`}
            label={subtitleTrackLabel(track)}
            selected={isSameSubtitleTrack(value, track)}
            onPress={() => choose(track)}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

interface RowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Row({ label, selected, onPress }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <ThemedText
        variant="body"
        weight={selected ? "bold" : "regular"}
        numberOfLines={1}
        style={[styles.label, selected ? styles.labelSelected : undefined]}
      >
        {label}
      </ThemedText>
      {selected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary + "3D" },
  rowPressed: { opacity: 0.75 },
  // A long track name must truncate instead of pushing the checkmark out of
  // the row: in a row `flexShrink` is horizontal, and it is 0 by default.
  label: { flexShrink: 1 },
  labelSelected: { color: theme.colors.primary },
});
