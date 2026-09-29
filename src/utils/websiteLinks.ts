import { API_BASE_URL } from "@/api/client";

/**
 * The public website's origin — the app links to pages that live there, such
 * as the privacy policy the app stores require (audit H-16).
 *
 * Release builds get EXPO_PUBLIC_WEBSITE_URL from their eas.json profile. In
 * development without it, the website is assumed to run on the same machine
 * as the API, on the website container's port 3003 — the owner's local setup —
 * so the link works from Expo Go without editing .env. A release build without
 * it gets no link rather than a guessed one.
 */
function resolveWebsiteUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_WEBSITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (!__DEV__) return null;
  const apiOrigin = /^(https?:\/\/[^/:]+)/.exec(API_BASE_URL);
  return apiOrigin ? `${apiOrigin[1]}:3003` : null;
}

export const WEBSITE_URL = resolveWebsiteUrl();

/** The website's /privacy page, or null when this build has no website address. */
export const PRIVACY_POLICY_URL = WEBSITE_URL ? `${WEBSITE_URL}/privacy` : null;
