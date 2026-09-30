// HUD slot for the item on B, with its ammo count. Hidden (along with the touch B button) until
// the inventory holds a selectable item.
import { selectedItem, selectableItems, ammo } from '../../items/inventory.js';
import { registerHudWidget } from '../hud.js';
import { COLORS } from '../canvas/gfx.js';
import { svgIcon } from '../canvas/sprites.js';
import { $ } from '../dom.js';
import { state } from '../../core/state.js';
import { spellCost } from '../../game/spells.js';

const shown = () => (selectedItem() && selectableItems().length > 0 ? selectedItem() : null);
const ammoText = (item) => (item?.ammo ? String(ammo(item.ammo)) : '');

registerHudWidget({
  id: 'item-slot',
  region: 'counters',
  order: 20,
  key: () => {
    const item = selectedItem();
    return `${selectableItems().length}|${item?.id}|${item?.ammo ? ammo(item.ammo) : ''}|${state.magic}|${state.maxMagic}|${item?.kind==='spell'?spellCost(item.id):''}`;
  },
  render() {
    const b = $('btn-b'); // the touch pad's B button follows the slot
    if (b) b.hidden = !shown();
  },
  measure: (g) => {
    const item = shown();
    if (!item) return null;
    const a = ammoText(item);
    return [26 + (a ? g.measure(a) + 5 : 0), item.kind==='spell'?38:26];
  },
  draw(g, s, x, y) {
    const item = shown();
    g.panel(x, y, 26, 26, { shadow: false });
    // the B button badge, top left
    g.rect(x - 3, y - 3, 9, 9, COLORS.edge);
    g.rect(x - 2, y - 2, 7, 7, COLORS.gold);
    g.text('B', x, y - 1, { color: '#1c1405' });
    const icon = typeof item.icon === 'function' ? item.icon() : item.icon;
    if(icon){const sprite=svgIcon(icon),size=Math.max(1,Math.min(2,Math.floor(22/Math.max(sprite.width,sprite.height))));g.sprite(sprite,x+Math.floor((26-sprite.width*size)/2),y+Math.floor((26-sprite.height*size)/2),size);}
    const a = ammoText(item);
    if (a) g.text(a, x + 31, y + 10, { color: COLORS.ink, outline: COLORS.shade });
    if(item.kind==='spell'){
      const cost=spellCost(item.id);
      g.text(`${cost}MP`,x+2,y+29,{color:s.magic>=cost?'#86dde1':'#e28b86',outline:COLORS.shade});
    }
  },
});
