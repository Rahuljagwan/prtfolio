import { create } from 'zustand'

/**
 * Global state — deliberately tiny.
 * scroll: raw target progress 0..1 (set by scroll listener)
 * smooth: lerped progress 0..1 (set by CameraRail every frame — the "buttery" value)
 * section: nearest station index (drives overlay cards + HUD dots)
 */
export const useStore = create((set) => ({
  scroll: 0,
  smooth: 0,
  section: 0,
  mouse: { x: 0, y: 0 }, // -1..1, for parallax
  setScroll: (v) => set({ scroll: v }),
  setSmooth: (v) => set({ smooth: v }),
  setSection: (v) => set({ section: v }),
  setMouse: (x, y) => set({ mouse: { x, y } }),
}))
