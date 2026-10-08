import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

/**
 * The player's line glyphs, drawn from the approved boards' own 24×24 paths
 * (Player / PlayerLandscape / PlayerEpisodes .dc.html) with react-native-svg,
 * which the app already ships. Ionicons has no equivalent for several of them
 * (the "10" skip rings, the caption box, the sliders, the screen-with-stand),
 * and mixing two icon families in one control bar reads as two products.
 * Strokes are rounded at the boards' widths; the filled ones are filled.
 */
export type PlayerGlyphName =
  | "back"
  | "episodes"
  | "subtitles"
  | "settings"
  | "speed"
  | "volume"
  | "muted"
  | "enterFullscreen"
  | "exitFullscreen"
  | "next"
  | "play"
  | "pause"
  | "seekBack"
  | "seekForward"
  | "crown"
  | "check"
  | "nowPlaying"
  | "lock"
  | "alert"
  | "warning";

interface Props {
  name: PlayerGlyphName;
  size?: number;
  color?: string;
}

export const PlayerGlyph = memo(function PlayerGlyph({ name, size = 22, color = theme.colors.text }: Props) {
  const stroke = { stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      {(() => {
        switch (name) {
          case "back":
            return <Path d="M15 5l-7 7 7 7" {...stroke} strokeWidth={2.2} />;
          case "episodes":
            return (
              <>
                <Path d="M4 5.5h16v10H4z" {...stroke} strokeWidth={2} />
                <Path d="M7 19h10" {...stroke} strokeWidth={2} />
              </>
            );
          case "subtitles":
            return (
              <>
                <Path
                  d="M3.5 7A2.5 2.5 0 0 1 6 4.5h12A2.5 2.5 0 0 1 20.5 7v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17z"
                  {...stroke}
                  strokeWidth={2}
                />
                <Path d="M7 12.5h4M13.5 12.5H17M7 15.5h6" {...stroke} strokeWidth={2} />
              </>
            );
          case "settings":
            return (
              <>
                <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...stroke} strokeWidth={2} />
                <Circle cx={15} cy={7} r={2} {...stroke} strokeWidth={2} />
                <Circle cx={9} cy={17} r={2} {...stroke} strokeWidth={2} />
              </>
            );
          case "speed":
            return (
              <>
                <Path d="M4.5 17a8 8 0 1 1 15 0" {...stroke} strokeWidth={2} />
                <Path d="M12 14l4-4.5" {...stroke} strokeWidth={2} />
              </>
            );
          case "volume":
            return (
              <>
                <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...stroke} strokeWidth={2} />
                <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...stroke} strokeWidth={2} />
              </>
            );
          case "muted":
            return (
              <>
                <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...stroke} strokeWidth={2} />
                <Path d="M16 9.5l5 5M21 9.5l-5 5" {...stroke} strokeWidth={2} />
              </>
            );
          case "enterFullscreen":
            return <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...stroke} strokeWidth={2.2} />;
          case "exitFullscreen":
            return <Path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" {...stroke} strokeWidth={2.2} />;
          case "next":
            return (
              <>
                <Path
                  d="M5 5.6v12.8c0 .8.9 1.2 1.5.8l9-6.4c.5-.4.5-1.2 0-1.6l-9-6.4C5.9 4.4 5 4.8 5 5.6z"
                  fill={color}
                />
                <Path d="M17.5 5h2.2v14h-2.2z" fill={color} />
              </>
            );
          case "play":
            return (
              <Path
                d="M7 4.8v14.4c0 .8.9 1.3 1.6.8l11-7.2c.6-.4.6-1.2 0-1.6l-11-7.2C7.9 3.5 7 4 7 4.8z"
                fill={color}
              />
            );
          case "pause":
            return <Path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill={color} />;
          case "seekForward":
            return <Path d="M3 7v10l7-5zM11 7v10l7-5z" fill={color} />;
          case "seekBack":
            return <Path d="M21 7v10l-7-5zM13 7v10l-7-5z" fill={color} />;
          case "crown":
            return <Path d="M3 18h18l1-11-5.5 4L12 4 7.5 11 2 7z" fill={color} />;
          case "check":
            return <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={3} />;
          case "nowPlaying":
            return <Path d="M5 10v4M9.5 6v12M14 8v8M18.5 11v2" {...stroke} strokeWidth={2.6} />;
          case "lock":
            return (
              <>
                <Rect x={5} y={10.5} width={14} height={9.5} rx={2} {...stroke} strokeWidth={2} />
                <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...stroke} strokeWidth={2} />
              </>
            );
          case "alert":
            return (
              <>
                <Circle cx={12} cy={12} r={8.5} {...stroke} strokeWidth={2} />
                <Path d="M12 8v4.5M12 15.8v.1" {...stroke} strokeWidth={2} />
              </>
            );
          case "warning":
            return (
              <>
                <Path d="M12 4l9 16H3z" {...stroke} strokeWidth={2.2} />
                <Path d="M12 10v4M12 17.2v.1" {...stroke} strokeWidth={2.2} />
              </>
            );
          default:
            return null;
        }
      })()}
    </Svg>
  );
});

interface SkipProps {
  direction: "back" | "forward";
  /** Glyph box in pt — 34 inline, 40 in fullscreen (the boards' sizes). */
  size: number;
  /** The seconds a tap moves, printed inside the ring. */
  seconds: number;
  color?: string;
}

/**
 * The boards' "replay 10" ring: an open circle with an arrowhead and the skip
 * length inside it. The ring is the boards' path; the number is real text in
 * the app font, so it renders like the rest of the chrome.
 */
export const SkipGlyph = memo(function SkipGlyph({ direction, size, seconds, color = theme.colors.text }: SkipProps) {
  const back = direction === "back";
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={back ? "M4.5 12a7.5 7.5 0 1 0 2.4-5.5" : "M19.5 12a7.5 7.5 0 1 1-2.4-5.5"} {...stroke} />
        <Path d={back ? "M4.5 3.5v4h4" : "M19.5 3.5v4h-4"} {...stroke} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <ThemedText
          weight="extrabold"
          tabular
          // An icon's numeral, not reading text: it must stay inside its ring.
          allowFontScaling={false}
          style={{
            color,
            fontSize: Math.round(size * 0.27),
            lineHeight: Math.round(size * 0.36),
            marginTop: Math.round(size * 0.08),
          }}
        >
          {String(seconds)}
        </ThemedText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
