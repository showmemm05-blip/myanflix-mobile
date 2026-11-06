import { useLanguageStore } from "@/store/languageStore";
import type { Language } from "@/localization/translations";

/**
 * The Lottery's two languages (owner, 4 Nov 2026: "I want a Burmese
 * translation on the lottery side as well"). The Lottery follows the app's
 * own language switch — the same zustand store `useLanguage()` reads — and
 * every copy module holds an English and a Burmese dictionary of the SAME
 * shape, wrapped by `ltCopy`.
 *
 * Why a Proxy rather than a `useLtCopy()` hook: the copy is read in 70-odd
 * files, often through a module-level alias (`const C = HOME_COPY.winners`)
 * and inside plain helpers (a11y sentences, toasts, share text) that are not
 * components. `ltCopy` hands back an object that looks exactly like the
 * English one, but every property read resolves against the language that is
 * current AT THAT MOMENT, so an alias taken at import time still answers in
 * Burmese once the app is switched. LotteryNavigator remounts its tabs when the
 * language changes, so memoised components and cached strings start over too.
 */

/** The language the Lottery speaks right now; Burmese unless the app is set to English. */
export function ltLanguage(): Language {
  return useLanguageStore.getState().language === "en" ? "en" : "mm";
}

/**
 * The Burmese twin's type: the English dictionary's shape with every string
 * literal widened to `string` (the English module is `as const`, the Burmese
 * words obviously differ) and every function's parameters kept exactly.
 */
export type LtWiden<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer A) => infer R
        ? (...args: A) => LtWiden<R>
        : T extends readonly (infer U)[]
          ? readonly LtWiden<U>[]
          : T extends object
            ? { readonly [K in keyof T]: LtWiden<T[K]> }
            : T;

const isBranch = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function walk(root: unknown, path: readonly PropertyKey[]): unknown {
  let node = root;
  for (const key of path) {
    if (node === null || node === undefined) return undefined;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return node;
}

/**
 * One copy module in two languages. Returns an object typed — and shaped —
 * exactly like `en`: nested objects come back as lazily resolving views,
 * strings, functions and arrays come back from the current language's
 * dictionary (English when a Burmese entry is missing, so a gap shows the
 * English words rather than `undefined`).
 */
export function ltCopy<T extends object>(en: T, mm: LtWiden<T>): T {
  const dictionaries: Record<Language, unknown> = { en, mm };
  const views = new Map<string, object>();

  const resolve = (path: readonly PropertyKey[]): unknown => {
    const value = walk(dictionaries[ltLanguage()], path);
    return value === undefined ? walk(en, path) : value;
  };

  const view = (path: readonly PropertyKey[], target: object): object => {
    const cacheKey = path.map(String).join("\u0000");
    const cached = views.get(cacheKey);
    if (cached) return cached;
    const proxy = new Proxy(target, {
      get(_target, key) {
        if (typeof key === "symbol") return Reflect.get(resolve(path) as object, key);
        const value = resolve([...path, key]);
        if (!isBranch(value)) return value;
        const englishChild = walk(en, [...path, key]);
        return view([...path, key], isBranch(englishChild) ? englishChild : value);
      },
      has(_target, key) {
        const node = resolve(path);
        return isBranch(node) && key in node;
      },
      ownKeys() {
        const node = resolve(path);
        return isBranch(node) ? Reflect.ownKeys(node) : [];
      },
      getOwnPropertyDescriptor(_target, key) {
        const node = resolve(path);
        if (!isBranch(node)) return undefined;
        const descriptor = Reflect.getOwnPropertyDescriptor(node, key);
        return descriptor ? { ...descriptor, configurable: true } : undefined;
      },
    });
    views.set(cacheKey, proxy);
    return proxy;
  };

  return view([], en) as T;
}

/** The full stop of the current language: "." / "။" — for spoken sentences joined in a component. */
export function ltStop(): string {
  return ltLanguage() === "mm" ? "။" : ".";
}

/** The list comma of the current language: "," / "၊". */
export function ltComma(): string {
  return ltLanguage() === "mm" ? "၊" : ",";
}

/** One spoken sentence: `text` ending in the current language's stop (a stop it already had is not doubled). */
export function ltSentence(text: string): string {
  return `${text.replace(/[.။]$/, "")}${ltStop()}`;
}

/** Picks the current language's value — for the few one-off words outside a copy module. */
export function ltPick<T>(values: Record<Language, T>): T {
  return values[ltLanguage()];
}
