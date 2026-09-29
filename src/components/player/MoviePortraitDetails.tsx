import { memo, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { IconButton } from "@/components/ui/IconButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
 * Everything under the video in portrait for a standalone film: the title and
 * its meta pills, favourite + share, the facts the pills do not cover, the
 * category chips, the synopsis, a rail of same-category titles and the comment
 * thread. The same pieces MovieDetails is built from, so the two screens read
 * as one app.
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
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [movie.id]);

  // null when the runtime was never measured — the Pill is dropped rather than reading "0m".
  const runtime = formatDuration(movie.duration);

  // Only what the pills above do not already say. Every one of these is
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
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + theme.spacing.xl }]}
        showsVerticalScrollIndicator={false}
        // Without this the first tap on "Post" only dismisses the keyboard.
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="title" numberOfLines={2}>
          {movie.title}
        </ThemedText>

        <View style={styles.meta}>
          {movie.rating > 0 && (
            <Pill tone="premium">
              {"★ "}
              {movie.rating.toFixed(1)}
            </Pill>
          )}
          <Pill tone="neutral">{String(movie.releaseYear)}</Pill>
          {runtime && <Pill tone="neutral">{runtime}</Pill>}
          <Pill tone="neutral">{movie.genre}</Pill>
        </View>

        {/* The same two controls as MovieDetails' CTA row, minus Watch — the
            film is already playing. */}
        <View style={styles.actions}>
          <IconButton
            icon={isFavorite ? "heart" : "heart-outline"}
            variant={isFavorite ? "soft" : "outline"}
            size="lg"
            color={isFavorite ? theme.colors.primary : undefined}
            accessibilityLabel={isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites}
            onPress={onToggleFavorite}
          />
          <IconButton
            icon="share-outline"
            variant="outline"
            size="lg"
            accessibilityLabel={t.movie.share}
            onPress={onShare}
          />
        </View>

        {facts.length > 0 && (
          <View style={styles.facts}>
            <SectionHeader title={t.movie.details} inset={false} />
            <InfoGrid items={facts} />
          </View>
        )}

        {/* Plain labels, on purpose: CategoryDetail is unreachable in this app
            (an open product decision), and a chip that looks tappable and goes
            nowhere is worse than one that does not invite the tap. Outline,
            neutral, small — how the website's player shows them. */}
        {movie.categories.length > 0 && (
          <View style={styles.chips}>
            {movie.categories.map((category) => (
              <Chip key={category.id} label={category.name} tone="neutral" size="sm" />
            ))}
          </View>
        )}

        <Synopsis text={movie.description} title={t.movie.synopsis} />

        {/* Pulled back out to the screen edge: the rail carries its own leading
            inset, and the section header its own, so inside this padded column
            both would be doubled. Renders nothing while the list is empty. */}
        <View style={styles.rail}>
          <MovieRow title={t.player.recommended} movies={similarMovies} onPressMovie={onPlaySimilar} />
        </View>

        {/* Pulled out to the screen edge for the same reason as the rail: the
            section carries its own horizontal padding. Keyed on the id because a
            recommended title plays IN PLACE — without the key the thread would
            keep the previous film's half-typed draft and open reply box while
            its queries re-pointed at the new one. MovieDetails never needs this:
            it is a fresh screen per movie. Only the id crosses this line, a
            stable string, so the playback tick still stops at this component. */}
        <View style={styles.comments}>
          <CommentsSection key={movie.id} movieId={movie.id} />
        </View>
      </KeyboardLiftScrollView>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: theme.layout.screenPadding,
    gap: theme.spacing.md,
  },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  facts: { gap: theme.spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  rail: { marginHorizontal: -theme.layout.screenPadding, marginTop: theme.spacing.sm },
  comments: { marginHorizontal: -theme.layout.screenPadding, marginTop: theme.spacing.sm },
});
