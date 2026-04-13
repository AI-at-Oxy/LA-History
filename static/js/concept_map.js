/* =============================================
   LA History — Concept Map
   ============================================= */

'use strict';

// ── Module state ──────────────────────────────
let cy = null;
let cmEraOrder = null;
let cmEraData = null;
let cmPendingEdgeSource = null;   // node id awaiting a target tap
let cmPendingEdgeSourceForEdit = null;  // when editing existing edge
let cmEditingEdgeId = null;       // id of edge being label-edited
let cmAutoSaveTimer = null;
let cmSubmitted = false;
let cmKeyboardNodeIndex = -1;     // for Tab-to-cycle-nodes keyboard nav
let cmContextTarget = null;       // { type: 'node'|'edge', id } for right-click menu

// ── Entry point ───────────────────────────────
function openConceptMap(eraOrder) {
  cmEraOrder = eraOrder;
  document.getElementById('cm-overlay').classList.add('open');
  if (typeof SFX !== 'undefined') SFX.play('panel-open');
  loadConceptMapData(eraOrder);
}

async function loadConceptMapData(eraOrder) {
  setStatus('Loading…');
  try {
    cmEraData = await apiFetch('/api/concept_map/' + eraOrder);
  } catch (e) {
    setStatus('');
    showToast(e.message || 'Could not load concept map.', 'error');
    return;
  }

  document.getElementById('cm-era-pill').textContent =
    (eraEmoji ? eraEmoji(cmEraData.era_name) + ' ' : '') +
    cmEraData.era_name.charAt(0).toUpperCase() + cmEraData.era_name.slice(1);

  renderPalette(cmEraData.locations);

  // Defer cytoscape init until overlay is visible so the canvas has real px dimensions
  requestAnimationFrame(() => {
    initCytoscape();

    if (cmEraData.concept_map && cmEraData.concept_map.graph_json) {
      try {
        cy.json(JSON.parse(cmEraData.concept_map.graph_json));
        cy.fit(undefined, 40);
      } catch (_) { /* stale/corrupt data — start fresh */ }
    }

    cmSubmitted = !!(cmEraData.concept_map && cmEraData.concept_map.submitted);
    if (cmSubmitted) {
      lockGraph();
      if (cmEraData.concept_map.ai_feedback) {
        try {
          displayResults({
            ai_feedback: JSON.parse(cmEraData.concept_map.ai_feedback),
            points_earned: cmEraData.concept_map.points_earned,
            synthesis_score: JSON.parse(cmEraData.concept_map.ai_feedback).synthesis_score || 0,
          });
        } catch (_) {}
      }
    }

    updateEdgeCount();
    updateSubmitButton();
    setStatus('');

    if (!cmSubmitted) {
      cmAutoSaveTimer = setInterval(autoSave, 30000);
    }
  });
}

