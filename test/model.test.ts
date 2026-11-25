// The model against darktable's own code (test/reference/dt_ref.c compiled by
// gcc): the solved coefficients and the mapped colours agree bit for bit, in
// every special case of the solve and for every preset.

import { describe, expect, it } from "vitest";
import {
  COLORCHECKER_LAB,
  DEFAULT_PARAMS,
  MAX_PATCHES,
  fastlog2,
  isIdle,
  labFromLinearSrgb,
  linearSrgbFromLab,
  mapLab,
  processPixel,
  solve,
  type Params,
  type Vec3,
} from "../src/model";
import { dtCases, dtPresets, inputsOf, outAt, paramsOf } from "./support/dt-vectors";

describe("solve, against darktable's commit_params", () => {
  for (const c of [...dtCases, ...dtPresets]) {
    it(c.name, () => {
      const s = solve(paramsOf(c));
      const n = Math.min(MAX_PATCHES, c.num_patches);
      expect(s.count).toBe(n);
      expect(Array.from(s.coeff[0])).toEqual(c.coeff_L);
      expect(Array.from(s.coeff[1])).toEqual(c.coeff_a);
      expect(Array.from(s.coeff[2])).toEqual(c.coeff_b);
    });
  }
});

describe("mapLab, against darktable's process", () => {
  for (const c of [...dtCases, ...dtPresets]) {
    it(c.name, () => {
      const s = solve(paramsOf(c));
      const inputs = inputsOf(c);
      let mismatches = 0;
      inputs.forEach((lab, i) => {
        const got = mapLab(s, lab);
        const want = outAt(c, i);
        if (got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2]) mismatches++;
      });
      expect(mismatches).toBe(0);
    });
  }

  it("takes every moved patch to its target", () => {
    const c = dtCases.find((k) => k.name === "defaults, four patches moved");
    if (!c) throw new Error("missing case");
    const p = paramsOf(c);
    const s = solve(p);
    for (const patch of p.patches) {
      const got = mapLab(s, patch.source);
      for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(patch.target[k], 2);
    }
  });
});

describe("fastlog2", () => {
  it("approximates log2 to about 1e-4", () => {
    for (const x of [1e-8, 0.01, 0.5, 1, 2, 3, 10, 1234.5, 1e5]) expect(Math.abs(fastlog2(x) - Math.log2(x))).toBeLessThan(2e-4);
  });
});

describe("defaults", () => {
  it("are darktable's: the 24 ColorChecker patches, each its own target", () => {
    const c = dtCases.find((k) => k.name === "defaults");
    if (!c) throw new Error("missing case");
    const want = paramsOf(c);
    expect(DEFAULT_PARAMS.patches.map((p) => p.source.map(Math.fround))).toEqual(want.patches.map((p) => p.source));
    expect(DEFAULT_PARAMS.patches.map((p) => p.target.map(Math.fround))).toEqual(want.patches.map((p) => p.target));
    expect(COLORCHECKER_LAB).toHaveLength(24);
  });

  it("are idle, and moving one target makes them active", () => {
    expect(isIdle(DEFAULT_PARAMS)).toBe(true);
    const moved: Params = {
      patches: DEFAULT_PARAMS.patches.map((p, k) => (k === 3 ? { ...p, target: [p.target[0] + 1, p.target[1], p.target[2]] as Vec3 } : p)),
    };
    expect(isIdle(moved)).toBe(false);
    expect(isIdle({ patches: [] })).toBe(true);
  });
});

describe("Lab plumbing", () => {
  it("round-trips linear sRGB through D50 Lab", () => {
    for (const rgb of [
      [0.2, 0.4, 0.6],
      [1, 1, 1],
      [0.001, 0.5, 0.02],
      [1.4, -0.05, 0.3],
    ] as Vec3[]) {
      const back = linearSrgbFromLab(labFromLinearSrgb(rgb));
      for (let k = 0; k < 3; k++) expect(back[k]).toBeCloseTo(rgb[k], 10);
    }
  });

  // darktable's matrix rows sum to 0.96422 and 0.82521 against its D50 white
  // of 0.9642 and 0.8249, so white lands a few hundredths off neutral.
  it("puts white at L 100, within a few hundredths of neutral", () => {
    const [L, a, b] = labFromLinearSrgb([1, 1, 1]);
    expect(L).toBeCloseTo(100, 4);
    expect(Math.abs(a)).toBeLessThan(0.05);
    expect(Math.abs(b)).toBeLessThan(0.05);
  });

  it("leaves a pixel alone with idle params", () => {
    expect(processPixel(DEFAULT_PARAMS, [0.3, 0.6, 0.9])).toEqual([0.3, 0.6, 0.9]);
  });
});
