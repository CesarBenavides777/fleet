import { spawnSync } from "node:child_process";
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { bootstrapGoogle } from "./google.js";
import { bootstrapGithub } from "./github.js";
import { bootstrapFigma } from "./figma.js";
import { bootstrapVercel } from "./vercel.js";
import {
  detectInfisicalContext,
  writeIdentitySecret,
  deleteIdentitySecret,
  envVarName,
} from "./infisical.js";
import type { BootstrapResult, Provider } from "./types.js";

const PROVIDERS: Provider[] = ["google", "github", "figma", "vercel"];
const INFISICAL_BIN = process.env.INFISICAL_BIN ?? "infisical";

async function persistResult(result: BootstrapResult): Promise<void> {
  const ctx = detectInfisicalContext();
  if (!ctx) {
    p.log.warn(
      "No .infisical.json detected in cwd. Skipping Infisical write.\n" +
        "Set the following env vars manually (or cd into apps/agents first):",
    );
    p.log.info(`  ${envVarName(result.provider, "TOKEN", result.accountId)}=<token>`);
    if (result.email)
      p.log.info(`  ${envVarName(result.provider, "EMAIL", result.accountId)}=${result.email}`);
    if (result.scopes.length)
      p.log.info(
        `  ${envVarName(result.provider, "SCOPES", result.accountId)}=${result.scopes.join(",")}`,
      );
    p.log.info(
      `  ${envVarName(result.provider, "BOOTSTRAPPED_AT", result.accountId)}=${Date.now()}`,
    );
    return;
  }

  const writes: Array<{ key: string; value: string }> = [
    { key: envVarName(result.provider, "TOKEN", result.accountId), value: result.token },
    {
      key: envVarName(result.provider, "BOOTSTRAPPED_AT", result.accountId),
      value: String(Date.now()),
    },
  ];
  if (result.email)
    writes.push({
      key: envVarName(result.provider, "EMAIL", result.accountId),
      value: result.email,
    });
  if (result.scopes.length)
    writes.push({
      key: envVarName(result.provider, "SCOPES", result.accountId),
      value: result.scopes.join(","),
    });

  const spin = p.spinner();
  spin.start(`Writing ${writes.length} secret(s) to Infisical (env=${ctx.envSlug})`);
  for (const w of writes) {
    const r = writeIdentitySecret(
      { provider: result.provider, accountId: result.accountId, key: w.key, value: w.value },
      ctx,
    );
    if (!r.ok) {
      spin.stop(`Failed: ${r.error}`);
      throw new Error(r.error);
    }
  }
  spin.stop("Secrets written to Infisical");
}

export async function runBootstrap(provider: Provider, accountId: string): Promise<void> {
  let result: BootstrapResult;
  switch (provider) {
    case "google":
      result = await bootstrapGoogle(accountId);
      break;
    case "github":
      result = await bootstrapGithub(accountId);
      break;
    case "figma":
      result = await bootstrapFigma(accountId);
      break;
    case "vercel":
      result = await bootstrapVercel(accountId);
      break;
  }
  await persistResult(result);
  p.outro(pc.green(`Bootstrapped ${provider}/${accountId}`));
}

async function runListProvider(provider: Provider): Promise<void> {
  const ctx = detectInfisicalContext();
  if (!ctx) {
    p.log.warn("No .infisical.json — listing relies on Infisical context. cd into apps/agents.");
    return;
  }
  const r = spawnSync(
    INFISICAL_BIN,
    [
      "secrets",
      "folders",
      "list",
      `--projectId=${ctx.projectId}`,
      `--env=${ctx.envSlug}`,
      `--path=/${provider}/`,
    ],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  );
  if (r.status !== 0) {
    p.log.error((r.stderr || r.stdout || "").trim().slice(0, 500));
    return;
  }
  p.log.info(`Wired ${provider} accounts (env=${ctx.envSlug}):`);
  p.log.info(r.stdout.trim() || "  (none)");
}

async function runWhoami(provider: Provider, accountId: string): Promise<void> {
  const tokenVar = envVarName(provider, "TOKEN", accountId);
  const token = process.env[tokenVar];
  if (!token) {
    p.log.error(
      `${tokenVar} not in current env. Bootstrap/check with: fleet identity ${provider} whoami ${accountId}`,
    );
    process.exit(1);
  }
  switch (provider) {
    case "google": {
      const refreshUrl = "https://oauth2.googleapis.com/token";
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        p.log.error("GOOGLE_OAUTH_CLIENT_ID / SECRET missing");
        process.exit(1);
      }
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token,
        grant_type: "refresh_token",
      });
      const res = await fetch(refreshUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) {
        p.log.error(`refresh failed: ${res.status} ${await res.text()}`);
        process.exit(1);
      }
      const { access_token } = (await res.json()) as { access_token: string };
      const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const profile = (await info.json()) as Record<string, unknown>;
      p.log.success(`google/${accountId} ⇒ ${JSON.stringify(profile, null, 2)}`);
      return;
    }
    case "github": {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "fleet" },
      });
      if (!res.ok) {
        p.log.error(`gh failed: ${res.status}`);
        process.exit(1);
      }
      const json = await res.json();
      p.log.success(`github/${accountId} ⇒ ${JSON.stringify(json, null, 2)}`);
      return;
    }
    case "figma": {
      const res = await fetch("https://api.figma.com/v1/me", {
        headers: { "X-Figma-Token": token },
      });
      const body = await res.json();
      p.log.success(`figma/${accountId} ⇒ ${JSON.stringify(body, null, 2)}`);
      return;
    }
    case "vercel": {
      const res = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      p.log.success(`vercel/${accountId} ⇒ ${JSON.stringify(body, null, 2)}`);
      return;
    }
  }
}

async function runRevoke(provider: Provider, accountId: string): Promise<void> {
  const ctx = detectInfisicalContext();
  if (!ctx) throw new Error("no .infisical.json detected; cd into apps/agents first");
  const keys: Array<"TOKEN" | "EMAIL" | "SCOPES" | "BOOTSTRAPPED_AT"> = [
    "TOKEN",
    "EMAIL",
    "SCOPES",
    "BOOTSTRAPPED_AT",
  ];
  const confirm = await p.confirm({
    message: `Permanently delete all Infisical secrets under /${provider}/${accountId}/ (env=${ctx.envSlug})?`,
    initialValue: false,
  });
  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Aborted");
    return;
  }
  for (const k of keys) {
    const key = envVarName(provider, k, accountId);
    deleteIdentitySecret({ provider, accountId, key }, ctx);
  }
  p.outro(
    pc.yellow(
      `Revoked ${provider}/${accountId} from Infisical (manually revoke the upstream token if compromised)`,
    ),
  );
}

export const identityCommand = new Command("identity").description(
  "Bootstrap and manage per-account identities (google/github/figma/vercel)",
);

for (const provider of PROVIDERS) {
  identityCommand
    .command(`${provider} <action> [accountId]`)
    .description(`Manage a ${provider} identity (action: bootstrap | whoami | revoke | list)`)
    .action(async (action: string, accountId: string | undefined) => {
      if (action === "list") return runListProvider(provider);
      const id = accountId ?? "";
      if (!id) {
        p.log.error(`action '${action}' requires an accountId`);
        process.exit(2);
        return;
      }
      if (action === "bootstrap") return runBootstrap(provider, id);
      if (action === "whoami") return runWhoami(provider, id);
      if (action === "revoke") return runRevoke(provider, id);
      p.log.error(`unknown action '${action}'; expected bootstrap | whoami | revoke | list`);
      process.exit(2);
    });
}
