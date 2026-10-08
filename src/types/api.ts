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
 * The query the self-service request lists (`GET /deposits/me`,
 * `GET /withdrawals/me`) accept on top of paging: the backend's DepositQueryDto
 * / WithdrawalQueryDto apply `status` and `dateFrom` (createdAt >=) there.
 *
 * Deliberately NOT accepted by the wallet ledger: `GET /wallet/transactions`
 * takes PaginationQueryDto only and the global ValidationPipe rejects any
 * other param with a 400 (forbidNonWhitelisted), so that call stays typed as
 * plain `PaginationParams` and a filter can never reach it at compile time.
 */
export interface RequestListParams extends PaginationParams {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  /** ISO timestamp; the server compares it to createdAt with `gte`. */
  dateFrom?: string;
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
