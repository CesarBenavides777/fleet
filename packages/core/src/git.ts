import { sh } from "./shell.js";

/** Repo root for `cwd` (default process.cwd()), or null if not in a git repo. */
export function gitRoot(cwd?: string): string | null {
  const r = sh("git", ["rev-parse", "--show-toplevel"], cwd);
  return r.ok ? r.out : null;
}

/** Repo root or process.cwd() as a best-effort fallback (used by read-only probes). */
export function gitRootOrCwd(cwd?: string): string {
  return gitRoot(cwd) ?? process.cwd();
}

/** Current branch name of the repo at `root`, or "HEAD" when detached/unknown. */
export function currentBranch(root: string): string {
  return sh("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"]).out || "HEAD";
}
