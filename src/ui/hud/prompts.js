// Contextual A/B labels finally drawn in the game's canvas, including Lift and Throw.
import { currentPrompts } from '../../game/prompts.js';
import { registerUiPart, COLORS } from '../canvas/gfx.js';
import { companionHintVisible, companionHintUsesItem } from './companion.js';
import { toastView } from '../toast.js';
import { bannerView } from '../banner.js';

let shown = [];
export const promptView = () => shown.map((p) => ({ ...p }));
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

registerUiPart({
  id: 'prompts', order: 15,
  key: () => JSON.stringify(currentPrompts()),
  draw(g) {
    shown = [];
    if (coarse && bannerView().visible) return;
    let width = 0;
    const maxWidth = g.w - g.safe.l - g.safe.r - 24;
    for (const p of currentPrompts()) {
      if (coarse && g.h < 200 && p.action === 'sword' && toastView().visible) continue;
      if (coarse && g.h < 200 && p.id === 'sword' && companionHintVisible(g)) continue;
      if (coarse && g.h < 200 && p.id === 'item' && (toastView().visible || (companionHintUsesItem() && companionHintVisible(g)))) continue;
      const label = `${p.button}  ${p.label}`;
      const w = g.measure(label) + 14;
      if (width + w > maxWidth) continue;
      shown.push({ ...p, text: label, w });
      width += w + 6;
    }
    if (!shown.length) return;
    width -= 6;
    let x = Math.round((g.w - width) / 2);
    const y = g.h - g.safe.b - (coarse ? 100 : 25);
    for (const p of shown) {
      g.panel(x, y, p.w, 16, { shadow: false });
      g.text(p.button, x + 6, y + 4, { color: COLORS.gold });
      g.text(p.label, x + 6 + g.measure(`${p.button}  `), y + 4, { color: COLORS.ink });
      p.x = x; p.y = y;
      x += p.w + 6;
    }
  },
});
