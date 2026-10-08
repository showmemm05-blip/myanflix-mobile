import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ActorAvatar } from "@/components/common/ActorAvatar";
import { theme } from "@/theme";
import type { MovieActorRef } from "@/types/movie";

/** MovieDetail.dc.html: 84pt faces, 14pt apart. */
const FACE = 84;
const GAP = 14;

interface Props {
  title: string;
  actors: MovieActorRef[];
  /** Stable (memoized by the screen) — it is every cell's prop. */
  onPress: (actor: MovieActorRef) => void;
}

const keyExtractor = (actor: MovieActorRef) => actor.id;
const Separator = () => <View style={styles.separator} />;

const CastCell = memo(function CastCell({
  actor,
  onPress,
}: {
  actor: MovieActorRef;
  onPress: (actor: MovieActorRef) => void;
}) {
  return (
    <PressableScale onPress={() => onPress(actor)} accessibilityLabel={actor.name} style={styles.cell}>
      <ActorAvatar name={actor.name} imageUrl={actor.imageUrl} size={FACE} />
      {/* Two lines, centred: a person's name is never cut to an ellipsis on one. */}
      <ThemedText variant="caption" weight="bold" color={theme.colors.text} numberOfLines={2} style={styles.name}>
        {actor.name}
      </ThemedText>
    </PressableScale>
  );
});

/**
 * The cast row on a title page — round 84pt faces (a photo when the catalogue
 * has one, initials otherwise) with the name under each; a tap opens that
 * person's page. Nothing at all when the title carries no cast. The catalogue
 * has no roles or crew, so no role line is drawn.
 */
export function CastRail({ title, actors, onPress }: Props) {
  const renderItem = useCallback<ListRenderItem<MovieActorRef>>(
    ({ item }) => <CastCell actor={item} onPress={onPress} />,
    [onPress],
  );

  if (actors.length === 0) return null;

  return (
    <View>
      <SectionHeader title={title} />
      <FlatList
        horizontal
        data={actors}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={FACE + GAP}
        decelerationRate="fast"
        snapToAlignment="start"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: theme.layout.screenPadding },
  separator: { width: GAP },
  cell: { width: FACE, alignItems: "center" },
  name: { marginTop: theme.spacing.sm, textAlign: "center" },
});
