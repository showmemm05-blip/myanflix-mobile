import { useWindowDimensions } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EpisodesSection } from "@/components/player/EpisodesSection";
import { useLanguage } from "@/localization/LanguageProvider";

interface Props {
  visible: boolean;
  onClose: () => void;
  seriesId: string;
  currentEpisodeId: string;
  onSelectEpisode: (episodeId: string) => void;
}

/**
 * Episode picker as a bottom sheet, so episode navigation stays reachable from
 * fullscreen. It renders the same `EpisodesSection` list (same query, same
 * cache) — selecting an episode closes the sheet and hands off unchanged.
 */
export function EpisodeSheet({ visible, onClose, seriesId, currentEpisodeId, onSelectEpisode }: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.series.episodesTitle}
      showClose
      snapHeight={height * 0.8}
    >
      {visible && (
        <EpisodesSection
          seriesId={seriesId}
          currentEpisodeId={currentEpisodeId}
          onSelectEpisode={(episodeId) => {
            onClose();
            onSelectEpisode(episodeId);
          }}
          hideHeader
        />
      )}
    </BottomSheet>
  );
}
