export type ActorType = "human" | "agent" | "service";
export type EvidenceType =
  | "test"
  | "observation"
  | "artifact"
  | "review"
  | "metric";

export interface Actor {
  id: string;
  label: string;
  type: ActorType;
}

export interface AcceptanceCriterion {
  id: string;
  statement: string;
  critical: boolean;
  minPassing: number;
  maxAgeMinutes: number;
  independentVerifier: boolean;
  requiredEvidenceTypes: EvidenceType[];
  requiredTags?: string[];
  negativeTestRequired?: boolean;
}

export interface EvidenceReceipt {
  id: string;
  criterionId: string;
  type: EvidenceType;
  producedBy: string;
  verifiedBy: string;
  capturedAt: string;
  outcome: "pass" | "fail";
  artifactRef: string;
  digest: string;
  tags: string[];
  details: string;
}

export interface CompletionContract {
  schemaVersion: "1.0";
  id: string;
  goal: string;
  executor: string;
  actors: Actor[];
  criteria: AcceptanceCriterion[];
  evidence: EvidenceReceipt[];
}

export interface AuditIssue {
  code: string;
  severity: "warning" | "blocked";
  message: string;
  criterionId?: string;
  evidenceId?: string;
}

export interface EvidenceAudit {
  evidenceId: string;
  valid: boolean;
  fresh: boolean;
  independent: boolean;
  issues: AuditIssue[];
}

export interface CriterionAudit {
  criterionId: string;
  passed: boolean;
  passingEvidence: number;
  distinctVerifiers: number;
  requiredQuorum: number;
  evidenceIds: string[];
  issues: AuditIssue[];
}

export interface CompletionAudit {
  contractId: string;
  status: "ready" | "warning" | "blocked";
  score: number;
  coveragePercent: number;
  passedCriteria: number;
  failedCriteria: number;
  criteria: CriterionAudit[];
  evidence: EvidenceAudit[];
  issues: AuditIssue[];
  auditedAt: string;
}

export interface CertifiedCriterion {
  criterionId: string;
  statement: string;
  critical: boolean;
  evidenceIds: string[];
  evidenceDigests: string[];
  verifiers: string[];
}

export interface CompletionCertificate {
  certificateVersion: "1.0";
  contractId: string;
  contractHash: string;
  issuedAt: string;
  status: "certified" | "provisional";
  criteria: CertifiedCriterion[];
  content: string;
  certificateHash: string;
}

export interface CertificateVerification {
  valid: boolean;
  checks: {
    certificateHash: boolean;
    contractHash: boolean;
    uniqueEvidence: boolean;
    criterionCoverage: boolean;
    criterionBindings: boolean;
  };
  errors: string[];
}

export interface ContractDiff {
  from: string;
  to: string;
  addedCriteria: string[];
  removedCriteria: string[];
  modifiedCriteria: string[];
  weakenedRequirements: string[];
}
