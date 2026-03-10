"use client";

import { useEffect, useState } from "react";

import type { CookieStorageOptions } from "@/types/common";

function parseCookieValue<T>(cookieValue: string | null): T | null {
  if (!cookieValue) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(cookieValue)) as T;
  } catch (error) {
    console.error("Failed to parse cookie value", error);
    return null;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const target = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return target ? target.split("=").slice(1).join("=") : null;
}

function buildCookieString<T>(name: string, value: T, options?: CookieStorageOptions): string {
  const segments = [`${name}=${encodeURIComponent(JSON.stringify(value))}`];

  if (options?.path) {
    segments.push(`Path=${options.path}`);
  }
  if (typeof options?.maxAge === "number") {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  if (options?.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }
  if (options?.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

export function useCookieStorage<T>(
  key: string,
  options?: CookieStorageOptions,
): [T | null, (value: T, overrideOptions?: CookieStorageOptions) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T | null>(() => parseCookieValue<T>(getCookie(key)));

  useEffect(() => {
    setStoredValue(parseCookieValue<T>(getCookie(key)));
  }, [key]);

  const setValue = (value: T, overrideOptions?: CookieStorageOptions): void => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      document.cookie = buildCookieString(key, value, overrideOptions ?? options);
      setStoredValue(value);
    } catch (error) {
      console.error("Failed to write cookie storage", error);
    }
  };

  const removeValue = (): void => {
    if (typeof document === "undefined") {
      return;
    }

    document.cookie = `${key}=; Path=${options?.path ?? "/"}; Max-Age=0`;
    setStoredValue(null);
  };

  return [storedValue, setValue, removeValue];
}
