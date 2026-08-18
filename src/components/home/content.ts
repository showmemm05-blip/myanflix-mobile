import type { Ionicons } from "@expo/vector-icons";

// Language-independent metadata for the ported home sections — joined to
// the translated copy in localization/translations by array index, mirrors
// userwebsite/components/home/content.ts.
// `bannerImage` was deleted with the photographic hero. PromoHero draws its
// composition in code, so there is no cover photograph on this page any more and
// nothing should reintroduce one by autocompleting a token that still exists.
export const HOME_CONTENT = {
  announcementIcons: ["megaphone-outline", "sparkles-outline", "gift-outline", "tv-outline"] as (keyof typeof Ionicons.glyphMap)[],
  behindTheScenesImages: [1, 2, 3, 4].map((i) => `https://picsum.photos/seed/myanflix-bts-${i}/600/800`),
  teamAvatarSeeds: [1, 2, 3, 4].map((i) => `myanflix-team-${i}`),
  partnerInitials: ["GR", "SFC", "YSW", "FWP", "SLD"],
  testimonialAvatarSeeds: [1, 2, 3, 4].map((i) => `myanflix-voice-${i}`),
  newsImages: [1, 2, 3].map((i) => `https://picsum.photos/seed/myanflix-news-${i}/700/420`),
};

export function avatarUrl(seed: string): string {
  return `https://i.pravatar.cc/160?u=${seed}`;
}
