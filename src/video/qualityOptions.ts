import type { StreamQuality } from "@/types/video";

const FREE_MAX_HEIGHT = 480;

function heightOf(label: string): number {
  const match = /^(\d+)p$/i.exec(label.trim());
  return match ? Number(match[1]) : 0;
}

/** The backend supplies the ladder in descending order. */
export function getQualityOptions(qualities: StreamQuality[], isPremium: boolean) {
  if (isPremium) return { qualities, upgradeQuality: null };
  return {
    qualities: qualities.filter(({ label }) => {
      const height = heightOf(label);
      return height > 0 && height <= FREE_MAX_HEIGHT;
    }),
    upgradeQuality: qualities.find(({ label }) => heightOf(label) > FREE_MAX_HEIGHT)?.label ?? null,
  };
}

export interface PlaybackSource {
  url: string;
  qualityLabel: string | null;
}

/** Resolve within the allowed ladder, keeping the stored preference for future titles. */
export function resolvePlaybackSource(
  masterUrl: string | null,
  qualities: StreamQuality[],
  label: string | null,
  allowAuto: boolean,
): PlaybackSource | null {
  const selected = qualities.find((quality) => quality.label === label) ??
    (allowAuto ? undefined : qualities[0]);
  if (selected) return { url: selected.url, qualityLabel: selected.label };
  return allowAuto && masterUrl ? { url: masterUrl, qualityLabel: null } : null;
}
