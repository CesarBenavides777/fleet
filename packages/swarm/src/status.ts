import { existsSync } from "node:fs";
import { p, pc, sh } from "@fleet/core";
import { readStatus, swarmPaths } from "@fleet/bus";
import {
  layoutFor,
  loadConfig,
  requireRoot,
  resolved,
  swarmDir,
  threadsOf,
} from "./config.js";

/** Compact table: bus status file (phase/progress/step/blockers) + last git commit. */
export function status(): void {
  const root = requireRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const ps = swarmPaths(swarmDir(root));
  const threads = threadsOf(cfg);

  p.intro(pc.cyan("🐝 swarm status"));
  let live = 0;
  for (const t of threads) {
    const { wtPath } = layoutFor(r, t);
    const exists = existsSync(wtPath);
    if (exists) live++;
    const st = readStatus(ps, t.name);
    const lastCommit = exists
      ? sh("git", ["-C", wtPath, "log", "-1", "--format=%h %s"]).out.slice(0, 60)
      : "—";
    const dot = exists ? pc.green("●") : pc.dim("○");
    const phase = st?.phase ?? (exists ? "active" : "down");
    const progress = st ? `${st.progress.done}/${st.progress.total}` : "";
    const head = `${dot} ${pc.bold(t.name.padEnd(16))} ${phase.padEnd(8)} ${progress.padEnd(6)}`;
    const step = st?.currentStep ? `\n   ${pc.dim(st.currentStep)}` : "";
    const blockers = st?.blockers?.length ? `\n   ${pc.red(`⚠ ${st.blockers.join("; ")}`)}` : "";
    p.log.message(`${head} ${pc.dim(lastCommit)}${step}${blockers}`);
  }
  p.outro(`${live}/${threads.length} live · board http://localhost:${r.port}/board.html`);
}
