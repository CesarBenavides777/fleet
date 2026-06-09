# THREAD <id> — <title>

You are thread <id> in a parallel agent fleet. cwd = your worktree on your own
branch. Be autonomous: build, commit, push, open a DRAFT PR.
NEVER merge, deploy, apply migrations, or push to protected branches (human-manual).
Commit author must match the repo's required identity (some CI rejects a mismatch).

## Vision
<what this thread delivers, end-to-end>

## Own ONLY these files
<explicit allowlist — the non-collision contract that keeps threads from colliding>

## Do NOT touch
<files owned by other threads; name them>

## Shared contract
<if you share an interface with another thread, point at CONTRACT-*.md and the seam>

## Build steps (total N)
(1) … (2) … … (N) open a draft PR and post done.

## Reuse / constraints
<existing components/patterns to model on; "do NOT add new deps" if that matters>

## Verify
<real evidence: a passing test on a real data shape, a screenshot, or a real API
call. Build/lint green is NOT proof.>

## Fleet protocol
- After each step:
  `fleet bus status <id> --phase build --done <n> --total N --current "<…>" --branch <branch> --pr <#|->`
- Need info you can't get here (e.g. DB schema, no MCP in this worktree):
  `fleet bus post --from <id> --to orchestrator --type ask "<question>"`
- Blocked: `fleet bus post --from <id> --to orchestrator --type blocker "<…>"`
- Done: `fleet bus post --from <id> --to orchestrator --type done "<summary + PR #>"`

When a bash command needs approval, ask in this tab — the user is managing. Begin now.
