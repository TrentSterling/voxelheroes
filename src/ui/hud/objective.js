// The "Next:" objective line (fun audit): a HUD widget, so it only asks to redraw when the current
// step changes (ui/hud.js's widget contract) and gets the same small hop a HUD number gets.
import { registerHudWidget, popHud } from '../hud.js';
import { objectiveId, objectiveHudText, currentStep, trackedQuestId } from '../../game/objective.js';
import { openJournal } from '../screens/journal.js';
import { COLORS } from '../canvas/gfx.js';

const label = () => trackedQuestId() ? 'Quest: ' : 'Next: ';
const lines = (g, width) => {
  const text = label() + objectiveHudText();
  if (trackedQuestId() && g.h < 200) return [{ text: g.fit(text, width) }];
  const wrapped = g.wrap(text, width);
  return wrapped.length > 2 ? [wrapped[0], { text: g.fit(wrapped.slice(1).map(line => line.text).join(' '), width) }] : wrapped;
};

registerHudWidget({
  id: 'objective',
  region: 'center', // under the area name
  order: 20,
  key: () => `${objectiveId()}|${objectiveHudText()}|${trackedQuestId()}`,
  render: () => popHud('objective'),
  measure(g, s, maxW) {
    const rows = lines(g, maxW - 2);
    return [Math.max(...rows.map(row => g.measure(row.text))) + 2, rows.length * 11 - 2];
  },
  draw(g, s, x, y, w) {
    const o = { outline: COLORS.shade };
    const lead = label();
    const rows = lines(g, w - 2);
    rows.forEach((row, index) => {
      const cy = y + 1 + index * 11;
      if (index === 0) {
        g.text(lead, x + 1, cy, { color: COLORS.gold, ...o });
        g.text(row.text.slice(lead.length), x + 1 + g.measure(lead), cy, { color: COLORS.ink, ...o });
      } else g.text(row.text, x + 1, cy, { color: COLORS.ink, ...o });
    });
    g.hit('objective-open', x, y, w, rows.length * 11 - 2, () => openJournal(currentStep()?.questId));
  },
});
