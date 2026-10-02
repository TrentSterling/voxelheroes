# Coilmaw: a charge the player can read

The first boss now marks its committed dash with two coral chevron rails.
The head holds that heading for a 0.75-second warning, dashes for 0.55 seconds,
then holds still for 0.7 seconds. Its head contact is harmless during that
recovery; guarded body parts still require the glowing tail. The forward
volley clock pauses through the warning, dash and recovery, then resumes
during ordinary circling. The clocks, heading and warning survive a co-op
room ownership change.

Once all six coils are broken, a sword hit on the exposed head cancels a
pending or active charge. The existing knockback and stagger remain. A
native sword swipe, spin or full-health beam can resolve that interruption.
Body guards, punishment rings, tail-heart drops, head health and the first
victory reward retain their existing rules.

The arena uses the barrow's pale, ash, root and copper floors. Its initial
head is three tiles farther south, keeping all six starting coils within
the arena walls. A compact HUD counts coils, then shows the exposed head's
health. Local directions explain the tail and charge; after collecting the
orb, Reward Room directs the player to the southern stairs and home east.

## Evidence and fixture limits

`barrow-victory` extends `barrow-journey` from the title through actual
Coilmaw combat, heart-container collection, the first orb and the reward
stairs back outside. Its controller reads actor positions and writes only
stick and sword input. It never changes boss or hero health, grants gear,
adds invulnerability, teleports, replaces AI, removes actors or calls a
damage API. Existing walking helpers settle exact endpoints within two
ordinary movement steps. The first preserved baseline already won with
the starter hero; this pass improves combat readability and pacing rather
than fixing a proven unwinnable fight.

`coilmaw` isolates the actual warning, sideways movement, recovery and
exposed-head sword interruption. Campaign progress, equipment, teleport
and approaches are fixtures. Removing the body isolates the exposed-head
contract. The charge sidestep itself uses no test damage or invulnerability.

`coilmaw-touch-test.mjs` checks complete phase directions, coil/head labels,
text bounds and overlaps at 320x568 and 568x320, normal and large text.
Actual CDP touch A interrupts the exposed head. Progress, equipment,
positions, hero invulnerability and body removal are layout fixtures.
Captures wait for the ordinary blink cycle and place the layout hero near
the head so a distant serpent is not mistaken for a missing model.

`coilmaw-coop-test.mjs` connects muted Chromium and Firefox through real
local Trystero RTC. A guest inherits the owner's active warning, completes
the committed dash and recovery, fights the exposed head with real sword
input and collects the shared first heart container. The host explores
elsewhere. Placements, starting gear, invulnerability and head-stage body
removal are disclosed fixtures. No direct head damage or forced boss flag
is used. Public signaling and separate-network ICE are outside this audit.

The solo touch camera now uses the existing party framing region to keep
its actual body clear of the HUD and touch pads. The ordinary desktop solo
rig and transition anchors retain their existing rules. A separate fresh
coarse-pointer phone route measures the real hero bounds at boss arrival,
without actor or camera placement fixtures; it does not claim a touch-only
victory.

All browser output is muted; NPC speech is disabled. The baked voice bank
is unchanged. New runs use fresh output folders to preserve failures,
screenshots and game/test hashes.

```powershell
node scripts/gauntlet.mjs --cases=coilmaw,barrow-victory,d1 --seeds=1,17,982451653 --engines=chromium,firefox --scenarios-only --out=playtest-out/coilmaw-native-fresh
node scripts/coilmaw-touch-test.mjs --out=playtest-out/coilmaw-touch-fresh
node scripts/coilmaw-coop-test.mjs --out=playtest-out/coilmaw-coop-fresh
```
