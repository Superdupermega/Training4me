'use client';

/**
 * The rest timer's "time's up" sound. `navigator.vibrate` alone
 * (RestTimer.tsx's original behaviour) is not supported in Safari on iOS at
 * all — on the likeliest gym device, rest used to end with no signal
 * whatsoever unless the screen was already awake and in view. WebAudio has
 * no such gap. See docs/07-PRODUCTION-REVIEW.md #12.
 *
 * Autoplay policies require a prior user gesture on the page before audio
 * can play; by the time a rest period ever ends, the session player has
 * already had one (starting the session, logging the set that started this
 * rest) — no separate "unlock audio" tap is needed.
 */
export function playRestAlert(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // Two short rising beeps — enough to read as "an alert", not a full tone.
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + offset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.16);
    });

    window.setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // A missed beep is a worse workout, never a worse app — swallow it.
  }
}
