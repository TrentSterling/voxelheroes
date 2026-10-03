# Equipment and the fourth-temple road

Earned swords previously entered the owned-blade registry without any normal
screen that called `equipSword`. A player could open the Warden chest and keep
using the starter blade indefinitely. The existing inventory input now opens
Equipment: Tab on keyboard, Y on a standard gamepad, or the touch Menu button.
Pause also has an Equipment button. Back returns to the mode that opened it.

Owned blades show their current damage and reach, including smith levels, the
hero's trait and the full-life rule. Selecting a row previews the choice;
Confirm or Equip commits it. Enter confirms inside Equipment. Closing the
screen does not carry a menu confirmation into a sword attack. The selected
weapon remains personal during co-op and survives save/load. Shared sword
rewards still share ownership. Passive shield, boots and ring equipment is
listed when the viewport has room. The compact screen keeps blade choices and
Back reachable. The empty screen directs an unarmed hero to the castle.

Nacre's old ripple marks sat below the raised Brineglass floor. Teal surfacing
marks and coral committed tentacle lanes now sit above the highest inlay. Their
world position and horizontal size stay independent of enemy spawn growth and
replica position interpolation. Tentacle rotations compose quaternions directly:
restoring a quaternion can produce an equivalent Euler rotation with flipped
X/Z angles, so reading its Euler Y alone gave the wrong warning direction.
The new one-line Nacre HUD fits through the existing measured center layout.

The native crown scenario starts at the fresh title and earns the first three
temple victories, then continues across Post Islands and the coast. It opens
the fourth-temple map and wand cache, melts First Thaw, claims the island heart
fragment, lights the twin bowls, opens Warden Legacy and equips its blade
through the actual Equipment screen. Normal fire/sword/guard combat earns the
pressure-patrol key and Ember Lens. Real returning throws unlock the magic
shield. The route melts the upper hall, lights the crown bowls, opens its chest,
crosses Tide Bridge and checks both directions of the entrance shortcut.

The narrow bank before Tide Bridge is approached at its actual center, z=7.5.
The west locked doorway is approached from x=2.5. The last long fire bolt is
allowed to finish traveling before the controller attempts the western exit.
Returning guards are fought when present. Loading a diagnostic save forgets
temporary room-clear memory, so a resumed probe can encounter guards that a
fresh uninterrupted route remembers.

The fresh scenario uses ordinary movement and earned tools, with no gear
grants, health edits, immunity, teleports, direct damage or forced AI phases.
Ancestor movement endpoints settle within two ordinary steps; an earned starter
save roundtrip is disclosed. Later diagnostic saves are recorded but never
loaded by the fresh acceptance scenario. The separate probe explicitly loads
an earned checkpoint and never claims fresh-title coverage.

## Verification and receipts

The release matrix is in
`playtest-out/undertow-equipment-acceptance-20261003`. Its structured result
records the game source fingerprint, captured test hashes, native campaign
cases, geometry, shell combat, reward/shield, retry and world-clearance checks.
The gameplay results reuse the completed release-checks packet on identical
game source, scenario scripts and executed helpers. Only the unused controller
driver changed afterward: it now allows wall-clock equipment feedback to settle
before checking the next input. The independent controller run below executes
that corrected driver. The original completed packets remain preserved.

Separate exact-source packets cover:

- `equipment-layout-verified-20261003`: real touch/mouse entry and selection,
  text bounds, control overlap and empty/one/three-blade layouts in two engines,
  four viewport profiles and two text settings.
- `equipment-gamepad-verified-20261003`: native Gamepad API polling through Y, d-pad,
  A confirmation, Y close and a fresh A sword press. The standard pad source
  and owned Warden blade are fixtures; physical hardware is outside scope.
- `undertow-equipment-coop-verified-20261003`: actual local Trystero RTC,
  independent equipped choices, harmless friendly sword knockback, shared
  multipart cues, warning coordinates and live ownership transfer. Campaign,
  gear, placement, phase and boss immunity are disclosed fixtures. Public
  signaling and separate-network ICE are outside scope.
- `undertow-equipment-offline-20261003`: the exact portable HTML in Firefox.

The image-only review is
`playtest-out/undertow-equipment-review/static.html`. Captions distinguish
earned campaign receipts, arranged geometry/layout scenes, local RTC contracts
and the frozen before image. Its manifest hashes every image and binds the
review to the packaged source and tested portable artifact. The release packet
contains a read-back-verified source ZIP and all 1,490 embedded voice clips.

Speaker output is disconnected before every game test navigation. The review
loads images only. No test plays through the desktop speakers.

## Further work

This checkpoint reaches the fourth boss door; it does not prove a fresh Nacre
victory, the tower, a full co-op campaign or separate-network connections. The
temple still uses its existing six floor motifs. More room-specific tile
architecture, recovery/retry pacing, encounter variety, era story and companion
integration remain part of the broader game work.
