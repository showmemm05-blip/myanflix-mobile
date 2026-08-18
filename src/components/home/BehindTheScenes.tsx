import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionIntro } from "@/components/home/SectionIntro";
import { EditorialArt } from "@/components/home/EditorialArt";
import { useSectionWidth } from "@/components/home/SectionWidth";
import { HOME_CONTENT } from "@/components/home/content";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Portrait tiles: height = width × 4/3, computed, never left to `aspectRatio`. */
const TILE_RATIO = 4 / 3;
/** The two clamps on the caption, kept here because the tile has to reserve
    room for exactly this many lines — the clamp and the reservation are one
    decision and must not drift apart. */
const TITLE_LINES = 2;
const DESCRIPTION_LINES = 5;
/** Gap between the two caption lines, in the overlay's own style below. */
const CAPTION_GAP = 2;

/**
 * Editorial, not advertising: photographic artwork, a hairline ring, a
 * SectionIntro heading and nothing tappable. The tile widths are computed from
 * the page's content column rather than guessed at with a percentage, so the
 * grid stays honest at 360pt and on a tablet alike.
 *
 * The tile HEIGHT is computed too, and that is not a style preference. This
 * grid once shipped as four hairlines and a void: a wrapping row inherits
 * `alignItems: stretch`, and a stretched child whose own height comes only from
 * `aspectRatio` — with an absoluteFill image and an absolute caption inside, so
 * nothing contributes layout height — resolves to zero. Belt AND braces now:
 * the row aligns to `flex-start` AND `EditorialArt` is handed a real height.
 * Every tile occupies its space with no images, no network and no copy.
 */
export function BehindTheScenes() {
  const { t } = useLanguage();
  // Columns come from the shared hook like every other grid on the page. A
  // local 2/4 split left this section at two columns across the 600–767pt band
  // (foldables, split view, landscape phones) where Team and Partners go to
  // three — a ~1000pt wall of photography inside the editorial band.
  const { columns, fontScale } = useHomeLayout();
  const contentWidth = useSectionWidth();

  const tileWidth = (contentWidth - theme.spacing.md * (columns - 1)) / columns;
  // Worst case the caption occupies: every clamped line at the OS text size,
  // plus the overlay's padding and the gap between the two blocks. This is the
  // one block on the page whose height does NOT come from its children, so it
  // has to do the children's arithmetic itself — a 3:4 tile at 320pt is 176pt
  // tall and seven lines of 13pt text at a 1.3× accessibility size is 182pt,
  // and `overflow: hidden` on a bottom-anchored overlay eats the TOP of the
  // caption, i.e. the title.
  const captionBlock =
    Math.ceil(theme.type.caption.lineHeight * fontScale * (TITLE_LINES + DESCRIPTION_LINES)) +
    CAPTION_GAP +
    theme.spacing.sm * 2;
  const tileHeight = Math.max(Math.round(tileWidth * TILE_RATIO), captionBlock);

  // Where the caption starts, as a fraction of the tile — so the scrim is tied
  // to the thing it has to make readable instead of to a guessed constant. It
  // used to be transparent until 0.35 while the text began at ~0.29, which put
  // the title on bare photograph.
  const captionTop = Math.max(0, 1 - captionBlock / tileHeight);
  const lead = Math.min(captionTop, 24 / tileHeight);
  const scrimStops: readonly [number, number, number] = [captionTop - lead, captionTop, 1];

  return (
    <View style={styles.container}>
      <View style={{ width: contentWidth }}>
        <SectionIntro
          eyebrow={t.home.behindTheScenes.eyebrow}
          title={t.home.behindTheScenes.title}
          subtitle={t.home.behindTheScenes.subtitle}
          icon="videocam-outline"
          inset={false}
        />
      </View>
      <View style={[styles.grid, { width: contentWidth }]}>
        {t.home.behindTheScenes.items.map((item, index) => (
          <EditorialArt
            key={item.caption}
            seed={index}
            kind="scene"
            uri={HOME_CONTENT.behindTheScenesImages[index]}
            width={tileWidth}
            height={tileHeight}
            bordered
            accessible
            accessibilityLabel={`${item.caption}. ${item.description}`}
          >
            <LinearGradient
              colors={["transparent", theme.colors.scrimSoft, theme.colors.scrim]}
              locations={scrimStops}
              style={styles.overlay}
            >
              {/* Full-strength ink, NOT the `caption` variant's default: that
                  default is `textMuted`, the exact colour the description below
                  asks for by name, so the two lines were the same size, the
                  same colour and separated only by weight — no hierarchy at all
                  on top of a photograph. */}
              <ThemedText
                variant="caption"
                weight="semibold"
                color={theme.colors.text}
                numberOfLines={TITLE_LINES}
              >
                {item.caption}
              </ThemedText>
              {/* Bounded only because the tile has a fixed aspect ratio and
                  clips: an ellipsis reads better than a glyph cut in half.
                  Five lines is what a 3:4 tile actually has room for — three
                  dropped the tail of every description in both languages. */}
              <ThemedText
                variant="caption"
                color={theme.colors.textMuted}
                numberOfLines={DESCRIPTION_LINES}
              >
                {item.description}
              </ThemedText>
            </LinearGradient>
          </EditorialArt>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm, alignItems: "center" },
  /**
   * `flex-start`, NOT the inherited `stretch`. Every tile already carries its
   * own computed height, so there is nothing for a line to stretch — and this
   * is the guard that stops a future tile from collapsing the same way.
   */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
    padding: theme.spacing.sm,
    gap: CAPTION_GAP,
  },
});
