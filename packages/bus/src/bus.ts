import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { sh } from "@fleet/core";
import type { CommsMessage, StatusFile, ThreadSeed } from "./types.js";

export interface SwarmPaths {
  dir: string;
  statusDir: string;
  commsDir: string;
  configPath: string;
}

/** ISO-8601 UTC truncated to seconds, e.g. "2026-06-09T12:00:00Z". */
export function utcSeconds(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

/**
 * Locate the `.swarm/` runtime dir from anywhere — including a worktree, whose
 * `.swarm` lives in the MAIN repo. Precedence:
 *   1. FLEET_SWARM_DIR (set by the launcher into each agent's env)
 *   2. nearest `.swarm/` walking up from cwd
 *   3. the main repo via `git rev-parse --git-common-dir` (works from worktrees)
 */
export function resolveSwarmDir(cwd: string = process.cwd()): string {
  const env = process.env.FLEET_SWARM_DIR;
  if (env) return env;

  let dir = cwd;
  for (;;) {
    const cand = join(dir, ".swarm");
    if (existsSync(cand)) return cand;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const common = sh("git", ["-C", cwd, "rev-parse", "--git-common-dir"]).out;
  if (common) {
    const commonAbs = isAbsolute(common) ? common : resolve(cwd, common);
    return join(dirname(commonAbs), ".swarm"); // <main>/.git → <main>/.swarm
  }
  return join(cwd, ".swarm");
}

export function swarmPaths(dir: string): SwarmPaths {
  return {
    dir,
    statusDir: join(dir, "status"),
    commsDir: join(dir, "comms"),
    configPath: join(dir, "config.json"),
  };
}

/** Read the thread list from `.swarm/config.json` (never hardcoded). */
export function readThreadSeeds(paths: SwarmPaths): ThreadSeed[] {
  if (!existsSync(paths.configPath)) return [];
  try {
    const cfg = JSON.parse(readFileSync(paths.configPath, "utf8")) as {
      threads?: ThreadSeed[];
      targets?: ThreadSeed[];
    };
    return cfg.threads ?? cfg.targets ?? [];
  } catch {
    return [];
  }
}

function defaultStatus(seed: ThreadSeed): StatusFile {
  return {
    thread: seed.name,
    title: seed.title ?? seed.name,
    phase: "pending",
    repo: seed.repo ?? "",
    branch: seed.branch ?? "",
    worktree: seed.worktree ?? "",
    progress: { done: 0, total: 0 },
    currentStep: "",
    pr: "",
    steps: [],
    blockers: [],
    updatedAt: utcSeconds(),
  };
}

function statusPath(paths: SwarmPaths, id: string): string {
  return join(paths.statusDir, `${id}.json`);
}

function commsPath(paths: SwarmPaths, id: string): string {
  return join(paths.commsDir, `${id}.jsonl`);
}

/** Create status/comms files for every thread in config (idempotent). */
export function initBus(paths: SwarmPaths, seeds: ThreadSeed[]): void {
  mkdirSync(paths.statusDir, { recursive: true });
  mkdirSync(paths.commsDir, { recursive: true });
  for (const seed of seeds) {
    const sp = statusPath(paths, seed.name);
    if (!existsSync(sp)) writeFileSync(sp, JSON.stringify(defaultStatus(seed), null, 2));
    const cp = commsPath(paths, seed.name);
    if (!existsSync(cp)) writeFileSync(cp, "");
  }
}

export function readStatus(paths: SwarmPaths, id: string): StatusFile | null {
  const sp = statusPath(paths, id);
  if (!existsSync(sp)) return null;
  try {
    return JSON.parse(readFileSync(sp, "utf8")) as StatusFile;
  } catch {
    return null;
  }
}

/** Read-modify-write the owner's own status file. */
export function updateStatus(paths: SwarmPaths, id: string, patch: Partial<StatusFile>): StatusFile {
  mkdirSync(paths.statusDir, { recursive: true });
  const cur = readStatus(paths, id) ?? defaultStatus({ name: id });
  const next: StatusFile = {
    ...cur,
    ...patch,
    progress: { ...cur.progress, ...(patch.progress ?? {}) },
    updatedAt: utcSeconds(),
  };
  writeFileSync(statusPath(paths, id), JSON.stringify(next, null, 2));
  return next;
}

/** Append one message to the sender's own outbox. */
export function postMessage(paths: SwarmPaths, msg: Omit<CommsMessage, "ts">): CommsMessage {
  mkdirSync(paths.commsDir, { recursive: true });
  const full: CommsMessage = { ts: utcSeconds(), ...msg };
  appendFileSync(commsPath(paths, msg.from), `${JSON.stringify(full)}\n`);
  return full;
}

function readAllComms(paths: SwarmPaths): CommsMessage[] {
  if (!existsSync(paths.commsDir)) return [];
  const out: CommsMessage[] = [];
  for (const file of readdirSync(paths.commsDir)) {
    if (!file.endsWith(".jsonl")) continue;
    const raw = readFileSync(join(paths.commsDir, file), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(JSON.parse(t) as CommsMessage);
      } catch {
        /* skip malformed line */
      }
    }
  }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}

/** All messages, oldest→newest. */
export function feed(paths: SwarmPaths, limit?: number): CommsMessage[] {
  const all = readAllComms(paths);
  return limit ? all.slice(-limit) : all;
}

/** Messages addressed to `id` or "all". */
export function inbox(paths: SwarmPaths, id: string, limit?: number): CommsMessage[] {
  const mine = readAllComms(paths).filter((m) => m.to === id || m.to === "all");
  return limit ? mine.slice(-limit) : mine;
}

/**
 * Set or clear a thread's blocker. Empty text clears it. Either way the change
 * is broadcast on the bus so the board and peers see it.
 */
export function setBlocker(paths: SwarmPaths, id: string, text: string): void {
  const clear = text.trim() === "";
  updateStatus(paths, id, {
    blockers: clear ? [] : [text],
    phase: clear ? "build" : "blocked",
  });
  postMessage(paths, {
    from: id,
    to: "all",
    type: "blocker",
    body: clear ? "(blocker cleared)" : text,
  });
}
