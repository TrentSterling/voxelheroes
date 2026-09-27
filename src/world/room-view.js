// Rooms are drawn one at a time (art bible section 9: outside the room is pure black).
//
// In an area with a fixed camera (area.camera, the dungeon) or area.rooms, only the room the hero
// is in is drawn, plus the room the view slides away from while it slides (mode 'scroll');
// the other rooms would show above the north wall and beside the side walls. Elsewhere every
// screen of every area that is not drawn room by room stays drawn, as before.
//
// syncRoomView() runs every frame after world.flush() (main.js), so meshes rebuilt and props
// added on a hidden room stay hidden.
//
// Stand-in: feat/world's transitions.js draws screens by the same rule (showScreens,
// syncScreenVisibility, shownRect for look.bind's roomRect). When that branch is merged, keep its
// call in main.js and delete this file.
import { on } from '../core/events.js';
import { state } from '../core/state.js';
import { world, currentScreen } from './world.js';

const byRoom = (area) => !!(area?.rooms || area?.camera);

let leaving = null; // the room the view slides away from
on('screen-leave', (e) => {
  leaving = e?.screen ?? null;
});
on('screen-enter', () => {
  leaving = null;
});

export function syncRoomView() {
  const here = currentScreen();
  if (!here) return;
  const rooms = byRoom(here.area);
  const also = state.mode === 'scroll' ? leaving : null;
  for (const s of world.screens.values()) {
    const shown = rooms ? s === here || s === also : !byRoom(s.area);
    if (shown && s.shown === true) continue; // hidden rooms are checked every frame (rebuilt meshes)
    for (const m of s.meshes ?? []) if (m.mesh.visible !== shown) m.mesh.visible = shown;
    for (const obj of s.props.values()) if (obj.visible !== shown) obj.visible = shown;
    s.shown = shown;
  }
}
