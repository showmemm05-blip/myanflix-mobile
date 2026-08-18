import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/common/Skeleton";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { TicketCard } from "@/components/home/TicketCard";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  isMember: boolean;
  /** The status request failed — we do not know, so we do not sell. */
  statusUnknown?: boolean;
  statusLoading: boolean;
  onSubscribe: () => void;
  onBrowseMovies: () => void;
  onBrowseSeries: () => void;
}

/**
 * The close: the second and last ticket on the page. Same object as the offer,
 * torn once more — which is the whole reason the shape is used exactly twice.
 *
 * The subscription ask is REMOVED, not disabled, for a member with an active
 * plan; the two browse buttons take the full width instead. Selling a
 * subscription to someone who already pays for one is the fastest way to make
 * a marketing page feel like it isn't listening.
 *
 * The old "Explore Categories" button is gone for good: it navigated to the
 * same Search/movies destination as Browse Movies under a different name.
 */
export function ClosingTicket({
  isMember,
  statusUnknown,
  statusLoading,
  onSubscribe,
  onBrowseMovies,
  onBrowseSeries,
}: Props) {
  const { t } = useLanguage();
  const { contentWidth, isTablet } = useHomeLayout();
  // Selling to someone we could not ask about is the same mistake as selling to
  // someone who already pays — and on a bad connection it is the SAME person.
  const withholdAsk = isMember || !!statusUnknown;

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" anchor="bottom" height={280} intensity={0.75} />
      <TicketCard
        // Same tear as the offer ticket at the same width — the signature
        // object appearing twice on one page has to be the same object.
        orientation={isTablet ? "vertical" : "horizontal"}
        // Gold frames an OFFER. Once the subscribe ask is removed for an active
        // member the block is two browse buttons and nothing else, so the frame
        // follows the content back to violet rather than promising a premium
        // pitch that isn't there.
        tint={withholdAsk ? theme.colors.primary : theme.colors.premium}
        style={[styles.ticket, { width: contentWidth }]}
        stub={
          <View style={styles.actions}>
            {statusLoading ? (
              <Skeleton width="100%" height={44} radius="xl" />
            ) : withholdAsk ? null : (
              <Button
                title={t.subscription.subscribeButton}
                icon="sparkles"
                color={theme.colors.premium}
                onPress={onSubscribe}
                fullWidth
              />
            )}
            {/* Wraps rather than squeezing — see BrowseBar: a two-up row of
                `flex: 1` buttons ellipsizes both Burmese labels on any phone. */}
            <View style={styles.browseRow}>
              <Button
                title={t.home.cta.browseMovies}
                icon="film-outline"
                onPress={onBrowseMovies}
                style={styles.browseButton}
              />
              <Button
                title={t.home.cta.browseSeries}
                icon="tv-outline"
                variant="outline"
                onPress={onBrowseSeries}
                style={styles.browseButton}
              />
            </View>
          </View>
        }
      >
        <ThemedText variant="title">{t.home.cta.title}</ThemedText>
        <ThemedText variant="body" color={theme.colors.textMuted}>
          {t.home.cta.subtitle}
        </ThemedText>
      </TicketCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: theme.spacing.md },
  ticket: { alignSelf: "center" },
  actions: { gap: theme.spacing.sm },
  browseRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  browseButton: { flexGrow: 1, flexBasis: 190 },
});
