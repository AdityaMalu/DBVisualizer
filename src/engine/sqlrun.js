/* ---------- SQL runner: a real SQLite (sql.js, WebAssembly) loaded on first use.
   Every run builds a fresh in-memory database from the dataset, so edits never leak between runs. ---------- */
let sqlReady = null;
function loadSQL(){
  if (sqlReady) return sqlReady;
  sqlReady = new Promise((res, rej)=>{
    if (window.initSqlJs) return res();
    const s = document.createElement('script');
    s.src = 'vendor/sql-wasm-inline.js';
    s.onload = res;
    s.onerror = () => rej(new Error('Could not load the SQL engine (vendor/sql-wasm-inline.js). Open the site through its URL or run "npm run build" so dist/vendor exists.'));
    document.head.appendChild(s);
  }).then(() => initSqlJs()).catch(e => { sqlReady = null; throw e; });
  return sqlReady;
}
async function runSQL(dbName, sql){
  const SQL = await loadSQL();
  const db = new SQL.Database();
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    if (dbName && DATASETS[dbName]) db.exec(DATASETS[dbName].sql);
    const t0 = performance.now();
    const res = db.exec(sql);
    return { sets: res, ms: performance.now() - t0, changes: db.getRowsModified() };
  } finally { db.close(); }
}
function resultHTML(r){
  if (!r.sets.length) return `<p class="res-note">Statement ran, no rows returned${r.changes ? ` (${r.changes} row${r.changes>1?'s':''} changed by the last statement)` : ''}.</p>`;
  const cell = v => v === null ? '<span class="null">NULL</span>' : esc(typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v);
  return r.sets.map((s, i)=>`<div class="tbl res"><div class="tbl-scroll"><table><thead><tr>${s.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
    s.values.slice(0, 200).map(row=>`<tr>${row.map(v=>`<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="res-note">${s.values.length} row${s.values.length===1?'':'s'}${s.values.length>200?' (first 200 shown)':''}${r.sets.length>1?` · result ${i+1} of ${r.sets.length}`:''}</p></div>`).join('');
}
const errHTML = e => `<p class="res-err"><b>Error:</b> ${esc(e.message || e)}</p>`;
/* compare the last result set of two runs: same columns count, same rows (order-insensitive unless ordered) */
function sameResult(a, b, ordered){
  const last = r => r.sets[r.sets.length - 1] || {columns:[], values:[]};
  const A = last(a), B = last(b);
  if (A.columns.length !== B.columns.length) return {ok:false, why:`Your query returns ${A.columns.length} column${A.columns.length===1?'':'s'}; the expected result has ${B.columns.length}.`};
  const norm = v => v === null ? 'NULL' : typeof v === 'number' ? String(+v.toFixed(6)) : String(v);
  const rows = s => s.values.map(r => JSON.stringify(r.map(norm)));
  let ra = rows(A), rb = rows(B);
  if (ra.length !== rb.length) return {ok:false, why:`Your query returns ${ra.length} row${ra.length===1?'':'s'}; the expected result has ${rb.length}.`};
  if (!ordered) { ra = ra.slice().sort(); rb = rb.slice().sort(); }
  const k = ra.findIndex((r, i) => r !== rb[i]);
  if (k >= 0) return {ok:false, why: ordered && ra.slice().sort().join() === rb.slice().sort().join() ? 'Right rows, wrong order. Check your ORDER BY.' : 'Same shape, but some values differ from the expected result.'};
  return {ok:true};
}
/* the CREATE statements of a dataset, for the schema panel */
const schemaOf = name => (DATASETS[name]?.sql.match(/CREATE\s+(TABLE|VIEW|INDEX)[\s\S]*?\);/gi) || []).join('\n\n');
const tablesOf = name => [...(DATASETS[name]?.sql.matchAll(/CREATE\s+TABLE\s+(\w+)/gi) || [])].map(m => m[1]);
