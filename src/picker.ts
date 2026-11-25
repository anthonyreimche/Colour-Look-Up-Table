// The colour picker on the patch selector: darktable's point picker. While it
// is on it holds the canvas's pick-drag tool, so core routes a press on the
// image to it, keeps Ctrl/⌘/Space for pan and zoom, lets go on Esc or when
// another picker or a canvas tool takes over. A press samples the view with
// this stage off (the module reads its own input, as darktable's picker
// does) through core's eyedropper sample, takes the colour to Lab, and
// selects the patch whose source is nearest (color_picker_apply). The
// picked colour stays for Shift+click on the grid, which puts it on a patch.
// The picker stays on until its button is pressed again or Esc, as
// darktable's does.

import { labFromDisplay } from "./model";
import { nearestPatch } from "./patches";
import { qualified, readParams } from "./params";
import { api } from "./rt";
import type { CanvasPoint, PickDragTool } from "./safelight";
import { store } from "./store";

/** The bag that leaves this stage out of the sample. */
export const WITHOUT_STAGE = Object.freeze({ [qualified("active")]: 0 });

export async function pickAt(point: CanvasPoint): Promise<void> {
  try {
    const photoId = api.stores.useDevelopStore.getState().photoId;
    const rgb = await api.develop.sampleView(point, WITHOUT_STAGE);
    const ui = store().getState();
    const dev = api.stores.useDevelopStore.getState();
    if (!rgb || !ui.picking || dev.photoId !== photoId) return;
    const lab = labFromDisplay(rgb);
    ui.setPicked(lab);
    const k = nearestPatch(readParams(dev.paramBag), lab);
    if (k !== null) ui.setPatch(k);
  } catch (err) {
    console.warn("[colour-look-up-table] pick failed:", err);
  }
}

const PICK_TOOL: PickDragTool = { onPress: (point) => void pickAt(point) };

/** Hold the canvas's pick-drag tool while the picker is on, and let go when
 *  it goes off. Returns the unsubscribe. */
export function syncPickDrag(): () => void {
  return store().subscribe((state, prev) => {
    if (state.picking !== prev.picking) api.develop.setPickDrag(state.picking ? PICK_TOOL : null);
  });
}