// ── Cytoscape init ────────────────────────────
function initCytoscape() {
  if (cy) {
    cy.destroy();
    cy = null;
  }

  cy = cytoscape({
    container: document.getElementById('cm-canvas'),
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'label': 'data(shortLabel)',
          'color': '#fff',
          'text-wrap': 'wrap',
          'text-max-width': '88px',
          'font-size': '11px',
          'font-family': 'DM Sans, system-ui, sans-serif',
          'width': 'label',
          'height': 'label',
          'padding': '10px',
          'shape': 'round-rectangle',
          'text-valign': 'center',
          'text-halign': 'center',
          'border-width': 2,
          'border-color': 'data(borderColor)',
          'min-width': 60,
          'min-height': 36,
        },
      },
      {
        selector: 'node[?cross_era]',
        style: {
          'border-style': 'dashed',
          'border-color': '#999',
          'opacity': 0.85,
        },
      },
      {
        selector: 'node.selected-source',
        style: {
          'border-color': '#d4a843',
          'border-width': 3,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#b8731a',
          'border-width': 3,
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#c4b89a',
          'target-arrow-color': '#c4b89a',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'font-family': 'DM Sans, system-ui, sans-serif',
          'color': '#5a4e3c',
          'text-background-color': '#faf7f0',
          'text-background-opacity': 1,
          'text-background-padding': '3px',
          'text-border-opacity': 0,
          'edge-text-rotation': 'autorotate',
        },
      },
      {
        selector: 'edge[?cross_era]',
        style: {
          'line-style': 'dashed',
          'line-color': '#a09080',
          'target-arrow-color': '#a09080',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#b8731a',
          'target-arrow-color': '#b8731a',
        },
      },
    ],
    layout: { name: 'preset' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    autounselectify: false,
  });

  // ── tap background → clear source selection
  cy.on('tap', function(evt) {
    if (evt.target === cy) {
      clearSourceSelection();
      hideEdgePopup();
      hideContextMenu();
    }
  });

  // ── right-click background → dismiss context menu
  cy.on('cxttap', function(evt) {
    if (evt.target === cy) hideContextMenu();
  });

  // ── right-click node → context menu
  cy.on('cxttap', 'node', function(evt) {
    if (cmSubmitted) return;
    const node = evt.target;
    showContextMenu([
      {
        label: '🔗 Start connection from here',
        action() {
          cy.nodes().removeClass('selected-source');
          node.addClass('selected-source');
          cmPendingEdgeSource = node.id();
        },
      },
      {
        label: 'Remove from map',
        danger: true,
        action() { cmRemoveNode(node.id()); },
      },
    ], evt.renderedPosition);
  });

  // ── right-click edge → context menu
  cy.on('cxttap', 'edge', function(evt) {
    if (cmSubmitted) return;
    const edge = evt.target;
    showContextMenu([
      {
        label: 'Edit label',
        action() {
          cmEditingEdgeId = edge.id();
          showEdgePopup(edge.data('source'), edge.data('target'), evt.renderedPosition, edge.data('label'));
        },
      },
      {
        label: 'Delete connection',
        danger: true,
        action() { cmRemoveEdge(edge.id()); },
      },
    ], evt.renderedPosition);
  });

  // ── tap node → edge state machine
  cy.on('tap', 'node', function(evt) {
    if (cmSubmitted) return;
    hideContextMenu();
    const node = evt.target;
    const nodeId = node.id();

    if (!cmPendingEdgeSource) {
      cy.nodes().removeClass('selected-source');
      node.addClass('selected-source');
      cmPendingEdgeSource = nodeId;
    } else if (cmPendingEdgeSource === nodeId) {
      clearSourceSelection();
    } else {
      showEdgePopup(cmPendingEdgeSource, nodeId, evt.renderedPosition);
    }
  });

  // ── double-tap edge → edit label
  cy.on('dblclick', 'edge', function(evt) {
    if (cmSubmitted) return;
    const edge = evt.target;
    cmEditingEdgeId = edge.id();
    showEdgePopup(
      edge.data('source'),
      edge.data('target'),
      evt.renderedPosition,
      edge.data('label'),
    );
  });
}

// ── Palette rendering ─────────────────────────
function renderPalette(locations) {
  const list = document.getElementById('cm-palette-list');
  const eraLocs = locations.filter(l => l.era_order === cmEraOrder);
  const visitedLocs = eraLocs.filter(l => l.visited);

  if (visitedLocs.length === 0) {
    list.innerHTML = '<p class="cm-palette-empty">Visit locations on the map to add them here.</p>';
    return;
  }

  list.innerHTML = visitedLocs.map(loc => `
    <div class="cm-palette-item" id="palette-item-${loc.id}">
      <span class="cm-palette-item-name" id="palette-name-${loc.id}"
            title="${loc.name}">${loc.name}</span>
      <button class="cm-btn cm-btn-secondary cm-palette-add-btn"
              data-loc-id="${loc.id}"
              onclick="cmAddNode(${JSON.stringify(loc).replace(/"/g, '&quot;')})">+</button>
    </div>
  `).join('');
}

