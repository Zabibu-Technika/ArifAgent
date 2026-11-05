// What the dashboard reads. One snapshot, taken atomically enough for a terminal.
//
// Every section fails independently: a missing `invoices/` directory is an empty list,
// not a blank screen. A dashboard that dies because one optional directory is absent is
// a dashboard nobody runs on a fresh machine.
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listReceipts, type ProofReceipt } from "../core/verification/receipt.ts";
import { active as activeDecisions, ledgerFor, type Decision } from "../core/memory/decisions.ts";

export interface QueueItem {
  id: string;
  platform: string;
  text: string;
  scheduledFor: string | null;
  createdAt: string;
}

export interface InvoiceFile {
  name: string;
  bytes: number;
  modified: number;
}

export interface Snapshot {
  workspace: string;
  queue: QueueItem[];
  published: number;
  invoices: InvoiceFile[];
  receipts: ProofReceipt[];
  decisions: Decision[];
  errors: string[];
  loadedAt: number;
}

async function readJsonl<T>(path: string): Promise<T[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const rows: T[] = [];
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      rows.push(JSON.parse(line) as T);
    } catch {
      // A torn line is one lost row, not a lost file.
    }
  }
  return rows;
}

async function countLines(path: string): Promise<number> {
  try {
    const text = await readFile(path, "utf8");
    return text.split("\n").filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

async function invoiceFiles(workspace: string): Promise<InvoiceFile[]> {
  const directory = join(resolve(workspace), "invoices");
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const files: InvoiceFile[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    try {
      const info = await stat(join(directory, name));
      files.push({ name, bytes: info.size, modified: info.mtimeMs });
    } catch {
      // A file that vanished between readdir and stat is not worth failing over.
    }
  }
  return files.sort((a, b) => b.modified - a.modified);
}

export async function loadSnapshot(workspace: string): Promise<Snapshot> {
  const errors: string[] = [];
  const root = resolve(workspace);

  const [queue, published, invoices, receipts, decisions] = await Promise.all([
    readJsonl<QueueItem>(join(root, ".arif-agent", "queue.jsonl")),
    countLines(join(root, ".arif-agent", "published.jsonl")),
    invoiceFiles(root),
    listReceipts(root),
    activeDecisions(ledgerFor(root)),
  ]);

  if (receipts.length === 0) errors.push("no proof receipts yet");

  return {
    workspace: root,
    queue,
    published,
    invoices,
    receipts,
    decisions,
    errors,
    loadedAt: Date.now(),
  };
}
