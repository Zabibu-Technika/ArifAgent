// Arif Agent's dashboard.
//
// A terminal UI is a contract with the person watching it: every line is exactly the
// window's width, every key does something, and nothing scrolls the alternate screen. The
// rendering function is pure so the contract can be tested without a terminal; the
// plumbing around it is the part that cannot be.
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALT_OFF,
  ALT_ON,
  AMBER,
  BOLD,
  CYAN,
  DIM,
  GRAY,
  GREEN,
  HIDE_CURSOR,
  RED,
  RESET,
  REVERSE,
  SHOW_CURSOR,
  displayWidth,
  truncate,
} from "../core/tui/ansi.ts";
import { ESCAPE_TIMEOUT_MS, KeyParser, type Key } from "../core/tui/keys.ts";
import { encodeFrame } from "../core/tui/canvas.ts";
import { gradient } from "../core/tui/theme.ts";
import { overlay } from "../core/tui/overlay.ts";
import { fit, joinColumns, panel, splitWidth, type Row } from "../core/tui/box.ts";
import { loadSnapshot, type Snapshot } from "./data.ts";
import {
  activeAccount,
  detectIntegrations,
  switchAccount,
  type Account,
  type DetectedIntegration,
} from "../core/integrations/index.ts";
import {
  analytics,
  draftInvoice,
  lspAction,
  mcpAction,
  queuePost,
  remember,
  subagentAction,
  syncCheck,
  verify,
  type ActionResult,
} from "./actions.ts";
import type { DecisionKind } from "../core/memory/decisions.ts";

export const ARIF_AGENT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where global manifests and the workspace registry live. */
export function weaverHome(): string {
  const override = process.env.WEAVER_HOME;
  return override !== undefined && override.length > 0 ? resolve(override) : join(homedir(), ".weaver");
}

const MIN_COLS = 76;
const MIN_ROWS = 20;
const RAIL_WIDTH = 22;
const TICK_MS = 90;
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type PageId = "overview" | "growth" | "bizops" | "proof" | "memory" | "accounts";

interface Page {
  id: PageId;
  label: string;
  title: string;
}

const PAGES: Page[] = [
  { id: "overview", label: "overview", title: "overview" },
  { id: "growth", label: "growth", title: "growth · social and analytics" },
  { id: "bizops", label: "bizops", title: "bizops · invoices and CRM" },
  { id: "proof", label: "proof", title: "proof · receipts" },
  { id: "memory", label: "memory", title: "memory · decisions" },
  { id: "accounts", label: "accounts", title: "accounts · GitHub and Vercel" },
];

export interface ModalState {
  detected: DetectedIntegration;
  account: Account;
}

/** The palette is a menu, not a shell: it inserts a command or opens a page. */
export const PALETTE = [
  { name: "queue", hint: "add a post to the local queue" },
  { name: "invoice", hint: "draft an invoice in integer cents" },
  { name: "analytics", hint: "summarise a CSV export" },
  { name: "verify", hint: "run the checks and write a receipt" },
  { name: "decision", hint: "record a decision and its reason" },
  { name: "sync", hint: "check the inherited core is current" },
  { name: "refresh", hint: "reload the snapshot and accounts" },
  { name: "accounts", hint: "switch the GitHub or Vercel account" },
  { name: "help", hint: "show every command" },
] as const;

export function filterPalette(query: string): Array<(typeof PALETTE)[number]> {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...PALETTE];
  return PALETTE.filter(
    (command) => command.name.includes(needle) || command.hint.toLowerCase().includes(needle),
  );
}

export interface TuiState {
  page: number;
  cursor: number;
  input: string;
  cursorPos: number;
  commandMode: boolean;
  busy: string | null;
  toast: { text: string; ok: boolean; until: number } | null;
  log: string[];
  snapshot: Snapshot;
  spinner: number;
  help: boolean;
  /** Detected CLIs and their accounts. Optional so a render test can omit them. */
  integrations?: DetectedIntegration[];
  /** An open confirmation. The overlay layer renders it. */
  modal?: ModalState | null;
  /** The command palette, when `:` is pressed. */
  palette?: { query: string; index: number } | null;
}

export function emptySnapshot(workspace: string): Snapshot {
  return {
    workspace,
    queue: [],
    published: 0,
    invoices: [],
    receipts: [],
    decisions: [],
    errors: [],
    loadedAt: Date.now(),
  };
}

