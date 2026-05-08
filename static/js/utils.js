/* =========================================
   LA History — Shared Utilities
   ========================================= */

async function apiFetch(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function eraColor(era) {
  return { native: '#b87316', spanish: '#5c7a2e', rancho: '#2d5f96', modern: '#a82828' }[era] || '#9e9e9e';
}

function eraLabel(era) {
  return { native: 'Era 1 · Tongva', spanish: 'Era 2 · Spanish/Mexican', rancho: 'Era 3 · Rancho/American', modern: 'Era 4 · Modern LA' }[era] || era;
}

function eraEmoji(era) {
  return { native: '🌿', spanish: '⚓', rancho: '🏗️', modern: '🌆' }[era] || '📍';
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
