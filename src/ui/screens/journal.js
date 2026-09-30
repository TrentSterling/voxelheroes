import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { registerPlayHook } from '../../systems/flow.js';
import { errandEntries } from '../../game/errands.js';
import { objectiveText } from '../../game/objective.js';
import { registerUiPart, requestUi, COLORS } from '../canvas/gfx.js';

let open = false, selected = 0;
const priority = { ready: 0, active: 1, offer: 2, done: 3 };
const entries = () => errandEntries().sort((a, b) => priority[a.status] - priority[b.status]);
export function openJournal() { if (!open && state.mode === 'play') pushMode('journal'); }
export function closeJournal() { if (state.mode === 'journal') popMode(); }
export const journalView = () => ({ open, selected, entries: entries(), objective: objectiveText() });
const move = delta => { selected = (selected + delta + entries().length) % entries().length; requestUi(); };

registerPlayHook({ id: 'journal-input', phase: 'input', update() { if (input.pressed('journal')) openJournal(); } });
registerMode('journal', {
  enter() { open = true; selected = 0; requestUi(); },
  exit() { open = false; requestUi(); },
  update() {
    if (input.pressed('journal') || input.pressed('cancel') || input.pressed('menu')) { closeJournal(); return; }
    const dir = input.menuDir();
    if (dir === 'down' || dir === 'right' || input.pressed('next-item')) move(1);
    if (dir === 'up' || dir === 'left' || input.pressed('prev-item')) move(-1);
  },
});
registerUiPart({
  id: 'journal-entry', order: 64, key: () => state.mode,
  draw(g) { if (state.mode === 'play') g.button('journal-open', 'Journal', g.w - g.safe.r - g.measure('Journal') - 24, g.safe.t + 52, openJournal); },
});
registerUiPart({
  id: 'journal-menu', order: 85,
  key: () => open ? JSON.stringify([selected, entries(), objectiveText()]) : '-',
  draw(g) {
    if (!open) return;
    const list = entries(), entry = list[selected], width = Math.min(390, g.w - 20);
    const narrow = width < 290;
    const x = Math.round((g.w - width) / 2), padding = 12;
    const heading=g.wrap('ADVENTURE JOURNAL',width-24,1,1);
    const goal = g.wrap(objectiveText(), width - 24);
    const detailWidth = narrow ? width - 24 : width - 174;
    const detail = g.wrap(entry.detail, detailWidth);
    const detailHeight = 48 + detail.length * 11 + 28;
    const height = Math.min(g.h - 12, 40 +(heading.length-1)*11+ goal.length * 11 + Math.max(narrow ? 0 : 94, detailHeight) + 26);
    const y = Math.max(6, Math.round((g.h - height) / 2));
    g.rect(0, 0, g.w, g.h, 'rgba(8,17,13,0.7)');
    g.hit('journal-scrim', 0, 0, g.w, g.h, closeJournal);
    g.panel(x, y, width, height, { accent: true }); g.hit('journal-panel', x, y, width, height, () => {});
    heading.forEach((l,i)=>g.text(l.text,x+padding,y+12+i*11,{color:COLORS.gold,tracking:1}));
    let cy = y + 19+heading.length*11;
    for (const line of goal) { g.text(line.text, x + padding, cy, { color: COLORS.muted }); cy += 11; }
    cy += 10;
    let dx = x + padding;
    if (!narrow) {
      list.forEach((item, index) => {
        g.button(`journal-task-${index}`, g.fit(item.title, 132), x + 12, cy + index * 15, () => { selected = index; requestUi(); }, { on: index === selected });
      });
      dx = x + 164;
      g.rect(dx - 9, cy, 1, Math.min(92, height - (cy - y) - 29), COLORS.line);
    }
    g.text(g.fit(entry.title, detailWidth), dx, cy, { color: COLORS.ink }); cy += 14;
    g.text(g.fit(`${entry.giver} / ${entry.where}`, detailWidth), dx, cy, { color: COLORS.muted }); cy += 16;
    for (const line of detail) { g.text(line.text, dx, cy, { color: COLORS.muted }); cy += 11; }
    cy += 8;
    g.text(g.fit(entry.progress, detailWidth), dx, cy, { color: entry.status === 'ready' ? COLORS.gold : COLORS.ink }); cy += 13;
    g.text(g.fit(`Reward: ${entry.reward}`, detailWidth), dx, cy, { color: COLORS.gold });
    const bottom = y + height - 20;
    g.button('journal-prev', '<', x + 12, bottom, () => move(-1));
    g.text(`${selected + 1} / ${list.length}`, x + 38, bottom + 3, { color: COLORS.muted });
    g.button('journal-next', '>', x + 74, bottom, () => move(1));
    g.button('journal-close', 'Close', x + width - 53, bottom, closeJournal);
  },
});
