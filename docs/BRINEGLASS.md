# Brineglass and the Last Shore Light

Brineglass Temple now holds a keeper's unfinished kiln and an optional original
story about leaving warmth for people in another era. Real-time fights and the
existing four-key campaign remain playable. This pass changes Pressure Patrol
and adds the kiln; Nacre's existing boss design remains the same.

Tideglass Skaters have 18 HP and guard sword, spin, beam, arrow and dash damage
from every angle while their ice shell is closed. An aimed lane warns for
0.85 seconds, followed by a committed 7.5-tile-per-second slide. A miss or wall
collision exposes a 1.8-second recovery. Fire deals the ordinary six damage,
opens the shell for five seconds and interrupts the charge. Physical pottery
opens it for 2.5 seconds. Grapples stun and interrupt without melting its shell.
AI, HP, shell timers, poses and warnings use the existing room-owner snapshots.

Pressure Patrol's two skaters guard its original campaign key. West of the
upper Ember Gate, Kiln of the First Light adds two one-time skaters and a native
Ember Lens chest. The passive shared lens gives newly fired bolts one extra ice
melt: exactly two consecutive blocks instead of one. It cannot pass through
ordinary walls, pots, bowls or enemies. A bolt already in flight retains its
original budget. Accepted guest fire actions can pass their first ice footprint
while the room owner's tile update travels back, without repeating that action.

The Last Shore Light is a new coastal screen south of Hookshore Landing and
west of Pilgrim Strand. The base wand can clear its ice but cannot restore the
cracked beacon. An Ember Lens and actual fire light it. A shared saved flag then
warms a memorial in the Silent Year square, even for a friend already there.
Its nearby physical vault grants one permanent magic gem through the existing
chest ownership path. The original Dawn Seed chest still requires water repair.
The new journal task can be tracked through kiln, shore, hourgate and memorial
stages, and releases its personal pin when the shared reward is claimed.

Six original dungeon floor types cover the 26 temple rooms and Undertow Court:
salt stone, sea glass, wet grates, copper heat pipes, shell mosaics and broken
ceramic. They remain walkable and accept native push blocks. Four coastal path
types add shell roads, tidal glass, jetty boards and copper conduits. North walls
gain glass lantern details. These are quick native voxel silhouettes for later
Boxel polish, not a completed art replacement.

Co-op testing also found and fixed two existing contact inconsistencies:
solid remote heroes stopped enemies before their damage radius, and negative
expired stun timers suppressed replica contact. Player-to-player physical
contact and friendly sword knockback retain their existing behavior.

Acceptance:

- `brineglass-combat`: actual shell guards, fire, hook, pottery, timed rush,
  dodge, crash punish, two kills, physical lens chest and save/reopen.
- `brineglass-route`: actual one/two-block melts, bowl/wall boundaries,
  connected coast exits, beacon, future vault, journal guidance, reward reload,
  all temple/coast captures and six actual counterweight pushes.
- `brineglass-retry`: cold beacon/vault and seed locks, partial guard reload,
  remaining actual kill, retried lens and an upgrade received during flight.
- `brineglass-geometry`: real rendered floor/path and north-wall vertices.
- `brineglass-coop-test`: muted Chromium/Firefox local Trystero RTC, replicated
  charge/contact, guest fire, owner migration, shared lens, guest ice piercing,
  independent eras, future reward, reuniting and solo reload.
- `brineglass-layout-test`: seven complete native conversations, four journal
  stages, both visible prize captions and warning HUD at 1280x720, 320x568 and
  568x320, normal and large text. Actual mouse/touch paging, canvas bounds and
  visible control overlap are checked, including restoration after captions.
- `barrow-portable-smoke --brineglass`: both engines, actual fire, two-block
  melting, coastal beacon, future memorial and upgrade reload in portable HTML.

Fixtures for position, equipment, static AI, reset HP, removed unrelated drops
and API kills are disclosed in receipts. Local RTC checks do not test public
signaling or separate-network ICE. Tests stay muted. Existing compressed Kokoro
recordings are retained without generation, playback or new model downloads;
machine logs and tablets do not add NPC voice lines.
