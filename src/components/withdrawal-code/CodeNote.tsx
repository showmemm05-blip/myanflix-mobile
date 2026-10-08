import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { CodeGlyph } from "@/components/withdrawal-code/CodeGlyph";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme, withAlpha } from "@/theme";

/** CodeCreated's `.rise`: .3s after a .18s beat, cubic-bezier(.2,.8,.2,1), 10pt. */
const RISE = FadeInDown.delay(180)
  .duration(300)
  .easing(Easing.bezier(0.2, 0.8, 0.2, 1))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });

/**
 * The note under "Withdrawal requested" when this withdrawal also made the
 * code (CodeCreated.dc.html): "Withdrawal code created" after a first code,
 * "New withdrawal code saved" after "Forgot code?". A shield-and-tick disc,
 * the title in 15/22 ExtraBold and one line of 13/19, on the panel fill. It
 * rises in just after the success tick, or is simply there under reduce
 * motion. A screen reader hears it as one status.
 */
export function CodeNote({ title, body }: { title: string; body: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : RISE}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}. ${body}`}
      style={styles.note}
    >
      <View style={styles.disc}>
        <CodeGlyph name="shieldCheck" size={22} color={theme.colors.link} />
      </View>
      <View style={styles.text}>
        <ThemedText weight="extrabold">{title}</ThemedText>
        <ThemedText variant="caption" weight="regular" style={styles.body}>
          {body}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginTop: theme.spacing.md,
    marginHorizontal: ROW_INSET,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.primary, 0.14),
  },
  text: { flex: 1, minWidth: 0 },
  body: { marginTop: 2, color: theme.colors.textMuted },
});
