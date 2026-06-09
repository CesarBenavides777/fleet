import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { currentBranch, gitRoot, p, parseJsonc } from "@fleet/core";

/** A unit of parallel work: one worktree + one mux surface running one agent. */
export interface SwarmThread {
  name: string; // == id
  title?: string;
  color?: string;
  /** Path (relative to repo root) to a markdown prompt dropped in as THREAD.md. */
  prompt?: string;
  /** Inline task text, used when `prompt` is omitted. */
  task?: string;
  /** Repo to fork (default: the current repo root). */
  repo?: string;
  /** Branch to fork from (overrides the top-level `base`). */
  base?: string;
  /** Subdir within the worktree to start the agent in (e.g. "apps/web"). */
  cwd?: string;
}

export interface SwarmConfig {
  base?: string;
  worktreeDir?: string;
  branchPrefix?: string;
  claudeArgs?: string;
  mux?: "cmux" | "tmux";
  port?: number;
  /** Threads to launch. `threads` is an accepted alias for `targets`. */
  targets?: SwarmThread[];
  threads?: SwarmThread[];
}

export interface ResolvedConfig {
  base: string;
  worktreeDir: string;
  branchPrefix: string;
  claudeArgs: string;
  mux?: "cmux" | "tmux";
  port: number;
}

export const THREAD_FILE = "THREAD.md";
export const DEFAULT_PORT = 8787;

export function requireRoot(): string {
  const root = gitRoot();
  if (!root) {
    p.log.error("Not inside a git repository.");
    process.exit(1);
  }
  return root;
}

export function fleetDir(root: string): string {
  return join(root, ".fleet");
}

export function swarmDir(root: string): string {
  return join(root, ".swarm");
}

export function loadConfig(root: string): SwarmConfig {
  for (const name of ["swarm.jsonc", "swarm.json"]) {
    const path = join(fleetDir(root), name);
    if (existsSync(path)) return parseJsonc<SwarmConfig>(readFileSync(path, "utf8"));
  }
  p.log.error(`No .fleet/swarm.jsonc in ${root}. Run \`fleet swarm init\` to scaffold one.`);
  process.exit(1);
}

export function threadsOf(cfg: SwarmConfig): SwarmThread[] {
  return cfg.targets ?? cfg.threads ?? [];
}

export function resolved(root: string, cfg: SwarmConfig): ResolvedConfig {
  const repoName = root.split("/").pop() ?? "repo";
  return {
    base: cfg.base ?? currentBranch(root),
    worktreeDir: cfg.worktreeDir
      ? join(root, cfg.worktreeDir)
      : join(root, "..", `${repoName}-worktrees`),
    branchPrefix: cfg.branchPrefix ?? "swarm/",
    claudeArgs: cfg.claudeArgs ?? "--permission-mode acceptEdits",
    mux: cfg.mux,
    port: cfg.port ?? DEFAULT_PORT,
  };
}

export function pickThreads(cfg: SwarmConfig, names: string[]): SwarmThread[] {
  const all = threadsOf(cfg);
  if (!names.length) return all;
  const set = new Set(names);
  const missing = names.filter((n) => !all.some((t) => t.name === n));
  if (missing.length) {
    p.log.error(
      `Unknown target(s): ${missing.join(", ")}. Known: ${all.map((t) => t.name).join(", ")}`,
    );
    process.exit(1);
  }
  return all.filter((t) => set.has(t.name));
}

export function threadText(root: string, t: SwarmThread): string {
  if (t.prompt) {
    const path = join(root, t.prompt);
    if (!existsSync(path)) {
      p.log.error(`Prompt file not found for "${t.name}": ${path}`);
      process.exit(1);
    }
    return readFileSync(path, "utf8");
  }
  return t.task ?? `# ${t.name}\n\n(No task specified — set "task" or "prompt" in .fleet/swarm.jsonc.)\n`;
}

export interface ThreadLayout {
  branch: string;
  wtPath: string;
  startCwd: string;
}

export function layoutFor(r: ResolvedConfig, t: SwarmThread): ThreadLayout {
  const branch = `${r.branchPrefix}${t.name}`;
  const wtPath = join(r.worktreeDir, t.name);
  const startCwd = t.cwd ? join(wtPath, t.cwd) : wtPath;
  return { branch, wtPath, startCwd };
}
