// MLN111 Quiz Application Logic

// --- STATE MANAGEMENT ---
let state = {
  currentTab: 'dashboard', // 'dashboard', 'c0', 'c1', 'c2', 'c3', 'bookmarks'
  currentIndex: 0,        // index of current question in active list
  activeQuestions: [],    // filtered list of questions for current tab
  userAnswers: {},        // q_id -> array of chosen options (e.g. ['A'])
  bookmarks: [],          // array of q_id
  mode: 'practice',       // 'practice' or 'exam'
  theme: 'dark',          // 'dark' or 'light'
  searchQuery: '',
  filterStatus: 'all',    // 'all', 'unanswered', 'correct', 'incorrect', 'bookmarked'
  examSubmitted: {},      // chapter_name -> boolean (if true, exam is graded)
  checkedQuestions: {}    // q_id -> boolean (if true, multi-select is checked in practice mode)
};

// --- CONSTANTS ---
const TAB_MAP = {
  'c0': 'Đề cương ôn tập chung',
  'c1': 'Chương 1',
  'c2': 'Chương 2',
  'c3': 'Chương 3'
};

// --- LOCAL STORAGE UTILITIES ---
function loadStateFromStorage() {
  const storedTheme = localStorage.getItem('mln_theme');
  if (storedTheme) state.theme = storedTheme;
  
  const storedMode = localStorage.getItem('mln_mode');
  if (storedMode) state.mode = storedMode;
  
  const storedAnswers = localStorage.getItem('mln_answers');
  if (storedAnswers) {
    const parsed = JSON.parse(storedAnswers);
    // Backward compatibility: migrate legacy string answers to arrays
    for (let key in parsed) {
      if (typeof parsed[key] === 'string') {
        parsed[key] = [parsed[key]];
      }
    }
    state.userAnswers = parsed;
  }
  
  const storedBookmarks = localStorage.getItem('mln_bookmarks');
  if (storedBookmarks) state.bookmarks = JSON.parse(storedBookmarks);
  
  const storedExamSubmitted = localStorage.getItem('mln_exam_submitted');
  if (storedExamSubmitted) state.examSubmitted = JSON.parse(storedExamSubmitted);

  const storedChecked = localStorage.getItem('mln_checked');
  if (storedChecked) {
    state.checkedQuestions = JSON.parse(storedChecked);
  } else {
    state.checkedQuestions = {};
  }
}

function saveStateToStorage() {
  localStorage.setItem('mln_theme', state.theme);
  localStorage.setItem('mln_mode', state.mode);
  localStorage.setItem('mln_answers', JSON.stringify(state.userAnswers));
  localStorage.setItem('mln_bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem('mln_exam_submitted', JSON.stringify(state.examSubmitted));
  localStorage.setItem('mln_checked', JSON.stringify(state.checkedQuestions));
}

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  applyTheme();
  initEventListeners();
  switchTab(state.currentTab);
  showToast('Đã tải dữ liệu ôn tập thành công!');
});

// --- THEME UTILITY ---
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.innerHTML = state.theme === 'dark' 
      ? '<span class="icon">☀️</span> Chế độ Sáng' 
      : '<span class="icon">🌙</span> Chế độ Tối';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveStateToStorage();
}

