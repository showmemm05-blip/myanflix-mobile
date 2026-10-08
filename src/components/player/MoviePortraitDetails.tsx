import { memo, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PressableScale } from "@/components/ui/PressableScale";
import { FadeInView } from "@/components/ui/FadeInView";
import { Chip } from "@/components/common/Chip";
import { Synopsis } from "@/components/detail/Synopsis";
import { InfoGrid } from "@/components/detail/InfoGrid";
import { MovieRow } from "@/components/movie/MovieRow";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { KeyboardLiftScrollView } from "@/components/common/KeyboardLiftScrollView";
import { AGE_RATING_LABELS } from "@/utils/ageRating";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { Movie } from "@/types/movie";

interface Props {
  movie: Movie;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  /** Same-category titles with the playing one already removed; empty hides the rail. */
  similarMovies: Movie[];
  /** Plays the title IN PLACE — the player swaps what is mounted, no navigation. */
  onPlaySimilar: (movie: Movie) => void;
  /** The home-indicator inset, so the last row can scroll clear of it. */
  bottomInset: number;
}

/**
 * Everything under the video in portrait for a standalone film
 * (Player.dc.html, "movie"): the title and its meta line, Favorites + Share,
 * the category labels, the synopsis, the facts, a rail of same-category titles
 * and the comment thread. The same pieces MovieDetails is built from, so the
 * two screens read as one app.
 *
 * Memoized because the player re-renders four times a second off the playback
 * tick (VideoPlayer's `timeUpdateEventInterval` is 0.25s), and every prop this
 * takes is held stable there — the movie is React Query's structurally shared
 * record, the handlers are `useCallback`s and the list is a `useMemo` — so none
 * of those ticks reach anything below this line. Labels come from context, not
 * props, so a language switch still re-renders it.
 */
