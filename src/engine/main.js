/* ---------- section jump links: scroll without touching the URL hash (it names the topic) ---------- */
document.querySelector('.jump').onclick = e => {
  const a = e.target.closest('a[data-jump]'); if (!a) return;
  e.preventDefault();
  const el = $(a.getAttribute('href').slice(1));
  if (el.tagName === 'DETAILS') el.open = true;
  el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
};
/* ---------- boot: build the topic list and open the topic named in the URL hash ---------- */
buildNav();
const h = (location.hash||'').slice(1), start = T.findIndex(t=>t.id===h);
go(start>=0?start:0, 0);
