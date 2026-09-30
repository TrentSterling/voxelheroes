// Focused NPC conversations use installed English voices. No model or remote
// speech service is downloaded; text remains usable on devices without voices.
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { isMuted, volumes } from '../core/audio.js';
import { entities } from '../entities/manager.js';

const CAST = {
  'Old Tobin': { male: true, rate: .9, pitch: .85 },
  'Pip': { male: true, rate: 1.08, pitch: 1.2 },
  'Brannoc': { male: true, rate: .94, pitch: .9 },
  'Tinker Wyll': { male: true, rate: 1.04, pitch: 1.02 },
  'Rowan': { male: true, rate: .98, pitch: .96 },
  'Hettie': { male: false, rate: 1, pitch: 1.02 },
  'Nell': { male: false, rate: 1.06, pitch: 1.06 },
  'Mags': { male: false, rate: 1, pitch: .96 },
  'Wenna': { male: false, rate: .95, pitch: 1 },
};
let unlocked = false, line = null, boundSynth = null, serial = 0;
let last = null;
const synth = () => globalThis.speechSynthesis;
const voiceList = () => {
  try { return synth()?.getVoices().filter(v => v.localService && /^en(?:[-_]|$)/i.test(v.lang)) ?? []; }
  catch { return []; }
};
const volume = () => { const v = volumes(); return v.master * v.sfx * .85; };
const allowed = () => unlocked && state.settings.npcVoices && !isMuted() && volume() > 0 && !document.hidden;
const speakerName = label => entities.find(e => e.kind === 'npc' && !e.removed && (label === e.name || label?.startsWith(e.name + ' ')))?.name;

function chooseVoice(name) {
  const voices = voiceList().sort((a,b) => a.name.localeCompare(b.name));
  if (!voices.length) return null;
  const style = CAST[name];
  const preferred = style?.male ? /David|Mark|George|Guy|James|Ryan/i : /Zira|Hazel|Sonia|Aria|Jenny|Susan/i;
  const candidates = style ? voices.filter(v => preferred.test(v.name)) : [];
  const list = candidates.length ? candidates : voices;
  const hash = [...name].reduce((n,c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return list[hash % list.length];
}

function bindVoices() {
  const engine = synth();
  if (engine === boundSynth) return;
  boundSynth?.removeEventListener?.('voiceschanged', deliver);
  boundSynth = engine;
  engine?.addEventListener?.('voiceschanged', deliver);
}

function deliver() {
  if (!line || line.sent || !allowed() || state.mode !== 'dialog') return;
  const voice = chooseVoice(line.speaker);
  if (!voice) { last.phase = 'waiting-for-local-voice'; return; }
  const token = line.token;
  try {
    const utterance = new SpeechSynthesisUtterance(line.text);
    const style = CAST[line.speaker] ?? { rate: .98, pitch: 1 };
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = style.rate;
    utterance.pitch = style.pitch;
    utterance.volume = volume();
    utterance.onstart = () => { if (line?.token === token) last.phase = 'speaking'; };
    utterance.onend = () => { if (line?.token === token) { last.phase = 'ended'; line = null; } };
    utterance.onerror = e => { if (line?.token === token) { last.phase = 'unavailable'; last.error = e.error; line = null; } };
    line.sent = true;
    line.utterance = utterance; // Keep the live utterance from being collected by the browser.
    last = { ...last, voice: voice.name, rate: utterance.rate, pitch: utterance.pitch, volume: utterance.volume, phase: 'queued' };
    synth().speak(utterance);
  } catch {
    last.phase = 'unavailable';
    line = null;
  }
}

export function stopNpcSpeech() {
  if (!line) return;
  line = null;
  if (last) last.phase = 'cancelled';
  try { boundSynth?.cancel(); } catch { /* Speech can be disabled independently of the game. */ }
}

export function speakNpcSegment(text, speaker, { voice } = {}) {
  stopNpcSpeech();
  const name = voice === true ? speaker : speakerName(speaker);
  if (voice === false || !name || !text?.trim() || !allowed() || typeof SpeechSynthesisUtterance !== 'function' || !synth()) return;
  bindVoices();
  line = { text: text.trim(), speaker: name, token: ++serial, sent: false };
  last = { text: line.text, speaker: name, phase: 'waiting-for-local-voice', voice: null };
  deliver();
}

export const npcVoiceView = () => ({
  supported: !!synth() && typeof SpeechSynthesisUtterance === 'function',
  enabled: !!state.settings.npcVoices,
  unlocked,
  localVoices: voiceList().map(v => ({ name: v.name, lang: v.lang })),
  current: line ? { text: line.text, speaker: line.speaker, sent: line.sent } : null,
  last: last ? { ...last } : null,
});

const unlock = event => { if (event.isTrusted) { unlocked = true; bindVoices(); deliver(); } };
window.addEventListener('keydown', unlock, true);
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('pagehide', stopNpcSpeech);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopNpcSpeech(); });
on('mode-change', ({ to }) => { if (to !== 'dialog') stopNpcSpeech(); });
on('settings-changed', ({ key }) => { if (['npcVoices', 'muted', 'volume', 'sfx'].includes(key)) stopNpcSpeech(); });
on('audio-muted', stopNpcSpeech);
