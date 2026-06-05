import * as p from "@clack/prompts";
import { loadIdentitiesYaml } from "./yaml-loader.js";
import type { BootstrapResult } from "./types.js";

async function validateToken(token: string): Promise<{ login?: string; error?: string }> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "fleet" },
  });
  if (!res.ok) return { error: `GitHub /user returned ${res.status}` };
  const json = (await res.json()) as { login?: string };
  return { login: json.login };
}

export async function bootstrapGithub(accountId: string): Promise<BootstrapResult> {
  const yaml = loadIdentitiesYaml();
  const declared = yaml?.providers.github?.accounts?.[accountId];
  const permissions = declared?.permissions ?? [];

  p.log.step(`Bootstrap GitHub PAT for '${accountId}'`);
  if (permissions.length) {
    p.log.info(`Expected fine-grained permissions:`);
    for (const perm of permissions) p.log.info(`  · ${perm}`);
  }
  p.log.info("Generate at: https://github.com/settings/personal-access-tokens/new");

  const token = await p.password({
    message: `GitHub PAT for ${accountId}`,
    validate: (v) => (v.length < 20 ? "PAT looks too short" : undefined),
  });
  if (p.isCancel(token)) throw new Error("cancelled");

  const v = await validateToken(token);
  if (v.error) throw new Error(`validation failed: ${v.error}`);
  p.log.success(`Validated as @${v.login}`);

  const extra: Record<string, string> = {};
  if (declared?.adminToken) {
    const want = await p.confirm({
      message: `Also bootstrap a separate elevated admin token for '${accountId}'?`,
      initialValue: false,
    });
    if (!p.isCancel(want) && want) {
      const adminToken = await p.password({
        message: `Elevated admin PAT for ${accountId} (gated to Sergio + Telegram confirm)`,
        validate: (val) => (val.length < 20 ? "PAT looks too short" : undefined),
      });
      if (p.isCancel(adminToken)) throw new Error("cancelled");
      const av = await validateToken(adminToken);
      if (av.error) throw new Error(`admin token validation failed: ${av.error}`);
      extra.adminToken = adminToken;
    }
  }

  return {
    provider: "github",
    accountId,
    scopes: permissions,
    token,
    extra: Object.keys(extra).length ? extra : undefined,
  };
}
