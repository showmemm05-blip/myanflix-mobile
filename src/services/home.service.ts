import { homeApi } from "@/api/home.api";
import type { RequestSignalOptions } from "@/types/api";
import type { HomeSettings, HomeShowcase } from "@/types/home";

/** The backend's defaults, used when an older server leaves a field out. */
const DEFAULT_SETTINGS: HomeSettings = {
  webUrl: null,
  appStoreUrl: null,
  playStoreUrl: null,
  gamesTeaserEnabled: true,
  gamesTeaserDateText: null,
};

export const homeService = {
  /**
   * The Home showcase: HERO slides, the spotlight, the coming-soon cards and
   * the Home settings. Lists are always arrays and settings always complete,
   * so the screen never has to guard a missing field.
   */
  async getShowcase(options: RequestSignalOptions = {}): Promise<HomeShowcase> {
    const data = await homeApi.getShowcase(options);
    return {
      hero: Array.isArray(data?.hero) ? data.hero : [],
      spotlight: data?.spotlight ?? null,
      comingSoon: Array.isArray(data?.comingSoon) ? data.comingSoon : [],
      settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) },
    };
  },
};
