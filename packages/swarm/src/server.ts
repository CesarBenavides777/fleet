import { spawn } from "node:child_process";
import { createReadStream, existsSync, openSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { sh } from "@fleet/core";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// The board fetches same-origin relative URLs, so no CORS header is needed —
// omitting it keeps other origins from reading the local status/comms files.
const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

/** Block until the no-cache static server for `.swarm/` exits. Bound to 127.0.0.1. */
export function serveForeground(swarmDir: string, port: number): void {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const rel = urlPath === "/" ? "/board.html" : urlPath;
    // Contain within swarmDir — reject path traversal. Anchor the prefix at a
    // separator so a sibling like "<swarmDir>-evil" can't bypass the check.
    const filePath = normalize(join(swarmDir, rel));
    const safeRoot = swarmDir.endsWith(sep) ? swarmDir : swarmDir + sep;
    const inside = filePath === swarmDir || filePath.startsWith(safeRoot);
    if (!inside || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, NO_CACHE);
      res.end("not found");
      return;
    }
    res.writeHead(200, { ...NO_CACHE, "Content-Type": MIME[extname(filePath)] ?? "text/plain" });
    createReadStream(filePath).pipe(res);
  });
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`fleet board server on http://127.0.0.1:${port}/board.html\n`);
  });
}

/** True if something is already listening on `port`. */
export function serverRunning(port: number): boolean {
  return sh("lsof", ["-ti", `tcp:${port}`]).ok;
}

/** Kill whatever holds `port` (used by teardown). */
export function killServer(port: number): boolean {
  const pids = sh("lsof", ["-ti", `tcp:${port}`]).out.split(/\s+/).filter(Boolean);
  if (!pids.length) return false;
  sh("kill", pids);
  return true;
}

/**
 * Start the server detached (survives the CLI exit), logging to `.swarm/server.log`.
 * Re-invokes this same CLI binary with `swarm serve`, so it works in dev (bun + .ts)
 * and from the published bundle alike.
 */
export function startServerDetached(swarmDir: string, port: number): boolean {
  if (serverRunning(port)) return false;
  const entry = process.argv[1] ?? "";
  const logFd = openSync(join(swarmDir, "server.log"), "a");
  const child = spawn(
    process.execPath,
    [entry, "swarm", "serve", "--swarm", swarmDir, "--port", String(port)],
    { detached: true, stdio: ["ignore", logFd, logFd] },
  );
  child.unref();
  return true;
}
