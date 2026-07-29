#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  auditCompletion,
  compileCertificate,
  diffContracts,
  sampleContract,
  verifyCertificate,
} from "@evidencequorum/core";
import type {
  CompletionCertificate,
  CompletionContract,
} from "@evidencequorum/core";
import { formatAudit, formatCriterion, formatDiff } from "./format.js";

const help = `EvidenceQuorum — independent completion evidence compiler

Usage:
  evidence-quorum audit <contract.json> [--at <ISO date>] [--json]
  evidence-quorum explain <contract.json> --criterion <id> [--at <ISO date>]
  evidence-quorum certify <contract.json> --output <completion.md> --receipt <certificate.json> [--at <ISO date>]
  evidence-quorum verify <certificate.json> [--contract <contract.json>]
  evidence-quorum diff <previous.json> <next.json> [--json]
  evidence-quorum init [path]

Exit codes: 0 ready/valid, 2 blocked, 3 warning, 4 weakened contract, 5 invalid input.`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(path), "utf8")) as unknown;

const auditDate = (args: string[]): Date => {
  const value = option(args, "--at");
  if (!value) return new Date();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid --at date: ${value}`);
  return date;
};

const outputJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

async function run(args: string[]): Promise<number> {
  const [command, first, second] = args;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(help);
    return 0;
  }
  if (command === "init") {
    const path = resolve(first ?? "evidence-quorum.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(sampleContract, null, 2)}\n`, "utf8");
    console.log(`Created ${path}`);
    return 0;
  }
  if (command === "audit" || command === "explain" || command === "certify") {
    if (!first || first.startsWith("--")) throw new Error(`${command} requires a contract path.`);
    const contract = await readJson(first);
    const audit = auditCompletion(contract, auditDate(args));
    if (command === "audit") {
      if (args.includes("--json")) outputJson(audit);
      else console.log(formatAudit(audit));
    }
    if (command === "explain") {
      const criterionId = option(args, "--criterion");
      if (!criterionId) throw new Error("explain requires --criterion <id>.");
      const criterion = audit.criteria.find((entry) => entry.criterionId === criterionId);
      if (!criterion) throw new Error(`Unknown criterion: ${criterionId}`);
      console.log(formatCriterion(criterion));
    }
    if (command === "certify") {
      const outputPath = option(args, "--output");
      const receiptPath = option(args, "--receipt");
      if (!outputPath || !receiptPath) {
        throw new Error("certify requires --output <markdown> and --receipt <json>.");
      }
      const certificate = compileCertificate({
        contract,
        audit,
        issuedAt: auditDate(args),
      });
      await mkdir(dirname(resolve(outputPath)), { recursive: true });
      await mkdir(dirname(resolve(receiptPath)), { recursive: true });
      await writeFile(resolve(outputPath), certificate.content, "utf8");
      await writeFile(resolve(receiptPath), `${JSON.stringify(certificate, null, 2)}\n`, "utf8");
      console.log(`Certificate: ${resolve(outputPath)}`);
      console.log(`Receipt: ${resolve(receiptPath)}`);
    }
    return audit.status === "ready" ? 0 : audit.status === "blocked" ? 2 : 3;
  }
  if (command === "verify") {
    if (!first || first.startsWith("--")) throw new Error("verify requires a certificate path.");
    const certificate = (await readJson(first)) as CompletionCertificate;
    const contractPath = option(args, "--contract");
    const contract = contractPath ? await readJson(contractPath) : undefined;
    const result = verifyCertificate({ certificate, contract });
    outputJson(result);
    return result.valid ? 0 : 2;
  }
  if (command === "diff") {
    if (!first || !second || second.startsWith("--")) {
      throw new Error("diff requires previous and next contract paths.");
    }
    const diff = diffContracts(await readJson(first), await readJson(second));
    if (args.includes("--json")) outputJson(diff);
    else console.log(formatDiff(diff));
    return diff.weakenedRequirements.length === 0 ? 0 : 4;
  }
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`EvidenceQuorum error: ${message}`);
    process.exitCode = 5;
  });

export type { CompletionContract };
