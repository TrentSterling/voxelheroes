# Fourfold memories and the Hollow Crown

The tower memories now use six original native floor materials in four room
plans: galleries, rest rooms, mechanism halls and ceremonial vaults. The amber,
sand, tide and ash palettes give each floor a distinct place in the borrowed-hour
story. All markings occupy the existing ground plane and remain walkable and
pushable. The three memory courts and final throne use quiet slate, brass edges
and a large hour seal. The tide court retains its water channel and grapple posts.

The earned route exposed an unusable first spell. Skipping optional earlier sages
left a hero with zero magic capacity; Iona previously added one unit while
Truesight cost three. A first lesson now fills enough reserve for its class-adjusted
cost. Later lessons still add at least one unit. Repeat teaching cannot add more
capacity. One violet crown wisp now drops three normal magic gems, enough for a
normal Truesight cast, so a depleted hero need not wait for three violet waves.

Caldrin guards during stalking, attack windups and lightning. His gold boxel ring
marks recovery, with up to three actual hits per opening. The ring closes when
the opportunity is spent. The native attacks, 140 HP, tier-six storm and ordinary
shots, lightning warnings and unguardable bright charge remain active. Each
recovery lasts 1.5 seconds; consuming an opening prompts one return shot instead
of three shots after every hit. This leaves time to raise the shield or move after
the sword retracts. The charge line is raised clear of the floor and follows its
committed direction while the
body turns or a replica interpolates. Both the ring and warning derive from shared
attack state.

The Hollow Throne's south stairs now remain open and return to the actual Last
Door, beside its well. A surviving player can retreat after Veyl and prepare for
Caldrin. The broken mask persists, so retreat, save/load and natural death do not
require defeating Veyl again. Personal well healing preserves a friend's separate
life and magic. Other arena doors retain their original completion rules.

The fresh-title tower cases extend the native four-temple campaign through the
coast, four tool anchors, floor patrols, independent keys and maps, actual puzzles,
three rematches, Iona, Bastion Shield, normally equipped Dawn Blade, Veyl and
Caldrin. No gear grants, health edits, immunity, teleports, direct damage or forced
AI are used. Controllers read live shadows, attack clocks, visible warnings and
pickups, then write ordinary movement, sword, guard and owned-tool inputs.
Ancestor walking helpers settle endpoints within two ordinary steps; the earned
starter save roundtrip is disclosed. Diagnostic saves are written for investigation
but never loaded by the fresh acceptance cases.

The separate natural recovery case waits for real Caldrin damage, presses actual
Try Again, keeps earned equipment, spent memory keys and the broken mask, and
physically returns to exactly one final boss. The first-spell case isolates normal
Iona teaching, casts, repeat talk and saves with explicit profile/room fixtures.
The architecture case inspects actual rendered vertices, four palettes, collision,
push-floor semantics and the southern retreat; enemies are harmless visual fixtures.

Local Chromium/Firefox Trystero checks isolate shared first-spell grants, personal
Truesight and rest, armored sword blocks, three-hit recovery, committed charge
geometry, physical independent retreat and pending attack ownership transfer.
Campaign flags, positions, gear, immunity and controlled boss windows are disclosed
fixtures. This does not establish a full native co-op campaign, public signaling,
separate-network ICE, mobile hardware performance or how enjoyable real players
find the difficulty. Those remain part of the larger work.

All browser output is disconnected before navigation. The existing 1,490 compressed
Kokoro recordings remain unchanged; no model or live generation ships. Review
pages are image-only static HTML with hashed screenshots and source/build manifests.
Earlier failed diagnostics are kept separately from final acceptance.

Accepted checkpoint receipts (2026-10-03):

- `playtest-out/fourfold-crown-accepted-20261003`: 22 passed, zero failed,
  4,388 assertions and 774 hashed screenshots. Both Firefox and Chromium finish
  the fresh campaign and independently exercise natural defeat and Try Again.
- `playtest-out/fourfold-crown-offline-20261003`: six passed, zero failed,
  542 assertions and 190 screenshots. Firefox finishes the fresh campaign from
  the actual portable `file://` HTML.
- `playtest-out/fourfold-crown-coop-final-20261003`: 15 passed with five screenshots.
  Real local Trystero RTC; the isolated campaign, positioning, equipment,
  immunity and attack-window fixtures are disclosed above.

All three bind game source SHA-256
`31c63f4c50faa15f56f29a20e2bae3b00ed6d930a056b9419cd226b345f7c3a6`.
Their executed test sources stayed unchanged. The portable artifact SHA-256 is
`b6cbc726efd4a8230315686b65b85dbcb9af1a77faf4ccfcd642b9f6ed0d7cc2`.
The source package and image-only review builder verify these exact fingerprints.
The review contains 38 slides, including the retained previous-source before image.
The accepted native victory can finish before Caldrin's charged shot; committed
charge geometry is established by the explicit local RTC fixture and the separate
legacy phase scenario, rather than claimed as a fresh charged-shot victory.

The wider goal remains active. Native co-op campaign coverage, quests and activities
beyond the main route, additional encounter variety, introductory pacing and art
polish still need work. Visual review also retains transitional boss banners and
brief outgoing hints honestly; future presentation work can improve those handoffs.

Repeatable silent checks:

```powershell
node scripts/gauntlet.mjs --scenarios-only --cases=first-spell,tower-architecture,tower-victory,tower-recovery,tower,contracts-m2,world-audit,hero,reward-shield,ui --engines=firefox,chromium --seeds=17
node scripts/crown-coop-test.mjs --url=http://127.0.0.1:5173/
npm run artifact
node scripts/gauntlet.mjs --scenarios-only --cases=tower-victory,first-spell,tower-architecture,ui --engines=firefox --seeds=17 --url=file:///C:/trontstack/voxelheroes/repo/dist-artifact/voxel-heroes.html
```
