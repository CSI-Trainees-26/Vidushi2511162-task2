/* =========================================================
   STORAGE HELPERS
   Everything in this app lives in localStorage under the
   "ft_" (fitness tracker) prefix so it survives page reloads.
   ========================================================= */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function lastNDates(n) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}
function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/* =========================================================
   APP STATE
   Loaded once at startup, saved back to localStorage after
   every change. Keeping it in memory avoids re-reading
   localStorage on every click.
   ========================================================= */
let tasks       = loadJSON('ft_tasks', []);
let habits      = loadJSON('ft_habits', []);
let water       = loadJSON('ft_water', {});       // { "2026-09-06": 500 }
let sleep       = loadJSON('ft_sleep', {});        // { "2026-09-06": 7.5 }
let calories    = loadJSON('ft_calories', {});     // { "2026-09-06": 1800 }
let savedQuotes = loadJSON('ft_savedQuotes', []);
let pomoStats   = loadJSON('ft_pomoStats', { sessionsCompleted: 0, totalFocusMinutes: 0 });

function persistAll() {
  saveJSON('ft_tasks', tasks);
  saveJSON('ft_habits', habits);
  saveJSON('ft_water', water);
  saveJSON('ft_sleep', sleep);
  saveJSON('ft_calories', calories);
  saveJSON('ft_savedQuotes', savedQuotes);
  saveJSON('ft_pomoStats', pomoStats);
}

