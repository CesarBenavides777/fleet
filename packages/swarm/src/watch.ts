import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { p, pc } from "@fleet/core";
import { selectMux } from "@fleet/mux";
import { postMessage, swarmPaths } from "@fleet/bus";
import { loadConfig, requireRoot, resolved, swarmDir } from "./config.js";

const TROUBLE = /Overloaded|529|API Error|rate.?limit|Request timed out/i;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function readSurfaces(sd: string): Record<string, string> {
  const path = join(sd, "surfaces.env");
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    out[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return out;
}

export interface WatchOpts {
  nudge?: boolean;
  interval?: number; // seconds
  once?: boolean;
}

/**
 * Poll each agent's surface for overload/error. If it's still retrying ("esc to
 * interrupt"), leave it; if it's idle, post a blocker on the bus (deduped 5min/thread)
 * and, with --nudge, type "continue". Report-only by default.
 */
export async function watch(opts: WatchOpts): Promise<void> {
  const root = requireRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const sd = swarmDir(root);
  const ps = swarmPaths(sd);
  const mux = selectMux(r.mux);
  const intervalMs = (opts.interval ?? 20) * 1000;
  const lastBlock: Record<string, number> = {};

  p.intro(pc.cyan(`🐝 fleet watch via ${mux.kind}${opts.nudge ? " (nudge on)" : ""}`));
  for (;;) {
    for (const [name, id] of Object.entries(readSurfaces(sd))) {
      const screen = mux.readScreen({ id }, 30);
      if (!TROUBLE.test(screen)) continue;
      if (/esc to interrupt/i.test(screen)) continue; // still retrying — leave it
      const now = Date.now();
      if (now - (lastBlock[name] ?? 0) < 5 * 60 * 1000) continue; // dedupe
      lastBlock[name] = now;
      postMessage(ps, {
        from: "watchdog",
        to: name,
        type: "blocker",
        body: "agent idle after overload/error",
      });
      p.log.warn(`${name}: overloaded/idle — posted blocker`);
      if (opts.nudge) {
        mux.send({ id }, "continue");
        mux.sendKey({ id }, "Enter");
      }
    }
    if (opts.once) break;
    await sleep(intervalMs);
  }
  p.outro("watch: one pass complete.");
}
