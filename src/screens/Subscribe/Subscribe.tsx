import { useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef, useReducedMotion, useSharedValue } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackActions, type NavigationProp } from "@react-navigation/native";
import { ThemedText } from "@/components/ui/ThemedText";
import { IconButton } from "@/components/ui/IconButton";
import { FadeInView } from "@/components/ui/FadeInView";
import {
  GLASS_BAR_ROW,
  GlassBarBackground,
  GlassScrollFeed,
  GlassTarget,
} from "@/components/layout/GlassBar";
import { Skeleton } from "@/components/common/Skeleton";
import { AccessBadge } from "@/components/common/AccessBadge";
import { ActionButton, Notice } from "@/components/profile/AccountKit";
import { CrownGlyph, SUBSCRIBE_ART_HEIGHT, SubscribeArt } from "@/components/subscribe/SubscribeArt";
import { useSubscriptionPlans, useSubscribe } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { ApiError } from "@/utils/errors";
import { theme, withAlpha } from "@/theme";
import type { MainTabParamList, MediaDetailParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<MediaDetailParamList, "Subscribe">;

/** Why the last Subscribe tap failed — the text is resolved at render, in the current language. */
type Failure = "insufficient" | "alreadyActive" | "failed";

/** How far the intro rides up over the stage art (the board's -40). */
const ART_OVERLAP = 40;

/**
 * Subscribe — Marquee "plan picker" (Subscribe.dc.html, approved): the stage
 * art, the PREMIUM title, the wallet balance on hairlines, the plans as a
 * radio list (the first one preselected), and ONE gold Subscribe button that
 * names the price of the picked plan.
 *
 * The purchase is the same POST as before — `subscribe(planId)` — with the
 * same mapping: 409 = already active (info blue), 400 = insufficient balance
 * (red, with "Add money", which opens the Wallet tab's Deposit sheet), any
 * other failure = "Subscription failed". The balance is never pre-checked
 * here; only the server's 400 says it is too low.
 */
export function SubscribeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const reduceMotion = useReducedMotion();
  const plansQuery = useSubscriptionPlans();
  const walletQuery = useWallet();
  const subscribeMutation = useSubscribe();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [pickedPlanId, setPickedPlanId] = useState<string | null>(null);

  const plans = plansQuery.data ?? [];
  const balance = walletQuery.data?.balance ?? 0;
  // The first plan from the backend is preselected (a design choice, see
  // AREA-NOTES); a pick that vanished on a refetch falls back to it as well.
  const selectedPlan = plans.find((plan) => plan.id === pickedPlanId) ?? plans[0] ?? null;
  const busy = subscribeMutation.isPending;
  const plansReady = !plansQuery.isLoading && !plansQuery.isError && plans.length > 0;
  const showAction = plansReady || plansQuery.isLoading;

  /**
   * Where the pinned action stops. On iOS this screen is a native modal sheet
   * that covers the floating dock, so only the home-indicator inset is kept.
   * On Android a "modal" is a plain stack screen and the dock still floats
   * over it, so the button must clear the dock the way every tab screen does.
   */
  const footerBottom = Platform.OS === "ios" ? Math.max(insets.bottom, theme.spacing.md) + 8 : dockClearance;
  /**
   * The status-bar inset the art reaches under. An iOS modal sheet already
   * starts below the status bar (native-stack gives it no top inset either),
   * so there it is 0; on Android the screen is full-height.
   */
  const topInset = Platform.OS === "ios" ? 0 : insets.top;

  /**
   * The glass behind the close button (components/layout/GlassBar): this
   * screen's "bar" is that one control, 8pt down from the top inset, so the
   * glass covers the inset and its 44pt row — transparent over the art at
   * the top, frosted once the plans scroll up under the button.
   */
  const blurTarget = useRef<View>(null);
  const scrollRef = useAnimatedRef<ScrollView>();
  const scrollY = useSharedValue(0);
  const glassHeight = topInset + GLASS_BAR_ROW;

  // Same `{n}` + separate-singular convention as comments.count/countOne.
  const formatPlanDuration = (days: number) =>
    days === 1 ? t.subscription.planDurationOne : t.subscription.planDuration.replace("{n}", String(days));

  const failureMessage =
    failure === "alreadyActive"
      ? t.subscription.alreadyActive
      : failure === "insufficient"
        ? t.subscription.insufficientBalance
        : failure === "failed"
          ? t.subscription.failure
          : null;

  const pickPlan = (planId: string) => {
    if (busy) return;
    // The notice was about the plan that was tried; a different pick starts over.
    if (planId !== selectedPlan?.id) setFailure(null);
    setPickedPlanId(planId);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || busy) return;
    setFailure(null);
    try {
      await subscribeMutation.mutateAsync(selectedPlan.id);
      setSucceeded(true);
      AccessibilityInfo.announceForAccessibility(t.subscription.success);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFailure("alreadyActive");
      } else if (err instanceof ApiError && err.status === 400) {
        setFailure("insufficient");
      } else {
        setFailure("failed");
      }
    }
  };

  /**
   * "Add money": close this modal, then switch to the Wallet tab and ask its
   * root to open the Deposit sheet. Subscribe is registered in the Home and
   * Search tab stacks — whose parent is the tab navigator — and in the stack
   * of the ROOT "Profile" screen, which sits above the tabs. From there the
   * tab navigator is not a parent, so `popTo("Main", …)` pops Profile off the
   * root stack (this modal with it) and hands the tabs the same params — the
   * way Profile's own balance card reaches the Wallet.
   * `pop: true` returns a Wallet stack that has Transactions pushed to its
   * root instead of stacking a second Wallet on top.
   *
   * iOS: this screen is a native modal sheet, and UIKit drops a presentation
   * that starts while another modal is still sliding away. The Wallet screen
   * owns that wait (OPEN_DEPOSIT_DELAY_MS in Wallet.tsx) for every caller, so
   * the param is sent at once here — waiting here as well doubled the delay.
   */
  const handleAddMoney = () => {
    const tabs = navigation.getParent<NavigationProp<MainTabParamList>>();
    if (tabs?.getState()?.type !== "tab") {
      navigation.dispatch(
        StackActions.popTo("Main", {
          screen: "WalletTab",
          params: { screen: "Wallet", params: { openDeposit: true }, pop: true },
        }),
      );
      return;
    }
    navigation.goBack();
    tabs.navigate("WalletTab", { screen: "Wallet", params: { openDeposit: true }, pop: true });
  };

  const art = <SubscribeArt height={SUBSCRIBE_ART_HEIGHT + topInset} />;

  if (succeeded) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {art}
          <View style={styles.success} accessibilityLiveRegion="polite">
            <FadeInView from="bottom" duration={340}>
              <View style={styles.successDisc} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Ionicons name="checkmark" size={48} color={theme.colors.finance} />
              </View>
            </FadeInView>
            <ThemedText variant="display" accessibilityRole="header" style={styles.centerText}>
              {t.subscription.success}
            </ThemedText>
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: footerBottom }]}>
          <ActionButton title={t.common.close} tone="play" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={blurTarget}>
        <ScrollView
          ref={scrollRef}
          scrollEventThrottle={16}
          /* With no pinned footer (plans failed or empty) nothing else keeps the
             last row — the Retry button — clear of the home indicator on iOS or
             of the floating dock on Android, so the scroll content takes the
             footer's own bottom clearance. */
          contentContainerStyle={[styles.scrollContent, !showAction && { paddingBottom: footerBottom }]}
          showsVerticalScrollIndicator={false}
        >
          {art}

          <View style={styles.intro}>
            {/* The app's one FREE/PREMIUM stamp — same badge the cards wear. */}
            <AccessBadge accessType="SUBSCRIPTION" />
            <ThemedText variant="display" accessibilityRole="header" style={styles.title}>
              {t.subscription.title}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.textBody} style={styles.subtitle}>
              {t.subscription.subtitle}
            </ThemedText>
          </View>

          <View style={styles.balanceRow}>
            <Ionicons name="wallet-outline" size={22} color={theme.colors.finance} />
            <View style={styles.wrapRow}>
              <ThemedText variant="body" color={theme.colors.textMuted} style={styles.shrink}>
                {t.subscription.walletBalance}
              </ThemedText>
              {walletQuery.isLoading ? (
                <Skeleton width={96} height={20} radius="xs" />
              ) : walletQuery.isError ? (
                <ThemedText variant="caption" weight="semibold" color={theme.colors.danger}>
                  {t.common.somethingWentWrong}
                </ThemedText>
              ) : (
                <ThemedText variant="section" tabular color={theme.colors.finance}>
                  {formatKyat(balance)}
                </ThemedText>
              )}
            </View>
          </View>

          {plansQuery.isLoading ? (
            <View style={styles.planList} accessible accessibilityLabel={t.common.loading}>
              <Skeleton height={88} style={styles.planSkeleton} />
              <Skeleton height={88} style={styles.planSkeleton} />
              <Skeleton height={88} style={styles.planSkeleton} />
            </View>
          ) : plansQuery.isError ? (
            /* A failed fetch is NOT an empty catalogue — same rule the
               balance row above follows. Telling a buyer there are no plans
               when the request failed reads as "MyanFlix stopped selling
               subscriptions", and leaves no way to try again. */
            <View style={styles.stateBlock} accessibilityLiveRegion="polite">
              <View style={[styles.stateDisc, styles.stateDiscDanger]}>
                <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.danger} />
              </View>
              <ThemedText variant="body" color={theme.colors.textBody} style={styles.centerText}>
                {t.common.somethingWentWrong}
              </ThemedText>
              <ActionButton
                title={t.common.retry}
                icon="refresh"
                tone="tonal"
                height={44}
                loading={plansQuery.isFetching}
                onPress={() => plansQuery.refetch()}
                style={styles.retry}
              />
            </View>
          ) : plans.length === 0 ? (
            <View style={styles.stateBlock}>
              <View style={styles.stateDisc}>
                <Ionicons name="pricetags-outline" size={26} color={theme.colors.textFaint} />
              </View>
              <ThemedText variant="body" color={theme.colors.textBody} style={styles.centerText}>
                {t.subscription.noPlans}
              </ThemedText>
            </View>
          ) : (
            <FadeInView duration={240}>
              <View style={styles.planList} accessibilityRole="radiogroup" accessibilityLabel={t.subscription.subtitle}>
                {plans.map((plan) => {
                  const selected = plan.id === selectedPlan?.id;
                  const duration = formatPlanDuration(plan.durationDays);
                  const price = formatKyat(plan.price);
                  return (
                    <Pressable
                      key={plan.id}
                      onPress={() => pickPlan(plan.id)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityLabel={`${plan.name}, ${duration}, ${price}`}
                      accessibilityState={{ checked: selected, disabled: busy }}
                      style={({ pressed }) => [
                        styles.planRow,
                        selected && styles.planRowSelected,
                        busy && !selected && styles.planRowMuted,
                        pressed && !busy && (reduceMotion ? styles.pressedStill : styles.pressed),
                      ]}
                    >
                      <View style={[styles.mark, selected && styles.markSelected]}>
                        {selected ? <Ionicons name="checkmark" size={14} color={theme.colors.onPremium} /> : null}
                      </View>
                      <View style={styles.wrapRow}>
                        <View style={styles.planText}>
                          <ThemedText weight="extrabold" style={styles.planName}>
                            {plan.name}
                          </ThemedText>
                          <ThemedText variant="caption" tabular color={theme.colors.textMuted}>
                            {duration}
                          </ThemedText>
                        </View>
                        <ThemedText
                          variant="section"
                          tabular
                          color={selected ? theme.colors.premium : theme.colors.text}
                        >
                          {price}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </FadeInView>
          )}
        </ScrollView>
        <GlassScrollFeed scrollRef={scrollRef} scrollY={scrollY} />
      </GlassTarget>

      {showAction ? (
        <View style={[styles.footer, { paddingBottom: footerBottom }]}>
          {failureMessage ? (
            <Notice message={failureMessage} tone={failure === "alreadyActive" ? "info" : "danger"}>
              {failure === "insufficient" ? (
                <Pressable
                  onPress={handleAddMoney}
                  accessibilityRole="button"
                  accessibilityLabel={t.subscription.addMoney}
                  style={({ pressed }) => [
                    styles.addMoney,
                    pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
                  ]}
                >
                  <ThemedText variant="muted" weight="extrabold" color={theme.colors.text}>
                    {t.subscription.addMoney}
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.text} />
                </Pressable>
              ) : null}
            </Notice>
          ) : null}
          <ActionButton
            title={t.subscription.subscribeButton}
            tone="premium"
            height={56}
            onPress={handleSubscribe}
            loading={busy}
            disabled={!plansReady || !selectedPlan}
            accessibilityLabel={
              selectedPlan
                ? `${t.subscription.subscribeButton}, ${formatKyat(selectedPlan.price)}`
                : t.subscription.subscribeButton
            }
            renderContent={(ink) => (
              <View style={styles.subscribeContent}>
                <View style={styles.subscribeLabel}>
                  <CrownGlyph color={ink} />
                  <ThemedText weight="extrabold" color={ink} style={styles.subscribeText}>
                    {t.subscription.subscribeButton}
                  </ThemedText>
                </View>
                {selectedPlan ? (
                  <ThemedText weight="extrabold" tabular color={ink} style={styles.subscribeText}>
                    {formatKyat(selectedPlan.price)}
                  </ThemedText>
                ) : null}
              </View>
            )}
          />
        </View>
      ) : null}

      <GlassBarBackground scrollY={scrollY} height={glassHeight} blurTarget={blurTarget} />
      {/* Over the art, fixed while the page scrolls — the board's blurred disc. */}
      <IconButton
        icon="close"
        overlay
        onPress={() => navigation.goBack()}
        accessibilityLabel={t.common.close}
        style={[styles.close, { top: topInset + theme.spacing.sm }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: theme.spacing.lg },
  close: { position: "absolute", right: theme.spacing.sm },
  intro: {
    marginTop: -ART_OVERLAP,
    paddingHorizontal: theme.layout.screenPadding,
    alignItems: "flex-start",
  },
  title: { marginTop: 12 },
  subtitle: { marginTop: theme.spacing.sm },
  /** The board's 64pt row between two hairlines. */
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.layout.screenPadding,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  /**
   * Label on the left, figure on the right — and when a large text size leaves
   * no room for both, the figure drops under the label instead of squeezing it.
   */
  wrapRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 2,
  },
  shrink: { flexShrink: 1 },
  planList: { gap: 10, marginTop: theme.spacing.lg, paddingHorizontal: theme.layout.screenPadding },
  planSkeleton: { borderRadius: 16 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 88,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surface,
  },
  planRowSelected: { borderColor: theme.colors.premium, backgroundColor: withAlpha(theme.colors.premium, 0.1) },
  planRowMuted: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: withAlpha(theme.colors.text, 0.3),
    alignItems: "center",
    justifyContent: "center",
  },
  markSelected: { backgroundColor: theme.colors.premium, borderColor: theme.colors.premium },
  planText: { flexGrow: 1, flexShrink: 1 },
  planName: { fontSize: 17 },
  stateBlock: {
    alignItems: "center",
    gap: 12,
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.layout.screenPadding,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.layout.screenPadding,
  },
  stateDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceElevated,
  },
  stateDiscDanger: { backgroundColor: theme.colors.dangerSoft },
  retry: { alignSelf: "center" },
  centerText: { textAlign: "center" },
  footer: {
    gap: 12,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    backgroundColor: theme.colors.background,
  },
  addMoney: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: theme.layout.minTouch,
  },
  /** Label + price, split to the two ends; the price wraps under at large text sizes. */
  subscribeContent: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  subscribeLabel: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  subscribeText: { fontSize: 16, flexShrink: 1 },
  success: { alignItems: "center", marginTop: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding },
  successDisc: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.successSoft,
    marginBottom: theme.spacing.lg,
  },
});
