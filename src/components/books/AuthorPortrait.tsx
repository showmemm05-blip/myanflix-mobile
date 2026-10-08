import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { personInitials } from "@/components/common/ActorAvatar";
import { theme, withAlpha } from "@/theme";

/** An initials disc's fill and ink. */
export interface AuthorTone {
  fill: string;
  ink: string;
}

/**
 * The tinted initials of Authors.dc.html (rose, sky, teal, amber…), built
 * from theme ROLE colours at their soft strength rather than from the
 * board's literal hexes, so they follow the palette. Rose is the theme's own
 * initials-avatar pair. Decorative only — every tone's ink is ≥ 6:1 on its fill.
 */
const TONES: AuthorTone[] = [
  { fill: theme.colors.avatar, ink: theme.colors.onAvatar },
  { fill: withAlpha(theme.colors.info, 0.16), ink: theme.colors.info },
  { fill: withAlpha(theme.colors.success, 0.16), ink: theme.colors.success },
  { fill: withAlpha(theme.colors.warning, 0.16), ink: theme.colors.warning },
  { fill: theme.colors.surfaceElevated, ink: theme.colors.textMuted },
];

/**
 * A stable tone per person — hashed from the id, so the same author has the
 * same colour on the Books rail, in the list and on their own page.
 */
export function authorTone(seed: string): AuthorTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

interface Props {
  /** Seeds the tone — the author row's id. */
  id: string;
  name: string;
  imageUrl?: string | null;
  /** Diameter in pt. */
  size: number;
  /** Ring in the page colour (the author page's avatar overlapping its band). */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The round author portrait — a photo when the catalogue has one, otherwise
 * the board's tinted initials disc. Visual only; the caller's pressable or
 * heading carries the name for screen readers.
 */
export const AuthorPortrait = memo(function AuthorPortrait({ id, name, imageUrl, size, ring, style }: Props) {
  const tone = authorTone(id);
  // Initials sit at about a third of the disc: 24 in an 84 disc, 38 in 112, 11 in 28.
  const fontSize = Math.max(11, Math.round(size * 0.32));
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.fill },
        ring && styles.ring,
        style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : (
        <ThemedText
          weight="extrabold"
          color={tone.ink}
          numberOfLines={1}
          // Fixed to the disc, never scaled by the OS text size: the disc
          // itself does not grow, and two initials must stay inside it.
          allowFontScaling={false}
          style={{ fontSize, lineHeight: Math.round(fontSize * 1.3) }}
        >
          {personInitials(name)}
        </ThemedText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ring: { borderWidth: 4, borderColor: theme.colors.background },
});
