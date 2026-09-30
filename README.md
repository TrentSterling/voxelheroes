# Voxel Heroes

A Three.js voxel action adventure in the spirit of 3D Dot Game Heroes and the SNES Zelda overworld.

```sh
npm install
npm run dev        # play locally at http://localhost:5173
npm run artifact   # build a single self-contained HTML page into dist-artifact/
npm run playtest   # headless play-through with screenshots in playtest-out/
npm run playtest:multiplayer # real Firefox + Chromium Trystero co-op checks
npm run playtest:browsers    # startup with an ad-block filter, plus real party menu controls
```

Controls (gameplay spec 7.1; `src/core/input.js` holds the bindings):

| | Keyboard | Gamepad | Touch |
|-|----------|---------|-------|
| Move | WASD or arrows | left stick or d-pad | stick |
| Sword, talk, lift / throw pot (A) | J or Z | A | A |
| Item or spell (B) | K or X (once you own one) | B | B |
| Dash | Space | X | D |
| Guard (hold) | Shift | RB | G |
| Map | M | LB | Map |
| Adventure journal | L | Back / View | Journal |
| Next / previous item | E / Q | RT / LT | |
| Inventory | Tab | Y | Menu |
| Pause | Enter, Esc or P | Start | Pause |
| Mute | N | | |

In menus and dialogs J, Z, Enter and Space confirm; K, X, Esc and Backspace
cancel. Hold A after a sword attack to charge a spin, then release. A tap during
the last 120 ms of recovery queues the next thrust.

Face a nearby pot and press A to lift it, then press A to throw. Carrying allows
movement and room transitions; a hit breaks the held pot. Pots damage and stun
enemies, and can ring the bronze seal in the Old Barrow's entrance to uncover a
heart piece. Action labels appear along the bottom of the game view.

Old Tobin's errand opens a real root cellar in Mossbrook. Bomb the stump beside
him, throw a pot at the bronze seal, collect his keepsake and return it. The
cellar has spare pots for missed throws; those pots give no loot. The chest's
heart piece and quest progress are shared in co-op.

Rook at West Gate sends you into Briar Den for his stolen dice. Cut the
northwest stair-bush, defeat the patrol and take the Hunter Bow. Shoot both
far-bank targets to lower the bridge, then recover the dice from the guarded
vault. Arrow racks let you retry missed shots. Return to Rook for a permanent
thirty-arrow quiver and three bombs. The bow, bridge, dice and permanent reward
are shared with friends; arrows remain personal. The village shop sells arrow
refills once you own the bow. Pots stagger the vault guard, while frontal arrows
hit its shield.

NPC conversations use installed browser voices through `speechSynthesis`.
Turn **NPC voices** on or off in Settings. Speech follows visible dialog pages,
stops when skipped or muted, and uses the Volume and Effects levels. No speech
model or remote service is downloaded. Voice quality and availability depend
on the device; text works even without an installed English voice. Background
town chatter and written signs stay silent. `node scripts/npc-voice-smoke.mjs`
checks native Firefox and Chromium playback callbacks on the running dev server.

Earned tools, quest keepsakes and heart containers show their native voxel model
above the hero during the cheer animation. The camera gives the prize room below
the HUD, with a separate reward caption. Quiet co-op grants leave the other
player's presentation alone. `item-prizes` checks the actual bow chest and the
presentation across five viewports, including dialogue and save/load cleanup.

Start by visiting the king south of Mossbrook for the sword and shield. Tinker
Wyll in town grants the Sprint Boots. The Old Barrow lies west of Mossbrook;
its tablet explains the dungeon's keys and physical puzzles.

After the first orb, head north through Chapel Green into Whisperwood. Read the
carved stone and follow north, west, east, north through the repeating forks.
Rootglass Hive has fifteen rooms, a bomb cache, three small keys, two stone
breaches, an optional magic container and an entrance shortcut. Its Amber Queen
opens her crown between flights; a bomb overturns her for four seconds and
scatters her brood. Bomb supplies in the hive refill an owned bag with A.

After the second orb, go east from Mill Pond and bomb the road stones into
Sunreach Basin. Sandglass Oasis has the second inn. The Buried Watch has
twenty-two rooms across two floors, a grapple cache, broken bridges, an optional
blue heart vault and a hidden powderwright selling twenty-bomb capacity for
200 coins. Hook striped posts or closed chests within six tiles; a hook also
stuns foes without damage. Rook's feet, arms and core open in sequence. Sidestep
its pale lasers, guard its slam waves and stay clear of the high leap. The
third orb's sage teaches Quake, which deals eight nearby damage for three magic.

After the third orb, grapple east across Post Islands to Brineglass Coast.
Brineglass Temple has twenty-five rooms across two floors. Its fire wand melts
ice and lights paired bowls; four small keys cover the main route and an
optional sword vault. A blue vault holds the magic shield, and a bombed seam
hides thirty-bomb capacity. Nacre surfaces on alternating banks, fires ink
that requires a tier-three shield, and dives after each damaging hit. Burning
a tentacle clears it temporarily without damaging the body. The fourth orb's
sage teaches Freeze: four magic holds nearby foes for five seconds and turns
flame walls into breakable ice. The wand also burns the coast's dead trees.
Cyan MP units below life show your spell reserve. The selected spell shows its
cost below the B slot, and that cost turns red when you cannot afford it.
The hive sage teaches Reflect; holding guard returns eligible shots for ten
seconds after casting.

