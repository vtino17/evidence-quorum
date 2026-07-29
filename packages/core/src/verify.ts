import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import type {
  CertificateVerification,
  CompletionCertificate,
  CompletionContract,
} from "./types.js";
import { assertContract } from "./validation.js";

export function verifyCertificate(input: {
  certificate: CompletionCertificate;
  contract?: unknown;
}): CertificateVerification {
  const certificate = input.certificate;
  const base = {
    certificateVersion: certificate.certificateVersion,
    contractId: certificate.contractId,
    contractHash: certificate.contractHash,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    criteria: certificate.criteria,
    content: certificate.content,
  };
  const evidenceIds = certificate.criteria.flatMap(
    (criterion) => criterion.evidenceIds
  );
  const checks = {
    certificateHash:
      sha256(canonicalJson(base)) === certificate.certificateHash,
    contractHash: true,
    uniqueEvidence: new Set(evidenceIds).size === evidenceIds.length,
    criterionCoverage: certificate.criteria.length > 0,
  };
  if (input.contract !== undefined) {
    assertContract(input.contract);
    const contract = input.contract as CompletionContract;
    checks.contractHash = hashValue(contract) === certificate.contractHash;
    const certified = new Set(
      certificate.criteria.map((criterion) => criterion.criterionId)
    );
    checks.criterionCoverage = contract.criteria
      .filter((criterion) => criterion.critical)
      .every((criterion) => certified.has(criterion.id));
  }
  const errors = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `${name} check failed`);
  return { valid: errors.length === 0, checks, errors };
}
