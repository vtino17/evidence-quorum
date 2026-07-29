import { canonicalJson } from "./canonical.js";
import type {
  AcceptanceCriterion,
  ContractDiff,
} from "./types.js";
import { assertContract } from "./validation.js";

export function diffContracts(fromValue: unknown, toValue: unknown): ContractDiff {
  assertContract(fromValue);
  assertContract(toValue);
  const from = fromValue;
  const to = toValue;
  const oldCriteria = new Map(from.criteria.map((entry) => [entry.id, entry]));
  const newCriteria = new Map(to.criteria.map((entry) => [entry.id, entry]));
  const addedCriteria = [...newCriteria.keys()].filter((id) => !oldCriteria.has(id)).sort();
  const removedCriteria = [...oldCriteria.keys()].filter((id) => !newCriteria.has(id)).sort();
  const modifiedCriteria = [...oldCriteria.keys()]
    .filter(
      (id) =>
        newCriteria.has(id) &&
        canonicalJson(oldCriteria.get(id)) !== canonicalJson(newCriteria.get(id))
    )
    .sort();
  const weakenedRequirements = removedCriteria.map(
    (id) => `Acceptance criterion "${id}" was removed.`
  );
  for (const id of modifiedCriteria) {
    const previous = oldCriteria.get(id) as AcceptanceCriterion;
    const next = newCriteria.get(id) as AcceptanceCriterion;
    if (previous.critical && !next.critical) {
      weakenedRequirements.push(`Criterion "${id}" is no longer critical.`);
    }
    if (next.minPassing < previous.minPassing) {
      weakenedRequirements.push(`Criterion "${id}" quorum decreased from ${previous.minPassing} to ${next.minPassing}.`);
    }
    if (next.maxAgeMinutes > previous.maxAgeMinutes) {
      weakenedRequirements.push(`Criterion "${id}" freshness window increased from ${previous.maxAgeMinutes} to ${next.maxAgeMinutes} minutes.`);
    }
    if (previous.independentVerifier && !next.independentVerifier) {
      weakenedRequirements.push(`Criterion "${id}" no longer requires an independent verifier.`);
    }
    const removedTypes = previous.requiredEvidenceTypes.filter(
      (type) => !next.requiredEvidenceTypes.includes(type)
    );
    if (removedTypes.length > 0) {
      weakenedRequirements.push(`Criterion "${id}" dropped evidence types: ${removedTypes.join(", ")}.`);
    }
    if (previous.negativeTestRequired && !next.negativeTestRequired) {
      weakenedRequirements.push(`Criterion "${id}" no longer requires a negative test.`);
    }
  }
  return {
    from: from.id,
    to: to.id,
    addedCriteria,
    removedCriteria,
    modifiedCriteria,
    weakenedRequirements,
  };
}
