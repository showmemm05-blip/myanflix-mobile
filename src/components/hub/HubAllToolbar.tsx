// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Type-only here, but
// the rule is the same. Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import { SearchResultsHeader } from "@/components/search/SearchResultsHeader";

interface Props {
  /**
   * "128 books" / "12 in Novel" — the server's total for the list below.
   * Null while that number is not known yet (a skeleton bar holds its place);
   * an empty string when there is no number to give (the list failed).
   */
  countLabel: string | null;
  /** The names pill: Authors on Books. */
  people: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
}

/**
 * The top of the Books hub's "All books" section: the count with the
 * Authors pill. (Movies and Series list their results under the Media
 * page's own results header — MediaResultsHeader.)
 */
export function HubAllToolbar({ countLabel, people }: Props) {
  return <SearchResultsHeader countLabel={countLabel} people={people} />;
}
