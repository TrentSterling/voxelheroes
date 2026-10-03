# Voxel Heroes build plan

The reported chest trap has a focused clearance fix: a reward reveal clears
overlapping heroes and travelling companions before adding its solid chest.
See `CHEST-CLEARANCE.md` for native input, occupied floor and local co-op checks.
The broader adventure task remains paused at the requested stopping point.

Goal: an original real-time voxel co-op adventure (Three.js, Vite, vanilla JS). On September 30, 2026 Trent changed the creative direction: retain real-time combat, but use Chrono Trigger as the reference for expressive color, memorable characters, linked eras, personal stakes and authored encounters. This supersedes the older requirement to follow 3D Dot Game Heroes closely. Characters, models, dialogue and music remain original.

The Old Barrow now has a turning copper block route, three personal rest
hourstones and more pale, ash, root and copper flooring. Coilmaw marks its
charge in coral, pauses after dashing and exposes a cancellable head attack.
The HUD counts its coils, then head health. A fresh starter route now covers
the complete first-temple victory, earned heart, first orb and native return
stairs. See `BARROW-PATH.md` and `COILMAW.md` for mechanics and the distinction
between native playthroughs and isolated fixtures. The later temples and
larger era campaign still need more work.

The road after the first clocklight now has a native two-temple route through
Rootglass and the Amber Queen. Four woodland ground builders vary eight
forest screens, room-aware directions follow pressure seals and the crown,
and compact Queen status clears actual touch prompts. See
`NURSERY-CONTROLS.md` and `ROOTGLASS-GROUND.md` for fresh routes and fixtures.
Guard plus sword stays in combat beside an NPC, and random group bodies clear
room wall insets before they are announced to the party.

The earned third-light journey now reaches the Watch through an all-night
Sunreach inn. Two personal rest clocks, room-aware directions, station floor
patterns and visible Rook laser, wave and landing cues extend the route.
`WATCH-STATION.md` describes the fresh three-temple journey and separate
local RTC and small-screen HUD checks. The fourth temple, tower and fuller
era campaign remain in the larger adventure goal.

The opening now has safe unarmed travel to King Aldric, four town paving
materials, directions for each road screen, three authored combat pairs and
a reusable recovery spring before the barrow. The first bow teaches the
starter guard and can lose its loaded shot to sword or boomerang interruption.
The king's shared kit is immediately usable by an independently exploring
friend. Native routes, local RTC and small-screen touch/text checks are
documented in `OPENING-ROAD.md`; this remains an iteration within the larger
adventure goal.

The Last Departure now connects two optional station screens south of the
Copperwalk. Meet Tern on his first day, repair a signal across eras, fight a
Waiting Bell Courier with committed three-note warnings, and choose to call it
home. One shared permanent magic gem and three present-day station lights close
the story. Four native station floors and fifteen new baked Tern lines extend
the current 1,460-clip bank. See `LAST-DEPARTURE.md` for scope, controls, saved
causality and simultaneous co-op reward claims.

Nearby party members now share camera composition and individual terrain cutaway
probes. Portrait frames keep the travelling party visible, and the technique hint
leaves room for their figures. Solo transitions and rewards keep their original
rules. See `PARTY-CAMERA.md` for scope, native measurements and local delivery.

Party travel now reconnects around walls and changing terrain, separates settled
followers and resets stale teleport trails. Enemy hit flashes fade to preserve
native colours and vulnerability poses during stuns. See `PARTY-TRAVEL.md` for
the movement, combat and verification scope.

The Buried Watch now follows the drowned Sunreach transit story with grapple-opened
Meridian Sentries, an optional shared eight-tile Sun Dial, a sunken platform route,
six dungeon floor materials and four outdoor materials. Its two-floor campaign
and Colossus route remain playable. See `BURIED-WATCH.md` for behavior and tests.

