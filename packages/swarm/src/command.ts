import { existsSync } from "node:fs";
import { Command } from "commander";
import { p, pc, sh } from "@fleet/core";
import { swarmPaths, updateStatus, type Phase, type StatusFile } from "@fleet/bus";
import {
  layoutFor,
  loadConfig,
  pickThreads,
  requireRoot,
  resolved,
  swarmDir,
} from "./config.js";
import { initScaffold } from "./init.js";
import { plan } from "./plan.js";
import { prepare } from "./prepare.js";
import { launch } from "./launch.js";
import { status } from "./status.js";
import { watch } from "./watch.js";
import { killServer, serveForeground, startServerDetached } from "./server.js";
import { pruneWorktrees, removeWorktree } from "./worktree.js";

function down(names: string[], opts: { force?: boolean }): void {
  const root = requireRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const threads = pickThreads(cfg, names);
  p.intro(pc.yellow(`🐝 swarm down — ${threads.length} worktree(s)`));
  for (const t of threads) {
    const { wtPath, branch } = layoutFor(r, t);
    if (!existsSync(wtPath)) {
      p.log.warn(`${t.name}: no worktree`);
      continue;
    }
    const rm = removeWorktree(root, wtPath, opts.force ?? false);
    if (!rm.ok) {
      p.log.error(`${t.name}: remove failed (uncommitted changes? use --force):\n${rm.out}`);
      continue;
    }
    p.log.success(`${t.name}: worktree removed (branch ${branch} kept)`);
  }
  pruneWorktrees(root);
  if (!names.length && killServer(r.port)) p.log.step(`board server on :${r.port} stopped`);
  p.outro("Done.");
}

function report(
  name: string,
  opts: { phase?: string; done?: string; total?: string; note?: string; pr?: string },
): void {
  const root = requireRoot();
  const ps = swarmPaths(swarmDir(root));
  const patch: Partial<StatusFile> = {};
  if (opts.phase) patch.phase = opts.phase as Phase;
  if (opts.note !== undefined) patch.currentStep = opts.note;
  if (opts.pr !== undefined) patch.pr = opts.pr;
  if (opts.done !== undefined || opts.total !== undefined) {
    patch.progress = {} as StatusFile["progress"];
    if (opts.done !== undefined) patch.progress.done = Number(opts.done);
    if (opts.total !== undefined) patch.progress.total = Number(opts.total);
  }
  updateStatus(ps, name, patch);
  p.log.success(`status updated for ${name}`);
}

export const swarmCommand = new Command("swarm").description(
  "Launch a swarm: one git worktree + one cmux/tmux surface per thread, with a live board + bus",
);

swarmCommand
  .command("init")
  .description("Scaffold .fleet/swarm.jsonc + prompts/")
  .action(initScaffold);

swarmCommand
  .command("plan [names...]")
  .description("Scaffold a THREAD prompt per thread from the template")
  .action((names: string[]) => plan(names));

swarmCommand
  .command("prepare [names...]")
  .description("AGENT-SAFE: worktrees + .swarm + seed mcp + bus + server (no agents spawned)")
  .action((names: string[]) => {
    prepare(names);
  });

swarmCommand
  .command("launch [names...]")
  .description("USER-RUN: spawn one surface per thread (new-surface → send → Enter, 8s stagger)")
  .option("--dry-run", "Print the spawn commands without opening surfaces")
  .option("--stagger <sec>", "Seconds between spawns", "8")
  .action((names: string[], opts: { dryRun?: boolean; stagger?: string }) =>
    launch(names, { dryRun: opts.dryRun, stagger: Number(opts.stagger ?? 8) }),
  );

swarmCommand
  .command("up [names...]")
  .description("Human convenience: prepare + launch in one go")
  .option("--dry-run", "Print what would happen without creating worktrees or surfaces")
  .option("--stagger <sec>", "Seconds between spawns", "8")
  .action(async (names: string[], opts: { dryRun?: boolean; stagger?: string }) => {
    if (!opts.dryRun) prepare(names, { quiet: true });
    await launch(names, { dryRun: opts.dryRun, stagger: Number(opts.stagger ?? 8) });
  });

swarmCommand.command("status").description("Compact table of swarm threads").action(status);

swarmCommand
  .command("board")
  .description("Ensure the board server is up and open it")
  .action(() => {
    const root = requireRoot();
    const r = resolved(root, loadConfig(root));
    startServerDetached(swarmDir(root), r.port);
    const url = `http://localhost:${r.port}/board.html`;
    p.log.step(`board → ${url}`);
    sh("open", [url]);
  });

swarmCommand
  .command("watch")
  .description("Watchdog: scan surfaces for 529/Overloaded; post blockers (--nudge to retry)")
  .option("--nudge", 'Type "continue" into idle/overloaded surfaces')
  .option("--interval <sec>", "Poll interval", "20")
  .option("--once", "Run a single pass and exit")
  .action((opts: { nudge?: boolean; interval?: string; once?: boolean }) =>
    watch({ nudge: opts.nudge, interval: Number(opts.interval ?? 20), once: opts.once }),
  );

swarmCommand
  .command("down [names...]")
  .description("Remove worktrees (branches kept); stop the server when tearing down all")
  .option("--force", "Remove even with uncommitted changes")
  .action((names: string[], opts: { force?: boolean }) => down(names, opts));

swarmCommand
  .command("report <name>")
  .description("Write a status update for a thread (thin wrapper over the bus)")
  .option("--phase <phase>", "current phase: build | qa | done")
  .option("--done <n>", "steps done")
  .option("--total <n>", "total steps")
  .option("--note <text>", "current step / short note")
  .option("--pr <pr>", "PR number or URL")
  .action(
    (name: string, opts: { phase?: string; done?: string; total?: string; note?: string; pr?: string }) =>
      report(name, opts),
  );

swarmCommand
  .command("serve")
  .description("(internal) Run the no-cache board server in the foreground")
  .requiredOption("--swarm <dir>", "Path to the .swarm dir")
  .requiredOption("--port <n>", "Port to bind on 127.0.0.1")
  .action((opts: { swarm: string; port: string }) => serveForeground(opts.swarm, Number(opts.port)));
