// Tiny publish/subscribe bus for cross-feature hooks. Features listen for
// what other features do without importing each other.
//
//   const off = on('enemy-killed', ({ entity }) => { ... });
//   emit('explosion', { x, z, radius: 1.5, source: bomb });
//
// Event names in use are listed in docs/ARCHITECTURE.md. Handlers run
// synchronously in subscription order; an exception propagates to the emitter.

const handlers = new Map();

export function on(name, fn) {
  let set = handlers.get(name);
  if (!set) handlers.set(name, (set = new Set()));
  set.add(fn);
  return () => set.delete(fn);
}

export function once(name, fn) {
  const off = on(name, (payload) => {
    off();
    fn(payload);
  });
  return off;
}

export function off(name, fn) {
  handlers.get(name)?.delete(fn);
}

export function emit(name, payload) {
  const set = handlers.get(name);
  if (!set || set.size === 0) return;
  for (const fn of [...set]) fn(payload);
}

export const events = { on, once, off, emit };