export function tuiSupported(): boolean {
  return (
    stdin.isTTY === true &&
    stdout.isTTY === true &&
    (stdout.columns ?? 0) >= MIN_COLS &&
    (stdout.rows ?? 0) >= MIN_ROWS
  );
}

// ------------------------------------------------------------------ commands

export type Dispatch =
  | { kind: "result"; result: ActionResult }
  | { kind: "refresh" }
  | { kind: "quit" }
  | { kind: "help" }
  | { kind: "none" };

const DECISION_KINDS: DecisionKind[] = ["choice", "rejection", "constraint", "assumption"];

/**
 * Parse and run one command line.
 *
 * `::` separates the head from its payloads, so a post can contain spaces without
 * quoting rules that a terminal will fight over.
 */
export async function dispatch(workspace: string, raw: string, arifAgentRoot = ARIF_AGENT_ROOT): Promise<Dispatch> {
  const text = raw.trim().replace(/^\/+/, "");
  if (text.length === 0) return { kind: "none" };

  const [head = "", ...payload] = text.split("::").map((part) => part.trim());
  const words = head.split(/\s+/).filter((word) => word.length > 0);
  const name = (words[0] ?? "").toLowerCase();

  switch (name) {
    case "help":
    case "?":
      return { kind: "help" };
    case "quit":
    case "exit":
    case "q":
      return { kind: "quit" };
    case "refresh":
    case "r":
      return { kind: "refresh" };

    case "queue": {
      const platform = words[1] ?? "";
      return { kind: "result", result: await queuePost(workspace, platform, payload[0] ?? "") };
    }

    case "invoice": {
      const client = words.slice(1).join(" ");
      const [description = "", quantity = "", price = "", currency] = payload;
      return {
        kind: "result",
        result: await draftInvoice(
          workspace,
          client,
          description,
          Number(quantity),
          Number(price),
          currency,
        ),
      };
    }

    case "analytics": {
      const path = words.slice(1).join(" ");
      return { kind: "result", result: await analytics(workspace, path, payload[0]) };
    }

    case "verify":
      return { kind: "result", result: await verify(workspace) };

    case "sync":
      return { kind: "result", result: await syncCheck(arifAgentRoot) };

    case "lsp":
      return { kind: "result", result: await lspAction(workspace, words.slice(1)) };

    case "mcp":
      return { kind: "result", result: await mcpAction(workspace, words.slice(1), payload[0]) };

    case "subagent": {
      const prompt = payload[0] ?? words.slice(1).join(" ");
      return { kind: "result", result: await subagentAction(workspace, prompt) };
    }

    case "decision": {
      const kind = (words[1] ?? "") as DecisionKind;
      if (!DECISION_KINDS.includes(kind)) {
        return {
          kind: "result",
          result: { ok: false, message: "usage: /decision <choice|rejection|constraint|assumption> :: <title> :: <why>" },
        };
      }
      return { kind: "result", result: await remember(workspace, kind, payload[0] ?? "", payload[1] ?? "") };
    }

    default:
      return { kind: "result", result: { ok: false, message: `unknown command /${name} — try /help` } };
  }
}

// ------------------------------------------------------------------ rendering

function headerLine(state: TuiState, cols: number): string {
  const left = `${BOLD}${gradient("Arif Agent")}${DIM} · multi-axis agent${RESET}`;
  const rightPlain =
    state.busy !== null
      ? `${SPINNER[state.spinner % SPINNER.length]} ${state.busy}`
      : truncate(state.snapshot.workspace, Math.max(0, cols - displayWidth(left) - 2));
  const right = `${GRAY}${rightPlain}${RESET}`;
  const gap = Math.max(1, cols - displayWidth(left) - displayWidth(rightPlain));
  return `${left}${" ".repeat(gap)}${right}`;
}

function commandLine(state: TuiState, cols: number): string {
  const room = Math.max(0, cols - 2);
  if (state.commandMode) {
    const withCursor = `${state.input.slice(0, state.cursorPos)}▏${state.input.slice(state.cursorPos)}`;
    return `${CYAN}›${RESET} ${fit(truncate(withCursor, room), room)}`;
  }
  if (state.toast !== null) {
    const style = state.toast.ok ? GREEN : RED;
    return `${CYAN}›${RESET} ${style}${fit(truncate(state.toast.text, room), room)}${RESET}`;
  }
  return `${CYAN}›${RESET} ${DIM}${fit(truncate("type / for commands · ? for help", room), room)}${RESET}`;
}

