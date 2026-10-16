/* ---------- study sections after the walkthrough: examples (simple → complex), interview tips, exercises.
   Examples and SQL exercises run in the browser against the topic's dataset. Finished exercises are remembered. ---------- */
const XKEY = 'dbv-ex-done-v1';
const EX_LV = {basic:'Basic', mid:'Intermediate', adv:'Advanced'};
let studyFor = -1, xdone = {};
try { xdone = JSON.parse(localStorage.getItem(XKEY) || '{}') || {}; } catch(e){ xdone = {}; }
const saveDone = () => { try { localStorage.setItem(XKEY, JSON.stringify(xdone)); } catch(e){} };
const isDone = (t, i) => (xdone[t.id] || []).includes(i);
function setDone(t, i, on){
  const s = new Set(xdone[t.id] || []); on ? s.add(i) : s.delete(i);
  xdone[t.id] = [...s]; saveDone(); xrScore(); updateTicks();
}
const dbOf = (t, x) => x.run === false ? null : (x.db !== undefined ? x.db : t.db) || null;

function datasetBar(t, names, where){
  if (!names.length) return '';
  return names.map(n => `<details class="dset"><summary>Dataset <code>${esc(n)}</code>: ${esc(DATASETS[n].title)} <span class="cm">· schema and sample rows</span></summary>
    <pre class="sql">${hiBlock(schemaOf(n))}</pre>
    <div class="dset-peek">Peek at a table: ${tablesOf(n).map(tb=>`<button type="button" data-peek="${esc(tb)}" data-db="${esc(n)}">${esc(tb)}</button>`).join('')}</div>
    <div class="res-box" data-peekout="${where}-${esc(n)}"></div></details>`).join('');
}

function renderStudy(){
  const t = T[ti];
  studyFor = ti;
  // examples
  $('exCard').hidden = !t.examples.length;
  const exDbs = [...new Set(t.examples.map(x => dbOf(t, x)).filter(Boolean))];
  $('examples').innerHTML = datasetBar(t, exDbs, 'ex') + t.examples.map((x, i) => {
    const db = dbOf(t, x);
    return `<article class="ex" data-i="${i}"><div class="ex-h"><span class="lvl lvl-${x.lv}">${EX_LV[x.lv]}</span><b>${x.title}</b></div>
      <pre class="sql" data-src>${hiBlock(x.sql)}</pre>
      <div class="ex-why">${x.why}</div>
      ${db ? `<div class="runbar"><button type="button" class="primary" data-run>▶ Run</button><button type="button" data-edit>✎ Edit</button><span class="cm">SQLite in your browser · dataset <code>${esc(db)}</code></span></div><div class="res-box" data-out></div>` : ''}
    </article>`;
  }).join('');
  // interview tips
  const tp = t.tips;
  $('tipCard').hidden = !tp;
  if (tp) $('tips').innerHTML =
    `<div class="tip-say"><span class="tip-l">Say it in 30 seconds</span><p>${tp.say}</p></div>` +
    `<div class="th-grid">` +
      `<div class="th-box ok"><h4>What interviewers listen for</h4><ul>${tp.points.map(x=>`<li>${x}</li>`).join('')}</ul></div>` +
      `<div class="th-box warn"><h4>Traps and red flags</h4><ul>${tp.traps.map(x=>`<li>${x}</li>`).join('')}</ul></div>` +
    `</div>` +
    (tp.qa && tp.qa.length ? `<div class="tip-qa"><h4>Likely follow-up questions <span class="cm">(think first, then open)</span></h4>${tp.qa.map(([q,a])=>`<details><summary>${q}</summary><div>${a}</div></details>`).join('')}</div>` : '');
  // exercises
  $('xrCard').hidden = !t.exercises.length;
  const xDbs = [...new Set(t.exercises.filter(x=>x.sql).map(x => dbOf(t, x)).filter(Boolean))];
  $('exercises').innerHTML = datasetBar(t, xDbs, 'xr') + t.exercises.map((x, i) => {
    const db = x.sql ? dbOf(t, x) : null, done = isDone(t, i);
    return `<article class="xr${done?' done':''}" data-i="${i}"><div class="ex-h"><span class="qn">E${i+1}</span><span class="lvl lvl-${x.lv}">${LV[x.lv]}</span>${x.sql ? '<span class="tag">SQL · auto-checked</span>' : '<span class="tag">think / design</span>'}
        <label class="xr-done"><input type="checkbox" data-done${done?' checked':''}> done</label></div>
      <div class="xr-q">${x.q}</div>
      ${db ? `<textarea class="sql-in" spellcheck="false" rows="${Math.min(10, Math.max(4, (x.sql.match(/\n/g)||[]).length + 2))}" aria-label="Your SQL for exercise ${i+1}" placeholder="-- write your query here, then Check"></textarea>` : ''}
      <div class="runbar">${db ? `<button type="button" data-xrun>▶ Run</button><button type="button" class="primary" data-check>✓ Check</button>` : ''}${x.hint ? `<button type="button" data-hint>Hint</button>` : ''}<button type="button" data-sol>Show solution</button></div>
      <div class="xr-status" aria-live="polite"></div>
      ${x.hint ? `<div class="xr-hint" hidden><b>Hint:</b> ${x.hint}</div>` : ''}
      <div class="xr-sol" hidden>${x.sql ? `<pre class="sql">${hiBlock(x.sql)}</pre>` : ''}${x.answer ? `<div>${x.answer}</div>` : ''}${x.sql && x.note ? `<div class="cm">${x.note}</div>` : ''}</div>
      ${db ? '<div class="res-box" data-out></div>' : ''}
    </article>`;
  }).join('');
  xrScore();
}
function xrScore(){
  const t = T[ti], n = t.exercises.length, d = t.exercises.filter((_, i) => isDone(t, i)).length;
  $('xrScore').textContent = n ? `${d} / ${n} done` : '';
}

