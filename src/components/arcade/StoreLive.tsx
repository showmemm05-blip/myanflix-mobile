import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeArt } from "@/components/arcade/ArcadeArt";
import { PulseDot } from "@/components/arcade/ArcadeBadge";
import { ArcadeSection } from "@/components/arcade/ArcadeSection";
import { liveNow } from "@/data/arcade";
import { formatCompactCount } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

/** Main.dc.html: a 120×68 thumbnail, 14pt gaps and an 18pt chevron per row. */
const THUMB_WIDTH = 120;
const ROW_GAP = 14;
const CHEVRON = 18;

/**
 * The widest single word in a game title at 1× in 15pt extra-bold
 * ("Emberfall", "Teahouse": ~73pt), with a little room. When the text column
 * beside the thumbnail is narrower than this at the current text size, the
 * thumbnail moves above the copy, so a title wraps between words instead of
 * breaking inside one (a 320pt phone at 2× has a 122pt column).
 */
const TITLE_WORD_WIDTH = 76;

/**
 * "Live and busy" — the four busiest titles as flat list rows, split by
 * hairlines. The player counts are static editorial figures: they render once
 * and never tick.
 */
export function StoreLive({ onPressGame }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();
  const columnWidth = layout.width - layout.gutter * 2 - THUMB_WIDTH - ROW_GAP * 2 - CHEVRON;
  const stacked = columnWidth < TITLE_WORD_WIDTH * layout.fontScale;

  return (
    <ArcadeSection
      eyebrow={t.arcade.live.kicker}
      title={t.arcade.live.title}
      adornment={<PulseDot color={theme.colors.danger} size={8} ring />}
      bodyGap={6}
      gutter={layout.gutter}
    >
      <View style={{ paddingHorizontal: layout.gutter }}>
        {liveNow.map((game, i) => {
          const count = game.playersOnline !== null ? formatCompactCount(game.playersOnline) : null;
          const event = game.eventKey ? t.arcade.events[game.eventKey] : null;
          const label = [
            game.title,
            t.arcade.badge.live,
            count !== null ? `${count} ${t.arcade.live.playing}` : null,
            event ? `${t.arcade.live.eventLive}, ${event}` : null,
          ]
            .filter(Boolean)
            .join(", ");

          const thumb = (
            <View style={[styles.thumb, stacked && styles.thumbStacked]}>
              <ArcadeArt gameId={game.id} format="landscape" />
              {/* The corner "Live" tag, cut into the thumbnail's top-left. */}
              <View style={styles.liveTag}>
                <PulseDot color={theme.colors.danger} size={5} />
                <ThemedText variant="overline" color={theme.colors.danger} style={styles.liveTagLabel}>
                  {t.arcade.badge.live}
                </ThemedText>
              </View>
            </View>
          );

          return (
            <PressableScale
              key={game.id}
              onPress={onPressGame}
              accessibilityLabel={label}
              style={[styles.row, i > 0 && styles.rowRule]}
            >
              {!stacked && thumb}

              <View style={styles.column}>
                {stacked && thumb}
                <ThemedText variant="body" weight="extrabold">
                  {game.title}
                </ThemedText>
                {count !== null && (
                  <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted}>
                    <ThemedText variant="caption" weight="extrabold" color={theme.colors.text} tabular>
                      {count}
                    </ThemedText>
                    {` ${t.arcade.live.playing}`}
                  </ThemedText>
                )}
                {event && (
                  <ThemedText variant="caption" weight="semibold" color={theme.colors.premium}>
                    {`${t.arcade.live.eventLive} · ${event}`}
                  </ThemedText>
                )}
              </View>

              <Ionicons name="chevron-forward" size={CHEVRON} color={theme.colors.textFaint} />
            </PressableScale>
          );
        })}
      </View>
    </ArcadeSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: 84,
    paddingVertical: theme.spacing.sm,
  },
  /** The board's 1pt white-at-8% rule between rows (none above the first). */
  rowRule: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  thumb: {
    width: THUMB_WIDTH,
    height: 68,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  /** Above the copy at large text: 4pt more than the column's own gap. */
  thumbStacked: { marginBottom: 4 },
  liveTag: {
    position: "absolute",
    top: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 20,
    paddingHorizontal: 7,
    borderBottomRightRadius: 6,
    backgroundColor: theme.colors.artBadge,
  },
  /** 11pt extra-bold, no tracking — the label is translated. */
  liveTagLabel: { letterSpacing: 0 },
  column: { flex: 1, minWidth: 0, gap: 4 },
});
