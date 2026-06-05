# fleet

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Portable, token-lean CLI for multi-agent work across any git repo. Two commands,
zero servers. Drops into any monorepo or polyrepo — or installs as an agent skill.

## Install

```bash
# as a CLI (requires Bun)
git clone https://github.com/CesarBenavides777/fleet && cd fleet
bun install && bun link        # puts `fleet` on PATH
fleet --help
```

```bash
# as an agent skill (skills.sh) — exposes `fleet swarm` / `fleet doctor` to your agent
npx skills.sh add CesarBenavides777/fleet
```

> Requires [Bun](https://bun.sh). `swarm` also needs [cmux](https://cmux.sh)
> (override the binary with `CMUX_BIN`).

## `fleet swarm` — parallel agents over isolated worktrees

One git worktree on its own branch + one cmux tab running `claude` per target.
The cmux tabs are the view; there's no dashboard or server.

```bash
fleet swarm init           # scaffold .fleet/swarm.jsonc + prompts/ in this repo
fleet swarm up             # worktree + cmux tab per target
fleet swarm up web chat    # only named targets
fleet swarm up --dry-run   # print the plan, touch nothing
fleet swarm status         # compact table (reads a tiny status file per worktree)
fleet swarm down [names]   # remove worktrees (branches kept; --force if dirty)
fleet swarm report <name> --phase build --done 2 --total 5 --note "…"
```

`.fleet/swarm.jsonc` (per repo):

```jsonc
{
  "base": "dev", // branch to fork worktrees from
  "worktreeDir": "../<repo>-worktrees",
  "branchPrefix": "swarm/",
  "claudeArgs": "--permission-mode acceptEdits",
  "targets": [{ "name": "web", "prompt": ".fleet/prompts/web.md", "cwd": "apps/web" }],
}
```

Each agent reads `TASK.md` (dropped into its worktree) as its brief, stays in its
lane, commits on its branch, and reports progress with `fleet swarm report`.

Requires `cmux` (`/Applications/cmux.app/…/bin/cmux`; override with `CMUX_BIN`).

## `fleet doctor` — probe + auto-fix connections

```bash
fleet doctor          # secret backend + identity tokens (OAuth/PAT) + MCP servers
fleet doctor --fix    # interactively re-bootstrap broken identities (browser/device OAuth)
fleet doctor --json   # machine-readable
```

Adapts per workspace automatically:

- **Secret backend** auto-detected: infisical / doppler / env-vault / 1password / dotenv.
- **Identities** read from `config/identities.yaml` (or `apps/agents/config/…`); each
  token is validated against its provider API (Google refresh, GitHub/Figma/Vercel `whoami`).
- **MCP servers** read from `.mcp.json` / `.claude/settings.json` and probed for reachability.
- `--fix` reruns the OAuth/PAT bootstrap for anything `no-token` or `invalid`.

## `fleet identity` — manage one account

```bash
fleet identity <google|github|figma|vercel> <bootstrap|whoami|revoke|list> [accountId]
```

The OAuth core picks a flow by environment: local browser callback on an
interactive TTY, device-code on SSH/headless. Tokens persist to Infisical when a
`.infisical.json` is present, otherwise the env vars to set are printed.

---

Dependency-light (commander, clack, picocolors, yaml) and self-contained, so the
same binary serves every workspace.

## License

MIT © Cesar Benavides — see [LICENSE](./LICENSE).
