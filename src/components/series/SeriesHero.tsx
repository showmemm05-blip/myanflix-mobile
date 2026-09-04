import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { AccessBadge } from "@/components/common/AccessBadge";
import { Skeleton } from "@/components/common/Skeleton";
import { theme, withAlpha } from "@/theme";
import type { AccessType } from "@/types/movie";

/** How far the text block rides up into the backdrop's dissolve. */
const OVERLAP = 56;

interface Props {
  title: string;
  /** Landscape art — pass `coverUrl ?? posterUrl`. */
  backdropUrl?: string | null;
  /** Drives the FREE / PREMIUM tag — gating stays with the screen. */
  accessType?: AccessType | null;
  releaseYear?: number | null;
  language?: string | null;
  /**
   * ONE already-translated sentence ("{s} seasons · {e} episodes") — built by
   * the screen from t.series.seasonSummary once BOTH counts are known, null
   * until then so the chip never shows a half-truth.
   */
  seasonSummary?: string | null;
}

function useHeroHeight(): number {
  const { width } = useWindowDimensions();
  return Math.max(260, Math.round(width * 0.75));
}

/**
 * The series flavor of a detail hero (movies keep common/DetailHero): a
 * full-bleed backdrop dissolving into the page, with the seasons chip, display
 * title and meta line overlapping the dissolve — the web series page's IA.
 */
export function SeriesHero({ title, backdropUrl, accessType, releaseYear, language, seasonSummary }: Props) {
  const heroHeight = useHeroHeight();
  const metaLine = [releaseYear, language]
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .join(" · ");

  return (
    <View>
      <View style={[styles.backdrop, { height: heroHeight }]}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="tv-outline" size={44} color={theme.colors.textFaint} />
          </View>
        )}

        {/* Quiet side scrim so pale artwork never washes out the status bar / back button. */}
        <View style={styles.sideScrim} pointerEvents="none" />

        {/* The dissolve: transparent over the top half, page background by the bottom edge. */}
        <LinearGradient
          colors={["transparent", withAlpha(theme.colors.background, 0.55), theme.colors.background]}
          locations={[0.5, 0.82, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View style={styles.content}>
        {seasonSummary ? (
          <Pill tone="overlay" icon="albums-outline">
            {seasonSummary}
          </Pill>
        ) : null}

        <ThemedText variant="display" numberOfLines={2} style={styles.title}>
          {title}
        </ThemedText>

        <View style={styles.metaRow}>
          {metaLine.length > 0 && (
            <ThemedText variant="caption" numberOfLines={1} tabular style={styles.meta}>
              {metaLine}
            </ThemedText>
          )}
          {accessType ? <AccessBadge accessType={accessType} /> : null}
        </View>
      </View>
    </View>
  );
}

/** Mirrors the hero's geometry while the series query is in flight. */
export function SeriesHeroSkeleton() {
  const heroHeight = useHeroHeight();

  return (
    <View>
      <Skeleton width="100%" height={heroHeight} radius="xs" />
      <View style={styles.content}>
        <Skeleton width="62%" height={28} radius="md" />
        <Skeleton width="38%" height={16} radius="md" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    width: "100%",
    backgroundColor: theme.colors.skeleton,
  },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  sideScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(theme.colors.background, 0.35),
  },
  content: {
    marginTop: -OVERLAP,
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.sm,
  },
  title: { textShadowColor: theme.colors.scrim, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" },
  meta: { flexShrink: 1 },
});
