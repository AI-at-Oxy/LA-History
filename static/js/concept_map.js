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
let cmUndoStack = [];             // undo/redo stacks
let cmRedoStack = [];
let cmCustomNodes = [];           // user-created custom nodes [{ id, label }]
let _previewSvg = null;          // ghost edge preview line

// ── CM Chat state ──────────────────────────────
let cmChatLoading = false;
let cmChatGreetingSent = false;

// ── Insight token state ────────────────────────
let cmInsightUsesRemaining = 3;

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
        // Restore custom nodes sidebar from saved graph
        cmCustomNodes = [];
        cy.nodes().forEach(n => {
          if (n.data('custom')) {
            cmCustomNodes.push({ id: n.id(), label: n.data('label') });
          }
        });
        renderCustomNodeList();
        // Sync palette dim state so nodes already on the canvas are marked
        // correctly (cy.json restore doesn't reliably fire 'add' events)
        syncPaletteDimState();
      } catch (_) { /* stale/corrupt data — start fresh */ }
    }

    cmSubmitted = !!(cmEraData.concept_map && cmEraData.concept_map.submitted);
    cmInsightUsesRemaining = cmEraData.concept_map ? (cmEraData.concept_map.insight_uses ?? 3) : 3;
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
    updateInsightButton();
    setStatus('');

    if (!cmSubmitted) {
      cmAutoSaveTimer = setInterval(autoSave, 30000);
      setTimeout(cmChatGreeting, 900);
      // Show concept map tutorial on first open
      if (typeof Tutorial !== 'undefined') {
        setTimeout(function () { Tutorial.startConceptMap(); }, 800);
      }
    }
  });
}

