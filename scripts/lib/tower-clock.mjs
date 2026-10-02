// Actual movement and selected-tool actions; campaign gear and invulnerability
// are supplied by the calling scenario, never by this route.
export async function useClockTool(t, id, x, z, facing = 'north', wait = .65) {
  await t.walkTo(x, z);
  await t.eval(([id, facing]) => { const h = window.__voxelHeroes; h.game.inventory.selectItem(id); h.game.hero.hero.setFacing(facing); h.player.lockT = h.player.knockT = h.player.stallT = 0; }, [id, facing]);
  await t.tap('item'); await t.step(wait);
}
export async function unwindClock(t) {
  await useClockTool(t, 'boomerang', 4.5, 9.5);
  await useClockTool(t, 'bombs', 17.5, 9.15, 'north', .1);
  await t.stick(0, 1, .5); await t.step(2.6);
  await useClockTool(t, 'grapple', 7.5, 13.5, 'north', 1);
  await useClockTool(t, 'fire-wand', 14.5, 13.5);
  await t.step(.3);
}
