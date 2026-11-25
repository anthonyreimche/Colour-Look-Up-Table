// A stage runs on every photo, so at its defaults it must leave the image as
// it was. Unit tests can't run GLSL (the reference rig renders it against
// darktable, test:gpu on the core's WebGL harness); these hold the parts
// that make the idle stage a no-op, its place in the pipeline, the uniforms
// the bag binds and their budget, a shader shape Direct3D 11 links, and,
// through a line-for-line mirror of the inline block, that what the shader
// sums from the bag is darktable's result.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, FASTLOG2, LN2, R2_FLOOR, SRGB_TO_XYZ_D50, mapLab, solve, type Vec3 } from "../src/model";
import { AFFINE_ROWS, PARAM_KEYS, SPLINE_ROWS, STAGE_ID, TARGET_ROWS, bagPatch } from "../src/params";
import { glslLiteral, lutStage } from "../src/stage";
import { dtCases, dtPresets, inputsOf, outAt, paramsOf } from "./support/dt-vectors";
import { shaderLab } from "./support/shader-mirror";

const stage = lutStage();
const glsl = `${stage.helpers}
${stage.glsl}`;

/** The body of every for loop in `src`, from its opening brace to the match. */
function loopBodies(src: string): string[] {
  return [...src.matchAll(/\bfor\s*\(/g)].map((m) => {
    const open = src.indexOf("{", m.index);
    let depth = 0;
    let end = open;
    for (; end < src.length; end++) {
      if (src[end] === "{") depth++;
      else if (src[end] === "}" && --depth === 0) break;
    }
    return src.slice(open + 1, end);
  });
}

describe("lutStage", () => {
  it("sits in darktable's Lab section, ahead of the other Lab ports", () => {
    expect(stage.id).toBe(STAGE_ID);
    expect(stage.phase).toBe("display-adjust");
    expect(stage.priority).toBeLessThan(100);
  });

  it("asks for the display values unclipped, as darktable's Lab modules see them", () => {
    expect(stage.space).toEqual({ encoding: "perceptual" });
  });

  it("declares one uniform per param, defaulting to the defaults' bag values", () => {
    expect(stage.uniforms.map((u) => u.key)).toEqual([...PARAM_KEYS]);
    const patch = bagPatch(DEFAULT_PARAMS);
    for (const u of stage.uniforms) expect(u.default).toEqual(patch[`${STAGE_ID}.${u.key}`]);
  });

  it("types the uniforms as the shader reads them", () => {
    const types = Object.fromEntries(stage.uniforms.map((u) => [u.key, [u.glslType, u.length]]));
    expect(types).toEqual({
      active: ["int", undefined],
      count: ["int", undefined],
      spline: ["vec4", SPLINE_ROWS],
      affine: ["vec4", AFFINE_ROWS],
      target: ["vec4", TARGET_ROWS],
    });
  });

  // Every develop-program uniform shares one budget (MAX_FRAGMENT_UNIFORM_VECTORS,
  // 224 at WebGL 2's minimum), and each mask that uses the stage adds a copy.
  // The shader reads 80 rows; the targets, which only the panel reads, take
  // 37 more where a compiler keeps uniforms nothing reads.
  it("reads 80 uniform rows, 117 declared", () => {
    expect(SPLINE_ROWS).toBe(75);
    expect(TARGET_ROWS).toBe(37);
    const rows = stage.uniforms.reduce((sum, u) => sum + (u.length ?? 1), 0);
    expect(rows).toBe(117);
    expect(rows - TARGET_ROWS).toBe(80);
    expect(stage.glsl).not.toMatch(/\btarget\b/);
    expect(stage.helpers).not.toMatch(/\btarget\b/);
  });

  it("is dormant, left out of the program, while every target sits on its source", () => {
    expect(stage.dormantWhen).toEqual({ active: 0 });
    expect(bagPatch(DEFAULT_PARAMS)[`${STAGE_ID}.active`]).toBe(0);
  });

  it("only writes the pixel inside the branch the active flag guards", () => {
    const body = stage.glsl;
    const branch = body.indexOf("if (active != 0)");
    expect(branch).toBeGreaterThan(0);
    expect(body.match(/\bc\s*=/g)).toHaveLength(1);
    expect(body.indexOf("c =")).toBeGreaterThan(branch);
  });

  describe("a shader Direct3D 11 links, at a cost the GPU's watchdog never sees", () => {
    it("samples no texture", () => {
      expect(glsl).not.toMatch(/\btexture(?:Lod|Offset|Grad|Fetch)?\s*\(/);
    });

    it("declares no local arrays", () => {
      expect(glsl).not.toMatch(/\b(?:float|int|bool|[iu]?vec[234]|mat[234])\s*(?:\[[^\]]*\]\s*\w+|\w+\s*\[[^\]]*\])\s*[;=]/);
    });

    it("runs one loop, of at most 25 steps, nested in nothing", () => {
      const loops = loopBodies(glsl);
      expect(loops).toHaveLength(1);
      for (const body of loops) expect(body).not.toMatch(/\b(?:for|while)\s*\(/);
      expect(stage.glsl).toMatch(/clP < 25;/);
    });

    it("does the fast logarithm's bit casts in highp", () => {
      expect(stage.helpers).toMatch(/highp uint bits = floatBitsToUint\(x\)/);
      expect(stage.helpers).toMatch(/highp float mx = uintBitsToFloat/);
    });
  });

  it("formats every constant from the model's numbers", () => {
    expect(stage.helpers).toContain(glslLiteral(SRGB_TO_XYZ_D50[0]));
    for (const v of [FASTLOG2.scale, FASTLOG2.bias, FASTLOG2.a, FASTLOG2.b, FASTLOG2.c, LN2, R2_FLOOR]) expect(stage.helpers).toContain(glslLiteral(v));
  });

  it("writes float literals that read back as the model's floats", () => {
    for (const v of [FASTLOG2.bias, FASTLOG2.a, FASTLOG2.b, FASTLOG2.c, LN2, R2_FLOOR, FASTLOG2.scale]) {
      expect(Math.fround(Number(glslLiteral(v)))).toBe(v);
    }
    expect(glslLiteral(1)).toBe("1.000000000");
    expect(glslLiteral(-2)).toBe("-2.000000000");
    expect(glslLiteral(1e-8)).toMatch(/^1\.0+e-8$/);
  });

  it("is maskable and a global look in presets", () => {
    expect(stage.mask).toEqual({ maskable: true });
    expect(stage.presetScope).toBe("global");
  });
});

describe("the shader's sums, mirrored", () => {
  const all = [...dtCases, ...dtPresets];

  it("equal the model bit for bit in float, for every case and preset", () => {
    for (const c of all) {
      const p = paramsOf(c);
      const bag = bagPatch(p);
      const s = solve(p);
      const wrong = inputsOf(c).filter((lab) => {
        const a = shaderLab(bag, lab);
        const b = mapLab(s, lab);
        return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2];
      });
      expect(wrong, c.name).toEqual([]);
    }
  });

  it("equal darktable's output", () => {
    for (const c of all) {
      const bag = bagPatch(paramsOf(c));
      inputsOf(c).forEach((lab, i) => expect(shaderLab(bag, lab), c.name).toEqual(outAt(c, i)));
    }
  });

  // A GPU may fuse and reorder; summed exactly instead of in float, every
  // colour still lands within 0.01 Lab of darktable's in the gamut's interior.
  it("barely move when summed exactly instead of in float", () => {
    let worst = 0;
    for (const c of all) {
      const bag = bagPatch(paramsOf(c));
      inputsOf(c).forEach((lab: Vec3, i) => {
        if (lab[0] < 0 || lab[0] > 100 || Math.hypot(lab[1], lab[2]) > 100) return;
        const got = shaderLab(bag, lab, (v) => v);
        const want = outAt(c, i);
        for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(got[k] - want[k]));
      });
    }
    expect(worst).toBeLessThan(0.01);
  });
});