// ── Cytoscape init ────────────────────────────
function initCytoscape() {
  if (cy) {
    cy.destroy();
    cy = null;
  }

  const isDark = document.documentElement.classList.contains('dark');
  const edgeColor      = isDark ? '#6b5d48' : '#c4a97a';
  const edgeLabelBg    = isDark ? '#1e1a14' : '#fdf8f0';
  const edgeLabelColor = isDark ? '#c8b898' : '#5a4232';

  cy = cytoscape({
    container: document.getElementById('cm-canvas'),
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'background-opacity': 0.92,
          'label': 'data(shortLabel)',
          'color': '#fff',
          'text-wrap': 'wrap',
          'text-max-width': '96px',
          'font-size': '11.5px',
          'font-weight': '600',
          'font-family': 'DM Sans, system-ui, sans-serif',
          'width': 'label',
          'height': 'label',
          'padding': '11px 14px',
          'shape': 'round-rectangle',
          'text-valign': 'center',
          'text-halign': 'center',
          'border-width': 2,
          'border-color': 'data(borderColor)',
          'border-opacity': 0.6,
          'min-width': 70,
          'min-height': 38,
          'shadow-blur': 12,
          'shadow-color': 'data(color)',
          'shadow-opacity': 0.35,
          'shadow-offset-x': 0,
          'shadow-offset-y': 3,
          'text-outline-width': 0,
          'overlay-opacity': 0,
          'transition-property': 'border-width, border-color, shadow-opacity',
          'transition-duration': '0.15s',
        },
      },
      {
        selector: 'node[?cross_era]',
        style: {
          'border-style': 'dashed',
          'border-color': '#a09070',
          'border-opacity': 0.7,
          'background-opacity': 0.72,
        },
      },
      {
        selector: 'node[?custom]',
        style: {
          'border-style': 'dotted',
          'border-width': 2.5,
          'border-color': '#a070d0',
          'border-opacity': 0.9,
          'background-color': '#7c4daf',
          'shadow-color': '#7c4daf',
        },
      },
      {
        selector: 'node.selected-source',
        style: {
          'border-color': '#f0c040',
          'border-width': 3,
          'border-opacity': 1,
          'shadow-color': '#d4a843',
          'shadow-opacity': 0.6,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#b8731a',
          'border-width': 3,
          'border-opacity': 1,
          'shadow-color': '#b8731a',
          'shadow-opacity': 0.55,
        },
      },
      {
        selector: 'node:active',
        style: {
          'overlay-opacity': 0.06,
          'overlay-color': '#fff',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 2.5,
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'arrow-scale': 1.1,
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10.5px',
          'font-weight': '500',
          'font-family': 'DM Sans, system-ui, sans-serif',
          'color': edgeLabelColor,
          'text-background-color': edgeLabelBg,
          'text-background-opacity': 1,
          'text-background-padding': '4px',
          'text-background-shape': 'round-rectangle',
          'text-border-opacity': 0,
          'edge-text-rotation': 'autorotate',
          'overlay-opacity': 0,
          'transition-property': 'line-color, target-arrow-color, width',
          'transition-duration': '0.15s',
        },
      },
      {
        selector: 'edge[?cross_era]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [8, 4],
          'line-color': isDark ? '#5a4e3c' : '#b0a080',
          'target-arrow-color': isDark ? '#5a4e3c' : '#b0a080',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#b8731a',
          'target-arrow-color': '#b8731a',
          'width': 3,
        },
      },
      {
        selector: 'edge:active',
        style: {
          'overlay-opacity': 0,
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

  // ── right-click node → same as left-click (no-op here, handled by tap)
  cy.on('cxttap', 'node', function(evt) {
    if (cmSubmitted) return;
    // Handled by left-click tap below
  });


  // ── tap node → show options popup, or complete edge if one is pending
  cy.on('tap', 'node', function(evt) {
    if (cmSubmitted) return;
    const node = evt.target;
    const nodeId = node.id();

    if (!cmPendingEdgeSource) {
      // Show options popup on left click
      showContextMenu([
        {
          label: '🔗 Start connection from here',
          action() {
            cy.nodes().removeClass('selected-source');
            node.addClass('selected-source');
            cmPendingEdgeSource = nodeId;
            showPreviewLine();
          },
        },
        {
          label: '🗑️ Remove from map',
          danger: true,
          action() { cmRemoveNode(nodeId); },
        },
      ], evt.renderedPosition);
    } else if (cmPendingEdgeSource === nodeId) {
      hideContextMenu();
      clearSourceSelection();
    } else {
      hideContextMenu();
      showEdgePopup(cmPendingEdgeSource, nodeId, evt.renderedPosition);
    }
  });

  // ── single tap edge → edit label or delete
  cy.on('tap', 'edge', function(evt) {
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

  // ── Sidebar auto-sync on every node add/remove ───────────────────────────
  cy.on('add remove', 'node', syncPaletteDimState);

  // ── Edge highlight on node hover
  cy.on('mouseover', 'node', function(evt) {
    evt.target.connectedEdges().style({
      'line-color': '#d4a843',
      'target-arrow-color': '#d4a843',
      'width': 3.5,
    });
  });
  cy.on('mouseout', 'node', function(evt) {
    const dark = document.documentElement.classList.contains('dark');
    const col  = dark ? '#6b5d48' : '#c4a97a';
    evt.target.connectedEdges().style({
      'line-color': col,
      'target-arrow-color': col,
      'width': 2.5,
    });
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

  list.innerHTML = visitedLocs.map(loc => {
    const dotColor = typeof eraColor === 'function' ? eraColor(loc.era) : '#888';
    return `
    <div class="cm-palette-item" id="palette-item-${loc.id}">
      <span class="cm-palette-dot" style="background:${dotColor}"></span>
      <span class="cm-palette-item-name" id="palette-name-${loc.id}"
            title="${loc.name}">${loc.name}</span>
      <button class="cm-btn cm-btn-secondary cm-palette-add-btn"
              data-loc-id="${loc.id}"
              onclick="cmAddNode(${JSON.stringify(loc).replace(/"/g, '&quot;')})">+</button>
    </div>
  `}).join('');
}

// ── Find a free position that doesn't overlap existing nodes ─────────────
function cmFindFreePosition() {
  const nodes = cy.nodes();

  if (nodes.length === 0) return { x: 0, y: 0 };

  const NODE_W = 140;   // conservative node width estimate (graph coords)
  const NODE_H = 60;    // conservative node height estimate
  const GAP    = 24;    // minimum gap between node edges

  // Collect bounding boxes of all placed nodes
  const bboxes = nodes.map(n => n.boundingBox());

  function overlaps(x, y) {
    const hw = (NODE_W + GAP) / 2;
    const hh = (NODE_H + GAP) / 2;
    return bboxes.some(bb =>
      x + hw > bb.x1 - GAP && x - hw < bb.x2 + GAP &&
      y + hh > bb.y1 - GAP && y - hh < bb.y2 + GAP
    );
  }

  const ext  = cy.extent();
  const vw   = ext.x2 - ext.x1;
  const vh   = ext.y2 - ext.y1;

  // 1) Try a regular grid across the current viewport
  const cols = Math.max(4, Math.ceil(vw / (NODE_W + GAP)));
  const rows = Math.max(4, Math.ceil(vh / (NODE_H + GAP)));
  const candidates = [];

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = ext.x1 + (c / cols) * vw;
      const y = ext.y1 + (r / rows) * vh;
      if (!overlaps(x, y)) candidates.push({ x, y });
    }
  }

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 2) No clear spot inside viewport — spiral outward from the graph centre
  const cx = (ext.x1 + ext.x2) / 2;
  const cy2 = (ext.y1 + ext.y2) / 2;
  const radius = Math.max(vw, vh) * 0.6;

  for (let attempt = 0; attempt < 60; attempt++) {
    const angle = (attempt / 60) * 2 * Math.PI;
    const dist  = radius + attempt * (NODE_W + GAP) * 0.25;
    const x = cx + Math.cos(angle) * dist;
    const y = cy2 + Math.sin(angle) * dist;
    if (!overlaps(x, y)) return { x, y };
  }

  // 3) Absolute fallback — place to the right of the rightmost node
  const rightmost = Math.max(...bboxes.map(bb => bb.x2));
  return { x: rightmost + NODE_W + GAP, y: cy2 };
}

function cmAddNode(locData) {
  const nodeId = 'loc-' + locData.id;
  if (cy.getElementById(nodeId).length > 0) {
    // Node already on canvas — flash it instead of duplicating
    const existing = cy.getElementById(nodeId);
    existing.flashClass('selected-source', 600);
    return;
  }

  const pos = cmFindFreePosition();

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

  // Node entrance animation: scale in from 0
  const newNode = cy.getElementById(nodeId);
  newNode.style({ 'width': 4, 'height': 4, 'opacity': 0 });
  newNode.animate(
    { style: { 'width': 64, 'height': 32, 'opacity': 1 } },
    {
      duration: 280,
      easing: 'spring(400, 20)',
      complete: function() {
        newNode.style({ 'width': 'label', 'height': 'label' });
        // Always fit so a node placed outside the current viewport is revealed
        cy.animate({ fit: { padding: 40 }, duration: 350, easing: 'ease-out' });
      },
    },
  );

  if (typeof SFX !== 'undefined') SFX.play('node-add');

  // Push to undo stack
  cmUndoStack.push({ type: 'add-node', nodeId, nodeData: { data: { ...newNode.data() }, position: { ...pos } } });
  cmRedoStack = [];

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

    const edgeData = {
      source: sourceId,
      target: targetId,
      label,
      cross_era: isCrossEra,
    };
    const addedEdge = cy.add({ group: 'edges', data: edgeData });
    const edgeId = addedEdge.id();

    // Push to undo stack + play sound
    cmUndoStack.push({ type: 'add-edge', edgeId, edgeData });
    cmRedoStack = [];
    if (typeof SFX !== 'undefined') SFX.play('edge-create');
  }

  clearSourceSelection();
  hideEdgePopup();
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();

  // Contextual tutor nudge after 1st and 3rd edge (key construction milestones)
  if (!cmEditingEdgeId) {
    const edgeCount = cy ? cy.edges().length : 0;
    if (edgeCount === 1 || edgeCount === 3) cmChatContextualNudge();
  }
}

function clearSourceSelection() {
  cy && cy.nodes().removeClass('selected-source');
  cmPendingEdgeSource = null;
  removePreviewLine();
}

// ── Concept Map Tutor Chat ────────────────────

function cmChatScrollToBottom() {
  const el = document.getElementById('cm-chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function cmChatAppendMessage(role, content, animate = true) {
  const container = document.getElementById('cm-chat-messages');
  if (!container) return;
  const intro = container.querySelector('.chat-intro');
  if (intro) intro.remove();

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  if (!animate) div.style.animation = 'none';
  div.innerHTML = `
    <div class="chat-bubble">${escapeHtml(content)}</div>
    <div class="chat-msg-time">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
  `;
  container.appendChild(div);
  cmChatScrollToBottom();
}

function cmChatShowTyping() {
  const container = document.getElementById('cm-chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'chat-typing';
  div.id = 'cm-chat-typing';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  container.appendChild(div);
  cmChatScrollToBottom();
}

function cmChatRemoveTyping() {
  const el = document.getElementById('cm-chat-typing');
  if (el) el.remove();
}

async function cmSendChatMessage() {
  if (cmChatLoading || !cmEraOrder) return;
  const input = document.getElementById('cm-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  cmChatAppendMessage('user', text);
  cmChatShowTyping();
  cmChatLoading = true;
  const sendBtn = document.getElementById('cm-chat-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const data = await apiFetch(
      '/api/concept_map/' + cmEraOrder + '/chat', 'POST', {
        message: text,
        graph_json: cy ? cy.json() : null,
        era_name: cmEraData ? cmEraData.era_name : '',
      }
    );
    cmChatRemoveTyping();
    cmChatAppendMessage('assistant', data.reply);
    if (typeof SFX !== 'undefined') SFX.play('chat-receive');
  } catch (e) {
    cmChatRemoveTyping();
    const container = document.getElementById('cm-chat-messages');
    if (container) {
      const err = document.createElement('div');
      err.className = 'chat-error';
      err.textContent = (e && e.message) || 'Could not reach the tutor. Is Ollama running?';
      container.appendChild(err);
      cmChatScrollToBottom();
    }
  } finally {
    cmChatLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

async function cmChatGreeting() {
  if (cmChatGreetingSent || !cmEraOrder || cmSubmitted) return;
  cmChatGreetingSent = true;
  cmChatShowTyping();
  try {
    const data = await apiFetch(
      '/api/concept_map/' + cmEraOrder + '/chat', 'POST', {
        message: '__greeting__',
        graph_json: cy ? cy.json() : null,
        era_name: cmEraData ? cmEraData.era_name : '',
      }
    );
    cmChatRemoveTyping();
    cmChatAppendMessage('assistant', data.reply, true);
  } catch (_) {
    cmChatRemoveTyping();
    // Silent fail — greeting is not critical
  }
}

async function cmChatContextualNudge() {
  if (cmChatLoading || !cmEraOrder || cmSubmitted || !cy) return;
  const edges = cy.edges();
  if (edges.length === 0) return;

  const lastEdge = edges[edges.length - 1];
  const label = lastEdge.data('label') || '(unlabeled)';
  const srcNode = cy.getElementById(lastEdge.data('source'));
  const tgtNode = cy.getElementById(lastEdge.data('target'));
  const src = (srcNode && srcNode.data('label')) || lastEdge.data('source');
  const tgt = (tgtNode && tgtNode.data('label')) || lastEdge.data('target');
  const syntheticMsg = `I just connected "${src}" to "${tgt}" with the label "${label}".`;

  cmChatShowTyping();
  cmChatLoading = true;
  try {
    const data = await apiFetch(
      '/api/concept_map/' + cmEraOrder + '/chat', 'POST', {
        message: syntheticMsg,
        graph_json: cy.json(),
        era_name: cmEraData ? cmEraData.era_name : '',
      }
    );
    cmChatRemoveTyping();
    cmChatAppendMessage('assistant', data.reply);
  } catch (_) {
    cmChatRemoveTyping();
  } finally {
    cmChatLoading = false;
  }
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
  document.getElementById('cm-tour-btn').addEventListener('click', function () {
    if (typeof Tutorial !== 'undefined') Tutorial.replayConceptMap();
  });

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

  // Custom node dialog
  document.getElementById('cm-add-custom-node-btn').addEventListener('click', openCustomNodeDialog);
  document.getElementById('cm-custom-node-close').addEventListener('click', closeCustomNodeDialog);
  document.getElementById('cm-custom-node-cancel').addEventListener('click', closeCustomNodeDialog);
  document.getElementById('cm-custom-node-confirm').addEventListener('click', confirmCustomNode);
  document.getElementById('cm-custom-node-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') confirmCustomNode();
    if (e.key === 'Escape') closeCustomNodeDialog();
  });

  // Canvas keyboard nav
  const canvas = document.getElementById('cm-canvas');
  canvas.addEventListener('keydown', handleCanvasKeydown);

  // Zoom to fit button
  document.getElementById('cm-fit-btn').addEventListener('click', () => {
    if (!cy) return;
    cy.animate({ fit: { padding: 40 }, duration: 400, easing: 'ease-out' });
    if (typeof SFX !== 'undefined') SFX.play('hover');
  });

  // Auto-layout button — compact spacing
  document.getElementById('cm-layout-btn').addEventListener('click', () => {
    if (!cy || cmSubmitted) return;
    cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 600,
      animationEasing: 'ease-out-cubic',
      nodeRepulsion: 1200,
      idealEdgeLength: 50,
      nodeOverlap: 10,
      gravity: 80,
      numIter: 1000,
      randomize: false,
      fit: true,
      padding: 30,
    }).run();
    if (typeof SFX !== 'undefined') SFX.play('panel-close');
    scheduleAutoSave();
  });

  // Zoom in / out buttons
  document.getElementById('cm-zoom-in-btn').addEventListener('click', () => {
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    if (typeof SFX !== 'undefined') SFX.play('hover');
  });
  document.getElementById('cm-zoom-out-btn').addEventListener('click', () => {
    if (!cy) return;
    cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    if (typeof SFX !== 'undefined') SFX.play('hover');
  });

  // Undo/Redo keyboard shortcuts
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('cm-overlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoLastAction(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoLastAction(); }
  });

  // ── CM Tutor Chat event listeners ──
  document.getElementById('cm-chat-send-btn').addEventListener('click', cmSendChatMessage);

  document.getElementById('cm-chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cmSendChatMessage(); }
  });

  document.getElementById('cm-chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  document.getElementById('cm-chat-clear-btn').addEventListener('click', e => {
    e.stopPropagation();
    const container = document.getElementById('cm-chat-messages');
    if (container) {
      container.innerHTML = `
        <div class="chat-intro">
          <div class="chat-intro-icon">🎓</div>
          <strong>Socratic Tutor</strong>
          History cleared. Ask a question to continue.
        </div>`;
    }
  });
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
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2200);
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

  score.textContent = s + '/100';

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
  const addCustomBtn = document.getElementById('cm-add-custom-node-btn');
  if (addCustomBtn) addCustomBtn.disabled = true;
  const addCrossEraBtn = document.getElementById('cm-add-cross-era-btn');
  if (addCrossEraBtn) addCrossEraBtn.disabled = true;
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

