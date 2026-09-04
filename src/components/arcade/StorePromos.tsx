import { StyleSheet, View } from "react-native";
import { GamePlate } from "@/components/common/GamePlate";
import { Button } from "@/components/ui/Button";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { FreeTag } from "@/components/arcade/FreeTag";
import { SectionRule } from "@/components/arcade/SectionRule";
import { SlugText } from "@/components/arcade/SlugText";
import { promos } from "@/data/arcade";
import { PLATE_PALETTES, formatCompactCount, formatKyat } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

/**
 * The three promo banners. Honesty rules carried over from the web verbatim:
 * the Coming Soon banner is NOT pressable and carries NO CTA and NO countdown
 * — just the expected year in translated copy. The new-release banner is the
 * only promo with a button.
 */
export function StorePromos({ onPressGame }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();

  const { newRelease, comingSoon, freeToPlay, limitedEvent } = promos;

  const duoWidth: number | "100%" = layout.isWide
    ? (layout.width - layout.gutter * 2 - theme.spacing.md) / 2
    : "100%";

  return (
    <SectionRule>
      <SectionHeader eyebrow={t.arcade.promos.kicker} title={t.arcade.promos.title} />

      <View style={[styles.stack, { paddingHorizontal: layout.gutter }]}>
        {/* 1 — New release: the only promo with a CTA. */}
        <PressableScale onPress={onPressGame} accessibilityLabel={newRelease.title}>
          <GamePlate palette={PLATE_PALETTES[newRelease.id]} radius="2xl" style={styles.newReleasePlate}>
            <View style={styles.bannerContent}>
              <View style={styles.badgeRow}>
                <ArcadeBadge kind="new" />
                <ThemedText variant="overline" style={{ color: theme.colors.primary }}>
                  {t.arcade.promos.newRelease}
                </ThemedText>
              </View>
              <ThemedText variant="title" numberOfLines={2}>
                {newRelease.title}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={2}>
                {t.arcade.gameCopy[newRelease.descriptionKey]}
              </ThemedText>
              <View style={styles.metaRow}>
                {newRelease.priceMMK !== null ? (
                  <SlugText color={theme.colors.text}>{formatKyat(newRelease.priceMMK)}</SlugText>
                ) : (
                  <FreeTag />
                )}
              </View>
              <Button
                title={t.arcade.hero.explore}
                icon="play"
                size="md"
                onPress={onPressGame}
                style={styles.bannerCta}
              />
            </View>
          </GamePlate>
        </PressableScale>

        {/* 2 — Coming soon: not pressable, no CTA, no countdown. */}
        <Surface radius="2xl" tone="flat" style={styles.comingSoonSurface}>
          <GamePlate
            palette={PLATE_PALETTES[comingSoon.id]}
            radius="none"
            dimmed
            style={styles.comingSoonPlate}
          />
          <View style={styles.comingSoonPanel}>
            <ArcadeBadge kind="comingSoon" />
            <ThemedText variant="title" numberOfLines={2}>
              {comingSoon.title}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={2}>
              {t.arcade.gameCopy[comingSoon.descriptionKey]}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textMuted}>
              {t.arcade.promos.expected.replace("{year}", String(comingSoon.releaseYear))}
            </ThemedText>
          </View>
        </Surface>

        {/* 3 — The duo: free-to-play and the limited-time event. */}
        <View style={styles.duoRow}>
          <PressableScale
            onPress={onPressGame}
            accessibilityLabel={freeToPlay.title}
            style={duoWidth === "100%" ? styles.duoFull : { width: duoWidth }}
          >
            <GamePlate palette={PLATE_PALETTES[freeToPlay.id]} radius="xl" style={styles.duoPlate}>
              <View style={styles.bannerContent}>
                <ThemedText variant="overline" style={{ color: theme.colors.finance }}>
                  {t.arcade.promos.freeToPlay}
                </ThemedText>
                <ThemedText variant="section" numberOfLines={1}>
                  {freeToPlay.title}
                </ThemedText>
                <View style={styles.metaRow}>
                  <FreeTag />
                  {freeToPlay.playersOnline !== null && (
                    <>
                      <SlugText>{formatCompactCount(freeToPlay.playersOnline)}</SlugText>
                      <ThemedText variant="caption" color={theme.colors.textMuted}>
                        {t.arcade.live.playing}
                      </ThemedText>
                    </>
                  )}
                </View>
              </View>
            </GamePlate>
          </PressableScale>

          <PressableScale
            onPress={onPressGame}
            accessibilityLabel={limitedEvent.title}
            style={duoWidth === "100%" ? styles.duoFull : { width: duoWidth }}
          >
            <GamePlate palette={PLATE_PALETTES[limitedEvent.id]} radius="xl" style={styles.duoPlate}>
              <View style={styles.bannerContent}>
                <ThemedText variant="overline" style={{ color: theme.colors.premium }}>
                  {t.arcade.promos.limitedEvent}
                </ThemedText>
                <ThemedText variant="section" numberOfLines={1}>
                  {limitedEvent.title}
                </ThemedText>
                <View style={styles.metaRow}>
                  {limitedEvent.eventKey && (
                    <ThemedText variant="caption" color={theme.colors.premium}>
                      {t.arcade.events[limitedEvent.eventKey]}
                    </ThemedText>
                  )}
                  <ArcadeBadge kind="limited" />
                </View>
              </View>
            </GamePlate>
          </PressableScale>
        </View>
      </View>
    </SectionRule>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  newReleasePlate: { aspectRatio: 4 / 3 },
  bannerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" },
  bannerCta: { alignSelf: "flex-start", marginTop: theme.spacing.xs },
  comingSoonSurface: { overflow: "hidden" },
  comingSoonPlate: { aspectRatio: 16 / 9, borderWidth: 0 },
  comingSoonPanel: {
    backgroundColor: theme.colors.surfaceSunken,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  duoRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  duoFull: { width: "100%" },
  duoPlate: { aspectRatio: 16 / 10 },
});
