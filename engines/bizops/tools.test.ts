// Business operations engine.
//
// Money is the part that must be exactly right; the rest is just a file write.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bizopsTools, formatMoney, invoiceTotals } from "./tools.ts";

async function withWorkspace(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "arif-agent-bizops-"));
  try {
    await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function tool(name: string) {
  const found = bizopsTools.find((candidate) => candidate.name === name);
  assert.ok(found !== undefined, `missing tool ${name}`);
  return found;
}

test("totals are computed in integer cents and tax is rounded once", () => {
  const totals = invoiceTotals(
    [
      { description: "Design", quantity: 3, unitPriceCents: 33_333 }, // 99,999
      { description: "Hosting", quantity: 1, unitPriceCents: 1 }, // 1
    ],
    16,
  );
  assert.equal(totals.subtotalCents, 100_000);
  assert.equal(totals.taxCents, 16_000);
  assert.equal(totals.totalCents, 116_000);
  assert.equal(formatMoney(totals.totalCents, "KES"), "KES 1,160.00");
});

test("an invoice is drafted with its totals visible", async () => {
  await withWorkspace(async (dir) => {
    const result = await tool("invoice_draft").run(
      {
        client: "Acme Ltd",
        items: [{ description: "Consulting", quantity: 2, unit_price: 150.5 }],
        currency: "KES",
        tax_rate: 16,
      },
      { workspace: dir },
    );
    assert.equal(result.ok, true, result.output);
    assert.match(result.output, /total KES 349\.16/);

    const path = result.output.split("drafted ")[1]?.split("\n")[0] ?? "";
    const body = await readFile(path, "utf8");
    assert.match(body, /Subtotal: \*\*KES 301\.00\*\*/);
    assert.match(body, /Draft only/);
  });
});

test("two invoices to the same client on the same day do not overwrite each other", async () => {
  await withWorkspace(async (dir) => {
    const args = {
      client: "Acme Ltd",
      items: [{ description: "Consulting", quantity: 1, unit_price: 100 }],
      currency: "KES",
    };
    const first = await tool("invoice_draft").run(args, { workspace: dir });
    const second = await tool("invoice_draft").run(args, { workspace: dir });
    assert.equal(first.ok, true, first.output);
    assert.equal(second.ok, true, second.output);

    const firstPath = first.output.split("drafted ")[1]?.split("\n")[0] ?? "";
    const secondPath = second.output.split("drafted ")[1]?.split("\n")[0] ?? "";
    assert.notEqual(firstPath, secondPath, "a second invoice must not overwrite the first");
    assert.match(await readFile(secondPath, "utf8"), /\*\*Total: KES 100\.00\*\*/);
  });
});

test("an invoice is dated by the local calendar, not UTC", async () => {
  await withWorkspace(async (dir) => {
    const result = await tool("invoice_draft").run(
      { client: "Acme", items: [{ description: "Work", quantity: 1, unit_price: 10 }] },
      { workspace: dir },
    );
    assert.equal(result.ok, true, result.output);
    const path = result.output.split("drafted ")[1]?.split("\n")[0] ?? "";
    const body = await readFile(path, "utf8");

    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, "0");
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    assert.match(body, new RegExp(`Issued: ${expected}`), "an invoice must carry the date the human sees");
  });
});

test("a bad quantity is refused instead of producing a negative invoice", async () => {
  await withWorkspace(async (dir) => {
    const result = await tool("invoice_draft").run(
      { client: "X", items: [{ description: "Refund", quantity: -1, unit_price: 10 }] },
      { workspace: dir },
    );
    assert.equal(result.ok, false);
    assert.match(result.output, /greater than zero/);
  });
});

test("a CRM payload goes to a local outbox and a bad address is refused", async () => {
  await withWorkspace(async (dir) => {
    const bad = await tool("crm_payload").run({ name: "A", email: "not-an-email" }, { workspace: dir });
    assert.equal(bad.ok, false);
    assert.match(bad.output, /does not look like an address/);

    const badStage = await tool("crm_payload").run(
      { name: "A", email: "a@example.com", stage: "customer-ish" },
      { workspace: dir },
    );
    assert.equal(badStage.ok, false, "an unknown stage must not be silently downgraded");
    assert.match(badStage.output, /must be lead, qualified, or customer/);

    const good = await tool("crm_payload").run(
      { name: "Amina Okoro", email: "amina@example.com", stage: "qualified" },
      { workspace: dir },
    );
    assert.equal(good.ok, true, good.output);
    const path = good.output.split("wrote ")[1]?.split(" (nothing")[0] ?? "";
    const payload = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    assert.equal(payload.name, "Amina Okoro");
    assert.equal(payload.stage, "qualified");
    assert.equal(payload.source, "arif-agent");
  });
});
