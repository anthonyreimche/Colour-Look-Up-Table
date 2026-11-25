// darktable's color look up table, reimplemented. darktable's `colorchecker`
// IOP (GPL-3.0) maps colours in Lab: each of up to 49 patches takes a source
// colour to a target colour, and every other colour follows a thin-plate
// spline through those pairs, an affine map plus a radial term per patch,
// φ(r) = r² ln r², with r the Lab distance to the patch's source.
//
// The spline is solved from the params once (commit_params): a linear system
// in double precision whose coefficients are kept as floats. With four
// patches or fewer the system is singular, and darktable fits smaller
// affine maps instead, case by case. Per pixel (process) the affine part and
// the patches' radial terms are summed in float, with darktable's fast
// logarithm. The port follows both in the same order and precision, so it
// agrees with darktable bit for bit (test/reference/dt_ref.c).
//
// References: darktable 5.6.1 src/iop/colorchecker.c (params version 2),
// src/iop/gaussian_elimination.h, src/common/math.h (fastlog2, fastlog) and
// src/common/colorspaces_inline_conversions.h (Lab, D50).

export type Vec3 = readonly [number, number, number];

/** darktable's MAX_PATCHES: a 7×7 grid. */
export const MAX_PATCHES = 49;

export interface Patch {
  /** The colour the patch picks out, Lab. */
  source: Vec3;
  /** Where that colour goes, Lab. */
  target: Vec3;
}

export interface Params {
  /** 0 to MAX_PATCHES of them, in grid order. */
  patches: readonly Patch[];
}

/** colorchecker_Lab: the 24 ColorChecker patches, from Argyll's
 *  ColorChecker.cie. */
export const COLORCHECKER_LAB: readonly Vec3[] = [
  [37.99, 13.56, 14.06], // dark skin
  [65.71, 18.13, 17.81], // light skin
  [49.93, -4.88, -21.93], // blue sky
  [43.14, -13.1, 21.91], // foliage
  [55.11, 8.84, -25.4], // blue flower
  [70.72, -33.4, -0.2], // bluish green
  [62.66, 36.07, 57.1], // orange
  [40.02, 10.41, -45.96], // purple red
  [51.12, 48.24, 16.25], // moderate red
  [30.33, 22.98, -21.59], // purple
  [72.53, -23.71, 57.26], // yellow green
  [71.94, 19.36, 67.86], // orange yellow
  [28.78, 14.18, -50.3], // blue
  [55.26, -38.34, 31.37], // green
  [42.1, 53.38, 28.19], // red
  [81.73, 4.04, 79.82], // yellow
  [51.94, 49.99, -14.57], // magenta
  [51.04, -28.63, -28.64], // cyan
  [96.54, -0.43, 1.19], // white
  [81.26, -0.64, -0.34], // neutral 8
  [66.77, -0.73, -0.5], // neutral 65
  [50.87, -0.15, -0.27], // neutral 5
  [35.66, -0.42, -1.23], // neutral 35
  [20.46, -0.08, -0.97], // black
];

function deepFreeze(p: Params): Readonly<Params> {
  for (const patch of p.patches) Object.freeze(patch);
  Object.freeze(p.patches);
  return Object.freeze(p);
}

/** init(): the 24 ColorChecker patches, each its own target. darktable
 *  leaves the module off by default; at these params it changes nothing. */
export const DEFAULT_PARAMS: Readonly<Params> = deepFreeze({
  patches: COLORCHECKER_LAB.map((lab) => ({ source: lab, target: lab })),
});

/** Every target on its source: the mapping is the identity. */
export const isIdle = (p: Params): boolean =>
  p.patches.every((k) => k.source[0] === k.target[0] && k.source[1] === k.target[1] && k.source[2] === k.target[2]);

// ── float arithmetic, as the C rounds it ────────────────────────────────────

const f = Math.fround;
const bits = new DataView(new ArrayBuffer(4));

/** fastlog2's constants, as the floats darktable writes them. */
export const FASTLOG2 = Object.freeze({
  scale: 1.1920928955078125e-7,
  bias: f(124.22551499),
  a: f(1.498030302),
  b: f(1.72587999),
  c: f(0.3520887068),
});
/** M_LN2f, fastlog's factor. */
export const LN2 = f(0.69314718055994530942);
/** kernel()'s floor on r² inside the logarithm. */
export const R2_FLOOR = f(1e-8);
const { bias: LOG_BIAS, a: LOG_A, b: LOG_B, c: LOG_C } = FASTLOG2;

/** math.h fastlog2: the float's exponent and a rational fit of its
 *  mantissa, good to about 1e-4. */
