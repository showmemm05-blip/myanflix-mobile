import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { clamp } from "@/utils/format";
import { theme } from "@/theme";
import type { SubtitleSize } from "@/store/playerPrefsStore";

/**
 * CUSTOM SUBTITLE RENDERING — why the player doesn't paint these.
 *
 * expo-video offers nothing to style a caption with: the player exposes only
 * which rendition is on, and its renderer draws bottom-anchored text at a size
 * the app cannot touch — landing under our own control bar, at a size the
 * viewer cannot change. So the native `subtitleTrack` is held at `null` and
 * the cues are fetched, parsed and drawn here instead, which is exactly what
 * the web player does with its TextTracks in `hidden` mode.
 *
 * This is a port of the website's `components/player/SubtitleOverlay.tsx`, and
 * the numbers below are its CSS translated rather than re-invented, so the two
 * clients render the same caption at the same size in the same place.
 */

interface Props {
  /** The active cues' text, markup stripped; one entry per simultaneous cue. */
  lines: string[];
  size: SubtitleSize;
  background: boolean;
  /** True while the control bar is showing — the caption steps up out of its way. */
  liftForControls: boolean;
  /** The video stage's measured size; both offsets are percentages of it on the web. */
  stageWidth: number;
  stageHeight: number;
  /** Safe-area padding — non-zero only in fullscreen, where the stage is edge-to-edge. */
  edgeInsets: { bottom: number; left: number; right: number };
}

/**
 * The web sizes captions with `clamp(<floor>, <n>vw, <ceiling>)` so they track
 * the video between a phone and a fullscreen desktop. `vw` there is the
 * viewport; here it is the stage, which is what the caption actually sits on.
 * Floors and ceilings are the rem values at the browser's 16px root:
 * small clamp(0.8rem, 1.6vw, 1.05rem), medium clamp(0.95rem, 2.2vw, 1.4rem),
 * large clamp(1.15rem, 3vw, 1.9rem).
 */
const FONT_SIZE: Record<SubtitleSize, { stage: number; min: number; max: number }> = {
  small: { stage: 0.016, min: 12.8, max: 16.8 },
  medium: { stage: 0.022, min: 15.2, max: 22.4 },
  large: { stage: 0.03, min: 18.4, max: 30.4 },
};

/** The web's `clamp(0.75rem, 5%, 2.5rem)` resting offset. */
const RESTING = { stage: 0.05, min: 12, max: 40 };

/**
 * The web's lifted offset is `clamp(4.25rem, 16%, 7.5rem)`. The percentage and
 * the ceiling carry over as-is; the 68pt floor does NOT, because mobile's
 * control bar is the taller of the two — its progress hit area (16 + 5 + 16),
 * 44pt action row and 8pt bottom padding measure ~89pt up from the stage edge.
 * A 68pt floor would put the caption on top of the scrub bar, so the floor
 * grows to keep the SAME clearance the website has.
 *
 * Mobile also has an obstruction the website does not: skip · play · skip sit
 * in the MIDDLE of the stage (PlayerControls' `centerControls` is an
 * absoluteFill row) whenever the bar is up, where the web shows its centre
 * play button only while PAUSED. Fullscreen and tablet stages have room for
 * both. An inline 16:9 stage — about 219pt tall on a 390pt-wide phone — has
 * none at any offset: the bar reaches 89pt up, the play button spans 73.5pt to
 * 145.5pt and the top bar comes down to 135pt.
 *
 * The caption lifts anyway. A stage too small for both is a reason for the
 * controls to cross the caption for the three seconds they are up — they are
 * opaque, momentary, and the thing the viewer just reached for — and never a
 * reason for the caption to leave, which would cost the viewer the line being
 * spoken every time they touched the screen. The website makes the same trade
 * in the other direction (its caption is z-5: above the play button, below the
 * z-10 bar); here the controls are the later sibling and paint over it
 * instead. Either way both stay on screen.
 */
const LIFTED = { stage: 0.16, min: 96, max: 120 };

/** CSS `ease-out` is exactly this curve; the duration is the web's 300ms. */
const LIFT_DURATION_MS = 300;
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

/**
 * Myanmar blocks never render tighter than this multiple of the font size —
 * the same floor `RichText` applies in the readers, because Android clips the
 * stacked combining marks at normal leading. Declared here rather than
 * imported from RichText, which would drag expo-image and the reader fonts
 * into the player for one regex.
 */
