import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { IconButton } from "@/components/ui/IconButton";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { ReaderThemeColors } from "@/components/books/readerThemes";

interface Props {
  visible: boolean;
  colors: ReaderThemeColors;
  /** The book's title, centred, one line. */
  title: string;
  onContents: () => void;
  onSettings: () => void;
  onClose: () => void;
  /** Text reader only — the icon renders only when the handler is passed. */
  onSearch?: () => void;
  /** Bookmark toggle — the icon renders only when the handler is passed. */
  onBookmark?: () => void;
  /** Pressed state of the bookmark toggle (a bookmark exists at the current position). */
  bookmarked?: boolean;
}

/**
 * The readers' auto-hiding top bar (BookReader.dc.html): close, contents, the
 * book's title, then the optional search and bookmark slots and the reading
 * settings — on the page colour at 94% with a hairline under it, so it
 * belongs to the page, not the app chrome. Fades with reanimated; snaps under
 * OS reduce-motion.
 */
export function ReaderTopBar({
  visible,
  colors,
  title,
  onContents,
  onSettings,
  onClose,
  onSearch,
  onBookmark,
  bookmarked,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { t } = useLanguage();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: 180 }),
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { paddingTop: insets.top, backgroundColor: withAlpha(colors.bg, 0.94), borderBottomColor: colors.rule },
        animatedStyle,
      ]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <View style={styles.row}>
        <IconButton
          icon="close"
          variant="ghost"
          size="md"
          color={colors.ink}
          onPress={onClose}
          accessibilityLabel={t.books.reader.close}
        />
        <IconButton
          icon="list"
          variant="ghost"
          size="md"
          color={colors.ink}
          onPress={onContents}
          accessibilityLabel={t.books.reader.contents}
        />
        <ThemedText variant="caption" weight="semibold" numberOfLines={1} style={[styles.title, { color: colors.muted }]}>
          {title}
        </ThemedText>
        {onSearch && (
          <IconButton
            icon="search"
            variant="ghost"
            size="md"
            color={colors.ink}
            onPress={onSearch}
            accessibilityLabel={t.books.reader.searchInBook}
          />
        )}
        {onBookmark && (
          <IconButton
            icon={bookmarked ? "bookmark" : "bookmark-outline"}
            variant="ghost"
            size="md"
            color={bookmarked ? theme.colors.primary : colors.ink}
            onPress={onBookmark}
            accessibilityLabel={bookmarked ? t.books.reader.removeBookmark : t.books.reader.addBookmark}
          />
        )}
        <IconButton
          icon="text-outline"
          variant="ghost"
          size="md"
          color={colors.ink}
          onPress={onSettings}
          accessibilityLabel={t.books.reader.settingsTitle}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /** 60pt under the safe area: the 44pt controls with 8pt above and below. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 60,
    paddingHorizontal: theme.spacing.sm,
  },
  title: { flex: 1, textAlign: "center" },
});
