/* =========================================
   LA History — Progress / Sidebar
   ========================================= */

let progressData = null;

async function loadProgress() {
  try {
    progressData = await apiFetch('/api/progress');
    renderSidebar(progressData);
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
}

function renderSidebar(data) {
  // Points
  const pointsEl = document.getElementById('sidebar-points');
  if (pointsEl) pointsEl.textContent = data.user.total_points;

  // Visited counter
  const counterEl = document.getElementById('sidebar-visited-counter');
  if (counterEl) counterEl.textContent = `${data.total_visited}/${data.total_locations} visited`;

  // Overall completion ring (based on quizzes passed)
  const ringFill = document.getElementById('sidebar-ring-fill');
  const ringPct  = document.getElementById('sidebar-ring-pct');
  if (ringFill && ringPct && data.total_locations > 0) {
    const pct = Math.round((data.total_passed / data.total_locations) * 100);
    const circumference = 125.7;
    const offset = circumference - (circumference * pct / 100);
    ringFill.style.strokeDashoffset = offset;
    ringPct.textContent = `${pct}%`;
  }

  // Era progress bars
  const list = document.getElementById('era-progress-list');
  if (list) {
    list.innerHTML = data.eras.map(era => {
      const pct = era.total > 0 ? Math.round((era.passed / era.total) * 100) : 0;
      const color = eraColor(era.era);
      return `
        <div class="era-progress-item">
          <div class="era-progress-header">
            <span class="era-progress-name">${eraEmoji(era.era)} ${era.era.charAt(0).toUpperCase() + era.era.slice(1)}</span>
            <span class="era-progress-stat">${era.passed}/${era.total} passed</span>
          </div>
          <div class="era-bar-bg">
            <div class="era-bar-fill ${era.era}" style="width:${pct}%;background:${color}"></div>
          </div>
          <button class="cm-era-trigger-btn era-${era.era}"
                  data-era-order="${era.era_order}"
                  onclick="openConceptMap(${era.era_order})">
            🗺 Concept Map
          </button>
        </div>
      `;
    }).join('');
  }

  // Badges
  const grid = document.getElementById('badge-grid');
  if (grid) {
    const earned = data.badges.filter(b => b.earned);
    if (earned.length === 0) {
      grid.innerHTML = '<span class="badge-empty">Complete quizzes to earn badges.</span>';
    } else {
      grid.innerHTML = earned.map(b => `
        <div class="badge-item" title="${b.name}: ${b.description}">
          <div class="badge-icon">${b.icon}</div>
          <span class="badge-name">${b.name}</span>
        </div>
      `).join('');
    }
  }
}

function updatePointsDisplay(newTotal) {
  const pointsEl = document.getElementById('sidebar-points');
  if (pointsEl) {
    pointsEl.textContent = newTotal;
    pointsEl.style.transform = 'scale(1.3)';
    pointsEl.style.transition = 'transform 0.3s';
    setTimeout(() => { pointsEl.style.transform = 'scale(1)'; }, 300);
  }
  // Also update navbar
  const navPoints = document.querySelector('.navbar-points');
  if (navPoints) navPoints.textContent = `✦ ${newTotal} pts`;
}

function handleNewBadges(badges) {
  if (!badges.length) return;

  // Show celebration overlay for each badge sequentially.
  // Start after 600ms so the detail panel finishes opening and the
  // user isn't mid-click when the overlay appears.
  let delay = 600;
  badges.forEach((b, i) => {
    setTimeout(() => showBadgeCelebration(b), delay);
    delay += 3000;  // stagger multiple badges
  });

  // Refresh sidebar after all celebrations
  setTimeout(() => {
    loadProgress().then(() => {
      const badgeNames = badges.map(b => b.name);
      document.querySelectorAll('.badge-item').forEach(el => {
        const nameEl = el.querySelector('.badge-name');
        if (nameEl && badgeNames.includes(nameEl.textContent)) {
          el.classList.add('newly-earned');
        }
      });
    });
  }, delay);
}

function showBadgeCelebration(badge) {
  if (typeof SFX !== 'undefined') SFX.play('badge-earned');

  const overlay = document.createElement('div');
  overlay.className = 'badge-celebration-overlay active';

  // Build particle dots in a ring
  let particlesHTML = '';
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    const rad = angle * Math.PI / 180;
    const x = 50 + Math.cos(rad) * 46;
    const y = 50 + Math.sin(rad) * 46;
    const hue = 35 + (i * 8);  // gold spectrum
    const d = 0.2 + i * 0.06;
    particlesHTML += `<div class="particle" style="left:${x}%;top:${y}%;background:hsl(${hue},75%,58%);animation-delay:${d}s"></div>`;
  }

  overlay.innerHTML = `
    <div class="badge-celebration-card">
      <div class="badge-celebration-glow"></div>
      <div class="badge-celebration-particles">${particlesHTML}</div>
      <div class="badge-celebration-icon">${badge.icon}</div>
      <div class="badge-celebration-label">Badge Unlocked</div>
      <div class="badge-celebration-name">${badge.name}</div>
      <div class="badge-celebration-desc">${badge.description || ''}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Allow click to dismiss — but only after the card is fully visible (~500ms in),
  // so accidental clicks during the initial transparent phase don't kill it.
  setTimeout(() => {
    overlay.addEventListener('click', () => overlay.remove());
  }, 500);

  // Auto-remove after animation completes
  setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 2700);
}

// Sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');
  if (!sidebar || !toggle) return;

  toggle.addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.play('sidebar-toggle');
    const collapsed = sidebar.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '›' : '‹';
    toggle.classList.toggle('collapsed', collapsed);
    toggle.style.left = collapsed ? '0' : 'var(--sidebar-w)';
    // Let the CSS transition finish, then tell Leaflet to recalculate its size
    setTimeout(() => {
      if (window._leafletMap) window._leafletMap.invalidateSize();
    }, 320);
  });
});
