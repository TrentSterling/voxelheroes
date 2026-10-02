# The nursery's remaining gardeners

Mossbridge and Forgotten Pay now use original leaf-and-brass Nursery
Pollinators. Raised leaf wings and pink ground marks warn a committed dive for
0.85 seconds. Moving sideways evades its straight path; the body rests for
1.25 seconds afterward. Contact hurts only during the dive. A starter blade,
returning wood, thrown clay or freeze cancels a pending attack. Zero-damage
boomerang stuns remain effective.

They stay over walkable ground. Root pillars block acquisition and committed
flight, and their floor warning avoids solid cover. A blocked route returns
to wandering. Their phase, remaining timer, committed direction and dive
count live in replicated AI state, so an ownership change continues the
same attack once.

Walk west from Three Watchers into the optional **Pollinator Court**. Two
native guards protect one permanent heart piece. Clear them with real-time
combat to reveal its chest and release the eastern shutters. The reward and
cleared room survive save/load and revisits without giving another piece.

The court's tablet recalls nursery children and the gardeners that kept
working after the final morning. It sits clear of the fighting lane. Petal
stones and seed rails add two quick native floor patterns to the greenhouse
kit, bringing Rootglass to sixteen authored rooms and eight local decorative
floors. Models and materials are intentionally simple boxels for later polish.
No new voice clips or synthesis model are added by this encounter.

`pollinator` checks native sword victories, real room entry, physical reward
collection, dodge, guard, returning wood, clay and blade interruptions,
warnings in several directions, cover, freeze cancellation and ground safety.
Starter gear, isolated placement, initial timers and one missing half-heart
are disclosed fixtures; freeze uses the damage API.

`scripts/pollinator-coop-test.mjs` tests a vulnerable guest's native dodge and
boomerang over real local Chromium/Firefox RTC, physical owner departure
during a warning, reunion and one shared court reward. The court guards are
removed with damage fixtures to isolate sharing; the solo scenario separately
requires native sword kills.

`scripts/pollinator-touch-test.mjs` drives actual touch joystick and item
events at small portrait and landscape sizes, with both text sizes. It checks
the dodge, stun, instruction and text bounds. All testing stays muted.