function footerLine(cols: number): string {
  return `${DIM}${fit("tab pane · ↑↓ move · : palette · / command · r refresh · q quit", cols)}${RESET}`;
}

function countFor(state: TuiState, page: Page): number {
  switch (page.id) {
    case "growth":
      return state.snapshot.queue.length;
    case "bizops":
      return state.snapshot.invoices.length;
    case "proof":
      return state.snapshot.receipts.length;
    case "memory":
      return state.snapshot.decisions.length;
    case "accounts":
      return (state.integrations ?? []).reduce((total, entry) => total + entry.accounts.length, 0);
    default:
      return 0;
  }
}

function railRows(state: TuiState): Row[] {
  const rows: Row[] = [];
  for (const [index, page] of PAGES.entries()) {
    const selected = index === state.page;
    const marker = selected ? "▸" : " ";
    const count = countFor(state, page);
    const label = ` ${marker} ${page.label}`;
    const suffix = count > 0 ? String(count) : "";
    const gap = Math.max(1, 20 - displayWidth(label) - displayWidth(suffix));
    rows.push({
      text: `${label}${" ".repeat(gap)}${suffix}`,
      style: selected ? `${CYAN}${BOLD}` : undefined,
    });
  }
  rows.push({ text: "" });
  rows.push({ text: ` ?  help`, style: DIM });
  rows.push({ text: ` q  quit`, style: DIM });
  return rows;
}

function kv(label: string, value: string, style?: string): Row {
  return { text: `${label.padEnd(10)}${value}`, style };
}

function accountSummary(state: TuiState): string {
  const entries = state.integrations ?? [];
  if (entries.length === 0) return "none detected — install gh or vercel";
  return entries
    .map((entry) => `${entry.integration.label}: ${activeAccount(entry)?.label ?? "no accounts"}`)
    .join(" · ");
}

function overviewRows(state: TuiState): Row[] {
  const s = state.snapshot;
  const last = s.receipts[0];
  const passed = last === undefined ? 0 : last.checks.filter((check) => check.ok).length;
  const total = last === undefined ? 0 : last.checks.length;
  const filled = total === 0 ? 0 : Math.round((passed / total) * 8);
  const meter = `${"█".repeat(filled)}${"░".repeat(8 - filled)}`;
  const lastStyle =
    last === undefined ? undefined : last.status === "proved" ? GREEN : last.status === "failed" ? RED : AMBER;
  return [
    kv("workspace", s.workspace, DIM),
    { text: "" },
    kv("growth", `${s.queue.length} queued · ${s.published} published`),
    kv("bizops", `${s.invoices.length} invoice draft${s.invoices.length === 1 ? "" : "s"}`),
    kv(
      "proof",
      `${meter} ${s.receipts.length} receipt${s.receipts.length === 1 ? "" : "s"}${
        last ? ` · ${last.status} ${passed}/${total}` : ""
      }`,
      lastStyle,
    ),
    kv("memory", `${s.decisions.length} active decision${s.decisions.length === 1 ? "" : "s"}`),
    kv("accounts", accountSummary(state)),
    { text: "" },
    { text: "next", style: `${BOLD}${AMBER}` },
    { text: "  /queue x :: a post about the launch", style: DIM },
    { text: "  /invoice Acme :: consulting :: 2 :: 150 :: KES", style: DIM },
    { text: "  /analytics sales.csv :: revenue", style: DIM },
    { text: "  /verify", style: DIM },
  ];
}

/**
 * The visible slice of a list, with each item's original index so selection stays
 * correct after scrolling. The panel gets exactly as many rows as it has height for.
 */
function windowed<T>(items: T[], cursor: number, height: number): Array<{ item: T; index: number }> {
  if (height <= 0) return [];
  const start = Math.max(0, Math.min(cursor - Math.floor(height / 2), Math.max(0, items.length - height)));
  return items.slice(start, start + height).map((item, offset) => ({ item, index: start + offset }));
}

