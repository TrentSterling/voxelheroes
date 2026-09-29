// The "Next:" objective line (fun audit): a HUD widget, so it only asks to redraw when the current
// step changes (ui/hud.js's widget contract) and gets the same small hop a HUD number gets.
import { registerHudWidget, popHud } from '../hud.js';
import { objectiveId, objectiveText } from '../../game/objective.js';
import { COLORS } from '../canvas/gfx.js';

const LABEL = 'Next: ';

registerHudWidget({
  id: 'objective',
  region: 'center', // under the area name
  order: 20,
  key: () => objectiveId(),
  render: () => popHud('objective'),
  measure(g, s, maxW) {
    const t = g.fit(objectiveText(), maxW - g.measure(LABEL));
    return [g.measure(LABEL) + g.measure(t) + 2, 9];
  },
  draw(g, s, x, y, w) {
    const o = { outline: COLORS.shade };
    g.text(LABEL, x + 1, y + 1, { color: COLORS.gold, ...o });
    g.text(g.fit(objectiveText(), w - g.measure(LABEL) - 2), x + 1 + g.measure(LABEL), y + 1, { color: COLORS.ink, ...o });
  },
});
