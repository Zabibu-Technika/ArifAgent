# Arif Agent dashboard

The TUI is the default interface: `arif-agent` with no arguments opens it. It is rendered by
the same pure function the tests exercise, so what you see here is the layout the
terminal gets — not a mock-up.

## Overview

```text
Arif Agent · multi-axis agent                                                 D:\Projects\Arif Agent
╭ axes ──────────────╮ ╭ overview ─────────────────────────────────────────────────────────────────╮
│  ▸ overview        │ │ workspace D:\Projects\Arif Agent                                          │
│    growth          │ │                                                                           │
│    bizops          │ │ growth    3 queued · 4 published                                          │
│    proof           │ │ bizops    2 invoice drafts                                                │
│    memory          │ │ proof     ████████ 2 receipts · proved 1/1                                │
│    accounts        │ │ memory    3 active decisions                                              │
│                    │ │ accounts  none detected — install gh or vercel                            │
│  ?  help           │ │                                                                           │
│  q  quit           │ │ next                                                                      │
│                    │ │   /queue x :: a post about the launch                                     │
│                    │ │   /invoice Acme :: consulting :: 2 :: 150 :: KES                          │
│                    │ │   /analytics sales.csv :: revenue                                         │
│                    │ │   /verify                                                                 │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
╰────────────────────╯ ╰───────────────────────────────────────────────────────────────────────────╯
› type / for commands · ? for help                                                                  
tab pane · ↑↓ move · : palette · / command · r refresh · q quit                                     
```

## Growth, with the second queued post selected

```text
Arif Agent · multi-axis agent                                                 D:\Projects\Arif Agent
╭ axes ──────────────╮ ╭ growth · social and analytics ─────────────────────────────────── 3 items ╮
│    overview        │ │    x          Undo shipped today: every change leaves a receipt.          │
│  ▸ growth          │ │  ▸ linkedin   Why we verify before we say done.                           │
│    bizops          │ │    whatsapp   Team update: invoices now draft in cents.                   │
│    proof           │ │                                                                           │
│    memory          │ │                                                                           │
│    accounts        │ │                                                                           │
│                    │ │                                                                           │
│  ?  help           │ │                                                                           │
│  q  quit           │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
╰────────────────────╯ ╰───────────────────────────────────────────────────────────────────────────╯
› type / for commands · ? for help                                                                  
tab pane · ↑↓ move · : palette · / command · r refresh · q quit                                     
```

## Proof

```text
Arif Agent · multi-axis agent                                                 D:\Projects\Arif Agent
╭ axes ──────────────╮ ╭ proof · receipts ──────────────────────────────────────────────── 2 items ╮
│    overview        │ │  ▸ proved   1/1  20261104T211600123-ab12                                  │
│    growth          │ │    partial  1/1  20261104T210200456-cd34                                  │
│    bizops          │ │                                                                           │
│  ▸ proof           │ │                                                                           │
│    memory          │ │                                                                           │
│    accounts        │ │                                                                           │
│                    │ │                                                                           │
│  ?  help           │ │                                                                           │
│  q  quit           │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
╰────────────────────╯ ╰───────────────────────────────────────────────────────────────────────────╯
› type / for commands · ? for help                                                                  
tab pane · ↑↓ move · : palette · / command · r refresh · q quit                                     
```

## Accounts — GitHub and Vercel

```text
Arif Agent · multi-axis agent                                                 D:\Projects\Arif Agent
╭ axes ──────────────╮ ╭ accounts · GitHub and Vercel ──────────────────────────────────── 4 items ╮
│    overview        │ │  ▸ ● GitHub   teh317         active · selected                            │
│    growth          │ │      GitHub   zabibu-ops                                                  │
│    bizops          │ │    ○ Vercel   Acme           selected                                     │
│    proof           │ │    ● Vercel   personal       active                                       │
│    memory          │ │                                                                           │
│  ▸ accounts        │ │                                                                           │
│                    │ │                                                                           │
│  ?  help           │ │                                                                           │
│  q  quit           │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
╰────────────────────╯ ╰───────────────────────────────────────────────────────────────────────────╯
› type / for commands · ? for help                                                                  
tab pane · ↑↓ move · : palette · / command · r refresh · q quit                                     
```

## Command palette

```text
Arif Agent · multi-axis agent                                                 D:\Projects\Arif Agent
╭ axes ──────────────╮ ╭ accounts · GitHub and Vercel ──────────────────────────────────── 4 items ╮
│    overview        │ │  ▸ ● GitHub   teh317         active · selected                            │
│    growth          │ │      GitHub   zabibu-ops                                                  │
│    bizops          │ │    ○ Vercel   Acme           selected                                     │
│    proof           │ │    ● Vercel   personal       active                                       │
│    memory          │ │                                                                           │
│  ▸ accounts        │ │                                                                           │
│                    │ │                                                                           │
│  ?  help           │ │                                                                           │
│  q  quit           │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
             ╭ commands ──────────────────────────────────────────────────────────────╮             
             │  ▸ /invoice    draft an invoice in integer cents                       │             
             ╰────────────────────────────────────────────────────────────────────────╯             
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
│                    │ │                                                                           │
╰────────────────────╯ ╰───────────────────────────────────────────────────────────────────────────╯
› type / for commands · ? for help                                                                  
tab pane · ↑↓ move · : palette · / command · r refresh · q quit                                     
```

## Commands

| Command | What it does |
| --- | --- |
| `/queue <platform> :: <text>` | Add to the local queue. Does not publish. |
| `/invoice <client> :: <desc> :: <qty> :: <price> [:: <currency>]` | Draft an invoice in integer cents. |
| `/analytics <file.csv> [:: <metric>]` | Summarise a CSV export. |
| `/verify` | Run the project's checks and write a receipt. |
| `/decision <kind> :: <title> :: <why>` | Record a decision. |
| `/sync` | Check the inherited core is current. |
| `/refresh` | Reload the snapshot. |
| `:` | Open the command palette; type to filter. |
| `accounts` page | Switch the active GitHub or Vercel account, with confirmation. |

Every command is also a CLI verb, e.g. `arif-agent queue x :: "hello"`, and both go through
the same parser.
