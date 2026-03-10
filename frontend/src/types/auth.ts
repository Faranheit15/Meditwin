export type TokenProvider = () => Promise<string | null>;

export interface AuthSessionUser {
  clerkId: string;
  email: string | null;
  fullName: string | null;
}

export type AuthSyncStatus = "idle" | "syncing" | "ready" | "error";
