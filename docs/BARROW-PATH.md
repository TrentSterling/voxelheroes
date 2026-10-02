# Old Barrow: the copper turn and resting hours

The first dungeon now separates its routes with pale limestone, ashstone,
root stone and copper traces. Map Hall and Pit Walk use pale paths; Block
Hall marks a turn in copper; the upper approach adds green stone. These
are quick voxel floor variants, with ordinary collision and pushable-floor
behavior, rather than a large art pass.

Block Hall starts its block at (5,7). Three east pushes stop beside the
statue at (9,7); the hero walks below the block and pushes twice north onto
the plate at (8,5). Holding right alone cannot finish it. An unfinished
solo room resets on departure. A solved block stays on its plate through
revisits and save/load, and the earned key cannot repeat. An occupied
co-op room retains a partial solution when its first player leaves.

Three copper hourstones restore the interacting hero's current hearts and
magic: the guarded Turning Room reward, the western Eye Hall corner and
the Antechamber. Living counted enemies and unfinished encounter waves
prevent rest. Repeated rest stays within existing capacities, costs no
coins and grants no permanent reward. Each friend rests independently.

The first temple's skeletons, bats and gazers are authored without random
crowns. Other areas retain their existing crown behavior. Native combat
still requires real movement, sword attacks, guarding and tool use.

Automatic Next directions now wrap to two HUD lines. The barrow supplies
short routes based on the current room and actual earned keys/items. The
longer instructions remain in the objective/journal. Room feedback is
short enough for phone and landscape touch layouts.
NPC bubbles calculate the current HUD and shortcut bounds before drawing.
Fully occluded bubbles skip their text and panel, preventing Wyll's opening
bark from using the previous frame's single-line direction bounds.

## Verification scope

`barrow-journey` begins at the title. It walks to King Aldric and Wyll,
earns sword/shield/boots, fights the roads, uses the wayside spring, earns
all four small keys, the map and boomerang, clears the upper bell waves,
physically throws clay at the quiet bell, lights all four eyes with
native throws within five seconds, earns the boss key and wakes the
entrance shortcut. It rests at the real hourstones. It stops in the
Antechamber; it does not claim an unassisted serpent victory.

This journey does not teleport, grant gear, edit health, kill through a
damage hook, remove enemies or add invulnerability. Bot healing is disabled.
Exact walk endpoints settle within two ordinary movement steps. The bot
waits for fliers on safe floor, lines up for the four-direction blade and
uses the actually earned boomerang. A pot can still break when its carrier
takes a real hit; the native optional clay puzzle is completed after the
waves. Timed bell interruption itself is covered by `barrow-echo`.

`barrow-path` isolates native pushes, solo reset, saved solved floors,
one-time key and native rest input. Its placements, floor arrangements,
starting health/magic, harmless guards and damage-hook room clearing are
explicit fixtures. Ten decorative floors accept a real block, while pits,
rubble, bell plinths and hourstones remain excluded.

`barrow-path-coop-test.mjs` uses muted Chromium and Firefox connected by
real local Trystero RTC. The host pushes east; the guest finishes north
after the host leaves. It checks the shared key and solved revisit, plus
guarded rest and personal current-stat restoration for the non-owner.
Positions, starting health/magic, invulnerability and guard-clearing are
fixtures. Public signaling and separate-network ICE are outside scope.

`barrow-path-touch-test.mjs` measures complete HUD directions, room hints,
visible feedback, bounds and overlaps at 320x568 and 568x320, normal and
large text. Actual CDP touch A tests guarded and restored hourstones.
Progress/equipment, placements, starting stats and guard-clearing are
fixtures. The full native route is measured separately.

All browser launches mute output. NPC speech is disabled during gameplay
checks. The 1,490 compressed baked recordings remain unchanged; no voice
model or live speech generator is bundled.

## Repeatable commands

```powershell
node scripts/gauntlet.mjs --cases=barrow-journey,barrow-path,first-road --seeds=1,17,982451653 --engines=chromium,firefox --scenarios-only --out=playtest-out/barrow-native-fresh
node scripts/barrow-path-coop-test.mjs --out=playtest-out/barrow-coop-fresh
node scripts/barrow-path-touch-test.mjs --out=playtest-out/barrow-touch-fresh
npm run artifact
node scripts/retake-barrow-path.mjs --out=playtest-out/barrow-retakes-fresh
```

Use fresh output folders to preserve failures, screenshots and source hashes.
