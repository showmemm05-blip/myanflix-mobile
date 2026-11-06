import { memo, type Ref } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";
import { LtText } from "@/lottery/components/LtText";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { BOOK_LOOK } from "@/lottery/screens/dreams/dreamBook";
import { DreamLineArt, GridGlyph, MoonGlyph } from "@/lottery/screens/dreams/DreamGlyphs";
import { DreamSearchField } from "@/lottery/screens/dreams/DreamSearchField";
import { LT, LT_RADIUS, LT_SHADOW, LT_SPACE } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

const COPY = DREAM_COPY.book;

/**
 * A dream book's cream band under the top bar (canvas "Dream detail, simpler"
 * › Book, the owner's pick "the question" on 3 Nov 2026): the "Dream book"
 * kicker, the question "What did you dream about?" as the page's one heading
 * — the book's name is in the top bar now — and the search pill right on the
 * band. Dream Number 1000 keeps the moon-and-book line art at the right (the
 * question wraps before it), Dream Number 100 its "100 DREAMS" stamp beside
 * the words. The first design's one-liner and "312 dreams" tag are gone: the
 * count line under "All dreams" says how many the book holds.
 */
export const DreamIntro = memo(function DreamIntro({
  book,
  query,
  onChange,
  onClear,
  inputRef,
}: {
  book: DreamBook;
  query: string;
  onChange: (text: string) => void;
  onClear: () => void;
  inputRef?: Ref<TextInputInstance>;
}) {
  const look = BOOK_LOOK[book];
  const search = (
    <View style={styles.search}>
      <DreamSearchField
        value={query}
        onChange={onChange}
        onClear={onClear}
        placeholder={COPY.searchPlaceholder}
        clearLabel={COPY.clearA11y}
        accessibilityLabel={COPY.searchA11y(book)}
        inputRef={inputRef}
      />
    </View>
  );

  if (book === "100") {
    return (
      <View style={styles.band}>
        <View style={styles.row}>
          <View style={styles.stamp} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LtText role="display" maxFontSizeMultiplier={1.2}>
              100
            </LtText>
            <LtText role="microB" color={LT.seal} style={styles.stampWord} maxFontSizeMultiplier={1.2}>
              {COPY.stampWord}
            </LtText>
          </View>
          <View style={styles.text}>
            <View style={styles.kicker}>
              <GridGlyph color={look.mark} />
              <LtText role="kicker">{COPY.kicker}</LtText>
            </View>
            <LtText role="h" accessibilityRole="header" style={styles.h}>
              {COPY.question}
            </LtText>
          </View>
        </View>
        {search}
      </View>
    );
  }

  return (
    <View style={styles.band}>
      <View style={styles.art}>
        <DreamLineArt color={look.mark} />
      </View>
      <View style={styles.kicker}>
        <MoonGlyph color={look.mark} />
        <LtText role="kicker">{COPY.kicker}</LtText>
      </View>
      <LtText role="h" accessibilityRole="header" style={styles.question}>
        {COPY.question}
      </LtText>
      {search}
    </View>
  );
});

const styles = StyleSheet.create({
  /** Full bleed: the column's 16pt gutters are cancelled, then given back as padding (board: padding 20 16 20). */
  band: {
    marginHorizontal: -LT_SPACE.gutter,
    paddingTop: 20,
    paddingHorizontal: LT_SPACE.gutter,
    paddingBottom: 20,
    backgroundColor: LT.cream,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
    overflow: "hidden",
  },
  art: { position: "absolute", top: 14, right: 6 },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 20 },
  /** Board `.lt-drintro__q`: at most 210 wide, so the two lines end above the art's bottom edge instead of under it. */
  question: { marginTop: 10, maxWidth: 210 },
  /** Board `.lt-drpill`: 16 under the heading. */
  search: { marginTop: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stamp: {
    width: 88,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.tag,
    boxShadow: LT_SHADOW.s1,
  },
  /** The stamp's word: Franklin 700 12/16 caps, .08em, seal (lt-base `.lt-stamp__m`). */
  stampWord: { textTransform: "uppercase", letterSpacing: 0.96 },
  text: { flex: 1, minWidth: 0 },
  h: { marginTop: 2 },
});
