import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";

// Lean, portable agent-swarm launcher: one git worktree + one cmux tab per
// target, driven by a small .fleet/swarm.jsonc. No server, no dashboard — the
// cmux tabs are the view and `swarm status` is the pull-based readout.

const CMUX_BIN = process.env.CMUX_BIN ?? "/Applications/cmux.app/Contents/Resources/bin/cmux";

interface SwarmTarget {
  name: string;
  /** Path (relative to repo root) to a markdown prompt dropped in as TASK.md. */
  prompt?: string;
  /** Inline task text, used when `prompt` is omitted. */
  task?: string;
  /** Subdir within the worktree to start the agent in (e.g. "apps/web"). */
  cwd?: string;
}

interface SwarmConfig {
  /** Branch to fork each worktree from. Default: current branch. */
  base?: string;
  /** Where worktrees live. Default: ../<repo>-worktrees. */
  worktreeDir?: string;
  /** Branch name prefix per target. Default: "swarm/". */
  branchPrefix?: string;
  /** Args passed to `claude` in each tab. Default: "--permission-mode acceptEdits". */
  claudeArgs?: string;
  targets: SwarmTarget[];
}

function sh(cmd: string, args: string[], cwd?: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function repoRoot(): string {
  const r = sh("git", ["rev-parse", "--show-toplevel"]);
  if (!r.ok) {
    p.log.error("Not inside a git repository.");
    process.exit(1);
  }
  return r.out;
}

function currentBranch(root: string): string {
  return sh("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"]).out || "HEAD";
}

function fleetDir(root: string): string {
  return join(root, ".fleet");
}

function loadConfig(root: string): SwarmConfig {
  for (const name of ["swarm.jsonc", "swarm.json"]) {
    const path = join(fleetDir(root), name);
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8");
      // Strip whole-line `//` comments only — leaves URLs ("https://…") intact.
      const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
      return JSON.parse(stripped) as SwarmConfig;
    }
  }
  p.log.error(`No .fleet/swarm.jsonc in ${root}. Run \`fleet swarm init\` to scaffold one.`);
  process.exit(1);
}

function resolved(root: string, cfg: SwarmConfig) {
  const repoName = root.split("/").pop() ?? "repo";
  return {
    base: cfg.base ?? currentBranch(root),
    worktreeDir: cfg.worktreeDir
      ? join(root, cfg.worktreeDir)
      : join(root, "..", `${repoName}-worktrees`),
    branchPrefix: cfg.branchPrefix ?? "swarm/",
    claudeArgs: cfg.claudeArgs ?? "--permission-mode acceptEdits",
  };
}

function pickTargets(cfg: SwarmConfig, names: string[]): SwarmTarget[] {
  if (!names.length) return cfg.targets;
  const set = new Set(names);
  const picked = cfg.targets.filter((t) => set.has(t.name));
  const missing = names.filter((n) => !cfg.targets.some((t) => t.name === n));
  if (missing.length) {
    p.log.error(
      `Unknown target(s): ${missing.join(", ")}. Known: ${cfg.targets.map((t) => t.name).join(", ")}`,
    );
    process.exit(1);
  }
  return picked;
}

const STATUS_FILE = ".fleet-status.json";

function taskText(root: string, t: SwarmTarget): string {
  if (t.prompt) {
    const path = join(root, t.prompt);
    if (!existsSync(path)) {
      p.log.error(`Prompt file not found for "${t.name}": ${path}`);
      process.exit(1);
    }
    return readFileSync(path, "utf8");
  }
  return (
    t.task ?? `# ${t.name}\n\n(No task specified — set "task" or "prompt" in .fleet/swarm.jsonc.)`
  );
}

