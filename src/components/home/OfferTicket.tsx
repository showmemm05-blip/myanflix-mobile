import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/common/Skeleton";
import { TicketCard } from "@/components/home/TicketCard";
import { IconTile } from "@/components/home/IconTile";
import { HOME_CONTENT } from "@/components/home/content";
import { OFFER_SLOT_INDEX } from "@/components/home/campaigns";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { theme } from "@/theme";

interface Props {
  balance: number | undefined;
  balanceLoading: boolean;
  balanceError: boolean;
  onOpenWallet: () => void;
}

/**
 * The referral offer, promoted out of the campaign deck into the page's
 * signature object and torn off the bottom edge of the hero.
 *
 * Gold frames the offer, emerald names the destination — two roles each doing
 * exactly what the theme says they mean. There is no promo code, no expiry and
 * no countdown here because none of those exist in this product; the only
 * concrete thing the offer can show is the wallet the credit lands in, and that
 * number is real. If it fails to load it is omitted rather than defaulted —
 * "0 Ks" printed as fact would be a lie.
 */
export function OfferTicket({ balance, balanceLoading, balanceError, onOpenWallet }: Props) {
  const { t } = useLanguage();
  const { contentWidth, gutter, isCompact, isTablet } = useHomeLayout();
  const item = t.home.announcements.items[OFFER_SLOT_INDEX];
  const stackStub = isCompact || isTablet;

  return (
    <TicketCard
      orientation={isTablet ? "vertical" : "horizontal"}
      style={[styles.ticket, { width: contentWidth, marginLeft: gutter }]}
      stub={
        <View style={styles.stub}>
          <View style={[styles.stubRow, stackStub && styles.stubRowStacked]}>
            {!balanceError && (
              <View style={styles.balanceBlock}>
                <ThemedText variant="overline">{t.subscription.walletBalance}</ThemedText>
                {balanceLoading || balance === undefined ? (
                  <Skeleton width={90} height={22} radius="sm" />
                ) : (
                  <ThemedText variant="section" weight="bold" tabular color={theme.colors.finance}>
                    {formatKyat(balance)}
                  </ThemedText>
                )}
              </View>
            )}
            <Button
              title={t.home.offer.walletCta}
              icon="wallet"
              variant="soft"
              color={theme.colors.finance}
              onPress={onOpenWallet}
              fullWidth={stackStub}
              accessibilityLabel={t.home.offer.walletCta}
            />
          </View>
          <ThemedText variant="caption">{t.home.offer.walletHint}</ThemedText>
        </View>
      }
    >
      <View style={styles.badgeRow}>
        <IconTile icon={HOME_CONTENT.announcementIcons[OFFER_SLOT_INDEX]} tone={theme.colors.premium} />
        <Pill tone="premium" solid>
          {item.badge}
        </Pill>
      </View>
      <ThemedText variant="title" numberOfLines={2}>
        {item.title}
      </ThemedText>
      <ThemedText variant="body" color={theme.colors.textMuted} numberOfLines={3}>
        {item.text}
      </ThemedText>
    </TicketCard>
  );
}

const styles = StyleSheet.create({
  /**
   * Tears off the bottom of the hero instead of starting a new band.
   *
   * LEFT-aligned to the page gutter, not centred. Identical on a phone (where
   * `contentWidth` is exactly the space between the gutters) and the fix on a
   * tablet, where `contentWidth` clamps at 760: centring put the ticket's left
   * edge 100pt right of the hero headline it is meant to read as one object
   * with.
   */
  ticket: { marginTop: -28, zIndex: 1, alignSelf: "flex-start" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  stub: { gap: theme.spacing.sm },
  stubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  stubRowStacked: { flexDirection: "column", alignItems: "stretch" },
  balanceBlock: { gap: 2 },
});
