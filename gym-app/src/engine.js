/* ===== State, persistence, analytics, progression and recommendation engine ===== */
const LS_KEY = 'ironlog.state.v1';
const DAY = 86400000;
let S = null;          // the whole app state
let REV = 0;           // bumps on every change; derived data caches key off it

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = t => { const d = new Date(startOfDay(t)); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

function repDefaultsFor(goal) {
  if (goal === 'strength') return { heavy: [3, 6], compound: [6, 10], isolation: [8, 12], small: [12, 15] };
  if (goal === 'muscle') return { heavy: [6, 10], compound: [8, 12], isolation: [10, 15], small: [12, 20] };
  return { heavy: [5, 8], compound: [8, 12], isolation: [10, 15], small: [12, 20] };
}

function defaultSettings() {
  return {
    unit: 'kg', goal: 'both', days: 4, experience: 'intermediate', equipMode: 'commercial',
    equipment: EQUIP_PRESETS.commercial.slice(), liked: [], excluded: [],
    reps: repDefaultsFor('both'),
    rest: { heavy: 180, compound: 150, isolation: 90 }, autoRest: false, restSound: true,
    showRPE: false, showRIR: false, theme: 'dark',
    inc: { barbell: 2.5, dumbbell: 2, machine: 2.5 },
  };
}

function defaultState() {
  return {
    v: 1, onboarded: false, hasDemo: false, settings: defaultSettings(),
    programme: null, customExercises: [], sessions: [], active: null,
    dismissed: {}, deleted: {}, coreUpdatedAt: 0,
    sync: { dirty: [], last: 0 },
  };
}

/* Storage: every change is written to IndexedDB (primary) and mirrored to localStorage.
   On launch the newer of the two copies wins, so data from older versions migrates automatically. */
const IDB_NAME = 'gym-app', IDB_STORE = 'kv';
let idbConn = null;
function idbOpen() {
  if (idbConn) return idbConn;
  idbConn = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
      r.onsuccess = () => { const db = r.result; db.onclose = () => { idbConn = null; }; db.onversionchange = () => { db.close(); idbConn = null; }; res(db); };
      r.onerror = () => { idbConn = null; rej(r.error); };
      r.onblocked = () => { idbConn = null; rej(new Error('blocked')); };
    } catch (e) { idbConn = null; rej(e); }
  });
  return idbConn;
}
async function idbReq(mode, fn) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, mode); const st = tx.objectStore(IDB_STORE);
    const r = fn(st); let val;
    if (r) r.onsuccess = () => { val = r.result; };
    tx.oncomplete = () => res(val); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
}
const idbGet = k => idbReq('readonly', st => st.get(k));
const idbPut = (k, v) => idbReq('readwrite', st => st.put(v, k));
const idbDel = k => idbReq('readwrite', st => st.delete(k));
const idbKeys = () => idbReq('readonly', st => st.getAllKeys());
function parseState(raw) {
  if (!raw) return null;
  try { const d = typeof raw === 'string' ? JSON.parse(raw) : raw; return d && typeof d === 'object' && d.settings ? d : null; } catch (e) { return null; }
}
function hydrate(d) {
  const st = Object.assign(defaultState(), d);
  st.settings = Object.assign(defaultSettings(), d.settings || {});
  st.sync = Object.assign({ dirty: [], last: 0 }, d.sync || {});
  st.dismissed = st.dismissed || {}; st.deleted = st.deleted || {};
  return st;
}
async function loadState() {
  let ls = null, idb = null;
  try { ls = parseState(localStorage.getItem(LS_KEY)); } catch (e) { }
  try { idb = parseState(await Promise.race([idbGet('state'), new Promise(r => setTimeout(() => r(null), 3000))])); } catch (e) { }
  const stamp = d => d ? (d.savedAt || d.coreUpdatedAt || 0) : -1;
  const pick = stamp(idb) >= stamp(ls) ? (idb || ls) : ls;
  S = pick ? hydrate(pick) : defaultState();
  REV++;
  // make sure both copies exist (first run of this version migrates the older one)
  if (pick && (!idb || !ls || stamp(idb) !== stamp(ls))) writeLocal();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
}

