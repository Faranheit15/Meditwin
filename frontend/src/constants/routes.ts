export const ROUTES = {
  HOME: "/",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  PROTOCOLS: "/protocols",
  PATIENTS: "/patients",
  SIMULATION: "/simulation",
  SETTINGS: "/settings",
} as const;

export const PUBLIC_ROUTES = [ROUTES.HOME, ROUTES.SIGN_IN, ROUTES.SIGN_UP] as const;
