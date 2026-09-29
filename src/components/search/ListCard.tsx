import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
// Deep imports, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
// MaterialCommunityIcons is the crown MediaCard already ships — same glyph,
// same already-paid TTF, so the premium mark reads the same on both cards.
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { AccessType } from "@/types/movie";

/** 2:3, sized so a title, a meta line, chips, two lines of blurb and the action row fit beside it. */
export const LIST_POSTER_WIDTH = 108;
export const LIST_POSTER_HEIGHT = 162;
/** Card padding on every side — the poster plus this twice is the card's resting height. */
const CARD_PADDING = 10;
/** What a skeleton row reserves: poster + padding, which is what a real card measures at rest. */
export const LIST_CARD_HEIGHT = LIST_POSTER_HEIGHT + CARD_PADDING * 2;
/** The card never lists more than this many category chips — the row has to stay one line. */
export const MAX_CHIPS = 3;

export interface ListCardAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Solid violet (the play action) or a quiet tinted pill (a secondary "view"). */
  solid?: boolean;
}

export interface ListCardProps {
  title: string;
  posterUrl?: string | null;
  coverUrl?: string | null;
  accessType?: AccessType | null;
  /** Already joined with " · " — the caller drops the parts it does not have. */
  meta: string;
  /** Category names, at most MAX_CHIPS of them. */
  chips: readonly string[];
  description: string;
  /** 0 (the API's "unrated") hides the star entirely. */
  rating: number;
  action: ListCardAction;
  /** Top-right corner control — the movie card's bookmark; series pass nothing. */
  corner?: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The results ROW — the owner's mock-up card: poster on the left, a column of
 * title / meta / chips / blurb on the right, and a bottom row with the rating
 * and one pill action. Presentational only; MovieListCard and SeriesListCard
 * map their records onto it and own the hooks, so this file has none.
 *
 * The whole card is one PressableScale that opens the details page; the
 * action pill and the corner control sit INSIDE it as their own Pressables,
 * which is what lets "Watch Now" and the bookmark do something different from
 * the card around them — RN resolves a nested touchable to the innermost one.
 */
export function ListCard({
  title,
  posterUrl,
  coverUrl,
  accessType,
  meta,
  chips,
  description,
  rating,
  action,
  corner,
  onPress,
  style,
}: ListCardProps) {
  const { t } = useLanguage();
  const imageUrl = posterUrl ?? coverUrl;

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.985}
      dimOnPress
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.card, style]}
    >
      <View style={styles.poster}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            // Same reasoning as MediaCard: rows leave the list window and come
            // back, and re-decoding a ~100pt poster from disk each time is the
            // expensive half of a fling.
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.posterFallback}>
            <Ionicons name="film-outline" size={26} color={theme.colors.textFaint} />
          </View>
        )}
        {accessType === "SUBSCRIPTION" && (
          <View style={styles.crown} accessibilityLabel={t.movie.premium}>
            <MaterialCommunityIcons name="crown" size={12} color={theme.colors.onPremium} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.titleRow}>
            <ThemedText variant="body" weight="bold" numberOfLines={2} style={styles.title}>
              {title}
            </ThemedText>
            {corner}
          </View>

          {meta.length > 0 && (
            <ThemedText variant="caption" tabular numberOfLines={1}>
              {meta}
            </ThemedText>
          )}

          {chips.length > 0 && (
            <View style={styles.chips}>
              {chips.slice(0, MAX_CHIPS).map((chip) => (
                <View key={chip} style={styles.chip}>
                  <ThemedText variant="caption" weight="semibold" numberOfLines={1} style={styles.chipText}>
                    {chip}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {description.length > 0 && (
            <ThemedText variant="caption" numberOfLines={2} color={theme.colors.textFaint}>
              {description}
            </ThemedText>
          )}
        </View>

        <View style={styles.bottom}>
          {rating > 0 ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={13} color={theme.colors.premium} />
              <ThemedText variant="caption" weight="bold" tabular color={theme.colors.premium}>
                {rating.toFixed(1)}
              </ThemedText>
            </View>
          ) : (
            // Holds the row's left edge so the pill stays right-aligned on an
            // unrated title instead of sliding over.
            <View />
          )}
          <Pressable
            onPress={action.onPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.action,
              action.solid ? styles.actionSolid : styles.actionSoft,
              pressed && styles.actionPressed,
            ]}
          >
            <Ionicons
              name={action.icon}
              size={13}
              color={action.solid ? theme.colors.onPrimary : theme.colors.primary}
            />
            <ThemedText
              variant="label"
              weight="bold"
              numberOfLines={1}
              style={{ color: action.solid ? theme.colors.onPrimary : theme.colors.primary }}
            >
              {action.label}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * The loading row. The poster block is the exact size of the real one and
 * the text bars sit where the real lines do, so the list does not shift
 * under the user's thumb the moment results land.
 */
export function ListCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.skeletonPoster} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Skeleton width="78%" height={16} radius="sm" />
          <Skeleton width="52%" height={12} radius="sm" />
          <View style={styles.chips}>
            <Skeleton width={56} height={20} radius="pill" />
            <Skeleton width={64} height={20} radius="pill" />
          </View>
          <Skeleton width="92%" height={12} radius="sm" />
          <Skeleton width="70%" height={12} radius="sm" />
        </View>
        <View style={styles.bottom}>
          <Skeleton width={36} height={14} radius="sm" />
          <Skeleton width={96} height={30} radius="pill" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: theme.spacing.sm + 4,
    padding: CARD_PADDING,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  poster: {
    width: LIST_POSTER_WIDTH,
    height: LIST_POSTER_HEIGHT,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  crown: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.premium,
    alignItems: "center",
    justifyContent: "center",
  },
  /** At least as tall as the poster, so the action row sits on the card's floor. */
  body: { flex: 1, minHeight: LIST_POSTER_HEIGHT, justifyContent: "space-between", gap: theme.spacing.sm },
  top: { gap: theme.spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.xs },
  title: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
  },
  actionSolid: { backgroundColor: theme.colors.primary },
  actionSoft: {
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.24),
  },
  actionPressed: { opacity: 0.75 },
  skeletonPoster: {
    width: LIST_POSTER_WIDTH,
    height: LIST_POSTER_HEIGHT,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.skeleton,
  },
});
