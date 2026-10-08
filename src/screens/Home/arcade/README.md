# The Arcade (games storefront) — kept for the future games rows

Kept for the future games rows (owner, 2026-10-08).

On 2026-10-08 the owner decided that Home is a page of movies, series and
books (`screens/Home/Home.tsx`, `components/home/*`). The games storefront
that used to be the Home page lives here, unchanged apart from its export
name, so that it keeps compiling and can come back later as extra rows on
Home. It is not registered in any navigator.

- `ArcadeHome.tsx` — the whole old Home screen (`ArcadeHomeScreen`), composed
  from the sections below.
- Its sections, art and layout stay where they were: `components/arcade/*`
  (Store* sections, ArcadeArt, arcadeScenes — the hubs' HubFallbackArt still
  draws from arcadeScenes), `hooks/useHomeLayout.ts`, and its mock data in
  `data/arcade.ts` + `data/games.ts`. Its strings stay under `t.arcade.*`.

Nothing here fetches the catalogue; it is all local mock data and drawn SVG.
