import type { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  /**
   * Set false when the caller already sits inside the page's clamped content
   * column — the home page centres its sections at `useHomeLayout().contentWidth`,
   * so the heading must not add its own screen padding on top of that.
   */
  inset?: boolean;
}

/**
 * Heading for the editorial (non-catalogue) home sections. A thin alias over
 * the shared SectionHeader so the home page and the content rails use one
 * heading system rather than two that drift apart.
 *
 * The one thing it changes is the line clamp. SectionHeader defaults to a
 * single title line because it usually sits above a rail with a "See all" link
 * beside it; home headings sit alone in a free-height column, and Burmese runs
 * long enough that one line drops the last clause of several of them.
 */
export function SectionIntro({ eyebrow, title, subtitle, icon, accent, inset }: Props) {
  return (
    <SectionHeader
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle || undefined}
      titleLines={2}
      subtitleLines={3}
      icon={icon}
      accent={accent}
      inset={inset}
    />
  );
}
