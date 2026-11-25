// Colour Look Up Table, a Safelight extension (GPL-3.0-or-later).
//
// darktable's color look up table: up to 49 patches, each taking a colour to
// a target, and every other colour carried along a thin-plate spline in Lab.
// Registers the display-adjust stage (stage.ts) and the Develop panel
// (Panel.tsx), which also edits a mask's patches in the Masking panel, and
// holds the canvas's pick-drag tool while the panel's picker is on
// (picker.ts).

import { ColourLutPanel } from "./Panel";
import { EXT_ID, PARAM_KEYS, STAGE_ID, qualified, resetPatch } from "./params";
import { syncPickDrag } from "./picker";
import { api, initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { lutStage } from "./stage";
import { initStore, store } from "./store";

export const PANEL_ID = `${EXT_ID}.panel`;

// Null until activate() runs.
let activeHost: SafelightAPI | null = null;
let stopPickDrag: (() => void) | null = null;

function reset(): void {
  const dev = api.stores.useDevelopStore.getState();
  dev.setDynParams(resetPatch());
  void dev.commitEdit("Colour Look Up Table reset");
}

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  initStore();
  activeHost = host;
  stopPickDrag = syncPickDrag();
  // While every target sits on its source `active` is 0: the renderer leaves
  // the stage out, so an untouched photo renders bit for bit unchanged.
  host.registerProcessingStage(lutStage());
  host.registerPanel({
    id: PANEL_ID,
    title: "Colour Look Up Table",
    component: ColourLutPanel,
    defaultDock: { module: "develop", direction: "right", width: 268 },
    onReset: reset,
    mask: { component: ColourLutPanel, owns: PARAM_KEYS.map(qualified) },
  });
}

export function deactivate(): void {
  const host = activeHost;
  if (!host) return;
  activeHost = null;
  // A throw here would skip the host's sweep of this extension's
  // registrations, so a failure is logged instead.
  try {
    store().getState().setPicking(false);
    stopPickDrag?.();
    stopPickDrag = null;
    host.develop.setPickDrag(null);
    host.unregisterProcessingStage(STAGE_ID);
  } catch (err) {
    console.warn("[colour-look-up-table] deactivate failed:", err);
  }
}
