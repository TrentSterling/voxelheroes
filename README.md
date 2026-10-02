# Voxel Heroes

A Three.js voxel action adventure with real-time co-op combat and an original story across eras. Its new direction pairs a tangible voxel world with the color, character-driven adventure and time-travel consequences of classic RPGs.

Sword, boots and other fanfare rewards now show native voxel items above the
hero's raised hands. Guard moves one carried shield forward, including on
co-op friends. See [reward and shield verification](docs/REWARD-SHIELD.md).

The opening era chapter, **The Bell That Rang Tomorrow**, starts with Mira beside
the copper hourgate in Mossbrook Square. Take a sword, visit the First Bloom and
the Silent Year, and repair the past to grow a future garden. Friends can split
across eras and watch those changes happen. Press **L** for the journal.

Follow the eastern copperwalk to the **Singing Workshop** in the First Bloom.
Clear the belt thieves and tune its pressure valve after restoring the square
engine. In the Silent Year, the same route leads to the **Archive of Voices**:
recover the Copper Memory and bring its lost festival choir to Tern. It awards
two permanent magic gems. Cobble, mosaic, brick, glass, drains, rails, reeds,
pipes, benches, lamps and salvage give the two eras different materials.

Choose **Travel with Mira** at the end of her conversation to bring her along.
She follows your route, catches up safely after an era change, and adds wrench
strikes when you fight. Ask her to **Wait in town** to leave her in Mossbrook.
In co-op there is one travelling Mira; she follows the living party leader,
and follows the remaining hero when that leader leaves.

Return the **Copper Memory** to Tern in the Silent Year to hear the recovered
choir, then choose **Travel with Tern**. The brass caretaker travels alongside
Mira; **Tend the garden** sends him home without dismissing her. Recruitment
survives saves and is shared with friends. Both companions follow the living
party leader, including after that player leaves.

Near Tern, hold **Guard** and tap **Sword** for **Bell Shelter**. It spends two
personal magic gems, shelters you and nearby friends for three seconds, and
recharges in eight seconds. Its teal floor ring marks protection from ordinary
blades and shots; hazards and explicitly unblockable attacks still hurt.
The casting input also works with two fingers on the touch Guard/Sword buttons.
Touch dialogue hides the gameplay pad; tap its panel to advance and tap a reply
to choose. Feedback toasts stay above touch controls, with the technique hint
temporarily yielding its space on short landscape screens.

For silent companion acceptance, run `--scenario tern,companion,era-workshop`,
`node scripts/tern-coop-test.mjs`, and
`node scripts/companion-ui-test.mjs --tern`. The last check drives actual
two-finger casting and touch/mouse dialogue choices, measures canvas text and
DOM controls, and preserves all three Tern paragraphs at large text size.

The archive's **Copper Memory** unlocks **Clockwork Cross**. Stay near Mira,
hold the sword button until charged, then release. The combination spends two
magic gems, deals six spin damage in a surrounding pulse, and recharges for
four seconds. Normal charged spins still work when the combination is
unavailable. Friends near Mira can use it too; it never damages other players.

The Old Barrow's **Crossed Bones** now has a copper bell encounter. Its floor
ring warns before four slow projectiles fire; throwing a pot at the bell cancels
that volley and gives four seconds of quiet. Skeletons and a bat guard the first
wave; a shielded warden and ranged gazer reinforce after a short pause. Shutters
and the fourth key wait for both waves. Quiet the bell and open the eastern
**Echo Memory** chest for one permanent magic gem and a note about tomorrow.
The bell remains available after the fight, so the optional reward is retryable.
Six barrow rooms now use cobble, copper rosettes, cracked slabs, repair channels,
clock rubble and bell plinths. The journal's **Read** button (or confirm key)
pages long descriptions while keeping progress, rewards and controls separate.

NPC dialogue and nearby reactions use **baked Kokoro recordings**, with a
consistent voice for each character. The 29-character cast currently has
1,490 Opus clips: about 21.49 MB and 92 minutes of speech. Clips load only
when spoken; no synthesis library or model ships with the game.

Chests now offer **Open chest** on J/Z or touch A, including the Silent Year's
four story vaults. A locked vault explains the repair or encounter it needs.
Old Wick stands beside his Mossbrook Lane pot, and returning pots skip occupied
ground. See [Town placement and future vaults](docs/TOWN-CHESTS.md).

