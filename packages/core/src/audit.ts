import type {
  AcceptanceCriterion,
  AuditIssue,
  CompletionAudit,
} from "./types.js";
import { assertContract } from "./validation.js";

function issue(
  code: string,
  severity: AuditIssue["severity"],
  message: string,
  target?: { criterionId?: string; evidenceId?: string }
): AuditIssue {
  return { code, severity, message, ...target };
}

function criterionSeverity(criterion: AcceptanceCriterion): AuditIssue["severity"] {
  return criterion.critical ? "blocked" : "warning";
}

export function auditCompletion(
  value: unknown,
  now = new Date()
): CompletionAudit {
  assertContract(value);
  const contract = value;
  const actors = new Map(contract.actors.map((actor) => [actor.id, actor]));
  const criteria = new Map(contract.criteria.map((criterion) => [criterion.id, criterion]));

  const evidenceAudits = contract.evidence.map((receipt) => {
    const issues: AuditIssue[] = [];
    const criterion = criteria.get(receipt.criterionId);
    const ageMinutes = (now.getTime() - Date.parse(receipt.capturedAt)) / 60_000;
    const fresh = Boolean(
      criterion && ageMinutes >= 0 && ageMinutes <= criterion.maxAgeMinutes
    );
    const independent = Boolean(
      !criterion?.independentVerifier ||
        (receipt.verifiedBy !== contract.executor &&
          receipt.verifiedBy !== receipt.producedBy)
    );
    if (!criterion) {
      issues.push(issue("unknown-criterion", "blocked", `Unknown criterion "${receipt.criterionId}".`, { evidenceId: receipt.id }));
    }
    if (!actors.has(receipt.producedBy)) {
      issues.push(issue("unknown-producer", "blocked", `Unknown producer "${receipt.producedBy}".`, { evidenceId: receipt.id }));
    }
    if (!actors.has(receipt.verifiedBy)) {
      issues.push(issue("unknown-verifier", "blocked", `Unknown verifier "${receipt.verifiedBy}".`, { evidenceId: receipt.id }));
    }
    if (!/^[a-f0-9]{64}$/i.test(receipt.digest)) {
      issues.push(issue("invalid-digest", "blocked", "Evidence digest must be a SHA-256 hex string.", { evidenceId: receipt.id }));
    }
    if (!fresh) {
      issues.push(
        issue(
          ageMinutes < 0 ? "future-evidence" : "stale-evidence",
          criterion ? criterionSeverity(criterion) : "blocked",
          ageMinutes < 0
            ? "Evidence timestamp is in the future."
            : `Evidence exceeds the ${criterion?.maxAgeMinutes ?? 0}-minute freshness window.`,
          { evidenceId: receipt.id, ...(criterion ? { criterionId: criterion.id } : {}) }
        )
      );
    }
    if (!independent && criterion) {
      issues.push(
        issue(
          "self-verification",
          criterionSeverity(criterion),
          "Evidence requires a verifier independent from both executor and producer.",
          { evidenceId: receipt.id, criterionId: criterion.id }
        )
      );
    }
    return {
      evidenceId: receipt.id,
      valid: fresh && independent && !issues.some((entry) => entry.severity === "blocked"),
      fresh,
      independent,
      issues,
    };
  });
  const evidenceAuditMap = new Map(
    evidenceAudits.map((entry) => [entry.evidenceId, entry])
  );

  const digestCriteria = new Map<string, Set<string>>();
  for (const receipt of contract.evidence) {
    const set = digestCriteria.get(receipt.digest) ?? new Set<string>();
    set.add(receipt.criterionId);
    digestCriteria.set(receipt.digest, set);
  }
  const reuseIssues = [...digestCriteria.entries()]
    .filter(([, criterionIds]) => criterionIds.size > 1)
    .map(([digest, criterionIds]) =>
      issue(
        "cross-criterion-evidence-reuse",
        "blocked",
        `Digest ${digest.slice(0, 12)}… is reused across criteria: ${[...criterionIds].join(", ")}.`
      )
    );

  const criterionAudits = contract.criteria.map((criterion) => {
    const receipts = contract.evidence.filter(
      (receipt) => receipt.criterionId === criterion.id
    );
    const valid = receipts.filter(
      (receipt) => evidenceAuditMap.get(receipt.id)?.valid
    );
    const passing = valid.filter((receipt) => receipt.outcome === "pass");
    const failing = valid.filter((receipt) => receipt.outcome === "fail");
    const distinctVerifiers = new Set(passing.map((receipt) => receipt.verifiedBy));
    const types = new Set(passing.map((receipt) => receipt.type));
    const tags = new Set(passing.flatMap((receipt) => receipt.tags));
    const issues: AuditIssue[] = [];
    const severity = criterionSeverity(criterion);
    if (distinctVerifiers.size < criterion.minPassing) {
      issues.push(
        issue(
          "insufficient-quorum",
          severity,
          `${distinctVerifiers.size} distinct passing verifiers do not meet quorum ${criterion.minPassing}.`,
          { criterionId: criterion.id }
        )
      );
    }
    const missingTypes = criterion.requiredEvidenceTypes.filter(
      (type) => !types.has(type)
    );
    if (missingTypes.length > 0) {
      issues.push(
        issue(
          "missing-evidence-type",
          severity,
          `Missing required evidence types: ${missingTypes.join(", ")}.`,
          { criterionId: criterion.id }
        )
      );
    }
    const missingTags = (criterion.requiredTags ?? []).filter(
      (tag) => !tags.has(tag)
    );
    if (missingTags.length > 0) {
      issues.push(
        issue(
          "missing-evidence-tag",
          severity,
          `Missing required evidence tags: ${missingTags.join(", ")}.`,
          { criterionId: criterion.id }
        )
      );
    }
    if (criterion.negativeTestRequired && !tags.has("negative")) {
      issues.push(
        issue(
          "missing-negative-test",
          severity,
          "Criterion requires passing negative-path evidence.",
          { criterionId: criterion.id }
        )
      );
    }
    if (failing.length > 0) {
      issues.push(
        issue(
          "contradictory-failure",
          severity,
          `${failing.length} current evidence receipt(s) report failure.`,
          { criterionId: criterion.id }
        )
      );
    }
    return {
      criterionId: criterion.id,
      passed: issues.length === 0,
      passingEvidence: passing.length,
      distinctVerifiers: distinctVerifiers.size,
      requiredQuorum: criterion.minPassing,
      evidenceIds: passing.map((receipt) => receipt.id),
      issues,
    };
  });

  const allIssues = [
    ...evidenceAudits.flatMap((entry) => entry.issues),
    ...criterionAudits.flatMap((entry) => entry.issues),
    ...reuseIssues,
  ];
  const passedCriteria = criterionAudits.filter((entry) => entry.passed).length;
  const blocked = allIssues.filter((entry) => entry.severity === "blocked").length;
  const warnings = allIssues.length - blocked;
  const coveragePercent = Math.round(
    (passedCriteria / contract.criteria.length) * 100
  );
  return {
    contractId: contract.id,
    status: blocked > 0 ? "blocked" : warnings > 0 ? "warning" : "ready",
    score: Math.max(0, coveragePercent - blocked * 10 - warnings * 3),
    coveragePercent,
    passedCriteria,
    failedCriteria: contract.criteria.length - passedCriteria,
    criteria: criterionAudits,
    evidence: evidenceAudits,
    issues: allIssues,
    auditedAt: now.toISOString(),
  };
}
