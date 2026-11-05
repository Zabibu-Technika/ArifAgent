# Arif Agent

The multi-axis extension of [Zabibu Weaver](https://github.com/Zabibu-Technika/ZabibuWeaver).
Weaver is deliberately narrow: it does software engineering, deeply, with a deterministic
gate. Arif Agent inherits that core and adds the axes that are not code — growth and
business operations — on the same verification, memory, reversibility, and provenance rules.

It is a **sibling repository**, not a subfolder:

```
Projects/
├── ZabibuWeaver/       upstream: core/, engines/coding/, src/ (the runnable engine)
└── ArifAgent/          this repository
    ├── core/           generated copy of ../ZabibuWeaver/core
    ├── engines/
    │   ├── coding/     generated copy of ../ZabibuWeaver/engines/coding
    │   ├── growth/     owned here: analytics, social queue, publishing
    │   └── bizops/     owned here: invoices, CRM outbox
    ├── site/           marketing site, deployed to arifagent.vercel.app
    └── sync-daemon.py
```

## Repositories and site

- **Code:** this repository — <https://github.com/Zabibu-Technika/ArifAgent>
- **Arif site:** [`site/`](site/) — <https://arifagent.vercel.app>
- **Weaver (upstream):** <https://github.com/Zabibu-Technika/ZabibuWeaver>
- **Fikra site and product hub:** <https://github.com/Zabibu-Technika/ZabibuFikra> — <https://zabibufikra.vercel.app>
- **Company site:** <https://zabibu.vercel.app>

A standalone clone needs its sibling: clone `ZabibuWeaver` beside this repository, then run
`npm run sync`. The daemon looks for `../ZabibuWeaver` (and the old `../Zabibu Weaver` name)
or accepts `--upstream PATH`. The site is deployed from `site/` with
`vercel --prod --yes --project arifagent`.

## What is inherited and what is owned

| Path | Owner | Why |
| --- | --- | --- |
| `core/` | **generated** | verification, decision memory, rollback journal, routing, scope |
| `engines/coding/` | **generated** | the coding engine contract |
| `engines/growth/` | owned | social and analytics tools |
| `engines/bizops/` | owned | invoices and CRM payloads |

Generated paths are gitignored. Run `npm run sync` (or `python sync-daemon.py`) after
pulling Weaver.

The daemon refuses to overwrite a file you edited locally: it hashes what it copied last
time, and a mismatch is reported as a conflict rather than silently resolved. `--force`
discards your edit; that is a deliberate speed bump, not an inconvenience to work around.

## Windows build (no Node required)

`arif-agent.exe` is a self-contained Windows x64 build: a native launcher, the official Node
24 runtime, and the app. Node does not need to be installed on the machine.

- **Download:** [arif-agent-0.2.0-win-x64.zip](https://github.com/Zabibu-Technika/ArifAgent/releases/latest/download/arif-agent-0.2.0-win-x64.zip)
- **One-line install (PowerShell):**

  ```powershell
  irm https://raw.githubusercontent.com/Zabibu-Technika/ArifAgent/main/packaging/install.ps1 | iex
  ```

- **Manual:** extract the zip, run `Install.cmd`, then `arif-agent`.

The release publishes `SHA256SUMS.txt` and `release.json`. The launcher is Authenticode-signed
with the Zabibu Technika development certificate; a publicly trusted certificate is the
remaining step for SmartScreen trust on a clean machine. See
[packaging/SIGNING.md](packaging/SIGNING.md).

Build the package yourself:

```powershell
.\packaging\build-windows.ps1
```

## Safety posture

Arif Agent uses Weaver's tool contract, so the same three declarations apply to every tool:

- `capability` — `read`, `local-write`, `destructive`, `egress`, or `unbounded`
- `mutating` — whether it changes anything
- `ingest` — what provenance its output carries

The consequences are practical:

- **`queue_post` writes locally.** It does not publish. Drafting and publishing are not
  the same action and must never share a permission path.
- **`publish_post` is `egress` and refuses by default.** It requires
  `ARIF_AGENT_PUBLISH_ENDPOINT`. Without an adapter it returns an error and sends nothing.
- **`analytics_summary` declares `ingest: "external"`.** A CSV export came from somewhere
  else; it is data, not instructions.
- **`invoice_draft` computes in integer cents** and writes a markdown draft. It sends
  nothing, and the file says so.
- **`crm_payload` writes to a local outbox.** A human or a separately-authorized
  integration sends it.

Anything that leaves the machine should be planned through `core/safety/rollback.ts`
*before* it runs, so the compensation is written down while it is still true. That module
is implemented and tested; wiring it into a real publishing adapter is the next step.

## Dashboard

`arif-agent` opens the dashboard; `arif-agent status` prints the same snapshot as text.

With no `--workspace` / `-C`, the dashboard reads and writes the shared base
`~/.weaver/workspace`; `-C <dir>` chooses another. This is the same base Weaver's setup
writes, so documents and code do not land in system directories by default.

The screen is a rail of axes, a pane, a command line, and a footer. It is produced by a
pure renderer, so every line is exactly the window width — a test asserts that at 100×30,
and a smoke drives the real state machine with no TTY. Frames use the shared pending-wrap
fix, so a full-width row cannot erase its own right border.

Keys: `tab` switch axis · `↑↓` / `j` / `k` move · `enter` inspect · `/` command · `:` palette
· `?` help · `q` quit.

| Command | What it does |
| --- | --- |
| `/queue <platform> :: <text>` | Add to the local queue. Does not publish. |
| `/invoice <client> :: <desc> :: <qty> :: <price> [:: <currency>]` | Draft an invoice in integer cents. |
| `/analytics <file.csv> [:: <metric>]` | Summarise a CSV export. |
| `/verify` | Run the project's checks and write a receipt. |
| `/decision <kind> :: <title> :: <why>` | Record a decision. |
| `/sync` | Check the inherited core is current. |
| `/refresh` | Reload the snapshot. |

Every dashboard command is also a CLI verb:

```bash
arif-agent queue x :: "a post about the launch"
arif-agent invoice Acme :: consulting :: 2 :: 150 :: KES
arif-agent analytics sales.csv :: revenue
arif-agent verify
arif-agent decision choice :: "Use checkpoints" :: "git is slow here"
arif-agent sync
```

`arif-agent` is the command; **Arif Agent** is the product. State lives in `.arif-agent/`
(queue, published, CRM outbox). Earlier builds used `.arif/`; rename that directory once if
you have data there.

If the terminal is smaller than 76×20, or not a TTY, it falls back to a line REPL.

A rendered frame is in [docs/tui.md](docs/tui.md).

## Accounts

The `accounts` page lists the CLIs detected on this machine and their accounts. `enter`
opens a confirmation modal; `y` switches. `:` opens the command palette; type to filter.

- **GitHub** comes from `gh auth status --json hosts`; `gh auth switch` changes the identity
  used for pushes and pull requests.
- **Vercel** comes from `vercel teams ls` (JSON first, table fallback) plus `vercel whoami`;
  `vercel switch <scope>` changes the deploy identity.
- **Any other CLI** can add a manifest under `.weaver/integrations/<id>.json`.

The choice is remembered in `.weaver/integrations.json`. The CLI remains the source of truth;
if it disagrees with the remembered choice, the accounts page shows both rather than picking
one silently.

## Commands

```bash
npm start         # open the dashboard
npm run smoke:tui # drive the TUI headlessly
npm run sync      # materialise core/ and engines/coding/ from the sibling Weaver
npm run check     # report drift without changing anything (exit 1 if drifted)
npm test          # sync first, then run the engine and CLI tests
npm run typecheck # TypeScript, with Arif Agent's own dev toolchain
```

`npm test` has a `pretest` hook that runs the sync, so a stale inherited core cannot
silently pass. The engines import nothing from Weaver's runtime — only Node builtins and
`core/` — which is what lets Arif Agent be its own project.

## Status

The engines are real tools with tests, and the dashboard and CLI are shipped. Arif Agent still
does not have an LLM agent loop or provider configuration: the TUI is a deterministic
control surface over the engines, not a chat window. The intended path is to reuse
Weaver's loop through `core/`, not copy `src/`.

## Direction

The shared roadmap is
[ZabibuWeaver/ROADMAP.md](https://github.com/Zabibu-Technika/ZabibuWeaver/blob/main/ROADMAP.md).
Arif Agent's own items are
workstream K, and the African-realities and self-dependence constraints in workstreams I
and J apply here too.
