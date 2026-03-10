import { ROUTES } from "@/constants/routes";

export const APP_NAME = "MediTwin";
export const APP_TAGLINE = "Patient digital twin simulation for clinical trial eligibility.";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const DEFAULT_DASHBOARD_ROUTE = ROUTES.PROTOCOLS;