function accountEntries(state: TuiState): Array<{ detected: DetectedIntegration; account: Account }> {
  const entries: Array<{ detected: DetectedIntegration; account: Account }> = [];
  for (const integration of state.integrations ?? []) {
    for (const account of integration.accounts) entries.push({ detected: integration, account });
  }
  return entries;
}

function pageRows(state: TuiState, height: number): Row[] {
  const page = PAGES[state.page] ?? PAGES[0];
  if (state.help) return helpRows();
  if (page === undefined) return [];

  switch (page.id) {
    case "growth": {
      if (state.snapshot.queue.length === 0) {
        return [
          { text: "queue", style: `${BOLD}${AMBER}` },
          { text: "" },
          { text: "Nothing queued.", style: DIM },
          { text: "Add one locally — publishing is a separate, gated action:", style: DIM },
          { text: "  /queue x :: a post about the launch", style: DIM },
        ];
      }
      return windowed(state.snapshot.queue, state.cursor, height).map(({ item, index }) => ({
        text: ` ${index === state.cursor ? "▸" : " "} ${item.platform.padEnd(10)} ${item.text}`,
        style: index === state.cursor ? REVERSE : undefined,
      }));
    }

    case "bizops": {
      if (state.snapshot.invoices.length === 0) {
        return [
          { text: "invoices", style: `${BOLD}${AMBER}` },
          { text: "" },
          { text: "No drafts yet.", style: DIM },
          { text: "  /invoice Acme :: consulting :: 2 :: 150 :: KES", style: DIM },
        ];
      }
      return windowed(state.snapshot.invoices, state.cursor, height).map(({ item, index }) => ({
        text: ` ${index === state.cursor ? "▸" : " "} ${item.name}  ${item.bytes}B`,
        style: index === state.cursor ? REVERSE : undefined,
      }));
    }

    case "proof": {
      if (state.snapshot.receipts.length === 0) {
        return [
          { text: "receipts", style: `${BOLD}${AMBER}` },
          { text: "" },
          { text: "No proof yet.", style: DIM },
          { text: "Run the project's checks and write a receipt:", style: DIM },
          { text: "  /verify", style: DIM },
        ];
      }
      return windowed(state.snapshot.receipts, state.cursor, height).map(({ item, index }) => {
        const passed = item.checks.filter((check) => check.ok).length;
        const style = item.status === "proved" ? GREEN : item.status === "failed" ? RED : AMBER;
        return {
          text: ` ${index === state.cursor ? "▸" : " "} ${item.status.padEnd(8)} ${passed}/${item.checks.length}  ${item.id}`,
          style: index === state.cursor ? REVERSE : style,
        };
      });
    }

    case "memory": {
      if (state.snapshot.decisions.length === 0) {
        return [
          { text: "decisions", style: `${BOLD}${AMBER}` },
          { text: "" },
          { text: "Nothing settled yet.", style: DIM },
          { text: "  /decision choice :: Use checkpoints :: git is slow here", style: DIM },
        ];
      }
      return windowed(state.snapshot.decisions, state.cursor, height).map(({ item, index }) => ({
        text: ` ${index === state.cursor ? "▸" : " "} [${item.kind}] ${item.title} — ${item.rationale}`,
        style: index === state.cursor ? REVERSE : undefined,
      }));
    }

    case "accounts": {
      const entries = accountEntries(state);
      if (entries.length === 0) {
        return [
          { text: "No CLIs detected.", style: DIM },
          { text: "Install GitHub CLI (gh) or Vercel (vercel), then sign in:", style: DIM },
          { text: "  gh auth login", style: DIM },
          { text: "  vercel login", style: DIM },
          { text: "", style: DIM },
          { text: "Other CLIs can declare a manifest in .weaver/integrations/.", style: DIM },
        ];
      }
      return windowed(entries, state.cursor, height).map(({ item, index }) => {
        const active = item.account.active;
        const selected = item.detected.selected === item.account.id;
        const mark = active ? "●" : selected ? "○" : " ";
        const stateLabel = active && selected ? "active · selected" : active ? "active" : selected ? "selected" : "";
        return {
          text: ` ${index === state.cursor ? "▸" : " "} ${mark} ${item.detected.integration.label.padEnd(8)} ${item.account.label.padEnd(14)} ${stateLabel}`,
          style: index === state.cursor ? REVERSE : active ? GREEN : selected ? AMBER : undefined,
        };
      });
    }

    default:
      return overviewRows(state);
  }
}

