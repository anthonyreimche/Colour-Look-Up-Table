# Colour Look Up Table for Safelight

A [Safelight](https://github.com/anthonyreimche/SafeLight) extension that ports
[**darktable**](https://www.darktable.org/)'s *color look up table* module:
up to 49 **patches** each take one Lab colour to another, and every other
colour follows smoothly between them. Match a colour chart, nudge skin tones
without touching the sky, or give a photo a film's palette: darktable's
maths, presets and chart gestures.

## What it does

Every pixel is read in D50 Lab. Each patch has a **colour** (where it sits)
and a **target** (where that colour should go). The mapping passes exactly
through every patch's target and bends as little as it can everywhere else:
a thin-plate spline, an affine map of L, a and b plus a smooth pull from each
patch that grows with the distance from it. Colours far from every patch
follow the overall trend the patches set.

With four patches or fewer a spline can't be fitted, so the mapping is
simpler: one patch scales each channel, two or three fit a straight line per
channel, four fit an affine map.

## The panel

- **Presets**: darktable's eight. *IT8 skin tones* and *Expanded colour
  checker* are sets of patches to edit from (a chart's skin tones; ramps of
  red, blue, green and grey, and a row of skin tones, 7×7). *Helmholtz–
  Kohlrausch monochrome* is a black and white conversion that keeps how
  bright saturated colours look. *Fuji Astia*, *Classic Chrome*,
  *Monochrome*, *Provia* and *Velvia* are film looks, fitted without a tone
  curve, so pair them with one of your own.
- **The chart**: one cell per patch, filled with its colour, 6×4 up to 24
  patches and 7×7 past that. A patch whose target has moved has an outline.
  - **click** a patch to select it;
  - **double-click** resets its target to its colour;
  - **right-click** deletes it, moving the rest up;
  - **Shift+click** with the picker on puts the picked colour there (on an
    empty cell, as a new patch).
- **Patch**, with the **colour picker** beside it. With the picker on, click
  the photo to select the patch nearest that colour; the picker reads the
  photo as this tool receives it, and stays on until you press it again or
  Esc.
- **Lightness**, **Green-magenta offset**, **Blue-yellow offset** and
  **Saturation** move the selected patch's target. Saturation scales
  green-magenta and blue-yellow together, so the hue stays.
- **Target colour**: *Relative* (the default) shows the sliders as offsets
  from the patch's colour; *Absolute* shows the target's Lab values.
  Double-click a slider to put that channel back on the patch's colour.

**In masks:** add Colour Look Up Table to a mask from the Masking panel's
Adjust tab to map colours inside that mask only. The picker works on the
photo's own panel.

**Defaults:** the 24 patches of a ColorChecker chart, each its own target.
An untouched table renders the photo bit for bit unchanged (the renderer
leaves it out altogether), and the dock header's *Reset to defaults* gives
that back.

## Where it runs

In Safelight's display tools, ahead of the other Lab tools, on the display
values unclipped. The spline is solved once per edit on the CPU; per pixel
the GPU sums its affine part and one term per patch, with no texture reads.

## The math

Faithful to darktable 5.6.1's `src/iop/colorchecker.c` (params version 2):
`commit_params`' solve, with its special cases for one to four patches, the
thin-plate kernel `r² · log(r²)` with darktable's fast log, its Gaussian
elimination in double precision, `process`'s per-pixel sum, darktable's
sRGB → XYZ D50 matrix and `init_presets()`.

### Differences from darktable

- With a single patch whose colour has a channel at zero (a grey patch),
  darktable divides by zero and draws nothing; here that channel is left as
  it is.
- Double-clicking a slider in *Absolute* mode puts the channel back on the
  patch's colour; darktable resets it to 0.

### Tests

The unit tests pin the solve and the pixel path against darktable's own code:
`test/reference/dt_ref.c` compiles colorchecker's `commit_params`, `process`,
`init_presets` and darktable's fast log and Gaussian elimination as they are,
over 14 sets of patches (every special case of the solve) and darktable's
eight presets, on 915 Lab colours. The extension and a line-by-line
transcription of its shader agree with it bit for bit.

The shader was checked on Safelight's real renderer against `darktable-cli`
5.6.1 renders of a synthetic chart, 16 cases: one to five patches, moved
skin, sky, foliage and grey patches, every patch moved, and darktable's
Helmholtz–Kohlrausch preset and five film looks. ΔE2000 at most 0.025,
or 0.051 in the two-patch case, whose straight-line fit runs far outside
the gamut.

## Development

```
npm install
npm run check        # typecheck, build, unit tests
node test/reference/build.cjs   # regenerate test/reference/vectors.json (needs gcc)
```

## Licence

GPL-3.0-or-later, as the darktable code it ports. See [LICENSE](LICENSE).
