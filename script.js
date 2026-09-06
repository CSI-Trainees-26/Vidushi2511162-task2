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
