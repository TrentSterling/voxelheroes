// The game's own pixel font: 5x7 glyphs (a lowercase g or y hangs two rows below the baseline),
// drawn from a glyph sheet onto the UI canvas. No DOM text, no web font to load, so nothing pops
// in and every string measures the same on every machine (ui/canvas/gfx.js draws with it).
//
// Glyphs are row strings joined by '/'; row 6 is the baseline. A glyph is as wide as its rows.
// A one-pixel-wide glyph, one character per row.
const col = (rows) => rows.split('').join('/');
const GLYPHS = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '###../#..#./#...#/#...#/#...#/#..#./###..',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  a: '...../...../.###./....#/.####/#...#/.####',
  b: '#..../#..../####./#...#/#...#/#...#/####.',
  c: '...../...../.###./#..../#..../#...#/.###.',
  d: '....#/....#/.####/#...#/#...#/#...#/.####',
  e: '...../...../.###./#...#/#####/#..../.###.',
  f: '..##/.#../###./.#../.#../.#../.#..',
  g: '...../...../.####/#...#/#...#/#...#/.####/....#/.###.',
  h: '#..../#..../#.##./##..#/#...#/#...#/#...#',
  i: '.#./.../##./.#./.#./.#./###',
  j: '...#/..../..##/...#/...#/...#/...#/#..#/.##.',
  k: '#..../#..../#..#./#.#../##.../#.#../#..#.',
  l: '##./.#./.#./.#./.#./.#./.##',
  m: '...../...../##.#./#.#.#/#.#.#/#.#.#/#.#.#',
  n: '...../...../####./#...#/#...#/#...#/#...#',
  o: '...../...../.###./#...#/#...#/#...#/.###.',
  p: '...../...../####./#...#/#...#/#...#/####./#..../#....',
  q: '...../...../.####/#...#/#...#/#...#/.####/....#/....#',
  r: '...../...../#.##./##..#/#..../#..../#....',
  s: '...../...../.####/#..../.###./....#/####.',
  t: '.#../.#../###./.#../.#../.#../..##',
  u: '...../...../#...#/#...#/#...#/#...#/.####',
  v: '...../...../#...#/#...#/#...#/.#.#./..#..',
  w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
  x: '...../...../#...#/.#.#./..#../.#.#./#...#',
  y: '...../...../#...#/#...#/#...#/.####/....#/....#/.###.',
  z: '...../...../#####/...#./..#../.#.../#####',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '...',
  '!': col('#####.#'),
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '.': col('......#'),
  ',': '../../../../../.#/.#/#.',
  ':': col('..#..#.'),
  ';': '../../.#/../../.#/.#/#.',
  '-': '..../..../..../####/..../..../....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '=': '...../...../#####/...../#####/...../.....',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '\\': '#..../#..../.#.../..#../...#./....#/....#',
  '(': '..#/.#./#../#../#../.#./..#',
  ')': '#../.#./..#/..#/..#/.#./#..',
  '[': '##/#./#./#./#./#./##',
  ']': '##/.#/.#/.#/.#/.#/##',
  '{': '..#/.#./.#./#../.#./.#./..#',
  '}': '#../.#./.#./..#/.#./.#./#..',
  "'": col('##.....'),
  '"': '#.#/#.#/.../.../.../.../...',
  '*': '...../..#../#.#.#/.###./#.#.#/..#../.....',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '@': '.###./#...#/#.###/#.#.#/#.###/#..../.###.',
  '<': '...#/..#./.#../#.../.#../..#./...#',
  '>': '#.../.#../..#./...#/..#./.#../#...',
  _: '...../...../...../...../...../...../...../#####',
  '|': col('########'),
  '~': '...../...../.##.#/#.##./...../...../.....',
  '^': '.#./#.#/.../.../.../.../...',
  '`': '#./.#/../../../../..',
  '·': col('...#...'),
  '…': '...../...../...../...../...../...../#.#.#',
  '♥': '...../.#.#./#####/#####/#####/.###./..#..',
  '♪': '..##./..#.#/..#../..#../###../###../.....',
  '✦': '..#../..#../.###./#####/.###./..#../..#..',
  '▶': '#.../##../###./####/###./##../#...',
  '▼': '...../#####/.###./..#../...../...../.....',
};

// One raw character to one glyph key, so string indexes never shift (the dialog's typewriter counts them).
const ALIAS = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '―': '-', '−': '-', '×': 'x', ' ': ' ', '\t': ' ' };
const glyphKey = (ch) => {
  if (GLYPHS[ch]) return ch;
  if (ALIAS[ch]) return ALIAS[ch];
  const base = ch.normalize('NFD')[0];
  return GLYPHS[base] ? base : '?';
};

