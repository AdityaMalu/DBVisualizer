/* ---------- diagrams: generic node/edge graphs (B-trees, replication, shards, lock waits …) ---------- */
/* generic node/edge diagram: topic.nodes {id:{x,y,label,kind,w,h}}, topic.edges (always drawn faint), step d.e (coloured overlay) */
function graphSVG(t, d){
  const N = t.nodes, hide = d.hide||[], lab = d.labels||{};
  const vis = id => N[id] && !hide.includes(id);
  const flagCol = f => /bad/.test(f)?'var(--bad-line)': /ok/.test(f)?'var(--ok-line)': /hot/.test(f)?'var(--accent)':'var(--muted)';
  const all = [...(t.edges||[]).filter(e=>!(d.e||[]).some(x=>x[0]===e[0]&&x[1]===e[1])).map(e=>[e[0],e[1],e[2]||'',(e[3]||'')+' base']), ...(d.e||[])];
  let out = `<svg viewBox="${t.vb||'0 0 440 250'}" role="img" aria-label="${esc(t.title)} diagram"><defs>`;
  ['m','b','o','h'].forEach((k,i)=> out += `<marker id="gm${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="${['var(--muted)','var(--bad-line)','var(--ok-line)','var(--accent)'][i]}"/></marker>`);
  out += `</defs>`;
  const box = id => { const n = N[id]; return {w:(n.w||120)/2, h:(n.h||40)/2}; };
  all.forEach(([a,b,l,f])=>{
    if (!vis(a) || !vis(b)) return;
    f = f||'';
    let x1=N[a].x, y1=N[a].y, x2=N[b].x, y2=N[b].y;
    const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
    const A = box(a), B = box(b);
    const oa = Math.min(A.w/Math.abs(ux||1e-9), A.h/Math.abs(uy||1e-9)), ob = Math.min(B.w/Math.abs(ux||1e-9), B.h/Math.abs(uy||1e-9));
    const rev = all.some(e=>e[0]===b&&e[1]===a) ? 7 : 0;
    const px = -uy*rev, py = ux*rev;
    x1+=ux*oa+px; y1+=uy*oa+py; x2-=ux*(ob+2)-px; y2-=uy*(ob+2)-py;
    const base = /base/.test(f), col = base ? 'var(--line)' : flagCol(f);
    const mk = /line/.test(f) ? '' : `marker-end="url(#gm${base?'m':/bad/.test(f)?'b':/ok/.test(f)?'o':/hot/.test(f)?'h':'m'})"`;
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${base?1.5:2.5}" ${/dash/.test(f)?'stroke-dasharray="6 4"':''} ${mk}/>`;
    if (l) {
      const mx=(x1+x2)/2, my=(y1+y2)/2, nx=-uy, ny=ux, side = rev ? 1 : (Math.abs(uy)>0.7 ? 1 : -1);
      const tx = mx + nx*11*side*(ux>=0?1:-1), ty = my + ny*11*side*(ux>=0?1:-1) + 4;
      const anchor = Math.abs(uy)>0.7 ? ((nx*side*(ux>=0?1:-1))>0?'start':'end') : 'middle';
      out += `<text x="${tx}" y="${ty}" font-size="10.5" font-weight="${base?400:600}" text-anchor="${anchor}" fill="${base?'var(--muted)':col}" font-family="IBM Plex Sans, sans-serif">${esc(l)}</text>`;
    }
  });
  Object.entries(N).forEach(([k,n])=>{
    if (!vis(k)) return;
    const w = n.w||120, h = n.h||40, on = (d.on||[]).includes(k), bad = (d.bad||[]).includes(k), ok = (d.ok||[]).includes(k), dim = (d.dim||[]).includes(k);
    const kind = n.kind||'box', tc = t.colors[k];
    const stroke = bad?'var(--bad-line)': ok?'var(--ok-line)': on?'var(--accent)': kind==='actor'&&tc ? tc : 'var(--muted)';
    const fill = on?'var(--accent)': bad?'var(--bad)': ok?'var(--ok)': kind==='lock'||kind==='mem'?'var(--soft)':'var(--panel)';
    const rx = kind==='actor'||kind==='circle' ? h/2 : kind==='lock'||kind==='mem' ? 4 : 9;
    const txt = on ? 'var(--panel)' : kind==='actor'&&tc ? tc : 'var(--ink)';
    const sw = on||bad||ok?2.2:1.4;
    out += `<g opacity="${dim?0.4:1}">`;
    if (kind==='db') {                             // a cylinder: body, bottom curve, top ellipse
      const ry = Math.min(8, h/5), x0 = n.x-w/2, y0 = n.y-h/2;
      out += `<path d="M${x0},${y0+ry} L${x0},${y0+h-ry} A${w/2},${ry} 0 0 0 ${x0+w},${y0+h-ry} L${x0+w},${y0+ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><ellipse cx="${n.x}" cy="${y0+ry}" rx="${w/2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else out += `<rect x="${n.x-w/2}" y="${n.y-h/2}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    const text = String(lab[k] !== undefined ? lab[k] : (n.label||k)).split('\n'), ty0 = kind==='db' ? 4 : 0;
    text.forEach((tl,i)=> out += `<text x="${n.x}" y="${n.y + 4 + ty0 + (i-(text.length-1)/2)*14}" text-anchor="middle" font-size="${n.fs||12}" font-weight="600" fill="${txt}" font-family="JetBrains Mono, monospace">${esc(tl)}</text>`);
    if (n.sub) out += `<text x="${n.x}" y="${n.y+h/2+13}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="IBM Plex Sans, sans-serif">${esc(n.sub)}</text>`;
    out += `</g>`;
  });
  return out + '</svg>';
}
