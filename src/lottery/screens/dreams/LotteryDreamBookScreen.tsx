import { useCallback, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, View, useWindowDimensions, type TextInputInstance } from "react-native";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { useDreams } from "@/lottery/hooks/useDreams";
import type { LotteryHomeScreenProps } from "@/lottery/navigation/types";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { HintLine, useAnnounceWhenStill } from "@/lottery/screens/dreams/DreamBits";
import {
  BOOK_LOOK,
  GRID_GAP,
  PAGE_SIZE,
  bookDreams,
  cardMetrics,
  searchBook,
  type BookDream,
} from "@/lottery/screens/dreams/dreamBook";
import { DreamCard } from "@/lottery/screens/dreams/DreamCard";
import { EmptySearchArt } from "@/lottery/screens/dreams/DreamGlyphs";
import { DreamIntro } from "@/lottery/screens/dreams/DreamIntro";
import { DreamErrorBanner, DreamSkeletonGrid } from "@/lottery/screens/dreams/DreamStates";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const COPY = DREAM_COPY.book;

/**
 * A DREAM BOOK — Dream Number 1000 (three-digit numbers) or Dream Number 100
 * (two digits), one page pattern for both (Dream1000 / Dream100.dc.html, the
 * band redone on the "Dream detail, simpler" canvas › Book, 3 Nov 2026): the
 * detail top bar (round back button, "Dream Number 1000", the wallet chip) →
 * the cream band with the "Dream book" kicker, the question "What did you
 * dream about?" and the search pill on it (English, Burmese or the number;
 * Burmese digits ၀–၉ count as digits) → the result title and live count → the
 * picture grid (3 per row with indigo discs, or 4 per row with seal discs) →
 * "Showing 24 of 312" + Load more (24 more with each tap) → footer. A dream
 * card opens its sample-ticket generator in this same Home tab.
 *
 * THE DREAMS ARE REAL: the whole book is fetched once (useDreams, kept five
 * minutes) and searched on the phone, so the filter is live on every key.
 * The board's levers are all built — the skeleton grid while it loads, the
 * error banner with Try again, "No dreams yet" for a book the admin has not
 * filled in, and the search empty state. The dream-type chips of the design
 * are not built: the API has no dream types.
 *
 * The dock steps aside while the search keyboard is up (LotteryDock does it
 * by itself), exactly as the board's `data-kb` lever shows.
 */
