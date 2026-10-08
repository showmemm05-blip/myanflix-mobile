import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeArt } from "@/components/arcade/ArcadeArt";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { ArcadeCta } from "@/components/arcade/ArcadeCta";
import { ArcadePrice, priceLabel } from "@/components/arcade/ArcadePrice";
import { ArcadeSection } from "@/components/arcade/ArcadeSection";
import { FreeTag } from "@/components/arcade/FreeTag";
import { promos } from "@/data/arcade";
import { formatCompactCount } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

interface Props {
  onPressGame: () => void;
}

const GROUND = theme.colors.background;
/** Banner scrim (Main.dc.html): clear → 78% → 94%. */
const BANNER_SCRIM = [withAlpha(GROUND, 0), withAlpha(GROUND, 0.78), withAlpha(GROUND, 0.94)] as const;
/** Duo scrim: clear → 85% → 95%. */
const DUO_SCRIM = [withAlpha(GROUND, 0), withAlpha(GROUND, 0.85), withAlpha(GROUND, 0.95)] as const;
const BANNER_STOPS = [0, 0.45, 1] as const;
const DUO_STOPS = [0, 0.55, 1] as const;

const DUO_GAP = 16;

/**
 * The Coming-soon title set in the art is decoration (the real title follows
 * on the page). Like Featured's, it stops growing at 2×, where the widest
 * catalogue word still fits a 320pt phone's column without breaking mid-word.
 */
const ART_TITLE_MAX_SCALE = 2;

/**
 * The spotlights. Honesty rules carried over from the web verbatim: the Coming
 * Soon spotlight is NOT pressable and carries NO CTA and NO countdown — just
 * the expected year in translated copy. The new-release banner is the only
 * promo that shows a call to action.
 *
 * Each banner's scrim hangs off its COPY block (it starts a little above the
 * copy and runs to the card's bottom edge), so at 2× text, where the copy
 * grows, the dark ground grows with it instead of leaving words on bright art.
 */
