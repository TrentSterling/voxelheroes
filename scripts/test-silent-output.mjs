import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isolateAudioOutput } from './lib/silent-output.mjs';

const edges = [], media = [], speech = [];
class AudioContext {}
class OfflineAudioContext {}
class AudioNode {
  constructor(context) { this.context = context; }
  connect(target, ...args) { edges.push({ from: this, target, args }); return target; }
}
class AudioDestinationNode extends AudioNode {}
class HTMLMediaElement {
  constructor() { this.value = false; }
  get muted() { return this.value; }
  set muted(value) { this.value = value; }
  play() { media.push(this.muted); return Promise.resolve(); }
}
const window = { AudioContext, AudioNode, AudioDestinationNode, HTMLMediaElement,
  speechSynthesis: { speak: value => speech.push(value) } };
runInNewContext(`(${isolateAudioOutput.toString()})()`, { window });
const checks = [];
const check = (value, label) => { assert.ok(value, label); checks.push(label); };
const live = new AudioContext(), gain = new AudioNode(live), destination = new AudioDestinationNode(live);
check(gain.connect(destination) === destination && edges.length === 0, 'Real-time destination connect returns its normal value without adding a speaker edge.');
const bus = new AudioNode(live); gain.connect(bus, 0, 0);
check(edges.length === 1 && edges[0].target === bus && edges[0].args.length === 2, 'Internal buses and connect arguments retain native behavior.');
const offline = new OfflineAudioContext(), offlineGain = new AudioNode(offline), offlineDestination = new AudioDestinationNode(offline);
offlineGain.connect(offlineDestination);
check(edges.length === 2 && edges[1].target === offlineDestination, 'Offline rendering remains connected for PCM/decode checks.');
const audio = new HTMLMediaElement(); audio.muted = false;
check(audio.muted, 'Setting media mute false cannot enable playback output.');
await audio.play();
check(media.length === 1 && media[0], 'Media play remains functional while the native player is muted.');
window.speechSynthesis.speak({ text: 'Do not speak this.' });
check(speech.length === 0, 'Speech synthesis never reaches the OS speech engine.');
const audit = window.__testAudioOutputGuard;
check(audit.version === 1 && audit.blockedDestinations === 1 && audit.mutedMediaPlays === 1 && audit.suppressedSpeech === 1, 'Guard counters identify all blocked output routes.');
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'playtest-out/test-silent-output';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/result.json`, JSON.stringify({ utc: new Date().toISOString(), ok: true, checks, browsersLaunched: 0,
  scope: 'VM contract checks of the injected guard. No AudioContext, media player, speech engine, browser or physical output is launched.' }, null, 2));
console.log(`PASS ${checks.length} output isolation contracts; no browser or audio device opened.`);
