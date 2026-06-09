import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { p, pc } from "@fleet/core";
import { assetsDir, THREAD_TEMPLATE } from "./assets.js";
import { fleetDir, loadConfig, requireRoot, threadsOf } from "./config.js";

/**
 * Scaffold a THREAD prompt per thread from the template (Claude fills them in
 * during author-from-plan). Existing prompt files are left untouched.
 */
export function plan(names: string[]): void {
  const root = requireRoot();
  const cfg = loadConfig(root);
  const all = threadsOf(cfg);
  const picked = names.length ? all.filter((t) => names.includes(t.name)) : all;
  const tmpl = readFileSync(join(assetsDir(), THREAD_TEMPLATE), "utf8");
  mkdirSync(join(fleetDir(root), "prompts"), { recursive: true });

  p.intro(pc.cyan("🐝 swarm plan — scaffold THREAD prompts"));
  if (!picked.length) p.log.warn("No threads in .fleet/swarm.jsonc — add some, or run `fleet swarm init`.");
  for (const t of picked) {
    const rel = t.prompt ?? `.fleet/prompts/${t.name}.md`;
    const abs = join(root, rel);
    if (existsSync(abs)) {
      p.log.warn(`${t.name}: ${rel} exists — leaving it`);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    const body = tmpl.replace(/<id>/g, t.name).replace(/<title>/g, t.title ?? t.name);
    writeFileSync(abs, body);
    p.log.success(`wrote ${rel}`);
  }
  p.outro("Fill in each THREAD prompt (own/do-not-touch/steps), then `fleet swarm prepare`.");
}
