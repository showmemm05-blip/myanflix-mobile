import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { SectionIntro } from "@/components/home/SectionIntro";
import { EditorialArt } from "@/components/home/EditorialArt";
import { HOME_CONTENT, avatarUrl } from "@/components/home/content";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Avatar edge on the quote card. */
const AVATAR = 34;

/**
 * Pushes the voices off the team's seeds so the page's two avatar rows never
 * draw the same four `EditorialArt` grounds. 46, not any offset: the ink and
 * glyph rotations are 5 and 4 long, so only an offset that is 1 mod 5 AND 2 mod
 * 4 shifts BOTH wheels — anything else re-pairs the same tint with the same
 * mark somewhere down the four.
 */
const SEED_OFFSET = 46;

/** Below this a grid card is narrower than the phone pager card it replaces. */
const MIN_GRID_CARD = 300;

/**
 * Proof, one voice at a time. A quote is only persuasive if it is actually
 * read, and four stacked cards get skimmed — so on a phone this is a snapping
 * pager showing exactly one, with dots to say how many are left.
 *
 * Once there is room the pager is dropped entirely for a 2×2 grid: a one-up
 * pager on a 1024pt screen wastes half the width to make a point about focus
 * that the width has already made. "Room" is measured, not assumed from a
 * device class — an `isTablet` gate held the pager at a 727pt-wide card right
 * up to 768pt.
 *
 * Quotes are NEVER truncated — a half-quote is a misquote.
 */
export function TestimonialPager() {
  const { t } = useLanguage();
  const { contentWidth } = useHomeLayout();
  const [index, setIndex] = useState(0);

  const items = t.home.testimonials.items;
  const total = items.length;
  const pageWidth = contentWidth;
  const gridWidth = (contentWidth - theme.spacing.md) / 2;
  // Two-up only while each card stays at least as wide as the pager card is on
  // a phone: a 276pt grid card would trade the focus the pager buys for nothing.
  const asGrid = gridWidth >= MIN_GRID_CARD;

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, pageWidth));
      setIndex(Math.max(0, Math.min(total - 1, page)));
    },
    [pageWidth, total],
  );

  const card = (item: (typeof items)[number], position: number, width: number) => (
    <Surface
      key={item.name}
      radius="2xl"
      padded
      style={[styles.card, { width }]}
      accessible
      accessibilityLabel={`${t.home.a11y.quoteOf
        .replace("{n}", String(position + 1))
        .replace("{total}", String(total))}. ${item.quote} ${item.name}, ${item.role}`}
    >
      <Ionicons name="chatbox-outline" size={18} color={theme.colors.primary} />
      <ThemedText variant="body">{item.quote}</ThemedText>
      <View style={styles.author}>
        <EditorialArt
          seed={position + SEED_OFFSET}
          kind="person"
          uri={avatarUrl(HOME_CONTENT.testimonialAvatarSeeds[position])}
          width={AVATAR}
          height={AVATAR}
          radius={theme.radius.pill}
        />
        <View style={styles.authorText}>
          <ThemedText variant="caption" weight="semibold" color={theme.colors.text} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textFaint} numberOfLines={1}>
            {item.role}
          </ThemedText>
        </View>
      </View>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <View style={{ width: contentWidth }}>
        <SectionIntro
          eyebrow={t.home.testimonials.eyebrow}
          title={t.home.testimonials.title}
          subtitle={t.home.testimonials.subtitle}
          icon="chatbubbles-outline"
          inset={false}
        />
      </View>

      {asGrid ? (
        <View style={[styles.grid, { width: contentWidth }]}>
          {items.map((item, position) => card(item, position, gridWidth))}
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={pageWidth}
            snapToAlignment="start"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            style={{ width: contentWidth }}
          >
            {items.map((item, position) => (
              <View key={item.name} style={{ width: pageWidth }}>
                {card(item, position, pageWidth)}
              </View>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {items.map((item, position) => (
              <View
                key={item.name}
                style={[styles.dot, position === index ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm, alignItems: "center" },
  card: { gap: theme.spacing.sm, minHeight: 168 },
  /**
   * `stretch` written down rather than inherited. Safe — the cards carry
   * `minHeight` and real quote text — and required: `author` is pinned with
   * `marginTop: "auto"`, which only has slack to take up once the card has been
   * stretched to its line.
   */
  grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: theme.spacing.md },
  author: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: "auto" },
  authorText: { flex: 1 },
  dots: { flexDirection: "row", gap: theme.spacing.xs + 2, paddingTop: theme.spacing.xs },
  dot: { width: 7, height: 7, borderRadius: theme.radius.pill },
  dotActive: { backgroundColor: theme.colors.primary },
  dotIdle: { backgroundColor: theme.colors.borderStrong },
});
