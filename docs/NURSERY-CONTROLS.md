# Guarded combat and the road to Rootglass

Holding Guard with an equipped blade commits A to the sword. Nearby people,
readable tiles and counters cannot consume that strike. The contextual prompt
uses the same rule. Release Guard to deliberately talk, read or lift a pot.
The unarmed opening retains conversation input. Carrying and throwing an
already lifted pot still use the existing earlier input hook.

Random spawn groups construct each body before placement is announced. They
check its real radius against scenery and screen bounds, including room side
collision that extends past a wall tile. A rejected floor centre is replaced
by an unused fitting candidate. Both the initial object position and spawn
options carry the corrected position, so party replication receives it.
If no remaining floor fits, that group member is skipped.

The fresh `nursery-journey` starts at the title and imports the complete native
first-orb route. It walks home, crosses Whisperwood and its north/west/east/north
maze, clears Broken Patrol, collects its actual key, opens the map chest, spends
the key on the north lock and clears the Powder Cache for its bomb bag. It uses
no teleport, equipment grants, direct damage, actor removals, health edits or
test invulnerability. Native recovery stones and naturally dropped pickups
remain available. Movement helpers settle endpoints within two normal steps.

Outdoor combat may carry the hero through the authored forward forest entrance.
That counts as normal travel. Locked dungeon fights must actually clear. Key
collection is checked by the earned key count, so walking need not reach the
old drop centre after the key is already collected beside a moved statue.
The native proof stops at the bomb cache. It does not establish an unassisted
Amber Queen victory or a complete second-temple adventure.

The optional combat controller for this route follows its final floor waypoint,
cuts blocking bushes and pots with real sword input, and uses a conservative
part of the real minimum blade width plus the target radius. It avoids holding
a flier stunned over water where the hero cannot approach. The established
first-temple controller keeps its previous behavior. Diagnostics return actor
numbers and AI clocks, never a visual mesh and its scene.

`combat-talk` isolates Forester Fen with starter gear, safe placement, a
stationary hostile and unrelated enemies removed. It checks held Guard plus
sword, the matching prompt, released Guard plus conversation, and native
confirmation back to movement. `spawn-clearance` exhausts actual group floor
pools with buzzers and larger guardians in two forest rooms and Rootglass.
It checks each body against scenery and its first ordinary movement options.
These are disclosed isolation fixtures, separate from the fresh journey.

`combat-talk-touch-test.mjs` uses real simultaneous Guard and A touches at
320x568 and 568x320 with normal and large text. A native confirm reveals the
first paragraph for its dialogue photograph. `retake-nursery-controls.mjs`
does the same for the desktop photograph. The existing hive co-op contract
checks shared pressure machinery, physical keys, separate-era exploration and
host migration over local Trystero RTC; its placement, health and guard-defeat
fixtures are separate from the native solo route.

All browser output is muted. Firefox uses zero media volume, Chromium uses
`CHROMIUM_ARGS`, and these scenarios disable NPC voices and game master volume.
Recordings are retained without listening. Reviews are image-only `static.html`
slides. Failure folders stay intact with their original source hashes.

Reproduce the gameplay cases with:

```powershell
node scripts/gauntlet.mjs --url=http://127.0.0.1:5173/ --cases=nursery-journey,combat-talk,spawn-clearance,pots,npcs,interact --seeds=17,73,941 --engines=chromium,firefox --scenarios-only
node scripts/combat-talk-touch-test.mjs --out=playtest-out/my-fresh-touch-run
node scripts/hive-coop-test.mjs --url=http://127.0.0.1:5173/ --out=playtest-out/my-fresh-coop-run
```

The checkpoint source packet is `playtest-out/nursery-controls-release-20261002`.
The static slideshow is `playtest-out/nursery-controls-review/static.html`.
Its manifest links exact receipts and fingerprints. Public signaling,
separate-network ICE, later dungeons and a larger forest art/story pass remain
outside this checkpoint.

The final Chromium and Firefox reports each pass 19 cases and 598 assertions
across seeds 17, 73 and 941. Together they retain 312 screenshot receipts.
All six 123-assertion native journeys were rerun after the route/controller
corrections. Thirty unchanged passing control and scenery cases were reused
only after the harness verified identical game and helper fingerprints.
The touch contract passes 16 checks and the desktop dialogue retake passes
six input assertions plus two photograph checks. All 315 game modules parse.

The offline Firefox checkpoint passes four cases and 148 assertions against
the exact portable HTML. Local Chromium/Firefox Trystero checks pass all 21
shared-dungeon contracts. The small large-text forest photograph still shows
an early quest objective sharing space with right-side controls. Touch input
is verified; this checkpoint does not claim every forest HUD layout is fixed.