async function runInto(box, db, sql){
  box.innerHTML = '<p class="res-note">Running…</p>';
  try { const r = await runSQL(db, sql); box.innerHTML = resultHTML(r); return r; }
  catch(e){ box.innerHTML = errHTML(e); return null; }
}
async function peek(btn){
  const box = btn.closest('details').querySelector('[data-peekout]');
  await runInto(box, btn.dataset.db, `SELECT * FROM ${btn.dataset.peek} LIMIT 25;`);
}
$('examples').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.peek) return peek(b);
  const art = b.closest('.ex'), t = T[ti], x = t.examples[+art.dataset.i];
  if (b.hasAttribute('data-edit')) {
    const pre = art.querySelector('[data-src]');
    if (pre) { const ta = document.createElement('textarea'); ta.className = 'sql-in'; ta.spellcheck = false; ta.value = x.sql; ta.rows = Math.min(14, x.sql.split('\n').length + 1); ta.setAttribute('aria-label', 'Edit the example SQL'); pre.replaceWith(ta); ta.focus(); b.textContent = '↺ Reset'; }
    else { const ta = art.querySelector('textarea'); const p = document.createElement('pre'); p.className = 'sql'; p.dataset.src = ''; p.innerHTML = hiBlock(x.sql); ta.replaceWith(p); b.textContent = '✎ Edit'; }
    return;
  }
  if (b.hasAttribute('data-run')) { const ta = art.querySelector('textarea'); await runInto(art.querySelector('[data-out]'), dbOf(t, x), ta ? ta.value : x.sql); }
};
$('exercises').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.peek) return peek(b);
  const art = b.closest('.xr'), t = T[ti], i = +art.dataset.i, x = t.exercises[i];
  const status = art.querySelector('.xr-status'), out = art.querySelector('[data-out]'), ta = art.querySelector('textarea');
  if (b.hasAttribute('data-hint')) { const h = art.querySelector('.xr-hint'); h.hidden = !h.hidden; return; }
  if (b.hasAttribute('data-sol')) { const s = art.querySelector('.xr-sol'); s.hidden = !s.hidden; b.textContent = s.hidden ? 'Show solution' : 'Hide solution'; return; }
  const sql = ta.value.trim();
  if (!sql) { status.className = 'xr-status bad'; status.textContent = 'Write a query first.'; ta.focus(); return; }
  if (b.hasAttribute('data-xrun')) { status.textContent = ''; await runInto(out, dbOf(t, x), sql); return; }
  if (b.hasAttribute('data-check')) {
    const mine = await runInto(out, dbOf(t, x), sql);
    if (!mine) { status.className = 'xr-status bad'; status.textContent = 'Your query failed: see the error below.'; return; }
    try {
      const want = await runSQL(dbOf(t, x), x.sql), r = sameResult(mine, want, x.ordered);
      status.className = 'xr-status ' + (r.ok ? 'ok' : 'bad');
      status.innerHTML = r.ok ? '<b>Correct.</b> Your result matches the expected one. Compare your query with the solution: there is often more than one good answer.' : `<b>Not yet.</b> ${esc(r.why)}`;
      if (r.ok && !isDone(t, i)) { setDone(t, i, true); art.classList.add('done'); art.querySelector('[data-done]').checked = true; }
    } catch(err){ status.className = 'xr-status bad'; status.textContent = 'Could not run the reference solution: ' + err.message; }
  }
};
$('exercises').onchange = e => {
  const c = e.target.closest('[data-done]'); if (!c) return;
  const art = c.closest('.xr'); setDone(T[ti], +art.dataset.i, c.checked); art.classList.toggle('done', c.checked);
};
$('exercises').addEventListener('keydown', e => {          // Ctrl/Cmd+Enter checks the answer
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA') { e.preventDefault(); e.target.closest('.xr').querySelector('[data-check]')?.click(); }
});
$('examples').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA') { e.preventDefault(); e.target.closest('.ex').querySelector('[data-run]')?.click(); }
});
