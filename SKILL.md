---
name: fleet
description: Launch parallel agent swarms (one git worktree + cmux tab per target) and diagnose/auto-fix service connections (OAuth tokens, PATs, MCP servers). Use when the user wants to run multiple agents in parallel across a repo's apps/services, set up a worktree-based swarm, check why an integration is broken, or repair/refresh OAuth and API tokens. Triggers: "spin up a swarm", "run agents in parallel", "fleet swarm", "fleet doctor", "my OAuth/connection is broken", "reconnect <service>", "check my MCP servers".
---

# fleet

A portable, dependency-light CLI with two jobs. Both work in any git repo via a
small per-repo `.fleet/` config; nothing is hardcoded to one project.

## Install (once)

```bash
git clone https://github.com/CesarBenavides777/fleet && cd fleet
bun install && bun link        # puts `fleet` on PATH
```

Requires [Bun](https://bun.sh). `swarm` also requires [cmux](https://cmux.sh)
(override the binary path with `CMUX_BIN`).

## `fleet swarm` — parallel agents over isolated worktrees

One git worktree on its own branch + one cmux tab running `claude` per target.
The cmux tabs are the view — no dashboard, no server.

```bash
fleet swarm init           # scaffold .fleet/swarm.jsonc + prompts/
fleet swarm up [names...]  # worktree + cmux tab per target (--dry-run to preview)
fleet swarm status         # compact table from per-worktree status files
fleet swarm down [names]   # remove worktrees (branches kept; --force if dirty)
fleet swarm report <name> --phase build --done 2 --total 5 --note "…"
```

When driving a swarm, prefer `--dry-run` first to show the plan, then `up`. Each
agent reads `TASK.md` in its worktree as its brief and reports via `swarm report`.

## `fleet doctor` — probe + auto-fix connections

```bash
fleet doctor        # secret backend + identity tokens (OAuth/PAT) + MCP servers
fleet doctor --fix  # interactively re-bootstrap broken identities (browser/device OAuth)
fleet doctor --json # machine-readable
```

Auto-detects the workspace's secret backend (infisical / doppler / env-vault /
1password / dotenv), validates each identity token against its provider API, and
probes configured MCP servers for reachability. `--fix` reruns OAuth/PAT bootstrap
for anything `no-token` or `invalid`. Use this first whenever a service
integration "isn't working" — it pinpoints which connection is broken before you
guess.

## `fleet identity` — manage one account

```bash
fleet identity <google|github|figma|vercel> <bootstrap|whoami|revoke|list> [accountId]
```

Picks an OAuth flow by environment (local browser callback on a TTY, device-code
on SSH/headless). Tokens persist to Infisical when `.infisical.json` is present,
else the env vars to set are printed.
