/* =========================================
   LA History — Tutorial / Onboarding
   ========================================= */

var Tutorial = (function () {

  /* ---- Step definitions ---- */
  var STEPS = [
    {
      id: 'welcome',
      title: 'Welcome to LA History!',
      body: 'Explore 57 historical locations across 4 eras of Los Angeles — from the Tongva people to the modern city. This quick tour shows you how everything works.',
      targetSelector: null,
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
    {
      id: 'map',
      title: 'Navigate the Map',
      body: '<b>Drag</b> to pan around LA · <b>Scroll</b> to zoom in and out · <b>Click any marker</b> to explore that historical location.',
      targetSelector: '#map',
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
    {
      id: 'eras',
      title: 'Four Eras of LA History',
      body: 'Filter locations by era using these buttons. Unlock new eras by completing quizzes in the current one — starting with <b>Tongva</b> and progressing forward in time.',
      targetSelector: '#era-filter-bar',
      placement: 'bottom',
      spotlightPadding: 8,
      beforeRender: null,
    },
    {
      id: 'sidebar',
      title: 'Your Progress',
      body: 'Track your <b>points</b>, visited locations, and overall completion here. The ring fills as you explore more of LA\'s history.',
      targetSelector: '#sidebar',
      placement: 'right',
      spotlightPadding: 6,
      beforeRender: _ensureSidebarOpen,
    },
    {
      id: 'badges',
      title: 'Earn Badges',
      body: 'Complete quizzes and reach milestones to earn badges. Pass a quiz on your <b>first attempt</b> for full points — retries earn half. Score 90%+ for a bonus!',
      targetSelector: '#badge-grid',
      placement: 'right',
      spotlightPadding: 8,
      beforeRender: _ensureSidebarOpen,
    },
    {
      id: 'tutor',
      title: 'AI History Tutor',
      body: 'Open any location, then expand the <b>AI Tutor panel</b> in the bottom-right corner. Ask questions about the history — it guides you with thought-provoking prompts.',
      targetSelector: '#chat-panel',
      placement: 'top',
      spotlightPadding: 6,
      beforeRender: null,
    },
    {
      id: 'done',
      title: "You're Ready to Explore!",
      body: 'Click any marker on the map to get started. Good luck, historian!',
      targetSelector: null,
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
  ];

  /* ---- Internal state ---- */
  var _currentIndex = -1;
  var _active = false;
  var _keyHandler = null;
  var _reducedMotion = false;
  var _previousFocus = null;
  var _sidebarWasCollapsed = false;

  /* ---- Public API ---- */

  function init() {
    _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    _buildDOM();
    // Register help-btn (may not exist on non-map pages)
    var helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', function () { replay(); });
    }
    // Show automatically only on first visit
    if (!localStorage.getItem('tutorial_completed')) {
      // Small delay so map tiles have a moment to render
      setTimeout(function () { start(); }, 600);
    }
  }

  function start() {
    _buildDOM();
    _sidebarWasCollapsed = false;
    _currentIndex = 0;
    _active = true;
    var overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
      overlay.classList.add('tutorial-visible');
      overlay.setAttribute('aria-hidden', 'false');
    }
    _previousFocus = document.activeElement;
    _attachKeyHandler();
    _renderStep(0);
  }

  function replay() {
    start();
  }

  function next() {
    if (!_active) return;
    if (_currentIndex >= STEPS.length - 1) {
      _complete();
    } else {
      _currentIndex++;
      _renderStep(_currentIndex);
    }
  }

  function prev() {
    if (!_active) return;
    if (_currentIndex > 0) {
      _currentIndex--;
      _renderStep(_currentIndex);
    }
  }

  function skip() {
    localStorage.setItem('tutorial_completed', 'true');
    _destroy();
  }

  /* ---- Private: DOM builder ---- */

  function _buildDOM() {
    if (document.getElementById('tutorial-overlay')) return;

    var dotsHTML = STEPS.map(function (_, i) {
      return '<span class="tutorial-dot" data-dot="' + i + '" aria-hidden="true"></span>';
    }).join('');

    var html = [
      '<div id="tutorial-overlay" aria-hidden="true">',
        '<div id="tutorial-backdrop" aria-hidden="true"></div>',
        '<div id="tutorial-spotlight" aria-hidden="true" class="tutorial-hidden"></div>',
        '<div id="tutorial-tooltip" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">',
          '<div class="tutorial-tooltip-header">',
            '<span class="tutorial-step-counter" id="tutorial-step-counter"></span>',
            '<h2 id="tutorial-title"></h2>',
          '</div>',
          '<div class="tutorial-tooltip-body" id="tutorial-body"></div>',
          '<div class="tutorial-tooltip-footer">',
            '<button id="tutorial-prev-btn" class="tutorial-hidden" aria-label="Previous step">&#8592; Back</button>',
            '<div class="tutorial-dots" aria-hidden="true">' + dotsHTML + '</div>',
            '<button id="tutorial-next-btn" aria-label="Next step">Next &#8594;</button>',
            '<button id="tutorial-skip-link" aria-label="Skip the tutorial">Skip</button>',
          '</div>',
        '</div>',
      '</div>',
    ].join('');

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstChild);

    // Wire up button events
    document.getElementById('tutorial-next-btn').addEventListener('click', function () { next(); });
    document.getElementById('tutorial-prev-btn').addEventListener('click', function () { prev(); });
    document.getElementById('tutorial-skip-link').addEventListener('click', function () { skip(); });
    document.getElementById('tutorial-backdrop').addEventListener('click', function () { skip(); });
  }

  /* ---- Private: render a step ---- */

  function _renderStep(index) {
    var step = STEPS[index];
    if (!step) return;

    var isFirst = index === 0;
    var isLast = index === STEPS.length - 1;
    var total = STEPS.length;

    // Run beforeRender hook — may need to wait for sidebar transition
    if (typeof step.beforeRender === 'function') {
      step.beforeRender(function () { _doRender(step, index, isFirst, isLast, total); });
    } else {
      _doRender(step, index, isFirst, isLast, total);
    }
  }

  function _doRender(step, index, isFirst, isLast, total) {
    // Update text content
    var counter = document.getElementById('tutorial-step-counter');
    var title   = document.getElementById('tutorial-title');
    var body    = document.getElementById('tutorial-body');
    var prevBtn = document.getElementById('tutorial-prev-btn');
    var nextBtn = document.getElementById('tutorial-next-btn');
    var skipLnk = document.getElementById('tutorial-skip-link');

    if (!counter) return; // DOM not ready

    var stepNum = index + 1;
    counter.textContent = 'Step ' + stepNum + ' of ' + total;
    counter.setAttribute('aria-label', 'Step ' + stepNum + ' of ' + total);
    title.textContent = step.title;
    body.innerHTML = step.body;

    // Buttons
    if (isFirst) {
      prevBtn.classList.add('tutorial-hidden');
      nextBtn.textContent = 'Start \u2192';
      nextBtn.setAttribute('aria-label', 'Start tutorial');
    } else if (isLast) {
      prevBtn.classList.remove('tutorial-hidden');
      nextBtn.textContent = 'Start Exploring \u2192';
      nextBtn.setAttribute('aria-label', 'Complete tutorial and start exploring');
      skipLnk.classList.add('tutorial-hidden');
    } else {
      prevBtn.classList.remove('tutorial-hidden');
      nextBtn.textContent = 'Next \u2192';
      nextBtn.setAttribute('aria-label', 'Next step');
      skipLnk.classList.remove('tutorial-hidden');
    }

    // Welcome step: hide prev, keep skip visible
    if (isFirst) {
      skipLnk.classList.remove('tutorial-hidden');
    }

    // Update dots
    document.querySelectorAll('.tutorial-dot').forEach(function (dot, i) {
      dot.classList.toggle('active', i === index);
    });

    // Spotlight
    _positionSpotlight(step.targetSelector, step.spotlightPadding || 0);

    // Tooltip
    var tooltip = document.getElementById('tutorial-tooltip');
    if (!tooltip) return;

    // Decide if centered (no target, or small viewport, or center placement)
    var isCentered = !step.targetSelector || step.placement === 'center' || window.innerWidth < 600;

    if (isCentered) {
      tooltip.classList.add('tutorial-centered');
      tooltip.style.top = '';
      tooltip.style.left = '';
      tooltip.style.transform = '';
    } else {
      tooltip.classList.remove('tutorial-centered');
      var targetEl = document.querySelector(step.targetSelector);
      if (targetEl) {
        var rect = targetEl.getBoundingClientRect();
        _positionTooltip(rect, step.placement, step.spotlightPadding || 0);
      } else {
        // Target not found — fall back to centered
        tooltip.classList.add('tutorial-centered');
      }
    }

    // Focus the primary action button
    var nextBtn2 = document.getElementById('tutorial-next-btn');
    if (nextBtn2) nextBtn2.focus();
  }

  /* ---- Private: spotlight positioning ---- */

  function _positionSpotlight(selector, padding) {
    var spotlight = document.getElementById('tutorial-spotlight');
    if (!spotlight) return;

    if (!selector) {
      spotlight.classList.add('tutorial-hidden');
      return;
    }

    var el = document.querySelector(selector);
    if (!el) {
      spotlight.classList.add('tutorial-hidden');
      return;
    }

    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      spotlight.classList.add('tutorial-hidden');
      return;
    }

    spotlight.classList.remove('tutorial-hidden');
    spotlight.style.top    = (rect.top    - padding) + 'px';
    spotlight.style.left   = (rect.left   - padding) + 'px';
    spotlight.style.width  = (rect.width  + padding * 2) + 'px';
    spotlight.style.height = (rect.height + padding * 2) + 'px';
  }

  /* ---- Private: tooltip positioning ---- */

  function _positionTooltip(targetRect, placement, padding) {
    var tooltip = document.getElementById('tutorial-tooltip');
    if (!tooltip) return;

    var gap = 14; // gap between spotlight edge and tooltip
    var tooltipW = 300;
    var tooltipH = tooltip.offsetHeight || 180;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var edgePad = 16;

    var top, left;

    if (placement === 'right') {
      left = targetRect.right + padding + gap;
      top  = targetRect.top + (targetRect.height / 2) - (tooltipH / 2);
      // Flip to left if overflow
      if (left + tooltipW > vw - edgePad) {
        left = targetRect.left - padding - gap - tooltipW;
      }
    } else if (placement === 'left') {
      left = targetRect.left - padding - gap - tooltipW;
      top  = targetRect.top + (targetRect.height / 2) - (tooltipH / 2);
      if (left < edgePad) {
        left = targetRect.right + padding + gap;
      }
    } else if (placement === 'bottom') {
      top  = targetRect.bottom + padding + gap;
      left = targetRect.left + (targetRect.width / 2) - (tooltipW / 2);
      // Flip to top if overflow
      if (top + tooltipH > vh - edgePad) {
        top = targetRect.top - padding - gap - tooltipH;
      }
    } else if (placement === 'top') {
      top  = targetRect.top - padding - gap - tooltipH;
      left = targetRect.left + (targetRect.width / 2) - (tooltipW / 2);
      if (top < edgePad) {
        top = targetRect.bottom + padding + gap;
      }
    } else {
      // center fallback
      tooltip.classList.add('tutorial-centered');
      return;
    }

    // Clamp to viewport
    left = Math.max(edgePad, Math.min(left, vw - tooltipW - edgePad));
    top  = Math.max(edgePad, Math.min(top,  vh - tooltipH - edgePad));

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
    tooltip.style.transform = '';
  }

  /* ---- Private: sidebar expansion hook ---- */

  function _ensureSidebarOpen(done) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) { done(); return; }

    if (!sidebar.classList.contains('collapsed')) {
      done();
      return;
    }

    // Mark that we forced it open
    _sidebarWasCollapsed = true;
    sidebar.classList.remove('collapsed');

    // Update toggle button text/state if present
    var toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');

    // Invalidate map size after transition
    setTimeout(function () {
      if (window._leafletMap) window._leafletMap.invalidateSize();
    }, 320);

    // Wait for CSS transition to finish before computing rect
    var waited = false;
    function proceed() {
      if (waited) return;
      waited = true;
      done();
    }
    sidebar.addEventListener('transitionend', proceed, { once: true });
    setTimeout(proceed, 380); // fallback
  }

  /* ---- Private: keyboard handler ---- */

  function _attachKeyHandler() {
    _detachKeyHandler();
    _keyHandler = function (e) {
      if (!_active) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        // Allow Enter on buttons inside the tooltip to work normally
        var tag = document.activeElement ? document.activeElement.tagName : '';
        if (e.key === 'Enter' && (tag === 'BUTTON' || tag === 'A')) return;
        e.stopPropagation();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        prev();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        skip();
      } else if (e.key === 'Tab') {
        _trapFocus(e);
      }
    };
    document.addEventListener('keydown', _keyHandler, true);
  }

  function _detachKeyHandler() {
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler, true);
      _keyHandler = null;
    }
  }

  /* ---- Private: focus trap ---- */

  function _trapFocus(e) {
    var tooltip = document.getElementById('tutorial-tooltip');
    if (!tooltip) return;
    var focusable = Array.from(tooltip.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* ---- Private: complete & destroy ---- */

  function _complete() {
    localStorage.setItem('tutorial_completed', 'true');
    _destroy();
    if (typeof showToast === 'function') {
      showToast('Tutorial complete \u2014 replay it anytime via Settings \u2699', 'info', 4000);
    }
  }

  function _destroy() {
    _active = false;
    _detachKeyHandler();

    var overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
      overlay.classList.remove('tutorial-visible');
      overlay.setAttribute('aria-hidden', 'true');
    }

    // Restore focus
    if (_previousFocus && typeof _previousFocus.focus === 'function') {
      try { _previousFocus.focus(); } catch (e) {}
    }
    _previousFocus = null;
  }

  /* ---- Expose public API ---- */
  return {
    init:   init,
    start:  start,
    replay: replay,
    next:   next,
    prev:   prev,
    skip:   skip,
  };

})();
