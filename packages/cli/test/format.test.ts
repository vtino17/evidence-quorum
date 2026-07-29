import { describe, expect, it } from "vitest";
import { auditCompletion, diffContracts, sampleContract } from "@evidencequorum/core";
import { formatAudit, formatDiff } from "../src/format.js";

describe("CLI formatting", () => {
  it("renders a scannable audit summary", () => {
    const audit = auditCompletion(
      sampleContract,
      new Date("2026-07-29T04:30:00.000Z")
    );
    expect(formatAudit(audit)).toContain("Status: READY");
    expect(formatAudit(audit)).toContain("2/2 verifiers");
  });

  it("renders contract weakening signals", () => {
    const next = structuredClone(sampleContract);
    next.criteria[0]!.minPassing = 1;
    expect(formatDiff(diffContracts(sampleContract, next))).toContain(
      "quorum decreased"
    );
  });
});