export function fastlog2(x: number): number {
  bits.setFloat32(0, x, true);
  const i = bits.getUint32(0, true);
  bits.setUint32(0, ((i & 0x007fffff) | 0x3f000000) >>> 0, true);
  const mx = bits.getFloat32(0, true);
  const y = f(f(i) * FASTLOG2.scale);
  return f(f(f(y - LOG_BIAS) - f(LOG_A * mx)) - f(LOG_B / f(LOG_C + mx)));
}

/** kernel(): the thin-plate radial function r² ln r², from the squared Lab
 *  distance, floored at 1e-8 inside the logarithm. */
export function kernel(x: Vec3, y: Vec3): number {
  const d0 = f(x[0] - y[0]);
  const d1 = f(x[1] - y[1]);
  const d2 = f(x[2] - y[2]);
  const r2 = f(f(f(d0 * d0) + f(d1 * d1)) + f(d2 * d2));
  return f(r2 * f(LN2 * fastlog2(r2 > R2_FLOOR ? r2 : R2_FLOOR)));
}

// ── gaussian_elimination.h ──────────────────────────────────────────────────

/** gauss_make_triangular: elimination with partial pivoting, in place, row
 *  major; `p` records the row swaps. False when A is singular. */
function gaussMakeTriangular(A: Float64Array, p: Int32Array, n: number): boolean {
  p[n - 1] = n - 1;
  for (let k = 0; k < n; ++k) {
    let m = k;
    for (let i = k + 1; i < n; ++i) if (Math.abs(A[k + n * i]) > Math.abs(A[k + n * m])) m = i;
    p[k] = m;
    const t1 = A[k + n * m];
    A[k + n * m] = A[k + n * k];
    A[k + n * k] = t1;
    if (t1 === 0) return false;
    for (let i = k + 1; i < n; ++i) A[k + n * i] /= -t1;
    if (k !== m) {
      for (let i = k + 1; i < n; ++i) {
        const t2 = A[i + n * m];
        A[i + n * m] = A[i + n * k];
        A[i + n * k] = t2;
      }
    }
    for (let j = k + 1; j < n; ++j) for (let i = k + 1; i < n; ++i) A[i + n * j] += A[k + j * n] * A[i + k * n];
  }
  return true;
}

/** gauss_solve_triangular: the back substitution, into `b`. */
function gaussSolveTriangular(A: Float64Array, p: Int32Array, b: Float64Array, n: number): void {
  for (let k = 0; k < n - 1; ++k) {
    const m = p[k];
    const t = b[m];
    b[m] = b[k];
    b[k] = t;
    for (let i = k + 1; i < n; ++i) b[i] += A[k + n * i] * t;
  }
  for (let k = n - 1; k > 0; --k) {
    b[k] /= A[k + n * k];
    const t = b[k];
    for (let i = 0; i < k; ++i) b[i] -= A[k + n * i] * t;
  }
  b[0] /= A[0];
}

function gaussSolve(A: Float64Array, b: Float64Array, n: number): boolean {
  const p = new Int32Array(n);
  if (!gaussMakeTriangular(A, p, n)) return false;
  gaussSolveTriangular(A, p, b, n);
  return true;
}

// ── commit_params ───────────────────────────────────────────────────────────

/** The spline as process() reads it: the sources, and per channel (L, a, b)
 *  count + 4 float coefficients, the patches' radial weights, then the
 *  constant and the L, a and b terms of the affine part. */
export interface Solution {
  count: number;
  sources: readonly Vec3[];
  coeff: readonly [Float32Array, Float32Array, Float32Array];
}

