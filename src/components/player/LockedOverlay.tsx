import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { FadeInView } from "@/components/ui/FadeInView";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onSubscribe: () => void;
}

/**
 * The premium gate shown instead of the player when the stream is forbidden
 * (Player.dc.html, "locked"): a soft gold glow behind a gold lock disc, the
 * "Subscribe to start watching" line, the plan line, and one gold Subscribe
 * button with the crown. The screen's own top bar carries Back.
 */
export function LockedOverlay({ onSubscribe }: Props) {
  const { t } = useLanguage();
  const { width, height } = useWindowDimensions();
  // The board's `radial-gradient(circle at 50% 40%, …)`: CSS sizes a circle
  // to the farthest corner, so the stops are fractions of that radius.
  const cx = width / 2;
  const cy = height * 0.4;
  const radius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <RadialGradient id="lockedGlow" cx={cx} cy={cy} r={radius} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.colors.premium} stopOpacity={0.2} />
            <Stop offset="0.36" stopColor={theme.colors.premium} stopOpacity={0.05} />
            <Stop offset="0.66" stopColor={theme.colors.premium} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#lockedGlow)" />
      </Svg>

      <FadeInView from="bottom" duration={400} style={styles.content}>
        <View style={styles.lockDisc}>
          <PlayerGlyph name="lock" size={40} color={theme.colors.premium} />
        </View>
        <ThemedText variant="title" accessibilityRole="header" style={[styles.text, styles.title]}>
          {t.movie.subscriptionLocked}
        </ThemedText>
        <ThemedText color={theme.colors.textMuted} style={[styles.text, styles.subtitle]}>
          {t.subscription.subtitle}
        </ThemedText>
        <PressableScale onPress={onSubscribe} accessibilityLabel={t.movie.subscribeButton} style={styles.button}>
          <PlayerGlyph name="crown" size={16} color={theme.colors.onPremium} />
          <ThemedText weight="extrabold" color={theme.colors.onPremium} style={styles.buttonLabel}>
            {t.movie.subscribeButton}
          </ThemedText>
        </PressableScale>
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    // The board sits the block a little above centre.
    paddingBottom: "8%",
  },
  content: { alignItems: "center", width: "100%", maxWidth: 380 },
  lockDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.premiumSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { textAlign: "center" },
  title: { marginTop: 28 },
  subtitle: { marginTop: 10 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    alignSelf: "stretch",
    minHeight: 52,
    marginTop: theme.spacing.xl,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.premium,
  },
  buttonLabel: { fontSize: 16, flexShrink: 1 },
});
