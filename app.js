const COLOR_PRESETS = [
  '#ff4757', '#ff6b81', '#ffa502', '#ffdd59',
  '#7bed9f', '#2ed573', '#70a1ff', '#5352ed',
  '#a29bfe', '#fd79a8', '#eccc68', '#57606f'
];
const DEMO_KEY = 'pixel-tasks-demo';

// ===== STATE =====

let sb = null;
let currentUser  = null;
let isDemoMode   = false;
let state        = { categories: [], tasks: [] };
let activeFilter      = 'all';
let activeView        = 'list';
let editingCatId      = null;
let editingTaskId     = null;
let editingNoteTaskId = null;

// ===== SOUNDS =====

let audioCtx = null;

function getAudio() {
  if (audioCtx) return audioCtx;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  return audioCtx;
}

function playSound(type) {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.type = 'square';

    // [frequencies[], duration, volume]
    const sounds = {
      click:      [[330],           0.06, 0.05],
      open:       [[400],           0.05, 0.04],
      save:       [[440, 554],      0.16, 0.07],
      complete:   [[523, 659, 784], 0.24, 0.08],
      uncomplete: [[660, 440],      0.16, 0.05],
      log:        [[440, 554],      0.13, 0.06],
      unlog:      [[554, 370],      0.13, 0.05],
      del:        [[300, 220],      0.16, 0.05],
    };
    const [freqs, dur, vol] = sounds[type] || sounds.click;

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    const step = dur / freqs.length;
    freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * step));
    osc.start(now);
    osc.stop(now + dur + 0.05);
  } catch (_) {}
}

// ===== DATE HELPERS =====

function pad(n) { return String(n).padStart(2, '0'); }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getStreak(task) {
  const worked = new Set(task.datesWorked || []);
  if (worked.size === 0) return 0;
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (worked.has(dateToStr(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function lastNDays(n) {
  const days = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    days.push(dateToStr(d));
  }
  return days;
}

function genId() {
  return 'demo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== SECURITY =====

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== DEMO MODE =====

function loadDemoData() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (_) {}
}

function saveDemoData() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
}

function enterDemoMode() {
  isDemoMode = true;
  loadDemoData();
  document.getElementById('demo-banner').style.display = 'flex';
  document.getElementById('btn-signout').style.display = 'none';
  showApp();
}

// ===== AUTH =====

async function initApp() {
  if (!window.SUPABASE_URL || window.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    document.getElementById('login-error').textContent = 'config.js not filled in — see SETUP.md';
    showLogin();
    return;
  }

  sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, detectSessionInUrl: false, storage: window.localStorage }
  });

  sb.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      isDemoMode  = false;
      currentUser = session.user;
      try { await loadData(); } catch(e) {}
      document.getElementById('demo-banner').style.display = 'none';
      document.getElementById('btn-signout').style.display = '';
      showApp();
    } else if (event === 'SIGNED_OUT' && !isDemoMode && currentUser !== null) {
      currentUser = null;
      state = { categories: [], tasks: [] };
      showLogin();
    }
  });

  // Handle PKCE callback: Google returns ?code= after the user authenticates.
  const searchParams = new URLSearchParams(window.location.search);
  const authCode     = searchParams.get('code');
  const authError    = searchParams.get('error');

  if (window.location.search || window.location.hash) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (authCode) { await exchangeGoogleCode(authCode); return; }

  if (authError) {
    showLogin();
    const desc = searchParams.get('error_description') || authError;
    document.getElementById('login-error').textContent = 'Sign-in error: ' + decodeURIComponent(desc.replace(/\+/g,' '));
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    isDemoMode = false; currentUser = session.user;
    await loadData(); showApp();
  } else {
    showLogin();
    // Pre-init One Tap for Chrome so it's ready when the button is clicked.
    if ('IdentityCredential' in window) waitForGSI();
  }
}