// --- NAVIGATION & TABS ---
function initEventListeners() {
  // Sidebar Tab Clicks
  const navButtons = document.querySelectorAll('.nav-item[data-tab]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Theme Toggle Button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
}

function switchTab(tabId) {
  state.currentTab = tabId;
  state.currentIndex = 0;
  state.searchQuery = '';
  state.filterStatus = 'all';
  
  // Update UI nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Clear search input UI
  const searchInput = document.getElementById('search-questions');
  if (searchInput) searchInput.value = '';

  // Setup active question list
  updateActiveQuestions();
  
  // Render Tab Content
  renderContent();
}

// Filter and prepare active questions based on current tab and filters
function updateActiveQuestions() {
  let list = [];
  
  if (state.currentTab === 'dashboard') {
    state.activeQuestions = [];
    return;
  }
  
  if (state.currentTab === 'bookmarks') {
    list = MLN_QUESTIONS.filter(q => state.bookmarks.includes(q.id));
  } else {
    // It's a chapter tab
    const chapterName = TAB_MAP[state.currentTab];
    list = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
  }

  // Apply search query
  if (state.searchQuery.trim().length > 0) {
    const qLower = state.searchQuery.toLowerCase();
    list = list.filter(q => 
      q.question.toLowerCase().includes(qLower) || 
      q.options.some(opt => opt.toLowerCase().includes(qLower))
    );
  }

  // Apply status filter
  if (state.filterStatus !== 'all') {
    list = list.filter(q => {
      const answers = state.userAnswers[q.id] || [];
      const hasAnswered = answers.length > 0;
      
      const isCorrect = hasAnswered && 
        answers.every(ans => q.correctAnswers.includes(ans)) && 
        q.correctAnswers.every(ans => answers.includes(ans));
        
      const isBookmarked = state.bookmarks.includes(q.id);

      if (state.filterStatus === 'unanswered') return !hasAnswered;
      if (state.filterStatus === 'correct') return isCorrect;
      if (state.filterStatus === 'incorrect') return hasAnswered && !isCorrect;
      if (state.filterStatus === 'bookmarked') return isBookmarked;
      return true;
    });
  }

  state.activeQuestions = list;
}

// --- RENDER CONTENT ---
function renderContent() {
  const container = document.getElementById('main-content-area');
  if (!container) return;

  if (state.currentTab === 'dashboard') {
    renderDashboard(container);
  } else {
    renderQuizView(container);
  }
}

// --- DASHBOARD RENDER ---
function renderDashboard(container) {
  // Statistics Calculations
  const totalQs = MLN_QUESTIONS.length;
  const answeredIds = Object.keys(state.userAnswers).filter(id => state.userAnswers[id] && state.userAnswers[id].length > 0);
  const totalAnswered = answeredIds.length;
  
  let totalCorrect = 0;
  MLN_QUESTIONS.forEach(q => {
    const answers = state.userAnswers[q.id] || [];
    const hasAnswered = answers.length > 0;
    const isCorrect = hasAnswered && 
      answers.every(ans => q.correctAnswers.includes(ans)) && 
      q.correctAnswers.every(ans => answers.includes(ans));
      
    if (isCorrect) {
      totalCorrect++;
    }
  });
  
  const totalIncorrect = totalAnswered - totalCorrect;
  const overallPercentage = totalQs > 0 ? Math.round((totalAnswered / totalQs) * 100) : 0;
  const correctPercentage = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Render Dashboard HTML
  let html = `
    <div class="dashboard-view">
      <div class="stats-card-large glass">
        <div class="welcome-info">
          <h3>Hệ thống Ôn thi MLN111</h3>
          <p>Dựa trên Đề cương ôn thi Triết học Mác - Lênin. Hệ thống tự động chia các câu hỏi có 1 đáp án và câu hỏi có nhiều đáp án (2 đáp án trở lên), lưu trữ tiến độ trên trình duyệt của bạn.</p>
          <div style="display: flex; gap: 12px;">
            <button class="action-btn primary" onclick="switchTab('c0')">Bắt đầu Ôn ngay</button>
            <button class="action-btn secondary" onclick="switchTab('bookmarks')">⭐ Xem câu đã lưu (${state.bookmarks.length})</button>
          </div>
        </div>
        <div class="chart-container">
          <svg viewBox="0 0 36 36" class="circular-chart">
            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="circle-fill" stroke-dasharray="${overallPercentage}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="chart-percentage">
            ${overallPercentage}%
            <span>Đã làm</span>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="summary-card glass">
          <div class="card-icon total">📚</div>
          <div class="card-info">
            <span class="value">${totalQs}</span>
            <span class="label">Tổng số câu hỏi</span>
          </div>
        </div>
        <div class="summary-card glass">
          <div class="card-icon correct">✅</div>
          <div class="card-info">
            <span class="value">${totalCorrect}</span>
            <span class="label">Số câu đúng (${correctPercentage}%)</span>
          </div>
        </div>
        <div class="summary-card glass">
          <div class="card-icon incorrect">❌</div>
          <div class="card-info">
            <span class="value">${totalIncorrect}</span>
            <span class="label">Số câu sai</span>
          </div>
        </div>
        <div class="summary-card glass">
          <div class="card-icon progress">⭐</div>
          <div class="card-info">
            <span class="value">${state.bookmarks.length}</span>
            <span class="label">Đã đánh dấu</span>
          </div>
        </div>
      </div>

      <h3 style="margin-bottom: 16px;">Danh mục Chương học</h3>
      <div class="chapter-cards-grid">
  `;

  // Render cards for each chapter
  const chapters = [
    { id: 'c0', name: 'Đề cương ôn tập chung', subtitle: 'Toàn bộ câu hỏi tổng hợp' },
    { id: 'c1', name: 'Chương 1: Khái luận triết học', subtitle: 'Lịch sử và đại cương triết học' },
    { id: 'c2', name: 'Chương 2: Chủ nghĩa duy vật biện chứng', subtitle: 'Vật chất, ý thức và phép biện chứng' },
    { id: 'c3', name: 'Chương 3: Chủ nghĩa duy vật lịch sử', subtitle: 'Hình thái kinh tế xã hội, nhà nước, xã hội' }
  ];

  chapters.forEach(ch => {
    // Count stats for this chapter
    const chapterName = ch.id === 'c0' ? 'Đề cương ôn tập chung' : ch.name.split(':')[0];
    const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
    const chTotal = chQuestions.length;
    
    let chAnswered = 0;
    chQuestions.forEach(q => {
      const answers = state.userAnswers[q.id] || [];
      if (answers.length > 0) chAnswered++;
    });
    
    const pct = chTotal > 0 ? Math.round((chAnswered / chTotal) * 100) : 0;

    html += `
      <div class="chapter-select-card glass" onclick="switchTab('${ch.id}')">
        <h4>${ch.name}</h4>
        <p>${ch.subtitle}</p>
        <div class="chapter-card-meta">
          <span class="q-count">${chTotal} câu hỏi</span>
          <span class="progress-text">${chAnswered}/${chTotal} câu (${pct}%)</span>
        </div>
        <div class="chapter-mini-progress">
          <div class="chapter-mini-progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div class="danger-zone-card glass">
        <div class="danger-info">
          <h4>Vùng nguy hiểm</h4>
          <p>Hành động này sẽ xóa toàn bộ lịch sử làm bài, điểm số và các câu hỏi đã lưu trên trình duyệt này.</p>
        </div>
        <button class="grid-reset-btn" onclick="resetAllProgress()">Xoá hết tiến trình</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// --- QUIZ VIEW RENDER ---
function renderQuizView(container) {
  const tabName = state.currentTab === 'bookmarks' ? 'Câu hỏi đã đánh dấu' : TAB_MAP[state.currentTab];
  
  let html = `
    <div class="quiz-grid-layout">
      <!-- Quiz Main Area -->
      <div class="quiz-main">
        <!-- Progress Bar at top of quiz -->
        <div class="progress-bar-container glass" style="padding: 20px;">
          <div class="progress-info">
            <span>Tiến độ chương:</span>
            <span id="progress-percentage-text">0% (0/0 câu)</span>
          </div>
          <div class="progress-track">
            <div id="progress-bar-fill" class="progress-fill"></div>
          </div>
        </div>

        <!-- Question Card -->
        <div id="question-card-placeholder">
          <!-- Dynamically populated -->
        </div>

        <!-- Navigation Buttons -->
        <div class="navigation-buttons">
          <button class="action-btn secondary" id="prev-question-btn">⬅️ Câu trước</button>
          <div id="exam-action-area"></div>
          <button class="action-btn primary" id="next-question-btn">Câu sau ➡️</button>
        </div>
      </div>

      <!-- Question Navigation Sidebar -->
      <div class="quiz-nav-sidebar glass" style="padding: 24px;">
        <div class="nav-grid-header">
          <h3>Bản đồ Câu hỏi</h3>
          <button class="grid-reset-btn" id="reset-chapter-btn">Làm lại</button>
        </div>
        
        <div class="nav-circles-container" id="nav-circles-grid">
          <!-- Dynamically populated -->
        </div>

        <div class="grid-legend">
          <div class="legend-item">
            <div class="legend-dot unanswered"></div>
            <span>Chưa làm</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot correct"></div>
            <span>Làm đúng</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot incorrect"></div>
            <span>Làm sai</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot bookmarked"></div>
            <span>Đã đánh dấu (Lưu)</span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind Quiz View Sub-components Event Listeners
  document.getElementById('prev-question-btn').addEventListener('click', prevQuestion);
  document.getElementById('next-question-btn').addEventListener('click', nextQuestion);
  document.getElementById('reset-chapter-btn').addEventListener('click', resetChapterProgress);

  // Set up filter states in app header if we are inside a chapter
  setupHeaderControls();
  
  // Render active question
  renderActiveQuestion();
}

function setupHeaderControls() {
  const headerActions = document.getElementById('header-actions-area');
  if (!headerActions) return;

  // Controls include Search input, Filters (All, Unanswered, Correct, Incorrect, Saved), and Mode toggle
  const isBookmarkedTab = state.currentTab === 'bookmarks';
  
  let html = `
    <div class="quiz-controls">
      <div class="controls-left">
        <!-- Search bar -->
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="search-questions" class="search-input" placeholder="Tìm kiếm câu hỏi..." value="${state.searchQuery}">
        </div>

        <!-- Filter tabs -->
        <div class="filter-tabs">
          <button class="filter-btn ${state.filterStatus === 'all' ? 'active' : ''}" onclick="setFilterStatus('all')">Tất cả</button>
          <button class="filter-btn ${state.filterStatus === 'unanswered' ? 'active' : ''}" onclick="setFilterStatus('unanswered')">Chưa làm</button>
          ${!isBookmarkedTab ? `
            <button class="filter-btn ${state.filterStatus === 'correct' ? 'active' : ''}" onclick="setFilterStatus('correct')">Đúng</button>
            <button class="filter-btn ${state.filterStatus === 'incorrect' ? 'active' : ''}" onclick="setFilterStatus('incorrect')">Sai</button>
          ` : ''}
          <button class="filter-btn ${state.filterStatus === 'bookmarked' ? 'active' : ''}" onclick="setFilterStatus('bookmarked')">Đã đánh dấu</button>
        </div>
      </div>

      <div class="controls-right">
        <!-- Mode toggles -->
        <div class="mode-toggle">
          <button class="mode-btn ${state.mode === 'practice' ? 'active' : ''}" onclick="setMode('practice')">🕹️ Luyện tập</button>
          <button class="mode-btn ${state.mode === 'exam' ? 'active' : ''}" onclick="setMode('exam')">📝 Thi thử</button>
        </div>
      </div>
    </div>
  `;

  headerActions.innerHTML = html;

  // Search input event
  const searchInput = document.getElementById('search-questions');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      updateActiveQuestions();
      state.currentIndex = 0;
      renderActiveQuestion();
    });
  }
}

