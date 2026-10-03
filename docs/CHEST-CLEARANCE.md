# Chest reveal clearance

A hidden chest marker is walkable floor. Clearing its room used to replace that
floor with a solid chest while leaving its occupant in the same position. The
hero's ordinary movement then rejected every step from inside the solid tile.

Chest tile definitions now identify themselves explicitly. When `setTile`
installs a chest, it checks body-radius overlap against the tile's actual solid
extent before adding the prop. Overlapping local heroes, visible travelling
companions and solid actors move to the nearest free floor in that screen.
The destination excludes occupied floor, hazards and entry hooks. Model position
and hero tile tracking update immediately. Remote friend positions remain owned
by their peers; each receiving peer clears its own hero when applying the shared
tile update. Unoccupied heroes stay in place. Reward positions and contents
remain authored, and normal A interaction still claims the reward once.

The regression scenario covers native sword kills revealing the Turning Room
boomerang and Chain Vault grapple, ordinary movement afterward, actual A,
repeat claims, save/load, all ten authored hidden chest markers at both centre
and radius overlap, derived chest metadata, and Mira and Tern sharing a reveal
location. Teleports, removed unrelated enemies, stationary one-HP final guards
and recruited companion placement are disclosed isolation fixtures. A separate
fresh-title Barrow victory protects the ordinary campaign route.

The local RTC driver uses Chromium and Firefox with a guest occupying the
reward floor when the host kills its final guard through native sword input.
It checks shared reveal clearance, guest movement, guest A, once-only rewards
and host departure. Public signaling and separate-network ICE are outside this
focused check. Every test disconnects audio output before navigation.

An already trapped hero on the older build can recover through the actual Save
Slot / Load Slot API, preserving progress and allowing the room arrival
clearance to find safe floor. The scenario also tests this legacy save case.

Receipts live in `playtest-out/chest-clearance-regression-final-20261003`,
`playtest-out/chest-clearance-coop-accepted-20261003`,
`playtest-out/chest-clearance-offline-20261003` and
`playtest-out/chest-clearance-review/static.html`. Each acceptance packet records
its exact source fingerprint and fixture scope. This is a bounded bug fix;
the broader adventure task remains paused at the user's stopping point.
