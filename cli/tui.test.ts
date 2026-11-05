// The dashboard's contract.
//
// Rendering is pure, so the border guarantee can be tested without a terminal: every line
// has exactly the window's width. The command parser is tested through the real actions,
// because a parser that agrees with itself but not with the tool is not useful.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { displayWidth, stripAnsi } from "../core/tui/ansi.ts";
import { dispatch, emptySnapshot, filterPalette, renderScreen, type TuiState } from "./tui.ts";
import type { Snapshot } from "./data.ts";
import type { DetectedIntegration } from "../core/integrations/index.ts";

function state(overrides: Partial<TuiState> = {}): TuiState {
  return {
    page: 0,
    cursor: 0,
    input: "",
    cursorPos: 0,
    commandMode: false,
    busy: null,
    toast: null,
    log: [],
    snapshot: emptySnapshot("C:\\ws"),
    spinner: 0,
    help: false,
    ...overrides,
  };
}

function withQueue(): Snapshot {
  const snapshot = emptySnapshot("C:\\ws");
  snapshot.queue = [
    { id: "a", platform: "x", text: "first post", scheduledFor: null, createdAt: "" },
    { id: "b", platform: "linkedin", text: "second post", scheduledFor: null, createdAt: "" },
    { id: "c", platform: "whatsapp", text: "third post", scheduledFor: null, createdAt: "" },
  ];
  return snapshot;
}

function githubFixture(): DetectedIntegration {
  return {
    integration: {
      id: "github",
      label: "GitHub",
      binary: "gh",
      available: async () => true,
      accounts: async () => [],
      switchTo: async () => ({ ok: true, message: "switched" }),
    },
    accounts: [
      { id: "github.com#alice", label: "alice", host: "github.com", active: true },
      { id: "github.com#bob", label: "bob", host: "github.com", active: false },
    ],
    selected: null,
  };
}

async function withWorkspace(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "arif-agent-tui-"));
  try {
    await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("every dashboard line is exactly the window width", () => {
  const cols = 100;
  const rows = 30;
  const lines = renderScreen(state({ snapshot: withQueue(), page: 1 }), cols, rows);

  assert.equal(lines.length, rows);
  for (const [index, line] of lines.entries()) {
    assert.equal(displayWidth(line), cols, `line ${index} is ${displayWidth(line)} cells`);
  }
  assert.match(stripAnsi(lines[0] ?? ""), /Arif Agent/);
  assert.match(lines.at(-1) ?? "", /quit/);
});

test("the rail marks the selected axis", () => {
  const lines = renderScreen(state({ page: 2 }), 100, 30).join("\n");
  assert.match(lines, /▸ bizops/);
  assert.match(lines, /  growth/);
});

test("selection follows the cursor, not the row number", () => {
  const lines = renderScreen(state({ page: 1, cursor: 1, snapshot: withQueue() }), 100, 30);
  const second = lines.find((line) => line.includes("second post"));
  assert.ok(second !== undefined, "the second item should be visible");
  assert.match(second, /▸/);
  assert.match(second, /\u001b\[7m/, "the selected row should be reversed");
});

test("an empty axis explains how to fill it", () => {
  const lines = renderScreen(state({ page: 1 }), 100, 30).join("\n");
  assert.match(lines, /Nothing queued/);
  assert.match(lines, /\/queue/);
});

test("help replaces the pane and lists the commands", () => {
  const lines = renderScreen(state({ help: true }), 100, 30).join("\n");
  assert.match(lines, /\/verify/);
  assert.match(lines, /\/decision/);
});

test("the command parser is shared with the TUI", async () => {
  assert.equal((await dispatch("C:\\ws", "help")).kind, "help");
  assert.equal((await dispatch("C:\\ws", "quit")).kind, "quit");

  const unknown = await dispatch("C:\\ws", "nonsense");
  assert.equal(unknown.kind, "result");
  if (unknown.kind === "result") assert.equal(unknown.result.ok, false);
});

test("a queued post is written locally", async () => {
  await withWorkspace(async (dir) => {
    const result = await dispatch(dir, "queue x :: hello from the dashboard");
    assert.equal(result.kind, "result");
    if (result.kind !== "result") return;
    assert.equal(result.result.ok, true, result.result.message);

    const queue = await readFile(join(dir, ".arif-agent", "queue.jsonl"), "utf8");
    assert.match(queue, /hello from the dashboard/);
  });
});

test("an invoice is drafted with the parsed numbers", async () => {
  await withWorkspace(async (dir) => {
    const result = await dispatch(dir, "invoice Acme :: consulting :: 2 :: 150 :: KES");
    assert.equal(result.kind, "result");
    if (result.kind !== "result") return;
    assert.equal(result.result.ok, true, result.result.message);

    const files = await readdir(join(dir, "invoices"));
    assert.equal(files.length, 1);
    const body = await readFile(join(dir, "invoices", files[0] ?? ""), "utf8");
    assert.match(body, /\*\*Total: KES 300\.00\*\*/);
  });
});

test("analytics runs against a real CSV", async () => {
  await withWorkspace(async (dir) => {
    await writeFile(join(dir, "sales.csv"), "rep,revenue\nA,100\nB,200\n", "utf8");
    const result = await dispatch(dir, "analytics sales.csv :: revenue");
    assert.equal(result.kind, "result");
    if (result.kind !== "result") return;
    assert.equal(result.result.ok, true, result.result.message);
    assert.match(result.result.message, /Analytics/);
  });
});

test("a decision records its reason", async () => {
  await withWorkspace(async (dir) => {
    const result = await dispatch(dir, "decision choice :: Use checkpoints :: git is slow here");
    assert.equal(result.kind, "result");
    if (result.kind !== "result") return;
    assert.equal(result.result.ok, true, result.result.message);

    const ledger = await readFile(join(dir, ".weaver", "decisions.jsonl"), "utf8");
    assert.match(ledger, /git is slow here/);
  });
});

// --- Accounts and the overlay ------------------------------------------------

test("the overview names the active account", () => {
  const text = renderScreen(state({ integrations: [githubFixture()] }), 100, 30).join("\n");
  assert.match(text, /GitHub: alice/);
});

test("the accounts page lists each CLI and its accounts", () => {
  const lines = renderScreen(state({ page: 5, integrations: [githubFixture()] }), 100, 30);
  for (const line of lines) assert.equal(displayWidth(line), 100);
  const text = lines.join("\n");
  assert.match(text, /GitHub/);
  assert.match(text, /alice/);
  assert.match(text, /active/);
});

test("switching an account is a modal, not a silent change", () => {
  const github = githubFixture();
  const account = github.accounts[0];
  assert.ok(account !== undefined);
  const lines = renderScreen(
    state({ page: 5, integrations: [github], modal: { detected: github, account } }),
    100,
    30,
  );
  for (const line of lines) assert.equal(displayWidth(line), 100);
  const text = lines.join("\n");
  assert.match(text, /switch GitHub/);
  assert.match(text, /Use alice\?/);
  assert.match(text, /y switch/);
});

test("the command palette filters and sits on the overlay layer", () => {
  assert.equal(filterPalette("").length, 9);
  assert.ok(filterPalette("inv").some((command) => command.name === "invoice"));

  const lines = renderScreen(state({ page: 5, palette: { query: "inv", index: 0 } }), 100, 30);
  for (const line of lines) assert.equal(displayWidth(line), 100);
  const text = lines.join("\n");
  assert.match(text, /commands/);
  assert.match(text, /\/invoice/);
  assert.doesNotMatch(text, /\/queue/);
});
