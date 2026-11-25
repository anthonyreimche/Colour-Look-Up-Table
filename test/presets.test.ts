// The presets against darktable's: init_presets() run by dt_ref.c, in the same
// order, with the same floats, and the same mapped colours.

import { describe, expect, it } from "vitest";
import { mapLab, solve } from "../src/model";
import { PRESETS, decodeParams } from "../src/presets";
import { dtPresets, inputsOf, outAt, paramsOf } from "./support/dt-vectors";

const asFloats = (p: ReturnType<typeof paramsOf>) =>
  p.patches.map((k) => [...k.source.map(Math.fround), ...k.target.map(Math.fround)]);

describe("presets", () => {
  it("are darktable's eight, in its order", () => {
    expect(PRESETS).toHaveLength(dtPresets.length);
    expect(PRESETS.map((p) => p.params.patches.length)).toEqual(dtPresets.map((d) => d.num_patches));
  });

  PRESETS.forEach((preset, i) => {
    it(`${preset.label}: darktable's patches and colours`, () => {
      const dt = dtPresets[i];
      expect(asFloats(preset.params)).toEqual(asFloats(paramsOf(dt)));
      const s = solve(preset.params);
      const wrong = inputsOf(dt).filter((lab, k) => mapLab(s, lab).some((v, c) => v !== outAt(dt, k)[c]));
      expect(wrong).toEqual([]);
    });
  });

  it("have unique ids, and labels without another program's name", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(p.label).not.toMatch(/darktable/i);
  });

  it("refuses hex of the wrong length", () => {
    expect(() => decodeParams("00")).toThrow(/hex digits/);
  });
});
