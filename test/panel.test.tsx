// The panel over the fake host: the chart and its gestures, the patch
// selector, the four sliders in both modes (each drag one undo step), the
// presets, the picker (sampling with the stage off, selecting the nearest
// patch, Shift+click placing the colour), and the mask scope.

import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { activate, deactivate } from "../src/index";
import { DEFAULT_PARAMS, displayFromLab, type Params, type Vec3 } from "../src/model";
import { ColourLutPanel } from "../src/Panel";
import { bagPatch, qualified, readParams } from "../src/params";
import { PRESETS } from "../src/presets";
import { store } from "../src/store";
import { fakeApi, type Rig } from "./support/fake-api";

let rig: Rig;

function open(initial: Params = DEFAULT_PARAMS): HTMLElement {
  rig = fakeApi(bagPatch(initial));
  activate(rig.api);
  return render(<ColourLutPanel />).container;
}

const params = () => readParams(rig.params());
const slider = (root: HTMLElement, label: string) => {
  const s = rig.sliders(root).find((p) => p.label === label);
  if (!s) throw new Error(`no slider ${label}`);
  return s;
};
const cells = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-label")?.startsWith("Patch ") || b.getAttribute("aria-label") === "Empty cell");

afterEach(() => {
  cleanup();
  deactivate();
});