function waitForGSI() {
  if (!window.google?.accounts?.id) { setTimeout(waitForGSI, 150); return; }
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleIdToken, ux_mode: 'popup' });
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const email = isDemoMode ? 'DEMO' : (currentUser?.email || '');
  document.getElementById('user-email').textContent = email;
  render();
  loadPublicStats();
  if (!window._statInterval) {
    window._statInterval = setInterval(loadPublicStats, 60000);
  }
}

async function loadPublicStats() {
  if (!sb) return;
  try {
    const { data } = await sb.rpc('get_public_stats');
    if (!data) return;
    document.getElementById('stat-users').textContent = data.users_count ?? '—';
    document.getElementById('stat-done').textContent  = data.completed_count ?? '—';
    document.getElementById('header-stats').style.display = 'flex';
  } catch (_) {}
}

const GOOGLE_CLIENT_ID = '565994478896-57aq1v7g5n4kuqvat0aeaisgs33g41sj.apps.googleusercontent.com';

function signIn() {
  playSound('click');
  document.getElementById('login-error').textContent = '';
  if ('IdentityCredential' in window && window.google?.accounts?.id) {
    // Chrome/Edge: try One Tap first; fall back to PKCE if it doesn't show.
    let fired = false;
    const fallback = setTimeout(() => { if (!fired) signInWithPKCE(); }, 2000);
    google.accounts.id.prompt(n => {
      fired = true; clearTimeout(fallback);
      if (n.isNotDisplayed() || n.isSkippedMoment()) signInWithPKCE();
    });
  } else {
    // Firefox and all other browsers: PKCE redirect flow.
    // redirect_uri is https://bmandanas.github.io/task-tabber/ — registered in Google Cloud Console.
    signInWithPKCE();
  }
}

async function signInWithPKCE() {
  const verifier  = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const buf       = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  localStorage.setItem('google_pkce_verifier', verifier);
  const redirectUri = 'https://bmandanas.github.io/task-tabber/';
  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    response_type: 'code', client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri, code_challenge: challenge,
    code_challenge_method: 'S256', scope: 'openid email profile', prompt: 'select_account',
  });
}

async function exchangeGoogleCode(code) {
  const verifier   = localStorage.getItem('google_pkce_verifier') || '';
  localStorage.removeItem('google_pkce_verifier');
  try {
    const res  = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, code_verifier: verifier,
        redirect_uri: 'https://bmandanas.github.io/task-tabber/', grant_type: 'authorization_code',
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error_description || json.error || 'HTTP ' + res.status);
    if (!json.id_token) throw new Error('No id_token in response');
    await handleGoogleIdToken({ credential: json.id_token });
  } catch(e) {
    showLogin();
    document.getElementById('login-error').textContent = 'Sign-in error: ' + e.message;
  }
}

async function handleGoogleIdToken({ credential }) {
  document.getElementById('login-error').textContent = '';
  const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: credential });
  if (error) { document.getElementById('login-error').textContent = error.message; return; }
  isDemoMode  = false;
  currentUser = data.session.user;
  await loadData();
  document.getElementById('btn-signout').style.display = '';
  showApp();
}

async function signOut() {
  playSound('click');
  if (isDemoMode) {
    isDemoMode = false;
    state = { categories: [], tasks: [] };
    showLogin();
    return;
  }
  await sb.auth.signOut();
}

// ===== DATA LAYER =====

async function loadData() {
  const [{ data: cats, error: e1 }, { data: tasks, error: e2 }] = await Promise.all([
    sb.from('categories').select('*').order('created_at'),
    sb.from('tasks').select('*').order('created_at')
  ]);
  if (e1 || e2) { console.error(e1, e2); return; }

  state.categories = cats.map(r => ({ id: r.id, name: r.name, color: r.color }));
  state.tasks = tasks.map(r => ({
    id: r.id, categoryId: r.category_id, title: r.title, points: r.points,
    completed: r.completed, completedAt: r.completed_at,
    datesWorked: r.dates_worked || [], note: r.note || null
  }));
}

