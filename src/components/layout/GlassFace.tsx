import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";

/**
 * THE GLASS ON EVERY TOP-BAR BUTTON (owner, 2026-11-10: "every page build it
 * i like it"; canvas page "Top bar", MoviesScreen.dc.html and
 * MoviesSpec.dc.html). It is the bottom bar's Liquid Glass recipe
 * (components/layout/TabBar) at control size, kept in this one place so the
 * round 44pt circles (AppBarAction, the avatar, IconButton's `overlay`) and
 * the 40pt pills (GlassChip) can never drift apart.
 *
 * Back to front, all clipped to the control's round shape:
 *   1. the blur of what is behind (iOS only, see below);
 *   2. a dark tint, black at 50%, so the white glyph reads over any picture
 *      (or, where no blur is drawn, a nearly solid dark fill);
 *   3. a soft shine on the upper half;
 *   4. a thin bright line along the top edge;
 *   5. a hairline rim, so the control has an edge over white and black alike;
 *   6. a light layer while a finger is down, under Reduce Motion only (the
 *      control cannot shrink then, so this is its press feedback).
 * Outside the clip: a soft shadow under it. React Native draws an outset
 * `boxShadow` only OUTSIDE the view's rounded box (Android cuts the box out,
 * iOS masks it), so the shadow never darkens the see-through glass.
 *
 * `picked` is the same glass tinted red (the chosen category, like the
 * bottom bar's lens), with a stronger top line and rim.
 *
 * WHERE THE BLUR IS DRAWN. iOS draws a real blur in every control, as the
 * old discs did. ANDROID NEVER BLURS A BUTTON: Android can only blur through
 * a BlurTargetView, and each Dimezis blur re-renders the whole page into a
 * bitmap on every frame, so six buttons would mean six full-page renders per
 * frame. Android buttons wear the solid fill with the same shine, top line,
 * rim and shadow; the one Android blur at the top is the scroll-edge fade's
 * (ANDROID_TOP_BLUR in components/layout/GlassBar). iOS with Reduce
 * Transparency, and any control asked to be `solid` (a greyed one, which
 * sits under 45% opacity — an iOS blur under a parent with alpha < 1 renders
 * broken), also get the solid fill.
 *
 * It fills its parent (absolutely positioned) and takes no touches: put it
 * first inside the control so the glyph or the words draw over it.
 */

/** The blur's strength (expo-blur's 1–100): the bottom bar's value, never 0. */
export const CONTROL_BLUR_INTENSITY = 50;
/** Over a real blur: what is behind, darkened by black at 50%. */
export const CONTROL_TINT = "rgba(20,20,26,0.50)";
/** Where no blur is drawn (Android, Reduce Transparency, `solid`): the bottom bar's nearly solid fill. */
export const CONTROL_SOLID_TINT = "rgba(26,26,32,0.94)";
/** The picked control: the crimson `primary` at 40%, the bottom bar's lens colour. */
export const CONTROL_PICKED_TINT = "rgba(224,24,31,0.40)";
/** "A soft shine on the upper half": white fading out by 60% of the height. */
const SHEEN_COLORS = ["rgba(255,255,255,0.14)", "rgba(255,255,255,0)"] as const;
const PICKED_SHEEN_COLORS = ["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"] as const;
const SHEEN_STOPS = [0, 0.6] as const;
/** "A thin bright line along the top edge." */
const EDGE_LIGHT = "inset 0 1px 0 rgba(255,255,255,0.35)";
const PICKED_EDGE_LIGHT = "inset 0 1px 0 rgba(255,255,255,0.45)";
/** "A hairline rim, white at 22%." */
const RIM = "rgba(255,255,255,0.22)";
const PICKED_RIM = "rgba(255,255,255,0.28)";
/** "A soft shadow under it: 6pt down, 16pt wide, black at 30%." */
export const CONTROL_SHADOW = "0 6px 16px rgba(0,0,0,0.30)";
/** Laid over the glass while a finger is down, under Reduce Motion only. */
const PRESS_FILL = "rgba(255,255,255,0.10)";

/**
 * Whether a glass control blurs on this phone: iOS without Reduce
 * Transparency. Never on Android (see the note above).
 */
export function useControlBlur(): boolean {
  const reduceTransparency = useReduceTransparency();
  return Platform.OS === "ios" && !reduceTransparency;
}

interface Props {
  /** Half the control's height (or width, for a circle): fully round ends. */
  radius: number;
  /** The chosen one: the same glass tinted red. */
  picked?: boolean;
  /** Shows the press layer — pass `reduceMotion && pressed`; otherwise the control shrinks instead. */
  pressed?: boolean;
  /** No blur, whatever the phone: for a control under partial opacity (a greyed pill). */
  solid?: boolean;
}

export function GlassFace({ radius, picked = false, pressed = false, solid = false }: Props) {
  const drawBlur = useControlBlur() && !solid;
  const round = { borderRadius: radius };
  return (
    <View pointerEvents="none" style={[styles.face, round]}>
      <View style={[styles.clip, round]}>
        {drawBlur ? (
          <BlurView intensity={CONTROL_BLUR_INTENSITY} tint="dark" style={[styles.layer, round]} />
        ) : null}
        <View
          style={[
            styles.layer,
            { backgroundColor: drawBlur ? (picked ? CONTROL_PICKED_TINT : CONTROL_TINT) : CONTROL_SOLID_TINT },
          ]}
        />
        {/* No blur: the red goes over the solid fill, as the bottom bar's lens sits on its solid capsule. */}
        {picked && !drawBlur ? <View style={[styles.layer, styles.pickedOverSolid]} /> : null}
        <LinearGradient colors={picked ? PICKED_SHEEN_COLORS : SHEEN_COLORS} locations={SHEEN_STOPS} style={styles.layer} />
        <View style={[styles.layer, round, { boxShadow: picked ? PICKED_EDGE_LIGHT : EDGE_LIGHT }]} />
        <View style={[styles.layer, round, styles.rim, { borderColor: picked ? PICKED_RIM : RIM }]} />
        {pressed ? <View style={[styles.layer, styles.press]} /> : null}
      </View>
    </View>
  );
}

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create({
  /** Unclipped, so its outset shadow can fall outside the round box. */
  face: { ...FILL, boxShadow: CONTROL_SHADOW },
  clip: { ...FILL, overflow: "hidden" },
  layer: FILL,
  pickedOverSolid: { backgroundColor: CONTROL_PICKED_TINT },
  rim: { borderWidth: StyleSheet.hairlineWidth },
  press: { backgroundColor: PRESS_FILL },
});
