# Quorum semantics

EvidenceQuorum uses a policy quorum, not a distributed consensus algorithm. It answers whether the submitted receipts satisfy an acceptance contract at one audit time.

For a receipt to count, it must:

1. reference a declared criterion and actors;
2. contain a SHA-256-shaped digest;
3. fall within the criterion freshness window;
4. use an independent verifier when required;
5. report a passing outcome.

The criterion then evaluates the set of accepted passing receipts. It requires:

- at least `minPassing` distinct verifier identities;
- every declared evidence type;
- every declared tag;
- a `negative` tag when negative-path proof is required;
- no accepted, fresh failure.

After per-criterion evaluation, the global anti-reuse rule blocks a digest that appears under more than one criterion. This prevents one underlying artifact from silently satisfying unrelated requirements.

## What quorum does not mean

Distinct IDs are not automatically distinct organizations or trust domains. Production adapters should authenticate identities and record their provenance. A malicious verifier majority can still certify a lie. Quorum reduces single-actor authority; it does not eliminate the need to choose trustworthy verifiers.
