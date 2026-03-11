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
import type { PaginationParams } from "@/types/common";
import type { CriterionRule, Protocol, ProtocolWithCriteria, SimulationResult, User } from "@/types/models";

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
  async list(params?: PaginationParams) {
    return apiRequest({
      method: "GET",
      url: "/patients",
      params,
    });
  },

  async getById(id: string) {
    return apiRequest({
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
  async preScreen(protocolId: string): Promise<APIResponse<null>> {
    return apiRequest<APIResponse<null>>({
      method: "POST",
      url: "/simulation/pre-screen",
      data: { protocolId },
    });
  },

  async runFull(protocolId: string, patientId: string): Promise<APIResponse<null>> {
    return apiRequest<APIResponse<null>>({
      method: "POST",
      url: "/simulation/full",
      data: { protocolId, patientId },
    });
  },

  async getResult(simulationId: string): Promise<APIResponse<SimulationResult>> {
    return apiRequest<APIResponse<SimulationResult>>({
      method: "GET",
      url: `/simulation/${simulationId}`,
    });
  },
};