export const CAP = 7; // cap height in font pixels (size 1)
export const LINE = 11; // a comfortable line step at size 1

const CELL_W = 6;
const CELL_H = 9;
const table = {}; // key -> { i, w }
let sheet = null;
const tinted = new Map(); // color -> canvas

function build() {
  const keys = Object.keys(GLYPHS);
  sheet = document.createElement('canvas');
  sheet.width = CELL_W * keys.length;
  sheet.height = CELL_H;
  const c = sheet.getContext('2d');
  c.fillStyle = '#fff';
  keys.forEach((k, i) => {
    const rows = GLYPHS[k].split('/');
    let w = 0;
    rows.forEach((row, y) => {
      w = Math.max(w, row.length);
      for (let x = 0; x < row.length; x++) if (row[x] === '#') c.fillRect(i * CELL_W + x, y, 1, 1);
    });
    table[k] = { i, w };
  });
}

function sheetFor(color) {
  if (!sheet) build();
  let t = tinted.get(color);
  if (!t) {
    t = document.createElement('canvas');
    t.width = sheet.width;
    t.height = sheet.height;
    const c = t.getContext('2d');
    c.drawImage(sheet, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, t.width, t.height);
    tinted.set(color, t);
  }
  return t;
}

const advance = (ch, size, tracking) => {
  if (!sheet) build();
  return (table[glyphKey(ch)].w + 1 + tracking) * size;
};

// Width in canvas pixels of a line of text (no trailing gap).
export function measure(text, size = 1, tracking = 0) {
  let w = 0;
  for (const ch of text) w += advance(ch, size, tracking);
  return Math.max(0, w - (1 + tracking) * size);
}

// Break text into lines that fit maxW. Explicit "\n" breaks; words longer than a line are cut.
// Each line keeps `start`, its index in the original string, so a typewriter can count characters.
export function wrap(text, maxW, size = 1, tracking = 0) {
  const lines = [];
  let at = 0;
  for (const para of text.split('\n')) {
    let line = '';
    let lineStart = at;
    let wordStart = at;
    const words = para.split(' ');
    words.forEach((word, wi) => {
      const tryLine = line ? `${line} ${word}` : word;
      if (line && measure(tryLine, size, tracking) > maxW) {
        lines.push({ text: line, start: lineStart });
        line = word;
        lineStart = wordStart;
      } else {
        line = tryLine;
      }
      while (measure(line, size, tracking) > maxW && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), size, tracking) > maxW) cut--;
        lines.push({ text: line.slice(0, cut), start: lineStart });
        line = line.slice(cut);
        lineStart += cut;
      }
      wordStart += word.length + 1;
      if (wi === words.length - 1) lines.push({ text: line, start: lineStart });
    });
    at += para.length + 1;
  }
  return lines;
}

// Trim to fit maxW, ending in "..." when it was cut.
export function fit(text, maxW, size = 1, tracking = 0) {
  text=String(text);
  if(maxW<=0)return '';
  if (measure(text, size, tracking) <= maxW) return text;
  if(measure('...',size,tracking)>maxW){let dots='...';while(dots&&measure(dots,size,tracking)>maxW)dots=dots.slice(1);return dots;}
  let s = text;
  while (s.length && measure(`${s}...`, size, tracking) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}

function run(ctx, text, x, y, color, size, tracking) {
  const src = sheetFor(color);
  let px = x;
  for (const ch of text) {
    const g = table[glyphKey(ch)];
    if (g.w > 0 && ch !== ' ') ctx.drawImage(src, g.i * CELL_W, 0, g.w, CELL_H, px, y, g.w * size, CELL_H * size);
    px += (g.w + 1 + tracking) * size;
  }
}

const RING = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// opts: color, size (whole pixels), align ('left' | 'center' | 'right'), tracking (extra px between
// letters), shadow (a colour, drawn one pixel down), outline (a colour, all round), alpha.
export function drawText(ctx, text, x, y, opts = {}) {
  const { color = '#f3ecd2', size = 1, align = 'left', tracking = 0, shadow = null, outline = null } = opts;
  if (!sheet) build();
  let px = x;
  if (align !== 'left') {
    const w = measure(text, size, tracking);
    px = align === 'center' ? Math.round(x - w / 2) : x - w;
  }
  if (outline) for (const [dx, dy] of RING) run(ctx, text, px + dx * size, y + dy * size, outline, size, tracking);
  if (shadow) run(ctx, text, px, y + size, shadow, size, tracking);
  run(ctx, text, px, y, color, size, tracking);
}

