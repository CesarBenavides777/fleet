import { Command } from "commander";
import pc from "picocolors";
import {
  feed,
  inbox,
  initBus,
  postMessage,
  readThreadSeeds,
  resolveSwarmDir,
  setBlocker,
  swarmPaths,
  updateStatus,
} from "./bus.js";
import type { CommsMessage, CommsType, Phase, StatusFile, StatusStep } from "./types.js";

function paths(swarm?: string) {
  return swarmPaths(resolveSwarmDir(swarm ?? process.cwd()));
}

const TYPE_COLOR: Record<CommsType, (s: string) => string> = {
  msg: pc.white,
  ask: pc.yellow,
  answer: pc.green,
  contract: pc.cyan,
  blocker: pc.red,
  done: pc.magenta,
};

function renderMsg(m: CommsMessage): string {
  const tag = (TYPE_COLOR[m.type] ?? pc.white)(m.type.padEnd(8));
  const refs = m.refs?.length ? pc.dim(` [${m.refs.join(", ")}]`) : "";
  const ts = m.ts.slice(0, 19); // trim ms for display; full ts is the sort key
  return `${pc.dim(ts)} ${tag} ${pc.bold(m.from)}→${m.to}: ${m.body}${refs}`;
}

export const busCommand = new Command("bus").description(
  "File-based status + comms bus for swarm agents (each writes only its own files)",
);

busCommand
  .command("init")
  .description("Create status/comms files for every thread in .swarm/config.json")
  .option("--swarm <dir>", "Path to the .swarm dir (else auto-resolved)")
  .action((opts: { swarm?: string }) => {
    const ps = paths(opts.swarm);
    const seeds = readThreadSeeds(ps);
    initBus(ps, seeds);
    process.stdout.write(`bus init: ${seeds.length} thread(s) in ${ps.dir}\n`);
  });

busCommand
  .command("status <id>")
  .description("Update a thread's own status file")
  .option("--phase <phase>", "pending | build | qa | blocked | done")
  .option("--done <n>", "steps done")
  .option("--total <n>", "total steps")
  .option("--current <text>", "current step description")
  .option("--pr <pr>", "PR number or URL")
  .option("--branch <branch>", "branch name")
  .option("--steps-json <json>", "JSON array of {title,status,note}")
  .option("--swarm <dir>", "Path to the .swarm dir")
  .action(
    (
      id: string,
      opts: {
        phase?: string;
        done?: string;
        total?: string;
        current?: string;
        pr?: string;
        branch?: string;
        stepsJson?: string;
        swarm?: string;
      },
    ) => {
      const patch: Partial<StatusFile> = {};
      if (opts.phase) patch.phase = opts.phase as Phase;
      if (opts.current !== undefined) patch.currentStep = opts.current;
      if (opts.pr !== undefined) patch.pr = opts.pr;
      if (opts.branch !== undefined) patch.branch = opts.branch;
      if (opts.done !== undefined || opts.total !== undefined) {
        patch.progress = {} as StatusFile["progress"];
        if (opts.done !== undefined) patch.progress.done = Number(opts.done);
        if (opts.total !== undefined) patch.progress.total = Number(opts.total);
      }
      if (opts.stepsJson) {
        try {
          patch.steps = JSON.parse(opts.stepsJson) as StatusStep[];
        } catch {
          process.stderr.write("bus status: --steps-json is not valid JSON\n");
          process.exit(2);
        }
      }
      const next = updateStatus(paths(opts.swarm), id, patch);
      process.stdout.write(
        `${id}: ${next.phase} ${next.progress.done}/${next.progress.total}${next.currentStep ? ` — ${next.currentStep}` : ""}\n`,
      );
    },
  );

busCommand
  .command("post <body>")
  .description("Append a message to the sender's outbox")
  .requiredOption("--from <id>", "sender thread id")
  .requiredOption("--to <id>", 'recipient thread id, or "all"')
  .option("--type <type>", "msg | ask | answer | contract | blocker | done", "msg")
  .option("--refs <refs>", "comma-separated references")
  .option("--swarm <dir>", "Path to the .swarm dir")
  .action(
    (
      body: string,
      opts: { from: string; to: string; type?: string; refs?: string; swarm?: string },
    ) => {
      const refs = opts.refs
        ? opts.refs
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean)
        : undefined;
      postMessage(paths(opts.swarm), {
        from: opts.from,
        to: opts.to,
        type: (opts.type ?? "msg") as CommsType,
        body,
        refs,
      });
      process.stdout.write(`posted ${opts.type ?? "msg"} ${opts.from}→${opts.to}\n`);
    },
  );

busCommand
  .command("inbox <id>")
  .description('Show messages addressed to <id> or "all"')
  .option("-n <n>", "limit to last n", "20")
  .option("--swarm <dir>", "Path to the .swarm dir")
  .action((id: string, opts: { n?: string; swarm?: string }) => {
    const msgs = inbox(paths(opts.swarm), id, Number(opts.n ?? 20));
    for (const m of msgs) process.stdout.write(`${renderMsg(m)}\n`);
  });

busCommand
  .command("feed")
  .description("Show the merged comms feed across all threads")
  .option("-n <n>", "limit to last n", "30")
  .option("--swarm <dir>", "Path to the .swarm dir")
  .action((opts: { n?: string; swarm?: string }) => {
    const msgs = feed(paths(opts.swarm), Number(opts.n ?? 30));
    for (const m of msgs) process.stdout.write(`${renderMsg(m)}\n`);
  });

busCommand
  .command("blocker <id> <text>")
  .description('Set a thread blocker (empty "" clears it); broadcasts on the bus')
  .option("--swarm <dir>", "Path to the .swarm dir")
  .action((id: string, text: string, opts: { swarm?: string }) => {
    setBlocker(paths(opts.swarm), id, text);
    process.stdout.write(`${id}: blocker ${text.trim() ? "set" : "cleared"}\n`);
  });
