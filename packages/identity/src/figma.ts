import * as p from "@clack/prompts";
import { loadIdentitiesYaml } from "./yaml-loader.js";
import type { BootstrapResult } from "./types.js";

async function validateToken(token: string): Promise<{ email?: string; handle?: string; error?: string }> {
  const res = await fetch("https://api.figma.com/v1/me", {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) return { error: `Figma /v1/me returned ${res.status}` };
  const json = (await res.json()) as { email?: string; handle?: string };
  return { email: json.email, handle: json.handle };
}

export async function bootstrapFigma(accountId: string): Promise<BootstrapResult> {
  const yaml = loadIdentitiesYaml();
  const declared = yaml?.providers.figma?.accounts?.[accountId];
  const scopes = declared?.scopes ?? [];

  p.log.step(`Bootstrap Figma PAT for '${accountId}'`);
  if (scopes.length) {
    p.log.info(`Expected scopes:`);
    for (const s of scopes) p.log.info(`  · ${s}`);
  }
  p.log.info("Generate at: https://www.figma.com/developers/api#access-tokens");

  const token = await p.password({
    message: `Figma PAT for ${accountId}`,
    validate: (v) => (v.length < 20 ? "Token looks too short" : undefined),
  });
  if (p.isCancel(token)) throw new Error("cancelled");

  const v = await validateToken(token);
  if (v.error) throw new Error(v.error);
  p.log.success(`Validated as @${v.handle ?? v.email}`);

  return {
    provider: "figma",
    accountId,
    email: v.email,
    scopes,
    token,
  };
}
