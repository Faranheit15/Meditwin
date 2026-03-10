import type { PaginationParams } from "@/types/common";
import type { CriterionRule, PatientProfile, SimulationResult, User } from "@/types/models";

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface UpdateCriterionPayload {
  originalText?: string;
  parameter?: string;
  operator?: CriterionRule["operator"];
  threshold?: number | null;
  unit?: string | null;
  timeWindow?: number | null;
  evalSchedule?: number[];
  requiresReview?: boolean;
}

export interface PreScreenPayload {
  protocolId: string;
}

export interface FullSimulationPayload {
  protocolId: string;
  patientId: string;
}

export interface AuthAPI {
  getMe: () => Promise<APIResponse<User>>;
}

export interface ProtocolAPI {
  upload: (file: File) => Promise<APIResponse<null>>;
  getCriteria: (protocolId: string) => Promise<APIResponse<CriterionRule[]>>;
  updateCriterion: (
    criterionId: string,
    data: UpdateCriterionPayload,
  ) => Promise<APIResponse<null>>;
}

export interface PatientAPI {
  list: (params?: PaginationParams) => Promise<PaginatedResponse<PatientProfile>>;
  getById: (id: string) => Promise<APIResponse<PatientProfile>>;
  uploadDocument: (patientId: string, file: File) => Promise<APIResponse<null>>;
  confirmEnrichment: (patientId: string) => Promise<APIResponse<null>>;
}

export interface SimulationAPI {
  preScreen: (protocolId: string) => Promise<APIResponse<null>>;
  runFull: (protocolId: string, patientId: string) => Promise<APIResponse<null>>;
  getResult: (simulationId: string) => Promise<APIResponse<SimulationResult>>;
}
