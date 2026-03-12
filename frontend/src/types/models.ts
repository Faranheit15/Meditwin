export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "coordinator" | "admin" | "sponsor";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Protocol {
  id: string;
  name: string;
  version: string;
  status: "PROCESSING" | "EXTRACTED" | "CONFIRMED" | "FAILED";
  fileName: string | null;
  criteriaCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CriterionRule {
  id: string;
  protocolId: string;
  category: "INCLUSION" | "EXCLUSION";
  originalText: string;
  parameter: string;
  operator: "GTE" | "LTE" | "EQ" | "NEQ" | "BOOLEAN" | "NOT_WITHIN" | "STABLE";
  threshold: number | null;
  unit: string | null;
  timeWindow: number | null;
  evalSchedule: number[];
  requiresReview: boolean;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolWithCriteria extends Protocol {
  criteria: CriterionRule[];
}

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  sex: "MALE" | "FEMALE";
  primaryDiagnosis: string;
  preScreenScore: number | null;
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | null;
  labResults: LabResult[];
  medications: Medication[];
  conditions: Condition[];
  failReasons?: string[];
}

export interface LabResult {
  parameter: string;
  value: number;
  unit: string;
  date: string;
  referenceRange: [number, number];
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
}

export interface Condition {
  name: string;
  icdCode: string;
  onsetDate: string;
}

export interface PreScreenResponse {
  protocolId: string;
  totalPatients: number;
  results: PreScreenPatientResult[];
}

export interface PreScreenPatientResult {
  id: string;
  name: string;
  age: number;
  sex: "MALE" | "FEMALE";
  primaryDiagnosis: string;
  preScreenScore: number | null;
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | null;
  failReasons: string[];
}

export interface SimulationResponse {
  id: string;
  protocolId: string;
  patientId: string;
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  riskScore: number;
  compatibilityScore: number;
  evaluations: EvaluationResponse[];
  createdAt: string;
}

export interface EvaluationResponse {
  id: string;
  criterionId: string;
  criterionText: string;
  category: "INCLUSION" | "EXCLUSION";
  week: number;
  status: "PASS" | "BORDERLINE" | "FAIL";
  projectedValue: number | null;
  threshold: number | null;
  marginPercent: number;
  confidence: number;
  parameter: string;
  operator: string;
  reasoning: ReasoningTrace | null;
}

export interface ReasoningTrace {
  id: string;
  evaluationId: string;
  explanation: string;
  riskFactors: string[];
  suggestion: string | null;
  confidenceNote: string;
}

export type SimulationResult = SimulationResponse;
