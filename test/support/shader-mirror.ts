// The stage's inline GLSL (src/stage.ts) transcribed line for line into
// TypeScript, reading only what the shader reads: the bag's uniforms, as the
// GPU holds them (float32). Unit tests can't run GLSL; this checks that what
// bagPatch writes, summed the way the shader sums it, gives darktable's
// result. `round` is the arithmetic: Math.fround for a GPU's float, or the
// identity for exact sums. Keep it in step with the shader.

import { FASTLOG2, LN2, R2_FLOOR, fastlog2, type Vec3 } from "../../src/model";
import { qualified, type ParamKey } from "../../src/params";

type Round = (v: number) => number;

const log2Exact = (x: number) => Math.log2(x);

/** The inline block's Lab → Lab, from the bag. With `exactLog` the fast
 *  logarithm is replaced by Math.log2, to measure how much it matters. */
export function shaderLab(bag: Readonly<Record<string, unknown>>, lab: Vec3, round: Round = Math.fround, exactLog = false): Vec3 {
  const get = (key: ParamKey) => (bag[qualified(key)] as number[]).map(round);
  const count = bag[qualified("count")] as number;
  const spline = get("spline");
  const affine = get("affine");
  const log2 = exactLog ? log2Exact : fastlog2;
  const x: Vec3 = [round(lab[0]), round(lab[1]), round(lab[2])];

  // clAffine
  const affineRow = (r: number): number =>
    round(affine[4 * r] + round(round(round(affine[4 * r + 1] * x[0]) + round(affine[4 * r + 2] * x[1])) + round(affine[4 * r + 3] * x[2])));
  // clKernel
  const kernel = (y: Vec3): number => {
    const d = [round(x[0] - y[0]), round(x[1] - y[1]), round(x[2] - y[2])];
    const r2 = round(round(round(d[0] * d[0]) + round(d[1] * d[1])) + round(d[2] * d[2]));
    return round(r2 * round(LN2 * log2(r2 > R2_FLOOR ? r2 : R2_FLOOR)));
  };

  const out = [affineRow(0), affineRow(1), affineRow(2)];
  const add = (w: Vec3, phi: number) => {
    for (let c = 0; c < 3; c++) out[c] = round(out[c] + round(w[c] * phi));
  };
  for (let p = 0; 2 * p < count; p++) {
    const A = spline.slice(12 * p, 12 * p + 4);
    const B = spline.slice(12 * p + 4, 12 * p + 8);
    const C = spline.slice(12 * p + 8, 12 * p + 12);
    add([A[3], B[0], B[1]], kernel([A[0], A[1], A[2]]));
    add([C[1], C[2], C[3]], kernel([B[2], B[3], C[0]]));
  }
  return [out[0], out[1], out[2]];
}

/** The literal the shader's fastlog2 multiplies the bits by. */
export const FASTLOG2_SCALE = FASTLOG2.scale;
