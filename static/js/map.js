/* =========================================
   LA History — Leaflet Map
   ========================================= */

let map;
let markersById = {};
let locationsData = [];
let activeLocationId = null;
let ttsActive = false;
let visitedTrail = null;
let _suppressZoomSFX = false;

// ---- TTS word-highlight helpers ----
let _descOrigHTML   = '';
let _wordPositions  = []; // [{ idx, fraction }]

function wrapWordsForHighlight(element) {
  _descOrigHTML = element.innerHTML;
  const totalChars = element.textContent.length || 1;
  let wordIdx = 0;
  let charPos = 0;
  const positions = [];

  const newHTML = element.innerHTML.replace(/(<[^>]+>)|([^\s<>]+)/g, (match, tag, word) => {
    if (tag)  return tag;
    if (word) {
      positions.push({ idx: wordIdx, fraction: charPos / totalChars });
      charPos += word.length + 1;
      wordIdx++;
      return `<span class="tts-word" data-idx="${wordIdx - 1}">${word}</span>`;
    }
    charPos += match.length;
    return match;
  });

  element.innerHTML = newHTML;
  _wordPositions = positions;
}

function highlightWordAtProgress(element, progress) {
  let best = _wordPositions[0];
  for (const wp of _wordPositions) {
    if (wp.fraction <= progress) best = wp;
    else break;
  }
  if (!best) return;
  const prev = element.querySelector('.tts-word.tts-active');
  if (prev) prev.classList.remove('tts-active');
  const span = element.querySelector(`.tts-word[data-idx="${best.idx}"]`);
  if (span) span.classList.add('tts-active');
}

function restoreDescHTML(element) {
  if (!element || !_descOrigHTML) return;
  element.innerHTML = _descOrigHTML;
  _descOrigHTML  = '';
  _wordPositions = [];
}

// ---- TTS progress bar helpers ----
let _progressBarEl    = null;
let _progressFillEl   = null;
let _progressMaxRatio = 0;

function showTTSProgressBar(afterElement) {
  hideTTSProgressBar();
  const bar = document.createElement('div');
  bar.className = 'tts-progress-bar';
  bar.innerHTML = '<div class="tts-progress-fill"></div>';
  afterElement.insertAdjacentElement('afterend', bar);
  _progressBarEl    = bar;
  _progressFillEl   = bar.querySelector('.tts-progress-fill');
  _progressMaxRatio = 0;
}

function updateTTSProgress(ratio) {
  if (!_progressFillEl) return;
  _progressMaxRatio = Math.max(_progressMaxRatio, ratio);
  _progressFillEl.style.width = `${Math.min(_progressMaxRatio * 100, 100)}%`;
}

function hideTTSProgressBar() {
  if (_progressBarEl) { _progressBarEl.remove(); _progressBarEl = null; _progressFillEl = null; }
  _progressMaxRatio = 0;
}

const TILE_STYLES = {
  voyager:    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  positron:   'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark_matter:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
let currentTileLayer = null;

function setTileStyle(name) {
  if (!map) return;
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(TILE_STYLES[name] || TILE_STYLES.voyager, {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  });
  currentTileLayer.addTo(map);
  localStorage.setItem('map_tile_style', name);
}
window.setTileStyle = setTileStyle;

function initMap() {
  map = L.map('map', {
    center: [34.05, -118.25],
    zoom: 11,
    zoomControl: true,
    minZoom: 11,
    maxBounds: [[33.65, -118.80], [34.45, -117.55]],
    maxBoundsViscosity: 1.0,
  });
  window._leafletMap = map;

  setTileStyle(localStorage.getItem('map_tile_style') || 'voyager');

  loadLocations();

  map.on('zoomend', () => { if (!_suppressZoomSFX && typeof SFX !== 'undefined') SFX.play('zoom'); });
}

async function loadLocations() {
  try {
    locationsData = await apiFetch('/api/locations');
    renderMarkers(locationsData);
    loadProgress(); // load sidebar
    initEraFilterColors();
    initMapSearch();
    const loader = document.getElementById('map-loading');
    if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 400); }
  } catch (e) {
    console.error('Failed to load locations:', e);
    const loader = document.getElementById('map-loading');
    if (loader) loader.remove();
  }
}