/* Persist immediately; there is never a Save button. */
function save(opts = {}) {
  if (opts.session) touchSession(opts.session);
  if (!opts.sessionOnly) S.coreUpdatedAt = Date.now();
  REV++;
  writeLocal();
}
let idbChain = Promise.resolve();
function writeLocal() {
  S.savedAt = Date.now();
  const json = JSON.stringify(S);
  let ok = true;
  try { localStorage.setItem(LS_KEY, json); } catch (e) { ok = false; }
  idbChain = idbChain.then(() => idbPut('state', json)).then(() => snapshot(json)).catch(() => { if (!ok && typeof toast === 'function') toast('Could not save — export a backup from Settings'); });
  return ok;
}
/* One automatic snapshot per day, last 7 kept, as a safety net against mistakes */
let lastSnapDay = null;
async function snapshot(json) {
  const d = new Date(); const key = `snap-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (lastSnapDay === key) return;
  const exists = await idbGet(key);
  lastSnapDay = key;
  if (exists) return;
  const st = JSON.parse(json);
  if (!st.onboarded) return;
  await idbPut(key, json);
  const keys = (await idbKeys()).filter(k => String(k).startsWith('snap-')).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 7))) await idbDel(k);
}
async function listSnapshots() {
  try { const keys = (await idbKeys()).filter(k => String(k).startsWith('snap-')).sort().reverse(); const out = []; for (const k of keys) { const d = parseState(await idbGet(k)); if (d) out.push({ key: k, sessions: (d.sessions || []).length, date: k.slice(5) }); } return out; } catch (e) { return []; }
}
async function restoreSnapshot(key) {
  const d = parseState(await idbGet(key)); if (!d) throw new Error('Snapshot unreadable');
  S = hydrate(d); save();
}
function touchSession(s) {
  s.updatedAt = Date.now();
}

/* ---------- Exercises ---------- */
let EX_CACHE = { rev: -1, map: null, list: null };
function allExercises() {
  if (EX_CACHE.rev !== REV) {
    const list = LIBRARY.concat(S.customExercises || []);
    EX_CACHE = { rev: REV, list, map: Object.fromEntries(list.map(e => [e.id, e])) };
  }
  return EX_CACHE.list;
}
function exById(id) { allExercises(); return EX_CACHE.map[id] || { id, name: 'Unknown exercise', muscle: 'other', sec: [], eq: 'other', pat: 'other', type: 'isolation', steps: [], focus: '' }; }
function exTips(ex) { return ex.tips || (PATTERNS[ex.pat] || {}).tips || []; }
function exMistakes(ex) { return ex.mistakes || (PATTERNS[ex.pat] || {}).mistakes || []; }
function isAvailable(ex) {
  const s = S.settings;
  return !s.excluded.includes(ex.id) && (ex.custom || s.equipment.includes(ex.eq));
}
const SMALL_PATS = ['latraise', 'reardelt', 'calf', 'trunkflex', 'antiext', 'rotation', 'abduct', 'forearm', 'shrug'];
function repCategory(ex, main) {
  if (main || ex.type === 'heavy') return 'heavy';
  if (ex.type === 'compound') return 'compound';
  return SMALL_PATS.includes(ex.pat) ? 'small' : 'isolation';
}
function defaultPrescription(ex, main) {
  const s = S.settings, cat = repCategory(ex, main);
  const [repMin, repMax] = s.reps[cat] || [8, 12];
  let sets = 3;
  if (cat === 'heavy' && s.goal === 'strength') sets = 4;
  if (s.experience === 'beginner' && cat !== 'heavy') sets = 2;
  if (s.experience === 'advanced' && cat === 'heavy') sets = 4;
  return { exId: ex.id, sets, repMin, repMax, main: !!main };
}
function restFor(ex, main) {
  const r = S.settings.rest, cat = repCategory(ex, main);
  return cat === 'heavy' ? r.heavy : cat === 'compound' ? r.compound : r.isolation;
}
function incrementFor(ex) {
  const s = S.settings;
  const inc = ex.eq === 'dumbbell' ? s.inc.dumbbell : (ex.eq === 'barbell' ? s.inc.barbell : s.inc.machine);
  return fromUnit(inc);
}

/* Replacement suggestions: same movement pattern first, then same muscle */
function alternatives(exId, excludeIds = []) {
  const ex = exById(exId);
  return allExercises().filter(e => e.id !== exId && !excludeIds.includes(e.id)).map(e => {
    let sc = 0;
    if (e.pat === ex.pat) sc += 4;
    if (e.muscle === ex.muscle) sc += 3;
    if (e.type === ex.type) sc += 1;
    if (e.focus && e.focus === ex.focus) sc += 1;
    if (!isAvailable(e)) sc -= 5;
    if (S.settings.liked.includes(e.id)) sc += 1;
    const hist = exHistory(e.id).length; if (hist) sc += Math.min(1.5, hist * 0.2);
    return { e, sc };
  }).filter(x => x.sc >= 3).sort((a, b) => b.sc - a.sc).map(x => x.e);
}

/* ---------- Units ---------- */
const LB = 2.2046226218;
function toUnit(kg) { return S.settings.unit === 'lb' ? kg * LB : kg; }
function fromUnit(v) { return S.settings.unit === 'lb' ? v / LB : v; }
function roundDisp(v) { return Math.round(v * 100) / 100; }
function fmtNum(v) { if (v == null || v === '' || isNaN(v)) return ''; const r = roundDisp(v); return String(r); }
function fmtW(kg, bw) { if (kg == null || kg === '') return '—'; if (bw && !kg) return 'BW'; return fmtNum(toUnit(kg)); }
function unitLabel() { return S.settings.unit; }
function roundToInc(kg, ex) {
  const incU = toUnit(incrementFor(ex)) || 1;
  const u = toUnit(kg);
  return fromUnit(Math.max(0, Math.round(u / incU) * incU));
}
function fmtVol(kg) {
  const v = toUnit(kg);
  if (v >= 100000) return Math.round(v / 1000) + 'k';
  if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
  return Math.round(v).toLocaleString();
}

/* ---------- Derived analytics (cached per revision) ---------- */
function e1rm(w, r) { if (!w || !r || r > 15) return 0; return r === 1 ? w : w * (1 + r / 30); }
function validSets(ex) { return (ex.sets || []).filter(s => s.r > 0 && !s.warm); }
function sessionVolume(s) { let v = 0; s.exercises.forEach(e => validSets(e).forEach(x => v += (x.w || 0) * x.r)); return v; }
function sessionSetCount(s) { return s.exercises.reduce((a, e) => a + validSets(e).length, 0); }
function sortedSessions() { return IDX().sessions; }

let IDX_CACHE = { rev: -1 };
function IDX() {
  if (IDX_CACHE.rev === REV) return IDX_CACHE;
  const sessions = S.sessions.slice().sort((a, b) => a.date - b.date);
  const byEx = {}, muscleLast = {}, bests = {}, prEvents = [];
  for (const s of sessions) {
    s.exercises.forEach((e, i) => {
      const sets = validSets(e);
      if (!sets.length) return;
      const ex = exById(e.exId);
      (byEx[e.exId] = byEx[e.exId] || []).push({ sid: s.id, date: s.date, sets, repMin: e.repMin, repMax: e.repMax, note: e.note || '' });
      muscleLast[ex.muscle] = s.date;
      const b = bests[e.exId] = bests[e.exId] || { first: true, maxW: 0, maxWReps: 0, bestE1: 0, bestE1Set: null, maxReps: 0, maxRepsW: 0, bestVol: 0, repsAtW: {} };
      let vol = 0, sessE1 = 0, sessE1Set = null, sessMaxW = 0, sessMaxWReps = 0;
      const newRepPRs = [];
      for (const x of sets) {
        vol += (x.w || 0) * x.r;
        const v = e1rm(x.w, x.r);
        if (v > sessE1) { sessE1 = v; sessE1Set = x; }
        if ((x.w || 0) > sessMaxW || ((x.w || 0) === sessMaxW && x.r > sessMaxWReps)) { sessMaxW = x.w || 0; sessMaxWReps = x.r; }
        const k = String(Math.round((x.w || 0) * 100));
        if (!b.first && b.repsAtW[k] && x.r > b.repsAtW[k]) newRepPRs.push(x);
      }
      if (!b.first) {
        const push = (type, label, value) => prEvents.push({ sid: s.id, date: s.date, exId: e.exId, type, label, value });
        if (sessMaxW > b.maxW && sessMaxW > 0) push('weight', 'Heaviest weight', `${fmtW(sessMaxW)} ${unitLabel()} × ${sessMaxWReps}`);
        if (sessE1 > b.bestE1 * 1.001 && sessE1 > 0) push('e1rm', 'Estimated 1RM', `${fmtW(Math.round(sessE1 * 10) / 10)} ${unitLabel()}`);
        else if (newRepPRs.length && !(sessMaxW > b.maxW)) { const x = newRepPRs.sort((a, c) => c.r - a.r)[0]; push('reps', 'Most reps', `${fmtW(x.w, true)}${x.w ? ' ' + unitLabel() : ''} × ${x.r}`); }
        if (vol > b.bestVol * 1.001 && vol > 0 && b.bestVol > 0) push('volume', 'Best volume', `${fmtVol(vol)} ${unitLabel()}`);
      }
      for (const x of sets) {
        const k = String(Math.round((x.w || 0) * 100));
        b.repsAtW[k] = Math.max(b.repsAtW[k] || 0, x.r);
        if (x.r > b.maxReps || (x.r === b.maxReps && (x.w || 0) > b.maxRepsW)) { b.maxReps = x.r; b.maxRepsW = x.w || 0; }
      }
      if (sessMaxW > b.maxW || (sessMaxW === b.maxW && sessMaxWReps > b.maxWReps)) { b.maxW = sessMaxW; b.maxWReps = sessMaxWReps; }
      if (sessE1 > b.bestE1) { b.bestE1 = sessE1; b.bestE1Set = sessE1Set; b.bestE1Date = s.date; }
      if (vol > b.bestVol) { b.bestVol = vol; b.bestVolDate = s.date; }
      b.first = false;
    });
  }
  // highest volume session overall
  let topSession = null; let topVol = 0;
  for (const s of sessions) { const v = sessionVolume(s); if (v > topVol) { if (topSession) prEvents.push({ sid: s.id, date: s.date, exId: null, type: 'session', label: 'Highest volume session', value: `${fmtVol(v)} ${unitLabel()}` }); topVol = v; topSession = s; } }
  prEvents.sort((a, b) => b.date - a.date);
  IDX_CACHE = { rev: REV, sessions, byEx, muscleLast, bests, prEvents, topSession, topVol };
  return IDX_CACHE;
}
function exHistory(exId) { return IDX().byEx[exId] || []; }
function lastEntry(exId, beforeDate) {
  const h = exHistory(exId);
  for (let i = h.length - 1; i >= 0; i--) if (beforeDate == null || h[i].date < beforeDate) return h[i];
  return null;
}
function entryTopW(en) { return Math.max(...en.sets.map(s => s.w || 0)); }
function entryE1(en) { return Math.max(0, ...en.sets.map(s => e1rm(s.w, s.r))); }
function entryReps(en, w) { return en.sets.filter(s => (s.w || 0) === w).reduce((a, s) => a + s.r, 0); }

/* Muscle recency: primary muscle trained, from saved sessions */
function muscleDays(m) { const t = IDX().muscleLast[m]; return t == null ? null : daysBetween(t, Date.now()); }
function muscleStatus(d) {
  if (d == null) return { k: 'never', label: 'Not yet trained' };
  if (d <= 1) return { k: 'recovering', label: 'Recovering' };
  if (d <= 4) return { k: 'ready', label: 'Ready' };
  if (d <= 7) return { k: 'due', label: 'Due' };
  return { k: 'overdue', label: 'Overdue' };
}
function weeklySets(sinceTs) {
  const out = Object.fromEntries(TRACKED_MUSCLES.map(m => [m, 0]));
  for (const s of S.sessions) {
    if (s.date < sinceTs) continue;
    for (const e of s.exercises) {
      const ex = exById(e.exId); const n = validSets(e).length;
      if (out[ex.muscle] != null) out[ex.muscle] += n;
      (ex.sec || []).forEach(m => { if (out[m] != null) out[m] += n * 0.5; });
    }
  }
  return out;
}

/* ---------- Progressive overload: what to do next time ---------- */
function suggest(exId, repMin, repMax, nSets, beforeDate) {
  const ex = exById(exId);
  const hist = exHistory(exId).filter(h => beforeDate == null || h.date < beforeDate);
  const last = hist[hist.length - 1];
  const U = unitLabel();
  const range = `${repMin}–${repMax}`;
  if (!last) {
    return { mode: 'new', short: 'First time', msg: `First time logging this. Pick a weight you could lift for about ${repMax + 2} reps, so you finish each set with around 2 reps in reserve.`, targets: Array.from({ length: nSets }, () => ({ w: null, r: repMin })), last: null };
  }
  const sets = last.sets;
  const bw = ex.eq === 'bodyweight';
  const pick = i => sets[Math.min(i, sets.length - 1)];
  const W = entryTopW(last);
  const inc = incrementFor(ex);
  const allTop = sets.every(s => s.r >= repMax);
  const firstBelow = sets[0].r < repMin;
  let res;
  if (allTop) {
    const e1 = entryE1(last);
    const targets = Array.from({ length: nSets }, (_, i) => {
      const w = roundToInc((pick(i).w || 0) + inc, ex);
      let r = repMin;
      if (e1 && w) r = clamp(Math.floor(30 * (e1 / w - 1)), repMin, repMax);
      return { w, r };
    });
    const nw = targets[0].w;
    res = { mode: 'increase', short: `↑ ${fmtW(nw)} ${U}`, msg: bw && !W
      ? `You hit ${repMax}+ reps on every set. Add ${fmtW(inc)} ${U} with a belt or dumbbell, or keep adding reps.`
      : `You reached the top of your ${range} range on every set last time. Increase from ${fmtW(W)} to ${fmtW(nw)} ${U}.`, targets };
  } else if (firstBelow) {
    const prev = hist[hist.length - 2];
    const twice = prev && entryTopW(prev) === W && prev.sets[0].r < repMin;
    if (twice && W > 0) {
      const nw = roundToInc(W * 0.92, ex);
      res = { mode: 'reduce', short: `↓ ${fmtW(nw)} ${U}`, msg: `Two sessions below ${repMin} reps at ${fmtW(W)} ${U}. Drop to ${fmtW(nw)} ${U} and build back up through the ${range} range.`,
        targets: Array.from({ length: nSets }, (_, i) => ({ w: roundToInc((pick(i).w || 0) * 0.92, ex), r: repMin + 1 })) };
    } else {
      res = { mode: 'hold', short: `= ${fmtW(W, bw)}${W ? ' ' + U : ''}`, msg: `Last time the first set was below ${repMin} reps. Keep ${fmtW(W, bw)}${W ? ' ' + U : ''} and aim for at least ${repMin} on every set.`,
        targets: Array.from({ length: nSets }, (_, i) => ({ w: pick(i).w || 0, r: Math.max(repMin, pick(i).r + 1) })) };
    }
  } else {
    res = { mode: 'reps', short: '+1 rep', msg: `Keep ${fmtW(W, bw)}${W ? ' ' + U : ''} and beat last time by a rep where you can. Once every set hits ${repMax}, the weight goes up.`,
      targets: Array.from({ length: nSets }, (_, i) => ({ w: pick(i).w || 0, r: clamp(pick(i).r + 1, repMin, repMax) })) };
  }
  // stall detection over the last 3 exposures
  const st = stallInfo(exId, beforeDate);
  if (st && res.mode !== 'increase' && res.mode !== 'reduce') {
    res.stalled = st;
    res.msg = `${fmtW(st.w, bw)}${st.w ? ' ' + U : ''} × ${st.reps} for ${st.n} sessions without improving. Give it one more session with good sleep and food, or try a new rep range or swap the exercise.`;
    res.short = 'Stalled';
    res.mode = 'stalled';
  }
  res.last = last;
  return res;
}
function stallInfo(exId, beforeDate) {
  const hist = exHistory(exId).filter(h => beforeDate == null || h.date < beforeDate);
  if (hist.length < 3) return null;
  const last = hist[hist.length - 1];
  const W = entryTopW(last);
  let n = 1;
  for (let i = hist.length - 2; i >= 0; i--) {
    const h = hist[i];
    if (entryTopW(h) !== W) break;
    if (entryReps(last, W) > entryReps(h, W) || entryE1(last) > entryE1(h) * 1.005) break;
    n++;
  }
  if (n < 3) return null;
  return { n, w: W, reps: last.sets[0].r };
}

/* ---------- Programme building ---------- */
function pickFromSlot(slotKey, used) {
  const list = SLOTS[slotKey] || [];
  const first = exById(list[0]);
  const liked = S.settings.liked.map(exById).filter(e => e && isAvailable(e) && !used.has(e.id) && (list.includes(e.id) || (e.pat === first.pat && e.muscle === first.muscle)));
  if (liked.length) return liked[0].id;
  for (const id of list) { const e = exById(id); if (!used.has(id) && isAvailable(e)) return id; }
  // fall back to any available exercise with the same pattern or muscle
  const alt = allExercises().find(e => !used.has(e.id) && isAvailable(e) && e.pat === first.pat) || allExercises().find(e => !used.has(e.id) && isAvailable(e) && e.muscle === first.muscle);
  return alt ? alt.id : null;
}
function buildProgramme(templateId, weekdays) {
  const t = TEMPLATES.find(x => x.id === templateId) || TEMPLATES[4];
  const wd = weekdays || DEFAULT_WEEKDAYS[t.days] || [];
  const days = t.plan.map((d, i) => {
    const used = new Set();
    const exercises = [];
    d.slice(1).forEach((slot, j) => {
      const [key, flag] = slot.split(':');
      const id = pickFromSlot(key, used);
      if (!id) return;
      used.add(id);
      exercises.push(defaultPrescription(exById(id), flag === 'main'));
    });
    return { id: uid(), name: d[0], weekday: wd[i] != null ? wd[i] : null, exercises };
  });
  return { templateId: t.id, name: t.name, days, createdAt: Date.now() };
}

/* Which programme day is next: today's scheduled day if not done yet, otherwise rotation after the last one done */
function nextProgrammeDay() {
  const p = S.programme; if (!p || !p.days.length) return null;
  const done = sortedSessions().filter(s => s.dayId && p.days.some(d => d.id === s.dayId));
  const today = new Date().getDay();
  const todayStart = startOfDay(Date.now());
  const sched = p.days.find(d => d.weekday === today);
  if (sched && !done.some(s => s.dayId === sched.id && s.date >= todayStart)) {
    const doneThisWeekToday = done.some(s => s.date >= todayStart);
    if (!doneThisWeekToday) return { day: sched, reason: 'Scheduled for today' };
  }
  const last = done[done.length - 1];
  if (!last) return { day: p.days[0], reason: 'Start of your programme' };
  const i = p.days.findIndex(d => d.id === last.dayId);
  return { day: p.days[(i + 1) % p.days.length], reason: `Follows ${last.name}` };
}
function dayMuscles(day) {
  const set = []; day.exercises.forEach(e => { const m = exById(e.exId).muscle; if (!set.includes(m) && m !== 'other') set.push(m); }); return set;
}

/* ---------- Smart session generator ---------- */
function generateWorkout(muscles, size = 'standard', variety = 0, avoid = []) {
  const target = { short: 4, standard: 6, long: 8 }[size] || 6;
  const w = m => (MUSCLES.find(x => x.id === m) || {}).big ? 2 : 1;
  let ms = muscles.slice();
  // most rested muscles first so they get priority when slots are scarce
  ms.sort((a, b) => (muscleDays(b) ?? 99) - (muscleDays(a) ?? 99));
  if (ms.length > target) ms = ms.slice(0, target);
  const alloc = Object.fromEntries(ms.map(m => [m, 1]));
  let left = target - ms.length;
  const totalW = ms.reduce((a, m) => a + w(m), 0);
  const order = ms.slice().sort((a, b) => w(b) - w(a));
  let guard = 0;
  while (left > 0 && guard++ < 50) {
    for (const m of order) { if (left <= 0) break; if (alloc[m] < Math.max(1, Math.ceil(target * w(m) / totalW)) + (ms.length <= 2 ? 2 : 0)) { alloc[m]++; left--; } }
    if (guard > 10) { for (const m of order) { if (left <= 0) break; alloc[m]++; left--; } }
  }
  const progIds = new Set(); (S.programme?.days || []).forEach(d => d.exercises.forEach(e => progIds.add(e.exId)));
  const recent = new Set(); S.sessions.filter(s => Date.now() - s.date < 2 * DAY).forEach(s => s.exercises.forEach(e => recent.add(e.exId)));
  const chosen = [];
  const rnd = () => Math.random() * (1 + variety * 1.5);
  for (const m of ms) {
    const pats = new Set();
    for (let k = 0; k < alloc[m]; k++) {
      const cands = allExercises().filter(e => e.muscle === m && isAvailable(e) && !chosen.some(c => c.exId === e.id));
      if (!cands.length) break;
      const scored = cands.map(e => {
        let sc = 0;
        if (k === 0) sc += e.type === 'heavy' ? 4 : e.type === 'compound' ? 3 : 0;
        else sc += e.type === 'isolation' ? 1.5 : e.type === 'compound' ? 1.2 : 0.2;
        if (pats.has(e.pat)) sc -= 3;
        if (progIds.has(e.id)) sc += 2;
        if (S.settings.liked.includes(e.id)) sc += 2.5;
        sc += Math.min(1.5, exHistory(e.id).length * 0.25);
        if (recent.has(e.id)) sc -= 3;
        if (avoid.includes(e.id)) sc -= k === 0 ? 1.5 : 3.5;
        if (e.id === 'deadlift' && ms.includes('back') && !ms.includes('hamstrings')) sc -= 2;
        sc += rnd();
        return { e, sc };
      }).sort((a, b) => b.sc - a.sc);
      const e = scored[0].e;
      pats.add(e.pat);
      chosen.push(defaultPrescription(e, false));
    }
  }
  const rank = e => { const ex = exById(e.exId); return (ex.type === 'heavy' ? 0 : ex.type === 'compound' ? 1 : 2) * 10 + (MUSCLES.find(x => x.id === ex.muscle)?.big ? 0 : 1); };
  chosen.sort((a, b) => rank(a) - rank(b));
  if (chosen[0] && exById(chosen[0].exId).type === 'heavy') Object.assign(chosen[0], defaultPrescription(exById(chosen[0].exId), true));
  return chosen;
}
function presetName(muscles) {
  const key = muscles.slice().sort().join(',');
  const p = GEN_PRESETS.find(g => g.muscles.slice().sort().join(',') === key);
  if (p) return p.name;
  return muscles.map(m => MUSCLE_NAME[m]).join(' + ');
}

/* ---------- Workout sessions ---------- */
function newSessionFrom(name, items, dayId) {
  const s = { id: uid(), name, dayId: dayId || null, date: Date.now(), start: Date.now(), end: null, notes: '', exercises: [] };
  items.forEach(it => s.exercises.push(sessionExercise(it, s.date)));
  return s;
}
function sessionExercise(it, beforeDate) {
  const ex = exById(it.exId);
  const sug = suggest(it.exId, it.repMin, it.repMax, it.sets, beforeDate);
  return {
    id: uid(), exId: it.exId, repMin: it.repMin, repMax: it.repMax, main: !!it.main, note: '',
    sug: { mode: sug.mode, msg: sug.msg, short: sug.short },
    sets: sug.targets.map(t => ({ id: uid(), w: t.w != null ? t.w : null, r: null, tw: t.w, tr: t.r, done: false })),
    rest: restFor(ex, it.main),
  };
}

/* ---------- Coach insights for the home screen ---------- */
function insights() {
  const out = [];
  const ss = sortedSessions();
  const now = Date.now();
  const last = ss[ss.length - 1];
  const U = unitLabel();
  const targetDays = S.settings.days;
  // Recovery / rest day
  const last3 = new Set(ss.filter(s => now - s.date < 3 * DAY).map(s => startOfDay(s.date))).size;
  const last7 = ss.filter(s => now - s.date < 7 * DAY).length;
  const trainedToday = last && startOfDay(last.date) === startOfDay(now);
  if (!trainedToday && (last3 >= 3 || last7 >= targetDays + 1)) out.push({ key: 'rest:' + startOfDay(now), kind: 'rest', title: 'Consider a rest day', body: `You've trained ${last3 >= 3 ? '3 days in a row' : `${last7} times in the last 7 days`}. Muscle is built during recovery — a day off now can make your next session stronger.` });
  // Performance drop in last session
  if (last) {
    let drops = 0, total = 0;
    last.exercises.forEach(e => { const sets = validSets(e); if (!sets.length) return; const prev = lastEntry(e.exId, last.date); if (!prev) return; total++; const a = Math.max(...sets.map(x => e1rm(x.w, x.r))), b = entryE1(prev); if (b && a < b * 0.97) drops++; });
    if (drops >= 3) out.push({ key: 'drop:' + last.id, kind: 'down', title: 'Performance dipped last session', body: `${drops} of ${total} exercises were weaker than the time before. Prioritise sleep and food, and hold off adding volume until numbers recover.` });
    // New e1RM PR last session
    const prs = IDX().prEvents.filter(p => p.sid === last.id && p.type === 'e1rm');
    if (prs.length) { const p = prs[0]; out.push({ key: 'pr:' + last.id, kind: 'pr', title: `New ${exById(p.exId).name} record`, body: `Estimated 1RM ${p.value}${prs.length > 1 ? ` — plus ${prs.length - 1} more record${prs.length > 2 ? 's' : ''} in ${last.name}` : ''}.`, action: { label: 'View', go: ['exercise', p.exId] } }); }
  }
  // Progression calls for the next programme day
  const nx = nextProgrammeDay();
  if (nx && ss.length) {
    const ups = [];
    nx.day.exercises.forEach(e => { const sg = suggest(e.exId, e.repMin, e.repMax, e.sets); if (sg.mode === 'increase') ups.push({ e, sg }); });
    if (ups.length) {
      const f = ups[0];
      const W = entryTopW(f.sg.last);
      out.push({ key: 'up:' + nx.day.id + ':' + (last ? last.id : ''), kind: 'up', title: `Go heavier on ${nx.day.name}`, body: `${exById(f.e.exId).name}: you hit the top of the ${f.e.repMin}–${f.e.repMax} range on every set. Increase from ${fmtW(W)} to ${fmtW(f.sg.targets[0].w)} ${U}.${ups.length > 1 ? ` ${ups.length - 1} more exercise${ups.length > 2 ? 's are' : ' is'} ready to go up too.` : ''}` });
    }
  }
  // Stalled lifts in the programme (only the most stalled one, so the coach stays quiet)
  let stallShown = false;
  (S.programme?.days || []).forEach(d => d.exercises.forEach((e, i) => {
    if (stallShown) return;
    const st = stallInfo(e.exId); if (!st || S.dismissed[`stall:${e.exId}:${exHistory(e.exId).length}`]) return;
    stallShown = true;
    const ex = exById(e.exId);
    const alts = alternatives(e.exId).filter(a => isAvailable(a) && a.pat === ex.pat).slice(0, 1);
    out.push({ key: `stall:${e.exId}:${exHistory(e.exId).length}`, kind: 'stall', title: `${ex.name} has stalled`, body: `${fmtW(st.w, ex.eq === 'bodyweight')}${st.w ? ' ' + U : ''} × ${st.reps} for ${st.n} sessions without progress. Keep it one more session, change the rep range, or swap it${alts[0] ? ` for ${alts[0].name}` : ''}.`, action: alts[0] ? { label: `Swap for ${alts[0].name}`, swap: [d.id, i, alts[0].id] } : null });
  }));
  // Neglected muscles (only those in the programme)
  const progMuscles = new Set(); (S.programme?.days || []).forEach(d => dayMuscles(d).forEach(m => progMuscles.add(m)));
  if (ss.length) progMuscles.forEach(m => {
    const d = muscleDays(m);
    if (d != null && d >= 8) out.push({ key: `muscle:${m}:${IDX().muscleLast[m]}`, kind: 'muscle', title: `${MUSCLE_NAME[m]}: ${d} days since last trained`, body: `You haven't trained ${MUSCLE_NAME[m].toLowerCase()} in ${d} days. Hitting each muscle at least twice a week is best for growth.`, action: { label: `Generate ${MUSCLE_NAME[m]} workout`, gen: [m] } });
  });
  // Volume trend for pressing / pulling / legs
  const groups = { pressing: ['hpush', 'inpush', 'vpush', 'dip'], pulling: ['hpull', 'vpull'], 'leg': ['squat', 'legpress', 'lunge', 'hinge'] };
  const vol = (pats, a, b) => ss.filter(s => s.date >= a && s.date < b).reduce((t, s) => t + s.exercises.filter(e => pats.includes(exById(e.exId).pat)).reduce((x, e) => x + validSets(e).reduce((y, st) => y + (st.w || 0) * st.r, 0), 0), 0);
  for (const [g, pats] of Object.entries(groups)) {
    const cur = vol(pats, now - 14 * DAY, now + DAY), prev = vol(pats, now - 28 * DAY, now - 14 * DAY);
    if (prev > 0 && cur > prev * 1.2) { out.push({ key: `vol:${g}:${startOfWeek(now)}`, kind: 'volume', title: `${g[0].toUpperCase() + g.slice(1)} volume up ${Math.round((cur / prev - 1) * 100)}%`, body: `Your ${g} volume over the last two weeks is well above the two weeks before. Good progress — keep an eye on joints and recovery.` }); break; }
  }
  // Weekly set volume too low for a big muscle
  const ws = weeklySets(now - 7 * DAY);
  if (ss.filter(s => now - s.date < 14 * DAY).length >= 3 && S.programme) {
    for (const m of ['chest', 'back', 'quads', 'hamstrings']) {
      if (!progMuscles.has(m) || ws[m] >= 8) continue;
      let target = null;
      S.programme.days.forEach(d => d.exercises.forEach((e, i) => { const ex = exById(e.exId); if (!target && ex.muscle === m && e.sets < 5) { const sg = suggest(e.exId, e.repMin, e.repMax, e.sets); if (sg.mode === 'increase' || sg.mode === 'reps') target = { d, i, e, ex }; } }));
      if (target) { out.push({ key: `sets:${m}:${startOfWeek(now)}`, kind: 'sets', title: `Low ${MUSCLE_NAME[m].toLowerCase()} volume`, body: `${MUSCLE_NAME[m]} got about ${Math.round(ws[m])} hard sets this week. 10–20 weekly sets tends to work best for growth, and ${target.ex.name} is still progressing — add a set.`, action: { label: `Add a set to ${target.ex.name}`, addSet: [target.d.id, target.i] } }); break; }
    }
  }
  return out.filter(r => !S.dismissed[r.key]);
}

