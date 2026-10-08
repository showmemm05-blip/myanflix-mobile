import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Text as SvgText } from "react-native-svg";
// Deep imports, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { Movie } from "@/types/movie";

/** The rank column and the 16:9 thumbnail, as the board draws them. */
const RANK_WIDTH = 26;
const RANK_HEIGHT = 32;
const THUMB_WIDTH = 104;
const THUMB_HEIGHT = 58;
const ROW_MIN_HEIGHT = 64;

/*
 * "Trending searches" on the search screen's All / Movies scopes, before a
 * search — the owner's approved section.
 *
 * There is no search-trend data anywhere in the API, so this is honestly the
 * MOST-WATCHED titles (movies sort=mostViewed, a handful of them) and the
 * caption says exactly that. A tap opens the title rather than running a
 * search, and no view numbers are shown: Movie carries no view count.
 */

interface Props {
  movies: readonly Movie[];
  onPress: (movie: Movie) => void;
}

function SectionTitle() {
  const { t } = useLanguage();
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Ionicons name="trending-up" size={20} color={theme.colors.link} />
        <ThemedText variant="section" accessibilityRole="header" style={styles.titleText}>
          {t.search.trendingTitle}
        </ThemedText>
      </View>
      <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
        {t.search.trendingCaption}
      </ThemedText>
    </View>
  );
}

/** Memoized: it sits under the search field, and a keystroke must not rebuild it. */
export const TrendingSection = memo(function TrendingSection({ movies, onPress }: Props) {
  return (
    <View>
      <SectionTitle />
      <View style={styles.list}>
        {movies.map((movie, index) => (
          <TrendingRow key={movie.id} movie={movie} rank={index + 1} onPress={onPress} />
        ))}
      </View>
    </View>
  );
});

/**
 * The outlined numeral. RN text has no stroke, so it is one SVG glyph —
 * decorative (the row's label already speaks the rank), and drawn at a fixed
 * size on purpose: it is a graphic, not reading text.
 */
function RankNumeral({ rank }: { rank: number }) {
  return (
    <Svg width={RANK_WIDTH} height={RANK_HEIGHT} accessible={false} pointerEvents="none">
      <SvgText
        x={RANK_WIDTH / 2}
        y={RANK_HEIGHT - 6}
        textAnchor="middle"
        fontSize={28}
        fontWeight="900"
        fontFamily={theme.font.black}
        fill="none"
        stroke={theme.colors.textMuted}
        strokeWidth={1.5}
      >
        {String(rank)}
      </SvgText>
    </Svg>
  );
}

const TrendingRow = memo(function TrendingRow({
  movie,
  rank,
  onPress,
}: {
  movie: Movie;
  rank: number;
  onPress: (movie: Movie) => void;
}) {
  const { t } = useLanguage();
  // Both guards are real data states: releaseYear is 0 until the admin fills
  // it in, and genre is empty on older records.
  const meta = [movie.releaseYear > 0 ? String(movie.releaseYear) : null, movie.genre || null]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const premium = movie.accessType === "SUBSCRIPTION";
  // The landscape art first — this is a 16:9 frame — and the poster after it.
  const imageUrl = movie.coverUrl ?? movie.posterUrl;
  const label = [t.search.rankA11y.replace("{n}", String(rank)), movie.title, meta || null, premium ? t.movie.premium : null]
    .filter((part): part is string => part !== null)
    .join(", ");

  return (
    <PressableScale onPress={() => onPress(movie)} dimOnPress accessibilityLabel={label} style={styles.row}>
      <RankNumeral rank={rank} />
      <View style={styles.thumb}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <Ionicons name="film-outline" size={20} color={theme.colors.textFaint} />
        )}
        {premium ? (
          <View style={styles.crown} pointerEvents="none">
            <CrownGlyph size={10} color={theme.colors.premium} />
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        {/* Body is already 15pt; no lineHeight override, so a Burmese title
            keeps ThemedText's +4 line-height bonus. */}
        <ThemedText weight="extrabold" numberOfLines={3}>
          {movie.title}
        </ThemedText>
        {meta.length > 0 ? (
          <ThemedText variant="caption" weight="regular" tabular numberOfLines={1} color={theme.colors.textFaint}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </PressableScale>
  );
});

/** The section while its request is out — same rows, same heights. */
export function TrendingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View accessibilityRole="progressbar">
      <View style={styles.header}>
        <Skeleton width={190} height={20} radius="xs" style={styles.skeletonTitle} />
        <Skeleton width={150} height={12} radius="xs" style={styles.skeletonCaption} />
      </View>
      <View style={styles.list}>
        {Array.from({ length: rows }, (_, index) => index).map((index) => (
          <View key={index} style={styles.row}>
            <Skeleton width={RANK_WIDTH} height={28} radius="xs" />
            <Skeleton width={THUMB_WIDTH} height={THUMB_HEIGHT} radius="sm" />
            <View style={styles.skeletonText}>
              <Skeleton width="70%" height={14} radius="xs" />
              <Skeleton width="40%" height={11} radius="xs" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.layout.screenPadding },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  titleText: { flexShrink: 1 },
  list: { gap: theme.spacing.xs, marginTop: 14, paddingHorizontal: theme.layout.screenPadding },
  /** A minimum, not a height: a long Burmese title at 2× text has to grow the row. */
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: ROW_MIN_HEIGHT },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    alignItems: "center",
    justifyContent: "center",
  },
  crown: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: theme.colors.artBadge,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0 },
  skeletonTitle: { marginTop: 4 },
  skeletonCaption: { marginTop: 8 },
  skeletonText: { flex: 1, gap: theme.spacing.sm },
});