function renderMarkers(locations) {
  // Clear existing
  Object.values(markersById).forEach(m => m.remove());
  markersById = {};

  locations.forEach(loc => {
    const marker = createMarker(loc);
    marker.addTo(map);
    markersById[loc.id] = marker;
  });

  renderVisitedTrail(locations);
}

// ---- Era filter ----
const activeEraFilters = new Set(['all', 'native', 'spanish', 'rancho', 'modern']);

function applyEraFilter(era) {
  if (typeof SFX !== 'undefined') SFX.play('filter-toggle');
  const allBtn = document.querySelector('.era-filter-btn[data-era="all"]');

  if (era === 'all') {
    // Toggle all on/off
    const allActive = ['native', 'spanish', 'rancho', 'modern'].every(e => activeEraFilters.has(e));
    if (allActive) {
      activeEraFilters.clear();
    } else {
      ['all', 'native', 'spanish', 'rancho', 'modern'].forEach(e => activeEraFilters.add(e));
    }
  } else {
    if (activeEraFilters.has(era)) {
      activeEraFilters.delete(era);
    } else {
      activeEraFilters.add(era);
    }
    // Sync "All" button state
    const allEras = ['native', 'spanish', 'rancho', 'modern'];
    if (allEras.every(e => activeEraFilters.has(e))) {
      activeEraFilters.add('all');
    } else {
      activeEraFilters.delete('all');
    }
  }

  // Update button visual state
  document.querySelectorAll('.era-filter-btn').forEach(btn => {
    const btnEra = btn.dataset.era;
    const isActive = activeEraFilters.has(btnEra) || (btnEra === 'all' && activeEraFilters.has('all'));
    btn.classList.toggle('active', isActive);
    if (btnEra !== 'all') {
      btn.style.background = isActive ? eraColor(btnEra) : '';
      btn.style.borderColor = isActive ? eraColor(btnEra) : '';
    }
  });

  updateMarkerVisibility();
}

function updateMarkerVisibility() {
  Object.values(markersById).forEach(marker => {
    const locId = marker._icon && marker.options._locId;
    const el = marker.getElement();
    if (!el) return;
  });
  // Use locationsData to filter
  locationsData.forEach(loc => {
    const marker = markersById[loc.id];
    if (!marker) return;
    const el = marker.getElement();
    if (!el) return;
    const visible = !loc.unlocked || activeEraFilters.size === 0 || activeEraFilters.has(loc.era);
    el.style.display = visible ? '' : 'none';
  });
}

window.applyEraFilter = applyEraFilter;

// Apply era color on initial render
function initEraFilterColors() {
  document.querySelectorAll('.era-filter-btn[data-era]').forEach(btn => {
    const era = btn.dataset.era;
    if (era !== 'all') {
      btn.style.background = eraColor(era);
      btn.style.borderColor = eraColor(era);
    }
  });
}

// ---- Map search ----
function initMapSearch() {
  const input = document.getElementById('map-search-input');
  const results = document.getElementById('map-search-results');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) return;
    const matches = locationsData
      .filter(l => l.name.toLowerCase().includes(q) && l.unlocked)
      .slice(0, 6);
    matches.forEach(loc => {
      const row = document.createElement('div');
      row.className = 'map-search-result';
      row.innerHTML = `<span class="map-search-result-name">${loc.name}</span><span class="map-search-result-era">${eraEmoji(loc.era)} ${loc.era.charAt(0).toUpperCase() + loc.era.slice(1)}</span>`;
      row.addEventListener('click', () => flyToLocation(loc));
      results.appendChild(row);
    });
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; results.innerHTML = ''; }
  });

  map.on('click', () => { results.innerHTML = ''; });
}