// --- FILTERS & MODES SETTERS ---
window.setFilterStatus = function(status) {
  state.filterStatus = status;
  setupHeaderControls();
  updateActiveQuestions();
  state.currentIndex = 0;
  renderActiveQuestion();
};

window.setMode = function(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  setupHeaderControls();
  renderActiveQuestion();
  showToast(`Đã chuyển sang chế độ ${mode === 'practice' ? 'Luyện tập (Xem đáp án ngay)' : 'Thi thử (Không xem đáp án ngay)'}`);
};

// --- RENDER ACTIVE QUESTION CARD ---
function renderActiveQuestion() {
  const qCardPlaceholder = document.getElementById('question-card-placeholder');
  const circlesGrid = document.getElementById('nav-circles-grid');
  
  if (!qCardPlaceholder) return;

  // Update progress bar
  updateProgressBar();

  // If no questions match filters
  if (state.activeQuestions.length === 0) {
    qCardPlaceholder.innerHTML = `
      <div class="question-card glass" style="text-align: center; padding: 48px;">
        <p style="color: var(--text-secondary); font-size: 16px; margin-bottom: 12px;">Không tìm thấy câu hỏi nào phù hợp với bộ lọc.</p>
        <button class="action-btn secondary" onclick="setFilterStatus('all')" style="margin: 0 auto;">Xoá bộ lọc</button>
      </div>
    `;
    if (circlesGrid) circlesGrid.innerHTML = '';
    return;
  }

  // Ensure index is in bounds
  if (state.currentIndex >= state.activeQuestions.length) {
    state.currentIndex = 0;
  } else if (state.currentIndex < 0) {
    state.currentIndex = state.activeQuestions.length - 1;
  }

  const q = state.activeQuestions[state.currentIndex];
  const qIndexInChapter = state.activeQuestions.indexOf(q) + 1;
  const isBookmarked = state.bookmarks.includes(q.id);
  const selectedAnswers = state.userAnswers[q.id] || [];
  const hasAnswered = selectedAnswers.length > 0;
  
  const isMultiSelect = q.correctAnswers.length > 1;
  const isChecked = state.checkedQuestions[q.id] === true;

  // Chapter name or exam grading state
  const chapterName = q.chapter;
  const isSubmitted = state.examSubmitted[chapterName] === true;

  // Build options HTML
  let optionsHtml = '';
  q.options.forEach(optionText => {
    const optionPrefix = optionText.substring(0, 1); // 'A', 'B', 'C', 'D'
    const optionCleanText = optionText.substring(3); // option text content
    
    let optionClass = '';
    let disabledClass = '';
    
    const isSelected = selectedAnswers.includes(optionPrefix);

    if (isMultiSelect) {
      // --- Multi-Select Question ---
      if (state.mode === 'practice') {
        if (isChecked) {
          disabledClass = 'disabled';
          const shouldBeCorrect = q.correctAnswers.includes(optionPrefix);
          if (shouldBeCorrect) {
            optionClass = 'correct'; // Green border (correct option)
          } else if (isSelected) {
            optionClass = 'incorrect'; // Red border (wrongly chosen)
          }
        } else {
          if (isSelected) {
            optionClass = 'selected'; // Blue border (not yet checked)
          }
        }
      } else {
        // Exam Mode
        if (isSubmitted) {
          disabledClass = 'disabled';
          const shouldBeCorrect = q.correctAnswers.includes(optionPrefix);
          if (shouldBeCorrect) {
            optionClass = 'correct';
          } else if (isSelected) {
            optionClass = 'incorrect';
          }
        } else {
          if (isSelected) {
            optionClass = 'selected';
          }
        }
      }
    } else {
      // --- Single-Select Question ---
      if (state.mode === 'practice') {
        if (hasAnswered) {
          disabledClass = 'disabled';
          if (q.correctAnswers.includes(optionPrefix)) {
            optionClass = 'correct'; // green
          } else if (isSelected) {
            optionClass = 'incorrect'; // red
          }
        }
      } else {
        // Exam mode:
        if (isSubmitted) {
          disabledClass = 'disabled';
          if (q.correctAnswers.includes(optionPrefix)) {
            optionClass = 'correct';
          } else if (isSelected) {
            optionClass = 'incorrect';
          }
        } else {
          if (isSelected) {
            optionClass = 'selected';
          }
        }
      }
    }

    optionsHtml += `
      <button class="option-item ${isMultiSelect ? 'multi' : ''} ${optionClass} ${disabledClass}" onclick="selectOption('${q.id}', '${optionPrefix}')" ${disabledClass || (state.mode === 'practice' && !isMultiSelect && hasAnswered) ? 'disabled' : ''}>
        <div class="option-prefix">${optionPrefix}</div>
        <div class="option-text-content">${optionCleanText}</div>
      </button>
    `;
  });

  // Render question card
  qCardPlaceholder.innerHTML = `
    <div class="question-card glass" id="active-question-card">
      <div class="question-header">
        <span class="question-number-badge">Câu hỏi ${state.currentIndex + 1} / ${state.activeQuestions.length}</span>
        <span class="question-type-badge" style="
          padding: 6px 12px;
          background-color: ${isMultiSelect ? 'rgba(245, 158, 11, 0.1)' : 'rgba(56, 189, 248, 0.1)'};
          border: 1px solid ${isMultiSelect ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'};
          color: ${isMultiSelect ? 'var(--warning-color)' : 'var(--accent-color)'};
          border-radius: 30px;
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        ">${isMultiSelect ? 'Chọn nhiều đáp án' : 'Chọn 1 đáp án'}</span>
        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark('${q.id}')" title="Đánh dấu câu hỏi này">
          ${isBookmarked ? '★' : '☆'}
        </button>
      </div>
      <div class="question-text">${q.question}</div>
      <div class="options-stack">
        ${optionsHtml}
      </div>
      ${isMultiSelect && state.mode === 'practice' && !isChecked ? `
        <div class="check-action-container" style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button class="action-btn success" id="check-multi-answer-btn" onclick="checkMultiAnswer('${q.id}')" ${selectedAnswers.length === 0 ? 'disabled' : ''}>
            Kiểm tra đáp án
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // Render navigation circle grid
  renderNavGrid();

  // Set up Exam submit/result button
  renderExamActionArea();
}

