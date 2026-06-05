import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const DEVICE_CODE_URL = "https://oauth2.googleapis.com/device/code";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleOAuthCreds {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}

export function shouldUseLocalCallback(): boolean {
  if (process.env.IDENTITY_FORCE_DEVICE === "1") return false;
  if (process.env.IDENTITY_FORCE_LOCAL === "1") return true;
  if (!process.stdin.isTTY) return false;
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return false;
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return false;
  return true;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    // user can copy/paste
  }
}

export async function localCallbackGoogle(
  creds: GoogleOAuthCreds,
  scopes: string[],
): Promise<GoogleTokens> {
  const port = await findFreePort();
  const redirect = `http://127.0.0.1:${port}/callback`;
  const state = randomBytes(16).toString("hex");

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  console.log(`\nOpening browser:\n  ${url.toString()}\n`);
  openBrowser(url.toString());

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400).end("bad request");
        return;
      }
      const reqUrl = new URL(req.url, redirect);
      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404).end("not found");
        return;
      }
      const gotState = reqUrl.searchParams.get("state");
      const gotCode = reqUrl.searchParams.get("code");
      const err = reqUrl.searchParams.get("error");
      if (err) {
        res.writeHead(400).end(`error: ${err}`);
        server.close();
        reject(new Error(`OAuth denied: ${err}`));
        return;
      }
      if (gotState !== state || !gotCode) {
        res.writeHead(400).end("state mismatch or missing code");
        server.close();
        reject(new Error("state mismatch or missing code"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body style='font-family:system-ui;padding:40px'><h2>Identity bootstrap complete.</h2><p>You can close this tab and return to the terminal.</p></body></html>",
      );
      server.close();
      resolve(gotCode);
    });
    server.listen(port, "127.0.0.1");
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth timeout (5 minutes)"));
    }, 5 * 60_000);
  });

  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as GoogleTokens;
}

export async function deviceCodeGoogle(creds: GoogleOAuthCreds, scopes: string[]): Promise<GoogleTokens> {
  const body = new URLSearchParams({ client_id: creds.clientId, scope: scopes.join(" ") });
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`device code request failed: ${res.status} ${await res.text()}`);
  const dc = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  };
  console.log(`\nOpen: ${dc.verification_url}`);
  console.log(`Code: ${dc.user_code}\n`);
  return pollDeviceToken(creds, dc.device_code, dc.interval, dc.expires_in);
}

async function pollDeviceToken(
  creds: GoogleOAuthCreds,
  deviceCode: string,
  intervalSec: number,
  expiresInSec: number,
): Promise<GoogleTokens> {
  const deadline = Date.now() + expiresInSec * 1000;
  let interval = intervalSec;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (res.ok) return json as unknown as GoogleTokens;
    const err = json.error as string | undefined;
    if (err === "authorization_pending") continue;
    if (err === "slow_down") {
      interval += 5;
      continue;
    }
    throw new Error(`token poll failed: ${err ?? res.status}`);
  }
  throw new Error("device code expired before approval");
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("could not allocate port"));
      });
    });
  });
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email?: string; sub?: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return (await res.json()) as { email?: string; sub?: string };
}
