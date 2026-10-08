import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The withdrawal-code boards' own line icons, drawn from the same 24×24
 * paths so the shield-and-lock, the timer and the keypad's delete key look
 * exactly as approved — Ionicons has no shield-with-padlock, and the app
 * already draws its own artwork with react-native-svg. Decoration only: each
 * one sits next to words (or inside a labelled button) that say the same.
 */
export type CodeGlyphName =
  | "shieldLock"
  | "shieldCheck"
  | "timer"
  | "sms"
  | "backspace"
  | "alert"
  | "check"
  | "startOver"
  | "resend"
  | "clock";

interface Props {
  name: CodeGlyphName;
  size: number;
  color: string;
  /** The boards' stroke for this use (2 for discs, 2.2 for small inline marks, 1.9 for the delete key). */
  strokeWidth?: number;
}

const DEFAULT_STROKE: Record<CodeGlyphName, number> = {
  shieldLock: 2,
  shieldCheck: 2,
  timer: 2,
  sms: 2,
  backspace: 1.9,
  alert: 2.2,
  check: 2.4,
  startOver: 2.2,
  resend: 2.2,
  clock: 2.2,
};

const SHIELD = "M12 3.5l7 2.8v5.2c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6.3z";

export function CodeGlyph({ name, size, color, strokeWidth }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth: strokeWidth ?? DEFAULT_STROKE[name],
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === "shieldLock" ? (
        <>
          <Path d={SHIELD} {...stroke} />
          <Rect x={9.25} y={11} width={5.5} height={4.5} rx={1} {...stroke} />
          <Path d="M10.5 11V9.8a1.5 1.5 0 0 1 3 0V11" {...stroke} />
        </>
      ) : null}
      {name === "shieldCheck" ? (
        <>
          <Path d={SHIELD} {...stroke} />
          <Path d="M9 12l2.2 2.2L15.5 10" {...stroke} />
        </>
      ) : null}
      {name === "timer" ? (
        <>
          <Circle cx={12} cy={12.5} r={8} {...stroke} />
          <Path d="M12 8.5v4l2.5 1.5" {...stroke} />
          <Path d="M9.5 2.5h5" {...stroke} />
        </>
      ) : null}
      {name === "sms" ? (
        <>
          <Path d="M5 18.5V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H9.5z" {...stroke} />
          <Path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" {...stroke} />
        </>
      ) : null}
      {name === "backspace" ? (
        <>
          <Path d="M9 5.5h10A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12z" {...stroke} />
          <Path d="M11.5 9.5l5 5M16.5 9.5l-5 5" {...stroke} />
        </>
      ) : null}
      {name === "alert" ? (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M12 7.5v5.5M12 16.5v.01" {...stroke} />
        </>
      ) : null}
      {name === "check" ? <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} /> : null}
      {name === "startOver" ? (
        <>
          <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" {...stroke} />
          <Path d="M4.5 4.5v4h4" {...stroke} />
        </>
      ) : null}
      {name === "resend" ? (
        <>
          <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" {...stroke} />
          <Path d="M19.5 4.5v4h-4" {...stroke} />
        </>
      ) : null}
      {name === "clock" ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