export const MoviePortraitDetails = memo(function MoviePortraitDetails({
  movie,
  isFavorite,
  onToggleFavorite,
  onShare,
  similarMovies,
  onPlaySimilar,
  bottomInset,
}: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * A recommended title plays in place, so this list survives the swap — and
   * with it a scroll position that was down at the rail the viewer tapped. The
   * new title's details start from the top, the way a new screen would have.
   * Keyed on the id so a refetch of the same film (structurally new record,
   * same title) does not yank the viewer back up.
   */
  const shownIdRef = useRef(movie.id);
  useEffect(() => {
    if (shownIdRef.current === movie.id) return;
    shownIdRef.current = movie.id;
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  }, [movie.id, reduceMotion]);

  // null when the runtime was never measured — dropped rather than reading "0m".
  const runtime = formatDuration(movie.duration);
  const metaParts = [String(movie.releaseYear), runtime, movie.genre].filter(
    (part): part is string => !!part && part.trim().length > 0,
  );
  /**
   * The meta line is read as ONE element: "Rating, 8.4, 2024, 1h 52m, Drama".
   * Read piece by piece, iOS VoiceOver stopped on the star glyph and on every
   * "·" separator (importantForAccessibility is Android-only), and the bare
   * "8.4" never said what it was.
   */
  const ratingText = movie.rating > 0 ? movie.rating.toFixed(1) : null;
  const metaA11yLabel = [
    ratingText ? t.player.controlState.replace("{label}", t.movie.rating).replace("{value}", ratingText) : null,
    ...metaParts,
  ]
    .filter((part): part is string => !!part)
    .join(t.player.listSeparator);

  // Only what the meta line does not already say. Every one of these is
  // nullable metadata the admin backfills over time, so an absent value drops
  // the row outright — a well reading "null" or standing empty is worse than
  // no well at all.
  const facts: { label: string; value: string }[] = [];
  if (movie.director) facts.push({ label: t.movie.director, value: movie.director });
  if (movie.country) facts.push({ label: t.movie.country, value: movie.country });
  // `?? movie.ageRating`, the fallback the label map documents: a
  // rating the label map does not know yet shows its raw code rather than an
  // empty value cell.
  if (movie.ageRating)
    facts.push({ label: t.movie.ageRating, value: AGE_RATING_LABELS[movie.ageRating] ?? movie.ageRating });
  if (movie.language) facts.push({ label: t.movie.language, value: movie.language });

  return (
    /* The comment composer at the foot of this column is the only text input
       on the player — on iOS nothing lifts it clear of the keyboard without
       this, and Player.tsx has no KeyboardAvoidingView of its own. Wrapped
       HERE rather than around the whole screen so only this column pads
       itself: the video stage above is a fixed-aspect sibling and does not
       shrink. Android resizes the window itself (adjustResize, Expo's default
       softwareKeyboardLayoutMode), so it takes no behavior, same as
       MovieDetails and AuthScreenShell. */
    <KeyboardAvoidingView style={styles.scroll} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <KeyboardLiftScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomInset + theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        // Without this the first tap on "Post" only dismisses the keyboard.
        keyboardShouldPersistTaps="handled"
      >
        <FadeInView from="bottom" style={styles.column}>
          <ThemedText variant="title" accessibilityRole="header">
            {movie.title}
          </ThemedText>

          <View style={styles.meta} accessible accessibilityRole="text" accessibilityLabel={metaA11yLabel}>
            {ratingText && (
              <View style={styles.rating}>
                <Ionicons name="star" size={13} color={theme.colors.premium} />
                <ThemedText variant="caption" weight="extrabold" tabular color={theme.colors.premium}>
                  {ratingText}
                </ThemedText>
              </View>
            )}
            {metaParts.map((part, index) => (
              <View key={`${index}-${part}`} style={styles.metaItem}>
                {index > 0 ? (
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textDecor}
                    importantForAccessibility="no"
                    accessibilityElementsHidden
                  >
                    ·
                  </ThemedText>
                ) : null}
                <ThemedText variant="caption" tabular color={theme.colors.textMuted}>
                  {part}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* The same two controls as MovieDetails' action row, minus Play —
              the film is already playing. */}
          <View style={styles.actions}>
            <PressableScale
              onPress={onToggleFavorite}
              accessibilityLabel={isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites}
              style={styles.action}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={20}
                color={isFavorite ? theme.colors.primary : theme.colors.text}
              />
              <ThemedText weight="bold" style={styles.actionLabel}>
                {isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites}
              </ThemedText>
            </PressableScale>
            <PressableScale onPress={onShare} accessibilityLabel={t.movie.share} style={styles.action}>
              <Ionicons name="share-outline" size={20} color={theme.colors.text} />
              <ThemedText weight="bold" style={styles.actionLabel}>
                {t.movie.share}
              </ThemedText>
            </PressableScale>
          </View>

          {/* Plain labels, on purpose: CategoryDetail is not reached from the
              player (AREA-NOTES), and a chip that looks tappable and goes
              nowhere is worse than one that does not invite the tap. */}
          {movie.categories.length > 0 && (
            <View style={styles.chips}>
              {movie.categories.map((category) => (
                <Chip key={category.id} label={category.name} tone="neutral" labelLines={2} />
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Synopsis text={movie.description} title={t.movie.synopsis} collapsedLines={3} />
          </View>

          {facts.length > 0 && (
            <View style={styles.section}>
              {/* The header's own 14pt bottom margin is the board's dt/dd offset. */}
              <SectionHeader title={t.movie.details} inset={false} titleLines={2} />
              <InfoGrid items={facts} variant="plain" />
            </View>
          )}
        </FadeInView>

        {/* Out at the screen edge: the rail carries its own leading inset and
            the section header its own. Renders nothing while the list is empty. */}
        <View style={styles.rail}>
          <MovieRow title={t.player.recommended} movies={similarMovies} onPressMovie={onPlaySimilar} />
        </View>

        {/* The section carries its own horizontal padding. Keyed on the id
            because a recommended title plays IN PLACE — without the key the
            thread would keep the previous film's half-typed draft and open
            reply box while its queries re-pointed at the new one. MovieDetails
            never needs this: it is a fresh screen per movie. Only the id
            crosses this line, a stable string, so the playback tick still
            stops at this component. */}
        <View style={styles.comments}>
          <CommentsSection key={movie.id} movieId={movie.id} />
        </View>
      </KeyboardLiftScrollView>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  column: { paddingTop: 20, paddingHorizontal: theme.layout.screenPadding },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 10,
    rowGap: 6,
    marginTop: theme.spacing.sm,
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: theme.spacing.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.tonalStrong,
    maxWidth: "100%",
  },
  actionLabel: { fontSize: 15, flexShrink: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  section: { marginTop: 28 },
  rail: { marginTop: 36 },
  comments: { marginTop: 36 },
});
