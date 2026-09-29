/* ===== Rendering, actions and boot ===== */
const VIEWS = { home: vHome, workout: vWorkout, programme: vProgramme, exercises: vExercises, progress: vProgress, history: vHistory, session: vSession, day: vDay, generate: vGenerate, exercise: vExercise, exform: vExForm, settings: vSettings };

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#0D0F13' : '#F2F3F6');
}
function navHtml() {
  const items = [['home', 'Home', I.home], ['workout', 'Workout', I.lift], ['programme', 'Programme', I.prog], ['exercises', 'Exercises', I.book], ['progress', 'Progress', I.chart]];
  return items.map(([id, l, ic]) => `<button class="${UI.tab === id ? 'on' : ''}${id === 'workout' && S.active ? ' live' : ''}" data-a="tab" data-v="${id}" aria-label="${l}">${ic}<span>${l}</span></button>`).join('');
}
function render(scrollTop) {
  applyTheme();
  const y = window.scrollY;
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (!S.onboarded) {
    app.innerHTML = vOnboarding(); nav.hidden = true;
    document.getElementById('restbar').innerHTML = '';
    renderSheet();
    if (scrollTop) window.scrollTo(0, 0);
    return;
  }
  nav.hidden = false;
  const r = route();
  const fn = VIEWS[r.v] || vHome;
  app.innerHTML = `<main class="view v-${r.v}${S.active && r.v === 'workout' ? ' active-wk' : ''}">${fn(r.p)}</main>`;
  nav.innerHTML = navHtml();
  document.getElementById('restbar').innerHTML = restBarHtml();
  renderSheet();
  if (scrollTop === true) window.scrollTo(0, 0);
  else if (typeof scrollTop === 'number') window.scrollTo(0, scrollTop);
  else window.scrollTo(0, y);
  wakeLock();
  if (r.v === 'settings') fillSnaps();
}
async function fillSnaps() {
  const el = document.getElementById('snaps'); if (!el) return;
  const list = await listSnapshots();
  const el2 = document.getElementById('snaps'); if (!el2) return;
  el2.innerHTML = list.length ? list.map(x => `<div class="pr-row"><div class="grow"><div class="pr-ex">${fmtDate(new Date(x.date + 'T12:00').getTime(), true)}</div><div class="muted xs">${x.sessions} workouts</div></div><button class="btn outline sm" data-a="snap-restore" data-k="${x.key}" data-v="${x.date}">Restore</button></div>`).join('') : '<div class="muted xs" style="padding:12px 14px">The first snapshot is taken today and one per day after that (last 7 kept).</div>';
}
function go(v, p) { UI.stack.push({ v, p, y: window.scrollY }); UI.sheet = null; render(true); }
function back() { const r = UI.stack.pop(); if (r && r.v === 'session' && UI.editId) finishEdit(); UI.justSaved = null; render(r ? r.y : true); }
function openSheet(type, params = {}) { UI.sheet = Object.assign({ type }, params); UI.sheetFresh = true; renderSheet(); }
function closeSheet() { UI.sheet = null; renderSheet(); }
function confirmSheet(title, body, ok, fn, danger) { UI.confirmFn = fn; openSheet('confirm', { title, body, ok, danger }); }

/* ---------- Starting workouts ---------- */
function startWorkout(name, items, dayId) {
  if (S.active) { UI.pending = { name, items, dayId }; openSheet('resume'); return; }
  S.active = newSessionFrom(name, items, dayId);
  if (S.hasDemo) S.active.demo = false;
  UI.timer.state = 'idle';
  UI.sheet = null; UI.stack = []; UI.tab = 'workout';
  save();
  render(true);
}
function startDay(id) {
  const d = S.programme.days.find(x => x.id === id);
  if (!d) return;
  startWorkout(d.name, d.exercises, d.id);
}

