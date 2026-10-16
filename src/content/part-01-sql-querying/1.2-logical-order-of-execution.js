/* 1.2 Logical order of query execution */
topic('1', { no:'1.2', title:'Logical order of query execution', db:'shop',
idea:`SQL is written SELECT-first but evaluated FROM-first. Run one grouped query through each logical phase and see why you can't use a SELECT alias in WHERE, why HAVING exists, and why window functions can't go in WHERE.`,
tbTitle:'Intermediate result', stateTitle:'Phase',
codes:{a:`SELECT   c.city, COUNT(*) AS orders                 -- 5
FROM     orders o                                   -- 1
JOIN     customers c ON c.id = o.customer_id        -- 1
WHERE    o.status <> 'cancelled'                    -- 2
GROUP BY c.city                                     -- 3
HAVING   COUNT(*) >= 2                              -- 4
ORDER BY orders DESC                                -- 6
LIMIT    2;                                         -- 7

-- ✗ WHERE orders >= 2       (alias doesn't exist yet in phase 2)
-- ✗ WHERE COUNT(*) >= 2     (no groups yet in phase 2)`},
steps:[
{hl:{q:[2,3]}, tb:[TB('1 · FROM + JOIN',['order','status','city'],[[101,'delivered','Pune'],[102,'delivered','Mumbai'],[103,'shipped','Pune'],[104,'delivered','Pune'],[105,'cancelled','Mumbai'],[106,'delivered','Mumbai'],[107,'placed','Pune'],[108,'delivered','Pune'],[109,'shipped','Delhi'],[110,'delivered','Mumbai']])], g:[G('Phase',['1 FROM / JOIN','build the working set','hot'],['2 WHERE',''],['3 GROUP BY',''],['4 HAVING',''],['5 SELECT',''],['6 ORDER BY',''],['7 LIMIT',''])],
 say:`Even though you <i>write</i> SELECT first, the database logically starts with <b>FROM</b> and the <b>JOINs</b>: it builds the working set of rows. Here: 10 orders, each joined to its customer's city.`},
{hl:{q:[4]}, tb:[TB('2 · WHERE',['order','status','city'],[[101,'delivered','Pune'],[102,'delivered','Mumbai'],[103,'shipped','Pune'],[104,'delivered','Pune'],[105,'cancelled','Mumbai'],[106,'delivered','Mumbai'],[107,'placed','Pune'],[108,'delivered','Pune'],[109,'shipped','Delhi'],[110,'delivered','Mumbai']],{4:'dim'})], g:[G('Phase',['1 FROM / JOIN','done'],['2 WHERE','filter individual rows','hot'])], log:['WHERE drops order 105 (cancelled)'],
 say:`<b>WHERE</b> filters individual rows. At this point there are no groups and no SELECT aliases, which is exactly why <code>WHERE orders &gt;= 2</code> (an alias) and <code>WHERE COUNT(*) &gt;= 2</code> (an aggregate) are errors.`},
{hl:{q:[5]}, tb:[TB('3 · GROUP BY city',['city','rows in group'],[['Pune','101, 103, 104, 107, 108'],['Mumbai','102, 106, 110'],['Delhi','109']])], g:[G('Phase',['3 GROUP BY','collapse rows into groups','hot'],['after this','only group keys and aggregates are meaningful'])],
 say:`<b>GROUP BY</b> collapses the remaining rows into one group per city. From now on each group is one output row, so you can only refer to the grouping columns or to <b>aggregates</b> over the group (COUNT, SUM, AVG…).`},
{hl:{q:[6]}, tb:[TB('4 · HAVING COUNT(*) >= 2',['city','COUNT(*)'],[['Pune',5],['Mumbai',3],['Delhi',1]],{2:'dim'})], g:[G('WHERE vs HAVING',['WHERE','filters rows, before grouping'],['HAVING','filters groups, after grouping','hot'])], log:['HAVING drops Delhi (1 order)'],
 say:`<b>HAVING</b> filters <i>groups</i>, after aggregation. Delhi has one order and is dropped. Rule of thumb: conditions on raw columns go in WHERE (cheaper, fewer rows to group); conditions on aggregates go in HAVING.`},
{hl:{q:[1]}, tb:[TB('5 · SELECT',['city','orders'],[['Pune',5],['Mumbai',3]])], g:[G('Phase',['5 SELECT','compute output columns, assign aliases','hot'],['window functions','evaluated here too (2.2)'],['DISTINCT','applied right after SELECT'])],
 say:`Only now does <b>SELECT</b> run: it computes the output expressions and gives them their aliases (<code>orders</code>). Window functions are evaluated in this phase as well, which is why you can't filter on ROW_NUMBER() in WHERE; you wrap the query and filter outside.`},
{hl:{q:[7,8]}, tb:[TB('6 · ORDER BY, 7 · LIMIT',['city','orders'],[['Pune',5],['Mumbai',3]],{0:'ok',1:'ok'})], g:[G('Phase',['6 ORDER BY','can use SELECT aliases','ok'],['7 LIMIT / OFFSET','cut the sorted result','ok'])], log:['Pune 5, Mumbai 3'],
 say:`<b>ORDER BY</b> runs after SELECT, so it <i>can</i> use the alias <code>orders</code>. <b>LIMIT</b> is last. Final answer: Pune 5, Mumbai 3.`},
{hl:{q:[10,11]}, tb:[], g:[G('Logical order',['1','FROM, JOIN'],['2','WHERE'],['3','GROUP BY'],['4','HAVING'],['5','SELECT (+ window functions, DISTINCT)'],['6','ORDER BY'],['7','LIMIT / OFFSET'])],
 say:`<b>Say it:</b> "Logically a query runs FROM and JOIN, then WHERE, GROUP BY, HAVING, SELECT, ORDER BY and LIMIT. That explains why aliases work in ORDER BY but not WHERE, why aggregates are filtered with HAVING, and why window functions need a subquery to be filtered." The optimizer may physically reorder work (push filters down, use an index for ORDER BY), but the result must be as if this order were followed. (MySQL and SQLite do allow SELECT aliases in GROUP BY/HAVING as an extension.)`}
],
keep:[`FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.`,`WHERE filters rows (no aggregates, no aliases). HAVING filters groups.`,`ORDER BY can use aliases because it runs after SELECT.`,`Filter on a window function by wrapping the query in a subquery/CTE.`]}, {
  imp: 'must',
  theory: TH(`SQL clauses are evaluated in a fixed logical order (FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT), which differs from the order you write them.`,
`<p>SQL was designed to read like English ("select names from customers where…"), but the database has to know <i>where</i> the rows come from before it can filter or compute anything. So it logically evaluates FROM first and SELECT near the end.</p>
<p>Think of cooking: you get ingredients (FROM), throw away the bad ones (WHERE), sort them into bowls (GROUP BY), discard bowls that are too small (HAVING), plate each bowl (SELECT), arrange the plates (ORDER BY) and serve the first few (LIMIT).</p>`,
[[`Logical order`,`The order the SQL standard defines results by.`],[`Physical plan`,`What the engine actually does; may reorder for speed but must give the same result.`],[`Aggregate`,`A function over a group: COUNT, SUM, AVG, MIN, MAX.`],[`HAVING`,`A filter on groups.`],[`Predicate pushdown`,`The optimizer applying filters as early as possible.`]],
[`FROM/JOIN build the input rows.`,`WHERE removes rows.`,`GROUP BY forms groups; HAVING removes groups.`,`SELECT computes outputs; DISTINCT; ORDER BY; LIMIT.`],
[`Debugging "column does not exist" errors on aliases in WHERE.`,`Choosing WHERE vs HAVING for performance: filter as early as possible.`,`Writing top-N-per-group with a window function in a CTE, then filtering outside.`],
[`Putting a non-aggregate condition in HAVING (works, but groups more rows than needed).`,`Referencing a SELECT alias in WHERE.`,`Expecting LIMIT to apply before ORDER BY.`]),
  examples: [
    {lv:'basic', title:'Alias in ORDER BY works', sql:`SELECT name, price * 2 AS double_price
FROM products
ORDER BY double_price DESC;`, why:`ORDER BY runs after SELECT, so the alias exists.`},
    {lv:'mid', title:'WHERE vs HAVING in one query', sql:`SELECT category, COUNT(*) AS n, AVG(price) AS avg_price
FROM products
WHERE price > 20             -- rows
GROUP BY category
HAVING COUNT(*) >= 2         -- groups
ORDER BY avg_price DESC;`, why:`Novel (15) is removed before grouping; books then has one product and is removed by HAVING.`},
    {lv:'adv', title:'Filter on a window function: wrap it', sql:`WITH ranked AS (
  SELECT name, category, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn
  FROM products
)
SELECT category, name, price
FROM ranked
WHERE rn = 1;`, why:`ROW_NUMBER is computed in the SELECT phase, after WHERE. To filter on it, compute it in a CTE and filter in the outer query: the most expensive product per category.`},
  ],
  tips: {
    say:`"Logical order is FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT. So WHERE can't see aliases or aggregates, HAVING filters groups, ORDER BY can use aliases, and window functions must be filtered in an outer query."`,
    points:[`Recite the order and immediately give one consequence (alias in WHERE fails).`,`Distinguish logical order from physical execution (pushdown, index-ordered scans).`,`Mention the MySQL/SQLite alias extension as a portability note.`],
    traps:[`Saying the engine literally executes in written order.`,`Using HAVING for row filters "because it works".`],
    qa:[[`Why does <code>SELECT price*2 AS p FROM t WHERE p &gt; 10</code> fail?`,`WHERE is evaluated before SELECT, so p doesn't exist yet. Repeat the expression or use a subquery/CTE.`],
        [`Can you use an aggregate in WHERE?`,`No: there are no groups yet. Use HAVING, or aggregate in a subquery and filter outside.`],
        [`Where do window functions run?`,`In the SELECT phase, after WHERE/GROUP BY/HAVING. They can be used in ORDER BY but not in WHERE.`]]
  },
  exercises: [
    {lv:'E', q:`Categories whose total list price exceeds 300. Return <code>category, total</code>.`, hint:`GROUP BY category, HAVING SUM(price) &gt; 300.`,
     sql:`SELECT category, SUM(price) AS total
FROM products
GROUP BY category
HAVING SUM(price) > 300;`},
    {lv:'M', q:`Among delivered orders only, customers with at least 2 such orders. Return <code>customer_id, delivered</code>, most first.`, hint:`Status filter in WHERE, count filter in HAVING.`, ordered:true,
     sql:`SELECT customer_id, COUNT(*) AS delivered
FROM orders
WHERE status = 'delivered'
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY delivered DESC, customer_id;`},
    {lv:'H', q:`For each order, its total (<code>SUM(qty*unit_price)</code>). Return only orders whose total is above the average order total. Columns: <code>order_id, total</code>.`, hint:`You need an aggregate of an aggregate: compute order totals in a CTE, then compare to AVG over that CTE.`,
     sql:`WITH totals AS (
  SELECT order_id, SUM(qty * unit_price) AS total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, total
FROM totals
WHERE total > (SELECT AVG(total) FROM totals);`},
  ],
  quiz: [
    [`Which clause is logically evaluated first?`,[`SELECT`,`FROM`,`WHERE`,`ORDER BY`],1,`The rows must exist before anything else.`,'E'],
    [`Where do you filter on COUNT(*) &gt; 5?`,[`WHERE`,`HAVING`,`ORDER BY`,`FROM`],1,`Aggregates exist after GROUP BY.`,'E'],
    [`Why can ORDER BY use a SELECT alias but WHERE can't?`,[`ORDER BY is evaluated after SELECT; WHERE before it`,`Aliases are only for ORDER BY by definition`,`WHERE runs on the index only`,`It's a MySQL-only feature`],0,`Logical order.`,'M'],
    [`Which runs last?`,[`HAVING`,`ORDER BY`,`LIMIT`,`SELECT`],2,`LIMIT cuts the sorted result.`,'E'],
    [`A condition on a plain column placed in HAVING instead of WHERE…`,[`Errors`,`Gives the same result but filters later (more work)`,`Changes the result`,`Is faster`],1,`Valid if the column is a group key, but WHERE is better.`,'M'],
    [`Filtering rows where ROW_NUMBER() = 1 requires…`,[`WHERE ROW_NUMBER() OVER (...) = 1`,`HAVING ROW_NUMBER() = 1`,`A subquery/CTE, then WHERE rn = 1 outside`,`LIMIT 1`],2,`Window functions run in SELECT.`,'M'],
  ],
  quizAdv: [
    [`DISTINCT is applied…`,[`Before WHERE`,`Right after SELECT, before ORDER BY`,`After LIMIT`,`During GROUP BY only`],1,`That's why ORDER BY with DISTINCT may only use selected columns (in Postgres).`,'H'],
    [`The optimizer evaluates a WHERE filter inside a join before joining. Is that allowed?`,[`No, the logical order forbids it`,`Yes: physical order may differ as long as results are identical`,`Only for inner joins in MySQL`,`Only when the filter uses an index`],1,`Predicate pushdown.`,'H'],
    [`<code>SELECT a, COUNT(*) FROM t GROUP BY a ORDER BY b</code> in PostgreSQL…`,[`Works`,`Fails: b isn't grouped or aggregated`,`Orders by a`,`Returns one row`],1,`After grouping, b has no single value per group.`,'H'],
  ],
});
