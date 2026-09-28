// Loading cards for the M1 overworld and the fallback card. Owner: overworld
// (docs/CONTRACTS.md, "Ownership"). Card ids are never replaced (cards.js
// throws on a duplicate), so a stream adds its own cards in its own file in
// this folder (the dungeon's crypt card is in cards/crypt.js) and never adds
// a '*' card in M2: card-road, order 999, stays the one fallback. `art` is
// null until the card's owner makes one (the ui then draws a card with the
// title and text only).
import { registerLoadingCard } from '../game/cards.js';

registerLoadingCard({ id: 'card-overworld', title: 'The Open Country', areas: ['overworld'], order: 10 });
registerLoadingCard({ id: 'card-road', title: 'On the Road', areas: '*', order: 999 });
registerLoadingCard({ id: 'card-castle', title: 'Crownhold', areas: ['ow-4-3'], order: 11, text: 'The castle and its pastures.' });
registerLoadingCard({ id: 'card-v1', title: 'Mossbrook', areas: ['v1'], order: 12, text: 'Rest at the inn, and it is there you will wake.' });
registerLoadingCard({ id: 'card-ow-3-2', title: 'Barrowfield', areas: ['ow-3-2', 'cave-barrow'], order: 13, text: 'The old barrow lies to the south.' });
