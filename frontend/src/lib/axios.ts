"use client";

import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { ROUTES } from "@/constants/routes";
import type { TokenProvider } from "@/types/auth";
import type { APIErrorResponse } from "@/types/api";

let authTokenProvider: TokenProvider | null = null;

export class APIRequestError extends Error {
  status: number | null;
  code: string;
  payload: APIErrorResponse | null;

  constructor(message: string, status: number | null, code: string, payload: APIErrorResponse | null) {
    super(message);
    this.name = "APIRequestError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function setAuthTokenProvider(provider: TokenProvider | null): void {
  authTokenProvider = provider;
}

export function clearAuthTokenProvider(): void {
  authTokenProvider = null;
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (authTokenProvider) {
    const token = await authTokenProvider();
    if (token) {
      const headers = AxiosHeaders.from(config.headers);
      headers.set("Authorization", `Bearer ${token}`);
      config.headers = headers;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[api:request]", config.method?.toUpperCase(), config.url);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === "development") {
      console.info("[api:response]", response.status, response.config.url);
    }

    return response.data;
  },
  (error: AxiosError<APIErrorResponse>) => {
    const status = error.response?.status ?? null;
    const payload = error.response?.data ?? null;
    const message = payload?.error.message ?? error.message ?? "Unexpected API error";
    const code = payload?.error.code ?? "UNKNOWN_ERROR";

    if (typeof window !== "undefined") {
      if (status === 401 && !window.location.pathname.startsWith(ROUTES.SIGN_IN)) {
        const redirectUrl = encodeURIComponent(window.location.pathname);
        window.location.href = `${ROUTES.SIGN_IN}?redirect_url=${redirectUrl}`;
      } else if (status === 403) {
        console.error("[api:forbidden]", message);
      } else if (status === 500) {
        console.error("[api:server-error]", message);
      }
    }

    return Promise.reject(new APIRequestError(message, status, code, payload));
  },
);

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  return apiClient.request<T, T>(config);
}

export default apiClient;
