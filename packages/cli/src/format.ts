import type {
  CompletionAudit,
  ContractDiff,
  CriterionAudit,
} from "@evidencequorum/core";

const symbol = (passed: boolean): string => (passed ? "✓" : "×");

export function formatAudit(audit: CompletionAudit): string {
  const lines = [
    `EvidenceQuorum · ${audit.contractId}`,
    `Status: ${audit.status.toUpperCase()} · score ${audit.score}/100 · coverage ${audit.coveragePercent}%`,
    "",
  ];
  for (const criterion of audit.criteria) {
    lines.push(
      `${symbol(criterion.passed)} ${criterion.criterionId} · ${criterion.distinctVerifiers}/${criterion.requiredQuorum} verifiers`
    );
    for (const entry of criterion.issues) {
      lines.push(`  ${entry.severity === "blocked" ? "BLOCK" : "WARN"} ${entry.code}: ${entry.message}`);
    }
  }
  const evidenceIssues = audit.evidence.flatMap((entry) =>
    entry.issues.map((issue) => ({ evidenceId: entry.evidenceId, issue }))
  );
  if (evidenceIssues.length > 0) {
    lines.push("", "Evidence issues");
    for (const { evidenceId, issue } of evidenceIssues) {
      lines.push(`  ${evidenceId}: ${issue.code} — ${issue.message}`);
    }
  }
  if (audit.issues.some((entry) => entry.code === "cross-criterion-evidence-reuse")) {
    lines.push("", "Reuse issues");
    for (const issue of audit.issues.filter(
      (entry) => entry.code === "cross-criterion-evidence-reuse"
    )) {
      lines.push(`  ${issue.message}`);
    }
  }
  return lines.join("\n");
}

export function formatCriterion(criterion: CriterionAudit): string {
  const lines = [
    `Criterion: ${criterion.criterionId}`,
    `Result: ${criterion.passed ? "PASS" : "FAIL"}`,
    `Verifier quorum: ${criterion.distinctVerifiers}/${criterion.requiredQuorum}`,
    `Accepted evidence: ${criterion.evidenceIds.join(", ") || "none"}`,
  ];
  for (const issue of criterion.issues) {
    lines.push(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
  }
  return lines.join("\n");
}

export function formatDiff(diff: ContractDiff): string {
  const lines = [
    `Contract diff: ${diff.from} → ${diff.to}`,
    `Added: ${diff.addedCriteria.join(", ") || "none"}`,
    `Removed: ${diff.removedCriteria.join(", ") || "none"}`,
    `Modified: ${diff.modifiedCriteria.join(", ") || "none"}`,
    "",
    `Weakening signals: ${diff.weakenedRequirements.length}`,
  ];
  for (const warning of diff.weakenedRequirements) lines.push(`- ${warning}`);
  return lines.join("\n");
}
