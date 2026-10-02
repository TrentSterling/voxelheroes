# Stone Eyes

Stone Eyes no longer stop the hero as soon as they acquire a row or column.
A coral floor line and open lid give one second to react. The shot follows
that original direction even when the hero moves. Its magic damage and shield
tier remain unchanged: the starter shield cannot block it; tier three can.
Solid cover prevents acquisition and clips the warning before the wall.

The ordinary boomerang still deals zero damage. Its actual impact cancels the
pending shot and stuns the eye for two seconds. Clay and sword hits cancel it
too. Freezing cancels the warning instead of postponing a stale projectile.
After firing, the eye closes its lid and leaves a 0.7-second counterattack
window before returning to its patrol and cooldown. This is shared enemy
behavior wherever the existing `gazer` appears, including the temple campaign.

The full attack state lives in the existing replicated AI snapshot. Guests
see the same committed cue, can interrupt the owner through normal item
requests, and can finish the warning if its owner retreats. This also removes
the old gaze call that could apply a status to the local hero while the eye
targeted a different party member.

Gazer Walk keeps its three enemies, pillars, clay, chest and entrances. Iris
mosaics and copper borders extend the barrow's local floor kit to eight
materials. The room instruction is short enough to remain complete on touch
screens: "Sidestep or boomerang." Native boxels remain ready for later polish.

Screenshot review caught overlapping arrival titles, hints and tool labels.
Touch hints and floating prompts yield to the arrival banner; compact titles
fit the center lane. The plain item label yields to transient feedback in short
landscape. Physical controls remain usable. Wide journals keep a moving window
of quest buttons above Track, with all entries reachable through the existing
Previous/Next and keyboard controls.

Silent acceptance:

```powershell
node scripts/gauntlet.mjs --cases=stone-eye,foes,d1,d2,d3,d4,tower,barrow-echo,barrow-retry,hero,pots,combat,contracts-m2,world-audit,hit-feedback,text-layout,journal --seeds=17 --engines=chromium,firefox --scenarios-only
node scripts/stone-eye-coop-test.mjs
node scripts/stone-eye-touch-test.mjs
```

The focused combat scenario uses actual movement, item, sword, guard and pot
input. Starter gear, positions, an initial attack cooldown and an isolated
uncrowned eye are fixtures. One missing half-heart isolates sword contact from
the existing full-life beam. Freeze uses the damage API. Co-op uses real local
Trystero RTC with empty ICE servers, controlled placement and one normal-length
handoff warning; separate-network connectivity is not measured. Touch checks
use actual joystick and item-button touch events, normal and large text,
canvas bounds and pairwise text overlaps. These checks do not establish an
unassisted difficulty rating or a complete redesign of every dungeon.

All browser output remains muted. No new NPC text, voice playback, generation
or model download is needed for this combat pass. The current bank contains
1,490 compressed Kokoro recordings.
