"""Create and read back a source ZIP; verify portable voice bytes without playback."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
import zipfile
import argparse
from html import escape

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('out', nargs='?', default='playtest-out/source-delivery')
parser.add_argument('--title', default='Mira and Clockwork Cross')
parser.add_argument('--review', default='companion-review')
parser.add_argument('--regression', default='companion-regression-20260930')
parser.add_argument('--coop', default='companion-coop-final-20260930')
parser.add_argument('--ui', default='')
args = parser.parse_args()
for name in (args.review, args.regression, args.coop, args.ui):
    if name and not re.fullmatch(r'[A-Za-z0-9_-]+', name):
        raise ValueError('Receipt folder names must be local directory names')
out = root / args.out
out = out.resolve()
if not out.is_relative_to(root):
    raise ValueError("Delivery must stay inside the repository")
out.mkdir(parents=True, exist_ok=True)
archive = out / "voxel-heroes-source.zip"
if archive.exists():
    raise FileExistsError("Use a fresh delivery folder to preserve earlier receipts")
paths = subprocess.check_output(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root
).decode("utf-8").split("\0")
entries = []
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for name in sorted(set(paths) - {""}):
        file = root / name
        if not file.is_file():
            continue
        if file.is_symlink() or not file.resolve().is_relative_to(root):
            raise ValueError(f"Source path escapes the repository: {name}")
        if file.name == ".env" or file.name.startswith(".env."):
            raise ValueError(f"Refusing to package environment secrets: {name}")
        data = file.read_bytes()
        entries.append({"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        z.writestr(name, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for entry in entries:
        assert hashlib.sha256(z.read(entry["file"])).hexdigest() == entry["sha256"]

artifact = root / "dist-artifact/voxel-heroes.html"
page = artifact.read_bytes()
portable = out / 'voxel-heroes.html'
portable.write_bytes(page)
assert portable.read_bytes() == page, 'Delivery keeps its own exact portable artifact'
encoded = re.findall(rb"data:audio/ogg;codecs=opus;base64,([A-Za-z0-9+/=]+)", page)
embedded = {hashlib.sha256(base64.b64decode(value, validate=True)).hexdigest() for value in encoded}
bank = json.loads((root / "src/game/voice-bank.json").read_text(encoding="utf-8"))
for line in bank["lines"]:
    assert hashlib.sha256((root / "public" / line["path"]).read_bytes()).hexdigest() in embedded, line["path"]
assert len(embedded) == len(bank["lines"]), "Each unique authored recording is embedded"
report = {
    "utc": datetime.now(timezone.utc).isoformat(), "ok": True,
    "gitHead": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip(),
    "archive": {"file": archive.name, "bytes": archive.stat().st_size, "sha256": hashlib.sha256(archive.read_bytes()).hexdigest()},
    "artifact": {"file": portable.name, "builtFrom": "dist-artifact/voxel-heroes.html", "bytes": len(page), "sha256": hashlib.sha256(page).hexdigest(), "embeddedClipsVerified": len(embedded)},
    "sourceFiles": entries,
    "scope": "Local source snapshot, verified ZIP readback and compressed embedded voice bytes; no audio playback or browser launch. Publication status is recorded separately.",
    "title": args.title,
    "reviews": {"slides": args.review, "regression": args.regression, "coop": args.coop, "ui": args.ui or None},
}
(out / "package.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
ui_link = f'<li><a href="../{args.ui}/result.json">Additional UI checks</a></li>' if args.ui else ''
(out / "index.html").write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes local build</title><style>body{{background:#162137;color:#eee0c5;font:16px system-ui;padding:24px;max-width:900px;margin:auto;line-height:1.5;overflow-wrap:anywhere}}a{{color:#a1d9cf}}h1{{font-size:28px}}li{{margin:12px 0}}</style><h1>{escape(args.title)}</h1><p>Local build, with current recorded NPC voices. No model download or live generation.</p><ul><li><a href="http://127.0.0.1:5173/">Play locally</a></li><li><a href="voxel-heroes.html">Portable playable HTML</a> ({len(page)/1e6:.2f} MB, all {len(embedded):,} compressed recordings verified; preserved in this packet)</li><li><a href="voxel-heroes-source.zip">Source ZIP</a> ({archive.stat().st_size/1e6:.2f} MB; {len(entries):,} files, read back and hashed)</li><li><a href="../{args.review}/index.html">Screenshot slideshow</a></li><li><a href="package.json">Package hashes and source manifest</a></li><li><a href="../{args.regression}/index.html">Focused regression receipts</a></li><li><a href="../{args.coop}/result.json">Local co-op checks</a></li>{ui_link}</ul><p>This packet preserves a local checkpoint. Read the slideshow manifest for fixture disclosures and coverage limits; publication is recorded separately.</p></html>''', encoding="utf-8")
print(f"PASS source delivery: {len(entries)} files read back and hashed; {len(embedded)} embedded compressed clips verified; no playback.")
