import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
}

export const usePlayerPrefsStore = create<PlayerPrefsState>()(
  persist(
    (set) => ({
      preferredSpeed: 1,
      setPreferredSpeed: (preferredSpeed) => set({ preferredSpeed }),
      preferredSubtitleLanguage: undefined,
      setPreferredSubtitleLanguage: (preferredSubtitleLanguage) => set({ preferredSubtitleLanguage }),
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
