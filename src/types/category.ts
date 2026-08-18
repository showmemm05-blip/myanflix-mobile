export interface Category {
  id: string;
  name: string;
  description: string | null;
  movieCount: number;
}

/** Just {id, name} — the shape a Movie carries inline under `categories`. */
export interface MovieCategoryRef {
  id: string;
  name: string;
}
