import { StyleSheet, View } from "react-native";
import { GamePlate } from "@/components/common/GamePlate";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeBadge, PulseDot } from "@/components/arcade/ArcadeBadge";
import { SectionRule } from "@/components/arcade/SectionRule";
import { SlugText } from "@/components/arcade/SlugText";
import { liveNow } from "@/data/arcade";
import { PLATE_PALETTES, formatCompactCount } from "@/data/games";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

/**
 * "Live and busy" — the four busiest titles as quiet list rows. The player
 * counts are static editorial figures: they render once and never tick.
 */
export function StoreLive({ onPressGame }: Props) {
  const { t } = useLanguage();

  return (
    <SectionRule>
      <SectionHeader
        eyebrow={t.arcade.live.kicker}
        title={t.arcade.live.title}
        accessory={<PulseDot color={theme.colors.danger} />}
      />

      <View style={styles.list}>
        {liveNow.map((game) => (
          <PressableScale key={game.id} onPress={onPressGame} accessibilityLabel={game.title}>
            <Surface tone="flat" radius="xl" style={styles.row}>
              <GamePlate
                palette={PLATE_PALETTES[game.id]}
                radius="lg"
                scrim={false}
                style={styles.thumb}
              />
              <View style={styles.column}>
                <ThemedText variant="body" weight="semibold" numberOfLines={1}>
                  {game.title}
                </ThemedText>
                <View style={styles.metaRow}>
                  <ArcadeBadge kind="live" />
                  {game.playersOnline !== null && (
                    <SlugText>{formatCompactCount(game.playersOnline)}</SlugText>
                  )}
                  <ThemedText variant="caption" color={theme.colors.textMuted}>
                    {t.arcade.live.playing}
                  </ThemedText>
                </View>
                {game.eventKey && (
                  <ThemedText variant="caption" color={theme.colors.premium} numberOfLines={1}>
                    {`${t.arcade.live.eventLive} · ${t.arcade.events[game.eventKey]}`}
                  </ThemedText>
                )}
              </View>
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
    padding: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
  },
  thumb: { width: 112, aspectRatio: 16 / 9 },
  column: { flex: 1, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
});