function flyToLocation(loc) {
  _suppressZoomSFX = true;
  map.flyTo([loc.latitude, loc.longitude], 15, { animate: true, duration: 1.2 });
  map.once('moveend', () => {
    _suppressZoomSFX = false;
    if (typeof SFX !== 'undefined') SFX.play('search-ping');
    const mIcon = markersById[loc.id]?._icon?.querySelector('.map-marker');
    if (mIcon) {
      mIcon.classList.add('search-highlight');
      mIcon.addEventListener('animationend', () => mIcon.classList.remove('search-highlight'), { once: true });
    }
  });
  const searchResults = document.getElementById('map-search-results');
  const searchInput = document.getElementById('map-search-input');
  if (searchResults) searchResults.innerHTML = '';
  if (searchInput) searchInput.value = '';
}

function renderVisitedTrail(locations) {
  if (visitedTrail) { visitedTrail.remove(); visitedTrail = null; }
  const visited = locations
    .filter(l => l.visited)
    .sort((a, b) => (a.era_order - b.era_order) || (a.id - b.id));
  if (visited.length < 2) return;
  const coords = visited.map(l => [l.latitude, l.longitude]);
  visitedTrail = L.polyline(coords, {
    color: 'rgba(212,168,67,0.45)',
    weight: 2,
    dashArray: '5, 8',
    className: 'visited-trail',
  }).addTo(map);
}

function getMarkerDimensions() {
  const base = parseInt(localStorage.getItem('marker_size')) || 32;
  return {
    iconSize:      [base, base],
    iconAnchor:    [base / 2, base],
    popupAnchor:   [0, -(base + 4)],
    tooltipOffset: [0, -(base + 4)],
  };
}

function createMarker(loc) {
  const dim   = getMarkerDimensions();
  const color = loc.unlocked ? eraColor(loc.era) : '#9e9e9e';
  const emoji = loc.unlocked ? eraEmoji(loc.era) : '🔒';

  const unlockedClass = loc.unlocked ? 'unlocked' : '';

  const icon = L.divIcon({
    className: '',
    html: `
      <div class="map-marker ${loc.visited ? 'visited' : ''} ${!loc.unlocked ? 'locked' : ''} ${unlockedClass}"
           style="background:${color};border-color:${loc.unlocked ? 'rgba(255,255,255,0.9)' : '#ccc'}">
        <div class="map-marker-inner">${emoji}</div>
      </div>`,
    iconSize: dim.iconSize,
    iconAnchor: dim.iconAnchor,
    popupAnchor: dim.popupAnchor,
  });

  const marker = L.marker([loc.latitude, loc.longitude], { icon });

  // Rich tooltip with thumbnail if image exists
  const tooltipContent = loc.image_url
    ? `<div class="marker-tooltip-rich">
         <img src="${encodeURI(loc.image_url)}" class="marker-tooltip-thumb" alt="">
         <span class="marker-tooltip-name">${loc.name}</span>
       </div>`
    : loc.name;
  marker.bindTooltip(tooltipContent, {
    direction: 'top',
    offset: dim.tooltipOffset,
    opacity: 0.97,
    className: loc.image_url ? 'marker-tooltip-with-thumb' : '',
  });

  if (loc.unlocked) {
    marker.bindPopup(buildPopup(loc), { maxWidth: 240 });
    marker.on('click', () => onMarkerClick(loc.id));
  } else {
    marker.bindPopup(buildLockedPopup(loc), { maxWidth: 240 });
    marker.on('click', () => { if (typeof SFX !== 'undefined') SFX.play('locked'); });
  }

  return marker;
}

function buildPopup(loc) {
  const visitedBadge = loc.visited
    ? '<span class="quiz-passed-badge" style="font-size:0.72rem">✓ Visited</span>'
    : '';
  return `
    <div class="map-popup-name">${loc.name} ${visitedBadge}</div>
    <div class="map-popup-short">${loc.short_description}</div>
    <button class="btn btn-primary btn-sm map-popup-btn" onclick="onMarkerClick(${loc.id})">
      Explore →
    </button>
  `;
}

