// The big title that fades in and out when you enter a screen or find something.
import { $ } from './dom.js';

let bannerTimer = 0;

export function showBanner(text) {
  const b = $('banner');
  b.hidden = true;
  b.textContent = text;
  void b.offsetWidth; // restart the CSS animation
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (b.hidden = true), 2300);
}
