import {
  auditCompletion,
  compileCertificate,
  sampleContract,
} from "@evidencequorum/core";
import type {
  CompletionAudit,
  CompletionContract,
  CriterionAudit,
} from "@evidencequorum/core";
import "./styles.css";

const applicationRoot = document.querySelector<HTMLDivElement>("#app");
if (!applicationRoot) throw new Error("Application root was not found.");
const app: HTMLDivElement = applicationRoot;

const currentSample = (): CompletionContract => {
  const value = structuredClone(sampleContract);
  const offsets = [18, 11, 8, 5, 35];
  value.evidence.forEach((receipt, index) => {
    receipt.capturedAt = new Date(
      Date.now() - (offsets[index] ?? 5) * 60_000
    ).toISOString();
  });
  return value;
};

let contract: CompletionContract = currentSample();
let audit: CompletionAudit = auditCompletion(contract);
let selectedCriterion = contract.criteria[0]!.id;

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!
  );

const issueMarkup = (criterion: CriterionAudit): string =>
  criterion.issues.length === 0
    ? `<p class="quiet">Every declared control is satisfied.</p>`
    : criterion.issues
        .map(
          (issue) =>
            `<div class="issue"><span>${escape(issue.severity)}</span><p><b>${escape(issue.code)}</b><br>${escape(issue.message)}</p></div>`
        )
        .join("");

