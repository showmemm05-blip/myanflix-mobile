/**
 * app.json stays the Expo config. Expo hands it to this file as `config`, and
 * it goes back out unchanged — this file only adds a build-time guard (audit
 * H-13), so Expo Go and `npx expo start` behave exactly as before.
 *
 * The guard runs when a PREVIEW or PRODUCTION profile from eas.json is being
 * built (those profiles set MYANFLIX_RELEASE_BUILD=1; eas-cli applies a
 * profile's env before it reads this file, and so does the build server). It
 * stops the build with a plain message instead of shipping an app that
 * cannot reach its server:
 *
 * - The API and website addresses in eas.json are still the
 *   "REPLACE-WITH-MYANFLIX-DOMAIN.invalid" placeholders. `.invalid` is a reserved name that
 *   never resolves, so a build that slipped through could never connect.
 * - An address is plain http://. Release builds block unencrypted traffic on
 *   Android and iOS, so every request would fail on a real phone.
 */
const RELEASE_URL_VARIABLES = ["EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_WEBSITE_URL"];

function releaseUrlProblem(name) {
  const value = process.env[name];
  if (!value) return `${name} is not set.`;
  let url;
  try {
    url = new URL(value);
  } catch {
    return `${name} is not a valid address: ${value}`;
  }
  if (url.hostname.endsWith(".invalid")) {
    return `${name} is still the placeholder (${value}). Put your real HTTPS domain in mobile/eas.json.`;
  }
  if (url.protocol !== "https:") {
    return `${name} must start with https:// in a release build (it is ${value}).`;
  }
  return null;
}

module.exports = ({ config }) => {
  if (process.env.MYANFLIX_RELEASE_BUILD === "1") {
    const problems = RELEASE_URL_VARIABLES.map(releaseUrlProblem).filter(Boolean);
    if (problems.length > 0) {
      throw new Error(`MyanFlix release build stopped:\n- ${problems.join("\n- ")}`);
    }
  }
  return config;
};
