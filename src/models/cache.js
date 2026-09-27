// Geometry is built once, on first use, and shared by every mesh that needs it.
//
//   export const slimeGeometry = () => cached('slime', () => makeSlime());
const cache = new Map();

export function cached(key, build) {
  let v = cache.get(key);
  if (v === undefined) {
    v = build();
    cache.set(key, v);
  }
  return v;
}
