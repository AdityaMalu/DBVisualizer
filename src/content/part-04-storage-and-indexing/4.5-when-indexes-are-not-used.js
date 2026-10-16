/* 4.5 When indexes are not used: sargability, selectivity, implicit casts */
topic('4', { no:'4.5', title:'Why isn\'t my index used? Sargability, functions, casts, selectivity', db:'shop',
idea:`You added an index and the plan still says full scan. Step through the usual culprits: a function wrapped around the column, arithmetic on it, an implicit type cast, a leading wildcard, OR across columns, and low selectivity where a scan really is cheaper.`,
stateTitle:'Index usable?', tbTitle:'Rewrite',
codes:{a:`CREATE INDEX ix_date  ON orders(order_date);
CREATE INDEX ix_email ON customers(email);

WHERE substr(order_date, 1, 4) = '2024'          -- ✗ function on column
WHERE order_date >= '2024-01-01'
  AND order_date <  '2025-01-01'                 -- ✓ sargable range

WHERE price * 1.18 > 100                         -- ✗ math on column
WHERE price > 100 / 1.18                         -- ✓ math on constant

WHERE lower(email) = 'ben@mail.com'              -- ✗ … unless an
CREATE INDEX ix_email_lower ON customers(lower(email));  -- expression index

WHERE phone = 9876543210        -- phone is VARCHAR → implicit cast ✗
WHERE name LIKE '%sh%'          -- leading wildcard ✗   'Ash%' ✓
WHERE status = 'delivered'      -- 80% of rows → scan is cheaper`},
steps:[
{hl:{q:[4]}, tb:[TB('the index stores',['order_date (sorted)'],[['2024-01-05'],['2024-01-09'],['2024-02-02'],['…']])], g:[G('substr(order_date, 1, 4) = \'2024\'',['index sorted by','order_date'],['query asks about','substr(order_date)'],['result','must compute it for every row → scan','bad'])], log:['SCAN orders'],
 say:`An index is sorted by the column's <i>raw values</i>. Wrap the column in a function (<code>substr</code>, <code>YEAR()</code>, <code>DATE()</code>, <code>lower()</code>) and the engine can't use that ordering: it has to compute the function for every row. A predicate the index can serve is called <b>sargable</b> (Search ARGument ABLE).`},
{hl:{q:[5,6]}, g:[G('Rewrite as a range',['order_date >= 2024-01-01 AND < 2025-01-01','✓ index range seek','ok'],['half-open','>= start AND < next start (no 23:59:59 bugs)','ok'])], log:['SEARCH orders USING INDEX ix_date (order_date>? AND order_date<?)'],
 say:`Fix: move the logic to the <b>constant side</b>. "Year is 2024" becomes a <b>half-open range</b> on the raw column: <code>&gt;= '2024-01-01' AND &lt; '2025-01-01'</code>. The index seeks to the start and scans to the end. Half-open ranges also avoid the classic "BETWEEN … '23:59:59'" bugs with timestamps.`},
{hl:{q:[8,9]}, g:[G('Arithmetic',['price * 1.18 > 100','✗ expression on column','bad'],['price > 100 / 1.18','✓ column alone','ok'])],
 say:`Same idea with arithmetic: <code>price * 1.18 &gt; 100</code> hides the column inside an expression. Rearranged as <code>price &gt; 100 / 1.18</code>, the column stands alone and the constant is computed once. Optimizers rarely do this algebra for you.`},
{hl:{q:[11,12]}, g:[G('Expression (functional) index',['index on lower(email)','stores the function\'s result, sorted','ok'],['query must match','lower(email) = …','hot'],['Postgres/SQLite/Oracle','expression indexes'],['MySQL 8','functional key parts / generated columns'])], log:['SEARCH customers USING INDEX ix_email_lower (<expr>=?)'],
 say:`When you genuinely need the function (case-insensitive email), index the <b>expression</b> itself: <code>CREATE INDEX … ON customers(lower(email))</code>. The index now stores lowercase emails in order, and a query using exactly <code>lower(email) = …</code> can seek.`},
{hl:{q:[14]}, g:[G('Implicit cast',['phone is VARCHAR','compared with a number'],['DB converts','every phone value to a number','bad'],['result','function on the column → scan','bad'],['fix','compare with a string literal; match types in joins too','ok'])],
 say:`<b>Implicit type conversion</b> is a function in disguise. Comparing a VARCHAR column to a number makes MySQL convert every row's value to a number, so the index is useless (and '0123' vs 123 semantics get weird). The same happens when joining columns of different types or collations. Match types exactly.`},
{hl:{q:[15]}, g:[G('LIKE',['\'Ash%\'','prefix → range seek','ok'],['\'%sh%\'','no fixed prefix → scan','bad'],['fix','trigram index (pg_trgm), full-text search (9.6)'])],
 say:`<code>LIKE 'Ash%'</code> has a fixed prefix, so it's a range on the index. <code>LIKE '%sh%'</code> could match anywhere, so a B-tree can't help. For "contains" search use a trigram index (Postgres pg_trgm) or full-text search.`},
{hl:{q:[16]}, g:[G('Low selectivity',['status = delivered','6 of 10 rows here; 80% in real life'],['index path','seek + random table read per row','bad'],['full scan','sequential, reads each page once','ok'],['optimizer picks','the cheaper estimate (needs fresh statistics, 5.4)'])],
 say:`Sometimes ignoring the index is <b>correct</b>. If a predicate matches a large fraction of rows (low <b>selectivity</b>), using a secondary index means one random table read per match, which is slower than reading the table sequentially once. The crossover is often a few percent of the table. The optimizer decides from statistics (5.4); stale statistics cause wrong choices.`},
{hl:{}, tb:[], g:[G('Checklist',['function or math on the column?','move it to the constant / expression index'],['type or collation mismatch?','match types'],['leading wildcard?','trigram / full-text'],['OR across columns?','UNION or separate indexes (bitmap OR)'],['not a leftmost prefix?','4.4'],['matches most rows?','scan is right'],['stale stats?','ANALYZE'])],
 say:`<b>Say it:</b> "An index is skipped when the predicate isn't sargable, like a function, arithmetic or implicit cast on the column, or a leading wildcard; when it doesn't match a leftmost prefix; or when the predicate is so unselective that a sequential scan is cheaper. I rewrite to compare the raw column with constants, add expression indexes when needed, keep types aligned, and keep statistics fresh."`}
],
keep:[`Sargable = raw column compared with a constant/range. Functions, math, casts on the column kill index use.`,`Year filter → half-open range. price*k > x → price > x/k.`,`Need the function? Expression index on exactly that expression.`,`LIKE 'abc%' ok, '%abc' not. Unselective predicates → full scan is correct.`]}, {
  imp: 'must',
  theory: TH(`An index helps only when the predicate compares the indexed value directly with something constant and selects a small fraction of rows; otherwise the optimizer correctly falls back to scanning.`,
`<p>An index is a sorted list of a column's values. If you ask about the values themselves ("dates from March"), the database can jump into the sorted list. If you ask about something computed from them ("dates whose month name has 5 letters"), the sorted order is useless and every value must be computed and checked.</p>
<p>And even a perfect index isn't worth it when the answer is most of the table: it's faster to read a book cover to cover than to look up 80% of its pages one at a time through the index.</p>`,
[[`Sargable`,`A predicate an index can use for seeking.`],[`Expression index`,`An index on the result of a function or expression.`],[`Implicit conversion`,`The DB silently casting values to compare different types.`],[`Selectivity`,`Fraction of rows a predicate keeps (low fraction = selective).`],[`Statistics`,`Value distributions the optimizer uses to estimate selectivity.`],[`Half-open range`,`>= start AND < end.`]],
[`The optimizer rewrites predicates and matches them against available indexes.`,`Only sargable predicates on a usable prefix can become seeks.`,`It estimates rows via statistics and compares plan costs.`,`It picks a scan if that's cheaper.`],
[`Slow-query investigations very often end with "the WHERE had a function on the column".`,`ORMs can generate non-sargable SQL (e.g. casting in comparisons); check generated queries.`,`Case-insensitive lookups use expression indexes or citext/collations.`],
[`WHERE DATE(created_at) = '2024-03-01'.`,`Comparing strings to numbers.`,`Forcing index hints to avoid a scan that's actually optimal.`,`Expecting an index on a boolean/low-cardinality column to speed everything up.`]),
  examples: [
    {lv:'basic', title:'Function on the column vs a range', sql:`CREATE INDEX ix_date ON orders(order_date);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE substr(order_date, 1, 7) = '2024-03';
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE order_date >= '2024-03-01' AND order_date < '2024-04-01';`, why:`First: SCAN. Second: SEARCH USING INDEX ix_date with a range.`},
    {lv:'mid', title:'Expression index for case-insensitive lookup', sql:`CREATE INDEX ix_email_lower ON customers(lower(email));
EXPLAIN QUERY PLAN SELECT name FROM customers WHERE lower(email) = 'ben@mail.com';
SELECT name FROM customers WHERE lower(email) = 'ben@mail.com';`, why:`The predicate matches the indexed expression exactly, so it seeks.`},
    {lv:'adv', title:'OR across columns, and the UNION rewrite', sql:`CREATE INDEX ix_city ON customers(city);
CREATE INDEX ix_email ON customers(email);
EXPLAIN QUERY PLAN SELECT name FROM customers WHERE city = 'Delhi' OR email = 'ben@mail.com';`, why:`SQLite uses a <b>MULTI-INDEX OR</b>: one seek per index, results merged. Databases without that would scan; the manual rewrite is <code>… WHERE city = 'Delhi' UNION SELECT … WHERE email = 'ben@mail.com'</code>.`},
  ],
  tips: {
    say:`"Indexes are skipped when the predicate isn't sargable (a function, arithmetic or implicit cast on the column, or a leading wildcard), when it doesn't use the index's leftmost prefix, or when it matches so many rows that a sequential scan is cheaper. I rewrite predicates to compare raw columns with constants, add expression indexes where needed, match types, and check statistics."`,
    points:[`Show the DATE(created_at) → half-open range rewrite.`,`Explain why a scan can be the right plan (random vs sequential I/O).`,`Mention implicit conversions in joins (type/collation mismatch).`],
    traps:[`Forcing index hints blindly.`,`Thinking an index on a boolean column helps most queries.`],
    qa:[[`Why is <code>WHERE YEAR(created_at) = 2024</code> slow?`,`The function is applied to every row, so the index on created_at can't seek. Use created_at &gt;= '2024-01-01' AND created_at &lt; '2025-01-01'.`],
        [`The index exists but the plan does a seq scan on 30% of the table. Bug?`,`Probably not: random heap reads for 30% of rows cost more than one sequential pass. Check estimates vs actual rows; if estimates are wrong, ANALYZE.`],
        [`How do you index for case-insensitive search?`,`Expression index on lower(col) and query with lower(col) = lower(?), or a case-insensitive collation/citext.`]]
  },
  exercises: [
    {lv:'E', q:`The original filter is <code>WHERE substr(order_date, 1, 7) = '2024-02'</code>. Rewrite it sargably as a half-open range and return <code>id, order_date</code>.`, hint:`>= '2024-02-01' AND &lt; '2024-03-01'.`,
     sql:`SELECT id, order_date FROM orders WHERE order_date >= '2024-02-01' AND order_date < '2024-03-01';`},
    {lv:'M', q:`Products whose price including 18% tax exceeds 200, written sargably: <code>name, price</code>.`, hint:`price &gt; 200 / 1.18.`,
     sql:`SELECT name, price FROM products WHERE price > 200 / 1.18;`},
    {lv:'H', q:`Create an index named <code>ix_cust_year</code> that lets <code>WHERE substr(joined, 1, 4) = '2024'</code> seek, and show the plan.`, hint:`An expression index on exactly substr(joined, 1, 4).`,
     sql:`CREATE INDEX ix_cust_year ON customers(substr(joined, 1, 4));
EXPLAIN QUERY PLAN SELECT name FROM customers WHERE substr(joined, 1, 4) = '2024';`},
  ],
  quiz: [
    [`Which predicate can use an index on created_at?`,[`DATE(created_at) = '2024-03-01'`,`created_at >= '2024-03-01' AND created_at < '2024-03-02'`,`created_at + 1 > NOW()`,`CAST(created_at AS TEXT) LIKE '2024%'`],1,`Raw column vs constants.`,'E'],
    [`"Sargable" means…`,[`Sorted`,`Usable as an index search argument`,`Saved in RAM`,`Secured`],1,`Search ARGument ABLE.`,'E'],
    [`LIKE 'abc%' vs LIKE '%abc' on an indexed column…`,[`Both use the index`,`Only 'abc%' can seek`,`Only '%abc' can seek`,`Neither`],1,`A fixed prefix is a range.`,'E'],
    [`VARCHAR phone compared to a numeric literal in MySQL…`,[`Uses the index`,`Converts each value to a number, preventing index seeks`,`Errors`,`Is faster`],1,`Implicit conversion.`,'M'],
    [`An index on status, where 90% of rows are 'active'. WHERE status = 'active'…`,[`Index is ideal`,`A full scan is likely cheaper`,`Always errors`,`Uses a hash`],1,`Low selectivity.`,'M'],
    [`To use an index for lower(email) = ?…`,[`Impossible`,`Create an expression index on lower(email)`,`Index email twice`,`Use LIKE`],1,`Functional index.`,'M'],
  ],
  quizAdv: [
    [`Why can a secondary index on a 20%-selective predicate lose to a seq scan?`,[`Indexes are slow`,`Each match costs a random heap/table read; sequential I/O over the whole table is cheaper beyond a small fraction`,`Seq scans skip the buffer pool`,`It can't`],1,`Bitmap heap scans (Postgres) are the middle ground.`,'H'],
    [`Postgres bitmap heap scan does…`,[`A hash join`,`Collects matching row locations from the index, sorts by page, then reads each page once`,`A full scan`,`An index-only scan`],1,`Fewer random reads for medium selectivity.`,'H'],
    [`A join on users.id (BIGINT) = events.user_id (VARCHAR)…`,[`Is fine`,`Casts one side for every row; the index on the cast side can't be used`,`Is rejected`,`Uses a merge join automatically`],1,`Fix the column type.`,'H'],
  ],
});
