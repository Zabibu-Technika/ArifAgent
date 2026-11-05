// Growth engine — the first non-coding axis.
//
// The rule that makes this safe to bolt onto a coding agent is the same rule the coding
// engine follows: every tool declares what it can do, and anything that leaves the
// machine is `egress`. Drafting a post and publishing a post are not the same action and
// must never share a permission path, even though they share a file format.
//
// So: analytics reads, queueing writes locally, and publishing refuses unless an adapter
// is explicitly configured. There is no default endpoint. A tool that "just posts" is a
// tool that posts to whatever the model was last told to trust.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ToolDef, ToolOutcome } from "../../core/contracts/tool.ts";
import { resolveInWorkspace } from "../../core/contracts/workspace.ts";
import {
  commit as commitAction,
  fail as failAction,
  journalFor,
  plan as planAction,
} from "../../core/safety/rollback.ts";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5_000;
const MAX_POST_CHARS = 5_000;

// --- CSV ---------------------------------------------------------------------

/** Minimal RFC-4180 parser: quotes, doubled quotes, CRLF. Enough for exported reports. */
export function parseDelimited(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === undefined) continue;

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (character === "\r") continue;
    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
}

interface ColumnStats {
  name: string;
  sum: number;
  mean: number;
  min: number;
  max: number;
}

