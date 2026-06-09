import { Command } from "commander";
import { gitRoot, p, pc } from "@fleet/core";
import { doctor } from "@fleet/doctor";
import { runBootstrap, type Provider } from "@fleet/identity";
import { initScaffold } from "@fleet/swarm";

const PROVIDERS: Provider[] = ["google", "github", "figma", "vercel"];

async function onboard(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" 🐝 fleet onboard ")));

  const root = gitRoot();
  if (!root) {
    p.log.warn("Not inside a git repo — the swarm needs one. Run `git init`, then re-run onboard.");
  } else {
    p.log.step(`repo: ${pc.dim(root)}`);
  }

  const runDoc = await p.confirm({
    message: "Run a connection check (fleet doctor) now?",
    initialValue: true,
  });
  if (!p.isCancel(runDoc) && runDoc) await doctor({});

  const connect = await p.confirm({
    message: "Connect a service (OAuth / PAT) now?",
    initialValue: false,
  });
  if (!p.isCancel(connect) && connect) {
    const provider = await p.select({
      message: "Which provider?",
      options: PROVIDERS.map((v) => ({ value: v, label: v })),
    });
    if (!p.isCancel(provider)) {
      const accountId = await p.text({
        message: "Account id (a label for this account)",
        placeholder: "work",
      });
      if (!p.isCancel(accountId) && accountId) {
        try {
          await runBootstrap(provider as Provider, String(accountId));
        } catch (err) {
          p.log.error(err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  if (root) {
    const scaffold = await p.confirm({
      message: "Scaffold a swarm config (.fleet/swarm.jsonc)?",
      initialValue: true,
    });
    if (!p.isCancel(scaffold) && scaffold) initScaffold();
  }

  p.outro(
    [
      pc.bold("Next:"),
      "  1. edit .fleet/swarm.jsonc — define non-overlapping threads",
      `  2. ${pc.cyan("fleet swarm plan")}     — scaffold a THREAD prompt per thread`,
      `  3. ${pc.cyan("fleet swarm prepare")}  — worktrees + board + bus (agent-safe)`,
      `  4. ${pc.cyan("fleet swarm launch")}   — YOU spawn the agent surfaces`,
      `  • ${pc.cyan("fleet swarm status | board | watch")} to track`,
    ].join("\n"),
  );
}

export const onboardCommand = new Command("onboard")
  .description("Slick first-run wizard: check connections, connect a service, scaffold a swarm")
  .action(onboard);
