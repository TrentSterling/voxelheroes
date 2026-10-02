# Four Borrowed Hours

The main campaign tower now begins with an active room instead of a two-minute
survival wait. Its keeper cannot be killed. Free four physical anchors with the
tools learned in the four temples: Return (boomerang, west), Break (placed bomb,
east), Draw (grapple, southwest) and Kindle (fire wand, southeast). Any order
works, and friends can split the jobs.

Anchor pedestals block enemy shots. Each released hour scatters the pending
enemy volley and briefly hides the reflections. The three initial bodies become
two after two anchors; the fourth anchor clears the encounter. Trial shots use shield tier two;
other keeper and Hollow Crown shots retain their previous tiers. The southern
powder supply refills bombs. The south exit stays open, so players can retreat
or explore independently; the northern memory stair requires all four hours.

Each anchor has two original story paragraphs from Sage Iona. The city clock
connects the barrow, nursery, watch and shore to the broken-hour story. Its four
native hands begin moving as the corresponding anchors are freed. Four new
floor materials distinguish slate seams, hour rings, copper winding channels
and plum mosaics. All assets are original code-built boxels, with placeholder
polish. Combat remains real time.

Four Borrowed Hours appears in the journal, can be tracked personally, and
advances to the next unsolved tool. The HUD reports anchor progress rather than
an obsolete countdown. Saved `tower:clock:<id>` flags preserve partial progress.
Existing saves with `tower:trial` remain complete without solving the new room.
The normal shared trial defeat opens the north stair without a new heart reward.

Ordinary tile hooks and room authority share native tool collisions. The grapple
now invokes an existing grapple tile's shot hook before latching, allowing its
zero-damage hit to tune Draw and pull the same hero. Tiles without a shot hook
retain their latch behavior. Local Chromium/Firefox co-op checks cover a host
retreat, guest-owned continuation, reunion, guest completion, independent north
travel, personal pins, host departure and saved completion.

Eleven Iona recordings are generated with Kokoro, reusing 1,459 exact current
recordings. The current bank contains 1,470 Opus clips, about 20.82 MB. No model
or raw WAVs ship. Generation and container/hash coverage are checked silently;
these checks do not claim human listening or renewed PCM-decode coverage.

Repeatable silent acceptance:

```powershell
node scripts/gauntlet.mjs --scenarios-only --cases=tower-clock,tower --engines=chromium,firefox --seeds=17
node scripts/clock-coop-test.mjs --url=http://127.0.0.1:5173/
node scripts/clock-layout-test.mjs --url=http://127.0.0.1:5173/
node scripts/voice-bank-audit.mjs --static-only
```

The focused solo route uses real movement and tool input, natural projectiles,
held guard, cover, supply interaction, physical retreat/return, north stair and
saves. Earlier milestones, gear, invulnerability outside the pressure checks,
initial positions and controlled native attack timing are fixtures. It verifies
that 121 simulated seconds do not open the stair, a weak shield takes damage,
wrong tools do not progress, partial saves resume and earned legacy saves work.
The full tower route exercises the subsequent campaign but uses disclosed
room kills and boss windows; it is not an unassisted difficulty playthrough.

The layout driver measures all ten new paragraphs, five journal states and
four play HUD states at normal/large text sizes on desktop, 320px portrait and
568x320 landscape. Enemy removal and flags isolate layout; paragraph paging,
Track and Close use native mouse/touch actions. Co-op uses real local Trystero
RTC with empty ICE servers. Public signaling, separate-network ICE, mobile
hardware performance and real player difficulty evaluation remain untested.

This changes the tower opening, not the three memory floors or final boss
story. More campaign encounter variety, town activities, story and art polish
remain part of the larger work. Review and delivery folders retain immutable
native screenshots, source hashes, test receipts, source ZIP and portable HTML.

Native visual review also caught a portable-only text bug: the packer omitted
UTF-8, so local files could render dialogue arrows as several garbled letters.
The portable now begins with the charset declaration. The encoding driver
checks real native down and selected-choice arrows in muted Chromium/Firefox.
Its optional `--before=path` proves the corrected file adds only that declaration
to a previously tested artifact. It works without earlier receipt folders:

```powershell
npm run artifact
node scripts/portable-encoding-test.mjs
```
