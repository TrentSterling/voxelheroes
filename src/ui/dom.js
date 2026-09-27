export const $ = (id) => document.getElementById(id);

// Create an element: el('div', { class: 'x', hidden: true }, 'text' | node...)
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) n.append(c);
  return n;
}
