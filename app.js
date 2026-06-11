// MLN111 Quiz Application Logic

// --- STATE MANAGEMENT ---
let state = {
  currentTab: 'dashboard', // 'dashboard', 'c0', 'c1', 'c2', 'c3', 'bookmarks', 'custom_quiz'
  currentIndex: 0,        // index of current question in active list
  activeQuestions: [],    // filtered list of questions for current tab
  practiceAnswers: {},    // q_id -> array of chosen options in practice mode
  examAnswers: {},        // q_id -> array of chosen options in exam mode
  bookmarks: [],          // array of q_id
  mode: 'practice',       // 'practice' or 'exam'
  theme: 'dark',          // 'dark' or 'light'
  searchQuery: '',
  filterStatus: 'all',    // 'all', 'unanswered', 'correct', 'incorrect', 'bookmarked'
  examSubmitted: {},      // chapter_name or 'custom_quiz' -> boolean (if true, exam is graded)
  checkedQuestions: {},   // q_id -> boolean (if true, multi-select is checked in practice mode)
  shuffledChapterQuestions: {}, // chapter_name -> array of shuffled question IDs
  
  // Custom quiz generator config
  customScope: 'all',
  customCount: '20',
  customOrder: 'random'
};

// --- CONSTANTS ---
const TAB_MAP = {
  'c0': 'Đề cương ôn tập chung',
  'c1': 'Chương 1',
  'c2': 'Chương 2',
  'c3': 'Chương 3'
};

