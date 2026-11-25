// What activate() registers: the stage and the panel (with its mask
// sub-panel), named under the manifest's id; deactivate() takes the stage
// back out and lets go of the picker.

import { describe, expect, it } from "vitest";
import manifest from "../safelight.json";
import { PANEL_ID, activate, deactivate } from "../src/index";
import { ColourLutPanel } from "../src/Panel";
import { EXT_ID, PARAM_KEYS, STAGE_ID, bagPatch, qualified } from "../src/params";
import { DEFAULT_PARAMS } from "../src/model";
import { store } from "../src/store";
import { fakeApi } from "./support/fake-api";

describe("activate", () => {
  it("registers the stage", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.stages.map((s) => s.id)).toEqual([STAGE_ID]);
  });

  it("registers the panel in Develop, and for masks over every param", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.panels).toHaveLength(1);
    expect(rig.panels[0]).toMatchObject({
      id: PANEL_ID,
      title: "Colour Look Up Table",
      component: ColourLutPanel,
      defaultDock: { module: "develop", direction: "right" },
      mask: { component: ColourLutPanel, owns: PARAM_KEYS.map(qualified) },
    });
  });

  it("names its contributions under the manifest's id", () => {
    expect(EXT_ID).toBe(manifest.id);
    expect(PANEL_ID.startsWith(`${manifest.id}.`)).toBe(true);
    expect(STAGE_ID.startsWith(`${manifest.id}.`)).toBe(true);
  });

  it("holds the pick-drag tool while the picker is on", () => {
    const rig = fakeApi();
    activate(rig.api);
    store().getState().setPicking(true);
    expect(rig.pickDrag()).not.toBeNull();
    store().getState().setPicking(false);
    expect(rig.pickDrag()).toBeNull();
  });

  it("resets to the defaults from the panel header", () => {
    const moved = { patches: DEFAULT_PARAMS.patches.map((p, k) => (k === 0 ? { ...p, target: [1, 2, 3] as const } : p)) };
    const rig = fakeApi(bagPatch(moved));
    activate(rig.api);
    rig.panels[0].onReset?.();
    expect(rig.params()).toEqual(bagPatch(DEFAULT_PARAMS));
    expect(rig.commits).toEqual(["Colour Look Up Table reset"]);
  });

  it("unregisters the stage and lets go of the picker on deactivate, once", () => {
    const rig = fakeApi();
    activate(rig.api);
    store().getState().setPicking(true);
    deactivate();
    deactivate();
    expect(rig.unregistered).toEqual([STAGE_ID]);
    expect(rig.pickDrag()).toBeNull();
  });
});
