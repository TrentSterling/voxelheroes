import { registerItem } from './registry.js';
import { prizeMesh } from '../models/items/items.js';
import { emberLensModel } from '../models/brineglass.js';

registerItem({ id: 'ember-lens', name: 'Ember Lens', passive: true, kind: 'passive', order: 41,
  icon: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#e0b876" d="M1 1h6v5H1zM3 6h2v2H3z"/><path fill="#78cbd8" d="M2 2h4v3H2z"/><path fill="#ffba6b" d="M3 2h2v3H3z"/></svg>',
  getText: 'Ember Lens! Each fire bolt now melts two ice blocks. Wake the shore beacon.', model: prizeMesh(emberLensModel) });
