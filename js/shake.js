// Shake-to-roll: zero-dependency motion detector (DeviceMotion).
// Uses the delta of acceleration magnitude — a firm shake of ~2–3 quick
// movements trips it; steady holding does not. iOS needs a user-gesture
// permission grant, which we request when the player taps Start.
// onMotion receives every raw acceleration sample while enabled (dice tilt).

const SHAKE_THRESHOLD = 13; // m/s² summed delta across axes
const COOLDOWN_MS = 650;

export function createShakeDetector(onShake, onMotion) {
  let enabled = false, last = 0, prev = null, watch = null;

  function handler(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;
    onMotion?.({ x: a.x || 0, y: a.y || 0, z: a.z || 0 });
    const m = Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z);
    if (prev == null) { prev = m; return; }
    const delta = Math.abs(m - prev);
    prev = m;
    const now = Date.now();
    if (delta > SHAKE_THRESHOLD && now - last > COOLDOWN_MS) {
      last = now;
      navigator.vibrate?.(35);
      onShake();
    }
  }

  return {
    get enabled() { return enabled; },
    supported() {
      return typeof DeviceMotionEvent !== 'undefined';
    },
    async enable() {
      if (enabled) return { ok: true };
      if (!window.isSecureContext) return { ok: false, reason: 'insecure' }; // motion needs https/localhost
      if (typeof DeviceMotionEvent === 'undefined') return { ok: false, reason: 'no-sensor' };
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const res = await DeviceMotionEvent.requestPermission();
          if (res !== 'granted') return { ok: false, reason: 'denied' };
        } catch { return { ok: false, reason: 'denied' }; }
      }
      if (!watch) { watch = handler; window.addEventListener('devicemotion', handler); }
      enabled = true;
      return { ok: true };
    },
    disable() {
      enabled = false;
      if (watch) { window.removeEventListener('devicemotion', watch); watch = null; }
      prev = null;
    },
  };
}