Brineglass now adds ice-shell Skaters, an optional upper kiln and a shared Ember
Lens that melts two ice blocks per bolt. A shore beacon warms a memorial and
opens a one-time vault in the Silent Year, including across independently
exploring friends. Six temple floors and four coastal paths provide more native
voxel variety. See `BRINEGLASS.md` for behavior, limits and acceptance tests.

Keeper Mara now joins after restoring the shore beacon, with a personal keeper
story, distinct paddle-and-lantern voxel poses and a Fire Wand Steamwheel with
Mira. The three-companion party supports shared guest techniques, independent
era exploration, dismissal and leader transfer. Crowded conversations favor
the person directly in front, and compact touch technique feedback stays clear
of item prompts. Seven new pre-recorded Kokoro lines keep the current voice bank
around 20 MB. See `MARA.md` for controls, behavior and verification.

Stone Eyes now commit to a coral sight line for one second, leaving movement
available. Boomerang, clay, sword and freeze interrupt their pending shot,
and the closing lid leaves a counterattack window. Their attack clock transfers
with dungeon ownership. Gazer Walk adds iris mosaics and copper borders.
Touch arrival titles, transient hints and item labels now take turns, and the
wide journal keeps long quest lists above its footer. See STONE-EYES.md for
controls, scope and muted verification.

## Era direction: first playable chapter

The reported Old Wick pot overlap and unavailable action-button chest opening
now have targeted reproductions and regression coverage. The original town's
NPC homes join the full world placement audit. All four future vaults retain
their story locks and use the action button, including local guest feedback
and owner-controlled rewards. See TOWN-CHESTS.md for the exact cases and
fixtures.

Rootglass also has leaf-and-brass Pollinators and an optional western
Pollinator Court with a saved heart piece. Its committed pink dive warning
keeps dodging and tool interruption available. Petal stones and seed rails
bring its local decorative materials to eight. See NURSERY-WINGS.md for
controls, room scope and muted native-input verification.

The Bell That Rang Tomorrow introduces clockmaker Mira, machine caretaker Tern,
and an hourgate in Mossbrook Square. A past engine repair changes the future's
crossing and garden, including for a friend already standing there. Three enemies
guard the engine; its repair, a one-time Dawn Seed heart reward and homecoming
are saved and shared. It is an optional story route alongside the existing
four-dungeon campaign, not a finished rewrite of that campaign.

The visual language now starts with plum village roofs, sea-green foliage,
brass and sea-glass machines, tall festival pennants, and indigo/gold menus.
The First Bloom uses warm paths and teal roofs; the Silent Year uses desaturated
blue stone, empty spires and a garden that physically regrows. Characters need
individual voices and reasons to care about places, with short conversations
that reveal those reasons through the adventure.

NPCs now use baked Kokoro recordings for all currently authored conversations
and nearby reactions, including errands, gifts, heart scenes and campaign
branches. Source inventory, cast checks, every-clip Firefox/Chromium decoding
and real recorded-media playback are part of the voice acceptance workflow.
The game loads individual Opus files and has no live inference or model download.

Mira now joins through conversation choices and travels with the living party
leader. Her wrench supports active sword fights without clearing idle rooms.
The Copper Memory unlocks Clockwork Cross: a nearby charged-spin release costs
two magic gems, adds a six-point pulse and recharges in four seconds. Co-op
publishes one companion pose with the leader; guests can use the combination,
split into other eras, or become her new leader after host departure.

The first dungeon now has its first authored two-wave encounter in Crossed
Bones. A copper bell previews four aimed projectiles; real pottery cancels the
warning and silences it for four seconds. A skeleton/bat opening becomes a
warden/gazer fight after a quiet beat. Its fourth key and shutters wait for both
waves. Quieting the bell also reveals a retryable Echo Memory chest with a
one-time shared magic gem and a saved journal note. Six dungeon rooms gain
local stone, copper, repair-channel and rubble variations. This is one encounter
redesign, not a claim that all four old dungeons have been redesigned.