// ===== RENDER =====

function render() {
  renderCatTabs();
  renderCatDetail();
  renderTasks();
}

function renderCatTabs() {
  const container = document.getElementById('cat-tabs');
  container.innerHTML = '';

  const allTab = document.createElement('button');
  allTab.className = 'cat-tab' + (activeFilter === 'all' ? ' active' : '');
  allTab.dataset.catId = 'all';
  allTab.innerHTML =
    `<div class="cat-tab-head"><span class="cat-dot" style="background:#fff"></span><span class="cat-tab-name">ALL</span></div>` +
    `<div class="cat-tab-footer"><span class="cat-tab-stats">${state.tasks.length} tasks</span></div>`;
  container.appendChild(allTab);

  state.categories.forEach(cat => {
    const tasks = state.tasks.filter(t => t.categoryId === cat.id);
    const done  = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

    const tab = document.createElement('button');
    tab.className = 'cat-tab' + (activeFilter === cat.id ? ' active' : '');
    tab.dataset.catId = cat.id;
    if (activeFilter === cat.id) tab.style.setProperty('--tab-color', cat.color);

    tab.innerHTML =
      `<div class="cat-tab-head">` +
        `<span class="cat-dot" style="background:${esc(cat.color)}"></span>` +
        `<span class="cat-tab-name">${esc(cat.name)}</span>` +
      `</div>` +
      `<div class="cat-tab-footer">` +
        `<span class="cat-tab-stats">${done}/${total} · ${pct}%</span>` +
        `<span class="cat-tab-actions">` +
          `<button class="cat-action-btn" data-action="edit-cat" data-id="${esc(cat.id)}" title="Edit">✎</button>` +
          `<button class="cat-action-btn danger" data-action="del-cat" data-id="${esc(cat.id)}" title="Delete">✕</button>` +
        `</span>` +
      `</div>` +
      `<div class="cat-tab-track"><div class="cat-tab-fill" style="width:${pct}%;background:${esc(cat.color)}"></div></div>`;

    container.appendChild(tab);
  });
}

function renderCatDetail() {
  const el  = document.getElementById('cat-detail');
  const cat = state.categories.find(c => c.id === activeFilter);
  if (!cat) { el.classList.remove('visible'); return; }

  const tasks     = state.tasks.filter(t => t.categoryId === activeFilter);
  const done      = tasks.filter(t => t.completed).length;
  const total     = tasks.length;
  const pct       = total === 0 ? 0 : Math.round((done / total) * 100);
  const ptsEarned = tasks.filter(t => t.completed).reduce((s, t) => s + t.points, 0);
  const ptsTotal  = tasks.reduce((s, t) => s + t.points, 0);
  const workDays  = new Set(tasks.flatMap(t => t.datesWorked || [])).size;

  el.classList.add('visible');
  el.innerHTML =
    `<div class="cat-detail-item"><span class="cat-detail-label">DONE</span><span class="cat-detail-val">${done}/${total}</span></div>` +
    `<div class="cat-detail-bar"><div class="cat-detail-fill" style="width:${pct}%;--detail-color:${esc(cat.color)}"></div></div>` +
    `<div class="cat-detail-item"><span class="cat-detail-label">PTS</span><span class="cat-detail-val">★ ${ptsEarned}/${ptsTotal}</span></div>` +
    `<div class="cat-detail-item"><span class="cat-detail-label">DAYS</span><span class="cat-detail-val">${workDays}</span></div>`;
}

function renderCategoryChips() {
  if (activeFilter !== 'all' || state.categories.length === 0) return '';
  const chips = state.categories.map(cat =>
    `<div class="cat-chip" data-action="filter-cat" data-id="${esc(cat.id)}" style="--chip-color:${esc(cat.color)}">` +
      `<span class="cat-chip-dot" style="background:${esc(cat.color)}"></span>` +
      `<span class="cat-chip-name">${esc(cat.name)}</span>` +
      `<button class="cat-chip-x" data-action="del-cat" data-id="${esc(cat.id)}" title="Remove category">✕</button>` +
    `</div>`
  ).join('');
  return `<div class="cat-chips">${chips}</div>`;
}

