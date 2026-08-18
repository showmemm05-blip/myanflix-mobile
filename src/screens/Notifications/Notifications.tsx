import { useMemo, useState } from "react";
import { RefreshControl, SectionList, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { Skeleton } from "@/components/common/Skeleton";
import { TopBar } from "@/components/layout/TopBar";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/useNotifications";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { RootStackParamList } from "@/navigation/types";
import type { AppNotification, NotificationType } from "@/types/notification";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  PURCHASE: "receipt",
  SUBSCRIPTION: "star",
  PAYMENT: "card",
  NEW_RELEASE: "film",
  PROMOTION: "pricetag",
  ANNOUNCEMENT: "megaphone",
  DEPOSIT_APPROVED: "checkmark-circle",
  DEPOSIT_REJECTED: "close-circle",
  WITHDRAWAL_APPROVED: "arrow-up-circle",
  WITHDRAWAL_REJECTED: "close-circle",
  BALANCE_ADJUSTED: "wallet",
};

/** Money news is emerald, premium is gold, rejections are red, the rest violet/sky. */
const TYPE_TONES: Record<NotificationType, string> = {
  PURCHASE: theme.colors.primary,
  SUBSCRIPTION: theme.colors.premium,
  PAYMENT: theme.colors.finance,
  NEW_RELEASE: theme.colors.primary,
  PROMOTION: theme.colors.premium,
  ANNOUNCEMENT: theme.colors.info,
  DEPOSIT_APPROVED: theme.colors.finance,
  DEPOSIT_REJECTED: theme.colors.danger,
  WITHDRAWAL_APPROVED: theme.colors.finance,
  WITHDRAWAL_REJECTED: theme.colors.danger,
  BALANCE_ADJUSTED: theme.colors.warning,
};

interface Section {
  title: string;
  data: AppNotification[];
}

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const notificationsQuery = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);

  const items = notificationsQuery.data?.items;

  // Purely presentational grouping: the feed is bucketed by calendar day in
  // the order the API already returned it — no sorting, no filtering.
  const sections = useMemo<Section[]>(() => {
    const grouped: Section[] = [];
    for (const item of items ?? []) {
      const title = new Date(item.createdAt).toLocaleDateString();
      const last = grouped[grouped.length - 1];
      if (last && last.title === title) last.data.push(item);
      else grouped.push({ title, data: [item] });
    }
    return grouped;
  }, [items]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await notificationsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" height={340} intensity={0.55} />
      <TopBar
        title={t.notifications.title}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
        rightIcon="checkmark-done"
        onRightPress={() => markAllRead.mutate()}
        rightAccessibilityLabel={t.notifications.markAllRead}
      />

      {notificationsQuery.isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} height={84} radius="xl" />
          ))}
        </View>
      ) : notificationsQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : !notificationsQuery.data || notificationsQuery.data.items.length === 0 ? (
        <EmptyState message={t.notifications.empty} icon="notifications-outline" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText variant="overline" tabular>
                {section.title}
              </ThemedText>
              <View style={styles.sectionRule} />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const tone = TYPE_TONES[item.type];
            return (
              <PressableScale
                onPress={() => !item.isRead && markRead.mutate(item.id)}
                accessibilityLabel={item.title}
              >
                <Surface radius="xl" tone={item.isRead ? "flat" : "default"} style={styles.row}>
                  {!item.isRead && <View style={styles.unreadBar} />}
                  <View style={[styles.iconTile, { backgroundColor: tone + "1F", borderColor: tone + "33" }]}>
                    <Ionicons name={TYPE_ICONS[item.type]} size={18} color={item.isRead ? theme.colors.textMuted : tone} />
                  </View>
                  <View style={styles.info}>
                    <View style={styles.titleRow}>
                      <ThemedText
                        variant="body"
                        weight={item.isRead ? "regular" : "semibold"}
                        numberOfLines={1}
                        style={styles.title}
                      >
                        {item.title}
                      </ThemedText>
                      {!item.isRead && <View style={styles.dot} />}
                    </View>
                    <ThemedText variant="caption" style={styles.message} numberOfLines={2}>
                      {item.message}
                    </ThemedText>
                    <ThemedText variant="caption" tabular style={styles.date}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                </Surface>
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  skeletonList: { padding: theme.layout.screenPadding, gap: theme.spacing.sm },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  separator: { height: theme.spacing.sm },
  row: { flexDirection: "row", gap: theme.spacing.md, padding: theme.spacing.md, overflow: "hidden", minHeight: 84 },
  /** Violet spine on unread items — readable without relying on the dot alone. */
  unreadBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.colors.primary },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.primary },
  message: { color: theme.colors.textMuted },
  date: { color: theme.colors.textFaint, marginTop: 2 },
});
