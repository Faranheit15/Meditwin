import type {
  CriterionRule,
  PatientProfile,
  PreScreenResponse,
  Protocol,
  ProtocolWithCriteria,
  SimulationListItem,
  SimulationResponse,
  User,
} from "@/types/models";

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
  confidence?: number | null;
}

export interface AuthAPI {
  getMe: () => Promise<APIResponse<User>>;
}

export interface ProtocolAPI {
  upload: (file: File) => Promise<APIResponse<Protocol>>;
  list: () => Promise<APIResponse<Protocol[]>>;
  getById: (id: string) => Promise<APIResponse<ProtocolWithCriteria>>;
  getCriteria: (protocolId: string) => Promise<APIResponse<CriterionRule[]>>;
  updateCriterion: (
    criterionId: string,
    data: UpdateCriterionPayload,
  ) => Promise<APIResponse<CriterionRule>>;
  confirm: (protocolId: string) => Promise<APIResponse<Protocol>>;
}

export interface PatientAPI {
  list: (protocolId?: string) => Promise<APIResponse<PatientProfile[]>>;
  getById: (id: string) => Promise<APIResponse<PatientProfile>>;
  uploadDocument: (patientId: string, file: File) => Promise<APIResponse<null>>;
  confirmEnrichment: (patientId: string) => Promise<APIResponse<null>>;
}

export interface SimulationAPI {
  list: (protocolId?: string, patientId?: string) => Promise<APIResponse<SimulationListItem[]>>;
  preScreen: (protocolId: string) => Promise<APIResponse<PreScreenResponse>>;
  runFull: (protocolId: string, patientId: string) => Promise<APIResponse<SimulationResponse>>;
  getResult: (simulationId: string) => Promise<APIResponse<SimulationResponse>>;
}
