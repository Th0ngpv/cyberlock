// FILE: public/app.js
let selectedCategories = [];
let currentMode = null;
let questions = [];
let currentIndex = 0;
let userAnswers = {};

// Test mode variables
let testQuestions = [];
let testIndex = 0;
let testUserAnswers = [];
const difficultyPoints = { easy: 1, medium: 2, hard: 3 };

// Progress tracking - stored in localStorage
let categoryProgress = {}; // { categoryName: { quiz: bool, cards: bool, test: bool, testScore: number, testMaxScore: number } }

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  loadCategories();
  attachEventListeners();
  loadLeaderboard();
});

function loadProgress() {
  const saved = localStorage.getItem('quizProgress');
  if (saved) {
    categoryProgress = JSON.parse(saved);
  }
}

function saveProgress() {
  localStorage.setItem('quizProgress', JSON.stringify(categoryProgress));
}

function attachEventListeners() {
  // Category selection
  document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
  document.getElementById('continueBtn').addEventListener('click', continueToModes);

  // Mode buttons
  document.getElementById('quizModeBtn').addEventListener('click', () => startMode('quiz'));
  document.getElementById('flashcardModeBtn').addEventListener('click', () => startMode('flashcard'));
  document.getElementById('testModeBtn').addEventListener('click', () => startMode('test'));

  // Back buttons
  document.getElementById('backFromModeBtn').addEventListener('click', backToCategories);
  document.getElementById('backFromQuizBtn').addEventListener('click', backToModeSelection);
  document.getElementById('backFromFlashcardBtn').addEventListener('click', backToModeSelection);
  document.getElementById('backFromResultsBtn').addEventListener('click', backToCategories);

  // Navigation
  document.getElementById('prevBtnQuiz').addEventListener('click', () => navigateQuiz(-1));
  document.getElementById('nextBtnQuiz').addEventListener('click', () => navigateQuiz(1));
  document.getElementById('prevBtnFlashcard').addEventListener('click', () => navigateFlashcard(-1));
  document.getElementById('nextBtnFlashcard').addEventListener('click', () => navigateFlashcard(1));
  document.getElementById('prevBtnTest').addEventListener('click', () => navigateTest(-1));
  document.getElementById('nextBtnTest').addEventListener('click', () => navigateTest(1));

  // Flashcard flip
  document.getElementById('flashcard').addEventListener('click', flipCard);

  // Leaderboard
  document.getElementById('submitScoreBtn').addEventListener('click', submitScore);
}

async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    
    categories.forEach(category => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.dataset.category = category;
      
      // Check if category is completed
      const progress = categoryProgress[category];
      const isCompleted = progress && progress.quiz && progress.cards && progress.test;
      
      // Create button content
      let btnContent = '';
      
      if (isCompleted) {
        btn.classList.add('completed');
        const score = progress.testScore || 0;
        const maxScore = progress.testMaxScore || 0;
        btnContent = `<span class="check-mark">✓</span> ${category.toUpperCase()}<br><span class="category-score">${score}/${maxScore}</span>`;
      } else {
        btnContent = category.toUpperCase();
      }
      
      btn.innerHTML = btnContent;
      btn.addEventListener('click', () => toggleCategorySelection(category, btn));
      container.appendChild(btn);
      
      // Initialize progress if not exists
      if (!categoryProgress[category]) {
        categoryProgress[category] = { quiz: false, cards: false, test: false, testScore: 0, testMaxScore: 0 };
      }
    });
    
    updateProgressBar();
  } catch (error) {
    console.error('Error loading categories:', error);
    alert('Failed to load categories');
  }
}

function toggleCategorySelection(category, btn) {
  if (selectedCategories.includes(category)) {
    selectedCategories = selectedCategories.filter(c => c !== category);
    btn.classList.remove('selected');
  } else {
    selectedCategories.push(category);
    btn.classList.add('selected');
  }
  
  // Enable/disable continue button
  const continueBtn = document.getElementById('continueBtn');
  continueBtn.disabled = selectedCategories.length === 0;
  
  // Update button text to show count
  if (selectedCategories.length > 0) {
    continueBtn.textContent = `CONTINUE (${selectedCategories.length}) →`;
  } else {
    continueBtn.textContent = 'CONTINUE →';
  }
}

function clearSelection() {
  selectedCategories = [];
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  const continueBtn = document.getElementById('continueBtn');
  continueBtn.disabled = true;
  continueBtn.textContent = 'CONTINUE →';
}

