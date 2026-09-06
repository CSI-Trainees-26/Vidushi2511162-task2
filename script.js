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
