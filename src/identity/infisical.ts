import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InfisicalContext, Provider } from "./types.js";

const DEFAULT_INFISICAL_BIN = process.env.INFISICAL_BIN ?? "infisical";

export function detectInfisicalContext(cwd: string = process.cwd()): InfisicalContext | null {
  const ctxPath = resolve(cwd, ".infisical.json");
  if (!existsSync(ctxPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(ctxPath, "utf8")) as {
      workspaceId?: string;
      defaultEnvironment?: string;
    };
    if (!raw.workspaceId) return null;
    return {
      projectId: raw.workspaceId,
      envSlug: raw.defaultEnvironment ?? "prod",
      adminApi: process.env.INFISICAL_ADMIN_API ?? "http://secrets.cesar:8090",
    };
  } catch {
    return null;
  }
}

export interface SecretWriteInput {
  provider: Provider;
  accountId: string;
  key: string;
  value: string;
}

function pathFor(provider: Provider, accountId: string, key: string): string {
  return `/${provider}/${accountId.toLowerCase()}/${key}`;
}

export function writeIdentitySecret(input: SecretWriteInput, ctx: InfisicalContext): { ok: boolean; error?: string } {
  const path = pathFor(input.provider, input.accountId, input.key);
  const args = [
    "secrets",
    "set",
    `${input.key}=${input.value}`,
    `--env=${ctx.envSlug}`,
    `--projectId=${ctx.projectId}`,
    `--path=${path.split("/").slice(0, -1).join("/") || "/"}`,
    "--silent",
  ];
  const r = spawnSync(DEFAULT_INFISICAL_BIN, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || r.stdout || "").trim().slice(0, 300) };
  }
  return { ok: true };
}

export function deleteIdentitySecret(input: Omit<SecretWriteInput, "value">, ctx: InfisicalContext): { ok: boolean; error?: string } {
  const path = pathFor(input.provider, input.accountId, input.key);
  const args = [
    "secrets",
    "delete",
    input.key,
    `--env=${ctx.envSlug}`,
    `--projectId=${ctx.projectId}`,
    `--path=${path.split("/").slice(0, -1).join("/") || "/"}`,
    "--silent",
  ];
  const r = spawnSync(DEFAULT_INFISICAL_BIN, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || "").trim().slice(0, 300) };
  return { ok: true };
}

const TOKEN_KEY: Record<Provider, string> = {
  google: "GOOGLE_REFRESH_TOKEN",
  github: "GITHUB_TOKEN",
  figma: "FIGMA_TOKEN",
  vercel: "VERCEL_TOKEN",
};

export const envVarName = (
  provider: Provider,
  suffix: "TOKEN" | "EMAIL" | "SCOPES" | "BOOTSTRAPPED_AT",
  accountId: string,
) =>
  `${suffix === "TOKEN" ? TOKEN_KEY[provider] : `${provider.toUpperCase()}_${suffix}`}__${accountId.toUpperCase()}`;
