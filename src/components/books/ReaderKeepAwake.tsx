import { useKeepAwake } from "expo-keep-awake";

/**
 * Keeps the screen on while reading, gated on the keepAwake pref. The hook
 * can't be called conditionally, so the toggle mounts/unmounts a child whose
 * only job is the hook — unmounting releases the wake lock (Player.tsx is the
 * always-on precedent; the reader's is opt-out).
 */
function KeepAwakeChild() {
  useKeepAwake();
  return null;
}

export function ReaderKeepAwake({ enabled }: { enabled: boolean }) {
  return enabled ? <KeepAwakeChild /> : null;
}
