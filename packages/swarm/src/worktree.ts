import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { sh, type ShResult } from "@fleet/core";
import { THREAD_FILE } from "./config.js";

export interface WorktreeResult {
  ok: boolean;
  existed: boolean;
  out: string;
}

/** Create the worktree on a fresh branch, falling back to attaching an existing one. */
export function createWorktree(
  root: string,
  branch: string,
  wtPath: string,
  base: string,
): WorktreeResult {
  if (existsSync(wtPath)) return { ok: true, existed: true, out: "" };
  const add = sh("git", ["-C", root, "worktree", "add", "-b", branch, wtPath, base]);
  if (add.ok) return { ok: true, existed: false, out: add.out };
  // Branch may already exist — retry attaching it without -b.
  const retry = sh("git", ["-C", root, "worktree", "add", wtPath, branch]);
  return { ok: retry.ok, existed: false, out: retry.ok ? retry.out : add.out };
}

export function writeThreadFile(startCwd: string, text: string): void {
  mkdirSync(startCwd, { recursive: true });
  writeFileSync(join(startCwd, THREAD_FILE), text);
}

/** Copy the parent repo's .mcp.json into the worktree (MCP doesn't follow worktrees). */
export function seedMcp(root: string, wtPath: string): boolean {
  const src = join(root, ".mcp.json");
  const dst = join(wtPath, ".mcp.json");
  if (existsSync(src) && !existsSync(dst)) {
    copyFileSync(src, dst);
    return true;
  }
  return false;
}

/** Keep generated files (THREAD.md, .mcp.json) out of the worktree's git. */
export function hideFromGit(wtPath: string, names: string[]): void {
  const gitDir = sh("git", ["-C", wtPath, "rev-parse", "--git-dir"]).out;
  if (!gitDir) return;
  const gitDirAbs = isAbsolute(gitDir) ? gitDir : join(wtPath, gitDir);
  const exclude = join(gitDirAbs, "info", "exclude");
  mkdirSync(dirname(exclude), { recursive: true });
  appendFileSync(exclude, `${names.join("\n")}\n`);
}

export function removeWorktree(root: string, wtPath: string, force: boolean): ShResult {
  const args = ["-C", root, "worktree", "remove", wtPath];
  if (force) args.push("--force");
  return sh("git", args);
}

export function pruneWorktrees(root: string): void {
  sh("git", ["-C", root, "worktree", "prune"]);
}
