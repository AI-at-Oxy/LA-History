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
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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
  } catch (e) {
    console.error('Failed to load locations:', e);
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
  const eventsHTML  = buildEventsHTML(loc.events || []);

  body.innerHTML = `
    <div class="detail-era-header">
      <h2 class="detail-name">${loc.name}</h2>
      ${loc.visited ? '<span class="quiz-passed-badge" style="font-size:0.78rem;margin-top:4px">✓ Visited</span>' : ''}
    </div>

    <div class="detail-description" id="detail-full-desc">
      ${escapeHtml(loc.full_description)}
    </div>

    <div class="tts-bar">
      <button class="btn btn-secondary btn-sm" id="tts-btn" onclick="handleTTS('${loc.slug}')">
        🔊 Read Aloud
      </button>
      <span id="tts-status"></span>
    </div>

    ${eventsHTML}
    ${quizSection}

    <div class="detail-actions">
      <button class="btn btn-ghost" onclick="openChat(${loc.id}, '${escapeAttr(loc.name)}')">
        💬 Ask the Tutor
      </button>
    </div>
  `;

  panel.classList.add('open');

  document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
}

function buildQuizSection(loc) {
  if (!loc.has_quiz) return '';

  if (loc.quiz_passed) {
    return `
      <div class="detail-actions" style="padding-bottom:0">
        <span class="quiz-passed-badge">✓ Quiz Passed — ${loc.quiz_score}%</span>
      </div>`;
  }

  return `
    <div class="detail-actions" style="padding-bottom:0">
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

  return `
    <div class="events-section">
      <h4>Historical Timeline</h4>
      <div class="timeline">${items}</div>
    </div>`;
}

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.remove('open');
  TTS.stop();
  ttsActive = false;
  activeLocationId = null;
}

function handleTTS(slug) {
  const btn    = document.getElementById('tts-btn');
  const status = document.getElementById('tts-status');
  const desc   = document.getElementById('detail-full-desc');

  if (!TTS.isSupported()) {
    status.textContent = 'TTS not supported in this browser.';
    return;
  }

  if (TTS.isSpeaking()) {
    TTS.stop();
    btn.textContent = '🔊 Read Aloud';
    status.textContent = '';
    ttsActive = false;
    return;
  }

  TTS.speak(desc.textContent);
  btn.textContent = '⏹ Stop';
  status.textContent = 'Reading…';
  ttsActive = true;

  const checkInterval = setInterval(() => {
    if (!TTS.isSpeaking()) {
      btn.textContent = '🔊 Read Aloud';
      status.textContent = '';
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
