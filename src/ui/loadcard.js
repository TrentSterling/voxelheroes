// The loading card (gameplay spec 4.4, game/cards.js): shown on the black of
// a load, from 'area-enter' until play resumes in the new area
// ('room-enter'). It is drawn in the UI canvas over the black fade (ui/overlay.js
// keeps the fade level), so it fades in and out with the black. The card's art
// shows when the loadingArt option is on and the card has an image; otherwise
// its title and text on a plain card.
import { on } from '../core/events.js';
import { state } from '../core/state.js';
import { cardForArea, markCardSeen } from '../game/cards.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';
import { cardAlpha } from './overlay.js';

let shownCard = null;
let text = { title: '', body: '', art: null };
const arts = new Map(); // url -> Image

export const loadCardView = () => ({ visible: !!shownCard, id: shownCard?.id ?? null, title: shownCard?.title ?? '' });

function artImage(url) {
  let img = arts.get(url);
  if (!img) {
    img = new Image();
    img.onload = requestUi;
    img.src = url;
    arts.set(url, img);
  }
  return img;
}

export function initLoadCard() {
  on('area-enter', ({ area }) => {
    const card = cardForArea(area.id);
    const art = state.settings.loadingArt !== false && typeof card?.art === 'string' ? card.art : null;
    text = { title: card?.title ?? area.name ?? area.id, body: card?.text ?? '', art };
    shownCard = card ?? { id: null, title: area.name ?? area.id };
    if (card) markCardSeen(card.id);
    requestUi();
  });
  on('room-enter', () => {
    if (!shownCard) return;
    shownCard = null;
    requestUi();
  });
}

registerUiPart({
  id: 'loadcard',
  order: 90, // over everything but the dialog: it sits on the black
  key: () => (shownCard ? `${text.title}|${Math.round(cardAlpha() * 24)}` : '-'),
  draw(g) {
    const a = shownCard ? cardAlpha() : 0;
    if (a <= 0.01) return;
    g.alpha(a);
    const lines = g.wrap(text.body, Math.min(300, g.w - 32));
    const titleLines=g.wrap(text.title,g.w-32,2,1);
    let art = null;
    if (text.art) {
      const img = artImage(text.art);
      if (img.complete && img.naturalWidth) art = img;
    }
    const artH = art ? Math.min(Math.round(g.h * 0.5), art.naturalHeight) : 0;
    const artW = art ? Math.round((art.naturalWidth * artH) / art.naturalHeight) : 0;
    const total = artH + (art ? 10 : 0) + titleLines.length*20 + 8 + lines.length * 11;
    let y = Math.round((g.h - total) / 2);
    if (art) {
      g.image(art, Math.round((g.w - artW) / 2), y, artW, artH);
      y += artH + 10;
    }
    for(const line of titleLines){g.text(line.text,g.w/2,y,{size:2,align:'center',tracking:1,color:'#f2ecd8'});y+=20;}
    y+=8;
    for (const line of lines) {
      g.text(line.text, g.w / 2, y, { align: 'center', color: COLORS.muted });
      y += 11;
    }
  },
});
