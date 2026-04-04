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
        </div>
      `;
    }).join('');
  }

  // Badges
  const grid = document.getElementById('badge-grid');
  if (grid) {
    if (data.badges.length === 0) {
      grid.innerHTML = '<span class="badge-empty">Complete quizzes to earn badges.</span>';
    } else {
      grid.innerHTML = data.badges.map(b => `
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
  badges.forEach(b => {
    showToast(`${b.icon} Badge unlocked: ${b.name}!`, 'badge', 5000);
  });
  loadProgress(); // Refresh badge grid
}

// Sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');
  if (!sidebar || !toggle) return;

  toggle.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '›' : '‹';
    toggle.classList.toggle('collapsed', collapsed);
    toggle.style.left = collapsed ? '0' : 'var(--sidebar-w)';
  });
});