function renderGantt(tasks) {
  const days   = lastNDays(30);
  const todayD = today();

  const hdrCells = days.map(day => {
    const isToday      = day === todayD;
    const dayNum       = parseInt(day.split('-')[2], 10);
    const isMonthStart = dayNum === 1;
    const label = isToday ? '·T·'
      : isMonthStart ? new Date(day + 'T12:00:00').toLocaleString('default', { month: 'short' })
      : dayNum;
    const cls = ['gantt-date-hdr', isToday && 'today', isMonthStart && 'month-start'].filter(Boolean).join(' ');
    return `<th class="${cls}">${label}</th>`;
  }).join('');

  if (tasks.length === 0) return `<div class="task-list-empty">NO TASKS YET<br>HIT + TASK TO ADD ONE</div>`;

  const rows = tasks.map(task => {
    const cat   = state.categories.find(c => c.id === task.categoryId);
    const color = cat ? cat.color : '#666666';
    const cells = days.map(day => {
      const worked  = (task.datesWorked || []).includes(day);
      const isToday = day === todayD;
      const cls     = ['gantt-cell', worked && 'worked', isToday && 'today'].filter(Boolean).join(' ');
      return `<td class="${cls}"${worked ? ` style="--cell-color:${esc(color)}"` : ''}></td>`;
    }).join('');
    return `<tr class="gantt-row${task.completed ? ' done' : ''}">` +
      `<td class="gantt-task-label gantt-sticky"${task.note ? ` title="${esc(task.note)}"` : ''} data-action="edit" data-id="${esc(task.id)}">${esc(task.title)}</td>` +
      cells + `</tr>`;
  }).join('');

  return `<div class="gantt"><table class="gantt-table">` +
    `<thead><tr><th class="gantt-task-hdr gantt-sticky">TASK</th>${hdrCells}</tr></thead>` +
    `<tbody>${rows}</tbody></table></div>`;
}

function renderTaskItem(task, todayD) {
  const cat         = state.categories.find(c => c.id === task.categoryId);
  const color       = cat ? cat.color : '#666666';
  const catName     = cat ? cat.name  : '?';
  const days        = (task.datesWorked || []).length;
  const loggedToday = (task.datesWorked || []).includes(todayD);
  const streak      = loggedToday ? getStreak(task) : 0;
  const logTitle    = loggedToday
    ? `${streak} day${streak !== 1 ? 's' : ''} in a row — click to un-log today`
    : 'Log work for today';
  const noteDot = task.note ? `<span class="task-note-dot" title="${esc(task.note)}"></span>` : '';

  return (
    `<div class="task-item${task.completed ? ' done' : ''}" style="--task-color:${esc(color)}">` +
      `<div class="px-checkbox${task.completed ? ' checked' : ''}" data-action="toggle" data-id="${esc(task.id)}" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">` +
        (task.completed ? '✓' : '') +
      `</div>` +
      `<div class="task-body">` +
        `<div class="task-title" data-action="edit" data-id="${esc(task.id)}"${task.note ? ` title="${esc(task.note)}"` : ''}>${esc(task.title)}${noteDot}</div>` +
        `<div class="task-meta">` +
          `<span class="task-cat-badge" style="background:${esc(color)}">${esc(catName)}</span>` +
          `<span class="task-days-badge">⏱ ${days}d worked</span>` +
        `</div>` +
      `</div>` +
      `<div class="task-actions">` +
        `<span class="pts-badge" title="Points value">★ ${task.points} pts</span>` +
        `<button class="px-btn px-btn-small px-btn-log${loggedToday ? ' logged' : ''}" ` +
          `data-action="log" data-id="${esc(task.id)}" title="${esc(logTitle)}">` +
          (loggedToday ? 'STREAK' : '+LOG') +
        `</button>` +
        `<details class="task-menu">` +
          `<summary title="More options">⋮</summary>` +
          `<div class="task-menu-items">` +
            `<button class="task-menu-item" data-action="note" data-id="${esc(task.id)}">📝 ${task.note ? 'EDIT NOTE' : 'ADD NOTE'}</button>` +
            `<button class="task-menu-item danger" data-action="del" data-id="${esc(task.id)}">🗑 DELETE</button>` +
          `</div>` +
        `</details>` +
      `</div>` +
    `</div>`
  );
}