function buildLockedPopup(loc) {
  const hint = getUnlockHint(loc.era_order);
  return `
    <div class="map-popup-name">🔒 ${loc.name}</div>
    <div class="map-popup-locked">${hint}</div>
  `;
}

function getUnlockHint(eraOrder) {
  if (eraOrder <= 1 || !locationsData.length) {
    return 'Complete earlier quizzes to unlock this era.';
  }
  const prevEraLocs = locationsData.filter(l => l.era_order === eraOrder - 1 && l.has_quiz);
  const prevPassed  = prevEraLocs.filter(l => l.quiz_passed).length;
  const prevTotal   = prevEraLocs.length;

  if (eraOrder === 2) {
    const needed = Math.ceil(prevTotal * 0.5) - prevPassed;
    if (needed <= 0) return 'Almost there — keep exploring!';
    return `Pass ${needed} more quiz${needed === 1 ? '' : 'zes'} in Era 1 to unlock the Spanish era.`;
  } else {
    const needed = prevTotal - prevPassed;
    const prevEraName = eraOrder === 3 ? 'Spanish' : 'Rancho';
    if (needed <= 0) return 'Almost there — keep exploring!';
    return `Pass ${needed} more quiz${needed === 1 ? '' : 'zes'} in the ${prevEraName} era to unlock this.`;
  }
}

async function onMarkerClick(locationId) {
  activeLocationId = locationId;
  map.closePopup();

  // Smooth fly-to the clicked location
  const locForFly = locationsData.find(l => l.id === locationId);
  if (locForFly) {
    _suppressZoomSFX = true;
    map.flyTo([locForFly.latitude, locForFly.longitude], Math.max(map.getZoom(), 14), {
      animate: true,
      duration: 0.9,
      easeLinearity: 0.25,
    });
    map.once('moveend', () => { _suppressZoomSFX = false; });
  }

  // Sound + bounce animation
  if (typeof SFX !== 'undefined') SFX.play('marker-click');
  const mIcon = markersById[locationId]?._icon?.querySelector('.map-marker');
  if (mIcon) {
    mIcon.classList.add('clicked');
    mIcon.addEventListener('animationend', () => mIcon.classList.remove('clicked'), { once: true });
  }

  try {
    const loc = await apiFetch(`/api/locations/${locationId}`);
    openDetailPanel(loc);

    // Mark visited (fire-and-forget)
    if (!loc.visited) {
      apiFetch(`/api/locations/${locationId}/visit`, 'POST')
        .then(res => {
          if (res.points_earned > 0) {
            showToast(`+${res.points_earned} pts — ${loc.name} visited!`, 'points');
            updatePointsDisplay(res.total_points);
          }
          // Refresh this marker
          const updated = { ...loc, visited: true, unlocked: true };
          refreshSingleMarker(updated);
          if (res.new_badges && res.new_badges.length > 0) {
            handleNewBadges(res.new_badges);
          } else {
            loadProgress();
          }
        })
        .catch(() => {});
    }
  } catch (e) {
    showToast('Could not load location details.', 'error');
  }
}

