import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { p, pc } from "@fleet/core";
import { selectMux, type MuxDriver, type SurfaceRef } from "@fleet/mux";
import {
  layoutFor,
  loadConfig,
  pickThreads,
  requireRoot,
  resolved,
  swarmDir,
  type SwarmThread,
} from "./config.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Single-quote for safe interpolation into the shell command we type into a surface. */
function q(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function agentPrompt(name: string): string {
  return (
    `Read THREAD.md in this directory — it is your assignment for this swarm thread. ` +
    `Work autonomously: build, commit on your branch, open a DRAFT PR. NEVER merge, deploy, ` +
    `apply migrations, or push to protected branches. Follow the Fleet protocol in THREAD.md: ` +
    `after each step run \`fleet bus status ${name} …\`; ask or flag blockers with \`fleet bus post\`. ` +
    `When a bash command needs approval, ask in this tab. Begin now.`
  );
}

export interface LaunchOpts {
  dryRun?: boolean;
  stagger?: number; // seconds between spawns
}

/**
 * USER-RUN: spawn one mux surface per thread. Uses the correct cmux sequence —
 * new-surface (a tab) → send (types) → send-key Enter (submits) — with a
 * double-Enter guard and an ~8s stagger to avoid Anthropic 529/Overloaded.
 */
export async function launch(names: string[], opts: LaunchOpts = {}): Promise<void> {
  const root = requireRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const threads = pickThreads(cfg, names);
  const sd = swarmDir(root);
  const staggerMs = (opts.stagger ?? 8) * 1000;

  if (!existsSync(sd)) {
    p.log.error("Not prepared. Run `fleet swarm prepare` first (or `fleet swarm up`).");
    process.exit(1);
  }

  const mux = selectMux(r.mux);
  const surfacesPath = join(sd, "surfaces.env");
  if (!opts.dryRun) writeFileSync(surfacesPath, "");
  p.intro(pc.cyan(`🐝 swarm launch — ${threads.length} agent(s) via ${mux.kind}`));

  for (let i = 0; i < threads.length; i++) {
    const t = threads[i] as SwarmThread;
    const { startCwd, branch } = layoutFor(r, t);
    const command =
      `cd ${q(startCwd)} && FLEET_SWARM_DIR=${q(sd)} ` +
      `claude ${r.claudeArgs} ${q(agentPrompt(t.name))}`;

    if (opts.dryRun) {
      p.log.step(`${pc.bold(t.name)} (${branch})\n  ${mux.kind} new-surface → ${command}`);
      continue;
    }
    const { wtPath } = layoutFor(r, t);
    if (!existsSync(wtPath)) {
      p.log.warn(`${t.name}: worktree missing — run \`fleet swarm prepare\`. Skipping.`);
      continue;
    }

    let ref: SurfaceRef;
    try {
      ref = mux.newSurface({ name: `🐝 ${t.name}`, focus: false });
    } catch (err) {
      p.log.error(`${t.name}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    appendFileSync(surfacesPath, `${t.name}=${ref.id}\n`);

    mux.send(ref, command);
    await sleep(1000);
    mux.sendKey(ref, "Enter");
    // claude's prompt often needs a second Enter to actually submit.
    if (!/esc to interrupt/i.test(mux.readScreen(ref, 30))) {
      await sleep(500);
      mux.sendKey(ref, "Enter");
    }
    p.log.success(`${t.name} → ${ref.id}`);

    if (i < threads.length - 1) await sleep(staggerMs); // stagger to dodge 529s
  }

  p.outro(
    opts.dryRun
      ? "Dry run complete."
      : `Launched. Board: http://localhost:${r.port}/board.html · track with \`fleet swarm status\`.`,
  );
}