function helpRows(): Row[] {
  return [
    { text: "commands", style: `${BOLD}${AMBER}` },
    { text: "  /queue <platform> :: <text>        add to the local queue", style: DIM },
    { text: "  /invoice <client> :: <desc> :: <qty> :: <price> [:: <currency>]", style: DIM },
    { text: "  /analytics <file.csv> [:: <metric>]  summarise an export", style: DIM },
    { text: "  /verify                            run checks, write a receipt", style: DIM },
    { text: "  /decision <kind> :: <title> :: <why>  record why", style: DIM },
    { text: "  /sync                              check the inherited core", style: DIM },
    { text: "  /lsp <action> <file> [line] [char]  diagnostics / definition / references / hover", style: DIM },
    { text: "  /mcp list | /mcp call <tool> :: <json>  configured MCP tools", style: DIM },
    { text: "  /subagent <prompt>                 delegate read-only research to Weaver", style: DIM },
    { text: "  /refresh                           reload the snapshot", style: DIM },
    { text: "", style: DIM },
    { text: "keys", style: `${BOLD}${AMBER}` },
    { text: "  tab / shift+tab   switch axis", style: DIM },
    { text: "  ↑↓ or j/k         move", style: DIM },
    { text: "  enter             inspect          /  command line", style: DIM },
    { text: "  :                 command palette", style: DIM },
    { text: "  ?                 close help       q  quit", style: DIM },
  ];
}

/**
 * Build the frame. Every returned line has exactly `cols` visible cells.
 *
 * Pure: no timers, no terminal, no mutation. That is what makes the border contract
 * testable.
 */
export function renderScreen(state: TuiState, cols: number, rows: number): string[] {
  const bodyHeight = Math.max(3, rows - 3);
  const { right: mainWidth } = splitWidth(cols, RAIL_WIDTH, 1);
  const page = PAGES[state.page] ?? PAGES[0];

  const rail = panel({
    title: "axes",
    rows: railRows(state),
    width: RAIL_WIDTH,
    height: bodyHeight,
    style: { border: GRAY, title: `${BOLD}${AMBER}` },
  });

  const count = page === undefined ? 0 : countFor(state, page);
  const main = panel({
    title: state.help ? "help" : (page?.title ?? "overview"),
    right: count > 0 ? `${count} item${count === 1 ? "" : "s"}` : undefined,
    rows: pageRows(state, Math.max(1, bodyHeight - 2)),
    width: mainWidth,
    height: bodyHeight,
    style: { border: GRAY, title: `${BOLD}${AMBER}`, right: GRAY },
  });

  const lines = [
    headerLine(state, cols),
    ...joinColumns(rail, main, RAIL_WIDTH, 1),
    commandLine(state, cols),
    footerLine(cols),
  ];

  const modal = state.modal ?? null;
  if (modal !== null) {
    return overlay(lines, {
      title: `switch ${modal.detected.integration.label}`,
      rows: [
        { text: `Use ${modal.account.label}?`, style: `${BOLD}${AMBER}` },
        { text: "" },
        { text: `This changes the account ${modal.detected.integration.label} uses for pushes and deploys.`, style: DIM },
        { text: "Switching back is always available.", style: DIM },
        { text: "" },
        { text: "y switch · n cancel", style: DIM },
      ],
      width: cols,
      height: rows,
      panelWidth: 66,
    });
  }

  const palette = state.palette ?? null;
  if (palette !== null) {
    const matches = filterPalette(palette.query);
    const paletteRows: Row[] =
      matches.length > 0
        ? matches.map((command, index) => ({
            text: ` ${index === palette.index ? "▸" : " "} /${command.name.padEnd(10)} ${command.hint}`,
            style: index === palette.index ? REVERSE : undefined,
          }))
        : [{ text: " no match", style: DIM }];

    return overlay(lines, {
      title: "commands",
      rows: paletteRows,
      width: cols,
      height: rows,
      panelWidth: 74,
    });
  }

  return lines;
}

// ------------------------------------------------------------------ terminal

