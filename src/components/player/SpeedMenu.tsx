import { Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ROW_HEIGHT = 52;

interface Props {
  visible: boolean;
  value: number;
  onSelect: (speed: number) => void;
  onClose: () => void;
}

/** Playback-rate picker as a bottom sheet — the selected rate is filled violet. */
export function SpeedMenu({ visible, value, onSelect, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.movie.speed}
      showClose
      snapHeight={SPEEDS.length * (ROW_HEIGHT + theme.spacing.sm) + 140}
    >
      <View style={styles.list}>
        {SPEEDS.map((speed) => {
          const selected = speed === value;
          return (
            <Pressable
              key={speed}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
              onPress={() => {
                onSelect(speed);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${speed}x`}
            >
              <ThemedText
                variant="body"
                weight={selected ? "bold" : "regular"}
                tabular
                style={selected ? styles.labelSelected : undefined}
              >
                {speed}x
              </ThemedText>
              {selected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: ROW_HEIGHT,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary + "3D" },
  rowPressed: { opacity: 0.75 },
  labelSelected: { color: theme.colors.primary },
});
