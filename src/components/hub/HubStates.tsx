import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/common/Skeleton";
import { bookCorners } from "@/components/books/BookCover";
import {
  HUB_TOP_GAP,
  useHubChromeHeight,
  useHubHeroMinHeight,
  type HubHeroVariant,
} from "@/components/hub/hubLayout";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Boards: the loading row is three 112 × 168 posters (or 116pt 5:7 covers) under a 150pt title bar. */
const ROW_POSTER = { width: 112, height: 168 };
const ROW_COVER = { width: 116, height: Math.round((116 * 7) / 5) };

/**
 * A hub while its first query loads (the boards' "loading" state): the
 * hero's silhouette at the hero's own height, then one row title and three
 * cards — pulsing blocks, never a spinner (Skeleton freezes under reduce
 * motion). The Media bar and its chips stay live over the hero's block, so a
 * sibling hub is one tap away even before this one has loaded. Screen
 * readers hear "Loading".
 */
export function HubSkeleton({ variant = "poster" }: { variant?: HubHeroVariant }) {
  const { t } = useLanguage();
  const card = variant === "cover" ? ROW_COVER : ROW_POSTER;

  return (
    <View style={styles.page}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
        <HeroBlock variant={variant} />
        <View style={styles.row}>
          <Skeleton width={150} height={20} radius="sm" />
          <View style={styles.cards}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={card.width} height={card.height} radius="card" />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * The hero's silhouette alone, at the hero's own height — a Media results
 * view's genre hero while that genre's first titles load (the results grid
 * under it draws its own skeleton cells). Spoken "Loading".
 */
export function HubHeroSkeleton({ variant = "poster" }: { variant?: HubHeroVariant }) {
  const { t } = useLanguage();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
      <HeroBlock variant={variant} />
    </View>
  );
}

/** The board's hero block in the sheet colour, with the copy's pulsing shapes on the raised fill. */
function HeroBlock({ variant }: { variant: HubHeroVariant }) {
  const { width } = useWindowDimensions();
  const heroHeight = useHubHeroMinHeight(variant);
  // The cover stands under the pinned Media bar and chip row, as the hero's does.
  const coverTop = useHubChromeHeight() + HUB_TOP_GAP;
  const coverWidth = Math.round(Math.min(180, width * 0.46));
  return (
    <View style={[styles.heroBlock, { height: heroHeight }]}>
      {variant === "cover" ? (
        <View style={[styles.coverStage, { paddingTop: coverTop }]}>
          <View style={[styles.coverClip, bookCorners("lg"), { width: coverWidth, height: (coverWidth * 7) / 5 }]}>
            <Skeleton height={400} radius="xs" />
          </View>
        </View>
      ) : null}
      <View style={[styles.heroCopy, variant === "cover" && styles.heroCopyCentered]}>
        <Skeleton width={120} height={20} radius="xs" />
        <Skeleton width="70%" height={38} radius="sm" style={styles.gap} />
        <Skeleton width="52%" height={14} radius="xs" style={styles.gap} />
        <View style={styles.actions}>
          <Skeleton height={52} radius="button" style={styles.grow} />
          <Skeleton width={110} height={52} radius="button" />
        </View>
      </View>
    </View>
  );
}

interface ErrorProps {
  /** Default "Something went wrong". */
  title?: string;
  /** Default the app's connection message. */
  message?: string;
  /** Default the struck-out cloud. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** The disc's role colour. Default `danger` (an error); `null` for the neutral disc. */
  tone?: string | null;
  /** Default "Retry". */
  actionLabel?: string;
  /** Retry — refetch every query of the hub. */
  onAction?: () => void;
  /**
   * The action's request is on its way (a Retry in flight): the button shows
   * its busy dots and cannot be pressed again. A refetch of a failed query
   * keeps the error status until it settles, so without this the page would
   * sit unchanged after the tap.
   */
  busy?: boolean;
}

/**
 * A hub whose first query failed (the boards' "error" state): the toned
 * disc, "Something went wrong", the connection line and a WHITE Retry, as the
 * board draws it. Scrolls, so a 2× text size never pushes the button off a
 * short phone — and starts below the pinned Media bar and chips, so nothing
 * scrolls up under them.
 */
export function HubError({ title, message, icon, tone, actionLabel, onAction, busy = false }: ErrorProps) {
  const { t } = useLanguage();
  const dockClearance = useDockClearance();
  const chromeHeight = useHubChromeHeight();
  const resolvedTone = tone === null ? undefined : (tone ?? theme.colors.danger);

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.page}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.errorBody, { paddingTop: chromeHeight, paddingBottom: dockClearance }]}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          icon={icon ?? "cloud-offline-outline"}
          tone={resolvedTone}
          title={title ?? t.common.somethingWentWrong}
          message={message ?? t.common.networkError}
          fill={false}
        />
        {onAction ? (
          <Button
            title={actionLabel ?? t.common.retry}
            variant="play"
            onPress={onAction}
            loading={busy}
            labelLines={2}
            style={styles.errorAction}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  heroBlock: { backgroundColor: theme.colors.surface },
  coverStage: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  coverClip: { overflow: "hidden" },
  heroCopy: {
    position: "absolute",
    left: theme.layout.screenPadding,
    right: theme.layout.screenPadding,
    bottom: 26,
  },
  heroCopyCentered: { alignItems: "center" },
  gap: { marginTop: 12 },
  actions: { flexDirection: "row", alignSelf: "stretch", gap: 10, marginTop: 18 },
  grow: { flex: 1 },
  row: { paddingTop: 10, paddingHorizontal: theme.layout.screenPadding },
  cards: { flexDirection: "row", gap: 10, marginTop: 16, overflow: "hidden" },
  errorBody: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: theme.spacing.xl },
  errorAction: { marginTop: theme.spacing.md, minWidth: 140 },
});
