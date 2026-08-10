import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import { auditCompletion } from "./audit.js";
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
    criterionBindings: true,
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
    const issuedAt = Date.parse(certificate.issuedAt);
    if (!Number.isFinite(issuedAt)) {
      checks.criterionBindings = false;
    } else {
      const audit = auditCompletion(contract, new Date(issuedAt));
      const expected = new Map(
        audit.criteria
          .filter((criterion) => criterion.passed)
          .map((criterion) => [criterion.criterionId, criterion])
      );
      const criteria = new Map(contract.criteria.map((criterion) => [criterion.id, criterion]));
      const evidence = new Map(contract.evidence.map((receipt) => [receipt.id, receipt]));
      checks.criterionBindings =
        expected.size === certificate.criteria.length &&
        new Set(certificate.criteria.map((criterion) => criterion.criterionId)).size === certificate.criteria.length &&
        certificate.criteria.every((certifiedCriterion) => {
          const expectedAudit = expected.get(certifiedCriterion.criterionId);
          const expectedCriterion = criteria.get(certifiedCriterion.criterionId);
          if (!expectedAudit || !expectedCriterion) return false;
          const expectedIds = [...expectedAudit.evidenceIds].sort();
          const actualIds = [...certifiedCriterion.evidenceIds].sort();
          if (canonicalJson(expectedIds) !== canonicalJson(actualIds)) return false;
          const receipts = actualIds.map((id) => evidence.get(id));
          if (receipts.some((receipt) => !receipt)) return false;
          const digests = [...new Set(receipts.map((receipt) => receipt!.digest))].sort();
          const verifiers = [...new Set(receipts.map((receipt) => receipt!.verifiedBy))].sort();
          return certifiedCriterion.statement === expectedCriterion.statement &&
            certifiedCriterion.critical === expectedCriterion.critical &&
            canonicalJson([...certifiedCriterion.evidenceDigests].sort()) === canonicalJson(digests) &&
            canonicalJson([...certifiedCriterion.verifiers].sort()) === canonicalJson(verifiers);
        });
    }
  }
  const errors = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `${name} check failed`);
  return { valid: errors.length === 0, checks, errors };
}
