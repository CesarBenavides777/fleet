# fleet

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

![fleet demo](docs/demo.gif)

Parallel agent swarms with better ergonomics — one git worktree + one cmux/tmux **surface** per
thread, a live local **board**, and a file-based **status/comms bus** — plus a **connection
doctor** for OAuth/PAT/MCP. Works in any git repo. A **Turborepo** monorepo, published as a
Claude Code skill.

## Install

```bash
# as a CLI (requires Bun)
git clone https://github.com/CesarBenavides777/fleet && cd fleet
bun install
cd apps/cli && bun run build && bun link    # puts `fleet` on PATH
fleet --help
```

```bash
# as an agent skill (skills.sh)
npx skills.sh add CesarBenavides777/fleet
```

> Requires [Bun](https://bun.sh). `swarm` needs [cmux](https://cmux.sh) (override with `CMUX_BIN`)
> or `tmux` (`FLEET_MUX=tmux`).

## `fleet swarm` — parallel agents over isolated worktrees

A *thread* = one git worktree on its own branch + one mux surface running `claude`. A live board
and a file-based bus give you visibility without a server-of-record between agents.

```bash
fleet onboard                  # slick first-run wizard
fleet swarm init               # scaffold .fleet/swarm.jsonc + prompts/
fleet swarm plan               # scaffold a THREAD prompt per thread from the template
fleet swarm prepare            # worktrees + .swarm/ + seed .mcp.json + bus + board server (agent-safe)
fleet swarm launch             # YOU spawn the agent surfaces (the permission boundary)
fleet swarm up                 # human convenience = prepare + launch
fleet swarm status | board | watch
fleet swarm down [names]       # remove worktrees (branches kept; --force if dirty)
fleet bus status|post|inbox|feed|blocker …   # agents report + coordinate from any cwd
```

**Permission boundary:** the orchestrator agent runs `prepare`; **you** run `launch`. The harness
blocks an agent from bulk-launching agents, so the skill prepares everything and you spawn the
surfaces under your own authority.

`.fleet/swarm.jsonc` (per repo) — authored & committed:

```jsonc
{
  "base": "dev",
  "worktreeDir": "../<repo>-worktrees",
  "branchPrefix": "swarm/",
  "claudeArgs": "--permission-mode acceptEdits",
  "mux": "cmux", // or "tmux"; omit to auto-detect
  "port": 8787,
  "targets": [
    { "name": "web", "title": "Web", "color": "#0ea5e9", "prompt": ".fleet/prompts/web.md", "cwd": "apps/web" }
  ],
}
```

`prepare` generates a git-ignored `.swarm/` (board assets, `config.json`, `status/`, `comms/`,
`surfaces.env`, `launch.sh`). Each agent reads its `THREAD.md`, stays in its lane, commits on its
branch, and reports via `fleet bus status` / `post`. Threads must own **disjoint** files; use
`CONTRACT-*.md` as the seam where two threads share an interface.

## `fleet doctor` — probe + auto-fix connections

```bash
fleet doctor          # secret backend + identity tokens (OAuth/PAT) + MCP servers
fleet doctor --fix    # interactively re-bootstrap broken identities
fleet doctor --json   # machine-readable
```

Auto-detects the secret backend (infisical / doppler / env-vault / 1password / dotenv), validates
each identity in `config/identities.yaml` against its provider API, and probes MCP servers from
`.mcp.json` / `.claude/settings.json`. `--fix` reruns OAuth/PAT bootstrap for anything broken.

## `fleet identity` — manage one account

```bash
fleet identity <google|github|figma|vercel> <bootstrap|whoami|revoke|list> [accountId]
```

Picks an OAuth flow by environment (local browser callback on a TTY, device-code on SSH/headless).
Tokens persist to Infisical when `.infisical.json` is present, otherwise the env vars to set are printed.

## Monorepo layout

```
apps/cli              @cesarbenavides/fleet — the published binary (commander root + onboard)
packages/core         sh/git/jsonc + clack/picocolors re-exports
packages/mux          cmux + tmux driver seam
packages/bus          file-based status + comms bus
packages/swarm        orchestration + board server + watchdog + board assets
packages/doctor       connection probes
packages/identity     OAuth/PAT bootstrap
```

Bun workspaces + Turborepo. `bunx turbo run check-types` to type-check all packages; Bun runs the
`.ts` directly so there's no dev build step. See [CLAUDE.md](./CLAUDE.md) for architecture details.

## License

MIT © Cesar Benavides — see [LICENSE](./LICENSE).
