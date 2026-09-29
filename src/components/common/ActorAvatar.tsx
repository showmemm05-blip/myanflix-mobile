import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

/**
 * "Tom Hanks" → "TH". One letter per word, two words at most — a person's
 * initials, not the first two characters `utils/format.initials` gives an
 * account name. Codepoint-safe so a Burmese or emoji-led name keeps a whole
 * glyph rather than half a surrogate pair.
 */
export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

interface Props {
  name: string;
  imageUrl: string | null;
  /** Diameter in dp — 64 on the People rail, 96 on the actor page. */
  size: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one round PORTRAIT — a photo when the catalogue has one, an initials
 * disc when it does not. Nothing about it is specific to a cast: it draws
 * anybody the catalogue names, and is shared by the Search screen's People
 * rail, the actors list and actor page, and the authors list and author page,
 * so the same person looks the same everywhere. Keep it that way — a second
 * copy for a second kind of person is how the two would drift apart.
 */
export function ActorAvatar({ name, imageUrl, size, style }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.disc, shape, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          // Rail cells unmount outside the list window and remount on the way
          // back; a headshot is tiny, so the memory tier is cheap.
          cachePolicy="memory-disk"
        />
      ) : (
        <ThemedText variant={size >= 80 ? "section" : "label"} weight="bold" color={theme.colors.text}>
          {personInitials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
});
