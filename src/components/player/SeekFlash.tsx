import { StyleSheet, View } from "react-native";
import Svg, { Ellipse } from "react-native-svg";
import Animated, { Easing, Keyframe, useReducedMotion } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { theme } from "@/theme";

interface Props {
  side: "left" | "right";
  seconds: number;
}

/**
 * The board's `ripple` keyframes, exactly: `from { opacity: 0; scale(.9) }` to
 * rest over .3s on cubic-bezier(.2,.8,.2,1). Only the ellipse ripples; the
 * arrows and "+10s" are simply there, as on the board. Module scope, so every
 * flash reuses one animation definition.
 */
const RIPPLE_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
}).duration(300);

/**
 * The double-tap seek confirmation (PlayerLandscape.dc.html, "seekFlash"):
 * a soft white ripple swelling in from the tapped edge, with the arrows and
 * "+10s" / "-10s" in the middle of it. The region is about a third of the
 * stage wide, as on the board; the ripple is an ellipse that runs off the
 * edge, drawn with react-native-svg so it is a true ellipse at any stage
 * shape. Decorative and untouchable — the seek has already happened.
 */
export function SeekFlash({ side, seconds }: Props) {
  const reduceMotion = useReducedMotion();
  const right = side === "right";

  return (
    <View
      // Re-keyed per side so a flash on the other side replays its entrance.
      key={side}
      style={[styles.region, right ? styles.regionRight : styles.regionLeft]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View
        entering={reduceMotion ? undefined : RIPPLE_IN}
        // Scales about the ellipse's own centre, as CSS does about the span's.
        style={[StyleSheet.absoluteFill, { transformOrigin: right ? "75% 50%" : "25% 50%" }]}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Ellipse cx={right ? "75%" : "25%"} cy="50%" rx="75%" ry="65%" fill="#FFFFFF" fillOpacity={0.1} />
        </Svg>
      </Animated.View>
      <View style={styles.center}>
        <PlayerGlyph name={right ? "seekForward" : "seekBack"} size={34} />
        <ThemedText weight="extrabold" tabular color={theme.colors.text} style={styles.label}>
          {right ? `+${seconds}s` : `-${seconds}s`}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  region: { position: "absolute", top: 0, bottom: 0, width: "36%", overflow: "hidden" },
  regionLeft: { left: 0 },
  regionRight: { right: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 6 },
  label: { fontSize: 15 },
});
