"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

// SSR-safe mounted guard using useSyncExternalStore.
// Server snapshot → false (not mounted), client snapshot → true.
// This avoids calling setState inside useEffect (react-hooks/set-state-in-effect).
function subscribe() {
  return () => {};
}
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,   // client: always mounted
    () => false,  // server: not mounted
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // Render an invisible placeholder before client hydration to avoid layout shift
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-hidden className="opacity-0" disabled>
        <Moon className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-yellow-400" />
      ) : (
        <Moon className="h-4 w-4 text-cyan-400" />
      )}
    </Button>
  );
}
