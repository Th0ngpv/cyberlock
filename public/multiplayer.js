// FILE: public/multiplayer.js (UPDATED)

// Initialize Firebase
let db;

async function initFirebase() {
  const res = await fetch('/api/firebase-config');
  const firebaseConfig = await res.json();

  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

initFirebase();

// Multiplayer State
let currentRoom = null;
let currentPlayer = null;
let roomListener = null;
let isHost = false;
let pendingMultiplayerAction = null; // 'create' or 'join'

// Generate Room Code
function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// NEW: Handle Create Room button - show categories first
async function initiateCreateRoom() {
  pendingMultiplayerAction = 'create';
  currentMode = 'multiplayer-create';
  
  // Load categories
  await loadCategories();
  
  // Show category selection
  showScreen('welcomeScreen');
  
  // Update heading
  document.querySelector('#welcomeScreen h1').textContent = `▓▓ SELECT CATEGORIES FOR MULTIPLAYER ▓▓`;
}

// NEW: Handle Join Room button - can join without selecting categories
async function initiateJoinRoom() {
  joinMultiplayerRoom();
}

// Update the continue button handler in live.js to check for multiplayer
// We'll override loadQuestionsAndStart for multiplayer
window.originalLoadQuestionsAndStart = loadQuestionsAndStart;
loadQuestionsAndStart = async function() {
  if (pendingMultiplayerAction === 'create') {
    await createMultiplayerRoomWithCategories();
  } else {
    window.originalLoadQuestionsAndStart();
  }
};

// Create Room (Host) - NOW CALLED AFTER CATEGORIES SELECTED
async function createMultiplayerRoomWithCategories() {
  if (selectedCategories.length === 0) {
    alert('Select at least one category first!');
    return;
  }

  const playerName = prompt('Enter your name:');
  if (!playerName) {
    pendingMultiplayerAction = null;
    return;
  }

  const roomCode = generateRoomCode();
  currentPlayer = playerName;
  currentRoom = roomCode;
  isHost = true;

  // Fetch questions for the room
  const response = await fetch('/api/questions/multiple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: selectedCategories })
  });
  const allQuestions = await response.json();

  // Filter only multiple choice for multiplayer
  const multiplayerQuestions = allQuestions.slice(0, 10); // Take first 10

  // Create room in Firebase
await db.ref(`rooms/${roomCode}`).set({
  host: playerName,
  state: 'waiting',
  currentQuestion: -1,
  scoredQuestions: {},   // ✅ ADD THIS LINE
  questions: multiplayerQuestions,
  categories: selectedCategories,
  players: {
    [playerName]: {
      name: playerName,
      score: 0,
      answers: {}
    }
  },
  createdAt: Date.now()
});


  pendingMultiplayerAction = null;
  showMultiplayerLobby();
  listenToRoom();
}

// Join Room (Player)
async function joinMultiplayerRoom() {
  const roomCode = prompt('Enter room code:');
  if (!roomCode) return;

  const playerName = prompt('Enter your name:');
  if (!playerName) return;

  // Check if room exists
  const roomSnapshot = await db.ref(`rooms/${roomCode}`).once('value');
  if (!roomSnapshot.exists()) {
    alert('Room not found!');
    return;
  }

  const roomData = roomSnapshot.val();
  if (roomData.state !== 'waiting') {
    alert('Game already started!');
    return;
  }

  currentRoom = roomCode;
  currentPlayer = playerName;
  isHost = false;

  // Add player to room
  await db.ref(`rooms/${roomCode}/players/${playerName}`).set({
    name: playerName,
    score: 0,
    answers: {}
  });

  showMultiplayerLobby();
  listenToRoom();
}

// Listen to Room Changes
function listenToRoom() {
  if (roomListener) roomListener.off();

  roomListener = db.ref(`rooms/${currentRoom}`);
  roomListener.on('value', (snapshot) => {
    const roomData = snapshot.val();
    if (!roomData) {
      alert('Room closed!');
      leaveRoom();
      return;
    }

    updateMultiplayerUI(roomData);
  });
}

