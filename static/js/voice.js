/* =============================================================
   LA History — Voice Input Module
   Exposes global singleton: Voice
   Follows the same IIFE pattern as TTS and SFX modules.
   ============================================================= */

const Voice = (() => {
  // ── State constants ──────────────────────────────────────────
  const STATES = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', RESULT: 'result', ERROR: 'error' };

  // ── Module state ─────────────────────────────────────────────
  let _state = STATES.IDLE;
  let _micBtn = null;
  let _ollamaAvailable = null;   // null = unchecked, true/false = checked
  let _ollamaModel    = null;
  let _activeAdapter  = null;    // currently running adapter instance
  let _errorResetTimer = null;
  let _resultResetTimer = null;

  // ── Settings helpers ─────────────────────────────────────────
  function _getSettings() {
    return {
      enabled: (localStorage.getItem('voice_enabled') || 'on') === 'on',
      method:   localStorage.getItem('voice_method')  || 'browser',
    };
  }

  // ── Browser STT adapter ─────────────────────────────────────
  const _BrowserSTTAdapter = (() => {
    let _recognition = null;
    let _onResult, _onError;

    function _isSupported() {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    function start(onResult, onError) {
      if (!_isSupported()) {
        onError('not-supported');
        return;
      }

      // Require secure context in non-localhost environments
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        onError('insecure-context');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      _recognition = new SpeechRecognition();
      _recognition.continuous  = false;
      _recognition.interimResults = false;
      _recognition.lang = 'en-US';

      _onResult = onResult;
      _onError  = onError;

      _recognition.onresult = (e) => {
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalText += e.results[i][0].transcript;
          }
        }
        if (finalText.trim()) {
          onResult(finalText.trim());
        }
      };

      _recognition.onerror = (e) => {
        onError(e.error || 'unknown');
      };

      _recognition.onend = () => {
        // If we haven't already delivered a result or error, fire a no-speech error
        // so the state machine doesn't hang in LISTENING.
        // (The result callback transitions state; if it was already called this is a no-op.)
      };

      try {
        _recognition.start();
      } catch (err) {
        onError('start-failed');
      }
    }

    function stop() {
      if (_recognition) {
        try { _recognition.stop(); } catch (_) {}
        _recognition = null;
      }
    }

    return { isSupported: _isSupported, start, stop };
  })();

  // ── Ollama STT adapter ──────────────────────────────────────
  const _OllamaSTTAdapter = (() => {
    let _mediaRecorder = null;
    let _chunks = [];
    const MAX_DURATION_MS = 30000; // 30 second safety cap
    let _maxDurationTimer = null;

    function _getSupportedMimeType() {
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return '';
    }

    function start(onResult, onError) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onError('not-supported');
        return;
      }

      const mimeType = _getSupportedMimeType();

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          _chunks = [];
          const options = mimeType ? { mimeType } : {};
          try {
            _mediaRecorder = new MediaRecorder(stream, options);
          } catch (_) {
            _mediaRecorder = new MediaRecorder(stream);
          }

          _mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) _chunks.push(e.data);
          };

          _mediaRecorder.onstop = () => {
            // Stop all tracks to release microphone
            stream.getTracks().forEach(t => t.stop());
            clearTimeout(_maxDurationTimer);

            const blobType = _mediaRecorder.mimeType || mimeType || 'audio/webm';
            const blob = new Blob(_chunks, { type: blobType });
            _chunks = [];
            _mediaRecorder = null;

            // Upload to backend proxy
            const formData = new FormData();
            formData.append('audio', blob, 'recording.' + (blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm'));
            // Attach CSRF token (global constant set by Flask template)
            if (typeof CSRF_TOKEN !== 'undefined') {
              formData.append('csrf_token', CSRF_TOKEN);
            }

            fetch('/api/voice/transcribe', {
              method: 'POST',
              body: formData,
              credentials: 'same-origin',
            })
              .then(r => {
                if (!r.ok) return r.json().then(d => { throw new Error(d.error || 'Transcription failed'); });
                return r.json();
              })
              .then(data => {
                if (data.transcript) {
                  onResult(data.transcript);
                } else {
                  onError('empty-transcript');
                }
              })
              .catch(err => {
                onError('transcribe-failed: ' + err.message);
              });
          };

          _mediaRecorder.start();

          // Enforce max duration
          _maxDurationTimer = setTimeout(() => {
            if (_mediaRecorder && _mediaRecorder.state === 'recording') {
              _mediaRecorder.stop();
            }
          }, MAX_DURATION_MS);
        })
        .catch(err => {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            onError('not-allowed');
          } else {
            onError('media-error: ' + err.message);
          }
        });
    }

    function stop() {
      clearTimeout(_maxDurationTimer);
      if (_mediaRecorder && _mediaRecorder.state === 'recording') {
        try { _mediaRecorder.stop(); } catch (_) {}
      }
    }

    return { start, stop };
  })();

  // ── State machine ────────────────────────────────────────────
  function _transition(newState) {
    if (_state === newState) return;
    const prev = _state;
    _state = newState;

    if (!_micBtn) return;

    // Remove all state classes
    _micBtn.classList.remove('listening', 'processing', 'error');

    switch (newState) {
      case STATES.LISTENING:
        _micBtn.classList.add('listening');
        _micBtn.setAttribute('aria-pressed', 'true');
        _micBtn.title = 'Stop recording';
        _micBtn.setAttribute('aria-label', 'Stop recording');
        if (typeof SFX !== 'undefined') SFX.play('mic-start');
        break;

      case STATES.PROCESSING:
        _micBtn.classList.add('processing');
        _micBtn.setAttribute('aria-pressed', 'false');
        _micBtn.title = 'Processing…';
        _micBtn.setAttribute('aria-label', 'Processing speech');
        if (typeof SFX !== 'undefined') SFX.play('mic-stop');
        break;

      case STATES.RESULT:
        _micBtn.setAttribute('aria-pressed', 'false');
        _micBtn.title = 'Voice input';
        _micBtn.setAttribute('aria-label', 'Start voice input');
        if (prev === STATES.LISTENING && typeof SFX !== 'undefined') SFX.play('mic-stop');
        // Auto-reset to IDLE
        clearTimeout(_resultResetTimer);
        _resultResetTimer = setTimeout(() => _transition(STATES.IDLE), 300);
        break;

      case STATES.ERROR:
        _micBtn.classList.add('error');
        _micBtn.setAttribute('aria-pressed', 'false');
        _micBtn.title = 'Voice input';
        _micBtn.setAttribute('aria-label', 'Start voice input');
        // Auto-reset to IDLE
        clearTimeout(_errorResetTimer);
        _errorResetTimer = setTimeout(() => _transition(STATES.IDLE), 2000);
        break;

      case STATES.IDLE:
      default:
        _micBtn.setAttribute('aria-pressed', 'false');
        _micBtn.title = 'Voice input';
        _micBtn.setAttribute('aria-label', 'Start voice input');
        break;
    }
  }

  // ── Error handling ───────────────────────────────────────────
  function _handleError(errorCode) {
    const messages = {
      'not-allowed':      'Microphone access denied. Please allow microphone in your browser settings.',
      'not-supported':    'Voice input is not supported in this browser. Try Chrome or Edge.',
      'insecure-context': 'Voice input requires HTTPS. It works on localhost during development.',
      'no-speech':        'No speech detected. Please try again.',
      'network':          'Network error during voice recognition. Check your connection.',
      'aborted':          null,  // user-cancelled, no toast needed
      'start-failed':     'Could not start voice recognition. Please reload the page.',
      'empty-transcript': 'Ollama returned an empty transcript. Try speaking more clearly.',
    };

    const msg = messages[errorCode] !== undefined
      ? messages[errorCode]
      : (errorCode.startsWith('transcribe-failed')
          ? 'Transcription failed. Ollama may not support audio input with this model.'
          : `Voice input error: ${errorCode}`);

    _transition(STATES.ERROR);

    if (msg && typeof showToast === 'function') {
      showToast(msg, 'error');
    }
  }

  // ── Text injection into chat input ───────────────────────────
  function _injectTranscript(text) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    input.value = text;
    // Trigger the existing auto-resize handler in chat.js
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    _transition(STATES.RESULT);
  }

  // ── Ollama health check ──────────────────────────────────────
  function _checkOllamaHealth(callback) {
    // Use apiFetch from utils.js if available, otherwise plain fetch
    const fetcher = typeof apiFetch === 'function'
      ? (url) => apiFetch(url)
      : (url) => fetch(url, { credentials: 'same-origin' }).then(r => r.json());

    fetcher('/api/voice/health')
      .then(data => {
        _ollamaAvailable = !!data.available;
        _ollamaModel     = data.model || null;
        // Update the settings status label if the modal is open
        const statusEl = document.getElementById('voice-ollama-status-text');
        if (statusEl) {
          statusEl.textContent = _ollamaAvailable
            ? `Available (${_ollamaModel})`
            : (data.reason || 'Unavailable');
          statusEl.style.color = _ollamaAvailable ? 'var(--success, #3a7a3a)' : 'var(--text-muted)';
        }
        if (typeof callback === 'function') callback(_ollamaAvailable);
      })
      .catch(() => {
        _ollamaAvailable = false;
        _ollamaModel     = null;
        if (typeof callback === 'function') callback(false);
      });
  }

  // ── Adapter selection & start ────────────────────────────────
  function _startWithAdapter(adapter) {
    _activeAdapter = adapter;
    _transition(STATES.LISTENING);

    adapter.start(
      // onResult
      (transcript) => {
        _activeAdapter = null;
        // For browser STT: state goes directly LISTENING → RESULT
        // For Ollama: state goes LISTENING → PROCESSING (handled in OllamaSTTAdapter.onstop)
        // so we only call _injectTranscript here once the data is ready
        _injectTranscript(transcript);
      },
      // onError
      (errorCode) => {
        _activeAdapter = null;
        _handleError(errorCode);
      }
    );
  }

  // ── Public API ───────────────────────────────────────────────
  function isSupported() {
    return _BrowserSTTAdapter.isSupported() || (navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia);
  }

  function start() {
    if (_state !== STATES.IDLE) {
      // Toggle off if already listening
      if (_state === STATES.LISTENING && _activeAdapter) {
        stop();
      }
      return;
    }

    const settings = _getSettings();
    if (!settings.enabled) return;

    if (settings.method === 'ollama') {
      if (_ollamaAvailable === true) {
        _startWithAdapter(_OllamaSTTAdapter);
      } else if (_ollamaAvailable === false) {
        // Fall back to browser
        if (typeof showToast === 'function') {
          showToast('Ollama audio not available. Using browser voice input.', 'info');
        }
        _startBrowserOrError();
      } else {
        // Not yet checked — run health check first
        _checkOllamaHealth((available) => {
          if (available) {
            _startWithAdapter(_OllamaSTTAdapter);
          } else {
            if (typeof showToast === 'function') {
              showToast('Ollama audio not available. Using browser voice input.', 'info');
            }
            _startBrowserOrError();
          }
        });
      }
    } else {
      _startBrowserOrError();
    }
  }

  function _startBrowserOrError() {
    if (_BrowserSTTAdapter.isSupported()) {
      _startWithAdapter(_BrowserSTTAdapter);
    } else {
      _handleError('not-supported');
      // Permanently hide the mic button
      if (_micBtn) _micBtn.style.display = 'none';
      const wrap = document.querySelector('.chat-input-wrap');
      if (wrap) wrap.classList.remove('voice-enabled');
    }
  }

  function stop() {
    if (_activeAdapter) {
      _activeAdapter.stop();
      _activeAdapter = null;
    }
    _transition(STATES.IDLE);
  }

  function getState() {
    return _state;
  }

  function applySettings(obj) {
    if (obj.enabled !== undefined) localStorage.setItem('voice_enabled', obj.enabled ? 'on' : 'off');
    if (obj.method  !== undefined) {
      localStorage.setItem('voice_method', obj.method);
      // Re-run health check when switching to ollama
      if (obj.method === 'ollama') {
        _ollamaAvailable = null;
        _checkOllamaHealth(() => {});
      }
    }
  }

  // ── DOM wiring (runs once on DOMContentLoaded) ───────────────
  function _init() {
    _micBtn = document.getElementById('chat-mic-btn');
    if (!_micBtn) return;

    // Decide whether to show the mic button
    if (!isSupported()) {
      // Leave hidden — nothing to offer
      return;
    }

    // Add the voice-enabled class to the wrapper so textarea gets padding
    const wrap = document.querySelector('.chat-input-wrap');
    if (wrap) wrap.classList.add('voice-enabled');

    _micBtn.classList.add('visible');

    // Click handler — toggle recording
    _micBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      start();
    });

    // Run Ollama health check in background if method is ollama
    const settings = _getSettings();
    if (settings.method === 'ollama') {
      _checkOllamaHealth(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', _init);

  // Expose health-check so settings.js can trigger it on method change
  return {
    isSupported,
    start,
    stop,
    getState,
    applySettings,
    checkOllamaHealth: _checkOllamaHealth,
    // Expose for settings panel status display
    get ollamaAvailable() { return _ollamaAvailable; },
    get ollamaModel()     { return _ollamaModel; },
  };
})();