/* ---------- Demo data ---------- */
function makeDemoSessions() {
  const p = S.programme; if (!p) return [];
  const days = p.days;
  const sessions = [];
  const state = {};
  const now = Date.now();
  // walk back 5 weeks following the weekday schedule (or every other day)
  const schedule = [];
  for (let d = 35; d >= 1; d--) {
    const t = startOfDay(now - d * DAY);
    const wd = new Date(t).getDay();
    const hasWd = days.some(x => x.weekday != null);
    if (hasWd ? days.some(x => x.weekday === wd) : d % 2 === 0) schedule.push(t);
  }
  let di = 0;
  const stallEx = days[0].exercises[1]?.exId;
  schedule.forEach((t, si) => {
    const day = days[di % days.length]; di++;
    const start = t + (17 + (si % 3)) * 3600000 + (si * 7 % 50) * 60000;
    const s = { id: 'demo-' + si, demo: true, name: day.name, dayId: day.id, date: start, start, end: start + (52 + (si * 13 % 25)) * 60000, notes: si === schedule.length - 2 ? 'Felt strong today, slept well.' : '', exercises: [], updatedAt: now };
    day.exercises.forEach(it => {
      const ex = exById(it.exId);
      const st = state[it.exId] = state[it.exId] || { w: roundToInc(DEMO_BASE[it.exId] ?? (ex.eq === 'bodyweight' ? 0 : ex.type === 'isolation' ? (ex.eq === 'dumbbell' ? 12 : 30) : (ex.eq === 'dumbbell' ? 24 : 60)), ex), r: it.repMin + 1 };
      const stall = it.exId === stallEx && si >= schedule.length - 3 * days.length;
      const sets = [];
      for (let k = 0; k < it.sets; k++) {
        let r = st.r >= it.repMax && !stall ? it.repMax : clamp(st.r - (k === 0 ? 0 : k === 1 ? (si % 2) : 1 + (si % 2)), it.repMin, it.repMax);
        sets.push({ id: uid(), w: st.w, r, done: true });
      }
      if (si === 3 && it === day.exercises[0]) sets[0].note = 'Paused first rep';
      s.exercises.push({ id: uid(), exId: it.exId, repMin: it.repMin, repMax: it.repMax, main: it.main, note: si === 0 && it === day.exercises[0] ? 'Seat height 4, grip ring finger on rings' : '', sets });
      if (stall) { st.r = Math.max(it.repMin, Math.min(st.r, it.repMax - 2)); return; }
      if (sets.every(x => x.r >= it.repMax)) { st.w = roundToInc(st.w + incrementFor(ex), ex); st.r = it.repMin; }
      else st.r = Math.min(it.repMax, st.r + 1);
    });
    sessions.push(s);
  });
  return sessions;
}
function clearDemo() {
  S.sessions.filter(s => s.demo).forEach(s => { S.deleted[s.id] = Date.now(); });
  S.sessions = S.sessions.filter(s => !s.demo);
  if (S.active && S.active.demo) S.active = null;
  S.hasDemo = false;
  S.dismissed = {};
  save();
}

