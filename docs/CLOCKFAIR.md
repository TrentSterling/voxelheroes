# Mossbrook Clockfair

The Bells We Borrow is an optional town activity, reached through the brass arch
in the open southeast of Mossbrook Square (12,10). Read Tinker Wyll's board,
choose to begin, lift practice clay with A and throw with A again. Six bells must
ring within 70 seconds. Each lamp blinks in place until struck, then the next
bell takes the light. A dark bell or another weapon cannot score.

The machine locks its aim during a visible wind-up, then fires ordinary tier-one
projectiles. Sidestep or face it with the king's starter shield. Its notes deal
real damage. Four southern clay stands refill when vacant; living players,
friends, companions and solid bodies keep an occupied stand empty. Practice clay
never drops loot, including when a guest lifts it or carries it out of the fair.

Friends share a round and may leave or return independently. The ordinary room
owner simulates its timer, lights and projectiles; entity AI snapshots preserve
an attempt during ownership transfer. Stable tile-claim authority serializes
simultaneous board choices. The first medal pays 60 coins to each party member,
including a friend in another screen. Repeats improve a saved best time without
another payment. Completion releases a fair journal pin without replacing a
friend's personal objective. Reloading a solo save returns an unfinished round
to the board; the medal, first reward and record stay earned.

Native boxels provide a bell frame, machine, board and arch. Four floor patterns
distinguish confetti, wooden clay stands, brass lanes and chevrons. The earned
medal lights six marks on the town arch. These are original placeholder assets
for a later polish pass, with no raster art or new runtime dependency.

King Aldric's initial talk, temple progression and homecoming now connect Mira's
thirteenth bell to the four borrowed temple hours and Caldrin's perfect morning.
Three original ending pages carry the story back to Mossbrook. The first talk
still grants the starter blade and shield; optional fair progress never gates
the main adventure. Centered panels reduce title size and spacing when necessary
to fit a short viewport while retaining their complete message.
Ending and game-over panels hide the touch pad, then restore it on returning
to play. Native death, Try again and all three ending pages are checked too.

Thirty new fair and king lines were baked silently with Kokoro, reusing 1,460
verified current takes. The bank now contains 1,490 Opus clips, about 21.49 MB.
No model or raw WAVs ship. Static inventory, container, byte and hash checks do
not claim listening quality or a new PCM decode audit.

Repeatable silent acceptance:

```powershell
node scripts/gauntlet.mjs --scenarios-only --cases=clockfair,campaign-story,tower,world-audit --engines=chromium,firefox --seeds=17
node scripts/fair-coop-test.mjs --url=http://127.0.0.1:5173/
node scripts/fair-layout-test.mjs --url=http://127.0.0.1:5173/
node scripts/voice-bank-audit.mjs --static-only
```

The solo fair scenario walks the arch, reads actual choices, lifts and throws
real pots, waits for ordinary blinking, wins twice under the unchanged timer,
checks timeout, guard, dodge and damage, and saves/reloads. Gear, invulnerability
outside isolated pressure checks, positions and selected light/attack clocks
are fixtures. The story scenario uses native A talks and confirm paging; earlier
temple milestones and removal of ending enemies isolate dialogue and return.

Co-op uses muted Chromium and Firefox over real local Trystero RTC with empty
ICE servers. Placements, invulnerability, lit targets and timer resets isolate
transport. It covers start races, remote occupied stands, guest throws, host
exit, transferred attacks, reunion, offscreen rewards, repeat payments, ordinary
guest-pot permission and the remaining friend's save. Public signaling and
separate-network connectivity are outside this local check.

Layout checks cover every fair-board and armed-king paragraph, all three ending
pages, four journal states and four HUD states on desktop, 320px portrait and
568x320 landscape at normal and large text sizes. Native mouse/touch paging,
choices, Track, Close and ending buttons are exercised; text, panels and journal
controls are measured. Mobile hardware performance and unassisted difficulty
evaluation remain outstanding. Fresh slideshow images and the delivery packet
retain hashes, receipts, source ZIP and portable UTF-8 HTML.

This adds one optional activity and advances the campaign story. Additional town
life, encounters, story integration and visual polish remain ongoing work.
