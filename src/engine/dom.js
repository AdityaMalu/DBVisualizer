/* ---------- DOM and text helpers, current position ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const STATE = {NEW:'NEW', READY:'READY', RUN:'RUNNING', BLOCKED:'BLOCKED', WAITING:'WAITING', TIMED:'TIMED_WAITING', TERM:'DONE'};
const KW = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|NATURAL|USING|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|INTERSECT|EXCEPT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|UNIQUE|PRIMARY|FOREIGN|KEY|REFERENCES|CASCADE|CONSTRAINT|CHECK|DEFAULT|DROP|ALTER|ADD|COLUMN|VIEW|MATERIALIZED|TRIGGER|BEFORE|AFTER|FOR|EACH|ROW|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|TRANSACTION|ISOLATION|LEVEL|READ|WRITE|COMMITTED|UNCOMMITTED|REPEATABLE|SERIALIZABLE|LOCK|SHARE|NOWAIT|SKIP|LOCKED|WITH|RECURSIVE|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|OVER|PARTITION|ROWS|RANGE|PRECEDING|FOLLOWING|CURRENT|UNBOUNDED|ASC|DESC|EXPLAIN|ANALYZE|QUERY|PLAN|RETURNING|CONFLICT|DO|NOTHING|INTEGER|INT|TEXT|REAL|VARCHAR|NUMERIC|DECIMAL|BOOLEAN|DATE|TIMESTAMP|SERIAL|BIGINT|true|false|function|return|const|let|if|else|for|while|new|await|async|db|use|find|insert|insertOne|updateOne|aggregate)\b/gi;
function hiCode(line){
  const ci = line.search(/--|\/\/|(?:^|\s)#(?=\s|$)/);
  const code = ci>=0 ? line.slice(0,ci) : line, cm = ci>=0 ? line.slice(ci) : '';
  // strings first, then keywords outside strings
  const parts = code.split(/('(?:[^']|'')*')/);
  const out = parts.map((p,i)=> i%2 ? `<span class="st">${esc(p)}</span>` : esc(p).replace(KW, m => `<span class="kw">${m}</span>`)).join('');
  return out + (cm ? `<span class="cm">${esc(cm)}</span>` : '');
}
const hiBlock = src => String(src).split('\n').map(hiCode).join('\n');
let ti = 0, si = 0, timer = null;
