import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { AuthorPortrait } from "@/components/books/AuthorPortrait";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { BookAuthorListItem } from "@/api/bookAuthors.api";

/** Books.dc.html: an 84pt portrait in an 84pt column, 14pt apart. */
const PORTRAIT = 84;
const GAP = 14;
const EDGE = theme.layout.screenPadding;

interface Props {
  title: string;
  authors: BookAuthorListItem[];
  loading?: boolean;
  onPressAuthor: (author: BookAuthorListItem) => void;
  onSeeAll: () => void;
  seeAllLabel: string;
  /** Ink of "See all". Books.dc.html (Marquee) draws it grey; the hub boards draw every row's white. */
  seeAllTone?: "link" | "text" | "muted";
}

const keyExtractor = (author: BookAuthorListItem) => author.id;
const Separator = () => <View style={styles.separator} />;

const AuthorCell = memo(function AuthorCell({
  author,
  onPress,
}: {
  author: BookAuthorListItem;
  onPress: (author: BookAuthorListItem) => void;
}) {
  const { t } = useLanguage();
  const count =
    author.bookCount === 1 ? t.authors.booksCountOne : t.authors.booksCount.replace("{n}", String(author.bookCount));
  return (
    <PressableScale onPress={() => onPress(author)} accessibilityLabel={`${author.name}, ${count}`} style={styles.cell}>
      <AuthorPortrait id={author.id} name={author.name} imageUrl={author.imageUrl} size={PORTRAIT} />
      <ThemedText
        variant="caption"
        weight="bold"
        color={theme.colors.text}
        numberOfLines={2}
        style={styles.name}
      >
        {author.name}
      </ThemedText>
      {/* Two lines: "စာအုပ် 12 အုပ်" at 2× is wider than the 84pt column. */}
      <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} numberOfLines={2} style={styles.count}>
        {count}
      </ThemedText>
    </PressableScale>
  );
});

/**
 * The Books screen's Authors shelf — round portraits with the name and book
 * count, and "See all" into the full Authors list. A new entry point: until
 * Marquee, the list was reachable only from the Search Books tab.
 */
export function AuthorRail({
  title,
  authors,
  loading,
  onPressAuthor,
  onSeeAll,
  seeAllLabel,
  seeAllTone = "muted",
}: Props) {
  const renderItem = useCallback<ListRenderItem<BookAuthorListItem>>(
    ({ item }) => <AuthorCell author={item} onPress={onPressAuthor} />,
    [onPressAuthor],
  );

  if (!loading && authors.length === 0) return null;

  return (
    <View>
      <SectionHeader title={title} titleLines={3} onSeeAll={onSeeAll} seeAllLabel={seeAllLabel} seeAllTone={seeAllTone} />
      {loading && authors.length === 0 ? (
        <View style={styles.skeletonRow}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.cell}>
              <Skeleton width={PORTRAIT - 8} height={PORTRAIT - 8} radius="pill" />
              <Skeleton width={60} height={12} radius="xs" style={styles.name} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={authors}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          snapToInterval={PORTRAIT + GAP}
          decelerationRate="fast"
          snapToAlignment="start"
          initialNumToRender={5}
          maxToRenderPerBatch={6}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: EDGE },
  separator: { width: GAP },
  cell: { width: PORTRAIT, alignItems: "center" },
  name: { marginTop: theme.spacing.sm, textAlign: "center" },
  count: { textAlign: "center", letterSpacing: 0 },
  skeletonRow: { flexDirection: "row", gap: GAP, paddingHorizontal: EDGE, overflow: "hidden" },
});
