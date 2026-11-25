// Session state shared by the panel, the grid and the picker: the selected
// patch, whether the sliders show offsets or Lab values (darktable's "target
// colour", a GUI setting rather than a param), whether the picker is on and
// the colour it last read. Built on the host's zustand `create` so the
// components subscribe like core.

import type { Vec3 } from "./model";
import { api } from "./rt";
import type { AppStore } from "./safelight";

export interface UiState {
  /** The selected patch; read it through min(patch, count − 1). */
  patch: number;
  absolute: boolean;
  picking: boolean;
  /** The picker's last colour, Lab, while it is on. */
  picked: Vec3 | null;
  setPatch(patch: number): void;
  setAbsolute(absolute: boolean): void;
  setPicking(picking: boolean): void;
  setPicked(picked: Vec3 | null): void;
}

let current: AppStore<UiState> | null = null;

export function initStore(): void {
  current = api.stores.create<UiState>((set) => ({
    patch: 0,
    absolute: false,
    picking: false,
    picked: null,
    setPatch: (patch) => set({ patch }),
    setAbsolute: (absolute) => set({ absolute }),
    setPicking: (picking) => set(picking ? { picking } : { picking, picked: null }),
    setPicked: (picked) => set({ picked }),
  }));
}

export function store(): AppStore<UiState> {
  if (!current) throw new Error("[colour-look-up-table] store() called before activate()");
  return current;
}
