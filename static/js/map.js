/* =========================================
   LA History — Leaflet Map
   ========================================= */

let map;
let markersById = {};
let locationsData = [];
let activeLocationId = null;
let ttsActive = false;

function initMap() {
  map = L.map('map', {
    center: [34.05, -118.25],
    zoom: 11,
    zoomControl: true,
    minZoom: 11,
    maxBounds: [[33.65, -118.80], [34.45, -117.55]],
    maxBoundsViscosity: 1.0,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  loadLocations();
}

async function loadLocations() {
  try {
    locationsData = await apiFetch('/api/locations');
    renderMarkers(locationsData);
    loadProgress(); // load sidebar
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
}

function createMarker(loc) {
  const color = loc.unlocked ? eraColor(loc.era) : '#9e9e9e';
  const emoji = loc.unlocked ? eraEmoji(loc.era) : '🔒';
  const visitedStyle = loc.visited ? 'opacity:0.75;' : '';

  const icon = L.divIcon({
    className: '',
    html: `
      <div class="map-marker ${loc.visited ? 'visited' : ''} ${!loc.unlocked ? 'locked' : ''}"
           style="background:${color};${visitedStyle}border-color:${loc.unlocked ? 'rgba(255,255,255,0.9)' : '#ccc'}">
        <div class="map-marker-inner">${emoji}</div>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });

  const marker = L.marker([loc.latitude, loc.longitude], { icon });

  marker.bindTooltip(loc.name, { direction: 'top', offset: [0, -36], opacity: 0.9 });

  if (loc.unlocked) {
    marker.bindPopup(buildPopup(loc), { maxWidth: 240 });
    marker.on('click', () => onMarkerClick(loc.id));
  } else {
    marker.bindPopup(`
      <div class="map-popup-name">🔒 ${loc.name}</div>
      <div class="map-popup-locked">Complete earlier quizzes to unlock ${eraLabel(loc.era)}.</div>
    `, { maxWidth: 220 });
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

async function onMarkerClick(locationId) {
  activeLocationId = locationId;
  map.closePopup();

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
          loadProgress();
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
    ? `<button class="detail-tts-btn" id="tts-btn" onclick="handleTTS('${loc.slug}')" title="Read aloud">🔊 Read Aloud</button>`
    : '';

  body.innerHTML = `
    <div class="detail-era-header">
      <h2 class="detail-name">${loc.name}</h2>
      <div class="detail-header-meta">
        ${loc.visited ? '<span class="quiz-passed-badge" style="font-size:0.78rem">✓ Visited</span>' : ''}
        ${ttsBtnHTML}
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

  if (loc.quiz_passed) {
    return `
      <div class="detail-actions">
        <span class="quiz-passed-badge">✓ Quiz Passed — ${loc.quiz_score}%</span>
      </div>`;
  }

  return `
    <div class="detail-actions">
      <button class="btn btn-primary" onclick="openQuiz(${loc.id})">
        📝 Take the Quiz
      </button>
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
    btn.textContent = '🔊';
    btn.classList.remove('active');
    return;
  }
  if (TTS.isSpeaking()) TTS.stop();
  // Reset description TTS if active
  const descBtn = document.getElementById('tts-btn');
  if (descBtn) { descBtn.textContent = '🔊 Read Aloud'; descBtn.classList.remove('active'); }
  ttsActive = false;

  TTS.speak(text);
  btn.textContent = '⏹';
  btn.classList.add('active');
  const check = setInterval(() => {
    if (!TTS.isSpeaking()) {
      btn.textContent = '🔊';
      btn.classList.remove('active');
      clearInterval(check);
    }
  }, 500);
}

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.remove('open');
  TTS.stop();
  ttsActive = false;
  activeLocationId = null;
}

function handleTTS(slug) {
  const btn  = document.getElementById('tts-btn');
  const desc = document.getElementById('detail-full-desc');

  if (TTS.isSpeaking()) {
    TTS.stop();
    btn.textContent = '🔊 Read Aloud';
    btn.classList.remove('active');
    ttsActive = false;
    return;
  }

  // Reset any active timeline TTS buttons
  document.querySelectorAll('.timeline-tts-btn').forEach(b => { b.textContent = '🔊'; b.classList.remove('active'); });

  TTS.speak(desc.textContent);
  btn.textContent = '⏹ Stop';
  btn.classList.add('active');
  ttsActive = true;

  const checkInterval = setInterval(() => {
    if (!TTS.isSpeaking()) {
      btn.textContent = '🔊 Read Aloud';
      btn.classList.remove('active');
      ttsActive = false;
      clearInterval(checkInterval);
    }
  }, 500);
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

document.addEventListener('DOMContentLoaded', initMap);
