# Party travel and readable hits

The October 1 movement audit reproduced Mara stopping on the opposite side of a
wall and companions bunching during travel. Followers now measure the route
around terrain instead of stopping at the straight-line distance through a wall.
Safe shortcuts and a bounded local route repair reconnect a party after a turn
or a changed tile. Placement checks the whole body, hazards, warp tiles, solid
entities and a clear route to the leader. Teleports, warps and reloads replace
old trails; continuous outdoor room edges preserve them.

Mira follows at 1.4 tiles, Tern at 2.4 and Mara at 3.4. Settled followers separate
on safe ground and stop their walking poses. Moving companions can pass each
other when the hero reverses; they remain non-solid to heroes. Mara's technique
partner range is now four tiles so the third follower can cast with the leader.
Mira's 2.8-tile and Tern's 3.2-tile combination ranges retain their existing values.
The local repair searches at most 512 cells, at most once per 0.6 seconds per
follower. A follower more than ten tiles behind uses the existing safe regroup.
This is a local follower system, not general NPC navigation or rigid crowd physics.

Enemy hit feedback now uses a warm, limited glow that fades through the original
0.3-second timer. The old full-white emission obscured ice-shell opening poses
until the timer ended. Damage, stagger and boss hit immunity keep their timings;
the flash clamps to zero and fades in real time even during a slowed long stun.
The serpent's independently updated segments share the same visual helper and
restore their native tail glow. No new audio or model downloads are required.

`party-travel-audit.mjs` keeps raw before/after frame measurements and screenshots.
`scenarios/party-travel.mjs` checks both wall turns, a one-tile corridor, a changed
route, idle settling, safe continuous movement, teleport, reload and a real room
edge. It measures spacing after settling; moving followers may temporarily cross.
`scenarios/hit-feedback.mjs` checks real wand and Steamwheel controls, readable
native opening poses, fading during stun, slow, repeat hits, guards, boss timing,
phone captures and reload. Terrain, recruitment and stationary combat AI are
disclosed fixtures. Boss timer boundaries use the normal damage pipeline.

All browser output is muted. Existing Kokoro recordings are not replayed or
decoded for this pass. Tests establish runtime behavior, not enjoyment or audible
voice quality. Local RTC tests do not establish separate-network connectivity.
Fresh slides and portable/source packets are retained in `playtest-out/` with
source and image hashes. Trent publishes the public site separately.

## October 1 verification receipts

Game source SHA-256:
`e3f0c827474ca4c6fafc4ec1bc38ab6a6a87f27f18b01ed3970ebb418c779089`.

- `party-regression-release2-20261001`: 33 Chromium scenarios, 1,999 gameplay
  assertions, 372 images. All four dungeons, the tower, combat contracts, world
  audit, saves, quests, eras, companions and mixed-input soak pass.
- `party-firefox-release2-20261001`: 20 cases on two seeds, 1,010 gameplay
  assertions, 186 images, including all four dungeons and the new scenarios.
- `party-portable-release2-20261001`: both browsers run travel and hit feedback
  in the standalone HTML, 98 gameplay assertions and 24 images.
- `party-coop-release2-20261001`: 23 local RTC checks including guest Steamwheel,
  shared warm emission, independent eras, harmless bonks and leader transfer.
- `party-layout-release1-20261001`: 117 actual input and layout checks,
  126 measured captures across desktop, portrait, landscape and both text sizes.
- `party-audit-release1-20261001`: 18 before/after checks and raw frame data;
  `party-baseline-20261001` retains the original wall and full-white flash.
- `party-retakes-release2-20261001`: freshly drawn portable captures, actual
  three-magic cast and both eight-damage openings, with artifact and image hashes.
- `party-syntax-20261001`: all 293 game JavaScript modules parse.

Final game assertions total 3,107; launch-policy checks are counted separately.
Changed scenarios were rerun; passing cases reused the identical game source,
unchanged scenario scripts and unchanged executed helpers. Earlier failed test
receipts remain intact. An invalid `itemprizes` selector was corrected to
`item-prizes`; the gauntlet now rejects unknown selectors before running cases.
Mobile captures now wait for canvas resize before drawing a manual test frame.
This fixes test capture timing, not a live gameplay rendering defect.

The current camera frames the hero. Some rear followers remain occluded by
hedges or HUD panels in certain orientations; group camera composition needs
another pass. The movement checks establish safe positions and settled poses,
not visibility of every model from every angle.