// --- OPTION SELECTION LOGIC ---
window.selectOption = function(qId, optionPrefix) {
  const q = MLN_QUESTIONS.find(x => x.id === qId);
  if (!q) return;

  const isMultiSelect = q.correctAnswers.length > 1;
  let selectedAnswers = state.userAnswers[qId] || [];

  if (isMultiSelect) {
    const idx = selectedAnswers.indexOf(optionPrefix);
    if (idx === -1) {
      selectedAnswers.push(optionPrefix);
    } else {
      selectedAnswers.splice(idx, 1);
    }
    state.userAnswers[qId] = selectedAnswers;
  } else {
    state.userAnswers[qId] = [optionPrefix];
    
    // If in Practice Mode, show animation if they got it wrong
    if (state.mode === 'practice') {
      const isCorrect = q.correctAnswers.includes(optionPrefix);
      if (!isCorrect) {
        // Add shake animation to the question card
        const card = document.getElementById('active-question-card');
        if (card) {
          card.classList.add('shake-animation');
          setTimeout(() => card.classList.remove('shake-animation'), 350);
        }
      }
    }
  }

  saveStateToStorage();
  
  // Rerender question with feedback immediately
  renderActiveQuestion();
  updateProgressBar();
};

window.checkMultiAnswer = function(qId) {
  const q = MLN_QUESTIONS.find(x => x.id === qId);
  if (!q) return;

  state.checkedQuestions[qId] = true;
  localStorage.setItem('mln_checked', JSON.stringify(state.checkedQuestions));

  // Verify correctness to trigger wrong answer shake animation
  const selectedAnswers = state.userAnswers[qId] || [];
  const isCorrect = selectedAnswers.every(ans => q.correctAnswers.includes(ans)) && 
                    q.correctAnswers.every(ans => selectedAnswers.includes(ans));
  
  if (!isCorrect) {
    const card = document.getElementById('active-question-card');
    if (card) {
      card.classList.add('shake-animation');
      setTimeout(() => card.classList.remove('shake-animation'), 350);
    }
  }

  renderActiveQuestion();
  updateProgressBar();
};