/* =========================================================
   NAVIGATION
   A simple single-page app: only one .view has "active" at
   a time. Sidebar buttons (and any "jump to X" button using
   data-target) trigger the switch.
   ========================================================= */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-target="${id}"]`);
  if (navBtn) navBtn.classList.add('active');
  renderAll(); // refresh data every time a view is opened, in case data changed elsewhere
}

document.querySelectorAll('[data-target]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.target));
});

/* Today's date, shown in sidebar + dashboard header */
function renderDates() {
  const niceDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('todayDateMain').textContent = niceDate;
  document.getElementById('todayDateSide').textContent = niceDate;
}

/* =========================================================
   TASK MANAGER
   Tasks are "temporary" (spec 3): title, status (pending/
   completed), and a pomodoroSessions counter that the
   Pomodoro timer increments later.
   ========================================================= */
function addTask(title) {
  tasks.push({ id: uid(), title, status: 'pending', createdAt: todayStr(), pomodoroSessions: 0 });
  persistAll();
  renderAll();
}
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  persistAll();
  renderAll();
}
function editTask(id) {
  const task = tasks.find(t => t.id === id);
  const newTitle = prompt('Edit task', task.title);
  if (newTitle && newTitle.trim()) {
    task.title = newTitle.trim();
    persistAll();
    renderAll();
  }
}
function setTaskStatus(id, status) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = status;
  task.completedAt = status === 'completed' ? todayStr() : null;
  persistAll();
  renderAll();
}

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.status === 'completed' ? ' completed' : '');
  card.draggable = true;
  card.dataset.id = task.id;
  card.innerHTML = `
    <span class="task-title">${escapeHTML(task.title)}</span>
    <span class="task-actions">
      <button class="icon-btn" data-action="edit" title="Edit">✎</button>
      <button class="icon-btn" data-action="delete" title="Delete">✕</button>
    </span>`;
  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', task.id);
  });
  card.querySelector('[data-action="edit"]').addEventListener('click', () => editTask(task.id));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task.id));
  return card;
}

function renderTasks() {
  const pendingList = document.getElementById('pendingList');
  const completedList = document.getElementById('completedList');
  pendingList.innerHTML = '';
  completedList.innerHTML = '';

  const pending = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');

  if (pending.length === 0) pendingList.innerHTML = '<p class="empty-hint">No pending tasks. Add one above.</p>';
  pending.forEach(t => pendingList.appendChild(renderTaskCard(t)));

  if (completed.length === 0) completedList.innerHTML = '<p class="empty-hint">Drag a task here when it\'s done.</p>';
  completed.forEach(t => completedList.appendChild(renderTaskCard(t)));

  document.getElementById('pendingCount').textContent = pending.length;
  document.getElementById('completedCount').textContent = completed.length;
}

/* Drop zones: allow drop, highlight while dragging over, and
   flip the task's status to match the zone it lands on. */
function setupDropZone(zoneId, status) {
  const zone = document.getElementById(zoneId);
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    setTaskStatus(id, status);
  });
}
setupDropZone('pendingList', 'pending');
setupDropZone('completedList', 'completed');

document.getElementById('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('taskInput');
  if (input.value.trim()) {
    addTask(input.value.trim());
    input.value = '';
  }
});

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   HABIT TRACKER
   A habit stores its own "history" map of date -> true, so
   we can both mark today's completion AND draw a graph of
   past days without a separate data structure.
   ========================================================= */
function addHabit(name, category) {
  habits.push({ id: uid(), name, category, history: {} });
  persistAll();
  renderAll();
}
function deleteHabit(id) {
  habits = habits.filter(h => h.id !== id);
  persistAll();
  renderAll();
}
function editHabit(id) {
  const habit = habits.find(h => h.id === id);
  const newName = prompt('Edit habit name', habit.name);
  if (newName && newName.trim()) {
    habit.name = newName.trim();
    persistAll();
    renderAll();
  }
}
function toggleHabitToday(id) {
  const habit = habits.find(h => h.id === id);
  const t = todayStr();
  habit.history[t] = !habit.history[t];
  persistAll();
  renderAll();
}

function renderHabits() {
  const list = document.getElementById('habitList');
  list.innerHTML = '';
  if (habits.length === 0) {
    list.innerHTML = '<p class="empty-hint">No habits yet. Add one above — e.g. "5km run" under Cardio.</p>';
    return;
  }
  const days = lastNDates(28); // 4 weeks of squares
  const today = todayStr();

  habits.forEach(habit => {
    const card = document.createElement('div');
    card.className = 'habit-card';

    const doneToday = !!habit.history[today];
    card.innerHTML = `
      <div class="habit-top">
        <div>
          <span class="habit-name">${escapeHTML(habit.name)}</span>
          <span class="habit-category">${habit.category}</span>
        </div>
        <span class="task-actions">
          <button class="icon-btn" data-action="edit">✎</button>
          <button class="icon-btn" data-action="delete">✕</button>
        </span>
      </div>
      <div class="habit-graph"></div>
      <button class="btn-small ${doneToday ? 'ghost' : ''}" data-action="toggle">
        ${doneToday ? 'Marked done today ✓' : 'Mark done today'}
      </button>
    `;

    const graph = card.querySelector('.habit-graph');
    days.forEach(day => {
      const sq = document.createElement('div');
      sq.className = 'habit-square' + (habit.history[day] ? ' done' : '') + (day === today ? ' today' : '');
      sq.title = day;
      graph.appendChild(sq);
    });

    card.querySelector('[data-action="edit"]').addEventListener('click', () => editHabit(habit.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteHabit(habit.id));
    card.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleHabitToday(habit.id));

    list.appendChild(card);
  });
}

document.getElementById('habitForm').addEventListener('submit', e => {
  e.preventDefault();
  const nameInput = document.getElementById('habitInput');
  const catSelect = document.getElementById('habitCategory');
  if (nameInput.value.trim()) {
    addHabit(nameInput.value.trim(), catSelect.value);
    nameInput.value = '';
  }
});

/* =========================================================
   WATER, SLEEP, CALORIES
   ========================================================= */
const WATER_GOAL = 2000; // ml

function addWater(ml) {
  const t = todayStr();
  water[t] = (water[t] || 0) + ml;
  persistAll();
  renderAll();
}
function logSleep(hours) {
  sleep[todayStr()] = hours;
  persistAll();
  renderAll();
}
function addCalories(kcal) {
  const t = todayStr();
  calories[t] = (calories[t] || 0) + kcal;
  persistAll();
  renderAll();
}

function renderWaterSleep() {
  const t = todayStr();
  const todayWater = water[t] || 0;
  const pct = Math.min(100, Math.round((todayWater / WATER_GOAL) * 100));

  document.getElementById('waterBig').textContent = todayWater + ' ml';
  document.getElementById('waterBarFull').style.width = pct + '%';
  document.getElementById('dashWaterStat').textContent = todayWater + ' ml';
  document.getElementById('dashWaterBar').style.width = pct + '%';

  const todaySleep = sleep[t];
  document.getElementById('sleepBig').textContent = (todaySleep !== undefined ? todaySleep : '—') + ' hrs';
  document.getElementById('dashSleepStat').textContent = (todaySleep !== undefined ? todaySleep : '—') + ' hrs';

  document.getElementById('dashCalStat').textContent = (calories[t] || 0) + ' kcal';

  renderSleepChart('sleepChart');
  renderSleepChart('summarySleepChart');
}

/* Simple 7-day bar chart built from plain divs -- no chart
   library needed for something this small. */
function renderSleepChart(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const days = lastNDates(7);
  const maxHours = Math.max(8, ...days.map(d => sleep[d] || 0));

  days.forEach(day => {
    const hrs = sleep[day] || 0;
    const col = document.createElement('div');
    col.className = 'chart-col';
    const barHeight = Math.round((hrs / maxHours) * 100);
    col.innerHTML = `
      <div class="chart-bar" style="height:${barHeight}%" title="${hrs}h"></div>
      <span class="chart-label">${formatDayLabel(day)}</span>
    `;
    container.appendChild(col);
  });
}

document.getElementById('dashWaterAdd').addEventListener('click', () => addWater(250));
document.getElementById('waterAddFull').addEventListener('click', () => addWater(250));

document.getElementById('dashCalForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('dashCalInput');
  const val = parseInt(input.value, 10);
  if (val > 0) { addCalories(val); input.value = ''; }
});

document.getElementById('dashSleepForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('dashSleepInput');
  const val = parseFloat(input.value);
  if (val >= 0) { logSleep(val); input.value = ''; }
});
document.getElementById('sleepFormFull').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('sleepInputFull');
  const val = parseFloat(input.value);
  if (val >= 0) { logSleep(val); input.value = ''; }
});

/* =========================================================
   POMODORO TIMER
   Simple countdown using setInterval. Work session = 25 min,
   break = 5 min. When a WORK session hits 0:00, we mark it
   complete against the linked task and notify the user.
   ========================================================= */
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

let pomoSecondsLeft = FOCUS_SECONDS;
let pomoInterval = null;
let pomoMode = 'focus'; // 'focus' | 'break'
let pomoLinkedTaskId = '';

function populatePomoTaskSelect() {
  const select = document.getElementById('pomoTaskSelect');
  const current = select.value;
  select.innerHTML = '<option value="">No task selected</option>';
  tasks.filter(t => t.status === 'pending').forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    select.appendChild(opt);
  });
  select.value = current || '';
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updatePomoDisplay() {
  const timeStr = formatTime(pomoSecondsLeft);
  document.getElementById('pomoTimeBig').textContent = timeStr;
  document.getElementById('pomoMode').textContent = pomoMode === 'focus' ? 'Focus session' : 'Break';
  document.getElementById('dashPomoTime').textContent = timeStr;
  const linkedTask = tasks.find(t => t.id === pomoLinkedTaskId);
  document.getElementById('dashPomoTask').textContent = linkedTask ? linkedTask.title : 'No task selected';
}

function pomoTick() {
  pomoSecondsLeft--;
  if (pomoSecondsLeft <= 0) {
    clearInterval(pomoInterval);
    pomoInterval = null;
    handlePomoComplete();
    return;
  }
  updatePomoDisplay();
}

function handlePomoComplete() {
  const banner = document.getElementById('pomoBanner');
  if (pomoMode === 'focus') {
    // Mark session complete + update stats
    pomoStats.sessionsCompleted++;
    pomoStats.totalFocusMinutes += 25;
    const task = tasks.find(t => t.id === pomoLinkedTaskId);
    if (task) task.pomodoroSessions = (task.pomodoroSessions || 0) + 1;
    persistAll();

    banner.textContent = task
      ? `Session complete! "${task.title}" now has ${task.pomodoroSessions} focus session(s).`
      : 'Focus session complete! Time for a break.';
    banner.classList.remove('hidden');
    notifyUser('Pomodoro complete', 'Nice work — take a 5 minute break.');

    pomoMode = 'break';
    pomoSecondsLeft = BREAK_SECONDS;
  } else {
    banner.textContent = 'Break over. Ready for another focus session?';
    banner.classList.remove('hidden');
    notifyUser('Break over', 'Ready to focus again?');
    pomoMode = 'focus';
    pomoSecondsLeft = FOCUS_SECONDS;
  }
  updatePomoDisplay();
  renderAll();
}

function notifyUser(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

document.getElementById('pomoStart').addEventListener('click', () => {
  if (pomoInterval) return; // already running
  pomoLinkedTaskId = document.getElementById('pomoTaskSelect').value;
  document.getElementById('pomoBanner').classList.add('hidden');
  pomoInterval = setInterval(pomoTick, 1000);
});
document.getElementById('pomoPause').addEventListener('click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
});
document.getElementById('pomoReset').addEventListener('click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  pomoMode = 'focus';
  pomoSecondsLeft = FOCUS_SECONDS;
  document.getElementById('pomoBanner').classList.add('hidden');
  updatePomoDisplay();
});

/* =========================================================
   DAILY QUOTE (public API) + SAVED QUOTES (CRUD)
   ========================================================= */
const FALLBACK_QUOTES = [
  { text: 'The only bad workout is the one that didn\'t happen.', author: 'Unknown' },
  { text: 'Small daily improvements lead to staggering long-term results.', author: 'Unknown' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Unknown' },
  { text: 'Progress, not perfection.', author: 'Unknown' },
  { text: 'Your body can stand almost anything. It\'s your mind you have to convince.', author: 'Unknown' }
];

let currentQuote = null;

async function fetchQuote() {
  document.getElementById('dashQuoteText').textContent = 'Loading quote…';
  document.getElementById('dashQuoteAuthor').textContent = '';
  try {
    const res = await fetch('https://api.quotable.io/random?tags=motivational|inspirational');
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    currentQuote = { text: data.content, author: data.author };
  } catch (e) {
    // API unreachable -- fall back to a local quote so the UI never breaks
    currentQuote = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
  }
  document.getElementById('dashQuoteText').textContent = `"${currentQuote.text}"`;
  document.getElementById('dashQuoteAuthor').textContent = currentQuote.author ? `— ${currentQuote.author}` : '';
}

function saveCurrentQuote() {
  if (!currentQuote) return;
  savedQuotes.push({ id: uid(), text: currentQuote.text, author: currentQuote.author || '' });
  persistAll();
  renderAll();
}
function addManualQuote(text, author) {
  savedQuotes.push({ id: uid(), text, author });
  persistAll();
  renderAll();
}
function deleteQuote(id) {
  savedQuotes = savedQuotes.filter(q => q.id !== id);
  persistAll();
  renderAll();
}
function editQuote(id) {
  const q = savedQuotes.find(q => q.id === id);
  const newText = prompt('Edit quote', q.text);
  if (newText && newText.trim()) {
    q.text = newText.trim();
    persistAll();
    renderAll();
  }
}

function renderSavedQuotes() {
  const grid = document.getElementById('savedQuoteList');
  grid.innerHTML = '';
  if (savedQuotes.length === 0) {
    grid.innerHTML = '<p class="empty-hint">No saved quotes yet.</p>';
    return;
  }
  savedQuotes.forEach(q => {
    const card = document.createElement('div');
    card.className = 'saved-quote-card';
    card.innerHTML = `
      <p class="q-text">"${escapeHTML(q.text)}"</p>
      <p class="q-author">${q.author ? '— ' + escapeHTML(q.author) : ''}</p>
      <span class="task-actions">
        <button class="icon-btn" data-action="edit">✎</button>
        <button class="icon-btn" data-action="delete">✕</button>
      </span>`;
    card.querySelector('[data-action="edit"]').addEventListener('click', () => editQuote(q.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteQuote(q.id));
    grid.appendChild(card);
  });
}

document.getElementById('dashQuoteNew').addEventListener('click', fetchQuote);
document.getElementById('dashQuoteSave').addEventListener('click', saveCurrentQuote);
document.getElementById('quoteForm').addEventListener('submit', e => {
  e.preventDefault();
  const textInput = document.getElementById('quoteTextInput');
  const authorInput = document.getElementById('quoteAuthorInput');
  if (textInput.value.trim()) {
    addManualQuote(textInput.value.trim(), authorInput.value.trim());
    textInput.value = '';
    authorInput.value = '';
  }
});
