// The "Next:" objective line (fun audit): a HUD widget, so it redraws only
// when the current step changes (ui/hud.js's widget contract) and gets the
// same small flourish a HUD number gets on a change (hud.js's pop(), kept
// local here since only this widget needs it).
import { registerHudWidget } from '../hud.js';
import { objectiveId, objectiveText } from '../../game/objective.js';
import { el, $ } from '../dom.js';

function pop(node) {
  node.classList.remove('hud-pop');
  void node.offsetWidth;
  node.classList.add('hud-pop');
}

registerHudWidget({
  id: 'objective',
  region: 'center', // under the area name (style.css stacks #hud-center)
  order: 20,
  mount({ host }) {
    host.append(el('div', { id: 'objective', class: 'objective-line' }));
  },
  key: () => objectiveId(),
  render() {
    const node = $('objective');
    node.textContent = `Next: ${objectiveText()}`;
    pop(node);
  },
});
