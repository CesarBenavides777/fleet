import { existsSync } from "node:fs";
import { sh } from "@fleet/core";
import { tailLines, type MuxDriver, type NewSurfaceOpts, type SurfaceRef } from "./driver.js";

export const CMUX_BIN =
  process.env.CMUX_BIN ?? "/Applications/cmux.app/Contents/Resources/bin/cmux";

export function cmuxAvailable(): boolean {
  return existsSync(CMUX_BIN);
}

function newSurface({ name, focus = false }: NewSurfaceOpts): SurfaceRef {
  const r = sh(CMUX_BIN, ["new-surface", "--type", "terminal", "--focus", String(focus)]);
  if (!r.ok) throw new Error(`cmux new-surface failed (is cmux running?): ${r.out}`);
  const m = r.out.match(/surface:\d+/);
  if (!m) throw new Error(`cmux new-surface: no surface id in output: ${r.out}`);
  const ref: SurfaceRef = { id: m[0] };
  renameTab(ref, name);
  return ref;
}

function renameTab(ref: SurfaceRef, name: string): void {
  sh(CMUX_BIN, ["rename-tab", "--surface", ref.id, name]);
}

function send(ref: SurfaceRef, text: string): void {
  sh(CMUX_BIN, ["send", "--surface", ref.id, text]);
}

function sendKey(ref: SurfaceRef, key: string): void {
  sh(CMUX_BIN, ["send-key", "--surface", ref.id, key]);
}

function readScreen(ref: SurfaceRef, lines?: number): string {
  return tailLines(sh(CMUX_BIN, ["read-screen", "--surface", ref.id]).out, lines);
}

export const cmuxDriver: MuxDriver = {
  kind: "cmux",
  newSurface,
  renameTab,
  send,
  sendKey,
  readScreen,
};
