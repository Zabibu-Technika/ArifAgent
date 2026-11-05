// Business operations engine — invoices, CRM payloads, and files that are safe to hand
// to a human.
//
// Money is computed in integer cents, never in floats. `0.1 + 0.2` is a bad joke in a
// spreadsheet and a worse one on an invoice, and the difference between a rounding bug
// and a fraud allegation is usually whether anyone checked the arithmetic.
//
// Nothing here talks to a network. An invoice is a local document; a CRM payload is a
// file in an outbox that a human or a separately-authorized integration can send. That
// separation is what keeps "the agent invoiced a client" from becoming a thing that
// happened without a human seeing the numbers first.
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ToolDef, ToolOutcome } from "../../core/contracts/tool.ts";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "untitled";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Local calendar date.
 *
 * `toISOString()` is UTC, and an invoice issued at 00:30 in Nairobi (UTC+3) would be
 * dated the previous day. That is not a cosmetic bug: it changes payment terms and, in
 * some jurisdictions, the tax period. Use the machine's local date, which is the date the
 * human sees on their own clock.
 */
function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** A local timestamp with millisecond resolution, for a filename that must not collide. */
function localStamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}` +
    `${String(date.getMilliseconds()).padStart(3, "0")}`
  );
}

export function formatMoney(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${currency} ${whole.toLocaleString("en-US")}.${fraction}`;
}

/**
 * Totals in cents.
 *
 * Tax is rounded once, at the subtotal, which is what most invoices do and what a
 * human checking the numbers will expect. Rounding per line and summing produces
 * one-cent disagreements that look like errors.
 */
export function invoiceTotals(items: InvoiceItem[], taxRatePercent: number): InvoiceTotals {
  let subtotal = 0;
  for (const item of items) subtotal += Math.round(item.quantity * item.unitPriceCents);
  const tax = Math.round((subtotal * taxRatePercent) / 100);
  return { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax };
}

function parseItems(input: unknown): InvoiceItem[] | string {
  if (!Array.isArray(input) || input.length === 0) return "`items` must be a non-empty array";
  const items: InvoiceItem[] = [];
  for (const raw of input) {
    if (raw === null || typeof raw !== "object") return "each item must be an object";
    const record = raw as { description?: unknown; quantity?: unknown; unit_price?: unknown };
    const description = typeof record.description === "string" ? record.description.trim() : "";
    const quantity = typeof record.quantity === "number" ? record.quantity : Number.NaN;
    const unitPrice = typeof record.unit_price === "number" ? record.unit_price : Number.NaN;

    if (description.length === 0) return "each item needs a description";
    if (!Number.isFinite(quantity) || quantity <= 0) return `quantity for "${description}" must be greater than zero`;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return `unit_price for "${description}" must be zero or more`;

    items.push({ description, quantity, unitPriceCents: Math.round(unitPrice * 100) });
  }
  return items;
}

