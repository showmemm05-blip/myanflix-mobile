import { useCallback, type ComponentProps } from "react";
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { ActorAvatar } from "@/components/common/ActorAvatar";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Headshot diameter — a face is recognisable at this size, and eight fit a phone width. */
const AVATAR_SIZE = 64;
/** A cell is the disc plus a little slack for a name wider than it. */
const CELL_WIDTH = AVATAR_SIZE + 16;

/**
 * All a face needs. Deliberately the MINIMUM: the search result row
 * (`ActorListItem`) and a movie's inline cast entry (`MovieActorRef`) both
 * satisfy it, so one rail serves both without either side widening.
 */
export interface RailPerson {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** Module scope — handed to FlatList, whose cells are PureComponents (see ResultsGrid). */
const keyExtractor = (actor: RailPerson) => actor.id;

interface Props<T extends RailPerson> {
  actors: T[];
  /**
   * Generic in the item, not fixed to `RailPerson`: a caller's handler may ask
   * for its OWN richer row (Search hands one typed `ActorListItem`), which a
   * `(actor: RailPerson) => void` parameter would reject under
   * strictFunctionTypes.
   */
  onPress: (actor: T) => void;
  /** Heading above the row. Defaults to the Search screen's "People". */
  title?: string;
  /**
    * Leading accent icon for the heading. `null` turns it off — the movie page
    * needs that, because every other heading there (Synopsis, Details) draws
    * SectionHeader's plain rule and a lone icon tile would single this one out.
    * Omitting the prop keeps the Search screen's "people" icon.
    */
  icon?: ComponentProps<typeof SectionHeader>["icon"] | null;
  /** Set false inside an already-padded container (the movie page's spine). */
  inset?: boolean;
}

/**
 * A horizontal row of round photos with the name under each; tapping a face
 * opens that person's page. Used in two places: the Search screen's People
 * row above the results (the term matched actors) and the movie page's Cast
 * row. Both get the same disc size and the same cell, so one person looks the
 * same wherever they appear.
 */
export function PeopleRail<T extends RailPerson>({
  actors,
  onPress,
  title,
  icon = "people-outline",
  inset = true,
}: Props<T>) {
  const { t } = useLanguage();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T>) => (
      <PressableScale onPress={() => onPress(item)} accessibilityLabel={item.name} style={styles.cell}>
        <ActorAvatar name={item.name} imageUrl={item.imageUrl} size={AVATAR_SIZE} />
        <ThemedText variant="caption" weight="medium" color={theme.colors.text} numberOfLines={2} style={styles.name}>
          {item.name}
        </ThemedText>
      </PressableScale>
    ),
    [onPress],
  );

  return (
    <View style={styles.section}>
      <SectionHeader title={title ?? t.search.people} icon={icon ?? undefined} inset={inset} />
      <FlatList
        horizontal
        data={actors}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, inset && styles.rowInset]}
        // The search field sits above this rail, so a tap on a face must land
        // even while the keyboard is up, and a drag must put it away.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.spacing.xs },
  row: { gap: theme.spacing.sm },
  rowInset: { paddingHorizontal: theme.layout.screenPadding },
  cell: { width: CELL_WIDTH, alignItems: "center", gap: theme.spacing.xs },
  name: { textAlign: "center", fontSize: 12, lineHeight: 16 },
});
