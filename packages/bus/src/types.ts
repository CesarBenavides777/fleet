export type Phase = "pending" | "build" | "qa" | "blocked" | "done";
export type StepStatus = "pending" | "active" | "done" | "blocked";
export type CommsType = "msg" | "ask" | "answer" | "contract" | "blocker" | "done";

export interface StatusStep {
  title: string;
  status: StepStatus;
  note?: string;
}

/** `.swarm/status/<id>.json` — written ONLY by its owner (read-modify-write). */
export interface StatusFile {
  thread: string;
  title: string;
  phase: Phase;
  repo: string;
  branch: string;
  worktree: string;
  progress: { done: number; total: number };
  currentStep: string;
  pr: string;
  steps: StatusStep[];
  blockers: string[];
  updatedAt: string;
}

/** One line of `.swarm/comms/<id>.jsonl` — append-only outbox per thread. */
export interface CommsMessage {
  ts: string;
  from: string;
  to: string; // a thread id, or "all"
  type: CommsType;
  body: string;
  refs?: string[];
}

/** Minimal thread shape the bus needs (read from .swarm/config.json). */
export interface ThreadSeed {
  name: string;
  title?: string;
  repo?: string;
  branch?: string;
  worktree?: string;
}
