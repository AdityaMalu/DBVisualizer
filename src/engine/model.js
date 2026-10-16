/* ---------- flatten parts, resolve inheritance between steps ---------- */
const T = [];
PARTS.sort((a,b)=> a.no.localeCompare(b.no, undefined, {numeric:true}));
PARTS.forEach(p => p.topics.forEach(t => { t.part = p; T.push(t); }));
// state carried into the next step loses its one-step highlights
function strip(g){ return (g||[]).map(x=>({t:x.t, r:x.r.map(r=> Array.isArray(r) ? (r[2]==='hot'?[r[0],r[1]]:r) : {k:r.k, c:r.c.map(ch=> Array.isArray(ch)&&ch[1]==='hot'?[ch[0]]:ch), f:r.f==='hot'?undefined:r.f})})); }
function stripTb(tb){ return (tb||[]).map(x=>({t:x.t, cols:x.cols, rows:x.rows, f:Object.fromEntries(Object.entries(x.f||{}).filter(([,v])=>v!=='hot'&&v!=='new'))})); }
T.forEach(t=>{
  t.id = 't' + t.no.replace(/\./g,'-');
  t.quiz = QUIZ[t.no] || [];
  t.quizAdv = QUIZ_ADV[t.no] || [];
  t.theory = THEORY[t.no] || null;
  t.examples = EXAMPLES[t.no] || [];
  t.tips = TIPS[t.no] || null;
  t.exercises = EXERCISES[t.no] || [];
  t.imp = t.imp || IMP[t.no] || 'good';
  let prev = {th:[], g:[], tb:[], log:[], d:null, cv:'a'};
  const ids = [];
  t.R = t.steps.map(s=>{
    const r = {
      say:s.say, hl:s.hl||{},
      th: s.th || prev.th,
      g: s.g ? s.g : strip(prev.g),
      tb: s.tb ? s.tb : stripTb(prev.tb),
      log: s.logReset ? [...(s.log||[])] : [...prev.log, ...(s.log||[])],
      nNew: (s.log||[]).length,
      d: s.d !== undefined ? s.d : prev.d,
      cv: s.cv || prev.cv
    };
    r.th.forEach(x=>{ if(!ids.includes(x[0])) ids.push(x[0]); });
    Object.keys(r.hl).forEach(k=>{ if(!ids.includes(k)) ids.push(k); });
    prev = r; return r;
  });
  t.colors = {}; ids.forEach((id,j)=> t.colors[id] = `var(--t${j%6})`);
});
