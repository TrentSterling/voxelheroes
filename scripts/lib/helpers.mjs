// Helpers shared by the scenarios (scripts/scenarios/*.mjs). Each takes the
// play-test session `t` (scripts/playtest.mjs launch()).

// Take the enemies (and anything they threw) out of the current screen so a
// walk is not knocked about. The default scenario does the fighting.
export const clearFoes = (t) =>
  t.eval(() => {
    for (const e of window.__voxelHeroes.entities) if (e.kind === 'enemy' || e.kind === 'projectile') e.remove();
  });

// Hold keyboard `key` until the mode leaves 'play' (a slide or a fade
// starts), then let go.
export async function pushUntilMoving(t, key, { seconds = 4 } = {}) {
  await t.page.keyboard.down(key);
  try {
    await t.waitFor((s) => s.mode !== 'play', { seconds });
  } finally {
    await t.page.keyboard.up(key);
  }
}
