/* =========================================
   LA History — Tutorial / Onboarding
   ========================================= */

var Tutorial = (function () {

  /* ---- Step definitions ---- */
  var STEPS = [
    {
      id: 'welcome',
      icon: '🗺️',
      title: 'Welcome to LA History!',
      body: 'Explore 57 historical locations across 4 eras of Los Angeles — from the Tongva people to the modern city. This quick tour shows you how everything works.',
      targetSelector: null,
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
    {
      id: 'map',
      icon: '🏙️',
      title: 'Navigate the Map',
      body: '<b>Drag</b> to pan around LA · <b>Scroll</b> to zoom in and out · <b>Click any marker</b> to explore that historical location.',
      targetSelector: '#map',
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
    {
      id: 'eras',
      icon: '⏳',
      title: 'Four Eras of LA History',
      body: 'Filter locations by era using these buttons. Unlock new eras by completing quizzes in the current one — starting with <b>Tongva</b> and progressing forward in time.',
      targetSelector: '#era-filter-bar',
      placement: 'bottom',
      spotlightPadding: 8,
      beforeRender: null,
    },
    {
      id: 'sidebar',
      icon: '📊',
      title: 'Your Progress',
      body: 'Track your <b>points</b>, visited locations, and overall completion here. The ring fills as you explore more of LA\'s history.',
      targetSelector: '#sidebar',
      placement: 'right',
      spotlightPadding: 6,
      beforeRender: _ensureSidebarOpen,
    },
    {
      id: 'badges',
      icon: '🏆',
      title: 'Earn Badges',
      body: 'Complete quizzes and reach milestones to earn badges. Pass a quiz on your <b>first attempt</b> for full points — retries earn half. Score 90%+ for a bonus!',
      targetSelector: '#badge-grid',
      placement: 'right',
      spotlightPadding: 8,
      beforeRender: _ensureSidebarOpen,
    },
    {
      id: 'tutor',
      icon: '💬',
      title: 'AI History Tutor',
      body: 'Inside the <b>Concept Map</b>, a Socratic tutor guides your thinking as you build connections. It asks questions about why things are related — not just what they are.',
      targetSelector: null,
      placement: 'center',
      spotlightPadding: 6,
      beforeRender: null,
    },
    {
      id: 'done',
      icon: '🎉',
      title: "You're Ready to Explore!",
      body: 'Click any marker on the map to get started. Good luck, historian!',
      targetSelector: null,
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
  ];

  /* ---- Concept Map tutorial steps ---- */
  var CM_STEPS = [
    {
      id: 'cm-welcome',
      icon: '🕸️',
      title: 'Build Your Concept Map',
      body: 'A concept map shows <b>how historical locations connect</b>. Place nodes, draw labeled links between them, and let the AI score your historical thinking.',
      targetSelector: null,
      placement: 'center',
      spotlightPadding: 0,
      beforeRender: null,
    },
    {
      id: 'cm-palette',
      icon: '📍',
      title: 'Add Locations',
      body: 'Click <b>+</b> next to any location you\'ve visited to place it on the canvas. Use <b>Cross-Era</b> to add locations from other eras.',
      targetSelector: '#cm-palette',
      placement: 'right',
      spotlightPadding: 8,
      beforeRender: null,
    },
    {
      id: 'cm-canvas',
      icon: '🔗',
      title: 'Connect the Dots',
      body: '<b>Click a node</b> to open its menu \u2192 choose <em>Start connection</em> \u2192 click a second node. Label the relationship (e.g. <em>\u201cboth displaced by Mission system\u201d</em>). Richer labels earn higher scores.',
      targetSelector: '#cm-canvas',
      placement: 'center',
      spotlightPadding: 6,
      beforeRender: null,
    },
    {
      id: 'cm-footer',
      icon: '💾',
      title: 'Save, Arrange & Submit',
      body: '<b>Save</b> your work any time (auto-saves every 30 s). <b>Fit</b> re-centers the canvas. <b>Auto-arrange</b> tidies nodes. Once you have \u2265 3 connections and have passed all era quizzes, <b>Submit for Feedback</b> unlocks.',
      targetSelector: '.cm-panel-footer',
      placement: 'top',
      spotlightPadding: 6,
      noArrow: true,
      beforeRender: null,
    },
    {
      id: 'cm-ai-tools',
      icon: '🤖',
      title: 'Two AI Tools, Two Different Roles',
      body: '<b>🎓 AI Tutor</b> (right panel) guides your thinking with Socratic questions — it will never just hand you an answer.<br><br><b>💡 AI Hint</b> (footer, 15 pts) gives a direct, concrete suggestion about a connection you might be missing.<br><br>Use the Tutor to think things through; use Hints when you\'re genuinely stuck.',
      targetSelector: '#cm-chat-panel',
      placement: 'left',
      spotlightPadding: 6,
      noArrow: true,
      beforeRender: _cmShowHintBtn,
    },
    {
      id: 'cm-done',
      icon: '🎉',
      title: "You're Ready to Map History!",
      body: 'Start with a few locations, connect them with meaningful labels, and listen to the tutor. The richer your reasoning, the higher your synthesis score. Good luck! <br><br>Missed something? Click the <b>?</b> button in the header to replay this tour any time.',
      targetSelector: '#cm-tour-btn',
      placement: 'left',
      spotlightPadding: 6,
      noArrow: true,
      beforeRender: _cmHideHintBtn,
    },
  ];

  /* ---- Internal state ---- */
  var _currentIndex = -1;
  var _active = false;
  var _keyHandler = null;
  var _reducedMotion = false;
  var _previousFocus = null;
  var _sidebarWasCollapsed = false;
  var _activeSteps = null;          // null → use STEPS (main tutorial)
  var _activeStorageKey = 'tutorial_completed';

  /* ---- Active-steps helpers ---- */

  function _getSteps() { return _activeSteps || STEPS; }

  function _updateDots() {
    var container = document.querySelector('.tutorial-dots');
    if (!container) return;
    var steps = _getSteps();
    container.innerHTML = steps.map(function (_, i) {
      return '<span class="tutorial-dot" data-dot="' + i + '" aria-hidden="true"></span>';
    }).join('');
  }

  /* ---- Public API ---- */

  function init() {
    _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    _buildDOM();
    // Show automatically only on first visit
    if (!localStorage.getItem('tutorial_completed')) {
      // Small delay so map tiles have a moment to render
      setTimeout(function () { start(); }, 600);
    }
  }

  function start() {
    _buildDOM();
    _activeSteps = null;
    _activeStorageKey = 'tutorial_completed';
    _updateDots();
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

  function startFor(steps, storageKey) {
    if (_active) return;
    _buildDOM();
    _activeSteps = steps;
    _activeStorageKey = storageKey || 'tutorial_completed';
    _updateDots();
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

  function startConceptMap() {
    if (localStorage.getItem('cm_tutorial_completed')) return;
    startFor(CM_STEPS, 'cm_tutorial_completed');
  }

  function replayConceptMap() {
    startFor(CM_STEPS, 'cm_tutorial_completed');
  }

  function next() {
    if (!_active) return;
    if (_currentIndex >= _getSteps().length - 1) {
      _complete();
    } else {
      _currentIndex++;
      if (typeof SFX !== 'undefined') SFX.play('tutorial-step');
      _renderStep(_currentIndex);
    }
  }

  function prev() {
    if (!_active) return;
    if (_currentIndex > 0) {
      _currentIndex--;
      if (typeof SFX !== 'undefined') SFX.play('tutorial-step');
      _renderStep(_currentIndex);
    }
  }

  function skip() {
    if (typeof SFX !== 'undefined') SFX.play('panel-close');
    localStorage.setItem(_activeStorageKey, 'true');
    _destroy();
  }

  /* ---- Private: DOM builder ---- */

  function _buildDOM() {
    if (document.getElementById('tutorial-overlay')) return;

    var html = [
      '<div id="tutorial-overlay" aria-hidden="true">',
        '<div id="tutorial-backdrop" aria-hidden="true"></div>',
        '<div id="tutorial-spotlight" aria-hidden="true" class="tutorial-hidden"></div>',
        '<div id="tutorial-pulse-ring" style="display:none" aria-hidden="true"></div>',

        /* Arrow SVG — drawn between tooltip and spotlight */
        '<svg id="tutorial-arrow-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">',
          '<path id="tutorial-arrow-path"/>',
          '<path id="tutorial-arrow-head"/>',
          '<circle id="tutorial-arrow-dot" r="4"/>',
        '</svg>',

        '<div id="tutorial-tooltip" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">',
          /* Progress bar strip */
          '<div id="tutorial-progress-bar-wrap" aria-hidden="true">',
            '<div id="tutorial-progress-bar"></div>',
          '</div>',
          /* Per-step icon */
          '<div id="tutorial-step-icon" aria-hidden="true"></div>',
          '<div class="tutorial-tooltip-header">',
            '<span class="tutorial-step-counter" id="tutorial-step-counter"></span>',
            '<h2 id="tutorial-title"></h2>',
          '</div>',
          '<div class="tutorial-tooltip-body" id="tutorial-body"></div>',
          '<div class="tutorial-tooltip-footer">',
            '<button id="tutorial-prev-btn" class="tutorial-hidden" aria-label="Previous step">&#8592; Back</button>',
            '<div class="tutorial-dots" aria-hidden="true"></div>',
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
    var step = _getSteps()[index];
    if (!step) return;

    var isFirst = index === 0;
    var isLast = index === _getSteps().length - 1;
    var total = _getSteps().length;

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

    // Step icon
    var iconEl = document.getElementById('tutorial-step-icon');
    if (iconEl) {
      if (step.icon) {
        iconEl.textContent = step.icon;
        iconEl.style.display = 'block';
      } else {
        iconEl.textContent = '';
        iconEl.style.display = 'none';
      }
    }

    // Progress bar
    var progressBar = document.getElementById('tutorial-progress-bar');
    if (progressBar) {
      progressBar.style.width = (stepNum / total * 100) + '%';
    }

    // Buttons
    if (isFirst) {
      prevBtn.classList.add('tutorial-hidden');
      nextBtn.textContent = 'Start \u2192';
      nextBtn.setAttribute('aria-label', 'Start tutorial');
    } else if (isLast) {
      prevBtn.classList.remove('tutorial-hidden');
      nextBtn.textContent = 'Start Exploring!';
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

    // Direction-aware entrance animation
    _applyDirectionAnimation(tooltip, step.placement || 'center', isCentered);

    // Pulse next button after a beat
    if (!_reducedMotion) {
      nextBtn.classList.remove('tutorial-btn-pulse');
      void nextBtn.offsetWidth;
      nextBtn.classList.add('tutorial-btn-pulse');
    }

    // Animated arrow + pulse ring (defer to next frame so tooltip is painted)
    _updateArrow(step);
    _updatePulseRing(step);

    // Focus the primary action button
    if (nextBtn) nextBtn.focus();
  }

  /* ---- Private: direction-aware tooltip animation ---- */

  function _applyDirectionAnimation(tooltip, placement, isCentered) {
    if (_reducedMotion) return;
    var dirClass = 'dir-' + (placement || 'center');
    tooltip.classList.remove('dir-center', 'dir-right', 'dir-left', 'dir-bottom', 'dir-top');
    void tooltip.offsetWidth; // reflow to re-trigger animation
    tooltip.classList.add(dirClass);
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

  /* ---- Private: animated arrow ---- */

  function _updateArrow(step) {
    var svg    = document.getElementById('tutorial-arrow-svg');
    var pathEl = document.getElementById('tutorial-arrow-path');
    var headEl = document.getElementById('tutorial-arrow-head');
    var dotEl  = document.getElementById('tutorial-arrow-dot');

    if (!svg || !pathEl) return;

    var isCentered = !step.targetSelector || step.placement === 'center' || window.innerWidth < 600;
    if (isCentered || _reducedMotion || step.noArrow) {
      svg.style.opacity = '0';
      return;
    }

    requestAnimationFrame(function () {
      var tooltipEl   = document.getElementById('tutorial-tooltip');
      var spotlightEl = document.getElementById('tutorial-spotlight');
      if (!tooltipEl || !spotlightEl) return;

      var tr = tooltipEl.getBoundingClientRect();
      var sr = spotlightEl.getBoundingClientRect();
      if (!sr.width) { svg.style.opacity = '0'; return; }

      var sx, sy, ex, ey;
      var edgeGap = 6; // small inset from element edges

      switch (step.placement) {
        case 'right':
          // Tooltip is to the right of spotlight
          sx = tr.left - edgeGap;
          sy = tr.top + tr.height / 2;
          ex = sr.right + edgeGap;
          ey = sr.top + sr.height / 2;
          break;
        case 'left':
          sx = tr.right + edgeGap;
          sy = tr.top + tr.height / 2;
          ex = sr.left - edgeGap;
          ey = sr.top + sr.height / 2;
          break;
        case 'bottom':
          // Tooltip is below spotlight
          sx = tr.left + tr.width / 2;
          sy = tr.top - edgeGap;
          ex = sr.left + sr.width / 2;
          ey = sr.bottom + edgeGap;
          break;
        case 'top':
          sx = tr.left + tr.width / 2;
          sy = tr.bottom + edgeGap;
          ex = sr.left + sr.width / 2;
          ey = sr.top - edgeGap;
          break;
        default:
          svg.style.opacity = '0';
          return;
      }

      // Quadratic bezier with perpendicular arc
      var dx = ex - sx;
      var dy = ey - sy;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var bendAmt = Math.min(len * 0.18, 40);
      var perpX = -(dy / len) * bendAmt;
      var perpY =  (dx / len) * bendAmt;
      var midX = (sx + ex) / 2;
      var midY = (sy + ey) / 2;
      var cpx = midX + perpX;
      var cpy = midY + perpY;

      // Main curve path
      var d = 'M ' + sx.toFixed(1) + ' ' + sy.toFixed(1) +
              ' Q ' + cpx.toFixed(1) + ' ' + cpy.toFixed(1) +
              ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1);
      pathEl.setAttribute('d', d);

      // Arrowhead: two lines diverging from end point at the tangent angle
      var angle = Math.atan2(ey - cpy, ex - cpx);
      var ahSize = 11;
      var ahSpread = 0.45; // radians
      var ahX1 = ex - ahSize * Math.cos(angle - ahSpread);
      var ahY1 = ey - ahSize * Math.sin(angle - ahSpread);
      var ahX2 = ex - ahSize * Math.cos(angle + ahSpread);
      var ahY2 = ey - ahSize * Math.sin(angle + ahSpread);
      var headD = 'M ' + ahX1.toFixed(1) + ' ' + ahY1.toFixed(1) +
                  ' L ' + ex.toFixed(1) + ' ' + ey.toFixed(1) +
                  ' L ' + ahX2.toFixed(1) + ' ' + ahY2.toFixed(1);
      if (headEl) {
        headEl.setAttribute('d', headD);
      }

      // Dash-draw animation on the main path
      var totalLen = pathEl.getTotalLength ? pathEl.getTotalLength() : 250;
      pathEl.style.transition = 'none';
      pathEl.style.strokeDasharray = totalLen + ' ' + totalLen;
      pathEl.style.strokeDashoffset = '' + totalLen;
      void pathEl.getBoundingClientRect(); // force reflow
      pathEl.style.transition = 'stroke-dashoffset 0.52s cubic-bezier(0.22, 1, 0.36, 1) 0.08s';
      pathEl.style.strokeDashoffset = '0';

      // Arrowhead fades in after path is drawn
      if (headEl) {
        headEl.style.transition = 'none';
        headEl.style.opacity = '0';
        void headEl.getBoundingClientRect();
        headEl.style.transition = 'opacity 0.18s ease 0.52s';
        headEl.style.opacity = '1';
      }

      // Tip dot at arrowhead endpoint — restart its pulse animation
      if (dotEl) {
        dotEl.setAttribute('cx', ex.toFixed(1));
        dotEl.setAttribute('cy', ey.toFixed(1));
        dotEl.style.animationName = 'none';
        void dotEl.getBoundingClientRect();
        dotEl.style.animationName = '';
      }

      svg.style.opacity = '1';
    });
  }

  /* ---- Private: pulse ring around spotlight ---- */

  function _updatePulseRing(step) {
    var ring = document.getElementById('tutorial-pulse-ring');
    if (!ring) return;

    var isCentered = !step.targetSelector || step.placement === 'center' || window.innerWidth < 600;
    if (isCentered || _reducedMotion) {
      ring.style.display = 'none';
      return;
    }

    requestAnimationFrame(function () {
      var spotlightEl = document.getElementById('tutorial-spotlight');
      if (!spotlightEl || spotlightEl.classList.contains('tutorial-hidden')) {
        ring.style.display = 'none';
        return;
      }

      // Mirror the spotlight's position and size
      ring.style.top    = spotlightEl.style.top;
      ring.style.left   = spotlightEl.style.left;
      ring.style.width  = spotlightEl.style.width;
      ring.style.height = spotlightEl.style.height;
      ring.style.display = 'block';

      // Restart animation cleanly
      ring.style.animation = 'none';
      void ring.offsetWidth;
      ring.style.animation = '';
    });
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

  function _cmShowHintBtn(done) {
    var btn = document.getElementById('cm-insight-btn');
    if (btn) {
      btn.dataset.tutorialForced = '1';
      btn.style.display = '';
      btn.classList.add('tutorial-hint-highlight');
    }
    done();
  }

  function _cmHideHintBtn(done) {
    var btn = document.getElementById('cm-insight-btn');
    if (btn && btn.dataset.tutorialForced) {
      btn.classList.remove('tutorial-hint-highlight');
      delete btn.dataset.tutorialForced;
      if (typeof updateInsightButton === 'function') {
        updateInsightButton();
      }
    }
    done();
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
    if (typeof SFX !== 'undefined') SFX.play('tutorial-complete');
    localStorage.setItem(_activeStorageKey, 'true');
    _destroy();
    if (_activeStorageKey === 'tutorial_completed') {
      if (typeof showToast === 'function') {
        showToast('Tutorial complete \u2014 replay it anytime via Settings \u2699', 'info', 4000);
      }
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
    init:             init,
    start:            start,
    replay:           replay,
    next:             next,
    prev:             prev,
    skip:             skip,
    startFor:          startFor,
    startConceptMap:   startConceptMap,
    replayConceptMap:  replayConceptMap,
  };

})();
