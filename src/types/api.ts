/** Every backend response is one of these two envelope shapes — branch on `success`, not HTTP status alone. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Per-call escape hatch for React Query's `AbortSignal`, threaded
 * queryFn → service → api module → axios so a superseded request is actually
 * cancelled instead of running to completion. Always the optional last
 * argument, so no existing call site has to pass it.
 */
export interface RequestSignalOptions {
  signal?: AbortSignal;
}
