import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { registerPlayHook } from '../../systems/flow.js';
import { ownedSwords, equippedId, equipSword, bladeStats, bladeSize } from '../../game/swords.js';
import { registerUiPart, requestUi, COLORS } from '../canvas/gfx.js';

let open = false, selectedId = null;
const selection = list => Math.max(0, list.findIndex(s => s.id === selectedId));
const select = id => { selectedId = id; requestUi(); };
const move = delta => {
  const list = ownedSwords();
  if (list.length) select(list[(selection(list) + delta + list.length) % list.length].id);
};
const equip = () => {
  const sword = ownedSwords()[selection(ownedSwords())];
  if (sword) { equipSword(sword.id); requestUi(); }
};
export function openEquipment() {
  if (!open && ['play', 'paused'].includes(state.mode)) pushMode('inventory');
}
export function closeEquipment() { if (state.mode === 'inventory') popMode(); }
export const equipmentView = () => ({ open, selectedId, equippedId: equippedId(), owned: ownedSwords().map(s => s.id) });

registerPlayHook({ id: 'equipment-input', phase: 'input', update() { if (input.pressed('inventory')) openEquipment(); } });
registerMode('inventory', {
  enter() { open = true; selectedId = equippedId() ?? ownedSwords()[0]?.id ?? null; requestUi(); },
  exit() { open = false; requestUi(); },
  update() {
    if (input.pressed('cancel') || input.pressed('inventory')) { closeEquipment(); return; }
    // Enter is both Start and Confirm. Inside this menu it equips the blade.
    if (input.pressed('confirm')) { equip(); return; }
    if (input.pressed('menu')) { closeEquipment(); return; }
    const dir = input.menuDir();
    if (dir === 'down' || dir === 'right' || input.pressed('next-item')) move(1);
    if (dir === 'up' || dir === 'left' || input.pressed('prev-item')) move(-1);
  },
});

registerUiPart({
  id: 'equipment-menu', order: 85,
  key: () => open ? JSON.stringify([selectedId, state.swords, state.gear, state.hp, state.maxHp, state.profile.trait]) : '-',
  draw(g) {
    if (!open) return;
    const list = ownedSwords(), selected = selection(list), compact = g.h < 200;
    const width = Math.min(360, g.w - g.safe.l - g.safe.r - 20), height = Math.min(252, g.h - g.safe.t - g.safe.b - 16);
    const x = g.safe.l + Math.round((g.w - g.safe.l - g.safe.r - width) / 2);
    const y = g.safe.t + Math.round((g.h - g.safe.t - g.safe.b - height) / 2), inner = width - 20;
    const rowH = compact ? 23 : 30, top = y + 29, footer = y + height - 23;
    const capacity = Math.max(1, Math.floor((height - (compact ? 53 : 115)) / rowH));
    const first = Math.max(0, Math.min(selected - Math.floor(capacity / 2), list.length - capacity));
    g.rect(0, 0, g.w, g.h, 'rgba(8,17,24,0.75)');
    g.hit('equipment-scrim', 0, 0, g.w, g.h, closeEquipment);
    g.panel(x, y, width, height, { accent: true }); g.hit('equipment-panel', x, y, width, height, () => {});
    g.text('EQUIPMENT', x + 10, y + 12, { color: COLORS.gold, tracking: 1 });
    const visible = list.slice(first, first + capacity);
    visible.forEach((sword, row) => {
      const ry = top + row * rowH, chosen = sword.id === selectedId, ready = sword.id === equippedId();
      const stats = bladeStats({ id: sword.id }), size = bladeSize(stats);
      g.panel(x + 10, ry, inner, rowH - 3, { shadow: false, fill: chosen ? 'rgba(241,194,50,0.18)' : COLORS.panel, line: chosen ? COLORS.gold : COLORS.line });
      g.text(g.fit(sword.name, inner - (ready ? 39 : 8)), x + 14, ry + 3, { color: chosen ? COLORS.ink : COLORS.muted });
      if (ready) g.text('Ready', x + width - 14, ry + 3, { align: 'right', color: COLORS.gold });
      g.text(g.fit(`Hit ${stats.strength} / reach ${size.reach.toFixed(1)}`, inner - 8), x + 14, ry + 12, { color: COLORS.muted });
      g.hit(`equipment-blade-${sword.id}`, x + 10, ry, inner, rowH - 3, () => select(sword.id));
    });
    let cy = top + visible.length * rowH + 3;
    if (!list.length) {
      for (const line of g.wrap('Find your first blade at the castle.', inner)) { g.text(line.text, x + 10, cy, { color: COLORS.muted }); cy += 11; }
    } else if (!compact) {
      const sword = list[selected], detail = g.wrap(sword.description, inner);
      for (const line of detail.slice(0, Math.min(3, Math.max(0, Math.floor((footer - cy - 39) / 11))))) {
        g.text(line.text, x + 10, cy, { color: COLORS.muted }); cy += 11;
      }
      cy += 4;
      const boots = state.gear.boots === 'boots-swamp' ? 'Swamp Boots' : state.gear.boots ? 'Sprint Boots' : 'No boots';
      const ring = state.gear.ring === 'ring-half' ? 'Half-damage ring' : state.gear.ring ? 'Guard ring' : 'No ring';
      const gear = g.wrap(`Shield ${state.gear.shield} / ${boots} / ${ring}`, inner);
      for (const line of gear.slice(0, Math.max(0, Math.floor((footer - cy - 4) / 11)))) { g.text(line.text, x + 10, cy, { color: COLORS.gold }); cy += 11; }
    }
    if (list.length) g.button('equipment-equip', equippedId() === list[selected].id ? 'Ready' : 'Equip', x + 10, footer, equip, { hitPad: 1 });
    g.button('equipment-close', 'Back', x + width - g.buttonMetrics('Back').w - 10, footer, closeEquipment, { hitPad: 1 });
  },
});
