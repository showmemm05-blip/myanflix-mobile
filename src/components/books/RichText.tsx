import { memo, useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";
import { Image } from "expo-image";
import { theme } from "@/theme";
import { READER_FONTS, type ReaderFontFaces } from "@/components/books/readerFonts";
import type { ReaderThemeColors } from "@/components/books/readerThemes";
import type { ReaderFontFamily, ReaderTextAlign } from "@/store/readerPrefsStore";

/**
 * A small pure renderer for EXACTLY the sanctioned ProseMirror set. The
 * re-parse against this closed list IS the sanitizer: unknown node types and
 * unknown marks render nothing, silently. Server documents are data, never
 * instructions — nothing here evaluates or injects anything.
 *
 * Nodes: doc, paragraph, text, heading (1–3, clamped), bulletList,
 * orderedList, listItem, blockquote, codeBlock, horizontalRule, hardBreak,
 * image (block-level). Marks: bold, italic, strike, underline, code, link
 * (http/https/mailto only — any other scheme renders as plain text).
 */

interface PMNode {
  type?: unknown;
  content?: unknown;
  text?: unknown;
  marks?: unknown;
  attrs?: unknown;
}

interface Props {
  /** The chapter's ProseMirror document (`{type:'doc', content:[...]}`). */
  content: Record<string, unknown>;
  /** 0.85–1.6 multiplier from readerPrefsStore. */
  textScale: number;
  colors: ReaderThemeColors;
  /**
   * Reader typeface. Callers must keep passing "sans" until useReaderFonts()
   * reports loaded — the sans faces are the always-loaded app fonts.
   */
  fontFamily?: ReaderFontFamily;
  /** Body-leading multiplier. Myanmar blocks floor at 1.8 regardless. */
  lineHeight?: number;
  /** Myanmar blocks are ALWAYS left-aligned regardless of this. */
  textAlign?: ReaderTextAlign;
  /** Native text selection — mutually exclusive with onLongPressBlock. */
  selectable?: boolean;
  /**
   * blockIndex -> ready-to-paint background colour (alpha already tuned for
   * the active theme). Used for saved highlights AND the search flash.
   */
  highlights?: Record<number, string>;
  /**
   * Long-press on a top-level block (paragraph highlighting). Ignored while
   * `selectable` is on — the two gestures conflict, one at a time.
   */
  onLongPressBlock?: (blockIndex: number, text: string) => void;
  /** Tap on a block — forwarded so tap-to-toggle-chrome keeps working over text. */
  onPressBlock?: () => void;
}

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const SAFE_LINK = /^(https?:|mailto:)/i;
const MYANMAR = /[က-႟]/;

/** Myanmar text never renders tighter than this leading, whatever the setting. */
const MYANMAR_LEADING_FLOOR = 1.8;

function asNodes(value: unknown): PMNode[] {
  return Array.isArray(value) ? (value.filter((n) => n && typeof n === "object") as PMNode[]) : [];
}

function nodeType(node: PMNode): string {
  return typeof node.type === "string" ? node.type : "";
}

function attr(node: PMNode, key: string): unknown {
  const attrs = node.attrs;
  return attrs && typeof attrs === "object" ? (attrs as Record<string, unknown>)[key] : undefined;
}

interface Ctx {
  base: number;
  /** Leading multiplier before the per-block Myanmar floor. */
  leading: number;
  colors: ReaderThemeColors;
  fonts: ReaderFontFaces;
  align: ReaderTextAlign;
  selectable: boolean;
}

/** The block's plain text — script detection, excerpts, search and estimates all share it. */
export function pmBlockText(node: PMNode): string {
  if (typeof node.text === "string") return node.text;
  return asNodes(node.content)
    .map((child) => pmBlockText(child))
    .filter(Boolean)
    .join(" ");
}

/** Top-level block texts of a ProseMirror doc — the search/reading-time source. */
export function pmPlainBlocks(content: Record<string, unknown>): string[] {
  const doc = content as PMNode;
  if (nodeType(doc) !== "doc") return [];
  return asNodes(doc.content).map((block) => pmBlockText(block));
}

/** Style for one text run from its sanctioned marks; unknown marks are skipped silently. */
function markStyle(
  node: PMNode,
  ctx: Ctx,
  face: { regular: string; bold: string; italic?: string; boldItalic?: string },
  bold: boolean,
): { style: TextStyle; href: string | null } {
  const style: TextStyle = { fontFamily: bold ? face.bold : face.regular };
  let href: string | null = null;
  let isBold = bold;
  let isItalic = false;
  for (const mark of asNodes(node.marks)) {
    switch (nodeType(mark)) {
      case "bold":
        isBold = true;
        break;
      case "italic":
        isItalic = true;
        break;
      case "strike":
        style.textDecorationLine = style.textDecorationLine === "underline" ? "underline line-through" : "line-through";
        break;
      case "underline":
        // StarterKit bundles the underline extension, so Ctrl/Cmd+U in the
        // admin editor produces this mark even with no toolbar button.
        style.textDecorationLine =
          style.textDecorationLine === "line-through" ? "underline line-through" : "underline";
        break;
      case "code":
        style.fontFamily = MONO_FONT;
        style.backgroundColor = ctx.colors.codeBg;
        style.fontSize = ctx.base * 0.88;
        break;
      case "link": {
        const raw = attr(mark, "href");
        if (typeof raw === "string" && SAFE_LINK.test(raw)) {
          href = raw;
          style.color = theme.colors.primary;
          style.textDecorationLine = style.textDecorationLine === "line-through" ? "underline line-through" : "underline";
        }
        break;
      }
      default:
        break;
    }
  }
  // Face resolution happens after the walk so bold+italic combine: Android
  // drops fontStyle on custom-loaded faces, so italics must be REAL faces
  // where the family ships them (Latin only — Burmese has no italic).
  if (isItalic) {
    const italicFace = isBold ? (face.boldItalic ?? face.bold) : (face.italic ?? face.regular);
    style.fontFamily = style.fontFamily === MONO_FONT ? MONO_FONT : italicFace;
    if (!((isBold && face.boldItalic) || (!isBold && face.italic))) {
      style.fontStyle = "italic";
    }
  } else if (isBold) {
    style.fontFamily = style.fontFamily === MONO_FONT ? MONO_FONT : face.bold;
  }
  return { style, href };
}

function openLink(href: string) {
  try {
    Linking.openURL(href).catch(() => {});
  } catch {
    // Malformed URL — render-only failure, never a crash mid-read.
  }
}

/**
 * One inline node (text | hardBreak) as a Text span. Anything else renders
 * nothing. The face is chosen PER NODE by script — a Latin run gets the
 * family's Latin face, a Myanmar run its Myanmar-capable one.
 */
function renderInline(node: PMNode, ctx: Ctx, key: string, bold: boolean): ReactNode {
  const type = nodeType(node);
  if (type === "hardBreak") return <Text key={key}>{"\n"}</Text>;
  if (type !== "text" || typeof node.text !== "string") return null;
  const face = MYANMAR.test(node.text) ? ctx.fonts.my : ctx.fonts.latin;
  const { style, href } = markStyle(node, ctx, face, bold);
  return (
    <Text key={key} style={style} onPress={href ? () => openLink(href) : undefined}>
      {node.text}
    </Text>
  );
}

/** Block-level image with its natural aspect learned from onLoad. */
function RichImage({ node }: { node: PMNode }) {
  const [aspect, setAspect] = useState(3 / 2);
  const src = attr(node, "src");
  const alt = attr(node, "alt");
  if (typeof src !== "string" || !SAFE_LINK.test(src)) return null;
  return (
    <Image
      source={{ uri: src }}
      style={[styles.image, { aspectRatio: aspect }]}
      contentFit="cover"
      transition={200}
      accessibilityLabel={typeof alt === "string" ? alt : undefined}
      onLoad={(event) => {
        const { width, height } = event.source;
        if (width > 0 && height > 0) setAspect(width / height);
      }}
    />
  );
}

/**
 * A paragraph's children, with block-level images hoisted out: consecutive
 * inline runs group into one Text, images break the flow as their own blocks.
 */
function renderParagraphChildren(
  children: PMNode[],
  ctx: Ctx,
  keyPrefix: string,
  textStyle: TextStyle,
  bold = false,
): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ReactNode[] = [];
  let runIndex = 0;

  const flush = () => {
    if (run.length === 0) return;
    out.push(
      <Text key={`${keyPrefix}-run-${runIndex}`} style={textStyle} selectable={ctx.selectable}>
        {run}
      </Text>,
    );
    run = [];
    runIndex += 1;
  };

  children.forEach((child, index) => {
    if (nodeType(child) === "image") {
      flush();
      out.push(<RichImage key={`${keyPrefix}-img-${index}`} node={child} />);
    } else {
      const inline = renderInline(child, ctx, `${keyPrefix}-in-${index}`, bold);
      if (inline) run.push(inline);
    }
  });
  flush();
  return out;
}

