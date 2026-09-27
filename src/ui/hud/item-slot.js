// HUD slot for the item on B, with its ammo count. Hidden (along with the
// touch B button) until the inventory holds a selectable item.
import './item-slot.css';
import { selectedItem, selectableItems, ammo } from '../../items/inventory.js';
import { registerHudWidget } from '../hud.js';
import { $, el } from '../dom.js';

let slot = null;

registerHudWidget({
  id: 'item-slot',
  region: 'right',
  order: 20,
  mount({ host }) {
    slot = {
      root: el('div', { id: 'item-slot', class: 'item-slot', 'aria-label': 'Item on B', hidden: true }),
      icon: el('span', { class: 'item-slot-icon', 'aria-hidden': 'true' }),
      ammo: el('span', { class: 'item-slot-ammo' }),
    };
    slot.root.append(el('span', { class: 'item-slot-button', 'aria-hidden': 'true' }, 'B'), slot.icon, slot.ammo);
    host.append(slot.root);
  },
  key: () => {
    const item = selectedItem();
    return `${selectableItems().length}|${item?.id}|${item?.ammo ? ammo(item.ammo) : ''}`;
  },
  render() {
    const item = selectedItem();
    const show = !!item && selectableItems().length > 0;
    slot.root.hidden = !show;
    const b = $('btn-b');
    if (b) b.hidden = !show;
    if (!show) return;
    slot.root.setAttribute('aria-label', `Item on B: ${item.name}`);
    slot.icon.innerHTML = typeof item.icon === 'function' ? item.icon() : item.icon;
    slot.ammo.hidden = !item.ammo;
    slot.ammo.textContent = item.ammo ? String(ammo(item.ammo)) : '';
  },
});
