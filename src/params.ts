// The param-bag contract: darktable's colorchecker params under the stage's
// qualified keys, as the GPU uniforms take them, packed tight because every
// stage in the develop program shares one uniform budget (224 vec4 rows at
// WebGL 2's minimum) and each mask that uses the stage adds a copy.
//
// `spline` is six floats a patch, back to back: the patch's source colour
// (Lab), then its radial weights for L, a and b, solved from the params;
// 49 patches fill 74 rows, padded to 75 so the shader reads whole pairs.
// `affine` is the spline's affine part, a row per output channel: the
// constant, then the L, a and b terms. `target` is three floats a patch,
// the target colours, which only the panel reads. `count` is how many
// patches are in use, and `active` is 0 while every target sits on its
// source, which lets the renderer leave the stage out. Solving per pixel
// would mean a 53×53 system per draw, so the shader only sums.
//
// The weights are never read back; every writer goes through bagPatch, so
// presets, copy and paste and masks carry a solution that matches the
// patches beside it. A bag that doesn't hold a whole, finite set of patches
// reads as the defaults.

import { DEFAULT_PARAMS, MAX_PATCHES, isIdle, solve, type Params, type Patch, type Solution, type Vec3 } from "./model";

export const EXT_ID = "colour-look-up-table";
export const STAGE_ID = `${EXT_ID}.lab`;

export const PARAM_KEYS = ["active", "count", "spline", "affine", "target"] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export const qualified = (key: ParamKey): string => `${STAGE_ID}.${key}`;

type BagValue = number | number[];

/** Floats a patch takes in `spline`: source L, a, b, weight L, a, b. */
export const SPLINE_STRIDE = 6;
/** `spline`'s vec4 rows: two patches in three rows. */
export const SPLINE_ROWS = 3 * Math.ceil(MAX_PATCHES / 2);
/** `target`'s vec4 rows: three floats a patch. */
export const TARGET_ROWS = Math.ceil((3 * MAX_PATCHES) / 4);
/** `affine`'s rows: one per output channel. */
export const AFFINE_ROWS = 3;
/** The affine part's terms: constant, L, a, b. */
const AFFINE_TERMS = 4;

/** One channel of commit_params' identity: nothing radial, the channel
 *  itself in the affine part. */
function identityChannel(count: number, channel: number): Float32Array {
  const c = new Float32Array(count + AFFINE_TERMS);
  c[count + 1 + channel] = 1;
  return c;
}

/** The solution with any channel that isn't finite put back to the
 *  identity. darktable divides by a zero source with a single patch (a grey
 *  one has a = b = 0) and draws NaN; the port leaves that channel alone. */
export function safeSolution(s: Solution): Solution {
  const finite = s.coeff.map((c) => c.every(Number.isFinite));
  if (finite.every(Boolean)) return s;
  const [L, a, b] = s.coeff.map((c, ch) => (finite[ch] ? c : identityChannel(s.count, ch)));
  return { ...s, coeff: [L, a, b] };
}

const pad = (values: number[], rows: number): number[] => [...values, ...new Array<number>(4 * rows - values.length).fill(0)];

export function bagPatch(p: Params): Record<string, BagValue> {
  const patches = p.patches.slice(0, MAX_PATCHES);
  const s = safeSolution(solve({ patches }));
  const [cL, ca, cb] = s.coeff;
  const N = s.count;
  const spline = patches.flatMap((k, i) => [...k.source, cL[i], ca[i], cb[i]]);
  return {
    [qualified("active")]: isIdle({ patches }) ? 0 : 1,
    [qualified("count")]: N,
    [qualified("spline")]: pad(spline, SPLINE_ROWS),
    [qualified("affine")]: [cL, ca, cb].flatMap((c) => [c[N], c[N + 1], c[N + 2], c[N + 3]]),
    [qualified("target")]: pad(
      patches.flatMap((k) => [...k.target]),
      TARGET_ROWS,
    ),
  };
}

const isNumberArray = (v: unknown, length: number): v is number[] =>
  Array.isArray(v) && v.length === length && v.every((x) => typeof x === "number" && Number.isFinite(x));

/** `bag` is the host's untyped per-photo bag (any extension writes to it). */
export function readParams(bag: Readonly<Record<string, unknown>>): Params {
  const count = bag[qualified("count")];
  const spline = bag[qualified("spline")];
  const target = bag[qualified("target")];
  const whole =
    typeof count === "number" &&
    Number.isInteger(count) &&
    count >= 0 &&
    count <= MAX_PATCHES &&
    isNumberArray(spline, 4 * SPLINE_ROWS) &&
    isNumberArray(target, 4 * TARGET_ROWS);
  if (!whole) return DEFAULT_PARAMS;
  return {
    patches: Array.from({ length: count }, (_, k): Patch => {
      const s = SPLINE_STRIDE * k;
      const t = 3 * k;
      return { source: [spline[s], spline[s + 1], spline[s + 2]] as Vec3, target: [target[t], target[t + 1], target[t + 2]] as Vec3 };
    }),
  };
}

export const resetPatch = (): Record<string, BagValue> => bagPatch(DEFAULT_PARAMS);
