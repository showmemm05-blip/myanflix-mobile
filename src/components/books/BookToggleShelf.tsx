import { StyleSheet, View, useWindowDimensions } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ThemedText } from "@/components/ui/ThemedText";
import { HubRow, type HubRowItem } from "@/components/hub/HubRow";
import { ShelfRetry } from "@/components/books/ShelfRetry";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Option {
  value: string;
  label: string;
}

interface Props {
  title: string;
  /** "12 books" — the current option's own response total. Hidden while it loads. */
  count?: string | null;
  /** Two choices, side by side (Books.dc.html: Text / Scanned pages, မြန်မာ / English). */
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  /** The shelf for the current option — 116pt covers (HubRow "cover"). */
  items: HubRowItem[];
  loading: boolean;
  /** Said under the toggle when the current option has no books. */
  emptyMessage: string;
  /** The current option's request failed (and has nothing cached): a Retry replaces the rail. */
  error?: boolean;
  onRetry?: () => void;
}

/**
 * The Books hub's two-way shelves ("Text or scanned pages", "Burmese or
 * English"): the heading with its count, a two-segment toggle, and the
 * rail of covers for the chosen side. Each side is a REAL server filter
 * (GET /books?type= / ?language=), so the count is the response's total.
 *
 * The heading and the toggle never disappear: when a side has no books the
 * rail gives way to a quiet line (or a Retry, when its request failed), so
 * the reader can always switch back. Long Burmese labels wrap inside the
 * segments instead of being cut, and the heading is never capped.
 */
export function BookToggleShelf({
  title,
  count,
  options,
  value,
  onChange,
  items,
  loading,
  emptyMessage,
  error = false,
  onRetry,
}: Props) {
  const { t } = useLanguage();
  const { width, fontScale } = useWindowDimensions();
  // A narrow phone or a large text size: the count moves under the heading
  // instead of taking width from it (CategoryBanner's "stacked" rule) — the
  // Burmese heading at 2× on a 320pt phone needs the whole line.
  const stacked = width < 360 || fontScale >= 1.3;
  const shownCount = count && !loading ? count : null;
  return (
    <View>
      <SectionHeader
        title={title}
        // 0 = no line limit (React Native's numberOfLines): this heading is
        // the shelf's only label, so it wraps as far as it needs, never "…".
        titleLines={0}
        subtitle={stacked ? (shownCount ?? undefined) : undefined}
        style={styles.header}
        accessory={
          !stacked && shownCount ? (
            <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint} tabular>
              {shownCount}
            </ThemedText>
          ) : undefined
        }
      />
      <View style={styles.toggle}>
        <SegmentedControl options={options} value={value} onChange={onChange} wrap />
      </View>
      {!loading && items.length === 0 ? (
        error && onRetry ? (
          <ShelfRetry message={t.common.somethingWentWrong} onRetry={onRetry} style={styles.state} />
        ) : (
          <ThemedText variant="muted" color={theme.colors.textMuted} style={[styles.state, styles.empty]}>
            {emptyMessage}
          </ThemedText>
        )
      ) : (
        <View style={styles.rail}>
          {/* `header={false}`: this section draws its own heading and toggle above. */}
          <HubRow variant="cover" title={title} items={items} loading={loading} header={false} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 10 },
  toggle: { paddingHorizontal: theme.layout.screenPadding },
  rail: { marginTop: 14 },
  state: { marginTop: 14 },
  empty: { paddingHorizontal: theme.layout.screenPadding },
});
