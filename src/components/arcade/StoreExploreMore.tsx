import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pill } from "@/components/ui/Pill";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionRule } from "@/components/arcade/SectionRule";
import { EXPLORE_LANES, type LaneId } from "@/data/arcade";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  /** The screen owns navigation — film/series/book/music each link straight in. */
  onPressLane: (id: LaneId) => void;
}

/**
 * The quietest section: movies, series, books and music demoted to a small
 * explore strip at the foot of the storefront. Mobile is always authed, so
 * every row links straight into its catalog surface.
 */
export function StoreExploreMore({ onPressLane }: Props) {
  const { t } = useLanguage();

  return (
    <SectionRule>
      <SectionHeader eyebrow={t.arcade.explore.kicker} title={t.arcade.explore.title} />
      <View style={styles.list}>
        {EXPLORE_LANES.map((lane) => (
          <PressableScale
            key={lane.id}
            onPress={() => onPressLane(lane.id)}
            accessibilityLabel={t.arcade.lanes[lane.id]}
          >
            <Surface tone="flat" radius="xl" style={styles.row}>
              <View style={styles.iconTile}>
                <Ionicons name={lane.icon} size={18} color={theme.colors.primary} />
              </View>
              <ThemedText variant="body" style={styles.name} numberOfLines={1}>
                {t.arcade.lanes[lane.id]}
              </ThemedText>
              {lane.state === "preview" && <Pill tone="neutral">{t.arcade.state.preview}</Pill>}
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
        ))}
      </View>
    </SectionRule>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: theme.layout.minTouch + 8,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1 },
});
