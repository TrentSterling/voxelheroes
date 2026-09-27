// Loading cards: the art shown while an area loads (gameplay spec 4.4) and
// the gallery they unlock into (12.2). Card data lives in src/cards/, one
// file per owner (overworld: its areas and the '*' fallback; dungeon: one
// file per dungeon).
//
//   registerLoadingCard({ id: 'card-crypt', title: 'Cairn Crypt', areas: ['crypt'], text: 'Mind the stairs.',
//                         art: null | 'cards/crypt.png' | () => THREE.Object3D })
//   cardForArea('crypt')   -> the card listing that area, else one with areas: '*', else null
//   markCardSeen(id)       the ui calls it when a card is shown (state.cardsSeen, saved)
//   galleryCards()         -> [{ ...card, seen }] in order
//
// art is the card owner's: an image URL (a file the stream adds next to its
// card file) or a function returning a THREE.Object3D (a diorama built with
// look's kit) that the ui draws. null (the default) until the owner makes
// one: the ui then shows the title and text on a plain card.
//
// The ui shows cardForArea(area.id) on feat/world's 'area-enter' for at least
// TUNING.load.cardMin s when the loadingArt option is on.
import { state } from '../core/state.js';
import './fields.js';

const cards = new Map();

export function registerLoadingCard(def) {
  if (!def?.id) throw new Error('registerLoadingCard: a card needs an id');
  if (cards.has(def.id)) throw new Error(`Loading card "${def.id}" is already registered`);
  const areas = def.areas ?? [];
  if (areas !== '*' && !Array.isArray(areas)) throw new Error(`Loading card "${def.id}": areas must be a list of area ids or '*'`);
  if (def.art != null && typeof def.art !== 'string' && typeof def.art !== 'function') throw new Error(`Loading card "${def.id}": art is an image URL, a function returning a THREE.Object3D, or null`);
  const full = { title: def.id, art: null, text: '', order: 100, ...def, areas };
  cards.set(def.id, full);
  return full;
}

export const getLoadingCard = (id) => cards.get(id) ?? null;
const ordered = () => [...cards.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export function cardForArea(areaId) {
  const list = ordered();
  return list.find((c) => Array.isArray(c.areas) && c.areas.includes(areaId)) ?? list.find((c) => c.areas === '*') ?? null;
}

export function markCardSeen(id) {
  if (!cards.has(id)) return false;
  state.cardsSeen.add(id);
  return true;
}

export const galleryCards = () => ordered().map((c) => ({ ...c, seen: state.cardsSeen.has(c.id) }));
