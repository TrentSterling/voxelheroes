// Placeholder loading cards for the M1 areas. The overworld and dungeon
// streams replace them with their own (one file each in this folder); look
// paints the art named by `art`.
import { registerLoadingCard } from '../game/cards.js';

registerLoadingCard({ id: 'card-overworld', title: 'The Open Country', art: 'overworld', areas: ['overworld'], order: 10 });
registerLoadingCard({ id: 'card-crypt', title: 'Cairn Crypt', art: 'crypt', areas: ['crypt'], order: 20, text: 'Small keys found here open only doors down here.' });
registerLoadingCard({ id: 'card-road', title: 'On the Road', art: 'road', areas: '*', order: 999 });
