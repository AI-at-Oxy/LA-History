/* =============================================================
   LA History — Voice Input Module
   Exposes global singleton: Voice
   Follows the same IIFE pattern as TTS and SFX modules.
   ============================================================= */

const Voice = (() => {
  // ── State constants ──────────────────────────────────────────
  const STATES = { IDLE: 'idle', LISTENING: 'listening', RESULT: 'result', ERROR: 'error' };

  // ── Module state ─────────────────────────────────────────────
  let _state = STATES.IDLE;
  let _micBtn = null;
  let _activeAdapter  = null;    // currently running adapter instance
  let _errorResetTimer = null;
  let _resultResetTimer = null;

  // ── Settings helpers ─────────────────────────────────────────
  function _getSettings() {
    return {
      enabled: (localStorage.getItem('voice_enabled') || 'on') === 'on',
    };
  }

  // ── Browser STT adapter ─────────────────────────────────────
  const _BrowserSTTAdapter = (() => {
    let _recognition = null;

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
    };

    const msg = messages[errorCode] !== undefined
      ? messages[errorCode]
      : `Voice input error: ${errorCode}`;

    _transition(STATES.ERROR);

    if (msg && typeof showToast === 'function') {
      showToast(msg, 'error');
    }
  }

  // ── Text injection into chat input ───────────────────────────
  let _targetInputId = 'chat-input';

  function _injectTranscript(text) {
    const input = document.getElementById(_targetInputId);
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    _transition(STATES.RESULT);
  }

  // ── Adapter start ────────────────────────────────────────────
  function _startWithAdapter(adapter) {
    _activeAdapter = adapter;
    _transition(STATES.LISTENING);

    adapter.start(
      (transcript) => {
        _activeAdapter = null;
        _injectTranscript(transcript);
      },
      (errorCode) => {
        _activeAdapter = null;
        _handleError(errorCode);
      }
    );
  }

  // ── Public API ───────────────────────────────────────────────
  function isSupported() {
    return _BrowserSTTAdapter.isSupported();
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
  }

  // ── Wire a single mic button to a specific input ─────────────
  function _wireButton(micBtnId, inputId) {
    const btn = document.getElementById(micBtnId);
    if (!btn) return;

    if (!isSupported()) return;

    // Add voice-enabled class to this button's wrapper
    const wrap = btn.closest('.chat-input-wrap');
    if (wrap) wrap.classList.add('voice-enabled');

    btn.classList.add('visible');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _micBtn = btn;
      _targetInputId = inputId;
      start();
    });
  }

  // ── DOM wiring (runs once on DOMContentLoaded) ───────────────
  function _init() {
    // Wire concept map tutor mic
    _wireButton('cm-chat-mic-btn', 'cm-chat-input');
  }

  document.addEventListener('DOMContentLoaded', _init);

  return { isSupported, start, stop, getState, applySettings };
})();
