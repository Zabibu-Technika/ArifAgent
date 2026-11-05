// Headless smoke for Arif Agent's dashboard.
//
// The pure renderer is tested separately; this drives the real state machine: alternate
// screen in and out, a command typed through the key parser, and a clean exit. It runs
// without a TTY, which is where most terminal bugs hide.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTui } from "../cli/tui.ts";

const workspace = mkdtempSync(join(tmpdir(), "arif-agent-tui-smoke-"));
writeFileSync(
  join(workspace, "package.json"),
  JSON.stringify({ name: "demo", scripts: { test: 'node -e "process.exit(0)"' } }),
);

const painted = [];
const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk) => {
  painted.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
  return true;
};

process.stdin.setRawMode = () => {};
process.stdin.setEncoding = () => {};
process.stdin.resume = () => {};
process.stdin.pause = () => {};

const press = (text) => process.stdin.emit("data", text);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let finished = false;
const cleanup = () => {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  process.stdout.write = realWrite;
  rmSync(workspace, { recursive: true, force: true });
};

const deadline = setTimeout(() => {
  cleanup();
  console.error("SMOKE FAIL (arif-agent tui): the dashboard never exited");
  process.exit(1);
}, 15_000);

const session = runTui(workspace, { force: true });
await wait(120);
press("/queue x :: smoke post");
press("\r");
await wait(600);
press("q");
await session;

try {
  const raw = painted.join("");
  assert.ok(raw.includes("\u001b[?1049h"), "the alternate screen was never entered");
  assert.ok(raw.includes("\u001b[?1049l"), "the alternate screen was never left");

  const plain = raw.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
  assert.ok(plain.includes("arif-agent"), "the header was never painted");
  assert.ok(plain.includes("overview"), "the rail was never painted");
  assert.ok(plain.includes("╭"), "no borders were painted");
  assert.ok(plain.includes("smoke post") || plain.includes("queued"), "the command result never appeared");

  const queue = readFileSync(join(workspace, ".arif-agent", "queue.jsonl"), "utf8");
  assert.match(queue, /smoke post/, "the command did not reach the queue");
} finally {
  cleanup();
}

console.log(
  `SMOKE PASS (Arif Agent dashboard): ${painted.length} chunks painted, the alt screen was entered and left, and a queued command landed.`,
);
