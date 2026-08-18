import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { SectionIntro } from "@/components/home/SectionIntro";
import { useSectionWidth } from "@/components/home/SectionWidth";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  shipped: "checkmark-circle",
  inProgress: "sync",
  upcoming: "ellipse-outline",
};

const STATUS_COLORS: Record<string, string> = {
  shipped: theme.colors.success,
  inProgress: theme.colors.primary,
  upcoming: theme.colors.textFaint,
};

const STATUS_TONES: Record<string, PillTone> = {
  shipped: "success",
  inProgress: "primary",
  upcoming: "neutral",
};

/** A timeline reads badly the wider it gets — this is where it stops growing. */
const MAX_TIMELINE = 640;

/**
 * A column narrower than this is worse than the single column it replaces — the
 * split has to buy measure, not just symmetry. Gating on `isTablet` instead
 * meant the whole 600–767pt band (split view, foldables, 600dp tablets) stayed
 * single-column at up to 594pt of 13pt caption text and then snapped in half at
 * 768 — the exact ribbon of white space this layout exists to prevent.
 */
const MIN_COLUMN = 300;

/**
 * Where the product is going. Editorial: no buttons, no photographs to borrow,
 * just the marker rail. Once there is room it splits into two columns so a
 * five-item list doesn't become a five-hundred-point ribbon of white space.
 */
export function RoadmapTimeline() {
  const { t } = useLanguage();
  const contentWidth = useSectionWidth();
  const items = t.home.roadmap.items;

  const width = Math.min(contentWidth, MAX_TIMELINE);
  const splitColumn = (width - theme.spacing.lg) / 2;
  const split = splitColumn >= MIN_COLUMN;
  const columnWidth = split ? splitColumn : width;
  // Two columns break the single vertical rail, so the connector is dropped
  // there — a dangling line to nowhere is worse than no line.
  const connected = !split;

  return (
    <View style={styles.container}>
      <View style={{ width: contentWidth }}>
        <SectionIntro
          eyebrow={t.home.roadmap.eyebrow}
          title={t.home.roadmap.title}
          subtitle={t.home.roadmap.subtitle}
          icon="map-outline"
          inset={false}
        />
      </View>

      <View style={[styles.list, split && styles.listSplit, { width }]}>
        {items.map((item, index) => {
          const color = STATUS_COLORS[item.status] ?? theme.colors.textFaint;
          return (
            <View
              key={item.title}
              style={[styles.row, { width: columnWidth }]}
              accessible
              accessibilityLabel={`${item.period}. ${item.title}. ${item.description}`}
            >
              <View style={styles.markerColumn}>
                <View style={[styles.marker, { backgroundColor: color + "1F", borderColor: color + "3D" }]}>
                  <Ionicons name={STATUS_ICONS[item.status] ?? "ellipse-outline"} size={16} color={color} />
                </View>
                {connected && index < items.length - 1 && <View style={styles.connector} />}
              </View>
              <View style={styles.content}>
                <Pill tone={STATUS_TONES[item.status] ?? "neutral"}>{item.period}</Pill>
                <ThemedText variant="body" weight="semibold">
                  {item.title}
                </ThemedText>
                <ThemedText variant="caption">{item.description}</ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm, alignItems: "center" },
  list: { alignSelf: "center" },
  listSplit: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.lg, alignItems: "flex-start" },
  row: { flexDirection: "row", gap: theme.spacing.md },
  markerColumn: { alignItems: "center", width: 30 },
  marker: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  connector: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4, minHeight: 20 },
  content: { flex: 1, gap: 3, paddingBottom: theme.spacing.md },
});
