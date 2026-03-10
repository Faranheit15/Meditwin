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
import type { CriterionRule, SimulationResult, User } from "@/types/models";

export const authAPI: AuthAPI = {
  async getMe(): Promise<APIResponse<User>> {
    return apiRequest<APIResponse<User>>({
      method: "GET",
      url: "/auth/me",
    });
  },
};

export const protocolAPI: ProtocolAPI = {
  async upload(file: File): Promise<APIResponse<null>> {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest<APIResponse<null>>({
      method: "POST",
      url: "/protocols/upload",
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
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
  ): Promise<APIResponse<null>> {
    return apiRequest<APIResponse<null>>({
      method: "PATCH",
      url: `/protocols/criteria/${criterionId}`,
      data,
    });
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