function renderTasks() {
  const list    = document.getElementById('task-list');
  const titleEl = document.getElementById('task-section-title');
  const ptsEl   = document.getElementById('total-pts');

  const tasks = activeFilter === 'all'
    ? state.tasks
    : state.tasks.filter(t => t.categoryId === activeFilter);

  const cat = state.categories.find(c => c.id === activeFilter);
  titleEl.textContent = cat ? `◈ ${cat.name.toUpperCase()}` : '◈ ALL TASKS';

  const earned = tasks.filter(t => t.completed).reduce((s, t) => s + t.points, 0);
  const total  = tasks.reduce((s, t) => s + t.points, 0);
  ptsEl.textContent = total > 0 ? `★ ${earned} / ${total} PTS` : '';

  let html = renderCategoryChips();

  html += `<div class="view-toggle">` +
    `<button class="view-btn${activeView === 'list'  ? ' active' : ''}" data-view="list">LIST</button>` +
    `<button class="view-btn${activeView === 'gantt' ? ' active' : ''}" data-view="gantt">GANTT</button>` +
  `</div>`;

  if (activeView === 'gantt') {
    html += renderGantt(tasks);
    list.innerHTML = html;
    return;
  }

  if (tasks.length === 0) {
    html += '<div class="task-list-empty">NO TASKS YET<br>HIT + TASK TO ADD ONE</div>';
    list.innerHTML = html;
    return;
  }

  const incomplete = tasks.filter(t => !t.completed);
  const complete   = tasks.filter(t =>  t.completed);
  const todayD     = today();

  html += incomplete.map(t => renderTaskItem(t, todayD)).join('');
  if (incomplete.length > 0 && complete.length > 0) html += '<div class="task-divider">— COMPLETED —</div>';
  html += complete.map(t => renderTaskItem(t, todayD)).join('');
  list.innerHTML = html;
}

// ===== MODALS =====

function openCatModal(catId = null) {
  playSound('open');
  editingCatId = catId;
  document.getElementById('modal-note').style.display = 'none';
  document.getElementById('modal-task').style.display = 'none';
  document.getElementById('modal-cat').style.display  = 'block';
  document.getElementById('modal-overlay').classList.remove('hidden');

  const nameInput  = document.getElementById('cat-name-input');
  const colorInput = document.getElementById('cat-color-input');

  if (catId) {
    const cat = state.categories.find(c => c.id === catId);
    document.getElementById('modal-cat-title').textContent = '■ EDIT CATEGORY';
    nameInput.value  = cat.name;
    colorInput.value = cat.color;
    buildColorPresets(cat.color);
  } else {
    document.getElementById('modal-cat-title').textContent = '■ NEW CATEGORY';
    nameInput.value  = '';
    const preset     = COLOR_PRESETS[state.categories.length % COLOR_PRESETS.length];
    colorInput.value = preset;
    buildColorPresets(preset);
  }
  nameInput.focus();
}

function closeCatModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingCatId = null;
}

