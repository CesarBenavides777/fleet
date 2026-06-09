import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { p, pc } from "@fleet/core";
import { fleetDir, requireRoot } from "./config.js";

function sampleConfig(repoName: string): string {
  return [
    "{",
    "  // Branch each worktree forks from. Omit to use the current branch.",
    '  "base": "dev",',
    `  // Worktrees live here (relative to repo root). Default: ../${repoName}-worktrees`,
    `  "worktreeDir": "../${repoName}-worktrees",`,
    '  "branchPrefix": "swarm/",',
    '  "claudeArgs": "--permission-mode acceptEdits",',
    '  // Terminal multiplexer: "cmux" (macOS) or "tmux". Omit to auto-detect.',
    '  // "mux": "cmux",',
    '  "port": 8787,',
    "  // Each thread = one worktree + one surface. Keep ownership DISJOINT.",
    '  "targets": [',
    '    {',
    '      "name": "example",',
    '      "title": "Example thread",',
    '      "color": "#7c3aed",',
    '      "prompt": ".fleet/prompts/example.md",',
    '      "cwd": "."',
    "    }",
    "  ]",
    "}",
    "",
  ].join("\n");
}

const EXAMPLE_PROMPT = [
  "# THREAD example — Example thread",
  "",
  "You are one agent in a parallel swarm, working in an isolated git worktree on your",
  "own branch. Be autonomous: build, commit, push, open a DRAFT PR.",
  "NEVER merge, deploy, apply migrations, or push to protected branches (human-manual).",
  "",
  "## Own ONLY these files",
  "- <explicit allowlist — your non-collision contract>",
  "## Do NOT touch",
  "- <files owned by other threads; name them>",
  "",
  "## Build steps (total N)",
  "(1) … (2) … … (N) open a draft PR and post done.",
  "",
  "## Verify",
  "- Real evidence (passing test on real data, screenshot, real API call). Lint is NOT proof.",
  "",
  "## Fleet protocol",
  "- After each step: `fleet bus status example --phase build --done <n> --total N --current \"…\"`",
  "- Need info you can't get here: `fleet bus post --from example --to orchestrator --type ask \"…\"`",
  "- Blocked: `fleet bus post --from example --to orchestrator --type blocker \"…\"`",
  "- Done: `fleet bus post --from example --to orchestrator --type done \"summary + PR #\"`",
  "When a bash command needs approval, ask in this tab. Begin now.",
  "",
].join("\n");

export function initScaffold(): void {
  const root = requireRoot();
  const dir = fleetDir(root);
  const repoName = root.split("/").pop() ?? "repo";
  mkdirSync(join(dir, "prompts"), { recursive: true });

  const cfgPath = join(dir, "swarm.jsonc");
  if (existsSync(cfgPath)) {
    p.log.warn(".fleet/swarm.jsonc already exists — leaving it.");
  } else {
    writeFileSync(cfgPath, sampleConfig(repoName));
    p.log.success("wrote .fleet/swarm.jsonc");
  }

  const promptPath = join(dir, "prompts", "example.md");
  if (!existsSync(promptPath)) {
    writeFileSync(promptPath, EXAMPLE_PROMPT);
    p.log.success("wrote .fleet/prompts/example.md");
  }
  p.outro(
    `Edit .fleet/swarm.jsonc, then ${pc.cyan("fleet swarm prepare")} (you launch) or ${pc.cyan("fleet swarm up")}.`,
  );
}
