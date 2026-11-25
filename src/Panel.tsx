// The Colour Look Up Table panel in darktable's order and wording: a preset
// menu, the patch chart, the patch selector with its colour picker, the
// lightness, green-magenta, blue-yellow and saturation sliders for the
// selected patch's target, and whether those show offsets from the patch's
// colour or Lab values. A drag writes the scope live and commits on release,
// so one gesture is one undo step; saturation scales the target as the drag
// found it, so a drag that touches a limit on its way doesn't bend the hue.
//
// It edits whatever useParamScope hands it: the photo's bag in the dock, a
// mask's in the Masking panel's Adjust tab. The picker reads the photo, so a
// mask's panel doesn't show it.

import { PatchGrid } from "./Grid";
import type { Params } from "./model";
import { RANGES, setBlueYellow, setGreenMagenta, setLightness, setSaturation, sliderValues } from "./patches";
import { bagPatch, readParams } from "./params";
import { PRESETS } from "./presets";
import { React, api } from "./rt";
import { store } from "./store";

/** darktable's slider stops: green to white to magenta, blue to white to
 *  yellow. */
export const A_TRACK = "linear-gradient(to right, rgb(0, 255, 51), rgb(255, 255, 255), rgb(255, 0, 51))";
export const B_TRACK = "linear-gradient(to right, rgb(0, 0, 255), rgb(255, 255, 255), rgb(255, 255, 0))";

const TARGET_OPTIONS = [
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
];

const TIPS = {
  patch: "The patch to edit. With the picker on, click the photo to select the patch nearest that colour.",
  picker: "Pick a colour from the photo: selects the nearest patch, and Shift+click on the chart puts the colour on a patch. Esc ends.",
  L: "The target's lightness: lower darkens the patch's colour, higher brightens it.",
  a: "The target's green-magenta: lower shifts the patch's colour towards green, higher towards magenta.",
  b: "The target's blue-yellow: lower shifts the patch's colour towards blue, higher towards yellow.",
  C: "The target's saturation: scales its green-magenta and blue-yellow together, keeping the hue.",
  target: "Relative: the sliders show how far the target is from the patch's colour. Absolute: they show the target's Lab values.",
};

type Edit = (p: Params, k: number, v: number, absolute: boolean) => Params;

export function ColourLutPanel() {
  const { useEffect, useRef } = React;
  const { Slider, PickerIcon } = api.components;
  const { Button, Field, Row, Select, Stack } = api.ui;
  const scope = api.develop.useParamScope();
  const selected = store()((s) => s.patch);
  const absolute = store()((s) => s.absolute);
  const picking = store()((s) => s.picking);
  const picked = store()((s) => s.picked);
  const holdsPickDrag = api.develop.usePickDragHeld();
  const inMask = scope.maskId !== null;
  const p = readParams(scope.getParams());
  // Drags outrun React's renders, so each change starts from the bag the
  // scope holds now rather than this render's snapshot.
  const live = (): Params => readParams(scope.getParams());
  const apply = (next: Params) => scope.setParams(bagPatch(next));
  const commit = (what: string) => scope.commit(`Colour Look Up Table ${what}`);
  const saturationBase = useRef<Params | null>(null);

  // The picker belongs to the dock's panel: closing it, or another tool
  // taking the canvas, ends it.
  useEffect(() => {
    if (inMask) return;
    return () => store().getState().setPicking(false);
  }, [inMask]);
  useEffect(() => {
    if (!inMask && picking && !holdsPickDrag) store().getState().setPicking(false);
  }, [inMask, picking, holdsPickDrag]);

  const count = p.patches.length;
  const k = Math.min(selected, count - 1);
  const values = k >= 0 ? sliderValues(p, k, absolute) : null;
  const source = k >= 0 ? p.patches[k].source : null;

  const slider = (label: string, tip: string, value: number, range: { min: number; max: number }, reset: number, edit: Edit, track?: string) => (
    <div title={tip}>
      <Slider
        label={label}
        value={value}
        min={range.min}
        max={range.max}
        step={0.01}
        defaultValue={reset}
        trackBackground={track}
        onChange={(v) => apply(edit(live(), k, v, absolute))}
        onCommit={() => commit(label.toLowerCase())}
      />
    </div>
  );

  return (
    <Stack gap={6} style={{ padding: 8 }}>
      <Select
        ariaLabel="Colour Look Up Table preset"
        value=""
        placeholder="Presets"
        options={PRESETS.map((pr) => ({ value: pr.id, label: pr.label }))}
        onChange={(id) => {
          const preset = PRESETS.find((pr) => pr.id === id);
          if (!preset) return;
          apply(preset.params);
          commit(`preset: ${preset.label}`);
        }}
      />
      <PatchGrid
        params={p}
        selected={k}
        picked={inMask ? null : picked}
        onSelect={(patch) => store().getState().setPatch(patch)}
        onEdit={(next, what) => {
          apply(next);
          commit(what);
        }}
      />
      {values && source ? (
        <>
          <Row gap={6} align="center">
            <div style={{ flex: 1 }}>
              <Select
                ariaLabel="Patch"
                title={TIPS.patch}
                value={String(k)}
                options={p.patches.map((_, i) => ({ value: String(i), label: `Patch ${i + 1}` }))}
                onChange={(v) => store().getState().setPatch(Number(v))}
              />
            </div>
            {inMask ? null : (
              <Button
                size="sm"
                active={picking}
                title={TIPS.picker}
                aria-label="Pick a colour"
                aria-pressed={picking}
                onClick={() => store().getState().setPicking(!picking)}
              >
                <PickerIcon size={12} />
              </Button>
            )}
          </Row>
          {slider("Lightness", TIPS.L, values.L, RANGES.L, absolute ? source[0] : 0, setLightness)}
          {slider("Green-magenta offset", TIPS.a, values.a, RANGES.ab, absolute ? source[1] : 0, setGreenMagenta, A_TRACK)}
          {slider("Blue-yellow offset", TIPS.b, values.b, RANGES.ab, absolute ? source[2] : 0, setBlueYellow, B_TRACK)}
          <div title={TIPS.C}>
            <Slider
              label="Saturation"
              value={values.C}
              min={RANGES.C.min}
              max={RANGES.C.max}
              step={0.01}
              defaultValue={absolute ? Math.hypot(source[1], source[2]) : 0}
              onChange={(v) => {
                saturationBase.current ??= live();
                apply(setSaturation(saturationBase.current, k, v, absolute));
              }}
              onCommit={() => {
                saturationBase.current = null;
                commit("saturation");
              }}
            />
          </div>
          <Field label="Target colour">
            <Select
              ariaLabel="Target colour"
              title={TIPS.target}
              value={absolute ? "absolute" : "relative"}
              options={TARGET_OPTIONS}
              onChange={(v) => store().getState().setAbsolute(v === "absolute")}
            />
          </Field>
        </>
      ) : null}
    </Stack>
  );
}