describe("the chart", () => {
  beforeEach(() => void open());

  it("draws 24 patches in a 6×4 grid, the first selected", () => {
    expect(cells()).toHaveLength(24);
    expect(screen.getByRole("button", { name: "Patch 1" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("selects a patch on click, and the sliders follow it", () => {
    fireEvent.click(screen.getByRole("button", { name: "Patch 7" }));
    expect(store().getState().patch).toBe(6);
    expect((screen.getByRole("combobox", { name: "Patch" }) as HTMLSelectElement).value).toBe("6");
  });

  it("resets a patch on double-click, as one undo step", () => {
    const moved = { patches: DEFAULT_PARAMS.patches.map((p, k) => (k === 2 ? { ...p, target: [10, 10, 10] as Vec3 } : p)) };
    act(() => rig.replace(bagPatch(moved)));
    expect(screen.getByRole("button", { name: "Patch 3" }).getAttribute("data-altered")).toBe("true");
    fireEvent.doubleClick(screen.getByRole("button", { name: "Patch 3" }));
    expect(params().patches[2].target).toEqual(params().patches[2].source);
    expect(rig.commits).toEqual(["Colour Look Up Table reset patch"]);
  });

  it("deletes a patch on right-click", () => {
    fireEvent.contextMenu(screen.getByRole("button", { name: "Patch 5" }));
    expect(params().patches).toHaveLength(23);
    expect(params().patches[4]).toEqual({ source: [...DEFAULT_PARAMS.patches[5].source], target: [...DEFAULT_PARAMS.patches[5].target] });
    expect(rig.commits).toEqual(["Colour Look Up Table delete patch"]);
    expect(screen.getAllByRole("button", { name: "Empty cell" })).toHaveLength(1);
  });

  it("switches to a 7×7 grid for more than 24 patches", () => {
    act(() => rig.replace(bagPatch(PRESETS[1].params)));
    expect(cells()).toHaveLength(49);
  });

  it("explains its gestures in each cell's tooltip, with the patch's colour", () => {
    const title = screen.getByRole("button", { name: "Patch 1" }).getAttribute("title") ?? "";
    expect(title).toMatch(/^L 37\.99 {2}a 13\.56 {2}b 14\.06\n/);
    expect(title).toMatch(/double-click to reset, right-click to delete/);
  });
});

describe("the sliders", () => {
  it("move the selected patch's target from its colour, one undo step a drag", () => {
    const root = open();
    act(() => store().getState().setPatch(6));
    act(() => slider(root, "Lightness").onChange(4));
    act(() => slider(root, "Lightness").onChange(5));
    act(() => slider(root, "Lightness").onCommit?.());
    const t = params().patches[6].target;
    expect(t[0]).toBeCloseTo(DEFAULT_PARAMS.patches[6].source[0] + 5, 10);
    expect(rig.commits).toEqual(["Colour Look Up Table lightness"]);
    expect(rig.params()[qualified("active")]).toBe(1);
  });

  it("show offsets in relative mode and Lab values in absolute", () => {
    const root = open({ patches: [{ source: [50, 30, 40], target: [55, 6, 8] }] });
    expect(slider(root, "Lightness").value).toBeCloseTo(5, 10);
    expect(slider(root, "Saturation").value).toBeCloseTo(-40, 10);
    fireEvent.change(screen.getByRole("combobox", { name: "Target colour" }), { target: { value: "absolute" } });
    expect(slider(root, "Lightness").value).toBe(55);
    expect(slider(root, "Green-magenta offset").value).toBe(6);
    expect(slider(root, "Blue-yellow offset").value).toBe(8);
    expect(slider(root, "Saturation").value).toBe(10);
  });

  it("reset to the patch's own colour on double-click in either mode", () => {
    const root = open({ patches: [{ source: [50, 30, 40], target: [55, 6, 8] }] });
    expect(slider(root, "Lightness").defaultValue).toBe(0);
    act(() => store().getState().setAbsolute(true));
    expect(slider(root, "Lightness").defaultValue).toBe(50);
    expect(slider(root, "Saturation").defaultValue).toBe(50);
  });

  it("scale saturation from the target the drag started with", () => {
    const root = open({ patches: [{ source: [50, 30, 40], target: [55, 6, 8] }] });
    act(() => store().getState().setAbsolute(true));
    act(() => slider(root, "Saturation").onChange(0));
    act(() => slider(root, "Saturation").onChange(20));
    act(() => slider(root, "Saturation").onCommit?.());
    const t = params().patches[0].target;
    expect(t[1]).toBeCloseTo(12, 6);
    expect(t[2]).toBeCloseTo(16, 6);
    expect(rig.commits).toEqual(["Colour Look Up Table saturation"]);
  });

  it("paint darktable's green-magenta and blue-yellow tracks", () => {
    const root = open();
    expect(slider(root, "Green-magenta offset").trackBackground).toMatch(/rgb\(0, 255, 51\).*rgb\(255, 0, 51\)/);
    expect(slider(root, "Blue-yellow offset").trackBackground).toMatch(/rgb\(0, 0, 255\).*rgb\(255, 255, 0\)/);
  });

  it("are gone with no patches left", () => {
    const root = open({ patches: [] });
    expect(rig.sliders(root)).toEqual([]);
    expect(screen.queryByRole("combobox", { name: "Patch" })).toBeNull();
  });
});

describe("presets", () => {
  it("apply darktable's patches as one undo step", () => {
    open();
    fireEvent.change(screen.getByRole("combobox", { name: "Colour Look Up Table preset" }), { target: { value: "velvia" } });
    expect(rig.params()).toEqual(bagPatch(PRESETS.find((p) => p.id === "velvia")!.params));
    expect(rig.commits).toEqual(["Colour Look Up Table preset: Fuji Velvia emulation"]);
  });
});

describe("the picker", () => {
  const pressAt = async (point = { x: 12, y: 34 }) => {
    const tool = rig.pickDrag();
    if (!tool?.onPress) throw new Error("no pick-drag tool held");
    await act(async () => tool.onPress?.(point));
  };

  it("arms from its button and holds the pick-drag tool", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pick a colour" }));
    expect(store().getState().picking).toBe(true);
    expect(rig.pickDrag()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pick a colour" }));
    expect(rig.pickDrag()).toBeNull();
  });

  it("samples the view with this stage off and selects the nearest patch", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pick a colour" }));
    rig.setSample(displayFromLab([62, 36, 57]) as [number, number, number]);
    await pressAt();
    expect(rig.samples).toEqual([{ point: { x: 12, y: 34 }, paramBag: { [qualified("active")]: 0 } }]);
    expect(store().getState().patch).toBe(6);
    const picked = store().getState().picked;
    expect(picked?.[0]).toBeCloseTo(62, 6);
    expect(store().getState().picking).toBe(true);
    expect(rig.commits).toEqual([]);
  });

  it("puts the picked colour on a patch with Shift+click", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pick a colour" }));
    rig.setSample(displayFromLab([44, 12, -8]) as [number, number, number]);
    await pressAt();
    fireEvent.click(screen.getByRole("button", { name: "Patch 10" }), { shiftKey: true });
    const patch = params().patches[9];
    expect(patch.source[0]).toBeCloseTo(44, 6);
    expect(patch.target).toEqual(patch.source);
    expect(store().getState().patch).toBe(9);
    expect(rig.commits).toEqual(["Colour Look Up Table picked patch"]);
  });

  it("drops a pick that lands after another photo opened", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pick a colour" }));
    rig.setSample([0.5, 0.5, 0.5]);
    const tool = rig.pickDrag();
    await act(async () => {
      const done = tool?.onPress?.({ x: 1, y: 1 });
      rig.switchPhoto("photo-2");
      await done;
    });
    expect(store().getState().picked).toBeNull();
  });

  it("turns off when another tool takes the canvas", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pick a colour" }));
    act(() => rig.releasePickDrag());
    expect(store().getState().picking).toBe(false);
  });

  it("is hidden in a mask's panel, where Shift+click places nothing", () => {
    rig = fakeApi(bagPatch(DEFAULT_PARAMS));
    activate(rig.api);
    rig.setMask("mask-1");
    render(<ColourLutPanel />);
    expect(screen.queryByRole("button", { name: "Pick a colour" })).toBeNull();
    act(() => store().getState().setPicked([44, 12, -8]));
    fireEvent.click(screen.getByRole("button", { name: "Patch 10" }), { shiftKey: true });
    expect(rig.commits).toEqual([]);
  });
});
