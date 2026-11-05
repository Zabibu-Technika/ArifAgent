// Render a representative frame to Markdown so the layout can be reviewed without a TTY.
// This is the real renderer, not a mock-up: the same `renderScreen` the dashboard uses.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARIF_AGENT_ROOT, emptySnapshot, renderScreen } from "../cli/tui.ts";

const WORKSPACE = "D:\\Projects\\Arif Agent";

const snapshot = emptySnapshot(WORKSPACE);
snapshot.queue = [
  { id: "mw2jl0jg", platform: "x", text: "Undo shipped today: every change leaves a receipt.", scheduledFor: null, createdAt: "2026-11-04T21:10:00Z" },
  { id: "mw2jl39w", platform: "linkedin", text: "Why we verify before we say done.", scheduledFor: null, createdAt: "2026-11-04T21:12:00Z" },
  { id: "mw2jl4aa", platform: "whatsapp", text: "Team update: invoices now draft in cents.", scheduledFor: null, createdAt: "2026-11-04T21:15:00Z" },
];
snapshot.published = 4;
snapshot.invoices = [
  { name: "invoice-acme-ltd-20261104T211201123-a1b2.md", bytes: 812, modified: Date.now() },
  { name: "invoice-zola-20261104T203344901-c3d4.md", bytes: 744, modified: Date.now() - 3_600_000 },
];
snapshot.receipts = [
  {
    id: "20261104T211600123-ab12",
    at: "2026-11-04T21:16:00.123Z",
    workspace: WORKSPACE,
    status: "proved",
    checks: [{ name: "test", command: "npm test", ok: true, code: 0, ms: 1_240, timedOut: false, outputDigest: "a".repeat(64), outputBytes: 2_048 }],
    skipped: [],
    selfAuthored: false,
    touched: ["src/app.ts"],
    notes: [],
  },
  {
    id: "20261104T210200456-cd34",
    at: "2026-11-04T21:02:00.456Z",
    workspace: WORKSPACE,
    status: "partial",
    checks: [{ name: "test", command: "npm test", ok: true, code: 0, ms: 980, timedOut: false, outputDigest: "b".repeat(64), outputBytes: 1_024 }],
    skipped: [],
    selfAuthored: true,
    touched: ["src/app.test.ts"],
    notes: ["This turn changed a test, a test config, or a check command."],
  },
];
snapshot.decisions = [
  { id: "1", at: "2026-11-04T20:00:00Z", kind: "choice", title: "Use content-addressed checkpoints", rationale: "git init is 2.3s here", alternatives: [], constraints: ["no git dependency"], tags: ["storage"], source: "user" },
  { id: "2", at: "2026-11-04T20:05:00Z", kind: "rejection", title: "No shadow git", rationale: "per-call snapshots would be disabled within a day", alternatives: [], constraints: [], tags: [], source: "user" },
  { id: "3", at: "2026-11-04T20:10:00Z", kind: "constraint", title: "Integer cents for money", rationale: "float rounding is a fraud allegation waiting to happen", alternatives: [], constraints: ["never float money"], tags: ["bizops"], source: "user" },
];

const base = {
  page: 0,
  cursor: 0,
  input: "",
  cursorPos: 0,
  commandMode: false,
  busy: null,
  toast: null,
  log: [],
  snapshot,
  spinner: 0,
  help: false,
};

const integrations = [
  {
    integration: {
      id: "github",
      label: "GitHub",
      binary: "gh",
      available: async () => true,
      accounts: async () => [],
      switchTo: async () => ({ ok: true, message: "" }),
    },
    accounts: [
      { id: "github.com#teh317", label: "teh317", host: "github.com", active: true },
      { id: "github.com#zabibu-ops", label: "zabibu-ops", host: "github.com", active: false },
    ],
    selected: "github.com#teh317",
  },
  {
    integration: {
      id: "vercel",
      label: "Vercel",
      binary: "vercel",
      available: async () => true,
      accounts: async () => [],
      switchTo: async () => ({ ok: true, message: "" }),
    },
    accounts: [
      { id: "acme", label: "Acme", active: false },
      { id: "personal", label: "personal", active: true },
    ],
    selected: "acme",
  },
];

const strip = (line) => line.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

function screen(overrides) {
  return renderScreen({ ...base, ...overrides }, 100, 30).map(strip).join("\n");
}

const doc = `# Arif Agent dashboard

The TUI is the default interface: \`arif-agent\` with no arguments opens it. It is rendered by
the same pure function the tests exercise, so what you see here is the layout the
terminal gets — not a mock-up.

## Overview

\`\`\`text
${screen({ page: 0 })}
\`\`\`

## Growth, with the second queued post selected

\`\`\`text
${screen({ page: 1, cursor: 1 })}
\`\`\`

## Proof

\`\`\`text
${screen({ page: 3, cursor: 0 })}
\`\`\`

## Accounts — GitHub and Vercel

\`\`\`text
${screen({ page: 5, integrations })}
\`\`\`

## Command palette

\`\`\`text
${screen({ page: 5, integrations, palette: { query: "inv", index: 0 } })}
\`\`\`

## Commands

| Command | What it does |
| --- | --- |
| \`/queue <platform> :: <text>\` | Add to the local queue. Does not publish. |
| \`/invoice <client> :: <desc> :: <qty> :: <price> [:: <currency>]\` | Draft an invoice in integer cents. |
| \`/analytics <file.csv> [:: <metric>]\` | Summarise a CSV export. |
| \`/verify\` | Run the project's checks and write a receipt. |
| \`/decision <kind> :: <title> :: <why>\` | Record a decision. |
| \`/sync\` | Check the inherited core is current. |
| \`/refresh\` | Reload the snapshot. |
| \`:\` | Open the command palette; type to filter. |
| \`accounts\` page | Switch the active GitHub or Vercel account, with confirmation. |

Every command is also a CLI verb, e.g. \`arif-agent queue x :: "hello"\`, and both go through
the same parser.
`;

mkdirSync(join(ARIF_AGENT_ROOT, "docs"), { recursive: true });
writeFileSync(join(ARIF_AGENT_ROOT, "docs", "tui.md"), doc, "utf8");
console.log("wrote docs/tui.md");
