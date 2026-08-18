import { createContext, useContext, type ReactNode } from "react";
import { useHomeLayout } from "@/hooks/useHomeLayout";

const SectionWidthContext = createContext<number | null>(null);

interface Props {
  width: number;
  children: ReactNode;
}

/**
 * Overrides the width the home sections beneath it lay out at. Only a container
 * that insets its own children needs this — today that is EditorialWell, whose
 * padded band on tablet is narrower than the page's content column.
 */
export function SectionWidthProvider({ width, children }: Props) {
  return <SectionWidthContext.Provider value={width}>{children}</SectionWidthContext.Provider>;
}

/**
 * The width a home section must size its heading and grid to. Defaults to the
 * page's clamped content column, so a section used at page level needs to know
 * nothing about this.
 *
 * Without it, a section sizes itself from the WINDOW while its parent sizes
 * itself from its content — which is how the editorial band ended up 2pt wider
 * than an iPad-portrait screen and lost the inset that made it read as a card.
 */
export function useSectionWidth(): number {
  const { contentWidth } = useHomeLayout();
  return useContext(SectionWidthContext) ?? contentWidth;
}
