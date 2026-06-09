export {
  tailLines,
  type MuxDriver,
  type NewSurfaceOpts,
  type SurfaceRef,
} from "./driver.js";
export { cmuxDriver, cmuxAvailable, CMUX_BIN } from "./cmux.js";
export { tmuxDriver, tmuxAvailable } from "./tmux.js";

import { cmuxAvailable, cmuxDriver } from "./cmux.js";
import { tmuxAvailable, tmuxDriver } from "./tmux.js";
import type { MuxDriver } from "./driver.js";

export type MuxKind = "cmux" | "tmux";

/**
 * Resolve a mux driver. Precedence: FLEET_MUX env → `preferred` (config) →
 * auto-detect (cmux app present → cmux, else tmux on PATH → tmux) → cmux
 * (which errors clearly at call time if it is not actually installed).
 */
export function selectMux(preferred?: MuxKind | string): MuxDriver {
  const choice = (process.env.FLEET_MUX ?? preferred ?? "").toLowerCase();
  if (choice === "tmux") return tmuxDriver;
  if (choice === "cmux") return cmuxDriver;
  if (cmuxAvailable()) return cmuxDriver;
  if (tmuxAvailable()) return tmuxDriver;
  return cmuxDriver;
}
