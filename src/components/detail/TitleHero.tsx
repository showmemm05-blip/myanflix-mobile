import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { AccessBadge } from "@/components/common/AccessBadge";
import { Skeleton } from "@/components/common/Skeleton";
import { PulseDots } from "@/components/detail/PulseDots";
import { theme, withAlpha } from "@/theme";
import type { AccessType } from "@/types/movie";

/** MovieDetail.dc.html: a 540pt hero on a 390pt-wide board. */
const HERO_RATIO = 540 / 390;
/** Never more than this share of the window, so the body peeks on short phones. */
const MAX_WINDOW_SHARE = 0.72;
const MIN_HERO = 360;
/** The floating round action: 72pt, centred on the hero's bottom edge less 2pt. */
export const HERO_ACTION_SIZE = 72;
const ACTION_DROP = 34;
/** Room the title keeps clear on its right for the floating action. */
const ACTION_LANE = HERO_ACTION_SIZE + 16 + 16;
/** The board's 140pt top scrim and 300pt bottom dissolve. */
const TOP_SCRIM = 140;
const BOTTOM_SCRIM = 300;
/** Space the body below needs on top so its first row clears the floating action. */
export const HERO_BODY_OFFSET = 44;

export type HeroActionKind = "play" | "locked" | "busy" | "disabled";

export interface HeroAction {
  kind: HeroActionKind;
  onPress?: () => void;
  accessibilityLabel: string;
}

interface Props {
  title: string;
  /** Portrait key art first (posterUrl ?? coverUrl) — the hero is taller than it is wide. */
  artUrl?: string | null;
  accessType?: AccessType | null;
  /** "Film" / "Series" beside the access badge. */
  kindLabel?: string;
  /** One bold line under the title — "Start watching · S1 E1". */
  subline?: string | null;
  /** The floating round control on the hero's bottom-right edge. Null hides it. */
  action?: HeroAction | null;
  /** Shown instead of the art when there is none. */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  children?: ReactNode;
}

export function useTitleHeroHeight(): number {
  const { width, height } = useWindowDimensions();
  return Math.round(Math.max(MIN_HERO, Math.min(width * HERO_RATIO, height * MAX_WINDOW_SHARE)));
}

/**
 * The Marquee title hero shared by MovieDetails and SeriesDetails: the art
 * full-bleed under the status bar with the board's two scrims, the access
 * badge + kind line, the 34pt black title and an optional bold subline on the
 * bottom-left, and the 72pt round action (white Play, gold lock, or its busy /
 * disabled forms) floating on the bottom edge.
 *
 * The block is a MIN height, not a fixed one: a long Burmese title at a large
 * text size grows the hero downwards instead of climbing under the top bar.
 * zIndex keeps the half of the action that hangs below the hero tappable over
 * the body that follows it.
 */
