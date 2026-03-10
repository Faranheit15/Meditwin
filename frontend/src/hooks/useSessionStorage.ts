"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error("Failed to read session storage", error);
      return initialValue;
    }
  });

  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    setStoredValue((previousValue) => {
      const nextValue = value instanceof Function ? value(previousValue) : value;
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, JSON.stringify(nextValue));
        }
      } catch (error) {
        console.error("Failed to write session storage", error);
      }
      return nextValue;
    });
  };

  const removeValue = (): void => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.error("Failed to remove session storage", error);
    }
    setStoredValue(initialValue);
  };

  return [storedValue, setValue, removeValue];
}