// Update UI based on room state
function updateMultiplayerUI(roomData) {
  const { state } = roomData;

  if (state === 'waiting') {
    updateLobby(roomData);
  } else if (state === 'playing') {
    showMultiplayerQuestion(roomData);
  } else if (state === 'results') {
    showQuestionResults(roomData);
  } else if (state === 'finished') {
    showFinalResults(roomData);
  }
}

// Show Lobby
function showMultiplayerLobby() {
  showScreen('multiplayerLobbyScreen');
  document.getElementById('mpRoomCode').textContent = currentRoom;
  
  // Show/hide host controls
  document.getElementById('mpHostControls').style.display = isHost ? 'block' : 'none';
}

function updateLobby(roomData) {
  const playersList = document.getElementById('mpPlayersList');
  playersList.innerHTML = '';
  
  Object.values(roomData.players).forEach(player => {
    const div = document.createElement('div');
    div.className = 'mp-player-item';
    div.innerHTML = `
      <span class="mp-player-name">${player.name}</span>
      ${player.name === roomData.host ? '<span class="mp-host-badge">HOST</span>' : ''}
    `;
    playersList.appendChild(div);
  });
}

// Host: Start Game
async function startMultiplayerGame() {
  await db.ref(`rooms/${currentRoom}`).update({
    state: 'playing',
    currentQuestion: 0
  });
}

// Show Question
function showMultiplayerQuestion(roomData) {
  showScreen('multiplayerGameScreen');
  
  const { currentQuestion, questions, players } = roomData;
  const question = questions[currentQuestion];
  
  // Update progress
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  document.getElementById('mpProgressFill').style.width = progress + '%';
  document.getElementById('mpQuestionCounter').textContent = `Q${currentQuestion + 1}/${questions.length}`;
  
  // Display question
  document.getElementById('mpQuestionText').textContent = question.question;
  
  const optionsContainer = document.getElementById('mpOptionsContainer');
  optionsContainer.innerHTML = '';
  
  // Check if already answered
  const hasAnswered = players[currentPlayer]?.answers?.[currentQuestion] !== undefined;
  
  question.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.className = 'option mp-option';
    btn.textContent = option;
    btn.disabled = hasAnswered;
    
    if (hasAnswered && players[currentPlayer].answers[currentQuestion].answer === index) {
      btn.classList.add('selected');
    }
    
    btn.addEventListener('click', () => submitMultiplayerAnswer(index, currentQuestion));
    optionsContainer.appendChild(btn);
  });
  
  if (hasAnswered) {
    document.getElementById('mpWaitingMessage').style.display = 'block';
  } else {
    document.getElementById('mpWaitingMessage').style.display = 'none';
  }
  
  // Show host controls
  if (isHost) {
    document.getElementById('mpShowResultsBtn').style.display = 'block';
  }
}

// Submit Answer
async function submitMultiplayerAnswer(answerIndex, questionIndex) {
  const timestamp = Date.now();
  
  await db.ref(`rooms/${currentRoom}/players/${currentPlayer}/answers/${questionIndex}`).set({
    answer: answerIndex,
    timestamp: timestamp
  });
  
  document.getElementById('mpWaitingMessage').style.display = 'block';
  
  // Disable all buttons
  document.querySelectorAll('.mp-option').forEach(btn => {
    btn.disabled = true;
  });
  document.querySelector(`.mp-option:nth-child(${answerIndex + 1})`).classList.add('selected');
}

// Host: Show Results for Current Question
async function showQuestionResultsHost() {
  document.getElementById('mpShowResultsBtn').disabled = true; // ✅ ADD
  await db.ref(`rooms/${currentRoom}`).update({
    state: 'results'
  });
}


