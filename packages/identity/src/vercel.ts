import * as p from "@clack/prompts";
import { loadIdentitiesYaml } from "./yaml-loader.js";
import type { BootstrapResult } from "./types.js";

async function validateToken(token: string): Promise<{ username?: string; email?: string; error?: string }> {
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { error: `Vercel /v2/user returned ${res.status}` };
  const json = (await res.json()) as { user: { username?: string; email?: string } };
  return { username: json.user?.username, email: json.user?.email };
}

export async function bootstrapVercel(accountId: string): Promise<BootstrapResult> {
  const yaml = loadIdentitiesYaml();
  const declared = yaml?.providers.vercel?.accounts?.[accountId];

  p.log.step(`Bootstrap Vercel PAT for '${accountId}'`);
  if (declared) p.log.info(`Scope: ${declared.scope}; dangerous actions gated: ${(declared.dangerous ?? []).join(", ") || "none"}`);
  p.log.info("Generate at: https://vercel.com/account/tokens (team-scoped recommended)");

  const token = await p.password({
    message: `Vercel PAT for ${accountId}`,
    validate: (v) => (v.length < 20 ? "Token looks too short" : undefined),
  });
  if (p.isCancel(token)) throw new Error("cancelled");

  const v = await validateToken(token);
  if (v.error) throw new Error(v.error);
  p.log.success(`Validated as ${v.username ?? v.email}`);

  const teamId = await p.text({
    message: `Vercel team ID for ${accountId} (leave blank for personal scope)`,
    initialValue: "",
  });
  if (p.isCancel(teamId)) throw new Error("cancelled");

  const extra: Record<string, string> = {};
  if (teamId && teamId.trim()) extra.teamId = teamId.trim();

  return {
    provider: "vercel",
    accountId,
    email: v.email,
    scopes: declared?.scope ? [declared.scope] : [],
    token,
    extra: Object.keys(extra).length ? extra : undefined,
  };
}