export function StorePromos({ onPressGame }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();

  const { newRelease, comingSoon, freeToPlay, limitedEvent } = promos;

  const contentWidth = layout.width - layout.gutter * 2;
  // The board's 358×268 banner; on a tablet it stops growing at 440.
  const bannerMinHeight = Math.min(contentWidth * (268 / 358), 440);
  // Two 171×214 cards share a row on the board. They stack only when the
  // OS text size makes a half-width card too narrow for its copy.
  const duoWidth = (contentWidth - DUO_GAP) / 2;
  const duoStacked = !layout.isWide && duoWidth < 130 * layout.fontScale;
  const duoMinHeight = duoStacked
    ? contentWidth * (10 / 16)
    : layout.isWide
      ? duoWidth * (10 / 16)
      : duoWidth * (214 / 171);

  const newPrice = priceLabel(newRelease, t.arcade.price.free);
  const newReleaseLabel = [t.arcade.promos.newRelease, newRelease.title, newPrice, t.arcade.hero.explore]
    .filter(Boolean)
    .join(", ");

  const playingLabel =
    freeToPlay.playersOnline !== null
      ? `${formatCompactCount(freeToPlay.playersOnline)} ${t.arcade.live.playing}`
      : null;
  const freeLabel = [t.arcade.promos.freeToPlay, freeToPlay.title, t.arcade.price.free, playingLabel]
    .filter(Boolean)
    .join(", ");

  const eventLabel = limitedEvent.eventKey ? t.arcade.events[limitedEvent.eventKey] : null;
  const limitedLabel = [t.arcade.promos.limitedEvent, limitedEvent.title, eventLabel, t.arcade.badge.limited]
    .filter(Boolean)
    .join(", ");

  return (
    <ArcadeSection eyebrow={t.arcade.promos.kicker} title={t.arcade.promos.title} gutter={layout.gutter}>
      <View style={[styles.stack, { paddingHorizontal: layout.gutter }]}>
        {/* 1 — New release: the whole banner is the one button; the CTA is its look. */}
        <PressableScale onPress={onPressGame} accessibilityLabel={newReleaseLabel}>
          <View style={[styles.banner, { minHeight: bannerMinHeight }]}>
            <ArcadeArt gameId={newRelease.id} format="landscape" halo />
            <View style={styles.bannerCopy}>
              <LinearGradient
                pointerEvents="none"
                colors={BANNER_SCRIM}
                locations={BANNER_STOPS}
                style={styles.bannerScrim}
              />
              <View style={styles.badgeRow}>
                <ArcadeBadge kind="new" />
                <ThemedText variant="caption" weight="extrabold" color={theme.colors.link} style={styles.shrink}>
                  {t.arcade.promos.newRelease}
                </ThemedText>
              </View>
              <ThemedText variant="title" style={styles.bannerTitle}>
                {newRelease.title}
              </ThemedText>
              <ThemedText variant="muted" color={theme.colors.textBody} numberOfLines={2} style={styles.bannerBody}>
                {t.arcade.gameCopy[newRelease.descriptionKey]}
              </ThemedText>
              <View style={styles.bannerFoot}>
                <ArcadeCta variant="play" icon="play" size="sm" title={t.arcade.hero.explore} />
                <ArcadePrice game={newRelease} size="lg" />
              </View>
            </View>
          </View>
        </PressableScale>

        {/* 2 — Coming soon: not pressable, no CTA, no countdown. */}
        <View>
          <View style={styles.soonArt}>
            <ArcadeArt gameId={comingSoon.id} format="landscape" dimmed />
            <ThemedText
              weight="black"
              maxFontSizeMultiplier={ART_TITLE_MAX_SCALE}
              style={[styles.artTitle, styles.soonArtTitle]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {comingSoon.title}
            </ThemedText>
          </View>
          <View style={styles.soonCopy}>
            <ArcadeBadge kind="comingSoon" surface="tint" />
            <ThemedText variant="title" style={styles.soonTitle}>
              {comingSoon.title}
            </ThemedText>
            <ThemedText variant="muted" color={theme.colors.textMuted} numberOfLines={2} style={styles.bannerBody}>
              {t.arcade.gameCopy[comingSoon.descriptionKey]}
            </ThemedText>
            <ThemedText variant="caption" weight="bold" color={theme.colors.textBody} tabular style={styles.expected}>
              {t.arcade.promos.expected.replace("{year}", String(comingSoon.releaseYear))}
            </ThemedText>
          </View>
        </View>

        {/* 3 — The duo: free-to-play and the limited-time event. */}
        <View style={[styles.duoRow, duoStacked && styles.duoStacked]}>
          <PressableScale
            onPress={onPressGame}
            accessibilityLabel={freeLabel}
            style={duoStacked ? undefined : styles.duoCell}
          >
            <View style={[styles.duoCard, { minHeight: duoMinHeight }]}>
              <ArcadeArt gameId={freeToPlay.id} format="poster" />
              <View style={styles.duoCopy}>
                <LinearGradient pointerEvents="none" colors={DUO_SCRIM} locations={DUO_STOPS} style={styles.duoScrim} />
                <ThemedText variant="caption" weight="extrabold" color={theme.colors.finance}>
                  {t.arcade.promos.freeToPlay}
                </ThemedText>
                <ThemedText variant="section" style={styles.duoTitle}>
                  {freeToPlay.title}
                </ThemedText>
                <View style={styles.duoMeta}>
                  <FreeTag />
                  {freeToPlay.playersOnline !== null && (
                    <ThemedText variant="caption" weight="regular" color={theme.colors.textBody}>
                      <ThemedText variant="caption" weight="extrabold" color={theme.colors.text} tabular>
                        {formatCompactCount(freeToPlay.playersOnline)}
                      </ThemedText>
                      {` ${t.arcade.live.playing}`}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          </PressableScale>

          <PressableScale
            onPress={onPressGame}
            accessibilityLabel={limitedLabel}
            style={duoStacked ? undefined : styles.duoCell}
          >
            <View style={[styles.duoCard, { minHeight: duoMinHeight }]}>
              <ArcadeArt gameId={limitedEvent.id} format="poster" />
              <View style={styles.duoCopy}>
                <LinearGradient pointerEvents="none" colors={DUO_SCRIM} locations={DUO_STOPS} style={styles.duoScrim} />
                <ThemedText variant="caption" weight="extrabold" color={theme.colors.premium}>
                  {t.arcade.promos.limitedEvent}
                </ThemedText>
                <ThemedText variant="section" style={styles.duoTitle}>
                  {limitedEvent.title}
                </ThemedText>
                <View style={styles.duoMeta}>
                  {eventLabel && (
                    <ThemedText variant="caption" weight="bold" color={theme.colors.premium}>
                      {eventLabel}
                    </ThemedText>
                  )}
                  <ArcadeBadge kind="limited" surface="tint" compact />
                </View>
              </View>
            </View>
          </PressableScale>
        </View>
      </View>
    </ArcadeSection>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  banner: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  bannerCopy: { padding: theme.spacing.md },
  /** From 18pt above the copy to the banner's edges (the copy's 16pt padding is undone). */
  bannerScrim: { position: "absolute", top: -18, left: 0, right: 0, bottom: 0 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
  shrink: { flexShrink: 1 },
  bannerTitle: { marginTop: 10 },
  bannerBody: { marginTop: 4 },
  bannerFoot: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
  },
  soonArt: {
    aspectRatio: 358 / 160,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  /** 22/23 black capitals set in the art — titles stay Latin in both languages. */
  artTitle: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 13,
    fontSize: 22,
    lineHeight: 23,
    letterSpacing: -0.44,
    textTransform: "uppercase",
  },
  soonArtTitle: { color: withAlpha(theme.colors.text, 0.72) },
  soonCopy: { paddingTop: 14 },
  soonTitle: { marginTop: theme.spacing.sm },
  expected: { marginTop: 6 },
  duoRow: { flexDirection: "row", gap: DUO_GAP },
  duoStacked: { flexDirection: "column", gap: 20 },
  duoCell: { flex: 1 },
  duoCard: {
    flexGrow: 1,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  duoCopy: { padding: 12 },
  duoScrim: { position: "absolute", top: -64, left: 0, right: 0, bottom: 0 },
  duoTitle: { marginTop: 2 },
  duoMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: theme.spacing.sm,
  },
});