Rootglass's leaf-and-brass Pollinators warn a straight pink dive, then rest for
a counterattack. The optional Pollinator Court west of Three Watchers guards
one permanent heart piece. Petal stones and seed rails add quick floor variety.
See [The nursery's remaining gardeners](docs/NURSERY-WINGS.md).

Enable **NPC voices** in Settings. Page skipping, closing, muting and hiding
the tab stop playback. Long authored pages keep their recording across phone
subtitle screenfuls. Ambient reactions take turns and yield to conversations.
The subtitles retain your chosen name; the recording says "hero". Missing or
unsupported audio leaves working text instead of changing voice engines.

`npm run voices:inventory` extracts the actual authored lines, quest branches,
friendship scenes, gift responses, service prompts and reactions from source.
`npm run voices:bake -- --download-model` records missing or changed lines
in town, Crownhold, eras, wilds and temples batches. For a pilot use
`--batch=town --limit=5`. Development recording uses installed Chrome/WebGPU,
FFmpeg and the pinned `kokoro-js` 1.2.1 browser worker. Its fp32 model download
belongs to the recorder only. Raw takes and checkpoints remain in ignored
`playtest-out/voice-bake/`; `public/voices/` holds only compressed shipped clips.
Voice, speed, engine and codec form stable take IDs, so unchanged clips can be
reused. `node scripts/build-voice-review.mjs` builds a searchable listening page.
`node scripts/voice-bank-audit.mjs` checks full source coverage and decodes every
clip in Firefox and Chromium. A portable artifact embeds the same Opus clips.
`npm run voices:check:assets` checks coverage, hashes and containers without
opening a browser. `npm run test:audio-policy` checks every automated browser
launch, including conditional branches, without playing or generating audio.
Test Chromium launches use `--mute-audio`; Firefox uses a zero output-volume
preference. Game settings remain available for normal play.

```sh
npm install
npm run dev        # play locally at http://localhost:5173
npm run artifact   # build a single self-contained HTML page into dist-artifact/
npm run playtest   # headless play-through with screenshots in playtest-out/
npm run playtest:multiplayer # real Firefox + Chromium Trystero co-op checks
npm run playtest:browsers    # startup with an ad-block filter, plus real party menu controls
npm run gauntlet             # all cases, seed sweeps, Firefox, local co-op, recorded voices
npm run gauntlet:quick       # movement, pots, both era quests/companions, guidance, world audit and input soak
```

The gauntlet creates a new timestamped folder in `playtest-out/`. Its
`index.html` links the screenshots; `result.json` records every case, assertion
count, fixture limitations and screenshot SHA-256 hashes. Results checkpoint
after each case, and the runner continues after failures. Existing receipts
are never overwritten. Use `--out=playtest-out/my-fresh-run`,
`--cases=eras,era-workshop`, `--url=http://127.0.0.1:5173/` or
`--scenarios-only` for a focused run. Local multiplayer tests disable public
ICE and use a local signaling relay. Public, separate-network connectivity
needs its own verification.
`node scripts/companion-coop-test.mjs` checks shared companion presentation,
guest combinations, separate-era exploration and companion handoff using a
local relay with public ICE disabled. `--scenario companion` covers the solo
interaction, follow route, support damage, unlock, magic cost, cooldown, wall
blocking, save/load, dismissal and phone presentation.
`node scripts/companion-ui-test.mjs --out=playtest-out/my-touch-check` measures
the technique panel in desktop and actual touch browser contexts, including
arrival titles, contextual prompts and the ready/empty/recharging states.
The companion slideshow is at `/playtest-out/companion-review/index.html`;
its manifest links focused gameplay, local co-op and final touch receipts.
`node scripts/build-companion-review.mjs` rebuilds that review from the saved
receipts. `node scripts/verify-workshop-review.mjs playtest-out/companion-review`
checks all embedded images, hashes, navigation and three viewport layouts.
`--scenario barrow-echo` checks the bell warning, actual pot input, both waves,
held room-clear rewards, safe reinforcement placement, memory chest and save.
`node scripts/barrow-coop-test.mjs` checks real Firefox/Chromium guest pots,
warning presentation, encounter handoff during reinforcement, split exploration
and one-time shared magic. Position, spawn wait and damage fixtures are disclosed.
`text-layout` checks every journal task, all barrow quest stages and full Read
paragraph coverage at six sizes, including 320 by 568 and 568 by 320.
`--scenario barrow-retry` checks a finished fight saved before key collection,
actual pottery after loading, the late memory reward and a second return.
The barrow slideshow is at `/playtest-out/barrow-review/index.html`, with links
to the current source ZIP, portable build and focused acceptance receipts.
`node scripts/build-barrow-review.mjs` rebuilds it from the saved receipts;
the existing review verifier checks its fourteen images and three layouts.
`node scripts/barrow-journal-input-test.mjs` drives actual mouse, touch and
keyboard events, including the edge between adjacent task buttons and Read
above the touch Pause control. Canvas menu gestures cannot press controls
beneath them. Short title, party and temple-map layouts also fit 568 by 320.
`python scripts/package-source.py playtest-out/my-fresh-delivery` packages the
current source and verifies both ZIP readback and compressed voices embedded
in the previously built portable HTML; it plays no audio.
For a new pass, use `--title`, `--review`, `--regression` and `--coop` to select
the delivery label and receipt folders. The ZIP includes uncommitted sources;
build the portable HTML first so its compressed voice byte checks are current.

To rerun failures without losing passing receipts, use
`npm run gauntlet -- --resume=playtest-out/your-finished-run`. Reuse requires
the same game source fingerprint and unchanged test/helper scripts. Changed
or failed cases run again; results go into a new folder and link the original
run by hash. A change to game source requires a fresh full run.

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
rewards. Select an unfinished task and press **Track** to keep its next step on
the HUD, even while visiting a different era. **Untrack** or **Auto** restores
normal guidance. Tap the HUD's **Quest:** line to open the chosen task; **Next:**
opens the journal with normal guidance at the top.
The choice is personal, survives saving, and is preserved when joining friends;
shared quest completion releases a completed pin. Completed era routes point
back to the hourgate instead of repeating reward or homecoming instructions.
Journal titles and rewards wrap on phones; **Read** preserves long paragraphs.
Tracked HUD instructions can use two portrait rows, with the full goal one tap away.
Nell's gold locket must be revealed by cutting a bush west of the path
at Barrow Crossing, then picked up and brought back for a heart piece. Entering
the crossing alone does not finish the search.

Guidance acceptance: `node scripts/gauntlet.mjs --cases=guidance,journal,eras,era-workshop,text-layout --scenarios-only`,
`node scripts/journal-guidance-input-test.mjs` (actual mouse and coarse touch),
and `node scripts/era-coop-test.mjs --guidance` (local Chromium/Firefox RTC).
These commands mute browser output; the new fixtures also disable NPC voices.

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
