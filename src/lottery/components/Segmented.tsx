import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export interface SegmentedOption<K extends string> {
  key: K;
  label: string;
  icon?: LtIconName;
  /** A small mark before the label (KBZPay's "K" disc) or a count after it. */
  lead?: ReactNode;
  trail?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}

interface Props<K extends string> {
  options: readonly SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** The group's spoken name ("Deposit with", "Show tickets"). */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The segmented control (lt-base 6.12): a mist track, equal options 44 tall,
 * the selected one white with a line-strong ring. Each option is a radio in a
 * radiogroup, so a screen reader says "selected, 2 of 3".
 */
function SegmentedInner<K extends string>({ options, value, onChange, accessibilityLabel, style }: Props<K>) {
  return (
    <View style={[styles.track, style]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.key === value;
        const disabled = !!option.disabled;
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              if (!selected) onChange(option.key);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected, disabled }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selected,
              pressed && !selected && styles.pressed,
            ]}
          >
            {option.lead}
            {option.icon ? <LtIcon name={option.icon} size={16} color={disabled ? LT.ink3 : selected ? LT.ink : LT.ink2} /> : null}
            <LtText role="metaB" color={disabled ? LT.ink3 : selected ? LT.ink : LT.ink2} numberOfLines={1}>
              {option.label}
            </LtText>
            {option.trail}
          </Pressable>
        );
      })}
    </View>
  );
}

export const Segmented = memo(SegmentedInner) as typeof SegmentedInner;

/**
 * The count after an option's word (Tickets board `tk-count`, moved here when
 * My tickets lost its filter and History gained its Tickets · Purchases
 * switch): a cream-2 pill, indigo when selected, mist when its option is
 * disabled. Hidden from a screen reader: the option's own label says the count.
 */
export const SegmentedCount = memo(function SegmentedCount({
  n,
  selected,
  disabled = false,
}: {
  n: number;
  selected: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={[styles.count, selected && styles.countOn, disabled && styles.countOff]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LtText role="microB" tabular color={selected ? LT.white : disabled ? LT.ink3 : LT.ink2} maxFontSizeMultiplier={1.3}>
        {String(n)}
      </LtText>
    </View>
  );
});

/** The round "K" / "W" mark before KBZPay / WavePay (lt-base `.lt-mono`). */
export const MonoMark = memo(function MonoMark({ letter }: { letter: string }) {
  return (
    <View style={styles.mono} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LtText role="microB" color={LT.ink2} style={styles.monoText}>
        {letter}
      </LtText>
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: LT.mist,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  selected: {
    backgroundColor: LT.white,
    boxShadow: `${LT_SHADOW.s1}, 0 0 0 1px ${LT.lineStrong}`,
  },
  pressed: { backgroundColor: LT.whiteVeil },
  mono: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.cream2,
  },
  monoText: { lineHeight: 14 },
  count: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: LT_RADIUS.round,
    backgroundColor: LT.cream2,
  },
  countOn: { backgroundColor: LT.indigo },
  countOff: { backgroundColor: LT.mist, borderWidth: 1, borderColor: LT.line },
});
