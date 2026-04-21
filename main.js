// Configuración de Reconocimiento de Voz
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

// ESTADO GLOBAL
const state = {
  category: '',
  playerNames: ['', ''], // Input inicial para 2 jugadores mínimo
  playersStats: [], // [{ name, turns, totalReactionTime, bestTime, longestWord }]
  usedWords: new Set(),
  currentPlayerIndex: -1,
  lastPlayerIndex: -1,
  timerInterval: null,
  timeRemaining: 10,
  turnStartTime: 0,
  isListening: false
};

// ELEMENTOS DEL DOM
const screens = {
  setup: document.getElementById('setup-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen')
};

// Setup DOM elements
const categoryInput = document.getElementById('category-input');
const playersList = document.getElementById('players-list');
const addPlayerBtn = document.getElementById('add-player-btn');
const startGameBtn = document.getElementById('start-game-btn');

// Game DOM elements
const currentCategoryDisplay = document.getElementById('current-category-display');
const currentPlayerName = document.getElementById('current-player-name');
const timerDisplay = document.getElementById('timer-display');
const timerRingProgress = document.getElementById('timer-ring-progress');
const speechTranscript = document.getElementById('speech-transcript');

// Results DOM elements
const gameOverReason = document.getElementById('game-over-reason');
const statsBody = document.getElementById('stats-body');
const restartBtn = document.getElementById('restart-btn');
const explosionEffect = document.getElementById('explosion-effect');

/* ==================================
             INICIALIZACIÓN
=================================== */
function init() {
  if (!SpeechRecognition) {
    alert("¡Advertencia! Tu navegador no soporta Reconocimiento de Voz. Se recomienda Google Chrome o Edge.");
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    // Queremos que escuche continuamente pero valide por resultados finales
    recognition.continuous = true; 
    recognition.interimResults = false;

    recognition.onresult = handleSpeechResult;
    recognition.onend = () => {
      // Si el juego sigue activo, reiniciar el listener
      if (state.timerInterval && !screens.game.classList.contains('hidden')) {
        try { recognition.start(); } catch(e){}
      }
    };
  }

  renderPlayerInputs();
  bindEvents();
}

function bindEvents() {
  addPlayerBtn.addEventListener('click', () => {
    if (state.playerNames.length < 13) {
      state.playerNames.push('');
      renderPlayerInputs();
    }
  });

  categoryInput.addEventListener('input', validateSetupForm);
  
  startGameBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', showSetupScreen);
}

