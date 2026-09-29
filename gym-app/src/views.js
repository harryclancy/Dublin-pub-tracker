/* ===== Views ===== */
const UI = {
  tab: 'home', stack: [], sheet: null, sheetFresh: false, openNotes: {}, openSetNotes: {},
  gen: null, exf: { m: 'all', eq: 'all', q: '', mine: false }, prog: { ex: null, metric: 'e1' },
  ob: { step: 0, d: null }, editId: null, showAllIns: false, showAllPR: false, exDraft: null,
  timer: { state: 'idle', end: 0, left: 0, dur: 0 },
};
const POPULAR = ['bb_bench', 'incline_db', 'ohp', 'db_lateral', 'pullup', 'lat_pulldown', 'bb_row', 'cable_row', 'back_squat', 'hack_squat', 'leg_press', 'deadlift', 'rdl', 'hip_thrust', 'bss', 'leg_ext', 'seated_curl', 'ez_curl', 'incline_curl', 'rope_pushdown', 'skullcrusher', 'dips', 'cable_fly', 'face_pull', 'standing_calf', 'cable_crunch'];

function route() { return UI.stack.length ? UI.stack[UI.stack.length - 1] : { v: UI.tab }; }
function getSess(ctx) { return ctx === 'active' ? S.active : S.sessions.find(x => x.id === UI.editId); }

