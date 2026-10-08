import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { BusyDots } from "@/components/wallet/BusyDots";
import { MaskedAmount, maskedKyat } from "@/components/wallet/MaskedAmount";
import { FlowButton } from "@/components/wallet/MoneyFlow";
import { PressScale } from "@/components/wallet/PressScale";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { theme, withAlpha } from "@/theme";

/** Decelerates once and stops, no overshoot. */
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

interface Props {
  /**
   * loading = first fetch; error = nothing to show (failed, or answered with
   * no wallet) — never "0 Ks"; ready = a real balance (possibly stale).
   */
  state: "loading" | "error" | "ready";
  /** A refetch failed but the last good balance is still on screen. */
  stale: boolean;
  balance: number;
  hidden: boolean;
  /** The hide/show switch beside the label; it only exists while there is a real balance. */
  onToggleHidden: () => void;
  /** Money held by pending withdrawals, when known exactly. Never part of `balance`. */
  heldAmount: number | null;
  onRetry: () => void;
  retrying: boolean;
}

/** The eye's disc inside its 44pt target. */
const EYE_DISC = 34;

/**
 * The wallet's one focal point (Wallet.dc.html): "Available balance" with the
 * hide/show eye beside it, the 56pt Black figure with "Ks", and under it the
 * quiet status lines — a stale balance in an amber note with its retry, and
 * the amber-dot line for money on hold. Straight on the hero art, no card.
 */
export function BalanceHero({
  state,
  stale,
  balance,
  hidden,
  onToggleHidden,
  heldAmount,
  onRetry,
  retrying,
}: Props) {
  const { t } = useLanguage();
  const { fontScale, amountSize } = useWalletLayout();
  const reduceMotion = useReducedMotion();

  /**
   * A soft green wash behind the figure when the balance changes live (the
   * socket's wallet.balanceUpdated). Not on the first value, not while hidden
   * (it would announce a change the user chose not to see), not under reduced
   * motion. No counting animation: the new figure is simply there.
   */
  const flash = useSharedValue(0);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (state !== "ready") return;
    const before = previous.current;
    previous.current = balance;
    if (before === null || before === balance || hidden || reduceMotion) return;
    flash.value = withSequence(
      withTiming(1, { duration: 120, easing: EASE_OUT }),
      withTiming(0, { duration: 480, easing: EASE_OUT }),
    );
  }, [balance, state, hidden, reduceMotion, flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  if (state === "loading") {
    const scale = Math.min(fontScale, 1.4);
    return (
      <View style={styles.block} accessible accessibilityLabel={t.common.loading}>
        <View style={styles.labelRow}>
          <Skeleton width={128} height={Math.round(14 * scale)} />
        </View>
        <Skeleton width={220} height={Math.round((amountSize - 8) * scale)} style={styles.skeletonFigure} />
        <Skeleton width={190} height={Math.round(12 * scale)} style={styles.skeletonLine} />
      </View>
    );
  }

  if (state === "error") {
    // A failed balance fetch must never render as "0 Ks" — the figure's place
    // says what went wrong and offers its own retry.
    return (
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <ThemedText weight="semibold" style={styles.label}>
            {t.wallet.availableBalance}
          </ThemedText>
        </View>
        <View style={styles.errorLine} accessible accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.danger} />
          <ThemedText variant="section" style={styles.errorText}>
            {t.common.somethingWentWrong}
          </ThemedText>
        </View>
        <FlowButton
          title={t.common.retry}
          icon="refresh"
          variant="danger"
          size="sm"
          loading={retrying}
          onPress={onRetry}
          style={styles.errorRetry}
        />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        {/* Visual only: the figure below speaks "Available balance, …" as one element. */}
        <ThemedText
          weight="semibold"
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[styles.label, styles.labelShrink]}
        >
          {t.wallet.availableBalance}
        </ThemedText>
        <PressScale
          onPress={onToggleHidden}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t.wallet.showBalance : t.wallet.hideBalance}
          style={styles.eyeTarget}
        >
          <View style={styles.eyeDisc}>
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={18} color={theme.colors.text} />
          </View>
        </PressScale>
      </View>

      {/* One element for the screen reader: what it is, then how much. The
          polite live region makes Android speak a live change; iOS gets an
          explicit announcement (useWalletAnnouncements). Silent while hidden. */}
      <View
        accessible
        accessibilityLabel={`${t.wallet.availableBalance}, ${hidden ? t.wallet.balanceHiddenA11y : formatKyat(balance)}`}
        accessibilityLiveRegion={hidden ? "none" : "polite"}
        style={styles.amountWrap}
      >
        <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
        <MaskedAmount value={balance} hidden={hidden} />
      </View>

      {stale ? (
        <View style={styles.staleNote}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.warning} />
          <ThemedText variant="caption" weight="semibold" style={styles.staleText}>
            {t.wallet.balanceStale}
          </ThemedText>
          <PressScale
            onPress={onRetry}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel={t.common.retry}
            accessibilityState={{ disabled: retrying, busy: retrying }}
            style={styles.staleRetry}
          >
            {retrying ? (
              <BusyDots color={theme.colors.text} size={6} />
            ) : (
              <ThemedText weight="extrabold" style={styles.staleRetryText}>
                {t.common.retry}
              </ThemedText>
            )}
          </PressScale>
        </View>
      ) : null}

      {heldAmount !== null && heldAmount > 0 ? (
        <View style={styles.heldLine}>
          <View style={styles.holdDot} />
          <ThemedText variant="caption" tabular style={styles.heldText}>
            {t.wallet.onHold.replace("{amount}", maskedKyat(heldAmount, hidden))}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: ROW_INSET },
  /** The label (or its skeleton) on a 44pt row, so the eye beside it is a full target. */
  labelRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, minHeight: theme.layout.minTouch },
  label: { color: theme.colors.textBody },
  labelShrink: { flexShrink: 1 },
  eyeTarget: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeDisc: {
    width: EYE_DISC,
    height: EYE_DISC,
    borderRadius: EYE_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
  amountWrap: { marginTop: 2, alignSelf: "flex-start", maxWidth: "100%" },
  flash: {
    position: "absolute",
    top: -2,
    bottom: -2,
    left: -10,
    right: -10,
    borderRadius: theme.radius.lg,
    backgroundColor: withAlpha(theme.colors.finance, 0.16),
  },
  staleNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    marginTop: 12,
    paddingVertical: theme.spacing.xs,
    paddingLeft: 12,
    paddingRight: theme.spacing.xs,
    borderRadius: theme.radius.button,
    backgroundColor: withAlpha(theme.colors.warning, 0.14),
  },
  staleText: { flex: 1, color: theme.colors.premium },
  staleRetry: {
    minWidth: theme.layout.minTouch,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  staleRetryText: { fontSize: 14, color: theme.colors.text },
  heldLine: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: 12 },
  heldText: { flexShrink: 1, color: theme.colors.textBody },
  holdDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.warning },
  skeletonFigure: { marginTop: 8 },
  skeletonLine: { marginTop: 16 },
  errorLine: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2, minHeight: 32 },
  errorText: { flexShrink: 1 },
  errorRetry: { alignSelf: "flex-start", marginTop: 12 },
});
