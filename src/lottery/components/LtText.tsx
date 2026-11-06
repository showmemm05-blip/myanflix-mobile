import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
import { LT_MYANMAR_FACE, useLtFace } from "@/lottery/theme/fonts";
import {
  LINING_TABULAR,
  LT_TYPE,
  MYANMAR_LINE_BONUS,
  MYANMAR_SCRIPT,
  NUM_TRACKING,
  TABULAR,
  type LtTypeRole,
} from "@/lottery/theme/type";

/**
 * TextProps minus RN's ARIA `role` — the name is taken by the type role here
 * (screen-reader roles go through `accessibilityRole`, as everywhere in the app).
 */
export interface LtTextProps extends Omit<TextProps, "role"> {
  /** The type role (theme/type.ts). Defaults to `body`. */
  role?: LtTypeRole;
  /** Ink; defaults to the role's (ink, kicker ink-3). */
  color?: string;
  /** Tabular figures for a Franklin role (prices, counts). Literata roles always have them. */
  tabular?: boolean;
}

function containsMyanmar(children: TextProps["children"]): boolean {
  if (typeof children === "string") return MYANMAR_SCRIPT.test(children);
  if (Array.isArray(children)) return children.some((c) => typeof c === "string" && MYANMAR_SCRIPT.test(c));
  return false;
}

/**
 * THE text of the Lottery — the only `Text` under src/lottery (the ticket's
 * printed layers excepted: they are artwork and size with the ticket).
 *
 * Burmese runs (ThemedText's own test) swap to Noto Sans Myanmar at the same
 * weight, with no letter spacing, no upper-casing and +4 line height: Libre
 * Franklin and Literata have no Myanmar glyphs, and tracking pulls Burmese
 * combining marks off their consonants.
 *
 * The OS text size is honoured up to 1.6× by default (`maxFontSizeMultiplier`)
 * so a 358pt column still holds a six-digit number on one line.
 */
export function LtText({ role = "body", color, tabular, style, maxFontSizeMultiplier = 1.6, ...rest }: LtTextProps) {
  const face = useLtFace();
  const spec = LT_TYPE[role];
  const myanmar = containsMyanmar(rest.children);

  // The `num` role tracks .06em of whatever size the caller sets.
  let letterSpacing = spec.letterSpacing;
  if (role === "num") {
    const size = StyleSheet.flatten(style)?.fontSize;
    letterSpacing = (typeof size === "number" ? size : spec.fontSize) * NUM_TRACKING;
  }

  const base: TextStyle = myanmar
    ? {
        fontFamily: LT_MYANMAR_FACE[spec.face],
        fontSize: spec.fontSize,
        lineHeight: spec.lineHeight + MYANMAR_LINE_BONUS,
        letterSpacing: 0,
        color: color ?? spec.color,
      }
    : {
        fontFamily: face(spec.face),
        fontSize: spec.fontSize,
        lineHeight: spec.lineHeight,
        letterSpacing,
        textTransform: spec.uppercase ? "uppercase" : "none",
        color: color ?? spec.color,
      };
  const figures = spec.lining ? LINING_TABULAR : tabular ? TABULAR : undefined;
  // A caller's own size wins, but a Burmese run keeps its taller line and no
  // tracking even then: a fixed English line height clips the stacked marks,
  // and letter spacing pulls them off their consonants.
  const burmeseFix = myanmar ? burmeseOverrides(style) : undefined;

  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[base, figures ? { fontVariant: figures } : undefined, style, burmeseFix]}
    />
  );
}

function burmeseOverrides(style: TextProps["style"]): TextStyle | undefined {
  const flat = StyleSheet.flatten(style);
  if (!flat) return undefined;
  const lineHeight = typeof flat.lineHeight === "number" ? flat.lineHeight + MYANMAR_LINE_BONUS : undefined;
  const tracked = Boolean(flat.letterSpacing);
  if (lineHeight === undefined && !tracked) return undefined;
  return {
    ...(lineHeight === undefined ? {} : { lineHeight }),
    ...(tracked ? { letterSpacing: 0 } : {}),
  };
}
