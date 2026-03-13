"use client";

import { apiRequest } from "@/lib/axios";
import type {
  APIResponse,
  AuthAPI,
  PatientAPI,
  ProtocolAPI,
  SimulationAPI,
  UpdateCriterionPayload,
} from "@/types/api";
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

let protocolsCache: APIResponse<Protocol[]> | null = null;
let protocolsInFlight: Promise<APIResponse<Protocol[]>> | null = null;

export function invalidateProtocolListCache(): void {
  protocolsCache = null;
  protocolsInFlight = null;
}

async function fetchProtocolList(): Promise<APIResponse<Protocol[]>> {
  if (protocolsCache) {
    return protocolsCache;
  }

  if (protocolsInFlight) {
    return protocolsInFlight;
  }

  protocolsInFlight = apiRequest<APIResponse<Protocol[]>>({
    method: "GET",
    url: "/protocols",
  })
    .then((response) => {
      protocolsCache = response;
      return response;
    })
    .finally(() => {
      protocolsInFlight = null;
    });

  return protocolsInFlight;
}

export const authAPI: AuthAPI = {
  async getMe(): Promise<APIResponse<User>> {
    return apiRequest<APIResponse<User>>({
      method: "GET",
      url: "/auth/me",
    });
  },
};

export const protocolAPI: ProtocolAPI = {
  async upload(file: File): Promise<APIResponse<Protocol>> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiRequest<APIResponse<Protocol>>({
      method: "POST",
      url: "/protocols/upload",
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000,
    });
    invalidateProtocolListCache();
    return response;
  },

  async list(): Promise<APIResponse<Protocol[]>> {
    return fetchProtocolList();
  },

  async getById(id: string): Promise<APIResponse<ProtocolWithCriteria>> {
    return apiRequest<APIResponse<ProtocolWithCriteria>>({
      method: "GET",
      url: `/protocols/${id}`,
    });
  },

  async getCriteria(protocolId: string): Promise<APIResponse<CriterionRule[]>> {
    return apiRequest<APIResponse<CriterionRule[]>>({
      method: "GET",
      url: `/protocols/${protocolId}/criteria`,
    });
  },

  async updateCriterion(
    criterionId: string,
    data: UpdateCriterionPayload,
  ): Promise<APIResponse<CriterionRule>> {
    return apiRequest<APIResponse<CriterionRule>>({
      method: "PATCH",
      url: `/criteria/${criterionId}`,
      data,
    });
  },

  async confirm(protocolId: string): Promise<APIResponse<Protocol>> {
    const response = await apiRequest<APIResponse<Protocol>>({
      method: "POST",
      url: `/protocols/${protocolId}/confirm`,
    });
    invalidateProtocolListCache();
    return response;
  },
};

export const patientAPI: PatientAPI = {
  async list(protocolId?: string): Promise<APIResponse<PatientProfile[]>> {
    return apiRequest<APIResponse<PatientProfile[]>>({
      method: "GET",
      url: "/patients/",
      params: protocolId ? { protocol_id: protocolId } : undefined,
    });
  },

  async getById(id: string): Promise<APIResponse<PatientProfile>> {
    return apiRequest<APIResponse<PatientProfile>>({
      method: "GET",
      url: `/patients/${id}`,
    });
  },

  async uploadDocument(patientId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest({
      method: "POST",
      url: `/patients/${patientId}/documents`,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  async confirmEnrichment(patientId: string) {
    return apiRequest({
      method: "POST",
      url: `/patients/${patientId}/confirm-enrichment`,
    });
  },
} satisfies PatientAPI;

export const simulationAPI: SimulationAPI = {
  async list(protocolId?: string, patientId?: string): Promise<APIResponse<SimulationListItem[]>> {
    const params: Record<string, string> = {};
    if (protocolId) {
      params.protocol_id = protocolId;
    }
    if (patientId) {
      params.patient_id = patientId;
    }

    return apiRequest<APIResponse<SimulationListItem[]>>({
      method: "GET",
      url: "/simulations",
      params: Object.keys(params).length > 0 ? params : undefined,
    });
  },

  async preScreen(protocolId: string): Promise<APIResponse<PreScreenResponse>> {
    return apiRequest<APIResponse<PreScreenResponse>>({
      method: "POST",
      url: "/simulate/pre-screen",
      data: { protocol_id: protocolId },
      timeout: 60000,
    });
  },

  async runFull(protocolId: string, patientId: string): Promise<APIResponse<SimulationResponse>> {
    return apiRequest<APIResponse<SimulationResponse>>({
      method: "POST",
      url: "/simulate/full",
      data: { protocol_id: protocolId, patient_id: patientId },
      timeout: 90000,
    });
  },

  async getResult(simulationId: string): Promise<APIResponse<SimulationResponse>> {
    return apiRequest<APIResponse<SimulationResponse>>({
      method: "GET",
      url: `/simulations/${simulationId}`,
      timeout: 90000,
    });
  },
};