function openDetailPanel(loc) {
  TTS.stop();
  ttsActive = false;

  const panel = document.getElementById('detail-panel');
  const pill  = document.getElementById('detail-era-pill');
  const body  = document.getElementById('detail-panel-body');

  pill.innerHTML = `<span class="era-badge ${loc.era}">${loc.era}</span>`;

  const quizSection = buildQuizSection(loc);
  const events      = loc.events || [];
  const eventsHTML  = buildEventsHTML(events);

  const ttsBtnHTML = TTS.isSupported()
    ? `<button class="detail-tts-btn" id="tts-btn" onclick="handleTTS()" title="Read aloud">🔊 Read Aloud</button>`
    : '';

  const copyBtnHTML = `<button class="detail-tts-btn detail-copy-btn" onclick="copyLocationLink(${loc.id})" title="Copy link to this location">🔗</button>`;

  body.innerHTML = `
    <div class="detail-era-header">
      <h2 class="detail-name">${loc.name}</h2>
      <div class="detail-header-meta">
        ${loc.visited ? '<span class="quiz-passed-badge" style="font-size:0.78rem">✓ Visited</span>' : ''}
        ${ttsBtnHTML}
        ${copyBtnHTML}
      </div>
    </div>

    ${loc.image_url ? `
    <figure class="detail-image-figure" onclick="openImageLightbox('${encodeURI(loc.image_url)}', '${escapeAttr(loc.image_caption || loc.name)}')" title="Click to enlarge">
      <img src="${encodeURI(loc.image_url)}" alt="${escapeAttr(loc.name)}" class="detail-image">
      <div class="detail-image-expand-hint">⤢</div>
      ${loc.image_caption ? `<figcaption class="detail-image-caption">${escapeHtml(loc.image_caption)}</figcaption>` : ''}
    </figure>` : ''}

    <div class="detail-description" id="detail-full-desc">
      ${escapeHtml(loc.full_description)}
    </div>

    ${eventsHTML}
    ${quizSection}
  `;

  panel.classList.add('open');

  if (events.length) bindTimelineTTSButtons(events);
  document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
}

function buildQuizSection(loc) {
  if (!loc.has_quiz) return '';

  const attempts = loc.quiz_attempts || 0;
  const attemptsLabel = attempts > 0
    ? `<span class="quiz-attempts-label">${attempts} attempt${attempts === 1 ? '' : 's'}</span>`
    : '';

  if (loc.quiz_passed) {
    return `
      <div class="detail-actions">
        <div class="detail-quiz-row">
          <span class="quiz-passed-badge">✓ Quiz Passed — ${loc.quiz_score}%</span>
          ${attemptsLabel}
        </div>
      </div>`;
  }

  return `
    <div class="detail-actions">
      <div class="detail-quiz-row">
        <button class="btn btn-primary" onclick="openQuiz(${loc.id})">
          📝 Take the Quiz
        </button>
        ${attemptsLabel}
      </div>
    </div>`;
}

