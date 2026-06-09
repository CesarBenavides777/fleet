import { onPath, sh } from "@fleet/core";
import { tailLines, type MuxDriver, type NewSurfaceOpts, type SurfaceRef } from "./driver.js";

// tmux has no "surfaces" — model each agent as a window inside one fleet session.
const SESSION = process.env.FLEET_TMUX_SESSION ?? "fleet";

export function tmuxAvailable(): boolean {
  return onPath("tmux");
}

function ensureSession(): void {
  if (!sh("tmux", ["has-session", "-t", SESSION]).ok) {
    sh("tmux", ["new-session", "-d", "-s", SESSION, "-n", "fleet"]);
  }
}

function newSurface({ name }: NewSurfaceOpts): SurfaceRef {
  ensureSession();
  // -a = insert AFTER the current window so tmux picks the next free index;
  // a bare `-t SESSION` targets the existing window 0 and fails "index in use".
  const r = sh("tmux", ["new-window", "-a", "-t", SESSION, "-n", name, "-P", "-F", "#{window_id}"]);
  if (!r.ok) throw new Error(`tmux new-window failed: ${r.out}`);
  return { id: r.out.trim() };
}

function renameTab(ref: SurfaceRef, name: string): void {
  sh("tmux", ["rename-window", "-t", ref.id, name]);
}

function send(ref: SurfaceRef, text: string): void {
  // -l = literal: type the text without interpreting key names.
  sh("tmux", ["send-keys", "-t", ref.id, "-l", text]);
}

function sendKey(ref: SurfaceRef, key: string): void {
  sh("tmux", ["send-keys", "-t", ref.id, key]);
}

function readScreen(ref: SurfaceRef, lines?: number): string {
  return tailLines(sh("tmux", ["capture-pane", "-t", ref.id, "-p"]).out, lines);
}

export const tmuxDriver: MuxDriver = {
  kind: "tmux",
  newSurface,
  renameTab,
  send,
  sendKey,
  readScreen,
};