Next creative work: additional companions and combination techniques,
distinctive dungeon architecture for each era, additional era-dependent town
quests, and campaign scenes that connect the four temples to the broken clock.
These are future work, not features implemented by the opening chapter.

Tern is now the second travelling companion, recruited after returning the
archive's Copper Memory and hearing the choir. He travels as an original brass
garden machine alongside Mira. Bell Shelter uses held Guard plus Sword for
two personal magic gems: three seconds of nearby team protection, with an
eight-second cooldown. Hazards and explicitly unblockable attacks bypass it.
Each companion can be dismissed independently. Two companion poses follow one
living party leader; separated friends cannot call a distant technique, and
both followers transfer to the remaining hero after host departure. The three
new Tern lines are baked Kokoro clips, with no runtime model download.

Tern acceptance now covers actual recruitment, both followers, ordinary shot
blocking and hazard/expiry boundaries, independent dismissal, reload and host
migration. Touch dialogue hides the gameplay pad; fitted feedback appears above
touch controls. The UI check verifies actual two-finger casting, complete large
text paragraphs and pointer choices.

Story guidance now advances from location and actual quest milestones. Completed
era routes lead back to the hourgate; finishing the choir before the garden
homecoming still leaves Mira's turn-in available. The journal can Track any
unfinished era story, barrow memory or village errand. That personal choice
survives save/load and party join, while a shared turn-in releases a completed
pin. Stable task ids preserve selection when progress reorders the journal.
Titles and rewards wrap on phones. The larger temple/era story rewrite and
other village quest redesigns remain future work.

Verification: `--scenario eras,journal,text-layout`, plus
`node scripts/era-coop-test.mjs` for local Chromium/Firefox cross-era replication.
The solo scenario uses real sword combat, gate choices, engine interaction and
chest collection; the co-op fixture isolates replication using patrol kills
through the damage API and disables public ICE.

Design inputs, read these when they exist and follow them over this plan:

- `/mnt/project-files/design/gameplay-spec.md`, the mechanics spec
- `/mnt/project-files/design/art-bible.md`, the art bible

## Original mechanical reference (historical; revised direction above wins)

