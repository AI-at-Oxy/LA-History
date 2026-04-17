/* =========================================
   LA History — Leaflet Map
   ========================================= */

let map;
let markersById = {};
let locationsData = [];
let activeLocationId = null;
let ttsActive = false;
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
    if (typeof Tutorial !== 'undefined') Tutorial.init();
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

}

// ---- Era filter ----
const activeEraFilters = new Set(['native', 'spanish', 'rancho', 'modern']);

function applyEraFilter(era) {
  if (typeof SFX !== 'undefined') SFX.play('filter-toggle');

  if (activeEraFilters.has(era)) {
    activeEraFilters.delete(era);
  } else {
    activeEraFilters.add(era);
  }

  // Update button visual state
  document.querySelectorAll('.era-filter-btn').forEach(btn => {
    const btnEra = btn.dataset.era;
    const isActive = activeEraFilters.has(btnEra);
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? eraColor(btnEra) : '';
    btn.style.borderColor = isActive ? eraColor(btnEra) : '';
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
      row.addEventListener('click', () => {
        results.innerHTML = '';
        input.value = '';
        onMarkerClick(loc.id);
      });
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


function getMarkerDimensions() {
  const base    = parseInt(localStorage.getItem('marker_size')) || 32;
  // CSS --marker-size is set to base+2, so match Leaflet's iconSize to avoid mismatch
  const visual  = base + 2;
  // Add padding so shadows and scale-on-hover aren't clipped by the icon container
  const padded  = visual + 12;
  return {
    iconSize:      [padded, padded],
    iconAnchor:    [padded / 2, padded - 6],
    popupAnchor:   [0, -(visual + 8)],
    tooltipOffset: [0, -(visual + 8)],
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

  // Raise z-index on hover so hovered marker appears above overlapping ones
  marker.on('mouseover', () => marker.setZIndexOffset(500));
  marker.on('mouseout',  () => marker.setZIndexOffset(0));

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
    return 'Complete earlier quizzes and submit the concept map to unlock this era.';
  }
  const prevEraLocs = locationsData.filter(l => l.era_order === eraOrder - 1 && l.has_quiz);
  const prevPassed  = prevEraLocs.filter(l => l.quiz_passed).length;
  const prevTotal   = prevEraLocs.length;
  const quizzesDone = prevPassed >= prevTotal;

  const prevEraName = eraOrder === 2 ? 'Native' : eraOrder === 3 ? 'Spanish' : 'Rancho';

  // Check concept map status from progressData (loaded by progress.js)
  let cmSubmitted = false;
  if (typeof progressData !== 'undefined' && progressData && progressData.eras) {
    const prevEraInfo = progressData.eras.find(e => e.era_order === eraOrder - 1);
    cmSubmitted = prevEraInfo ? !!prevEraInfo.concept_map_submitted : false;
  }

  if (quizzesDone && cmSubmitted) {
    return 'Almost there — keep exploring!';
  }
  if (quizzesDone && !cmSubmitted) {
    return `Submit the ${prevEraName} era concept map to unlock this era.`;
  }

  const needed = prevTotal - prevPassed;
  if (cmSubmitted) {
    return `Pass ${needed} more quiz${needed === 1 ? '' : 'zes'} in the ${prevEraName} era to unlock this.`;
  }
  return `To unlock this era: pass all ${prevEraName} era quizzes (${prevPassed}/${prevTotal} done) and submit the ${prevEraName} concept map.`;
}

async function onMarkerClick(locationId) {
  activeLocationId = locationId;
  map.closePopup();

  // Smooth fly-to the clicked location
  const locForFly = locationsData.find(l => l.id === locationId);
  if (locForFly) {
    _suppressZoomSFX = true;
    map.flyTo([locForFly.latitude, locForFly.longitude], Math.max(map.getZoom(), 13), {
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
            setTimeout(() => { if (typeof SFX !== 'undefined') SFX.play('visit-earn'); }, 200);
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
  if (typeof MusicPlayer !== 'undefined') MusicPlayer.play(loc.era);

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

    ${buildVideoSection(loc)}

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

function buildVideoSection(loc) {
  if (!loc.video_url) return '';
  const videoId = extractYouTubeId(loc.video_url);
  if (!videoId) return '';
  const caption = loc.video_caption
    ? `<figcaption class="detail-video-caption">${escapeHtml(loc.video_caption)}</figcaption>`
    : '';
  return `
    <div class="detail-video-section">
      <div class="detail-video-thumb-wrap" data-video-id="${videoId}" onclick="loadDetailVideo(this)">
        <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg"
             alt="Video thumbnail" class="detail-video-thumb" loading="lazy">
        <div class="detail-video-play-btn" aria-label="Play video">&#9654;</div>
      </div>
      ${caption}
    </div>`;
}

function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    return null;
  } catch { return null; }
}

function loadDetailVideo(thumbWrap) {
  const videoId = thumbWrap.dataset.videoId;
  thumbWrap.outerHTML = `
    <div class="detail-video-embed-wrap">
      <iframe class="detail-video-iframe"
        src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1"
        title="Historical video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
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
  const iframe = document.querySelector('.detail-video-iframe');
  if (iframe) iframe.src = '';
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

// Expose so quiz.js can refresh the detail panel after a quiz pass
window.refreshDetailPanel = async function(locationId) {
  try {
    const loc = await apiFetch(`/api/locations/${locationId}`);
    const idx = locationsData.findIndex(l => l.id === locationId);
    if (idx !== -1) locationsData[idx] = { ...locationsData[idx], ...loc };
    if (activeLocationId === locationId) openDetailPanel(loc);
    refreshSingleMarker(loc);
  } catch (e) {
    // silently ignore — panel will be correct on next open
  }
};

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

// ---- Map page keyboard shortcuts ----
document.addEventListener('keydown', function (e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (document.activeElement.isContentEditable) return;

  const quizOpen     = document.getElementById('quiz-modal-overlay')?.classList.contains('open');
  const cmOpen       = document.getElementById('cm-overlay')?.classList.contains('open');
  const settingsOpen = document.getElementById('settings-overlay')?.classList.contains('open');
  const shortcutOpen = document.getElementById('shortcut-overlay')?.classList.contains('open');
  const tutorialOpen = !!document.querySelector('.tutorial-visible');
  const lightboxOpen = document.getElementById('image-lightbox-overlay')?.classList.contains('open');
  const anyModalOpen = quizOpen || cmOpen || settingsOpen || shortcutOpen || tutorialOpen || lightboxOpen;

  switch (e.key) {
    case '/':
      if (!anyModalOpen) {
        e.preventDefault();
        const search = document.getElementById('map-search-input');
        if (search) { search.focus(); search.select(); }
      }
      break;

    case 's': case 'S':
      if (!anyModalOpen) document.getElementById('sidebar-toggle')?.click();
      break;

    case 'c': case 'C':
      if (!anyModalOpen && typeof toggleChat === 'function') toggleChat();
      break;

    case 'r': case 'R':
      if (!anyModalOpen && map) {
        _suppressZoomSFX = true;
        map.flyTo([34.05, -118.25], 11, { animate: true, duration: 1.0 });
        map.once('moveend', () => { _suppressZoomSFX = false; });
      }
      break;

    case 'q': case 'Q':
      if (!anyModalOpen && activeLocationId) {
        const loc = locationsData.find(l => l.id === activeLocationId);
        if (loc && loc.has_quiz && !loc.quiz_passed && typeof openQuiz === 'function') {
          openQuiz(activeLocationId);
        }
      }
      break;

    case 't': case 'T':
      if (!anyModalOpen) document.getElementById('tts-btn')?.click();
      break;

    case 'Escape':
      if (quizOpen && typeof closeQuiz === 'function') { closeQuiz(); break; }
      if (cmOpen) { document.getElementById('cm-close-btn')?.click(); break; }
      if (lightboxOpen) { closeImageLightbox(); break; }
      if (!shortcutOpen && !settingsOpen && !tutorialOpen) {
        if (document.getElementById('detail-panel')?.classList.contains('open')) {
          closeDetailPanel(); break;
        }
      }
      break;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  if (typeof MusicPlayer !== 'undefined') {
    MusicPlayer.play(localStorage.getItem('music_last_era') || 'native');
  }
  // Deep-link: open location from URL hash #loc-{id}
  const hashMatch = location.hash.match(/^#loc-(\d+)$/);
  if (hashMatch) {
    const targetId = parseInt(hashMatch[1]);
    const checkLoaded = setInterval(() => {
      if (locationsData.length > 0) {
        clearInterval(checkLoaded);
        const loc = locationsData.find(l => l.id === targetId);
        if (loc && loc.unlocked) onMarkerClick(targetId);
      }
    }, 200);
  }

  // Deep-link: open concept map from ?cm={era_order}
  const cmParam = new URLSearchParams(location.search).get('cm');
  if (cmParam) {
    const eraOrder = parseInt(cmParam);
    if (eraOrder >= 1 && eraOrder <= 4) {
      const waitForSidebar = setInterval(() => {
        if (typeof openConceptMap === 'function' && locationsData.length > 0 && typeof progressData !== 'undefined' && progressData) {
          clearInterval(waitForSidebar);
          const eraInfo = progressData.eras && progressData.eras.find(e => e.era_order === eraOrder);
          if (eraInfo && !eraInfo.era_unlocked) {
            showToast('That era is locked. Complete the previous era\'s quizzes and concept map first.', 'warning');
            return;
          }
          setTimeout(() => openConceptMap(eraOrder), 300);
        }
      }, 200);
    }
  }
});
