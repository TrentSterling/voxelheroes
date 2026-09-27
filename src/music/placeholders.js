// Silent placeholder tracks, so areas, dungeons and bosses can name their
// music before M6 writes it. The overworld stream owns this folder.
import { registerMusic } from '../game/music.js';

registerMusic({ id: 'title', name: 'Title' });
registerMusic({ id: 'overworld', name: 'Open Country' });
registerMusic({ id: 'village', name: 'Village' });
registerMusic({ id: 'dungeon', name: 'Down Below' });
registerMusic({ id: 'boss', name: 'Boss' });
