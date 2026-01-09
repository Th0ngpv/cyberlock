// FILE: public/live.js (MULTIPLAYER VERSION - CLEANED)
let selectedCategories = [];
let categoryProgress = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  attachEventListeners();
  // Start on mode screen for multiplayer
  showScreen('modeScreen');
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
  document.getElementById('continueBtn').addEventListener('click', loadQuestionsAndStart);
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
    continueBtn.textContent = `START MULTIPLAYER (${selectedCategories.length}) →`;
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

// This will be overridden by multiplayer.js
function loadQuestionsAndStart() {
  console.log('loadQuestionsAndStart called - should be overridden by multiplayer.js');
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}
