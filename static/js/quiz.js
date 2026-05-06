/* =========================================
   LA History — Quiz Modal
   ========================================= */

let currentQuiz = null;
let currentQuizLocationId = null;
let currentAnswers = {};
let currentQuestionIndex = 0;
let quizSubmitted = false;

// Hint state
let hintsUsed = {};          // { question_id: true }
let hintLoadingId = null;    // question_id currently awaiting hint
let quizAlreadyPassed = false;
let currentFeedback = {};   // { question_id: { is_correct, explanation, chosen_text } }
let questionChecked = false; // whether current question's answer has been confirmed

const overlay  = () => document.getElementById('quiz-modal-overlay');
const modal    = () => document.getElementById('quiz-modal');

async function openQuiz(locationId, alreadyPassed = false) {
  currentQuizLocationId = locationId;
  currentAnswers = {};
  currentQuestionIndex = 0;
  quizSubmitted = false;
  hintsUsed = {};
  hintLoadingId = null;
  quizAlreadyPassed = alreadyPassed;
  currentFeedback = {};
  questionChecked = false;

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

  // Hint button — hidden for already-passed quizzes
  let hintBtnHTML = '';
  if (!quizAlreadyPassed) {
    if (hintsUsed[q.id]) {
      hintBtnHTML = `<button class="quiz-hint-btn hint-used" disabled>Hint Used ✓</button>`;
    } else {
      hintBtnHTML = `<button class="quiz-hint-btn" id="hint-btn-${q.id}" onclick="requestHint(${q.id})">Use Hint (5 pts)</button>`;
    }
  }

  // Hint penalty footer
  const totalHints = Object.keys(hintsUsed).length;
  const hintFooterHTML = totalHints > 0
    ? `<span class="quiz-hint-footer">Hints used: ${totalHints} (−${totalHints * 5} pts from reward)</span>`
    : '';

  const challengeNote = `<p>Pass with ${currentQuiz.passing_score}% · ${currentQuiz.points_reward} pts on first pass</p>`;

  modal().innerHTML = `
    <div class="quiz-header">
      <div class="quiz-header-left">
        <h2>${currentQuiz.title}</h2>
        ${challengeNote}
      </div>
      <button class="quiz-close" onclick="closeQuiz()">×</button>
    </div>
    <div class="quiz-progress-bar">
      <div class="quiz-progress-fill" id="quiz-prog" style="width:${pct}%"></div>
    </div>
    <div class="quiz-body">
      <div class="quiz-question-counter">Question ${currentQuestionIndex + 1} of ${total}</div>
      <div class="quiz-question-text">${q.question_text}</div>
      ${hintBtnHTML}
      <div class="quiz-options" id="quiz-options">
        ${options}
      </div>
      <div id="quiz-explanation"></div>
    </div>
    <div class="quiz-footer">
      ${hintFooterHTML}
      <button class="btn btn-primary" id="quiz-next-btn" onclick="advanceQuiz()" disabled>
        ${currentQuestionIndex < total - 1 ? 'Next Question →' : 'Submit Quiz'}
      </button>
    </div>
  `;

  // Re-attach option click handlers
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => selectOption(btn, q));
  });

  // Restore selection if already answered (e.g. after hint re-render)
  const savedAnswer = currentAnswers[q.id];
  if (savedAnswer) {
    const savedBtn = document.querySelector(`.quiz-option[data-value="${savedAnswer}"]`);
    if (savedBtn) {
      savedBtn.classList.add('selected');
      const nextBtn = document.getElementById('quiz-next-btn');
      if (nextBtn) nextBtn.disabled = false;
    }
  }

  // Restore wrong-answer feedback if Phase 1 already happened for this question
  if (questionChecked && currentFeedback[q.id] && !currentFeedback[q.id].is_correct) {
    const explEl = document.getElementById('quiz-explanation');
    const nextBtn = document.getElementById('quiz-next-btn');
    const optionsEl = document.getElementById('quiz-options');
    if (optionsEl) optionsEl.classList.add('locked');
    if (explEl) {
      explEl.innerHTML = `<div class="quiz-feedback-wrong"><strong>Not quite.</strong> ${escapeHtml(currentFeedback[q.id].explanation)}</div>`;
    }
    if (nextBtn) {
      nextBtn.textContent = currentQuestionIndex < currentQuiz.questions.length - 1 ? 'Continue →' : 'Continue to Results';
    }
  }
}

