#!/usr/bin/env node
// Arif Agent's command line. The dashboard is the default; every action is also a verb so it
// can be scripted, and both go through the same parser as the TUI's command line.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { dispatch, runTui, statusText, ARIF_AGENT_ROOT } from "./tui.ts";
import { loadSnapshot } from "./data.ts";
import { defaultBaseWorkspace, ensureBaseWorkspace } from "../core/onboard/device.ts";

const HELP = `
  Arif Agent — the multi-axis agent
  code · growth · business operations, on one verified core

  usage:
    arif-agent                         open the dashboard
    arif-agent status                  print the current snapshot and exit
    arif-agent queue <platform> :: <text>
    arif-agent invoice <client> :: <desc> :: <qty> :: <price> [:: <currency>]
    arif-agent analytics <file.csv> [:: <metric>]
    arif-agent verify                  run the project's checks, write a receipt
    arif-agent decision <kind> :: <title> :: <why>
    arif-agent sync                    check the inherited core is current
    arif-agent help

  options:
    -C, --workspace <dir>        where the engines read and write (default: cwd)
    -h, --help                   show this help
    -v, --version                print the version

  in the dashboard:
    tab switch axis · ↑↓ move · / command · ? help · q quit
`;

function version(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(ARIF_AGENT_ROOT, "package.json"), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      workspace: { type: "string", short: "C" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
  });

  if (values.help === true) {
    console.log(HELP);
    return;
  }
  if (values.version === true) {
    console.log(version());
    return;
  }

  const workspace =
    values.workspace !== undefined
      ? resolve(values.workspace)
      : await ensureBaseWorkspace(defaultBaseWorkspace());
  const command = (positionals[0] ?? "tui").toLowerCase();
  const args = positionals.slice(1);

  if (command === "tui" || command === "dashboard") {
    await runTui(workspace);
    return;
  }

  if (command === "status") {
    console.log(statusText(await loadSnapshot(workspace)));
    return;
  }

  if (command === "help") {
    console.log(HELP);
    return;
  }

  const result = await dispatch(workspace, [command, ...args].join(" "));
  switch (result.kind) {
    case "result":
      console.log(result.result.message);
      process.exitCode = result.result.ok ? 0 : 1;
      return;
    case "refresh":
      console.log(statusText(await loadSnapshot(workspace)));
      return;
    case "help":
      console.log(HELP);
      return;
    case "quit":
      return;
    default:
      console.log(HELP);
  }
}

await main();