// --- BOOKMARKS LOGIC ---
window.toggleBookmark = function(qId) {
  const index = state.bookmarks.indexOf(qId);
  if (index === -1) {
    state.bookmarks.push(qId);
    showToast('Đã đánh dấu câu hỏi này!');
  } else {
    state.bookmarks.splice(index, 1);
    showToast('Đã bỏ đánh dấu câu hỏi!');
  }
  saveStateToStorage();
  
  // Re-filter if we are in bookmarks tab
  if (state.currentTab === 'bookmarks') {
    updateActiveQuestions();
  }
  
  renderActiveQuestion();
};

// --- PROGRESS BAR ---
function updateProgressBar() {
  const progressText = document.getElementById('progress-percentage-text');
  const progressFill = document.getElementById('progress-bar-fill');
  
  if (!progressFill) return;

  const total = state.activeQuestions.length;
  if (total === 0) {
    progressText.innerText = '0% (0/0 câu)';
    progressFill.style.width = '0%';
    return;
  }

  let answered = 0;
  state.activeQuestions.forEach(q => {
    const answers = state.userAnswers[q.id] || [];
    if (answers.length > 0) answered++;
  });

  const pct = Math.round((answered / total) * 100);
  progressText.innerText = `${pct}% (${answered}/${total} câu)`;
  progressFill.style.width = `${pct}%`;
}

