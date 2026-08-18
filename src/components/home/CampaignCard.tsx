import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { PressableScale } from "@/components/ui/PressableScale";
import { IconTile } from "@/components/home/IconTile";
import { theme } from "@/theme";

/**
 * The card's ending. `cta` navigates somewhere the label actually names;
 * `status` is what a campaign with no honest destination gets instead — and a
 * status card is not pressable anywhere on its surface.
 */
export type CampaignFooter =
  | { kind: "cta"; label: string; onPress: () => void }
  | { kind: "status"; label: string };

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  text: string;
  /** Role colour for the rule, canvas wash, icon tile and chevron. */
  tone: string;
  footer: CampaignFooter;
  style?: StyleProp<ViewStyle>;
}

/** Campaign artwork is DRAWN, never borrowed from the editorial photography. */
const WATERMARK_SIZE = 120;
const CANVAS_HEIGHT = 84;

function pillToneFor(tone: string): PillTone {
  return tone === theme.colors.primary ? "primary" : "neutral";
}

/**
 * One advertising campaign. Advertising is the material with a role-tinted ring
 * and a drawn canvas; editorial is the material with a hairline border and a
 * photograph. A user should be able to tell them apart with the sound off.
 *
 * Every card ends in the same rail, so "there is no button here" reads as a
 * decision rather than an omission — and the asymmetry is structural as well as
 * chromatic: a CTA card carries a leading rule and a lifted surface, the
 * informational one carries neither.
 */
export function CampaignCard({ icon, badge, title, text, tone, footer, style }: Props) {
  const hasCta = footer.kind === "cta";

  return (
    <Surface
      radius="2xl"
      tone={hasCta ? "default" : "flat"}
      style={[styles.card, style]}
      accessible={!hasCta}
      accessibilityLabel={hasCta ? undefined : `${badge}. ${title}. ${text}. ${footer.label}`}
    >
      {hasCta && <View style={[styles.rule, { backgroundColor: tone }]} pointerEvents="none" />}

      <View style={styles.canvas} pointerEvents="none">
        <LinearGradient
          colors={[tone + "3D", theme.colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons
          name={icon}
          size={WATERMARK_SIZE}
          color={tone}
          style={styles.watermark}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      {/* Straddles the canvas/body seam — the one overlap that makes the card
          read as designed rather than stacked. */}
      <IconTile icon={icon} tone={tone} style={styles.tile} />

      <View style={styles.body}>
        <Pill tone={pillToneFor(tone)}>{badge}</Pill>
        <ThemedText variant="body" weight="semibold" numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={3}>
          {text}
        </ThemedText>

        {footer.kind === "cta" ? (
          <PressableScale
            onPress={footer.onPress}
            dimOnPress
            activeScale={0.98}
            accessibilityLabel={footer.label}
            style={styles.footer}
          >
            <View style={styles.footerRow}>
              <ThemedText variant="label" weight="semibold" color={tone}>
                {footer.label}
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={tone} />
            </View>
          </PressableScale>
        ) : (
          <View style={[styles.footer, styles.footerRow]}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textFaint} />
            <ThemedText variant="label" color={theme.colors.textFaint}>
              {footer.label}
            </ThemedText>
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  /** minHeight, never a fixed height — Burmese wraps longer than English. */
  card: { minHeight: 148, overflow: "hidden" },
  rule: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: theme.radius.pill,
    zIndex: 2,
  },
  canvas: { height: CANVAS_HEIGHT, overflow: "hidden" },
  watermark: { position: "absolute", right: -18, bottom: -28, opacity: 0.1 },
  tile: { marginLeft: theme.spacing.md, marginTop: -22 },
  /** Absorbs the extra height when a wide row stretches the cards to match. */
  body: { flex: 1, padding: theme.spacing.md, gap: theme.spacing.xs },
  footer: {
    minHeight: theme.layout.minTouch,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    /** Pinned to the bottom so two side-by-side cards end in the SAME rail. */
    marginTop: "auto",
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
});
