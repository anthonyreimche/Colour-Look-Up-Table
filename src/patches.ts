// The panel's edits, as darktable's colorchecker GUI makes them. Every slider
// writes the selected patch's target; in relative mode its value is an
// offset from the patch's source, in absolute mode the Lab value itself. a
// and b are held to ±128 with glib's CLAMP; saturation scales a and b
// together to a new chroma, held to 0.01..128. The grid is 6×4 up to 24
// patches and 7×7 past that; double-click resets a patch, right-click
// deletes it, and Shift+click with the picker on puts the picked colour
// there (a new patch from an empty cell). The picker itself selects the
// patch nearest the picked colour (color_picker_apply).

import { MAX_PATCHES, type Params, type Patch, type Vec3 } from "./model";

/** The sliders' ranges, as darktable builds them. */
export const RANGES = Object.freeze({
  L: { min: -100, max: 200 },
  ab: { min: -256, max: 256 },
  C: { min: -128, max: 128 },
});

const AB_LIMIT = 128;
const C_FLOOR = 0.01;
const COUT_FLOOR = 1e-4;

/** glib's CLAMP, which darktable's callbacks use. */
const clamp = (x: number, lo: number, hi: number): number => (x > hi ? hi : x < lo ? lo : x);

const chroma = (lab: Vec3): number => Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);

export interface SliderValues {
  L: number;
  a: number;
  b: number;
  C: number;
}

/** _colorchecker_update_sliders. */
export function sliderValues(p: Params, k: number, absolute: boolean): SliderValues {
  const { source: s, target: t } = p.patches[k];
  if (absolute) return { L: t[0], a: t[1], b: t[2], C: chroma(t) };
  return { L: t[0] - s[0], a: t[1] - s[1], b: t[2] - s[2], C: chroma(t) - chroma(s) };
}

function withTarget(p: Params, k: number, target: (patch: Patch) => Vec3): Params {
  if (k < 0 || k >= p.patches.length) return p;
  return { patches: p.patches.map((patch, i) => (i === k ? { source: patch.source, target: target(patch) } : patch)) };
}

/** target_L_callback. */
export const setLightness = (p: Params, k: number, v: number, absolute: boolean): Params =>
  withTarget(p, k, ({ source: s, target: t }) => [absolute ? v : s[0] + v, t[1], t[2]]);

/** target_a_callback. */
export const setGreenMagenta = (p: Params, k: number, v: number, absolute: boolean): Params =>
  withTarget(p, k, ({ source: s, target: t }) => [t[0], clamp(absolute ? v : s[1] + v, -AB_LIMIT, AB_LIMIT), t[2]]);

/** target_b_callback. */
export const setBlueYellow = (p: Params, k: number, v: number, absolute: boolean): Params =>
  withTarget(p, k, ({ source: s, target: t }) => [t[0], t[1], clamp(absolute ? v : s[2] + v, -AB_LIMIT, AB_LIMIT)]);

/** target_C_callback. `p` is the params the drag started from: the new
 *  chroma scales the target as it was then, so a drag that hits the limits
 *  on its way doesn't bend the hue for good. */
export const setSaturation = (p: Params, k: number, v: number, absolute: boolean): Params =>
  withTarget(p, k, ({ source: s, target: t }) => {
    const cout = Math.max(COUT_FLOOR, chroma(t));
    const cnew = clamp(absolute ? v : chroma(s) + v, C_FLOOR, AB_LIMIT);
    return [t[0], clamp((t[1] * cnew) / cout, -AB_LIMIT, AB_LIMIT), clamp((t[2] * cnew) / cout, -AB_LIMIT, AB_LIMIT)];
  });

/** Double-click: the patch's target back on its source. */
export const resetPatch = (p: Params, k: number): Params => withTarget(p, k, ({ source }) => source);

/** Right-click: the patch removed, the ones after it moved up. */
export function deletePatch(p: Params, k: number): Params {
  if (k < 0 || k >= p.patches.length) return p;
  return { patches: p.patches.filter((_, i) => i !== k) };
}

/** A patch is drawn with an outline once its target leaves its source. */
export const isAltered = ({ source: s, target: t }: Patch): boolean =>
  Math.abs(t[0] - s[0]) > 1e-5 || Math.abs(t[1] - s[1]) > 1e-5 || Math.abs(t[2] - s[2]) > 1e-5;

export function gridSize(count: number): { cols: number; rows: number } {
  return count > 24 ? { cols: 7, rows: 7 } : { cols: 6, rows: 4 };
}

/** The cell under (x, y) in a grid `width`×`height` drawn for `count`
 *  patches; a point on the far edges counts as the last column or row. */
export function cellAt(count: number, x: number, y: number, width: number, height: number): number {
  const { cols, rows } = gridSize(count);
  const col = Math.min(cols - 1, Math.max(0, Math.floor((x * cols) / width)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((y * rows) / height)));
  return col + cols * row;
}

const dist2 = (a: Vec3, b: Vec3): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** color_picker_apply: the patch whose source is nearest the picked colour,
 *  the first of equals; null without patches. */
export function nearestPatch(p: Params, lab: Vec3): number | null {
  if (p.patches.length === 0) return null;
  let best = 0;
  for (let k = 1; k < p.patches.length; k++) if (dist2(lab, p.patches[k].source) < dist2(lab, p.patches[best].source)) best = k;
  return best;
}

/** Shift+click with the picker on: the picked colour becomes `cell`'s
 *  source and target, or a new patch when the cell is empty and there is
 *  room. Null for a colour with a channel within 1e-3 of zero (darktable
 *  avoids the solve's divisions by it) or within 1e-3 of a patch's source. */
export function placePicked(p: Params, cell: number, lab: Vec3): { params: Params; index: number } | null {
  if (lab.some((v) => Math.abs(v) <= 1e-3)) return null;
  if (p.patches.some(({ source: s }) => s.every((v, c) => Math.abs(lab[c] - v) < 1e-3))) return null;
  const patch: Patch = { source: lab, target: lab };
  const n = p.patches.length;
  if (n < MAX_PATCHES && (cell < 0 || cell >= n)) return { params: { patches: [...p.patches, patch] }, index: n };
  if (cell < 0 || cell >= n) return null;
  return { params: { patches: p.patches.map((k, i) => (i === cell ? patch : k)) }, index: cell };
}