// --- NAVIGATION DOTS GRID ---
function renderNavGrid() {
  const circlesGrid = document.getElementById('nav-circles-grid');
  if (!circlesGrid) return;

  let html = '';
  state.activeQuestions.forEach((q, idx) => {
    const answers = state.userAnswers[q.id] || [];
    const hasAnswered = answers.length > 0;
    
    // Evaluate correctness
    const isCorrect = hasAnswered && 
      answers.every(ans => q.correctAnswers.includes(ans)) && 
      q.correctAnswers.every(ans => answers.includes(ans));
      
    const isBookmarked = state.bookmarks.includes(q.id);
    
    let statusClass = 'unanswered';
    
    if (state.mode === 'practice') {
      if (hasAnswered) {
        const isMultiSelect = q.correctAnswers.length > 1;
        const isChecked = !isMultiSelect || state.checkedQuestions[q.id] === true;
        if (isChecked) {
          statusClass = isCorrect ? 'correct' : 'incorrect';
        } else {
          statusClass = 'active'; // blue border for partially answered/selected
        }
      }
    } else {
      // Exam Mode
      const isSubmitted = state.examSubmitted[q.chapter] === true;
      if (isSubmitted) {
        statusClass = isCorrect ? 'correct' : 'incorrect';
      } else if (hasAnswered) {
        statusClass = 'active'; // show blue if selected in exam
      }
    }

    const isActive = idx === state.currentIndex ? 'active' : '';
    const bookmarkClass = isBookmarked ? 'bookmarked' : '';

    html += `
      <button class="nav-circle ${statusClass} ${isActive} ${bookmarkClass}" onclick="jumpToQuestion(${idx})" title="Đi tới câu ${idx + 1}">
        ${idx + 1}
      </button>
    `;
  });

  circlesGrid.innerHTML = html;
}

