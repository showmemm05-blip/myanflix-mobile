/**
 * The hero's featured titles: the newest first page, those WITH art first and
 * then those without (each group keeps the server's newest-first order), up
 * to `count`. There is no featured flag in the schema, so "newest" is the
 * honest pick; a title without art is still featured — over its drawn
 * fallback (HubFallbackArt) — so a catalogue with no pictures yet still gets
 * a hero.
 */
export function featureNewest<T>(items: readonly T[], hasArt: (item: T) => boolean, count: number): T[] {
  const withArt: T[] = [];
  const withoutArt: T[] = [];
  for (const item of items) (hasArt(item) ? withArt : withoutArt).push(item);
  return [...withArt, ...withoutArt].slice(0, count);
}
