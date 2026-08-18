import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/home/IconTile";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onBrowseMovies: () => void;
  onBrowseSeries: () => void;
}

/**
 * The mid-funnel catch. Between the campaigns and the press room there is one
 * band that asks for nothing but a tap — no subscription, no wallet, no money
 * of any kind. It is violet because it is purely an action, and it is the
 * quiet point in the page's CTA-density curve for exactly that reason.
 */
export function BrowseBar({ onBrowseMovies, onBrowseSeries }: Props) {
  const { t } = useLanguage();
  const { contentWidth } = useHomeLayout();

  return (
    <Surface radius="2xl" tone="accent" padded style={[styles.bar, { width: contentWidth }]}>
      <View style={styles.headingRow}>
        <IconTile icon="play-circle-outline" tone={theme.colors.primary} />
        <View style={styles.headingText}>
          <ThemedText variant="section">{t.home.browse.title}</ThemedText>
          <ThemedText variant="caption">{t.home.browse.subtitle}</ThemedText>
        </View>
      </View>

      {/* The row WRAPS rather than squeezing. `Button` clamps its label to one
          line, and "ဇာတ်လမ်းတွဲများကြည့်ရန်" needs ~166pt — more than half of
          any phone's content width, so a two-up row of `flex: 1` buttons
          ellipsizes both CTAs in Burmese on every handset, not just small ones.
          `flexBasis` lets them sit side by side when they genuinely fit and
          drop to one per line when they don't. */}
      <View style={styles.actions}>
        <Button title={t.home.cta.browseMovies} icon="film-outline" onPress={onBrowseMovies} style={styles.action} />
        <Button
          title={t.home.cta.browseSeries}
          icon="tv-outline"
          variant="outline"
          onPress={onBrowseSeries}
          style={styles.action}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: "center", gap: theme.spacing.md },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  headingText: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  /** Wide enough for the longest Burmese label; grows to share a wide row. */
  action: { flexGrow: 1, flexBasis: 190 },
});
