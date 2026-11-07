import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lspAction, mcpAction, subagentAction } from "./actions.ts";

test("lsp needs an action and a file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arif-lsp-"));
  try {
    const result = await lspAction(dir, []);
    assert.equal(result.ok, false);
    assert.match(result.message, /usage: lsp/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mcp call rejects malformed JSON before starting a server", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arif-mcp-"));
  try {
    const result = await mcpAction(dir, ["call", "mcp__x__y"], "{not json");
    assert.equal(result.ok, false);
    assert.match(result.message, /valid JSON/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("subagent needs a prompt", async () => {
  const result = await subagentAction(".", "   ");
  assert.equal(result.ok, false);
  assert.match(result.message, /usage: subagent/);
});
