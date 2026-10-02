# Visible rewards and one shield

Reported problems: the hero raised empty hands when receiving a sword or
Sprint Boots; guarding showed a carried shield and another raised shield.
The preserved baseline records 35 fanfare grants without models, and 72
baked shield voxels plus an attached guard shield on the original hero.

Every native fanfare grant now has nonempty reward geometry. The missing
catalog receives original voxel swords, paired boots, tiered shields, rings,
spell books, keys, maps, orbs, powder bags, magic jars, heart pieces and tokens.
Existing tool and story models are reused. Unknown extension grants retain
their explicit metadata contract; the catalog test catches future gaps.

Rewards settle above raised hands, turn gently and have two small brass glints.
Small props scale to a readable silhouette. The pose lasts 1.65 seconds of
play and holds during dialogue so reading cannot make the item disappear.
Camera headroom and reward captions use the actual prize bounds. Leaving a
screen or resetting clears the presentation without disposing shared models.
Short landscape caps reserved header height so the hero's feet remain visible;
a side column keeps captions on screen when space above and below is occupied.

The player and co-op friend rigs have no baked shield. One separate mesh
rests at the off hand, moves forward when guarding, and returns when released.
It changes geometry for the owned tier; it is put away during reward/carry
poses and absent before obtaining gear. Friend pose messages include shield
tier and guard state. Removing a baked shield from a model now copies its
parsed voxel grid first, preserving other rigs that use the same source.

`reward-shield` drives actual King Aldric and Tinker Wyll conversations,
checks the loaded fanfare catalog, captures isolated grants, holds guard,
changes tiers and verifies saved equipment. Catalog grants, safe positions and
unrelated courtyard enemy removal are fixtures. `hero`, `contracts-m2` and `adventure` retain independent combat
and directional blocking checks.

`scripts/reward-shield-touch-test.mjs` measures reward and caption framing on
320x568 and 568x320 screens at both text sizes, then drives real touch guard
input. `scripts/reward-shield-coop-test.mjs` uses muted Chromium and Firefox
over local Trystero RTC, verifies one remote shield and confirms shared grants
do not interrupt the other hero. Public signaling is outside these checks.
All tests mute browser output and disable NPC speech; no listening is used.
