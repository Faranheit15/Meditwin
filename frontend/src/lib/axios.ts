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
const AUTH_PROVIDER_WAIT_TIMEOUT_MS = 1500;
let pendingProviderResolvers: Array<(provider: TokenProvider | null) => void> = [];

function flushAuthProviderResolvers(provider: TokenProvider | null): void {
  if (pendingProviderResolvers.length === 0) {
    return;
  }

  const resolvers = pendingProviderResolvers;
  pendingProviderResolvers = [];
  for (const resolve of resolvers) {
    resolve(provider);
  }
}

async function waitForAuthTokenProvider(
  timeoutMs: number = AUTH_PROVIDER_WAIT_TIMEOUT_MS,
): Promise<TokenProvider | null> {
  if (authTokenProvider) {
    return authTokenProvider;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const onProviderReady = (provider: TokenProvider | null) => {
      window.clearTimeout(timeoutId);
      resolve(provider);
    };

    const timeoutId = window.setTimeout(() => {
      pendingProviderResolvers = pendingProviderResolvers.filter((item) => item !== onProviderReady);
      resolve(authTokenProvider);
    }, timeoutMs);

    pendingProviderResolvers.push(onProviderReady);
  });
}

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
  if (provider) {
    flushAuthProviderResolvers(provider);
  }
}

export function clearAuthTokenProvider(): void {
  authTokenProvider = null;
  flushAuthProviderResolvers(null);
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const provider = authTokenProvider ?? (await waitForAuthTokenProvider());
  if (provider) {
    const token = await provider();
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
