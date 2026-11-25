// The GPU side: darktable's color look up table as one inline fragment in the
// host's display-adjust phase, the point in Safelight's pipeline that
// matches darktable's Lab modules (display-referred). It runs ahead of the
// other Lab ports, as darktable's pipe orders colorchecker before
// colorcorrection and colorzones. There is no prepass and no texture: the
// work is per pixel.
//
// The display colour `c` arrives sRGB-encoded and, through the declared
// space, unclipped on process version 2. The branch decodes it with the
// host's curve extended both ways, takes it to D50 Lab through darktable's
// matrix, maps it through the thin-plate spline and encodes it back the
// same way. Version 1 photos hand `c` clipped, which the same path reads as
// it is.
//
// The spline is solved on the CPU (params.ts): the shader sums the affine
// part and each patch's weighted r² ln r², two patches a loop step from the
// packed `spline` rows, in darktable's order, with
// darktable's fast logarithm, whose bit casts need highp. While every target
// sits on its source `active` is 0: the renderer leaves the stage out, and
// where it is in the program (a mask's copy, a build without dormancy) the
// branch is not taken, so the stage is a bit-exact no-op. Every constant is
// formatted from the model's numbers, so the shader and the CPU reference
// cannot drift.

import type { GlslType, ProcessingStageContribution, UniformDeclaration } from "./safelight";
import {
  D50_WHITE,
  DEFAULT_PARAMS,
  FASTLOG2,
  LAB_CBRT_EPSILON,
  LAB_EPSILON,
  LAB_KAPPA,
  LN2,
  MAX_PATCHES,
  R2_FLOOR,
  SRGB_TO_XYZ_D50,
  XYZ_D50_TO_SRGB,
} from "./model";
import { AFFINE_ROWS, PARAM_KEYS, SPLINE_ROWS, STAGE_ID, TARGET_ROWS, bagPatch, qualified, type ParamKey } from "./params";

/** A GLSL float literal at full single precision, always with a decimal point
 *  (GLSL ES never promotes an integer literal to float). */
export function glslLiteral(v: number): string {
  const s = v.toPrecision(10);
  return s.includes("e") ? v.toExponential(9) : s.includes(".") ? s : `${s}.0`;
}

/** A row-major 3×3 as a GLSL mat3 constructor (column-major arguments). */
function glslMat3(rowMajor: readonly number[]): string {
  const cols = [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => glslLiteral(rowMajor[i]));
  return `mat3(${cols.join(", ")})`;
}

/** The shader reads the patches two at a time; an odd count leaves the last
 *  pair's second patch with zero weights, which adds nothing. */
const PAIRS = String(SPLINE_ROWS / 3);
const EPS = glslLiteral(LAB_EPSILON);
const CBRT_EPS = glslLiteral(LAB_CBRT_EPSILON);
const KAPPA = glslLiteral(LAB_KAPPA);
const WHITE = `vec3(${D50_WHITE.map(glslLiteral).join(", ")})`;
const LOG = {
  scale: glslLiteral(FASTLOG2.scale),
  bias: glslLiteral(FASTLOG2.bias),
  a: glslLiteral(FASTLOG2.a),
  b: glslLiteral(FASTLOG2.b),
  c: glslLiteral(FASTLOG2.c),
};

