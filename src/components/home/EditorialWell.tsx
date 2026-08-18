import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionWidthProvider } from "@/components/home/SectionWidth";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  children: ReactNode;
}

/**
 * The press room. Everything below the fold-break — behind the scenes, news,
 * the roadmap, the team — is editorial, not advertising, and it says so by
 * changing material: the page drops into a sunken band with its own heading,
 * flat surfaces, hairline borders and photographic artwork, and not one solid
 * role-coloured button in the whole well.
 *
 * The band's heading is rendered HERE rather than through SectionIntro on
 * purpose. Its four children each carry a `section`-sized SectionIntro with a
 * 30pt icon tile; if the parent used the same one it would be the fifth
 * identical heading in a row and the band would read as a peer section that
 * happens to have a background. `title` puts it one full step up the type
 * scale, which is what makes the nesting visible.
 *
 * A TicketCard must never be placed in here: its notches are punched to
 * `background` and would read as the wrong fill over the sunken ground.
 */
export function EditorialWell({ children }: Props) {
  const { t } = useLanguage();
  const { contentWidth, isTablet } = useHomeLayout();

  // On tablet the band draws its own padded, rounded frame. Its children size
  // themselves from this rather than from the window, because a child at the
  // page's full content width plus the band's own padding is wider than an
  // iPad in portrait — which is how the inset that makes it a card was lost.
  const innerWidth = isTablet ? contentWidth - theme.spacing.xl * 2 : contentWidth;

  return (
    <SectionWidthProvider width={innerWidth}>
      <View style={[styles.band, isTablet && styles.bandTablet]}>
        <View style={[styles.heading, { width: innerWidth }]}>
          <ThemedText variant="overline" color={theme.colors.primary}>
            {t.home.editorial.eyebrow.toUpperCase()}
          </ThemedText>
          <ThemedText variant="title">{t.home.editorial.title}</ThemedText>
        </View>
        <View style={styles.sections}>{children}</View>
      </View>
    </SectionWidthProvider>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: theme.colors.surfaceSunken,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.lg,
    alignItems: "center",
  },
  bandTablet: {
    maxWidth: 940,
    alignSelf: "center",
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius["3xl"],
    borderWidth: 1,
  },
  heading: { gap: 2 },
  sections: { alignSelf: "stretch", alignItems: "center", gap: theme.spacing.xl },
});
