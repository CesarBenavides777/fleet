/**
 * A terminal-multiplexer driver. A "surface" is a tab/pane that runs one agent.
 *
 * Hard-won distinction (cmux): a surface is a TAB, created with `new-surface`,
 * NOT `new-workspace` (which makes a sidebar workspace). `send` TYPES text but
 * does not press Enter — submit with a separate `sendKey(ref, "Enter")`.
 */
export interface SurfaceRef {
  /** Opaque, driver-specific id. cmux: "surface:NN". tmux: "@N" (window id). */
  id: string;
}

export interface NewSurfaceOpts {
  name: string;
  focus?: boolean;
}

export interface MuxDriver {
  readonly kind: "cmux" | "tmux";
  /** Create a new tab/window, name it, and return its ref. Throws on failure. */
  newSurface(opts: NewSurfaceOpts): SurfaceRef;
  renameTab(ref: SurfaceRef, name: string): void;
  /** Type text into the surface — does NOT submit. */
  send(ref: SurfaceRef, text: string): void;
  /** Press a key (e.g. "Enter") in the surface. */
  sendKey(ref: SurfaceRef, key: string): void;
  /** Read visible screen text; pass `lines` to keep only the last N. */
  readScreen(ref: SurfaceRef, lines?: number): string;
}

export function tailLines(text: string, lines?: number): string {
  if (!lines) return text;
  return text.split("\n").slice(-lines).join("\n");
}