// Helpers take everything as arguments, so a mask's copy of the stage shares
// them. The host rewrites the uniform keys (active, count, spline, affine,
// target) at identifier boundaries here and in the inline block, so
// no local or parameter uses one of those names.
const HELPERS = `
vec3 clDecode(vec3 y) {
  vec3 m = abs(y);
  return sign(y) * mix(m / 12.92, pow((m + 0.055) / 1.055, vec3(2.4)), step(0.04045, m));
}
vec3 clEncode(vec3 x) {
  vec3 m = abs(x);
  return sign(x) * mix(m * 12.92, 1.055 * pow(m, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, m));
}
float clF(float t) {
  return t > ${EPS} ? pow(t, 1.0 / 3.0) : (${KAPPA} * t + 16.0) / 116.0;
}
float clFInv(float v) {
  return v > ${CBRT_EPS} ? v * v * v : (116.0 * v - 16.0) / ${KAPPA};
}
vec3 clLab(vec3 rgb) {
  const mat3 toXyz = ${glslMat3(SRGB_TO_XYZ_D50)};
  vec3 r = (toXyz * rgb) / ${WHITE};
  vec3 v = vec3(clF(r.x), clF(r.y), clF(r.z));
  return vec3(116.0 * v.y - 16.0, 500.0 * (v.x - v.y), 200.0 * (v.y - v.z));
}
vec3 clRgb(vec3 lab) {
  const mat3 toRgb = ${glslMat3(XYZ_D50_TO_SRGB)};
  float fy = (lab.x + 16.0) / 116.0;
  float fx = lab.y / 500.0 + fy;
  float fz = fy - lab.z / 200.0;
  return toRgb * (vec3(clFInv(fx), clFInv(fy), clFInv(fz)) * ${WHITE});
}

// darktable's fastlog2: the float's bits read as an integer give its
// exponent, and a rational fit of the mantissa does the rest.
highp float clFastLog2(highp float x) {
  highp uint bits = floatBitsToUint(x);
  highp float mx = uintBitsToFloat((bits & 0x007FFFFFu) | 0x3F000000u);
  highp float y = float(bits) * ${LOG.scale};
  return y - ${LOG.bias} - ${LOG.a} * mx - ${LOG.b} / (${LOG.c} + mx);
}

// One output channel's affine part: the constant, then the L, a and b terms,
// summed in darktable's order.
highp float clAffine(highp vec4 r, highp vec3 x) {
  return r.x + ((r.y * x.x + r.z * x.y) + r.w * x.z);
}

// The thin-plate radial function r² ln r², floored inside the logarithm.
highp float clKernel(highp vec3 x, highp vec3 y) {
  highp vec3 d = x - y;
  highp float r2 = d.x * d.x + d.y * d.y + d.z * d.z;
  return r2 * (${glslLiteral(LN2)} * clFastLog2(max(${glslLiteral(R2_FLOOR)}, r2)));
}
`;

const INLINE = `
{
  if (active != 0) {
    highp vec3 clIn = clLab(clDecode(c));
    highp vec3 clOut = vec3(clAffine(affine[0], clIn), clAffine(affine[1], clIn), clAffine(affine[2], clIn));
    for (int clP = 0; clP < ${PAIRS}; clP++) {
      if (2 * clP >= count) break;
      highp vec4 clA = spline[3 * clP];
      highp vec4 clB = spline[3 * clP + 1];
      highp vec4 clC = spline[3 * clP + 2];
      clOut += vec3(clA.w, clB.xy) * clKernel(clIn, clA.xyz);
      clOut += clC.yzw * clKernel(clIn, vec3(clB.zw, clC.x));
    }
    c = clEncode(clRgb(clOut));
  }
}
`;

type Scalar = { glslType: GlslType; range: { min: number; max: number; step?: number } };

const SCALARS: Partial<Record<ParamKey, Scalar>> = {
  active: { glslType: "int", range: { min: 0, max: 1, step: 1 } },
  count: { glslType: "int", range: { min: 0, max: MAX_PATCHES, step: 1 } },
};

const LABELS: Record<ParamKey, string> = {
  active: "active",
  count: "patches",
  spline: "patches and their weights",
  affine: "mapping base",
  target: "target colours",
};

const ROWS: Partial<Record<ParamKey, number>> = { spline: SPLINE_ROWS, affine: AFFINE_ROWS, target: TARGET_ROWS };

function uniforms(): UniformDeclaration[] {
  const defaults = bagPatch(DEFAULT_PARAMS);
  return PARAM_KEYS.map((key): UniformDeclaration => {
    const value = defaults[qualified(key)];
    const label = LABELS[key];
    const scalar = SCALARS[key];
    if (scalar) return { key, glslType: scalar.glslType, default: value, label, range: scalar.range };
    return { key, glslType: "vec4", length: ROWS[key], default: value, label };
  });
}

export function lutStage(): ProcessingStageContribution {
  return {
    id: STAGE_ID,
    name: "Colour Look Up Table",
    phase: "display-adjust",
    priority: 90,
    space: { encoding: "perceptual" },
    glsl: INLINE,
    helpers: HELPERS,
    uniforms: uniforms(),
    presetScope: "global",
    // A mask's copy runs at the defaults until one of its targets moves, so
    // the gate keeps an untouched mask bit-exact too.
    mask: { maskable: true },
    dormantWhen: { active: 0 },
  };
}
