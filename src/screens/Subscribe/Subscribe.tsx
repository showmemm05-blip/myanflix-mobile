import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { Skeleton } from "@/components/common/Skeleton";
import { AccessBadge } from "@/components/common/AccessBadge";
import { useSubscriptionPlans, useSubscribe } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";
import type { MediaDetailParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<MediaDetailParamList, "Subscribe">;

export function SubscribeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const plansQuery = useSubscriptionPlans();
  const walletQuery = useWallet();
  const subscribeMutation = useSubscribe();
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const plans = plansQuery.data ?? [];
  const balance = walletQuery.data?.balance ?? 0;

  // Same `{n}` + separate-singular convention as comments.count/countOne.
  const formatPlanDuration = (days: number) =>
    days === 1 ? t.subscription.planDurationOne : t.subscription.planDuration.replace("{n}", String(days));

  const handleSubscribe = async (planId: string) => {
    setError(null);
    setPendingPlanId(planId);
    try {
      await subscribeMutation.mutateAsync(planId);
      setSucceeded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t.subscription.alreadyActive);
      } else if (err instanceof ApiError && err.status === 400) {
        setError(t.subscription.insufficientBalance);
      } else {
        setError(t.subscription.failure);
      }
    } finally {
      setPendingPlanId(null);
    }
  };

  if (succeeded) {
    return (
      <View style={styles.container}>
        <AuroraBackdrop tone="gold" height={480} />
        <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
          <View style={styles.center}>
            <View style={styles.successHalo}>
              <Ionicons name="checkmark-circle" size={52} color={theme.colors.finance} />
            </View>
            <ThemedText variant="display" style={styles.centerText}>
              {t.subscription.success}
            </ThemedText>
            <Button title={t.common.close} onPress={() => navigation.goBack()} size="lg" style={styles.successButton} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="gold" height={460} />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <View style={styles.topRow}>
          <IconButton
            icon="close"
            onPress={() => navigation.goBack()}
            variant="ghost"
            accessibilityLabel={t.common.close}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            {/* The app's one FREE/PREMIUM stamp — same badge the cards wear. */}
            <View style={styles.badgeRow}>
              <AccessBadge accessType="SUBSCRIPTION" />
            </View>
            <ThemedText variant="display">{t.subscription.title}</ThemedText>
            <ThemedText variant="body" style={styles.subtitle}>
              {t.subscription.subtitle}
            </ThemedText>
          </View>

          <Surface radius="2xl" padded style={styles.balanceCard}>
            <View style={styles.balanceIconTile}>
              <Ionicons name="wallet" size={20} color={theme.colors.finance} />
            </View>
            <ThemedText variant="body" style={styles.balanceLabel} numberOfLines={1}>
              {t.subscription.walletBalance}
            </ThemedText>
            {walletQuery.isLoading ? (
              <Skeleton width={96} height={20} radius="sm" />
            ) : walletQuery.isError ? (
              <ThemedText variant="caption" weight="semibold" style={styles.errorText}>
                {t.common.somethingWentWrong}
              </ThemedText>
            ) : (
              <ThemedText variant="section" weight="bold" tabular style={styles.balanceValue}>
                {formatKyat(balance)}
              </ThemedText>
            )}
          </Surface>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
              <ThemedText variant="caption" weight="semibold" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          {plansQuery.isLoading ? (
            <View style={styles.planList}>
              <Skeleton height={148} radius="2xl" />
              <Skeleton height={148} radius="2xl" />
            </View>
          ) : plansQuery.isError ? (
            /* A failed fetch is NOT an empty catalogue — same rule the
               balance card above follows. Telling a buyer there are no plans
               when the request failed reads as "MyanFlix stopped selling
               subscriptions", and leaves no way to try again. */
            <Surface radius="2xl" padded style={styles.noPlans}>
              <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.danger} />
              <ThemedText variant="muted" style={styles.centerText}>
                {t.common.somethingWentWrong}
              </ThemedText>
              <Button
                title={t.common.retry}
                icon="refresh"
                variant="soft"
                loading={plansQuery.isFetching}
                onPress={() => plansQuery.refetch()}
              />
            </Surface>
          ) : plans.length === 0 ? (
            <Surface radius="2xl" padded style={styles.noPlans}>
              <Ionicons name="pricetags-outline" size={22} color={theme.colors.textFaint} />
              <ThemedText variant="muted" style={styles.centerText}>
                {t.subscription.noPlans}
              </ThemedText>
            </Surface>
          ) : (
            <View style={styles.planList}>
              {plans.map((plan) => {
                const isPending = subscribeMutation.isPending && pendingPlanId === plan.id;
                return (
                  <View key={plan.id} style={styles.planCard}>
                    <View style={styles.planTitleBlock}>
                      <AccessBadge accessType="SUBSCRIPTION" />
                      <ThemedText variant="section" numberOfLines={1}>
                        {plan.name}
                      </ThemedText>
                      <ThemedText variant="caption" style={styles.planDuration}>
                        {formatPlanDuration(plan.durationDays)}
                      </ThemedText>
                    </View>

                    <ThemedText variant="display" tabular numberOfLines={1} style={styles.planPrice}>
                      {formatKyat(plan.price)}
                    </ThemedText>

                    <Button
                      title={t.subscription.subscribeButton}
                      onPress={() => handleSubscribe(plan.id)}
                      loading={isPending}
                      disabled={subscribeMutation.isPending}
                      size="lg"
                      fullWidth
                      trailingIcon="arrow-forward"
                    />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.md,
  },
  intro: { gap: theme.spacing.xs },
  badgeRow: { alignSelf: "flex-start", marginBottom: theme.spacing.xs },
  subtitle: { color: theme.colors.textMuted },
  balanceCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: 72 },
  balanceIconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.financeSoft,
    borderWidth: 1,
    borderColor: theme.colors.finance + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: { flex: 1, color: theme.colors.textMuted },
  balanceValue: { color: theme.colors.finance },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger + "3D",
  },
  errorText: { flex: 1, color: theme.colors.danger },
  planList: { gap: theme.spacing.md },
  /** Gold framing is the premium role; the CTA stays violet like every action. */
  planCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius["2xl"],
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.premium + "3D",
    gap: theme.spacing.md,
    ...theme.shadow.md,
    shadowColor: theme.colors.premium,
    shadowOpacity: 0.18,
  },
  planTitleBlock: { gap: theme.spacing.xs, alignItems: "flex-start" },
  planDuration: { color: theme.colors.textMuted },
  planPrice: { color: theme.colors.premium },
  noPlans: { alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md, padding: theme.layout.screenPadding },
  centerText: { textAlign: "center" },
  successHalo: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.financeSoft,
    borderWidth: 1,
    borderColor: theme.colors.finance + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  successButton: { marginTop: theme.spacing.md },
});
