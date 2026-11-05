// Growth engine.
//
// The important assertions are about restraint: analytics can read, the queue can write,
// and publishing refuses until someone configures a real adapter. A test that only
// checked the happy path would not notice the day that default changed.
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { growthTools, parseDelimited } from "./tools.ts";

async function withWorkspace(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "arif-agent-growth-"));
  try {
    await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function tool(name: string) {
  const found = growthTools.find((candidate) => candidate.name === name);
  assert.ok(found !== undefined, `missing tool ${name}`);
  return found;
}

test("the CSV parser handles quoted commas and doubled quotes", () => {
  const rows = parseDelimited('name,note,amount\n"Acme, Ltd","said ""hello""",1200\nBeta,plain,300\n');
  assert.deepEqual(rows[0], ["name", "note", "amount"]);
  assert.deepEqual(rows[1], ["Acme, Ltd", 'said "hello"', "1200"]);
});

test("analytics sums numeric columns and ranks by a metric", async () => {
  await withWorkspace(async (dir) => {
    await writeFile(
      join(dir, "sales.csv"),
      ["rep,region,revenue,units", "Amina,North,1200,12", "Kwame,South,900,9", "Zola,North,300,3"].join("\n"),
      "utf8",
    );

    const result = await tool("analytics_summary").run(
      { path: "sales.csv", metric: "revenue", top: 2 },
      { workspace: dir },
    );
    assert.equal(result.ok, true, result.output);
    assert.match(result.output, /revenue \| 2400/);
    assert.match(result.output, /top 2 by revenue/);
    assert.match(result.output, /1200/);
    assert.match(result.output, /900/);
  });
});

test("analytics refuses to read outside the workspace", async () => {
  await withWorkspace(async (dir) => {
    const result = await tool("analytics_summary").run({ path: "../../etc/passwd" }, { workspace: dir });
    assert.equal(result.ok, false);
    assert.match(result.output, /outside|workspace|ENOENT/i);
  });
});

test("a queued post is local, and publishing refuses with no adapter", async () => {
  await withWorkspace(async (dir) => {
    const queued = await tool("queue_post").run(
      { platform: "x", text: "We shipped undo today." },
      { workspace: dir },
    );
    assert.equal(queued.ok, true, queued.output);
    assert.match(queued.output, /nothing was published/i);

    const queue = await readFile(join(dir, ".arif-agent", "queue.jsonl"), "utf8");
    assert.match(queue, /undo today/);

    delete process.env.ARIF_AGENT_PUBLISH_ENDPOINT;
    const published = await tool("publish_post").run({ id: "whatever" }, { workspace: dir });
    assert.equal(published.ok, false);
    assert.match(published.output, /no adapter configured/i);
    assert.match(published.output, /Nothing was sent/i);
  });
});

test("publishing records a compensation and refuses to send the same post twice", async () => {
  await withWorkspace(async (dir) => {
    let hits = 0;
    const server = createServer((_request, response) => {
      hits += 1;
      response.writeHead(200);
      response.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");
    process.env.ARIF_AGENT_PUBLISH_ENDPOINT = `http://127.0.0.1:${address.port}`;

    try {
      const queued = await tool("queue_post").run({ platform: "x", text: "hello" }, { workspace: dir });
      const id = queued.output.match(/queued (\S+)/)?.[1];
      assert.ok(id !== undefined, queued.output);

      const first = await tool("publish_post").run({ id }, { workspace: dir });
      assert.equal(first.ok, true, first.output);
      assert.equal(hits, 1);

      const second = await tool("publish_post").run({ id }, { workspace: dir });
      assert.equal(second.ok, false, "a second publish must be refused");
      assert.match(second.output, /already published/);
      assert.equal(hits, 1, "the duplicate must not reach the platform");

      const journal = await readFile(join(dir, ".weaver", "actions.jsonl"), "utf8");
      assert.match(journal, /publish_post/);
      assert.match(journal, /"status":"applied"/);
      assert.match(journal, /delete the post from x/);
    } finally {
      delete process.env.ARIF_AGENT_PUBLISH_ENDPOINT;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
