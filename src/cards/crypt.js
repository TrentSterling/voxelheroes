// The loading card of the M1 crypt (dungeon 0). Owner: dungeon (a dungeon's
// cards live in cards/<dungeon>.js).
import { registerLoadingCard } from '../game/cards.js';

registerLoadingCard({ id: 'card-crypt', title: 'Cairn Crypt', areas: ['crypt'], order: 20, text: 'Small keys found here open only doors down here.' });
