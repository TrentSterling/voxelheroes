// Small math helpers used across systems.

// Rotate angle a towards b by fraction t along the shortest way round.
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// Unit vector for a yaw angle (yaw 0 faces +z, towards the camera).
export const yawDir = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