function openTaskModal(taskId = null) {
  playSound('open');
  editingTaskId = taskId;
  document.getElementById('modal-note').style.display = 'none';
  document.getElementById('modal-cat').style.display  = 'none';
  document.getElementById('modal-task').style.display = 'block';
  document.getElementById('modal-overlay').classList.remove('hidden');

  const titleInput = document.getElementById('task-title-input');
  const catSelect  = document.getElementById('task-cat-select');
  const ptsInput   = document.getElementById('task-pts-input');

  catSelect.innerHTML = '';
  if (state.categories.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '-- add a category first --';
    catSelect.appendChild(opt);
  } else {
    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id; opt.textContent = cat.name;
      catSelect.appendChild(opt);
    });
  }

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    document.getElementById('modal-task-title').textContent = '■ EDIT TASK';
    titleInput.value = task.title;
    catSelect.value  = task.categoryId;
    ptsInput.value   = task.points;
  } else {
    document.getElementById('modal-task-title').textContent = '■ NEW TASK';
    titleInput.value = '';
    if (activeFilter !== 'all' && state.categories.find(c => c.id === activeFilter)) {
      catSelect.value = activeFilter;
    }
    ptsInput.value = '1';
  }
  titleInput.focus();
}

function closeTaskModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingTaskId = null;
}

function openNoteModal(taskId) {
  playSound('open');
  editingNoteTaskId = taskId;
  const task = state.tasks.find(t => t.id === taskId);
  document.getElementById('modal-cat').style.display  = 'none';
  document.getElementById('modal-task').style.display = 'none';
  document.getElementById('modal-note').style.display = 'block';
  document.getElementById('modal-overlay').classList.remove('hidden');
  const input = document.getElementById('note-input');
  input.value = task.note || '';
  input.focus();
}

function closeNoteModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingNoteTaskId = null;
}

function buildColorPresets(selected) {
  const container = document.getElementById('color-presets');
  container.innerHTML = '';
  COLOR_PRESETS.forEach(color => {
    const sw = document.createElement('div');
    sw.className        = 'color-swatch' + (color === selected ? ' sel' : '');
    sw.style.background = color;
    sw.dataset.color    = color;
    container.appendChild(sw);
  });
}

// ===== ACTIONS =====

async function saveCategory() {
  const name  = document.getElementById('cat-name-input').value.trim();
  const color = document.getElementById('cat-color-input').value;
  if (!name) { document.getElementById('cat-name-input').focus(); return; }

  playSound('save');

  if (isDemoMode) {
    if (editingCatId) {
      const cat = state.categories.find(c => c.id === editingCatId);
      cat.name = name; cat.color = color;
    } else {
      state.categories.push({ id: genId(), name, color });
    }
    saveDemoData(); closeCatModal(); render(); return;
  }

  if (editingCatId) {
    const { error } = await sb.from('categories').update({ name, color }).eq('id', editingCatId);
    if (error) { console.error(error); return; }
    const cat = state.categories.find(c => c.id === editingCatId);
    cat.name = name; cat.color = color;
  } else {
    const { data, error } = await sb.from('categories').insert({ name, color }).select('id').single();
    if (error) { console.error(error); return; }
    state.categories.push({ id: data.id, name, color });
  }
  closeCatModal(); render();
}

async function deleteCategory(catId) {
  const count = state.tasks.filter(t => t.categoryId === catId).length;
  if (!confirm(count > 0 ? `Delete category and its ${count} task(s)?` : 'Delete this category?')) return;

  playSound('del');

  if (isDemoMode) {
    state.tasks      = state.tasks.filter(t => t.categoryId !== catId);
    state.categories = state.categories.filter(c => c.id !== catId);
    if (activeFilter === catId) activeFilter = 'all';
    saveDemoData(); render(); return;
  }

  const { error } = await sb.from('categories').delete().eq('id', catId);
  if (error) { console.error(error); return; }
  state.tasks      = state.tasks.filter(t => t.categoryId !== catId);
  state.categories = state.categories.filter(c => c.id !== catId);
  if (activeFilter === catId) activeFilter = 'all';
  render();
}

