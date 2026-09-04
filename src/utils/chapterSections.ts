/**
 * Composing a chapter with its optional sections — the client half of the
 * book hierarchy (Book → Part? → Chapter → Section? → content).
 *
 * The reader renders an EDITOR chapter with sections as ONE ProseMirror
 * document: the chapter's own blocks, then for each section a level-2
 * heading (`${number} ${title}`) followed by the section's blocks. That keeps
 * a single block-index space per chapter, so highlights, search hits,
 * reading-time and jump targets all keep working unchanged.
 *
 * INVARIANT (do not "tidy" it away): with no sections the chapter's document
 * is returned by IDENTITY — the same object, not a copy — so every existing
 * book renders byte-for-byte as it did before sections existed. Section
 * blocks are appended AFTER the chapter's own, so an existing highlight's
 * blockIndex never shifts when a chapter later gains sections.
 *
 * Pure, dependency-free, and the same algorithm the website ships in
 * components/books/chapter-sections.ts — keep the two in step.
 */

export interface PmDoc {
  type?: string;
  content?: unknown[];
  [key: string]: unknown;
}

export interface ComposableSection {
  id: string;
  title: string;
  number: string;
  content?: PmDoc | Record<string, unknown> | null;
}

export interface SectionAnchor {
  sectionId: string;
  number: string;
  title: string;
  /** Top-level block index of the section's heading — the scroll target. */
  blockIndex: number;
  /** Index of the section's last block (inclusive). */
  endBlockIndex: number;
}

export interface ComposedChapter {
  doc: PmDoc | null;
  anchors: SectionAnchor[];
}

function blocksOf(doc: unknown): unknown[] {
  const content = (doc as { content?: unknown } | null | undefined)?.content;
  return Array.isArray(content) ? content : [];
}

export function composeChapterDoc(chapter: {
  content: PmDoc | Record<string, unknown> | null;
  sections: ComposableSection[];
}): ComposedChapter {
  if (!chapter.sections || chapter.sections.length === 0) {
    // Identity — see the header comment.
    return { doc: chapter.content as PmDoc | null, anchors: [] };
  }
  const blocks: unknown[] = [...blocksOf(chapter.content)];
  const anchors: SectionAnchor[] = [];
  for (const section of chapter.sections) {
    const blockIndex = blocks.length;
    blocks.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: `${section.number} ${section.title}`.trim() }],
    });
    blocks.push(...blocksOf(section.content));
    anchors.push({
      sectionId: section.id,
      number: section.number,
      title: section.title,
      blockIndex,
      endBlockIndex: blocks.length - 1,
    });
  }
  return { doc: { type: "doc", content: blocks }, anchors };
}

/** The section whose heading is the last one at or above `blockIndex`, else null. */
export function sectionIdAtBlock(anchors: SectionAnchor[], blockIndex: number): string | null {
  let found: string | null = null;
  for (const anchor of anchors) {
    if (anchor.blockIndex <= blockIndex) found = anchor.sectionId;
    else break;
  }
  return found;
}

/** Scroll-depth (0–1) variant of sectionIdAtBlock over a `totalBlocks`-block document. */
export function sectionIdAtDepth(
  anchors: SectionAnchor[],
  depth: number,
  totalBlocks: number,
): string | null {
  return sectionIdAtBlock(anchors, Math.floor(depth * totalBlocks));
}

/** PDF books: the last section (by startPage asc) that starts at or before `pageNumber`, else null. */
export function sectionIdAtPage(
  sections: Array<{ id: string; startPage: number | null }>,
  pageNumber: number,
): string | null {
  let found: { id: string; startPage: number } | null = null;
  for (const section of sections) {
    if (section.startPage == null || section.startPage > pageNumber) continue;
    if (!found || section.startPage >= found.startPage) found = { id: section.id, startPage: section.startPage };
  }
  return found?.id ?? null;
}