function cmAddNode(locData) {
  const nodeId = 'loc-' + locData.id;
  if (cy.getElementById(nodeId).length > 0) {
    // Node already on canvas — flash it instead of duplicating
    const existing = cy.getElementById(nodeId);
    existing.flashClass('selected-source', 600);
    return;
  }

  const canvasEl = document.getElementById('cm-canvas');
  const w = canvasEl.offsetWidth || 600;
  const h = canvasEl.offsetHeight || 400;
  const pos = {
    x: 60 + Math.random() * (w - 120),
    y: 60 + Math.random() * (h - 120),
  };

  const color = typeof eraColor === 'function' ? eraColor(locData.era) : '#888';
  const shortLabel = locData.name.length > 22
    ? locData.name.slice(0, 21) + '…'
    : locData.name;

  cy.add({
    group: 'nodes',
    data: {
      id: nodeId,
      label: locData.name,
      shortLabel,
      color,
      borderColor: color,
      location_id: locData.id,
      era: locData.era,
      era_order: locData.era_order,
      cross_era: locData.era_order !== cmEraOrder,
    },
    position: pos,
  });

  // Dim the palette entry to signal it's on the map
  const nameEl = document.getElementById('palette-name-' + locData.id);
  if (nameEl) nameEl.classList.add('on-map');

  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

// Expose so palette onclick can call it by name
window.cmAddNode = cmAddNode;

// ── Edge popup ────────────────────────────────
function showEdgePopup(sourceId, targetId, renderedPos, existingLabel) {
  const popup = document.getElementById('cm-edge-popup');
  const input = document.getElementById('cm-edge-label-input');

  // Store pending connection
  cmPendingEdgeSource = sourceId;
  cmEditingEdgeId = cmEditingEdgeId || null;

  // Position relative to canvas container
  const canvasEl = document.getElementById('cm-canvas');
  const rect = canvasEl.getBoundingClientRect();
  const popupW = 290;
  const popupH = 120;
  let left = renderedPos.x + 10;
  let top  = renderedPos.y + 10;

  // Clamp so popup stays inside canvas
  left = Math.min(left, canvasEl.offsetWidth  - popupW - 10);
  top  = Math.min(top,  canvasEl.offsetHeight - popupH - 10);
  left = Math.max(left, 6);
  top  = Math.max(top,  6);

  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.classList.add('visible');
  popup.setAttribute('aria-hidden', 'false');

  input.value = existingLabel || '';
  input.focus();

  // Stash target for the confirm handler
  popup.dataset.sourceId = sourceId;
  popup.dataset.targetId = targetId;
}

function hideEdgePopup() {
  const popup = document.getElementById('cm-edge-popup');
  popup.classList.remove('visible');
  popup.setAttribute('aria-hidden', 'true');
  document.getElementById('cm-edge-label-input').value = '';
  cmEditingEdgeId = null;
}

function confirmEdge() {
  const popup = document.getElementById('cm-edge-popup');
  const label = document.getElementById('cm-edge-label-input').value.trim();
  if (!label) {
    document.getElementById('cm-edge-label-input').focus();
    return;
  }

  const sourceId = popup.dataset.sourceId;
  const targetId = popup.dataset.targetId;

  if (cmEditingEdgeId) {
    // Edit existing edge label
    const edge = cy.getElementById(cmEditingEdgeId);
    if (edge.length) edge.data('label', label);
  } else {
    const sourceNode = cy.getElementById(sourceId);
    const targetNode = cy.getElementById(targetId);
    const isCrossEra = sourceNode.data('cross_era') || targetNode.data('cross_era')
      || sourceNode.data('era_order') !== targetNode.data('era_order');

    cy.add({
      group: 'edges',
      data: {
        source: sourceId,
        target: targetId,
        label,
        cross_era: isCrossEra,
      },
    });
  }

  clearSourceSelection();
  hideEdgePopup();
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

function clearSourceSelection() {
  cy && cy.nodes().removeClass('selected-source');
  cmPendingEdgeSource = null;
}

// ── Edge popup event listeners ────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cm-edge-add-btn').addEventListener('click', confirmEdge);
  document.getElementById('cm-edge-cancel-btn').addEventListener('click', () => {
    clearSourceSelection();
    hideEdgePopup();
  });
  document.getElementById('cm-edge-label-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdge(); }
    if (e.key === 'Escape') { clearSourceSelection(); hideEdgePopup(); }
  });

  // Close overlay on backdrop click
  document.getElementById('cm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('cm-overlay')) closeConceptMap();
  });

  document.getElementById('cm-close-btn').addEventListener('click', closeConceptMap);

  // Save button
  document.getElementById('cm-save-btn').addEventListener('click', async () => {
    try {
      await saveGraph();
      showToast('Map saved.', 'info');
    } catch (e) {
      showToast(e.message || 'Save failed.', 'error');
    }
  });

  // Submit button
  document.getElementById('cm-submit-btn').addEventListener('click', handleSubmit);

  // Clear All
  document.getElementById('cm-clear-btn').addEventListener('click', cmClearAll);

  // Cross-era picker
  document.getElementById('cm-add-cross-era-btn').addEventListener('click', openCrossEraPicker);
  document.getElementById('cm-picker-close').addEventListener('click', closeCrossEraPicker);

  // Canvas keyboard nav
  const canvas = document.getElementById('cm-canvas');
  canvas.addEventListener('keydown', handleCanvasKeydown);
});

