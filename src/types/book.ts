/**
 * How a book was made — and therefore how it is read. An `EDITOR` book is
 * rich text in chapters (ProseMirror JSON, rendered by ChapterReader); a
 * `PDF` book is a sequence of pre-rendered page images (PageReader). The two
 * readers are separate implementations, so nothing should branch on anything
 * but this field.
 */
export type BookType = "EDITOR" | "PDF";

/** Users only ever see PUBLISHED editions; the rest are admin-side lifecycle states. */
export type BookStatus = "DRAFT" | "UPLOADING" | "PROCESSING" | "READY" | "PUBLISHED" | "FAILED";

export interface BookCategoryRef {
  id: string;
  name: string;
}

/**
 * The author row behind a book's denormalised `author` string — enough to
 * label a card and to open that author's page without a second lookup.
 * `imageUrl` re-hosts per request, so it is not safe to cache long-term.
 */
export interface BookAuthorRef {
  id: string;
  name: string;
  imageUrl: string | null;
}

/**
 * One language of a book, and the unit that actually holds content. A book
 * is the work; an edition is the work in a language, with its own chapters
 * or pages and its own publish state — so a title can be live in Burmese
 * while its English translation is still being prepared.
 *
 * The API only ever sends a reader the editions that are published, so
 * anything in this array is safe to offer as a language choice.
 */
export interface BookEdition {
  id: string;
  language: string;
  status: BookStatus;
  /** Chapters in this language — BOTH book types have them. */
  chapterCount: number;
  /** Chapters a reader could actually open — the rest are still converting. */
  readyChapterCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A title in the digital library, as `GET /books` returns it. */
export interface Book {
  id: string;
  title: string;
  /** The display name, denormalised onto the book — always present. */
  author: string;
  /**
   * The author ROW's id, and the row itself. Optional for the same reason
   * `Movie.actors` is: an older backend simply omits them, and every screen
   * that shows a book must keep working when it does. The backend resolves or
   * creates a BookAuthor on create and update, so a live book always carries
   * both and is reachable from exactly one author page.
   */
  authorId?: string | null;
  authorRef?: BookAuthorRef | null;
  description: string;
  coverUrl: string | null;
  type: BookType;
  categories: BookCategoryRef[];
  /** Only the editions this viewer may read. */
  editions: BookEdition[];
  /** Their language codes, in the same order — the language panel's source. */
  languages: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A chapter's own lifecycle. A written chapter is READY once it has text; a
 * PDF chapter carries its own file and converts on its own.
 */
export type ChapterStatus = "DRAFT" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export interface BookChapterSummary {
  id: string;
  title: string;
  order: number;
  /** Optional cover — the thumbnail a chapter list shows. Both book types. */
  imageUrl: string | null;
  status: ChapterStatus;
  /** PDF chapters — how many pages this chapter has. */
  pageCount: number;
  processedPages: number;
  processingError: string | null;
  pdfFileSize: number | null;
  /** The part this chapter sits in; null for every chapter of a part-less book. */
  partId: string | null;
  /** Derived 1-based position in reading order ("3") — the server computes it, clients only display it. */
  number: string;
  /** Optional subdivisions; [] for every existing chapter. */
  sections: BookSectionSummary[];
}

/**
 * A section as a table of contents lists it. `number` is "3.1". A written
 * section carries its own document (BookSection.content); a PDF section is
 * a page anchor — `startPage` within its chapter, `endPage` derived by the
 * server (the page before the next section, or the chapter's last page).
 */
export interface BookSectionSummary {
  id: string;
  chapterId: string;
  title: string;
  order: number;
  number: string;
  startPage: number | null;
  endPage: number | null;
}

/** The summary plus the section's ProseMirror document (EDITOR books; null on PDF). */
export interface BookSection extends BookSectionSummary {
  content: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The numbered tree every table of contents renders from —
 * `GET /books/:id/editions/:editionId/contents`. Unparted `chapters` read
 * before the first part; every row is the same shape as the flat list's.
 */
export interface BookContents {
  editionId: string;
  bookType: BookType;
  chapterCount: number;
  parts: Array<{
    id: string;
    title: string;
    order: number;
    number: number;
    chapters: BookChapterSummary[];
  }>;
  chapters: BookChapterSummary[];
}

/** `GET /books/:id`. Chapters belong to an edition, so they are fetched per language. */
export type BookDetail = Book;

/** One chapter's ProseMirror document. */
export interface BookChapter extends BookChapterSummary {
  editionId: string;
  /** NULL on a PDF chapter, whose content is its pages. */
  content: Record<string, unknown> | null;
  /** The detail carries each section WITH its document, so the reader composes the chapter from one response. */
  sections: BookSection[];
}

/**
 * One converted page. `width`/`height` are the real pixel dimensions, so the
 * reader can reserve the right box before the image loads and lazy loading
 * never makes the scroll jump.
 */
export interface BookPage {
  /** 1-based WITHIN ITS CHAPTER — a chapter is a release, numbered its own way. */
  pageNumber: number;
  url: string;
  width: number;
  height: number;
}

/**
 * Where a reader left off IN ONE LANGUAGE. Written editions remember a
 * chapter, PDF editions a page — the same row serves both, with the
 * irrelevant field null. Keyed per edition because two languages of a title
 * need not have the same chapter or page counts.
 */
export interface BookReadingProgress {
  editionId: string;
  chapterId: string | null;
  /** The section the reader was last in, when the reader knew it. */
  sectionId: string | null;
  pageNumber: number | null;
  /** 0–100. */
  progress: number;
  updatedAt: string;
}

export interface BookQuery {
  page?: number;
  limit?: number;
  type?: BookType;
  categoryId?: string;
  /**
   * One author's books — an exact match on the book's own `authorId` column,
   * ANDed with every other filter here (the author page sends nothing else).
   * An id that matches nobody is not an error: the endpoint answers 200 with
   * an empty page, which is the author page's "no books yet" state.
   *
   * The viewer visibility rule still applies on top, so a USER can legitimately
   * receive fewer books than the author row's `bookCount` claims — that count
   * includes unpublished ones. Trust this response's own `total`.
   */
  authorId?: string;
  language?: string;
  search?: string;
}