function numericColumns(header: string[], rows: string[][]): ColumnStats[] {
  const stats: ColumnStats[] = [];
  for (let column = 0; column < header.length; column += 1) {
    const values: number[] = [];
    for (const row of rows) {
      const raw = (row[column] ?? "").replace(/[$,%\s]/g, "");
      if (raw.length === 0) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        values.length = 0;
        break;
      }
      values.push(value);
    }
    if (values.length === 0) continue;
    const sum = values.reduce((total, value) => total + value, 0);
    stats.push({
      name: header[column] ?? `column ${column + 1}`,
      sum: Math.round(sum * 100) / 100,
      mean: Math.round((sum / values.length) * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }
  return stats;
}

function cell(value: string | undefined, limit = 40): string {
  const text = (value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

const analyticsSummary: ToolDef = {
  name: "analytics_summary",
  description: "Summarise a CSV export: numeric column totals, averages, and the top rows by a chosen metric.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "CSV path relative to the workspace." },
      metric: { type: "string", description: "Numeric column to rank rows by (optional)." },
      top: { type: "number", description: "How many top rows to show (default 5)." },
    },
    required: ["path"],
  },
  mutating: false,
  // A CSV came from somewhere else: an export, a download, a client. Treat it as data
  // that could contain instruction-shaped text, not as trusted local output.
  ingest: "external",
  capability: "read",
  async run(input, ctx): Promise<ToolOutcome> {
    const path = typeof input.path === "string" ? input.path : null;
    if (path === null) return { ok: false, output: "analytics_summary: `path` is required" };

    let text: string;
    try {
      text = await readFile(resolveInWorkspace(ctx.workspace, path), "utf8");
    } catch (error) {
      return { ok: false, output: `analytics_summary: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (Buffer.byteLength(text, "utf8") > MAX_CSV_BYTES) {
      return { ok: false, output: `analytics_summary: file exceeds ${MAX_CSV_BYTES} bytes` };
    }

    const table = parseDelimited(text);
    const header = table[0];
    if (header === undefined) return { ok: false, output: "analytics_summary: the file is empty" };
    const rows = table.slice(1, MAX_ROWS + 1);
    const stats = numericColumns(header, rows);

    const lines: string[] = [`# Analytics — ${path}`, `rows: ${rows.length}`, ""];
    if (stats.length === 0) {
      lines.push("No numeric columns were found.");
    } else {
      lines.push("| column | sum | mean | min | max |", "| --- | ---: | ---: | ---: | ---: |");
      for (const column of stats) {
        lines.push(`| ${column.name} | ${column.sum} | ${column.mean} | ${column.min} | ${column.max} |`);
      }
    }

    const metric = typeof input.metric === "string" ? input.metric : null;
    const top = typeof input.top === "number" && input.top > 0 ? Math.min(Math.floor(input.top), 20) : 5;
    if (metric !== null) {
      const index = header.indexOf(metric);
      if (index === -1) {
        lines.push("", `metric "${metric}" is not a column.`);
      } else {
        const ranked = [...rows]
          .map((row) => ({ row, value: Number((row[index] ?? "").replace(/[$,%\s]/g, "")) }))
          .filter((entry) => Number.isFinite(entry.value))
          .sort((a, b) => b.value - a.value)
          .slice(0, top);
        lines.push("", `top ${ranked.length} by ${metric}:`);
        for (const entry of ranked) {
          const label = header.map((name, position) => `${name}=${cell(entry.row[position])}`).join("  ");
          lines.push(`- ${entry.value}  (${label})`);
        }
      }
    }

    return { ok: true, output: lines.join("\n") };
  },
};

// --- Social queue ------------------------------------------------------------

interface QueuedPost {
  id: string;
  platform: string;
  text: string;
  scheduledFor: string | null;
  createdAt: string;
}

const queuePath = (workspace: string): string => join(resolve(workspace), ".arif-agent", "queue.jsonl");
const publishedPath = (workspace: string): string => join(resolve(workspace), ".arif-agent", "published.jsonl");

/** Whether this id is already in the outbox. Re-publishing is a duplicate post, not a retry. */
async function alreadyPublished(workspace: string, id: string): Promise<boolean> {
  try {
    const text = await readFile(publishedPath(workspace), "utf8");
    for (const line of text.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        if ((JSON.parse(line) as { id?: string }).id === id) return true;
      } catch {
        // A torn line is not evidence of publication; keep looking.
      }
    }
  } catch {
    // No outbox yet.
  }
  return false;
}

const queuePost: ToolDef = {
  name: "queue_post",
  description: "Add a drafted post to the local publishing queue. Does not publish anything.",
  parameters: {
    type: "object",
    properties: {
      platform: { type: "string", description: "Target platform, e.g. x, linkedin, whatsapp." },
      text: { type: "string", description: "The post body." },
      scheduled_for: { type: "string", description: "Optional ISO timestamp to publish at." },
    },
    required: ["platform", "text"],
  },
  mutating: true,
  capability: "local-write",
  async run(input, ctx): Promise<ToolOutcome> {
    const platform = typeof input.platform === "string" ? input.platform.trim() : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (platform.length === 0) return { ok: false, output: "queue_post: `platform` is required" };
    if (text.length === 0) return { ok: false, output: "queue_post: `text` is required" };
    if (text.length > MAX_POST_CHARS) return { ok: false, output: `queue_post: text exceeds ${MAX_POST_CHARS} characters` };

    const post: QueuedPost = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      platform,
      text,
      scheduledFor: typeof input.scheduled_for === "string" ? input.scheduled_for : null,
      createdAt: new Date().toISOString(),
    };

    await mkdir(join(resolve(ctx.workspace), ".arif-agent"), { recursive: true });
    await appendFile(queuePath(ctx.workspace), `${JSON.stringify(post)}\n`, "utf8");
    return { ok: true, output: `queued ${post.id} for ${platform} (nothing was published)` };
  },
};

const publishPost: ToolDef = {
  name: "publish_post",
  description:
    "Publish a queued post through the configured adapter. Requires ARIF_AGENT_PUBLISH_ENDPOINT; refuses otherwise.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "The queued post id." },
    },
    required: ["id"],
  },
  mutating: true,
  // This is the line that leaves the machine. It is `egress`, so the trust layer gates
  // it on provenance and never offers "always allow".
  capability: "egress",
  async run(input, ctx): Promise<ToolOutcome> {
    const endpoint =
      process.env.ARIF_AGENT_PUBLISH_ENDPOINT ?? process.env.ARIF_PUBLISH_ENDPOINT;
    if (endpoint === undefined || endpoint.trim().length === 0) {
      return {
        ok: false,
        output:
          "publish_post: no adapter configured. Set ARIF_AGENT_PUBLISH_ENDPOINT to a real publishing service before this tool can act. Nothing was sent.",
      };
    }

    const id = typeof input.id === "string" ? input.id : null;
    if (id === null) return { ok: false, output: "publish_post: `id` is required" };

    let text: string;
    try {
      text = await readFile(queuePath(ctx.workspace), "utf8");
    } catch {
      return { ok: false, output: "publish_post: the queue is empty" };
    }

    const post = text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as QueuedPost;
        } catch {
          return null;
        }
      })
      .find((candidate): candidate is QueuedPost => candidate !== null && candidate.id === id);

    if (post === undefined) return { ok: false, output: `publish_post: no queued post "${id}"` };

    if (await alreadyPublished(ctx.workspace, post.id)) {
      return {
        ok: false,
        output: `publish_post: ${post.id} was already published — refusing to send it twice`,
      };
    }

    // Plan the compensation before the effect. If the process dies during the request,
    // the journal leaves the action `pending`, which is the honest state: we do not know
    // whether the platform accepted it.
    const journal = journalFor(ctx.workspace);
    const planned = await planAction(journal, {
      action: "publish_post",
      detail: `publish ${post.id} to ${post.platform}`,
      target: endpoint,
      compensation: `delete the post from ${post.platform} through its UI or delete API`,
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: post.platform, text: post.text }),
      });
      if (!response.ok) {
        await failAction(journal, planned.id, `the adapter returned HTTP ${response.status}`);
        return { ok: false, output: `publish_post: the adapter returned HTTP ${response.status}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failAction(journal, planned.id, message);
      return { ok: false, output: `publish_post: ${message}` };
    }

    await commitAction(journal, planned.id);
    await mkdir(join(resolve(ctx.workspace), ".arif-agent"), { recursive: true });
    await appendFile(
      publishedPath(ctx.workspace),
      `${JSON.stringify({ id: post.id, platform: post.platform, at: new Date().toISOString() })}\n`,
      "utf8",
    );
    return {
      ok: true,
      output: `published ${post.id} to ${post.platform} — compensation recorded: delete it if needed`,
    };
  },
};

export const growthTools: ToolDef[] = [analyticsSummary, queuePost, publishPost];
