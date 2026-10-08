import { useCallback } from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { useWalletPrefsStore } from "@/store/walletPrefsStore";
import { formatKyat, formatKyatNumber } from "@/utils/currency";
import { theme } from "@/theme";

const MASK = "••••••";

/**
 * How far the balance follows the OS text size. A 56pt figure is already
 * large; past this it would only be shrunk back down to fit the width.
 */
const HERO_MAX_SCALE = 1.25;
/** Marquee's balance: 56/60 Black, tracked -0.035em; "Ks" 22pt ExtraBold beside it. */
const UNIT_SIZE = 22;

/** The string form, for sub-lines and template slots: "12,500 Ks" or "•••••• Ks". */
export function maskedKyat(value: number, hidden: boolean): string {
  return hidden ? `${MASK} Ks` : formatKyat(value);
}

/**
 * The hide/show switch, shared by the wallet header and the withdraw flow.
 * `toggle` also tells a screen reader what the tap did, since the visible
 * change (digits ↔ dots) is not itself announced.
 */
export function useBalanceVisibility() {
  const { t } = useLanguage();
  const hidden = useWalletPrefsStore((state) => state.balanceHidden);
  const toggleHidden = useWalletPrefsStore((state) => state.toggleBalanceHidden);
  const toggle = useCallback(
    (balance: number) => {
      const next = !hidden;
      toggleHidden();
      AccessibilityInfo.announceForAccessibility(
        next ? t.wallet.balanceHiddenA11y : `${t.wallet.availableBalance}, ${formatKyat(balance)}`,
      );
    },
    [hidden, toggleHidden, t],
  );
  return { hidden, toggle };
}

interface Props {
  value: number;
  hidden: boolean;
}

/**
 * The balance figure — 56/60 Black tabular — with "Ks" set smaller and muted
 * beside it on the same baseline, or the mask when the balance is hidden.
 * One line that shrinks to fit instead of wrapping or being cut, so no balance
 * is ever shown as "12,3…". Swapping digits ↔ dots cross-fades (instantly
 * under reduced motion). Visual only — the surrounding element carries the
 * spoken label, so the dots are never read out.
 */
export function MaskedAmount({ value, hidden }: Props) {
  const reduceMotion = useReducedMotion();
  const { amountSize } = useWalletLayout();

  return (
    <Animated.View key={hidden ? "hidden" : "shown"} entering={reduceMotion ? undefined : FadeIn.duration(150)}>
      <ThemedText
        tabular
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.4}
        maxFontSizeMultiplier={HERO_MAX_SCALE}
        style={[
          styles.figure,
          { fontSize: amountSize, lineHeight: amountSize + 4, letterSpacing: -amountSize * 0.035 },
        ]}
      >
        {hidden ? MASK : formatKyatNumber(value)}
        {/* Two spaces at the unit's size make the design's 10pt gap. */}
        <ThemedText weight="extrabold" style={styles.unit}>
          {"  Ks"}
        </ThemedText>
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  figure: { fontFamily: theme.font.black, color: theme.colors.text },
  unit: {
    fontSize: UNIT_SIZE,
    color: theme.colors.textMuted,
    letterSpacing: 0,
  },
});
