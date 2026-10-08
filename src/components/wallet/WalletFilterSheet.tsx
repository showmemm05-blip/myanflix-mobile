import { ScrollView, StyleSheet, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ChoiceList } from "@/components/wallet/ChoiceList";
import { useFilterGroups, type FilterGroupKey, type SegmentFilters } from "@/components/wallet/HistoryFilters";
import type { ActivitySegment } from "@/components/wallet/RecentActivity";
import { TextAction } from "@/components/wallet/TextAction";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Header + one 56pt row (and its hairline) per option + the sheet's own padding. */
const SHEET_CHROME = 140;
const ROW_HEIGHT = 57;
const CLEAR_ROW = 60;

interface Props {
  visible: boolean;
  /** The group being picked — kept while the sheet slides away, so it does not empty mid-close. */
  group: FilterGroupKey;
  onClose: () => void;
  segment: ActivitySegment;
  value: SegmentFilters;
  onChange: (next: SegmentFilters) => void;
  onClear: () => void;
  /** Number of active filters — shows the Clear button when above zero. */
  activeCount: number;
}

/**
 * History's picker for one filter on a phone — Status, Date or Type — as a
 * radio list of plain 56pt options (WalletHistory.dc.html, "filterSheet"). A
 * pick applies at once (the list behind updates live) and closes the sheet;
 * there is nothing to confirm.
 */
export function WalletFilterSheet({ visible, group, onClose, segment, value, onChange, onClear, activeCount }: Props) {
  const { t } = useLanguage();
  const groups = useFilterGroups(segment, value);
  const current = groups.find((candidate) => candidate.key === group) ?? null;
  const optionCount = current?.options.length ?? 4;

  return (
    <BottomSheet
      visible={visible && !!current}
      onClose={onClose}
      snapHeight={SHEET_CHROME + optionCount * ROW_HEIGHT + (activeCount > 0 ? CLEAR_ROW : 0)}
      title={current?.title}
      showClose
      closeLabel={t.common.close}
      footer={
        activeCount > 0 ? (
          <TextAction
            title={t.wallet.clearFilters}
            icon="close"
            size="md"
            onPress={() => {
              onClear();
              onClose();
            }}
            style={styles.clear}
          />
        ) : undefined
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {current ? (
          // The sheet pads its body; the rows pad themselves, so they run edge to edge.
          <View style={styles.flush}>
            <ChoiceList
              appearance="options"
              accessibilityLabel={current.title}
              options={current.options.map((option) => ({ key: option.value, title: option.label }))}
              selectedKey={current.selected}
              onSelect={(next) => {
                onChange(current.pick(next));
                onClose();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.md },
  /** Bleeds the list to the sheet edges: exactly undoes the sheet's side padding. */
  flush: { marginHorizontal: -theme.layout.screenPadding },
  clear: { alignSelf: "center" },
});
