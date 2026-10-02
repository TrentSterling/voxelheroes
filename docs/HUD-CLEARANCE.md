# Forest HUD clearance and silent test output

The forest objective used to wrap across the Party shortcut in 568x320
landscape. The same conflict affected the map and bomb-cache objectives at
Rootglass Mouth. The retained before run checks all three in normal and
large text. Its screenshots demonstrate actual overlapping rectangles.

The HUD now reserves the shared, current Party and Journal geometry as well
as its side widgets. It measures again when a narrower span adds a line,
and places the resulting box inside the free horizontal span. Very narrow
screens retain the existing stack below the side controls. Drawing and
camera composition continue to use the same HUD bounds.

Shortcut geometry reads live party status through a reader supplied by the
party screen. It does not import the multiplayer transport into the early
HUD module. A failed development run exposed that import cycle before this
dependency was removed; its startup error is retained separately.

`forest-hud-layout-test.mjs` checks five viewports, both text settings, three
real objectives and Chromium/Firefox. It records widget/shortcut collisions,
all drawn text bounds, source fingerprints and actual touch/mouse Journal
input. Equipment, story flags, teleport and unrelated enemy removal are
disclosed layout fixtures. This is a HUD delta, separate from the previously
packaged native title-to-bomb-cache journey in NURSERY-CONTROLS.md.

After Trent reported audio during testing, the two current test jobs and
their descendant browsers were explicitly stopped. Their incomplete runs
retain interruption receipts and are not acceptance results. Browser launch
mute settings alone do not establish what was heard at the speakers. Trent
confirmed the noise continued after those browsers stopped, probably from
another game instance. No audio process belonging to his other work was stopped.

The scenario harness and this HUD test now install a second output guard
before navigation. Real-time WebAudio destination connections are dropped;
internal gain buses and offline rendering remain intact. Native media
players stay muted and speech dispatch is suppressed. Game mute and gain
logic still runs. A missing guard aborts the scenario before game input.
These tests do not assess audible voice quality. Other standalone test
drivers still have their independently checked browser mute settings.

Seven VM contracts exercise output isolation without starting a browser or
audio device. Twelve native Chromium/Firefox checks verify the installed
guard on blank documents without playing a game, oscillator or clip.

```powershell
node scripts/test-silent-output.mjs
node scripts/verify-silent-browser.mjs
node scripts/forest-hud-layout-test.mjs --out=playtest-out/my-fresh-hud-run
node scripts/gauntlet.mjs --url=http://127.0.0.1:5173/ --cases=text-layout,party-camera,combat-talk --seeds=17 --engines=chromium,firefox --scenarios-only --out=playtest-out/my-fresh-hud-regression
```

The old Rootglass source packet and 14-slide review remain unchanged.
The new HUD receipt folders preserve before, interrupted and accepted runs
separately. The Chrono-inspired forest art/story pass and a fully native
Amber Queen victory remain outside this change.

Final layout acceptance passes all 310 checks with 60 captures. The existing
text, party-camera and guarded-combat cases pass in both browsers: eight
case/stage results, zero failures, 360 assertions and 214 image receipts.
Source and executed test fingerprints remain unchanged during the run.
Five final photographs wait through the native arrival blink and retain
visible heroes without forcing visibility. All 315 game modules parse.

The compiled portable HTML also passes the guarded-combat fixture in offline
Firefox (three case/stage results, eight assertions). This is a startup and
control check of the new HUD build, not a repeated full native journey.
The four touch retakes also use a real Guard tap to select touch labels;
no input-device value or prompt text is forced by the capture script.

The local Chromium/Firefox co-op rerun passes all 21 contracts on this exact
game source: shared pressure machinery, physical key pickup, separate-era
exploration, owner handoff and save/reload. Its arranged progress, positions,
invulnerability and direct guard-defeat fixtures remain disclosed. It does
not establish public signaling or a native full second-temple victory.