async function saveTask() {
  const title = document.getElementById('task-title-input').value.trim();
  const catId = document.getElementById('task-cat-select').value;
  const pts   = Math.max(1, parseInt(document.getElementById('task-pts-input').value) || 1);
  if (!title) { document.getElementById('task-title-input').focus(); return; }
  if (!catId) return;

  playSound('save');

  if (isDemoMode) {
    if (editingTaskId) {
      const task = state.tasks.find(t => t.id === editingTaskId);
      task.title = title; task.categoryId = catId; task.points = pts;
    } else {
      state.tasks.push({ id: genId(), title, categoryId: catId, points: pts,
        completed: false, completedAt: null, datesWorked: [], note: null });
    }
    saveDemoData(); closeTaskModal(); render(); return;
  }

  if (editingTaskId) {
    const { error } = await sb.from('tasks').update({ title, category_id: catId, points: pts }).eq('id', editingTaskId);
    if (error) { console.error(error); return; }
    const task = state.tasks.find(t => t.id === editingTaskId);
    task.title = title; task.categoryId = catId; task.points = pts;
  } else {
    const { data, error } = await sb.from('tasks')
      .insert({ title, category_id: catId, points: pts, completed: false, completed_at: null, dates_worked: [], note: null })
      .select('id').single();
    if (error) { console.error(error); return; }
    state.tasks.push({ id: data.id, title, categoryId: catId, points: pts,
      completed: false, completedAt: null, datesWorked: [], note: null });
  }
  closeTaskModal(); render();
}

async function saveNote() {
  const note = document.getElementById('note-input').value.trim() || null;
  playSound('save');

  if (isDemoMode) {
    const task = state.tasks.find(t => t.id === editingNoteTaskId);
    task.note = note;
    saveDemoData(); closeNoteModal(); render(); return;
  }

  const { error } = await sb.from('tasks').update({ note }).eq('id', editingNoteTaskId);
  if (error) { console.error(error); return; }
  const task = state.tasks.find(t => t.id === editingNoteTaskId);
  task.note = note;
  closeNoteModal(); render();
}

async function toggleTask(taskId) {
  const task        = state.tasks.find(t => t.id === taskId);
  const completed   = !task.completed;
  const completedAt = completed ? new Date().toISOString() : null;
  const datesWorked = [...(task.datesWorked || [])];
  if (completed) { const d = today(); if (!datesWorked.includes(d)) datesWorked.push(d); }

  playSound(completed ? 'complete' : 'uncomplete');

  if (isDemoMode) {
    task.completed = completed; task.completedAt = completedAt; task.datesWorked = datesWorked;
    saveDemoData(); render(); return;
  }

  const { error } = await sb.from('tasks')
    .update({ completed, completed_at: completedAt, dates_worked: datesWorked }).eq('id', taskId);
  if (error) { console.error(error); return; }
  task.completed = completed; task.completedAt = completedAt; task.datesWorked = datesWorked;
  render();
}

async function toggleWorkDay(taskId) {
  const task        = state.tasks.find(t => t.id === taskId);
  const d           = today();
  const datesWorked = [...(task.datesWorked || [])];
  const idx         = datesWorked.indexOf(d);
  const logging     = idx === -1;
  if (logging) datesWorked.push(d); else datesWorked.splice(idx, 1);

  playSound(logging ? 'log' : 'unlog');

  if (isDemoMode) {
    task.datesWorked = datesWorked;
    saveDemoData(); render(); return;
  }

  const { error } = await sb.from('tasks').update({ dates_worked: datesWorked }).eq('id', taskId);
  if (error) { console.error(error); return; }
  task.datesWorked = datesWorked;
  render();
}

async function deleteTask(taskId) {
  playSound('del');

  if (isDemoMode) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    saveDemoData(); render(); return;
  }

  const { error } = await sb.from('tasks').delete().eq('id', taskId);
  if (error) { console.error(error); return; }
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  render();
}

// ===== EVENTS =====

