# Release benchmarks and competitive position

Measured **2026-11-05** on Windows 11 Pro (10.0.26220), Intel Core i5-6300U
(2 cores / 4 threads), 7.8 GB RAM. These are release facts for **Arif Agent v0.2.0**,
not a model-quality benchmark.

## Release facts

| Item | Value |
|---|---|
| Version | 0.2.0 |
| Windows package | `arif-agent-0.2.0-win-x64.zip` |
| Zip size | 35,313,538 bytes (33.7 MB) |
| Installed size | 87.4 MB |
| Bundled runtime | Node v24.14.1 |
| SHA256 | `49ed39bf8e62a9e58f02d8bb295c15eaea4dc779e236bf8599614cfd2365432c` |
| Signature | Authenticode, Zabibu Technika development certificate |
| Tests | 25 pass |
| Test duration | 4,590 ms |
| Typecheck | clean |
| Runtime npm dependencies | 0 (inherited core included) |

## Measured runtime

| Measurement | Result |
|---|---|
| `arif-agent.exe --version`, warm (5 runs) | 1.92 s, 2.14 s, 2.32 s, 2.35 s, 7.91 s |
| Warm median | **2.32 s** |
| Cold first run | 7.91 s |
| `arif-agent.exe status` | 4.22 s |
| Packaged `queue twitter :: ...` | completed, returned a queue id |
| Packaged `invoice ...` | completed, wrote a local markdown draft |

Arif starts faster than Weaver because its CLI surface is smaller; it still pays the same
Node/TypeScript startup cost. The `sync` command is a developer check that spawns Python and
expects a sibling `ZabibuWeaver` checkout. The shipped package already contains the inherited
core, so `sync` is not needed to run the agent.

## End-to-end checks on the packaged build

- Extracted the release zip and ran `arif-agent.exe --version` → `0.2.0`.
- Ran `arif-agent.exe status` against the shared base workspace.
- Queued a post locally; nothing was published.
- Drafted an invoice; the result was a local markdown file with integer-cent arithmetic.
- Verified the GitHub release asset's stored SHA256 digest matches the local build.
- `install.ps1` installed into a custom directory and the installed executable ran.

Not yet measured: real publishing and CRM adapters, long-running business workflows,
multi-account switching under failure, and model-quality comparisons.

## Competitive position

There is no direct like-for-like competitor with the same three axes in one local agent.
The realistic alternatives are a coding agent plus separate SaaS tools, or a general agent
with plugins. The comparison is therefore about integration and proof, not raw model quality.

| Capability | Arif Agent | Coding agent + SaaS | General agent + plugins |
|---|---|---|---|
| Code, growth, and bizops in one runtime | **yes** | no | partial |
| Local-first / offline-capable | **yes** | no | no |
| One proof receipt across axes | **yes** | no | no |
| Reversible external actions (two-phase journal) | **yes** | no | partial |
| Multiple GitHub/Vercel identities, explicit switch | **yes** | no | no |
| Real publishing adapters | no (local queue only) | yes | yes |
| Real CRM/accounting integrations | no (local outbox/drafts) | yes | yes |
| Mature plugin ecosystem | no | yes | yes |
| Benchmarked on business tasks | no | vendor claims | vendor claims |

**Where Arif is ahead.** It treats code, growth, and business operations as one product with
one verification and reversibility model. Drafting, queueing, and publishing are separate
actions; nothing is sent by a draft. The account switcher is explicit. It inherits Weaver's
gate and receipts instead of reimplementing them.

**Where Arif is behind.** It is early (0.2.0). Publishing is a local queue with no adapter by
default; CRM writes go to a local outbox; invoices are markdown drafts, not an accounting
integration. There is no plugin ecosystem, no real business-task benchmark, and no
multi-user or server mode. The Windows build still uses a development certificate.

**What would change the answer.** Real adapters for at least one publishing platform and one
CRM, a 20-task business-workflow benchmark with receipts, and a hosted/team mode. Until then,
the honest claim is: one local agent, three axes, same proof — with integrations still to come.

## Reproduce

```powershell
cd ArifAgent
npm test
npm run typecheck
.\packaging\build-windows.ps1
```

Then extract `dist\arif-agent-0.2.0-win-x64.zip`, run `arif-agent.exe --version`, and compare
the zip hash with `dist\SHA256SUMS.txt`.
