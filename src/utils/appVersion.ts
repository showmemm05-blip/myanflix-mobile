import appConfig from "../../app.json";

/**
 * The app's version as app.json states it ("1.0.0") — the number the stores
 * show for a build. Read from the config file when the bundle is made rather
 * than through expo-constants or expo-application: neither is a dependency of
 * this app, and one line of text is no reason to add a native package.
 */
export const APP_VERSION: string = appConfig.expo.version;
