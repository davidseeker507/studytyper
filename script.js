document.addEventListener('DOMContentLoaded', () => {
  const inputText = document.getElementById('inputText');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const setupSection = document.getElementById('setupSection');
  const raceSection = document.getElementById('raceSection');
  const displayText = document.getElementById('displayText');
  const typeInput = document.getElementById('typeInput');
  const timeStat = document.getElementById('timeStat');
  const wpmStat = document.getElementById('wpmStat');
  const accuracyStat = document.getElementById('accuracyStat');
  const resultModal = document.getElementById('resultModal');
  const resultSummary = document.getElementById('resultSummary');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const themeToggle = document.getElementById('themeToggle');

  let text = '';
  let timerInterval = null;
  let startTime = null;
  let cheated = false;

  // Sample texts
  const sampleTexts = {
    lorem: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur euismod, nisl at convallis elementum, felis purus gravida nisl, in cursus enim elit in nisl.`,
    declaration: `We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.`,
    twister: `She sells seashells by the seashore. The shells she sells are surely seashells.`
  };

  const sampleSelect = document.getElementById('sampleSelect');
  const fileInput = document.getElementById('fileInput');
  const progressBar = document.getElementById('progressBar');
  const errorStat = document.getElementById('errorStat');
  const cpmStat = document.getElementById('cpmStat');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownText = document.getElementById('countdownText');
  const historyTableBody = document.querySelector('#historyTable tbody');

  let errorCount = 0;

  // --- Sound setup ---
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  function beep(freq, duration=0.05) {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.frequency.value = freq;
    oscillator.type = 'square';
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, duration * 1000);
  }

  function playKeySound() { beep(880, 0.03); }
  function playFinishSound() { beep(440, 0.2); }

  // Load history from localStorage
  loadHistory();

  // Enable start button when textarea has content
  inputText.addEventListener('input', () => {
    startBtn.disabled = inputText.value.trim().length === 0;
  });

  startBtn.addEventListener('click', () => {
    text = inputText.value.trim();
    if (!text) return;

    // Prepare display but keep raceSection hidden until countdown ends
    renderText(text);
    resetStats();

    // Show countdown overlay
    let counter = 3;
    countdownText.textContent = counter;
    countdownOverlay.classList.remove('hidden');

    const countdownInterval = setInterval(() => {
      counter--;
      if (counter === 0) {
        countdownText.textContent = 'Go!';
      } else {
        countdownText.textContent = counter;
      }
      if (counter < 0) {
        clearInterval(countdownInterval);
        countdownOverlay.classList.add('hidden');

        // Show race section
        setupSection.classList.add('hidden');
        raceSection.classList.remove('hidden');
        typeInput.focus();
      }
    }, 1000);
  });

  resetBtn.addEventListener('click', resetAll);

  typeInput.addEventListener('input', handleTyping);

  closeModalBtn.addEventListener('click', () => {
    smoothCloseModal();
  });

  function smoothCloseModal() {
    if (resultModal.classList.contains('hidden')) return;
    resultModal.classList.add('closing');
    // Wait for transition end on overlay
    resultModal.addEventListener('transitionend', handleEnd);

    function handleEnd(e) {
      if (e.target !== resultModal) return; // ensure overlay event
      resultModal.removeEventListener('transitionend', handleEnd);
      resultModal.classList.remove('closing');
      resultModal.classList.add('hidden');
    }
  }

  // --- Theme handling ---
  const storedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme ? storedTheme === 'dark' : prefersDark);

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
  });

  function applyTheme(dark) {
    if (dark) {
      document.body.classList.add('dark');
      themeToggle.textContent = '☀️';
    } else {
      document.body.classList.remove('dark');
      themeToggle.textContent = '🌙';
    }
  }

  function renderText(str) {
    // Clear previous content
    displayText.innerHTML = '';
    for (let ch of str) {
      const span = document.createElement('span');
      span.textContent = ch;
      displayText.appendChild(span);
    }
    highlightCurrentChar(0);
  }

  function handleTyping() {
    const typed = typeInput.value;
    if (typed.length === 1 && !startTime) {
      startTimer();
    }

    let correctChars = 0;
    errorCount = 0;

    for (let i = 0; i < displayText.children.length; i++) {
      const span = displayText.children[i];
      const char = typed[i];

      if (char == null) {
        span.className = '';
      } else if (char === span.textContent) {
        span.className = 'correct';
        correctChars++;
      } else {
        span.className = 'incorrect';
        errorCount++;
      }
    }

    playKeySound();
    highlightCurrentChar(typed.length);

    updateStats(correctChars, typed.length);

    // Update error + progress
    errorStat.textContent = errorCount;
    const progressPercent = (typed.length / text.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    if (typed.length === text.length) {
      finish();
    }
  }

  function highlightCurrentChar(position) {
    [...displayText.children].forEach(span => span.classList.remove('current'));
    if (position < displayText.children.length) {
      displayText.children[position].classList.add('current');
    }
  }

  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      timeStat.textContent = `${seconds}s`;
    }, 1000);
  }

  function resetStats() {
    startTime = null;
    clearInterval(timerInterval);
    timeStat.textContent = '0s';
    wpmStat.textContent = '0';
    accuracyStat.textContent = '100%';
    typeInput.value = '';
  }

  function updateStats(correctChars, typedChars) {
    if (cheated) return;

    const minutes = startTime ? (Date.now() - startTime) / 60000 : 0;
    const elapsedSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;
    const wpm = minutes > 0 ? Math.round((correctChars / 5) / minutes) : 0;
    const accuracy = typedChars > 0 ? Math.round((correctChars / typedChars) * 100) : 100;
    const cpm = minutes > 0 ? Math.round(correctChars / minutes) : 0;
    if (!cheated && elapsedSeconds >= 5 && wpm > 300) {
      handleCheat();
      return;
    }
    wpmStat.textContent = wpm;
    accuracyStat.textContent = `${accuracy}%`;
    cpmStat.textContent = cpm;
  }

  function handleCheat() {
    // If result modal is currently open for another reason, close it smoothly first
    if (!resultModal.classList.contains('hidden')) {
      smoothCloseModal();
    }
    cheated = true;
    clearInterval(timerInterval);

    // Reset view to start page
    setupSection.classList.remove('hidden');
    raceSection.classList.add('hidden');
    typeInput.disabled = false;
    inputText.value = '';
    startBtn.disabled = true;
    displayText.innerHTML = '';
    resetStats();

    // Show warning message
    resultSummary.innerHTML = 'Whoa! Over 300 WPM? Please stop cheating and try again.';
    resultModal.classList.remove('hidden');
  }

  function finish() {
    clearInterval(timerInterval);
    typeInput.disabled = true;
    highlightCurrentChar(text.length - 1);

    // Prepare and show results
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const wpm = wpmStat.textContent;
    const accuracy = accuracyStat.textContent;
    const chars = text.length;
    const words = text.trim().split(/\s+/).length;

    resultSummary.innerHTML = `You typed <strong>${chars}</strong> characters (<strong>${words}</strong> words) in <strong>${elapsedSeconds}</strong> seconds.<br/>WPM: <strong>${wpm}</strong> &bull; Accuracy: <strong>${accuracy}</strong>`;
    resultModal.classList.remove('hidden');

    playFinishSound();

    // Save session to history
    const session = {
      date: new Date().toLocaleString(),
      wpm: wpm,
      accuracy: accuracy,
      words: words,
      time: elapsedSeconds
    };
    pushHistory(session);

    // Return to start view beneath the modal
    setupSection.classList.remove('hidden');
    raceSection.classList.add('hidden');
    typeInput.disabled = false;
    inputText.value = '';
    startBtn.disabled = true;
    displayText.innerHTML = '';
    resetStats();
  }

  function resetAll() {
    cheated = false;
    smoothCloseModal();
    setupSection.classList.remove('hidden');
    raceSection.classList.add('hidden');
    typeInput.disabled = false;
    inputText.value = '';
    startBtn.disabled = true;
    displayText.innerHTML = '';
    resetStats();
  }

  sampleSelect.addEventListener('change', () => {
    const key = sampleSelect.value;
    if (sampleTexts[key]) {
      inputText.value = sampleTexts[key];
      startBtn.disabled = false;
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      inputText.value = ev.target.result;
      startBtn.disabled = inputText.value.trim().length === 0;
    };
    reader.readAsText(file);
  });

  function pushHistory(session) {
    const hist = JSON.parse(localStorage.getItem('history') || '[]');
    hist.unshift(session);
    localStorage.setItem('history', JSON.stringify(hist.slice(0, 20))); // keep last 20
    loadHistory();
  }

  function loadHistory() {
    const hist = JSON.parse(localStorage.getItem('history') || '[]');
    historyTableBody.innerHTML = '';
    hist.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${h.date}</td><td>${h.wpm}</td><td>${h.accuracy}%</td><td>${h.words}</td><td>${h.time}</td>`;
      historyTableBody.appendChild(tr);
    });
  }
}); 