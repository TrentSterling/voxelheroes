import { state } from '../../core/state.js';
import { player } from '../../entities/player.js';
import { companionView, CLOCKWORK, SHELTER, STEAMWHEEL } from '../../game/companions.js';
import { input } from '../../core/input.js';
import { buttonLabel, currentPrompts } from '../../game/prompts.js';
import { registerUiPart, COLORS } from '../canvas/gfx.js';
import { playShortcutBounds } from '../shortcuts.js';
import { hudBounds } from '../hud.js';
import { bannerView } from '../banner.js';
import { toastView } from '../toast.js';
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export function companionHintUsesItem(c = companionView()) {
  return c.steamUnlocked && c.steamSelected && c.nearby && c.maraNearby;
}

export function companionHintVisible(g) {
  const c = companionView();
  if (state.mode !== 'play' || (!c.unlocked && !c.steamUnlocked) || (!c.nearby && !c.ternNearby && c.wardT <= 0)) return false;
  // Technique feedback owns this slot while its toast is visible. Resume the
  // status panel after the feedback fades, including on keyboard layouts.
  if (toastView().visible) return false;
  // In touch landscape, this hint replaces the plain Sword label. Keep
  // interaction prompts and arrival titles ahead of optional technique help.
  return !(coarse && g.h < 200 && (bannerView().visible || currentPrompts().some(p => p.id !== 'sword' && !(p.id === 'item' && companionHintUsesItem(c)))));
}

// Camera composition and drawing use the same reserved technique slot.
export function companionHintBounds(g) {
  const compact = coarse && g.h < 200;
  let w = Math.min(compact ? 100 : 220, g.w - g.safe.l - g.safe.r - 24), x = Math.round((g.w - w) / 2);
  if (compact) {
    let left = g.safe.l + 8, right = g.w - g.safe.r - 8;
    for (const r of [...hudBounds(g), ...playShortcutBounds(g)]) {
      if (r.y >= g.safe.t + 67 || r.y + r.h <= g.safe.t + 40) continue;
      if (r.x + r.w <= g.w / 2) left = Math.max(left, r.x + r.w + 4);
      else right = Math.min(right, r.x - 4);
    }
    w = Math.min(w, Math.max(1, right - left));
    x = Math.max(left, Math.min(x, right - w));
  }
  return { x,
    y: compact ? g.safe.t + 40 : Math.max(g.safe.t + 70, g.h - g.safe.b - (coarse ? 140 : 60)), w, h: 27 };
}

registerUiPart({
  id: 'companion-tech', order: 14,
  key: () => { const c = companionView(); return [state.mode, c.unlocked, c.nearby, c.ternNearby, c.maraNearby, c.steamUnlocked, c.steamSelected, c.ready, Math.ceil(c.cooldown), Math.ceil(c.shelterCooldown), Math.ceil(c.steamCooldown), Math.ceil(c.wardT), input.held('guard'), player.charge?.ready, state.magic, buttonLabel('sword'), buttonLabel('guard'), buttonLabel('item'), bannerView().visible, toastView().visible, JSON.stringify(currentPrompts())].join('|'); },
  draw(g) {
    const c = companionView();
    if (!companionHintVisible(g)) return;
    const compact = coarse && g.h < 200;
    const steam = companionHintUsesItem(c) && c.wardT <= 0;
    const shelter = !steam && (c.wardT > 0 || (c.ternNearby && (input.held('guard') || !c.nearby)));
    const technique = steam ? STEAMWHEEL : shelter ? SHELTER : CLOCKWORK;
    const cooldown = steam ? c.steamCooldown : shelter ? c.shelterCooldown : c.cooldown;
    const { x, y, w } = companionHintBounds(g);
    g.panel(x, y, w, 27, { shadow: false });
    g.text(g.fit(technique.name, w - 12), x + 6, y + 5, { color: COLORS.gold });
    const detail = shelter && c.wardT > 0 ? `Sheltered ${Math.ceil(c.wardT)}s` : cooldown > 0 ? `Recharging ${Math.ceil(cooldown)}s` : state.magic < technique.cost ? `Needs ${technique.cost} magic` : steam ? `Hold ${buttonLabel('guard')} + ${buttonLabel('item')} (3 MP)` : shelter ? `Hold ${buttonLabel('guard')} + ${buttonLabel('sword')} (2 MP)` : player.charge?.ready ? 'Release for Cross' : compact ? `Charge ${buttonLabel('sword')} (2 MP)` : `Hold ${buttonLabel('sword')}; release: 2 MP`;
    g.text(g.fit(detail, w - 12), x + 6, y + 15, { color: COLORS.ink });
  },
});
