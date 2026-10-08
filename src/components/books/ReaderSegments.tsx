import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export interface ReaderSegmentOption {
  value: string;
  label: string;
}

interface Props {
  options: ReaderSegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

/** The board's track inset and the gap between segments. */
const TRACK_INSET = 2;

/**
 * The reader settings' segmented track (BookReader.dc.html / PageReader.dc.html
 * "seg"): a raised track with a 2pt inset, the picked segment white with
 * near-black ink, the rest in body grey.
 *
 * A books-area twin of the shared SegmentedControl for one reason: that
 * control keeps every label on ONE line in equal columns, and these sheets
 * carry the app's longest Burmese option labels ("မျက်နှာပြင်နှင့် ကိုက်ညီစေရန်",
 * "အပြင်အဆင်အတိုင်း"), which it cut short. Here a label wraps and the row
 * grows instead — never truncated — and at a large OS text size a group of
 * three or more (or four on a narrow phone) goes two a row.
 */
export function ReaderSegments({ options, value, onChange }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const twoUp = (options.length >= 3 && fontScale >= 1.3) || (options.length >= 4 && width < 360);
  const perRow = twoUp ? 2 : Math.max(1, options.length);

  const rows: ReaderSegmentOption[][] = [];
  for (let i = 0; i < options.length; i += perRow) rows.push(options.slice(i, i + perRow));

  return (
    <View style={styles.track}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.segment,
                  active && styles.segmentActive,
                  pressed && !active && styles.pressed,
                ]}
              >
                <ThemedText
                  variant="muted"
                  weight={active ? "bold" : "semibold"}
                  color={active ? theme.colors.onPlay : theme.colors.textBody}
                  style={styles.label}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
          {/* An odd last row keeps the columns of the rows above it. */}
          {row.length < perRow &&
            Array.from({ length: perRow - row.length }).map((_, index) => (
              <View key={`pad-${index}`} style={styles.filler} />
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    padding: TRACK_INSET,
    gap: TRACK_INSET,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
  },
  row: { flexDirection: "row", gap: TRACK_INSET },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: theme.colors.play },
  pressed: { opacity: 0.7 },
  label: { textAlign: "center" },
  filler: { flex: 1 },
});
