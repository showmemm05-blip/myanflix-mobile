import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem } from "react-native";
import { Image } from "expo-image";
// Deep imports, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { Movie } from "@/types/movie";

/** CategoryDetail.dc.html "Top rated": a 150 × 160 cell, the 104 × 156 poster on its right. */
const CELL_WIDTH = 150;
const CELL_HEIGHT = 160;
const POSTER_WIDTH = 104;
const POSTER_HEIGHT = 156;
const GAP = 8;

interface Props {
  title: string;
  movies: Movie[];
  /** Stable — every cell's prop. */
  onPress: (movie: Movie) => void;
}

const keyExtractor = (movie: Movie) => movie.id;
const Separator = () => <View style={styles.separator} />;

const RankedCell = memo(function RankedCell({
  movie,
  rank,
  onPress,
}: {
  movie: Movie;
  rank: number;
  onPress: (movie: Movie) => void;
}) {
  const { t } = useLanguage();
  const isPremium = movie.accessType === "SUBSCRIPTION";
  const art = movie.posterUrl ?? movie.coverUrl;
  return (
    <PressableScale
      onPress={() => onPress(movie)}
      dimOnPress
      accessibilityLabel={[`${rank}`, movie.title, isPremium ? t.movie.premium : null].filter(Boolean).join(", ")}
      style={styles.cell}
    >
      {/* Decoration only — the rank is spoken in the label above. Never scaled
          with the OS text size: it is drawn art, not reading text. */}
      <ThemedText
        weight="black"
        allowFontScaling={false}
        style={styles.rank}
        accessible={false}
        importantForAccessibility="no"
      >
        {rank}
      </ThemedText>
      <View style={styles.poster}>
        {art ? (
          <Image
            source={{ uri: art }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="film-outline" size={24} color={theme.colors.textFaint} />
          </View>
        )}
        {isPremium && (
          <View style={styles.crown} pointerEvents="none">
            <CrownGlyph size={12} color={theme.colors.premium} />
          </View>
        )}
      </View>
    </PressableScale>
  );
});

/**
 * A ranked shelf — big decorative numerals tucked behind each poster, in the
 * order the server ranked them (sort=rating). Renders nothing when empty.
 */
export function RankedRail({ title, movies, onPress }: Props) {
  const renderItem = useCallback<ListRenderItem<Movie>>(
    ({ item, index }) => <RankedCell movie={item} rank={index + 1} onPress={onPress} />,
    [onPress],
  );
  if (movies.length === 0) return null;
  return (
    <View>
      <SectionHeader title={title} />
      <FlatList
        horizontal
        data={movies}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={CELL_WIDTH + GAP}
        decelerationRate="fast"
        snapToAlignment="start"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: theme.layout.screenPadding },
  separator: { width: GAP },
  cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
  rank: {
    position: "absolute",
    left: -6,
    bottom: -6,
    fontSize: 120,
    lineHeight: 124,
    letterSpacing: -6,
    color: theme.colors.textDecor,
  },
  poster: {
    position: "absolute",
    right: 0,
    top: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  crown: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.artBadge,
    alignItems: "center",
    justifyContent: "center",
  },
});
