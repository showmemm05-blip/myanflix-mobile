import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackDisc, StepRail } from "@/components/auth/AuthParts";
import { theme } from "@/theme";

interface Props {
  onBack: () => void;
  backDisabled?: boolean;
  backLabel: string;
  /** Zero-based step, and how many steps the rail shows. */
  step: number;
  steps: number;
  railLabel: string;
}

/**
 * The forgot-password screens' head (ForgotPassword.dc.html): a 60pt row
 * under the status bar with the 40pt back disc on the left and the step rail
 * on the right, over a faint crimson glow from the top-right corner. The glow
 * is one static SVG gradient — no image, no blur.
 */
export function AuthTopBar({ onBack, backDisabled, backLabel, step, steps, railLabel }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top }}>
      <CrimsonGlow />
      <View style={styles.row}>
        <BackDisc onPress={onBack} disabled={backDisabled} accessibilityLabel={backLabel} />
        <View style={styles.railSlot}>
          <StepRail index={step} count={steps} width={96} accessibilityLabel={railLabel} />
        </View>
      </View>
    </View>
  );
}

/** radial-gradient(110% 80% at 85% 0%, crimson 16% → nothing at 70%), 300pt tall. */
const CrimsonGlow = memo(function CrimsonGlow() {
  return (
    <View style={styles.glow} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="authGlow" cx="85%" cy="0%" rx="110%" ry="80%" fx="85%" fy="0%">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.16} />
            <Stop offset="0.7" stopColor={theme.colors.background} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#authGlow)" />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  glow: { position: "absolute", left: 0, right: 0, top: 0, height: 300 },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.sm,
  },
  railSlot: { marginRight: theme.spacing.sm },
});
