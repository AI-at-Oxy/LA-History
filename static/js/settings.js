/* =========================================
   LA History — Settings Modal
   ========================================= */

function openSettings() {
  if (typeof SFX !== 'undefined') SFX.play('settings-open');
  document.getElementById('settings-overlay').classList.add('open');
  initSettingsModal();
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('settings-overlay')) return;
  if (typeof SFX !== 'undefined') SFX.play('panel-close');
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
  if (typeof SFX !== 'undefined') SFX.play('filter-toggle');
}

// ---- Language filter ----

function langLabel(code) {
  try {
    const [lang, region] = code.split('-');
    const langName = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) || lang;
    if (region) {
      const regionName = new Intl.DisplayNames(['en'], { type: 'region' }).of(region) || region;
      return `${langName} — ${regionName}`;
    }
    return langName;
  } catch (_) {
    return code;
  }
}

function populateLangSelect() {
  if (typeof TTS === 'undefined' || !TTS.isSupported()) return;
  const allVoices = TTS.getVoices();
  const langs = [...new Set(allVoices.map(v => v.lang))].sort((a, b) => langLabel(a).localeCompare(langLabel(b)));
  const sel   = document.getElementById('tts-lang-select');
  const saved = localStorage.getItem('tts_lang') || '';
  sel.innerHTML = '<option value="">All languages</option>' +
    langs.map(l => `<option value="${l}"${l === saved ? ' selected' : ''}>${langLabel(l)}</option>`).join('');
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

function applyMarkerSize(size) {
  const cssSize = size + 2;
  document.documentElement.style.setProperty('--marker-size', cssSize + 'px');
  if (typeof renderMarkers === 'function' && typeof locationsData !== 'undefined') {
    renderMarkers(locationsData);
  }
}

function applyAnimSpeed(preset) {
  const html = document.documentElement;
  html.classList.remove('anim-reduced', 'anim-off');
  if (preset === 'reduced') html.classList.add('anim-reduced');
  if (preset === 'off')     html.classList.add('anim-off');
  localStorage.setItem('anim_speed', preset);
}

// Apply saved settings on page load (before modal is ever opened)
(function applySavedSettings() {
  const savedFontSize = localStorage.getItem('font_size');
  if (savedFontSize) {
    document.documentElement.style.setProperty('--font-size-base', savedFontSize + 'px');
  }
  const savedMarkerSize = localStorage.getItem('marker_size');
  if (savedMarkerSize) {
    document.documentElement.style.setProperty('--marker-size', (parseInt(savedMarkerSize) + 2) + 'px');
  }
  const savedAnimSpeed = localStorage.getItem('anim_speed');
  if (savedAnimSpeed && savedAnimSpeed !== 'normal') applyAnimSpeed(savedAnimSpeed);
  const savedVol = localStorage.getItem('sfx_volume');
  if (savedVol && typeof SFX !== 'undefined') SFX.setVolume(parseFloat(savedVol));
})();

function initSettingsModal() {
  // Theme select
  const themeSel = document.getElementById('theme-select');
  if (themeSel) {
    const current = localStorage.getItem('darkMode') || 'light';
    themeSel.value = (current === 'true') ? 'semi-dark' : (current === 'false' ? 'light' : current);
    themeSel.onchange = () => { if (typeof SFX !== 'undefined') SFX.play('hover'); setTheme(themeSel.value); };
  }

  // Map tile style
  const tileSel = document.getElementById('map-tile-select');
  if (tileSel) {
    tileSel.value = localStorage.getItem('map_tile_style') || 'voyager';
    tileSel.onchange = () => { if (typeof SFX !== 'undefined') SFX.play('hover'); if (typeof setTileStyle === 'function') setTileStyle(tileSel.value); };
  }

  // Animation speed preset
  const animSel = document.getElementById('anim-speed-select');
  if (animSel) {
    animSel.value = localStorage.getItem('anim_speed') || 'normal';
    animSel.onchange = () => { if (typeof SFX !== 'undefined') SFX.play('hover'); applyAnimSpeed(animSel.value); };
  }

  // TTS settings (only if TTS is available)
  if (typeof TTS !== 'undefined' && TTS.isSupported()) {
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
      hlToggle.onchange = () => { if (typeof SFX !== 'undefined') SFX.play('hover'); localStorage.setItem('tts_word_highlight', hlToggle.checked ? 'on' : 'off'); };
    }
  }

  // Music toggle
  const musicToggle = document.getElementById('music-toggle');
  if (musicToggle && typeof MusicPlayer !== 'undefined') {
    musicToggle.checked = MusicPlayer.isEnabled();
    musicToggle.onchange = () => {
      if (typeof SFX !== 'undefined') SFX.play('hover');
      MusicPlayer.setEnabled(musicToggle.checked);
    };
  }

  // Music volume slider
  const musicVolSlider = document.getElementById('music-volume-slider');
  const musicVolVal    = document.getElementById('music-volume-val');
  if (musicVolSlider && typeof MusicPlayer !== 'undefined') {
    musicVolSlider.value = MusicPlayer.getVolume();
    if (musicVolVal) musicVolVal.textContent = Math.round(MusicPlayer.getVolume() * 100) + '%';
    musicVolSlider.oninput = () => {
      MusicPlayer.setVolume(parseFloat(musicVolSlider.value));
      if (musicVolVal) musicVolVal.textContent = Math.round(musicVolSlider.value * 100) + '%';
    };
  }

  // Sound effects toggle
  const sfxToggle = document.getElementById('sfx-toggle');
  if (sfxToggle && typeof SFX !== 'undefined') {
    sfxToggle.checked = SFX.isEnabled();
    sfxToggle.onchange = () => {
      if (sfxToggle.checked) {
        SFX.setEnabled(true);
        SFX.play('hover');
      } else {
        SFX.play('hover');
        SFX.setEnabled(false);
      }
    };
  }

  // SFX volume slider
  const volSlider = document.getElementById('sfx-volume-slider');
  const volVal    = document.getElementById('sfx-volume-val');
  if (volSlider && typeof SFX !== 'undefined') {
    volSlider.value = SFX.getVolume();
    if (volVal) volVal.textContent = Math.round(SFX.getVolume() * 100) + '%';
    volSlider.oninput = () => {
      SFX.setVolume(parseFloat(volSlider.value));
      if (volVal) volVal.textContent = Math.round(volSlider.value * 100) + '%';
    };
  }

  // Font size slider
  const fsSlider = document.getElementById('fontsize-slider');
  const fsVal    = document.getElementById('fontsize-val');
  if (fsSlider) {
    fsSlider.value = localStorage.getItem('font_size') || '15';
    fsVal.textContent = fsSlider.value + 'px';
    fsSlider.oninput = () => {
      fsVal.textContent = fsSlider.value + 'px';
      localStorage.setItem('font_size', fsSlider.value);
      document.documentElement.style.setProperty('--font-size-base', fsSlider.value + 'px');
    };
  }

  // Marker size select
  const msSelect = document.getElementById('markersize-select');
  if (msSelect) {
    msSelect.value = localStorage.getItem('marker_size') || '32';
    msSelect.onchange = () => {
      if (typeof SFX !== 'undefined') SFX.play('hover');
      localStorage.setItem('marker_size', msSelect.value);
      applyMarkerSize(parseInt(msSelect.value));
    };
  }

  // Voice input settings
  if (typeof Voice !== 'undefined') {
    const voiceEnabledToggle = document.getElementById('voice-enabled-toggle');

    if (voiceEnabledToggle) {
      voiceEnabledToggle.checked = (localStorage.getItem('voice_enabled') || 'on') === 'on';
      voiceEnabledToggle.onchange = () => {
        if (typeof SFX !== 'undefined') SFX.play('hover');
        Voice.applySettings({ enabled: voiceEnabledToggle.checked });
      };
    }
  }

  // Reset progress
  const resetBtn = document.getElementById('reset-progress-btn');
  if (resetBtn) {
    resetBtn.onclick = async () => {
      const confirmed = confirm(
        'Are you sure you want to reset ALL progress?\n\n' +
        'This will permanently delete:\n' +
        '• All visited locations\n' +
        '• All quiz scores and attempts\n' +
        '• All earned badges\n' +
        '• All points\n\n' +
        'This action cannot be undone.'
      );
      if (!confirmed) return;
      try {
        await apiFetch('/api/progress/reset', 'POST');
        localStorage.removeItem('tutorial_completed');
        localStorage.removeItem('cm_tutorial_completed');
        showToast('All progress has been reset.', 'info');
        setTimeout(() => window.location.reload(), 1000);
      } catch (e) {
        showToast('Failed to reset progress: ' + e.message, 'error');
      }
    };
  }
}