/* ---------- Set logging ---------- */
/* Completes a set: fills blanks from the target, carries the weight forward, checks for records */
function applyDone(ei, si) {
  const e = S.active.exercises[ei]; const x = e.sets[si];
  if (x.w == null && x.tw != null) x.w = x.tw;
  if (x.w == null && exById(e.exId).eq === 'bodyweight') x.w = 0;
  if (!(x.r > 0)) { if (x.tr > 0) x.r = x.tr; else { toast('Enter the reps you did first'); focusField(ei, si, 'r'); return null; } }
  if (x.w == null) { toast('Enter the weight you used first'); focusField(ei, si, 'w'); return null; }
  x.done = true;
  const changed = [];
  for (let k = si + 1; k < e.sets.length; k++) { const n = e.sets[k]; if (!n.done && n.r == null && (n.w == null || n.w === n.tw) && (n.tw == null || n.tw === x.tw) && n.w !== x.w) { n.w = x.w; changed.push(k); } }
  const pr = checkPR(e, x);
  x.pr = pr ? pr.type : null;
  if (pr) toast(pr.msg, 'pr');
  save();
  if (S.settings.autoRest) startRest(e.rest || 120);
  return { changed };
}
function markDone(ei, si) {
  const a = S.active; const e = a.exercises[ei]; const x = e.sets[si];
  if (x.done) {
    if (Date.now() - (x.autoAt || 0) < 1200) { render(); return; } // just auto-completed on leaving the reps box
    x.done = false; x.pr = null; save(); render(); return;
  }
  if (!applyDone(ei, si)) return;
  const finishedEx = e.sets.every(s => s.done);
  render();
  if (finishedEx && ei + 1 < a.exercises.length) { const nx = document.getElementById('x-' + (ei + 1)); if (nx) setTimeout(() => nx.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }
}
/* Same as markDone but patches the row in place so a tap elsewhere is not swallowed by a re-render */
function completeInPlace(el, ei, si) {
  const res = applyDone(ei, si); if (!res) return;
  const e = S.active.exercises[ei], x = e.sets[si];
  x.autoAt = Date.now();
  const row = el.closest('.srow');
  if (row) { row.classList.add('done'); if (x.pr) row.classList.add('pr'); }
  res.changed.forEach(k => { const inp = document.querySelector(`input[data-f="w"][data-ei="${ei}"][data-si="${k}"]`); if (inp && document.activeElement !== inp) inp.value = fmtNum(toUnit(e.sets[k].w)); });
  const card = document.getElementById('x-' + ei); if (card && e.sets.every(s => s.done)) card.classList.add('complete');
}
function focusField(ei, si, f) { const el = document.querySelector(`input[data-f="${f}"][data-ei="${ei}"][data-si="${si}"]`); if (el) el.focus(); }
function checkPR(e, x) {
  const b = IDX().bests[e.exId]; if (!b || !(x.r > 0)) return null;
  const ex = exById(e.exId); const U = unitLabel();
  const others = e.sets.filter(o => o !== x && o.done && o.r > 0);
  const w = x.w || 0;
  const maxW = Math.max(b.maxW, ...others.map(o => o.w || 0));
  const e1 = e1rm(w, x.r), bestE1 = Math.max(b.bestE1, ...others.map(o => e1rm(o.w, o.r)));
  const k = String(Math.round(w * 100));
  const repsAt = Math.max(b.repsAtW[k] || 0, ...others.filter(o => (o.w || 0) === w).map(o => o.r));
  if (w > 0 && w > maxW + 0.001) return { type: 'weight', msg: `New record · heaviest ${ex.name}: ${fmtW(w)} ${U} × ${x.r}` };
  if (e1 > 0 && e1 > bestE1 * 1.001) return { type: 'e1rm', msg: `New record · ${ex.name} est. 1RM ${fmtW(Math.round(e1 * 10) / 10)} ${U}` };
  if (repsAt > 0 && x.r > repsAt) return { type: 'reps', msg: `Rep record · ${ex.name} ${w ? fmtW(w) + ' ' + U : 'BW'} × ${x.r}` };
  return null;
}
function addSet(ctx, ei) {
  const s = getSess(ctx); const e = s.exercises[ei];
  const last = e.sets[e.sets.length - 1];
  const n = { id: uid(), w: last ? last.w : null, r: null, tw: last ? (last.tw ?? last.w) : null, tr: last ? (last.tr ?? last.r) : null, done: false };
  if (ctx === 'edit') { n.r = last ? last.r : null; n.done = true; }
  e.sets.push(n);
  persist(ctx, s); render();
  setTimeout(() => focusField(ei, e.sets.length - 1, ctx === 'edit' ? 'w' : 'r'), 30);
}
function persist(ctx, s) { if (ctx === 'active') save(); else save({ session: s }); }

/* ---------- Finishing ---------- */
function finishWorkout(updateProgramme) {
  const a = S.active;
  const s = clone(a);
  s.end = Date.now();
  s.exercises = s.exercises.map(e => { e.sets = e.sets.filter(x => x.r > 0).map(x => { const o = { id: x.id, w: x.w == null ? 0 : x.w, r: x.r, done: true }; ['rpe', 'rir', 'note', 'warm', 'pr'].forEach(k => { if (x[k] != null && x[k] !== '') o[k] = x[k]; }); return o; }); delete e.sug; delete e.rest; return e; }).filter(e => e.sets.length);
  if (updateProgramme && a.dayId) {
    const d = S.programme.days.find(x => x.id === a.dayId);
    if (d) d.exercises = a.exercises.map(e => ({ exId: e.exId, sets: Math.max(1, e.sets.length), repMin: e.repMin, repMax: e.repMax, main: !!e.main }));
  }
  S.sessions.push(s);
  S.active = null;
  UI.timer.state = 'idle';
  save({ session: s });
  UI.sheet = null;
  UI.justSaved = s.id;
  UI.tab = 'workout'; UI.stack = [{ v: 'session', p: s.id, y: 0 }];
  releaseWake();
  render(true);
}
function finishEdit() {
  const s = S.sessions.find(x => x.id === UI.editId);
  UI.editId = null;
  if (!s) return;
  s.exercises.forEach(e => { e.sets = e.sets.filter(x => x.r > 0); e.sets.forEach(x => x.done = true); });
  s.exercises = s.exercises.filter(e => e.sets.length);
  if (!s.exercises.length && s.fresh) { S.sessions = S.sessions.filter(x => x !== s); S.deleted[s.id] = Date.now(); save(); toast('Empty workout discarded'); return; }
  delete s.fresh;
  save({ session: s });
  toast('Workout updated');
}

/* ---------- Picker results ---------- */
function pickExercise(id) {
  const sh = UI.sheet; const ex = exById(id);
  if (sh.mode === 'add' || sh.mode === 'replace') {
    const s = getSess(sh.ctx);
    const base = defaultPrescription(ex, false);
    if (sh.mode === 'add') {
      const it = sessionExercise(base, s.date);
      if (sh.ctx === 'edit') it.sets = it.sets.map(x => Object.assign(x, { tw: null, tr: null }));
      s.exercises.push(it);
      persist(sh.ctx, s); closeSheet(); render();
      toast(`${ex.name} added`);
      setTimeout(() => { const el = document.getElementById('x-' + (s.exercises.length - 1)); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
      return;
    }
    const old = s.exercises[sh.ei];
    const n = Math.max(old.sets.length, 1);
    const it = sessionExercise(Object.assign(base, { sets: n, main: old.main && ex.type === 'heavy' }), s.date);
    if (sh.ctx === 'edit') { it.sets = old.sets.map(x => Object.assign({}, x)); }
    else old.sets.forEach((x, i) => { if (x.done && it.sets[i]) { /* keep nothing: new exercise starts fresh */ } });
    it.note = old.note;
    s.exercises[sh.ei] = it;
    persist(sh.ctx, s); closeSheet(); render();
    toast(`Replaced with ${ex.name}`);
    return;
  }
  if (sh.mode === 'day-add' || sh.mode === 'day-swap') {
    const d = S.programme.days.find(x => x.id === sh.dayId);
    if (sh.mode === 'day-add') d.exercises.push(defaultPrescription(ex, false));
    else { const old = d.exercises[sh.i]; d.exercises[sh.i] = Object.assign(defaultPrescription(ex, old.main && ex.type === 'heavy'), { sets: old.sets }); }
    save(); closeSheet(); render(); toast(sh.mode === 'day-add' ? `${ex.name} added to ${d.name}` : `Swapped for ${ex.name}`);
    return;
  }
  if (sh.mode === 'gen-add') UI.gen.items.push(defaultPrescription(ex, false));
  if (sh.mode === 'gen-swap') { const old = UI.gen.items[sh.i]; UI.gen.items[sh.i] = Object.assign(defaultPrescription(ex, false), { sets: old.sets }); }
  closeSheet(); render();
}

/* ---------- Rest timer ---------- */
let audioCtx = null;
function beep() {
  if (!S.settings.restSound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22, 0.44].forEach((t, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = i === 2 ? 1320 : 880; g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18); o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2); });
  } catch (e) { }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
}
function startRest(sec) {
  const T = UI.timer; T.dur = sec; T.end = Date.now() + sec * 1000; T.state = 'run';
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume && audioCtx.resume(); } catch (e) { }
  updRestBar();
}
function updRestBar() { const el = document.getElementById('restbar'); if (el) el.innerHTML = restBarHtml(); }
function tick() {
  const T = UI.timer;
  if (T.state === 'run') {
    const left = (T.end - Date.now()) / 1000;
    if (left <= 0) { T.state = 'done'; T.doneAt = Date.now(); beep(); toast('Rest over — next set'); updRestBar(); }
    else { const el = document.querySelector('[data-live="rest"]'); if (el) el.textContent = fmtClock(left); const pr = document.querySelector('.rest .r-prog'); if (pr) pr.style.width = Math.min(100, (1 - left / T.dur) * 100) + '%'; }
  } else if (T.state === 'done' && Date.now() - T.doneAt > 6000) { T.state = 'idle'; updRestBar(); }
  if (S && S.active) document.querySelectorAll('[data-live="elapsed"]').forEach(el => el.textContent = fmtClock((Date.now() - S.active.start) / 1000));
}