const HEADING_SCALE: Record<number, number> = { 1: 1.6, 2: 1.35, 3: 1.15 };

function renderBlock(node: PMNode, ctx: Ctx, key: string): ReactNode {
  const { colors } = ctx;
  // Myanmar wants looser leading than Latin — floor the multiplier per block,
  // and never justify a Myanmar block (its spacing model can't take it).
  const blockIsMyanmar = MYANMAR.test(pmBlockText(node));
  const leading = blockIsMyanmar ? Math.max(ctx.leading, MYANMAR_LEADING_FLOOR) : ctx.leading;
  const bodyStyle: TextStyle = {
    fontFamily: ctx.fonts.latin.regular,
    fontSize: ctx.base,
    lineHeight: ctx.base * leading,
    color: colors.ink,
    textAlign: ctx.align === "justify" && !blockIsMyanmar ? "justify" : "left",
  };

  switch (nodeType(node)) {
    case "paragraph": {
      const children = asNodes(node.content);
      if (children.length === 0) return <View key={key} style={styles.paragraphGap} />;
      return (
        <View key={key} style={styles.paragraph}>
          {renderParagraphChildren(children, ctx, key, bodyStyle)}
        </View>
      );
    }
    case "heading": {
      const rawLevel = attr(node, "level");
      const level = Math.min(3, Math.max(1, typeof rawLevel === "number" ? rawLevel : 3));
      const size = ctx.base * HEADING_SCALE[level];
      const headingStyle: TextStyle = {
        fontFamily: ctx.fonts.latin.bold,
        fontSize: size,
        lineHeight: size * (blockIsMyanmar ? 1.6 : 1.4),
        color: colors.ink,
      };
      return (
        <View key={key} style={styles.heading}>
          {renderParagraphChildren(asNodes(node.content), ctx, key, headingStyle, true)}
        </View>
      );
    }
    case "bulletList":
    case "orderedList": {
      const ordered = nodeType(node) === "orderedList";
      return (
        <View key={key} style={styles.list}>
          {asNodes(node.content).map((item, index) => {
            if (nodeType(item) !== "listItem") return null;
            return (
              <View key={`${key}-li-${index}`} style={styles.listItem}>
                <Text style={[bodyStyle, styles.listMarker]}>{ordered ? `${index + 1}.` : "•"}</Text>
                <View style={styles.listBody}>
                  {asNodes(item.content).map((child, childIndex) =>
                    renderBlock(child, ctx, `${key}-li-${index}-${childIndex}`),
                  )}
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    case "blockquote":
      return (
        <View key={key} style={[styles.blockquote, { borderLeftColor: colors.rule }]}>
          {asNodes(node.content).map((child, index) =>
            renderBlock(child, { ...ctx, colors: { ...colors, ink: colors.muted } }, `${key}-bq-${index}`),
          )}
        </View>
      );
    case "codeBlock": {
      const code = asNodes(node.content)
        .map((child) => (typeof child.text === "string" ? child.text : ""))
        .join("");
      return (
        <View key={key} style={[styles.codeBlock, { backgroundColor: colors.codeBg }]}>
          <Text
            selectable={ctx.selectable}
            style={{
              fontFamily: MONO_FONT,
              fontSize: ctx.base * 0.85,
              lineHeight: ctx.base * 1.4,
              color: colors.ink,
            }}
          >
            {code}
          </Text>
        </View>
      );
    }
    case "horizontalRule":
      return (
        <View key={key} style={styles.hrWrap}>
          <View style={[styles.hr, { backgroundColor: colors.rule }]} />
        </View>
      );
    case "image":
      return <RichImage key={key} node={node} />;
    default:
      // Unknown node type — the closed list is the sanitizer. Render nothing.
      return null;
  }
}

/** Renders one chapter's ProseMirror doc onto the current reader theme. */
export const RichText = memo(function RichText({
  content,
  textScale,
  colors,
  fontFamily = "sans",
  lineHeight = 1.65,
  textAlign = "justify",
  selectable = false,
  highlights,
  onLongPressBlock,
  onPressBlock,
}: Props) {
  const base = 17 * textScale;
  const ctx: Ctx = {
    base,
    leading: lineHeight,
    colors,
    fonts: READER_FONTS[fontFamily],
    align: textAlign,
    selectable,
  };
  const doc = content as PMNode;
  const blocks = nodeType(doc) === "doc" ? asNodes(doc.content) : [];
  // Native selection and long-press highlighting are mutually exclusive — the
  // long-press would swallow the selection gesture (honest tradeoff).
  const interactive = !!onLongPressBlock && !selectable;

  return (
    <View style={styles.doc}>
      {blocks.map((node, index) => {
        const rendered = renderBlock(node, ctx, `b-${index}`);
        if (rendered === null) return null;
        const background = highlights?.[index];
        const paint = background ? [styles.blockWrap, { backgroundColor: background }] : undefined;
        if (interactive) {
          return (
            <Pressable
              key={`w-${index}`}
              onLongPress={() => onLongPressBlock?.(index, pmBlockText(node))}
              // Forward plain taps so tap-to-toggle-chrome works over text too.
              onPress={onPressBlock}
              accessible={false}
              style={paint}
            >
              {rendered}
            </Pressable>
          );
        }
        if (background) {
          return (
            <View key={`w-${index}`} style={paint}>
              {rendered}
            </View>
          );
        }
        return rendered;
      })}
    </View>
  );
});

/** Exposed for the chapter opening — the print-style overline drops its tracking on Myanmar text. */
export function containsMyanmar(text: string): boolean {
  return MYANMAR.test(text);
}

const styles = StyleSheet.create({
  doc: { gap: theme.spacing.md },
  /** Highlight paint bleeds slightly past the text column, like a real marker. */
  blockWrap: {
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: theme.radius.sm,
  },
  paragraph: { gap: theme.spacing.sm },
  paragraphGap: { height: theme.spacing.sm },
  heading: { marginTop: theme.spacing.sm },
  list: { gap: theme.spacing.sm },
  listItem: { flexDirection: "row", gap: theme.spacing.sm },
  listMarker: { minWidth: 22, textAlign: "right" },
  listBody: { flex: 1, gap: theme.spacing.sm },
  blockquote: {
    borderLeftWidth: 3,
    paddingLeft: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  codeBlock: {
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  hrWrap: { alignItems: "center", marginVertical: theme.spacing.sm },
  hr: { width: "40%", height: StyleSheet.hairlineWidth * 2 },
  image: {
    width: "100%",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.skeleton,
  },
});
