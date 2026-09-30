// Package real screenshots, measurements and test receipts into a portable review.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const readText = (path) => {
  const bytes = readFileSync(path);
  return bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le').replace(/^\uFEFF/, '') : bytes.toString('utf8');
};
const result = JSON.parse(readText('playtest-out/multiplayer/result.json'));
const gameplay = readText('playtest-out/gameplay-final.log');
const browsers = readText('playtest-out/browser-final.log');
const development = readText('playtest-out/browser-dev.log');
const publicParty = JSON.parse(readText('playtest-out/public-party/result.json'));
const publicPartyRerun=JSON.parse(readText('playtest-out/public-party-rerun-blocked.json'));
const npcVoicesPath='playtest-out/npc-native-voices-rook/result.json';
const npcVoices=JSON.parse(readText(npcVoicesPath));
assert.ok(npcVoices.browsers.length===2&&npcVoices.browsers.every(b=>b.errors.length===0),'Check native speech in both browser engines');
const npcVoicesReceipt={path:npcVoicesPath,sha256:createHash('sha256').update(readFileSync(npcVoicesPath)).digest('hex'),...npcVoices};
assert.equal(publicParty.passed, true, 'Check the shipped public relay configuration before building the review');
assert.equal(result.failed, 0);
assert.equal(result.pending,false,'The co-op run must have completed successfully');
assert.ok(result.passed >= 51);
const gameplaySummary = gameplay.match(/^(\d+)\/(\d+) scenarios passed\s*$/m);
const scenarios = readdirSync('scripts/scenarios').filter(path => path.endsWith('.mjs')).map(path => path.slice(0,-4));
const scenarioCount = scenarios.length;
assert.ok(gameplaySummary && Number(gameplaySummary[2]) <= scenarioCount, 'A full regression receipt is required');
const verified = new Set([...gameplay.matchAll(/^PASS ([\w-]+) /gm)].map(match => match[1]));
const failed = [...gameplay.matchAll(/^FAIL ([\w-]+):/gm)].map(match => match[1]);
const rechecks = [];
// The previous complete suite predates the native prize presentation. The
// changed camera, pose, reward routes and text have one later targeted run;
// it also supplies the new scenario. Require every current scenario below.
for (const name of ['item-prizes','hero','camera','rewards','rook-den','sidequests','text-layout']) {
  const path='playtest-out/item-prizes-final.log', log=readText(path), summary=log.match(/^(\d+)\/(\d+) scenarios passed\s*$/m);
  assert.ok(statSync(path).mtimeMs>=statSync('playtest-out/gameplay-final.log').mtimeMs);
  assert.ok(summary&&summary[1]===summary[2]&&new RegExp(`^PASS ${name} `,'m').test(log)&&!/^FAIL /m.test(log),`Final ${name} check did not pass`);
  verified.add(name);
  rechecks.push({scenario:name,path,reason:'Native prize models, HUD clearance, camera restoration and existing reward routes',checkedUtc:statSync(path).mtime.toISOString(),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
for (const name of [...new Set(failed)]) {
  const path = `playtest-out/${name}-final.log`;
  assert.ok(existsSync(path), `Recheck failed scenario ${name} before building the review`);
  assert.ok(statSync(path).mtimeMs >= statSync('playtest-out/gameplay-final.log').mtimeMs, `${name} recheck must follow the completed full run`);
  const log = readText(path), summary = log.match(/^(\d+)\/(\d+) scenarios passed\s*$/m);
  assert.ok(summary && summary[1] === summary[2] && new RegExp(`^PASS ${name} `,'m').test(log) && !/^FAIL /m.test(log), `${name} recheck did not pass`);
  verified.add(name);
  rechecks.push({ scenario: name, path, checkedUtc: statSync(path).mtime.toISOString(), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
}
// Visual inspection after the full run found a narrow-screen HUD collision.
// Verify the changed layout and actual UI controls on the final rebuilt artifact.
for(const name of['text-layout','ui']){
  const path=`playtest-out/${name}-rook-check.log`,log=readText(path);
  assert.ok(statSync(path).mtimeMs>=statSync('playtest-out/gameplay-final.log').mtimeMs);
  assert.ok(/^1\/1 scenarios passed\s*$/m.test(log)&&new RegExp(`^PASS ${name} `,'m').test(log)&&!/^FAIL /m.test(log),`Final ${name} check did not pass`);
  rechecks.push({scenario:name,path,reason:'Phone HUD spacing below shortcuts, then reward headlines below the entire header',checkedUtc:statSync(path).mtime.toISOString(),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
assert.ok(scenarios.every(name => verified.has(name)), 'Every current scenario needs a passing receipt');
for(const name of ['item-prizes','text-layout']){
  const path='playtest-out/item-prizes-caption-final.log',log=readText(path);
  assert.ok(statSync(path).mtimeMs>=statSync('playtest-out/item-prizes-final.log').mtimeMs);
  assert.ok(/^2\/2 scenarios passed\s*$/m.test(log)&&new RegExp(`^PASS ${name} `,'m').test(log)&&!/^FAIL /m.test(log),`Final caption ${name} check did not pass`);
  rechecks.push({scenario:name,path,reason:'Final caption placement avoids projected prize bounds in the closer town camera',checkedUtc:statSync(path).mtime.toISOString(),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
assert.ok(verified.has('tower'),'The current full suite must verify the tower and ending');
{
  const path='playtest-out/item-prizes-release.log',log=readText(path);
  assert.ok(/^1\/1 scenarios passed\s*$/m.test(log)&&/^PASS item-prizes /m.test(log)&&!/^FAIL /m.test(log),'Final clear-path presentation check did not pass');
  rechecks.push({scenario:'item-prizes',path,reason:'Final town capture positions the hero on clear central paving',checkedUtc:statSync(path).mtime.toISOString(),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
const gameplayReceipt = `${scenarioCount}/${scenarioCount} scenarios verified${rechecks.length ? ' (full run plus focused rechecks)' : ''}`;
assert.equal((browsers.match(/^PASS /gm) || []).length, 4, 'Complete both standalone browser checks first');
assert.equal((development.match(/^PASS /gm) || []).length, 4, 'Verify the actual development server in both browser engines');
const receipts = JSON.parse(readText('playtest-out/multiplayer/receipts.json'));
const slides = receipts.map((receipt) => ({ ...receipt, path: `playtest-out/multiplayer/${receipt.image}` }));
const before = 'C:/Users/trent/Pictures/TrontSnap/TrontSnap_2026-09-29_18-36-44.png';
if (existsSync(before)) slides.unshift({ path: before, caption: 'The reported Firefox white screen',
  evidence: 'User screenshot: Firefox failed to load the boomerang module. Blocking that filename reproduced the blank page in both browser engines.' });
slides.splice(existsSync(before) ? 1 : 0, 0, { path: 'playtest-out/browser-smoke/firefox-after.png', caption: 'Firefox starts again',
  evidence: 'Startup passes with the EasyPrivacy filename filter enabled. The returning boomerang remains registered; no JavaScript page errors.' });
if (existsSync('playtest-out/final/pots/03-safe-load.png')) slides.push({ path: 'playtest-out/final/pots/03-safe-load.png',
  caption: 'Clear arrivals after save and load', evidence: 'The pot regrows at the saved position; loading moves the hero to clear floor. The pot, movement, and reward regression scenarios pass.' });
const adventureSlides = [
  ['adventure/01-guard-windup.png', 'A blade raised before the lunge', 'The guard remains stationary and harmless during its wind-up. A raised blade and gold floor marks show the committed attack line.'],
  ['adventure/02-guard-missed.png', 'Sidestep, then counterattack', 'Real movement evades the lunge without losing health. The guard stays on its committed line and enters a recovery window; a real sword counter lands there.'],
  ['adventure/03-warden-front.png', 'A shield changes the fight', 'A frontal sword strike is blocked. A strike from behind lands, and a thrown-pot damage source interrupts the wind-up. Holding the hero’s shield also blocks a guard lunge.'],
  ['adventure/04-turning-room.png', 'The Turning Room encounter', 'A guard, shielded warden and bat share the room with four pots and cover. The shutters remain closed until the encounter clears. The real first-dungeon playthrough passes.'],
  ['errands/errands-03-locket-revealed.png', 'A find you can actually pick up', 'Cutting the crossing bush reveals Nell’s gold leaf locket. Entering the area alone does not find it. The unclaimed object survives a return visit, and the collected find survives save/load.'],
  ['journal/01-journal-desktop.png', 'Keep the next task visible', 'The journal shows the current dungeon objective and village errands with locations, progress and rewards. A found locket is ready to return for a heart piece. Keyboard and canvas controls pass.'],
  ['journal/02-journal-phone.png', 'The journal on a phone', 'The task view wraps to a single column in portrait. Paging and close controls are reachable in portrait and landscape, and saved task progress restores after load.'],
];
slides.push(...adventureSlides.map(([path, caption, evidence]) => ({ path: `playtest-out/final/${path}`, caption, evidence })));
const hiveSlides = [
  ['01-whisperwood', 'North from the town hub', 'A real walk from Chapel Green enters the moss-green forest, then crosses Mothwater to the carved stone.'],
  ['02-carved-stone', 'A route you can learn', 'The carved stone gives north, west, east, north. A wrong turn returns to the first clearing; the southwest path leads home.'],
  ['03-amber-gate', 'Find the hidden hive', 'Four correct physical exits reach Amber Gate and the second dungeon. Friends can explore the forks separately.'],
  ['04-hive-mouth', 'Rootglass Hive', 'Fifteen authored rooms use the moss palette. The objective follows the map, powder cache, breaches, keys and queen.'],
  ['05-hive-map', 'Map the next adventure', 'The real map chest reveals all fifteen rooms, including the optional red vault and separate reward chamber.'],
  ['06-counterweight', 'A physical counterweight', 'Real movement pushes the block onto its plate and opens the treasury shutter. The puzzle and opened chest persist.'],
  ['07-powder-cache', 'Earn the bomb bag', 'A lock-in encounter reveals the cache. The route test resolves its enemies through the damage API; chest pickup and subsequent bomb input are real.'],
  ['08-breached-gallery', 'Bombs change the route', 'Two real B-input bombs open persistent passages to the eastern key rooms. Three earned small keys open the upper hive.'],
  ['09-queen-flight', 'Vespera and her brood', 'The queen flies a figure eight, rests with an open crown, and fires three four-shot volleys. Eight distinct drones replicate in co-op.'],
  ['10-queen-bomb-counter', 'A clear counter window', 'A real planted bomb deals six damage, overturns the crown for four seconds and scatters the brood. Real sword input then lands.'],
  ['11-second-orb', 'A second campaign reward', 'The boss kill uses the damage API. Its heart pickup permanently increases life; the second orb, bombs and opened routes survive save/load. Rematches give no second heart.'],
];
slides.push(...hiveSlides.map(([file, caption, evidence]) => ({ path: `playtest-out/final/d2/${file}.png`, caption, evidence })));
const watchSlides = [
  ['01-desert-road', 'East into Sunreach', 'A physical exit from Mill Pond reaches the desert road. Real bomb input removes both fallen stones without warping the hero. Earlier campaign milestones use fixtures.'],
  ['02-oasis-inn', 'A second place to rest', 'The oasis inn restores life and sets a desert respawn. The route continues north across the dry river and east to the buried temple.'],
  ['03-watch-entrance', 'The Buried Watch', 'Twenty-two authored rooms across two floors add keyed patrols, a counterweight, a grapple cache, optional vaults, broken bridges and a separate boss court.'],
  ['04-two-floor-map', 'Read both floors', 'Opening the real map chest reveals the lower and upper watch. Floor-qualified room flags keep the two locks independent.'],
  ['05-grapple-cache', 'Earn the next tool', 'Two keys come from the patrol and a real pushed counterweight. The eastern door consumes one key for both leaves; the cleared cache grants the grapple. Room kills use fixtures.'],
  ['06a-grapple-in-flight', 'The chain carries you across', 'Real grapple input catches a striped post within six tiles and pulls the hero over water. The test checks the far-bank landing and the return crossing.'],
  ['07-powderwright', 'Find the hidden powderwright', 'A real bomb opens the workshop seam. A real conversation spends 200 coins for twenty-bomb capacity; a second conversation cannot charge again.'],
  ['07a-blue-vault', 'An optional blue vault', 'Two real boomerang throws wake the watchers within their timer. The blue lock opens a permanent heart-piece chest.'],
  ['08-upper-landing', 'Climb into the upper watch', 'The lower bridge requires the grapple before the stair. Both stair directions and the entrance shortcut are physically traversed.'],
  ['09a-pit-pull', 'Cross the missing bridge', 'The chain holds the hero over a pit without applying pit damage. Both landings preserve life; the eastern crown chest itself provides a grapple target.'],
  ['10-colossus-feet', 'Rook: break the feet first', 'One core, two feet and two arms hold 45 total HP. All four parts render at their authored scale. Visual inspection caught and corrected the initial tiny-part bug.'],
  ['10a-colossus-tell', 'Read the laser line', 'Pale lasers pierce even a tier-six shield. Round slam waves can be guarded. The test positions the boss and hero, then lets the real attack AI emit its shots.'],
  ['11-colossus-arms', 'Then the arms', 'Real sword input breaks the exposed feet and advances the fight. The arms become vulnerable while the core stays armored. Target placement and attack windows are controlled fixtures.'],
  ['12-colossus-core', 'A hopping final target', 'Two broken arms expose the fifteen-HP core. Its high leap leaves sword reach and produces a sixteen-wave landing. Real sword input finishes the fight.'],
  ['13-third-orb', 'A third campaign light', 'The collectible boss heart adds one permanent heart. The reward chest grants orb three; the tool and completion survive save/load. Rematches pay coins without another heart.'],
  ['14-quake-sage', 'Stone remembers', 'The real sage conversation teaches Quake. Real spell input deals eight nearby damage to a nine-HP warden and spends three magic.'],
  ['15-post-islands', 'The tool opens a detour', 'The earned grapple reaches an outdoor island chest and returns across the channel. Permanent terrain and reward state remain part of the shared campaign.'],
];
slides.push(...watchSlides.map(([file, caption, evidence]) => ({ path: `playtest-out/final/d3/${file}.png`, caption, evidence })));
const tideSlides = [
  ['01-coast-landing', 'Cross into Brineglass Coast', 'The earned grapple crosses Post Islands, then real physical exits reach the cool coast and temple. Earlier campaign milestones are fixtures.'],
  ['02-tide-entrance', 'A fourth temple to explore', 'Twenty-five rooms across two floors connect patrol keys, a counterweight, the fire wand, optional treasures, flame gates and Undertow Court.'],
  ['03-tide-map', 'Chart the two temple floors', 'The real map chest reveals both temple floors and the separate boss court. Each floor keeps distinct door and puzzle flags.'],
  ['04-ember-cache', 'The Fire Wand', 'The patrol and pushed counterweight earn keys. The eastern lock spends one key for both leaves; clearing its fixture guards exposes the real wand chest.'],
  ['05-first-thaw', 'Melt a path through tideglass', 'The sword leaves tideglass intact. Three actual fire-wand shots melt one block each, producing a walkable lane. A cramped landing found during testing was widened.'],
  ['06-twin-bowls', 'Two flames release a key', 'One fire shot lights only its bowl. Lighting the second releases one persistent key; the route earns four keys in total.'],
  ['07-deep-powder-bag', 'Thirty bombs for the next adventure', 'A real planted bomb opens the treasury seam. Its hidden chest upgrades the permanent bag to thirty; the party shares the capacity.'],
  ['08-magic-shield', 'Find protection from ink', 'Two actual returning throws wake the blue watchers. The optional vault grants a tier-three magic shield, which stops Nacre ink.'],
  ['09-ember-gate', 'Light the upper gate', 'One lit bowl leaves the shutter closed. Both real flames open it; a meltable ice hall then leads toward the crown.'],
  ['10-tide-crown', 'Uncover the crown chest', 'Two more wand-lit bowls reveal the hidden big-key chest. Three route locks and the optional sword lock consume the four earned small keys exactly once.'],
  ['11a-tide-hook', 'A chain above the tide', 'Actual grapple input holds the hero above the water and lands safely at the upper bank without losing life.'],
  ['11-tide-bridge', 'Reach the Undertow shortcut', 'The upper bridge leads to the antechamber. Walking onto its switch opens a real return portal to the temple entrance.'],
  ['12-nacre-surface', 'Nacre: follow the next ripple', 'Nacre has 105 body HP, four linked tentacles, alternating banks, a ripple tell and ink volleys. The native voxel models render at their authored scale.'],
  ['13-tentacle-cleared', 'Fire clears a tentacle', 'A real wand bolt withdraws one tentacle without reducing body HP. It regrows after its opening. Target placement and attack windows are controlled fixtures.'],
  ['14a-boss-hook', 'Cross during the dive', 'A real sword strike drives Nacre under immediately toward the opposite bank. A real grapple crosses the channel; the test temporarily withdraws tentacles to isolate the landing.'],
  ['14-far-bank', 'Keep up with the keeper', 'Tier-two guard fails against real ink; the earned magic shield stops it. Body hits use actual sword input, with controlled placement and surfacing windows.'],
  ['15-fourth-orb', 'All four temple lights', 'Real sword inputs finish Nacre, its heart permanently adds one heart, and the reward chest grants orb four. Rematches pay coins without another heart.'],
  ['16-freeze-sage', 'Sage Neru teaches Freeze', 'The real conversation grants Freeze. Actual spell input spends four magic and holds a fixture warden for five seconds; the sword shatters it. The hive sage also teaches tested Reflect.'],
  ['17-frozen-secret', 'Still the flame wall', 'Actual Freeze turns a flame wall into ice; a sword breaks it to reach a magic container. A refill fixture supplies magic for this optional follow-up check.'],
  ['18-charred-orchard', 'The wand opens an outdoor secret', 'A real fire shot burns an otherwise uncuttable tree and opens the coastal heart-piece chest. Save/load retains orb four, wand, Freeze and thirty-bomb capacity.'],
];
slides.push(...tideSlides.map(([file, caption, evidence]) => ({ path: `playtest-out/final/d4/${file}.png`, caption, evidence })));
slides.push(
  {path:'playtest-out/final/ui/02a-spell-reserve.png',caption:'Know what a spell costs',evidence:'Visual inspection found missing magic feedback. Cyan reserve units now sit below life, and the selected spell shows its class-adjusted cost.'},
  {path:'playtest-out/final/ui/02b-empty-magic.png',caption:'See when magic is spent',evidence:'Actual Freeze input spends four reserve units. The empty meter remains visible and an unaffordable cost turns muted red.'},
  {path:'playtest-out/final/ui/10-phone.png',caption:'Magic and spell costs on a phone',evidence:'Portrait and landscape HUD checks pass with the reserve and selected-spell cost present. Every widget stays within the view without overlapping.'}
);
const towerSlides = [
  ['01-four-light-gate','Four lights open the tower','The real coast doorway refuses entry with three orbs. Fire opens the tree barrier, and the fourth orb permits entry. Earlier campaign progress is a fixture.'],
  ['02-first-reflection','Endure the first reflection','Three native voxel bodies fire during a two-minute survival encounter. The countdown is visible and the long hint wraps within the canvas. Invulnerability is a route-test fixture.'],
  ['03-truesight-sage','Iona teaches Truesight','The actual sage conversation grants the spell after the timed trial. It spends the class-adjusted cost and its personal shadow cue expires after fifteen simulation seconds.'],
  ['04-amber-map','Each memory keeps its own map','The first floor has its own visited-room map, small key and crown key. Its actual rest well refills life and magic.'],
  ['05-amber-crown','Wake both watchers','Two real boomerang throws open the amber memory gate and reveal the crown route. Patrol clears use fixtures; locks, chests and puzzle inputs are real.'],
  ['06-amber-rematch','The queen returns','The amber floor brings back the queen and linked brood. The route test clears the rematch with a fixture; the original fight and co-op bomb counter have separate passing checks.'],
  ['07-storm-shield','Earn the Bastion Shield','The actual reward chest grants tier-six guard protection. Storm shots later demonstrate the difference between this shield and tier five.'],
  ['08-sand-counterweight','Move the memory counterweight','Real movement pushes the block onto its plate and opens the sand gate. This floor has a separate small key and crown key.'],
  ['09-sand-rematch','Rook guards the second ascent','The multipart colossus returns with four linked parts. Its route clear is a fixture; independent gameplay and co-op checks cover the original fight and room handoffs.'],
  ['10-dawn-blade','Find Dawn Blade','An actual chest grants the new sword, which is equipped for the final route. Three floors keep distinct reward and boss-clear flags.'],
  ['11-tide-bowls','Light the tide memory','Real wand inputs light both bowls and open the third gate. The cool tide palette changes the floor, wall and prop colors.'],
  ['12-tide-rematch','Nacre beneath the tower','The last memory brings back Nacre, four linked tentacles, water and hook posts. The route clear uses a controlled hit; the main Nacre fight has its own real-input coverage.'],
  ['13-last-door','The crown guard releases the last key','The final approach has a map, rest well, guard-clear chest and last boss lock. Earlier patrol clears are fixtures; chest acquisition and door inputs are real.'],
  ['14-truesight-reflections','Follow the real shadow','Actual Truesight reveals one body among reflections. False copies remain protected; real sword inputs grow the encounter from three to five bodies. Placement and attack windows are controlled.'],
  ['15-hollow-crown','The mask breaks into the Hollow Crown','Real sword inputs finish the keeper and start exactly one king. The native voxel body, crown and separate animated tail remain visible.'],
  ['16-lightning-tell','Leave the marked lightning squares','The actual king AI marks the hero and four corners. The warning is harmless; real movement escapes the strike. Its AI sequence is selected by a fixture.'],
  ['17-charge-line','Dash away from the charged line','The actual low-life AI commits to the white line before firing. A real charged projectile pierces even the earned shield; ordinary storms obey shield tiers. Low life is a fixture.'],
  ['18-ending','Bring the four lights home','Real sword inputs remove the full 140 HP king and enter the ending after its death effect clears. Placement and recovery windows are fixtures.'],
  ['19-ending-phone','The ending fits a phone','The full title, story and continue button stay inside the portrait canvas after title wrapping was corrected.'],
  ['20-homecoming','Return to Mossbrook','Actual ending controls return to the town and save. Reload preserves completion; King Aldric acknowledges homecoming and cleared rematches stay cleared.'],
];
slides.push(...towerSlides.map(([file,caption,evidence])=>({path:`playtest-out/tower-final-layout/${file}.png`,caption,evidence})));
const textSlides=[
 ['playtest-out/text-before/phone-saved-title.png','Before: a saved title runs off the phone','The reported problem is reproduced: the Continue summary and secondary action exceed the phone width.'],
 ['playtest-out/text-layout-final/phone-saved-title.png','Keep the whole Continue summary','The full saved-game label wraps inside its button. New adventure moves below it. Narrow title screens omit keyboard-control chips.'],
 ['playtest-out/text-before/phone-memory-map.png','Before: map text crosses its frame','The old hint wrapped to a width larger than the actual panel. A stale area banner also appeared behind the menu.'],
 ['playtest-out/text-layout-final/phone-memory-map.png','Map text follows its own panel','The title and complete hint use the measured inner width. Banners stay off menus.'],
 ['playtest-out/text-before/phone-party-entry.png','Before: the invite panel spills text','The old fixed rows spill copy and overlap the code field with Join.'],
 ['playtest-out/text-layout-final/phone-party-entry.png','An invite panel that reflows','Introductory, invitation and harmless-bonk text wrap. Code entry and Join have separate space.'],
 ['playtest-out/text-layout-final/phone-active-party.png','Keep the complete party code visible','All twelve code characters remain visible. Status, member name, area and actions reflow into rows. A local single-member party is the fixture.'],
 ['playtest-out/text-before/small-phone-large-dialog.png','Before: large text leaves the dialog','The authored paragraph and choices extend beyond the small phone.'],
 ['playtest-out/text-layout-final/small-phone-large-dialog.png','Large dialog text gets a screenful','The readable large font stays inside the dialog. Confirm fills or advances a screenful without skipping authored text.'],
 ['playtest-out/text-layout-final/small-phone-dialog-choices.png','Choices stay after the full story','The test reconstructs the full paragraph from the paginated screenfuls, then chooses an option with real input. Long options wrap and selection brings hidden choices into view.'],
 ['playtest-out/text-layout-final/landscape-temple-map.png','Two floors on a landscape phone','Floor charts sit side by side on short, wide screens. Labels, the complete hint and Close stay visible.'],
 ['playtest-out/text-layout-final/small-phone-settings-page-2.png','Reach every setting on a small phone','Labels stack above controls. Page two exposes the Effects slider, which responds to the real canvas drag control.'],
];
slides.push(...textSlides.map(([path,caption,evidence])=>({path,caption,evidence})));
const villageSlides=[
 ['sidequests/01-tobin-offer.png','Tobin has a place to explore','The real conversation accepts a physical errand: clear the roots, find a keepsake in the cellar and bring it home. Equipment and positioning are fixtures.'],
 ['sidequests/02-stump-before.png','A visible objective beside Tobin','The native stump stands in the open town path. Inspection explains that it needs a bomb. The original roof-obscured placement was moved after visual inspection.'],
 ['sidequests/03-cellar-stairs.png','A real bomb opens stone stairs','Actual item input consumes a bomb and permanently replaces the solid stump with a physical entrance. The journal follows the objective.'],
 ['sidequests/04-root-cellar.png','Beneath the roots','Walking onto the steps reaches a native voxel cellar with bronze seal, pot and spare-pot crate. The hero lands on clear floor; cached town speech bubbles stay out.'],
 ['sidequests/05-spare-pot.png','Miss a throw and try again','The ordinary pot was deliberately spent first. The native supply crate offers unlimited replacement pots without coin, health or magic loot.'],
 ['sidequests/06-keepsake-chest.png','Ring the bronze seal','A real thrown spare pot reveals the chest. Ringing the seal alone does not complete the quest.'],
 ['sidequests/07-keepsake-found.png','Recover a keepsake and heart piece','Walking into the chest collects the native medallion and one permanent heart piece. The reward headline is compact; the quest becomes ready and survives save/load.'],
 ['sidequests/08-tobin-return.png','Bring the keepsake home','The actual cellar stairs return to Mossbrook. Tobin receives his medallion through the real NPC conversation and pays forty coins once.'],
 ['sidequests/09-tobin-complete.png','Remember what you finished','The cleared stump, collected chest and completed errand survive a real save/load. A repeated conversation cannot pay the errand reward again.'],
 ['voices/01-tobin-speaking.png','Hear the focused conversation','The deterministic speech fixture verifies one utterance per screenful, distinct Tobin and Hettie delivery, skip/close cancellation and mute. Native engine callbacks are verified separately.'],
 ['voices/02-phone-voiced-page.png','Speech follows readable pages','The phone test reconstructs the entire authored paragraph from spoken screenfuls with no repeated or omitted text. Browsers without speech keep fully usable text dialog.'],
 ['voices/03-npc-voices-setting.png','Optional voices with no model download','The real Settings control turns NPC voices on or off and saves the preference. Only installed English voices are used; signs and background barks remain silent.'],
];
slides.push(...villageSlides.map(([path,caption,evidence])=>({path:`playtest-out/sidequests-full/${path}`,caption,evidence})));
for(const browser of npcVoices.browsers)slides.push({path:`playtest-out/npc-native-voices-rook/${browser.name}-npc-voice.png`,caption:`Native NPC speech in ${browser.name==='firefox'?'Firefox':'Chromium'}`,evidence:`${browser.view.localVoices.length} installed English voices; ${browser.delivered?'actual native start and end callbacks completed for Hettie.':'no completed native playback was observed on this device.'} No speech model was downloaded. The receipt checks callbacks and does not measure audible voice quality.`});
const rookSlides=[
 ['01-rook-offer','Rook has an adventure to offer','The actual NPC conversation accepts a physical dice quest. An older completed bush errand is migrated into a fresh offer while unrelated completed quests are preserved. Starting sword, positioning and invulnerability are fixtures.'],
 ['02-den-stairs','Uncover Briar Den','A real sword cut permanently reveals the northwest stairs. Ordinary brush cuts cannot satisfy the stolen-dice objective.'],
 ['03-hunter-bench','A patrol protects the bow','Walking onto the actual stairs lands on clear floor in a three-room den. The first room holds two full-health enemies, a supply rack and a closed north gate.'],
 ['04-bow-earned','Earn a new ranged tool','Actual sword combat defeats the patrol, then walking into the revealed chest grants the native Hunter Bow with ten arrows.'],
 ['05-arrow-span-before','Steel cannot reach the far bank','Two bullseyes stand across a pit. Native arrow racks allow missed shots to be retried; empty quivers cannot fire free arrows.'],
 ['06-first-target','One arrow is only half the answer','A real arrow turns one bullseye green. A thrown pot does not activate it, and the pit stays open until both targets answer.'],
 ['07-bridge-lowered','Two shots lower the bridge','Real bow inputs activate both far-bank targets and replace six pit tiles with a native plank deck. The quest remains active until the actual dice are found.'],
 ['08-span-crossed','Walk across the answer','Real movement crosses the newly lowered deck without pit damage. The same bridge supports the trip home.'],
 ['09-dice-vault','A shield guards the dice','The vault pairs a shielded warden with an archer, throwable pots and an arrow rack. The chest stays hidden until the room is cleared.'],
 ['10-guard-stunned','Clay breaks the guard','A frontal arrow respects the shield. A real thrown pot damages and stuns the guard; real arrows finish it. Guard attack windows and later archer positioning are controlled fixtures.'],
 ['11-vault-clear','Make the treasure reachable','Actual projectile damage clears the vault and reveals its physical chest. Combat windows are fixtures; the chest is not granted by the test.'],
 ['12-dice-found','Find the stolen dice','Walking into the vault chest collects the native lucky dice and makes Rook\'s journal objective ready.'],
 ['13-rook-return','Bring the dice back to town','The hero returns through both real doorways, the lowered bridge and the actual stairs, then talks to Rook beside the West Gate.'],
 ['14-rook-complete','A reason to finish the adventure','Rook grants a permanent thirty-arrow quiver and exactly three bombs. The test spends an arrow and repeats the conversation with Goodbye; neither reward is duplicated.'],
 ['15-span-revisit','Remember the whole route','A real save/load preserves the completed errand, quiver, cleared patrol, revealed entrance, both targets and lowered bridge.'],
];
slides.push(...rookSlides.map(([file,caption,evidence])=>({path:`playtest-out/rook-den-final/${file}.png`,caption,evidence})));
slides.push({path:'playtest-out/item-prizes-second/phone-small-earned-bow.png',caption:'A visual check caught the hidden prize',evidence:'The first native prize was inside the camera frame, yet the smallest phone HUD covered it. This interrupted development run is retained as the before image. Later checks measure clearance from the actual HUD and shortcut rectangles.'});
const prizeSlides=[
 ['desktop-earned-bow','Hold up the actual bow','Walking into the real Hunter Bench chest grants the bow and displays its existing voxel model. Patrol deaths are a fixture in this presentation test; the separate complete Rook scenario checks real patrol combat.'],
 ['phone-earned-bow','A phone can see the treasure','Brief local camera headroom gives the raised prize space below the actual HUD, without entering a reward mode or pausing a co-op partner.'],
 ['phone-small-earned-bow','The smallest phone clears the HUD','At 320 by 568, projected model corners clear the actual HUD and both shortcut rectangles. Manual inspection confirms a visible bow above the hero.'],
 ['phone-wide-earned-bow','The same prize on a wider phone','The actual earned bow stays within the frame and below the header at 430 by 932.'],
 ['laptop-earned-bow','Preserve the laptop room view','The raised prize stays below the header. Expiry restores the measured dungeon subject; the existing camera scenario also passes.'],
 ['dialog-heart-prize','Rewards can arrive during dialogue','An explicit heart-container grant fixture shows the native heart and cheer pose immediately while dialogue pauses player updates. Replacement detaches the earlier instance and retains cached geometry.'],
 ['keepsake-prize','Tobin has a physical keepsake','The existing authored medallion appears over the hero. This grant is a presentation fixture; the separately rechecked cellar route verifies real chest collection and one-time rewards.'],
 ['quiver-prize','Show the quiver Rook gives','The existing quiver model now appears during item-get. This direct grant is a presentation fixture; the complete Rook route independently checks delivery and saved state.'],
 ['phone-quiver-prize','A quiver and readable reward caption','The smallest phone displays both the actual native prize and complete wrapped caption. The final capture waits for camera resize before rendering; an earlier cleared-canvas photo is retained in visual inspection receipts.'],
];
slides.push(...prizeSlides.map(([file,caption,evidence])=>({path:`playtest-out/item-prizes-final/item-prizes/${file}.png`,caption,evidence})));
for(const [file,caption]of [['town-phone','Town rewards fit the small phone'],['town-landscape','Town rewards fit landscape too']])slides.push({path:`playtest-out/item-prizes-release/${file}-quiver-prize.png`,caption,evidence:'The closer town camera projects a larger prize than the dungeon rig. The final caption layout measures the actual projected model bounds and puts the complete text clear of the quiver. The hero stands on clear central paving. Direct grant and positioning are presentation fixtures; the quest route is verified separately.'});
for(const id of['desktop','phone'])slides.push({path:`playtest-out/rook-text-final/${id}-quiver-reward.png`,caption:`The quiver reward fits ${id==='phone'?'a phone':'the desktop'}`,evidence:'The actual grant presents its complete authored headline. The canvas audit checks every drawn text run and panel at five desktop and phone sizes, including the active Rook journal objective. This photo does not establish a quiver prize silhouette.'});
// The current full run has fresh captures; retain the old files for historical receipts.
for(const slide of slides){
  if(slide.path.startsWith('playtest-out/final/'))slide.path=slide.path.replace('playtest-out/final/','playtest-out/rook-final-full/');
  if(slide.path.startsWith('playtest-out/tower-final-layout/'))slide.path=slide.path.replace('playtest-out/tower-final-layout/','playtest-out/rook-final-full/tower/');
  if(slide.path.startsWith('playtest-out/sidequests-full/'))slide.path=slide.path.replace('playtest-out/sidequests-full/','playtest-out/rook-final-full/');
  if(slide.path.startsWith('playtest-out/text-layout-final/'))slide.path=slide.path.replace('playtest-out/text-layout-final/','playtest-out/rook-text-final/');
  if(/\/rook-den-final\/(04-bow-earned|12-dice-found)\.png$/.test(slide.path))slide.path=slide.path.replace('playtest-out/rook-den-final/','playtest-out/item-prizes-final/rook-den/');
  if(slide.path.endsWith('/sidequests/07-keepsake-found.png'))slide.path='playtest-out/item-prizes-final/sidequests/07-keepsake-found.png';
}
for (const slide of slides) {
  const bytes = readFileSync(slide.path);
  slide.screenshotSha256 = createHash('sha256').update(bytes).digest('hex');
  if (!slide.capturedUtc) { slide.capturedUtc = statSync(slide.path).mtime.toISOString(); slide.timestampSource = 'screenshot file modified time'; }
}
const modified = execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0').filter((path) => /^(src\/|scripts\/|docs\/|README\.md$|vite\.config\.js$|package(-lock)?\.json$)/.test(path)).sort();
const hash = createHash('sha256');
for (const path of modified) hash.update(path).update(existsSync(path) ? readFileSync(path) : '<deleted>');
const debuggingReceipts = readdirSync('playtest-out').filter(path => /^d[34].*\.log$|^multiplayer-d[34].*\.log$|^(?:multiplayer-)?tower.*\.log$|^text.*\.log$|^ui-rook.*\.log$|^(?:multiplayer-)?(?:sidequests|rook|item-prizes).*\.log$|^(?:voices|npc-bubbles|npc-native-voices).*\.log$/.test(path)).sort().map(file => ({
  path: 'playtest-out/' + file,
  result: /^FAIL |AssertionError|SyntaxError|Error: Game failed/m.test(readText('playtest-out/' + file)) ? 'failed development run retained' : /^PASS |^\d+\/\d+ multiplayer/m.test(readText('playtest-out/' + file)) ? 'passed focused development run' : 'build and startup diagnostics',
  sha256: createHash('sha256').update(readFileSync('playtest-out/' + file)).digest('hex'),
}));
const artifacts = ['dist-artifact/voxel-heroes.html', 'dist-artifact/voxel-heroes-item-prizes-source.zip'].filter(existsSync).map(path => ({
  path, bytes: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
}));
const inspectionReceipts=['playtest-out/d4-visual-inspection.ndjson','playtest-out/tower-visual-inspection.ndjson','playtest-out/sidequests-visual-inspection.ndjson','playtest-out/rook-visual-inspection.ndjson','playtest-out/item-prizes-visual-inspection.ndjson'].map(path=>({
  path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),entries:readText(path).trim().split(/\r?\n/).map(line=>{
    const entry=JSON.parse(line),byHash=`playtest-out/visual-history/${entry.sha256}/${entry.path}`;
    const historic=existsSync(byHash)?byHash:'playtest-out/visual-history/d4/'+entry.path;
    if(existsSync(entry.path)&&createHash('sha256').update(readFileSync(entry.path)).digest('hex')===entry.sha256)return entry;
    assert.ok(existsSync(historic),'Missing preserved inspection image: '+entry.path);
    assert.equal(createHash('sha256').update(readFileSync(historic)).digest('hex'),entry.sha256);
    return {...entry,originalPath:entry.path,path:historic};
  }),
}));
const textBoundsPath='playtest-out/item-prizes-caption-final/text-layout/text-bounds.json';
const textBounds=JSON.parse(readText(textBoundsPath));
assert.deepEqual(textBounds.issues,[],'Complete the drawn-text and panel-bounds audit');
const textBoundsReceipt={path:textBoundsPath,sha256:createHash('sha256').update(readFileSync(textBoundsPath)).digest('hex'),checkedUtc:textBounds.checkedUtc,checks:textBounds.checks.length};
const manifest = {
  generatedUtc: new Date().toISOString(), sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  changedSourceSha256: hash.digest('hex'), changedFiles: modified, multiplayer: result, gameplay: gameplayReceipt,
  publicParty, publicPartyRerun, debuggingReceipts, artifacts, inspectionReceipts,textBoundsReceipt,npcVoicesReceipt,
  gameplayVerification: { fullRun: gameplaySummary[0].trim(), notes:'The prior full 36-scenario run covers four dungeons, tower, ending, combat, save and streaming. A later seven-scenario run checks prize presentation, hero, camera, boss rewards, complete Rook and Tobin routes, and drawn text. The final caption-only adjustment has a subsequent two-scenario prize and drawn-text recheck. Earlier UI receipts retain their timestamps. This is combined coverage, not a fresh full 37-scenario run. Captions disclose fixtures.', scenarios: [...verified].sort(), rechecks },
  browsers: `Firefox and Chromium; ${result.ice}; local Nostr signaling relay`,
  standalone: '4/4 startup and party-menu checks passed in Firefox and Chromium',
  development: '4/4 startup and party-menu checks passed at localhost:5173 in Firefox and Chromium',
  visualInspection: 'Manual image observations retain timestamps and hashes for quest routes, NPC voices and the native prize presentation. Before images preserve the HUD-hidden bow and the resize-cleared quiver capture. The final drawn-text audit checks five viewport sizes; the new prize scenario measures actual HUD clearance and camera restoration.',
  scope: 'Firefox startup, shared co-op, pots and sword buffering, guard combat, four dungeons, three tower memory floors, final fight and ending, physical Tobin and Rook adventures, native local prize models and optional installed NPC voices. Broader quest variety, remaining reward models and M4 catalogue, and separate-network multiplayer verification remain.',
  build: readdirSync('dist/assets').filter(path => path.endsWith('.js')).map(path => ({ path: `dist/assets/${path}`, sha256: createHash('sha256').update(readFileSync(`dist/assets/${path}`)).digest('hex') })),
  slides: slides.map(({ caption, evidence, path, capturedUtc, timestampSource, screenshotSha256, sceneState }) => ({ caption, evidence, path, capturedUtc, timestampSource, screenshotSha256, sceneState })),
};
const bundled = slides.map(({ path, ...slide }) => ({ ...slide, image: `data:image/png;base64,${readFileSync(path).toString('base64')}` }));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voxel Heroes | Adventure and co-op review</title><style>
:root{color-scheme:dark;font:16px/1.5 system-ui,sans-serif;background:#08100e;color:#f3ecd2}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column}
header{padding:18px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #28372e}header strong{font-size:18px;letter-spacing:.03em}header span{color:#a9b8a2;font-size:13px}
main{width:min(1440px,100%);margin:auto;padding:20px 28px;flex:1}figure{margin:0;background:#030806;border:1px solid #28372e;border-radius:6px;overflow:hidden}img{display:block;width:100%;height:min(63vh,810px);object-fit:contain;background:#030806}
.caption{display:grid;grid-template-columns:minmax(220px,1fr) 2fr;gap:24px;margin-top:20px}h1{font-size:26px;line-height:1.15;margin:0 0 8px}p{margin:0;color:#a9b8a2}.evidence{font-size:15px;color:#d7dec8}.controls{display:flex;gap:10px;align-items:center;margin-top:22px}button,select{font:inherit;color:inherit;background:#142219;border:1px solid #425443;border-radius:4px;padding:9px 14px;cursor:pointer}button:hover{border-color:#f1c232;color:#f1c232}button:focus-visible,select:focus-visible{outline:2px solid #f1c232;outline-offset:3px}select{flex:1;min-width:0}
.receipt{font:12px/1.6 ui-monospace,monospace;margin-top:18px;color:#7f957d}footer{padding:12px 28px;border-top:1px solid #28372e;font-size:12px;color:#a9b8a2}#index{color:#f1c232;font:13px ui-monospace,monospace;margin-left:12px}
details{margin-top:16px;color:#a9b8a2;font-size:13px}pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#a9b8a2}a{color:#f1c232}@media(max-width:650px){header,main,footer{padding:14px}header span{display:none}.caption{display:block}.evidence{margin-top:12px}img{height:48vh}.controls{flex-wrap:wrap}select{flex-basis:100%}h1{font-size:22px}}
</style><header><strong>VOXEL HEROES <span>/ ADVENTURE + CO-OP</span></strong><span>Real screenshots + test receipts</span></header>
<main><figure><img id="frame" alt=""></figure><div class="caption"><div><h1 id="title"></h1><p id="stamp"></p></div><p id="evidence" class="evidence"></p></div>
<div class="controls"><button id="prev" aria-label="Previous slide">Previous</button><button id="next" aria-label="Next slide">Next</button><select id="picker" aria-label="Choose slide"></select><button id="full">Fullscreen</button><span id="index"></span></div>
<div class="receipt">${gameplayReceipt}. ${result.passed}/${result.passed} multiplayer checks passed. Firefox + Chromium, real Trystero WebRTC.</div>
<div class="receipt">Current browser and RTC checks use local signaling. The earlier public-relay pass is retained; its latest rerun requires approval.</div>
<details><summary>Verification and source receipt</summary><pre id="receipt"></pre></details></main><footer>Arrow keys navigate. Images are embedded. Cellar quest and NPC voices included; broader quest variety and separate-network testing remain.</footer>
<script>const slides=${JSON.stringify(bundled).replace(/</g, '\\u003c')};const manifest=${JSON.stringify(manifest).replace(/</g, '\\u003c')};
const frame=document.getElementById('frame'),picker=document.getElementById('picker');let current=0;
slides.forEach((slide,i)=>{const option=document.createElement('option');option.value=i;option.textContent=(i+1)+'. '+slide.caption;picker.append(option)});
function show(i){current=(i+slides.length)%slides.length;const slide=slides[current];frame.src=slide.image;frame.alt=slide.caption;document.getElementById('title').textContent=slide.caption;document.getElementById('evidence').textContent=slide.evidence;document.getElementById('stamp').textContent=slide.capturedUtc?(slide.timestampSource?'Screenshot saved ':'Captured ')+new Date(slide.capturedUtc).toLocaleString():'Saved screenshot';document.getElementById('index').textContent=(current+1)+' / '+slides.length;picker.value=current}
document.getElementById('prev').onclick=()=>show(current-1);document.getElementById('next').onclick=()=>show(current+1);picker.onchange=()=>show(+picker.value);
document.getElementById('full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT')return;if(e.key==='ArrowRight'){e.preventDefault();show(current+1)}if(e.key==='ArrowLeft'){e.preventDefault();show(current-1)}if(e.key==='Home')show(0);if(e.key==='End')show(slides.length-1)});
document.getElementById('receipt').textContent=JSON.stringify(manifest,null,2);show(0);</script></html>`;
if (existsSync('playtest-out/review/manifest.json')) {
  const previous = JSON.parse(readText('playtest-out/review/manifest.json'));
  if (previous.changedSourceSha256 !== manifest.changedSourceSha256) {
    const history = `playtest-out/review-history/${previous.generatedUtc.replace(/[:.]/g, '-')}`;
    if (!existsSync(history)) cpSync('playtest-out/review', history, { recursive: true });
  }
}
mkdirSync('playtest-out/review', { recursive: true });
writeFileSync('playtest-out/review/voxel-heroes-review.html', html);
writeFileSync('playtest-out/review/manifest.json', JSON.stringify(manifest, null, 2));
writeFileSync('playtest-out/review/gameplay.log', gameplay);
writeFileSync('playtest-out/review/multiplayer.log', readText('playtest-out/multiplayer-final.log'));
writeFileSync('playtest-out/review/standalone-browsers.log', browsers);
writeFileSync('playtest-out/review/development-browsers.log', development);
writeFileSync('playtest-out/review/public-party.json', JSON.stringify(publicParty, null, 2));
for (const recheck of rechecks) writeFileSync(`playtest-out/review/${recheck.scenario}-recheck.log`, readText(recheck.path));
if (existsSync('playtest-out/errands-final.log')) writeFileSync('playtest-out/review/quest-visual-check.log', readText('playtest-out/errands-final.log'));
mkdirSync('playtest-out/review/development-history', { recursive: true });
for (const receipt of debuggingReceipts) cpSync(receipt.path, 'playtest-out/review/development-history/' + receipt.path.split('/').at(-1));
for(const receipt of inspectionReceipts)cpSync(receipt.path,'playtest-out/review/'+receipt.path.split('/').at(-1));
cpSync(textBoundsPath,'playtest-out/review/text-bounds.json');
cpSync(npcVoicesPath,'playtest-out/review/npc-native-voices.json');
cpSync('playtest-out/public-party-rerun-blocked.json','playtest-out/review/public-party-rerun-blocked.json');
writeFileSync('playtest-out/review/screenshot-receipts.json', JSON.stringify(manifest.slides, null, 2));
console.log(`${slides.length} slides with embedded screenshots: ${resolve('playtest-out/review/voxel-heroes-review.html')}`);