const MYANMAR_SCRIPT = /[က-႟ꩠ-ꩿ]/;
const MYANMAR_LEADING_FLOOR = 1.8;
/** The web's unitless `line-height: 1.35`. */
const LEADING = 1.35;

/**
 * Memoized: the player renders four times a second off the playback tick, but
 * `lines` only changes when the caption does (Player holds the previous array
 * while the visible text is identical). Every other prop is a primitive or a
 * memoized object, so this now renders once per caption, not once per tick.
 */
export const SubtitleOverlay = memo(function SubtitleOverlay({
  lines,
  size,
  background,
  liftForControls,
  stageWidth,
  stageHeight,
  edgeInsets,
}: Props) {
  const reduceMotion = useReducedMotion();

  const scale = FONT_SIZE[size];
  // Not rounded: React Native takes a fractional font size, and rounding would
  // drift away from what the same clamp produces in the browser.
  const fontSize = clamp(stageWidth * scale.stage, scale.min, scale.max);
  const text = lines.join("\n");
  const lineHeight = fontSize * (MYANMAR_SCRIPT.test(text) ? MYANMAR_LEADING_FLOOR : LEADING);

  const sidePadding = theme.spacing.md + Math.max(edgeInsets.left, edgeInsets.right);
  // The web caps the measure at min(92%, 60ch) so a long sentence wraps into
  // readable lines instead of one edge-to-edge strip. A digit advance of
  // ~0.55em in Noto Sans Myanmar makes 60ch ≈ 33em.
  const maxWidth = Math.min((stageWidth - sidePadding * 2) * 0.92, fontSize * 33);

  const resting = clamp(stageHeight * RESTING.stage, RESTING.min, RESTING.max) + edgeInsets.bottom;
  const lifted = clamp(stageHeight * LIFTED.stage, LIFTED.min, LIFTED.max) + edgeInsets.bottom;

  // `bottom` stays put and the lift is a transform so the animation can run on
  // the UI thread; the web animates `bottom` itself, which has no equivalent.
  // Driven from an effect rather than inline in the style worklet because this
  // component re-renders on every playback tick, and the animation must only
  // be re-aimed when the lift itself actually changes.
  const lift = useSharedValue(0);
  useEffect(() => {
    const target = liftForControls ? -(lifted - resting) : 0;
    lift.value = reduceMotion
      ? target
      : withTiming(target, { duration: LIFT_DURATION_MS, easing: EASE_OUT });
  }, [lift, liftForControls, lifted, resting, reduceMotion]);

  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    // The website unmounts this node between cues; here the wrapper stays
    // mounted and only the plate comes and goes, because an unmount would
    // restart the lift animation from scratch mid-transition.
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { bottom: resting, paddingHorizontal: sidePadding }, liftStyle]}
    >
      {lines.length > 0 && stageWidth > 0 && (
        <View style={[{ maxWidth }, background && styles.plate]}>
          <ThemedText
            variant="body"
            weight="medium"
            // Pure white, not theme.colors.text: a caption sits on arbitrary
            // picture, and this is the one colour the website uses for it.
            color="#FFFFFF"
            style={[styles.text, { fontSize, lineHeight }, !background && styles.textShadow]}
          >
            {text}
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  plate: {
    // Literal black at 75% (the web's bg-black/75) — theme.colors.scrim is
    // navy-tinted and would tint the picture behind the caption.
    backgroundColor: "rgba(0,0,0,0.75)",
    // 12, the same number the site's --radius resolves to for rounded-lg.
    borderRadius: theme.radius.lg,
    // The web's px-3 / py-1.5.
    paddingHorizontal: 12,
    paddingVertical: 6,
    // The web's backdrop-blur-[2px] is deliberately dropped: under a
    // 75%-opaque plate it is invisible, and a BlurView would double-darken
    // the picture for the cost of a whole extra native layer.
  },
  // No counterpart to the web's `[overflow-wrap:anywhere]` is set because there
  // is none to set: a token too long for the plate is already broken between
  // characters by both platforms' own line breakers, which is the behaviour
  // that property buys in the browser.
  text: { textAlign: "center" },
  // React Native draws ONE text shadow, so the web's crisp
  // `0 1px 2px rgba(0,0,0,0.9)` plus its `0 0 8px rgba(0,0,0,0.7)` halo
  // collapse into a single pass; radius 4 splits the difference between them.
  textShadow: {
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