export function TitleHero({ title, artUrl, accessType, kindLabel, subline, action, fallbackIcon = "film-outline", children }: Props) {
  const heroHeight = useTitleHeroHeight();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // "open": the art settles in from a slight zoom; "float": the action rises in after it.
  const artScale = useSharedValue(reduceMotion ? 1 : 1.08);
  const artOpacity = useSharedValue(reduceMotion ? 1 : 0.3);
  const actionIn = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      artScale.value = 1;
      artOpacity.value = 1;
      actionIn.value = 1;
      return;
    }
    const easing = Easing.bezier(0.2, 0.8, 0.2, 1);
    artScale.value = withTiming(1, { duration: 320, easing });
    artOpacity.value = withTiming(1, { duration: 320, easing });
    actionIn.value = withDelay(120, withTiming(1, { duration: 400, easing }));
  }, [reduceMotion, artScale, artOpacity, actionIn]);

  const artStyle = useAnimatedStyle(() => ({ opacity: artOpacity.value, transform: [{ scale: artScale.value }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: actionIn.value,
    transform: [{ translateY: (1 - actionIn.value) * 12 }, { scale: 0.9 + actionIn.value * 0.1 }],
  }));

  return (
    <View style={[styles.hero, { minHeight: heroHeight }]}>
      <View style={styles.artClip} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
          {artUrl ? (
            <Image
              source={{ uri: artUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
              priority="high"
              accessible={false}
            />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name={fallbackIcon} size={44} color={theme.colors.textFaint} />
            </View>
          )}
        </Animated.View>
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0.7), withAlpha(theme.colors.background, 0)]}
          style={[styles.topScrim, { height: insets.top + TOP_SCRIM }]}
        />
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.86), theme.colors.background]}
          locations={[0, 0.62, 1]}
          style={[styles.bottomScrim, { height: Math.min(BOTTOM_SCRIM, heroHeight * 0.62) }]}
        />
      </View>

      <View
        style={[
          styles.text,
          { paddingTop: insets.top + 64 },
          action ? { paddingRight: ACTION_LANE } : styles.textNoAction,
        ]}
      >
        {(accessType || kindLabel) && (
          <View style={styles.kindRow}>
            {accessType ? <AccessBadge accessType={accessType} /> : null}
            {kindLabel ? (
              <ThemedText variant="caption" weight="medium" color={theme.colors.textBody}>
                {kindLabel}
              </ThemedText>
            ) : null}
          </View>
        )}
        <ThemedText variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
        {subline ? (
          <ThemedText variant="caption" weight="bold" color={theme.colors.textBody} style={styles.subline}>
            {subline}
          </ThemedText>
        ) : null}
        {children}
      </View>

      {action ? (
        <Animated.View style={[styles.actionSlot, actionStyle]}>
          <HeroActionButton action={action} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function HeroActionButton({ action }: { action: HeroAction }) {
  const reduceMotion = useReducedMotion();
  const { kind } = action;
  const fill =
    kind === "locked" ? theme.colors.premium : kind === "disabled" ? theme.colors.surfaceElevated : theme.colors.play;
  const ink = kind === "locked" ? theme.colors.onPremium : kind === "disabled" ? theme.colors.textMuted : theme.colors.onPlay;
  const inert = kind === "busy" || kind === "disabled" || !action.onPress;

  return (
    <Pressable
      onPress={action.onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityState={{ disabled: inert, busy: kind === "busy" }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: fill },
        kind !== "disabled" && styles.actionLifted,
        pressed && !inert && (reduceMotion ? styles.actionPressedStill : styles.actionPressed),
      ]}
    >
      {kind === "busy" ? (
        <PulseDots color={theme.colors.onPlay} />
      ) : kind === "locked" ? (
        <Ionicons name="lock-closed" size={26} color={ink} />
      ) : (
        <Ionicons name="play" size={28} color={ink} style={styles.playGlyph} />
      )}
    </Pressable>
  );
}

/** The hero's silhouette while the title loads: the art block, then the title lines. */
export function TitleHeroSkeleton() {
  const heroHeight = useTitleHeroHeight();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width="100%" height={heroHeight} radius="xs" style={styles.skeletonArt} />
      <View style={styles.skeletonText}>
        <Skeleton width="62%" height={30} radius="sm" />
        <Skeleton width="38%" height={14} radius="xs" style={styles.skeletonGap} />
        <View style={styles.skeletonStats}>
          <Skeleton width={72} height={36} radius="sm" />
          <Skeleton width={72} height={36} radius="sm" />
          <Skeleton width={72} height={36} radius="sm" />
        </View>
        <Skeleton width="100%" height={14} radius="xs" style={styles.skeletonLine} />
        <Skeleton width="92%" height={14} radius="xs" style={styles.skeletonLineTight} />
        <Skeleton width="70%" height={14} radius="xs" style={styles.skeletonLineTight} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { justifyContent: "flex-end", zIndex: 1 },
  artClip: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: theme.colors.surface },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", bottom: 0, left: 0, right: 0 },
  text: { paddingLeft: theme.layout.screenPadding, paddingBottom: 26 },
  textNoAction: { paddingRight: theme.layout.screenPadding },
  kindRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  title: { marginTop: 10 },
  subline: { marginTop: 6 },
  actionSlot: { position: "absolute", right: theme.layout.screenPadding, bottom: -ACTION_DROP },
  action: {
    width: HERO_ACTION_SIZE,
    height: HERO_ACTION_SIZE,
    borderRadius: HERO_ACTION_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The board's 0 14 36 rgba(0,0,0,0.6) lift — the theme's largest shadow. */
  actionLifted: theme.shadow.lg,
  actionPressed: { transform: [{ scale: 0.96 }] },
  actionPressedStill: { opacity: 0.8 },
  /** The play triangle's optical centre sits right of its box. */
  playGlyph: { marginLeft: 3 },
  skeletonArt: { borderRadius: 0 },
  skeletonText: { marginTop: -60, paddingHorizontal: theme.layout.screenPadding },
  skeletonGap: { marginTop: 14 },
  skeletonStats: { flexDirection: "row", gap: theme.spacing.md, marginTop: HERO_BODY_OFFSET },
  skeletonLine: { marginTop: 28 },
  skeletonLineTight: { marginTop: 10 },
});
