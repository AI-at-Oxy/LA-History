/* =========================================
   LA History — Quiz Modal
   ========================================= */

let currentQuiz = null;
let currentQuizLocationId = null;
let currentAnswers = {};
let currentQuestionIndex = 0;
let quizSubmitted = false;

const overlay  = () => document.getElementById('quiz-modal-overlay');
const modal    = () => document.getElementById('quiz-modal');

async function openQuiz(locationId) {
  currentQuizLocationId = locationId;
  currentAnswers = {};
  currentQuestionIndex = 0;
  quizSubmitted = false;

  try {
    currentQuiz = await apiFetch(`/api/quiz/${locationId}`);
  } catch (e) {
    showToast(e.message || 'Could not load quiz.', 'error');
    return;
  }

  renderQuizQuestion();
  overlay().classList.add('open');
  if (typeof SFX !== 'undefined') SFX.play('quiz-open');
}

function closeQuiz() {
  if (typeof SFX !== 'undefined') SFX.play('panel-close');
  overlay().classList.remove('open');
  TTS.stop();
}

function renderQuizQuestion() {
  const q = currentQuiz.questions[currentQuestionIndex];
  const total = currentQuiz.questions.length;
  const pct = Math.round(((currentQuestionIndex) / total) * 100);

  const options = buildOptions(q);

  modal().innerHTML = `
    <div class="quiz-header">
      <div class="quiz-header-left">
        <h2>${currentQuiz.title}</h2>
        <p>Pass with ${currentQuiz.passing_score}% · ${currentQuiz.points_reward} pts on first pass</p>
      </div>
      <button class="quiz-close" onclick="closeQuiz()">×</button>
    </div>
    <div class="quiz-progress-bar">
      <div class="quiz-progress-fill" id="quiz-prog" style="width:${pct}%"></div>
    </div>
    <div class="quiz-body">
      <div class="quiz-question-counter">Question ${currentQuestionIndex + 1} of ${total}</div>
      <div class="quiz-question-text">${q.question_text}</div>
      <div class="quiz-options" id="quiz-options">
        ${options}
      </div>
      <div id="quiz-explanation"></div>
    </div>
    <div class="quiz-footer">
      <button class="btn btn-primary" id="quiz-next-btn" onclick="advanceQuiz()" disabled>
        ${currentQuestionIndex < total - 1 ? 'Next Question →' : 'Submit Quiz'}
      </button>
    </div>
  `;

  // Re-attach option click handlers
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => selectOption(btn, q));
  });
}

function buildOptions(q) {
  if (q.question_type === 'true_false') {
    return ['True', 'False'].map((label, i) => {
      const val = i === 0 ? 't' : 'f';
      return optionHTML(val, label.charAt(0), label);
    }).join('');
  }
  return ['a', 'b', 'c', 'd']
    .filter(k => q[`option_${k}`])
    .map(k => optionHTML(k, k, q[`option_${k}`]))
    .join('');
}

function optionHTML(value, letter, text) {
  const selected = currentAnswers[currentQuiz.questions[currentQuestionIndex].id] === value;
  return `
    <button class="quiz-option ${selected ? 'selected' : ''}" data-value="${value}">
      <span class="option-letter">${letter.toUpperCase()}</span>
      ${text}
    </button>
  `;
}

function selectOption(btn, q) {
  if (quizSubmitted) return;
  document.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  btn.classList.add('just-selected');
  btn.addEventListener('animationend', () => btn.classList.remove('just-selected'), { once: true });
  if (typeof SFX !== 'undefined') SFX.play('hover');
  currentAnswers[q.id] = btn.dataset.value;
  document.getElementById('quiz-next-btn').disabled = false;
}

function advanceQuiz() {
  const total = currentQuiz.questions.length;

  if (currentQuestionIndex < total - 1) {
    currentQuestionIndex++;
    renderQuizQuestion();
    // Restore selection if already answered
    const q = currentQuiz.questions[currentQuestionIndex];
    const saved = currentAnswers[q.id];
    if (saved) {
      const btn = document.querySelector(`.quiz-option[data-value="${saved}"]`);
      if (btn) {
        btn.classList.add('selected');
        document.getElementById('quiz-next-btn').disabled = false;
      }
    }
  } else {
    submitQuiz();
  }
}

async function submitQuiz() {
  quizSubmitted = true;
  const answers = {};
  currentQuiz.questions.forEach(q => {
    if (currentAnswers[q.id] !== undefined) {
      answers[String(q.id)] = currentAnswers[q.id];
    }
  });

  let result;
  try {
    result = await apiFetch(`/api/quiz/${currentQuizLocationId}/submit`, 'POST', { answers });
  } catch (e) {
    showToast(e.message || 'Submit failed.', 'error');
    return;
  }

  renderResults(result);

  if (result.points_earned > 0) {
    updatePointsDisplay(result.total_points);
    showToast(`+${result.points_earned} points earned!`, 'points');
  }

  if (result.newly_unlocked && result.newly_unlocked.length > 0) {
    setTimeout(() => {
      showToast(`🔓 New locations unlocked! Explore the map.`, 'unlock', 5000);
      if (window.refreshMapMarkers) window.refreshMapMarkers();
    }, 1500);
  }

  if (result.new_badges && result.new_badges.length > 0) {
    handleNewBadges(result.new_badges);
  } else {
    loadProgress();
  }
}

function renderResults(result) {
  if (typeof SFX !== 'undefined') SFX.play(result.passed ? 'quiz-success' : 'quiz-error');

  const passed = result.passed;
  const pct = result.score_percent;

  const unlockHTML = result.newly_unlocked && result.newly_unlocked.length > 0 ? `
    <div class="results-unlock-notice">
      <strong>🔓 New era unlocked!</strong>
      New historical locations are now available on the map.
    </div>
  ` : '';

  modal().innerHTML = `
    <div class="quiz-header">
      <div class="quiz-header-left">
        <h2>${currentQuiz.title}</h2>
        <p>Results</p>
      </div>
      <button class="quiz-close" onclick="closeQuiz()">×</button>
    </div>
    <div class="quiz-progress-bar">
      <div class="quiz-progress-fill" style="width:100%;background:${passed ? 'var(--success)' : 'var(--danger)'}"></div>
    </div>
    <div class="quiz-body">
      <div class="quiz-results">
        <div class="results-score ${passed ? 'pass' : 'fail'}">${pct}%</div>
        <div class="results-label ${passed ? 'pass' : 'fail'}">${passed ? '✓ Passed!' : '✗ Not quite'}</div>
        <div class="results-detail">${result.correct_count} of ${result.total_questions} correct</div>
        ${result.points_earned > 0 ? `<div class="results-points">✦ +${result.points_earned} points</div>` : ''}
        ${unlockHTML}
        <div class="results-actions">
          <button class="btn btn-secondary" onclick="closeQuiz()">Close</button>
          ${!passed ? `<button class="btn btn-primary" onclick="retryQuiz()">Try Again</button>` : ''}
        </div>
      </div>
    </div>
  `;

  // Trigger results pop animation
  const resultsEl = modal().querySelector('.quiz-results');
  if (resultsEl) resultsEl.classList.add('animate');
}

function retryQuiz() {
  const id = currentQuizLocationId;
  closeQuiz();
  setTimeout(() => openQuiz(id), 200);
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', () => {
  const ov = overlay();
  if (ov) {
    ov.addEventListener('click', e => {
      if (e.target === ov) closeQuiz();
    });
  }
});