/* ---------- Screen wake lock during workouts (optional, ignored if refused) ---------- */
let wake = null;
async function wakeLock() {
  if (!S.active || wake || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } catch (e) { wake = null; }
}
function releaseWake() { try { wake && wake.release(); } catch (e) { } wake = null; }

/* ---------- Export / import ---------- */
function backupName() { const d = new Date(); return `gym-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`; }
function doExport() {
  const text = exportPayload();
  let canShare = false;
  try { canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([text], backupName(), { type: 'application/json' })] })); } catch (e) { }
  openSheet('exportData', { text, canShare });
}
async function shareExport() {
  const text = UI.sheet.text;
  const file = new File([text], backupName(), { type: 'application/json' });
  try { await navigator.share({ files: [file], title: 'Gym backup' }); UI.sheet.saved = true; UI.sheet.msg = 'Backup shared. Save it to Files or iCloud Drive so it is safe if you change phones.'; renderSheet(); }
  catch (e) { if (e && e.name !== 'AbortError') downloadExport(); }
}
function downloadExport() {
  try {
    const url = URL.createObjectURL(new Blob([UI.sheet.text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = backupName(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    UI.sheet.saved = true; UI.sheet.msg = `Saved as ${backupName()}.`; renderSheet();
  } catch (e) { toast('Could not save a file here — copy the text instead'); }
}
function doImport(text) {
  try {
    const n = importPayload(text.trim());
    UI.sheet = null; UI.stack = []; UI.tab = 'home';
    render(true); toast(`Restored ${n} workouts`);
  } catch (e) { UI.sheet.err = e.message && e.message.includes('Gym backup') ? e.message : 'That doesn\'t look like a valid backup. Make sure you pasted the whole text.'; renderSheet(); }
}

/* ---------- Action table ---------- */
const A = {
  tab: d => { UI.tab = d.v; UI.stack = []; UI.sheet = null; UI.justSaved = null; if (UI.editId) finishEdit(); render(true); },
  go: d => { if (d.v === 'generate' && !UI.gen) UI.gen = null; if (d.v === 'exercise' && UI.sheet) UI.sheet = null; go(d.v, d.p); },
  back: () => back(),
  'sheet-close': () => closeSheet(),
  'confirm-ok': () => { const f = UI.confirmFn; UI.confirmFn = null; closeSheet(); f && f(); },
  'clear-demo': () => confirmSheet('Clear demo data?', 'All demo workouts are removed. Your programme, exercise library and settings stay exactly as they are.', 'Clear Demo Data & Start My Training', () => { clearDemo(); UI.stack = []; UI.tab = 'home'; render(true); toast('Demo data cleared — time to train'); }),
  'toggle-ins': () => { UI.showAllIns = !UI.showAllIns; render(); },
  'toggle-pr': () => { UI.showAllPR = !UI.showAllPR; render(); },
  dismiss: d => { S.dismissed[d.k] = Date.now(); save(); render(); },
  'ins-act': d => {
    const r = insights()[+d.i]; if (!r || !r.action) return;
    const a = r.action;
    if (a.go) go(a.go[0], a.go[1]);
    else if (a.gen) { UI.gen = { muscles: a.gen.slice(), preset: null, size: 'standard', items: generateWorkout(a.gen, 'standard'), variety: 0, name: presetName(a.gen) }; go('generate'); }
    else if (a.swap) { const [dayId, i, exId] = a.swap; const day = S.programme.days.find(x => x.id === dayId); if (day && day.exercises[i]) { const old = day.exercises[i]; day.exercises[i] = Object.assign({}, old, { exId }); S.dismissed[r.key] = Date.now(); save(); render(); toast(`${day.name}: swapped to ${exById(exId).name}`); } }
    else if (a.addSet) { const [dayId, i] = a.addSet; const day = S.programme.days.find(x => x.id === dayId); if (day && day.exercises[i]) { day.exercises[i].sets++; S.dismissed[r.key] = Date.now(); save(); render(); toast(`${exById(day.exercises[i].exId).name} now ${day.exercises[i].sets} sets`); } }
  },
  'start-day': d => startDay(d.id),
  'start-empty': () => startWorkout('Workout', [], null),
  'choose-sheet': () => openSheet('choose'),
  resume: () => { UI.pending = null; UI.sheet = null; UI.tab = 'workout'; UI.stack = []; render(true); },
  'discard-start': () => { const p = UI.pending; S.active = null; UI.pending = null; UI.sheet = null; startWorkout(p.name, p.items, p.dayId); },
  'log-past': () => {
    const t = startOfDay(Date.now() - DAY) + 18 * 3600000;
    const s = { id: uid(), name: 'Workout', dayId: null, date: t, start: t, end: t + 60 * 60000, notes: '', exercises: [], fresh: true };
    S.sessions.push(s); save({ session: s }); UI.editId = s.id; go('session', s.id);
  },
  // live workout
  done: d => markDone(+d.ei, +d.si),
  addset: d => addSet(d.ctx, +d.ei),
  setmenu: d => openSheet('setmenu', { ctx: d.ctx, ei: +d.ei, si: +d.si }),
  exmenu: d => openSheet('exmenu', { ctx: d.ctx, ei: +d.ei }),
  'set-dup': () => { const sh = UI.sheet, s = getSess(sh.ctx), e = s.exercises[sh.ei], x = e.sets[sh.si]; const c = Object.assign({}, x, { id: uid(), pr: null }); if (sh.ctx === 'active') { c.done = false; c.tw = x.w ?? x.tw; c.tr = x.r ?? x.tr; c.r = null; } e.sets.splice(sh.si + 1, 0, c); persist(sh.ctx, s); closeSheet(); render(); },
  'set-del': () => { const sh = UI.sheet, s = getSess(sh.ctx); s.exercises[sh.ei].sets.splice(sh.si, 1); persist(sh.ctx, s); closeSheet(); render(); },
  'set-note': () => { const sh = UI.sheet, s = getSess(sh.ctx), x = s.exercises[sh.ei].sets[sh.si]; if (x.note == null) x.note = ''; UI.openSetNotes[x.id] = true; closeSheet(); render(); setTimeout(() => { const el = document.querySelector(`input[data-f="snote"][data-ei="${sh.ei}"][data-si="${sh.si}"]`); el && el.focus(); }, 30); },
  'set-warm': () => { const sh = UI.sheet, s = getSess(sh.ctx), x = s.exercises[sh.ei].sets[sh.si]; x.warm = !x.warm; persist(sh.ctx, s); closeSheet(); render(); },
  'set-undone': () => { const sh = UI.sheet, x = S.active.exercises[sh.ei].sets[sh.si]; x.done = false; x.pr = null; save(); closeSheet(); render(); },
  'ex-move': d => { const sh = UI.sheet, s = getSess(sh.ctx), i = sh.ei, j = i + +d.d; if (j < 0 || j >= s.exercises.length) return; [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]]; persist(sh.ctx, s); closeSheet(); render(); },
  reorder: d => openSheet('reorder', { ctx: d.ctx }),
  'ro-move': d => { const sh = UI.sheet, s = getSess(sh.ctx), i = +d.i, j = i + +d.d; if (j < 0 || j >= s.exercises.length) return; [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]]; persist(sh.ctx, s); renderSheet(); render(); },
  'ex-rm': () => { const sh = UI.sheet, s = getSess(sh.ctx), e = s.exercises[sh.ei]; const name = exById(e.exId).name; const ctx = sh.ctx, ei = sh.ei; confirmSheet(`Remove ${name}?`, e.sets.some(x => x.r > 0) ? 'Sets you logged for it in this workout are removed too.' : 'You can add it back any time.', 'Remove', () => { s.exercises.splice(ei, 1); persist(ctx, s); render(); }, true); },
  exnote: d => { const s = getSess(d.ctx), e = s.exercises[+d.ei]; UI.openNotes[e.id] = true; UI.sheet = null; render(); setTimeout(() => { const el = document.querySelector(`textarea[data-f="enote"][data-ei="${d.ei}"]`); el && el.focus(); }, 30); },
  'toggle-snotes': () => { UI.openNotes.session = !UI.openNotes.session; render(); },
  range: d => openSheet('range', { ctx: d.ctx, ei: +d.ei, rest: getSess(d.ctx).exercises[+d.ei].rest || 120 }),
  'rg-rest': d => { const sh = UI.sheet, e = getSess(sh.ctx).exercises[sh.ei]; e.rest = clamp((e.rest || 120) + 15 * d.d, 15, 600); persist(sh.ctx, getSess(sh.ctx)); renderSheet(); },
  'range-ok': () => {
    const sh = UI.sheet, s = getSess(sh.ctx), e = s.exercises[sh.ei];
    let mn = parseInt(document.getElementById('rg-min').value) || e.repMin, mx = parseInt(document.getElementById('rg-max').value) || e.repMax;
    if (mx < mn) [mn, mx] = [mx, mn];
    e.repMin = clamp(mn, 1, 100); e.repMax = clamp(mx, 1, 100);
    if (sh.ctx === 'active') {
      const sg = suggest(e.exId, e.repMin, e.repMax, e.sets.length, s.date);
      e.sug = { mode: sg.mode, msg: sg.msg, short: sg.short };
      e.sets.forEach((x, i) => { if (!x.done) { const t = sg.targets[i] || sg.targets[sg.targets.length - 1]; if (t) { if (x.w == null || x.w === x.tw) x.w = t.w; x.tw = t.w; x.tr = t.r; } } });
    }
    persist(sh.ctx, s); closeSheet(); render();
  },
  pick: d => {
    const params = { mode: d.mode, ctx: d.ctx, q: '', m: '' };
    if (d.mode === 'replace') { params.ei = +d.ei; params.from = getSess(d.ctx).exercises[+d.ei].exId; }
    if (d.mode === 'day-add' || d.mode === 'day-swap') { params.dayId = d.id; params.i = +d.i; if (d.mode === 'day-swap') params.from = S.programme.days.find(x => x.id === d.id).exercises[+d.i].exId; }
    if (d.mode === 'gen-swap') { params.i = +d.i; params.from = UI.gen.items[+d.i].exId; }
    openSheet('picker', params);
  },
  'pick-m': d => { UI.sheet.m = d.v; renderSheet(); },
  'pick-ok': d => pickExercise(d.id),
  finish: () => openSheet('finish', { upd: false }),
  'fin-upd': () => { UI.sheet.upd = !UI.sheet.upd; renderSheet(); },
  'fin-save': () => finishWorkout(UI.sheet.upd),
  'fin-discard': () => confirmSheet('Discard this workout?', 'Nothing from this session will be saved.', 'Discard workout', () => { S.active = null; UI.timer.state = 'idle'; save(); releaseWake(); UI.tab = 'home'; UI.stack = []; render(true); toast('Workout discarded'); }, true),
  rename: d => openSheet('rename', { title: 'Rename workout', value: getSess(d.ctx).name, ctx: d.ctx }),
  'rename-ok': () => { const v = document.getElementById('rename-in').value.trim(); const s = getSess(UI.sheet.ctx); if (v) { s.name = v; persist(UI.sheet.ctx, s); } closeSheet(); render(); },
  rest: d => startRest(+d.sec),
  't-add': () => { const T = UI.timer; if (T.state === 'run') { T.end += 30000; T.dur += 30; } else if (T.state === 'pause') { T.left += 30; T.dur += 30; } else startRest(30); updRestBar(); },
  't-toggle': () => { const T = UI.timer; if (T.state === 'run') { T.left = (T.end - Date.now()) / 1000; T.state = 'pause'; } else if (T.state === 'pause') { T.end = Date.now() + T.left * 1000; T.state = 'run'; } updRestBar(); },
  't-reset': () => { const T = UI.timer; if (T.state === 'pause') T.left = T.dur; else { T.end = Date.now() + T.dur * 1000; T.state = 'run'; } updRestBar(); },
  't-skip': () => { UI.timer.state = 'idle'; updRestBar(); },
  // history
  'edit-session': d => { UI.editId = d.id; UI.justSaved = null; render(true); },
  'edit-done': () => { const id = UI.editId; finishEdit(); if (!S.sessions.find(x => x.id === id)) { UI.stack.pop(); } render(true); },
  'del-session': d => confirmSheet('Delete this workout?', 'It is removed from your history, records and charts. This cannot be undone.', 'Delete workout', () => { S.sessions = S.sessions.filter(x => x.id !== d.id); S.deleted[d.id] = Date.now(); save(); UI.stack.pop(); render(true); toast('Workout deleted'); }, true),
  repeat: d => { const s = S.sessions.find(x => x.id === d.id); startWorkout(s.name, s.exercises.map(e => ({ exId: e.exId, sets: Math.max(1, validSets(e).length), repMin: e.repMin || 8, repMax: e.repMax || 12, main: e.main })), s.dayId); },
  // programme
  'split-sheet': () => openSheet('split'),
  'split-pick': d => { const t = TEMPLATES.find(x => x.id === d.v); confirmSheet(`Switch to ${t.name}?`, 'Your current programme days are replaced with a new plan. Workout history is kept.', 'Build programme', () => { S.programme = buildProgramme(d.v); S.settings.days = t.days; S.dismissed = {}; save(); UI.tab = 'programme'; UI.stack = []; render(true); toast(`${t.name} ready`); }); },
  'split-custom': () => confirmSheet('Start a custom programme?', 'Your current programme days are removed so you can build your own. Workout history is kept.', 'Start empty', () => { S.programme = { templateId: 'custom', name: 'My Programme', days: [{ id: uid(), name: 'Day 1', weekday: null, exercises: [] }], createdAt: Date.now() }; save(); UI.tab = 'programme'; UI.stack = [{ v: 'day', p: S.programme.days[0].id, y: 0 }]; render(true); }),
  'add-day': () => { const d = { id: uid(), name: `Day ${S.programme.days.length + 1}`, weekday: null, exercises: [] }; S.programme.days.push(d); S.settings.days = S.programme.days.length; save(); go('day', d.id); },
  'day-wd': d => { const day = S.programme.days.find(x => x.id === d.id); day.weekday = d.v === '' ? null : +d.v; save(); render(); },
  'day-move': d => { const day = S.programme.days.find(x => x.id === d.id), i = +d.i, j = i + +d.d; if (j < 0 || j >= day.exercises.length) return; [day.exercises[i], day.exercises[j]] = [day.exercises[j], day.exercises[i]]; save(); render(); },
  'day-rm': d => { const day = S.programme.days.find(x => x.id === d.id); const e = day.exercises[+d.i]; day.exercises.splice(+d.i, 1); save(); render(); toast(`${exById(e.exId).name} removed`); },
  'day-sets': d => { const day = S.programme.days.find(x => x.id === d.id); const e = day.exercises[+d.i]; e.sets = clamp(e.sets + +d.d, 1, 10); save(); render(); },
  'day-dup': d => { const day = S.programme.days.find(x => x.id === d.id); const c = clone(day); c.id = uid(); c.name = day.name + ' (copy)'; c.weekday = null; S.programme.days.splice(S.programme.days.indexOf(day) + 1, 0, c); S.settings.days = S.programme.days.length; save(); UI.stack.pop(); go('day', c.id); toast('Day duplicated'); },
  'day-del': d => { const day = S.programme.days.find(x => x.id === d.id); confirmSheet(`Delete ${day.name}?`, 'The day is removed from your programme. Past workouts stay in your history.', 'Delete day', () => { S.programme.days = S.programme.days.filter(x => x.id !== d.id); S.settings.days = Math.max(1, S.programme.days.length); save(); UI.stack.pop(); render(true); }, true); },
  // generator
  'gen-preset': d => { const p = GEN_PRESETS.find(x => x.id === d.v); UI.gen.preset = p.id; UI.gen.muscles = p.muscles.slice(); render(); },
  'gen-m': d => { const g = UI.gen; g.preset = null; g.muscles = g.muscles.includes(d.v) ? g.muscles.filter(x => x !== d.v) : g.muscles.concat(d.v); render(); },
  'gen-size': d => { UI.gen.size = d.v; render(); },
  'gen-go': () => { const g = UI.gen; if (!g.muscles.length) return; g.variety = g.items ? g.variety + 1 : 0; g.items = generateWorkout(g.muscles, g.size, g.variety, g.items ? g.items.map(x => x.exId) : []); g.name = g.preset ? GEN_PRESETS.find(p => p.id === g.preset).name : presetName(g.muscles); render(); },
  'gen-move': d => { const it = UI.gen.items, i = +d.i, j = i + +d.d; [it[i], it[j]] = [it[j], it[i]]; render(); },
  'gen-rm': d => { UI.gen.items.splice(+d.i, 1); render(); },
  'gen-sets': d => { const e = UI.gen.items[+d.i]; e.sets = clamp(e.sets + +d.d, 1, 10); render(); },
  'gen-cycle': d => { const g = UI.gen, i = +d.i, cur = g.items[i]; const alts = alternatives(cur.exId, g.items.map(x => x.exId)).filter(isAvailable); if (!alts.length) { toast('No other alternatives available'); return; } g.cycle = (g.cycle || 0) + 1; const pick = alts[(g.cycle - 1) % Math.min(4, alts.length)]; g.items[i] = Object.assign(defaultPrescription(pick, false), { sets: cur.sets }); render(); },
  'gen-start': () => { const g = UI.gen; if (!g.items.length) { toast('Add at least one exercise'); return; } startWorkout(g.name || 'Workout', g.items, null); },
  'gen-save': () => { const g = UI.gen; if (!g.items.length) return; if (!S.programme) S.programme = { templateId: 'custom', name: 'My Programme', days: [], createdAt: Date.now() }; const d = { id: uid(), name: g.name || 'Workout', weekday: null, exercises: clone(g.items) }; S.programme.days.push(d); S.settings.days = S.programme.days.length; save(); toast(`${d.name} added to your programme`); UI.stack = []; UI.tab = 'programme'; render(true); },
  // exercises
  'exf-m': d => { UI.exf.m = d.v; render(); },
  'exf-eq': d => { UI.exf.eq = d.v; render(); },
  'exf-mine': () => { UI.exf.mine = !UI.exf.mine; render(); },
  'ex-like': d => { const s = S.settings; s.liked = s.liked.includes(d.id) ? s.liked.filter(x => x !== d.id) : s.liked.concat(d.id); s.excluded = s.excluded.filter(x => x !== d.id || !s.liked.includes(d.id)); save(); render(); },
  'ex-excl': d => { const s = S.settings; s.excluded = s.excluded.includes(d.id) ? s.excluded.filter(x => x !== d.id) : s.excluded.concat(d.id); s.liked = s.liked.filter(x => x !== d.id || !s.excluded.includes(d.id)); save(); render(); },
  'ex-add-active': d => { const ex = exById(d.id); S.active.exercises.push(sessionExercise(defaultPrescription(ex, false), S.active.date)); save(); toast(`${ex.name} added to your workout`); render(); },
  'new-ex': () => { const q = UI.sheet && UI.sheet.q || UI.exf.q || ''; UI.sheet = null; UI.exDraft = { name: q, muscle: 'chest', sec: [], eq: 'machine', type: 'compound', pat: 'hpush', instructions: '', notes: '' }; go('exform', null); },
  'edit-ex': d => { const ex = S.customExercises.find(x => x.id === d.id); UI.exDraft = Object.assign({}, ex, { sec: (ex.sec || []).slice() }); go('exform', d.id); },
  'del-ex': d => { const used = S.sessions.some(s => s.exercises.some(e => e.exId === d.id)); confirmSheet('Delete this exercise?', used ? 'It stays in past workouts but can no longer be added. Consider keeping it if you still log it.' : 'It will be removed from your library and programme.', 'Delete exercise', () => { S.customExercises = S.customExercises.filter(x => x.id !== d.id); if (!used && S.programme) S.programme.days.forEach(day => day.exercises = day.exercises.filter(e => e.exId !== d.id)); if (used) { const ex = exById(d.id); } save(); UI.stack.pop(); render(true); toast('Exercise deleted'); }, true); },
  'xd-m': d => { UI.exDraft.muscle = d.v; UI.exDraft.sec = UI.exDraft.sec.filter(x => x !== d.v); render(); },
  'xd-sec': d => { const x = UI.exDraft; x.sec = x.sec.includes(d.v) ? x.sec.filter(y => y !== d.v) : x.sec.concat(d.v); render(); },
  'xd-eq': d => { UI.exDraft.eq = d.v; render(); },
  'xd-type': d => { UI.exDraft.type = d.v; render(); },
  'save-ex': () => {
    const x = UI.exDraft; if (!x.name.trim()) { toast('Give the exercise a name'); return; }
    const id = route().p;
    const obj = { id: id || 'c_' + uid(), custom: true, name: x.name.trim(), muscle: x.muscle, sec: x.sec, eq: x.eq, pat: x.pat, type: x.type, focus: '', instructions: x.instructions, notes: x.notes, steps: x.instructions.split('\n').map(s => s.trim()).filter(Boolean), tips: null, mistakes: null };
    if (id) S.customExercises = S.customExercises.map(e => e.id === id ? obj : e); else S.customExercises.push(obj);
    save(); UI.stack.pop(); if (!id) go('exercise', obj.id); else render(true); toast(id ? 'Exercise updated' : `${obj.name} created`);
  },
  // progress
  'prog-metric': d => { UI.prog.metric = d.v; render(); },
  'prog-pick': d => { UI.prog.ex = d.id; render(true); },
  // settings
  'set-goal': d => { S.settings.goal = d.v; S.settings.reps = repDefaultsFor(d.v); save(); render(); toast('Rep ranges updated for new plans — rebuild to apply to your programme'); },
  'set-days': d => { S.settings.days = +d.v; save(); render(); },
  'set-exp': d => { S.settings.experience = d.v; save(); render(); },
  'set-eqmode': d => { const s = S.settings; s.equipMode = d.v; if (d.v !== 'custom') s.equipment = EQUIP_PRESETS[d.v].slice(); save(); render(); },
  'set-eq': d => { const s = S.settings; s.equipment = s.equipment.includes(d.v) ? s.equipment.filter(x => x !== d.v) : s.equipment.concat(d.v); save(); render(); },
  rebuild: () => { const t = RECOMMENDED_TEMPLATE[S.settings.days]; confirmSheet('Rebuild your programme?', `Creates a new ${TEMPLATES.find(x => x.id === t).name} plan from your current settings. Your current programme days are replaced; history is kept.`, 'Rebuild programme', () => { S.programme = buildProgramme(t); save(); UI.stack = []; UI.tab = 'programme'; render(true); toast('Programme rebuilt'); }); },
  'set-rest': d => { const r = S.settings.rest; r[d.k] = clamp(r[d.k] + 15 * d.d, 30, 600); save(); render(); },
  'set-toggle': d => { S.settings[d.k] = !S.settings[d.k]; save(); render(); },
  'set-unit': d => { S.settings.unit = d.v; const inc = S.settings.inc; if (d.v === 'lb') { S.settings.inc = { barbell: 5, dumbbell: 5, machine: 5 }; } else { S.settings.inc = { barbell: 2.5, dumbbell: 2, machine: 2.5 }; } save(); render(); },
  'set-inc': d => { const s = S.settings; const steps = s.unit === 'lb' ? [1, 2.5, 5, 10] : [0.5, 1, 1.25, 2, 2.5, 5]; const i = steps.indexOf(s.inc[d.k]); s.inc[d.k] = steps[clamp((i < 0 ? 2 : i) + +d.d, 0, steps.length - 1)]; save(); render(); },
  'set-theme': d => { S.settings.theme = d.v; save(); render(); },
  export: () => doExport(),
  'download-export': () => downloadExport(),
  'share-export': () => shareExport(),
  'dismiss-install': () => { S.dismissed.install = Date.now(); save(); render(); },
  'ob-restore': () => openSheet('importData', {}),
  'snap-restore': d => confirmSheet(`Restore snapshot from ${d.v}?`, 'Everything in the app is replaced by this automatic daily snapshot.', 'Restore snapshot', async () => { await restoreSnapshot(d.k); UI.stack = []; UI.tab = 'home'; render(true); toast('Snapshot restored'); }),
  'copy-export': () => { const ta = document.getElementById('export-text'); const txt = UI.sheet.text; const ok = () => toast('Backup copied — paste it somewhere safe'); try { navigator.clipboard.writeText(txt).then(ok, () => { ta.select(); toast('Text selected — use Copy from the menu'); }); } catch (e) { ta.select(); toast('Text selected — use Copy from the menu'); } },
  import: () => openSheet('importData', {}),
  'import-ok': () => { const t = document.getElementById('import-text').value; if (!t.trim()) { UI.sheet.err = 'Choose a file or paste your backup text first.'; renderSheet(); return; } UI.sheet.text = t; confirmImport(t); },
  'reset-all': () => confirmSheet('Erase everything?', 'Every workout, your programme, custom exercises and settings are deleted from this device and your cloud copy. Export a backup first if you might want it.', 'Erase everything', () => { const del = {}; S.sessions.forEach(s => del[s.id] = Date.now()); const sync = S.sync; S = defaultState(); S.deleted = del; S.sync = sync; save(); UI.stack = []; UI.tab = 'home'; UI.ob = { step: 0, d: null }; render(true); }, true),
  // onboarding
  'ob-goal': d => { UI.ob.d.goal = d.v; render(); },
  'ob-days': d => { UI.ob.d.days = +d.v; UI.ob.d.template = null; render(); },
  'ob-exp': d => { UI.ob.d.experience = d.v; render(); },
  'ob-eq': d => { const o = UI.ob.d; o.equipMode = d.v; if (d.v !== 'custom') o.equipment = EQUIP_PRESETS[d.v].slice(); render(); },
  'ob-eqc': d => { const o = UI.ob.d; o.equipment = o.equipment.includes(d.v) ? o.equipment.filter(x => x !== d.v) : o.equipment.concat(d.v); render(); },
  'ob-like': d => { const o = UI.ob.d; o.liked = o.liked.includes(d.v) ? o.liked.filter(x => x !== d.v) : o.liked.concat(d.v); o.excluded = o.excluded.filter(x => x !== d.v); render(); },
  'ob-excl': d => { const o = UI.ob.d; o.excluded = o.excluded.includes(d.v) ? o.excluded.filter(x => x !== d.v) : o.excluded.concat(d.v); o.liked = o.liked.filter(x => x !== d.v); render(); },
  'ob-tpl': d => { UI.ob.d.template = d.v; render(); },
  'ob-demo': () => { UI.ob.d.demo = !UI.ob.d.demo; render(); },
  'ob-next': () => { UI.ob.step++; render(true); },
  'ob-back': () => { UI.ob.step = Math.max(0, UI.ob.step - 1); render(true); },
  'ob-finish': () => {
    const o = UI.ob.d; const s = S.settings;
    Object.assign(s, { goal: o.goal, days: o.days, experience: o.experience, equipMode: o.equipMode, equipment: o.equipment.length ? o.equipment : EQUIP_PRESETS.commercial.slice(), liked: o.liked, excluded: o.excluded, reps: repDefaultsFor(o.goal) });
    S.programme = buildProgramme(o.template || RECOMMENDED_TEMPLATE[o.days]);
    S.onboarded = true;
    if (o.demo) { REV++; S.sessions = S.sessions.concat(makeDemoSessions()); S.hasDemo = S.sessions.some(x => x.demo); S.sessions.forEach(x => touchSession(x)); }
    save(); UI.tab = 'home'; UI.stack = []; render(true);
    toast('Your programme is ready');
  },
};
function confirmImport(text) { confirmSheet('Replace current data with this backup?', 'Everything currently in the app is replaced by the backup.', 'Restore backup', () => { openSheet('importData', { text }); doImport(text); }); }

/* ---------- Inputs (autosave) ---------- */
let inputTimer = null, pendingSave = null;
function saveSoon(fn) { pendingSave = fn; clearTimeout(inputTimer); inputTimer = setTimeout(flushSave, 350); }
function flushSave() { clearTimeout(inputTimer); if (pendingSave) { const f = pendingSave; pendingSave = null; f(); } }
function num(v, int) { if (v === '' || v == null) return null; const n = int ? parseInt(v, 10) : parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
function onInput(ev) {
  const el = ev.target; const f = el.dataset.f; if (!f) return;
  const d = el.dataset;
  const v = el.value;
  if (['w', 'r', 'rpe', 'rir', 'snote'].includes(f)) {
    const s = getSess(d.ctx); if (!s) return; const x = s.exercises[+d.ei].sets[+d.si];
    if (f === 'w') { const n = num(v); x.w = n == null ? null : fromUnit(n); }
    if (f === 'r') x.r = num(v, true);
    if (f === 'rpe') x.rpe = num(v);
    if (f === 'rir') x.rir = num(v, true);
    if (f === 'snote') x.note = v;
    saveSoon(() => persist(d.ctx, s));
    return;
  }
  if (f === 'enote') { const s = getSess(d.ctx); s.exercises[+d.ei].note = v; saveSoon(() => persist(d.ctx, s)); return; }
  if (f === 'snotes') { const s = getSess(d.ctx); s.notes = v; saveSoon(() => persist(d.ctx, s)); return; }
  if (f === 'sname') { const s = getSess('edit'); s.name = v; saveSoon(() => save({ session: s })); return; }
  if (f === 'sdate') { const s = getSess('edit'); const t = new Date(v).getTime(); if (!isNaN(t)) { const dur = s.end ? s.end - s.start : null; s.date = s.start = t; if (dur != null) s.end = t + dur; saveSoon(() => save({ session: s })); } return; }
  if (f === 'sdur') { const s = getSess('edit'); const m = num(v, true); s.end = m ? s.start + m * 60000 : null; saveSoon(() => save({ session: s })); return; }
  if (f === 'pname') { S.programme.name = v; saveSoon(() => save()); return; }
  if (f === 'dname') { const day = S.programme.days.find(x => x.id === d.id); day.name = v; saveSoon(() => save()); return; }
  if (f === 'drmin' || f === 'drmax') { const day = S.programme.days.find(x => x.id === d.id); const e = day.exercises[+d.i]; const n = num(v, true); if (n > 0) { e[f === 'drmin' ? 'repMin' : 'repMax'] = n; saveSoon(() => save()); } return; }
  if (f === 'grmin' || f === 'grmax') { const e = UI.gen.items[+d.i]; const n = num(v, true); if (n > 0) e[f === 'grmin' ? 'repMin' : 'repMax'] = n; return; }
  if (f === 'gname') { UI.gen.name = v; return; }
  if (f === 'exq') { UI.exf.q = v; document.getElementById('ex-list').innerHTML = exListHtml(); return; }
  if (f === 'pickq') { UI.sheet.q = v; document.getElementById('pick-list').innerHTML = pickListHtml(UI.sheet); return; }
  if (f === 'xd') { UI.exDraft[d.k] = v; return; }
  if (f === 'setrep') { const n = num(v, true); if (n > 0) { S.settings.reps[d.k][+d.i] = n; saveSoon(() => save()); } return; }
}
function onChange(ev) {
  const el = ev.target; const f = el.dataset.f;
  if (f === 'prog-ex') { UI.prog.ex = el.value; render(); return; }
  if (f === 'xd') { UI.exDraft[el.dataset.k] = el.value; return; }
  if (f === 'drmin' || f === 'drmax' || f === 'grmin' || f === 'grmax') {
    // keep ranges sane once the user leaves the field
    const list = f[0] === 'd' ? S.programme.days.find(x => x.id === el.dataset.id).exercises : UI.gen.items;
    const e = list[+el.dataset.i]; if (e.repMax < e.repMin) [e.repMin, e.repMax] = [e.repMax, e.repMin];
    if (f[0] === 'd') save();
    return;
  }
  if (el.id === 'import-file' && el.files && el.files[0]) {
    const r = new FileReader();
    r.onload = () => { const t = String(r.result || ''); UI.sheet.text = t; renderSheet(); confirmImport(t); };
    r.onerror = () => { UI.sheet.err = 'Could not read that file.'; renderSheet(); };
    r.readAsText(el.files[0]);
    return;
  }
  if (f === 'r' && S.active && el.dataset.ctx === 'active') {
    // entering reps and leaving the field counts as completing the set
    flushSave();
    const x = S.active.exercises[+el.dataset.ei]?.sets[+el.dataset.si];
    if (x && x.r > 0 && !x.done && (x.w != null || x.tw != null || exById(S.active.exercises[+el.dataset.ei].exId).eq === 'bodyweight')) completeInPlace(el, +el.dataset.ei, +el.dataset.si);
  }
}

/* ---------- Boot ---------- */
async function boot() {
  await loadState();
  if (S.active && S.onboarded) { UI.tab = 'workout'; setTimeout(() => toast(`Welcome back — “${S.active.name}” is still in progress`), 400); }
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (fn) { ev.preventDefault(); flushSave(); fn(el.dataset, el); }
  });
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && UI.sheet) closeSheet();
    if (ev.key === 'Enter' && ev.target.id === 'rename-in') A['rename-ok']();
    if (ev.key === 'Enter' && ev.target.dataset && (ev.target.dataset.f === 'w' || ev.target.dataset.f === 'r')) {
      // jump weight → reps → next set weight for fast entry
      const inputs = [...document.querySelectorAll('input.num-in[data-ctx]')];
      const i = inputs.indexOf(ev.target); if (inputs[i + 1]) { ev.preventDefault(); inputs[i + 1].focus(); inputs[i + 1].select && inputs[i + 1].select(); } else ev.target.blur();
    }
  });
  document.addEventListener('focusin', ev => { if (ev.target.classList && ev.target.classList.contains('num-in')) setTimeout(() => { try { ev.target.select(); } catch (e) { } }, 0); });
  const flushAll = () => { flushSave(); writeLocal(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); else wakeLock(); });
  window.addEventListener('pagehide', flushAll);
  setInterval(tick, 250);
  render(true);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