async function up(names: string[], opts: { dryRun?: boolean }): Promise<void> {
  const root = repoRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const targets = pickTargets(cfg, names);

  if (!existsSync(r.worktreeDir)) mkdirSync(r.worktreeDir, { recursive: true });
  p.intro(pc.cyan(`🐝 swarm up — ${targets.length} agent(s), base=${r.base}`));

  for (const t of targets) {
    const branch = `${r.branchPrefix}${t.name}`;
    const wtPath = join(r.worktreeDir, t.name);
    const startCwd = t.cwd ? join(wtPath, t.cwd) : wtPath;
    const prompt =
      "Read TASK.md in this directory — it is your assignment for this swarm worktree. " +
      "Stay within your scope, commit on this branch, and report progress by writing " +
      `${STATUS_FILE} (or \`fleet swarm report ${t.name}\`). Begin.`;
    const command = `claude ${r.claudeArgs} ${JSON.stringify(prompt)}`;

    if (opts.dryRun) {
      p.log.step(
        `${pc.bold(t.name)}\n  worktree: git worktree add -b ${branch} ${wtPath} ${r.base}\n  task: ${t.prompt ?? "(inline)"}\n  tab: cmux new-workspace --cwd ${startCwd} --command ${JSON.stringify(command)}`,
      );
      continue;
    }

    if (existsSync(wtPath)) {
      p.log.warn(`${t.name}: worktree exists (${wtPath}) — skipping create, refreshing TASK.md`);
    } else {
      const add = sh("git", ["-C", root, "worktree", "add", "-b", branch, wtPath, r.base]);
      if (!add.ok) {
        // Branch may already exist — retry without -b.
        const retry = sh("git", ["-C", root, "worktree", "add", wtPath, branch]);
        if (!retry.ok) {
          p.log.error(`${t.name}: worktree add failed:\n${add.out}`);
          continue;
        }
      }
    }

    writeFileSync(join(wtPath, "TASK.md"), taskText(root, t));

    const open = sh(CMUX_BIN, [
      "new-workspace",
      "--name",
      `🐝 ${t.name}`,
      "--cwd",
      startCwd,
      "--command",
      command,
      "--no-focus",
    ]);
    if (!open.ok) {
      p.log.error(`${t.name}: cmux tab failed (is cmux running?):\n${open.out}`);
      continue;
    }
    p.log.success(`${t.name} → ${branch} @ ${wtPath}`);
  }

  p.outro(opts.dryRun ? "Dry run complete." : "Swarm launched. `fleet swarm status` to track.");
}

interface StatusRow {
  name: string;
  branch: string;
  exists: boolean;
  lastCommit: string;
  phase?: string;
  progress?: string;
  note?: string;
}

function status(): void {
  const root = repoRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const rows: StatusRow[] = cfg.targets.map((t) => {
    const branch = `${r.branchPrefix}${t.name}`;
    const wtPath = join(r.worktreeDir, t.name);
    const exists = existsSync(wtPath);
    const lastCommit = exists
      ? sh("git", ["-C", wtPath, "log", "-1", "--format=%h %s"]).out.slice(0, 60)
      : "—";
    let phase: string | undefined;
    let progress: string | undefined;
    let note: string | undefined;
    const sf = join(wtPath, STATUS_FILE);
    if (exists && existsSync(sf)) {
      try {
        const s = JSON.parse(readFileSync(sf, "utf8")) as {
          phase?: string;
          done?: number;
          total?: number;
          note?: string;
        };
        phase = s.phase;
        if (typeof s.done === "number" && typeof s.total === "number")
          progress = `${s.done}/${s.total}`;
        note = s.note;
      } catch {
        /* ignore malformed status file */
      }
    }
    return { name: t.name, branch, exists, lastCommit, phase, progress, note };
  });

  p.intro(pc.cyan("🐝 swarm status"));
  for (const row of rows) {
    const dot = row.exists ? pc.green("●") : pc.dim("○");
    const head = `${dot} ${pc.bold(row.name.padEnd(16))} ${(row.phase ?? (row.exists ? "active" : "down")).padEnd(8)} ${(row.progress ?? "").padEnd(6)}`;
    p.log.message(`${head} ${pc.dim(row.lastCommit)}${row.note ? `\n   ${pc.dim(row.note)}` : ""}`);
  }
  p.outro(`${rows.filter((r2) => r2.exists).length}/${rows.length} live`);
}

function down(names: string[], opts: { force?: boolean }): void {
  const root = repoRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const targets = pickTargets(cfg, names);
  p.intro(pc.yellow(`🐝 swarm down — ${targets.length} worktree(s)`));
  for (const t of targets) {
    const wtPath = join(r.worktreeDir, t.name);
    if (!existsSync(wtPath)) {
      p.log.warn(`${t.name}: no worktree`);
      continue;
    }
    const args = ["-C", root, "worktree", "remove", wtPath];
    if (opts.force) args.push("--force");
    const rm = sh("git", args);
    if (!rm.ok) {
      p.log.error(`${t.name}: remove failed (uncommitted changes? use --force):\n${rm.out}`);
      continue;
    }
    p.log.success(`${t.name}: worktree removed (branch ${r.branchPrefix}${t.name} kept)`);
  }
  p.outro("Done.");
}

