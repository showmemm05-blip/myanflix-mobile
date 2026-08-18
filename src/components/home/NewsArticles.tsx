import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { Pill } from "@/components/ui/Pill";
import { SectionIntro } from "@/components/home/SectionIntro";
import { EditorialArt } from "@/components/home/EditorialArt";
import { useSectionWidth } from "@/components/home/SectionWidth";
import { HOME_CONTENT } from "@/components/home/content";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Thumbnail edge for the two compact rows under the lead story. */
const THUMB = 96;

/**
 * A compact row is only split two-up once each half is at least as wide as the
 * row is on a phone. A device-class gate got this wrong in both directions: at
 * 767pt it left two full-width rows carrying ~600pt of 13pt text, and splitting
 * at 600pt would have handed each story a 146pt body — narrower than the 190pt
 * it gets on a 360pt phone. The width is the thing that matters, so measure it.
 */
const MIN_COMPACT = 320;

/**
 * Pushes this section's grounds off Behind-the-Scenes' — both sit in the same
 * band and both seed from a bare index, so tile 0 and the lead story drew the
 * same ink pair in the same direction. See TestimonialPager for why an offset
 * has to be non-zero against BOTH rotation wheels.
 */
const SEED_OFFSET = 17;

/**
 * Three stories with a real hierarchy instead of three identical cards: one
 * lead with 16:9 artwork, then two compact rows. Editorial material throughout
 * — photographs, tinted pills, hairline borders, nothing tappable, because
 * none of these stories has a page to open inside the app.
 *
 * Every image is an `EditorialArt` ground with the photograph layered on top,
 * so the section is fully composed before — and without — the network. The lead
 * no longer sizes itself with `width: "100%"` + `aspectRatio` either: it is
 * handed a measured height, which is the one thing an aspect ratio cannot
 * promise once a parent's alignment changes underneath it.
 */
export function NewsArticles() {
  const { t } = useLanguage();
  const contentWidth = useSectionWidth();

  const [lead, ...rest] = t.home.news.items;
  const splitWidth = (contentWidth - theme.spacing.md) / 2;
  const split = splitWidth >= MIN_COMPACT;
  const compactWidth = split ? splitWidth : contentWidth;
  // Inside the lead Surface's 1pt border on each side.
  const leadWidth = contentWidth - 2;
  const leadHeight = Math.round((leadWidth * 9) / 16);

  return (
    <View style={styles.container}>
      <View style={{ width: contentWidth }}>
        <SectionIntro
          eyebrow={t.home.news.eyebrow}
          title={t.home.news.title}
          subtitle={t.home.news.subtitle}
          icon="newspaper-outline"
          inset={false}
        />
      </View>

      <View style={[styles.list, { width: contentWidth }]}>
        <Surface
          radius="2xl"
          tone="flat"
          style={styles.lead}
          accessible
          accessibilityLabel={`${lead.tag}. ${lead.title}. ${lead.excerpt}. ${lead.date}`}
        >
          <EditorialArt
            seed={SEED_OFFSET}
            kind="story"
            uri={HOME_CONTENT.newsImages[0]}
            width={leadWidth}
            height={leadHeight}
            radius={0}
            stretch
          />
          <View style={styles.leadBody}>
            <View style={styles.metaRow}>
              {/* Neutral, not violet: these tags are metadata on a card that
                  opens nothing. Violet is the app's action ink. */}
              <Pill tone="neutral">{lead.tag}</Pill>
              <ThemedText
                variant="caption"
                color={theme.colors.textFaint}
                numberOfLines={1}
                style={styles.metaDate}
              >
                {lead.date}
              </ThemedText>
            </View>
            <ThemedText variant="section">{lead.title}</ThemedText>
            <ThemedText variant="caption">{lead.excerpt}</ThemedText>
          </View>
        </Surface>

        <View style={[styles.compactRow, split && styles.compactRowSplit]}>
          {rest.map((item, index) => (
            <Surface
              key={item.title}
              radius="2xl"
              tone="flat"
              style={[styles.compact, { width: compactWidth }]}
              accessible
              accessibilityLabel={`${item.tag}. ${item.title}. ${item.excerpt}. ${item.date}`}
            >
              <EditorialArt
                seed={index + 1 + SEED_OFFSET}
                kind="story"
                uri={HOME_CONTENT.newsImages[index + 1]}
                width={THUMB}
                height={THUMB}
                radius={theme.radius.lg}
              />
              <View style={styles.compactBody}>
                <View style={styles.metaRow}>
                  <Pill tone="neutral">{item.tag}</Pill>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textFaint}
                    numberOfLines={1}
                    style={styles.metaDate}
                  >
                    {item.date}
                  </ThemedText>
                </View>
                <ThemedText variant="body" weight="semibold">
                  {item.title}
                </ThemedText>
                <ThemedText variant="caption">{item.excerpt}</ThemedText>
              </View>
            </Surface>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm, alignItems: "center" },
  list: { gap: theme.spacing.md },
  lead: { overflow: "hidden" },
  leadBody: { padding: theme.spacing.md, gap: theme.spacing.xs },
  compactRow: { gap: theme.spacing.md },
  /**
   * `wrap`, because `compactWidth` is hard-coded to exactly two per row while
   * the item count comes from the translation bundle: a fourth story would
   * otherwise be pushed off the right edge of a row that neither wraps nor
   * clips. `flex-start` for the reason BehindTheScenes documents at length.
   */
  compactRowSplit: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  compact: { flexDirection: "row", gap: theme.spacing.md, padding: theme.spacing.sm, overflow: "hidden" },
  compactBody: { flex: 1, gap: theme.spacing.xs, paddingVertical: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  /**
   * The date yields, the tag does not. RN defaults `flexShrink` to 0, so this
   * row of two intrinsically-sized children simply overflowed once the pill and
   * the date together exceeded the card — and `compact`'s `overflow: hidden`
   * cut the date mid-glyph rather than letting `numberOfLines` ellipsize it.
   * `numberOfLines` can only clip inside the width Yoga hands the text, and
   * without a shrink Yoga hands it the full intrinsic width. Reachable today in
   * Burmese on a 320pt phone, and on any phone at an accessibility text size.
   */
  metaDate: { flexShrink: 1 },
});
