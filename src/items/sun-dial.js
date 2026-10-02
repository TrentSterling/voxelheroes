import { registerItem } from './registry.js';
import { prizeMesh } from '../models/items/items.js';
import { sunDialModel } from '../models/watch.js';

registerItem({ id: 'sun-dial', name: 'Sun Dial', passive: true, kind: 'passive', order: 31,
  icon: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#e2b565" d="M2 0h4v1h1v1h1v4H7v1H6v1H2V7H1V6H0V2h1V1h1z"/><path fill="#425c75" d="M2 2h4v4H2z"/><path fill="#8ae6df" d="M3 2h1v2h2v1H3z"/></svg>',
  getText: 'Sun Dial! Your grapple now reaches eight tiles.', model: prizeMesh(sunDialModel) });