const invoiceDraft: ToolDef = {
  name: "invoice_draft",
  description: "Draft a markdown invoice with verified totals. Writes a local file; sends nothing.",
  parameters: {
    type: "object",
    properties: {
      client: { type: "string", description: "Client name." },
      items: {
        type: "array",
        description: "Line items: description, quantity, unit_price.",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
          },
          required: ["description", "quantity", "unit_price"],
        },
      },
      currency: { type: "string", description: "Three-letter code, default USD." },
      tax_rate: { type: "number", description: "Tax percentage, e.g. 16 for 16%." },
      due_days: { type: "number", description: "Payment terms in days, default 14." },
    },
    required: ["client", "items"],
  },
  mutating: true,
  capability: "local-write",
  async run(input, ctx): Promise<ToolOutcome> {
    const client = typeof input.client === "string" ? input.client.trim() : "";
    if (client.length === 0) return { ok: false, output: "invoice_draft: `client` is required" };

    const items = parseItems(input.items);
    if (typeof items === "string") return { ok: false, output: `invoice_draft: ${items}` };

    const currency = typeof input.currency === "string" && input.currency.trim().length > 0 ? input.currency.trim().toUpperCase() : "USD";
    const taxRate = typeof input.tax_rate === "number" ? input.tax_rate : 0;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return { ok: false, output: "invoice_draft: `tax_rate` must be between 0 and 100" };
    }
    const dueDays = typeof input.due_days === "number" && input.due_days > 0 ? Math.floor(input.due_days) : 14;

    const totals = invoiceTotals(items, taxRate);
    const now = new Date();
    const due = new Date(now.getTime() + dueDays * 86_400_000);
    const date = localDate(now);
    // Include the time and a short random suffix: two invoices to the same client in the
    // same millisecond must not overwrite each other. A silent overwrite of a financial
    // document is exactly the kind of data loss that has no rollback.
    const stamp = `${localStamp(now)}-${Math.random().toString(36).slice(2, 6)}`;

    const lines = [
      `# Invoice — ${client}`,
      "",
      `Issued: ${date}  `,
      `Due: ${localDate(due)} (${dueDays} days)`,
      "",
      "| Description | Qty | Unit price | Line total |",
      "| --- | ---: | ---: | ---: |",
      ...items.map(
        (item) =>
          `| ${item.description} | ${item.quantity} | ${formatMoney(item.unitPriceCents, currency)} | ${formatMoney(
            Math.round(item.quantity * item.unitPriceCents),
            currency,
          )} |`,
      ),
      "",
      `Subtotal: **${formatMoney(totals.subtotalCents, currency)}**  `,
      `Tax (${taxRate}%): ${formatMoney(totals.taxCents, currency)}  `,
      `**Total: ${formatMoney(totals.totalCents, currency)}**`,
      "",
      "_Draft only. Review the figures before sending._",
      "",
    ];

    const directory = join(resolve(ctx.workspace), "invoices");
    await mkdir(directory, { recursive: true });
    const path = join(directory, `invoice-${slug(client)}-${stamp}.md`);
    await writeFile(path, lines.join("\n"), "utf8");

    return {
      ok: true,
      output: `drafted ${path}\nsubtotal ${formatMoney(totals.subtotalCents, currency)} · tax ${formatMoney(
        totals.taxCents,
        currency,
      )} · total ${formatMoney(totals.totalCents, currency)}`,
    };
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const crmPayload: ToolDef = {
  name: "crm_payload",
  description: "Write a CRM contact payload to a local outbox. Sends nothing.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Contact name." },
      email: { type: "string", description: "Contact email." },
      company: { type: "string", description: "Company (optional)." },
      stage: { type: "string", description: "lead | qualified | customer" },
      notes: { type: "string", description: "Free-form notes (optional)." },
    },
    required: ["name", "email"],
  },
  mutating: true,
  capability: "local-write",
  async run(input, ctx): Promise<ToolOutcome> {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    if (name.length === 0) return { ok: false, output: "crm_payload: `name` is required" };
    if (!EMAIL.test(email)) return { ok: false, output: "crm_payload: `email` does not look like an address" };

    const stageRaw = typeof input.stage === "string" ? input.stage.trim().toLowerCase() : "lead";
    if (stageRaw !== "lead" && stageRaw !== "qualified" && stageRaw !== "customer") {
      return { ok: false, output: "crm_payload: `stage` must be lead, qualified, or customer" };
    }
    const stage = stageRaw;

    const payload = {
      name,
      email,
      company: typeof input.company === "string" ? input.company : null,
      stage,
      notes: typeof input.notes === "string" ? input.notes : null,
      createdAt: new Date().toISOString(),
      source: "arif-agent",
    };

    const directory = join(resolve(ctx.workspace), ".arif-agent", "crm-outbox");
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${Date.now().toString(36)}-${slug(name)}.json`);
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    return { ok: true, output: `wrote ${path} (nothing was sent)` };
  },
};

export const bizopsTools: ToolDef[] = [invoiceDraft, crmPayload];
