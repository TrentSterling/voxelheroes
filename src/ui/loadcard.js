// The loading card (gameplay spec 4.4, game/cards.js): shown on the black of
// a load, from 'area-enter' until play resumes in the new area
// ('room-enter'). It sits inside #fade, so it fades in and out with the
// black. The card's art shows when the loadingArt option is on and the card
// has an image; otherwise its title and text on a plain card.
import { on } from '../core/events.js';
import { state } from '../core/state.js';
import { cardForArea, markCardSeen } from '../game/cards.js';
import { $ } from './dom.js';

let shownCard = null;

export const loadCardView = () => ({ visible: !!shownCard, id: shownCard?.id ?? null, title: shownCard?.title ?? '' });

export function initLoadCard() {
  on('area-enter', ({ area }) => {
    const card = cardForArea(area.id);
    const el = $('load-card');
    if (!el) return;
    $('load-card-title').textContent = card?.title ?? area.name ?? area.id;
    $('load-card-text').textContent = card?.text ?? '';
    const img = $('load-card-art');
    const art = state.settings.loadingArt !== false && typeof card?.art === 'string' ? card.art : null;
    img.hidden = !art;
    if (art) img.src = art;
    el.hidden = false;
    shownCard = card ?? { id: null, title: area.name ?? area.id };
    if (card) markCardSeen(card.id);
  });
  on('room-enter', () => {
    if (!shownCard) return;
    shownCard = null;
    const el = $('load-card');
    if (el) el.hidden = true;
  });
}
