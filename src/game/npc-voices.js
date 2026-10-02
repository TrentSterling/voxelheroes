// Authored Kokoro recordings. The player downloads only the clip being spoken;
// synthesis and model weights belong to the development recorder.
import bank from './voice-bank.json';
import { voiceKey } from './voice-text.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { isMuted, volumes } from '../core/audio.js';

const clips = new Map(bank.lines.map(row => [row.key, row]));
const speakers = [...new Set(bank.lines.map(row => row.speaker))].sort((a, b) => b.length - a.length);
let unlocked = false, line = null, serial = 0, last = null, ambientAfter = 0;
const volume = () => { const v = volumes(); return v.master * v.sfx * .85; };
const allowed = () => unlocked && state.settings.npcVoices && !isMuted() && volume() > 0 && !document.hidden;
const speakerName = label => speakers.find(name => label === name || label?.startsWith(name + ' '));
const stillCurrent = token => line?.token === token;

export function stopNpcSpeech() {
  if (!line) return;
  const old = line; line = null;
  old.audio.pause(); old.audio.removeAttribute('src'); old.audio.load();
  if (last) last.phase = 'cancelled';
}

function playClip(text, speaker, { continuation = false, ambient = false, voice = undefined, voiceText: override } = {}) {
  const name = speakerName(speaker) ?? (voice === true ? speaker : null);
  const key = voiceKey(name, override ?? text);
  // A long authored page can span several phone screenfuls. Keep its recording
  // playing as the subtitle continues, without repeating or cutting it short.
  if (continuation && last?.key === key) return;
  stopNpcSpeech();
  if (voice === false || !name || !text?.trim() || !allowed() || typeof Audio !== 'function') return;
  const clip = clips.get(key);
  if (!clip) { last = { speaker: name, text, key, phase: 'unrecorded', engine: 'recorded-kokoro' }; return; }
  const token = ++serial, audio = new Audio();
  audio.preload = 'none'; audio.volume = volume();
  line = { text, speaker: name, key, token, audio, ambient, clip };
  last = { speaker: name, text, key, id: clip.id, voice: clip.voice, engine: 'recorded-kokoro', path: clip.path, duration: clip.duration, volume: audio.volume, phase: 'loading', ambient };
  audio.addEventListener('playing', () => { if (stillCurrent(token)) last.phase = 'speaking'; });
  audio.addEventListener('ended', () => { if (stillCurrent(token)) { last.phase = 'ended'; line = null; } });
  audio.addEventListener('error', () => { if (stillCurrent(token)) { last.phase = 'unavailable'; last.error = audio.error?.code ?? 'media-error'; line = null; } });
  audio.src = clip.path.startsWith('data:') ? clip.path : new URL(import.meta.env.BASE_URL + clip.path, document.baseURI).href;
  audio.play().catch(error => { if (stillCurrent(token)) { last.phase = 'unavailable'; last.error = error.name; line = null; } });
}

export function speakNpcSegment(text, speaker, opts = {}) { playClip(text, speaker, opts); }

export function speakNpcBark(text, speaker) {
  if (!allowed() || state.mode !== 'play' || line || performance.now() < ambientAfter) return;
  if (!clips.has(voiceKey(speaker, text))) return;
  ambientAfter = performance.now() + 5500;
  playClip(text, speaker, { ambient: true });
}

export const npcVoiceView = () => ({
  supported: typeof Audio === 'function', enabled: !!state.settings.npcVoices, unlocked,
  engine: 'recorded-kokoro', modelDownloads: 0, recordedLines: bank.lines.length, characters: speakers.length,
  current: line ? { text: line.text, speaker: line.speaker, id: line.clip.id, sent: !line.audio.paused, ambient: line.ambient, time: line.audio.currentTime } : null,
  last: last ? { ...last } : null,
});

const unlock = event => { if (event.isTrusted) unlocked = true; };
window.addEventListener('keydown', unlock, true);
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('pagehide', stopNpcSpeech);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopNpcSpeech(); });
on('mode-change', ({ to }) => { if (to !== 'dialog' || line?.ambient) stopNpcSpeech(); });
on('settings-changed', ({ key }) => { if (['npcVoices', 'muted'].includes(key)) stopNpcSpeech(); });
on('audio-muted', stopNpcSpeech);
on('audio-levels-changed', () => { if (line) { line.audio.volume = volume(); last.volume = line.audio.volume; if (!allowed()) stopNpcSpeech(); } });
on('screen-enter', stopNpcSpeech);
