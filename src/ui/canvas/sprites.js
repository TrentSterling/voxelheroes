// Small pixel sprites for the UI, drawn once to offscreen canvases with a one-pixel dark outline
// (the outline is what keeps a heart readable over grass and sand). Rows are strings: a letter
// looks up the palette, '.' is empty.
import { requestUi } from './gfx.js';

const OUTLINE = '#0b0f0c';
const cache = new Map();

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// The same picture with a 1px outline all round (4 neighbours: the classic pixel-art edge).
export function outlined(src, color = OUTLINE) {
  const w = src.width + 2;
  const h = src.height + 2;
  const mask = canvasOf(w, h);
  const m = mask.getContext('2d');
  m.drawImage(src, 1, 1);
  m.globalCompositeOperation = 'source-in';
  m.fillStyle = color;
  m.fillRect(0, 0, w, h);
  const out = canvasOf(w, h);
  const c = out.getContext('2d');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(mask, dx, dy);
  c.drawImage(src, 1, 1);
  return out;
}

function fromRows(rows, palette) {
  const c = canvasOf(rows[0].length, rows.length);
  const x = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const col = palette[row[i]];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(i, y, 1, 1);
    }
  });
  return c;
}

const once = (key, make) => {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
};

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

// fill: 2 full, 1 half (the left side), 0 empty.
export const heart = (fill) =>
  once(`heart${fill}`, () => {
    const c = canvasOf(7, 6);
    const x = c.getContext('2d');
    HEART.forEach((row, y) =>
      [...row].forEach((ch, i) => {
        if (ch !== 'X') return;
        const on = fill === 2 || (fill === 1 && i <= 3);
        x.fillStyle = on && i === 1 && y === 1 ? '#ffb0bc' : on ? '#e8364a' : '#3b2a2f';
        x.fillRect(i, y, 1, 1);
      })
    );
    return outlined(c);
  });

// A filled disc of diameter d with a one-pixel drop shadow below it (speech bubbles).
export const disc = (d, fill) =>
  once(`disc${d}${fill}`, () => {
    const c = canvasOf(d, d + 1);
    const x = c.getContext('2d');
    const r = d / 2;
    for (const [dy, color] of [[1, 'rgba(0, 0, 0, 0.28)'], [0, fill]]) {
      x.fillStyle = color;
      for (let y = 0; y < d; y++) {
        const half = Math.round(Math.sqrt(Math.max(0, r * r - (y + 0.5 - r) ** 2)));
        x.fillRect(Math.round(r - half), y + dy, half * 2, 1);
      }
    }
    return c;
  });

export const coin = () =>
  once('coin', () =>
    outlined(
      fromRows(['..ggg..', '.hhggd.', 'hhgggdd', 'hgggddd', 'ggggddd', '.gdddd.', '..ddd..'], { g: '#f1c232', h: '#fff2a8', d: '#b8871b' })
    )
  );

export const key = () =>
  once('key', () =>
    outlined(fromRows(['.kkk.', 'k...k', 'k...k', '.kkk.', '..k..', '..k..', '..kk.', '..k..', '..kk.'], { k: '#f1c232' }))
  );

export const magic = (filled) => once(`magic${filled}`,()=>outlined(fromRows(
  ['...x...','..xxx..','.xxxxx.','xxxxxxx','.xxxxx.','..xxx..','...x...'],
  {x:filled?'#86dde1':'#344e5b'}
)));

// A pixel-art SVG (an item icon: crisp rects on a small viewBox) rasterised at one pixel per unit.
// The image decodes asynchronously; the canvas fills in and the UI redraws.
export function svgIcon(svg) {
  return once(`svg:${svg}`, () => {
    const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    const w = m ? Number(m[1]) : 8;
    const h = m ? Number(m[2]) : 8;
    const c = canvasOf(w, h);
    const img = new Image();
    img.onload = () => {
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cache.set(`svg:${svg}`, outlined(c));
      requestUi();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `))}`;
    return c;
  });
}
