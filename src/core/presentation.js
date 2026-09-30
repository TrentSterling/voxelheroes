// Optional screen-space bounds for presentation that combines 3D and canvas.
// Keep this boundary independent of the renderer, UI and gameplay modules.
let rewardReader = null;
export function setRewardBoundsReader(read) { rewardReader = read; }
export const rewardViewportBounds = () => rewardReader?.() ?? null;