function updateProgressBar() {
  const totalCategories = Object.keys(categoryProgress).length;
  let completedCategories = 0;
  
  Object.values(categoryProgress).forEach(progress => {
    if (progress.quiz && progress.cards && progress.test) {
      completedCategories++;
    }
  });
  
  const percentage = totalCategories > 0 ? (completedCategories / totalCategories) * 100 : 0;
  document.getElementById('categoryProgressFill').style.width = percentage + '%';
  document.getElementById('categoryProgressText').textContent = 
    `${completedCategories} / ${totalCategories} CATEGORIES COMPLETED`;
}

async function continueToModes() {
  if (selectedCategories.length === 0) return;
  
  try {
    // Fetch questions for selected categories
    const response = await fetch('/api/questions/multiple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: selectedCategories })
    });
    questions = await response.json();
    
    if (questions.length === 0) {
      alert('No questions found for selected categories');
      return;
    }
    
    // Update mode selection screen
    document.getElementById('selectedCategoriesDisplay').textContent = 
      `SELECTED: ${selectedCategories.map(c => c.toUpperCase()).join(', ')}`;
    
    updateModeStatus();
    showScreen('modeScreen');
  } catch (error) {
    console.error('Error loading questions:', error);
    alert('Failed to load questions');
  }
}

function updateModeStatus() {
  // Check if all selected categories have completed each mode
  const allQuizDone = selectedCategories.every(cat => categoryProgress[cat]?.quiz);
  const allCardsDone = selectedCategories.every(cat => categoryProgress[cat]?.cards);
  const allTestDone = selectedCategories.every(cat => categoryProgress[cat]?.test);
  
  document.getElementById('quizStatus').textContent = allQuizDone ? '✓ DONE' : '';
  document.getElementById('cardsStatus').textContent = allCardsDone ? '✓ DONE' : '';
  document.getElementById('testStatus').textContent = allTestDone ? '✓ DONE' : '';
  
  // Disable test mode if quiz and cards not completed
  const testBtn = document.getElementById('testModeBtn');
  if (!allQuizDone || !allCardsDone) {
    testBtn.disabled = true;
    testBtn.classList.add('locked');
    document.getElementById('testStatus').textContent = '🔒 LOCKED';
  } else {
    testBtn.disabled = false;
    testBtn.classList.remove('locked');
  }
}

function startMode(mode) {
  currentMode = mode;
  currentIndex = 0;
  userAnswers = {};
  
  if (mode === 'quiz') {
    showScreen('quizScreen');
    displayQuizQuestion();
  } else if (mode === 'flashcard') {
    showScreen('flashcardScreen');
    displayFlashcardQuestion();
  } else if (mode === 'test') {
    startTestMode();
  }
}

function displayQuizQuestion() {
  const question = questions[currentIndex];
  
  // Update progress
  const progress = ((currentIndex + 1) / questions.length) * 100;
  document.getElementById('progressFill').style.width = progress + '%';
  document.getElementById('questionCounter').textContent = `Q${currentIndex + 1}/${questions.length}`;
  
  // Display question
  document.getElementById('questionText').textContent = question.question;
  
  const optionsContainer = document.getElementById('optionsContainer');
  optionsContainer.innerHTML = '';
  
  question.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = option;
    
    // Check if this question was answered
    if (userAnswers[currentIndex] !== undefined) {
      const selectedIndex = userAnswers[currentIndex];
      
      if (index === question.correctIndex) {
        btn.classList.add('correct');
      } else if (index === selectedIndex && selectedIndex !== question.correctIndex) {
        btn.classList.add('incorrect');
      }
      
      btn.addEventListener('click', () => answerQuestion(index));
    } else {
      btn.addEventListener('click', () => answerQuestion(index));
    }
    
    optionsContainer.appendChild(btn);
  });
  
  // Show feedback if already answered
  if (userAnswers[currentIndex] !== undefined) {
    showFeedback(userAnswers[currentIndex]);
  } else {
    document.getElementById('feedbackContainer').className = 'feedback-hidden';
  }
  
  updateNavigationButtons();
}

function answerQuestion(selectedIndex) {
  const question = questions[currentIndex];
  userAnswers[currentIndex] = selectedIndex;
  
  displayQuizQuestion();
  showFeedback(selectedIndex);
  updateNavigationButtons();
}

