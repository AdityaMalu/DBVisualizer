/* ---------- quiz: each attempt draws a few questions from a hidden per-topic bank.
   Unseen questions are preferred (tracked in this browser), options are shuffled on every draw,
   and the bank itself is never listed. Best score per set is kept, counted only with "All levels". ---------- */
const QKEY = 'dbv-quiz-best-v1', FKEY = 'dbv-quiz-filter-v1', SEEN_KEY = 'dbv-quiz-seen-v1';
const LV = {E:'Easy', M:'Medium', H:'Hard'};
const DRAW = {core:3, adv:2};
let best = {}, seen = {}, quizFor = -1, qa = [], qlist = [], lastDraw = [], qf = {set:'core', level:'all'};
try { best = JSON.parse(localStorage.getItem(QKEY) || '{}') || {}; } catch(e){ best = {}; }
try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch(e){ seen = {}; }
try { Object.assign(qf, JSON.parse(localStorage.getItem(FKEY) || '{}')); } catch(e){}
function saveBest(){ try { localStorage.setItem(QKEY, JSON.stringify(best)); } catch(e){} }
function saveSeen(){ try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch(e){} }
function saveFilter(){ try { localStorage.setItem(FKEY, JSON.stringify(qf)); } catch(e){} }
const setOf = (t, set) => set==='adv' ? t.quizAdv : t.quiz;
const drawSize = (t, set) => Math.min(DRAW[set], setOf(t, set).length);
const bestKey = (t, set) => set==='adv' ? t.id+':adv' : t.id;
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function updateTicks(){
  document.querySelectorAll('#rail em.tick').forEach(el=>{
    const t = T.find(x=>x.id===el.dataset.t); if (!t) return;
    const nc = drawSize(t,'core'), na = drawSize(t,'adv');
    const b = best[bestKey(t,'core')], ba = best[bestKey(t,'adv')];
    const full = b === nc, fullAdv = na && ba === na;
    el.textContent = b === undefined && ba === undefined ? '' : full && fullAdv ? '★' : full ? '✓' : b === undefined ? '' : `${b}/${nc}`;
    el.classList.toggle('full', !!full);
    el.title = [b!==undefined ? `Core best ${b}/${nc}` : '', ba!==undefined ? `Advanced best ${ba}/${na}` : ''].filter(Boolean).join(' · ');
  });
}
/* pick n questions: unseen first (random), then the least recently drawn; never repeat the previous draw if avoidable */
function drawQuestions(t){
  const key = t.id + ':' + qf.set, pool = setOf(t, qf.set).map((q,i)=>({q,i})).filter(x => qf.level==='all' || x.q[4]===qf.level);
  const n = Math.min(DRAW[qf.set], pool.length);
  let used = (seen[key] || []).filter(i => i < setOf(t, qf.set).length);
  let fresh = shuffle(pool.filter(x => !used.includes(x.i)));
  if (fresh.length < n) {                         // pool used up: start a new round, but avoid the questions just shown
    used = [];
    const notLast = shuffle(pool.filter(x => !lastDraw.includes(x.i)));
    fresh = notLast.length >= n ? notLast : shuffle(pool);
  }
  const pick = fresh.slice(0, n);
  seen[key] = [...used, ...pick.map(x=>x.i)];
  saveSeen();
  lastDraw = pick.map(x=>x.i);
  return pick.map(({q})=>{                         // shuffle options, remap the answer index
    const order = shuffle([0,1,2,3]);
    return [q[0], order.map(k=>q[1][k]), order.indexOf(q[2]), q[3], q[4]];
  });
}
function renderQuiz(){
  const t = T[ti];
  if (quizFor !== ti) lastDraw = [];
  quizFor = ti;
  qlist = drawQuestions(t);
  qa = qlist.map(()=>null);
  $('quizCard').hidden = !t.quiz.length && !t.quizAdv.length;
  const cnt = lv => setOf(t, qf.set).filter(q => lv==='all' || q[4]===lv).length;
  const seg = (key, val, label, n, note) => `<button type="button" data-f="${key}" data-v="${val}" aria-pressed="${qf[key]===val}"${n===0?' disabled':''}>${label}${note?` <span class="n">${note}</span>`:''}</button>`;
  $('qzBar').innerHTML =
    `<div class="segwrap"><span class="seg-l">Set</span><div class="seg" role="group" aria-label="Question set">${seg('set','core','Core',t.quiz.length,drawSize(t,'core'))}${seg('set','adv','Advanced',t.quizAdv.length,drawSize(t,'adv'))}</div></div>` +
    `<div class="segwrap"><span class="seg-l">Level</span><div class="seg" role="group" aria-label="Difficulty">${seg('level','all','All',cnt('all'))}${['E','M','H'].map(l=>seg('level',l,LV[l],cnt(l))).join('')}</div></div>` +
    `<button type="button" class="qz-new" data-redraw title="Draw different questions from this topic's bank">↻ New questions</button>` +
    `<p class="qz-bank">Each attempt draws ${drawSize(t,qf.set)} from a hidden bank of ${setOf(t,qf.set).length} for this topic${qf.level!=='all'?` (${cnt(qf.level)} at this level)`:''}; answers are shuffled every time.</p>`;
  drawQuiz();
}
function drawQuiz(){
  const qs = qlist;
  const done = qa.filter(a=>a!==null).length, right = qa.filter((a,i)=>a===qs[i][2]).length;
  $('qzScore').textContent = !qs.length ? '' : done ? `${right} / ${qs.length} correct` : `${qs.length} question${qs.length>1?'s':''}`;
  if (!qs.length) { $('quiz').innerHTML = `<p class="qzempty">No ${LV[qf.level]||''} questions in this set for this topic. Pick another level.</p>`; return; }
  $('quiz').innerHTML = qs.map(([q,opts,ans,why,lv],i)=>{
    const a = qa[i];
    return `<div class="qz" role="group" aria-label="Question ${i+1}, ${LV[lv]}"><div class="q"><span class="qn">Q${i+1}</span> <span class="lvl lvl-${lv}">${LV[lv]}</span>${q}</div><div class="opts">${opts.map((o,j)=>{
      const cls = a===null ? '' : j===ans ? 'right' : j===a ? 'wrong' : 'dim';
      return `<button type="button" data-q="${i}" data-o="${j}" class="${cls}"${a!==null?' disabled':''}><span class="l">${'ABCD'[j]}</span><span>${o}</span></button>`;
    }).join('')}</div>${a===null ? '' : `<div class="why" aria-live="polite"><b class="${a===ans?'ok':'bad'}">${a===ans?'Correct.':'Not quite.'}</b> ${why}</div>`}</div>`;
  }).join('') + (done===qs.length ? `<div class="qzfoot"><span>You scored <b>${right} / ${qs.length}</b>. ${right===qs.length ? (qf.set==='core' && T[ti].quizAdv.length ? 'Solid. Try new questions or the Advanced set.' : 'Solid. Try a new set of questions.') : 'Step back through the walkthrough above, then try a new set.'}${qf.level!=='all' ? ' <span class="cm">(Best scores are only saved with All levels.)</span>' : ''}</span><button type="button" data-retry>↻ New questions</button>${qf.set==='core' && T[ti].quizAdv.length ? `<button type="button" data-advanced>Advanced set</button>` : ''}${nextVisible(1)>=0?`<button type="button" class="primary" data-nexttopic>Next topic ›</button>`:''}</div>` : '');
}
$('qzBar').onclick = e => {
  if (e.target.closest('[data-redraw]')) { renderQuiz(); $('quiz').querySelector('button')?.focus(); return; }
  const b = e.target.closest('button[data-f]'); if (!b || b.disabled) return;
  qf[b.dataset.f] = b.dataset.v;
  if (b.dataset.f==='set' && qf.level!=='all' && !setOf(T[ti], qf.set).some(q=>q[4]===qf.level)) qf.level = 'all';
  lastDraw = [];
  saveFilter(); renderQuiz();
  $('qzBar').querySelector(`button[data-f="${b.dataset.f}"][data-v="${qf[b.dataset.f]}"]`)?.focus();
};
$('quiz').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-retry')) { renderQuiz(); $('quiz').querySelector('button')?.focus(); return; }
  if (b.hasAttribute('data-advanced')) { qf.set = 'adv'; qf.level = 'all'; lastDraw = []; saveFilter(); renderQuiz(); $('quizCard').scrollIntoView({block:'start'}); return; }
  if (b.hasAttribute('data-nexttopic')) { const n = nextVisible(1); if (n >= 0) { go(n, 0); window.scrollTo(0, 0); } return; }
  const i = +b.dataset.q, j = +b.dataset.o, qs = qlist;
  if (qa[i] !== null) return;
  qa[i] = j;
  if (qa.every(a=>a!==null) && qf.level==='all') {
    const r = qa.filter((a,k)=>a===qs[k][2]).length, key = bestKey(T[ti], qf.set);
    if (!(best[key] >= r)) { best[key] = r; saveBest(); updateTicks(); }
  }
  drawQuiz();
  const next = $('quiz').querySelectorAll('.qz')[i]?.querySelector('.why');
  if (next) { next.tabIndex = -1; next.focus({preventScroll:true}); }
};
$('say').onclick = e => { const b = e.target.closest('[data-go]'); if (b) { stop(); $(b.dataset.go).scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}); } };
