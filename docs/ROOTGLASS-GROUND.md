# The woodland road and the second light

Whisperwood and its five maze clearings use four new ground materials: fallen
leaves, weathered stepping stones, copper routes and amber seedbeds. Each
screen has its own arrangement. These are small voxel builders extending the
existing overworld kit; they require no bitmap assets or new model downloads.
Only ordinary grass and path cells change. Actors, scenery, chests and maze
passages retain their published positions. The child tileset explicitly
registers the existing northern terrain backdrop.

Rootglass directions now follow the current room and actual seal flags. The
nursery shows the remaining brass seals, then its wardens, then key pickup.
The galleries point toward the nursery and amber chest. Queen instructions
follow flight, rest, volley and the bomb opening. Her separate HUD shows life
and phase on one line, choosing shorter labels when the available span is
narrow. It reserves room above the touch action prompts. The second orb's room
points toward the actual southern exit home.

`nursery-crown-journey` extends the existing fresh title-to-bomb-cache route
through both stone seams, all three pressure seals, normal warden combat,
the amber chest, the three-eye puzzle, three real locks and the entrance
shortcut. It saves earned checkpoints for diagnosis, without loading them.
`nursery-victory` continues into the Queen, collects the actual permanent
heart and second orb, and leaves by the authored reward stairs.

The Queen controller reads positions and phase clocks and writes ordinary
movement, guard, sword and bomb inputs. It cuts nearby drones, waits out
flight, plants earned bombs during landing, retreats from the fuse and
attacks the overturned crown. It does not grant gear, edit health or immunity,
alter boss AI, remove actors, teleport or directly deal damage. Earlier
walking helpers settle an endpoint within two ordinary movement steps. The
first controller died by chasing the Queen through the swarm; that failure
remains beside the later defending controller's receipts.

`woodland-ground` compares all eight authored maps with published commit
`a40aa08`. It checks dimensions, actor homes, loot, warp destinations and every
changed ground cell. Collision is compared directly with each original grass
or path cell. Some original centres already collide with room wall insets;
the first test's assumption that every centre was open is preserved as a
failed fixture. Placement, unrelated enemy removal and temporary collision
comparisons are disclosed fixtures. Native adventures exercise the real
forest groups, maze and dungeon combat separately.

`rootglass-hud-layout-test` covers nursery states, all five Queen phases and
the second-orb homecoming at phone, short landscape, wide and desktop sizes
in Chromium and Firefox, with both text settings. Those phase/health, gear
and placement states are fixtures. It checks actual text bounds, HUD and
shortcut clearance, action-prompt clearance, visible settled heroes and real
touch/mouse Journal input. Touch photographs select their device through the
real Guard control. Large Text changes dialogue layout, so it does not scale
the HUD font. The first layout check split a valid wrapped phase label into
two runs; the corrected check reads the complete widget. Manual inspection
then found the two-line status overlapping touch prompts. The final status
uses a single line and prompt rectangles are included in the matrix.

The three-seed mechanical checkpoint retains 50 passing case/stage results,
6,998 assertions and 516 image receipts, including six fresh two-temple wins.
That source used the earlier two-line status. Publication reruns the native
route and dungeon/world controls in both browsers after compacting it; the
portable Firefox run repeats a fresh two-temple adventure. Each report holds
its own source and executed-test fingerprints. Earlier source variants are
kept separately and are never substituted for final-source acceptance.

The local co-op contract checks shared pressure, physical keys, separate
exploration, host handoff and saving over local Trystero RTC. Its placement,
gear, immunity and guard-defeat fixtures are separate from native solo wins.
Public signaling and connections across separate networks remain untested.

The source packet is `playtest-out/rootglass-ground-release-20261002` and the
image-only slideshow is `playtest-out/rootglass-ground-review/static.html`.
Its manifest records the exact artifact, source and receipt hashes. Woodland
retakes arrange scenic viewpoints and wait for native arrival and terrain
construction; they do not force hero visibility. All test clients disconnect
speaker output before navigation. Voice verification reads the 1,490 existing
compressed clips without playback; no voice identities or texts changed.

Final-source acceptance is tied to game fingerprint
`b3580c8787fcc3ed6584cf330210573d66ab69ebd826897fedc7173f3f970916`:

- Chromium and Firefox: 18 passing case/stage results, 2,334 assertions and
  172 screenshots, with two fresh native two-temple victories.
- Portable offline Firefox: three passing case/stage results, 172 assertions
  and 57 screenshots, with another fresh native two-temple victory.
- Rootglass HUD: 1,016 checks and 144 settled photographs, including actual
  touch action-prompt clearance.
- Local RTC co-op: all 21 contracts pass; separate-network signaling and ICE
  are outside this acceptance scope.
- All 317 game JavaScript files parse. The static voice audit verifies 1,490
  recordings totaling 21.49 MB without playback or a runtime model.

The native route checks its own earned starter equipment through a save and
reload. It does not load externally seeded saves or its later diagnostic
checkpoints. The slideshow distinguishes the earlier two-line HUD failure,
arranged woodland/phase fixtures and final native adventure evidence.

Later temples, a broader story/content pass and user-directed Boxel polish
remain further work.