All four orbs open the Fourfold Tower on the coast. Endure the first reflection
for two minutes, then learn Truesight from Sage Iona. Three memory floors have
separate keys and maps, physical puzzles, rest wells and rematches with the
queen, Rook and Nacre. Their rewards include the tier-six Bastion Shield and
Dawn Blade. Truesight spends three magic (two for a focus hero), lasts fifteen
seconds and reveals the real keeper's shadow among its reflections. The Hollow
Crown follows: leave the marked lightning squares, guard ordinary storms with
the Bastion Shield, and dash out of its charged shot. Victory opens the ending,
returns the hero to Mossbrook and saves the completed campaign.

Guards raise their blades and mark a straight lunge before committing. Sidestep
and counterattack during recovery. The red Barrow Warden blocks frontal sword
strikes; flank it, bait a lunge or stagger it with a pot. The dungeon objective
tracks the map, keys, boomerang and four-eye puzzle before the boss.

The adventure journal lists village errands, their progress, locations and
rewards. Nell's gold locket must be revealed by cutting a bush west of the path
at Barrow Crossing, then picked up and brought back for a heart piece. Entering
the crossing alone does not finish the search.

Use **Play with friends** on the title screen, or **Party** during play. Create
a party, then share its code or copy the invite link. Up to eight heroes can
join the adventure; arriving friends start in Mossbrook Square. Heroes have
consistent colors and name labels, share enemies, terrain, dungeon keys,
equipment, permanent rewards and quest milestones, and can explore separate
rooms. Coins and health refills go to the person who claims them. Player bodies
collide; sword hits knock friends back without removing health.

Trystero uses Nostr relays for discovery and WebRTC for game messages. Each
occupied room has one simulation owner, with ownership transferred when heroes
move apart or leave. Joining uses the party host's campaign save. A copy of the
joining browser's previous save is kept at `voxelHeroes:before-party` in
localStorage; leaving continues the party campaign as a solo adventure.

The multiplayer test uses a local Nostr signaling relay and actual browser RTC
data channels. It checks movement, body collision, harmless bonks, guest pot
actions, shared damage and loot, puzzle rewards, mixed-player wall switches,
independent exploration, multipart bosses, room handoff and rejoining after
host migration, shared guard cues, shield flanks, the physical locket search,
the hive breaches and the queen's bomb counter, grapple crossings and stuns,
shared bomb-bag capacity, colossus state through room handoffs, paired fire
bowls, persistent ice melting, Nacre and its regrowing tentacles, Freeze,
personal Truesight, shared reflections and the final boss through room handoffs.
Screenshots and machine-readable receipts are saved in
`playtest-out/multiplayer/`. Run the full gameplay suite and these browser
checks, then `npm run review` to assemble a standalone screenshot slideshow.
`npm run review:check` loads every embedded image, checks receipt hashes and
exercises slide selection, keyboard navigation and the phone layout.
`node scripts/public-party-smoke.mjs` checks the shipped public relay and ICE
configuration with two local browsers. Separate networks are not covered.
Reviews retain a failed full-run log when a later focused recheck resolves it;
the manifest lists the passing coverage and hashes each recheck receipt.
The local development server streams the embedded slideshow directly at
`/playtest-out/review/voxel-heroes-review.html`; it can also be opened as a file.

The returning boomerang module deliberately avoids the filename `boomerang.js`:
EasyPrivacy includes a generic rule with that name, which can block a game's
module import and leave the page blank in browsers with an ad blocker enabled.

Run every gameplay regression with `node scripts/playtest.mjs --scenario all`.
The `pots`, `responsiveness` and `rewards` scenarios cover carrying, throwing,
safe arrivals after save/load, sword buffering and collectible boss rewards.
The `adventure`, `errands` and `journal` scenarios cover guard attack timing,
the first dungeon, searching and returning the locket, saved quest progress,
and the journal's keyboard, canvas and mobile controls.
The `tower` scenario checks the four-orb doorway, three floors, spell cost and
expiry, both final stages, the desktop and phone ending, and saved homecoming.
Its captions distinguish real inputs from earlier progression and controlled
combat fixtures.
The `text-layout` scenario measures the actual canvas text and panel bounds at
five desktop and phone sizes. It covers saved-game controls, party entry and
roster, settings pages, both map types, every journal entry, banners and the
ending. Large dialogs paginate without losing their text or final choices.

## Layout

The code is split into small modules with registries for tiles, areas,
entities, items, HUD widgets and UI screens, so most additions are new files.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, every
registry's contract, worked examples, the `window.__voxelHeroes` test hook and
the play-test harness. [docs/CONTRACTS.md](docs/CONTRACTS.md) has the M2
contracts: who owns which file, shared state, events, input and the APIs the
parallel streams build on. [docs/PLAN.md](docs/PLAN.md) has the milestone plan.
