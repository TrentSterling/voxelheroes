# The Last Departure

An optional original Tern chapter south of the Copperwalk in both eras. Combat
stays real time. This extends the garden and archive story; the larger temple
campaign rewrite remains unfinished.

Meet Tern on his first day in the First Bloom station. Repair the square engine
and Singing Workshop, defeat two station thieves, then tune the station signal.
The Last Platform in the Silent Year gains a six-tile crossing and four lit
signals. A friend already exploring that future sees the repair in place.

The Waiting Bell Courier guards its passenger tag. Its closed front blocks
swords, spins, arrows and dashes, while flanking works. Three marked lanes warn
before a committed fan of notes; the shutters open after the volley. Below half
health the warning and recovery shorten. A grapple opens the shutters without
damage; pottery or fire interrupts the call. Ordinary shields and nearby Bell
Shelter block its notes. The courier and its projectiles use ordinary shared
actors, including transfer between occupied-screen simulation owners.

After the fight, physically cross the restored platform and open the departure
chest. Answer the northern signal with its tag. The affirmative conversation
choice grants one permanent magic gem to each party member and places three
decorative station lights in present-day Mossbrook. Declining keeps the story
unfinished. Travelling Tern answers the station conversation too, and his
first-day self remains available in the past.

Shared story claims use the tile `onClaim` hook. Its authority follows the
lowest-rank living occupant independently of dialogue modes. Combat simulation
still follows an available player. This prevents simultaneous conversation
choices from temporarily electing two reward owners as both panels close.
The authority saves the claimed flag before sending the ordinary grant; its
nested magic-container reward is shared through the existing grant transport.
Ordinary sword hits cannot claim a story reward. Claims, defeat flags, bridge,
lights, tag and permanent magic survive reload.

Four native floor materials distinguish station boards, platform edges, ticket
mosaics and signal grates. Signals, benches, tag, courier and warning marks are
original code-built boxels. This is a compact content pass with placeholder art,
not a long asset polish pass.
Low station border rails retain the tile collision boundary while keeping
heroes visible on the lower platform; taller ruin columns remain elsewhere.
Technique feedback temporarily replaces the companion status panel on every
screen size, so its toast cannot cover the active Shelter or cooldown text.
The status returns after the feedback fades. Native Guard and Sword inputs
verify both states on desktop, portrait and short landscape at both text sizes.

Fifteen new Tern recordings were baked with Kokoro. The complete current bank
has 1,460 compressed Opus clips, about 20.4 MB. `--reuse-bank` imports only
matching inventory keys, voices, paths, byte counts and hashes, so later batches
generate only missing lines. No inference model or raw WAVs ship. New recordings
were generated and container/hash checked without speaker playback.

Repeatable silent acceptance:

```powershell
node scripts/gauntlet.mjs --scenarios-only --cases=departure --engines=chromium,firefox --seeds=17
node scripts/departure-coop-test.mjs --url=http://127.0.0.1:5173/
node scripts/departure-layout-test.mjs --url=http://127.0.0.1:5173/
node scripts/voice-bank-audit.mjs --static-only
```

The solo case uses actual edge travel, two past kills, courier controls, bridge
travel, chest, both choices, repeat conversation and saves. Positions, gear,
milestone flags and isolated courier HP/clock resets are disclosed fixtures.
The co-op driver uses muted Chromium and Firefox over real local Trystero RTC;
its guard/courier kills are fixtures to isolate causality, transferred native
attacks, guest grapple and simultaneous choices. The layout driver checks every
authored paragraph, both choices, all five journal stages and reward captions
with actual mouse/touch input on desktop, portrait and short landscape at both
text sizes. Public connectivity and subjective enjoyment are not measured.

Local delivery and the new screenshot deck live under `playtest-out`. The
delivery packet preserves its own source ZIP and portable HTML with verified
compressed voice bytes. The public site is unchanged by this local pass.
