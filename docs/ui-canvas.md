# The canvas UI

Trent hates DOM text in games (Gems Together draws its own interface). Voxel Heroes' whole
interface is drawn by the game in `src/ui/canvas/`: an immediate-mode layer (`gfx.js`) over the
view, our own 5x7 pixel font (`font.js`), outlined sprites (`sprites.js`), hit regions for taps.

Drawn there: the HUD (hearts, coins, keys, area name, Next: line, clock, item slot, Settings and
Sound buttons), contextual action labels (including Lift pot and Throw pot), the dialog box,
the banner, toasts, the title / pause / game-over panel, speech
bubbles over heads, the map, the settings panel (cycle rows, drag sliders, keyboard) and the
loading card.

The party menu, invite code, roster, and hero name labels are also drawn in the
canvas (`ui/screens/party.js`). An invisible native input supplies text editing,
paste, and mobile keyboards for codes or invite links. It renders no DOM text.

Still DOM on purpose: the touch pad (`#touch`, multi-touch belongs to `core/input.js`), the black
`#fade` div (no text), the debug cheats panel, and the About block from `seo/about.py` (SEO).

Tests read views, never pixels: `game.hud.hudView()`, `game.ui.uiView()` (`pressUi(id)`,
`dragUi(id, fraction)`), `game.dialog.dialogView()`, `game.overlay.overlayView()`,
`game.banner.bannerView()`, `game.toast.toastView()`, `game.mapScreen.mapView()`,
`game.settingsPanel.settingsView()`, `game.npcFx.bubblesShown()`,
`game.promptHud.promptView()`. Call `__voxelHeroes.render()`
before pressing a region: regions exist only for what the last frame drew. Scenario: `ui.mjs`.

Text wraps to the actual inner panel width, including tracking and font size.
`g.buttonMetrics()` supplies both dimensions for wrapped buttons; `primary()`
and `button()` accept `maxWidth`. Narrow title screens stack their actions.
Maps reserve space for their headings, hint and Close button before sizing the
chart. Settings stack labels above controls and page rows when needed. Party
copy and roster rows reflow; full invite codes remain visible.

Large dialogs split an authored page into screenfuls. Confirm fills or advances
the current screenful; final choices appear after the last one. Choices wrap
and selection brings hidden options into view. `dialogView().text` is the
remaining authored text; `shown` is what the current screenful has typed.
`scripts/scenarios/text-layout.mjs` records actual drawn text and panel bounds,
checks five viewport sizes, and verifies that pagination loses no dialog text.
