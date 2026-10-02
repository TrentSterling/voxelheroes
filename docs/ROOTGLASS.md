# Rootglass Nursery

Rootglass is an abandoned municipal greenhouse, still tending seedlings that
Mossbrook stopped collecting 300 years ago. Combat stays in real time. The
original nursery story connects the hive's machinery to the Silent Year garden.

All fifteen rooms use the local `hive` tileset. Its six walkable floor materials
are root cobble, amber glass, service grates, irrigation channels, leaf mosaics
and cracked root stone. Roots and the pump use quick original voxel models.
The crown arena uses the same kit; the barrow keeps its own tileset.

Crossfire Nursery has three one-time guards and three bomb-breakable seals.
The machine starts after four seconds, warns for 1.25 seconds, fires a lane for
0.85 seconds, then rests for 2.9 seconds. Breaking a seal cancels its current
lane and removes that lane from subsequent cycles. Every active lane can deal
one half-heart through the ordinary personal hazard pipeline. Guard and Bell
Shelter do not block it; ordinary hit immunity still applies. Leaving the lane
before the burst avoids damage. The room contains a refill for empty bomb bags.

Both guards and seals must be cleared for the second small key. Either order
works. Once defeated, these guards stay defeated, including partial reloads.
The shared saved flags are `dungeon:d2:nursery-valve:0` through `:2` and
`dungeon:d2:nursery-vented`. Valve tiles persist as `d`. The native key and
keytaken flags retain their existing room ids. Old saves that already earned
the nursery key infer the completed machinery and keep their earned progress.

The owner replicates one encounter clock. A play hook resolves local hazard
contact on every peer, so a proxy lane can hurt a guest without hurting a
distant friend. Bomb tile hooks use the existing owner RPC. Room ownership can
transfer with partial seals and the current warning intact. Shared venting
grows four more future garden tiles after the main water engine is restored,
including for a friend who is already standing in the future.

Decorative floors explicitly opt into `pushableFloor`. Both puzzle blocks and
ordinary pushed statues accept them; moving onward restores the original floor.
Pits and closed seals do not opt in. This avoids changing every walkable tile
into a valid block destination.

Verification receipts are preserved under `playtest-out/`:

- `hive-regression-release4-20261001`: 1,256 assertions, including the complete
  hive and barrow routes, all world definitions, block and statue movement,
  hero combat, eras, companions, quest guidance, saves and gameplay contracts.
  Sixteen passing cases on identical source are reused from release3; the
  expanded floor scenario runs again. Failed development runs remain preserved.
- `hive-firefox-release3-20261001`: 271 assertions across two seeds, including
  pressure contact, real bombs, the full hive route, pottery and the barrow.
- `hive-coop-release3-20261001`: 21 checks over local Chromium/Firefox RTC.
- `hive-layout-release3-20261001`: 27 input checks and 28 layout captures,
  covering desktop, portrait and short landscape in both text sizes.

Position, equipment, story, terrain and enemy damage fixtures are disclosed
in the scenarios. Pressure clocks, bomb input and fuses, dodge input, key
pickup and tablet paging run through gameplay. These checks do not measure
enjoyment or verify public signaling and separate-network ICE. Every browser
is muted. No voice generation, audio decoding or playback was repeated.

Use `node scripts/gauntlet.mjs --scenarios-only --cases=hive-pressure,hive-retry,hive-floors,d2`
for the focused route. `--engines=firefox --seeds=17,982451653` selects browser
and seeds. The normal gauntlet includes the new solo, co-op and layout checks.

The local delivery retains a portable HTML, source ZIP, silent slideshow and
hashed receipts. Trent handles GitHub publishing; this pass does not deploy.
