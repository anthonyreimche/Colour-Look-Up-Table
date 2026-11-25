// The param-bag contract: what bagPatch writes is what readParams reads back,
// the solved coefficients ride along for the shader, a channel darktable
// would fill with NaN stays the identity, and a bag nobody wrote reads as
// the defaults.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, solve, type Params, type Vec3 } from "../src/model";
import {
  EXT_ID,
  PARAM_KEYS,
  SPLINE_ROWS,
  SPLINE_STRIDE,
  STAGE_ID,
  TARGET_ROWS,
  bagPatch,
  qualified,
  readParams,
  resetPatch,
  safeSolution,
} from "../src/params";
import { PRESETS } from "../src/presets";

const at = (bag: Record<string, unknown>, key: (typeof PARAM_KEYS)[number]) => bag[qualified(key)];
const flat = (bag: Record<string, unknown>, key: (typeof PARAM_KEYS)[number]) => at(bag, key) as number[];

function moved(): Params {
  return {
    patches: DEFAULT_PARAMS.patches.map((p, k) =>
      k % 5 === 0 ? { ...p, target: [p.target[0] + 3, p.target[1] - 4, p.target[2] + 2] as Vec3 } : p,
    ),
  };
}

describe("keys", () => {
  it("live under the stage's id", () => {
    expect(STAGE_ID).toBe(`${EXT_ID}.lab`);
    expect(qualified("count")).toBe(`${STAGE_ID}.count`);
    expect(Object.keys(bagPatch(DEFAULT_PARAMS)).sort()).toEqual(PARAM_KEYS.map(qualified).sort());
  });
});

describe("bagPatch", () => {
  it("writes the defaults as idle: the renderer leaves the stage out", () => {
    const bag = bagPatch(DEFAULT_PARAMS);
    expect(at(bag, "active")).toBe(0);
    expect(at(bag, "count")).toBe(24);
  });

  it("is active once a target leaves its source", () => {
    expect(at(bagPatch(moved()), "active")).toBe(1);
  });

  it("packs each patch's source and weights in six floats, its target in three", () => {
    const p = moved();
    const s = solve(p);
    const bag = bagPatch(p);
    const spline = flat(bag, "spline");
    const target = flat(bag, "target");
    expect(spline).toHaveLength(4 * SPLINE_ROWS);
    expect(target).toHaveLength(4 * TARGET_ROWS);
    p.patches.forEach((patch, k) => {
      expect(spline.slice(SPLINE_STRIDE * k, SPLINE_STRIDE * k + 6)).toEqual([...patch.source, s.coeff[0][k], s.coeff[1][k], s.coeff[2][k]]);
      expect(target.slice(3 * k, 3 * k + 3)).toEqual([...patch.target]);
    });
    expect(spline.slice(SPLINE_STRIDE * 24).every((v) => v === 0)).toBe(true);
    expect(target.slice(3 * 24).every((v) => v === 0)).toBe(true);
  });

  it("writes the affine part a row per channel: constant, then L, a and b", () => {
    const p = moved();
    const s = solve(p);
    const N = s.count;
    expect(flat(bagPatch(p), "affine")).toEqual(s.coeff.flatMap((c) => [c[N], c[N + 1], c[N + 2], c[N + 3]]));
  });

  it("writes the identity's affine part for no patches", () => {
    expect(flat(bagPatch({ patches: [] }), "affine")).toEqual([0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
});

describe("safeSolution", () => {
  // One patch scales each channel by target / source; darktable divides by
  // a zero source and draws NaN. The port keeps that channel unchanged.
  it("keeps a channel darktable would divide by zero at the identity", () => {
    const p: Params = { patches: [{ source: [50, 0, 10], target: [60, 5, 20] }] };
    const s = safeSolution(solve(p));
    expect(Array.from(s.coeff[0])).toEqual([0, 0, 1.2000000476837158, 0, 0]);
    expect(Array.from(s.coeff[1])).toEqual([0, 0, 0, 1, 0]);
    expect(Array.from(s.coeff[2])).toEqual([0, 0, 0, 0, 2]);
    const bag = bagPatch(p);
    for (const key of ["spline", "affine"] as const) expect(flat(bag, key).every(Number.isFinite)).toBe(true);
  });

  it("returns a finite solution as it is", () => {
    const s = solve(moved());
    expect(safeSolution(s)).toBe(s);
  });
});

describe("readParams", () => {
  it("reads back what bagPatch wrote, for every preset", () => {
    for (const p of [DEFAULT_PARAMS, moved(), { patches: [] }, ...PRESETS.map((pr) => pr.params)]) {
      expect(readParams(bagPatch(p))).toEqual({ patches: p.patches.map((k) => ({ source: [...k.source], target: [...k.target] })) });
    }
  });

  it("reads an empty bag as the defaults", () => {
    expect(readParams({})).toEqual(DEFAULT_PARAMS);
  });

  it("reads a damaged bag as the defaults", () => {
    const bag = bagPatch(moved());
    expect(readParams({ ...bag, [qualified("count")]: 50 })).toEqual(DEFAULT_PARAMS);
    expect(readParams({ ...bag, [qualified("count")]: 2.5 })).toEqual(DEFAULT_PARAMS);
    expect(readParams({ ...bag, [qualified("spline")]: [1, 2, 3] })).toEqual(DEFAULT_PARAMS);
    const nan = [...flat(bag, "target")];
    nan[5] = Number.NaN;
    expect(readParams({ ...bag, [qualified("target")]: nan })).toEqual(DEFAULT_PARAMS);
  });

  it("resetPatch writes the defaults", () => {
    expect(resetPatch()).toEqual(bagPatch(DEFAULT_PARAMS));
  });
});
