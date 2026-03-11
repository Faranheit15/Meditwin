"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, type ReactNode } from "react";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { clearAuthTokenProvider, setAuthTokenProvider } from "@/lib/axios";
import { authAPI } from "@/lib/api";
import { UserSessionManager } from "@/stores/UserSessionManager";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const sessionManager = UserSessionManager.getInstance();

  const syncUser = useEffectEvent(async () => {
    if (!userId) {
      return;
    }

    try {
      const response = await authAPI.getMe();
      if (response.data) {
        sessionManager.setUser(response.data);
      }
    } catch (error) {
      console.error("Failed to sync signed-in user", error);
      sessionManager.clearUser();
    }
  });

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      sessionManager.clear();
      clearAuthTokenProvider();
      router.replace(ROUTES.SIGN_IN);
      return;
    }

    setAuthTokenProvider(async () => getToken());
    void syncUser();

    return () => {
      clearAuthTokenProvider();
    };
  }, [getToken, isLoaded, isSignedIn, router, sessionManager, userId]);

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
