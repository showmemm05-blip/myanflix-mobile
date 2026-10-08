import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeArt } from "@/components/arcade/ArcadeArt";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { ArcadePrice, priceLabel } from "@/components/arcade/ArcadePrice";
import { ArcadeSection } from "@/components/arcade/ArcadeSection";
import { featuredGames } from "@/data/arcade";
import type { Game } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

/**
 * The title set in the art is a logotype, not body copy (the spoken label
 * carries it). At 2× the catalogue's widest word, EMBERFALL, is ~253pt at 22pt
 * black, which still fits the 260pt column of a 320pt phone; past that (the
 * iOS accessibility sizes) it would break mid-word, so it stops growing here.
 */
const ART_TITLE_MAX_SCALE = 2;

/** "·" between meta values — decoration only. */
function Sep() {
  return (
    <ThemedText variant="caption" color={theme.colors.textDecor} importantForAccessibility="no">
      ·
    </ThemedText>
  );
}

function FeaturedCard({ game, width, onPress }: { game: Game; width: number | "100%"; onPress: () => void }) {
  const { t } = useLanguage();
  const price = priceLabel(game, t.arcade.price.free);
  // One spoken sentence for the whole card: title, genre, platforms, rating, price.
  const label = [
    game.title,
    game.genre,
    game.platforms.join(", "),
    game.rating !== null ? t.arcade.a11y.rated.replace("{rating}", game.rating.toFixed(1)) : null,
    price,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ width }}>
      <View style={styles.art}>
        <ArcadeArt gameId={game.id} format="landscape" band />
        {/* Game titles stay Latin in both languages, so the art may set them in capitals. */}
        <ThemedText weight="black" maxFontSizeMultiplier={ART_TITLE_MAX_SCALE} style={styles.artTitle}>
          {game.title}
        </ThemedText>
        {game.badge && <ArcadeBadge kind={game.badge} style={styles.badge} />}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted}>
            {game.genre}
          </ThemedText>
          <Sep />
          <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted}>
            {game.platforms.join(" · ")}
          </ThemedText>
          {game.rating !== null && (
            <>
              <Sep />
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color={theme.colors.premium} />
                <ThemedText variant="caption" weight="regular" color={theme.colors.textBody} tabular>
                  {game.rating.toFixed(1)}
                </ThemedText>
              </View>
            </>
          )}
        </View>
        <ArcadePrice game={game} size="md" />
      </View>
    </PressableScale>
  );
}

/** The four-game featured shelf — stacked on phones, 2-up on wide screens. */
export function StoreFeatured({ onPressGame }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();

  const cardWidth: number | "100%" = layout.isWide
    ? (layout.width - layout.gutter * 2 - GRID_GAP) / 2
    : "100%";

  return (
    <ArcadeSection
      eyebrow={t.arcade.featured.kicker}
      title={t.arcade.featured.title}
      spacing={28}
      gutter={layout.gutter}
    >
      <View style={[styles.grid, { paddingHorizontal: layout.gutter }]}>
        {featuredGames.map((game) => (
          <FeaturedCard key={game.id} game={game} width={cardWidth} onPress={onPressGame} />
        ))}
      </View>
    </ArcadeSection>
  );
}

const GRID_GAP = 16;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GRID_GAP,
    rowGap: 20,
  },
  art: {
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  /** 22/23 black, tight, in capitals — set into the art's dark band. */
  artTitle: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 13,
    fontSize: 22,
    lineHeight: 23,
    letterSpacing: -0.44,
    textTransform: "uppercase",
    color: theme.colors.text,
  },
  badge: { position: "absolute", top: 10, left: 10 },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginTop: theme.spacing.sm,
  },
  meta: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 6,
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
});
