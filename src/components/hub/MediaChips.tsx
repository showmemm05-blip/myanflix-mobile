import { memo, type ReactNode, type RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FadeInView } from "@/components/ui/FadeInView";
import type { HubKind } from "@/components/hub/hubLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

/** What the Media tab can show: one of the three hubs, or Music (coming soon). */
export type MediaChip = HubKind | "music";

/**
 * The Netflix row a results view shows instead of the content chips: a
 * round ✕ (back to browse, every filter cleared), the type, and the picked
 * genre or category highlighted with a ▾ that reopens the Categories
 * overlay — or plain "Categories ▾" when nothing is picked (a shelf's See all).
 */
export interface MediaChipsSelection {
  /** The picked genre / category's name, or null. */
  pick: string | null;
  onClear: () => void;
}

interface Props {
  value: MediaChip;
  onChange: (chip: MediaChip) => void;
  /** Opens the Categories pop-up (Movies · Series · Books) — from every chip since 2026-10-07. */
  onCategories: () => void;
  /**
   * Attached to whichever chip opens the pop-up right now ("Categories ▾"
   * on browse, the picked name on a results view), so the Media screen can
   * hand screen-reader focus back to it when the pop-up closes.
   */
  categoriesRef?: RefObject<View | null>;
  /** Set while Movies or Series is showing its results view. */
  selection?: MediaChipsSelection | null;
}

/** Boards: a 36pt chip, radius 18, inside a 44pt target. */
const CHIP_HEIGHT = 36;
/** Resting chip fill over the art: white at 14% on a dark blur (boards). */
const RESTING_FILL = withAlpha(theme.colors.text, 0.14);
/** The "Soon" tag on the Music chip: white at 18% on a resting chip, ground at 10% on the selected white one. */
const TAG_FILL = withAlpha(theme.colors.text, 0.18);
const TAG_FILL_SELECTED = withAlpha(theme.colors.onPlay, 0.1);
/** The hairline between Categories and Music (white at 24%). */
const DIVIDER = withAlpha(theme.colors.text, 0.24);
/** The picked genre's ring — "this is what you are looking at". */
const PICK_RING = withAlpha(theme.colors.text, 0.9);

/**
 * The Media tab's chip row. It is laid over the hero under the "Media" bar,
 * so every chip is dark glass — white at 14% over a blur — and the current
 * one is solid white with near-black ink.
 *
 * Browse: Movies · Series · Books · "Categories ▾", a hairline, then Music
 * (with a small "Soon" tag) — the owner's order (2026-10-02).
 *
 * Results (Movies / Series, the Netflix way): ✕ · Movies · "Drama ▾". The ✕
 * goes back to browse, the white type chip says where you are, and the
 * ringed pick reopens the Categories overlay. The two rows cross-fade (a
 * plain swap under reduce motion).
 *
 * One sideways rail: at 2× text or in Burmese the row scrolls rather than
 * ever shrinking or cutting a label. Every chip keeps a 44pt target.
 */