The signature things a player of the original would expect to find (with the gameplay spec's corrections, section 2.1):

1. **Areas, then screens.** The world is 7 × 5 areas joined by short loading cards. Each area is a grid of fixed screens (16 × 16 tiles outdoors; dungeon rooms are 16 × 12). The default camera is a low, tilted view that follows the hero; the higher presets and every dungeon room slide one screen at a time.
2. **Everything is voxels, and everything breaks into voxels.** Enemies, grass, bushes, pots and walls burst into bouncing cubes when destroyed.
3. **The sword is the star.** Swords have separate stats (length, width, strength, spin, beam, pierce, special), raised one level at a time at a blacksmith. At full life the sword grows to its full, often screen-spanning size; half a heart of damage drops it to a small blade until life is full again. The thrust is instant; twisting the stick while the blade is out sweeps it round (a spin, with no charge). There are several swords to find, some with special traits.
4. **Guard.** A held button that slows the hero and blocks from the front. Six shield tiers decide which projectiles it stops.
5. **Tools and spells** share one quick slot on the B button, cycled without pausing: boomerang, bombs, bow, grapple, long grapple and fire wand, plus spells paid from a magic row. Candles and lamps are shop consumables. Ammo and bomb counts show on the HUD.
6. **Dungeons** on a room grid, with small keys, one boss key, a map chest and a map that fills in as you explore (no compass), shutter doors that open when a room is cleared, push blocks, floor and wall switches, bombable cracked walls, torches and dark rooms, pits, pots, a boss, a heart container and an orb reward.
7. **Towns and people.** Villagers to talk to, shops, a blacksmith, an inn that sets the respawn point and refills, sidequests and secret caves. Saving is from the pause menu, anywhere.
8. **Progression.** A life row and a magic row (starting life 3 to 5 hearts by class), heart pieces, coins from enemies, bushes and chests, and six orbs from six dungeons as the long-term goal. The first playable milestone ships with one full dungeon.
9. **Controls.** Sword, item, dash, guard, map, inventory and item cycling each have their own button.
10. **Custom hero.** The original lets you build your own hero in a voxel editor. We add a simple editor late on.

## Scope: the smaller world

The compact scope below overrides the gameplay spec's full-size sections (4.1, 5.3, 6.8, 6.9, 10.5).

Trent chose a smaller world (spec Q25, 2026-09-28): fewer, smaller areas and dungeons, so a complete game from title screen to ending lands sooner. Mechanics and look still follow the original 1:1. Where the gameplay spec gives full-size counts (sections 4.1, 5.3, 6.8, 6.9, 10.5), these win:

| | Original (spec) | Ours |
|---|---|---|
| Overworld | 7 × 5 areas of 4 × 4 screens, about 560 screens | 4 × 3 areas of 3 × 3 screens (16 × 16 tiles each), about 108 screens |
| Dungeons | 6 plus a 7-floor tower, about 370 rooms | 4 plus a short tower (2 to 3 rematch floors, then the final), about 100 rooms |
| First dungeon | 20 to 24 rooms | about 16 rooms, same mechanics (4 small keys, boomerang, dark room, colored side room, antechamber) |
| Tool chain | boomerang, bombs, grapple, long grapple, fire wand, swamp boots | boomerang, bombs, grapple, fire wand; 4 orbs open the tower |
| Swords | 12 to 16 | about 8 to 10 |
| Places | castle, 3 villages, 3 inns, lone houses, graveyard, volcano, lost woods | castle, 1 village (shops, smith, inn), a second inn, graveyard, a small lost woods (5 exits), caves |

`TUNING.world.areaScreens` is [3, 3] and `areas` [4, 3] (set in P0; [CONTRACTS.md](CONTRACTS.md) carries the numbers).

## Milestones

| # | Milestone | Contents |
|---|-----------|----------|
| M0 | Prototype (done) | 6 overworld screens, a 4-room crypt, sword, 2 enemy types, key, door, chest |
| M1 | Foundation (done) | Modules with registries, event bus, inventory, dialog, save; deterministic headless play-test harness with screenshots |
| M1.5 | Look, world, contracts (done, v0.3) | The art bible look (materials, lighting, post-processing, 1/8 terrain, 1/16 characters, the dungeon kit); per-area screen sizes, 16 × 12 dungeon rooms, area loads; [CONTRACTS.md](CONTRACTS.md), TUNING, the fixed 60 Hz step and the spec's key layout |
| P0 | Framework alignment | Cameras A and D follow the hero with follow changes, B and C hold and slide (48 ticks); loads of at most 90 ticks with cards; only the current area built; dungeon, large-room and interior cameras from the art bible |
| M2 | The kit and the first slice | hero (movement, thrust, full-life blade, spin, guard, dash, damage), items, overworld and dungeon enemies with the first boss, the dungeon kit and D1, the overworld slice (castle area, village, D1's area), and the ui, one stream at a time or in pairs |
| M3 | Title to the first boss | Merge the streams, fix the seams, and a play-test from the title screen through a new game, the overworld slice and D1 to its boss |
| M4 | The complete game | D2 to D4, the remaining areas, the tower, the final boss and the ending; the effects catalogue, biome palettes and temple themes |
| M5 | Extras | Hero voxel editor, new game+, minigames, music |

The gameplay spec's build order (its section 13, phases P0 to P5) decides what comes first inside these milestones.

M4 now has its second-dungeon stretch: three forest screens, five repeating
woodland forks, fifteen Rootglass Hive rooms and the Amber Queen arena. Bombs,
breaches, three keys, the optional red magic vault, portal, second orb and
rematch are implemented. The Sunreach route and twenty-two-room, two-floor
Buried Watch add grapple crossings, blue vault, powder bag, the colossus,
third orb and Quake. Brineglass Coast and the twenty-five-room, two-floor
Brineglass Temple add the fire wand, paired torch gates, meltable ice, magic
shield vault, thirty-bomb bag, Nacre, fourth orb and Freeze. The hive sage
also teaches Reflect. The Fourfold Tower opens with four active tool anchors, any-order progress,
shot-blocking pedestals and a southern retreat. Partial and earned legacy saves
remain valid. Three memory floors with independent keys/maps/puzzles/rematches,
rest wells, Truesight, the Bastion Shield and Dawn Blade. The final keeper grows
from three to five bodies; personal Truesight reveals its vulnerable body.
The Hollow Crown uses storm, marked lightning and charged-shot patterns. The
ending returns to Mossbrook and saves victory, with King Aldric's homecoming.
This route is implemented and is undergoing full regression and co-op checks.
Broader village quest variety and the rest of M4's catalogue remain to audit;
the existence of an ending does not by itself complete that milestone.

Village errands now include Tobin's physical root cellar and Rook's three-room
Briar Den. Rook's route earns the Hunter Bow, combines two arrow targets into
a bridge crossing, guards the stolen dice behind a shielded enemy, and returns
a permanent quiver plus bombs. These routes replace automatic visit and bush
objectives with places, tools and physical treasure; other village errands and
the remaining M4 catalogue still need their own audit.

The item-get cheer now presents existing native prize models for tools, quest
keepsakes and heart containers. A brief local camera adjustment keeps them below
the phone HUD, and reward captions sit apart from the model. Missing model
metadata still falls back to the existing banner; the remaining reward catalogue
needs its own art audit rather than substituting a generic prize.

## Architecture contracts

Rootglass now has its own six-material floor kit and an abandoned municipal
nursery story. Three bomb-breakable pressure seals control marked hazard lanes;
the second key requires both vented machinery and defeated guards. Partial saves,
old earned keys, guest bomb input and encounter ownership remain supported.
Venting the nursery feeds another patch of the Silent Year garden after the
water engine is repaired. [ROOTGLASS.md](ROOTGLASS.md) records its mechanics and
muted Chromium/Firefox, co-op, touch and visual receipts. The other temples
still need distinct encounters and more of the original era story.

The era route now extends through four authored copperwalk/workshop/archive
screens. Two original quests connect engine repair, pressure tuning, a future
garden and the lost town choir. Real-time encounters guard the repairs and
physical chests. The archive grants a one-time shared magic-capacity upgrade.
Fifteen terrain/prop variants plus valve and memory-chest interactions provide
material variety without a final asset polish pass.

`npm run gauntlet` is the repeatable acceptance run: all scenarios, two extra
critical-case seeds, Firefox checks, recorded voice callbacks and local
Trystero multiplayer. Its world audit validates all registered maps and warp
destinations; its input soak drives 2,880 simulated frames and twelve save
reloads per seed. It checkpoints structured results and hashes screenshots.
Passing these checks does not imply external-network RTC coverage or complete
campaign redesign. Mira now travels with the party and supports real-time
combat; Copper Memory unlocks Clockwork Cross, a charged-spin combination
that spends two magic points. Additional companions, more coordinated
abilities and deeper changes to the four old dungeons remain future work.

- [ARCHITECTURE.md](ARCHITECTURE.md) is the map of the code: the registries (tiles, areas, entities, items, modes, HUD widgets, grants, drops, save fields), the event bus, the test hook `window.__voxelHeroes` and the play-test harness.
- [CONTRACTS.md](CONTRACTS.md) fixes everything the M2 streams share: one owner per file, units, state fields, events, input actions and bindings, the APIs (hero, damage, projectiles, pickups, items and spells, swords, dungeons, shops and menus, music, loading cards, settings, save slots), ids and the reserved regions of the global grid. A stream that needs a change in a file it does not own asks for it in its report instead of editing.

## Process

- Every milestone ends with a Playwright play-test that drives the real build and saves screenshots to `/mnt/project-files/voxel-heroes-shots/<milestone>/`. The playable artifact is republished after each milestone.
- Headless Chromium renders slowly, so tests step the simulation at fixed 1/60 s ticks through `window.__voxelHeroes` rather than waiting in real time.
- Work happens in a local git repo. Parallel features use separate branches and worktrees, and an integration pass merges them. In M2 each stream works on `feat/m2-<stream>`, keeps one scenario in `scripts/scenarios/<stream>.mjs` and saves its screenshots under `/mnt/project-files/voxel-heroes-shots/m2/<stream>/`.
- Each milestone keeps a source ZIP, the playable HTML and screenshot receipts locally. Pushes authorized by Trent publish main through the repository GitHub Pages workflow.


### Clockfair and borrowed-hour story pass (2026-10-01)

Reported town/future bugs are followed by the visible-reward and single-shield
pass in [REWARD-SHIELD.md](REWARD-SHIELD.md). Native NPC grants, the complete
fanfare model catalog, held guard, six tiers, saves, small touch layouts and
remote friend presentation have dedicated muted acceptance cases.

Mossbrook now has The Bells We Borrow, an optional 70-second native pot activity
with blinking targets, committed wind-up notes, occupied-safe clay stands, shared
rounds, independent travel, a one-time party medal reward and saved best times.
The arch is in the open southeast square at (12,10). King Aldric and the three
ending pages now connect the four temple hours to Mira and Caldrin. Responsive
centered panels retain the complete text in short viewports. See CLOCKFAIR.md
for scope, saved-state rules, fixtures and silent acceptance commands. The bank
contains 1,490 compressed Kokoro recordings; no model ships. More town life,
encounter variety, original story integration and art polish remain ongoing.

### Equipment and Undertow road (2026-10-02)

The fourth-temple audit exposed earned blades without a normal selection
screen and Nacre warnings buried by the fine floor. Equipment now handles the
existing Tab, standard gamepad Y and touch Menu actions, with a Pause entry.
Players compare actual current damage/reach, equip an owned blade, retain their
personal choice in co-op and restore it from a save. Nacre has distinct raised
surfacing and committed lunge cues, with physical warning positions preserved
while replica bodies interpolate.

The new native crown journey continues the earned three-temple campaign through
the coast, wand, optional Warden blade, shield, lens, crown and return shortcut.
Its diagnostic failures and corrected walking targets are retained separately
from fresh acceptance. Exact-source layout, native input, local RTC, portable
HTML and image-only slideshow receipts are described in
[EQUIPMENT-UNDERTOW.md](EQUIPMENT-UNDERTOW.md). The fourth boss victory, tower,
additional room art and the broader story/co-op goals remain ongoing.

### Nacre and room architecture (2026-10-02)

Brineglass now uses twelve native floor materials in six room-specific plans.
Charts have a compass inlay, kilns use fired clay and vents, sluices use drained
stone, vaults have quiet ceremonial mosaics, and Undertow has clear slate banks.
The antechamber's physical tidewell restores personal life and magic before
the fourth keeper. Normal co-op rest preserves the other hero's own vitals.
Fresh-title victory and natural-death recovery cases extend the earned crown
through Nacre, its permanent heart, the fourth orb and the return shortcut.
See [NACRE-TIDEWELL.md](NACRE-TIDEWELL.md) for retained failures, fixture scopes
and exact-source receipts. The tower and broader game work remain ongoing.

### Tower memories and crown openings (2026-10-03)

The earned campaign now exercises all three memory rematches and the two final
bosses. Six native floor materials and four room plans distinguish amber, sand,
tide and ash. Iona's first spell can be cast even when earlier sages were skipped;
one violet wisp supplies a normal Truesight charge. Caldrin guards between visible
recovery openings, with a raised committed charge warning. The final south stairs
permit physical retreat to the last well while preserving the broken mask.
See [CROWN-MEMORIES.md](CROWN-MEMORIES.md) for gameplay, fixture disclosures and
silent verification. Native co-op campaign play, broader story/activity variety,
additional encounter work and art polish remain ongoing.
