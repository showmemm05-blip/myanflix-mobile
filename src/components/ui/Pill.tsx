import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export type PillTone =
  | "primary"
  | "success"
  | "warning"
  | "neutral"
  | "overlay"
  /* added in the Aurora redesign */
  | "premium"
  | "finance"
  | "danger"
  | "info"
  | "brand";

interface Props {
  children: React.ReactNode;
  tone?: PillTone;
  /** Solid pills read as badges; the default tinted style reads as metadata. */
  solid?: boolean;
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

const TONE_STYLES: Record<PillTone, { backgroundColor: string; color: string; borderColor: string; solidBg: string; solidColor: string }> = {
  primary: {
    backgroundColor: theme.colors.primarySoft,
    color: theme.colors.primary,
    borderColor: theme.colors.primary + "3D",
    solidBg: theme.colors.primary,
    solidColor: theme.colors.onPrimary,
  },
  success: {
    backgroundColor: theme.colors.successSoft,
    color: theme.colors.success,
    borderColor: theme.colors.success + "3D",
    solidBg: theme.colors.success,
    solidColor: theme.colors.onFinance,
  },
  finance: {
    backgroundColor: theme.colors.financeSoft,
    color: theme.colors.finance,
    borderColor: theme.colors.finance + "3D",
    solidBg: theme.colors.finance,
    solidColor: theme.colors.onFinance,
  },
  premium: {
    backgroundColor: theme.colors.premiumSoft,
    color: theme.colors.premium,
    borderColor: theme.colors.premium + "3D",
    solidBg: theme.colors.premium,
    solidColor: theme.colors.onPremium,
  },
  warning: {
    backgroundColor: theme.colors.warningSoft,
    color: theme.colors.warning,
    borderColor: theme.colors.warning + "3D",
    solidBg: theme.colors.warning,
    solidColor: theme.colors.onPremium,
  },
  danger: {
    backgroundColor: theme.colors.dangerSoft,
    color: theme.colors.danger,
    borderColor: theme.colors.danger + "3D",
    solidBg: theme.colors.danger,
    solidColor: theme.colors.text,
  },
  info: {
    backgroundColor: theme.colors.infoSoft,
    color: theme.colors.info,
    borderColor: theme.colors.info + "3D",
    solidBg: theme.colors.info,
    solidColor: theme.colors.onPrimary,
  },
  brand: {
    backgroundColor: theme.colors.brandSoft,
    color: theme.colors.brand,
    borderColor: theme.colors.brand + "3D",
    solidBg: theme.colors.brand,
    solidColor: theme.colors.text,
  },
  neutral: {
    backgroundColor: theme.colors.secondary,
    color: theme.colors.textMuted,
    borderColor: theme.colors.border,
    solidBg: theme.colors.secondary,
    solidColor: theme.colors.text,
  },
  overlay: {
    backgroundColor: theme.colors.overlay,
    color: theme.colors.text,
    borderColor: theme.colors.ring,
    solidBg: theme.colors.scrim,
    solidColor: theme.colors.text,
  },
};

/** Small non-interactive status/metadata chip. For a tappable one use `common/Chip`. */
export function Pill({ children, tone = "neutral", solid, icon, iconColor, style }: Props) {
  const toneStyle = TONE_STYLES[tone];
  const ink = solid ? toneStyle.solidColor : toneStyle.color;
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: solid ? toneStyle.solidBg : toneStyle.backgroundColor,
          borderColor: solid ? "transparent" : toneStyle.borderColor,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={12}
          color={iconColor ?? ink}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <ThemedText variant="caption" weight="semibold" style={{ color: ink }}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
});
