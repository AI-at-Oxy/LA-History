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
})();

function initSettingsModal() {
  // Theme select
  const themeSel = document.getElementById('theme-select');
  if (themeSel) {
    const current = localStorage.getItem('darkMode') || 'light';
    themeSel.value = (current === 'true') ? 'semi-dark' : (current === 'false' ? 'light' : current);
    themeSel.onchange = () => setTheme(themeSel.value);
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
      hlToggle.onchange = () => localStorage.setItem('tts_word_highlight', hlToggle.checked ? 'on' : 'off');
    }
  }

  // Sound effects toggle
  const sfxToggle = document.getElementById('sfx-toggle');
  if (sfxToggle && typeof SFX !== 'undefined') {
    sfxToggle.checked = SFX.isEnabled();
    sfxToggle.onchange = () => SFX.setEnabled(sfxToggle.checked);
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
      localStorage.setItem('marker_size', msSelect.value);
      applyMarkerSize(parseInt(msSelect.value));
    };
  }

  // Voice input settings
  if (typeof Voice !== 'undefined') {
    const voiceEnabledToggle = document.getElementById('voice-enabled-toggle');
    const voiceMethodSelect  = document.getElementById('voice-method-select');
    const ollamaStatusRow    = document.getElementById('voice-ollama-status-row');
    const ollamaStatusText   = document.getElementById('voice-ollama-status-text');

    if (voiceEnabledToggle) {
      voiceEnabledToggle.checked = (localStorage.getItem('voice_enabled') || 'on') === 'on';
      voiceEnabledToggle.onchange = () => {
        Voice.applySettings({ enabled: voiceEnabledToggle.checked });
      };
    }

    if (voiceMethodSelect) {
      voiceMethodSelect.value = localStorage.getItem('voice_method') || 'browser';
      // Show/hide Ollama status row based on current selection
      function _updateOllamaRow() {
        if (ollamaStatusRow) {
          ollamaStatusRow.style.display = voiceMethodSelect.value === 'ollama' ? '' : 'none';
        }
      }
      _updateOllamaRow();

      voiceMethodSelect.onchange = () => {
        Voice.applySettings({ method: voiceMethodSelect.value });
        _updateOllamaRow();
        // Populate status text if switching to ollama
        if (voiceMethodSelect.value === 'ollama' && ollamaStatusText) {
          if (Voice.ollamaAvailable === null) {
            ollamaStatusText.textContent = 'Checking…';
            ollamaStatusText.style.color = 'var(--text-muted)';
          } else {
            ollamaStatusText.textContent = Voice.ollamaAvailable
              ? `Available (${Voice.ollamaModel})`
              : 'Unavailable';
            ollamaStatusText.style.color = Voice.ollamaAvailable
              ? 'var(--success, #3a7a3a)'
              : 'var(--text-muted)';
          }
        }
      };
    }

    // Populate Ollama status if method is already set to ollama
    if (voiceMethodSelect && voiceMethodSelect.value === 'ollama' && ollamaStatusText) {
      if (Voice.ollamaAvailable !== null) {
        ollamaStatusText.textContent = Voice.ollamaAvailable
          ? `Available (${Voice.ollamaModel})`
          : 'Unavailable';
        ollamaStatusText.style.color = Voice.ollamaAvailable
          ? 'var(--success, #3a7a3a)'
          : 'var(--text-muted)';
      }
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
        showToast('All progress has been reset.', 'info');
        setTimeout(() => window.location.reload(), 1000);
      } catch (e) {
        showToast('Failed to reset progress: ' + e.message, 'error');
      }
    };
  }
}