export const MediaChips = memo(function MediaChips({
  value,
  onChange,
  onCategories,
  categoriesRef,
  selection,
}: Props) {
  const { t } = useLanguage();
  const options: { chip: MediaChip; label: string }[] = [
    { chip: "movies", label: t.search.movies },
    { chip: "series", label: t.search.series },
    { chip: "books", label: t.search.books },
  ];
  const typeLabel = options.find((option) => option.chip === value)?.label ?? t.search.movies;

  const contentChip = (chip: MediaChip, label: string) => {
    const selected = chip === value;
    const soon = chip === "music";
    return (
      <GlassChip
        key={chip}
        selected={selected}
        onPress={() => onChange(chip)}
        accessibilityLabel={soon ? `${label}, ${t.hub.soon}` : label}
      >
        <ThemedText
          variant="muted"
          weight={selected ? "extrabold" : "bold"}
          color={selected ? theme.colors.onPlay : theme.colors.text}
          numberOfLines={1}
        >
          {label}
        </ThemedText>
        {soon ? (
          <View style={[styles.tag, { backgroundColor: selected ? TAG_FILL_SELECTED : TAG_FILL }]}>
            <ThemedText variant="overline" color={selected ? theme.colors.onPlay : theme.colors.text} style={styles.tagText}>
              {t.hub.soon.toUpperCase()}
            </ThemedText>
          </View>
        ) : null}
      </GlassChip>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.rail}
      contentContainerStyle={styles.row}
      accessibilityLabel={t.hub.sectionsA11y}
    >
      {selection ? (
        <FadeInView key="results" duration={220} style={styles.group}>
          <GlassChip
            round
            onPress={selection.onClear}
            accessibilityLabel={t.hub.clearSelectionA11y.replace("{type}", typeLabel)}
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </GlassChip>
          {/* Where you are — not a control (the ✕ is the way back). */}
          <GlassChip selected accessibilityLabel={typeLabel}>
            <ThemedText variant="muted" weight="extrabold" color={theme.colors.onPlay} numberOfLines={1}>
              {typeLabel}
            </ThemedText>
          </GlassChip>
          <GlassChip
            chipRef={categoriesRef}
            ringed={!!selection.pick}
            onPress={onCategories}
            accessibilityLabel={
              selection.pick ? t.hub.changeCategoryA11y.replace("{name}", selection.pick) : t.browse.title
            }
            trailingPad
          >
            <ThemedText
              variant="muted"
              weight={selection.pick ? "extrabold" : "bold"}
              color={theme.colors.text}
              numberOfLines={1}
            >
              {selection.pick ?? t.browse.title}
            </ThemedText>
            <Ionicons name="chevron-down" size={14} color={theme.colors.text} />
          </GlassChip>
        </FadeInView>
      ) : (
        <FadeInView key="browse" duration={220} style={styles.group}>
          {options.map(({ chip, label }) => contentChip(chip, label))}

          <GlassChip chipRef={categoriesRef} onPress={onCategories} accessibilityLabel={t.browse.title} trailingPad>
            <ThemedText variant="muted" weight="bold" color={theme.colors.text} numberOfLines={1}>
              {t.browse.title}
            </ThemedText>
            <Ionicons name="chevron-down" size={14} color={theme.colors.text} />
          </GlassChip>

          <View style={styles.divider} />

          {contentChip("music", t.search.music)}
        </FadeInView>
      )}
    </ScrollView>
  );
});

function GlassChip({
  chipRef,
  selected = false,
  ringed = false,
  round = false,
  onPress,
  accessibilityLabel,
  trailingPad = false,
  children,
}: {
  /** The pressable's view (the Categories chips only — see Props.categoriesRef). */
  chipRef?: RefObject<View | null>;
  selected?: boolean;
  /** The picked genre / category: a white ring over the glass. */
  ringed?: boolean;
  /** The ✕: a 36pt circle. */
  round?: boolean;
  /** Omitted: a label, not a control (the results row's type chip). */
  onPress?: () => void;
  accessibilityLabel: string;
  /** The Categories chip's tighter right edge before its chevron (the board's 14 / 12). */
  trailingPad?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const face = (
    <View
      style={[
        styles.chip,
        trailingPad && styles.chipTrailing,
        round && styles.chipRound,
        selected && styles.chipSelected,
        ringed && styles.chipRinged,
      ]}
    >
      {selected ? null : (
        <View style={styles.glass} pointerEvents="none">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
        </View>
      )}
      {children}
    </View>
  );

  if (!onPress) {
    return (
      <View style={styles.target} accessible accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }}>
        {face}
      </View>
    );
  }

  return (
    <Pressable
      ref={chipRef}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.target,
        round && styles.targetRound,
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { flexGrow: 0 },
  /** 8pt under the bar's control row (the boards' 52 → 60). */
  row: {
    alignItems: "center",
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
  },
  group: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  target: { minHeight: theme.layout.minTouch, justifyContent: "center" },
  /** The ✕'s 44pt square target around its 36pt disc. */
  targetRound: { minWidth: theme.layout.minTouch, alignItems: "center" },
  /** A minimum, so 2× text grows the chip rather than clipping its label. */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: 4,
    borderRadius: CHIP_HEIGHT / 2,
    overflow: "hidden",
  },
  chipTrailing: { paddingLeft: 14, paddingRight: 12 },
  chipRound: { width: CHIP_HEIGHT, height: CHIP_HEIGHT, paddingHorizontal: 0, paddingVertical: 0, justifyContent: "center" },
  chipSelected: { backgroundColor: theme.colors.play },
  chipRinged: { borderWidth: 1.5, borderColor: PICK_RING },
  glass: { ...StyleSheet.absoluteFill, borderRadius: CHIP_HEIGHT / 2, overflow: "hidden" },
  glassFill: { backgroundColor: RESTING_FILL },
  tag: { minHeight: 18, paddingHorizontal: 6, borderRadius: 9, justifyContent: "center" },
  tagText: { fontSize: 10 },
  divider: { width: 1, height: 20, marginHorizontal: 2, backgroundColor: DIVIDER },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.75 },
});
