// TUNING sections owned by the ui stream: maps, readability, and the option
// defaults (gameplay spec 4.6, 12). The first block of options is the spec's
// Appendix A; the second holds the other options the settings module keeps
// (src/game/settings.js lists every key and its allowed values).

export const minimap = { pxPerTile: 4, gridTiles: 16, windowPx: [236, 137], edgeMargin: 8, alpha: 0.85 };

export const worldMap = { pxPerTile: 2, markerHz: 2 };

export const readability = { glintPeriod: 2, hudThreatFade: 0.3 };

export const options = {
  camera: 'A',
  minimap: true,
  seams: true, // the seam grid (the spec's 'grid' option)
  loadingArt: true,
  sway: true,
  cornerAssist: true,
  spinAssist: false,
  dashHold: false,
  autosave: true,
  largeText: false,

  look: 'auto',
  textSpeed: 'normal',
  brightness: 1,
  saturation: 1,
  renderScale: 1,
  bloom: true,
  blur: 0.5, // Trent found the full art-bible blur too heavy (2026-09-28)
  volume: 0.8,
  music: 0.7,
  sfx: 0.9,
  npcVoices: true,
  muted: false,
};

export const profile = { nameMax: 8 };

// Menus: a held direction moves the cursor again after repeatDelay s, then
// every repeatEvery s (core/input.js menuDir).
export const menu = { repeatDelay: 0.35, repeatEvery: 0.1 };

// Toasts: how long the key toast stays (gameplay spec 6.3; it was
// TUNING.dungeon.keyToast).
export const toasts = { key: 2.0 };
