import { spawnSync } from "node:child_process";
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadIdentitiesYaml } from "../identity/yaml-loader.js";
import { runBootstrap } from "../identity/index.js";
import type { Provider } from "../identity/types.js";
import {
  detectSecretBackend,
  probeIdentity,
  probeMcp,
  readMcpServers,
  type ProbeResult,
  type ProbeStatus,
} from "./probe.js";

// `doctor` — probe every connection a workspace declares (identity tokens +
// MCP servers), report health, and (with --fix) auto-repair broken identities
// by re-running the OAuth/PAT bootstrap flow.

const PROVIDERS: Provider[] = ["google", "github", "figma", "vercel"];

function repoRoot(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

function enumerateIdentities(root: string): Array<{ provider: Provider; accountId: string }> {
  const yaml = loadIdentitiesYaml(root) ?? loadIdentitiesYaml(process.cwd());
  if (!yaml) return [];
  const out: Array<{ provider: Provider; accountId: string }> = [];
  for (const provider of PROVIDERS) {
    const accounts = yaml.providers[provider]?.accounts ?? {};
    for (const accountId of Object.keys(accounts)) out.push({ provider, accountId });
  }
  return out;
}

const MARK: Record<ProbeStatus, string> = {
  ok: pc.green("✔ ok"),
  no_token: pc.yellow("● no-token"),
  invalid: pc.red("✖ invalid"),
  unreachable: pc.red("✖ unreachable"),
  skipped: pc.dim("– skipped"),
};

function line(r: ProbeResult): string {
  return `  ${MARK[r.status].padEnd(20)} ${pc.bold(r.target.padEnd(22))} ${pc.dim(r.detail)}`;
}

async function doctor(opts: { fix?: boolean; json?: boolean }): Promise<void> {
  const root = repoRoot();
  const results: ProbeResult[] = [];

  const backend = detectSecretBackend(root);
  results.push({
    kind: "backend",
    target: `secrets/${backend.name}`,
    status: "ok",
    detail: backend.detail,
  });

  const identities = enumerateIdentities(root);
  for (const { provider, accountId } of identities)
    results.push(await probeIdentity(provider, accountId));

  const mcp = readMcpServers(root);
  for (const [name, server] of Object.entries(mcp)) results.push(await probeMcp(name, server));

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return;
  }

  p.intro(pc.cyan("🩺 connection doctor"));
  if (!identities.length) p.log.warn("No identities.yaml found — identity checks skipped.");
  if (!Object.keys(mcp).length) p.log.message(pc.dim("  (no MCP servers configured)"));
  for (const r of results) p.log.message(line(r));

  const broken = results.filter(
    (r) => r.status === "invalid" || r.status === "no_token" || r.status === "unreachable",
  );
  const fixableIds = results.filter(
    (r) => r.fix && (r.status === "invalid" || r.status === "no_token"),
  );

  if (!broken.length) {
    p.outro(pc.green(`All ${results.length} checks healthy.`));
    return;
  }

  if (!opts.fix) {
    p.log.warn(
      `${broken.length} issue(s). Re-run with ${pc.bold("--fix")} to repair identities interactively.`,
    );
    for (const r of broken.filter((b) => !b.fix))
      p.log.message(pc.dim(`  ${r.target}: ${r.detail} (manual — not auto-fixable)`));
    p.outro("Done.");
    return;
  }

  if (!fixableIds.length) {
    p.log.warn("Nothing auto-fixable (MCP/backend issues need manual attention).");
    p.outro("Done.");
    return;
  }

  for (const r of fixableIds) {
    if (!r.fix) continue;
    const go = await p.confirm({
      message: `Re-bootstrap ${r.target}? (${r.detail})`,
      initialValue: true,
    });
    if (p.isCancel(go) || !go) {
      p.log.message(pc.dim(`  skipped ${r.target}`));
      continue;
    }
    try {
      await runBootstrap(r.fix.provider, r.fix.accountId);
    } catch (err) {
      p.log.error(`  ${r.target}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  p.outro("Re-run `fleet doctor` to confirm.");
}

export const doctorCommand = new Command("doctor")
  .description("Probe + auto-fix connections: identity tokens (OAuth/PAT) and MCP servers")
  .option("--fix", "Interactively re-bootstrap broken identities")
  .option("--json", "Emit raw probe results as JSON")
  .action((opts: { fix?: boolean; json?: boolean }) => doctor(opts));
