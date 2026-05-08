/* =========================================
   LA History — Ambient Music Player
   Web Audio API synthesized era loops.
   ========================================= */

const MusicPlayer = (() => {
  let audioCtx = null;
  let musicGain = null;
  let enabled = localStorage.getItem('music_enabled') !== 'off';
  let volume = parseFloat(localStorage.getItem('music_volume') || '0.4');
  let currentEra = null;
  let droneNodes = [];
  let scheduleTimer = null;
  let isDucked = false;
  let switchId = 0;
  let _pendingEra = null;

  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  function fadeTo(targetVol, durationMs) {
    if (!musicGain) return;
    const t = audioCtx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(targetVol, t + durationMs / 1000);
  }

  function setVolume(val) {
    volume = Math.max(0, Math.min(1, val));
    if (musicGain && !isDucked) {
      const t = audioCtx.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setValueAtTime(volume, t);
    }
    localStorage.setItem('music_volume', String(volume));
  }

  function getVolume() { return volume; }
  function isEnabled() { return enabled; }

  function setEnabled(val) {
    enabled = !!val;
    localStorage.setItem('music_enabled', val ? 'on' : 'off');
    if (!enabled) {
      fadeTo(0, 300);
      setTimeout(stopNodes, 350);
    } else if (currentEra) {
      play(currentEra);
    }
  }

  function stopNodes() {
    if (scheduleTimer) { clearInterval(scheduleTimer); scheduleTimer = null; }
    droneNodes.forEach(n => { try { n.stop(); } catch (_) {} });
    droneNodes = [];
  }

  function duck() {
    if (!enabled || !musicGain) return;
    isDucked = true;
    fadeTo(volume * 0.1, 300);
  }

  function restore() {
    if (!musicGain) return;
    isDucked = false;
    fadeTo(volume, 500);
  }

  function play(era) {
    if (!enabled) { currentEra = era; return; }
    getCtx();

    if (audioCtx.state === 'suspended') {
      _pendingEra = era;
      currentEra = era;
      return;
    }

    if (era === currentEra && droneNodes.length > 0) return;
    currentEra = era;
    localStorage.setItem('music_last_era', era);
    const myId = ++switchId;

    if (droneNodes.length > 0) {
      fadeTo(0, 350);
      setTimeout(() => {
        if (switchId !== myId) return;
        stopNodes();
        startEra(era);
      }, 400);
    } else {
      startEra(era);
    }
  }

  function stop() {
    fadeTo(0, 350);
    setTimeout(() => { stopNodes(); currentEra = null; }, 400);
  }

  function startEra(era) {
    const ctx = getCtx();
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(isDucked ? volume * 0.1 : volume, ctx.currentTime + 0.7);

    const map = { native: startNative, spanish: startSpanish, rancho: startRancho, modern: startModern };
    const fn = map[era];
    if (fn) fn(ctx);
  }

  // Continuous oscillator drone
  function drone(ctx, freq, type, gain) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.value = gain;
    osc.connect(vol).connect(musicGain);
    osc.start();
    droneNodes.push(osc);
    return { osc, vol };
  }

  // Single scheduled note (auto-releases)
  function schedNote(ctx, freq, type, gain, delay, dur) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    vol.gain.setValueAtTime(0, t);
    vol.gain.linearRampToValueAtTime(gain, t + Math.min(0.1, dur * 0.25));
    vol.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(vol).connect(musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ---- Native / Tongva: earthy, meditative ----
  // Low sine drone + slow tremolo LFO + pentatonic flute-like arpeggio
  function startNative(ctx) {
    const { vol: droneVol } = drone(ctx, 110, 'sine', 0.05);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(droneVol.gain);
    lfo.start();
    droneNodes.push(lfo);
    drone(ctx, 220, 'sine', 0.02);

    const penta = [220, 277.18, 329.63, 440, 554.37]; // A3 C#4 E4 A4 C#5
    let idx = 0;
    function block() {
      for (let i = 0; i < 3; i++) {
        schedNote(ctx, penta[(idx + i) % penta.length], 'triangle', 0.05, i * 2.3 + 0.05, 2.2);
      }
      idx = (idx + 3) % penta.length;
    }
    block();
    scheduleTimer = setInterval(block, 6900);
  }

  // ---- Spanish Colonial: rhythmic, warm ----
  // Triangle bass + picked E-major arpeggio
  function startSpanish(ctx) {
    drone(ctx, 110,    'triangle', 0.04);  // A2
    drone(ctx, 164.81, 'triangle', 0.022); // E3

    const chord = [164.81, 207.65, 246.94, 329.63]; // E3 G#3 B3 E4
    function block() {
      for (let i = 0; i < 8; i++) {
        const g = 0.055 + (i % 4 === 0 ? 0.018 : 0);
        schedNote(ctx, chord[i % chord.length], 'triangle', g, i * 0.42, 0.5);
      }
    }
    block();
    scheduleTimer = setInterval(block, 3360);
  }

  // ---- Rancho: open, pastoral ----
  // Filtered sawtooth bass + open fifth + slow LFO + pad notes
  function startRancho(ctx) {
    const bassOsc = ctx.createOscillator();
    const bassFilter = ctx.createBiquadFilter();
    const bassVol = ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = 98; // G2
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 350;
    bassFilter.Q.value = 0.7;
    bassVol.gain.value = 0.032;
    bassOsc.connect(bassFilter).connect(bassVol).connect(musicGain);
    bassOsc.start();
    droneNodes.push(bassOsc);

    drone(ctx, 146.83, 'sine', 0.025); // D3

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain).connect(bassFilter.frequency);
    lfo.start();
    droneNodes.push(lfo);

    const pad = [196, 293.66, 392]; // G3 D4 G4
    let idx = 0;
    function block() {
      for (let i = 0; i < 3; i++) {
        schedNote(ctx, pad[(idx + i) % pad.length], 'sine', 0.042, i * 2.6, 3.0);
      }
      idx = (idx + 3) % pad.length;
    }
    block();
    scheduleTimer = setInterval(block, 7800);
  }

  // ---- Modern: urban, contemporary ----
  // Ambient pad + filtered bass pulse + hi shimmer
  function startModern(ctx) {
    drone(ctx, 440,    'sine', 0.022); // A4
    drone(ctx, 554.37, 'sine', 0.016); // C#5

    const pulseOsc = ctx.createOscillator();
    const pulseFilter = ctx.createBiquadFilter();
    const pulseVol = ctx.createGain();
    pulseOsc.type = 'square';
    pulseOsc.frequency.value = 55; // A1
    pulseFilter.type = 'lowpass';
    pulseFilter.frequency.value = 110;
    pulseVol.gain.value = 0;
    pulseOsc.connect(pulseFilter).connect(pulseVol).connect(musicGain);
    pulseOsc.start();
    droneNodes.push(pulseOsc);

    const beatDur = 60 / 76; // ~0.79s @ 76 bpm
    function block() {
      const t = audioCtx.currentTime + 0.05;
      for (let i = 0; i < 4; i++) {
        pulseVol.gain.setValueAtTime(0.045, t + i * beatDur);
        pulseVol.gain.exponentialRampToValueAtTime(0.001, t + i * beatDur + 0.22);
      }
      schedNote(audioCtx, 1760, 'triangle', 0.01, 0.05, 0.12);
      schedNote(audioCtx, 1760, 'triangle', 0.01, beatDur * 2 + 0.05, 0.12);
    }
    block();
    scheduleTimer = setInterval(block, Math.round(beatDur * 4 * 1000));
  }

  // Resume suspended context on first user gesture, then start pending era
  function _tryResume() {
    if (!audioCtx || audioCtx.state !== 'suspended') return;
    audioCtx.resume().then(() => {
      if (_pendingEra && enabled && droneNodes.length === 0) {
        const era = _pendingEra;
        _pendingEra = null;
        startEra(era);
      }
    });
  }
  document.addEventListener('click',   _tryResume);
  document.addEventListener('keydown', _tryResume);

  // Pause when tab is hidden, resume on return
  document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.hidden) audioCtx.suspend();
    else {
      audioCtx.resume().then(() => {
        if (_pendingEra && enabled && droneNodes.length === 0) {
          const era = _pendingEra;
          _pendingEra = null;
          startEra(era);
        }
      });
    }
  });

  return { isEnabled, setEnabled, play, stop, duck, restore, setVolume, getVolume };
})();