function buildOptions(q) {
  if (q.question_type === 'true_false') {
    return ['True', 'False'].map((label, i) => {
      const val = i === 0 ? 'a' : 'b';
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
  if (questionChecked) return; // locked after answer was checked
  document.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  btn.classList.add('just-selected');
  btn.addEventListener('animationend', () => btn.classList.remove('just-selected'), { once: true });
  if (typeof SFX !== 'undefined') SFX.play('hover');
  currentAnswers[q.id] = btn.dataset.value;
  document.getElementById('quiz-next-btn').disabled = false;
}

async function requestHint(questionId) {
  if (hintLoadingId) return;
  hintLoadingId = questionId;

  const btn = document.getElementById(`hint-btn-${questionId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Loading hint…'; }

  try {
    const result = await apiFetch(
      `/api/quiz/${currentQuizLocationId}/hint`,
      'POST',
      { question_id: questionId }
    );
    hintsUsed[questionId] = true;
    updatePointsDisplay(result.total_points);
    if (typeof SFX !== 'undefined') SFX.play('hint-reveal');
    showToast('−5 pts — Hint revealed.', 'info');

    // Inject hint text into explanation area before re-render
    const expl = document.getElementById('quiz-explanation');
    if (expl) {
      expl.innerHTML = `<div class="quiz-hint-text"><strong>Hint:</strong> ${escapeHtml(result.hint)}</div>`;
    }

    // Re-render question to show "Hint Used ✓" button state and updated footer
    renderQuizQuestion();

    // Show hint again after re-render (renderQuizQuestion clears #quiz-explanation)
    const explAfter = document.getElementById('quiz-explanation');
    if (explAfter) {
      explAfter.innerHTML = `<div class="quiz-hint-text"><strong>Hint:</strong> ${escapeHtml(result.hint)}</div>`;
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Use Hint (5 pts)'; }
    const msg = (e && e.message) || '';
    if (msg.includes('402') || msg.toLowerCase().includes('enough points') || msg.toLowerCase().includes('not enough')) {
      showToast('Not enough points for a hint.', 'error');
    } else {
      showToast(msg || 'Could not load hint.', 'error');
    }
  } finally {
    hintLoadingId = null;
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

async function advanceQuiz() {
  const total = currentQuiz.questions.length;
  const q = currentQuiz.questions[currentQuestionIndex];

  if (!questionChecked) {
    // Phase 1: check the answer for immediate feedback
    const optionsEl = document.getElementById('quiz-options');
    if (optionsEl) optionsEl.classList.add('locked');
    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Checking…'; }

    let result;
    try {
      result = await apiFetch('/api/quiz/check_answer', 'POST', {
        question_id: q.id,
        chosen_answer: currentAnswers[q.id]
      });
    } catch (e) {
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = currentQuestionIndex < total - 1 ? 'Next Question →' : 'Submit Quiz';
      }
      showToast(e.message || 'Could not check answer.', 'error');
      return;
    }

    currentFeedback[q.id] = {
      is_correct: result.is_correct,
      explanation: result.explanation,
      chosen_text: getOptionText(q, currentAnswers[q.id])
    };

    const explEl = document.getElementById('quiz-explanation');
    if (result.is_correct) {
      if (explEl) explEl.innerHTML = `<div class="quiz-feedback-correct">✓ Correct!</div>`;
      if (nextBtn) nextBtn.disabled = true;
      setTimeout(() => _doAdvance(total), 1500);
    } else {
      if (explEl) {
        const text = result.explanation || 'Review the location description for more context.';
        explEl.innerHTML = `<div class="quiz-feedback-wrong"><strong>Not quite.</strong> ${escapeHtml(text)}</div>`;
      }
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = currentQuestionIndex < total - 1 ? 'Continue →' : 'Continue to Results';
      }
      questionChecked = true;
    }
  } else {
    // Phase 2: actually advance (only reached after wrong-answer feedback)
    questionChecked = false;
    _doAdvance(total);
  }
}

function _doAdvance(total) {
  if (currentQuestionIndex < total - 1) {
    currentQuestionIndex++;
    renderQuizQuestion();
  } else {
    submitQuiz();
  }
}

function getOptionText(q, answer) {
  if (!answer) return '—';
  if (q.question_type === 'true_false') return answer === 'a' ? 'True' : 'False';
  return q[`option_${answer}`] || answer.toUpperCase();
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
    result = await apiFetch(
      `/api/quiz/${currentQuizLocationId}/submit`,
      'POST',
      { answers, hints_used: Object.keys(hintsUsed).length }
    );
  } catch (e) {
    showToast(e.message || 'Submit failed.', 'error');
    return;
  }

  renderResults(result);

  if (result.points_earned > 0) {
    updatePointsDisplay(result.total_points);
    showToast(`+${result.points_earned} points earned!`, 'points');
  }

  if (result.passed && window.refreshDetailPanel) {
    window.refreshDetailPanel(currentQuizLocationId);
  }

  if (result.newly_unlocked && result.newly_unlocked.length > 0) {
    setTimeout(() => {
      if (typeof SFX !== 'undefined') SFX.play('era-unlock');
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
  const pct = result.score_percent ?? result.score_pct;

  const unlockHTML = result.newly_unlocked && result.newly_unlocked.length > 0 ? `
    <div class="results-unlock-notice">
      <strong>🔓 New era unlocked!</strong>
      New historical locations are now available on the map.
    </div>
  ` : '';

  const hintsCount = Object.keys(hintsUsed).length;
  const hintPenaltyHTML = hintsCount > 0
    ? `<div class="results-hint-penalty">${hintsCount} hint${hintsCount > 1 ? 's' : ''} used (−${hintsCount * 5} pts from reward)</div>`
    : '';

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
        ${hintPenaltyHTML}
        ${unlockHTML}
        <div class="results-actions">
          <button class="btn btn-secondary" onclick="closeQuiz()">Close</button>
          ${!passed ? `<button class="btn btn-primary" onclick="retryQuiz()">Try Again</button>` : ''}
        </div>
        ${buildRecapHTML()}
      </div>
    </div>
  `;

  // Trigger results pop animation
  const resultsEl = modal().querySelector('.quiz-results');
  if (resultsEl) resultsEl.classList.add('animate');
}

function retryQuiz() {
  const id = currentQuizLocationId;
  hintsUsed = {};
  hintLoadingId = null;
  currentFeedback = {};
  questionChecked = false;
  closeQuiz();
  setTimeout(() => openQuiz(id, false), 200);
}

function buildRecapHTML() {
  const questions = currentQuiz.questions;
  if (!questions || questions.length === 0) return '';
  const items = questions.map((q, i) => {
    const fb = currentFeedback[q.id];
    if (!fb) return '';
    const icon = fb.is_correct ? '✓' : '✗';
    const cls  = fb.is_correct ? 'recap-correct' : 'recap-wrong';
    return `
      <div class="recap-item ${cls}">
        <span class="recap-icon">${icon}</span>
        <div class="recap-content">
          <div class="recap-question">Q${i + 1}: ${escapeHtml(q.question_text)}</div>
          <div class="recap-answer">You answered: ${escapeHtml(fb.chosen_text)}</div>
          ${!fb.is_correct ? `<div class="recap-explanation">${escapeHtml(fb.explanation)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
  return `
    <div class="quiz-recap">
      <div class="recap-header">Question Recap</div>
      ${items}
    </div>`;
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