// --- HELPER SHUFFLE FUNCTION ---
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- LOCAL STORAGE UTILITIES ---
function loadStateFromStorage() {
  const storedTheme = localStorage.getItem('mln_theme');
  if (storedTheme) state.theme = storedTheme;
  
  const storedMode = localStorage.getItem('mln_mode');
  if (storedMode) state.mode = storedMode;
  
  const storedPracticeAnswers = localStorage.getItem('mln_practice_answers');
  if (storedPracticeAnswers) {
    const parsed = JSON.parse(storedPracticeAnswers);
    // Backward compatibility: migrate legacy string answers to arrays
    for (let key in parsed) {
      if (typeof parsed[key] === 'string') {
        parsed[key] = [parsed[key]];
      }
    }
    state.practiceAnswers = parsed;
  } else {
    state.practiceAnswers = {};
  }

  const storedExamAnswers = localStorage.getItem('mln_exam_answers');
  if (storedExamAnswers) {
    const parsed = JSON.parse(storedExamAnswers);
    for (let key in parsed) {
      if (typeof parsed[key] === 'string') {
        parsed[key] = [parsed[key]];
      }
    }
    state.examAnswers = parsed;
  } else {
    state.examAnswers = {};
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

  const storedShuffled = localStorage.getItem('mln_shuffled_chapters');
  if (storedShuffled) {
    state.shuffledChapterQuestions = JSON.parse(storedShuffled);
  } else {
    state.shuffledChapterQuestions = {};
  }
}

function saveStateToStorage() {
  localStorage.setItem('mln_theme', state.theme);
  localStorage.setItem('mln_mode', state.mode);
  localStorage.setItem('mln_practice_answers', JSON.stringify(state.practiceAnswers));
  localStorage.setItem('mln_exam_answers', JSON.stringify(state.examAnswers));
  localStorage.setItem('mln_bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem('mln_exam_submitted', JSON.stringify(state.examSubmitted));
  localStorage.setItem('mln_checked', JSON.stringify(state.checkedQuestions));
  localStorage.setItem('mln_shuffled_chapters', JSON.stringify(state.shuffledChapterQuestions));
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
  
  // Dynamic header updates
  const mainTitle = document.getElementById('header-main-title');
  const subTitle = document.getElementById('header-sub-title');
  if (mainTitle && subTitle) {
    if (tabId === 'dashboard') {
      mainTitle.innerText = 'Trắc nghiệm MLN111';
      subTitle.innerText = 'Chào mừng bạn đến với hệ thống ôn tập kiến thức Triết học Mác - Lênin.';
    } else if (tabId === 'bookmarks') {
      mainTitle.innerText = 'Câu hỏi đã lưu';
      subTitle.innerText = 'Danh sách các câu hỏi khó bạn đã lưu lại để ôn tập.';
    } else if (tabId === 'custom_quiz') {
      mainTitle.innerText = state.mode === 'practice' ? 'Đề luyện tập tự chọn' : 'Đề thi thử tùy chỉnh';
      subTitle.innerText = `Đề thi gồm ${state.activeQuestions.length} câu hỏi ngẫu nhiên được tổng hợp theo yêu cầu.`;
    } else {
      const chapterName = TAB_MAP[tabId];
      mainTitle.innerText = chapterName;
      subTitle.innerText = `Luyện tập các câu hỏi trắc nghiệm thuộc phần: ${chapterName}.`;
    }
  }

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
  
  if (state.currentTab === 'custom_quiz') {
    // Active questions are pre-generated by the custom builder
    return;
  }
  
  if (state.currentTab === 'bookmarks') {
    list = MLN_QUESTIONS.filter(q => state.bookmarks.includes(q.id));
  } else {
    // It's a chapter tab
    const chapterName = TAB_MAP[state.currentTab];
    if (state.mode === 'exam' && state.shuffledChapterQuestions && state.shuffledChapterQuestions[chapterName]) {
      const shuffledIds = state.shuffledChapterQuestions[chapterName];
      list = shuffledIds.map(id => MLN_QUESTIONS.find(q => q.id === id)).filter(Boolean);
    } else {
      list = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
    }
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
      const answers = (state.mode === 'practice' ? state.practiceAnswers : state.examAnswers)[q.id] || [];
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
  
  // Calculate practice mode stats
  const practiceAnsweredIds = Object.keys(state.practiceAnswers).filter(id => state.practiceAnswers[id] && state.practiceAnswers[id].length > 0);
  const practiceAnswered = practiceAnsweredIds.length;
  let practiceCorrect = 0;
  MLN_QUESTIONS.forEach(q => {
    const answers = state.practiceAnswers[q.id] || [];
    if (answers.length > 0 && answers.every(ans => q.correctAnswers.includes(ans)) && q.correctAnswers.every(ans => answers.includes(ans))) {
      practiceCorrect++;
    }
  });

  // Calculate exam mode stats
  const examAnsweredIds = Object.keys(state.examAnswers).filter(id => state.examAnswers[id] && state.examAnswers[id].length > 0);
  const examAnswered = examAnsweredIds.length;
  let examCorrect = 0;
  MLN_QUESTIONS.forEach(q => {
    const answers = state.examAnswers[q.id] || [];
    if (answers.length > 0 && answers.every(ans => q.correctAnswers.includes(ans)) && q.correctAnswers.every(ans => answers.includes(ans))) {
      examCorrect++;
    }
  });
  
  const overallPercentage = totalQs > 0 ? Math.round(((practiceAnswered + examAnswered) / (totalQs * 2)) * 100) : 0;

  // Render Dashboard HTML
  let html = `
    <div class="dashboard-view">
      <!-- Welcome Banner -->
      <div class="stats-card-large glass">
        <div class="welcome-info">
          <h3>Hệ thống Ôn thi MLN111</h3>
          <p>Dựa trên Đề cương ôn thi Triết học Mác - Lênin. Hỗ trợ câu hỏi nhiều đáp án, lưu tiến trình riêng biệt cho <b>Luyện tập</b> và <b>Thi thử</b>.</p>
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
            <span>Tiến độ</span>
          </div>
        </div>
      </div>

      <!-- Custom Quiz Generator Card (Randomizer) -->
      <div class="custom-quiz-builder glass" style="padding: 24px; margin-bottom: 32px;">
        <h3 style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-family: 'Outfit';">🎲 Bộ tạo đề ôn tập & Thi thử tự do</h3>
        <div class="builder-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; align-items: flex-end;">
          
          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Phạm vi câu hỏi</label>
            <select id="custom-scope" class="search-input" style="padding-left: 12px; height: 42px;">
              <option value="all">Tất cả câu hỏi (423 câu)</option>
              <option value="c0">Đề cương ôn tập chung (104 câu)</option>
              <option value="c1">Chương 1: Khái luận triết học (63 câu)</option>
              <option value="c2">Chương 2: CNDV Biện chứng (88 câu)</option>
              <option value="c3">Chương 3: CNDV Lịch sử (168 câu)</option>
              <option value="bookmarks">Câu hỏi đã đánh dấu (Lưu)</option>
            </select>
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Chế độ thi</label>
            <select id="custom-mode" class="search-input" style="padding-left: 12px; height: 42px;">
              <option value="practice">🕹️ Luyện tập (Xem kết quả ngay)</option>
              <option value="exam">📝 Thi thử (Chấm điểm khi nộp)</option>
            </select>
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Số lượng câu hỏi</label>
            <select id="custom-count" class="search-input" style="padding-left: 12px; height: 42px;">
              <option value="10">10 câu</option>
              <option value="20" selected>20 câu</option>
              <option value="50">50 câu</option>
              <option value="100">100 câu</option>
              <option value="all">Tất cả câu</option>
            </select>
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Thứ tự xuất hiện</label>
            <select id="custom-order" class="search-input" style="padding-left: 12px; height: 42px;">
              <option value="random" selected>Xáo trộn ngẫu nhiên</option>
              <option value="default">Thứ tự mặc định</option>
            </select>
          </div>

          <button class="action-btn primary" onclick="startCustomQuiz()" style="height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
            Tạo đề thi
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="dashboard-grid">
        <div class="summary-card glass">
          <div class="card-icon total">📚</div>
          <div class="card-info">
            <span class="value">${totalQs}</span>
            <span class="label">Tổng số câu hỏi</span>
          </div>
        </div>
        <div class="summary-card glass">
          <div class="card-icon correct">🕹️</div>
          <div class="card-info">
            <span class="value">${practiceCorrect}/${totalQs}</span>
            <span class="label">Luyện tập (Đúng)</span>
          </div>
        </div>
        <div class="summary-card glass">
          <div class="card-icon incorrect">📝</div>
          <div class="card-info">
            <span class="value">${examCorrect}/${totalQs}</span>
            <span class="label">Thi thử (Đúng)</span>
          </div>
        </div>
        <div class="summary-card glass">
          <div class="card-icon progress">⭐</div>
          <div class="card-info">
            <span class="value">${state.bookmarks.length}</span>
            <span class="label">Đã lưu (Bookmarks)</span>
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
    const chapterName = ch.id === 'c0' ? 'Đề cương ôn tập chung' : ch.name.split(':')[0];
    const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
    const chTotal = chQuestions.length;
    
    // Display stats based on active mode
    const answers = state.mode === 'practice' ? state.practiceAnswers : state.examAnswers;
    let chAnswered = 0;
    chQuestions.forEach(q => {
      const ans = answers[q.id] || [];
      if (ans.length > 0) chAnswered++;
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
          <p>Hành động này sẽ xóa toàn bộ lịch sử làm bài (cả hai chế độ), điểm số và các câu hỏi đã lưu trên trình duyệt này.</p>
        </div>
        <button class="grid-reset-btn" onclick="resetAllProgress()">Xoá hết tiến trình</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// --- QUIZ VIEW RENDER ---
function renderQuizView(container) {
  let html = `
    <div class="quiz-grid-layout">
      <!-- Quiz Main Area -->
      <div class="quiz-main">
        <!-- Progress Bar at top of quiz -->
        <div class="progress-bar-container glass" style="padding: 20px;">
          <div class="progress-info">
            <span>Tiến độ câu hỏi:</span>
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
          <div style="display: flex; gap: 6px;">
            ${state.mode === 'exam' && state.currentTab !== 'bookmarks' && state.currentTab !== 'custom_quiz' ? `
              <button class="grid-shuffle-btn" onclick="shuffleChapterExam()">🎲 Trộn đề</button>
            ` : ''}
            <button class="grid-reset-btn" id="reset-chapter-btn">Làm lại</button>
          </div>
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
  const isCustomQuiz = state.currentTab === 'custom_quiz';
  
  let html = `
    <div class="quiz-controls">
      <div class="controls-left">
        <!-- Search bar (disabled for custom_quiz to avoid breaking custom lists) -->
        ${!isCustomQuiz ? `
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" id="search-questions" class="search-input" placeholder="Tìm kiếm câu hỏi..." value="${state.searchQuery}">
          </div>
        ` : ''}

        <!-- Filter tabs -->
        <div class="filter-tabs">
          <button class="filter-btn ${state.filterStatus === 'all' ? 'active' : ''}" onclick="setFilterStatus('all')">Tất cả</button>
          <button class="filter-btn ${state.filterStatus === 'unanswered' ? 'active' : ''}" onclick="setFilterStatus('unanswered')">Chưa làm</button>
          ${!isBookmarkedTab ? `
            <button class="filter-btn ${state.filterStatus === 'correct' ? 'active' : ''}" onclick="setFilterStatus('correct')">Đúng</button>
            <button class="filter-btn ${state.filterStatus === 'incorrect' ? 'active' : ''}" onclick="setFilterStatus('incorrect')">Sai</button>
          ` : ''}
          <button class="filter-btn ${state.filterStatus === 'bookmarked' ? 'active' : ''}" onclick="setFilterStatus('bookmarked')">Đã lưu</button>
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
  if (!isCustomQuiz) {
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
}

// --- FILTERS & MODES SETTERS ---
window.setFilterStatus = function(status) {
  state.filterStatus = status;
  setupHeaderControls();
  
  if (state.currentTab !== 'custom_quiz') {
    updateActiveQuestions();
  }
  
  state.currentIndex = 0;
  renderActiveQuestion();
};

window.setMode = function(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  setupHeaderControls();
  
  // Reload active questions if we are filtering, because filters are mode-dependent
  if (state.currentTab !== 'custom_quiz') {
    updateActiveQuestions();
  }
  
  state.currentIndex = 0;
  
  // Update header title in case it is custom quiz
  const mainTitle = document.getElementById('header-main-title');
  if (mainTitle && state.currentTab === 'custom_quiz') {
    mainTitle.innerText = mode === 'practice' ? 'Đề luyện tập tự chọn' : 'Đề thi thử tùy chỉnh';
  }

  renderContent();
  showToast(`Đã chuyển sang chế độ ${mode === 'practice' ? 'Luyện tập (Xem đáp án ngay)' : 'Thi thử (Không xem đáp án ngay)'}`);
};

// --- CUSTOM QUIZ BUILDER ---
window.startCustomQuiz = function() {
  const scope = document.getElementById('custom-scope').value;
  const countVal = document.getElementById('custom-count').value;
  const order = document.getElementById('custom-order').value;
  const mode = document.getElementById('custom-mode').value;
  
  state.customScope = scope;
  state.customCount = countVal;
  state.customOrder = order;
  state.mode = mode;
  
  // Fetch scope list
  let list = [];
  if (scope === 'all') {
    list = [...MLN_QUESTIONS];
  } else if (scope === 'bookmarks') {
    list = MLN_QUESTIONS.filter(q => state.bookmarks.includes(q.id));
  } else {
    const chapterName = TAB_MAP[scope];
    list = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
  }
  
  if (list.length === 0) {
    alert('Không tìm thấy câu hỏi nào trong phạm vi được chọn!');
    return;
  }
  
  // Apply shuffle
  if (order === 'random') {
    list = shuffleArray(list);
  }
  
  // Limit count
  if (countVal !== 'all') {
    const limit = parseInt(countVal, 10);
    list = list.slice(0, limit);
  }
  
  state.activeQuestions = list;
  state.currentTab = 'custom_quiz';
  state.currentIndex = 0;
  state.searchQuery = '';
  state.filterStatus = 'all';
  state.examSubmitted['custom_quiz'] = false;
  
  saveStateToStorage();
  
  // Clear sidebar active highlights
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Update headers
  const mainTitle = document.getElementById('header-main-title');
  const subTitle = document.getElementById('header-sub-title');
  if (mainTitle && subTitle) {
    mainTitle.innerText = mode === 'practice' ? 'Đề luyện tập tự chọn' : 'Đề thi thử tùy chỉnh';
    subTitle.innerText = `Đề thi gồm ${list.length} câu hỏi ngẫu nhiên được tổng hợp theo yêu cầu.`;
  }
  
  renderContent();
  showToast(`Đã tạo bộ đề thi gồm ${list.length} câu hỏi!`);
};

// --- RENDER ACTIVE QUESTION CARD ---
function renderActiveQuestion() {
  const qCardPlaceholder = document.getElementById('question-card-placeholder');
  const circlesGrid = document.getElementById('nav-circles-grid');
  
  if (!qCardPlaceholder) return;

  // Update progress bar
  updateProgressBar();

  // Handle empty lists
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

  // Bound checks
  if (state.currentIndex >= state.activeQuestions.length) {
    state.currentIndex = 0;
  } else if (state.currentIndex < 0) {
    state.currentIndex = state.activeQuestions.length - 1;
  }

  const q = state.activeQuestions[state.currentIndex];
  const qIndexInChapter = state.activeQuestions.indexOf(q) + 1;
  const isBookmarked = state.bookmarks.includes(q.id);
  
  // Read answer from mode-specific storage
  const selectedAnswers = (state.mode === 'practice' ? state.practiceAnswers : state.examAnswers)[q.id] || [];
  const hasAnswered = selectedAnswers.length > 0;
  
  const isMultiSelect = q.correctAnswers.length > 1;
  const isChecked = state.checkedQuestions[q.id] === true;

  const chapterName = state.currentTab === 'custom_quiz' ? 'custom_quiz' : q.chapter;
  const isSubmitted = state.examSubmitted[chapterName] === true;

  // Build options HTML
  let optionsHtml = '';
  q.options.forEach(optionText => {
    const optionPrefix = optionText.substring(0, 1);
    const optionCleanText = optionText.substring(3);
    
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
            optionClass = 'correct'; // green border
          } else if (isSelected) {
            optionClass = 'incorrect'; // red border
          }
        } else {
          if (isSelected) {
            optionClass = 'selected'; // blue border
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
            optionClass = 'correct';
          } else if (isSelected) {
            optionClass = 'incorrect';
          }
        }
      } else {
        // Exam Mode
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
  const answers = state.mode === 'practice' ? state.practiceAnswers : state.examAnswers;
  let selectedAnswers = answers[qId] || [];

  if (isMultiSelect) {
    const idx = selectedAnswers.indexOf(optionPrefix);
    if (idx === -1) {
      selectedAnswers.push(optionPrefix);
    } else {
      selectedAnswers.splice(idx, 1);
    }
    answers[qId] = selectedAnswers;
  } else {
    answers[qId] = [optionPrefix];
    
    // If in Practice Mode, show animation if they got it wrong
    if (state.mode === 'practice') {
      const isCorrect = q.correctAnswers.includes(optionPrefix);
      if (!isCorrect) {
        const card = document.getElementById('active-question-card');
        if (card) {
          card.classList.add('shake-animation');
          setTimeout(() => card.classList.remove('shake-animation'), 350);
        }
      }
    }
  }

  saveStateToStorage();
  
  renderActiveQuestion();
  updateProgressBar();
};

window.checkMultiAnswer = function(qId) {
  const q = MLN_QUESTIONS.find(x => x.id === qId);
  if (!q) return;

  state.checkedQuestions[qId] = true;
  saveStateToStorage();

  // Verify correctness to trigger wrong answer shake animation
  const selectedAnswers = state.practiceAnswers[qId] || [];
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
    const answers = (state.mode === 'practice' ? state.practiceAnswers : state.examAnswers)[q.id] || [];
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
    const answers = (state.mode === 'practice' ? state.practiceAnswers : state.examAnswers)[q.id] || [];
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
          statusClass = 'active'; // blue border for selected but unchecked
        }
      }
    } else {
      // Exam Mode
      const chapterName = state.currentTab === 'custom_quiz' ? 'custom_quiz' : q.chapter;
      const isSubmitted = state.examSubmitted[chapterName] === true;
      if (isSubmitted) {
        statusClass = isCorrect ? 'correct' : 'incorrect';
      } else if (hasAnswered) {
        statusClass = 'active'; // show blue selected border
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

  const currentChapter = state.currentTab === 'custom_quiz' ? 'custom_quiz' : TAB_MAP[state.currentTab];
  if (!currentChapter) {
    area.innerHTML = '';
    return;
  }

  const isSubmitted = state.examSubmitted[currentChapter] === true;

  if (isSubmitted) {
    // Show exam results summary
    let correct = 0;
    let answered = 0;
    state.activeQuestions.forEach(q => {
      const answers = state.examAnswers[q.id] || [];
      if (answers.length > 0) {
        answered++;
        const isCorrect = answers.every(ans => q.correctAnswers.includes(ans)) && 
                          q.correctAnswers.every(ans => answers.includes(ans));
        if (isCorrect) correct++;
      }
    });

    area.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 13px; font-weight: 600; color: var(--success-color);">Kết quả: ${correct}/${state.activeQuestions.length} câu đúng</span>
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
  let answered = 0;
  state.activeQuestions.forEach(q => {
    const answers = state.examAnswers[q.id] || [];
    if (answers.length > 0) answered++;
  });

  const confirmSubmit = confirm(`Bạn đã trả lời ${answered}/${state.activeQuestions.length} câu. Bạn có chắc chắn muốn nộp bài thi không?`);
  if (!confirmSubmit) return;

  state.examSubmitted[chapterName] = true;
  saveStateToStorage();
  
  renderActiveQuestion();
  showToast('Đã nộp bài thi thành công! Hãy xem kết quả trên bản đồ câu hỏi.');
};

window.resetExamMode = function(chapterName) {
  const confirmReset = confirm(`Bạn muốn làm lại đề thi này? Hành động này sẽ xoá các đáp án đã chọn.`);
  if (!confirmReset) return;

  // Clear answers for the active questions
  state.activeQuestions.forEach(q => {
    delete state.examAnswers[q.id];
    delete state.checkedQuestions[q.id];
  });
  
  state.examSubmitted[chapterName] = false;
  saveStateToStorage();
  
  state.currentIndex = 0;
  renderActiveQuestion();
  showToast('Đã đặt lại bài thi!');
};

// --- SHUFFLE EXAM QUESTIONS FOR CHAPTER ---
window.shuffleChapterExam = function() {
  const chapterName = TAB_MAP[state.currentTab];
  if (!chapterName) return;
  
  const confirmShuffle = confirm(`Bạn muốn xáo trộn các câu hỏi của chương "${chapterName}" để bắt đầu một bài thi thử ngẫu nhiên mới? (Hành động này sẽ xoá các đáp án thi thử hiện tại của chương này)`);
  if (!confirmShuffle) return;
  
  const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
  chQuestions.forEach(q => {
    delete state.examAnswers[q.id];
    delete state.checkedQuestions[q.id];
  });
  state.examSubmitted[chapterName] = false;
  
  // Shuffle
  const shuffled = shuffleArray(chQuestions);
  state.shuffledChapterQuestions[chapterName] = shuffled.map(q => q.id);
  
  saveStateToStorage();
  
  state.activeQuestions = shuffled;
  state.currentIndex = 0;
  
  renderActiveQuestion();
  showToast('Đã xáo trộn đề thi ngẫu nhiên cho chương!');
};

// --- RESET PROGRESS FUNCTIONS ---
window.resetChapterProgress = function() {
  if (state.currentTab === 'dashboard') return;
  
  if (state.currentTab === 'custom_quiz') {
    const confirmReset = confirm('Bạn muốn làm lại đề ôn tập tự chọn này? (Lịch sử trả lời của các câu hỏi này sẽ bị xoá)');
    if (!confirmReset) return;
    
    state.activeQuestions.forEach(q => {
      const answers = state.mode === 'practice' ? state.practiceAnswers : state.examAnswers;
      delete answers[q.id];
      delete state.checkedQuestions[q.id];
    });
    state.examSubmitted['custom_quiz'] = false;
    
    saveStateToStorage();
    state.currentIndex = 0;
    renderActiveQuestion();
    showToast('Đã reset đề thi tùy chỉnh!');
    return;
  }
  
  let chapterName = '';
  let msg = '';
  
  if (state.currentTab === 'bookmarks') {
    chapterName = 'Bookmarks';
    msg = 'Bạn có chắc chắn muốn xoá toàn bộ câu hỏi đã lưu?';
  } else {
    chapterName = TAB_MAP[state.currentTab];
    msg = `Bạn có chắc chắn muốn làm lại (xoá tất cả đáp án) của chương "${chapterName}" ở chế độ hiện tại?`;
  }

  const confirmReset = confirm(msg);
  if (!confirmReset) return;

  if (state.currentTab === 'bookmarks') {
    state.bookmarks = [];
  } else {
    const chQuestions = MLN_QUESTIONS.filter(q => q.chapter === chapterName);
    const answers = state.mode === 'practice' ? state.practiceAnswers : state.examAnswers;
    chQuestions.forEach(q => {
      delete answers[q.id];
      delete state.checkedQuestions[q.id];
    });
    // Reset exam status for this chapter
    state.examSubmitted[chapterName] = false;
    
    // Clear shuffled state if resetting in exam mode
    if (state.mode === 'exam' && state.shuffledChapterQuestions) {
      delete state.shuffledChapterQuestions[chapterName];
    }
  }

  saveStateToStorage();
  state.currentIndex = 0;
  
  updateActiveQuestions();
  renderActiveQuestion();
  showToast('Đã xoá tiến trình của phần này!');
};

window.resetAllProgress = function() {
  const confirmReset = confirm('CẢNH BÁO: Bạn có chắc chắn muốn xoá toàn bộ tiến trình ôn tập (cả chế độ Luyện tập và Thi thử), đáp án đã trả lời và câu hỏi đã đánh dấu trên hệ thống?');
  if (!confirmReset) return;

  state.practiceAnswers = {};
  state.examAnswers = {};
  state.bookmarks = [];
  state.examSubmitted = {};
  state.checkedQuestions = {};
  state.shuffledChapterQuestions = {};
  
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