// ── Save & auto-save ──────────────────────────
function scheduleAutoSave() {
  clearTimeout(cmAutoSaveTimer);
  cmAutoSaveTimer = setTimeout(autoSave, 30000);
}

async function autoSave() {
  if (cmSubmitted || !cmEraOrder || !cy) return;
  try {
    await saveGraph();
    flashSaveIndicator();
  } catch (_) {
    // Silent — don't interrupt user with auto-save failures
  }
}

async function saveGraph() {
  await apiFetch('/api/concept_map/' + cmEraOrder + '/save', 'POST', {
    graph_json: cy.json(),
  });
}

function flashSaveIndicator() {
  const el = document.getElementById('cm-save-indicator');
  el.textContent = '✓ Saved';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}

// ── Submit ────────────────────────────────────
async function handleSubmit() {
  const btn = document.getElementById('cm-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Evaluating…';

  // Ensure latest state is persisted before evaluation
  try { await saveGraph(); } catch (_) {}

  try {
    const result = await apiFetch('/api/concept_map/' + cmEraOrder + '/evaluate', 'POST', {});

    cmSubmitted = true;
    lockGraph();
    clearTimeout(cmAutoSaveTimer);

    displayResults(result);
    showToast('+' + result.points_earned + ' pts — Concept map submitted!', 'points');

    if (typeof updatePointsDisplay === 'function') updatePointsDisplay(result.total_points);

    if (result.new_badges && result.new_badges.length) {
      if (typeof handleNewBadges === 'function') handleNewBadges(result.new_badges);
    } else {
      if (typeof loadProgress === 'function') loadProgress();
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Submit for Feedback';
    showToast(e.message || 'Evaluation failed. Is Ollama running?', 'error');
  }
}

// ── Display AI results ────────────────────────
function displayResults(result) {
  const panel = document.getElementById('cm-results-panel');
  const body  = document.getElementById('cm-results-body');
  const score = document.getElementById('cm-synthesis-score');

  const feedback = result.ai_feedback || {};
  const s = result.synthesis_score !== undefined
    ? result.synthesis_score
    : (feedback.synthesis_score || 0);

  score.textContent = 'Synthesis score: ' + s + '/100';

  let html = '';

  (feedback.edge_feedback || []).forEach(ef => {
    html += `
      <div class="cm-edge-feedback-item">
        <div class="cm-edge-feedback-connection">
          ${ef.source || ''} → ${ef.target || ''}
          ${ef.label ? '<span style="color:var(--text-muted);font-weight:400"> · ' + ef.label + '</span>' : ''}
        </div>
        <div class="cm-edge-feedback-comment">${ef.comment || ''}</div>
      </div>
    `;
  });

  if (feedback.overall_comment) {
    html += `<div class="cm-results-overall">${feedback.overall_comment}</div>`;
  }

  if (feedback.follow_up_question) {
    html += `<div class="cm-results-follow-up">💭 ${feedback.follow_up_question}</div>`;
  }

  body.innerHTML = html || '<p style="color:var(--text-muted);font-size:0.82rem">No feedback received.</p>';
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Update submit button to reflect submitted state
  const submitBtn = document.getElementById('cm-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitted ✓';
  document.getElementById('cm-status').textContent = 'Submitted';
}

// ── Lock graph after submission ───────────────
function lockGraph() {
  if (!cy) return;
  cy.nodes().ungrabify();
  cy.off('tap', 'node');
  cy.off('dblclick', 'edge');
  const submitBtn = document.getElementById('cm-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitted ✓'; }
  document.getElementById('cm-status').textContent = 'Submitted';
}

// ── Submit button state ───────────────────────
function updateSubmitButton() {
  const btn     = document.getElementById('cm-submit-btn');
  const tooltip = document.getElementById('cm-submit-tooltip');
  const edgeCount = cy ? cy.edges().length : 0;

  if (cmSubmitted) {
    btn.disabled = true;
    btn.textContent = 'Submitted ✓';
    tooltip.textContent = '';
    return;
  }

  if (edgeCount < 3) {
    btn.disabled = true;
    const needed = 3 - edgeCount;
    tooltip.textContent = `Add ${needed} more connection${needed !== 1 ? 's' : ''} to submit.`;
    return;
  }

  if (cmEraData && !cmEraData.era_quizzes_all_passed) {
    btn.disabled = true;
    tooltip.textContent = 'Complete all era quizzes to unlock submission.';
    return;
  }

  btn.disabled = false;
  tooltip.textContent = '';
}

function updateEdgeCount() {
  const count = cy ? cy.edges().length : 0;
  document.getElementById('cm-edge-count').textContent =
    count + ' connection' + (count !== 1 ? 's' : '');
}

// ── Cross-era picker ──────────────────────────
async function openCrossEraPicker() {
  const picker = document.getElementById('cm-cross-era-picker');
  const list   = document.getElementById('cm-picker-list');
  list.innerHTML = '<p class="cm-picker-empty">Loading…</p>';
  picker.classList.add('visible');
  picker.setAttribute('aria-hidden', 'false');

  try {
    const progressData = await apiFetch('/api/progress');
    const otherVisited = progressData.eras
      .filter(e => e.era_order !== cmEraOrder)
      .flatMap(e => (e.locations || []).filter(l => l.visited));

    if (otherVisited.length === 0) {
      list.innerHTML = '<p class="cm-picker-empty">No visited locations in other eras yet.</p>';
      return;
    }

    list.innerHTML = otherVisited.map(loc => `
      <div class="cm-picker-item">
        <span class="cm-picker-era-badge ${loc.era || ''}">${loc.era || ''}</span>
        <span class="cm-picker-name" title="${loc.name}">${loc.name}</span>
        <button class="cm-btn cm-btn-secondary"
                style="font-size:0.72rem;padding:2px 8px;flex-shrink:0"
                onclick="cmPickCrossEraNode(${loc.id}, ${JSON.stringify(loc.name).replace(/"/g, '&quot;')}, '${loc.era}', ${loc.era_order || 0})">
          Add
        </button>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<p class="cm-picker-empty">Could not load locations.</p>';
    showToast(e.message || 'Failed to load locations.', 'error');
  }
}

function cmPickCrossEraNode(locId, locName, era, eraOrder) {
  cmAddNode({ id: locId, name: locName, era, era_order: eraOrder, visited: true });
  closeCrossEraPicker();
}
window.cmPickCrossEraNode = cmPickCrossEraNode;

function closeCrossEraPicker() {
  const picker = document.getElementById('cm-cross-era-picker');
  picker.classList.remove('visible');
  picker.setAttribute('aria-hidden', 'true');
}

// ── Close overlay ─────────────────────────────
function closeConceptMap() {
  if (typeof SFX !== 'undefined') SFX.play('panel-close');

  // Save on close if there are unsaved changes and not yet submitted
  if (!cmSubmitted && cmEraOrder && cy) {
    apiFetch('/api/concept_map/' + cmEraOrder + '/save', 'POST', {
      graph_json: cy.json(),
    }).catch(() => {});
  }

  document.getElementById('cm-overlay').classList.remove('open');
  clearTimeout(cmAutoSaveTimer);

  // Clean up cytoscape to free memory
  if (cy) { cy.destroy(); cy = null; }

  cmEraOrder = null;
  cmEraData = null;
  cmPendingEdgeSource = null;
  cmEditingEdgeId = null;
  cmSubmitted = false;
  cmKeyboardNodeIndex = -1;

  // Reset results panel for next open
  document.getElementById('cm-results-panel').hidden = true;
  document.getElementById('cm-results-body').innerHTML = '';
  document.getElementById('cm-status').textContent = '';
  document.getElementById('cm-palette-list').innerHTML = '';
}

// ── Keyboard accessibility ────────────────────
function handleCanvasKeydown(e) {
  if (!cy || cmSubmitted) return;

  if (e.key === 'Escape') { hideContextMenu(); return; }

  const nodes = cy.nodes();
  if (nodes.length === 0) return;

  if (e.key === 'Tab') {
    e.preventDefault();
    cmKeyboardNodeIndex = (cmKeyboardNodeIndex + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
    cy.nodes().unselect();
    nodes[cmKeyboardNodeIndex].select();
    return;
  }

  const selected = cy.$('node:selected');
  if (selected.length === 0) return;

  // Arrow key movement
  const step = e.shiftKey ? 20 : 8;
  const pos = selected.position();
  let dx = 0, dy = 0;
  if (e.key === 'ArrowLeft')  { dx = -step; e.preventDefault(); }
  if (e.key === 'ArrowRight') { dx =  step; e.preventDefault(); }
  if (e.key === 'ArrowUp')    { dy = -step; e.preventDefault(); }
  if (e.key === 'ArrowDown')  { dy =  step; e.preventDefault(); }
  if (dx !== 0 || dy !== 0) {
    selected.position({ x: pos.x + dx, y: pos.y + dy });
    scheduleAutoSave();
    return;
  }

  // Delete selected elements
  if ((e.key === 'Delete' || e.key === 'Backspace') &&
      document.activeElement.tagName !== 'INPUT' &&
      document.activeElement.tagName !== 'TEXTAREA') {
    cy.$('node:selected').forEach(node => cmRemoveNode(node.id()));
    cy.$('edge:selected').forEach(edge => cmRemoveEdge(edge.id()));
    cmKeyboardNodeIndex = -1;
    return;
  }

  // Enter → start edge from selected node
  if (e.key === 'Enter') {
    const nodeId = selected.id();
    if (!cmPendingEdgeSource) {
      selected.addClass('selected-source');
      cmPendingEdgeSource = nodeId;
    } else if (cmPendingEdgeSource !== nodeId) {
      const pos = selected.renderedPosition();
      showEdgePopup(cmPendingEdgeSource, nodeId, pos);
    }
  }
}

// ── Context menu ──────────────────────────────
function showContextMenu(items, renderedPos) {
  const menu = document.getElementById('cm-context-menu');
  const itemsEl = document.getElementById('cm-context-menu-items');
  itemsEl.innerHTML = '';

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'cm-context-menu-item' + (item.danger ? ' danger' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', () => { hideContextMenu(); item.action(); });
    itemsEl.appendChild(btn);
  });

  const canvasEl = document.getElementById('cm-canvas');
  const menuW = 180;
  const menuH = items.length * 36 + 4;
  let left = renderedPos.x + 6;
  let top  = renderedPos.y + 6;
  left = Math.min(left, canvasEl.offsetWidth  - menuW - 8);
  top  = Math.min(top,  canvasEl.offsetHeight - menuH - 8);
  left = Math.max(left, 4);
  top  = Math.max(top,  4);

  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';
  menu.classList.add('visible');
  menu.setAttribute('aria-hidden', 'false');
}

function hideContextMenu() {
  const menu = document.getElementById('cm-context-menu');
  if (!menu) return;
  menu.classList.remove('visible');
  menu.setAttribute('aria-hidden', 'true');
  cmContextTarget = null;
}

// ── Remove individual elements ────────────────
function cmRemoveNode(nodeId) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node.length) return;

  // Un-dim the palette entry so the node can be re-added
  const locId = node.data('location_id');
  if (locId) {
    const nameEl = document.getElementById('palette-name-' + locId);
    if (nameEl) nameEl.classList.remove('on-map');
  }

  node.remove(); // cytoscape also removes connected edges
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

function cmRemoveEdge(edgeId) {
  if (!cy) return;
  cy.getElementById(edgeId).remove();
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

// ── Clear entire canvas ───────────────────────
function cmClearAll() {
  if (!cy || cy.elements().length === 0) return;
  if (!confirm('Remove all nodes and connections from this concept map?')) return;

  // Un-dim every palette entry
  cy.nodes().forEach(node => {
    const locId = node.data('location_id');
    if (locId) {
      const nameEl = document.getElementById('palette-name-' + locId);
      if (nameEl) nameEl.classList.remove('on-map');
    }
  });

  cy.elements().remove();
  clearSourceSelection();
  hideEdgePopup();
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

// ── Helpers ───────────────────────────────────
function setStatus(msg) {
  document.getElementById('cm-status').textContent = msg;
}

// ── Public API ────────────────────────────────
window.openConceptMap = openConceptMap;