/** commit_params, case for case. The params are darktable's floats. */
export function solve(p: Params): Solution {
  const N = Math.min(MAX_PATCHES, p.patches.length);
  const N4 = N + 4;
  const src = p.patches.slice(0, N).map((k): Vec3 => [f(k.source[0]), f(k.source[1]), f(k.source[2])]);
  const tgt = p.patches.slice(0, N).map((k): Vec3 => [f(k.target[0]), f(k.target[1]), f(k.target[2])]);
  const sL = src.map((v) => v[0]);
  const sa = src.map((v) => v[1]);
  const sb = src.map((v) => v[2]);
  const tL = tgt.map((v) => v[0]);
  const ta = tgt.map((v) => v[1]);
  const tb = tgt.map((v) => v[2]);
  const cL = new Float32Array(N4);
  const ca = new Float32Array(N4);
  const cb = new Float32Array(N4);
  // The identity, which stands for N ≤ 4 and a singular system.
  cL[N + 1] = 1;
  ca[N + 2] = 1;
  cb[N + 3] = 1;

  const solveInto = (rows: number[][], rhs: number[], store: (b: Float64Array) => void): boolean => {
    const A = Float64Array.from(rows.flat());
    const b = Float64Array.from(rhs);
    if (!gaussSolve(A, b, rhs.length)) return false;
    store(b);
    return true;
  };

  switch (N) {
    case 0:
      break;
    case 1:
      // a constant factor per channel
      cL[N + 1] = f(tL[0] / sL[0]);
      ca[N + 2] = f(ta[0] / sa[0]);
      cb[N + 3] = f(tb[0] / sb[0]);
      break;
    case 2: {
      // a constant and the channel itself; a singular channel leaves the
      // channels after it at the identity, as darktable's `break` does
      const done =
        solveInto([[1, sL[0]], [1, sL[1]]], [tL[0], tL[1]], (b) => {
          cL[N] = b[0];
          cL[N + 1] = b[1];
        }) &&
        solveInto([[1, sa[0]], [1, sa[1]]], [ta[0], ta[1]], (b) => {
          ca[N] = b[0];
          ca[N + 2] = b[1];
        }) &&
        solveInto([[1, sb[0]], [1, sb[1]]], [tb[0], tb[1]], (b) => {
          cb[N] = b[0];
          cb[N + 3] = b[1];
        });
      void done;
      break;
    }
    case 3: {
      // a constant, the channel itself and the other two at one weight
      const done =
        solveInto(
          [0, 1, 2].map((k) => [1, sL[k], f(sa[k] + sb[k])]),
          [tL[0], tL[1], tL[2]],
          (b) => {
            cL[N] = b[0];
            cL[N + 1] = b[1];
            cL[N + 2] = b[2];
            cL[N + 3] = b[2];
          },
        ) &&
        solveInto(
          [0, 1, 2].map((k) => [1, sa[k], f(sL[k] + sb[k])]),
          [ta[0], ta[1], ta[2]],
          (b) => {
            ca[N] = b[0];
            ca[N + 1] = b[2];
            ca[N + 2] = b[1];
            ca[N + 3] = b[2];
          },
        ) &&
        solveInto(
          [0, 1, 2].map((k) => [1, sb[k], f(sL[k] + sa[k])]),
          [tb[0], tb[1], tb[2]],
          (b) => {
            cb[N] = b[0];
            cb[N + 1] = b[2];
            cb[N + 2] = b[2];
            cb[N + 3] = b[1];
          },
        );
      void done;
      break;
    }
    case 4: {
      // a constant and all three channels
      const A = Float64Array.from([0, 1, 2, 3].flatMap((k) => [1, sL[k], sa[k], sb[k]]));
      const piv = new Int32Array(4);
      if (!gaussMakeTriangular(A, piv, 4)) break;
      for (const [t, c] of [
        [tL, cL],
        [ta, ca],
        [tb, cb],
      ] as const) {
        const b = Float64Array.from(t);
        gaussSolveTriangular(A, piv, b, 4);
        for (let i = 0; i < 4; i++) c[N + i] = b[i];
      }
      break;
    }
    default: {
      const A = new Float64Array(N4 * N4);
      for (let j = 0; j < N; ++j) for (let i = j; i < N; ++i) A[j * N4 + i] = A[i * N4 + j] = kernel(src[i], src[j]);
      for (let i = 0; i < N; ++i) {
        A[i * N4 + N] = A[N * N4 + i] = 1;
        A[i * N4 + N + 1] = A[(N + 1) * N4 + i] = sL[i];
        A[i * N4 + N + 2] = A[(N + 2) * N4 + i] = sa[i];
        A[i * N4 + N + 3] = A[(N + 3) * N4 + i] = sb[i];
      }
      const piv = new Int32Array(N4);
      if (!gaussMakeTriangular(A, piv, N4)) break;
      for (const [t, c] of [
        [tL, cL],
        [ta, ca],
        [tb, cb],
      ] as const) {
        const b = new Float64Array(N4);
        for (let i = 0; i < N; ++i) b[i] = t[i];
        gaussSolveTriangular(A, piv, b, N4);
        for (let i = 0; i < N4; ++i) c[i] = b[i];
      }
    }
  }
  return { count: N, sources: src, coeff: [cL, ca, cb] };
}

// ── process ─────────────────────────────────────────────────────────────────

/** process() on one Lab pixel: the affine part, then each patch's radial
 *  term, summed in float in darktable's order. */
