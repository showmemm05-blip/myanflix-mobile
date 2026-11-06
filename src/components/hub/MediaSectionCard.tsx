import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton } from "@/components/common/Skeleton";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { hasMyanmar } from "@/components/hub/hubLayout";
import { SECTION_ICON, type MediaSection } from "@/components/hub/mediaSections";
import { theme, withAlpha } from "@/theme";

/**
 * A pressable card's artwork: the 160° wash, the glow disc in the corner,
 * and — only where a card asks for them — its own hairline and glyph tile
 * (the Lottery hub's Thai card: a cream edge and a cream disc with a red
 * ticket, a piece of the white Ivory app shown on the dark page).
 */
export interface SectionCardArt {
  wash: readonly [string, string];
  glow: string;
  glowAlpha: number;
  /** The inner hairline; white at 8% unless the card says otherwise. */
  edge?: string;
  /** The glyph tile's fill and ink; the raised tonal with white ink unless the card says otherwise. */
  tile?: { fill: string; ink: string };
}

interface BaseProps {
  title: string;
  /** The live line under the name ("1,240 titles · 12 new"); null while it loads. */
  line: string | null;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Omitted for a "Soon" card: dimmed, dashed, tagged, nothing to press. */
  onPress?: () => void;
  /** The tag on a "Soon" card. */
  soonLabel?: string;
  /** Width of the skeleton that stands in for the line while it loads (the board's 104; the Lottery hub's Thai card draws 116). */
  lineSkeletonWidth?: number;
}

/** One of the Media sections — its own glyph and wash (SECTION_ICON, ART). */
interface SectionLook {
  section: MediaSection;
  icon?: undefined;
  art?: undefined;
}

/** Any other card (the Lottery hub's games): its own glyph, and its artwork when it is pressable. */
interface CustomLook {
  section?: undefined;
  icon: keyof typeof Ionicons.glyphMap;
  art?: SectionCardArt;
}

type Props = BaseProps & (SectionLook | CustomLook);

/** The board: 140pt tall, radius 18. */
const CARD_HEIGHT = 140;
const CARD_RADIUS = 18;
/** The 40pt glyph tile top-left, and the glow disc tucked into the top-right corner. */
const TILE = 40;
const GLOW = 120;
/** The skeleton that stands in for the live line (the board's 104 × 10). */
const LINE_SKELETON_WIDTH = 104;

/**
 * Each card's own dark wash (MediaHub.dc.html) — a 160° run from a deep tint
 * to near-black, with a soft disc of the section's colour in the corner.
 * Decorative artwork, like HubFallbackArt's palettes: not UI colour, so it
 * lives here rather than in the theme. Music draws no wash.
 */
const ART: Record<Exclude<MediaSection, "music">, SectionCardArt> = {
  movies: { wash: ["#3A1620", "#16090D"], glow: "#E0181F", glowAlpha: 0.26 },
  series: { wash: ["#10303A", "#071317"], glow: "#7FD6C2", glowAlpha: 0.2 },
  books: { wash: ["#3A2612", "#170E05"], glow: "#F2A65A", glowAlpha: 0.22 },
};
/** A custom card that names no artwork: the raised fill fading to the sheet, a faint white glow. */
const PLAIN_ART: SectionCardArt = {
  wash: [theme.colors.surfaceElevated, theme.colors.surface],
  glow: theme.colors.text,
  glowAlpha: 0.08,
};
/** A 160° gradient on a 1:1-ish card: top-left to bottom-right, leaning down. */
const WASH_START = { x: 0.1, y: 0 };
const WASH_END = { x: 0.9, y: 1 };
/** The card's inner hairline (white at 8%) and the "Soon" card's dashed edge (24%). */
const EDGE = withAlpha(theme.colors.text, 0.08);
const DASHED_EDGE = withAlpha(theme.colors.text, 0.24);

