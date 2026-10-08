import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeSection } from "@/components/arcade/ArcadeSection";
import { EXPLORE_LANES, type LaneId } from "@/data/arcade";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** The screen owns navigation — film/series/book/music each link straight in. */
  onPressLane: (id: LaneId) => void;
}

const COLUMN_GAP = 16;
const ROW_GAP = 10;

/**
 * The quietest section: movies, series, books and music as a 2×2 grid of
 * raised tiles at the foot of the storefront — each with its icon, its name
 * and its verb (Watch / Read / Listen). A lane still in preview wears a
 * "Preview" chip where the others show a chevron. Every tile links straight
 * into its catalog surface.
 */
export function StoreExploreMore({ onPressLane }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();

  // Two across on a phone (the board), all four in one row on a wide screen.
  const columns = layout.isWide ? 4 : 2;
  const tileWidth =
    (layout.width - layout.gutter * 2 - COLUMN_GAP * (columns - 1)) / columns;

  return (
    <ArcadeSection eyebrow={t.arcade.explore.kicker} title={t.arcade.explore.title} gutter={layout.gutter}>
      <View style={[styles.grid, { paddingHorizontal: layout.gutter }]}>
        {EXPLORE_LANES.map((lane) => {
          const name = t.arcade.lanes[lane.id];
          const verb = t.arcade.verbs[lane.verb];
          const preview = lane.state === "preview";
          return (
            <PressableScale
              key={lane.id}
              onPress={() => onPressLane(lane.id)}
              accessibilityLabel={[name, verb, preview ? t.arcade.state.preview : null].filter(Boolean).join(", ")}
              style={[styles.tile, { width: tileWidth }]}
            >
              <View style={styles.tileTop}>
                <Ionicons name={lane.icon} size={24} color={theme.colors.link} />
                {preview ? (
                  <View style={styles.previewChip}>
                    <ThemedText variant="label" weight="bold" color={theme.colors.textBody} style={styles.chipLabel}>
                      {t.arcade.state.preview}
                    </ThemedText>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
                )}
              </View>
              <View>
                <ThemedText weight="extrabold" style={styles.name}>
                  {name}
                </ThemedText>
                <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
                  {verb}
                </ThemedText>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </ArcadeSection>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: COLUMN_GAP,
    rowGap: ROW_GAP,
  },
  tile: {
    minHeight: 104,
    padding: 14,
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  previewChip: {
    flexShrink: 1,
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: withAlpha(theme.colors.text, 0.1),
  },
  chipLabel: { letterSpacing: 0 },
  /** 17pt extra-bold lane name. */
  name: { fontSize: 17 },
});
