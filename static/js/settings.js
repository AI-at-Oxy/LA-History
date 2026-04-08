/* =========================================
   LA History — Settings Modal
   ========================================= */

function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  initSettingsModal();
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('settings-overlay')) return;
  document.getElementById('settings-overlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSettings();
});

function toggleAccordion(id) {
  const section = document.getElementById(id);
  const header  = section.querySelector('.accordion-header');
  const body    = section.querySelector('.accordion-body');
  header.classList.toggle('open');
  body.style.display = header.classList.contains('open') ? '' : 'none';
}

// ---- Language filter ----

function populateLangSelect() {
  if (typeof TTS === 'undefined' || !TTS.isSupported()) return;
  const allVoices = TTS.getVoices();
  const langs = [...new Set(allVoices.map(v => v.lang))].sort();
  const sel   = document.getElementById('tts-lang-select');
  const saved = localStorage.getItem('tts_lang') || '';
  sel.innerHTML = '<option value="">All languages</option>' +
    langs.map(l => `<option value="${l}"${l === saved ? ' selected' : ''}>${l}</option>`).join('');
  sel.onchange = () => {
    localStorage.setItem('tts_lang', sel.value);
    populateVoiceSelect(sel.value);
  };
}

function populateVoiceSelect(lang) {
  if (typeof TTS === 'undefined' || !TTS.isSupported()) return;
  const allVoices = TTS.getVoices();
  const filtered  = lang ? allVoices.filter(v => v.lang === lang) : allVoices;
  const sel   = document.getElementById('tts-voice-select');
  const saved = localStorage.getItem('tts_voice') || '';
  sel.innerHTML = '<option value="">Auto (default)</option>' +
    filtered.map(v =>
      `<option value="${v.name}"${v.name === saved ? ' selected' : ''}>${v.name} (${v.lang})</option>`
    ).join('');
  sel.onchange = () => localStorage.setItem('tts_voice', sel.value);
}

// ---- Main init ----

function initSettingsModal() {
  if (typeof TTS === 'undefined' || !TTS.isSupported()) return;

  // Language filter (populates first, then filters voices)
  populateLangSelect();
  populateVoiceSelect(localStorage.getItem('tts_lang') || '');

  // Speed slider
  const speedSlider = document.getElementById('tts-speed-slider');
  const speedVal    = document.getElementById('tts-speed-val');
  speedSlider.value = localStorage.getItem('tts_rate') || '0.92';
  speedVal.textContent = parseFloat(speedSlider.value).toFixed(2) + '×';
  speedSlider.oninput = () => {
    speedVal.textContent = parseFloat(speedSlider.value).toFixed(2) + '×';
    localStorage.setItem('tts_rate', speedSlider.value);
  };

  // Pitch slider
  const pitchSlider = document.getElementById('tts-pitch-slider');
  const pitchVal    = document.getElementById('tts-pitch-val');
  pitchSlider.value = localStorage.getItem('tts_pitch') || '1.0';
  pitchVal.textContent = parseFloat(pitchSlider.value).toFixed(2);
  pitchSlider.oninput = () => {
    pitchVal.textContent = parseFloat(pitchSlider.value).toFixed(2);
    localStorage.setItem('tts_pitch', pitchSlider.value);
  };

  // Word highlight toggle
  const hlToggle = document.getElementById('tts-highlight-toggle');
  if (hlToggle) {
    hlToggle.checked = localStorage.getItem('tts_word_highlight') === 'on';
    hlToggle.onchange = () => localStorage.setItem('tts_word_highlight', hlToggle.checked ? 'on' : 'off');
  }
}
