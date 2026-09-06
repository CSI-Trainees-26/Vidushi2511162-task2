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
let pomoStats   = loadJSON('ft_pomoStats', { sessionsCompleted: 0, totalFocusMinutes: 0, sessionsByDate: {} });

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
   No longer needed as JS logic! Each page is now a real,
   separate HTML file, so the browser itself handles
   navigation via normal <a href="..."> links in the sidebar.
   The "active" nav highlight is just a class written directly
   into each page's HTML at build time.
   ========================================================= */

/* Small helper: only attach a listener if the element actually
   exists on THIS page. Since script.js is now shared across 7
   different pages, most pages only contain some of the elements
   referenced below -- without this guard, the first missing
   element would throw and stop the rest of the script running. */
function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct;
}

/* Today's date, shown in sidebar + page header on every page */
function renderDates() {
  const niceDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  setText('todayDateMain', niceDate);
  setText('todayDateSide', niceDate);
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
  if (!pendingList || !completedList) return; // this page doesn't include the task manager

  pendingList.innerHTML = '';
  completedList.innerHTML = '';

  const pending = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');

  if (pending.length === 0) pendingList.innerHTML = '<p class="empty-hint">No pending tasks. Add one above.</p>';
  pending.forEach(t => pendingList.appendChild(renderTaskCard(t)));

  if (completed.length === 0) completedList.innerHTML = '<p class="empty-hint">Drag a task here when it\'s done.</p>';
  completed.forEach(t => completedList.appendChild(renderTaskCard(t)));

  setText('pendingCount', pending.length);
  setText('completedCount', completed.length);
}

/* Drop zones: allow drop, highlight while dragging over, and
   flip the task's status to match the zone it lands on. */
