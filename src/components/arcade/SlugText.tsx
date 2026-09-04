import { Platform, Text, type TextProps } from "react-native";
import { tabularNums, theme } from "@/theme";

/**
 * The storefront's mono "slug" voice — prices, counts, years, ratings and
 * Latin platform tags ONLY. It deliberately bypasses ThemedText: the mono
 * face has no Myanmar glyphs, so a translated word passed through here would
 * fall out of the font. Never hand it translated copy; translated words
 * render beside it in ThemedText (Noto Sans Myanmar).
 */
const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

interface Props extends TextProps {
  /** Ink override — defaults to the muted text tone. */
  color?: string;
}

export function SlugText({ color, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: MONO,
          fontSize: 11,
          lineHeight: 15,
          fontWeight: "500",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: color ?? theme.colors.textMuted,
        },
        tabularNums,
        style,
      ]}
    />
  );
}
