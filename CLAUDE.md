# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`fleet` is a Bun-native CLI, published as a Claude Code skill, with two jobs: **launch
parallel Claude agents** across isolated git worktrees + cmux/tmux surfaces (with a live
board and a file-based status/comms bus), and **diagnose/repair service connections**
(OAuth tokens, PATs, MCP servers). It runs in any git repo via a small per-repo `.fleet/`
config — nothing is hardcoded to one project. The repo is a **Turborepo monorepo** being
grown into the flagship skill for skills.org.

## Commands

Package manager is **Bun** (`bun.lock`, `engines.bun >= 1.1`). Bun executes `.ts` directly,
so there is **no dev build step**.

```bash
bun install                       # wire the workspaces
bunx turbo run check-types        # tsc --noEmit across all packages (the only "test" today)
bun run check-types               # same, via the root script
bun apps/cli/src/index.ts <cmd>   # run the CLI in dev (or `bun run fleet <cmd>`)
cd apps/cli && bun run build      # bundle @fleet/* → dist/index.js + copy board assets → dist/assets
```

There is no test suite or linter yet. To check a single package, run `tsc --noEmit` in that
package dir (e.g. `cd packages/swarm && bun run check-types`). `bun link` in `apps/cli` puts
`fleet` on PATH (after a `build`, since `bin` → `dist/index.js`).

## Monorepo layout

- `apps/cli` — the published binary `@cesarbenavides/fleet`. Thin commander root
  (`src/index.ts`) that composes the package commands, plus the `onboard` wizard. It is the
  **only** published package; everything under `packages/*` is private (`@fleet/*`) and
  consumed via `workspace:*`. The publish bundle inlines them with `bun build`.
- `packages/core` — `sh()` (the one shell-out site), `gitRoot`/`currentBranch`, `parseJsonc`,
  and `p`/`pc` (one import site for @clack/prompts + picocolors). Everything else depends on it.
- `packages/mux` — terminal-multiplexer **driver seam**. `MuxDriver` (`newSurface`, `renameTab`,
  `send`, `sendKey`, `readScreen`) with `cmux.ts` and `tmux.ts` implementations; `selectMux()`
  picks by `FLEET_MUX` env → config `mux` → auto-detect.
- `packages/bus` — the file-based status/comms **bus** + the `fleet bus` command.
- `packages/swarm` — orchestration (config, worktrees, prepare/launch/status/down), the
  no-cache board **server**, the **watchdog**, and the board **assets** (`assets/board.*`,
  `assets/THREAD.template.md`). The largest package; start here for swarm changes.
- `packages/doctor`, `packages/identity` — connection probing and OAuth/PAT bootstrap (moved
  verbatim from the original single-package layout; `doctor` depends on `identity`).

## Architecture that spans files

**The swarm rig (the heart of it).** A *thread* = one git worktree on its own branch + one mux
*surface* running `claude`. There is no coordination server or message bus between agents —
coordination is filesystem-based and pull-based:

- **cmux surfaces, not workspaces.** Agents launch via `new-surface` (a tab), then `send` (types
  the command) + `send-key Enter` (submits, with a double-Enter guard), staggered ~8s to avoid
  Anthropic 529/Overloaded. This lives in `packages/swarm/src/launch.ts` over `@fleet/mux`. Using
  `new-workspace` (a sidebar workspace) is the classic bug — don't reintroduce it.
- **Permission boundary.** The harness blocks an orchestrator agent from bulk-launching agents.
  So `fleet swarm prepare` (agent-safe: worktrees, `.swarm/`, seed `.mcp.json`, bus init, start
  server) is separated from `fleet swarm launch` (**the user runs this** to spawn surfaces).
  `fleet swarm up` = prepare + launch, for a human typing it directly. When *you* set up a swarm,
  run `prepare` and then tell the user to run `launch`.
