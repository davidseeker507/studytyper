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

  let text = '';
  let timerInterval = null;
  let startTime = null;

  // Enable start button when textarea has content
  inputText.addEventListener('input', () => {
    startBtn.disabled = inputText.value.trim().length === 0;
  });

  startBtn.addEventListener('click', () => {
    text = inputText.value.trim().replace(/\s+/g, ' ');
    if (!text) return;

    setupSection.classList.add('hidden');
    raceSection.classList.remove('hidden');

    renderText(text);

    resetStats();
    typeInput.focus();
  });

  resetBtn.addEventListener('click', resetAll);

  typeInput.addEventListener('input', handleTyping);

  closeModalBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
  });

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
      }
    }

    highlightCurrentChar(typed.length);

    updateStats(correctChars, typed.length);

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
    const minutes = startTime ? (Date.now() - startTime) / 60000 : 0;
    const wpm = minutes > 0 ? Math.round((correctChars / 5) / minutes) : 0;
    const accuracy = typedChars > 0 ? Math.round((correctChars / typedChars) * 100) : 100;
    wpmStat.textContent = wpm;
    accuracyStat.textContent = `${accuracy}%`;
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
  }

  function resetAll() {
    resultModal.classList.add('hidden');
    setupSection.classList.remove('hidden');
    raceSection.classList.add('hidden');
    typeInput.disabled = false;
    inputText.value = '';
    startBtn.disabled = true;
    displayText.innerHTML = '';
    resetStats();
  }
}); 