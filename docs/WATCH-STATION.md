# The Watch station road and third light

This iteration follows the earned second light home through Mossbrook and
Sunreach into the Buried Watch. It continues the original realtime adventure;
the fourth temple, tower and broader era story remain further work.

Mossbrook and Sunreach innkeepers now stay available all night. Previously a
fresh two-temple journey arrived at Sella at 23:20 and could not ask for a bed.
Ordinary villagers retain their own schedules, and an explicitly authored NPC
schedule still overrides the innkeeper default.

Two small teal and brass rest clocks serve the Chain Vault and Colossus
Antechamber. Face one and press the ordinary action button. Living room guards
prevent recovery. After the room clears, the clock restores that player's
current hearts and magic without charging coins, increasing capacity or
healing another independently controlled player. The antechamber clock sits
beside the shortcut and clears its actual arrival tile.

The station's ground now follows its rooms: crossed transit rails, blue map
and cache floors, counterweight tracks, grated channel banks and quieter
stone fields. A horizontal rail joins the existing six ground materials.
These floor patterns preserve puzzle props, actor homes, loot and passages;
the two rest-clock props are intentional additions to collision geometry.

Rook's coral laser marks now sit above the raised voxel floor. A separate gold
ring announces the guardable wave, and a coral circle stays at the committed
landing target during the high leap. The replica reconstructs these cues from
the shared boss phase. A compact HUD reports remaining total health, the
vulnerable feet, arms or core, and the current warning. Attack damage, phase
durations, part health and shield rules are unchanged.

Directions now follow the earned road, specific Watch rooms and live Rook
stage. They cover the map, counterweight, grapple, optional Sun Dial, crown,
shortcut, rest clocks and third-light return stairs. Existing pinned quests
retain their precedence.

## Verification scope

`watch-victory` starts at a fresh title and inherits the complete opening,
barrow and Rootglass routes. It pays for Sella's actual inn stay, bombs the
Dustfall stones, fights the Watch guards, collects actual keys, solves the
counterweight, opens the physical grapple and Sun Dial caches, crosses the
channels, earns the crown, activates the shortcut, uses both rest clocks and
defeats Rook through ordinary movement, sword and guard inputs. It collects
the real permanent heart and third orb before taking the authored return
stairs. No hero/boss health grants, immunity, direct damage, teleports or AI
overrides are used in this fresh route. Earlier movement helpers settle
endpoints within two normal movement steps. The earned starter equipment has
a save roundtrip; subsequent diagnostic checkpoints are saved and never loaded.
The combat controller reads positions and attack clocks, so these receipts
measure mechanical progression rather than human difficulty or enjoyment.

`inn-hours` arranges time and currency but uses actual conversations and paid
stays at both inns. `colossus-cues` arranges direction and phase to measure
world-space marks and active clocks. `watch-station-hud-layout-test.mjs`
arranges progression, gear, placement and stationary stage/phase fixtures;
it measures all text runs, actual touch prompt boxes, side controls, Journal
input and native hero visibility at four viewport shapes in both engines.
The large-text option affects dialogue rather than increasing every HUD font.

`colossus-coop-test.mjs` uses silent Firefox and Chromium over real local
Trystero RTC. Its disclosed fixtures isolate guest sword damage, stage and
cue replication, owner departure during a leap, guarded rest and personal
recovery. It does not stand in for an earned cooperative campaign, public
signaling or separate-network ICE. The existing Watch co-op test separately
covers sentry shutters, the Sun Dial and independent exploration.

All automated launches disconnect speaker output before loading the game.
Voice assets remain baked recordings; asset hash checks do not measure
audible voice quality. Frozen failures and earlier source checkpoints remain
in `playtest-out`; the review manifest identifies the exact source for each
accepted receipt and image.

The accepted October 3 checkpoint records:

- `watch-station-matrix-20261003`: 18 passing cases, 2,646 assertions and
  308 images, including fresh Firefox/Chromium victories and room audits.
- `watch-station-native-acceptance-20261003`: 4 passing cases/stages,
  524 assertions and 162 images; fresh seed 73 wins in both engines.
- `watch-station-offline-acceptance-20261003`: 3 passing cases/stages,
  263 assertions and 81 images; the exact portable Firefox build wins.
- `watch-station-hud-20261003`: 1,544 checks and 192 settled images.
- `watch-station-coop-rest-20261003`: 13 local RTC contracts.
- 318 game modules parse; all 1,490 current Opus assets pass static checks.

The broader seed investigation caught a Firefox hero arriving at the nursery
with two half-hearts and dying while the bot waited on a seal fuse beside
pursuing guardians. The accepted route now fights all three guardians before
working on the seals; the machine stays live throughout. This changes test
inputs, not game damage, enemy health or puzzle rules. Its combat helper stops
after three kills because the live machine intentionally blocks room clear.

Native and portable acceptance reuse passing cases from their parent packets
after the harness verifies unchanged source, executed helpers and scenario
dependencies. The parents retain an integrity failure caused by editing an
unused co-op fixture driver during their run. No failed gameplay case is
reused. The frozen parent and acceptance manifests preserve this provenance.
