# Sunreach and the Buried Watch

The Watch is a drowned municipal observatory and transit station. Its sentries
still guard the platforms after the last evacuation. The original tablets link
its keeper, a stopped meridian clock and a forgotten route to Sunreach's town.
Real-time combat and the existing two-floor campaign route remain the foundation.

Meridian Sentries have 18 HP, frontal brass armor, a committed three-bolt volley
with a 0.9-second warning, and a 1.25-second exposed recovery. The grapple deals
zero damage but opens their shutters for four seconds and cancels an attack.
Flanks and recovery also permit sword damage; physical pottery interrupts and
opens them for two seconds. Their bolts use ordinary tier-two shield, reflection
and sword-deflection rules. Warning markers sit above the highest new floor.
Sentries stay on their bank, and the Crossing Arsenal shutters require both kills.
Enemy AI, exposed armor, poses and shots use the existing room-owner snapshots.

The optional Hook and Guard cache awards the Sun Dial. This passive item extends
newly fired hooks from six to eight tiles and shares with the adventure party.
Its one-time guards and native chest flags survive saves. Sunken Meridian is a
new optional route south of Quiet Dunes; a six-tile chain misses its far post,
while an eight-tile cast reaches a dry platform with a one-time heart fragment.
The return post also requires the extended chain. Existing Quiet Dunes loot stays
at its original coordinates.

Six local Watch floor materials cover all 22 rooms and the Colossus Court:
salt flagstone, blue mosaic, grates, meridian rails, clock faces and cracked
sandstone. They opt into native push-block and statue movement. Four sparse
Sunreach materials add paving, caravan slabs, transit rails and sun mosaics.
All geometry is quick original voxel code, suitable for a later Boxel polish.
The Barrow's clock rubble and bell plinth now use the correct global detail
writer so their solid footprints also have visible geometry.

Treasure captions temporarily hide the touch pad while the reward banner is up;
the hero's treasure pose already holds actions. This prevents reward text being
covered by the pad on short landscape screens. Dialogue paging still exposes
every authored paragraph at normal and large text sizes.

Acceptance scripts:

- `watch-combat`: actual sword, hook, pottery, dodge, guard, recovery, cache and saves.
- `watch-route`: ordinary/extended hooks, safe landing and return, permanent
  platform reward, save/reopen, all Watch/Sunreach captures and six real block pushes.
- `d3`: full campaign route, both keys, grapple caches, Colossus and third orb.
- `watch-coop-test`: muted Chromium/Firefox local RTC, replica warning/bolt contact,
  guest hook, owner transfer, shared cache, independent exploration and save/reload.
- `watch-layout-test`: complete real mouse/touch tablet paging, prize and warning
  HUD at 1280x720, 320x568 and 568x320 with both text sizes. Canvas bounds and
  reward-caption overlap with actual visible touch controls are measured.
- `barrow-portable-smoke --watch`: both browser engines, real sentry hook,
  extended traversal and saved passive item in the portable HTML.

Position/equipment/story fixtures, removed unrelated pickups and API guard kills
are identified in test descriptions. Real public signaling and separate-network
ICE are outside the local RTC checks. No new NPC voice lines or model downloads
are introduced; the existing compressed voice bank is preserved without playback.
