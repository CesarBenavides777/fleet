---
name: fleet
description: Launch parallel agent swarms (one git worktree + one cmux/tmux surface per thread) with a live board and a file-based status/comms bus, and diagnose/auto-fix service connections (OAuth tokens, PATs, MCP servers). Use when the user wants to run multiple agents in parallel across a repo, fan out N agents on worktrees with a live board, set up a worktree-based swarm, check why an integration is broken, or repair/refresh OAuth and API tokens. Triggers - "spin up a swarm", "fan out N agents on worktrees", "parallel build with a live board", "run agents in parallel", "fleet swarm", "fleet doctor", "my OAuth/connection is broken", "reconnect <service>", "check my MCP servers".
---

# fleet

A Bun CLI with two jobs, working in any git repo via a small per-repo `.fleet/` config:
**parallel agent swarms** (worktree + cmux/tmux surface per thread, live board, status/comms
bus) and a **connection doctor** (OAuth/PAT/MCP probe + auto-fix).

## Install (once)

```bash
git clone https://github.com/CesarBenavides777/fleet && cd fleet
bun install && (cd apps/cli && bun run build && bun link)   # puts `fleet` on PATH
```

Requires [Bun](https://bun.sh). `swarm` needs [cmux](https://cmux.sh) (override with `CMUX_BIN`)
or `tmux` (set `FLEET_MUX=tmux`).

## Author a swarm from a plan (you do this)

The skill does NOT expect a hand-written manifest. Given a natural-language description (or a
plan file), **you** decompose it into N **non-overlapping** threads and author the prompts:

1. **Non-collision is the whole game.** Give each thread a disjoint file/dir ownership set,
   disjoint migration-number blocks, separate edge-function dirs. Two threads editing the same
   file collide; one frontend-only + one backend-only thread never do. Use shared `CONTRACT-*.md`
   files as the seam between threads that must agree on an interface.
2. Write one `.fleet/prompts/<id>.md` (THREAD.md) per thread — `fleet swarm plan` scaffolds these
   from the template; fill in **Own ONLY these files**, **Do NOT touch**, numbered build steps
   ending in a draft PR, real-evidence Verify (lint is NOT proof), and the Fleet protocol block.
3. List the threads in `.fleet/swarm.jsonc`.

## Run it

```bash
fleet swarm init               # scaffold .fleet/swarm.jsonc + prompts/
fleet swarm plan [names...]    # scaffold a THREAD prompt per thread from the template
fleet swarm prepare [names...] # AGENT-SAFE: worktrees + .swarm/ + seed .mcp.json + bus + board server
fleet swarm launch [names...]  # USER-RUN: spawn one surface per thread (the user runs this)
fleet swarm up [names...]      # human convenience = prepare + launch
fleet swarm status             # compact table from the bus status files
fleet swarm board              # open the live board
fleet swarm watch [--nudge]    # watchdog: scan surfaces for 529/Overloaded, post blockers
fleet swarm down [names]       # remove worktrees (branches kept; --force if dirty), stop server
fleet bus status|post|inbox|feed|blocker …   # agents report progress / coordinate from any cwd
```

### **Permission boundary (critical)**

**The skill prepares; the USER runs `launch`.** The harness auto-mode classifier blocks an
orchestrator agent from bulk-launching agents. So when you set up a swarm, run
`fleet swarm prepare` (worktrees, `.swarm/`, seed mcp, bus, server) and then **tell the user to
run `fleet swarm launch`** (or `bash .swarm/launch.sh`) — the agents then run under the user's
authority. Each agent launches with `claude --permission-mode acceptEdits` and prompts in-tab for
bash approvals. No `--dangerously-skip-permissions`, no broad allowlist. `fleet swarm up`
(prepare+launch) is for a human typing it directly, never for an agent.

### Gotchas baked in (don't undo them)

- **Surfaces, not workspaces.** Agents spawn via cmux `new-surface` (a tab) → `send` (types) →
  `send-key Enter` (submits), with a double-Enter guard. `new-workspace` makes a sidebar, not a tab.
- **Stagger ~8s** between spawns — N agents firing their first request at once causes 529/Overloaded.
- **No-cache board server** on 127.0.0.1 (`FLEET_PORT`, default 8787): `Cache-Control: no-store…`
  or the board serves stale JSON.
- **MCP doesn't follow worktrees** — `.mcp.json` is seeded into each worktree before launch, and
  hidden (with THREAD.md) via the worktree's `.git/info/exclude` so agents don't commit them.
- **Bus = no DB, no sockets.** Each agent writes only its own `status/<id>.json` + `comms/<id>.jsonl`.
- **Agents never merge/deploy/apply migrations/push to protected branches** — those gates stay human.
  Commit author must match the repo's required identity (some CI rejects a mismatch).
- **Teardown:** `fleet swarm down` removes worktrees and stops the server; closing a cmux tab does
  NOT delete worktree files on disk.

## `fleet doctor` — probe + auto-fix connections

```bash
fleet doctor        # secret backend + identity tokens (OAuth/PAT) + MCP servers
fleet doctor --fix  # interactively re-bootstrap broken identities (browser/device OAuth)
fleet doctor --json # machine-readable
```

Auto-detects the secret backend (infisical / doppler / env-vault / 1password / dotenv), validates
each identity in `config/identities.yaml` against its provider API, and probes MCP servers for
reachability. Use this first whenever a service integration "isn't working".

## `fleet identity` / `fleet onboard`

```bash
fleet identity <google|github|figma|vercel> <bootstrap|whoami|revoke|list> [accountId]
fleet onboard   # slick first-run wizard: connection check → connect a service → scaffold a swarm
```

Tokens persist to Infisical when `.infisical.json` is present, else the env vars to set are printed.