- **The bus** (`@fleet/bus`). Each agent writes ONLY its own two files — `.swarm/status/<id>.json`
  (read-modify-write) and `.swarm/comms/<id>.jsonl` (append) — so there is zero multi-writer
  contention. Readers merge everyone's files. `resolveSwarmDir()` finds the main repo's `.swarm/`
  from inside a worktree via `git rev-parse --git-common-dir` (or `FLEET_SWARM_DIR`, set into each
  agent's launch env). Agents call `fleet bus status|post|inbox|feed|blocker` from any cwd.
- **The board** (`assets/board.*`, served by `src/server.ts`). A no-cache static server bound to
  127.0.0.1 (`FLEET_PORT`/config `port`, default 8787); the board polls `config.json` +
  `status/*.json` + `comms/*.jsonl` every 2s. The server runs detached (re-invoking the CLI's
  `swarm serve`) so `prepare` returns. The board reads its thread list from `config.json` — never
  a hardcoded constant; **escape all HTML** when editing `board.js`.
- **The watchdog** (`src/watch.ts`). Reads `id → surfaceRef` from `.swarm/surfaces.env`, scans each
  surface with `readScreen` for `Overloaded|529|API Error|…`; if still retrying ("esc to interrupt")
  it leaves it, else posts a blocker on the bus (deduped 5min/thread), nudging only with `--nudge`.

**Authored vs. generated state.** `.fleet/` is authored & committed: `swarm.jsonc` (threads) +
`prompts/<id>.md` (each thread's THREAD.md). `.swarm/` is generated by `prepare` and git-ignored:
`config.json`, `status/`, `comms/`, `surfaces.env`, `server.log`, the copied board assets, and
`launch.sh`. A thread's `prompt` file is copied into its worktree as `THREAD.md` and hidden via
the worktree's `.git/info/exclude` (along with a seeded `.mcp.json`, since MCP doesn't follow
worktrees).

**doctor / identity.** `fleet doctor` auto-detects the secret backend (infisical / doppler /
env-vault / 1password / dotenv), validates each identity in `config/identities.yaml` against its
provider API, and probes MCP servers from `.mcp.json` / `.claude/settings.json`; `--fix` reruns
bootstrap. `fleet identity <provider> <action>` bootstraps tokens (Google OAuth via local
callback on a TTY or device-code on SSH/headless; GitHub/Figma/Vercel PATs) and persists to
Infisical when `.infisical.json` is present, else prints the env vars to set.

## Conventions worth knowing

- **Threads must be non-overlapping.** When authoring a swarm from a plan, give each thread a
  disjoint file/dir ownership set; use shared `CONTRACT-*.md` files as the seam between threads
  that share an interface. Agents never merge/deploy/apply migrations/push to protected branches.
- **Config schema:** `.fleet/swarm.jsonc` `targets[]` (alias `threads[]`) of
  `{ name, title?, color?, prompt?, task?, repo?, base?, cwd? }`, plus top-level `base`,
  `worktreeDir`, `branchPrefix`, `claudeArgs`, `mux`, `port`. JSONC = whole-line `//` comments only.
- **Status file schema:** `{ thread, title, phase, repo, branch, worktree, progress:{done,total},
  currentStep, pr, steps:[{title,status,note}], blockers:[], updatedAt }`; timestamps are UTC
  truncated to seconds.
- **Identity env-var naming:** `GOOGLE_REFRESH_TOKEN__<ACCOUNTID>`, `GITHUB_TOKEN__<ACCOUNTID>`,
  `FIGMA_TOKEN__<ACCOUNTID>`, `VERCEL_TOKEN__<ACCOUNTID>`, plus `<PROVIDER>_{EMAIL,SCOPES,
  BOOTSTRAPPED_AT}__<ACCOUNTID>` (see `packages/identity/src/infisical.ts`).
- **External binaries:** `cmux` (`CMUX_BIN`, default `/Applications/cmux.app/…/bin/cmux`) or
  `tmux`; `infisical` CLI (`INFISICAL_BIN`) when persisting secrets; `lsof`/`kill` for server
  teardown.
- Adding a new `@fleet/*` package: copy an existing `package.json` + `tsconfig.json` (extends
  `../../tsconfig.base.json`, `exports` → `./src/index.ts`), add it as a `workspace:*` dep where
  consumed, and `bun install`. `verbatimModuleSyntax` is on — use explicit `.js` extensions on
  relative imports and `import type` for types.
