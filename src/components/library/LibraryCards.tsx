import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { PosterThumb } from "@/components/library/PosterThumb";
import { theme, withAlpha } from "@/theme";

const CARD_RADIUS = 16;

/** Each poster's place in the fan, back to front (Library.dc.html). */
const FAN_SLOTS = [
  { right: 78, top: 18, rotate: "-8deg", opacity: 0.55 },
  { right: 46, top: 14, rotate: "-2deg", opacity: 0.8 },
  { right: 14, top: 16, rotate: "6deg", opacity: 1 },
] as const;
/** Room the fan takes on the right of a banner. */
const FAN_WIDTH = 150;
/** The compact fan: the newest poster alone, smaller, in the front slot's tilt. */
const COMPACT_POSTER = { width: 56, height: 84 } as const;
const COMPACT_SLOT = { right: 16, top: 24, rotate: "6deg" } as const;
const COMPACT_FAN_WIDTH = 88;
/** Room the trailing glyph disc (Downloads) takes. */
const TRAILING_WIDTH = 96;
/** The text column's left inset. */
const BANNER_TEXT_LEFT = 18;
/**
 * The narrowest text column a banner keeps, at font scale 1: the longest
 * title word at 22pt black ("Favorites", "Downloads") fits on one line
 * instead of breaking mid-word. It grows with the phone's text size.
 */
const MIN_TEXT_ROOM = 140;

type BannerArt = "full" | "compact" | "none";

/**
 * How much art a banner can afford beside its title. The banners span the
 * window less the screen padding (Profile's "Your library"), so the column left over
 * is known from the window alone — no measuring pass, no jump on first paint.
 * A 320pt phone gets the compact fan; large text drops the art altogether
 * before it squeezes the title into a per-syllable column.
 */
function bannerArt(windowWidth: number, fontScale: number, artWidth: number, compactWidth: number | null): BannerArt {
  const bannerWidth = windowWidth - 2 * theme.layout.screenPadding;
  const need = MIN_TEXT_ROOM * Math.max(1, fontScale);
  if (bannerWidth - BANNER_TEXT_LEFT - artWidth >= need) return "full";
  if (compactWidth !== null && bannerWidth - BANNER_TEXT_LEFT - compactWidth >= need) return "compact";
  return "none";
}

/**
 * Three posters fanned at the right of a collection banner, the newest in
 * front — or, when compact, the newest alone. A slot with no poster (nothing
 * yet, or still loading) is a ghost outline, so the banner keeps its shape in
 * every state.
 */
function PosterFan({ uris, ghost, compact }: { uris: (string | null)[]; ghost: boolean; compact: boolean }) {
  if (compact) {
    const uri = ghost ? undefined : uris[0];
    const place = { right: COMPACT_SLOT.right, top: COMPACT_SLOT.top, transform: [{ rotate: COMPACT_SLOT.rotate }] };
    return (
      <View style={styles.fan} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {uri === undefined ? (
          <View style={[styles.fanGhost, COMPACT_POSTER, place]} />
        ) : (
          <View style={[styles.fanCard, COMPACT_POSTER, place]}>
            <PosterThumb uri={uri} width={COMPACT_POSTER.width} height={COMPACT_POSTER.height} radius={8} fallbackIconSize={14} />
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={styles.fan} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {FAN_SLOTS.map((slot, index) => {
        // Slot 2 is the front: the first (newest) poster goes there.
        const uri = ghost ? undefined : uris[FAN_SLOTS.length - 1 - index];
        const place = { right: slot.right, top: slot.top, transform: [{ rotate: slot.rotate }] };
        if (uri === undefined) return <View key={index} style={[styles.fanGhost, place]} />;
        return (
          <View key={index} style={[styles.fanCard, place, { opacity: slot.opacity }]}>
            <PosterThumb uri={uri} width={72} height={108} radius={8} fallbackIconSize={16} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * One of the library's big collection banners — today the Downloads & Cache
 * placeholder in Profile's "Your library" (it once carried Watch History and
 * Favorites on the Library tab, hence the poster fan): a glyph, a 22pt title,
 * a count line, and either a fan of real posters or a trailing glyph disc. The whole banner is the button. It
 * grows taller rather than clipping when the title wraps, and narrows its art
 * (bannerArt) on small phones and at large text so the title keeps its room.
 */
export function CollectionBanner({
  icon,
  iconColor,
  title,
  titleColor,
  meta,
  metaLoading,
  tint,
  fanUris,
  fanGhost,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  titleColor?: string;
  meta?: string | null;
  metaLoading?: boolean;
  /** The colour the banner's fill leans toward on its right; omit for the flat panel. */
  tint?: string;
  fanUris?: (string | null)[];
  fanGhost?: boolean;
  /** Replaces the fan with a glyph disc (the Downloads placeholder). */
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { width, fontScale } = useWindowDimensions();
  const hasFan = fanUris !== undefined;
  const art = hasFan
    ? bannerArt(width, fontScale, FAN_WIDTH, COMPACT_FAN_WIDTH)
    : trailing
      ? bannerArt(width, fontScale, TRAILING_WIDTH, null)
      : "none";
  const artRoom = art === "none" ? BANNER_TEXT_LEFT : !hasFan ? TRAILING_WIDTH : art === "full" ? FAN_WIDTH : COMPACT_FAN_WIDTH;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} style={[styles.banner, !tint && styles.bannerFlat]}>
      {tint ? (
        <LinearGradient
          colors={[withAlpha(tint, 0), withAlpha(tint, 0.1)]}
          start={{ x: 0, y: 0.32 }}
          end={{ x: 1, y: 0.68 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {hasFan && art !== "none" ? (
        <PosterFan uris={fanUris ?? []} ghost={!!fanGhost} compact={art === "compact"} />
      ) : null}
      {trailing && art !== "none" ? <View style={styles.bannerTrailing}>{trailing}</View> : null}
      <View style={[styles.bannerText, { marginRight: artRoom }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
        <ThemedText variant="title" weight="black" color={titleColor} style={styles.bannerTitle}>
          {title}
        </ThemedText>
        {metaLoading ? (
          <Skeleton width={80} height={12} radius="xs" style={styles.bannerMetaSkeleton} />
        ) : meta ? (
          <ThemedText
            variant="caption"
            weight="regular"
            tabular
            color={trailing ? theme.colors.textFaint : theme.colors.textBody}
            style={styles.bannerMeta}
          >
            {meta}
          </ThemedText>
        ) : null}
      </View>
    </PressableScale>
  );
}


const styles = StyleSheet.create({
  banner: {
    minHeight: 132,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: theme.colors.popover,
  },
  bannerFlat: { backgroundColor: theme.colors.surface },
  bannerText: { marginLeft: BANNER_TEXT_LEFT, paddingVertical: 20 },
  /** 22pt black — size only, so Burmese keeps its line-height bonus. */
  bannerTitle: { marginTop: theme.spacing.sm, fontSize: 22 },
  bannerMeta: { marginTop: 2 },
  bannerMetaSkeleton: { marginTop: 5 },
  bannerTrailing: { position: "absolute", right: 22, top: 38 },
  fan: { ...StyleSheet.absoluteFill },
  fanCard: { position: "absolute", width: 72, height: 108, borderRadius: 8, ...theme.shadow.md },
  fanGhost: {
    position: "absolute",
    width: 72,
    height: 108,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    backgroundColor: withAlpha(theme.colors.text, 0.03),
  },
});
