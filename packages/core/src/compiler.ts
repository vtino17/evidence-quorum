import { auditCompletion } from "./audit.js";
import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import type {
  CompletionAudit,
  CompletionCertificate,
  CompletionContract,
} from "./types.js";
import { assertContract } from "./validation.js";

function render(
  contract: CompletionContract,
  certificate: Omit<CompletionCertificate, "content" | "certificateHash">
): string {
  const lines = [
    "# EvidenceQuorum Completion Certificate",
    "",
    `Contract: ${contract.id}`,
    `Goal: ${contract.goal}`,
    `Status: ${certificate.status}`,
    `Contract SHA-256: ${certificate.contractHash}`,
    "",
  ];
  for (const criterion of certificate.criteria) {
    lines.push(
      `## ${criterion.criterionId}`,
      "",
      criterion.statement,
      "",
      `- Critical: ${criterion.critical ? "yes" : "no"}`,
      `- Verifiers: ${criterion.verifiers.join(", ")}`,
      `- Evidence: ${criterion.evidenceIds.join(", ")}`,
      ""
    );
  }
  lines.push("Completion is bound to the listed evidence digests and verifier identities.", "");
  return lines.join("\n");
}

export function compileCertificate(input: {
  contract: unknown;
  audit: CompletionAudit;
  issuedAt?: Date;
}): CompletionCertificate {
  assertContract(input.contract);
  const contract = input.contract;
  if (input.audit.contractId !== contract.id) {
    throw new Error("Audit does not belong to this contract.");
  }
  const expectedAudit = auditCompletion(contract, new Date(input.audit.auditedAt));
  if (canonicalJson(expectedAudit) !== canonicalJson(input.audit)) {
    throw new Error("Audit payload does not match a fresh evaluation of this contract.");
  }
  if (input.audit.status === "blocked") {
    throw new Error("Cannot certify a blocked completion contract.");
  }
  const evidence = new Map(contract.evidence.map((entry) => [entry.id, entry]));
  const auditCriteria = new Map(
    input.audit.criteria.map((entry) => [entry.criterionId, entry])
  );
  const criteria = contract.criteria
    .filter((criterion) => auditCriteria.get(criterion.id)?.passed)
    .map((criterion) => {
      const evidenceIds = auditCriteria.get(criterion.id)!.evidenceIds;
      const receipts = evidenceIds.map((id) => evidence.get(id)!);
      return {
        criterionId: criterion.id,
        statement: criterion.statement,
        critical: criterion.critical,
        evidenceIds,
        evidenceDigests: [...new Set(receipts.map((entry) => entry.digest))],
        verifiers: [...new Set(receipts.map((entry) => entry.verifiedBy))],
      };
    });
  const baseWithoutContent = {
    certificateVersion: "1.0" as const,
    contractId: contract.id,
    contractHash: hashValue(contract),
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    status: input.audit.status === "ready" ? "certified" as const : "provisional" as const,
    criteria,
  };
  const content = render(contract, baseWithoutContent);
  const base = { ...baseWithoutContent, content };
  return { ...base, certificateHash: sha256(canonicalJson(base)) };
}