function render(): void {
  const selected =
    audit.criteria.find((entry) => entry.criterionId === selectedCriterion) ??
    audit.criteria[0]!;
  const selectedContract = contract.criteria.find(
    (entry) => entry.id === selected.criterionId
  )!;
  const evidence = contract.evidence.filter(
    (entry) => entry.criterionId === selected.criterionId
  );
  const quorumDots = Array.from(
    { length: Math.max(selected.requiredQuorum, selected.distinctVerifiers) },
    (_, index) =>
      `<span class="quorum-dot ${index < selected.distinctVerifiers ? "filled" : ""}"></span>`
  ).join("");
  app.innerHTML = `
    <header>
      <a class="brand" href="#" aria-label="EvidenceQuorum home">
        <span class="brand-mark">EQ</span>
        <span>EvidenceQuorum <small>STUDIO</small></span>
      </a>
      <div class="header-meta"><span class="local-dot"></span> Local-only analysis</div>
      <a class="github-link" href="https://github.com/vtino17/evidence-quorum">GitHub ↗</a>
    </header>
    <main>
      <section class="intro">
        <div>
          <p class="eyebrow">Completion is a claim. Require a quorum.</p>
          <h1>Know when an agent is <em>actually</em> done.</h1>
          <p class="lede">Audit fresh, independent evidence against explicit acceptance criteria—then compile a tamper-evident completion certificate.</p>
        </div>
        <div class="status-orbit status-${audit.status}">
          <span>${audit.score}</span>
          <small>${audit.status.toUpperCase()}</small>
        </div>
      </section>
      <section class="stats">
        <article><strong>${audit.coveragePercent}%</strong><span>criterion coverage</span></article>
        <article><strong>${audit.passedCriteria}/${audit.criteria.length}</strong><span>criteria satisfied</span></article>
        <article><strong>${contract.evidence.length}</strong><span>evidence receipts</span></article>
        <article><strong>${new Set(contract.evidence.map((entry) => entry.verifiedBy)).size}</strong><span>distinct verifiers</span></article>
      </section>
      <section class="workspace">
        <div class="panel contract-panel">
          <div class="panel-title">
            <div><span class="index">01</span><h2>Completion contract</h2></div>
            <button id="reset" class="button ghost">Reset demo</button>
          </div>
          <textarea id="editor" spellcheck="false" aria-label="Completion contract JSON">${escape(JSON.stringify(contract, null, 2))}</textarea>
          <div id="editor-error" class="editor-error" aria-live="polite"></div>
          <div class="editor-footer">
            <span>JSON · schema 1.0</span>
            <button id="audit" class="button primary">Run audit <b>⌘↵</b></button>
          </div>
        </div>
        <div class="panel result-panel">
          <div class="panel-title">
            <div><span class="index">02</span><h2>Quorum audit</h2></div>
            <span class="status-pill ${audit.status}">${audit.status}</span>
          </div>
          <div class="criteria-list">
            ${audit.criteria
              .map((entry) => {
                const criterion = contract.criteria.find(
                  (candidate) => candidate.id === entry.criterionId
                )!;
                return `<button class="criterion ${entry.criterionId === selected.criterionId ? "selected" : ""}" data-criterion="${escape(entry.criterionId)}">
                  <span class="result-icon">${entry.passed ? "✓" : "!"}</span>
                  <span><b>${escape(entry.criterionId)}</b><small>${escape(criterion.statement)}</small></span>
                  <span class="mini-quorum">${entry.distinctVerifiers}/${entry.requiredQuorum}</span>
                </button>`;
              })
              .join("")}
          </div>
          <div class="explain">
            <p class="eyebrow">Selected criterion</p>
            <h3>${escape(selected.criterionId)}</h3>
            <p>${escape(selectedContract.statement)}</p>
            <div class="quorum-line">
              <div>${quorumDots}</div>
              <span>${selected.distinctVerifiers} independent verifiers / ${selected.requiredQuorum} required</span>
            </div>
            <div class="rules">
              <span>Fresh ≤ ${selectedContract.maxAgeMinutes}m</span>
              <span>${selectedContract.requiredEvidenceTypes.map(escape).join(" + ")}</span>
              ${selectedContract.negativeTestRequired ? "<span>negative path</span>" : ""}
            </div>
            <div class="issues">${issueMarkup(selected)}</div>
          </div>
          <div class="certificate-actions">
            <button id="download" class="button primary" ${audit.status === "blocked" ? "disabled" : ""}>Download certificate</button>
            <span>SHA-256 bound · independently verifiable</span>
          </div>
        </div>
      </section>
      <section class="evidence-section">
        <div class="section-heading">
          <div><span class="index">03</span><h2>Evidence ledger</h2></div>
          <p>Receipts for <b>${escape(selected.criterionId)}</b></p>
        </div>
        <div class="ledger">
          ${evidence
            .map((entry) => {
              const evidenceAudit = audit.evidence.find(
                (candidate) => candidate.evidenceId === entry.id
              )!;
              return `<article>
                <span class="evidence-type">${escape(entry.type)}</span>
                <div><h3>${escape(entry.id)}</h3><p>${escape(entry.details)}</p></div>
                <div class="receipt-meta"><span>verified by <b>${escape(entry.verifiedBy)}</b></span><code>${entry.digest.slice(0, 12)}…</code></div>
                <span class="receipt-status ${evidenceAudit.valid ? "valid" : "invalid"}">${evidenceAudit.valid ? "VALID" : "REJECTED"}</span>
              </article>`;
            })
            .join("")}
        </div>
      </section>
    </main>
    <footer><span>EvidenceQuorum v0.1</span><span>Your contract never leaves this browser.</span></footer>
  `;
  bind();
}

function runAudit(): void {
  const editor = document.querySelector<HTMLTextAreaElement>("#editor")!;
  const error = document.querySelector<HTMLDivElement>("#editor-error")!;
  try {
    contract = JSON.parse(editor.value) as CompletionContract;
    audit = auditCompletion(contract);
    if (!contract.criteria.some((entry) => entry.id === selectedCriterion)) {
      selectedCriterion = contract.criteria[0]!.id;
    }
    render();
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
  }
}

function downloadCertificate(): void {
  const certificate = compileCertificate({
    contract,
    audit,
    issuedAt: new Date(),
  });
  const blob = new Blob([JSON.stringify(certificate, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${contract.id}.certificate.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function bind(): void {
  document.querySelector("#audit")?.addEventListener("click", runAudit);
  document.querySelector("#reset")?.addEventListener("click", () => {
    contract = currentSample();
    selectedCriterion = contract.criteria[0]!.id;
    audit = auditCompletion(contract);
    render();
  });
  document.querySelector("#download")?.addEventListener("click", downloadCertificate);
  document.querySelectorAll<HTMLButtonElement>("[data-criterion]").forEach((button) =>
    button.addEventListener("click", () => {
      selectedCriterion = button.dataset.criterion!;
      render();
    })
  );
  document.querySelector("#editor")?.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runAudit();
    }
  });
}

render();