window.jumpToQuestion = function(idx) {
  state.currentIndex = idx;
  renderActiveQuestion();
};

function nextQuestion() {
  if (state.activeQuestions.length === 0) return;
  state.currentIndex = (state.currentIndex + 1) % state.activeQuestions.length;
  renderActiveQuestion();
}

function prevQuestion() {
  if (state.activeQuestions.length === 0) return;
  state.currentIndex = (state.currentIndex - 1 + state.activeQuestions.length) % state.activeQuestions.length;
  renderActiveQuestion();
}

// --- EXAM MODE LOGIC (Submit/Grading) ---
function renderExamActionArea() {
  const area = document.getElementById('exam-action-area');
  if (!area) return;

  if (state.mode === 'practice') {
    area.innerHTML = '';
    return;
  }

  // Get active chapter
  const currentChapter = TAB_MAP[state.currentTab];
  if (!currentChapter) {
    area.innerHTML = '';
    return;
  }

  const isSubmitted = state.examSubmitted[currentChapter] === true;

  if (isSubmitted) {
    // Show exam results summary
    const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === currentChapter);
    let correct = 0;
    let answered = 0;
    chQuestions.forEach(q => {
      const answers = state.userAnswers[q.id] || [];
      if (answers.length > 0) {
        answered++;
        const isCorrect = answers.every(ans => q.correctAnswers.includes(ans)) && 
                          q.correctAnswers.every(ans => answers.includes(ans));
        if (isCorrect) correct++;
      }
    });

    area.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 13px; font-weight: 600; color: var(--success-color);">Kết quả: ${correct}/${chQuestions.length} câu đúng</span>
        <button class="action-btn secondary" onclick="resetExamMode('${currentChapter}')" style="padding: 8px 16px;">Làm lại</button>
      </div>
    `;
  } else {
    // Show submit button
    area.innerHTML = `
      <button class="action-btn success" onclick="submitExam('${currentChapter}')">Nộp bài thi</button>
    `;
  }
}

window.submitExam = function(chapterName) {
  // Confirm submit
  const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
  let answered = 0;
  chQuestions.forEach(q => {
    const answers = state.userAnswers[q.id] || [];
    if (answers.length > 0) answered++;
  });

  const confirmSubmit = confirm(`Bạn đã trả lời ${answered}/${chQuestions.length} câu. Bạn có chắc chắn muốn nộp bài thi không?`);
  if (!confirmSubmit) return;

  state.examSubmitted[chapterName] = true;
  saveStateToStorage();
  
  renderActiveQuestion();
  showToast('Đã nộp bài thi thành công! Hãy xem kết quả trên bản đồ câu hỏi.');
};

window.resetExamMode = function(chapterName) {
  const confirmReset = confirm(`Bạn muốn làm lại chương "${chapterName}" trong chế độ thi thử? Hành động này sẽ xoá các đáp án đã chọn.`);
  if (!confirmReset) return;

  // Clear answers for this chapter
  const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
  chQuestions.forEach(q => {
    delete state.userAnswers[q.id];
    delete state.checkedQuestions[q.id];
  });
  
  // Clear exam submitted state
  state.examSubmitted[chapterName] = false;
  saveStateToStorage();
  
  state.currentIndex = 0;
  renderActiveQuestion();
  showToast('Đã làm lại chương trong chế độ thi thử!');
};

// --- RESET PROGRESS FUNCTIONS ---
window.resetChapterProgress = function() {
  if (state.currentTab === 'dashboard') return;
  
  let chapterName = '';
  let msg = '';
  
  if (state.currentTab === 'bookmarks') {
    chapterName = 'Bookmarks';
    msg = 'Bạn có chắc chắn muốn xoá toàn bộ câu hỏi đã lưu?';
  } else {
    chapterName = TAB_MAP[state.currentTab];
    msg = `Bạn có chắc chắn muốn làm lại (xoá tất cả đáp án đã chọn) của chương "${chapterName}"?`;
  }

  const confirmReset = confirm(msg);
  if (!confirmReset) return;

  if (state.currentTab === 'bookmarks') {
    state.bookmarks = [];
  } else {
    const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
    chQuestions.forEach(q => {
      delete state.userAnswers[q.id];
      delete state.checkedQuestions[q.id];
    });
    // Reset exam status as well
    state.examSubmitted[chapterName] = false;
  }

  saveStateToStorage();
  state.currentIndex = 0;
  
  // Re-filter active questions
  updateActiveQuestions();
  renderActiveQuestion();
  showToast('Đã xoá tiến trình của phần này!');
};

window.resetAllProgress = function() {
  const confirmReset = confirm('CẢNH BÁO: Bạn có chắc chắn muốn xoá toàn bộ tiến trình ôn tập, đáp án đã trả lời và câu hỏi đã đánh dấu trên hệ thống?');
  if (!confirmReset) return;

  state.userAnswers = {};
  state.bookmarks = [];
  state.examSubmitted = {};
  state.checkedQuestions = {};
  
  saveStateToStorage();
  
  if (state.currentTab !== 'dashboard') {
    switchTab('dashboard');
  } else {
    renderContent();
  }
  
  showToast('Đã xoá toàn bộ dữ liệu ôn tập trên trình duyệt!');
};

// --- TOAST NOTIFICATION UTILITY ---
function showToast(message) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-msg';
    document.body.appendChild(toast);
  }
  
  toast.innerText = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
