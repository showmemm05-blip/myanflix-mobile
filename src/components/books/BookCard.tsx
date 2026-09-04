import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { theme } from "@/theme";

interface Props {
  title: string;
  author: string;
  coverUrl?: string | null;
  /** Fixed card width (rails). Omit to fill the parent (grid cells). */
  width?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The catalog's book tile — a 5:7 cover (books are taller than movie posters)
 * with title and author below, the poster-grid sibling of MediaCard.
 */
export const BookCard = memo(function BookCard({ title, author, coverUrl, width, onPress, style }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      activeScale={0.96}
      dimOnPress
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${author}`}
      style={[width ? { width } : styles.stretch, style]}
    >
      <View style={styles.cover}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="book-outline" size={26} color={theme.colors.textFaint} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <ThemedText variant="caption" weight="medium" color={theme.colors.text} numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1} style={styles.author}>
          {author}
        </ThemedText>
      </View>
    </PressableScale>
  );
});

/** Matching placeholder so the loading grid keeps its layout. */
export function BookCardSkeleton({ width, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[width ? { width } : styles.stretch, style]}>
      <View style={styles.skeletonCover} />
      <View style={styles.text}>
        <Skeleton width="70%" height={12} radius="sm" />
        <Skeleton width="45%" height={10} radius="sm" style={styles.skeletonMeta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch", width: "100%" },
  cover: {
    width: "100%",
    aspectRatio: 5 / 7,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  coverFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  text: { marginTop: theme.spacing.sm, gap: 2 },
  author: { fontSize: 12 },
  skeletonCover: {
    width: "100%",
    aspectRatio: 5 / 7,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonMeta: { marginTop: 2 },
});