export async function runTui(workspace: string, options: { force?: boolean } = {}): Promise<void> {
  if (options.force !== true && !tuiSupported()) {
    await runPlain(workspace);
    return;
  }

  const state: TuiState = {
    page: 0,
    cursor: 0,
    input: "",
    cursorPos: 0,
    commandMode: false,
    busy: null,
    toast: null,
    log: [],
    snapshot: await loadSnapshot(workspace),
    spinner: 0,
    help: false,
    integrations: [],
    modal: null,
  };

  stdout.write(ALT_ON + HIDE_CURSOR);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  let cleaned = false;
  let dirty = true;
  let wipe = true;
  let lastInterrupt = 0;
  let escapeTimer: ReturnType<typeof setTimeout> | undefined;
  const parser = new KeyParser();

  await new Promise<void>((resolveSession) => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = (): void => {
      if (cleaned) return;
      cleaned = true;
      if (timer !== undefined) clearInterval(timer);
      if (escapeTimer !== undefined) clearTimeout(escapeTimer);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(SHOW_CURSOR + ALT_OFF);
      resolveSession();
    };

    const toast = (text: string, ok = true): void => {
      state.toast = { text, ok, until: Date.now() + 6_000 };
      dirty = true;
    };

    const refresh = async (): Promise<void> => {
      try {
        state.snapshot = await loadSnapshot(workspace);
        state.integrations = await detectIntegrations(workspace, weaverHome());
      } catch (error) {
        toast(`refresh failed: ${error instanceof Error ? error.message : String(error)}`, false);
      }
      dirty = true;
    };

    const run = async (raw: string): Promise<void> => {
      state.busy = "working";
      dirty = true;
      try {
        const result = await dispatch(workspace, raw);
        if (result.kind === "quit") {
          stop();
          return;
        }
        if (result.kind === "help") {
          state.help = true;
        } else if (result.kind === "refresh") {
          await refresh();
          toast("refreshed");
        } else if (result.kind === "result") {
          toast(result.result.message, result.result.ok);
          state.log.unshift(result.result.message);
          state.log = state.log.slice(0, 20);
          await refresh();
        }
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), false);
      } finally {
        state.busy = null;
        dirty = true;
      }
    };

    const confirmSwitch = async (): Promise<void> => {
      const modal = state.modal;
      if (modal === null || modal === undefined) return;
      state.modal = null;
      state.busy = `switching ${modal.detected.integration.label}`;
      dirty = true;
      try {
        const result = await switchAccount(workspace, modal.detected, modal.account);
        toast(result.message, result.ok);
        state.integrations = await detectIntegrations(workspace, weaverHome());
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), false);
      } finally {
        state.busy = null;
        dirty = true;
      }
    };

    const move = (delta: number): void => {
      const count = countFor(state, PAGES[state.page] ?? PAGES[0]!);
      const max = Math.max(0, count - 1);
      state.cursor = Math.min(max, Math.max(0, state.cursor + delta));
      dirty = true;
    };

    const inspect = (): void => {
      const page = PAGES[state.page];
      if (page === undefined) return;
      if (page.id === "growth") {
        const item = state.snapshot.queue[state.cursor];
        if (item !== undefined) toast(`${item.id} · ${item.platform} · ${item.text}`);
      } else if (page.id === "bizops") {
        const file = state.snapshot.invoices[state.cursor];
        if (file !== undefined) toast(`${file.name} · ${file.bytes} bytes`);
      } else if (page.id === "proof") {
        const receipt = state.snapshot.receipts[state.cursor];
        if (receipt !== undefined) toast(`${receipt.status} · ${receipt.id} · ${receipt.checks.length} check(s)`);
      } else if (page.id === "memory") {
        const decision = state.snapshot.decisions[state.cursor];
        if (decision !== undefined) toast(`[${decision.kind}] ${decision.title} — ${decision.rationale}`);
      } else if (page.id === "accounts") {
        const entry = accountEntries(state)[state.cursor];
        if (entry !== undefined) {
          state.modal = { detected: entry.detected, account: entry.account };
          dirty = true;
        }
      }
    };

    const insert = (text: string): void => {
      state.input = state.input.slice(0, state.cursorPos) + text + state.input.slice(state.cursorPos);
      state.cursorPos += text.length;
      dirty = true;
    };

    const handle = (key: Key): void => {
      if (key.type === "ctrl" && key.value === "c") {
        if (Date.now() - lastInterrupt < 1_500) {
          stop();
        } else {
          lastInterrupt = Date.now();
          toast("press ctrl+c again to quit", false);
        }
        return;
      }
      if (key.type === "ctrl" && key.value === "l") {
        state.log = [];
        state.toast = null;
        dirty = true;
        return;
      }

      if (state.modal !== null && state.modal !== undefined) {
        if (key.type === "char" && (key.value === "y" || key.value === "Y")) {
          void confirmSwitch();
          return;
        }
        if (key.type === "char" && (key.value === "n" || key.value === "N")) {
          state.modal = null;
          dirty = true;
          return;
        }
        if (key.type === "unknown" && key.raw === "\u001b") {
          state.modal = null;
          dirty = true;
          return;
        }
        if (key.type === "enter") {
          void confirmSwitch();
          return;
        }
        return;
      }

      if (state.palette !== null && state.palette !== undefined) {
        const palette = state.palette;
        if (key.type === "char") {
          palette.query += key.value;
          palette.index = 0;
          dirty = true;
          return;
        }
        if (key.type === "backspace") {
          palette.query = palette.query.slice(0, -1);
          palette.index = 0;
          dirty = true;
          return;
        }
        if (key.type === "down") {
          palette.index = Math.min(Math.max(0, filterPalette(palette.query).length - 1), palette.index + 1);
          dirty = true;
          return;
        }
        if (key.type === "up") {
          palette.index = Math.max(0, palette.index - 1);
          dirty = true;
          return;
        }
        if (key.type === "unknown" && key.raw === "\u001b") {
          state.palette = null;
          dirty = true;
          return;
        }
        if (key.type === "enter") {
          const selected = filterPalette(palette.query)[palette.index];
          state.palette = null;
          if (selected === undefined) {
            dirty = true;
            return;
          }
          if (selected.name === "accounts") {
            state.page = PAGES.findIndex((page) => page.id === "accounts");
            state.cursor = 0;
            state.help = false;
            dirty = true;
            return;
          }
          if (selected.name === "help") {
            state.help = true;
            dirty = true;
            return;
          }
          if (selected.name === "verify" || selected.name === "sync" || selected.name === "refresh") {
            void run(`/${selected.name}`);
            return;
          }
          state.commandMode = true;
          state.input = `/${selected.name} `;
          state.cursorPos = state.input.length;
          dirty = true;
          return;
        }
        return;
      }

      if (key.type === "unknown" && key.raw === "\u001b") {
        if (state.help) state.help = false;
        else if (state.commandMode) {
          state.commandMode = false;
          state.input = "";
          state.cursorPos = 0;
        }
        dirty = true;
        return;
      }

      if (state.commandMode) {
        if (key.type === "char") insert(key.value);
        else if (key.type === "paste") insert(key.value);
        else if (key.type === "backspace") {
          if (state.cursorPos > 0) {
            state.input = state.input.slice(0, state.cursorPos - 1) + state.input.slice(state.cursorPos);
            state.cursorPos -= 1;
            dirty = true;
          }
        } else if (key.type === "delete") {
          state.input = state.input.slice(0, state.cursorPos) + state.input.slice(state.cursorPos + 1);
          dirty = true;
        } else if (key.type === "left") {
          state.cursorPos = Math.max(0, state.cursorPos - 1);
          dirty = true;
        } else if (key.type === "right") {
          state.cursorPos = Math.min(state.input.length, state.cursorPos + 1);
          dirty = true;
        } else if (key.type === "home") {
          state.cursorPos = 0;
          dirty = true;
        } else if (key.type === "end") {
          state.cursorPos = state.input.length;
          dirty = true;
        } else if (key.type === "ctrl" && key.value === "u") {
          state.input = state.input.slice(state.cursorPos);
          state.cursorPos = 0;
          dirty = true;
        } else if (key.type === "enter") {
          const raw = state.input;
          state.input = "";
          state.cursorPos = 0;
          state.commandMode = false;
          void run(raw);
        }
        return;
      }

      if (key.type === "char") {
        switch (key.value) {
          case "q":
            stop();
            return;
          case "?":
            state.help = !state.help;
            dirty = true;
            return;
          case "/":
            state.commandMode = true;
            state.help = false;
            dirty = true;
            return;
          case ":":
            state.palette = { query: "", index: 0 };
            state.help = false;
            dirty = true;
            return;
          case "r":
            void refresh();
            return;
          case "j":
            move(1);
            return;
          case "k":
            move(-1);
            return;
          case "g":
            state.cursor = 0;
            dirty = true;
            return;
          case "G":
            state.cursor = Math.max(0, countFor(state, PAGES[state.page] ?? PAGES[0]!) - 1);
            dirty = true;
            return;
          default:
            if (/^[1-6]$/.test(key.value)) {
              state.page = Number(key.value) - 1;
              state.cursor = 0;
              state.help = false;
              dirty = true;
            }
            return;
        }
      }

      if (key.type === "tab") {
        state.page = (state.page + 1) % PAGES.length;
        state.cursor = 0;
        state.help = false;
        dirty = true;
        return;
      }
      if (key.type === "down") move(1);
      else if (key.type === "up") move(-1);
      else if (key.type === "pagedown") move(5);
      else if (key.type === "pageup") move(-5);
      else if (key.type === "enter") inspect();
    };

    stdin.on("data", (chunk: string) => {
      for (const key of parser.push(chunk)) handle(key);
      if (parser.pending.length > 0) {
        if (escapeTimer !== undefined) clearTimeout(escapeTimer);
        escapeTimer = setTimeout(() => {
          for (const key of parser.flush()) handle(key);
        }, ESCAPE_TIMEOUT_MS);
      }
      dirty = true;
    });

    stdout.on("resize", () => {
      wipe = true;
      dirty = true;
    });

    const paint = (): void => {
      const cols = stdout.columns ?? MIN_COLS;
      const rows = stdout.rows ?? MIN_ROWS;
      stdout.write(encodeFrame(renderScreen(state, cols, rows), wipe));
      wipe = false;
      dirty = false;
    };

    // First paint immediately rather than waiting for the first tick: a 90 ms blank
    // alternate screen reads as a hang.
    paint();

    // Account detection shells out to `gh`/`vercel`; do it after the first paint so the
    // dashboard is responsive immediately and a slow CLI cannot swallow key presses.
    state.busy = "detecting accounts";
    void (async () => {
      try {
        state.integrations = await detectIntegrations(workspace, weaverHome());
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), false);
      } finally {
        state.busy = null;
        dirty = true;
      }
    })();

    timer = setInterval(() => {
      if (state.toast !== null && Date.now() > state.toast.until) {
        state.toast = null;
        dirty = true;
      }
      if (state.busy !== null) {
        state.spinner += 1;
        dirty = true;
      }
      if (dirty) paint();
    }, TICK_MS);
  });
}