/* ---------- Shared pieces ---------- */
function topbar(title, opts = {}) {
  return `<header class="topbar">
    ${opts.back ? `<button class="iconbtn" data-a="back" aria-label="Back">${I.back}</button>` : ''}
    <div class="tb-text">${opts.eyebrow ? `<div class="eyebrow">${esc(opts.eyebrow)}</div>` : ''}<h1 class="title${opts.small ? ' sm' : ''}">${esc(title)}</h1></div>
    ${opts.right || ''}
    ${opts.gear !== false && !opts.back ? `<button class="iconbtn" data-a="go" data-v="settings" aria-label="Settings">${I.gear}</button>` : ''}
  </header>`;
}
function movedBanner() {
  if (!window.GYM_MOVED_URL) return '';
  const real = S.sessions.filter(x => !x.demo).length;
  return `<div class="moved"><b>Gym now has its own app</b><span>This Claude version is retired. Open the link below in Safari on your iPhone, then Share → Add to Home Screen.</span><span class="url">${esc(window.GYM_MOVED_URL)}</span>
    ${real ? `<span>You logged ${real} workout${real > 1 ? 's' : ''} here. Tap <b>Copy my data</b>, then in the new app choose <b>Restore a backup</b> and paste.</span><button class="btn solid" data-a="export">Copy my data</button>` : '<span>No workouts were logged here, so there is nothing to move.</span>'}</div>`;
}
function isStandalone() { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
function installCard() {
  if (isStandalone() || S.dismissed.install || window.GYM_MOVED_URL) return '';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return `<div class="install-card"><div class="ic-logo">${I.lift}</div><div class="grow"><b>Install Gym on your Home Screen</b><span>${ios ? 'Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>. It then opens full-screen like a normal app.' : 'Open your browser menu and choose <b>Install app</b> or <b>Add to Home Screen</b>.'}</span><button class="link" data-a="dismiss-install">Not now</button></div></div>`;
}
function demoBanner() {
  if (!S.hasDemo) return '';
  return `<div class="demo-banner"><div><b>You're looking at demo workouts.</b><span>Explore freely — then wipe them and start logging your own training. Your programme and settings are kept.</span></div><button class="btn solid" data-a="clear-demo">Clear Demo Data &amp; Start My Training</button></div>`;
}
function muscleChips(ms) { return ms.map(m => `<span class="mchip">${esc(MUSCLE_NAME[m])}</span>`).join(''); }
function estMinutes(items) { return Math.round(items.reduce((a, e) => { const ex = exById(e.exId); return a + e.sets * (restFor(ex, e.main) + 45); }, 0) / 60 / 5) * 5; }
function sessionRow(s) {
  const vol = sessionVolume(s), sets = sessionSetCount(s);
  const names = s.exercises.filter(e => validSets(e).length).map(e => exById(e.exId).name);
  const prs = IDX().prEvents.filter(p => p.sid === s.id && p.type !== 'session').length;
  return `<button class="srow-card" data-a="go" data-v="session" data-p="${s.id}">
    <div class="sr-date"><span>${WD[new Date(s.date).getDay()]}</span><b>${new Date(s.date).getDate()}</b></div>
    <div class="sr-main"><div class="sr-name">${esc(s.name)}${s.demo ? '<span class="tag">Demo</span>' : ''}${prs ? `<span class="tag pr">${I.trophy}${prs}</span>` : ''}</div>
    <div class="sr-meta">${s.end ? fmtDur(s.end - s.start) + ' · ' : ''}${sets} sets · ${fmtVol(vol)} ${unitLabel()}</div>
    <div class="sr-ex">${esc(names.slice(0, 4).join(' · '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</div></div>
    <span class="chev">${I.right}</span></button>`;
}

/* ---------- HOME ---------- */
function vHome() {
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  let h = topbar(greet, { eyebrow: `${WDL[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]}` });
  h += movedBanner();
  h += installCard();
  h += demoBanner();
  h += heroCard();
  h += weekCard();
  // insights
  const ins = insights();
  if (ins.length) {
    const shown = UI.showAllIns ? ins : ins.slice(0, 3);
    h += `<section class="sec"><div class="sec-h"><h2>Coach</h2>${ins.length > 3 ? `<button class="link" data-a="toggle-ins">${UI.showAllIns ? 'Show less' : `All ${ins.length}`}</button>` : ''}</div><div class="ins-list">`;
    h += shown.map(r => insightCard(r, ins.indexOf(r))).join('');
    h += `</div></section>`;
  }
  h += muscleCard();
  const ss = sortedSessions();
  const last = ss[ss.length - 1];
  if (last) {
    h += `<section class="sec"><div class="sec-h"><h2>Last workout</h2><button class="link" data-a="go" data-v="history">History</button></div>`;
    h += `<button class="card last-card" data-a="go" data-v="session" data-p="${last.id}">
      <div class="lc-top"><div><div class="lc-name">${esc(last.name)}</div><div class="muted sm">${ago(last.date)} · ${last.end ? fmtDur(last.end - last.start) : ''}</div></div>
      <div class="lc-stats"><div><b>${sessionSetCount(last)}</b><span>sets</span></div><div><b>${fmtVol(sessionVolume(last))}</b><span>${unitLabel()}</span></div></div></div>
      <div class="lc-lines">${last.exercises.filter(e => validSets(e).length).slice(0, 4).map(e => { const ex = exById(e.exId); return `<div><span>${esc(ex.name)}</span><span class="num">${setsText(validSets(e), ex.eq === 'bodyweight').join(', ')}</span></div>`; }).join('')}</div>
    </button></section>`;
  }
  const prs = IDX().prEvents.filter(p => p.type !== 'session').slice(0, 4);
  if (prs.length) {
    h += `<section class="sec"><div class="sec-h"><h2>Recent records</h2><button class="link" data-a="tab" data-v="progress">All</button></div><div class="card list">`;
    h += prs.map(prRow).join('');
    h += `</div></section>`;
  }
  const hl = highlights();
  if (hl.length) {
    h += `<section class="sec"><div class="sec-h"><h2>Progress highlights</h2></div><div class="hl-row">${hl.map(x => `<button class="hl" data-a="go" data-v="exercise" data-p="${x.id}"><div class="hl-name">${esc(x.name)}</div><div class="hl-val ${x.diff >= 0 ? 'good' : 'bad'}">${x.diff >= 0 ? '+' : ''}${fmtW(Math.round(x.diff * 10) / 10)}<small> ${unitLabel()}</small></div><div class="muted xs">est. 1RM · ${x.weeks} wk</div>${spark(x.vals)}</button>`).join('')}</div></section>`;
  }
  if (S.programme) h += `<section class="sec"><button class="split-row" data-a="tab" data-v="programme"><span class="muted xs">Current split</span><b>${esc(S.programme.name)}</b><span class="muted sm">${S.programme.days.length} days · ${S.programme.days.map(d => esc(d.name)).join(' · ')}</span><span class="chev">${I.right}</span></button></section>`;
  return h;
}
function prRow(p) {
  const ex = exById(p.exId);
  return `<button class="pr-row" data-a="go" data-v="exercise" data-p="${p.exId}"><span class="pr-ic">${I.trophy}</span><div class="grow"><div class="pr-ex">${esc(ex.name)}</div><div class="muted xs">${esc(p.label)} · ${ago(p.date)}</div></div><b class="num">${esc(p.value)}</b></button>`;
}
function highlights() {
  const out = [];
  const now = Date.now();
  Object.entries(IDX().byEx).filter(([, h]) => h.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 6).forEach(([id, h]) => {
    const recent = h.filter(x => now - x.date < 42 * DAY);
    if (recent.length < 2) return;
    const vals = recent.map(entryE1).filter(v => v > 0);
    if (vals.length < 2) return;
    const diff = Math.max(...vals.slice(-2)) - vals[0];
    out.push({ id, name: exById(id).name, diff, vals, weeks: Math.max(1, Math.round((recent[recent.length - 1].date - recent[0].date) / (7 * DAY))) });
  });
  return out.sort((a, b) => b.diff - a.diff).slice(0, 3);
}
function heroCard() {
  if (S.active) {
    const a = S.active; const done = a.exercises.reduce((t, e) => t + e.sets.filter(s => s.done || s.r > 0).length, 0);
    const tot = a.exercises.reduce((t, e) => t + e.sets.length, 0);
    return `<section class="hero live"><div class="eyebrow">Workout in progress</div><div class="hero-name">${esc(a.name)}</div>
      <div class="hero-meta"><span data-live="elapsed">${fmtClock((Date.now() - a.start) / 1000)}</span> elapsed · ${done}/${tot} sets</div>
      <button class="btn big solid" data-a="tab" data-v="workout">${I.play}Resume workout</button></section>`;
  }
  if (!S.programme || !S.programme.days.length) {
    return `<section class="hero"><div class="eyebrow">No programme yet</div><div class="hero-name">Build your plan</div><p class="muted">Pick a split and the app fills it with proven exercises.</p><button class="btn big solid" data-a="split-sheet">Choose a split</button><button class="btn ghost" data-a="go" data-v="generate">Generate a one-off workout</button></section>`;
  }
  const nx = nextProgrammeDay(); const d = nx.day;
  const ms = dayMuscles(d);
  const preview = d.exercises.slice(0, 4).map(e => {
    const ex = exById(e.exId); const sg = suggest(e.exId, e.repMin, e.repMax, e.sets);
    const t = sg.targets[0];
    const tgt = t && t.w != null ? `${fmtW(t.w, ex.eq === 'bodyweight')} × ${t.r}` : `${e.repMin}–${e.repMax} reps`;
    return `<li><span>${esc(ex.name)}</span><span class="num ${sg.mode}">${sg.mode === 'increase' ? I.arrowUp : ''}${tgt}</span></li>`;
  }).join('');
  return `<section class="hero">
    <div class="hero-top"><div class="eyebrow">Next up · ${esc(nx.reason)}</div></div>
    <div class="hero-name">${esc(d.name)}</div>
    <div class="hero-chips">${muscleChips(ms)}</div>
    <ul class="hero-list">${preview}${d.exercises.length > 4 ? `<li class="muted">+ ${d.exercises.length - 4} more</li>` : ''}</ul>
    <div class="hero-meta">${d.exercises.length} exercises · about ${estMinutes(d.exercises)} min</div>
    <button class="btn big solid" data-a="start-day" data-id="${d.id}">${I.play}Start Workout</button>
    <div class="hero-alt"><button class="btn ghost sm" data-a="choose-sheet">Choose another</button><button class="btn ghost sm" data-a="go" data-v="generate">${I.spark}Generate</button></div>
  </section>`;
}
function weekCard() {
  const ws = startOfWeek(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => ws + i * DAY);
  const sess = S.sessions.filter(s => s.date >= ws);
  const planned = new Set((S.programme?.days || []).map(d => d.weekday).filter(x => x != null));
  const today = startOfDay(Date.now());
  const cells = days.map(t => {
    const n = sess.filter(s => startOfDay(s.date) === t).length;
    const wd = new Date(t).getDay();
    return `<div class="wd ${n ? 'hit' : ''} ${planned.has(wd) ? 'plan' : ''} ${t === today ? 'today' : ''}"><span>${WD[wd][0]}</span><i></i></div>`;
  }).join('');
  const target = S.settings.days;
  return `<section class="sec"><div class="card week">
    <div class="wk-l"><div class="muted xs">This week</div><div class="wk-n"><b>${sess.length}</b><span>/ ${target} sessions</span></div><div class="muted xs">${fmtVol(sess.reduce((a, s) => a + sessionVolume(s), 0))} ${unitLabel()} lifted</div></div>
    <div class="wk-days">${cells}</div></div></section>`;
}
function insightCard(r, i) {
  const icon = { up: I.arrowUp, hold: I.eq, down: I.arrowDn, rest: I.rest, muscle: I.target, stall: I.shuffle, pr: I.trophy, volume: I.chart, sets: I.plus }[r.kind] || I.info;
  const act = r.action ? `<button class="btn sm solid" data-a="ins-act" data-i="${i}">${esc(r.action.label)}</button>` : '';
  return `<div class="ins k-${r.kind}"><span class="ins-ic">${icon}</span><div class="grow"><div class="ins-t">${esc(r.title)}</div><div class="ins-b">${esc(r.body)}</div>
    <div class="ins-a">${act}<button class="btn sm ghost" data-a="dismiss" data-k="${esc(r.key)}">Dismiss</button></div></div></div>`;
}
function muscleCard() {
  const rows = TRACKED_MUSCLES.map(m => ({ m, d: muscleDays(m) }));
  const due = rows.filter(r => r.d == null || r.d >= 4).sort((a, b) => (b.d ?? 99) - (a.d ?? 99));
  return `<section class="sec"><div class="sec-h"><h2>Muscle recovery</h2></div><div class="card">
    ${due.length ? `<div class="due-line">${I.target}<span>Due to train: <b>${due.slice(0, 4).map(r => MUSCLE_NAME[r.m]).join(', ')}</b></span></div>` : ''}
    <div class="mgrid">${rows.map(r => { const st = muscleStatus(r.d); return `<div class="mcell s-${st.k}"><span class="mc-n">${MUSCLE_NAME[r.m]}</span><span class="mc-d">${r.d == null ? '—' : r.d === 0 ? 'Today' : r.d + 'd'}</span><i style="--p:${r.d == null ? 0 : Math.min(1, r.d / 7)}"></i></div>`; }).join('')}</div>
    <div class="legend"><span class="s-recovering"><i></i>Recovering</span><span class="s-ready"><i></i>Ready</span><span class="s-due"><i></i>Due</span><span class="s-overdue"><i></i>Overdue</span></div>
  </div></section>`;
}

/* ---------- WORKOUT TAB ---------- */
function vWorkout() {
  if (S.active) return vActive();
  let h = topbar('Workout');
  h += demoBanner();
  if (S.programme && S.programme.days.length) {
    const nx = nextProgrammeDay();
    h += `<section class="sec"><div class="sec-h"><h2>Your programme</h2><span class="muted xs">${esc(S.programme.name)}</span></div><div class="day-list">`;
    h += S.programme.days.map(d => `<div class="day-pick ${d.id === nx.day.id ? 'next' : ''}"><button class="grow dp-main" data-a="go" data-v="day" data-p="${d.id}"><div class="dp-name">${esc(d.name)}${d.id === nx.day.id ? '<span class="tag acc">Next</span>' : ''}</div><div class="muted xs">${d.weekday != null ? WD[d.weekday] + ' · ' : ''}${d.exercises.length} exercises · ${dayMuscles(d).map(m => MUSCLE_NAME[m]).join(', ')}</div></button><button class="btn solid sm" data-a="start-day" data-id="${d.id}">Start</button></div>`).join('');
    h += `</div></section>`;
  }
  h += `<section class="sec tiles">
    <button class="tile" data-a="go" data-v="generate"><span>${I.spark}</span><b>Generate workout</b><small>Pick muscles, get a smart session</small></button>
    <button class="tile" data-a="start-empty"><span>${I.plus}</span><b>Empty workout</b><small>Add exercises as you go</small></button>
    <button class="tile" data-a="log-past"><span>${I.cal}</span><b>Log past workout</b><small>Record a session after the fact</small></button>
  </section>`;
  const ss = sortedSessions().slice().reverse();
  h += `<section class="sec"><div class="sec-h"><h2>History</h2>${ss.length > 6 ? `<button class="link" data-a="go" data-v="history">All ${ss.length}</button>` : ''}</div>`;
  h += ss.length ? `<div class="hist">${ss.slice(0, 6).map(sessionRow).join('')}</div>` : `<div class="empty">No workouts yet. Start one above — every set is saved as you go.</div>`;
  h += `</section>`;
  return h;
}

function vActive() {
  const a = S.active;
  const done = a.exercises.reduce((t, e) => t + e.sets.filter(s => s.done).length, 0);
  const tot = a.exercises.reduce((t, e) => t + e.sets.length, 0);
  const vol = a.exercises.reduce((t, e) => t + e.sets.filter(s => s.done || s.r > 0).reduce((x, s) => x + (s.w || 0) * (s.r || 0), 0), 0);
  const curIdx = a.exercises.findIndex(e => e.sets.some(s => !s.done));
  let h = `<div class="wk-head">
    <button class="wk-title" data-a="rename" data-ctx="active"><span>${esc(a.name)}</span>${I.edit}</button>
    <span class="wk-clock num" data-live="elapsed">${fmtClock((Date.now() - a.start) / 1000)}</span>
    <button class="btn solid sm" data-a="finish">Finish</button></div>`;
  h += `<div class="wk-sub"><div class="prog-bar"><i style="width:${tot ? done / tot * 100 : 0}%"></i></div><span class="num">${done}/${tot} sets · ${fmtVol(vol)} ${unitLabel()}</span>
    <button class="link sm" data-a="toggle-snotes">${I.note}${a.notes ? 'Notes ·' : 'Add notes'}</button></div>`;
  if (a.notes || UI.openNotes.session) h += `<textarea class="notes" data-f="snotes" data-ctx="active" placeholder="How did the session feel? Sleep, energy, anything to remember…">${esc(a.notes)}</textarea>`;
  if (!a.exercises.length) h += `<div class="empty big">Add your first exercise to get going.</div>`;
  h += a.exercises.map((e, i) => exCard('active', a, e, i, i === curIdx)).join('');
  h += `<div class="wk-foot"><button class="btn outline big" data-a="pick" data-mode="add" data-ctx="active">${I.plus}Add exercise</button>
    <button class="btn solid big" data-a="finish">${I.check}Finish workout</button></div>`;
  return h;
}

/* Exercise card used both during a live workout (ctx=active) and when editing history (ctx=edit) */
function exCard(ctx, s, e, ei, current) {
  const ex = exById(e.exId);
  const bw = ex.eq === 'bodyweight';
  const live = ctx === 'active';
  const tpl = `40px minmax(0,1fr) minmax(0,1fr)${S.settings.showRPE ? ' minmax(0,.75fr)' : ''}${S.settings.showRIR ? ' minmax(0,.75fr)' : ''}${live ? ' 52px' : ''}`;
  const allDone = live && e.sets.length && e.sets.every(x => x.done);
  let h = `<section class="xcard${current ? ' current' : ''}${allDone ? ' complete' : ''}" id="x-${ei}">
    <header class="xh"><span class="xnum">${ei + 1}</span>
      <button class="xt" data-a="go" data-v="exercise" data-p="${ex.id}"><b>${esc(ex.name)}</b><span>${esc(MUSCLE_NAME[ex.muscle])} · ${esc(EQUIP_NAME[ex.eq] || '')} · ${e.repMin}–${e.repMax} reps</span></button>
      <button class="iconbtn" data-a="exmenu" data-ctx="${ctx}" data-ei="${ei}" aria-label="Exercise options">${I.dots}</button></header>`;
  if (live) {
    const last = lastEntry(e.exId, s.date);
    const lastLines = last ? last.sets.map(x => `<div>${fmtW(x.w, bw)}${x.w || !bw ? '' : ''} × ${x.r}</div>`).join('') : '<div class="muted">First time</div>';
    const tgt = e.sets.map(x => {
      if (x.tr == null && x.tw == null) return '';
      const up = last && x.tw != null && x.tw > entryTopW(last) + 0.001;
      return `<div class="${up ? 'up' : ''}">${x.tw != null ? fmtW(x.tw, bw) : '?'} × ${x.tr}</div>`;
    }).join('');
    h += `<div class="cmp"><div class="cmp-col"><span class="lbl">Last time${last ? ' · ' + ago(last.date).toLowerCase() : ''}</span>${lastLines}</div>
      <div class="cmp-col tgt"><span class="lbl">Today's target</span>${tgt || '<div class="muted">Choose a weight</div>'}</div></div>`;
    if (e.sug) h += `<div class="advice m-${e.sug.mode}"><b>${esc(e.sug.short)}</b><span>${esc(e.sug.msg)}</span></div>`;
    if (last && last.note) h += `<div class="lastnote">${I.note}<span>Last note: ${esc(last.note)}</span></div>`;
  }
  h += `<div class="sets" style="--tpl:${tpl}"><div class="shd"><span>Set</span><span>${unitLabel()}${bw ? ' +' : ''}</span><span>Reps</span>${S.settings.showRPE ? '<span>RPE</span>' : ''}${S.settings.showRIR ? '<span>RIR</span>' : ''}${live ? '<span></span>' : ''}</div>`;
  e.sets.forEach((x, si) => {
    const wv = x.w != null ? fmtNum(toUnit(x.w)) : '';
    const wph = x.tw != null ? fmtNum(toUnit(x.tw)) : (bw ? '0' : '');
    h += `<div class="srow${x.done ? ' done' : ''}${x.pr ? ' pr' : ''}${x.warm ? ' warm' : ''}">
      <button class="sno" data-a="setmenu" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" aria-label="Set ${si + 1} options">${x.warm ? 'W' : si + 1}${x.pr ? `<i class="prdot">${I.trophy}</i>` : ''}</button>
      <input class="num-in" data-f="w" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" inputmode="decimal" enterkeyhint="next" value="${wv}" placeholder="${wph}" aria-label="Weight set ${si + 1}">
      <input class="num-in" data-f="r" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" inputmode="numeric" enterkeyhint="done" value="${x.r != null ? x.r : ''}" placeholder="${x.tr != null ? x.tr : ''}" aria-label="Reps set ${si + 1}">
      ${S.settings.showRPE ? `<input class="num-in sm" data-f="rpe" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" inputmode="decimal" value="${x.rpe != null ? x.rpe : ''}" placeholder="–" aria-label="RPE">` : ''}
      ${S.settings.showRIR ? `<input class="num-in sm" data-f="rir" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" inputmode="numeric" value="${x.rir != null ? x.rir : ''}" placeholder="–" aria-label="Reps in reserve">` : ''}
      ${live ? `<button class="chk" data-a="done" data-ei="${ei}" data-si="${si}" aria-label="Complete set">${I.check}</button>` : ''}
    </div>`;
    if (x.note != null && (x.note !== '' || UI.openSetNotes[x.id])) h += `<input class="snote" data-f="snote" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" value="${esc(x.note)}" placeholder="Set note">`;
  });
  h += `</div><div class="xfoot">
    <button class="btn ghost sm" data-a="addset" data-ctx="${ctx}" data-ei="${ei}">${I.plus}Add set</button>
    ${live ? `<button class="btn ghost sm" data-a="rest" data-sec="${e.rest || 120}">${I.timer}${fmtClock(e.rest || 120)}</button>` : ''}
    <button class="btn ghost sm" data-a="exnote" data-ctx="${ctx}" data-ei="${ei}">${I.note}Note</button>
  </div>`;
  if (e.note || UI.openNotes[e.id]) h += `<textarea class="notes sm" data-f="enote" data-ctx="${ctx}" data-ei="${ei}" placeholder="Exercise note — seat height, grip, cues…">${esc(e.note)}</textarea>`;
  h += `</section>`;
  return h;
}

/* ---------- HISTORY ---------- */
function vHistory() {
  const ss = sortedSessions().slice().reverse();
  let h = topbar('History', { back: true, eyebrow: `${ss.length} workouts` });
  if (!ss.length) return h + `<div class="empty">No workouts logged yet.</div>`;
  let month = '';
  h += `<div class="hist">`;
  ss.forEach(s => {
    const d = new Date(s.date); const m = `${MON[d.getMonth()]} ${d.getFullYear()}`;
    if (m !== month) { month = m; h += `<div class="month">${m}</div>`; }
    h += sessionRow(s);
  });
  h += `</div><div class="center"><button class="btn ghost" data-a="log-past">${I.plus}Log a past workout</button></div>`;
  return h;
}
function vSession(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return topbar('Workout', { back: true }) + `<div class="empty">This workout no longer exists.</div>`;
  if (UI.editId === id) return vSessionEdit(s);
  const prs = IDX().prEvents.filter(p => p.sid === s.id);
  let h = topbar(s.name, { back: true, eyebrow: `${fmtDate(s.date, true)} · ${fmtTime(s.date)}`, right: `<button class="btn outline sm" data-a="edit-session" data-id="${s.id}">${I.edit}Edit</button>` });
  if (UI.justSaved === s.id) {
    h += `<div class="saved-banner"><div class="sb-ic">${I.check}</div><div><b>Workout saved</b><span>${prs.filter(p => p.type !== 'session').length ? `${prs.length} new record${prs.length > 1 ? 's' : ''} — nice work.` : 'Every set is stored. See you next session.'}</span></div></div>`;
  }
  h += `<div class="stat-row"><div><b>${s.end ? fmtDur(s.end - s.start) : '—'}</b><span>Duration</span></div><div><b>${s.exercises.filter(e => validSets(e).length).length}</b><span>Exercises</span></div><div><b>${sessionSetCount(s)}</b><span>Sets</span></div><div><b>${fmtVol(sessionVolume(s))}</b><span>Volume ${unitLabel()}</span></div></div>`;
  if (prs.length) h += `<section class="sec"><div class="card list pr-card">${prs.map(p => `<div class="pr-row"><span class="pr-ic">${I.trophy}</span><div class="grow"><div class="pr-ex">${p.exId ? esc(exById(p.exId).name) : 'Session'}</div><div class="muted xs">${esc(p.label)}</div></div><b class="num">${esc(p.value)}</b></div>`).join('')}</div></section>`;
  if (s.notes) h += `<section class="sec"><div class="card note-card">${I.note}<p>${esc(s.notes)}</p></div></section>`;
  s.exercises.forEach(e => {
    const ex = exById(e.exId); const sets = e.sets.filter(x => x.r > 0);
    const bw = ex.eq === 'bodyweight';
    const sg = UI.justSaved === s.id ? suggest(e.exId, e.repMin, e.repMax, Math.max(1, sets.length)) : null;
    h += `<section class="card hx"><button class="hx-h" data-a="go" data-v="exercise" data-p="${ex.id}"><b>${esc(ex.name)}</b><span class="muted xs">${esc(MUSCLE_NAME[ex.muscle])} · ${e.repMin}–${e.repMax}</span></button>
      <table class="hx-t"><tbody>${sets.map((x, i) => `<tr><td class="muted">${x.warm ? 'W' : i + 1}</td><td class="num"><b>${fmtW(x.w, bw)}</b>${x.w ? ' ' + unitLabel() : ''} × <b>${x.r}</b></td><td class="muted xs">${x.rpe != null && x.rpe !== '' ? 'RPE ' + x.rpe : ''}${x.rir != null && x.rir !== '' ? ' RIR ' + x.rir : ''}</td><td class="muted xs">${x.w ? 'e1RM ' + fmtW(Math.round(e1rm(x.w, x.r))) : ''}</td></tr>${x.note ? `<tr><td></td><td colspan="3" class="muted xs">“${esc(x.note)}”</td></tr>` : ''}`).join('')}</tbody></table>
      ${e.note ? `<div class="muted xs hx-note">${I.note} ${esc(e.note)}</div>` : ''}
      ${sg ? `<div class="advice m-${sg.mode} sm"><b>Next time</b><span>${esc(sg.msg)}</span></div>` : ''}</section>`;
  });
  h += `<div class="row-btns"><button class="btn outline" data-a="repeat" data-id="${s.id}">${I.reset}Repeat this workout</button><button class="btn danger-ghost" data-a="del-session" data-id="${s.id}">${I.trash}Delete</button></div>`;
  return h;
}
function vSessionEdit(s) {
  let h = topbar('Edit workout', { back: true, eyebrow: 'Changes save automatically', right: `<button class="btn solid sm" data-a="edit-done">Done</button>` });
  h += `<section class="card form">
    <label class="fl"><span>Name</span><input data-f="sname" data-ctx="edit" value="${esc(s.name)}"></label>
    <div class="two"><label class="fl"><span>Date &amp; start time</span><input type="datetime-local" data-f="sdate" data-ctx="edit" value="${toLocalInput(s.start || s.date)}"></label>
    <label class="fl"><span>Duration (min)</span><input inputmode="numeric" data-f="sdur" data-ctx="edit" value="${s.end ? Math.round((s.end - s.start) / 60000) : ''}"></label></div>
    <label class="fl"><span>Workout notes</span><textarea data-f="snotes" data-ctx="edit" placeholder="Notes">${esc(s.notes)}</textarea></label></section>`;
  h += s.exercises.map((e, i) => exCard('edit', s, e, i, false)).join('');
  h += `<div class="wk-foot"><button class="btn outline big" data-a="pick" data-mode="add" data-ctx="edit">${I.plus}Add exercise</button><button class="btn solid big" data-a="edit-done">${I.check}Done editing</button></div>`;
  return h;
}

/* ---------- PROGRAMME ---------- */
function vProgramme() {
  const p = S.programme;
  let h = topbar('Programme');
  if (!p) return h + `<div class="empty big">No programme yet.<br><button class="btn solid" data-a="split-sheet">Choose a split</button></div>`;
  const rec = RECOMMENDED_TEMPLATE[S.settings.days];
  h += `<section class="prog-head card"><label class="fl"><span>Programme name</span><input data-f="pname" value="${esc(p.name)}"></label>
    <div class="ph-row"><div><b>${p.days.length}</b><span>days / week</span></div><div><b>${p.days.reduce((a, d) => a + d.exercises.length, 0)}</b><span>exercises</span></div><div><b>${p.days.reduce((a, d) => a + d.exercises.reduce((x, e) => x + e.sets, 0), 0)}</b><span>weekly sets</span></div></div>
    <div class="ph-btns"><button class="btn outline sm" data-a="split-sheet">${I.swap}Change split</button><button class="btn outline sm" data-a="add-day">${I.plus}Add day</button></div>
    ${rec && p.templateId !== rec && TEMPLATES.find(t => t.id === rec) ? `<div class="muted xs">For ${S.settings.days} days a week the app recommends <b>${esc(TEMPLATES.find(t => t.id === rec).name)}</b>. Your current setup is fine to keep.</div>` : ''}
  </section>`;
  // weekly schedule strip
  h += `<section class="sec"><div class="sec-h"><h2>Weekly schedule</h2></div><div class="sched">${[1, 2, 3, 4, 5, 6, 0].map(wd => { const d = p.days.filter(x => x.weekday === wd); return `<div class="sc ${d.length ? 'on' : ''}"><span>${WD[wd]}</span><b>${d.length ? esc(d.map(x => x.name).join(' / ')) : 'Rest'}</b></div>`; }).join('')}</div></section>`;
  h += `<section class="sec"><div class="sec-h"><h2>Workouts</h2><span class="muted xs">Tap to edit</span></div>`;
  p.days.forEach((d, i) => {
    h += `<div class="card pday"><button class="pd-h" data-a="go" data-v="day" data-p="${d.id}"><div class="pd-i">${i + 1}</div><div class="grow"><b>${esc(d.name)}</b><div class="muted xs">${d.weekday != null ? WDL[d.weekday] : 'No fixed day'} · ~${estMinutes(d.exercises)} min</div></div><span class="chev">${I.right}</span></button>
      <ul class="pd-list">${d.exercises.map(e => `<li><span>${esc(exById(e.exId).name)}</span><span class="num muted">${e.sets} × ${e.repMin}–${e.repMax}</span></li>`).join('') || '<li class="muted">No exercises yet</li>'}</ul>
      <div class="pd-f"><div class="hero-chips">${muscleChips(dayMuscles(d))}</div><button class="btn solid sm" data-a="start-day" data-id="${d.id}">Start</button></div></div>`;
  });
  h += `</section>`;
  // weekly sets per muscle from the plan
  const sets = Object.fromEntries(TRACKED_MUSCLES.map(m => [m, 0]));
  p.days.forEach(d => d.exercises.forEach(e => { const ex = exById(e.exId); if (sets[ex.muscle] != null) sets[ex.muscle] += e.sets; (ex.sec || []).forEach(m => { if (sets[m] != null) sets[m] += e.sets * 0.5; }); }));
  h += `<section class="sec"><div class="sec-h"><h2>Planned weekly sets</h2><span class="muted xs">10–20 per muscle suits most lifters</span></div><div class="card">${volBars(sets)}</div></section>`;
  return h;
}
function volBars(sets) {
  const max = Math.max(22, ...Object.values(sets));
  return `<div class="vbars">${Object.entries(sets).map(([m, v]) => `<div class="vb"><span>${MUSCLE_NAME[m]}</span><div class="vb-track"><i class="zone" style="left:${10 / max * 100}%;width:${10 / max * 100}%"></i><i class="fill ${v < 10 ? 'low' : v > 20 ? 'high' : ''}" style="width:${Math.min(100, v / max * 100)}%"></i></div><b class="num">${Math.round(v * 10) / 10}</b></div>`).join('')}</div>`;
}
function vDay(id) {
  const d = S.programme?.days.find(x => x.id === id);
  if (!d) return topbar('Workout day', { back: true }) + `<div class="empty">This day was removed.</div>`;
  let h = topbar(d.name, { back: true, eyebrow: 'Edit workout day' });
  h += `<section class="card form"><label class="fl"><span>Name</span><input data-f="dname" data-id="${d.id}" value="${esc(d.name)}"></label>
    <div class="fl"><span>Training day</span><div class="chips wrap">${chip('Any', d.weekday == null, `data-a="day-wd" data-id="${d.id}" data-v=""`)}${[1, 2, 3, 4, 5, 6, 0].map(w => chip(WD[w], d.weekday === w, `data-a="day-wd" data-id="${d.id}" data-v="${w}"`)).join('')}</div></div></section>`;
  h += `<section class="sec"><div class="sec-h"><h2>Exercises</h2><span class="muted xs">Order = the order you'll train</span></div>`;
  d.exercises.forEach((e, i) => {
    const ex = exById(e.exId);
    h += `<div class="card dx"><div class="dx-h"><div class="dx-o"><button class="iconbtn sm" data-a="day-move" data-id="${d.id}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${I.up}</button><button class="iconbtn sm" data-a="day-move" data-id="${d.id}" data-i="${i}" data-d="1" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">${I.down}</button></div>
      <button class="grow xt" data-a="go" data-v="exercise" data-p="${ex.id}"><b>${esc(ex.name)}</b><span>${esc(MUSCLE_NAME[ex.muscle])} · ${esc(EQUIP_NAME[ex.eq])}${e.main ? ' · Main lift' : ''}</span></button>
      <button class="iconbtn sm" data-a="pick" data-mode="day-swap" data-id="${d.id}" data-i="${i}" aria-label="Swap">${I.swap}</button><button class="iconbtn sm" data-a="day-rm" data-id="${d.id}" data-i="${i}" aria-label="Remove">${I.trash}</button></div>
      <div class="dx-f"><div class="dx-c"><span class="lbl">Sets</span>${stepper(e.sets, 'day-sets', `data-id="${d.id}" data-i="${i}"`)}</div>
      <div class="dx-c"><span class="lbl">Rep range</span><div class="rr"><input class="num-in" inputmode="numeric" data-f="drmin" data-id="${d.id}" data-i="${i}" value="${e.repMin}"><span>–</span><input class="num-in" inputmode="numeric" data-f="drmax" data-id="${d.id}" data-i="${i}" value="${e.repMax}"></div></div></div></div>`;
  });
  h += `<button class="btn outline big" data-a="pick" data-mode="day-add" data-id="${d.id}">${I.plus}Add exercise</button></section>`;
  h += `<div class="row-btns"><button class="btn solid" data-a="start-day" data-id="${d.id}">${I.play}Start this workout</button><button class="btn outline" data-a="day-dup" data-id="${d.id}">${I.copy}Duplicate</button><button class="btn danger-ghost" data-a="day-del" data-id="${d.id}">${I.trash}Delete day</button></div>`;
  return h;
}

/* ---------- GENERATOR ---------- */
function vGenerate() {
  const g = UI.gen = UI.gen || { muscles: [], preset: null, size: 'standard', items: null, variety: 0, name: '' };
  let h = topbar('Generate workout', { back: true, eyebrow: 'Smart session builder' });
  h += `<section class="sec"><div class="lbl-h">Quick picks</div><div class="chips wrap">${GEN_PRESETS.map(p => chip(p.name, g.preset === p.id, `data-a="gen-preset" data-v="${p.id}"`)).join('')}</div>
    <div class="lbl-h">Or choose muscles</div><div class="chips wrap">${TRACKED_MUSCLES.map(m => { const d = muscleDays(m); return chip(`${MUSCLE_NAME[m]}${d != null ? ` · ${d}d` : ''}`, g.muscles.includes(m), `data-a="gen-m" data-v="${m}"`); }).join('')}</div>
    <div class="lbl-h">Session length</div>${seg([['short', 'Short · 4'], ['standard', 'Standard · 6'], ['long', 'Long · 8']], g.size, 'gen-size')}
    <button class="btn solid big" data-a="gen-go" ${g.muscles.length ? '' : 'disabled'}>${I.spark}${g.items ? 'Regenerate' : 'Generate'}</button></section>`;
  if (g.items) {
    h += `<section class="sec"><label class="fl"><span>Workout name</span><input data-f="gname" value="${esc(g.name)}"></label>
      <p class="muted xs">Built from the most rested muscles first, compounds before isolation, favouring exercises already in your programme and avoiding ones you did in the last 2 days.</p>`;
    g.items.forEach((e, i) => {
      const ex = exById(e.exId);
      h += `<div class="card dx"><div class="dx-h"><div class="dx-o"><button class="iconbtn sm" data-a="gen-move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${I.up}</button><button class="iconbtn sm" data-a="gen-move" data-i="${i}" data-d="1" ${i === g.items.length - 1 ? 'disabled' : ''} aria-label="Move down">${I.down}</button></div>
        <button class="grow xt" data-a="go" data-v="exercise" data-p="${ex.id}"><b>${esc(ex.name)}</b><span>${esc(MUSCLE_NAME[ex.muscle])} · ${esc(EQUIP_NAME[ex.eq])}</span></button>
        <button class="iconbtn sm" data-a="gen-cycle" data-i="${i}" aria-label="Next alternative">${I.shuffle}</button><button class="iconbtn sm" data-a="pick" data-mode="gen-swap" data-i="${i}" aria-label="Choose replacement">${I.swap}</button><button class="iconbtn sm" data-a="gen-rm" data-i="${i}" aria-label="Remove">${I.trash}</button></div>
        <div class="dx-f"><div class="dx-c"><span class="lbl">Sets</span>${stepper(e.sets, 'gen-sets', `data-i="${i}"`)}</div><div class="dx-c"><span class="lbl">Reps</span><div class="rr"><input class="num-in" inputmode="numeric" data-f="grmin" data-i="${i}" value="${e.repMin}"><span>–</span><input class="num-in" inputmode="numeric" data-f="grmax" data-i="${i}" value="${e.repMax}"></div></div></div></div>`;
    });
    h += `<button class="btn outline big" data-a="pick" data-mode="gen-add">${I.plus}Add exercise</button></section>
      <div class="row-btns"><button class="btn solid big" data-a="gen-start">${I.play}Start this workout</button><button class="btn outline" data-a="gen-save">${I.prog}Save to programme</button></div>`;
  }
  return h;
}

/* ---------- EXERCISES ---------- */
function vExercises() {
  const f = UI.exf;
  let h = topbar('Exercises', { right: `<button class="iconbtn" data-a="new-ex" aria-label="Create exercise">${I.plus}</button>` });
  h += `<div class="search">${I.search}<input data-f="exq" value="${esc(f.q)}" placeholder="Search ${allExercises().length} exercises" type="search"></div>
    <div class="chips scroll">${chip('All', f.m === 'all', 'data-a="exf-m" data-v="all"')}${MUSCLES.map(m => chip(m.name, f.m === m.id, `data-a="exf-m" data-v="${m.id}"`)).join('')}</div>
    <div class="chips scroll">${chip('Any equipment', f.eq === 'all', 'data-a="exf-eq" data-v="all"')}${EQUIPMENT.map(e => chip(e.name, f.eq === e.id, `data-a="exf-eq" data-v="${e.id}"`)).join('')}${chip('My exercises', f.mine, 'data-a="exf-mine"')}</div>
    <div id="ex-list">${exListHtml()}</div>`;
  return h;
}
function filterExercises(q, m, eq, mine) {
  const qq = (q || '').trim().toLowerCase();
  return allExercises().filter(e => (m === 'all' || e.muscle === m) && (eq === 'all' || e.eq === eq) && (!mine || e.custom) && (!qq || e.name.toLowerCase().includes(qq) || (MUSCLE_NAME[e.muscle] || '').toLowerCase().includes(qq) || (e.focus || '').toLowerCase().includes(qq)));
}
function exListHtml() {
  const f = UI.exf;
  const list = filterExercises(f.q, f.m, f.eq, f.mine);
  if (!list.length) return `<div class="empty">No exercises match. <button class="link" data-a="new-ex">Create “${esc(f.q || 'a new exercise')}”</button></div>`;
  let h = '';
  const groups = f.m === 'all' ? MUSCLES.map(m => [m, list.filter(e => e.muscle === m.id)]).filter(g => g[1].length) : [[MUSCLES.find(m => m.id === f.m), list]];
  groups.forEach(([m, items]) => {
    h += `<div class="month">${esc(m.name)} <span class="muted">${items.length}</span></div><div class="card list">`;
    h += items.map(exRow).join('');
    h += `</div>`;
  });
  return h;
}
function exRow(e) {
  const b = IDX().bests[e.exId || e.id];
  const liked = S.settings.liked.includes(e.id), excl = S.settings.excluded.includes(e.id);
  return `<button class="ex-row" data-a="go" data-v="exercise" data-p="${e.id}"><span class="eq-badge eq-${e.eq}">${esc((EQUIP_NAME[e.eq] || 'Other').slice(0, 2))}</span><div class="grow"><div class="ex-n">${esc(e.name)}${e.custom ? '<span class="tag">Mine</span>' : ''}${liked ? `<span class="tag acc">${I.heart}</span>` : ''}${excl ? '<span class="tag">Excluded</span>' : ''}</div><div class="muted xs">${esc(EQUIP_NAME[e.eq])}${e.focus ? ' · ' + esc(e.focus) : ''}${b ? ` · best ${fmtW(b.maxW, e.eq === 'bodyweight')}${b.maxW ? ' ' + unitLabel() : ''} × ${b.maxWReps}` : ''}</div></div><span class="chev">${I.right}</span></button>`;
}
function vExercise(id) {
  const ex = exById(id);
  const h0 = exHistory(id);
  const b = IDX().bests[id];
  const bw = ex.eq === 'bodyweight';
  const U = unitLabel();
  const liked = S.settings.liked.includes(id), excl = S.settings.excluded.includes(id);
  let h = topbar(ex.name, { back: true, eyebrow: `${MUSCLE_NAME[ex.muscle]}${ex.focus ? ' · ' + ex.focus : ''}`, small: ex.name.length > 22 });
  h += `<section class="card ex-hero">${muscleMap(ex.muscle, ex.sec || [])}
    <div class="ex-facts"><div><span class="lbl">Main muscle</span><b>${esc(MUSCLE_NAME[ex.muscle])}</b></div><div><span class="lbl">Also works</span><b>${(ex.sec || []).map(m => MUSCLE_NAME[m]).join(', ') || '—'}</b></div><div><span class="lbl">Equipment</span><b>${esc(EQUIP_NAME[ex.eq])}</b></div><div><span class="lbl">Type</span><b>${ex.type === 'heavy' ? 'Main compound' : ex.type === 'compound' ? 'Compound' : 'Isolation'}</b></div></div>
    <div class="ex-acts">${chip(liked ? 'Favourite' : 'Favourite', liked, `data-a="ex-like" data-id="${id}"`)}${chip(excl ? 'Excluded' : 'Exclude', excl, `data-a="ex-excl" data-id="${id}"`)}${S.active ? `<button class="chip" data-a="ex-add-active" data-id="${id}">+ Add to workout</button>` : ''}</div></section>`;
  // stats
  if (b) {
    h += `<section class="sec"><div class="stat-grid">
      <div><span class="lbl">Best weight</span><b>${fmtW(b.maxW, bw)}<small>${b.maxW ? ' ' + U : ''}</small></b><span class="muted xs">× ${b.maxWReps} reps</span></div>
      <div><span class="lbl">Est. 1RM</span><b>${b.bestE1 ? fmtW(Math.round(b.bestE1 * 10) / 10) : '—'}<small>${b.bestE1 ? ' ' + U : ''}</small></b><span class="muted xs">${b.bestE1Set ? `from ${fmtW(b.bestE1Set.w)} × ${b.bestE1Set.r}` : 'needs added weight'}</span></div>
      <div><span class="lbl">Best reps</span><b>${b.maxReps}</b><span class="muted xs">at ${fmtW(b.maxRepsW, bw)}${b.maxRepsW ? ' ' + U : ''}</span></div>
      <div><span class="lbl">Best volume</span><b>${fmtVol(b.bestVol)}<small> ${U}</small></b><span class="muted xs">${h0.length} session${h0.length === 1 ? '' : 's'} logged</span></div></div></section>`;
    const pts = h0.map(x => ({ x: x.date, y: bw && !entryTopW(x) ? x.sets.reduce((a, s) => Math.max(a, s.r), 0) : Math.round(entryE1(x) * 10) / 10 || entryTopW(x) })).map(p => ({ x: p.x, y: bw ? p.y : toUnit(p.y) }));
    h += `<section class="sec"><div class="sec-h"><h2>${bw && !b.maxW ? 'Best reps over time' : 'Estimated 1RM over time'}</h2></div><div class="card">${lineChart(pts, { fmt: v => Math.round(v), label: 'Progress chart' })}</div></section>`;
    const sg = h0.length ? suggest(id, h0[h0.length - 1].repMin || 8, h0[h0.length - 1].repMax || 12, h0[h0.length - 1].sets.length) : null;
    if (sg) h += `<div class="advice m-${sg.mode}"><b>Next time</b><span>${esc(sg.msg)}</span></div>`;
  }
  h += `<section class="sec"><div class="sec-h"><h2>How to do it</h2><a class="link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' exercise form')}" target="_blank" rel="noopener">${I.video}Watch a demo</a></div><div class="card">
    ${ex.steps && ex.steps.length ? `<ol class="steps">${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : `<p class="muted">${esc(ex.instructions || 'No instructions added.')}</p>`}
    </div></section>`;
  const tips = exTips(ex), mis = exMistakes(ex);
  if (tips.length || mis.length) h += `<section class="sec two-col"><div class="card tipcard"><div class="lbl good">Technique tips</div><ul>${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div><div class="card tipcard"><div class="lbl bad">Common mistakes</div><ul>${mis.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></section>`;
  const cat = repCategory(ex, false);
  const rr = S.settings.reps;
  h += `<section class="sec"><div class="card rr-card"><div class="lbl">Recommended rep ranges</div><div class="rr-row">${ex.type === 'heavy' ? `<div><b>${rr.heavy[0]}–${rr.heavy[1]}</b><span>as a main strength lift</span></div>` : ''}${ex.type === 'heavy' ? `<div><b>${rr.compound[0]}–${rr.compound[1]}</b><span>as a volume lift</span></div>` : `<div><b>${rr[cat][0]}–${rr[cat][1]}</b><span>for growth</span></div>`}<div><b>${restLabel(restFor(ex, ex.type === 'heavy'))}</b><span>rest between sets</span></div></div></div></section>`;
  if (ex.custom && ex.notes) h += `<section class="sec"><div class="card note-card">${I.note}<p>${esc(ex.notes)}</p></div></section>`;
  if (h0.length) {
    h += `<section class="sec"><div class="sec-h"><h2>My history</h2></div><div class="card list">`;
    h += h0.slice().reverse().slice(0, 30).map(x => `<button class="hist-line" data-a="go" data-v="session" data-p="${x.sid}"><div><b>${fmtDate(x.date)}</b><div class="muted xs">${x.sets.length} sets${x.note ? ' · ' + esc(x.note) : ''}</div></div><span class="num">${setsText(x.sets, bw).join(', ')}</span></button>`).join('');
    h += `</div></section>`;
  } else h += `<div class="empty">You haven't logged this exercise yet. Your sets, bests and chart will appear here.</div>`;
  if (ex.custom) h += `<div class="row-btns"><button class="btn outline" data-a="edit-ex" data-id="${id}">${I.edit}Edit exercise</button><button class="btn danger-ghost" data-a="del-ex" data-id="${id}">${I.trash}Delete</button></div>`;
  return h;
}
function restLabel(s) { return s >= 120 ? `${Math.round(s / 60 * 2) / 2} min` : `${s} s`; }
function vExForm(id) {
  const d = UI.exDraft;
  let h = topbar(id ? 'Edit exercise' : 'New exercise', { back: true });
  h += `<section class="card form">
    <label class="fl"><span>Exercise name</span><input data-f="xd" data-k="name" value="${esc(d.name)}" placeholder="e.g. Plate-Loaded Row"></label>
    <div class="fl"><span>Main muscle</span><div class="chips wrap">${MUSCLES.map(m => chip(m.name, d.muscle === m.id, `data-a="xd-m" data-v="${m.id}"`)).join('')}</div></div>
    <div class="fl"><span>Secondary muscles</span><div class="chips wrap">${MUSCLES.filter(m => m.id !== d.muscle).map(m => chip(m.name, d.sec.includes(m.id), `data-a="xd-sec" data-v="${m.id}"`)).join('')}</div></div>
    <div class="fl"><span>Equipment</span><div class="chips wrap">${EQUIPMENT.map(e => chip(e.name, d.eq === e.id, `data-a="xd-eq" data-v="${e.id}"`)).join('')}</div></div>
    <div class="fl"><span>Type</span>${seg([['heavy', 'Main compound'], ['compound', 'Compound'], ['isolation', 'Isolation']], d.type, 'xd-type')}</div>
    <label class="fl"><span>Movement (used for replacement suggestions)</span><select data-f="xd" data-k="pat">${Object.entries(PATTERNS).map(([k, p]) => `<option value="${k}" ${d.pat === k ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label class="fl"><span>Instructions</span><textarea data-f="xd" data-k="instructions" placeholder="One step per line">${esc(d.instructions)}</textarea></label>
    <label class="fl"><span>Notes</span><textarea data-f="xd" data-k="notes" placeholder="Machine settings, cues…">${esc(d.notes)}</textarea></label>
    <button class="btn solid big" data-a="save-ex">${I.check}${id ? 'Save changes' : 'Create exercise'}</button></section>`;
  return h;
}

/* ---------- PROGRESS ---------- */
function vProgress() {
  let h = topbar('Progress');
  const idx = IDX();
  const exIds = Object.keys(idx.byEx).sort((a, b) => idx.byEx[b].length - idx.byEx[a].length);
  if (!idx.sessions.length) return h + `<div class="empty big">Log your first workout and your progress will build up here.</div>`;
  const cur = UI.prog.ex && idx.byEx[UI.prog.ex] ? UI.prog.ex : exIds[0];
  UI.prog.ex = cur;
  const ex = exById(cur), hist = idx.byEx[cur], bw = ex.eq === 'bodyweight';
  const metric = UI.prog.metric;
  const val = x => metric === 'e1' ? entryE1(x) : metric === 'top' ? entryTopW(x) : metric === 'reps' ? x.sets.reduce((a, s) => Math.max(a, s.r), 0) : x.sets.reduce((a, s) => a + (s.w || 0) * s.r, 0);
  const pts = hist.map(x => ({ x: x.date, y: metric === 'reps' ? val(x) : Math.round(toUnit(val(x)) * 10) / 10 }));
  const first = pts[0]?.y || 0, lastv = pts[pts.length - 1]?.y || 0;
  const diff = lastv - first;
  h += `<section class="sec"><div class="sec-h"><h2>Exercise progress</h2></div><div class="card">
    <select class="ex-sel" data-f="prog-ex">${exIds.map(id => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(exById(id).name)} (${idx.byEx[id].length})</option>`).join('')}</select>
    ${seg([['e1', 'Est. 1RM'], ['top', 'Top weight'], ['reps', 'Best reps'], ['vol', 'Volume']], metric, 'prog-metric')}
    <div class="pg-sum"><div><span class="lbl">Latest</span><b class="num">${metric === 'reps' ? lastv : fmtNum(lastv)}<small>${metric === 'reps' ? ' reps' : ' ' + unitLabel()}</small></b></div><div><span class="lbl">Change</span><b class="num ${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '+' : ''}${fmtNum(Math.round(diff * 10) / 10)}</b></div><div><span class="lbl">Sessions</span><b class="num">${hist.length}</b></div></div>
    ${lineChart(pts, { fmt: v => Math.round(v), label: `${ex.name} progress` })}
    <button class="link" data-a="go" data-v="exercise" data-p="${cur}">Full ${esc(ex.name)} history ${I.right}</button></div></section>`;
  // PRs
  const prs = idx.prEvents;
  if (prs.length) {
    const shown = UI.showAllPR ? prs.slice(0, 60) : prs.slice(0, 5);
    h += `<section class="sec"><div class="sec-h"><h2>Personal records</h2>${prs.length > 5 ? `<button class="link" data-a="toggle-pr">${UI.showAllPR ? 'Show less' : `All ${prs.length}`}</button>` : ''}</div><div class="card list">${shown.map(p => p.exId ? prRow(p) : `<button class="pr-row" data-a="go" data-v="session" data-p="${p.sid}"><span class="pr-ic">${I.trophy}</span><div class="grow"><div class="pr-ex">${esc(p.label)}</div><div class="muted xs">${ago(p.date)}</div></div><b class="num">${esc(p.value)}</b></button>`).join('')}</div></section>`;
  }
  // best lifts table
  const top = exIds.filter(id => idx.bests[id].bestE1 > 0).slice(0, 6);
  if (top.length) h += `<section class="sec"><div class="sec-h"><h2>Strength</h2><span class="muted xs">Best estimated 1RM</span></div><div class="card list">${top.map(id => { const b = idx.bests[id]; const hh = idx.byEx[id]; return `<button class="pr-row" data-a="prog-pick" data-id="${id}"><div class="grow"><div class="pr-ex">${esc(exById(id).name)}</div><div class="muted xs">Heaviest ${fmtW(b.maxW)} × ${b.maxWReps}</div></div>${spark(hh.slice(-10).map(entryE1))}<b class="num">${fmtW(Math.round(b.bestE1))}</b></button>`; }).join('')}</div></section>`;
  // sessions per week & volume
  const weeks = 12, ws = startOfWeek(Date.now());
  const wk = Array.from({ length: weeks }, (_, i) => ws - (weeks - 1 - i) * 7 * DAY);
  const cnt = wk.map(t => idx.sessions.filter(s => s.date >= t && s.date < t + 7 * DAY).length);
  const vol = wk.map(t => idx.sessions.filter(s => s.date >= t && s.date < t + 7 * DAY).reduce((a, s) => a + toUnit(sessionVolume(s)), 0));
  const lbl = wk.map((t, i) => i % 3 === 2 || i === weeks - 1 ? fmtShort(t) : '');
  h += `<section class="sec"><div class="sec-h"><h2>Sessions per week</h2><span class="muted xs">avg ${(cnt.slice(-4).reduce((a, b) => a + b, 0) / 4).toFixed(1)} last 4 wks</span></div><div class="card">${barChart(cnt, lbl, { target: S.settings.days, label: 'Sessions per week' })}</div></section>`;
  h += `<section class="sec"><div class="sec-h"><h2>Training volume</h2><span class="muted xs">${unitLabel()} lifted per week</span></div><div class="card">${barChart(vol, lbl, { fmt: v => v >= 1000 ? Math.round(v / 1000) + 'k' : v, label: 'Weekly volume' })}</div></section>`;
  // muscle frequency
  const sets7 = weeklySets(Date.now() - 7 * DAY);
  h += `<section class="sec"><div class="sec-h"><h2>Sets per muscle · last 7 days</h2></div><div class="card">${volBars(sets7)}<div class="muted xs pad-t">Shaded zone = 10–20 hard sets, a good weekly target for growth. Secondary muscles count as half a set.</div></div></section>`;
  const freq = TRACKED_MUSCLES.map(m => { const n = new Set(idx.sessions.filter(s => Date.now() - s.date < 28 * DAY && s.exercises.some(e => exById(e.exId).muscle === m && validSets(e).length)).map(s => startOfDay(s.date))).size; return { m, f: n / 4, d: muscleDays(m) }; });
  h += `<section class="sec"><div class="sec-h"><h2>Muscle frequency</h2><span class="muted xs">times per week · last 4 weeks</span></div><div class="card list">${freq.map(x => `<div class="freq"><span>${MUSCLE_NAME[x.m]}</span><div class="dots">${[0, 1, 2, 3].map(i => `<i class="${x.f > i + 0.25 ? 'on' : ''}"></i>`).join('')}</div><b class="num">${x.f.toFixed(1)}×</b><span class="muted xs">${x.d == null ? 'never' : x.d === 0 ? 'today' : x.d + 'd ago'}</span></div>`).join('')}</div></section>`;
  // consistency
  const calStart = ws - 11 * 7 * DAY;
  const daySet = new Set(idx.sessions.map(s => startOfDay(s.date)));
  let cal = '';
  for (let w = 0; w < 12; w++) { cal += '<div class="cal-col">'; for (let d = 0; d < 7; d++) { const t = calStart + (w * 7 + d) * DAY; cal += `<i class="${daySet.has(startOfDay(t)) ? 'on' : ''}${t > Date.now() ? ' fut' : ''}" title="${fmtShort(t)}"></i>`; } cal += '</div>'; }
  const cons = exIds.slice(0, 8).map(id => { const wset = new Set(idx.byEx[id].filter(x => x.date >= calStart).map(x => startOfWeek(x.date))); return { id, n: wset.size }; });
  h += `<section class="sec"><div class="sec-h"><h2>Consistency</h2><span class="muted xs">last 12 weeks</span></div><div class="card"><div class="cal"><div class="cal-days">${['M', '', 'W', '', 'F', '', 'S'].map(x => `<span>${x}</span>`).join('')}</div>${cal}</div>
    <div class="cons">${cons.map(c => `<div><span>${esc(exById(c.id).name)}</span><div class="cbar"><i style="width:${c.n / 12 * 100}%"></i></div><b class="num">${c.n}/12 wks</b></div>`).join('')}</div></div></section>`;
  return h;
}

/* ---------- SETTINGS ---------- */
function vSettings() {
  const s = S.settings;
  let h = topbar('Settings', { back: true });
  h += `<section class="sec"><div class="lbl-h">Training</div><div class="card form">
    <div class="fl"><span>Primary goal</span>${seg([['muscle', 'Muscle'], ['strength', 'Strength'], ['both', 'Muscle + Strength']], s.goal, 'set-goal')}</div>
    <div class="fl"><span>Workouts per week</span>${seg([[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], s.days, 'set-days')}</div>
    <div class="fl"><span>Experience</span>${seg([['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], s.experience, 'set-exp')}</div>
    <div class="fl"><span>Equipment</span>${seg([['commercial', 'Full gym'], ['home', 'Home gym'], ['custom', 'Custom']], s.equipMode, 'set-eqmode')}
    ${s.equipMode === 'custom' ? `<div class="chips wrap">${EQUIPMENT.map(e => chip(e.name, s.equipment.includes(e.id), `data-a="set-eq" data-v="${e.id}"`)).join('')}</div>` : ''}</div>
    <button class="btn outline" data-a="rebuild">${I.reset}Rebuild programme from these settings</button></div></section>`;
  const rr = (k, label) => `<div class="rr-set"><span>${label}</span><div class="rr"><input class="num-in" inputmode="numeric" data-f="setrep" data-k="${k}" data-i="0" value="${s.reps[k][0]}"><span>–</span><input class="num-in" inputmode="numeric" data-f="setrep" data-k="${k}" data-i="1" value="${s.reps[k][1]}"></div></div>`;
  h += `<section class="sec"><div class="lbl-h">Preferred rep ranges</div><div class="card form">${rr('heavy', 'Main compound lifts')}${rr('compound', 'Other compounds')}${rr('isolation', 'Isolation')}${rr('small', 'Delts, calves & abs')}
    <p class="muted xs">Used for new programmes and generated workouts. Existing programme days keep their own ranges — edit those in Programme.</p></div></section>`;
  const rs = (k, label) => `<div class="rr-set"><span>${label}</span>${stepper(fmtClock(s.rest[k]), 'set-rest', `data-k="${k}"`)}</div>`;
  h += `<section class="sec"><div class="lbl-h">Rest timer</div><div class="card form">${rs('heavy', 'Heavy compound')}${rs('compound', 'Moderate compound')}${rs('isolation', 'Isolation')}
    ${toggle('Start timer automatically after each set', s.autoRest, 'set-toggle', 'autoRest')}${toggle('Sound when rest is over', s.restSound, 'set-toggle', 'restSound')}</div></section>`;
  h += `<section class="sec"><div class="lbl-h">Logging</div><div class="card form">
    <div class="fl"><span>Units</span>${seg([['kg', 'kg'], ['lb', 'lb']], s.unit, 'set-unit')}</div>
    ${toggle('Show RPE column', s.showRPE, 'set-toggle', 'showRPE')}${toggle('Show RIR (reps in reserve) column', s.showRIR, 'set-toggle', 'showRIR')}
    <div class="rr-set"><span>Barbell / smith jump</span>${stepper(fmtNum(s.inc.barbell) + ' ' + s.unit, 'set-inc', 'data-k="barbell"')}</div>
    <div class="rr-set"><span>Dumbbell jump</span>${stepper(fmtNum(s.inc.dumbbell) + ' ' + s.unit, 'set-inc', 'data-k="dumbbell"')}</div>
    <div class="rr-set"><span>Machine / cable jump</span>${stepper(fmtNum(s.inc.machine) + ' ' + s.unit, 'set-inc', 'data-k="machine"')}</div></div></section>`;
  h += `<section class="sec"><div class="lbl-h">Appearance</div><div class="card form"><div class="fl"><span>Theme</span>${seg([['dark', 'Dark'], ['light', 'Light'], ['system', 'Match phone']], s.theme, 'set-theme')}</div></div></section>`;
  h += `<section class="sec"><div class="lbl-h">Exercise preferences</div><div class="card form">
    <div class="fl"><span>Favourites (${s.liked.length})</span><div class="chips wrap">${s.liked.map(id => chip(exById(id).name + ' ×', true, `data-a="ex-like" data-id="${id}"`)).join('') || '<span class="muted xs">Mark favourites from any exercise page.</span>'}</div></div>
    <div class="fl"><span>Excluded (${s.excluded.length})</span><div class="chips wrap">${s.excluded.map(id => chip(exById(id).name + ' ×', true, `data-a="ex-excl" data-id="${id}"`)).join('') || '<span class="muted xs">Excluded exercises never appear in generated plans.</span>'}</div></div></div></section>`;
  h += `<section class="sec"><div class="lbl-h">Your data</div><div class="card form">
    <div class="cloud-line s-on">${I.cloud}<div><b>Saved on this phone</b><span>Every change saves instantly on this device — no account, no internet needed. A snapshot is also kept automatically each day. Export a backup file now and then in case you change phones.</span></div></div>
    <div class="data-stats"><div><b>${S.sessions.length}</b><span>workouts</span></div><div><b>${S.sessions.reduce((a, x) => a + sessionSetCount(x), 0)}</b><span>sets</span></div><div><b>${S.customExercises.length}</b><span>custom exercises</span></div></div>
    <button class="btn solid" data-a="export">${I.download}Export / back up data</button>
    <button class="btn outline" data-a="import">${I.upload}Import / restore backup</button>
    ${S.hasDemo ? `<button class="btn outline" data-a="clear-demo">${I.trash}Clear demo data</button>` : ''}
    <button class="btn danger-ghost" data-a="reset-all">${I.trash}Erase everything</button></div></section>
    <section class="sec"><div class="lbl-h">Automatic daily snapshots</div><div class="card list" id="snaps"><div class="muted xs" style="padding:12px 14px">Loading…</div></div></section>
    <p class="center muted xs">Gym · your data never leaves this phone unless you export it.</p>`;
  return h;
}
function toggle(label, on, action, key) { return `<button class="toggle-row" data-a="${action}" data-k="${key}" role="switch" aria-checked="${on}"><span>${esc(label)}</span><i class="sw ${on ? 'on' : ''}"></i></button>`; }

/* ---------- ONBOARDING ---------- */
function vOnboarding() {
  const o = UI.ob; o.d = o.d || { goal: 'both', days: 4, experience: 'intermediate', equipMode: 'commercial', equipment: EQUIP_PRESETS.commercial.slice(), liked: [], excluded: [], demo: true, template: null };
  const d = o.d;
  const steps = 6;
  const pbar = `<div class="ob-prog">${Array.from({ length: steps }, (_, i) => `<i class="${i <= o.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  const opt = (a, v, cur, title, sub) => `<button class="ob-opt ${String(cur) === String(v) ? 'on' : ''}" data-a="${a}" data-v="${v}"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</button>`;
  if (o.step === 0) body = `<div class="ob-hero"><div class="logo">${I.lift}</div><h1>Gym</h1><p>Your personal coach for building muscle and strength. Six quick questions and your programme is ready.</p><button class="link" data-a="ob-restore">${I.upload}Already have a backup? Restore it</button></div>
    <h2>What's your main goal?</h2>${opt('ob-goal', 'both', d.goal, 'Muscle + Strength', 'Heavy compounds plus hypertrophy work — recommended')}${opt('ob-goal', 'muscle', d.goal, 'Muscle', 'Maximise size with moderate and higher reps')}${opt('ob-goal', 'strength', d.goal, 'Strength', 'Lift as heavy as possible on the big lifts')}`;
  if (o.step === 1) body = `<h2>How many days a week do you want to train?</h2><div class="ob-days">${[2, 3, 4, 5, 6].map(n => `<button class="ob-day ${d.days === n ? 'on' : ''}" data-a="ob-days" data-v="${n}">${n}</button>`).join('')}</div><p class="muted">You can change this any time. ${esc(TEMPLATES.find(t => t.id === RECOMMENDED_TEMPLATE[d.days]).name)} is recommended for ${d.days} days.</p>`;
  if (o.step === 2) body = `<h2>Training experience</h2>${opt('ob-exp', 'beginner', d.experience, 'Beginner', 'Under a year of consistent lifting')}${opt('ob-exp', 'intermediate', d.experience, 'Intermediate', '1–3 years, comfortable with the main lifts')}${opt('ob-exp', 'advanced', d.experience, 'Advanced', '3+ years, progress comes slowly')}`;
  if (o.step === 3) body = `<h2>What equipment do you have?</h2>${opt('ob-eq', 'commercial', d.equipMode, 'Full commercial gym', 'Barbells, dumbbells, cables, machines')}${opt('ob-eq', 'home', d.equipMode, 'Home gym', 'Barbell, rack, dumbbells, bench')}${opt('ob-eq', 'custom', d.equipMode, 'Custom', 'Pick exactly what you have')}
    ${d.equipMode === 'custom' ? `<div class="chips wrap">${EQUIPMENT.map(e => chip(e.name, d.equipment.includes(e.id), `data-a="ob-eqc" data-v="${e.id}"`)).join('')}</div>` : ''}`;
  if (o.step === 4) body = `<h2>Any exercises you particularly like?</h2><p class="muted">They'll be prioritised in your programme. Optional.</p><div class="chips wrap">${POPULAR.map(id => chip(exById(id).name, d.liked.includes(id), `data-a="ob-like" data-v="${id}"`)).join('')}</div>
    <h2 class="mt">Anything to exclude?</h2><p class="muted">Injuries, no access, or you just hate it.</p><div class="chips wrap">${POPULAR.map(id => chip(exById(id).name, d.excluded.includes(id), `data-a="ob-excl" data-v="${id}"`)).join('')}</div>`;
  if (o.step === 5) {
    const rec = RECOMMENDED_TEMPLATE[d.days];
    d.template = d.template || rec;
    const opts = TEMPLATES.filter(t => t.days === d.days || t.id === rec);
    body = `<h2>Your split</h2><p class="muted">Based on ${d.days} days a week. Everything is editable later.</p>
      ${opts.map(t => `<button class="ob-opt ${d.template === t.id ? 'on' : ''}" data-a="ob-tpl" data-v="${t.id}"><b>${esc(t.name)}${t.id === rec ? ' <span class="tag acc">Recommended</span>' : ''}</b><span>${esc(t.desc)}</span><span class="xs">${t.plan.map(p => p[0]).join(' · ')}</span></button>`).join('')}
      <button class="toggle-row" data-a="ob-demo" role="switch" aria-checked="${d.demo}"><span>Load demo workouts so I can explore first<br><small class="muted">One tap removes them later</small></span><i class="sw ${d.demo ? 'on' : ''}"></i></button>`;
  }
  return `<div class="ob">${pbar}<div class="ob-body">${body}</div>
    <div class="ob-nav">${o.step > 0 ? `<button class="btn ghost" data-a="ob-back">Back</button>` : '<span></span>'}${o.step < steps - 1 ? `<button class="btn solid big" data-a="ob-next">${o.step === 4 ? (d.liked.length || d.excluded.length ? 'Continue' : 'Skip') : 'Continue'}</button>` : `<button class="btn solid big" data-a="ob-finish">${I.bolt}Build my programme</button>`}</div></div>`;
}

/* ---------- SHEETS ---------- */
function renderSheet() {
  const root = document.getElementById('sheet');
  const sh = UI.sheet;
  if (!sh) { root.className = 'sheet-wrap'; root.innerHTML = ''; document.body.classList.remove('locked'); return; }
  document.body.classList.add('locked');
  const html = SHEETS[sh.type](sh);
  root.innerHTML = `<div class="backdrop" data-a="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  root.className = 'sheet-wrap open' + (UI.sheetFresh ? ' fresh' : '');
  UI.sheetFresh = false;
  const auto = root.querySelector('[data-autofocus]');
  if (auto && !('ontouchstart' in window)) auto.focus();
}
const SHEETS = {
  confirm: sh => `<h3>${esc(sh.title)}</h3><p class="muted">${esc(sh.body)}</p><div class="sheet-btns"><button class="btn ${sh.danger ? 'danger' : 'solid'} big" data-a="confirm-ok">${esc(sh.ok)}</button><button class="btn ghost big" data-a="sheet-close">Cancel</button></div>`,
  rename: sh => `<h3>${esc(sh.title)}</h3><input class="big-in" id="rename-in" value="${esc(sh.value)}" data-autofocus><div class="sheet-btns"><button class="btn solid big" data-a="rename-ok">Save</button><button class="btn ghost big" data-a="sheet-close">Cancel</button></div>`,
  setmenu: sh => {
    const s = getSess(sh.ctx); const x = s.exercises[sh.ei].sets[sh.si];
    return `<h3>Set ${sh.si + 1} · ${esc(exById(s.exercises[sh.ei].exId).name)}</h3><div class="menu">
      <button data-a="set-dup">${I.copy}Duplicate set</button>
      <button data-a="set-note">${I.note}${x.note ? 'Edit note' : 'Add note'}</button>
      <button data-a="set-warm">${I.bolt}${x.warm ? 'Mark as working set' : 'Mark as warm-up (not counted)'}</button>
      ${sh.ctx === 'active' && x.done ? `<button data-a="set-undone">${I.reset}Mark as not done</button>` : ''}
      <button class="danger" data-a="set-del">${I.trash}Delete set</button></div>`;
  },
  exmenu: sh => {
    const s = getSess(sh.ctx); const e = s.exercises[sh.ei]; const ex = exById(e.exId);
    return `<h3>${esc(ex.name)}</h3><div class="menu">
      <button data-a="pick" data-mode="replace" data-ctx="${sh.ctx}" data-ei="${sh.ei}">${I.swap}Replace exercise</button>
      <button data-a="ex-move" data-d="-1" ${sh.ei === 0 ? 'disabled' : ''}>${I.up}Move up</button>
      <button data-a="ex-move" data-d="1" ${sh.ei === s.exercises.length - 1 ? 'disabled' : ''}>${I.down}Move down</button>
      <button data-a="reorder" data-ctx="${sh.ctx}">${I.grip}Reorder all exercises</button>
      <button data-a="range" data-ctx="${sh.ctx}" data-ei="${sh.ei}">${I.target}Rep range &amp; rest</button>
      <button data-a="exnote" data-ctx="${sh.ctx}" data-ei="${sh.ei}">${I.note}Exercise note</button>
      <button data-a="go" data-v="exercise" data-p="${ex.id}">${I.info}Technique &amp; history</button>
      <button class="danger" data-a="ex-rm">${I.trash}Remove exercise</button></div>`;
  },
  reorder: sh => { const s = getSess(sh.ctx); return `<h3>Reorder exercises</h3><div class="reorder">${s.exercises.map((e, i) => `<div class="ro"><span class="xnum">${i + 1}</span><b class="grow">${esc(exById(e.exId).name)}</b><button class="iconbtn sm" data-a="ro-move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${I.up}</button><button class="iconbtn sm" data-a="ro-move" data-i="${i}" data-d="1" ${i === s.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">${I.down}</button></div>`).join('')}</div><div class="sheet-btns"><button class="btn solid big" data-a="sheet-close">Done</button></div>`; },
  range: sh => { const s = getSess(sh.ctx); const e = s.exercises[sh.ei]; return `<h3>Rep range &amp; rest</h3><div class="form"><div class="rr-set"><span>Target reps</span><div class="rr"><input class="num-in" inputmode="numeric" id="rg-min" value="${e.repMin}"><span>–</span><input class="num-in" inputmode="numeric" id="rg-max" value="${e.repMax}"></div></div>
    ${sh.ctx === 'active' ? `<div class="rr-set"><span>Rest</span>${stepper(fmtClock(e.rest || 120), 'rg-rest')}</div>` : ''}<p class="muted xs">Targets for remaining sets update to the new range.</p></div><div class="sheet-btns"><button class="btn solid big" data-a="range-ok">Save</button></div>`; },
  picker: sh => {
    const title = { add: 'Add exercise', replace: 'Replace exercise', 'day-add': 'Add exercise', 'day-swap': 'Swap exercise', 'gen-add': 'Add exercise', 'gen-swap': 'Swap exercise' }[sh.mode];
    return `<h3>${title}</h3>${sh.from ? `<p class="muted sm">Replacing <b>${esc(exById(sh.from).name)}</b>. Similar movements first.</p>` : ''}
      <div class="search">${I.search}<input id="pick-q" data-f="pickq" value="${esc(sh.q || '')}" placeholder="Search exercises" type="search"></div>
      <div class="chips scroll">${chip('All', !sh.m, 'data-a="pick-m" data-v=""')}${MUSCLES.map(m => chip(m.name, sh.m === m.id, `data-a="pick-m" data-v="${m.id}"`)).join('')}</div>
      <div id="pick-list" class="pick-list">${pickListHtml(sh)}</div>
      <button class="btn ghost" data-a="new-ex">${I.plus}Create a new exercise</button>`;
  },
  finish: sh => {
    const a = S.active;
    const logged = a.exercises.map(e => ({ e, n: e.sets.filter(x => x.r > 0).length }));
    const empty = logged.filter(x => !x.n);
    const sets = logged.reduce((t, x) => t + x.n, 0);
    const vol = a.exercises.reduce((t, e) => t + e.sets.filter(x => x.r > 0).reduce((y, x) => y + (x.w || 0) * x.r, 0), 0);
    const prs = a.exercises.reduce((t, e) => t + e.sets.filter(x => x.pr && x.r > 0).length, 0);
    const day = a.dayId && S.programme?.days.find(d => d.id === a.dayId);
    const changed = day && (day.exercises.map(x => x.exId + x.sets + x.repMin + x.repMax).join() !== a.exercises.map(x => x.exId + x.sets.length + x.repMin + x.repMax).join());
    return `<h3>Finish workout?</h3><div class="stat-row sm"><div><b>${fmtDur(Date.now() - a.start)}</b><span>Duration</span></div><div><b>${sets}</b><span>Sets</span></div><div><b>${fmtVol(vol)}</b><span>${unitLabel()}</span></div><div><b>${prs}</b><span>Records</span></div></div>
      ${empty.length ? `<p class="warn-line">${I.info}${empty.length} exercise${empty.length > 1 ? 's have' : ' has'} no logged sets and won't be saved: ${esc(empty.map(x => exById(x.e.exId).name).join(', '))}.</p>` : ''}
      ${sets ? '' : `<p class="warn-line">${I.info}No sets have reps entered yet. Enter reps (or tap ✓ to log the target) before finishing.</p>`}
      <textarea class="notes" data-f="snotes" data-ctx="active" placeholder="Workout notes (optional)">${esc(a.notes)}</textarea>
      ${changed ? `<button class="toggle-row" data-a="fin-upd" role="switch" aria-checked="${!!sh.upd}"><span>Update “${esc(day.name)}” in my programme with today's exercises and set counts</span><i class="sw ${sh.upd ? 'on' : ''}"></i></button>` : ''}
      <div class="sheet-btns"><button class="btn solid big" data-a="fin-save" ${sets ? '' : 'disabled'}>${I.check}Save workout</button><button class="btn ghost big" data-a="sheet-close">Keep training</button><button class="btn danger-ghost" data-a="fin-discard">Discard workout</button></div>`;
  },
  choose: () => {
    const p = S.programme;
    return `<h3>Choose a workout</h3><div class="menu">${(p?.days || []).map(d => `<button data-a="start-day" data-id="${d.id}"><span class="grow">${esc(d.name)}<small class="muted"> · ${dayMuscles(d).map(m => MUSCLE_NAME[m]).join(', ')}</small></span>${I.play}</button>`).join('')}
      <button data-a="go" data-v="generate">${I.spark}Generate a workout</button><button data-a="start-empty">${I.plus}Empty workout</button></div>`;
  },
  split: () => `<h3>Choose a split</h3><p class="muted sm">Replaces your programme days with a fresh plan built from your settings. Workout history is kept.</p><div class="menu tall">${TEMPLATES.map(t => `<button data-a="split-pick" data-v="${t.id}"><span class="grow"><b>${esc(t.name)}</b>${t.id === RECOMMENDED_TEMPLATE[S.settings.days] ? ' <span class="tag acc">Recommended</span>' : ''}<small class="muted block">${t.days} days · ${esc(t.desc)}</small></span></button>`).join('')}<button data-a="split-custom"><span class="grow"><b>Custom — start empty</b><small class="muted block">Create your own days from scratch</small></span></button></div>`,
  resume: () => `<h3>Workout already in progress</h3><p class="muted">“${esc(S.active.name)}” is still open. Resume it, or discard it and start the new one.</p><div class="sheet-btns"><button class="btn solid big" data-a="resume">Resume current</button><button class="btn danger-ghost big" data-a="discard-start">Discard and start new</button></div>`,
  exportData: sh => `<h3>Back up your data</h3><p class="muted sm">${sh.saved ? 'Backup file saved. ' : ''}${sh.msg || 'Save the backup file to Files or iCloud Drive, or copy the text into Notes. Use Import to restore it on any phone.'}</p>
    <textarea class="code" id="export-text" readonly>${esc(sh.text)}</textarea><div class="sheet-btns"><button class="btn solid big" data-a="copy-export">${I.copy}Copy backup text</button>${sh.canShare ? `<button class="btn outline big" data-a="share-export">${I.upload}Share / save backup file</button>` : `<button class="btn outline big" data-a="download-export">${I.download}Save backup file</button>`}</div>`,
  importData: sh => `<h3>Restore a backup</h3><p class="muted sm">Choose a backup file, or paste the backup text. This replaces what's in the app now.</p>
    <label class="btn outline big file-btn">${I.upload}Choose backup file<input type="file" id="import-file" accept=".json,application/json,text/plain"></label>
    <textarea class="code" id="import-text" placeholder="…or paste backup text here">${esc(sh.text || '')}</textarea>
    ${sh.err ? `<p class="warn-line">${I.info}${esc(sh.err)}</p>` : ''}
    <div class="sheet-btns"><button class="btn solid big" data-a="import-ok">Restore</button></div>`,
};
function pickListHtml(sh) {
  const cur = sh.mode === 'replace' || sh.mode === 'add' ? getSess(sh.ctx).exercises.map(e => e.exId) : sh.mode.startsWith('day') ? S.programme.days.find(d => d.id === sh.dayId).exercises.map(e => e.exId) : UI.gen.items.map(e => e.exId);
  let h = '';
  const q = (sh.q || '').trim();
  if (sh.from && !q && !sh.m) {
    const alts = alternatives(sh.from, cur).slice(0, 8);
    if (alts.length) h += `<div class="month">Best alternatives</div><div class="card list">${alts.map(e => pickRow(e)).join('')}</div>`;
  }
  const list = filterExercises(q, sh.m || 'all', 'all', false).filter(e => !cur.includes(e.id) || e.id === sh.from).sort((a, b) => (isAvailable(b) - isAvailable(a)) || (exHistory(b.id).length - exHistory(a.id).length));
  h += `<div class="month">${q || sh.m ? 'Results' : 'All exercises'}</div><div class="card list">${list.slice(0, 80).map(e => pickRow(e)).join('') || '<div class="empty">No matches</div>'}</div>`;
  return h;
}
function pickRow(e) {
  const n = exHistory(e.id).length;
  return `<button class="ex-row" data-a="pick-ok" data-id="${e.id}"><span class="eq-badge eq-${e.eq}">${esc((EQUIP_NAME[e.eq] || 'Other').slice(0, 2))}</span><div class="grow"><div class="ex-n">${esc(e.name)}</div><div class="muted xs">${esc(MUSCLE_NAME[e.muscle])} · ${esc(EQUIP_NAME[e.eq])}${n ? ` · done ${n}×` : ''}${!isAvailable(e) ? ' · not in your equipment' : ''}</div></div><span class="chev">${I.plus}</span></button>`;
}

/* ---------- Rest timer bar ---------- */
function restBarHtml() {
  const T = UI.timer;
  const a = S.active;
  if (!a || UI.tab !== 'workout' || UI.stack.length) return '';
  const cur = a.exercises.find(e => e.sets.some(s => !s.done)) || a.exercises[a.exercises.length - 1];
  const def = cur ? cur.rest || 120 : S.settings.rest.compound;
  if (T.state === 'idle') return `<div class="rest idle"><span class="r-ic">${I.timer}</span><span class="grow muted sm">Rest timer</span><button class="btn solid sm" data-a="rest" data-sec="${def}">${I.play}${fmtClock(def)}</button></div>`;
  const left = T.state === 'run' ? (T.end - Date.now()) / 1000 : T.left;
  const pct = T.state === 'done' ? 100 : Math.max(0, Math.min(100, (1 - left / T.dur) * 100));
  return `<div class="rest ${T.state}"><div class="r-prog" style="width:${pct}%"></div>
    <b class="r-time num" data-live="rest">${T.state === 'done' ? 'Go!' : fmtClock(left)}</b>
    <div class="r-btns"><button class="iconbtn" data-a="t-add" aria-label="Add 30 seconds">+30</button>
    <button class="iconbtn" data-a="t-toggle" aria-label="${T.state === 'run' ? 'Pause' : 'Resume'}">${T.state === 'run' ? I.pause : I.play}</button>
    <button class="iconbtn" data-a="t-reset" aria-label="Reset">${I.reset}</button><button class="iconbtn" data-a="t-skip" aria-label="Skip">${I.skip}</button></div></div>`;
}