export function LotteryDreamBookScreen({ navigation, route }: LotteryHomeScreenProps<"LotteryDreamBook">) {
  const { book } = route.params;
  const look = BOOK_LOOK[book];
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const inputRef = useRef<TextInputInstance>(null);

  const { data, isPending, isError, refetch } = useDreams(book);
  const dreams = useMemo(() => bookDreams(data ?? []), [data]);
  const search = useMemo(() => searchBook(dreams, query), [dreams, query]);
  const metrics = useMemo(() => cardMetrics(book, width), [book, width]);

  // A new search starts at the first page again.
  const [seenQuery, setSeenQuery] = useState(search.qn);
  if (search.qn !== seenQuery) {
    setSeenQuery(search.qn);
    setLimit(PAGE_SIZE);
  }

  const total = dreams.length;
  const n = search.found.length;
  const visible = useMemo(() => search.found.slice(0, limit), [search.found, limit]);
  const more = n - visible.length;

  let count: string;
  let countSpoken: string;
  if (isPending) {
    count = COPY.loadingCount;
    countSpoken = count;
  } else if (isError) {
    count = COPY.failedCount;
    countSpoken = count;
  } else if (search.qn) {
    count = COPY.matchCount(n, search.shown);
    countSpoken = COPY.matchCount(n, search.said);
  } else {
    count = COPY.fullCount(total);
    countSpoken = count;
  }
  useAnnounceWhenStill(countSpoken);

  const rows = useMemo(() => chunk(visible, look.cols), [visible, look.cols]);

  const clearQuery = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);
  const openDream = useCallback(
    (number: string) => {
      Keyboard.dismiss();
      navigation.navigate("LotteryDreamTickets", { book, number });
    },
    [navigation, book],
  );
  const loadMore = () => setLimit((prev) => prev + PAGE_SIZE);

  let body;
  if (isPending) {
    body = <DreamSkeletonGrid book={book} disc={metrics.disc} style={styles.grid} />;
  } else if (isError) {
    body = (
      <DreamErrorBanner
        title={COPY.errorTitle}
        text={COPY.errorText}
        retryLabel={COPY.retry}
        onRetry={() => refetch()}
        style={styles.banner}
      />
    );
  } else if (total === 0) {
    body = <LtEmpty title={COPY.noneTitle} text={COPY.noneText} style={styles.none} />;
  } else if (n === 0) {
    body = <DreamEmpty title={COPY.emptyTitle(search.shown)} spoken={COPY.emptyTitle(search.said)} onClear={clearQuery} />;
  } else {
    body = (
      <>
        <View style={styles.grid} accessibilityLabel={COPY.gridA11y}>
          {rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((dream) => (
                <DreamCard
                  key={dream.num}
                  book={book}
                  dream={dream}
                  disc={metrics.disc}
                  pic={metrics.pic}
                  onOpen={openDream}
                />
              ))}
              {/* Empty places keep a short last row's cards the same width as the rest. */}
              {Array.from({ length: look.cols - row.length }, (_, i) => (
                <View key={`gap-${i}`} style={styles.spacer} />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.more}>
          <LtText role="metaB" color={LT.ink2} tabular style={styles.shown}>
            {COPY.shownOf(visible.length, n)}
          </LtText>
          {more > 0 ? (
            <LtButton
              variant="secondary"
              size="block"
              label={COPY.loadMore}
              onPress={loadMore}
              accessibilityLabel={COPY.loadMoreA11y(Math.min(PAGE_SIZE, more))}
            />
          ) : null}
        </View>
      </>
    );
  }

  return (
    <LotteryScreen
      topBar={{
        // The cleaner bar the dream detail page got on 3 Nov 2026 (owner: "yes plz" for the book too).
        variant: "detail",
        backA11y: COPY.backA11y,
        title: { pre: DREAM_COPY.titlePre, big: book },
      }}
      contentStyle={styles.column}
      footer={
        <View style={styles.footer}>
          <LotteryFooter lines={[{ icon: "info", text: COPY.footerLine }]} />
        </View>
      }
    >
      <DreamIntro book={book} query={query} onChange={setQuery} onClear={clearQuery} inputRef={inputRef} />

      <View style={styles.results}>
        <LtText role="title" accessibilityRole="header">
          {search.qn ? COPY.resultsTitle : COPY.allTitle}
        </LtText>
        <LtText role="meta" color={LT.ink2} tabular style={styles.count} accessibilityLabel={countSpoken}>
          {count}
        </LtText>
        <HintLine
          icon={<LtIcon name="tickets" size={16} color={look.mark} />}
          text={COPY.hint}
          color={LT.ink2}
          style={styles.hint}
        />
        {body}
      </View>
    </LotteryScreen>
  );
}

function chunk(list: readonly BookDream[], size: number): BookDream[][] {
  const out: BookDream[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * No dream matches (board section 6, `.lt-empty`): the magnifier-and-moon
 * drawing, "No dream matches “unicorn”.", one line, then Clear search.
 */
function DreamEmpty({ title, spoken, onClear }: { title: string; spoken: string; onClear: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <EmptySearchArt />
      </View>
      <LtText role="title" accessibilityRole="header" accessibilityLabel={spoken} style={styles.center}>
        {title}
      </LtText>
      <LtText role="meta" color={LT.ink2} style={[styles.center, styles.emptyText]}>
        {COPY.emptyText}
      </LtText>
      <View style={styles.emptyActs}>
        <LtButton variant="secondary" size="sm" label={COPY.emptyClear} onPress={onClear} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** The board's `.lt-dream .lt-main`: no top padding (the intro band meets the bar), sections spaced one by one. */
  column: { paddingTop: 0, gap: 0 },
  results: { marginTop: 24 },
  count: { marginTop: 2 },
  hint: { marginTop: 6 },
  grid: { gap: GRID_GAP, marginTop: 12 },
  row: { flexDirection: "row", gap: GRID_GAP },
  spacer: { flex: 1 },
  banner: { marginTop: 12 },
  none: { marginTop: 12 },
  more: { gap: 10, marginTop: 20 },
  shown: { textAlign: "center", minHeight: 20 },
  /** Spare height falls below the footer, never above it (board `.lt-foot` margin-top 40). */
  footer: { marginTop: 40 },
  empty: {
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
  },
  emptyArt: { marginBottom: 8 },
  center: { textAlign: "center" },
  emptyText: { maxWidth: 280 },
  emptyActs: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 },
});