// ------------------------------------------------------------------ fallback

export function statusText(snapshot: Snapshot): string {
  const last = snapshot.receipts[0];
  return [
    `workspace  ${snapshot.workspace}`,
    `growth     ${snapshot.queue.length} queued · ${snapshot.published} published`,
    `bizops     ${snapshot.invoices.length} invoice draft(s)`,
    `proof      ${snapshot.receipts.length} receipt(s)${last ? ` · last ${last.status}` : ""}`,
    `memory     ${snapshot.decisions.length} active decision(s)`,
  ].join("\n");
}

/** Line mode for a terminal too small for the dashboard, or a pipe. */
export async function runPlain(workspace: string): Promise<void> {
  const snapshot = await loadSnapshot(workspace);
  console.log("");
  console.log(`${BOLD}${gradient("Arif Agent")}${DIM} · multi-axis agent${RESET}`);
  console.log(`${DIM}${statusText(snapshot)}${RESET}`);
  console.log(`${DIM}/help for commands · /quit to leave${RESET}`);
  console.log("");

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (;;) {
      let line: string;
      try {
        line = await rl.question(`${CYAN}Arif Agent ›${RESET} `);
      } catch {
        break;
      }
      const result = await dispatch(workspace, line);
      if (result.kind === "quit") break;
      if (result.kind === "help") {
        for (const row of helpRows()) console.log(`  ${row.style ?? ""}${row.text}${row.style ? RESET : ""}`);
      } else if (result.kind === "refresh") {
        console.log(`${DIM}${statusText(await loadSnapshot(workspace))}${RESET}`);
      } else if (result.kind === "result") {
        console.log(`${result.result.ok ? GREEN : RED}${result.result.message}${RESET}`);
      }
    }
  } finally {
    rl.close();
  }
}
