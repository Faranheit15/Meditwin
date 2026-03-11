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
  sex: "M" | "F";
  primaryDiagnosis: string;
  preScreenScore: number | null;
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | null;
  labResults: LabResult[];
  medications: Medication[];
  conditions: Condition[];
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

export interface SimulationResult {
  id: string;
  protocolId: string;
  patientId: string;
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  riskScore: number;
  compatibilityScore: number;
  timeline: TimePointResult[];
  createdAt: string;
}

export interface TimePointResult {
  week: number;
  evaluations: Evaluation[];
}

export interface Evaluation {
  criterionId: string;
  criterionText: string;
  status: "PASS" | "BORDERLINE" | "FAIL";
  projectedValue: number | null;
  threshold: number | null;
  marginPercent: number;
  confidence: number;
  reasoning: ReasoningTrace | null;
}

export interface ReasoningTrace {
  explanation: string;
  riskFactors: string[];
  suggestion: string | null;
  confidenceNote: string;
}
