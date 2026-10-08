import { memo, useCallback } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { EpisodeBrowser } from "@/components/player/EpisodeBrowser";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/**
 * Portrait sheet height: the header, the season chips, one rail of 232×130
 * cards with a two-line title and its meta line, and air. Capped at 80% of
 * the window; past that the body scrolls.
 */
const SHEET_CONTENT_HEIGHT = 76 + 58 + 14 + 130 + 10 + 48 + 18 + 24;

interface Props {
  visible: boolean;
  onClose: () => void;
  seriesId: string;
  currentEpisodeId: string;
  onSelectEpisode: (episodeId: string) => void;
  /** Fullscreen opens the board's full-width overlay; portrait a bottom sheet. */
  isFullscreen: boolean;
}

/**
 * The episode picker reachable from the controls, so episode navigation works
 * from fullscreen too. Same query, same cache and the same select handler as
 * the rail under the video — selecting an episode closes the picker and hands
 * off unchanged.
 *
 * FULLSCREEN (PlayerEpisodes.dc.html): a full-width dark overlay over the
 * picture — "Episodes", Close, the season chips and a rail of large cards.
 * PORTRAIT: the same chips and rail in a bottom sheet (AREA-NOTES: the
 * portrait sheet carries the same rows).
 *
 * Memoised: it is rendered (closed) for every series while the player ticks
 * 4×/s, and Player passes it stable props, so it only re-renders when it
 * opens, closes, or the episode changes.
 */
export const EpisodeSheet = memo(function EpisodeSheet({ visible, onClose, seriesId, currentEpisodeId, onSelectEpisode, isFullscreen }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const handleSelect = useCallback(
    (episodeId: string) => {
      onClose();
      onSelectEpisode(episodeId);
    },
    [onClose, onSelectEpisode],
  );

  if (isFullscreen) {
    if (!visible) return null;
    const sideStart = Math.max(44, insets.left);
    const sideEnd = Math.max(36, insets.right);
    return (
      <Modal
        visible
        transparent
        animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={onClose}
        // iOS pins a modal to portrait unless told otherwise; this one opens
        // over the landscape player.
        supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={[StyleSheet.absoluteFill, styles.overlay]} accessibilityViewIsModal>
          <ScrollView
            contentContainerStyle={{ paddingTop: 14 + insets.top, paddingBottom: 16 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.overlayHeader, { paddingLeft: sideStart, paddingRight: sideEnd }]}>
              <ThemedText variant="title" accessibilityRole="header" style={styles.overlayTitle}>
                {t.series.episodesTitle}
              </ThemedText>
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
            <EpisodeBrowser
              seriesId={seriesId}
              currentEpisodeId={currentEpisodeId}
              onSelectEpisode={handleSelect}
              size="large"
              inset={sideStart}
            />
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.series.episodesTitle}
      showClose
      snapHeight={Math.min(SHEET_CONTENT_HEIGHT + Math.max(insets.bottom, theme.spacing.md), height * 0.8)}
    >
      {visible && (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetBody}>
          <EpisodeBrowser
            seriesId={seriesId}
            currentEpisodeId={currentEpisodeId}
            onSelectEpisode={handleSelect}
            size="regular"
            inset={theme.layout.screenPadding}
          />
        </ScrollView>
      )}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  overlay: { backgroundColor: "rgba(8,8,11,0.92)" },
  overlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overlayTitle: { flexShrink: 1 },
  close: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  closeDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
  // The sheet pads its body by the page margin; the rail runs edge to edge
  // and carries that margin itself, so the first card still lines up.
  sheetBody: { marginHorizontal: -theme.layout.screenPadding },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.72 },
});