// Show Question Results
async function showQuestionResults(roomData) {
  showScreen('multiplayerResultsScreen');
  
  const { currentQuestion, questions, players } = roomData;
  const question = questions[currentQuestion];
  const correctIndex = question.correctIndex;
  
  // Calculate scores for this question
  const results = [];
  Object.values(players).forEach(player => {
    const answer = player.answers?.[currentQuestion];
    if (answer) {
      const isCorrect = answer.answer === correctIndex;
      const points = isCorrect ? 1000 : 0; // Base points
      results.push({
        name: player.name,
        isCorrect,
        points,
        totalScore: player.score + points
      });
    }
  });
  
  // Sort by points
  results.sort((a, b) => b.points - a.points);
  
  // Display results
  document.getElementById('mpCorrectAnswer').textContent = 
    `Correct Answer: ${question.options[correctIndex]}`;
  
  const resultsList = document.getElementById('mpQuestionResultsList');
  resultsList.innerHTML = '';
  
  results.forEach((result, index) => {
    const div = document.createElement('div');
    div.className = 'mp-result-item';
    div.innerHTML = `
      <span class="mp-result-rank">#${index + 1}</span>
      <span class="mp-result-name">${result.name}</span>
      <span class="mp-result-points ${result.isCorrect ? 'correct' : 'wrong'}">
        ${result.isCorrect ? '✓' : '✗'} ${result.points}
      </span>
    `;
    resultsList.appendChild(div);
  });
// ✅ Score ONLY ONCE per question (host only)
  if (isHost) {
    const scoreLockRef = db.ref(`rooms/${currentRoom}/scoredQuestions/${currentQuestion}`);
    
    // Check if already scored
    const scoredSnapshot = await scoreLockRef.once('value');
    if (!scoredSnapshot.exists()) {
      // Mark as scored first
      await scoreLockRef.set(true);
      
      // Then update scores using simple set operations
      const updates = {};
      results.forEach(result => {
        if (result.points > 0) {
          updates[`players/${result.name}/score`] = result.totalScore;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await db.ref(`rooms/${currentRoom}`).update(updates);
      }
    }
  }


  
  // Show next button only for host
  document.getElementById('mpNextQuestionHostBtn').style.display = isHost ? 'block' : 'none';
}

// Host: Next Question or Finish
async function nextMultiplayerQuestion() {
  const roomSnapshot = await db.ref(`rooms/${currentRoom}`).once('value');
  const roomData = roomSnapshot.val();
  const nextQuestion = roomData.currentQuestion + 1;
  
  if (nextQuestion >= roomData.questions.length) {
    // Game finished
    await db.ref(`rooms/${currentRoom}`).update({
      state: 'finished'
    });
  } else {
    // Next question
    await db.ref(`rooms/${currentRoom}`).update({
      state: 'playing',
      currentQuestion: nextQuestion
    });
  }
  document.getElementById('mpShowResultsBtn').disabled = false;

}

// Show Final Results
function showFinalResults(roomData) {
  showScreen('multiplayerFinalScreen');
  
  const players = Object.values(roomData.players);
  players.sort((a, b) => b.score - a.score);
  
  const finalList = document.getElementById('mpFinalResultsList');
  finalList.innerHTML = '';
  
  players.forEach((player, index) => {
    const div = document.createElement('div');
    div.className = 'mp-final-item';
    if (index < 3) div.classList.add('top-3');
    
    div.innerHTML = `
      <span class="mp-final-rank">#${index + 1}</span>
      <span class="mp-final-name">${player.name}</span>
      <span class="mp-final-score">${player.score}</span>
    `;
    finalList.appendChild(div);
  });
}

// Leave Room
async function leaveRoom() {
  if (roomListener) {
    roomListener.off();
    roomListener = null;
  }
  
  if (currentRoom && currentPlayer) {
    await db.ref(`rooms/${currentRoom}/players/${currentPlayer}`).remove();
  }
  
  currentRoom = null;
  currentPlayer = null;
  isHost = false;
  pendingMultiplayerAction = null;
  
  showScreen('modeScreen');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createRoomBtn').addEventListener('click', initiateCreateRoom);
  document.getElementById('joinRoomBtn').addEventListener('click', initiateJoinRoom);
  document.getElementById('mpStartGameBtn').addEventListener('click', startMultiplayerGame);
  document.getElementById('mpShowResultsBtn').addEventListener('click', showQuestionResultsHost);
  document.getElementById('mpNextQuestionHostBtn').addEventListener('click', nextMultiplayerQuestion);
  document.getElementById('mpBackToLobby').addEventListener('click', leaveRoom);
  document.getElementById('backFromMpLobby').addEventListener('click', leaveRoom);
});
