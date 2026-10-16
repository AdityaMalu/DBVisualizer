/* ---------- stepper: render the current step, navigation, playback, keyboard ---------- */
function chip(ch, t){
  let label = ch, flag = '';
  if (Array.isArray(ch)) { label = ch[0]; flag = ch[1]||''; }
  const col = t.colors[label];
  return `<span class="chip ${flag}"${col?` style="--c:${col}"`:''}>${esc(label)}</span>`;
}
/* a table snapshot: header, rows, per-row flags (hot / ok / bad / dim / new) */
function tableHTML(x){
  const cell = v => v === null ? '<span class="null">NULL</span>' : esc(v);
  return `<div class="tbl"><h4>${esc(x.t)}</h4><div class="tbl-scroll"><table><thead><tr>${x.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
    x.rows.length ? x.rows.map((r,i)=>`<tr class="${(x.f||{})[i]||''}">${r.map(v=>`<td>${cell(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${x.cols.length}" class="empty">(no rows)</td></tr>`
  }</tbody></table></div></div>`;
}
function pillOf(st){
  if (STATE[st]) return {label:STATE[st], cls:st};
  if (st.includes('→') && /RUN|BLOCKED|WAITING/.test(st)) { const cls = st.split('→').pop().trim(); return {label:st.replace(/RUN\b/g,'RUNNING'), cls}; }
  const i = st.lastIndexOf(':');
  if (i > 0) return {label:st.slice(0,i), cls:st.slice(i+1)};
  return {label:st, cls:'info'};
}
function render(){
  const t = T[ti], s = t.R[si];
  document.querySelectorAll('#rail button').forEach(b=> b.setAttribute('aria-current', +b.dataset.i===ti));
  $('pick').value = ti;
  $('crumb').textContent = `Part ${t.part.no} · ${t.part.title}`;
  $('no').textContent = t.no; $('title').textContent = t.title; $('idea').innerHTML = t.idea;
  if (theoryFor !== ti) renderTheory();
  $('ptopic').disabled = nextVisible(-1) < 0; $('ntopic').disabled = nextVisible(1) < 0;
  $('impPill').className = 'imp-pill ' + t.imp; $('impPill').textContent = IMP_LABEL[t.imp];
  if (!document.querySelector(`#rail button[data-i="${ti}"]`)) buildNav();
  $('count').textContent = `Step ${si+1} / ${t.R.length}`;
  $('prev').disabled = si===0; $('next').disabled = si===t.R.length-1;
  $('dots').innerHTML = t.R.map((_,i)=>`<button aria-label="Step ${i+1}" class="${i<si?'done':''} ${i===si?'cur':''}" data-i="${i}"></button>`).join('');
  $('say').innerHTML = s.say + (si===t.R.length-1 ? `<p class="qhint">End of the walkthrough. Next:${t.examples.length?` <button type="button" data-go="exCard">Examples ↓</button>`:''}${t.exercises.length?` <button type="button" data-go="xrCard">Exercises ↓</button>`:''}${t.quiz.length?` <button type="button" data-go="quizCard">Quiz ↓</button>`:''}</p>` : '');

  const lines = t.codes[s.cv].split('\n');
  const who = {};
  Object.entries(s.hl).forEach(([id, ls])=> ls.forEach(n=> (who[n] = who[n]||[]).push(id)));
  const keys = Object.keys(t.codes);
  $('codeTag').textContent = keys.length>1 ? `variant ${keys.indexOf(s.cv)+1} of ${keys.length}` : '';
  $('code').innerHTML = lines.map((l,i)=>{
    const w = who[i+1]||[];
    return `<div class="ln ${w.length?'on':''}"><span class="n">${i+1}</span><span class="who">${w.map(id=>`<i style="background:${t.colors[id]}">${id==='q'?'▶':esc(id.length>7?id.slice(0,7):id)}</i>`).join('')}</span><span class="src">${hiCode(l)||' '}</span></div>`;
  }).join('');

  $('thTitle').textContent = t.actors || 'Sessions';
  $('thCard').hidden = !s.th.length;
  $('threads').innerHTML = s.th.map(([id, st, note])=>{
    const p = pillOf(st);
    return `<div class="th ${p.cls}" style="--c:${t.colors[id]}"><div class="nm">${esc(id)}</div><span class="pill s-${p.cls}">${esc(p.label)}</span><div class="note">${esc(note||'')}</div></div>`;
  }).join('');

  $('gTitle').textContent = t.stateTitle || 'Key facts';
  $('gCard').hidden = !s.g.length;
  $('groups').innerHTML = s.g.map(g=>`<div class="grp"><h4>${esc(g.t)}</h4>${g.r.map(r=>{
    if (Array.isArray(r)) return `<div class="row ${r[2]||''}"><span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span></div>`;
    return `<div class="row ${r.f||''}"><span class="k">${esc(r.k)}</span><span class="chips">${r.c.map(c=>chip(c,t)).join('')}</span></div>`;
  }).join('')}</div>`).join('');

  $('tbTitle').textContent = t.tbTitle || 'Tables';
  $('tbCard').hidden = !s.tb.length;
  $('tables').innerHTML = s.tb.map(tableHTML).join('');

  $('dgCard').hidden = !s.d;
  if (s.d) {
    $('dgTitle').textContent = s.d.title || t.dgTitle || 'Diagram';
    $('diagram').innerHTML = graphSVG(t, s.d);
  }

  $('lgTitle').textContent = t.logTitle || 'Output / events';
  $('lgCard').hidden = !s.log.length && !!t.noLog;
  $('log').innerHTML = s.log.length ? s.log.map((l,i)=>`<div class="${i>=s.log.length-s.nNew?'new':''}">${esc(l)}</div>`).join('') : '<div class="empty">no output yet</div>';
  $('log').scrollTop = 1e6;

  $('keep').innerHTML = t.keep.map(k=>`<li>${k}</li>`).join('');
  if (studyFor !== ti) renderStudy();
  if (quizFor !== ti) renderQuiz();
  try { history.replaceState(null,'','#'+t.id); } catch(e){}
}

function go(t, s){ stop(); ti = t; si = s; render(); }
function step(d){ const n = si + d; if (n>=0 && n<T[ti].R.length){ si = n; render(); } }
function stop(){ if (timer){ clearInterval(timer); timer=null; $('play').textContent='▶ Play'; } }
function play(){
  if (timer) return stop();
  if (si === T[ti].R.length-1) { si = 0; render(); }
  $('play').textContent = '❚❚ Pause';
  timer = setInterval(()=>{ if (si >= T[ti].R.length-1) return stop(); step(1); }, 3400);
}
$('prev').onclick = ()=>{ stop(); step(-1); };
$('next').onclick = ()=>{ stop(); step(1); };
$('first').onclick = ()=> go(ti, 0);
$('play').onclick = play;
$('ptopic').onclick = ()=> { const i = nextVisible(-1); if (i >= 0) go(i, 0); };
$('ntopic').onclick = ()=> { const i = nextVisible(1); if (i >= 0) go(i, 0); };
$('dots').onclick = e => { const b = e.target.closest('button'); if (b){ stop(); si = +b.dataset.i; render(); } };
document.addEventListener('keydown', e=>{
  if (/^(SELECT|TEXTAREA|INPUT)$/.test(e.target.tagName) || e.target.isContentEditable || e.target.closest?.('#quiz, #qzBar') || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key==='ArrowRight'){ e.preventDefault(); stop(); step(1); }
  else if (e.key==='ArrowLeft'){ e.preventDefault(); stop(); step(-1); }
  else if (e.key===']'){ const i = nextVisible(1); if (i >= 0) go(i,0); }
  else if (e.key==='['){ const i = nextVisible(-1); if (i >= 0) go(i,0); }
  else if (e.key===' ' && e.target.tagName!=='BUTTON'){ e.preventDefault(); play(); }
});
