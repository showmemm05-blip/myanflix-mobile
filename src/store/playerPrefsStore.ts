import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PlayerPrefsState {
  preferredSpeed: number;
  setPreferredSpeed: (speed: number) => void;
}

export const usePlayerPrefsStore = create<PlayerPrefsState>()(
  persist(
    (set) => ({
      preferredSpeed: 1,
      setPreferredSpeed: (preferredSpeed) => set({ preferredSpeed }),
    }),
    {
      name: "myanflix-player-prefs",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
