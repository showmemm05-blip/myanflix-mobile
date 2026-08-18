import { Text, type TextProps } from "react-native";
import { tabularNums, theme, type TypeVariant } from "@/theme";

export type ThemedTextWeight = "regular" | "medium" | "semibold" | "bold";
export type ThemedTextVariant =
  | "body"
  | "title"
  /** Alias kept for existing call sites — renders exactly like `display`. */
  | "heading"
  | "caption"
  | "muted"
  | "label"
  /* added in the Aurora redesign — the full type scale from theme.type */
  | "display"
  | "section"
  | "overline";

interface Props extends TextProps {
  weight?: ThemedTextWeight;
  variant?: ThemedTextVariant;
  /** Renders digits with tabular figures — use for money, durations, counts, times. */
  tabular?: boolean;
  /** Shorthand for a one-off color without writing a style object. */
  color?: string;
}

/**
 * Which role in `theme.type` each variant renders at. Sizes/weights/tracking
 * live ONLY in the token file — this map exists so the extra `heading` alias
 * keeps working, and so nothing here can silently drift from `theme.type`.
 */
const VARIANT_ROLE: Record<ThemedTextVariant, TypeVariant> = {
  /** Screen-owning hero copy (balance, hero title). */
  display: "display",
  heading: "display",
  /** Large title on app bars and page headers. */
  title: "title",
  /** Rail / group headings. */
  section: "section",
  body: "body",
  /** Meta lines under titles. */
  caption: "caption",
  /** Quieter secondary copy. */
  muted: "muted",
  /** Form labels and small emphasised keys. */
  label: "label",
  /** Eyebrow above a section title. */
  overline: "overline",
};

/** Default ink per variant — the one thing the type scale doesn't carry. */
const VARIANT_COLOR: Record<ThemedTextVariant, string> = {
  display: theme.colors.text,
  heading: theme.colors.text,
  title: theme.colors.text,
  section: theme.colors.text,
  body: theme.colors.text,
  caption: theme.colors.textMuted,
  muted: theme.colors.textFaint,
  label: theme.colors.textMuted,
  overline: theme.colors.textFaint,
};

/**
 * Every screen must use this instead of RN's raw `Text` — Myanmar script
 * needs Noto Sans Myanmar to render correctly (system fonts drop glyphs /
 * mis-stack combining marks on many Android devices), and this is the one
 * place that font is wired in.
 */
export function ThemedText({ variant = "body", weight, tabular, color, style, ...rest }: Props) {
  const scale = theme.type[VARIANT_ROLE[variant]];
  const resolvedWeight: ThemedTextWeight = weight ?? scale.weight;

  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: theme.font[resolvedWeight],
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          color: color ?? VARIANT_COLOR[variant],
          letterSpacing: scale.letterSpacing,
        },
        tabular && tabularNums,
        style,
      ]}
    />
  );
}
