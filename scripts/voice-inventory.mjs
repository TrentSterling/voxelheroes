// Extract authored NPC dialogue from the JS AST, not regexes or recorded saves.
// No model dependency belongs to the production game.
import { parseSync } from 'rolldown/utils';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { voiceText, voiceKey } from '../src/game/voice-text.js';
import { economy } from '../src/tuning/economy.js';

export const CAST = {
  Mira: ['af_heart', 1.03], Tern: ['bm_george', .94],
  Hettie: ['bf_emma', 1], Pip: ['am_puck', 1.13], 'Old Tobin': ['bm_george', .9],
  Nell: ['af_bella', 1.06], Rowan: ['am_michael', .98], Tam: ['am_puck', 1.03],
  Mags: ['af_sarah', 1], Brannoc: ['am_fenrir', .94], Wenna: ['bf_emma', .96],
  'Tinker Wyll': ['bm_fable', 1.04], 'Old Wick': ['bm_fable', .93],
  'Sister Anwe': ['af_nicole', .95], 'Farmer Dobb': ['am_michael', .94],
  Rook: ['am_fenrir', 1.02], 'King Aldric': ['bm_george', 1],
  'Guard Oswin': ['am_fenrir', .97], 'Guard Pell': ['am_michael', 1], Cobb: ['bm_fable', 1.05],
  'Warden Cray': ['am_fenrir', .93], 'Forester Fen': ['bm_fable', .98],
  'Caravanner Roan': ['am_michael', 1.02], 'Keeper Mara': ['bf_emma', .98],
  'Innkeeper Sella': ['af_sarah', .98], 'Powderwright Pell': ['bm_fable', 1.02],
  'Sage Oriel': ['bm_fable', .9], 'Sage Neru': ['am_michael', .92], 'Sage Iona': ['af_nicole', .93],
};
const BATCHES = ['town', 'crownhold', 'eras', 'wilds', 'temples'];
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) value.forEach(n => walk(n, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
};
const prop = (node, name) => node?.properties?.find(p => (p.key?.name ?? p.key?.value) === name)?.value;
function literal(node) {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  if (node.type === 'Identifier' && node.name === 'TUNING') return { economy };
  if (node.type === 'MemberExpression') return literal(node.object)?.[node.computed ? literal(node.property) : node.property.name];
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.filter(p => p.type === 'Property').map(p => [p.key.name ?? p.key.value, literal(p.value)]));
  if (node.type === 'LogicalExpression' && node.operator === '??') return literal(node.right);
}
const strings = node => {
  if (!node) return [];
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
  if (node.type === 'ArrayExpression') return node.elements.flatMap(strings);
  if (node.type === 'ConditionalExpression') return [...strings(node.consequent), ...strings(node.alternate)];
  if (node.type === 'LogicalExpression') return [...strings(node.left), ...strings(node.right)];
  return [];
};
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []);
}
export function inventory() {
  const paths = [...files('src/world/areas'), ...files('src/entities/npcs'), 'src/game/companions.js', 'src/game/npc-talk.js', 'src/game/errands.js', 'src/game/menus.js', ...files('src/world/tiles'), 'src/systems/grants.js', 'src/game/dungeons.js', ...files('src/items'), ...files('src/swords'), ...files('src/shops')];
  const trees = new Map(paths.map(path => [path, parseSync(path, readFileSync(path, 'utf8')).program]));
  const constants = path => {
    const result = {};
    walk(trees.get(path), node => { if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') result[node.id.name] = literal(node.init); });
    return result;
  };
  const charm = constants('src/game/npc-talk.js'), errands = constants('src/game/errands.js').ERRANDS;
  const people = new Map(), rows = new Map(), placements = [];
  const grantNames = new Map();
  for (const tree of trees.values()) walk(tree, n => {
    if (n.type !== 'CallExpression') return;
    if (n.callee.name === 'registerGrant') grantNames.set(literal(n.arguments[0]), literal(prop(n.arguments[2], 'name')));
    if (n.callee.name === 'registerItem') grantNames.set(literal(prop(n.arguments[0], 'id')), literal(prop(n.arguments[0], 'name')));
  });
  function person(name, opts = {}, batch) {
    if (!CAST[name]) throw Error(`Assign a Kokoro voice to ${name}`);
    let p = people.get(name);
    if (!p) {
      let hash = 0; for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      p = { name, batch: batch ?? 'town', personality: opts.personality ?? (name === 'Sage Oriel' ? 'dreamy' : Object.keys(charm.PERSONALITIES)[hash % 5]), generic: opts.type === 'npc', barks: opts.barks };
      people.set(name, p);
    }
    if (opts.type === 'npc') p.generic = true;
    if (opts.barks) p.barks = opts.barks;
    if (opts.personality) p.personality = opts.personality;
    if (batch && BATCHES.indexOf(batch) < BATCHES.indexOf(p.batch)) p.batch = batch;
    return p;
  }
  function add(name, text, source, kind = 'dialogue') {
    if (!text || !/[A-Za-z]/.test(text)) return;
    const p = person(name), spoken = voiceText(text), key = voiceKey(name, text);
    if (!spoken) return;
    if (rows.has(key)) { const r = rows.get(key); if (!r.sources.includes(source)) r.sources.push(source); if (kind === 'dialogue') r.kind = kind; return; }
    const [voice, speed] = CAST[name];
    const id = createHash('sha256').update(JSON.stringify({ key, voice, speed, engine: 'kokoro-js-1.2.1-fp32', codec: 'opus-32k-v1' })).digest('hex').slice(0, 24);
    rows.set(key, { id, key, speaker: name, text, spoken, voice, speed, batch: p.batch, kind, sources: [source] });
  }
  const defaults = { 'npc-king': 'King Aldric', 'npc-shop': 'Mags', 'npc-smith': 'Brannoc', 'npc-inn': 'Wenna', 'npc-inventor': 'Tinker Wyll', 'npc-sage': 'Sage Oriel', 'npc-mira': 'Mira', 'npc-tern': 'Tern', 'npc-tern-first': 'Tern', 'npc-mara': 'Keeper Mara', 'bomb-upgrader': 'Powderwright Pell' };
  // Area placement defines the actual cast, including renamed sages and services.
  for (const [path, tree] of trees) if (path.startsWith('src/world/areas/')) walk(tree, node => {
    if (node.type !== 'ObjectExpression') return;
    const opts = literal(node), type = opts?.type;
    if (!type || !(type === 'npc' || type.startsWith('npc-') || type === 'bomb-upgrader')) return;
    const name = opts.name ?? defaults[type]; if (!name) throw Error(`Unknown NPC type ${type}`);
    const batch = path.endsWith('/era.js') ? 'eras' : /\/(d[1-4]|tower)\.js$/.test(path) ? 'temples' : /\/(forest|coast|desert)\.js$/.test(path) ? 'wilds' : ['King Aldric','Guard Oswin','Guard Pell','Cobb'].includes(name) ? 'crownhold' : name === 'Mira' ? 'town' : name === 'Warden Cray' ? 'wilds' : 'town';
    person(name, opts, batch);
    placements.push({ name, type, opts, source: path });
    for (const field of ['lines', 'grantLines', 'afterLines']) for (const text of strings(prop(node, field))) add(name, text, `${path}:${node.start}:${field}`);
    if (type === 'npc-inn') { /* Filled below from registered inns. */ }
  });
  for (const [path, tree] of trees) if (path.startsWith('src/entities/npcs/')) walk(tree, node => {
    if (node.type !== 'ClassDeclaration') return;
    let name, style = {};
    walk(node, child => { if (child.type === 'CallExpression' && child.callee.type === 'Super') { style = literal(child.arguments[1]) ?? {}; name = style.name ?? name; } });
    if (!name) return;
    const variants = name === 'Sage Oriel' ? [...people.keys()].filter(n => n.startsWith('Sage ')) : [name];
    for (const speaker of variants) {
      person(speaker, style, speaker === 'Tern' ? 'eras' : speaker.startsWith('Sage ') ? 'temples' : undefined);
      walk(node, child => { if (child.type === 'CallExpression' && child.callee.name === 'showDialog') for (const text of strings(child.arguments[0])) add(speaker, text, `${path}:${child.start}`); });
    }
  });
  for (const p of people.values()) {
    const mood = charm.PERSONALITIES[p.personality];
    if (p.generic) {
      for (const text of mood.chat.flat()) add(p.name, text, `src/game/npc-talk.js:chat:${p.personality}`);
      for (const at of [2, 4]) for (const text of charm.HEART_EVENTS[at][p.personality]) add(p.name, text, `src/game/npc-talk.js:heart:${at}`);
      for (const [gift, def] of Object.entries(charm.GIFTS)) {
        const taste = charm.TASTE[p.personality][gift], tpl = typeof charm.REACTIONS[taste] === 'string' ? charm.REACTIONS[taste] : charm.REACTIONS[taste][p.personality];
        add(p.name, tpl.replace('{gift}', def.name).replace(/^./, c => c.toUpperCase()), `src/game/npc-talk.js:gift:${gift}`);
      }
      for (const text of ['Anything else?', 'What will you give?']) add(p.name, text, 'src/entities/npc.js:gift-menu');
    }
    for (const kind of ['greet', 'idle', 'startled', 'ouch']) {
      const texts = p.barks?.[kind] ?? mood[kind];
      for (const text of Array.isArray(texts) ? texts : [texts]) add(p.name, text, `src/game/npc-talk.js:${kind}`, 'bark');
    }
    for (const context of charm.CONTEXT) for (const text of context.lines[p.personality]) add(p.name, text, 'src/game/npc-talk.js:context', 'bark');
    for (const text of charm.STORY[p.name] ?? []) add(p.name, text, 'src/game/npc-talk.js:story', 'bark');
    const errand = errands[p.name];
    if (errand) for (const field of ['ask', 'give', 'thanks']) for (const text of [errand[field]].flat().filter(Boolean)) add(p.name, text, `src/game/errands.js:${field}`);
    for (const def of Object.values(errands)) if (def.need?.to === p.name) for (const text of def.arrive) add(p.name, text, 'src/game/errands.js:arrive');
  }
  const menus = constants('src/game/menus.js');
  const refusals = Object.values(menus.REFUSALS);
  for (const text of [...refusals, ...Object.values(menus.SMITH_LINES), 'There, that should help.', 'Back to how it was made? The coins you spent on it are gone for good.']) add('Brannoc', text, 'src/game/menus.js:smith');
  for (const [path, tree] of trees) if (path.startsWith('src/swords/')) walk(tree, n => {
    if (n.type !== 'CallExpression' || n.callee.name !== 'registerSword') return;
    const name = literal(prop(n.arguments[0], 'name'));
    for (const text of [`The ${name}. What shall I work on?`, `There is nothing I can add to the ${name}.`]) add('Brannoc', text, `${path}:smith`);
  });
  for (const [path, tree] of trees) walk(tree, n => {
    if (n.type !== 'CallExpression') return;
    if (path === 'src/game/companions.js' && n.callee.name === 'showDialog') {
      const speaker = literal(prop(n.arguments[1], 'speaker'));
      if (speaker) for (const text of strings(n.arguments[0])) add(speaker, text, `${path}:${n.start}`);
    }
    if (n.callee.name === 'registerInn') {
      const inn = literal(n.arguments[0]), speaker = inn.id === 'inn-2' ? 'Innkeeper Sella' : 'Wenna';
      const price = inn.price;
      if (typeof price !== 'number') throw Error(`Resolve the inn price for ${inn.name}`);
      for (const text of [`${inn.name}. A bed is ${price} coins a night. Will you stay?`, 'Sleep well. You wake here if you fall.', ...refusals]) add(speaker, text, `${path}:inn`);
    }
    if (n.callee.name === 'registerShop') {
      const shop = literal(n.arguments[0]);
      for (const text of [`${shop.name}. What will it be?`, ...refusals]) add('Mags', text, `${path}:shop`);
      for (const entry of shop.entries ?? []) {
        const name = entry.name ?? grantNames.get(entry.grant) ?? entry.grant;
        if (typeof entry.price !== 'number') throw Error(`Resolve the price of ${name}`);
        add('Mags', `${name} for ${entry.price}?`, `${path}:counter`);
      }
    }
    if (path.startsWith('src/world/tiles/') && n.callee.name === 'showDialog') {
      const speaker = literal(prop(n.arguments[1], 'speaker'));
      for (const text of strings(n.arguments[0])) {
        if (CAST[speaker]) add(speaker, text, `${path}:${n.start}`);
        else if (text.startsWith('Mira:')) add('Mira', text, `${path}:${n.start}`);
      }
    }
  });
  const ordered = [...rows.values()].map(row => ({ ...row, batch: people.get(row.speaker).batch })).sort((a, b) => BATCHES.indexOf(a.batch) - BATCHES.indexOf(b.batch) || (a.kind === b.kind ? 0 : a.kind === 'dialogue' ? -1 : 1) || a.speaker.localeCompare(b.speaker) || a.id.localeCompare(b.id));
  return { schema: 1, engine: 'kokoro-js 1.2.1', model: 'onnx-community/Kokoro-82M-v1.0-ONNX', codec: 'Opus VBR 32 kbps mono', cast: [...people.values()], placements, batches: BATCHES.map(batch => ({ batch, lines: ordered.filter(r => r.batch === batch).length })), lines: ordered };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/voice-inventory.mjs')) {
  const result = inventory(); mkdirSync('assets/voices', { recursive: true });
  writeFileSync('assets/voices/inventory.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ characters: result.cast.length, lines: result.lines.length, batches: result.batches }, null, 2));
}
