// The patch chart, as darktable draws it (checker_draw): 6×4 cells up to 24
// patches, 7×7 past, each filled with its source colour on a dark ground. A
// patch whose target has moved gets a light outline with a dark one inside;
// the selected patch a ring, black on light patches. Click selects, double-
// click resets the patch, right-click deletes it, and Shift+click with the
// picker on puts the picked colour there, as a new patch from an empty cell.

import { displayFromLab, type Params, type Vec3 } from "./model";
import { deletePatch, gridSize, isAltered, placePicked, resetPatch } from "./patches";
import { React } from "./rt";

export interface GridProps {
  params: Params;
  selected: number;
  /** The picker's colour while it is on; Shift+click places it. */
  picked: Vec3 | null;
  onSelect(patch: number): void;
  /** A finished edit: the new params and the undo step's name. */
  onEdit(next: Params, what: string): void;
}

const css = (lab: Vec3): string => {
  const rgb = displayFromLab(lab).map((v) => Math.round(255 * Math.min(1, Math.max(0, v))));
  return `rgb(${rgb.join(", ")})`;
};

const fixed = (v: number) => v.toFixed(2);

export const CELL_HELP =
  "Patches with an outline have been moved. Click to select, double-click to reset, right-click to delete; with the picker on, Shift+click puts the picked colour here.";

export function PatchGrid({ params, selected, picked, onSelect, onEdit }: GridProps) {
  const count = params.patches.length;
  const { cols, rows } = gridSize(count);

  const cell = (k: number) => {
    const patch = k < count ? params.patches[k] : null;
    const tip = patch ? `L ${fixed(patch.source[0])}  a ${fixed(patch.source[1])}  b ${fixed(patch.source[2])}\n${CELL_HELP}` : CELL_HELP;
    const onClick = (e: React.MouseEvent) => {
      if (e.shiftKey && picked) {
        const placed = placePicked(params, k, picked);
        if (!placed) return;
        onSelect(placed.index);
        onEdit(placed.params, "picked patch");
        return;
      }
      if (count > 0) onSelect(Math.min(k, count - 1));
    };
    const onDoubleClick = () => {
      if (patch) onEdit(resetPatch(params, k), "reset patch");
    };
    const onContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (patch) onEdit(deletePatch(params, k), "delete patch");
    };
    const altered = patch !== null && isAltered(patch);
    const ring = patch && k === selected ? (patch.source[0] > 80 ? "#000" : "#fff") : null;
    return (
      <div
        key={k}
        role="button"
        aria-label={patch ? `Patch ${k + 1}` : "Empty cell"}
        aria-pressed={patch ? k === selected : undefined}
        data-altered={altered ? "true" : undefined}
        title={tip}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        style={{
          position: "relative",
          background: patch ? css(patch.source) : "transparent",
          boxShadow: altered ? "inset 0 0 0 2px rgb(204, 204, 204), inset 0 0 0 3px rgb(51, 51, 51)" : undefined,
          cursor: "pointer",
        }}
      >
        {ring ? (
          <div style={{ position: "absolute", inset: 4, border: `2px solid ${ring}`, pointerEvents: "none" }} />
        ) : null}
      </div>
    );
  };

  return (
    <div
      role="group"
      aria-label="Patches"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 1,
        aspectRatio: `${cols} / ${rows}`,
        background: "rgb(51, 51, 51)",
        padding: 1,
      }}
    >
      {Array.from({ length: cols * rows }, (_, k) => cell(k))}
    </div>
  );
}
