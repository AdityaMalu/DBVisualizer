/* ---------- interview focus filter: which topics the rail, the topic picker and prev/next show ---------- */
const FOCUS_KEY = 'dbv-focus-v1';
const IMP_LABEL = {must:'Must-know for interviews', good:'Good to know', extra:'Beyond typical interviews'};
let focus = 'all';
try { focus = localStorage.getItem(FOCUS_KEY) || 'all'; } catch(e){}
const visible = t => focus==='all' || (focus==='must' ? t.imp==='must' : t.imp!=='extra');
function nextVisible(dir){ for (let i = ti + dir; i >= 0 && i < T.length; i += dir) if (visible(T[i])) return i; return -1; }
$('focus').onclick = e => {
  const b = e.target.closest('button[data-focus]'); if (!b) return;
  focus = b.dataset.focus;
  try { localStorage.setItem(FOCUS_KEY, focus); } catch(e){}
  buildNav(); render();
};
function buildNav(){
  let html = '', opts = '';
  PARTS.forEach(p=>{
    const vis = p.topics.filter(t => visible(t) || T.indexOf(t) === ti);
    if (!vis.length) return;
    html += `<details open><summary>Part ${p.no} · ${esc(p.title)}</summary>`;
    opts += `<optgroup label="Part ${p.no} · ${esc(p.title)}">`;
    vis.forEach(t=>{ const i = T.indexOf(t);
      html += `<button data-i="${i}"><span>${t.no}</span>${esc(t.title)}<em class="tick" data-t="${t.id}"></em><i class="imp imp-${t.imp}" title="${IMP_LABEL[t.imp]}"></i></button>`;
      opts += `<option value="${i}">${t.no} ${t.imp==='must'?'● ':''}${esc(t.title)}</option>`; });
    html += '</details>'; opts += '</optgroup>';
  });
  $('rail').innerHTML = html; $('pick').innerHTML = opts; $('pick').value = ti;
  document.querySelectorAll('#focus button').forEach(b=> b.setAttribute('aria-pressed', b.dataset.focus===focus));
  document.querySelectorAll('#rail button').forEach(b=> b.setAttribute('aria-current', +b.dataset.i===ti));
  updateTicks();
  $('rail').onclick = e => { const b = e.target.closest('button'); if(b) go(+b.dataset.i, 0); };
  $('pick').onchange = e => go(+e.target.value, 0);
}
