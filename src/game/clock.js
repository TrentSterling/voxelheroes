// The day (Stardew-style): time runs while the hero plays (a game minute every 0.7 s, so a day from
// 6:00 to 2:00 is about 14 minutes), a clock shows on the HUD, the light warms at dusk and cools at
// night (a tint over the view; the renderer's look is untouched), and the day turns over when the
// hero sleeps at an inn or stays up past 2:00. NPC schedules read hour().
//
//   state.clock = { day: 1, min: 480 }   minutes since midnight (can pass 1440 up to 26:00)
//   hour() -> 8.5      timeLabel() -> 'Day 1  8:30 am'
//   events: 'hour' { hour }, 'new-day' { day }
import { defineState, state } from '../core/state.js';
import { emit, on } from '../core/events.js';
import { toast } from '../ui/toast.js';

defineState('clock', () => ({ day: 1, min: 8 * 60 }));

export const MINUTES_PER_SECOND = 1 / 0.7;
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60; // 2:00 the next morning

export const hour = () => (state.clock?.min ?? 480) / 60;
export const today = () => state.clock?.day ?? 1;

export function timeLabel() {
  const m = Math.floor(state.clock.min) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(Math.floor(m % 60 / 10) * 10).padStart(2, '0');
  const h12 = ((h + 11) % 12) + 1;
  return `Day ${state.clock.day}  ${h12}:${mm} ${h < 12 ? 'am' : 'pm'}`;
}

export function setTime(min, day = state.clock.day) {
  const before = Math.floor(hour());
  state.clock.min = min;
  state.clock.day = day;
  if (Math.floor(hour()) !== before) emit('hour', { hour: Math.floor(hour()) });
  paint();
}

export function newDay(reason = 'sleep') {
  state.clock.day += 1;
  state.clock.min = DAY_START;
  emit('new-day', { day: state.clock.day, reason });
  emit('hour', { hour: 6 });
  paint();
}

export function tickClock(dt) {
  if (state.mode !== 'play' || !state.clock) return;
  const before = Math.floor(hour());
  state.clock.min += dt * MINUTES_PER_SECOND;
  if (state.clock.min >= DAY_END) {
    newDay('late');
    toast('You stayed up far too late... a new day begins.', 3);
    return;
  }
  if (Math.floor(hour()) !== before) emit('hour', { hour: Math.floor(hour()) });
  paintSoon();
}

// Sleeping at an inn: morning.
on('inn-rest', () => newDay('inn'));

// ---------------------------------------------------------------- the view: tint and HUD clock
// Tint by hour: day clear, a warm dusk from 17:00, blue night from 20:00, back through dawn.
const STOPS = [
  [0, [10, 18, 55, 0.45]], [5, [10, 18, 55, 0.45]], [6.5, [255, 170, 110, 0.12]], [8, [0, 0, 0, 0]],
  [16.5, [0, 0, 0, 0]], [18, [255, 130, 50, 0.16]], [19.5, [110, 55, 120, 0.24]], [21, [10, 18, 55, 0.4]], [26, [10, 18, 55, 0.45]],
];
function tint(h) {
  for (let i = 1; i < STOPS.length; i++) {
    const [h1, c1] = STOPS[i];
    const [h0, c0] = STOPS[i - 1];
    if (h <= h1) {
      const k = (h - h0) / (h1 - h0 || 1);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return STOPS[STOPS.length - 1][1];
}

let overlay = null;
let lastPaint = -1;
function paintSoon() {
  const m = Math.floor(state.clock.min);
  if (m !== lastPaint) paint();
}
function paint() {
  if (typeof document === 'undefined') return;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'daylight';
    Object.assign(overlay.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 5 }); // a plain wash: blend modes over the WebGL canvas are unreliable
    document.body.append(overlay);
  }
  lastPaint = Math.floor(state.clock.min);
  const [r, g, b, a] = tint(hour());
  overlay.style.background = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a.toFixed(3)})`;
}
on('room-enter', () => paint());
