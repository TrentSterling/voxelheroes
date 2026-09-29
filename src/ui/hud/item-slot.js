// HUD slot for the item on B, with its ammo count. Hidden (along with the touch B button) until
// the inventory holds a selectable item.
import { selectedItem, selectableItems, ammo } from '../../items/inventory.js';
import { registerHudWidget } from '../hud.js';
import { COLORS } from '../canvas/gfx.js';
import { svgIcon } from '../canvas/sprites.js';
import { $ } from '../dom.js';

const shown = () => (selectedItem() && selectableItems().length > 0 ? selectedItem() : null);
const ammoText = (item) => (item?.ammo ? String(ammo(item.ammo)) : '');

registerHudWidget({
  id: 'item-slot',
  region: 'slots',
  order: 20,
  key: () => {
    const item = selectedItem();
    return `${selectableItems().length}|${item?.id}|${item?.ammo ? ammo(item.ammo) : ''}`;
  },
  render() {
    const b = $('btn-b'); // the touch pad's B button follows the slot
    if (b) b.hidden = !shown();
  },
  measure: (g) => {
    const item = shown();
    if (!item) return null;
    const a = ammoText(item);
    return [26 + (a ? g.measure(a) + 5 : 0), 26];
  },
  draw(g, s, x, y) {
    const item = shown();
    g.panel(x, y, 26, 26, { shadow: false });
    // the B button badge, top left
    g.rect(x - 3, y - 3, 9, 9, COLORS.edge);
    g.rect(x - 2, y - 2, 7, 7, COLORS.gold);
    g.text('B', x, y - 1, { color: '#1c1405' });
    const icon = typeof item.icon === 'function' ? item.icon() : item.icon;
    if (icon) g.sprite(svgIcon(icon), x + 3, y + 3, 2);
    const a = ammoText(item);
    if (a) g.text(a, x + 31, y + 10, { color: COLORS.ink, outline: COLORS.shade });
  },
});
