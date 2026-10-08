import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { onSolid, theme } from "@/theme";

export type PillTone =
  | "primary"
  | "success"
  | "warning"
  | "neutral"
  | "overlay"
  | "premium"
  | "finance"
  | "danger"
  | "info"
  | "brand";

/**
 * "md" (default) — the 34pt metadata chip (a title's genres, its year).
 * "sm" — the 24pt LABEL chip, radius 6: NEW, PREMIUM, an episode tag.
 */
export type PillSize = "md" | "sm";

interface Props {
  children: React.ReactNode;
  tone?: PillTone;
  /** Solid pills read as badges; the default tinted style reads as metadata. */
  solid?: boolean;
  size?: PillSize;
  /**
   * Leading glyph, rendered as a SIBLING of the label rather than inside it.
   * Never put an `<Ionicons>` in `children`: it would nest inside the label's
   * `<Text>`, where a screen reader announces the icon font's private-use
   * codepoint before the words and the glyph inherits the label's tracking.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon ink — defaults to the tone's label colour. */
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
}

interface ToneStyle {
  /** Resting fill. */
  backgroundColor: string;
  /** Resting ink (≥ 4.5:1 on the fill over the page ground). */
  color: string;
  /** `solid` fill; its ink comes from onSolid(). */
  solidBg: string;
}

/**
 * Marquee pills have no border: a neutral pill is the raised #1C1C23 fill with
 * white ink, a role pill is its own soft tint with role ink, and `overlay` is
 * the dark glass chip stamped on artwork. Crimson words use `link`, because
 * crimson text on its own tint is only 3.7:1.
 */
const TONE_STYLES: Record<PillTone, ToneStyle> = {
  primary: { backgroundColor: theme.colors.primarySoft, color: theme.colors.link, solidBg: theme.colors.primary },
  brand: { backgroundColor: theme.colors.brandSoft, color: theme.colors.link, solidBg: theme.colors.brand },
  success: { backgroundColor: theme.colors.successSoft, color: theme.colors.success, solidBg: theme.colors.success },
  finance: { backgroundColor: theme.colors.financeSoft, color: theme.colors.finance, solidBg: theme.colors.finance },
  premium: { backgroundColor: theme.colors.premiumSoft, color: theme.colors.premium, solidBg: theme.colors.premium },
  warning: { backgroundColor: theme.colors.warningSoft, color: theme.colors.warning, solidBg: theme.colors.warning },
  danger: { backgroundColor: theme.colors.dangerSoft, color: theme.colors.danger, solidBg: theme.colors.danger },
  info: { backgroundColor: theme.colors.infoSoft, color: theme.colors.info, solidBg: theme.colors.info },
  // Solid neutral = the "selected" look everywhere else in Marquee: white.
  neutral: { backgroundColor: theme.colors.surfaceElevated, color: theme.colors.text, solidBg: theme.colors.play },
  overlay: { backgroundColor: theme.colors.artBadge, color: theme.colors.text, solidBg: theme.colors.scrim },
};

/** Small non-interactive status/metadata chip. For a tappable one use `common/Chip`. */
export function Pill({ children, tone = "neutral", solid, size = "md", icon, iconColor, style }: Props) {
  const toneStyle = TONE_STYLES[tone];
  // `overlay`'s solid fill is a near-black scrim — white ink, not onSolid's fallback.
  const ink = solid ? (tone === "overlay" ? theme.colors.text : onSolid(toneStyle.solidBg)) : toneStyle.color;
  const small = size === "sm";

  return (
    <View
      style={[
        styles.container,
        small ? styles.sm : styles.md,
        { backgroundColor: solid ? toneStyle.solidBg : toneStyle.backgroundColor },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={small ? 11 : 14}
          color={iconColor ?? ink}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <ThemedText
        variant={small ? "overline" : "muted"}
        weight={small ? "extrabold" : "semibold"}
        style={{ color: ink }}
      >
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  /** DesignSystem genre chip: 34 tall, radius 17, 14pt label. */
  md: { minHeight: 34, gap: 6, paddingHorizontal: 14, borderRadius: theme.radius.xl },
  /** DesignSystem label chip: 24 tall, 11pt / 800 label. */
  sm: { minHeight: 24, gap: 4, paddingHorizontal: 8, borderRadius: 6 },
});
