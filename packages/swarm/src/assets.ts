import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the shipped board/template assets. Dev: `<pkg>/src` → `<pkg>/assets`.
 * Published bundle: `<dist>/index.js` → `<dist>/assets` (copied at build time).
 */
export function assetsDir(): string {
  for (const c of [resolve(here, "../assets"), resolve(here, "./assets")]) {
    if (existsSync(c)) return c;
  }
  return resolve(here, "../assets");
}

/** Board files copied into a target repo's `.swarm/` on prepare. */
export const BOARD_FILES = ["board.html", "board.js", "board.css"];
export const THREAD_TEMPLATE = "THREAD.template.md";