function setupEvents() {
  document.getElementById('btn-google-signin').addEventListener('click', signIn);
  document.getElementById('btn-try-demo').addEventListener('click', () => { playSound('click'); enterDemoMode(); });
  document.getElementById('btn-signout').addEventListener('click', signOut);
  document.getElementById('btn-exit-demo').addEventListener('click', () => {
    isDemoMode = false;
    state = { categories: [], tasks: [] };
    showLogin();
    document.getElementById('demo-banner').style.display = 'none';
    document.getElementById('btn-signout').style.display = '';
  });

  document.getElementById('btn-new-category').addEventListener('click', () => { playSound('click'); openCatModal(); });
  document.getElementById('btn-new-task').addEventListener('click', () => {
    playSound('click');
    state.categories.length === 0 ? openCatModal() : openTaskModal();
  });

  document.getElementById('btn-cat-cancel').addEventListener('click', () => { playSound('click'); closeCatModal(); });
  document.getElementById('btn-cat-save').addEventListener('click', saveCategory);
  document.getElementById('cat-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCategory();
    if (e.key === 'Escape') closeCatModal();
  });
  document.getElementById('cat-color-input').addEventListener('input', e => buildColorPresets(e.target.value));
  document.getElementById('color-presets').addEventListener('click', e => {
    const sw = e.target.closest('.color-swatch');
    if (!sw) return;
    document.getElementById('cat-color-input').value = sw.dataset.color;
    buildColorPresets(sw.dataset.color);
  });

  document.getElementById('btn-task-cancel').addEventListener('click', () => { playSound('click'); closeTaskModal(); });
  document.getElementById('btn-task-save').addEventListener('click', saveTask);
  document.getElementById('task-title-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveTask();
    if (e.key === 'Escape') closeTaskModal();
  });
  document.getElementById('pts-dec').addEventListener('click', () => {
    playSound('click');
    const inp = document.getElementById('task-pts-input');
    inp.value = Math.max(1, (parseInt(inp.value) || 1) - 1);
  });
  document.getElementById('pts-inc').addEventListener('click', () => {
    playSound('click');
    const inp = document.getElementById('task-pts-input');
    inp.value = Math.min(9999, (parseInt(inp.value) || 1) + 1);
  });

  document.getElementById('btn-note-cancel').addEventListener('click', () => { playSound('click'); closeNoteModal(); });
  document.getElementById('btn-note-save').addEventListener('click', saveNote);
  document.getElementById('note-input').addEventListener('keydown', e => { if (e.key === 'Escape') closeNoteModal(); });

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') { closeCatModal(); closeTaskModal(); closeNoteModal(); }
  });

  document.getElementById('cat-tabs').addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      if (actionEl.dataset.action === 'edit-cat') { openCatModal(actionEl.dataset.id); return; }
      if (actionEl.dataset.action === 'del-cat')  { deleteCategory(actionEl.dataset.id); return; }
    }
    const tab = e.target.closest('.cat-tab');
    if (tab) { playSound('click'); activeFilter = tab.dataset.catId; render(); }
  });

  document.getElementById('task-list').addEventListener('click', e => {
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) { playSound('click'); activeView = viewBtn.dataset.view; render(); return; }

    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;

    if      (action === 'filter-cat') { playSound('click'); activeFilter = id; render(); }
    else if (action === 'del-cat')    { deleteCategory(id); }
    else if (action === 'new-cat')    { openCatModal(); }
    else if (action === 'toggle')     { toggleTask(id); }
    else if (action === 'edit')       { openTaskModal(id); }
    else if (action === 'log')        { toggleWorkDay(id); }
    else if (action === 'note')       { el.closest('details')?.removeAttribute('open'); openNoteModal(id); }
    else if (action === 'del')        { el.closest('details')?.removeAttribute('open'); deleteTask(id); }
  });
}

// ===== INIT =====

setupEvents();
buildColorPresets('#ff4757');
initApp();
