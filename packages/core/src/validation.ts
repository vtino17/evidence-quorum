import type {
  CompletionContract,
  EvidenceType,
} from "./types.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const date = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
const nonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const evidenceTypes = new Set<EvidenceType>([
  "test", "observation", "artifact", "review", "metric"
]);

export function validateContract(value: unknown): ValidationIssue[] {
  if (!object(value)) return [{ path: "$", message: "Contract must be an object." }];
  const issues: ValidationIssue[] = [];
  if (value.schemaVersion !== "1.0") {
    issues.push({ path: "schemaVersion", message: 'Must equal "1.0".' });
  }
  for (const field of ["id", "goal", "executor"] as const) {
    if (!text(value[field])) issues.push({ path: field, message: "Must be non-empty." });
  }
  if (!Array.isArray(value.actors) || value.actors.length === 0) {
    issues.push({ path: "actors", message: "At least one actor is required." });
  } else {
    value.actors.forEach((actor, index) => {
      if (!object(actor)) {
        issues.push({ path: `actors[${index}]`, message: "Must be an object." });
        return;
      }
      if (!text(actor.id)) issues.push({ path: `actors[${index}].id`, message: "ID is required." });
      if (!text(actor.label)) issues.push({ path: `actors[${index}].label`, message: "Label is required." });
      if (!["human", "agent", "service"].includes(String(actor.type))) {
        issues.push({ path: `actors[${index}].type`, message: "Unknown actor type." });
      }
    });
  }
  if (!Array.isArray(value.criteria) || value.criteria.length === 0) {
    issues.push({ path: "criteria", message: "At least one criterion is required." });
  } else {
    value.criteria.forEach((criterion, index) => {
      const path = `criteria[${index}]`;
      if (!object(criterion)) {
        issues.push({ path, message: "Must be an object." });
        return;
      }
      if (!text(criterion.id)) issues.push({ path: `${path}.id`, message: "ID is required." });
      if (!text(criterion.statement)) issues.push({ path: `${path}.statement`, message: "Statement is required." });
      if (typeof criterion.critical !== "boolean") issues.push({ path: `${path}.critical`, message: "Must be boolean." });
      if (!Number.isInteger(criterion.minPassing) || (criterion.minPassing as number) < 1) {
        issues.push({ path: `${path}.minPassing`, message: "Must be a positive integer." });
      }
      if (!nonNegative(criterion.maxAgeMinutes) || criterion.maxAgeMinutes === 0) {
        issues.push({ path: `${path}.maxAgeMinutes`, message: "Must be greater than zero." });
      }
      if (typeof criterion.independentVerifier !== "boolean") {
        issues.push({ path: `${path}.independentVerifier`, message: "Must be boolean." });
      }
      if (
        !Array.isArray(criterion.requiredEvidenceTypes) ||
        criterion.requiredEvidenceTypes.length === 0 ||
        !criterion.requiredEvidenceTypes.every((entry) => evidenceTypes.has(entry as EvidenceType))
      ) {
        issues.push({ path: `${path}.requiredEvidenceTypes`, message: "Must contain known evidence types." });
      }
      if (
        criterion.requiredTags !== undefined &&
        (!Array.isArray(criterion.requiredTags) || !criterion.requiredTags.every(text))
      ) {
        issues.push({ path: `${path}.requiredTags`, message: "Must be an array of strings." });
      }
      if (
        criterion.negativeTestRequired !== undefined &&
        typeof criterion.negativeTestRequired !== "boolean"
      ) {
        issues.push({ path: `${path}.negativeTestRequired`, message: "Must be boolean." });
      }
    });
  }
  if (!Array.isArray(value.evidence)) {
    issues.push({ path: "evidence", message: "Evidence must be an array." });
  } else {
    value.evidence.forEach((receipt, index) => {
      const path = `evidence[${index}]`;
      if (!object(receipt)) {
        issues.push({ path, message: "Must be an object." });
        return;
      }
      for (const field of ["id", "criterionId", "producedBy", "verifiedBy", "artifactRef", "digest", "details"] as const) {
        if (!text(receipt[field])) issues.push({ path: `${path}.${field}`, message: "Must be non-empty." });
      }
      if (!evidenceTypes.has(receipt.type as EvidenceType)) {
        issues.push({ path: `${path}.type`, message: "Unknown evidence type." });
      }
      if (!date(receipt.capturedAt)) issues.push({ path: `${path}.capturedAt`, message: "Must be an ISO date." });
      if (!["pass", "fail"].includes(String(receipt.outcome))) {
        issues.push({ path: `${path}.outcome`, message: "Must be pass or fail." });
      }
      if (!Array.isArray(receipt.tags) || !receipt.tags.every(text)) {
        issues.push({ path: `${path}.tags`, message: "Must be an array of strings." });
      }
    });
  }
  const actorIds = Array.isArray(value.actors) ? value.actors.filter(object).map((entry) => entry.id).filter(text) : [];
  const criterionIds = Array.isArray(value.criteria) ? value.criteria.filter(object).map((entry) => entry.id).filter(text) : [];
  const evidenceIds = Array.isArray(value.evidence) ? value.evidence.filter(object).map((entry) => entry.id).filter(text) : [];
  if (new Set(actorIds).size !== actorIds.length) issues.push({ path: "actors", message: "Actor IDs must be unique." });
  if (new Set(criterionIds).size !== criterionIds.length) issues.push({ path: "criteria", message: "Criterion IDs must be unique." });
  if (new Set(evidenceIds).size !== evidenceIds.length) issues.push({ path: "evidence", message: "Evidence IDs must be unique." });
  if (text(value.executor) && !actorIds.includes(value.executor)) {
    issues.push({ path: "executor", message: "Executor must reference a declared actor." });
  }
  return issues;
}

export function assertContract(value: unknown): asserts value is CompletionContract {
  const issues = validateContract(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid completion contract:\n${issues.map((entry) => `- ${entry.path}: ${entry.message}`).join("\n")}`
    );
  }
}
