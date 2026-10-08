import { StyleSheet, View } from "react-native";
import { ExpandableText } from "@/components/detail/ExpandableText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Lines shown while collapsed, unless the caller asks for another clamp. */
const COLLAPSED_LINES = 4;

interface Props {
  text: string;
  /** Heading above the copy — pass `t.movie.synopsis`. */
  title: string;
  /** Lines shown while collapsed (default 4; the player's film panel draws 3). */
  collapsedLines?: number;
}

/**
 * A "Synopsis" heading over a description that collapses long copy behind a
 * Show more / Show less toggle. The copy is the title pages' ExpandableText,
 * so whether the toggle shows is MEASURED at the real width and text size —
 * never guessed from a character count, which would clamp a short Burmese
 * synopsis at 2× text with no way to open it.
 */
export function Synopsis({ text, title, collapsedLines = COLLAPSED_LINES }: Props) {
  const { t } = useLanguage();
  if ((text?.trim() ?? "").length === 0) return null;

  return (
    <View>
      <SectionHeader title={title} inset={false} titleLines={2} style={styles.header} />
      <ExpandableText
        text={text}
        collapsedLines={collapsedLines}
        moreLabel={t.common.showMore}
        lessLabel={t.common.showLess}
        style={styles.body}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Player.dc.html: the copy sits 8pt under the 19/26 heading. */
  header: { marginBottom: theme.spacing.sm },
  body: { marginTop: 0 },
});
