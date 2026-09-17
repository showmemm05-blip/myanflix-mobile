import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Caption text size, the same three steps the web player offers. */
export type SubtitleSize = "small" | "medium" | "large";

interface PlayerPrefsState {
  preferredSpeed: number;
  setPreferredSpeed: (speed: number) => void;
  /**
   * Language of the subtitle track to switch on, `null` for explicitly off, or
   * `undefined` when the viewer has never chosen — in which case the manifest's
   * own DEFAULT=YES track wins, which is what the web client already does.
   *
   * The three-way distinction is the point: collapsing "never chosen" into
   * `null` means a fresh install actively switches OFF the default track
   * (VideoPlayer asserts the choice, and asserting `null` disables the text
   * renderer outright), so the two clients disagree about the same manifest.
   *
   * `undefined` survives persistence correctly: JSON.stringify omits the key,
   * and an absent key rehydrates to the initial `undefined`, while a deliberate
   * "Off" round-trips as `null`.
   *
   * Stored as a language rather than a track because track ids are per-title
   * (and Android-only): the choice has to carry across an episode change, which
   * replaces the Player route and so remounts the whole screen. A title that
   * has no matching rendition simply plays without subtitles — the preference
   * stays put and re-applies on the next one that does.
   */
  preferredSubtitleLanguage: string | null | undefined;
  setPreferredSubtitleLanguage: (language: string | null) => void;
  /**
   * How the caption itself looks — mobile draws subtitles rather than leaving
   * them to the native renderer, so these are ours to honour. Defaults match
   * the web player's DEFAULT_SUBTITLE_STYLE so the same account sees the same
   * caption on both clients until it is changed on one of them.
   */
  subtitleSize: SubtitleSize;
  setSubtitleSize: (size: SubtitleSize) => void;
  /** Solid backing plate behind the text vs bare text with a shadow. */
  subtitleBackground: boolean;
  setSubtitleBackground: (background: boolean) => void;
  /**
   * The rendition to pin, as its LABEL ("720p"), or `null` for Auto — the
   * master playlist, adapting to bandwidth, which is what plays today.
   *
   * A label rather than a URL for the same reason the subtitle preference
   * stores a language: the URL belongs to one title and expires within the
   * day, while the choice outlives both. It is resolved against whatever
   * ladder the title actually offers, so a title with no 720p plays Auto and
   * the preference stays put for the next one that has it.
   *
   * No three-way undefined/null/value here, unlike the subtitle language:
   * Auto is both "never chosen" and the right default, so one `null` says
   * both and nothing is lost by collapsing them.
   */
  preferredQuality: string | null;
  setPreferredQuality: (label: string | null) => void;
}

export const usePlayerPrefsStore = create<PlayerPrefsState>()(
  persist(
    (set) => ({
      preferredSpeed: 1,
      setPreferredSpeed: (preferredSpeed) => set({ preferredSpeed }),
      preferredSubtitleLanguage: undefined,
      setPreferredSubtitleLanguage: (preferredSubtitleLanguage) => set({ preferredSubtitleLanguage }),
      // No version bump for these three: an older stored blob simply has no
      // such keys, and persist shallow-merges over the initial state, so they
      // rehydrate to exactly these defaults without a migration.
      subtitleSize: "medium",
      setSubtitleSize: (subtitleSize) => set({ subtitleSize }),
      subtitleBackground: true,
      setSubtitleBackground: (subtitleBackground) => set({ subtitleBackground }),
      preferredQuality: null,
      setPreferredQuality: (preferredQuality) => set({ preferredQuality }),
    }),
    {
      name: "myanflix-player-prefs",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      /**
       * v0 seeded `preferredSubtitleLanguage: null` as the INITIAL value and
       * persisted it the first time any preference was written, so an install
       * from before subtitles existed on mobile carries a `null` that records
       * no choice at all. Left as-is it would read as a deliberate "Off" and
       * suppress every default track. Dropping it restores "never chosen".
       */
      migrate: (persisted, version) => {
        const state = persisted as Partial<PlayerPrefsState> | undefined;
        if (version < 1 && state && state.preferredSubtitleLanguage === null) {
          return { ...state, preferredSubtitleLanguage: undefined };
        }
        return state;
      },
    },
  ),
);