/**
 * One section on the Media hub (MediaHub.dc.html, 2026-10-22: "Choose what to
 * open") — and, since 2026-10-23, one game on the Lottery hub
 * (LotteryHub.dc.html, "Choose a game"): the glyph tile, the name and a live
 * line — "1,240 titles · 12 new", "Draw 1 · closes in 2d 04h" — on the card's
 * own wash. A card with `onPress` opens its page; without one it is a dashed,
 * dimmed card tagged "Soon" that is not a button (spoken disabled, with the
 * "coming soon" hint). The line shows a pulsing bar while it loads (still
 * under reduce motion), never a spinner.
 */
export const MediaSectionCard = memo(function MediaSectionCard(props: Props) {
  const { title, line, accessibilityLabel, accessibilityHint, onPress, soonLabel } = props;
  const glyph = props.section !== undefined ? SECTION_ICON[props.section] : props.icon;
  /** Latin gets the board's tight 20/24; Myanmar script takes no tracking and the Marquee +4 line (see ThemedText). */
  const nameStyle = [styles.name, hasMyanmar(title) ? styles.nameMyanmar : styles.nameLatin];
  if (props.section === "music" || !onPress) {
    return (
      <View
        style={[styles.card, styles.soon]}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: true }}
      >
        {soonLabel ? (
          <View style={styles.tag}>
            <ThemedText variant="overline" color={theme.colors.text} style={styles.tagText}>
              {soonLabel.toUpperCase()}
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.tile, styles.tileSoon]}>
          <Ionicons name={glyph} size={22} color={theme.colors.textMuted} />
        </View>
        <ThemedText weight="black" color={theme.colors.textMuted} numberOfLines={1} style={nameStyle}>
          {title}
        </ThemedText>
        <ThemedText variant="label" weight="regular" color={theme.colors.textFaint} numberOfLines={1}>
          {line ?? ""}
        </ThemedText>
      </View>
    );
  }

  const art = props.section !== undefined ? ART[props.section] : (props.art ?? PLAIN_ART);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={styles.card}
    >
      <LinearGradient colors={art.wash} start={WASH_START} end={WASH_END} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, { backgroundColor: art.glow, opacity: art.glowAlpha }]} pointerEvents="none" />
      <View style={[styles.edge, art.edge ? { borderColor: art.edge } : null]} pointerEvents="none" />
      <View style={[styles.tile, art.tile ? { backgroundColor: art.tile.fill } : null]}>
        <Ionicons name={glyph} size={22} color={art.tile?.ink ?? theme.colors.text} />
      </View>
      <ThemedText weight="black" numberOfLines={1} style={nameStyle}>
        {title}
      </ThemedText>
      {line === null ? (
        <Skeleton width={props.lineSkeletonWidth ?? LINE_SKELETON_WIDTH} height={10} radius="xs" style={styles.lineSkeleton} />
      ) : (
        <ThemedText variant="label" weight="regular" color={theme.colors.textBody} tabular numberOfLines={1}>
          {line}
        </ThemedText>
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: CARD_HEIGHT,
    padding: 14,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  /** The "Soon" card: no wash, a dashed edge, everything a step quieter. */
  soon: { borderWidth: 1.5, borderStyle: "dashed", borderColor: DASHED_EDGE },
  edge: { ...StyleSheet.absoluteFill, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: EDGE },
  glow: {
    position: "absolute",
    top: -34,
    right: -34,
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
  },
  tile: {
    position: "absolute",
    top: 14,
    left: 14,
    width: TILE,
    height: TILE,
    borderRadius: 12,
    backgroundColor: theme.colors.tonal,
    alignItems: "center",
    justifyContent: "center",
  },
  tileSoon: { backgroundColor: withAlpha(theme.colors.text, 0.06) },
  /** The board's 20pt black name, 4pt over the line. */
  name: { fontSize: 20, marginBottom: 4 },
  /** Latin: the board's 24pt line and tight tracking. */
  nameLatin: { lineHeight: 24, letterSpacing: -0.4 },
  /** Myanmar: no tracking (the medials would drift), and room under the line for the below-base marks. */
  nameMyanmar: { lineHeight: 28 },
  /** The board's 10 × 20 "SOON" tag at the top-right corner. */
  tag: {
    position: "absolute",
    top: 12,
    right: 12,
    minHeight: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.text, 0.14),
  },
  tagText: { fontSize: 10 },
  lineSkeleton: { marginTop: 3, marginBottom: 3 },
});
