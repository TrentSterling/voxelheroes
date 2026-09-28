// A short line of feedback at the bottom of the view ("No item selected"), for buttons that do
// nothing yet, so a press is never silent. The same text is not repeated within 2.5 s.
let el = null;
let hideAt = 0;
const lastShown = new Map();

export function toast(text, seconds = 1.6) {
  if (typeof document === 'undefined') return;
  const now = performance.now();
  if (now - (lastShown.get(text) ?? -1e9) < 2500) return;
  lastShown.set(text, now);
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
      background: 'rgba(12, 14, 12, 0.82)', color: '#f2efe4', padding: '6px 14px', borderRadius: '6px',
      font: '14px/1.3 ui-monospace, Consolas, monospace', pointerEvents: 'none', zIndex: 40, transition: 'opacity 0.2s',
    });
    document.body.append(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  hideAt = now + seconds * 1000;
  setTimeout(() => { if (performance.now() >= hideAt - 5) el.style.opacity = '0'; }, seconds * 1000);
}
