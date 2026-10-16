/* ---------- theory card: open by default, the reader's open/closed choice is remembered ---------- */
const TKEY = 'dbv-theory-open-v1';
let theoryFor = -1;
try { const v = localStorage.getItem(TKEY); $('theoryCard').open = v === null ? true : v === '1'; } catch(e){ $('theoryCard').open = true; }
$('theoryCard').addEventListener('toggle', ()=>{ try { localStorage.setItem(TKEY, $('theoryCard').open ? '1' : '0'); } catch(e){} });
function renderTheory(){
  const t = T[ti], th = t.theory;
  theoryFor = ti;
  $('theoryCard').hidden = !th;
  if (!th) return;
  const text = [th.one, th.intro, ...th.terms.flat(), ...th.steps, ...th.practice, ...th.mistakes].join(' ').replace(/<[^>]+>/g,' ');
  const mins = Math.max(1, Math.round(text.split(/\s+/).length / 200));
  $('thMeta').textContent = `${mins} min read · no prior knowledge needed`;
  $('theory').innerHTML =
    `<p class="th-one">${th.one}</p>` +
    `<div>${th.intro}</div>` +
    `<div class="th-grid">` +
      `<div class="th-box"><h4>Key terms</h4><dl class="th-terms">${th.terms.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>` +
      `<div class="th-box"><h4>How it works</h4><ol>${th.steps.map(x=>`<li>${x}</li>`).join('')}</ol></div>` +
      `<div class="th-box ok"><h4>In real projects</h4><ul>${th.practice.map(x=>`<li>${x}</li>`).join('')}</ul></div>` +
      `<div class="th-box warn"><h4>Common mistakes</h4><ul>${th.mistakes.map(x=>`<li>${x}</li>`).join('')}</ul></div>` +
    `</div>` +
    `<p class="th-next">Next: step through the visual walkthrough below, then work through the examples (simple → complex), the interview tips, the exercises and the quiz.</p>`;
}
