/* Arif Agent — interactive TUI demo
   Static, scripted, and local. Nothing here runs a real command. */

(() => {
  "use strict";

  const root = document.getElementById("arif-tui");
  if (!root) return;

  const screen = document.getElementById("tui-screen");
  const form = document.getElementById("tui-form");
  const input = document.getElementById("tui-input");
  const paneTitle = document.getElementById("tui-pane-title");
  const paneMeta = document.getElementById("tui-pane-meta");
  const ghLabel = document.getElementById("tui-gh");
  const vcLabel = document.getElementById("tui-vc");
  const demoButton = document.getElementById("tui-demo");

  const palette = document.getElementById("tui-palette");
  const paletteInput = document.getElementById("tui-palette-input");
  const paletteList = document.getElementById("tui-palette-list");
  const accountsModal = document.getElementById("tui-accounts");
  const accountList = document.getElementById("tui-account-list");

  const state = {
    pane: "overview",
    github: "teh317",
    vercel: "Zabibu Technika",
    history: [],
    historyIndex: 0,
    busy: false,
    returnFocus: null,
    paletteItems: [],
    paletteIndex: 0
  };

  const PANES = {
    overview: { title: "Overview", meta: "proof 1/1 · 0 deps · local-first" },
    code: { title: "Code", meta: "weaver engine · gated" },
    growth: { title: "Growth", meta: "analytics · queue · egress" },
    bizops: { title: "Bizops", meta: "invoices · CRM · local outbox" },
    proof: { title: "Proof", meta: "last receipt · sha256 bound" },
    memory: { title: "Memory", meta: "decision ledger · bounded" },
    accounts: { title: "Accounts", meta: "GitHub · Vercel" },
    compare: { title: "Compare", meta: "feature matrix · not a benchmark" }
  };

  const GH_OPTIONS = [
    { name: "teh317", detail: "personal" },
    { name: "zabibu-ops", detail: "organization" }
  ];
  const VC_OPTIONS = [
    { name: "Zabibu Technika", detail: "team" },
    { name: "personal", detail: "hobby" }
  ];

  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad = (value, width) => String(value) + " ".repeat(Math.max(0, width - String(value).length));

  function scroll() {
    screen.scrollTop = screen.scrollHeight;
  }

  function line(html, className = "") {
    const el = document.createElement("div");
    el.className = "tui-line" + (className ? " " + className : "");
    el.innerHTML = html;
    screen.appendChild(el);
    scroll();
    return el;
  }

  function rule() {
    line('<span class="tui-dim">────────────────────────────────────────────────────────────</span>');
  }

  function table(text) {
    const pre = document.createElement("pre");
    pre.className = "tui-table";
    pre.textContent = text;
    screen.appendChild(pre);
    scroll();
  }

  function chips(commands) {
    const wrap = document.createElement("div");
    wrap.className = "tui-chips";
    commands.forEach((cmd) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tui-chip";
      button.dataset.cmd = cmd;
      button.textContent = cmd;
      wrap.appendChild(button);
    });
    screen.appendChild(wrap);
    scroll();
  }

  function clearScreen() {
    screen.innerHTML = "";
  }

  function setBusy(busy) {
    state.busy = busy;
    input.disabled = busy;
    demoButton.disabled = busy;
    screen.setAttribute("aria-busy", busy ? "true" : "false");
    root.classList.toggle("is-busy", busy);
  }

  function renderSideAccounts() {
    ghLabel.textContent = state.github;
    vcLabel.textContent = state.vercel;
  }

  function status() {
    line('axes      <span class="tui-white">code</span>   <span class="tui-white">growth</span>   <span class="tui-white">bizops</span>');
    line('proof     <span class="tui-ok">1 receipt · proved 1/1</span>');
    line(`accounts  <span class="tui-ok">●</span> GitHub   <span class="tui-white">${esc(state.github)}</span>            <span class="tui-dim">active</span>`);
    line(`          <span class="tui-warn">○</span> Vercel   <span class="tui-white">${esc(state.vercel)}</span>  <span class="tui-dim">selected</span>`);
    line('workspace <span class="tui-white">~/.weaver/workspace</span>');
  }

  function banner() {
    line('<span class="tui-accent">ZABIBU ARIF 0.2.0</span> <span class="tui-dim">· multi-axis workspace</span>');
    line('Verified core inherited from Weaver. <span class="tui-dim">Type</span> help <span class="tui-dim">or press</span> <span class="tui-coral">:</span> <span class="tui-dim">for the palette.</span>');
    rule();
  }

  function welcome() {
    clearScreen();
    banner();
    status();
    line("Try:", "tui-dim");
    chips([
      "code fix the auth redirect",
      "growth summarize october.csv",
      "bizops invoice acme 125000",
      "compare --all",
      "demo"
    ]);
  }

  function help() {
    line('<span class="tui-accent">COMMANDS</span> <span class="tui-dim">· type a name, or press :</span>');
    COMMANDS.forEach((cmd) => {
      line(`<span class="tui-coral">${pad(cmd.name, 10)}</span><span class="tui-dim">${esc(cmd.desc)}</span>`);
    });
    line('<span class="tui-dim">Also:</span> 1–7 switch panes · ↑↓ history · tab complete · esc close overlays');
    chips(["status", "compare --all", "demo", "download"]);
  }

  async function codeTurn(args) {
    const task = args || "fix the auth redirect";
    line(`<span class="tui-dim">task</span> ${esc(task)} <span class="tui-dim">· gate canary</span>`);
    await sleep(250);
    line('● Read(src/core/auth.ts)  <span class="tui-ok">✓ 18ms</span>');
    await sleep(280);
    line('● Edit(src/core/auth.ts)  <span class="tui-ok">✓ 24ms</span>');
    await sleep(280);
    line('● Bash(npm test)  <span class="tui-ok">✓ 2.4s</span>');
    await sleep(360);
    line('[ proof ] <span class="tui-ok">proved — 3/3 checks passed</span>', "tui-warn");
    line('<span class="tui-dim">receipt .weaver/receipts/20261107T…-demo.md</span>');
    line('<span class="tui-dim">self-authored checks: no · canary 9f2c… · undo available</span>');
    chips(["proof", "undo", "compare --all"]);
  }

  async function growthTurn(args) {
    const task = args || "summarize october.csv";
    line(`<span class="tui-dim">task</span> ${esc(task)} <span class="tui-dim">· analytics</span>`);
    await sleep(260);
    line('● analytics_summary(external)  <span class="tui-ok">✓ 312 rows</span>');
    line('  revenue <span class="tui-ok">+18.4%</span> · activation <span class="tui-ok">+6.2%</span> · churn <span class="tui-ok">−1.1%</span>');
    await sleep(300);
    line('● queue_post(draft)  <span class="tui-ok">✓ local only</span>');
    line('  draft queued: <span class="tui-white">"October in five numbers"</span>');
    await sleep(260);
    line('publish_post is <span class="tui-warn">egress</span>; no adapter configured — nothing sent.', "tui-warn");
    chips(["proof", "memory", "compare --all"]);
  }

  async function bizopsTurn(args) {
    const task = args || "invoice acme 125000";
    line(`<span class="tui-dim">task</span> ${esc(task)} <span class="tui-dim">· local outbox</span>`);
    await sleep(260);
    line('● invoice_draft(acme)  <span class="tui-ok">✓</span>');
    line('  subtotal <span class="tui-white">1,250.00 USD</span> · tax 0.00 · total <span class="tui-white">1,250.00</span>');
    line('  local date <span class="tui-white">2026-11-07</span> · outbox <span class="tui-white">./invoices/acme-2026-11-07.md</span>');
    await sleep(260);
    line('sent: <span class="tui-ok">no</span> <span class="tui-dim">· draft only · integer cents</span>');
    chips(["proof", "memory", "compare --all"]);
  }

  function proof() {
    line('[ proof ] <span class="tui-ok">proved — 3/3 checks passed</span>', "tui-warn");
    table(
      "check          result  exit  time\n" +
      "typecheck      PASS    0     1.1s\n" +
      "test           PASS    0     2.4s\n" +
      "lint           PASS    0     0.8s\n" +
      "sha256         bound   —     —\n" +
      "self-authored  no      canary 9f2c…"
    );
    line('<span class="tui-dim">A check the agent authored is capped at partial. A human signs the receipt.</span>');
  }

  function memory() {
    line('<span class="tui-accent">DECISION LEDGER</span> <span class="tui-dim">· append-only · bounded</span>');
    table(
      "id    kind        entry\n" +
      "a1f2  decision    Use the keyless endpoint first\n" +
      "b7c1  superseded  Pin the model to the fastest free tier\n" +
      "c4d2  constraint  Do not touch billing migrations\n" +
      "d9e3  assumption  Workspace is ~/.weaver/workspace"
    );
    line('<span class="tui-dim">Changing your mind supersedes an entry; it never deletes the trail.</span>');
  }

  function undo() {
    line('checkpoint <span class="tui-white">9f2c</span> <span class="tui-dim">before Edit(src/core/auth.ts)</span>');
    line('restored <span class="tui-ok">1 file</span> · removed 0 files · workspace sweep complete');
    line('journal 2 phases · compensation written <span class="tui-dim">before the external action</span>');
  }

  const MATRIX = [
    ["multi-axis (code + growth + bizops)", "✓", "✗", "✗", "✗"],
    ["proof receipt per turn", "✓", "✗", "✗", "✗"],
    ["deterministic gate", "✓", "✗", "~", "✗"],
    ["decision memory", "✓", "✗", "~", "✗"],
    ["undo without git", "✓", "git", "✗", "✗"],
    ["explicit account switching", "✓", "~", "✗", "~"],
    ["local-first / offline", "✓", "~", "✗", "~"],
    ["zero runtime dependencies", "✓", "✗", "✗", "✗"],
    ["model freedom", "✓", "✓", "vendor", "vendor"],
    ["MCP / plugins / subagents", "roadmap", "✓", "✓", "✓"]
  ];

  function matrixText() {
    const header = pad("CATEGORY", 37) + pad("ARIF", 9) + pad("OPENCODE", 10) + pad("CLAUDE", 9) + "CODEX";
    const rows = MATRIX.map((row) => pad(row[0], 37) + pad(row[1], 9) + pad(row[2], 10) + pad(row[3], 9) + row[4]);
    return [header].concat(rows).join("\n");
  }

  const VERDICTS = {
    opencode: "OpenCode wins on ecosystem breadth today (MCP, plugins, subagents). Arif wins on proof, breadth, undo, and identity.",
    claude: "Claude Code wins on vendor polish and ecosystem breadth. Arif wins on proof, multi-axis work, undo, and explicit accounts.",
    codex: "Codex wins on vendor distribution. Arif wins on proof, local-first operation, multi-axis work, and account discipline."
  };

  function compare(args) {
    const mode = String(args || "").replace(/^--?/, "").trim().toLowerCase().replace(/\s+code$/, "");
    line('<span class="tui-accent">ARIF AGENT vs THE FIELD</span> <span class="tui-dim">· feature matrix, not a benchmark</span>');
    table(matrixText());
    line('<span class="tui-dim">✓ yes · ✗ no · ~ partial · git = needs git · vendor = vendor-locked</span>');
    line('Arif leads <span class="tui-ok">9 of 10</span> categories in this matrix.', "tui-accent");
    line('OpenCode leads on ecosystem breadth today (MCP, plugins, subagents). That is the honest gap.', "tui-dim");
    if (VERDICTS[mode]) {
      line(`VERDICT / ${mode.toUpperCase()}: ${VERDICTS[mode]}`, "tui-warn");
    } else if (mode && mode !== "all") {
      line(`No head-to-head for "${esc(mode)}". Try: compare opencode | claude | codex | --all`, "tui-dim");
    }
    line('<span class="tui-dim">Other editors and chat agents: same gaps, more surface.</span>');
  }

  function accountsSummary() {
    line('<span class="tui-accent">ACCOUNTS</span> <span class="tui-dim">· one chosen account per provider</span>');
    line(`GitHub   <span class="tui-ok">●</span> ${esc(state.github)} <span class="tui-dim">active</span>   <span class="tui-warn">○</span> ${state.github === "teh317" ? "zabibu-ops" : "teh317"}`);
    line(`Vercel   <span class="tui-ok">●</span> ${esc(state.vercel)} <span class="tui-dim">selected</span>   <span class="tui-warn">○</span> ${state.vercel === "Zabibu Technika" ? "personal" : "Zabibu Technika"}`);
    line('<span class="tui-dim">Switching is a modal: account, consequence, and the way back.</span>');
  }

  function accounts() {
    accountsSummary();
    openAccounts();
  }

  function openAccounts() {
    if (state.busy) return;
    state.returnFocus = document.activeElement;
    accountsModal.hidden = false;
    renderAccountModal();
    const first = accountList.querySelector("button");
    if (first) first.focus();
  }

  function renderAccountModal() {
    accountList.innerHTML = "";
    const groups = [
      { provider: "github", label: "GitHub", options: GH_OPTIONS, active: state.github },
      { provider: "vercel", label: "Vercel", options: VC_OPTIONS, active: state.vercel }
    ];
    groups.forEach((group) => {
      group.options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tui-account-item" + (option.name === group.active ? " is-active" : "");
        button.dataset.accountProvider = group.provider;
        button.dataset.accountName = option.name;
        const badge = option.name === group.active
          ? '<span class="tui-badge">active</span>'
          : '<span class="tui-badge is-selected">switch</span>';
        button.innerHTML = `<span>${esc(group.label)} · ${esc(option.name)}<em>${esc(option.detail)}</em></span>${badge}`;
        accountList.appendChild(button);
      });
    });
  }

  function closeAccounts() {
    accountsModal.hidden = true;
    const target = state.returnFocus && document.contains(state.returnFocus) ? state.returnFocus : input;
    target.focus();
  }

  function applySwitch(provider, name) {
    if (provider === "github") state.github = name;
    if (provider === "vercel") state.vercel = name;
    renderSideAccounts();
    line(`switched ${provider} → <span class="tui-white">${esc(name)}</span>`, "tui-ok");
    line('<span class="tui-dim">selection is per workspace; the way back is one command.</span>');
  }

  function switchAccount(args) {
    const parts = String(args || "").trim().split(/\s+/).filter(Boolean);
    const provider = (parts.shift() || "").toLowerCase();
    const name = parts.join(" ");
    if (!provider || !name) {
      line("usage: switch github &lt;name&gt; | vercel &lt;name&gt;", "tui-warn");
      line("options: teh317, zabibu-ops, Zabibu Technika, personal", "tui-dim");
      return;
    }
    const options = provider === "github" ? GH_OPTIONS : provider === "vercel" ? VC_OPTIONS : null;
    if (!options) {
      line(`unknown provider: ${esc(provider)}. Use github or vercel.`, "tui-warn");
      return;
    }
    const match = options.find((option) => option.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      line(`unknown ${provider} account: ${esc(name)}`, "tui-warn");
      line(`options: ${options.map((option) => option.name).join(", ")}`, "tui-dim");
      return;
    }
    applySwitch(provider, match.name);
  }

  function openPalette() {
    if (state.busy) return;
    state.returnFocus = document.activeElement;
    palette.hidden = false;
    paletteInput.value = "";
    renderPalette("");
    paletteInput.focus();
  }

  function closePalette() {
    palette.hidden = true;
    const target = state.returnFocus && document.contains(state.returnFocus) ? state.returnFocus : input;
    target.focus();
  }

  function renderPalette(filter) {
    const query = String(filter || "").toLowerCase();
    const rank = (cmd) => {
      const name = cmd.name.toLowerCase();
      if (name === query) return 0;
      if (name.startsWith(query)) return 1;
      if (name.includes(query)) return 2;
      return 3;
    };
    state.paletteItems = COMMANDS
      .filter((cmd) => cmd.name.toLowerCase().includes(query) || cmd.desc.toLowerCase().includes(query))
      .sort((a, b) => rank(a) - rank(b));
    state.paletteIndex = 0;
    paletteList.innerHTML = "";
    state.paletteItems.forEach((cmd, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tui-palette-item" + (index === 0 ? " is-active" : "");
      button.dataset.cmd = cmd.name;
      button.innerHTML = `<b>${esc(cmd.name)}</b><span>${esc(cmd.desc)}</span>`;
      paletteList.appendChild(button);
    });
  }

  function movePalette(delta) {
    if (!state.paletteItems.length) return;
    state.paletteIndex = (state.paletteIndex + delta + state.paletteItems.length) % state.paletteItems.length;
    const items = paletteList.querySelectorAll(".tui-palette-item");
    items.forEach((item, index) => item.classList.toggle("is-active", index === state.paletteIndex));
    if (items[state.paletteIndex]) items[state.paletteIndex].scrollIntoView({ block: "nearest" });
  }

  function closeOverlays() {
    if (!palette.hidden) palette.hidden = true;
    if (!accountsModal.hidden) accountsModal.hidden = true;
    if (document.contains(input)) input.focus();
  }

  function about() {
    line('<span class="tui-accent">ARIF AGENT</span> <span class="tui-dim">· the agentic extension of Zabibu Arif</span>');
    line('One agent loop. Three axes. One verified core inherited from Weaver. Built local-first for the machines people actually have.');
    line('<span class="tui-dim">Code, growth, and business operations — with proof, memory, undo, and explicit accounts.</span>');
  }

  function download() {
    line('<span class="tui-accent">ARIF AGENT 0.2.0</span> <span class="tui-dim">· Windows 10/11 x64 · 33.7 MB</span>');
    line('<a class="tui-link" href="https://github.com/Zabibu-Technika/ArifAgent/releases/latest/download/arif-agent-0.2.0-win-x64.zip" target="_blank" rel="noopener">arif-agent-0.2.0-win-x64.zip</a>');
    line('<span class="tui-dim">Node 24 included · SHA256 published · dev-signed. One-line install is on the page below.</span>');
  }

  function v6() {
    line('<span class="tui-accent">ZABIBU ARIF 6</span> <span class="tui-dim">· coming soon</span>');
    line('Speech detection · canvas-based interface · professional tools built in · offline/native build · and more.');
    line('<a class="tui-link" href="https://zabibuarif.vercel.app" target="_blank" rel="noopener">zabibuarif.vercel.app</a>');
  }

  function openProduct() {
    line('<span class="tui-accent">ZABIBU ARIF</span> <span class="tui-dim">· the product</span>');
    line('The multi-axis workspace for thinking, making, and running the work.');
    line('<a class="tui-link" href="https://zabibuarif.lovable.app" target="_blank" rel="noopener">zabibuarif.lovable.app</a>');
  }

  async function demo() {
    if (state.busy) return;
    setBusy(true);
    clearScreen();
    banner();
    await sleep(600);
    for (const command of ["status", "code fix the auth redirect", "proof", "compare --all"]) {
      await sleep(650);
      await runCommand(command, { demo: true });
    }
    await sleep(500);
    line("Demo complete. Type <span class=\"tui-white\">help</span>, or press <span class=\"tui-coral\">:</span> for the palette.", "tui-dim");
    setBusy(false);
    input.focus();
  }

  function pushHistory(command) {
    if (state.history[state.history.length - 1] !== command) state.history.push(command);
    state.historyIndex = state.history.length;
  }

  function echo(command) {
    line(`<span class="tui-prompt-inline">›</span>${esc(command)}`, "tui-cmd");
  }

  async function runCommand(raw, options = {}) {
    const command = String(raw || "").trim();
    if (!command) return;
    if (state.busy && !options.demo) return;
    if (!options.demo) {
      input.value = "";
      pushHistory(command);
    }
    echo(command);
    const name = command.split(/\s+/)[0].toLowerCase();
    const args = command.slice(name.length).trim();
    const definition = COMMANDS.find((item) => item.name === name);
    if (!definition) {
      line(`unknown command: <span class="tui-warn">${esc(name)}</span>. Type <span class="tui-white">help</span>.`, "tui-warn");
      return;
    }
    const heavy = name === "code" || name === "growth" || name === "bizops";
    if (heavy && !options.demo) setBusy(true);
    try {
      await definition.run(args, options);
    } finally {
      if (heavy && !options.demo) {
        setBusy(false);
        input.focus();
      }
    }
  }

  function selectPane(name) {
    if (state.busy || !PANES[name]) return;
    state.pane = name;
    document.querySelectorAll(".tui-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.pane === name);
    });
    paneTitle.textContent = PANES[name].title;
    paneMeta.textContent = PANES[name].meta;
    clearScreen();

    if (name === "overview") {
      welcome();
      return;
    }
    if (name === "code") {
      line('<span class="tui-accent">CODE</span> <span class="tui-dim">· the mono-axis engine, inherited from Weaver</span>');
      line("Read, edit, search, run, verify. Every change is gated before it happens.");
      line("Run:", "tui-dim");
      chips(["code fix the auth redirect", "proof", "undo"]);
      return;
    }
    if (name === "growth") {
      line('<span class="tui-accent">GROWTH</span> <span class="tui-dim">· analytics, queue, publishing</span>');
      line("Summarise a CSV, draft a post, queue it locally. Publishing is a separate egress action.");
      line("Run:", "tui-dim");
      chips(["growth summarize october.csv", "proof", "compare --all"]);
      return;
    }
    if (name === "bizops") {
      line('<span class="tui-accent">BIZOPS</span> <span class="tui-dim">· invoices and CRM, in integer cents</span>');
      line("Invoice totals use integer cents and local dates. CRM payloads land in a local outbox.");
      line("Run:", "tui-dim");
      chips(["bizops invoice acme 125000", "proof", "memory"]);
      return;
    }
    if (name === "proof") {
      proof();
      return;
    }
    if (name === "memory") {
      memory();
      return;
    }
    if (name === "accounts") {
      accountsSummary();
      openAccounts();
      return;
    }
    if (name === "compare") {
      compare("");
    }
  }

  const COMMANDS = [
    { name: "help", desc: "List every command", run: help },
    { name: "status", desc: "Axes, proof, accounts, workspace", run: status },
    { name: "code", desc: "Run a gated coding turn", run: codeTurn },
    { name: "growth", desc: "Summarize a CSV and queue a draft", run: growthTurn },
    { name: "bizops", desc: "Draft an invoice in integer cents", run: bizopsTurn },
    { name: "proof", desc: "Inspect the last proof receipt", run: proof },
    { name: "memory", desc: "Read the decision ledger", run: memory },
    { name: "undo", desc: "Restore the last checkpoint", run: undo },
    { name: "compare", desc: "Arif vs OpenCode, Claude Code, Codex", run: compare },
    { name: "accounts", desc: "Open the account switcher", run: accounts },
    { name: "switch", desc: "switch github <name> | vercel <name>", run: switchAccount },
    { name: "demo", desc: "Run the scripted demo", run: demo },
    { name: "open", desc: "Open Zabibu Arif", run: openProduct },
    { name: "download", desc: "Get Arif Agent 0.2 for Windows", run: download },
    { name: "v6", desc: "Zabibu Arif 6 — coming soon", run: v6 },
    { name: "about", desc: "What Arif Agent is", run: about },
    { name: "clear", desc: "Clear the screen", run: clearScreen }
  ];

  /* events */

  document.querySelectorAll(".tui-tab").forEach((tab) => {
    tab.addEventListener("click", () => selectPane(tab.dataset.pane));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    runCommand(value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === ":" && input.value === "") {
      event.preventDefault();
      openPalette();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (state.historyIndex > 0) {
        state.historyIndex -= 1;
        input.value = state.history[state.historyIndex] || "";
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (state.historyIndex < state.history.length) state.historyIndex += 1;
      input.value = state.history[state.historyIndex] || "";
      return;
    }
    if (event.key === "Tab") {
      const value = input.value.trim();
      if (!value) return;
      const match = COMMANDS.find((cmd) => cmd.name.startsWith(value.toLowerCase()));
      if (match) {
        event.preventDefault();
        input.value = match.name + " ";
      }
      return;
    }
    if (/^[1-8]$/.test(event.key) && input.value === "") {
      event.preventDefault();
      selectPane(["overview", "code", "growth", "bizops", "proof", "memory", "accounts", "compare"][Number(event.key) - 1]);
    }
  });

  paletteInput.addEventListener("input", () => renderPalette(paletteInput.value));

  paletteInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      movePalette(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      movePalette(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = state.paletteItems[state.paletteIndex];
      if (selected) {
        closePalette();
        runCommand(selected.name);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
  });

  accountsModal.addEventListener("keydown", (event) => {
    const buttons = [...accountList.querySelectorAll("button")];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(current + 1 + buttons.length) % buttons.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      buttons[(current - 1 + buttons.length) % buttons.length].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAccounts();
    }
  });

  root.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close]");
    if (close) {
      if (close.dataset.close === "palette") closePalette();
      if (close.dataset.close === "accounts") closeAccounts();
      return;
    }

    const account = event.target.closest("[data-account-provider]");
    if (account) {
      applySwitch(account.dataset.accountProvider, account.dataset.accountName);
      closeAccounts();
      return;
    }

    const command = event.target.closest("[data-cmd]");
    if (command) {
      if (!palette.hidden) closePalette();
      runCommand(command.dataset.cmd);
      return;
    }

    if (event.target === palette) closePalette();
    if (event.target === accountsModal) closeAccounts();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOverlays();
  });

  demoButton.addEventListener("click", demo);

  renderSideAccounts();
  selectPane("overview");

  /* A small hook for tests and future integrations. */
  window.__arifTui = {
    runCommand,
    selectPane,
    openPalette,
    openAccounts,
    state,
    commands: COMMANDS
  };
})();
