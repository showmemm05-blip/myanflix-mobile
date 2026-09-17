import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/ThemedText";
import { AccessBadge } from "@/components/common/AccessBadge";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

interface Props {
  title: string;
  /** 16:9 / landscape art — pass `coverUrl ?? posterUrl`. */
  backdropUrl?: string | null;
  /** 2:3 art for the overlapping tile. Omit to hide the tile. */
  posterUrl?: string | null;
  /** Drives the FREE / PREMIUM tag — purely a label, gating lives in the screen. */
  accessType?: AccessType | null;
  rating?: number | null;
  /** Meta segments joined with "·" — year, runtime, episode count, genre. */
  meta?: Array<string | number | null | undefined>;
}

/**
 * The cinematic top of a detail screen: full-bleed artwork dissolving into the
 * page, with the poster tile, title and meta line riding the bottom edge.
 * Shared by MovieDetails and SeriesDetails so both read as the same screen.
 */
export function DetailHero({ title, backdropUrl, posterUrl, accessType, rating, meta }: Props) {
  const metaLine = (meta ?? [])
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .join("  ·  ");

  return (
    <View style={styles.container}>
      {backdropUrl ? (
        <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="film-outline" size={44} color={theme.colors.textFaint} />
        </View>
      )}

      <LinearGradient
        colors={[theme.colors.scrimSoft, "transparent", theme.colors.background + "CC", theme.colors.background]}
        locations={[0, 0.34, 0.8, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.footer}>
        {posterUrl ? (
          <View style={styles.posterTile}>
            <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" transition={220} />
          </View>
        ) : null}

        <View style={styles.text}>
          {accessType ? <AccessBadge accessType={accessType} /> : null}

          <ThemedText variant="display" numberOfLines={3} style={styles.title}>
            {title}
          </ThemedText>

          <View style={styles.metaRow}>
            {typeof rating === "number" && rating > 0 && (
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color={theme.colors.premium} />
                <ThemedText variant="caption" weight="semibold" tabular style={styles.ratingText}>
                  {rating.toFixed(1)}
                </ThemedText>
              </View>
            )}
            {metaLine.length > 0 && (
              <ThemedText variant="caption" numberOfLines={1} tabular style={styles.meta}>
                {metaLine}
              </ThemedText>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    justifyContent: "flex-end",
    backgroundColor: theme.colors.skeleton,
  },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.md,
  },
  posterTile: {
    width: 96,
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
    ...theme.shadow.lg,
  },
  posterImage: { width: "100%", height: "100%" },
  text: { flex: 1, gap: theme.spacing.xs, paddingBottom: 2 },
  title: { textShadowColor: theme.colors.scrim, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.premiumSoft,
    borderWidth: 1,
    borderColor: theme.colors.premium + "3D",
  },
  ratingText: { color: theme.colors.premium },
  meta: { flex: 1 },
});