function showFeedback(selectedIndex) {
  const question = questions[currentIndex];
  const isCorrect = selectedIndex === question.correctIndex;
  
  const feedbackContainer = document.getElementById('feedbackContainer');
  const feedbackResult = document.getElementById('feedbackResult');
  const feedbackExplanation = document.getElementById('feedbackExplanation');
  
  if (isCorrect) {
    feedbackResult.textContent = '> CORRECT!';
    feedbackResult.className = 'feedback-result correct';
    feedbackExplanation.textContent = question.correctExplanation || question.explanation || 'Well done!';
  } else {
    feedbackResult.textContent = '> WRONG!';
    feedbackResult.className = 'feedback-result incorrect';
    feedbackExplanation.textContent = question.wrongExplanations?.[selectedIndex] || question.explanation || 'Check the correct answer above.';
  }
  
  feedbackContainer.className = 'feedback-content';
}

function navigateQuiz(direction) {
  const newIndex = currentIndex + direction;
  
  if (newIndex >= 0 && newIndex < questions.length) {
    currentIndex = newIndex;
    displayQuizQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (newIndex >= questions.length) {
    // Quiz completed
    completeMode('quiz');
    backToModeSelection();
  }
}

function displayFlashcardQuestion() {
  const question = questions[currentIndex];
  
  // Update progress
  const progress = ((currentIndex + 1) / questions.length) * 100;
  document.getElementById('flashcardProgressFill').style.width = progress + '%';
  document.getElementById('flashcardCounter').textContent = `CARD ${currentIndex + 1}/${questions.length}`;
  
  // Display question and answer
  document.getElementById('flashcardQuestion').textContent = question.question;
  document.getElementById('flashcardAnswer').textContent = question.options[question.correctIndex];
  
  // Reset flip
  const flashcard = document.getElementById('flashcard');
  flashcard.classList.remove('flipped');
  
  updateNavigationButtons();
}

function flipCard() {
  const flashcard = document.getElementById('flashcard');
  flashcard.classList.toggle('flipped');
}

function navigateFlashcard(direction) {
  const newIndex = currentIndex + direction;
  
  if (newIndex >= 0 && newIndex < questions.length) {
    currentIndex = newIndex;
    displayFlashcardQuestion();
  } else if (newIndex >= questions.length) {
    // Flashcards completed
    completeMode('cards');
    backToModeSelection();
  }
}

// TEST MODE FUNCTIONS
async function startTestMode() {
  try {
    // Use the multiple categories endpoint
    const response = await fetch('/api/questions/multiple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: selectedCategories })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    testQuestions = await response.json();
    
    if (testQuestions.length < 8) {
      alert('Not enough questions for test mode (minimum 8 required)');
      return;
    }
    
    testIndex = 0;
    testUserAnswers = [];
    
    showScreen('testScreen');
    displayTestQuestion();
  } catch (error) {
    console.error('Error loading test questions:', error);
    alert('Failed to load test questions: ' + error.message);
  }
}

function displayTestQuestion() {
  const q = testQuestions[testIndex];
  
  // Update progress
  const progress = ((testIndex + 1) / testQuestions.length) * 100;
  document.getElementById('testProgressFill').style.width = progress + '%';
  document.getElementById('testCounter').textContent = `Q${testIndex + 1}/${testQuestions.length}`;
  
  // Hide all containers
  document.getElementById('testOptionsContainer').classList.add('hidden');
  document.getElementById('testMatchContainer').classList.add('hidden');
  document.getElementById('testShortAnswerContainer').classList.add('hidden');
  
  if (testIndex < 4) {
    // Multiple Choice
    document.getElementById('testQuestionText').textContent = q.question;
    document.getElementById('testOptionsContainer').classList.remove('hidden');
    
    const container = document.getElementById('testOptionsContainer');
    container.innerHTML = '';
    
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.textContent = opt;
      
      // Prevent immediate navigation - use mousedown/click properly
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectTestOption(i);
      });
      
      const prevAnswer = testUserAnswers[testIndex];
      if (prevAnswer !== undefined && prevAnswer === i) {
        btn.classList.add('selected');
      }
      
      container.appendChild(btn);
    });
  } else if (testIndex === 4) {
    // Matching
    document.getElementById('testQuestionText').textContent = 'MATCH THE QUESTION TO THE ANSWER';
    document.getElementById('testMatchContainer').classList.remove('hidden');
    
    const matchDiv = document.getElementById('testMatchContainer');
    matchDiv.innerHTML = '';
    
    const matchQs = testQuestions.slice(4, Math.min(7, testQuestions.length));
    const answers = matchQs.map(mq => mq.options[mq.correctIndex]);
    shuffleArray(answers);
    
    matchQs.forEach((mq, i) => {
      const div = document.createElement('div');
      div.className = 'test-match-item';
      
      const qDiv = document.createElement('div');
      qDiv.className = 'test-match-question';
      qDiv.textContent = `Q${5 + i}: ${mq.question}`;
      
      const select = document.createElement('select');
      select.className = 'test-match-select';
      select.dataset.index = i;
      
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'SELECT ANSWER';
      select.appendChild(defaultOpt);
      
      answers.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        select.appendChild(opt);
      });
      
      const prevAnswer = testUserAnswers[testIndex];
      if (prevAnswer && prevAnswer[i]) {
        select.value = prevAnswer[i];
      }
      
      div.appendChild(qDiv);
      div.appendChild(select);
      matchDiv.appendChild(div);
    });
  } else {
    // Short Answer
    document.getElementById('testQuestionText').textContent = q.question;
    document.getElementById('testShortAnswerContainer').classList.remove('hidden');
    
    const input = document.getElementById('testShortAnswer');
    const prevAnswer = testUserAnswers[testIndex];
    input.value = prevAnswer || '';
  }
  
  updateTestNavigation();
}

