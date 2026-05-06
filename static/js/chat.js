/* =========================================
   LA History — Chat Panel
   ========================================= */

let chatLocationId = null;
let chatOpen = false;
let chatLoading = false;

function openChat(locationId, locationName) {
  chatLocationId = locationId;
  const panel = document.getElementById('chat-panel');
  const label = document.getElementById('chat-location-label');
  if (label) label.textContent = locationName || '';

  panel.classList.add('open');
  chatOpen = true;

  loadChatHistory(locationId);
  document.getElementById('chat-input').focus();
}

function toggleChat() {
  if (typeof SFX !== 'undefined') SFX.play('chat-toggle');
  const panel = document.getElementById('chat-panel');
  chatOpen = !chatOpen;
  panel.classList.toggle('open', chatOpen);
  const btn = document.getElementById('chat-toggle-btn');
  if (btn) btn.textContent = chatOpen ? '▼' : '▲';
  try { localStorage.setItem('chat_panel_open', chatOpen ? '1' : '0'); } catch (e) {}
}

async function loadChatHistory(locationId) {
  if (!locationId) return;
  try {
    const data = await apiFetch(`/api/chat/history/${locationId}`);
    const messages = document.getElementById('chat-messages');
    if (data.messages.length === 0) {
      messages.innerHTML = `
        <div class="chat-intro">
          <div class="chat-intro-icon">🎓</div>
          <strong>Socratic Tutor</strong>
          Ask a question about this location — I'll guide you with questions rather than answers.
        </div>`;
    } else {
      messages.innerHTML = '';
      data.messages.forEach(m => appendMessage(m.role, m.content, false));
      scrollToBottom();
    }
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }
}

async function sendChatMessage() {
  if (chatLoading) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  if (typeof SFX !== 'undefined') SFX.play('chat-send');
  appendMessage('user', text);
  showTyping();
  chatLoading = true;
  document.getElementById('chat-send-btn').disabled = true;

  let bubbleEl = null;
  let fullReply = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
      body: JSON.stringify({ message: text, location_id: chatLocationId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        let msg;
        try { msg = JSON.parse(raw); } catch { continue; }

        if (msg.error) {
          removeTyping();
          showChatError(msg.error);
          streamDone = true;
          break;
        }
        if (msg.token) {
          if (!bubbleEl) {
            removeTyping();
            if (typeof SFX !== 'undefined') SFX.play('chat-receive');
            bubbleEl = appendStreamingBubble();
          }
          fullReply += msg.token;
          bubbleEl.innerHTML = escapeHtml(fullReply);
          scrollToBottom();
        }
        if (msg.done) {
          streamDone = true;
          break;
        }
      }
    }

    // After stream: attach TTS button with full reply
    if (bubbleEl && fullReply && TTS.isSupported()) {
      const outerDiv = bubbleEl.parentElement;
      const ttsBtn = document.createElement('button');
      ttsBtn.className = 'chat-tts-btn';
      ttsBtn.title = 'Read aloud';
      ttsBtn.textContent = '🔊';
      const captured = fullReply;
      ttsBtn.addEventListener('click', () => chatTTSToggle(ttsBtn, captured));
      outerDiv.insertBefore(ttsBtn, outerDiv.querySelector('.chat-msg-time'));
    }
  } catch (e) {
    removeTyping();
    showChatError(e.message || 'Could not reach the tutor. Is Ollama running?');
  } finally {
    chatLoading = false;
    document.getElementById('chat-send-btn').disabled = false;
    input.focus();
  }
}

function appendStreamingBubble() {
  const container = document.getElementById('chat-messages');
  const intro = container.querySelector('.chat-intro');
  if (intro) intro.remove();

  const div = document.createElement('div');
  div.className = 'chat-msg assistant';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  div.appendChild(bubble);
  const time = document.createElement('div');
  time.className = 'chat-msg-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.appendChild(time);
  container.appendChild(div);
  scrollToBottom();
  return bubble;
}

function appendMessage(role, content, animate = true) {
  const container = document.getElementById('chat-messages');
  // Remove intro if present
  const intro = container.querySelector('.chat-intro');
  if (intro) intro.remove();

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-bubble">${escapeHtml(content)}</div>
    ${role === 'assistant' && TTS.isSupported() ? '<button class="chat-tts-btn" title="Read aloud">🔊</button>' : ''}
    <div class="chat-msg-time">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
  `;
  if (role === 'assistant' && TTS.isSupported()) {
    const btn = div.querySelector('.chat-tts-btn');
    btn.addEventListener('click', () => chatTTSToggle(btn, content));
  }
  container.appendChild(div);
  scrollToBottom();
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-typing';
  div.id = 'chat-typing';
  div.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function removeTyping() {
  const el = document.getElementById('chat-typing');
  if (el) el.remove();
}

function showChatError(msg) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-error';
  div.textContent = msg;
  container.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

async function clearChatHistory() {
  if (!confirm('Clear your conversation history?')) return;
  if (typeof SFX !== 'undefined') SFX.play('clear-chat');
  try {
    await apiFetch('/api/chat/history', 'DELETE');
    chatLocationId = null;
    const messages = document.getElementById('chat-messages');
    messages.innerHTML = `
      <div class="chat-intro">
        <div class="chat-intro-icon">🎓</div>
        <strong>Socratic Tutor</strong>
        History cleared. Ask a question to start fresh.
      </div>`;
  } catch (e) {
    showToast('Could not clear history.', 'error');
  }
}

function chatTTSToggle(btn, content) {
  if (TTS.isSpeaking()) {
    TTS.stop();
    btn.textContent = '🔊';
    btn.classList.remove('active');
    return;
  }
  // Reset any other active TTS buttons
  document.querySelectorAll('.chat-tts-btn').forEach(b => { b.textContent = '🔊'; b.classList.remove('active'); });
  TTS.speak(content);
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

document.addEventListener('DOMContentLoaded', () => {
  // Restore chat session and panel state after page navigation
  (async () => {
    try {
      const data = await apiFetch('/api/chat/history');
      if (!data.messages || data.messages.length === 0) return;
      const messages = document.getElementById('chat-messages');
      messages.innerHTML = '';
      data.messages.forEach(m => appendMessage(m.role, m.content, false));
      scrollToBottom();
      const wasOpen = localStorage.getItem('chat_panel_open') === '1';
      if (wasOpen) {
        const panel = document.getElementById('chat-panel');
        panel.classList.add('open');
        chatOpen = true;
      }
    } catch (e) { console.error('Failed to restore chat history:', e); }
  })();

  // Header toggle
  document.getElementById('chat-panel-header').addEventListener('click', e => {
    if (e.target.closest('.chat-panel-actions')) return;
    toggleChat();
  });

  // Toggle btn
  document.getElementById('chat-toggle-btn').addEventListener('click', toggleChat);

  // Clear btn
  document.getElementById('chat-clear-btn').addEventListener('click', e => {
    e.stopPropagation();
    clearChatHistory();
  });

  // Send btn
  document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);

  // Enter to send (Shift+Enter for newline)
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Auto-resize textarea
  document.getElementById('chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
});
