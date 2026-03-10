"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { UserSessionManager } from "@/stores/UserSessionManager";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const manager = UserSessionManager.getInstance();
  const [storedValue, setStoredValue] = useState<T>(() => manager.get<T>(key) ?? initialValue);

  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    setStoredValue((previousValue) => {
      const nextValue = value instanceof Function ? value(previousValue) : value;
      manager.set<T>(key, nextValue);
      return nextValue;
    });
  };

  const removeValue = (): void => {
    manager.remove(key);
    setStoredValue(initialValue);
  };

  return [storedValue, setValue, removeValue];
}
