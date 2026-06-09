import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { onPath } from "@fleet/core";
import { envVarName, type Provider } from "@fleet/identity";

// Read-only health probes for connections: identity tokens (OAuth / PATs) and
// configured MCP servers. Each probe returns a structured result so the doctor
// command can render a table and decide what to auto-fix.

export type ProbeStatus = "ok" | "no_token" | "invalid" | "unreachable" | "skipped";

export interface ProbeResult {
  kind: "identity" | "mcp" | "backend";
  target: string;
  status: ProbeStatus;
  detail: string;
  /** For identity probes only — lets `--fix` re-bootstrap. */
  fix?: { provider: Provider; accountId: string };
}

async function getJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** First non-empty string among the candidates, else "authenticated". */
function firstStr(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === "string" && v) return v;
  return "authenticated";
}

export async function probeIdentity(provider: Provider, accountId: string): Promise<ProbeResult> {
  const base: Pick<ProbeResult, "kind" | "target" | "fix"> = {
    kind: "identity",
    target: `${provider}/${accountId}`,
    fix: { provider, accountId },
  };
  const token = process.env[envVarName(provider, "TOKEN", accountId)];
  if (!token) return { ...base, status: "no_token", detail: "token not in env" };

  try {
    switch (provider) {
      case "google": {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret)
          return {
            ...base,
            status: "skipped",
            detail: "GOOGLE_OAUTH_CLIENT_ID/SECRET missing — cannot refresh",
          };
        const refresh = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token,
            grant_type: "refresh_token",
          }).toString(),
        });
        if (!refresh.ok) return { ...base, status: "invalid", detail: `refresh ${refresh.status}` };
        const { access_token } = (await getJson(refresh)) as { access_token?: string };
        if (!access_token)
          return { ...base, status: "invalid", detail: "no access_token from refresh" };
        const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const profile = await getJson(info);
        return { ...base, status: "ok", detail: firstStr(profile.email) };
      }
      case "github": {
        const res = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${token}`, "User-Agent": "fleet" },
        });
        if (!res.ok) return { ...base, status: "invalid", detail: `GET /user ${res.status}` };
        const j = await getJson(res);
        return { ...base, status: "ok", detail: firstStr(j.login) };
      }
      case "figma": {
        const res = await fetch("https://api.figma.com/v1/me", {
          headers: { "X-Figma-Token": token },
        });
        if (!res.ok) return { ...base, status: "invalid", detail: `GET /v1/me ${res.status}` };
        const j = await getJson(res);
        return { ...base, status: "ok", detail: firstStr(j.email, j.handle) };
      }
      case "vercel": {
        const res = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ...base, status: "invalid", detail: `GET /v2/user ${res.status}` };
        const j = await getJson(res);
        const user = (j.user as Record<string, unknown> | undefined) ?? j;
        return { ...base, status: "ok", detail: firstStr(user.username, user.email) };
      }
    }
  } catch (err) {
    return {
      ...base,
      status: "unreachable",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

interface McpServer {
  command?: string;
  url?: string;
  type?: string;
}

/** Read mcpServers from .mcp.json or .claude/settings.json at the repo root. */
export function readMcpServers(root: string): Record<string, McpServer> {
  for (const rel of [
    ".mcp.json",
    join(".claude", "settings.json"),
    join(".claude", "settings.local.json"),
  ]) {
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    try {
      const json = JSON.parse(readFileSync(path, "utf8")) as {
        mcpServers?: Record<string, McpServer>;
      };
      if (json.mcpServers && Object.keys(json.mcpServers).length) return json.mcpServers;
    } catch {
      /* ignore malformed */
    }
  }
  return {};
}

export async function probeMcp(name: string, server: McpServer): Promise<ProbeResult> {
  const base: Pick<ProbeResult, "kind" | "target"> = { kind: "mcp", target: `mcp/${name}` };
  if (server.url) {
    try {
      const res = await fetch(server.url, { method: "GET" });
      // Any HTTP response (even 401/405) means the endpoint is reachable.
      return {
        ...base,
        status: res.status >= 500 ? "unreachable" : "ok",
        detail: `${server.url} → ${res.status}`,
      };
    } catch (err) {
      return {
        ...base,
        status: "unreachable",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }
  if (server.command) {
    return onPath(server.command)
      ? { ...base, status: "ok", detail: `${server.command} on PATH` }
      : { ...base, status: "unreachable", detail: `${server.command} not on PATH` };
  }
  return { ...base, status: "skipped", detail: "no url or command" };
}

export interface SecretBackend {
  name: string;
  detail: string;
}

/** Best-effort detection of which secret backend a workspace uses. */
export function detectSecretBackend(root: string): SecretBackend {
  if (
    existsSync(join(root, ".infisical.json")) ||
    existsSync(join(root, "apps", "agents", ".infisical.json"))
  )
    return { name: "infisical", detail: ".infisical.json" };
  if (existsSync(join(root, ".env.vault"))) return { name: "env-vault", detail: ".env.vault" };
  if (existsSync(join(root, "doppler.yaml")) || existsSync(join(root, ".doppler.yaml")))
    return { name: "doppler", detail: "doppler.yaml" };
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = Object.values(pkg.scripts ?? {}).join(" ");
    if (scripts.includes("doppler run")) return { name: "doppler", detail: "package.json scripts" };
    if (scripts.includes("op run") || existsSync(join(root, ".secretstash.json")))
      return { name: "1password", detail: "op run / .secretstash.json" };
  } catch {
    /* ignore */
  }
  if (existsSync(join(root, ".env"))) return { name: "dotenv", detail: ".env" };
  return { name: "none", detail: "no secret backend detected" };
}
