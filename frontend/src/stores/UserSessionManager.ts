"use client";

import type { User } from "@/types/models";

export class UserSessionManager {
  private static instance: UserSessionManager | null = null;
  private readonly prefix = "meditwin:";
  private readonly userKey = `${this.prefix}user`;
  private readonly protocolKey = `${this.prefix}lastProtocolId`;
  private readonly patientKey = `${this.prefix}lastPatientId`;
  private readonly sidebarKey = `${this.prefix}sidebarCollapsed`;

  private constructor() {}

  static getInstance(): UserSessionManager {
    if (!UserSessionManager.instance) {
      UserSessionManager.instance = new UserSessionManager();
    }

    return UserSessionManager.instance;
  }

  setUser(user: User): void {
    this.set(this.userKey, user);
  }

  getUser(): User | null {
    return this.get<User>(this.userKey);
  }

  clearUser(): void {
    this.remove(this.userKey);
  }

  setLastProtocolId(id: string): void {
    this.set(this.protocolKey, id);
  }

  getLastProtocolId(): string | null {
    return this.get<string>(this.protocolKey);
  }

  setLastPatientId(id: string): void {
    this.set(this.patientKey, id);
  }

  getLastPatientId(): string | null {
    return this.get<string>(this.patientKey);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.set(this.sidebarKey, collapsed);
  }

  getSidebarCollapsed(): boolean {
    return this.get<boolean>(this.sidebarKey) ?? false;
  }

  set<T>(key: string, value: T): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to write local storage", error);
    }
  }

  get<T>(key: string): T | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    try {
      const value = storage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      console.error("Failed to read local storage", error);
      return null;
    }
  }

  remove(key: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(key);
    } catch (error) {
      console.error("Failed to remove local storage item", error);
    }
  }

  clear(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      const keys = Object.keys(storage).filter((key) => key.startsWith(this.prefix));
      keys.forEach((key) => storage.removeItem(key));
    } catch (error) {
      console.error("Failed to clear local storage", error);
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage;
  }
}
