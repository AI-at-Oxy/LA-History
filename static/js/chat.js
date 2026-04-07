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
  const panel = document.getElementById('chat-panel');
  chatOpen = !chatOpen;
  panel.classList.toggle('open', chatOpen);
  const btn = document.getElementById('chat-toggle-btn');
  if (btn) btn.textContent = chatOpen ? '▼' : '▲';
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
  appendMessage('user', text);
  showTyping();
  chatLoading = true;
  document.getElementById('chat-send-btn').disabled = true;

  try {
    const data = await apiFetch('/api/chat', 'POST', {
      message: text,
      location_id: chatLocationId,
    });
    removeTyping();
    appendMessage('assistant', data.reply);
  } catch (e) {
    removeTyping();
    showChatError(e.message || 'Could not reach the tutor. Is Ollama running?');
  } finally {
    chatLoading = false;
    document.getElementById('chat-send-btn').disabled = false;
    input.focus();
  }
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
  if (!chatLocationId) return;
  if (!confirm('Clear your conversation history for this location?')) return;
  try {
    await apiFetch(`/api/chat/history/${chatLocationId}`, 'DELETE');
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
