import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { IdentitiesYaml } from "./types.js";

export function loadIdentitiesYaml(cwd: string = process.cwd()): IdentitiesYaml | null {
  const candidates = [
    resolve(cwd, "config", "identities.yaml"),
    resolve(cwd, "apps", "agents", "config", "identities.yaml"),
    resolve(cwd, "..", "agents", "config", "identities.yaml"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return parseYaml(readFileSync(path, "utf8")) as IdentitiesYaml;
    }
  }
  return null;
}

export function scopesFor(yaml: IdentitiesYaml, provider: "google" | "figma", accountId: string): string[] {
  const acc = yaml.providers[provider]?.accounts?.[accountId];
  if (!acc) return [];
  return acc.scopes ?? [];
}
