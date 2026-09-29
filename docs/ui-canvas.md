# The canvas UI

Trent hates DOM text in games (Gems Together draws its own interface). Voxel Heroes' whole
interface is drawn by the game in `src/ui/canvas/`: an immediate-mode layer (`gfx.js`) over the
view, our own 5x7 pixel font (`font.js`), outlined sprites (`sprites.js`), hit regions for taps.

Drawn there: the HUD (hearts, coins, keys, area name, Next: line, clock, item slot, Settings and
Sound buttons), the dialog box, the banner, toasts, the title / pause / game-over panel, speech
bubbles over heads, the map, the settings panel (cycle rows, drag sliders, keyboard) and the
loading card.

Still DOM on purpose: the touch pad (`#touch`, multi-touch belongs to `core/input.js`), the black
`#fade` div (no text), the debug cheats panel, and the About block from `seo/about.py` (SEO).

Tests read views, never pixels: `game.hud.hudView()`, `game.ui.uiView()` (`pressUi(id)`,
`dragUi(id, fraction)`), `game.dialog.dialogView()`, `game.overlay.overlayView()`,
`game.banner.bannerView()`, `game.toast.toastView()`, `game.mapScreen.mapView()`,
`game.settingsPanel.settingsView()`, `game.npcFx.bubblesShown()`. Call `__voxelHeroes.render()`
before pressing a region: regions exist only for what the last frame drew. Scenario: `ui.mjs`.
