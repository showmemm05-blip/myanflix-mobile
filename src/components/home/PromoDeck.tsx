import { StyleSheet, View } from "react-native";
import { CampaignCard, type CampaignFooter } from "@/components/home/CampaignCard";
import { DECK_SLOTS, type CampaignFooterKind } from "@/components/home/campaigns";
import { HOME_CONTENT } from "@/components/home/content";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onBrowseMovies: () => void;
  onBrowseSeries: () => void;
}

/**
 * The campaign stack — a VERTICAL deck, deliberately not a horizontal rail. At
 * 360pt a rail hides two of the three campaigns behind a swipe, and hidden
 * inventory converts at zero.
 *
 * No SectionIntro: advertising doesn't get an editorial heading. The deck opens
 * on the first card's solid badge instead.
 */
export function PromoDeck({ onBrowseMovies, onBrowseSeries }: Props) {
  const { t } = useLanguage();
  const { contentWidth, isWide } = useHomeLayout();

  const columnWidth = (contentWidth - theme.spacing.md) / 2;

  const footerFor = (kind: CampaignFooterKind): CampaignFooter => {
    switch (kind) {
      case "browseMovies":
        return { kind: "cta", label: t.home.cta.browseMovies, onPress: onBrowseMovies };
      case "browseSeries":
        // Stays the generic browse label on purpose: the Originals copy says the
        // slate "starts rolling out this quarter", so "Watch Originals" would
        // promise a catalogue that may not be there yet.
        return { kind: "cta", label: t.home.cta.browseSeries, onPress: onBrowseSeries };
      case "wallet":
        // The wallet campaign is promoted into OfferTicket, never rendered here.
        return { kind: "status", label: t.home.campaigns.comingSoon };
      case "comingSoon":
      default:
        return { kind: "status", label: t.home.campaigns.comingSoon };
    }
  };

  return (
    <View
      style={[styles.deck, isWide && styles.deckWide, { width: contentWidth }]}
    >
      {DECK_SLOTS.map((slot) => {
        const item = t.home.announcements.items[slot.index];
        const footer = footerFor(slot.footer);
        // The card with no CTA spans both columns — its full width is what says
        // "this one is information, not an offer" at a glance on a wide screen.
        const spans = footer.kind === "status";

        return (
          <CampaignCard
            key={slot.index}
            icon={HOME_CONTENT.announcementIcons[slot.index]}
            badge={item.badge}
            title={item.title}
            text={item.text}
            tone={slot.tone}
            footer={footer}
            style={isWide ? { width: spans ? contentWidth : columnWidth } : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { gap: theme.spacing.md, alignSelf: "center" },
  /**
   * `stretch`, not `flex-start`: the two CTA cards share a line and their body
   * copy is different lengths (much more so in Burmese), so aligning to the top
   * leaves their bottom edges — and the footer rail every card is supposed to
   * end in — at different heights. The cards carry a minHeight and no fixed
   * height, so Yoga stretches them to the line's cross size.
   */
  deckWide: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
});
