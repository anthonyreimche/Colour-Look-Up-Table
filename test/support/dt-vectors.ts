// darktable's solved coefficients and output for the reference cases and its
// presets (test/reference/vectors.json, written by dt_ref.c), typed, with each
// case's params as the extension's. Read with JSON.parse rather than
// imported: the bundler's JSON import turns -0 into 0.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Params, Vec3 } from "../../src/model";

export interface DtCase {
  name: string;
  num_patches: number;
  source_L: number[];
  source_a: number[];
  source_b: number[];
  target_L: number[];
  target_a: number[];
  target_b: number[];
  coeff_L: number[];
  coeff_a: number[];
  coeff_b: number[];
  /** Lab out for every input, then for each of the case's own sources. */
  out: number[];
}

interface Vectors {
  inputs: number[];
  cases: DtCase[];
  presets: DtCase[];
}

// Every number is a C float printed to 9 significant digits, which reads
// back as that float through Math.fround.
const vectors = JSON.parse(readFileSync(resolve(process.cwd(), "test/reference/vectors.json"), "utf8"), (_key, value: unknown) =>
  typeof value === "number" ? Math.fround(value) : value,
) as Vectors;

export const dtCases = vectors.cases;
export const dtPresets = vectors.presets;

/** The grid every case is evaluated at. */
export const dtInputs: Vec3[] = Array.from({ length: vectors.inputs.length / 3 }, (_, i) => [
  vectors.inputs[3 * i],
  vectors.inputs[3 * i + 1],
  vectors.inputs[3 * i + 2],
]);

export function paramsOf(c: DtCase): Params {
  return {
    patches: Array.from({ length: c.num_patches }, (_, k) => ({
      source: [c.source_L[k], c.source_a[k], c.source_b[k]] as Vec3,
      target: [c.target_L[k], c.target_a[k], c.target_b[k]] as Vec3,
    })),
  };
}

/** The inputs a case was evaluated at: the grid, then its own sources. */
export function inputsOf(c: DtCase): Vec3[] {
  const n = Math.min(49, Math.max(0, c.num_patches));
  return [...dtInputs, ...Array.from({ length: n }, (_, k): Vec3 => [c.source_L[k], c.source_a[k], c.source_b[k]])];
}

export function outAt(c: DtCase, i: number): Vec3 {
  return [c.out[3 * i], c.out[3 * i + 1], c.out[3 * i + 2]];
}
