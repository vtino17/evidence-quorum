# Integration guide

EvidenceQuorum sits after evidence-producing systems and before an agent or pipeline declares completion.

## CI gate

Use a stable audit timestamp supplied by the run and preserve the approved contract baseline:

```yaml
- name: Audit completion evidence
  run: |
    pnpm quorum audit evidence/completion.json --at "$RUN_TIMESTAMP"
    pnpm quorum diff evidence/baseline.json evidence/completion.json
    pnpm quorum certify evidence/completion.json \
      --at "$RUN_TIMESTAMP" \
      --output artifacts/completion.md \
      --receipt artifacts/certificate.json
```

If `audit` exits `2`, route its criterion-specific gaps back to the executor. If `diff` exits `4`, require an explicit review of the weakened controls.

## Receipt adapters

An adapter should:

1. identify the exact external run or artifact in `artifactRef`;
2. hash immutable content rather than a mutable URL;
3. assign `producedBy` and `verifiedBy` from authenticated identities;
4. use a timestamp from a trusted system;
5. attach narrow tags such as commit, environment, and negative-path coverage.

Good sources include CI test reports, deployment observations, signed human reviews, synthetic monitoring results, and immutable build manifests.

## Agent loop

An agent can use `audit --json` to receive a machine-readable list of gaps. It should acquire new evidence or repair the underlying work; it should not lower quorum, widen freshness, or remove criteria. Protect the baseline with code review and run `diff` before certificate generation.
