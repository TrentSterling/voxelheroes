import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { registerPlayHook } from '../../systems/flow.js';
import { objectiveText, questEntries, trackedQuestId, trackQuest } from '../../game/objective.js';
import { registerUiPart, requestUi, COLORS } from '../canvas/gfx.js';
import { journalShortcutLayout } from '../shortcuts.js';

let open = false, selectedId = null, requestedId = null, detailPage = 0, detailPages = 1, shownDetail = '';
const priority = { ready: 0, active: 1, offer: 2, done: 3 };
const entries = () => questEntries().sort((a, b) => priority[a.status] - priority[b.status]);
const selection = list => Math.max(0, list.findIndex(entry => entry.id === selectedId));
export function openJournal(id = null) {
  if (!open && state.mode === 'play') { requestedId = id; pushMode('journal'); }
}
export function closeJournal() { if (state.mode === 'journal') popMode(); }
export const journalView = () => { const list = entries(); return { open, selected: selection(list), selectedId, trackedId: trackedQuestId(), detailPage, detailPages, shownDetail, entries: list, objective: objectiveText() }; };
const select = id => { selectedId = id; detailPage = 0; requestUi(); };
const move = delta => { const list = entries(); select(list[(selection(list) + delta + list.length) % list.length].id); };
const readMore = () => { detailPage = (detailPage + 1) % detailPages; requestUi(); };

registerPlayHook({ id: 'journal-input', phase: 'input', update() { if (input.pressed('journal')) openJournal(); } });
registerMode('journal', {
  enter() { open = true; selectedId = requestedId ?? trackedQuestId() ?? entries()[0].id; requestedId = null; detailPage = 0; requestUi(); },
  exit() { open = false; requestUi(); },
  update() {
    if (input.pressed('journal') || input.pressed('cancel') || input.pressed('menu')) { closeJournal(); return; }
    const dir = input.menuDir();
    if (dir === 'down' || dir === 'right' || input.pressed('next-item')) move(1);
    if (dir === 'up' || dir === 'left' || input.pressed('prev-item')) move(-1);
    if (input.pressed('confirm') && detailPages > 1) readMore();
  },
});
registerUiPart({
  id: 'journal-entry', order: 64, key: () => state.mode,
  draw(g) { const layout = journalShortcutLayout(g); if (layout) g.button(layout.id, layout.label, layout.x, layout.y, openJournal); },
});
registerUiPart({
  id: 'journal-menu', order: 85,
  key: () => open ? JSON.stringify([selectedId, detailPage, trackedQuestId(), entries(), objectiveText()]) : '-',
  draw(g) {
    if (!open) return;
    const list = entries(), selected = selection(list), entry = list[selected], tracked = trackedQuestId(), width = Math.min(390, g.w - 20);
    const narrow = width < 290 || g.h < 260;
    const x = Math.round((g.w - width) / 2), padding = 12;
    const heading=g.wrap('ADVENTURE JOURNAL',width-24,1,1);
    const compact = g.h < 200;
    const goalText = tracked === entry.id ? 'Tracking this task' : objectiveText();
    // Short landscape frames need the row for the actual quest paragraph.
    // The same objective remains available in the HUD after closing the journal.
    const goal = compact ? [] : g.wrap(goalText, width - 24);
    const detailWidth = narrow ? width - 24 : width - 174;
    const detail = g.wrap(entry.detail, detailWidth);
    const detailHeight = 48 + detail.length * 11 + 28;
    const height = Math.min(g.h - 12, 40 +(heading.length-1)*11+ goal.length * 11 + Math.max(narrow ? 0 : list.length * 15 + 16, detailHeight) + 44);
    const y = Math.max(6, Math.round((g.h - height) / 2));
    g.rect(0, 0, g.w, g.h, 'rgba(8,17,13,0.7)');
    g.hit('journal-scrim', 0, 0, g.w, g.h, closeJournal);
    g.panel(x, y, width, height, { accent: true }); g.hit('journal-panel', x, y, width, height, () => {});
    heading.forEach((l,i)=>g.text(l.text,x+padding,y+12+i*11,{color:COLORS.gold,tracking:1}));
    let cy = y + 19+heading.length*11;
    for (const line of goal) { g.text(line.text, x + padding, cy, { color: COLORS.muted }); cy += 11; }
    cy += compact ? 6 : 10;
    const twoRows = width < 200;
    const trackY = y + height - (twoRows ? 54 : 38);
    const bottom = trackY + 18;
    let dx = x + padding;
    if (!narrow) {
      const capacity = Math.max(1, Math.floor((trackY - cy - 3) / 15));
      const first = Math.max(0, Math.min(selected - Math.floor(capacity / 2), list.length - capacity));
      list.slice(first, first + capacity).forEach((item, row) => {
        const index = first + row;
        g.button(`journal-task-${index}`, g.fit(item.title, 132), x + 12, cy + row * 15, () => select(item.id), { on: index === selected, hitPad: 1 });
      });
      dx = x + 164;
      g.rect(dx - 9, cy, 1, Math.min(92, height - (cy - y) - 29), COLORS.line);
    }
    for (const line of g.wrap(entry.title, detailWidth)) { g.text(line.text, dx, cy, { color: COLORS.ink }); cy += 11; }
    cy += 3;
    g.text(g.fit(`${entry.giver} / ${entry.where}`, detailWidth), dx, cy, { color: COLORS.muted }); cy += compact ? 12 : 16;
    // Reserve progress, reward and navigation before allocating paragraph rows.
    const reward = g.wrap(`Reward: ${entry.reward}`, detailWidth);
    const progressY = trackY - 16 - reward.length * 11;
    const rows = Math.max(1, Math.floor((progressY - 8 - cy) / 11));
    detailPages = Math.max(1, Math.ceil(detail.length / rows));
    detailPage = Math.min(detailPage, detailPages - 1);
    const visible = detail.slice(detailPage * rows, (detailPage + 1) * rows);
    shownDetail = visible.map(line => line.text).join(' ');
    for (const line of visible) { g.text(line.text, dx, cy, { color: COLORS.muted }); cy += 11; }
    g.text(g.fit(entry.progress, detailWidth), dx, progressY, { color: entry.status === 'ready' ? COLORS.gold : COLORS.ink });
    reward.forEach((line, index) => g.text(line.text, dx, progressY + 13 + index * 11, { color: COLORS.gold }));
    if (entry.status !== 'done') g.button('journal-track', tracked === entry.id ? 'Untrack' : 'Track', x + 12, trackY, () => { trackQuest(tracked === entry.id ? null : entry.id); requestUi(); }, { on: tracked === entry.id, hitPad: 1 });
    else g.text('Completed', x + 12, trackY + 3, { color: COLORS.muted });
    if (tracked) g.button('journal-auto', 'Auto', x + width - 46, trackY, () => { trackQuest(null); requestUi(); }, { hitPad: 1 });
    g.button('journal-prev', '<', x + 12, bottom, () => move(-1), {hitPad:1});
    g.text(`${selected + 1} / ${list.length}`, x + 38, bottom + 3, { color: COLORS.muted });
    g.button('journal-next', '>', x + 74, bottom, () => move(1), {hitPad:1});
    if (detailPages > 1) g.button('journal-detail-next', `Read ${detailPage + 1}/${detailPages}`, x + (twoRows ? 12 : 100), bottom + (twoRows ? 16 : 0), readMore, {hitPad:1});
    g.button('journal-close', 'Close', x + width - 53, bottom + (twoRows ? 16 : 0), closeJournal, {hitPad:1});
  },
});
