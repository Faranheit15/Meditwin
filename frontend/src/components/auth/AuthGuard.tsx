"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { clearAuthTokenProvider, setAuthTokenProvider } from "@/lib/axios";
import { authAPI } from "@/lib/api";
import { UserSessionManager } from "@/stores/UserSessionManager";
import type { AuthSyncStatus } from "@/types/auth";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const sessionManager = UserSessionManager.getInstance();
  const syncedUserIdRef = useRef<string | null>(sessionManager.getUser()?.clerkId ?? null);
  const [status, setStatus] = useState<AuthSyncStatus>(() =>
    sessionManager.getUser() ? "ready" : "idle",
  );

  const syncUser = useEffectEvent(async () => {
    const nextUserId = userId ?? null;
    if (!nextUserId) {
      return;
    }

    setStatus("syncing");

    try {
      const response = await authAPI.getMe();
      if (response.data) {
        sessionManager.setUser(response.data);
        syncedUserIdRef.current = response.data.clerkId;
      }

      startTransition(() => {
        setStatus("ready");
      });
    } catch (error) {
      console.error("Failed to sync signed-in user", error);
      sessionManager.clearUser();
      syncedUserIdRef.current = null;
      startTransition(() => {
        setStatus("error");
      });
    }
  });

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      sessionManager.clear();
      clearAuthTokenProvider();
      syncedUserIdRef.current = null;
      router.replace(ROUTES.SIGN_IN);
      return;
    }

    setAuthTokenProvider(async () => getToken());
    const cachedUser = sessionManager.getUser();
    const isAlreadySynced =
      Boolean(userId) &&
      syncedUserIdRef.current === userId &&
      cachedUser?.clerkId === userId;

    if (isAlreadySynced) {
      if (status !== "ready") {
        startTransition(() => {
          setStatus("ready");
        });
      }
      return () => {
        clearAuthTokenProvider();
      };
    }

    void syncUser();

    return () => {
      clearAuthTokenProvider();
    };
  }, [getToken, isLoaded, isSignedIn, router, sessionManager, status, userId]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading workspace" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}
