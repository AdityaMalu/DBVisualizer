/* 1.7 Set operations: UNION, INTERSECT, EXCEPT */
topic('1', { no:'1.7', title:'Set operations: UNION, UNION ALL, INTERSECT, EXCEPT', db:'shop',
idea:`Stack two result sets vertically instead of joining them side by side. Compare UNION (removes duplicates) with UNION ALL (keeps them), then INTERSECT and EXCEPT, and the rules both sides must follow.`,
tbTitle:'Result sets', stateTitle:'Rules',
codes:{a:`-- A: cities of customers who ordered in Feb 2024
SELECT c.city FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE o.order_date LIKE '2024-02%'
UNION                         -- or UNION ALL / INTERSECT / EXCEPT
-- B: cities of customers who ordered in Mar 2024
SELECT c.city FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE o.order_date LIKE '2024-03%';`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('A (Feb)',['city'],[['Pune'],['Pune'],['Mumbai']]), TB('B (Mar)',['city'],[['Mumbai'],['Pune'],['Pune'],['Delhi']])],
 say:`Set operators combine the <b>rows</b> of two queries, one result under the other. A (February orders) has Pune twice (orders 103, 104) and Mumbai (105). B (March) has Mumbai, Pune twice and Delhi.`},
{hl:{q:[4]}, tb:[TB('A UNION B',['city'],[['Pune'],['Mumbai'],['Delhi']],{0:'new',1:'new',2:'new'})], g:[G('UNION',['combine','A + B'],['duplicates','removed (like DISTINCT)','hot'],['cost','needs a sort or hash to dedupe'])], log:['UNION → 3 rows'],
 say:`<b>UNION</b> returns every distinct row that appears in A or B. Duplicates are removed, both within and across the inputs, which costs a sort or a hash.`},
{hl:{q:[4]}, tb:[TB('A UNION ALL B',['city'],[['Pune'],['Pune'],['Mumbai'],['Mumbai'],['Pune'],['Pune'],['Delhi']])], g:[G('UNION ALL',['duplicates','kept','hot'],['cost','just concatenates: cheaper','ok'],['use when','inputs are disjoint or you want counts'])], log:['UNION ALL → 7 rows'],
 say:`<b>UNION ALL</b> simply appends B to A: 7 rows, duplicates kept, no dedup work. If you know the parts can't overlap (e.g. different years) or you want every row, UNION ALL is faster and is the right default.`},
{hl:{q:[4]}, tb:[TB('A INTERSECT B',['city'],[['Pune'],['Mumbai']],{0:'ok',1:'ok'}), TB('A EXCEPT B',['city'],[],{}), TB('B EXCEPT A',['city'],[['Delhi']],{0:'ok'})], log:['INTERSECT → Pune, Mumbai','A EXCEPT B → none','B EXCEPT A → Delhi'],
 say:`<b>INTERSECT</b>: rows in both (cities active in Feb <i>and</i> Mar). <b>EXCEPT</b> (Oracle: MINUS): rows in the first but not the second. Order matters for EXCEPT: B EXCEPT A is Delhi, a city new in March. Both remove duplicates (INTERSECT ALL / EXCEPT ALL exist in Postgres).`},
{hl:{}, tb:[], g:[G('Rules',['same number of columns','required','hot'],['compatible types','column by column'],['column names','taken from the first query'],['ORDER BY / LIMIT','once, at the end, applies to the whole result'],['NULLs','treated as equal for duplicate removal'])],
 say:`Both sides must have the <b>same number of columns with compatible types</b>; columns match by position, not by name, and the output takes the first query's names. A single ORDER BY at the end sorts the combined result. Set operations treat NULLs as equal when removing duplicates, unlike =.`},
{hl:{}, g:[G('Set op vs join',['UNION','stack rows vertically'],['JOIN','add columns horizontally'],['INTERSECT','≈ semi-join (EXISTS)'],['EXCEPT','≈ anti-join (NOT EXISTS)'])],
 say:`<b>Say it:</b> "UNION stacks two compatible result sets and removes duplicates; UNION ALL keeps them and is cheaper; INTERSECT keeps common rows and EXCEPT keeps rows only in the first. Columns match by position. I default to UNION ALL unless I need deduplication."`}
],
keep:[`UNION dedupes (cost), UNION ALL doesn't (cheaper; usual default).`,`INTERSECT = in both; EXCEPT/MINUS = in first, not in second (order matters).`,`Same column count, compatible types, matched by position; names from the first query.`,`One ORDER BY at the very end.`]}, {
  imp: 'good',
  theory: TH(`Set operations combine the rows of two queries with the same shape: union (either), intersection (both) or difference (first but not second).`,
`<p>Joins put tables side by side; set operations put results <b>on top of each other</b>. They're the SQL version of Venn diagrams: UNION is the whole of both circles, INTERSECT is the overlap, EXCEPT is one circle minus the overlap.</p>
<p>Because rows are stacked, both queries must produce the same columns in the same order, like two spreadsheets you paste under each other.</p>`,
[[`UNION`,`Distinct rows from either input.`],[`UNION ALL`,`All rows from both, duplicates kept.`],[`INTERSECT`,`Distinct rows present in both.`],[`EXCEPT / MINUS`,`Distinct rows of the first not present in the second.`],[`Union-compatible`,`Same number of columns with compatible types.`]],
[`Each side is evaluated as an independent query.`,`Results are concatenated (UNION ALL) or combined via sort/hash for dedup and matching.`,`The final ORDER BY/LIMIT applies to the combined output.`],
[`Combining similar data from different tables (current + archived orders).`,`Building one feed from several event types (UNION ALL with a "type" column).`,`Data reconciliation: EXCEPT in both directions to diff two tables.`],
[`Using UNION when UNION ALL is meant (slow, and silently drops legit duplicate rows).`,`Mismatched column order (types happen to match, data ends up in the wrong column).`,`Putting ORDER BY inside the first query.`]),
  examples: [
    {lv:'basic', title:'Every name in the system', sql:`SELECT name, 'customer' AS kind FROM customers
UNION ALL
SELECT name, 'product' FROM products
ORDER BY kind, name;`, why:`A label column tells you where each row came from. UNION ALL because the two lists can't overlap meaningfully.`},
    {lv:'mid', title:'Customers who ordered both electronics and books', sql:`SELECT o.customer_id FROM orders o
JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
WHERE p.category = 'electronics'
INTERSECT
SELECT o.customer_id FROM orders o
JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
WHERE p.category = 'books';`, why:`INTERSECT expresses "both" directly.`},
    {lv:'adv', title:'Diff two tables in both directions', sql:`CREATE TABLE products_backup AS SELECT * FROM products;
UPDATE products SET price = 99 WHERE id = 6;
DELETE FROM products_backup WHERE id = 8;

SELECT 'only in live' AS side, * FROM (SELECT * FROM products EXCEPT SELECT * FROM products_backup)
UNION ALL
SELECT 'only in backup', * FROM (SELECT * FROM products_backup EXCEPT SELECT * FROM products);`, why:`Reconciliation pattern: rows that differ show up on one or both sides. The changed Lamp appears twice (old and new versions); the deleted Cookbook only in live.`},
  ],
  tips: {
    say:`"UNION stacks two union-compatible queries and removes duplicates, UNION ALL keeps duplicates and is cheaper, INTERSECT keeps common rows, EXCEPT keeps rows only in the first. Columns match by position and the final ORDER BY sorts the whole thing."`,
    points:[`Say UNION ALL is the default unless dedup is needed, and why (sort/hash cost).`,`Know EXCEPT's Oracle name (MINUS) and that MySQL only got INTERSECT/EXCEPT in 8.0.31.`,`Relate INTERSECT/EXCEPT to semi/anti-joins.`],
    traps:[`Saying UNION "joins" tables.`,`Assuming columns are matched by name.`],
    qa:[[`UNION vs UNION ALL?`,`UNION removes duplicates (extra sort/hash), UNION ALL concatenates. Use UNION ALL when inputs are disjoint or duplicates are meaningful.`],
        [`How would you compare two tables for differences?`,`(A EXCEPT B) UNION ALL (B EXCEPT A), or a FULL OUTER JOIN on the key comparing columns.`],
        [`EXCEPT vs NOT EXISTS?`,`EXCEPT compares whole rows and treats NULLs as equal; NOT EXISTS compares on chosen columns with = (NULL never matches).`]]
  },
  exercises: [
    {lv:'E', q:`One alphabetical list of every customer name and product name that starts with C. Single column <code>name</code>.`, hint:`Two SELECTs with LIKE 'C%', UNION, ORDER BY name.`, ordered:true,
     sql:`SELECT name FROM customers WHERE name LIKE 'C%'
UNION
SELECT name FROM products WHERE name LIKE 'C%'
ORDER BY name;`},
    {lv:'M', q:`Customer ids who placed an order in February 2024 but none in March 2024.`, hint:`EXCEPT between two queries on orders.`,
     sql:`SELECT customer_id FROM orders WHERE order_date LIKE '2024-02%'
EXCEPT
SELECT customer_id FROM orders WHERE order_date LIKE '2024-03%';`},
    {lv:'H', q:`An activity feed: one row per event with <code>day, customer_id, event</code>, where events are <code>'joined'</code> (customers.joined), <code>'ordered'</code> (orders.order_date) and <code>'logged in'</code> (logins), restricted to March 2024, sorted by day then customer.`, hint:`Three SELECTs with UNION ALL and a literal event column; filter each part; ORDER BY at the end.`, ordered:true,
     sql:`SELECT joined AS day, id AS customer_id, 'joined' AS event FROM customers WHERE joined LIKE '2024-03%'
UNION ALL
SELECT order_date, customer_id, 'ordered' FROM orders WHERE order_date LIKE '2024-03%'
UNION ALL
SELECT login_date, customer_id, 'logged in' FROM logins WHERE login_date LIKE '2024-03%'
ORDER BY day, customer_id, event;`},
  ],
  quiz: [
    [`UNION vs UNION ALL?`,[`UNION keeps duplicates`,`UNION removes duplicates; UNION ALL keeps them`,`They're identical`,`UNION ALL removes NULLs`],1,`UNION ALL is cheaper.`,'E'],
    [`Requirement for UNION?`,[`Same table`,`Same number of columns with compatible types`,`Same column names`,`A shared key`],1,`Matched by position.`,'E'],
    [`A EXCEPT B returns…`,[`Rows in both`,`Rows in A not in B`,`Rows in B not in A`,`All rows`],1,`Oracle calls it MINUS.`,'E'],
    [`Where does ORDER BY go in a UNION?`,[`In each query`,`Once at the end, sorting the combined result`,`Only in the first query`,`Not allowed`],1,`It applies to the whole result.`,'M'],
    [`A has (1),(1),(2); B has (2),(3). A UNION ALL B has how many rows?`,[`3`,`4`,`5`,`2`],2,`Plain concatenation.`,'E'],
    [`Output column names of a UNION come from…`,[`The last query`,`The first query`,`Both, joined with _`,`They're unnamed`],1,`Alias in the first SELECT.`,'M'],
  ],
  quizAdv: [
    [`For duplicate removal in UNION, two rows with NULL in the same column are…`,[`Different`,`Treated as duplicates`,`An error`,`Kept only with UNION ALL`],1,`Set operations use "not distinct", unlike =.`,'H'],
    [`Postgres INTERSECT ALL with A = (1,1,1) and B = (1,1) returns…`,[`(1)`,`(1,1)`,`(1,1,1)`,`Nothing`],1,`min(count in A, count in B).`,'H'],
    [`Why can UNION be much slower than UNION ALL on large inputs?`,[`It runs queries serially`,`It must sort or hash the full combined result to remove duplicates`,`It disables indexes`,`It forces a cross join`],1,`Dedup is the cost.`,'M'],
  ],
});
