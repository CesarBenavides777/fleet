import { spawnSync } from "node:child_process";

export interface ShResult {
  ok: boolean;
  out: string;
  code: number | null;
}

/**
 * Synchronous shell call. Captures stdout+stderr merged into `out` and never
 * throws — callers branch on `ok`. This is the one place fleet shells out.
 */
export function sh(cmd: string, args: string[], cwd?: string): ShResult {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  return {
    ok: r.status === 0,
    out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(),
    code: r.status,
  };
}

/** True if `bin` resolves on PATH. */
export function onPath(bin: string): boolean {
  return sh("which", [bin]).ok;
}
