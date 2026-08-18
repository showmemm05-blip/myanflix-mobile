import type { MovieCategoryRef } from "@/types/category";

export type MovieStatus = "DRAFT" | "PROCESSING" | "PUBLISHED" | "ARCHIVED";

export type AccessType = "FREE" | "SUBSCRIPTION";

export interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  duration: number; // minutes
  rating: number;
  accessType: AccessType;
  status: MovieStatus;
  seriesId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  categories: MovieCategoryRef[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  price: number;
  purchasedAt: string;
}

export interface MovieQuery {
  page?: number;
  limit?: number;
  genre?: string;
  categoryId?: string;
  search?: string;
}