/* ==================================
          SETUP SCREEN LOGIC
=================================== */
function renderPlayerInputs() {
  playersList.innerHTML = '';
  state.playerNames.forEach((name, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'player-input-wrapper';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Jugador ${index + 1}`;
    input.value = name;
    input.addEventListener('input', (e) => {
      state.playerNames[index] = e.target.value;
      validateSetupForm();
    });

    wrapper.appendChild(input);

    if (state.playerNames.length > 2) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-player-btn';
      removeBtn.innerHTML = '×';
      removeBtn.addEventListener('click', () => {
        state.playerNames.splice(index, 1);
        renderPlayerInputs();
        validateSetupForm();
      });
      wrapper.appendChild(removeBtn);
    }

    playersList.appendChild(wrapper);
  });
  
  validateSetupForm();
}

function validateSetupForm() {
  const isCategoryValid = categoryInput.value.trim().length > 0;
  const arePlayersValid = state.playerNames.every(name => name.trim().length > 0);
  startGameBtn.disabled = !(isCategoryValid && arePlayersValid);
}

function showSetupScreen() {
  switchScreen('setup');
  // Se mantienen los state.playerNames actuales
  renderPlayerInputs();
}

/* ==================================
           GAME LOGIC
=================================== */
function startGame() {
  state.category = categoryInput.value.trim();
  state.usedWords.clear();
  
  // Inicializar estadísticas
  state.playersStats = state.playerNames.map(name => ({
    name: name.trim(),
    turns: 0,
    totalReactionTime: 0,
    bestTime: 999,
    longestWord: ''
  }));

  state.lastPlayerIndex = -1;
  
  currentCategoryDisplay.textContent = state.category;
  
  if (recognition) {
    try { recognition.start(); } catch(e){}
  }

  switchScreen('game');
  nextTurn();
}

function nextTurn() {
  // Limpiar timer si existe
  if (state.timerInterval) clearInterval(state.timerInterval);

  // Seleccionar aleatoriamente
  let nextIndex;
  
  if (state.playersStats.length > 1) {
    do {
      nextIndex = Math.floor(Math.random() * state.playersStats.length);
    } while (nextIndex === state.lastPlayerIndex);
  } else {
    nextIndex = 0;
  }
  
  state.currentPlayerIndex = nextIndex;
  state.lastPlayerIndex = nextIndex;
  
  const currentPlayer = state.playersStats[state.currentPlayerIndex];
  
  // Update UI
  currentPlayerName.textContent = currentPlayer.name;
  // Reiniciar animación del nombre
  currentPlayerName.style.animation = 'none';
  void currentPlayerName.offsetWidth; // trigger reflow
  currentPlayerName.style.animation = 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  speechTranscript.textContent = 'Escuchando...';
  speechTranscript.style.color = '#ddd';

  // Iniciar timer
  state.timeRemaining = 10;
  state.turnStartTime = Date.now();
  updateTimerUI();
  
  state.timerInterval = setInterval(() => {
    state.timeRemaining -= 0.1;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateTimerUI();
      triggerGameOver(`⏱️ ¡El tiempo de ${currentPlayer.name} se agotó!`);
    } else {
      updateTimerUI();
    }
  }, 100); // Actualizamos cada 100ms para que la barra se mueva fluido
}

function updateTimerUI() {
  const timeCeil = Math.ceil(state.timeRemaining);
  timerDisplay.textContent = timeCeil > 0 ? timeCeil : '0';
  
  // Progreso
  const dashoffset = 565.48 - (state.timeRemaining / 10) * 565.48;
  timerRingProgress.style.strokeDashoffset = dashoffset;
  
  if (state.timeRemaining <= 3) {
    timerRingProgress.style.stroke = 'var(--alert-color)';
    timerDisplay.style.color = 'var(--alert-color)';
  } else {
    timerRingProgress.style.stroke = 'var(--primary-color)';
    timerDisplay.style.color = 'white';
  }
}

/* ==================================
          SPEECH HANDLING
=================================== */
function handleSpeechResult(event) {
  if (screens.game.classList.contains('hidden') || state.timeRemaining <= 0) return;

  const resultIndex = event.resultIndex;
  const transcriptRaw = event.results[resultIndex][0].transcript;
  
  // Normalización: pasar a minúsculas y quitar acentos y signos o espacios extra
  const transcriptTrimmed = transcriptRaw.trim();
  const normalized = normalizeWord(transcriptTrimmed);
  
  if (!normalized) return;

  speechTranscript.textContent = `"${transcriptTrimmed}"`;

  // Calcular T_reacción
  const reactionTime = (Date.now() - state.turnStartTime) / 1000;
  const currentPlayer = state.playersStats[state.currentPlayerIndex];

  // Reglas: Comprobar repetición
  if (state.usedWords.has(normalized)) {
    triggerGameOver(`🗣️ ${currentPlayer.name} repitió la palabra: "${transcriptTrimmed}"`);
  } else {
    // Palabra Nueva y válida
    state.usedWords.add(normalized);
    
    // Sumar stats
    currentPlayer.turns += 1;
    currentPlayer.totalReactionTime += reactionTime;
    if (reactionTime < currentPlayer.bestTime) {
      currentPlayer.bestTime = reactionTime;
    }
    if (transcriptTrimmed.length > currentPlayer.longestWord.length) {
      currentPlayer.longestWord = transcriptTrimmed;
    }

    speechTranscript.style.color = 'var(--primary-color)';
    nextTurn();
  }
}

function normalizeWord(word) {
  return word.toLowerCase()
             .normalize("NFD")
             .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
             .replace(/[^a-z0-9 ]/gi, ''); // Quitar signos puntuación
}

/* ==================================
          GAME OVER / RESULTADOS
=================================== */
function triggerGameOver(reasonStr) {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  if (recognition) {
    try { recognition.stop(); } catch(e){}
  }

  // Explosion Effect
  explosionEffect.classList.remove('explode-anim');
  void explosionEffect.offsetWidth;
  explosionEffect.classList.add('explode-anim');
  
  gameOverReason.textContent = reasonStr;
  
  buildResultsTable();
  switchScreen('results');
}

function buildResultsTable() {
  statsBody.innerHTML = '';

  // Preparar estadísticas para ordenar y encontrar meritorios
  let process = [...state.playersStats];
  
  // Buscar récords para los badges
  let recordTime = 999;
  let recordSlower = -1;
  let fastestPlayerName = '';

  let longestWordLength = -1;
  let creativePlayerName = '';

  process.forEach(p => {
    if (p.turns > 0) {
      if (p.bestTime < recordTime) {
        recordTime = p.bestTime;
        fastestPlayerName = p.name;
      }
      if (p.longestWord.length > longestWordLength) {
        longestWordLength = p.longestWord.length;
        creativePlayerName = p.name;
      }
    }
  });

  process.forEach(p => {
    const avg = p.turns > 0 ? (p.totalReactionTime / p.turns).toFixed(2) : '-';
    const best = p.turns > 0 ? p.bestTime.toFixed(2) : '-';
    
    // Badges
    let badgesHtml = '';
    if (p.name === fastestPlayerName && p.turns > 0) {
      badgesHtml += `<span class="badge badge-speed">⚡ Reflejos de Rayo</span>`;
    }
    if (p.name === creativePlayerName && p.turns > 0 && longestWordLength > 3) {
      badgesHtml += `<span class="badge badge-creative">🧠 El más creativo</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${avg}</td>
      <td>${best}</td>
      <td>${badgesHtml}</td>
    `;
    statsBody.appendChild(tr);
  });
}

/* ==================================
          UTILITIES
=================================== */
function switchScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
    screen.classList.add('hidden');
  });
  screens[screenName].classList.remove('hidden');
  // Pequeño timeout para permitir transición
  setTimeout(() => {
    screens[screenName].classList.add('active');
  }, 50);
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);