export function mapLab(s: Solution, lab: Vec3): Vec3 {
  const N = s.count;
  const [cL, ca, cb] = s.coeff;
  const x: Vec3 = [f(lab[0]), f(lab[1]), f(lab[2])];
  const poly = (c: Float32Array) => f(f(f(c[N + 1] * x[0]) + f(c[N + 2] * x[1])) + f(c[N + 3] * x[2]));
  let L = f(cL[N] + poly(cL));
  let a = f(ca[N] + poly(ca));
  let b = f(cb[N] + poly(cb));
  for (let p = 0; p < N; p++) {
    const phi = kernel(x, s.sources[p]);
    L = f(L + f(cL[p] * phi));
    a = f(a + f(ca[p] * phi));
    b = f(b + f(cb[p] * phi));
  }
  return [L, a, b];
}

// ── transfer functions (the host shader's srgbToLinear / linearToSrgb) ───────

export function srgbToLinear(v: number): number {
  return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** srgbToLinear on |v| with the sign put back and no ceiling: the host's
 *  curve on [0, 1], and display values past white or below black keep their
 *  meaning. */
export function decodePerceptual(v: number): number {
  return Math.sign(v) * srgbToLinear(Math.abs(v));
}

/** linearToSrgb's curve on |v| with the sign put back and no ceiling. */
export function encodePerceptual(v: number): number {
  const a = Math.abs(v);
  return Math.sign(v) * (a < 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055);
}

// ── Lab, D50 (colorspaces_inline_conversions.h) ──────────────────────────────

/** darktable's `d50`. */
export const D50_WHITE: Vec3 = [0.9642, 1.0, 0.8249];

/** `sRGB_to_xyz_transposed` read row-major: linear Rec.709 → XYZ D50. */
export const SRGB_TO_XYZ_D50: readonly number[] = [
  0.4360747, 0.3850649, 0.1430804,
  0.2225045, 0.7168786, 0.0606169,
  0.0139322, 0.0971045, 0.7141733,
];

function invert3(m: readonly number[]): number[] {
  const [a, b, c, d, e, g, h, i, j] = m;
  const A = e * j - g * i;
  const B = -(d * j - g * h);
  const C = d * i - e * h;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * j - c * i) / det, (b * g - c * e) / det,
    B / det, (a * j - c * h) / det, -(a * g - c * d) / det,
    C / det, -(a * i - b * h) / det, (a * e - b * d) / det,
  ];
}

/** XYZ D50 → linear Rec.709: the exact inverse of SRGB_TO_XYZ_D50, so the
 *  round trip is exact rather than a second rounded table. */
export const XYZ_D50_TO_SRGB: readonly number[] = invert3(SRGB_TO_XYZ_D50);

export const LAB_EPSILON = 216 / 24389;
export const LAB_KAPPA = 24389 / 27;
/** lab_f_inv's threshold: cbrt(epsilon), darktable's 0.20689655172413796f. */
export const LAB_CBRT_EPSILON = Math.cbrt(LAB_EPSILON);

function mul3(m: readonly number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

const labF = (t: number): number => (t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116);
const labFInv = (v: number): number => (v > LAB_CBRT_EPSILON ? v * v * v : (116 * v - 16) / LAB_KAPPA);

export function labFromLinearSrgb(rgb: Vec3): Vec3 {
  const xyz = mul3(SRGB_TO_XYZ_D50, rgb);
  const fx = labF(xyz[0] / D50_WHITE[0]);
  const fy = labF(xyz[1] / D50_WHITE[1]);
  const fz = labF(xyz[2] / D50_WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function linearSrgbFromLab([L, a, b]: Vec3): Vec3 {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  return mul3(XYZ_D50_TO_SRGB, [labFInv(fx) * D50_WHITE[0], labFInv(fy) * D50_WHITE[1], labFInv(fz) * D50_WHITE[2]]);
}

/** A display-encoded colour in D50 Lab, as the stage reads it. */
export function labFromDisplay(c: Vec3): Vec3 {
  return labFromLinearSrgb([decodePerceptual(c[0]), decodePerceptual(c[1]), decodePerceptual(c[2])]);
}

/** Lab → display-encoded sRGB, signed and unclipped. */
export function displayFromLab(lab: Vec3): Vec3 {
  const rgb = linearSrgbFromLab(lab);
  return [encodePerceptual(rgb[0]), encodePerceptual(rgb[1]), encodePerceptual(rgb[2])];
}

/** The whole per-pixel path on a display-encoded pixel: decode, Lab, the
 *  spline, back, encode. Idle params return the pixel as it came. */
export function processPixel(p: Params, c: Vec3): Vec3 {
  if (isIdle(p)) return c;
  return displayFromLab(mapLab(solve(p), labFromDisplay(c)));
}