function report(
  name: string,
  opts: { phase?: string; done?: string; total?: string; note?: string },
): void {
  const root = repoRoot();
  const cfg = loadConfig(root);
  const r = resolved(root, cfg);
  const wtPath = join(r.worktreeDir, name);
  if (!existsSync(wtPath)) {
    p.log.error(`No worktree for "${name}".`);
    process.exit(1);
  }
  const payload = {
    phase: opts.phase,
    done: opts.done ? Number(opts.done) : undefined,
    total: opts.total ? Number(opts.total) : undefined,
    note: opts.note,
    at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  };
  writeFileSync(join(wtPath, STATUS_FILE), JSON.stringify(payload, null, 2));
  p.log.success(`status updated for ${name}`);
}

function initScaffold(): void {
  const root = repoRoot();
  const dir = fleetDir(root);
  const repoName = root.split("/").pop() ?? "repo";
  mkdirSync(join(dir, "prompts"), { recursive: true });

  const cfgPath = join(dir, "swarm.jsonc");
  if (existsSync(cfgPath)) {
    p.log.warn(`.fleet/swarm.jsonc already exists — leaving it.`);
  } else {
    const sample: string = [
      "{",
      "  // Branch each worktree forks from. Omit to use the current branch.",
      '  "base": "dev",',
      `  // Worktrees live here (relative to repo root). Default: ../${repoName}-worktrees`,
      `  "worktreeDir": "../${repoName}-worktrees",`,
      '  "branchPrefix": "swarm/",',
      '  "claudeArgs": "--permission-mode acceptEdits",',
      '  "targets": [',
      '    { "name": "example", "prompt": ".fleet/prompts/example.md", "cwd": "." }',
      "  ]",
      "}",
      "",
    ].join("\n");
    writeFileSync(cfgPath, sample);
    p.log.success("wrote .fleet/swarm.jsonc");
  }

  const promptPath = join(dir, "prompts", "example.md");
  if (!existsSync(promptPath)) {
    writeFileSync(
      promptPath,
      [
        "# Example swarm task",
        "",
        "You are one agent in a parallel swarm, working in an isolated git worktree on your",
        "own branch. Scope: <describe what this agent owns>.",
        "",
        "## Do",
        "- <step 1>",
        "- <step 2>",
        "",
        "## Rules",
        "- Stay within your scope; do not touch other agents' areas.",
        "- Commit on this branch. Do not push to main/dev.",
        "- Update progress: `fleet swarm report example --phase build --done 1 --total 3`.",
        "",
      ].join("\n"),
    );
    p.log.success("wrote .fleet/prompts/example.md");
  }
  p.outro("Edit .fleet/swarm.jsonc, then `fleet swarm up`.");
}

export const swarmCommand = new Command("swarm").description(
  "Launch a lean agent swarm: one git worktree + cmux tab per target (config: .fleet/swarm.jsonc)",
);

swarmCommand
  .command("init")
  .description("Scaffold .fleet/swarm.jsonc + prompts/")
  .action(initScaffold);

swarmCommand
  .command("up [names...]")
  .description("Create a worktree + cmux tab per target (all, or just the named ones)")
  .option("--dry-run", "Print what would happen without creating worktrees or tabs")
  .action((names: string[], opts: { dryRun?: boolean }) => up(names, opts));

swarmCommand
  .command("status")
  .description("Show a compact table of swarm worktrees")
  .action(status);

swarmCommand
  .command("down [names...]")
  .description("Remove swarm worktrees (branches are kept)")
  .option("--force", "Remove even with uncommitted changes")
  .action((names: string[], opts: { force?: boolean }) => down(names, opts));

swarmCommand
  .command("report <name>")
  .description("Write a tiny status file for a worktree (used by agents to report progress)")
  .option("--phase <phase>", "current phase, e.g. build | review | done")
  .option("--done <n>", "steps done")
  .option("--total <n>", "total steps")
  .option("--note <text>", "short note")
  .action((name: string, opts: { phase?: string; done?: string; total?: string; note?: string }) =>
    report(name, opts),
  );
