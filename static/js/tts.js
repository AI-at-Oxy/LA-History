/* =========================================
   LA History — Text-to-Speech
   ========================================= */

const TTS = (() => {
  const synth = window.speechSynthesis;
  let voices = [];

  if (synth) {
    const loadVoices = () => { voices = synth.getVoices(); };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  function isSupported() {
    return !!synth;
  }

  function getSettings() {
    return {
      rate:      parseFloat(localStorage.getItem('tts_rate')  || '0.92'),
      pitch:     parseFloat(localStorage.getItem('tts_pitch') || '1.0'),
      voiceName: localStorage.getItem('tts_voice') || null,
    };
  }

  // ---- Text preprocessing ----

  const ABBREVIATIONS = [
    [/\bSt\.\s/g,       'Saint '],
    [/\bAve\.\b/g,      'Avenue'],
    [/\bBlvd\.\b/g,     'Boulevard'],
    [/\bDr\.\s/g,       'Drive '],
    [/\bRd\.\b/g,       'Road'],
    [/\bMt\.\s/g,       'Mount '],
    [/\bFt\.\s/g,       'Fort '],
    [/\bLt\.\s/g,       'Lieutenant '],
    [/\bGen\.\s/g,      'General '],
    [/\bGov\.\s/g,      'Governor '],
    [/\bCapt\.\s/g,     'Captain '],
    [/\bCol\.\s/g,      'Colonel '],
    [/\bSgt\.\s/g,      'Sergeant '],
    [/\bPvt\.\s/g,      'Private '],
    [/\bapprox\.\s/gi,  'approximately '],
    [/\bca\.\s/g,       'circa '],
    [/\betc\.\b/gi,     'etcetera'],
    [/\bvs\.\s/g,       'versus '],
    [/\be\.g\.\s/gi,    'for example '],
    [/\bi\.e\.\s/gi,    'that is '],
    [/\bL\.A\.\b/g,     'Los Angeles'],
  ];

  const ONES = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen',
  ];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const ORDINALS = {
    '1st':'first', '2nd':'second', '3rd':'third', '4th':'fourth', '5th':'fifth',
    '6th':'sixth', '7th':'seventh', '8th':'eighth', '9th':'ninth', '10th':'tenth',
    '11th':'eleventh', '12th':'twelfth', '13th':'thirteenth', '14th':'fourteenth',
    '15th':'fifteenth', '16th':'sixteenth', '17th':'seventeenth', '18th':'eighteenth',
    '19th':'nineteenth', '20th':'twentieth', '21st':'twenty-first', '22nd':'twenty-second',
    '23rd':'twenty-third', '24th':'twenty-fourth', '25th':'twenty-fifth',
  };

  function twoDigits(n) {
    if (n === 0)  return '';
    if (n < 20)   return ONES[n];
    const t = TENS[Math.floor(n / 10)];
    const o = ONES[n % 10];
    return o ? `${t}-${o}` : t;
  }

  function yearToWords(year) {
    if (year >= 2000) {
      const r = year - 2000;
      if (r === 0)  return 'two thousand';
      if (r < 10)   return `two thousand oh ${ONES[r]}`;
      return `two thousand ${twoDigits(r)}`;
    }
    const hi = Math.floor(year / 100);
    const lo = year % 100;
    const hiWord = twoDigits(hi);
    if (lo === 0)  return `${hiWord} hundred`;
    if (lo < 10)   return `${hiWord} oh ${ONES[lo]}`;
    return `${hiWord} ${twoDigits(lo)}`;
  }

  function expandNumber(str) {
    const n = parseInt(str.replace(/,/g, ''), 10);
    if (isNaN(n)) return str;
    if (n >= 1000 && n <= 2099) return yearToWords(n);
    if (n === 0)  return 'zero';
    if (n < 20)   return ONES[n];
    if (n < 100)  return twoDigits(n);
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      return r ? `${ONES[h]} hundred ${twoDigits(r)}` : `${ONES[h]} hundred`;
    }
    const thousands = Math.floor(n / 1000);
    const rem = n % 1000;
    const tWord = thousands < 20 ? ONES[thousands] : twoDigits(thousands);
    if (!rem) return `${tWord} thousand`;
    if (rem < 100) return `${tWord} thousand ${twoDigits(rem)}`;
    return `${tWord} thousand ${ONES[Math.floor(rem / 100)]} hundred${rem % 100 ? ' ' + twoDigits(rem % 100) : ''}`;
  }

  function preprocessText(text) {
    let t = text.replace(/~/g, 'around');

    // Ordinals (must run before general number expansion)
    t = t.replace(/\b(\d{1,2}(?:st|nd|rd|th))\b/gi, m => ORDINALS[m] || m);

    // Decade annotations: "1840s" → "eighteen forties"
    t = t.replace(/\b(\d{4})s\b/g, (_, yr) => yearToWords(parseInt(yr)) + 's');

    // Year ranges: "1847–1850" or "1847-1850"
    t = t.replace(/\b(\d{4})\s*[-\u2013\u2014]\s*(\d{4})\b/g, (_, a, b) =>
      `${yearToWords(parseInt(a))} to ${yearToWords(parseInt(b))}`
    );

    // Standalone numbers (with optional commas, e.g. 10,000)
    t = t.replace(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/g, m => expandNumber(m));

    // Abbreviations
    ABBREVIATIONS.forEach(([regex, replacement]) => {
      t = t.replace(regex, replacement);
    });

    return t;
  }

  // ---- Self-calibrating duration estimator ----
  // Stores actual chars/second per rate bucket (nearest 0.25) so each speed
  // accumulates its own calibration. A global normalised fallback is also kept
  // for rates that have never been used before.
  // Manually stopped sessions are excluded from calibration.

  let _speechStart = null;

  function _rateKey(rate) {
    return (Math.round(rate * 10) / 10).toFixed(2); // e.g. "0.90", "1.00", "1.50"
  }

  function _updateCalibration(charCount, actualMs, rate) {
    if (actualMs < 800 || charCount < 20) return;
    const cps = charCount / actualMs * 1000; // actual CPS at this rate
    if (cps < 4 || cps > 120) return;

    // Rate-specific bucket — most accurate for this speed
    const key  = _rateKey(rate);
    const hist = JSON.parse(localStorage.getItem(`tts_cps_history_${key}`) || '[]');
    hist.push(parseFloat(cps.toFixed(1)));
    if (hist.length > 8) hist.shift();
    localStorage.setItem(`tts_cps_history_${key}`, JSON.stringify(hist));
    localStorage.setItem(`tts_cps_${key}`,
      (hist.reduce((a, b) => a + b, 0) / hist.length).toFixed(2));

    // Global normalised fallback (cps ÷ rate) used for unseen rates
    const normCps  = cps / rate;
    const gHist    = JSON.parse(localStorage.getItem('tts_cps_history') || '[]');
    gHist.push(parseFloat(normCps.toFixed(1)));
    if (gHist.length > 8) gHist.shift();
    localStorage.setItem('tts_cps_history', JSON.stringify(gHist));
    localStorage.setItem('tts_cps',
      (gHist.reduce((a, b) => a + b, 0) / gHist.length).toFixed(2));
  }

  // ---- Core API ----

  function speak(text, callbacks = {}) {
    if (!synth) return;
    synth.cancel();
    const processed = preprocessText(text);
    const s = getSettings();
    const utterance = new SpeechSynthesisUtterance(processed);
    utterance.rate  = s.rate;
    utterance.pitch = s.pitch;

    const preferred = s.voiceName
      ? voices.find(v => v.name === s.voiceName)
      : voices.find(v => v.lang === 'en-US' && /Google|Samantha|Alex/.test(v.name));
    if (preferred) utterance.voice = preferred;

    let _interval = null;

    utterance.onstart = () => {
      _speechStart = Date.now();
      if (callbacks.onBoundary) {
        _interval = setInterval(() => {
          if (_speechStart === null) return;
          // Re-read rate each tick — adjusts instantly when settings change
          const currentRate = parseFloat(localStorage.getItem('tts_rate') || '0.92');
          const key = _rateKey(currentRate);
          // Prefer rate-specific calibration; fall back to global normalised × rate
          const rateCps     = parseFloat(localStorage.getItem(`tts_cps_${key}`) || '0');
          const fallbackCps = parseFloat(localStorage.getItem('tts_cps') || '15') * currentRate;
          const baseCps     = rateCps > 0 ? rateCps : fallbackCps;
          const estimatedMs = Math.max(processed.length / baseCps * 1000, 500);
          const ratio = Math.min((Date.now() - _speechStart) / estimatedMs, 0.99);
          callbacks.onBoundary(Math.round(ratio * processed.length), processed.length);
        }, 80);
      }
    };

    // Pass real boundary events through for word highlight (Chrome/Edge only)
    if (callbacks.onBoundary) {
      utterance.onboundary = e => {
        if (e.name === 'word') callbacks.onBoundary(e.charIndex, processed.length);
      };
    }

    utterance.onend = () => {
      if (_interval) { clearInterval(_interval); _interval = null; }
      // Calibrate with actual duration (only for naturally completed utterances)
      if (_speechStart !== null) {
        _updateCalibration(processed.length, Date.now() - _speechStart, s.rate);
        _speechStart = null;
      }
      // Snap to 100% regardless of estimate accuracy
      if (callbacks.onBoundary) callbacks.onBoundary(processed.length, processed.length);
      if (callbacks.onEnd) callbacks.onEnd();
    };

    synth.speak(utterance);
  }

  function stop() {
    _speechStart = null; // Exclude manually stopped sessions from calibration
    if (synth) synth.cancel();
  }

  function isSpeaking() {
    return synth ? synth.speaking : false;
  }

  return { isSupported, speak, stop, isSpeaking, getVoices: () => voices };
})();
