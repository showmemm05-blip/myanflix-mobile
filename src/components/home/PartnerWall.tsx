import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { SectionIntro } from "@/components/home/SectionIntro";
import { HOME_CONTENT } from "@/components/home/content";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/**
 * The narrowest tile the three-line description was designed to sit in: the
 * 4-up tablet tile, 170pt. Gating the description on `isTablet` instead was
 * backwards against its own reason — at 767pt the tile is 237pt wide and the
 * description is hidden; at 768pt the tile shrinks to 170pt and it appears. The
 * wider box was the one refusing to show the text. Measure the box.
 */
const DESCRIPTION_MIN_TILE = 168;

/**
 * Credibility, laid out as a wall rather than a rail. A horizontal strip lets a
 * reader skip most of the list without noticing; the point of a partner list is
 * that you see how long it is. All five are visible at once, at every width.
 *
 * Nothing here is tappable — none of these organisations has a destination
 * inside this app — so the tiles carry a composed label for screen readers and
 * no button role.
 *
 * Columns come from the page's shared layout hook. A fifth column on tablet
 * squeezed the text box to ~100pt, which is narrower than any of the partner
 * descriptions — and the description only renders once the tile is wide enough
 * to hold it, so the extra column was cutting off the one thing it existed to
 * make room for.
 */
export function PartnerWall() {
  const { t } = useLanguage();
  const { contentWidth, columns } = useHomeLayout();

  const tileWidth = (contentWidth - theme.spacing.sm * (columns - 1)) / columns;
  const showDescription = tileWidth >= DESCRIPTION_MIN_TILE;

  return (
    <View style={styles.container}>
      <View style={{ width: contentWidth }}>
        <SectionIntro
          eyebrow={t.home.partners.eyebrow}
          title={t.home.partners.title}
          subtitle={t.home.partners.subtitle}
          icon="link-outline"
          inset={false}
        />
      </View>
      <View style={[styles.grid, { width: contentWidth }]}>
        {t.home.partners.items.map((item, index) => (
          <Surface
            key={item.name}
            radius="2xl"
            // `flat` is the EDITORIAL WELL's material. This block sits above the
            // well on the page's own ground, next to the testimonial cards, and
            // proof laid out in two different materials reads as two systems.
            tone="default"
            padded
            style={[styles.tile, { width: tileWidth }]}
            accessible
            accessibilityLabel={`${item.name}. ${item.description}`}
          >
            <View style={styles.initialsTile}>
              <ThemedText variant="caption" weight="bold">
                {HOME_CONTENT.partnerInitials[index]}
              </ThemedText>
            </View>
            <ThemedText variant="caption" weight="semibold" numberOfLines={2}>
              {item.name}
            </ThemedText>
            {showDescription && (
              <ThemedText variant="caption" color={theme.colors.textFaint} numberOfLines={3}>
                {item.description}
              </ThemedText>
            )}
          </Surface>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm, alignItems: "center" },
  /**
   * `stretch` written down rather than inherited — safe here (every tile's
   * height comes from real text children) and wanted, so a wrapped line of
   * partner tiles ends level. Compare BehindTheScenes, where an inherited
   * stretch over aspect-ratio-only children collapsed the row to nothing.
   */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    gap: theme.spacing.sm,
  },
  tile: { gap: theme.spacing.xs, alignItems: "flex-start" },
  initialsTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
