import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Which channel the viewer would like their sign-in code to arrive on.
 *
 * This is a DEVICE PREFERENCE, not a request parameter. Nothing in the sign-in
 * flow sends it anywhere — see the long comment in
 * components/auth/OtpChannelPicker.tsx for why adding it to the OTP request
 * body would break sign-in outright.
 */
export type OtpChannel = "sms" | "telegram" | "viber";

interface AuthPrefsState {
  /**
   * Defaults to "sms" because SMS is the only one of the three that can ever
   * reach a phone number with no prior relationship: Telegram can't message a
   * number that has not started a chat with the bot, and Viber needs an
   * approved business sender plus an opt-in. So "sms" stays the correct
   * default on the day delivery is actually switched on.
   */
  preferredOtpChannel: OtpChannel;
  setPreferredOtpChannel: (channel: OtpChannel) => void;
}

/**
 * AsyncStorage rather than SecureStore on purpose: this is a non-sensitive
 * display preference, and SecureStore is reserved for tokens. Nothing gates
 * first paint on rehydration either — a read before the store has hydrated
 * returns the "sms" default, which is also the value we'd want to show.
 */
export const useAuthPrefsStore = create<AuthPrefsState>()(
  persist(
    (set) => ({
      preferredOtpChannel: "sms",
      setPreferredOtpChannel: (preferredOtpChannel) => set({ preferredOtpChannel }),
    }),
    {
      name: "myanflix-auth-prefs",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