/* ---------- Backup format ---------- */
function exportPayload() {
  return JSON.stringify({ app: 'Gym', version: 1, exportedAt: new Date().toISOString(), data: { settings: S.settings, programme: S.programme, customExercises: S.customExercises, sessions: S.sessions, active: S.active, onboarded: S.onboarded, hasDemo: S.hasDemo, dismissed: S.dismissed } }, null, 1);
}
function importPayload(text) {
  const j = JSON.parse(text);
  const d = j && j.data;
  if (!d || !Array.isArray(d.sessions)) throw new Error('This file is not a Gym backup.');
  const keep = S.sync;
  const deleted = S.deleted || {};
  S.sessions.forEach(s => { if (!d.sessions.some(x => x.id === s.id)) deleted[s.id] = Date.now(); });
  S = Object.assign(defaultState(), { settings: Object.assign(defaultSettings(), d.settings || {}), programme: d.programme || null, customExercises: d.customExercises || [], sessions: d.sessions, active: d.active || null, onboarded: true, hasDemo: !!d.hasDemo, dismissed: d.dismissed || {}, deleted });
  d.sessions.forEach(s => { delete deleted[s.id]; });
  S.sync = keep;
  S.sessions.forEach(s => { s.updatedAt = Date.now(); });
  save();
  return d.sessions.length;
}

