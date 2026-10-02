# Nearby party composition

The camera now frames the hero, recruited companions and nearby co-op heroes.
It uses the union of each native figure's poses, with a small margin, so a sword,
shadow or expanding technique ring cannot drive the zoom. At most eight subjects
within six tiles participate; companions take priority. Friends in separate
areas or rooms keep their own cameras.

The existing solo target, edge thresholds and room slide remain authoritative.
Party composition adds a presentation offset after that calculation, keeps the
current field of view, raises the low party rigs to 28 degrees and expands only
when necessary. Closing up eases the camera back. Arrivals discard stale offsets;
dismissing the party returns to the selected solo rig. Item rewards retain their
headroom constraint.

The frame fits a free rectangle between the actual canvas HUD and technique slot.
Touch pad groups are measured on viewport changes. The desktop technique hint is
closer to the bottom prompts; short touch landscape puts its compact hint beneath
the life/counter column, between the equipped item and party shortcut. Drawing
and composition share current shortcut bounds rather than reading hit regions
that are rebuilt later in the draw. Portrait, landscape, large text and the
original controls remain supported.

Foreground voxel materials now receive a body-centered dissolve ray for each
subject. The floor, character materials and far backdrop retain their existing
protection. This is presentation only; collision, tiles, attacks and shared state
are unchanged.

Verification retains native vertex bounds, actual stick travel through the First
Bloom and a Barrow doorway, pot lifting/throwing, a native reward, three quality
paths, touch controls, RTC split/reunion/migration and campaign checks. Identical
raw GL frames compare hero-only and full-party probes inside companion silhouettes.
All browser output is muted and the existing voice bank is never replayed.

The final production, second-seed Firefox, camera safety and portable runs retain
3,807 gameplay assertions. The camera scenarios run natively on both engines;
unchanged passing safety cases retain their identical source and executed-helper
hashes when only the pot capture is retaken after the normal arrival banner fades.
Additional receipts contain 32 local RTC checks, 84 touch framing checks, 117
conversation/technique layout checks, 20 native fragment checks and 295 parsed
game modules. These numbers count assertions, not unique features or enjoyment.

The baseline, current 12-slide review and local build packet are in
`playtest-out/camera-baseline2-20261001`, `playtest-out/camera-review` and
`playtest-out/camera-delivery-20261001`. Their manifests preserve source, image,
receipt, artifact and ZIP hashes. Development failures remain in their original
folders, including an old watchdog test that assumed a slow Firefox renderer.
Its updated fixture introduces a measured slow native draw and retains the same
quality-drop requirement.

This does not establish visibility behind every possible obstacle, frame distant
players, or give enemies their own composition priority. Very short touch screens
still devote substantial space to controls, and authored adventure content remains
the next priority. Public separate-network RTC and enjoyment are not measured.
