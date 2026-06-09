import * as p from "@clack/prompts";
import {
  deviceCodeGoogle,
  fetchGoogleUserInfo,
  localCallbackGoogle,
  shouldUseLocalCallback,
  type GoogleOAuthCreds,
} from "./oauth.js";
import { loadIdentitiesYaml, scopesFor } from "./yaml-loader.js";
import type { BootstrapResult } from "./types.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} missing in env — run under apps/agents/scripts/with-infisical.sh or export it manually`);
  }
  return v;
}

export async function bootstrapGoogle(accountId: string): Promise<BootstrapResult> {
  const yaml = loadIdentitiesYaml();
  if (!yaml) throw new Error("identities.yaml not found (looked in cwd + apps/agents/config)");
  const scopes = scopesFor(yaml, "google", accountId);
  if (scopes.length === 0) throw new Error(`no Google scopes declared for account '${accountId}' in identities.yaml`);

  const creds: GoogleOAuthCreds = {
    clientId: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
  };

  p.log.step(`Requesting Google OAuth for '${accountId}' with ${scopes.length} scope(s)`);
  for (const s of scopes) p.log.info(`  · ${s}`);

  const tokens = shouldUseLocalCallback()
    ? await localCallbackGoogle(creds, scopes)
    : await deviceCodeGoogle(creds, scopes);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google returned no refresh_token — likely the account has previously consented. Revoke this app at https://myaccount.google.com/permissions and try again.",
    );
  }

  const info = await fetchGoogleUserInfo(tokens.access_token);
  const expectedEmail = yaml.providers.google?.accounts?.[accountId]?.email;
  if (expectedEmail && info.email && expectedEmail.toLowerCase() !== info.email.toLowerCase()) {
    throw new Error(
      `Google identity mismatch for '${accountId}': identities.yaml expects ${expectedEmail} but signed-in account is ${info.email}. Aborting bootstrap.`,
    );
  }

  return {
    provider: "google",
    accountId,
    email: info.email ?? expectedEmail,
    scopes,
    token: tokens.refresh_token,
  };
}
