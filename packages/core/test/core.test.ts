import { describe, expect, it } from "vitest";
import {
  auditCompletion,
  compileCertificate,
  diffContracts,
  hashValue,
  sampleContract,
  sha256,
  validateContract,
  verifyCertificate,
} from "../src/index.js";
import type { CompletionContract } from "../src/index.js";

const auditAt = new Date("2026-07-29T04:30:00.000Z");
const copy = (): CompletionContract => structuredClone(sampleContract);

describe("canonical hashing", () => {
  it("implements the SHA-256 known vector", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("hashes object keys independently of insertion order", () => {
    expect(hashValue({ alpha: 1, beta: 2 })).toBe(
      hashValue({ beta: 2, alpha: 1 })
    );
  });
});

describe("completion auditing", () => {
  it("accepts a fresh, independent, heterogeneous quorum", () => {
    const audit = auditCompletion(copy(), auditAt);
    expect(audit.status).toBe("ready");
    expect(audit.coveragePercent).toBe(100);
    expect(audit.criteria.map((entry) => entry.distinctVerifiers)).toEqual([
      2, 2, 1,
    ]);
  });

  it("blocks self-verification for critical criteria", () => {
    const contract = copy();
    contract.evidence[0]!.verifiedBy = contract.executor;
    const audit = auditCompletion(contract, auditAt);
    expect(audit.status).toBe("blocked");
    expect(audit.issues.some((entry) => entry.code === "self-verification")).toBe(
      true
    );
  });

  it("blocks stale critical evidence", () => {
    const contract = copy();
    contract.evidence[0]!.capturedAt = "2026-07-29T01:00:00.000Z";
    const audit = auditCompletion(contract, auditAt);
    expect(audit.status).toBe("blocked");
    expect(audit.issues.some((entry) => entry.code === "stale-evidence")).toBe(
      true
    );
  });

  it("blocks evidence reused across acceptance criteria", () => {
    const contract = copy();
    contract.evidence[2]!.digest = contract.evidence[0]!.digest;
    const audit = auditCompletion(contract, auditAt);
    expect(audit.status).toBe("blocked");
    expect(
      audit.issues.some(
        (entry) => entry.code === "cross-criterion-evidence-reuse"
      )
    ).toBe(true);
  });

  it("blocks a current contradictory failure", () => {
    const contract = copy();
    contract.evidence[0]!.outcome = "fail";
    const audit = auditCompletion(contract, auditAt);
    expect(audit.issues.some((entry) => entry.code === "contradictory-failure")).toBe(
      true
    );
  });

  it("requires negative-path evidence when declared", () => {
    const contract = copy();
    contract.evidence[0]!.tags = ["commit:v42"];
    const audit = auditCompletion(contract, auditAt);
    expect(audit.issues.some((entry) => entry.code === "missing-negative-test")).toBe(
      true
    );
  });
});

describe("completion certificates", () => {
  it("compiles and verifies a certificate bound to its contract", () => {
    const contract = copy();
    const audit = auditCompletion(contract, auditAt);
    const certificate = compileCertificate({
      contract,
      audit,
      issuedAt: auditAt,
    });
    const verification = verifyCertificate({ certificate, contract });
    expect(certificate.status).toBe("certified");
    expect(verification.valid).toBe(true);
  });

  it("detects certificate tampering", () => {
    const contract = copy();
    const audit = auditCompletion(contract, auditAt);
    const certificate = compileCertificate({ contract, audit, issuedAt: auditAt });
    certificate.content += "\nTampered";
    expect(verifyCertificate({ certificate, contract }).valid).toBe(false);
  });

  it("refuses to certify a blocked audit", () => {
    const contract = copy();
    contract.evidence = [];
    const audit = auditCompletion(contract, auditAt);
    expect(() => compileCertificate({ contract, audit })).toThrow(
      "Cannot certify"
    );
  });

  it("refuses a forged ready audit", () => {
    const contract = copy();
    contract.evidence = [];
    const audit = auditCompletion(contract, auditAt);
    audit.status = "ready";
    expect(() => compileCertificate({ contract, audit })).toThrow(
      "does not match"
    );
  });
});

describe("contract regression", () => {
  it("reports weakened controls", () => {
    const previous = copy();
    const next = copy();
    const criterion = next.criteria[0]!;
    criterion.critical = false;
    criterion.minPassing = 1;
    criterion.maxAgeMinutes = 120;
    criterion.independentVerifier = false;
    criterion.requiredEvidenceTypes = ["test"];
    criterion.negativeTestRequired = false;
    const diff = diffContracts(previous, next);
    expect(diff.weakenedRequirements).toHaveLength(6);
  });
});

describe("contract validation", () => {
  it("rejects undeclared executors and duplicate IDs", () => {
    const contract = copy();
    contract.executor = "missing-agent";
    contract.actors.push(contract.actors[0]!);
    const issues = validateContract(contract);
    expect(issues.map((entry) => entry.path)).toContain("executor");
    expect(issues.some((entry) => entry.message.includes("unique"))).toBe(true);
  });
});
