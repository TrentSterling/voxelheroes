// Packs the Vite build into one self-contained HTML page for publishing as a
// claude.ai Artifact (the host adds its own doctype/head/body wrapper).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const between = (a, b) => html.split(a)[1].split(b)[0].trim();
const head = between('<!-- head:start -->', '<!-- head:end -->');
const body = between('<!-- body:start -->', '<!-- body:end -->');

const assets = readdirSync('dist/assets');
let js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
// The web build loads voice clips individually. Its portable artifact embeds
// those same compressed clips so it also works as one offline HTML file.
const bank = JSON.parse(readFileSync('src/game/voice-bank.json', 'utf8'));
for (const clip of bank.lines) {
  const data = 'data:audio/ogg;codecs=opus;base64,' + readFileSync(`dist/${clip.path}`).toString('base64');
  let replaced = false;
  for (const quote of ['"', "'", '`']) {
    const literal = quote + clip.path + quote;
    if (js.includes(literal)) { js = js.replaceAll(literal, JSON.stringify(data)); replaced = true; }
  }
  if (!replaced) throw Error(`The portable artifact did not embed ${clip.path}`);
}
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');

const page = `<meta charset="UTF-8">
${head}
<style>${css}</style>
${body}
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/voxel-heroes.html', page);
console.log(`dist-artifact/voxel-heroes.html ${(page.length / 1024).toFixed(0)} KB`);
