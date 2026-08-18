import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { SectionIntro } from "@/components/home/SectionIntro";
import { EditorialArt } from "@/components/home/EditorialArt";
import { useSectionWidth } from "@/components/home/SectionWidth";
import { HOME_CONTENT, avatarUrl } from "@/components/home/content";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

const AVATAR = 64;

/**
 * Pushes the team's grounds off Behind-the-Scenes'. Both are four-item grids at
 * the same column count in the same band, and both seeded from a bare index —
 * so they ran the identical ink sequence, left to right, a screen apart. 23,
 * because an offset only moves BOTH wheels when it is non-zero mod 5 (inks) and
 * mod 4 (person glyphs); see TestimonialPager, which found this first.
 */
const SEED_OFFSET = 23;

/**
 * The people, on the same editorial material as the rest of the well: flat
 * surfaces, photographic avatars, no buttons. Columns come from the page's
 * shared layout hook — 2 on a phone, 3 on a large phone, 4 on a tablet — and
 * the tile width is computed, never a percentage string.
 *
 * The avatars are the one place on the page where the image IS the content, and
 * they come from a third-party host, so a blocked or offline device would
 * otherwise show four grey discs that never resolve. The local-vs-remote
 * bookkeeping this section used to carry is gone: `EditorialArt` draws a
 * seeded, tinted person mark FIRST and fades the photograph in over it, so the
 * "failed" state and the "still loading" state look the same — finished — and
 * the four faces differ from each other either way. Still a glyph rather than
 * initials, because slicing two characters off a Burmese name splits a
 * combining cluster.
 */
export function TeamSpotlight() {
  const { t } = useLanguage();
  const { columns } = useHomeLayout();
  const contentWidth = useSectionWidth();

  const tileWidth = (contentWidth - theme.spacing.md * (columns - 1)) / columns;

  return (
    <View style={styles.container}>
      <View style={{ width: contentWidth }}>
        <SectionIntro
          eyebrow={t.home.team.eyebrow}
          title={t.home.team.title}
          subtitle={t.home.team.subtitle}
          icon="people-outline"
          inset={false}
        />
      </View>
      <View style={[styles.grid, { width: contentWidth }]}>
        {t.home.team.members.map((member, index) => (
          <Surface
            key={member.name}
            radius="2xl"
            tone="flat"
            padded
            style={[styles.card, { width: tileWidth }]}
            accessible
            accessibilityLabel={`${member.name}. ${member.role}. ${member.bio}`}
          >
            <View style={styles.avatarRing}>
              <EditorialArt
                seed={index + SEED_OFFSET}
                kind="person"
                uri={avatarUrl(HOME_CONTENT.teamAvatarSeeds[index])}
                width={AVATAR}
                height={AVATAR}
                radius={theme.radius.pill}
              />
            </View>
            <ThemedText variant="body" weight="semibold" numberOfLines={2}>
              {member.name}
            </ThemedText>
            {/* Muted, not violet: nothing in the editorial well is tappable, and
                violet is the app's action ink. */}
            <ThemedText variant="caption" weight="semibold" color={theme.colors.textMuted} numberOfLines={2}>
              {member.role}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textFaint}>
              {member.bio}
            </ThemedText>
          </Surface>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm, alignItems: "center" },
  /**
   * `stretch` WRITTEN DOWN, not inherited — see BehindTheScenes for what an
   * unexamined stretch does to a wrapping row. It is safe and wanted here: the
   * tiles' heights come from real text children, so a line has something to
   * stretch to, and equal-height cards is the point of stretching.
   */
  grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: theme.spacing.md },
  card: { gap: 3, alignItems: "flex-start" },
  avatarRing: {
    padding: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
});
