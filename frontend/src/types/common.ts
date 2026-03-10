export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig<TKey extends string = string> {
  key: TKey;
  direction: SortDirection;
}

export interface CookieStorageOptions {
  path?: string;
  maxAge?: number;
  sameSite?: "Strict" | "Lax" | "None";
  secure?: boolean;
}
