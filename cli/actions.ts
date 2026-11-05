// What the dashboard can do. Each action calls the same tool the agent would, so the TUI
// is a second interface to one implementation — not a parallel one that drifts.
import { spawn } from "node:child_process";
import { growthTools } from "../engines/growth/tools.ts";
import { bizopsTools } from "../engines/bizops/tools.ts";
import { detectChecks, runChecks } from "../core/verification/index.ts";
import { summarizeProof, writeReceipt } from "../core/verification/receipt.ts";
import { ledgerFor, record, type DecisionKind } from "../core/memory/decisions.ts";
import type { ToolDef } from "../core/contracts/tool.ts";

export interface ActionResult {
  ok: boolean;
  message: string;
}

function tool(tools: ToolDef[], name: string): ToolDef {
  const found = tools.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`missing tool ${name}`);
  return found;
}

function firstLine(text: string): string {
  return (text.split("\n").find((line) => line.trim().length > 0) ?? "").trim();
}

export async function queuePost(workspace: string, platform: string, text: string): Promise<ActionResult> {
  if (platform.length === 0 || text.length === 0) {
    return { ok: false, message: "usage: /queue <platform> :: <text>" };
  }
  const result = await tool(growthTools, "queue_post").run({ platform, text }, { workspace });
  return { ok: result.ok, message: firstLine(result.output) };
}

export async function draftInvoice(
  workspace: string,
  client: string,
  description: string,
  quantity: number,
  unitPrice: number,
  currency?: string,
): Promise<ActionResult> {
  if (client.length === 0 || description.length === 0) {
    return { ok: false, message: "usage: /invoice <client> :: <description> :: <qty> :: <unit_price>" };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "quantity must be a positive number" };
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { ok: false, message: "unit price must be zero or more" };
  }

  const result = await tool(bizopsTools, "invoice_draft").run(
    {
      client,
      items: [{ description, quantity, unit_price: unitPrice }],
      currency:
        currency ?? process.env.ARIF_AGENT_CURRENCY ?? process.env.ARIF_CURRENCY ?? "USD",
    },
    { workspace },
  );
  return { ok: result.ok, message: firstLine(result.output) };
}

export async function analytics(workspace: string, path: string, metric?: string): Promise<ActionResult> {
  if (path.length === 0) return { ok: false, message: "usage: /analytics <path.csv> [:: <metric>]" };
  const input: Record<string, unknown> = { path };
  if (metric !== undefined && metric.length > 0) input.metric = metric;
  const result = await tool(growthTools, "analytics_summary").run(input, { workspace });
  return { ok: result.ok, message: firstLine(result.output) };
}

export async function verify(workspace: string): Promise<ActionResult> {
  const checks = await detectChecks(workspace);
  if (checks.length === 0) {
    return { ok: false, message: "no checks detected — add a test script, tsconfig, Cargo.toml, or go.mod" };
  }
  const report = await runChecks(workspace, checks);
  const written = await writeReceipt({ workspace, report, touched: [] });
  return { ok: report.ok, message: summarizeProof(written.receipt) };
}

export async function remember(
  workspace: string,
  kind: DecisionKind,
  title: string,
  why: string,
): Promise<ActionResult> {
  if (title.length === 0 || why.length === 0) {
    return { ok: false, message: "usage: /decision <choice|rejection|constraint|assumption> :: <title> :: <why>" };
  }
  const decision = await record(ledgerFor(workspace), {
    kind,
    title,
    rationale: why,
    source: "user",
    tags: ["tui"],
  });
  return { ok: true, message: `recorded [${decision.kind}] ${decision.title}` };
}

/** Run the sibling sync check. Python is the one external tool the project already needs. */
export function syncCheck(arifAgentRoot: string): Promise<ActionResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.env.PYTHON ?? "python", ["sync-daemon.py", "--check"], {
      cwd: arifAgentRoot,
      windowsHide: true,
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolvePromise({ ok: false, message: `could not run python: ${error.message}` });
    });
    child.on("close", (code) => {
      const last = output.trim().split("\n").filter((line) => line.length > 0).pop();
      resolvePromise({ ok: code === 0, message: last ?? `sync exited ${code}` });
    });
  });
}
