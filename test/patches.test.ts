// The panel's edits, as darktable's callbacks make them: the four sliders in
// relative and absolute mode (with glib's CLAMP on a and b, and saturation
// scaling a and b together), reset and delete from the grid, the picker
// choosing the nearest patch, and Shift+click placing a picked colour.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, MAX_PATCHES, type Params, type Vec3 } from "../src/model";
import {
  cellAt,
  deletePatch,
  gridSize,
  isAltered,
  nearestPatch,
  placePicked,
  resetPatch,
  setBlueYellow,
  setGreenMagenta,
  setLightness,
  setSaturation,
  sliderValues,
} from "../src/patches";

const one = (source: Vec3, target: Vec3): Params => ({ patches: [{ source, target }] });

describe("sliderValues", () => {
  const p = one([50, 30, 40], [55, 6, 8]);

  it("shows offsets from the source in relative mode", () => {
    const v = sliderValues(p, 0, false);
    expect(v.L).toBeCloseTo(5, 12);
    expect(v.a).toBeCloseTo(-24, 12);
    expect(v.b).toBeCloseTo(-32, 12);
    expect(v.C).toBeCloseTo(10 - 50, 12);
  });

  it("shows the target itself in absolute mode", () => {
    expect(sliderValues(p, 0, true)).toEqual({ L: 55, a: 6, b: 8, C: 10 });
  });
});

describe("the sliders", () => {
  const p = one([50, 30, 40], [55, 6, 8]);

  it("set lightness from the source, or as given, unclamped", () => {
    expect(setLightness(p, 0, -20, false).patches[0].target).toEqual([30, 6, 8]);
    expect(setLightness(p, 0, 180, true).patches[0].target).toEqual([180, 6, 8]);
  });

  it("set a and b from the source, or as given, held to ±128", () => {
    expect(setGreenMagenta(p, 0, 10, false).patches[0].target).toEqual([55, 40, 8]);
    expect(setGreenMagenta(p, 0, 200, false).patches[0].target).toEqual([55, 128, 8]);
    expect(setBlueYellow(p, 0, -250, true).patches[0].target).toEqual([55, 6, -128]);
    expect(setBlueYellow(p, 0, 12, false).patches[0].target).toEqual([55, 6, 52]);
  });

  it("scale a and b together for saturation, keeping the hue", () => {
    const abs = setSaturation(p, 0, 20, true).patches[0].target;
    expect(abs[0]).toBe(55);
    expect(abs[1]).toBeCloseTo(12, 10);
    expect(abs[2]).toBeCloseTo(16, 10);
    // relative: the new chroma is the source's (50) plus the slider
    const rel = setSaturation(p, 0, -30, false).patches[0].target;
    expect(Math.hypot(rel[1], rel[2])).toBeCloseTo(20, 10);
    expect(rel[2] / rel[1]).toBeCloseTo(8 / 6, 10);
  });

  it("hold saturation's chroma to 0.01..128 and a and b to ±128", () => {
    const tiny = setSaturation(p, 0, -500, false).patches[0].target;
    expect(Math.hypot(tiny[1], tiny[2])).toBeCloseTo(0.01, 10);
    const big = setSaturation(one([50, 0, 0], [50, 100, 1]), 0, 128, true).patches[0].target;
    expect(big[1]).toBeCloseTo(127.99, 1);
    expect(big[1]).toBeLessThanOrEqual(128);
  });

  // Cout = MAX(1e-4, |ab|): a grey target scales from a floor, not by zero.
  it("give a grey target a finite saturation", () => {
    const t = setSaturation(one([50, 0, 0], [50, 0, 0]), 0, 20, true).patches[0].target;
    expect(t).toEqual([50, 0, 0]);
  });

  it("leave other patches and a patch out of range alone", () => {
    const two: Params = { patches: [p.patches[0], { source: [20, 1, 1], target: [20, 1, 1] }] };
    expect(setLightness(two, 1, 5, false).patches[0]).toBe(two.patches[0]);
    expect(setLightness(two, 7, 5, false)).toBe(two);
  });
});

describe("the grid", () => {
  it("is 6×4 up to 24 patches, 7×7 past", () => {
    expect(gridSize(24)).toEqual({ cols: 6, rows: 4 });
    expect(gridSize(5)).toEqual({ cols: 6, rows: 4 });
    expect(gridSize(25)).toEqual({ cols: 7, rows: 7 });
    expect(gridSize(MAX_PATCHES)).toEqual({ cols: 7, rows: 7 });
  });

  it("finds the cell under a point, held inside the grid", () => {
    expect(cellAt(24, 0, 0, 600, 400)).toBe(0);
    expect(cellAt(24, 599, 399, 600, 400)).toBe(23);
    expect(cellAt(24, 600, 400, 600, 400)).toBe(23);
    expect(cellAt(30, 150, 150, 700, 700)).toBe(8);
  });

  it("marks a patch whose target left its source by more than 1e-5", () => {
    expect(isAltered({ source: [1, 2, 3], target: [1, 2, 3.000001] })).toBe(false);
    expect(isAltered({ source: [1, 2, 3], target: [1, 2, 3.0001] })).toBe(true);
  });

  it("resets a patch's target to its source", () => {
    const p = one([50, 30, 40], [55, 6, 8]);
    expect(resetPatch(p, 0).patches[0]).toEqual({ source: [50, 30, 40], target: [50, 30, 40] });
  });

  it("deletes a patch, moving the rest up", () => {
    const p = deletePatch(DEFAULT_PARAMS, 2);
    expect(p.patches).toHaveLength(23);
    expect(p.patches[2]).toBe(DEFAULT_PARAMS.patches[3]);
    expect(deletePatch(DEFAULT_PARAMS, 30)).toBe(DEFAULT_PARAMS);
  });
});

describe("the picker", () => {
  it("chooses the patch whose source is nearest, the first on a tie", () => {
    expect(nearestPatch(DEFAULT_PARAMS, [62, 36, 57])).toBe(6);
    const tie: Params = {
      patches: [
        { source: [10, 0, 0], target: [10, 0, 0] },
        { source: [30, 0, 0], target: [30, 0, 0] },
      ],
    };
    expect(nearestPatch(tie, [20, 0, 0])).toBe(0);
    expect(nearestPatch({ patches: [] }, [20, 0, 0])).toBeNull();
  });

  it("puts a picked colour on the clicked patch, as source and target", () => {
    const placed = placePicked(DEFAULT_PARAMS, 5, [44, 12, -8]);
    expect(placed?.index).toBe(5);
    expect(placed?.params.patches[5]).toEqual({ source: [44, 12, -8], target: [44, 12, -8] });
    expect(placed?.params.patches).toHaveLength(24);
  });

  it("adds it as a new patch from an empty cell", () => {
    const few: Params = { patches: DEFAULT_PARAMS.patches.slice(0, 10) };
    const placed = placePicked(few, 17, [44, 12, -8]);
    expect(placed?.index).toBe(10);
    expect(placed?.params.patches).toHaveLength(11);
  });

  it("refuses a colour with a channel near zero, or one already a patch", () => {
    expect(placePicked(DEFAULT_PARAMS, 5, [44, 0.0005, -8])).toBeNull();
    expect(placePicked(DEFAULT_PARAMS, 5, [37.99, 13.56, 14.06])).toBeNull();
  });
});