function updateEdgeCount() { updateGraphStats(); }

function updateGraphStats() {
  const nodeCount = cy ? cy.nodes().length : 0;
  const edgeCount = cy ? cy.edges().length : 0;
  const el = document.getElementById('cm-graph-stats');
  if (el) el.textContent =
    `${nodeCount} node${nodeCount !== 1 ? 's' : ''} · ${edgeCount} connection${edgeCount !== 1 ? 's' : ''}`;

  // Toggle empty state hint
  const emptyState = document.getElementById('cm-empty-state');
  if (emptyState) {
    emptyState.classList.toggle('hidden', nodeCount > 0);
  }
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
        <button class="cm-btn cm-btn-secondary cm-picker-add-btn"
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

// ── Custom node dialog ────────────────────────
function openCustomNodeDialog() {
  if (cmSubmitted) return;
  const dialog = document.getElementById('cm-custom-node-dialog');
  dialog.classList.add('visible');
  dialog.setAttribute('aria-hidden', 'false');
  const input = document.getElementById('cm-custom-node-input');
  input.value = '';
  input.focus();
}

function closeCustomNodeDialog() {
  const dialog = document.getElementById('cm-custom-node-dialog');
  dialog.classList.remove('visible');
  dialog.setAttribute('aria-hidden', 'true');
  document.getElementById('cm-custom-node-input').value = '';
}

function confirmCustomNode() {
  const label = document.getElementById('cm-custom-node-input').value.trim();
  if (!label) {
    document.getElementById('cm-custom-node-input').focus();
    return;
  }
  closeCustomNodeDialog();
  cmAddCustomNode(label);
}

function cmAddCustomNode(label) {
  const nodeId = 'custom-' + Date.now();
  const shortLabel = label.length > 22 ? label.slice(0, 21) + '…' : label;
  const pos = cmFindFreePosition();

  cy.add({
    group: 'nodes',
    data: {
      id: nodeId,
      label,
      shortLabel,
      color: '#7c4daf',
      borderColor: '#a070d0',
      custom: true,
    },
    position: pos,
  });

  const newNode = cy.getElementById(nodeId);
  newNode.style({ 'width': 4, 'height': 4, 'opacity': 0 });
  newNode.animate(
    { style: { 'width': 64, 'height': 32, 'opacity': 1 } },
    {
      duration: 280,
      easing: 'spring(400, 20)',
      complete: function() {
        newNode.style({ 'width': 'label', 'height': 'label' });
        cy.animate({ fit: { padding: 40 }, duration: 350, easing: 'ease-out' });
      },
    },
  );

  if (typeof SFX !== 'undefined') SFX.play('node-add');

  cmUndoStack.push({ type: 'add-node', nodeId, nodeData: { data: { ...newNode.data() }, position: { ...pos } } });
  cmRedoStack = [];

  // Track in cmCustomNodes and update the sidebar list
  cmCustomNodes.push({ id: nodeId, label });
  renderCustomNodeList();

  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

function renderCustomNodeList() {
  const list = document.getElementById('cm-custom-node-list');
  if (!list) return;
  if (cmCustomNodes.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = cmCustomNodes.map(n => {
    const onMap = cy && cy.getElementById(n.id).length > 0;
    return `<div class="cm-custom-palette-item">
      <span class="cm-custom-palette-dot"></span>
      <span class="cm-custom-palette-name ${onMap ? 'on-map' : ''}" title="${n.label}">${n.label}</span>
      <button class="cm-btn cm-btn-secondary cm-palette-add-btn"
              onclick="cmReAddCustomNode(${JSON.stringify(n.id)}, ${JSON.stringify(n.label)})">+</button>
    </div>`;
  }).join('');
}

function cmReAddCustomNode(nodeId, label) {
  if (cy.getElementById(nodeId).length > 0) {
    cy.getElementById(nodeId).flashClass('selected-source', 600);
    return;
  }
  // Node was removed — re-add it with the same id so undo etc. still work
  const shortLabel = label.length > 22 ? label.slice(0, 21) + '…' : label;
  const pos = cmFindFreePosition();
  cy.add({
    group: 'nodes',
    data: { id: nodeId, label, shortLabel, color: '#7c4daf', borderColor: '#a070d0', custom: true },
    position: pos,
  });
  const n = cy.getElementById(nodeId);
  n.style({ 'width': 4, 'height': 4, 'opacity': 0 });
  n.animate({ style: { 'width': 64, 'height': 32, 'opacity': 1 } }, {
    duration: 280,
    easing: 'spring(400, 20)',
    complete() { n.style({ 'width': 'label', 'height': 'label' }); },
  });
  if (typeof SFX !== 'undefined') SFX.play('node-add');
  renderCustomNodeList();
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}
window.cmReAddCustomNode = cmReAddCustomNode;

// ── Insight token button ──────────────────────
function updateInsightButton() {
  const btn = document.getElementById('cm-insight-btn');
  const usesSpan = document.getElementById('cm-insight-uses');
  if (!btn) return;
  if (cmSubmitted || cmInsightUsesRemaining <= 0) {
    btn.style.display = 'none';
  } else {
    btn.style.display = '';
    if (usesSpan) usesSpan.textContent = cmInsightUsesRemaining;
    btn.disabled = false;
  }
}

async function requestInsight() {
  if (cmChatLoading || !cmEraOrder || cmSubmitted) return;
  const btn = document.getElementById('cm-insight-btn');
  if (btn) btn.disabled = true;

  cmChatAppendMessage('user', '[AI Insight requested — 15 pts]');
  cmChatShowTyping();
  cmChatLoading = true;

  try {
    const result = await apiFetch('/api/concept_map/' + cmEraOrder + '/insight', 'POST', {});
    cmChatRemoveTyping();
    cmChatAppendMessage('assistant', result.insight);
    cmInsightUsesRemaining = result.uses_remaining;
    updatePointsDisplay(result.total_points);
    updateInsightButton();
    showToast(`−15 pts — AI Insight used. ${result.uses_remaining} remaining.`, 'info');
    if (typeof SFX !== 'undefined') SFX.play('chat-receive');
  } catch (e) {
    cmChatRemoveTyping();
    if (btn) btn.disabled = false;
    const msg = (e && e.message) || 'Could not get insight.';
    if (msg.toLowerCase().includes('not enough') || msg.includes('402')) {
      showToast('Not enough points for an AI Insight.', 'error');
    } else {
      showToast(msg, 'error');
    }
  } finally {
    cmChatLoading = false;
  }
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
  cmUndoStack = [];
  cmRedoStack = [];
  cmCustomNodes = [];
  cmChatGreetingSent = false;
  cmChatLoading = false;
  cmInsightUsesRemaining = 3;
  removePreviewLine();

  // Reset results panel for next open
  document.getElementById('cm-results-panel').hidden = true;
  document.getElementById('cm-results-body').innerHTML = '';
  document.getElementById('cm-status').textContent = '';
  document.getElementById('cm-palette-list').innerHTML = '';
  const customNodeList = document.getElementById('cm-custom-node-list');
  if (customNodeList) customNodeList.innerHTML = '';

  // Reset chat panel
  const chatContainer = document.getElementById('cm-chat-messages');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="chat-intro">
        <div class="chat-intro-icon">🎓</div>
        <strong>Socratic Tutor</strong>
        I'll guide your thinking as you build. Add a connection and I'll ask about it.
      </div>`;
  }
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

  // Capture connected edges for undo
  const removedEdges = node.connectedEdges().map(e => ({ edgeId: e.id(), edgeData: { ...e.data() } }));
  const nodeData = { data: { ...node.data() }, position: { ...node.position() } };

  // Un-dim the palette entry so the node can be re-added
  const locId = node.data('location_id');
  if (locId) {
    const nameEl = document.getElementById('palette-name-' + locId);
    if (nameEl) nameEl.classList.remove('on-map');
  }

  node.remove(); // cytoscape also removes connected edges
  cmUndoStack.push({ type: 'remove-node', nodeId, nodeData, removedEdges });
  cmRedoStack = [];

  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

function cmRemoveEdge(edgeId) {
  if (!cy) return;
  const edge = cy.getElementById(edgeId);
  if (!edge.length) return;
  const edgeData = { ...edge.data() };
  edge.remove();
  cmUndoStack.push({ type: 'remove-edge', edgeId, edgeData });
  cmRedoStack = [];
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

// ── Undo / Redo ───────────────────────────────
function undoLastAction() {
  if (!cy || cmSubmitted || cmUndoStack.length === 0) return;
  const cmd = cmUndoStack.pop();
  if (cmd.type === 'add-node') {
    const node = cy.getElementById(cmd.nodeId);
    if (node.length) {
      const locId = node.data('location_id');
      if (locId) {
        const nameEl = document.getElementById('palette-name-' + locId);
        if (nameEl) nameEl.classList.remove('on-map');
      }
      node.remove();
    }
    cmRedoStack.push(cmd);
  } else if (cmd.type === 'remove-node') {
    cy.add({ group: 'nodes', data: cmd.nodeData.data, position: cmd.nodeData.position });
    // Re-add connected edges whose endpoints still exist
    cmd.removedEdges.forEach(({ edgeData }) => {
      if (cy.getElementById(edgeData.source).length && cy.getElementById(edgeData.target).length) {
        cy.add({ group: 'edges', data: edgeData });
      }
    });
    const locId = cmd.nodeData.data.location_id;
    if (locId) {
      const nameEl = document.getElementById('palette-name-' + locId);
      if (nameEl) nameEl.classList.add('on-map');
    }
    cmRedoStack.push(cmd);
  } else if (cmd.type === 'add-edge') {
    const edge = cy.getElementById(cmd.edgeId);
    if (edge.length) edge.remove();
    cmRedoStack.push(cmd);
  } else if (cmd.type === 'remove-edge') {
    const src = cy.getElementById(cmd.edgeData.source);
    const tgt = cy.getElementById(cmd.edgeData.target);
    if (src.length && tgt.length) cy.add({ group: 'edges', data: cmd.edgeData });
    cmRedoStack.push(cmd);
  }
  if (typeof SFX !== 'undefined') SFX.play('undo');
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

function redoLastAction() {
  if (!cy || cmSubmitted || cmRedoStack.length === 0) return;
  const cmd = cmRedoStack.pop();
  if (cmd.type === 'add-node') {
    cy.add({ group: 'nodes', data: cmd.nodeData.data, position: cmd.nodeData.position });
    const locId = cmd.nodeData.data.location_id;
    if (locId) {
      const nameEl = document.getElementById('palette-name-' + locId);
      if (nameEl) nameEl.classList.add('on-map');
    }
    cmUndoStack.push(cmd);
  } else if (cmd.type === 'remove-node') {
    const node = cy.getElementById(cmd.nodeId);
    if (node.length) {
      const locId = node.data('location_id');
      if (locId) {
        const nameEl = document.getElementById('palette-name-' + locId);
        if (nameEl) nameEl.classList.remove('on-map');
      }
      node.remove();
    }
    cmUndoStack.push(cmd);
  } else if (cmd.type === 'add-edge') {
    const src = cy.getElementById(cmd.edgeData.source);
    const tgt = cy.getElementById(cmd.edgeData.target);
    if (src.length && tgt.length) cy.add({ group: 'edges', data: cmd.edgeData });
    cmUndoStack.push(cmd);
  } else if (cmd.type === 'remove-edge') {
    const edge = cy.getElementById(cmd.edgeId);
    if (edge.length) edge.remove();
    cmUndoStack.push(cmd);
  }
  if (typeof SFX !== 'undefined') SFX.play('hover');
  updateEdgeCount();
  updateSubmitButton();
  scheduleAutoSave();
}

// ── Connection preview line (ghost edge while drawing) ────
function showPreviewLine() {
  if (_previewSvg || !cy) return;
  const canvasArea = document.querySelector('.cm-canvas-area');
  if (!canvasArea) return;
  _previewSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  _previewSvg.id = 'cm-preview-svg';
  _previewSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;');
  _previewSvg.innerHTML = '<line id="cm-preview-line" stroke="#d4a843" stroke-width="2" stroke-dasharray="6,4" opacity="0.7" x1="0" y1="0" x2="0" y2="0"/>';
  canvasArea.appendChild(_previewSvg);
  document.getElementById('cm-canvas').addEventListener('mousemove', _updatePreviewLine);
}

function _updatePreviewLine(e) {
  const line = document.getElementById('cm-preview-line');
  if (!line || !cmPendingEdgeSource || !cy) return;
  const sourceNode = cy.getElementById(cmPendingEdgeSource);
  if (!sourceNode.length) return;
  const rp = sourceNode.renderedPosition();
  const rect = document.getElementById('cm-canvas').getBoundingClientRect();
  line.setAttribute('x1', rp.x);
  line.setAttribute('y1', rp.y);
  line.setAttribute('x2', e.clientX - rect.left);
  line.setAttribute('y2', e.clientY - rect.top);
}

function removePreviewLine() {
  if (_previewSvg) { _previewSvg.remove(); _previewSvg = null; }
  const canvas = document.getElementById('cm-canvas');
  if (canvas) canvas.removeEventListener('mousemove', _updatePreviewLine);
}

// ── Sidebar sync ──────────────────────────────
// Re-derive which nodes are actually on the canvas and update all sidebar
// indicators so they always reflect truth regardless of how nodes changed.
function syncPaletteDimState() {
  if (!cy) return;

  // Location palette: toggle .on-map on the name span
  const paletteItems = document.querySelectorAll('[id^="palette-name-"]');
  paletteItems.forEach(el => {
    const locId = el.id.replace('palette-name-', '');
    el.classList.toggle('on-map', cy.getElementById('loc-' + locId).length > 0);
  });

  // Custom node list: rebuild so the .on-map class and re-add button are correct
  renderCustomNodeList();
}

// ── Helpers ───────────────────────────────────
function setStatus(msg) {
  document.getElementById('cm-status').textContent = msg;
}

// ── Public API ────────────────────────────────
window.openConceptMap = openConceptMap;
