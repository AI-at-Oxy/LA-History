/* =========================================
   LA History — Sound Effects Manager (SFX)
   Web Audio API synthesized sounds.
   ========================================= */

const SFX = (() => {
  let audioCtx = null;
  let enabled = localStorage.getItem('sfx_enabled') !== 'off';
  let playing = false;

  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function isEnabled() { return enabled; }

  function setEnabled(val) {
    enabled = !!val;
    localStorage.setItem('sfx_enabled', val ? 'on' : 'off');
  }

  function play(name) {
    if (!enabled || playing) return;
    try {
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const fn = sounds[name];
      if (fn) {
        playing = true;
        fn(ctx).then(() => { playing = false; })
               .catch(() => { playing = false; });
      }
    } catch (_) { playing = false; }
  }

  // --- Utility: schedule an oscillator note ---
  function note(ctx, freq, type, gain, start, dur) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    vol.gain.setValueAtTime(gain, ctx.currentTime + start);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(vol).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur);
  }

  // --- Sound definitions (all < 500ms) ---

  const sounds = {
    // Short pop — sine descending from 880 to 440 Hz
    'marker-click': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      vol.gain.setValueAtTime(0.15, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
      return new Promise(r => setTimeout(r, 120));
    },

    // Three ascending notes — C5, E5, G5
    'quiz-success': (ctx) => {
      note(ctx, 523.25, 'sine', 0.14, 0,    0.12);  // C5
      note(ctx, 659.25, 'sine', 0.14, 0.09, 0.12);  // E5
      note(ctx, 783.99, 'sine', 0.16, 0.18, 0.18);  // G5
      return new Promise(r => setTimeout(r, 360));
    },

    // Two descending notes — E4, C4 (triangle, soft)
    'quiz-error': (ctx) => {
      note(ctx, 329.63, 'triangle', 0.12, 0,    0.14);  // E4
      note(ctx, 261.63, 'triangle', 0.10, 0.10, 0.16);  // C4
      return new Promise(r => setTimeout(r, 260));
    },

    // Celebratory badge fanfare — ascending arpeggio with shimmer overlay
    'badge-earned': (ctx) => {
      const t = ctx.currentTime;
      // Main arpeggio notes (sine — warm)
      note(ctx, 523.25, 'sine', 0.13, 0,    0.18);  // C5
      note(ctx, 659.25, 'sine', 0.14, 0.10, 0.18);  // E5
      note(ctx, 783.99, 'sine', 0.16, 0.20, 0.18);  // G5
      note(ctx, 1046.5, 'sine', 0.18, 0.30, 0.28);  // C6 (held longer)
      // Shimmer layer (triangle, octave higher, quieter)
      note(ctx, 1046.5, 'triangle', 0.06, 0.05, 0.12);
      note(ctx, 1318.5, 'triangle', 0.06, 0.15, 0.12);
      note(ctx, 1568.0, 'triangle', 0.07, 0.25, 0.12);
      note(ctx, 2093.0, 'triangle', 0.08, 0.35, 0.20);
      // Final sparkle — high sine ping
      note(ctx, 2637.0, 'sine', 0.05, 0.45, 0.15);  // E7 sparkle
      return new Promise(r => setTimeout(r, 600));
    },

    // Tiny tick for selection feedback
    'hover': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      vol.gain.setValueAtTime(0.06, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.03);
      return new Promise(r => setTimeout(r, 30));
    },

    // Soft descending close — panels, quiz, settings
    'panel-close': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
      vol.gain.setValueAtTime(0.10, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.14);
      return new Promise(r => setTimeout(r, 140));
    },

    // Two ascending notes — quiz opening
    'quiz-open': (ctx) => {
      note(ctx, 440, 'sine', 0.12, 0,    0.10);
      note(ctx, 660, 'sine', 0.13, 0.08, 0.12);
      return new Promise(r => setTimeout(r, 200));
    },

    // Single triangle click — settings open
    'settings-open': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      vol.gain.setValueAtTime(0.09, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
      return new Promise(r => setTimeout(r, 80));
    },

    // Low soft thump — sidebar toggle
    'sidebar-toggle': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.09);
      vol.gain.setValueAtTime(0.12, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.11);
      return new Promise(r => setTimeout(r, 110));
    },

    // Bubble pop — chat panel open/close
    'chat-toggle': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.09);
      vol.gain.setValueAtTime(0.10, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.11);
      return new Promise(r => setTimeout(r, 110));
    },

    // Quick upward whoosh — message sent
    'chat-send': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
      vol.gain.setValueAtTime(0.10, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.14);
      return new Promise(r => setTimeout(r, 140));
    },

    // Soft two-tone ping — AI response received
    'chat-receive': (ctx) => {
      note(ctx, 880,  'sine', 0.09, 0,    0.10);
      note(ctx, 1100, 'sine', 0.09, 0.08, 0.12);
      return new Promise(r => setTimeout(r, 200));
    },

    // Downward sweep — clear conversation
    'clear-chat': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.18);
      vol.gain.setValueAtTime(0.10, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.20);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.20);
      return new Promise(r => setTimeout(r, 200));
    },

    // Low sawtooth thud — locked location denied
    'locked': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
      vol.gain.setValueAtTime(0.12, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
      return new Promise(r => setTimeout(r, 150));
    },

    // Brief high tick — map zoom
    'zoom': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      vol.gain.setValueAtTime(0.06, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.04);
      return new Promise(r => setTimeout(r, 40));
    },

    // Two ascending notes — microphone recording started
    'mic-start': (ctx) => {
      note(ctx, 660, 'sine', 0.10, 0,    0.08);  // E5
      note(ctx, 880, 'sine', 0.11, 0.07, 0.10);  // A5
      return new Promise(r => setTimeout(r, 170));
    },

    // Single descending note — microphone recording stopped
    'mic-stop': (ctx) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.10);
      vol.gain.setValueAtTime(0.10, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(vol).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
      return new Promise(r => setTimeout(r, 120));
    },
  };

  return { isEnabled, setEnabled, play };
})();