function setupDropZone(zoneId, status) {
  const zone = document.getElementById(zoneId);
  if (!zone) return; // this page doesn't have this drop zone
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

on('taskForm', 'submit', e => {
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
  if (!list) return; // this page doesn't include the habit tracker
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

on('habitForm', 'submit', e => {
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

  // water-sleep.html elements
  setText('waterBig', todayWater + ' ml');
  setWidth('waterBarFull', pct + '%');
  // dashboard elements (different ids, same underlying data)
  setText('dashWaterStat', todayWater + ' ml');
  setWidth('dashWaterBar', pct + '%');

  const todaySleep = sleep[t];
  const sleepLabel = (todaySleep !== undefined ? todaySleep : '—') + ' hrs';
  setText('sleepBig', sleepLabel);
  setText('dashSleepStat', sleepLabel);

  setText('dashCalStat', (calories[t] || 0) + ' kcal');

  renderSleepChart('sleepChart');
  renderSleepChart('summarySleepChart');
}

/* Simple 7-day bar chart built from plain divs -- no chart
   library needed for something this small. Guarded because it's
   called for both water-sleep.html's chart AND summary.html's
   chart, but a given page only ever has one of the two. */
function renderSleepChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
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

on('dashWaterAdd', 'click', () => addWater(250));
on('waterAddFull', 'click', () => addWater(250));

on('dashCalForm', 'submit', e => {
  e.preventDefault();
  const input = document.getElementById('dashCalInput');
  const val = parseInt(input.value, 10);
  if (val > 0) { addCalories(val); input.value = ''; }
});

on('dashSleepForm', 'submit', e => {
  e.preventDefault();
  const input = document.getElementById('dashSleepInput');
  const val = parseFloat(input.value);
  if (val >= 0) { logSleep(val); input.value = ''; }
});
on('sleepFormFull', 'submit', e => {
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
  if (!select) return; // only exists on pomodoro.html
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

/* Updates the LIVE timer display on pomodoro.html only -- this can't
   sync to other pages since each page is a separate load and the
   countdown lives in memory, not localStorage. */
function updatePomoDisplay() {
  const timeStr = formatTime(pomoSecondsLeft);
  setText('pomoTimeBig', timeStr);
  setText('pomoMode', pomoMode === 'focus' ? 'Focus session' : 'Break');
}

/* Updates the dashboard's pomodoro widget with a persisted stat
   (sessions completed today) instead of a live countdown, since the
   dashboard is a different page load than the running timer. */
function renderDashboardPomo() {
  const today = todayStr();
  const count = (pomoStats.sessionsByDate && pomoStats.sessionsByDate[today]) || 0;
  setText('dashPomoSessions', `${count} session${count === 1 ? '' : 's'} today`);
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
    // Mark session complete + update stats (both lifetime and per-day)
    pomoStats.sessionsCompleted++;
    pomoStats.totalFocusMinutes += 25;
    if (!pomoStats.sessionsByDate) pomoStats.sessionsByDate = {};
    const today = todayStr();
    pomoStats.sessionsByDate[today] = (pomoStats.sessionsByDate[today] || 0) + 1;

    const task = tasks.find(t => t.id === pomoLinkedTaskId);
    if (task) task.pomodoroSessions = (task.pomodoroSessions || 0) + 1;
    persistAll();

    if (banner) {
      banner.textContent = task
        ? `Session complete! "${task.title}" now has ${task.pomodoroSessions} focus session(s).`
        : 'Focus session complete! Time for a break.';
      banner.classList.remove('hidden');
    }
    notifyUser('Pomodoro complete', 'Nice work — take a 5 minute break.');

    pomoMode = 'break';
    pomoSecondsLeft = BREAK_SECONDS;
  } else {
    if (banner) {
      banner.textContent = 'Break over. Ready for another focus session?';
      banner.classList.remove('hidden');
    }
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

on('pomoStart', 'click', () => {
  if (pomoInterval) return; // already running
  pomoLinkedTaskId = document.getElementById('pomoTaskSelect').value;
  const banner = document.getElementById('pomoBanner');
  if (banner) banner.classList.add('hidden');
  pomoInterval = setInterval(pomoTick, 1000);
});
on('pomoPause', 'click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
});
on('pomoReset', 'click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  pomoMode = 'focus';
  pomoSecondsLeft = FOCUS_SECONDS;
  const banner = document.getElementById('pomoBanner');
  if (banner) banner.classList.add('hidden');
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

/* Only the dashboard has the "today's quote" widget -- skip the
   network call entirely on other pages instead of fetching and then
   discovering there's nowhere to display it. */
async function fetchQuote() {
  const textEl = document.getElementById('dashQuoteText');
  const authorEl = document.getElementById('dashQuoteAuthor');
  if (!textEl || !authorEl) return;

  textEl.textContent = 'Loading quote…';
  authorEl.textContent = '';
  try {
    const res = await fetch('https://api.quotable.io/random?tags=motivational|inspirational');
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    currentQuote = { text: data.content, author: data.author };
  } catch (e) {
    // API unreachable -- fall back to a local quote so the UI never breaks
    currentQuote = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
  }
  textEl.textContent = `"${currentQuote.text}"`;
  authorEl.textContent = currentQuote.author ? `— ${currentQuote.author}` : '';
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
  if (!grid) return; // only exists on quotes.html
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

on('dashQuoteNew', 'click', fetchQuote);
on('dashQuoteSave', 'click', saveCurrentQuote);
on('quoteForm', 'submit', e => {
  e.preventDefault();
  const textInput = document.getElementById('quoteTextInput');
  const authorInput = document.getElementById('quoteAuthorInput');
  if (textInput.value.trim()) {
    addManualQuote(textInput.value.trim(), authorInput.value.trim());
    textInput.value = '';
    authorInput.value = '';
  }
});

/* =========================================================
   WEEKLY SUMMARY
   Pure read-only aggregation over the last 7 days of data.
   ========================================================= */
function renderSummary() {
  const week = lastNDates(7);

  // ---- Tasks ----
  const weekTasks = tasks.filter(t => week.includes(t.createdAt));
  const completedTasks = weekTasks.filter(t => t.status === 'completed');
  const pendingTasks = weekTasks.filter(t => t.status === 'pending');
  const completionPct = weekTasks.length ? Math.round((completedTasks.length / weekTasks.length) * 100) : 0;

  setList('summaryTasks', [
    ['Added this week', weekTasks.length],
    ['Completed', completedTasks.length],
    ['Pending', pendingTasks.length],
    ['Completion rate', completionPct + '%']
  ]);

  // ---- Habits ----
  const habitCompletionsThisWeek = habits.reduce((sum, h) => sum + week.filter(d => h.history[d]).length, 0);
  const categoryCounts = {};
  habits.forEach(h => {
    const doneCount = week.filter(d => h.history[d]).length;
    categoryCounts[h.category] = (categoryCounts[h.category] || 0) + doneCount;
  });
  const categoryLines = Object.keys(categoryCounts).map(cat => [cat, categoryCounts[cat]]);

  setList('summaryHabits', [
    ['Habits created', habits.length],
    ['Completions this week', habitCompletionsThisWeek],
    ...categoryLines
  ]);

  // ---- Fitness (water, calories) ----
  const weekWater = week.map(d => water[d] || 0);
  const totalWater = weekWater.reduce((a, b) => a + b, 0);
  const avgWater = Math.round(totalWater / 7);
  const totalCalories = week.reduce((sum, d) => sum + (calories[d] || 0), 0);

  const weekSleep = week.map(d => sleep[d]).filter(v => v !== undefined);
  const totalSleep = weekSleep.reduce((a, b) => a + b, 0);
  const avgSleep = weekSleep.length ? (totalSleep / weekSleep.length).toFixed(1) : 0;

  setList('summaryFitness', [
    ['Total water', totalWater + ' ml'],
    ['Average water/day', avgWater + ' ml'],
    ['Total calories', totalCalories + ' kcal'],
    ['Total sleep', totalSleep + ' hrs'],
    ['Average sleep/day', avgSleep + ' hrs']
  ]);

  // Mini dashboard version
  setList('dashWeekList', [
    ['Tasks completed', completedTasks.length],
    ['Habit completions', habitCompletionsThisWeek],
    ['Avg sleep', avgSleep + ' hrs'],
    ['Water total', totalWater + ' ml']
  ]);
}

function setList(id, rows) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = rows.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join('');
}

/* =========================================================
   DASHBOARD TOP STATS (tasks / habits progress bars)
   ========================================================= */
function renderDashboardTop() {
  const todayTasks = tasks; // all currently pending+completed tasks counted for "today" simplicity
  const completed = todayTasks.filter(t => t.status === 'completed').length;
  const total = todayTasks.length;
  setText('dashTaskStat', `${completed} / ${total}`);
  setWidth('dashTaskBar', total ? `${(completed / total) * 100}%` : '0%');

  const t = todayStr();
  const habitsDoneToday = habits.filter(h => h.history[t]).length;
  setText('dashHabitStat', `${habitsDoneToday} / ${habits.length}`);
  setWidth('dashHabitBar', habits.length ? `${(habitsDoneToday / habits.length) * 100}%` : '0%');
}

/* =========================================================
   MASTER RENDER
   Called after every state change so whichever page is
   currently open always reflects the latest data. Every
   render function above guards itself, so calling all of them
   on every page is safe -- each one is a no-op on pages that
   don't have its elements.
   ========================================================= */
function renderAll() {
  renderDates();
  renderTasks();
  renderHabits();
  renderWaterSleep();
  renderSummary();
  renderDashboardTop();
  renderDashboardPomo();
  renderSavedQuotes();
  populatePomoTaskSelect();
  updatePomoDisplay();
}

/* =========================================================
   INIT
   ========================================================= */
renderAll();
fetchQuote();
