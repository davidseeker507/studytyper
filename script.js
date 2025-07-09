import { supabase } from './supabaseClient.js';

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

  function softBeep(freq, duration = 0.06, volume = 0.05) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gainNode.gain.value = volume;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    // quick fade-out to avoid click
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playKeySound() {
    softBeep(600, 0.04, 0.04);
  }

  function playFinishSound() {
    softBeep(500, 0.12, 0.06);
    setTimeout(() => softBeep(700, 0.12, 0.06), 120); // gentle double tone
  }

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
        window.scrollTo({top:0, left:0});
        document.body.classList.add('typing-mode');
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
      const currentSpan = displayText.children[position];
      currentSpan.classList.add('current');
    }
  }

  // Graph variables
  const wpmGraph = document.getElementById('wpmGraph');
  const graphCtx = wpmGraph.getContext ? wpmGraph.getContext('2d') : null;
  let wpmData = [];

  function drawGraph() {
    if (!graphCtx) return;
    const width = wpmGraph.width;
    const height = wpmGraph.height;
    graphCtx.clearRect(0,0,width,height);
    // background grid
    const maxWpm = Math.max(...wpmData, 60);
    const roundedMax = Math.ceil(maxWpm/20)*20;
    graphCtx.strokeStyle = '#333';
    graphCtx.lineWidth = 1;
    for (let yVal = 0; yVal<=roundedMax; yVal+=20){
      const y = height - (yVal/roundedMax)*(height-4)-2;
      graphCtx.beginPath();
      graphCtx.moveTo(0,y);
      graphCtx.lineTo(width,y);
      graphCtx.stroke();
    }

    // area fill
    graphCtx.fillStyle = 'rgba(79,141,242,0.25)';
    graphCtx.beginPath();
    const scaleY = (val)=> height - (val/roundedMax)* (height-4) -2;
    const stepX = width / (wpmData.length-1||1);
    wpmData.forEach((val,idx)=>{
      const x = idx*stepX;
      const y = scaleY(val);
      if(idx===0) graphCtx.moveTo(x,y); else graphCtx.lineTo(x,y);
    });
    graphCtx.lineTo(width,height);
    graphCtx.lineTo(0,height);
    graphCtx.closePath();
    graphCtx.fill();

    // main line
    graphCtx.strokeStyle = '#4f8df2';
    graphCtx.lineWidth = 2;
    graphCtx.beginPath();
    wpmData.forEach((val,idx)=>{
      const x = idx*stepX;
      const y = scaleY(val);
      if(idx===0) graphCtx.moveTo(x,y); else graphCtx.lineTo(x,y);
    });
    graphCtx.stroke();
    // y-axis labels (min and max)
    graphCtx.fillStyle = '#888';
    graphCtx.font = '10px monospace';
    graphCtx.textAlign = 'left';
    graphCtx.fillText(roundedMax+' wpm',2,8);
    graphCtx.fillText('0',2,height-4);
  }

  // modify startTimer to reset graph
  function startTimer() {
    startTime = Date.now();
    wpmData = [];
    drawGraph();
    timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      timeStat.textContent = `${seconds}s`;
      // capture current WPM each second
      const currentWpm = Number(wpmStat.textContent) || 0;
      wpmData.push(currentWpm);
      if (wpmData.length > 60) wpmData.shift();
      drawGraph();
    }, 1000);
  }

  // clear graph in resetStats
  function resetStats() {
    startTime = null;
    clearInterval(timerInterval);
    timeStat.textContent = '0s';
    wpmStat.textContent = '0';
    accuracyStat.textContent = '100%';
    typeInput.value = '';
    wpmData = [];
    drawGraph();
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
    // Keep the original text so users can immediately retry the same material
    // inputText.value remains unchanged
    startBtn.disabled = false;
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
    // Keep the original text so users can immediately retry the same material
    // inputText.value remains unchanged
    startBtn.disabled = false;
    displayText.innerHTML = '';
    resetStats();
    document.body.classList.remove('typing-mode');
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
    document.body.classList.remove('typing-mode');
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
    if (file.size > settings.fileLimitMB * 1024 * 1024) {
      alert(`File exceeds ${settings.fileLimitMB} MB limit.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      inputText.value = ev.target.result;
      startBtn.disabled = inputText.value.trim().length === 0;
    };
    reader.readAsText(file);
  });

  async function pushHistory(session) {
    const { error } = await supabase.from('history').insert(session);
    if (error) console.error('Supabase insert error:', error);
    else loadHistory();
  }

  async function loadHistory() {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase select error:', error);
      return;
    }
    historyTableBody.innerHTML = '';
    data.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${h.date}</td><td>${h.wpm}</td><td>${h.accuracy}%</td><td>${h.words}</td><td>${h.time}</td>`;
      historyTableBody.appendChild(tr);
    });
  }

  // ----- SETTINGS MANAGEMENT -----
  const DEFAULT_SETTINGS = {
    theme: 'system',
    caret: 'underline',
    autoFocus: true,
    fileLimitMB: 1,
    historyLimit: 20,
    focusLine: false,
    font: 'Fira Code',
    themePreset: 'default'
  };
  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem('settings') || '{}')) };
  }
  function saveSettings(s) { localStorage.setItem('settings', JSON.stringify(s)); }

  let settings = getSettings();

  // apply theme on load (override earlier approach)
  applyTheme(settings.theme === 'dark' ? true : settings.theme === 'light' ? false : prefersDark);

  // caret style via body classes
  function applyCaretStyle() {
    document.body.classList.toggle('caret-bar', settings.caret === 'bar');
    document.body.classList.toggle('caret-none', settings.caret === 'none');
  }
  applyCaretStyle();

  // settings modal elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  // populate UI when opened
  settingsBtn.addEventListener('click', () => {
    // open modal
    settingsModal.classList.remove('hidden');
    // reflect current settings
    document.querySelectorAll('input[name="themeChoice"]').forEach(r => r.checked = (r.value === settings.theme));
    document.querySelectorAll('input[name="caretChoice"]').forEach(r => r.checked = (r.value === settings.caret));
    document.getElementById('autoFocusToggle').checked = settings.autoFocus;
    document.getElementById('fileSizeLimit').value = settings.fileLimitMB;
    document.getElementById('historyLimit').value = settings.historyLimit;
    document.getElementById('themePreset').value = settings.themePreset;
  });
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  saveSettingsBtn.addEventListener('click', () => {
    settings.theme = document.querySelector('input[name="themeChoice"]:checked')?.value || settings.theme;
    settings.caret = document.querySelector('input[name="caretChoice"]:checked')?.value || settings.caret;
    settings.autoFocus = document.getElementById('autoFocusToggle').checked;
    settings.fileLimitMB = parseFloat(document.getElementById('fileSizeLimit').value) || settings.fileLimitMB;
    settings.historyLimit = parseInt(document.getElementById('historyLimit').value) || settings.historyLimit;
    settings.themePreset = document.getElementById('themePreset').value;
    saveSettings(settings);
    applyTheme(settings.theme === 'dark' ? true : settings.theme === 'light' ? false : prefersDark);
    applyCaretStyle();
    setThemeVars(THEMES[settings.themePreset]||THEMES.default);
    settingsModal.classList.add('hidden');
  });

  // history export/import
  const exportBtn = document.getElementById('exportHistoryBtn');
  const importInput = document.getElementById('importHistoryInput');
  exportBtn.addEventListener('click', () => {
    const data = localStorage.getItem('history') || '[]';
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'studyTyperHistory.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  importInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const arr = JSON.parse(ev.target.result);
        if (Array.isArray(arr)) {
          localStorage.setItem('history', JSON.stringify(arr));
          loadHistory();
        } else alert('Invalid history file');
      } catch { alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  });

  // Theme presets
  const THEMES = {
    default: { accent:'#f0c674', bg:'#2b2b2b', fg:'#f1f1f1', error:'#ff5f5f'},
    nord   : { accent:'#88c0d0', bg:'#2e3440', fg:'#e5e9f0', error:'#bf616a'},
    dracula: { accent:'#bd93f9', bg:'#282a36', fg:'#f8f8f2', error:'#ff5555'},
    serika : { accent:'#f0c674', bg:'#1b1b1b', fg:'#eaeaea', error:'#ff5f5f'},
    cmyk   : { accent:'#00aaff', bg:'#0d0d0d', fg:'#ffffff', error:'#ff00ff'},
    monokai: { accent:'#f92672', bg:'#272822', fg:'#f8f8f2', error:'#fd971f'}
  };

  function setThemeVars(obj){
    Object.entries(obj).forEach(([k,v])=>document.documentElement.style.setProperty(`--${k}`,v));
  }

  // apply preset on load after applyFont()
  setThemeVars(THEMES[settings.themePreset]||THEMES.default);
}); 