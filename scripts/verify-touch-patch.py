"""Verify the delivery follow-up changes only two touch visibility selectors."""
from pathlib import Path
import hashlib
import json
import zipfile
from datetime import datetime, timezone

root = Path(__file__).resolve().parent.parent
before = root / 'playtest-out/fair-delivery-20261001'
out = root / 'playtest-out/fair-final-touch-patch-20261001'
packet = json.loads((before / 'package.json').read_text(encoding='utf-8'))
sha = lambda data: hashlib.sha256(data).hexdigest()
archive = before / packet['archive']['file']
assert sha(archive.read_bytes()) == packet['archive']['sha256']
paths = sorted([p.relative_to(root).as_posix() for folder in ['src', 'public/voices']
                for p in (root / folder).rglob('*') if p.is_file()]
               + ['index.html', 'package.json', 'package-lock.json'])
game = lambda name: name.startswith(('src/', 'public/voices/')) or name in ['index.html', 'package.json', 'package-lock.json']
old_paths = sorted(row['file'] for row in packet['sourceFiles'] if game(row['file']))
assert paths == old_paths, 'No game file added or removed in the follow-up'
old_hash, new_hash = hashlib.sha256(), hashlib.sha256()
changes = []
with zipfile.ZipFile(archive) as z:
    for name in paths:
        old, new = z.read(name), (root / name).read_bytes()
        for h, data in [(old_hash, old), (new_hash, new)]:
            h.update((name + '\0').encode('utf-8'))
            h.update(data)
        if old != new:
            changes.append({'file': name, 'beforeSha256': sha(old), 'afterSha256': sha(new)})
        if name == 'src/style.css':
            old_css, new_css = old.decode('utf-8').replace('\r\n', '\n'), new.decode('utf-8').replace('\r\n', '\n')
assert [c['file'] for c in changes] == ['src/style.css']
target = '[data-game-mode="dialog"]) #touch'
replacement = '[data-game-mode="dialog"], [data-game-mode="ending"], [data-game-mode="dead"]) #touch'
assert old_css.count(target) == 1
assert old_css.replace(target, replacement) == new_css, 'Only ending/dead touch suppression was added'
old_page = (before / packet['artifact']['file']).read_bytes()
new_page = (root / 'dist-artifact/voxel-heroes.html').read_bytes()
assert sha(old_page) == packet['artifact']['sha256']
def inline_js(page):
    return page.split(b'<script type="module">', 1)[1].rsplit(b'</script>', 1)[0]
assert inline_js(old_page) == inline_js(new_page), 'Compiled game and embedded voice JavaScript remain byte-identical'
assert old_hash.hexdigest() == '2d6bd228a9477ae7b1630e3c250276a1a48694fe3b95be6ecbcdbc0044b7e7f1'
result = {'ok': True, 'utc': datetime.now(timezone.utc).isoformat(),
          'beforeSourceSha256': old_hash.hexdigest(), 'afterSourceSha256': new_hash.hexdigest(),
          'beforeArtifactSha256': sha(old_page), 'afterArtifactSha256': sha(new_page),
          'inlineJavaScriptSha256': sha(inline_js(new_page)), 'changes': changes,
          'scope': 'Every game file and asset is compared with the verified previous source ZIP. Only two touch visibility selectors were added. Compiled game and embedded voice JavaScript are byte-identical. Earlier gameplay/co-op/portable receipts retain their original source hashes; fresh UI and encoding checks cover the corrected artifact.'}
out.mkdir(parents=True, exist_ok=True)
(out / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print('PASS CSS-only touch follow-up: game files unchanged except two selectors; compiled game/voice JavaScript byte-identical.')
