import { hasFlag, setFlag } from '../core/state.js';
import { grant, registerGrant } from './grants.js';
import { modelMesh } from '../models/kit.js';
import { tobinKeepsakeModel } from '../models/village-quests.js';

registerGrant('tobin-keepsake', () => {
  if (hasFlag('errand:tobin:keepsake')) return;
  setFlag('errand:tobin:keepsake');
  grant('heart-piece', 1, { source: 'chest', fanfare: false });
}, { name: 'Tobin\'s Keepsake', fanfare: true, model: () => modelMesh(tobinKeepsakeModel()),
  text: 'Tobin\'s Keepsake + a piece of heart!' });