function buildEventsHTML(events) {
  if (!events.length) return '';
  const items = events.map(ev => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-year">${ev.year_display}</div>
      <div class="timeline-title">${ev.title}</div>
      <div class="timeline-content">${ev.content}</div>
    </div>
  `).join('');

  const ttsBtn = TTS.isSupported()
    ? `<button class="timeline-tts-btn" id="timeline-tts-btn" title="Read timeline aloud">🔊</button>`
    : '';

  return `
    <div class="events-section">
      <div class="events-section-header">
        <h4>Historical Timeline</h4>
        ${ttsBtn}
      </div>
      <div class="timeline">${items}</div>
    </div>`;
}

function bindTimelineTTSButtons(events) {
  const btn = document.getElementById('timeline-tts-btn');
  if (!btn) return;
  const fullText = events.map(ev => `${ev.year_display}. ${ev.title}. ${ev.content}`).join(' ');
  btn.addEventListener('click', () => timelineTTSToggle(btn, fullText));
}

function timelineTTSToggle(btn, text) {
  if (TTS.isSpeaking() && btn.classList.contains('active')) {
    TTS.stop();
    hideTTSProgressBar();
    btn.textContent = '🔊';
    btn.classList.remove('active');
    return;
  }
  if (TTS.isSpeaking()) TTS.stop();

  // Reset description TTS if active
  const descBtn = document.getElementById('tts-btn');
  const desc    = document.getElementById('detail-full-desc');
  if (descBtn) { descBtn.textContent = '🔊 Read Aloud'; descBtn.classList.remove('active'); }
  if (desc) restoreDescHTML(desc);
  hideTTSProgressBar();
  ttsActive = false;

  const header = document.querySelector('.events-section-header');
  if (header) showTTSProgressBar(header);

  btn.textContent = '⏹';
  btn.classList.add('active');

  TTS.speak(text, {
    onBoundary: (charIndex, totalLength) => updateTTSProgress(charIndex / totalLength),
    onEnd: () => {
      hideTTSProgressBar();
      btn.textContent = '🔊';
      btn.classList.remove('active');
    },
  });
}

function closeDetailPanel() {
  if (typeof SFX !== 'undefined') SFX.play('panel-close');
  document.getElementById('detail-panel').classList.remove('open');
  const desc = document.getElementById('detail-full-desc');
  if (desc) restoreDescHTML(desc);
  hideTTSProgressBar();
  TTS.stop();
  ttsActive = false;
  activeLocationId = null;
}

function handleTTS() {
  const btn  = document.getElementById('tts-btn');
  const desc = document.getElementById('detail-full-desc');

  if (TTS.isSpeaking()) {
    TTS.stop();
    restoreDescHTML(desc);
    hideTTSProgressBar();
    btn.textContent = '🔊 Read Aloud';
    btn.classList.remove('active');
    ttsActive = false;
    return;
  }

  // Reset any active timeline TTS buttons
  document.querySelectorAll('.timeline-tts-btn').forEach(b => { b.textContent = '🔊'; b.classList.remove('active'); });

  const highlightEnabled = localStorage.getItem('tts_word_highlight') === 'on';
  if (highlightEnabled) wrapWordsForHighlight(desc);
  const eraHeader = document.querySelector('.detail-era-header');
  showTTSProgressBar(eraHeader || btn);

  btn.textContent = '⏹ Stop';
  btn.classList.add('active');
  ttsActive = true;

  TTS.speak(desc.textContent, {
    onBoundary: (charIndex, totalLength) => {
      if (highlightEnabled) highlightWordAtProgress(desc, charIndex / totalLength);
      updateTTSProgress(charIndex / totalLength);
    },
    onEnd: () => {
      restoreDescHTML(desc);
      hideTTSProgressBar();
      btn.textContent = '🔊 Read Aloud';
      btn.classList.remove('active');
      ttsActive = false;
    },
  });
}

function refreshSingleMarker(loc) {
  if (markersById[loc.id]) {
    markersById[loc.id].remove();
  }
  const marker = createMarker(loc);
  marker.addTo(map);
  markersById[loc.id] = marker;
}

// Expose so quiz.js can trigger a full refresh after unlock
window.refreshMapMarkers = loadLocations;

function openImageLightbox(src, caption) {
  let overlay = document.getElementById('image-lightbox-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'image-lightbox-overlay';
    overlay.className = 'image-lightbox-overlay';
    overlay.innerHTML = `
      <div class="image-lightbox-box">
        <button class="image-lightbox-close" id="image-lightbox-close" title="Close">×</button>
        <img class="image-lightbox-img" id="image-lightbox-img" src="" alt="">
        <p class="image-lightbox-caption" id="image-lightbox-caption"></p>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeImageLightbox(); });
    document.getElementById('image-lightbox-close').addEventListener('click', closeImageLightbox);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageLightbox(); });
  }
  document.getElementById('image-lightbox-img').src = src;
  document.getElementById('image-lightbox-img').alt = caption;
  const cap = document.getElementById('image-lightbox-caption');
  cap.textContent = caption;
  cap.style.display = caption ? '' : 'none';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeImageLightbox() {
  const overlay = document.getElementById('image-lightbox-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function escapeAttr(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function copyLocationLink(locationId) {
  const url = `${location.origin}${location.pathname}#loc-${locationId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => { showToast('Link copied to clipboard!', 'info', 2000); if (typeof SFX !== 'undefined') SFX.play('hover'); })
      .catch(() => showToast('Could not copy link.', 'error'));
  }
}
window.copyLocationLink = copyLocationLink;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  // Deep-link: open location from URL hash #loc-{id}
  const hashMatch = location.hash.match(/^#loc-(\d+)$/);
  if (hashMatch) {
    const targetId = parseInt(hashMatch[1]);
    // Wait for markers to load then trigger click
    const checkLoaded = setInterval(() => {
      if (locationsData.length > 0) {
        clearInterval(checkLoaded);
        const loc = locationsData.find(l => l.id === targetId);
        if (loc && loc.unlocked) onMarkerClick(targetId);
      }
    }, 200);
  }
});