function selectTestOption(index) {
  testUserAnswers[testIndex] = index;
  
  const buttons = document.querySelectorAll('#testOptionsContainer .option');
  buttons.forEach((btn, i) => {
    if (i === index) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function navigateTest(direction) {
  saveCurrentTestAnswer();
  
  const newIndex = testIndex + direction;
  
  if (newIndex >= 0 && newIndex < testQuestions.length) {
    testIndex = newIndex;
    displayTestQuestion();
  } else if (newIndex >= testQuestions.length) {
    showTestResults();
  }
}

function saveCurrentTestAnswer() {
  if (testIndex < 4) {
    // Already saved via selectTestOption
  } else if (testIndex === 4) {
    const selects = document.querySelectorAll('#testMatchContainer select');
    const answers = [];
    selects.forEach(sel => answers.push(sel.value));
    testUserAnswers[testIndex] = answers;
  } else {
    const input = document.getElementById('testShortAnswer');
    testUserAnswers[testIndex] = input.value.trim();
  }
}

function showTestResults() {
  saveCurrentTestAnswer();
  
  showScreen('testResultsScreen');
  
  let totalScore = 0;
  let maxScore = 0;
  
  testQuestions.forEach((q, i) => {
    // Each question is worth 1 point
    const points = 1;
    maxScore += points;
    
    if (i < 4) {
      if (testUserAnswers[i] === q.correctIndex) {
        totalScore += points;
      }
    } else if (i >= 4 && i < 7) {
      if (i === 4 && testUserAnswers[4]) {
        testQuestions.slice(4, 7).forEach((mq, idx) => {
          const correctAns = mq.options[mq.correctIndex];
          if (testUserAnswers[4][idx] === correctAns) {
            totalScore += 1;
          }
        });
      }
    } else {
      const correctAns = q.options[q.correctIndex];
      if (testUserAnswers[i] && testUserAnswers[i].toLowerCase() === correctAns.toLowerCase()) {
        totalScore += points;
      }
    }
  });
  
  document.getElementById('testResultsScore').textContent = `SCORE: ${totalScore} / ${maxScore} POINTS`;
  
  const summaryDiv = document.getElementById('testResultsSummary');
  summaryDiv.innerHTML = '';
  
  testQuestions.forEach((q, i) => {
    if (i >= 4 && i < 7 && i !== 4) return;
    
    const div = document.createElement('div');
    div.className = 'summary-item';
    
    let isCorrect = false;
    let content = '';
    
    if (i < 4) {
      const userAns = testUserAnswers[i] !== undefined ? q.options[testUserAnswers[i]] : 'NO ANSWER';
      const correctAns = q.options[q.correctIndex];
      isCorrect = testUserAnswers[i] === q.correctIndex;
      content = `<strong>Q${i + 1}: ${q.question}</strong><br>YOUR ANSWER: ${userAns}<br>CORRECT: ${correctAns}<br>EXPLANATION: ${q.explanation || 'N/A'}`;
    } else if (i === 4) {
      content = '<strong>MATCHING QUESTIONS (Q5-Q7)</strong><br>';
      let allCorrect = true;
      testQuestions.slice(4, 7).forEach((mq, idx) => {
        const ua = testUserAnswers[4] ? testUserAnswers[4][idx] : 'NO ANSWER';
        const ca = mq.options[mq.correctIndex];
        const ic = ua === ca;
        if (!ic) allCorrect = false;
        content += `<br>Q${5 + idx}: ${mq.question}<br>YOUR ANSWER: ${ua}<br>CORRECT: ${ca}<br>`;
      });
      isCorrect = allCorrect;
    } else {
      const userAns = testUserAnswers[i] || 'NO ANSWER';
      const correctAns = q.options[q.correctIndex];
      isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
      content = `<strong>Q${i + 1}: ${q.question}</strong><br>YOUR ANSWER: ${userAns}<br>CORRECT: ${correctAns}<br>EXPLANATION: ${q.explanation || 'N/A'}`;
    }
    
    div.innerHTML = content;
    div.classList.add(isCorrect ? 'correct' : 'wrong');
    summaryDiv.appendChild(div);
  });
  
  // Save test score to progress
  selectedCategories.forEach(cat => {
    categoryProgress[cat].testScore = totalScore;
    categoryProgress[cat].testMaxScore = maxScore;
  });
  
  // Mark test as complete
  completeMode('test');
}

function completeMode(mode) {
  // When completing quiz or cards, mark both as complete since they use the same questions
  selectedCategories.forEach(cat => {
    if (mode === 'quiz' || mode === 'cards') {
      categoryProgress[cat]['quiz'] = true;
      categoryProgress[cat]['cards'] = true;
    } else {
      categoryProgress[cat][mode] = true;
    }
  });
  saveProgress();
  updateProgressBar();
}

function updateTestNavigation() {
  const isFirst = testIndex === 0;
  const isLast = testIndex >= testQuestions.length - 1;
  
  document.getElementById('prevBtnTest').disabled = isFirst;
  document.getElementById('nextBtnTest').textContent = isLast ? 'FINISH →' : 'NEXT →';
}

function updateNavigationButtons() {
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === questions.length - 1;
  
  if (currentMode === 'quiz') {
    document.getElementById('prevBtnQuiz').disabled = isFirstQuestion;
    document.getElementById('nextBtnQuiz').disabled = false; // Always enable next in quiz
    document.getElementById('nextBtnQuiz').textContent = isLastQuestion ? 'FINISH →' : 'NEXT →';
  } else if (currentMode === 'flashcard') {
    document.getElementById('prevBtnFlashcard').disabled = isFirstQuestion;
    document.getElementById('nextBtnFlashcard').disabled = false; // Always enable next in flashcard
    document.getElementById('nextBtnFlashcard').textContent = isLastQuestion ? 'FINISH →' : 'NEXT →';
  }
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function backToCategories() {
  selectedCategories = [];
  currentMode = null;
  questions = [];
  currentIndex = 0;
  userAnswers = {};
  testQuestions = [];
  testIndex = 0;
  testUserAnswers = [];
  loadCategories();
  showScreen('welcomeScreen');
}

function backToModeSelection() {
  currentMode = null;
  currentIndex = 0;
  userAnswers = {};
  updateModeStatus();
  showScreen('modeScreen');
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* -----------------------------------
   LEADERBOARD SYSTEM (LOCALSTORAGE)
----------------------------------- */

function loadLeaderboard() {
  const board = JSON.parse(localStorage.getItem("leaderboard") || "[]");

  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";

  if (board.length === 0) {
    list.innerHTML = `<div class="leaderboard-item">No scores yet.</div>`;
    return;
  }

  board
    .sort((a, b) => b.score - a.score)
    .forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "leaderboard-item";
      if (index < 3) item.classList.add("top-3");

      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-name">${entry.name}</span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      list.appendChild(item);
    });
}

// Handle score submission
function submitScore() {
  const name = document.getElementById("usernameInput").value.trim();
  if (!name) return alert("Enter a name first!");

  const scoreText = document.getElementById("testResultsScore").textContent;
  const score = parseInt(scoreText.match(/\d+/)[0], 10);

  const board = JSON.parse(localStorage.getItem("leaderboard") || "[]");
  board.push({ name, score });

  localStorage.setItem("leaderboard", JSON.stringify(board));

  loadLeaderboard();
  alert("Score submitted!");

  // hide input after submitting
  document.getElementById("usernameSection").style.display = "none";
}
