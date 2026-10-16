/* 5.2 Reading EXPLAIN and EXPLAIN ANALYZE */
topic('5', { no:'5.2', title:'Reading EXPLAIN / EXPLAIN ANALYZE', db:'shop',
idea:`Read a real PostgreSQL plan from the inside out: which node runs first, what cost and rows mean, how to spot a bad row estimate, why "loops" multiply time, and the handful of red flags that explain most slow queries.`,
stateTitle:'Reading the node',
codes:{a:`EXPLAIN (ANALYZE, BUFFERS)
SELECT c.name, o.id, o.order_date
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.city = 'Pune' AND o.status = 'delivered'
ORDER BY o.order_date DESC LIMIT 20;

Limit  (cost=1250.3..1250.4 rows=20) (actual time=48.1..48.1 rows=20 loops=1)
  -> Sort  (cost=1250.3..1262.8 rows=5000) (actual time=48.1..48.1 rows=20 loops=1)
        Sort Key: o.order_date DESC   Sort Method: top-N heapsort  Memory: 27kB
        -> Hash Join  (cost=35.2..1117.4 rows=5000) (actual rows=61234 loops=1)
              Hash Cond: (o.customer_id = c.id)
              -> Seq Scan on orders o  (cost=0..980.0 rows=40000) (actual rows=40112 loops=1)
                    Filter: (status = 'delivered')   Rows Removed by Filter: 9888
              -> Hash  (cost=30.0..30.0 rows=400) (actual rows=3100 loops=1)
                    -> Seq Scan on customers c  (rows=400) (actual rows=3100 loops=1)
                          Filter: (city = 'Pune')
Planning Time: 0.4 ms   Execution Time: 48.3 ms
Buffers: shared hit=812 read=4021`},
steps:[
{hl:{q:[1,2,3,4,5]}, g:[G('EXPLAIN variants',['EXPLAIN','estimated plan only, query not run'],['EXPLAIN ANALYZE','runs it: actual times and rows','hot'],['BUFFERS','pages from cache (hit) vs disk (read)'],['careful','ANALYZE on UPDATE/DELETE really modifies data: wrap in BEGIN … ROLLBACK','bad'])],
 say:`<code>EXPLAIN</code> shows the plan the optimizer chose, with <i>estimates</i>. <code>EXPLAIN ANALYZE</code> actually runs the query and adds <i>actual</i> times and row counts, which is what you need for diagnosis. Careful: ANALYZE on a DELETE really deletes, so wrap it in a transaction you roll back.`},
{hl:{q:[12,13,14,15,16]}, g:[G('Read inside-out',['deepest / most indented','runs first (leaves: scans)','hot'],['parent','consumes its children\'s rows'],['top node','returns rows to the client'],['here','scans → hash → hash join → sort → limit'])],
 say:`A plan is a tree printed top-down, but <b>data flows bottom-up</b>. Start at the most indented nodes, the scans, and work outwards. Here: scan customers and build a hash table; scan orders and probe the hash; sort the joined rows; take 20.`},
{hl:{q:[7,8,10]}, g:[G('cost=1250.3..1262.8',['first number','startup cost (before the first row)'],['second','total cost'],['units','arbitrary (≈ page reads), compare within a plan'],['rows=5000','ESTIMATED rows output','hot'])],
 say:`<code>cost=startup..total</code> is the optimizer's estimate in abstract units (roughly page-read equivalents). Startup matters for LIMIT queries: a plan that streams the first rows quickly can beat one with a lower total cost. <code>rows=</code> is the <b>estimated</b> number of rows the node outputs.`},
{hl:{q:[10,14,15]}, g:[G('Estimate vs actual',['Hash Join','est 5000 vs actual 61234','bad'],['customers Pune','est 400 vs actual 3100','bad'],['×8 – ×12 off','plans built on wrong numbers','bad'],['cause','stale or missing statistics, correlated columns','hot'],['fix','ANALYZE; extended statistics'])],
 say:`The single most useful check: <b>estimated vs actual rows</b> on each node. The planner expected 400 Pune customers and got 3,100; it expected 5,000 joined rows and got 61,234. When estimates are off by 10×, every decision built on them (join order, algorithm, memory) may be wrong. Typical causes: stale statistics (run ANALYZE) or correlated predicates (5.4).`},
{hl:{q:[12,13]}, g:[G('Seq Scan + Filter',['scanned','50,000 rows'],['removed by filter','9,888'],['index helpful?','only if the filter is selective'],['here','80% kept → seq scan is right','ok'])],
 say:`<b>Seq Scan with a Filter</b> and "Rows Removed by Filter" tells you how much work was wasted. Here 80% of orders pass the filter, so a sequential scan is the right choice (4.5). A red flag is the opposite: millions of rows removed to keep a handful, which begs for an index.`},
{hl:{q:[8,9]}, g:[G('Sort node',['Sort Method','top-N heapsort (thanks to LIMIT)','ok'],['Memory: 27kB','fits in work_mem','ok'],['red flag','external merge Disk: 512MB → spilled','bad'],['avoid sorting','index on (customer filter…, order_date) to read in order'])],
 say:`<b>Sort</b> nodes show how they sorted. "top-N heapsort" is cheap because only 20 rows are kept. A red flag is <code>Sort Method: external merge Disk: …</code>: the sort spilled to disk because work_mem was too small. Often the better fix is an index that returns rows already in order (4.4).`},
{hl:{q:[17,18]}, g:[G('Totals',['Execution Time','48.3 ms'],['Buffers hit 812','pages from cache','ok'],['read 4021','pages from disk (or OS cache)','hot'],['loops=N','per-loop numbers × N = total (nested loops!)'])],
 say:`At the bottom: planning and execution time, and with BUFFERS how many pages came from cache vs disk. One more trap: on the inner side of a nested loop you'll see <code>loops=10000</code>, and the time and rows shown are <b>per loop</b>, so multiply. A 0.05 ms index scan × 10,000 loops is 500 ms.`},
{hl:{}, g:[G('Red flags',['estimate off by 10×+','stats / correlation'],['Seq Scan removing almost all rows','missing index'],['Nested Loop with huge loops','bad estimate or missing index on inner side'],['Sort/Hash spilling to disk','work_mem or better index'],['many heap fetches in index-only scan','VACUUM'])],
 say:`<b>Say it:</b> "I run EXPLAIN (ANALYZE, BUFFERS), read the tree from the innermost nodes out, and compare estimated with actual rows on every node, because big misestimates cause bad join orders and algorithms. Then I look for expensive scans that discard most rows, nested loops with huge loop counts, and sorts or hashes spilling to disk, and fix with indexes, fresher statistics or query rewrites."`}
],
keep:[`EXPLAIN = estimates; EXPLAIN ANALYZE = runs it (careful with writes).`,`Read from the most indented node outward; data flows up.`,`Compare estimated rows vs actual rows: 10× off = suspect statistics.`,`Watch: Rows Removed by Filter, loops × per-loop time, Sort spilling to disk, buffers read.`]}, {
  imp: 'must',
  theory: TH(`EXPLAIN prints the execution plan the optimizer chose; EXPLAIN ANALYZE also runs it and reports actual rows and timings, which is how you find why a query is slow.`,
`<p>When a query is slow, guessing is expensive. EXPLAIN is the database telling you exactly what it decided to do: which tables it scans, which indexes it uses, in what order it joins, how it sorts. EXPLAIN ANALYZE adds what really happened, so you can compare the optimizer's expectations with reality.</p>
<p>Reading a plan is like reading a recipe written upside down: the indented steps at the bottom happen first (fetch ingredients), and each step above uses the results of the steps below it.</p>`,
[[`Plan node`,`One operator: scan, join, sort, aggregate, limit.`],[`cost=a..b`,`Estimated startup and total cost.`],[`rows`,`Estimated (or actual) output rows.`],[`loops`,`How many times the node ran (per-loop figures).`],[`Rows Removed by Filter`,`Rows read but rejected.`],[`Buffers`,`Pages hit in cache vs read from disk.`],[`Misestimate`,`Large gap between estimated and actual rows.`]],
[`Run EXPLAIN (ANALYZE, BUFFERS) on a realistic dataset.`,`Find the nodes where most time is spent.`,`Compare estimates vs actuals; fix statistics if they diverge.`,`Check access paths, join algorithms and spills; change indexes or the query; re-run.`],
[`Slow-query logs (pg_stat_statements, MySQL slow log) tell you which queries; EXPLAIN tells you why.`,`auto_explain logs plans of slow queries automatically in production.`,`Visualisers (explain.dalibo.com, explain.depesz.com) highlight hot nodes.`],
[`Running EXPLAIN on a tiny dev database and trusting the plan for production data.`,`EXPLAIN ANALYZE on a DELETE without a rollback.`,`Ignoring loops when reading per-node times.`,`Comparing cost numbers across different queries as if they were milliseconds.`]),
  examples: [
    {lv:'basic', title:'Scan vs search in SQLite', sql:`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE status = 'delivered';`, why:`<code>SCAN orders</code>: no index on status. SQLite's EXPLAIN QUERY PLAN is a compact cousin of Postgres EXPLAIN.`},
    {lv:'mid', title:'Spot the temp sort, then remove it with an index', sql:`EXPLAIN QUERY PLAN SELECT id, order_date FROM orders WHERE customer_id = 1 ORDER BY order_date;
CREATE INDEX ix_cust_date ON orders(customer_id, order_date);
EXPLAIN QUERY PLAN SELECT id, order_date FROM orders WHERE customer_id = 1 ORDER BY order_date;`, why:`Before: SCAN + "USE TEMP B-TREE FOR ORDER BY". After: one SEARCH using the composite index, no sort.`},
    {lv:'adv', title:'A join plan: who is scanned, who is searched', sql:`CREATE INDEX ix_orders_cust ON orders(customer_id);
EXPLAIN QUERY PLAN
SELECT c.name, o.id
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.city = 'Pune' AND o.status = 'delivered';`, why:`SQLite uses a nested loop: SCAN orders as the outer loop and, for each order, SEARCH customers by its integer primary key (inner). In Postgres output, the inner side of such a plan shows loops=N, and per-loop numbers must be multiplied by N`},
  ],
  tips: {
    say:`"I use EXPLAIN (ANALYZE, BUFFERS), read from the innermost node outward, find where time goes, and compare estimated vs actual rows; a 10× misestimate usually explains a bad join order or algorithm. Then I look for scans that discard most rows, nested loops with large loop counts, and sorts or hashes spilling to disk."`,
    points:[`Explain cost (estimate) vs actual time, and startup vs total cost.`,`Mention loops and per-loop numbers.`,`Know the common fixes: index, ANALYZE, rewrite, work_mem.`],
    traps:[`Treating cost units as milliseconds.`,`Running EXPLAIN ANALYZE on writes without a rollback.`],
    qa:[[`EXPLAIN vs EXPLAIN ANALYZE?`,`EXPLAIN shows the planned tree with estimates without running; ANALYZE executes and adds actual rows, time and loops.`],
        [`Estimated rows 10, actual 1,000,000: what now?`,`Statistics are stale or don't capture the data (correlation, skew). Run ANALYZE, raise the statistics target, add extended statistics, then re-check the plan.`],
        [`What does "Sort Method: external merge Disk: 2GB" mean?`,`The sort didn't fit in work_mem and spilled to disk. Add an index that provides the order, reduce rows earlier, or raise work_mem for that query.`]]
  },
  exercises: [
    {lv:'E', q:`Show the plan for <code>SELECT name FROM products WHERE price &gt; 100 ORDER BY price</code> (note the sort step).`, hint:`EXPLAIN QUERY PLAN …`,
     sql:`EXPLAIN QUERY PLAN SELECT name FROM products WHERE price > 100 ORDER BY price;`},
    {lv:'M', q:`Create an index <code>ix_price</code> so that the previous query has no temp sort, and show the new plan.`, hint:`Index on price.`,
     sql:`CREATE INDEX ix_price ON products(price);
EXPLAIN QUERY PLAN SELECT name FROM products WHERE price > 100 ORDER BY price;`},
    {lv:'H', q:`A Postgres plan shows <code>Nested Loop (actual time=0.1..9200 rows=50 loops=1)</code> whose inner node is <code>Index Scan on orders (actual time=0.09..0.09 rows=0 loops=100000)</code>, and the outer node estimated 100 rows. Diagnose and propose fixes.`, hint:`Multiply by loops; compare estimates.`,
     answer:`<p>The outer side produced ~100,000 rows (estimated 100), so the planner chose a nested loop expecting 100 inner probes but did 100,000: 0.09 ms × 100k ≈ 9 s. Fix the estimate (ANALYZE, extended statistics for correlated filters) so it picks a hash join; or rewrite to filter earlier; check that the inner index matches the join key exactly.</p>`},
  ],
  quiz: [
    [`EXPLAIN ANALYZE differs from EXPLAIN because it…`,[`Only parses`,`Actually runs the query and reports real rows and times`,`Shows only costs`,`Rewrites the query`],1,`Careful with writes.`,'E'],
    [`In a plan tree, which nodes run first?`,[`The top node`,`The most indented (leaf) nodes`,`Alphabetical order`,`Joins`],1,`Data flows up.`,'E'],
    [`cost=10.5..200.0 means…`,[`10.5 ms to 200 ms`,`Estimated startup cost 10.5 and total cost 200 (abstract units)`,`10 to 200 rows`,`Memory used`],1,`Not milliseconds.`,'M'],
    [`rows=100 estimated, actual rows=500000. Most likely cause?`,[`Network latency`,`Stale or inadequate statistics`,`Too many indexes`,`A syntax error`],1,`Run ANALYZE.`,'M'],
    [`An inner index scan shows actual time=0.05 ms loops=20000. Its total time is about…`,[`0.05 ms`,`1 second`,`20 seconds`,`0.0025 ms`],1,`0.05 × 20000 = 1000 ms.`,'M'],
    [`"Sort Method: external merge Disk" indicates…`,[`An index was used`,`The sort spilled to disk (not enough memory)`,`Parallel query`,`A covering index`],1,`Raise work_mem or avoid the sort.`,'E'],
  ],
  quizAdv: [
    [`Why can a plan with a higher total cost be chosen for a LIMIT query?`,[`Bugs`,`Its startup cost is low: it produces the first rows quickly and the limit stops it early`,`Total cost is ignored`,`LIMIT disables the planner`],1,`Startup cost matters with LIMIT.`,'H'],
    [`Buffers: shared hit=10 read=90000 suggests…`,[`Everything was cached`,`Most pages came from disk (cold cache or too much data touched)`,`An index-only scan`,`Lock waits`],1,`I/O bound.`,'H'],
    [`Rows Removed by Index Recheck in a Bitmap Heap Scan is high because…`,[`The index is corrupt`,`The bitmap became lossy (page-level) for lack of work_mem, so rows are rechecked`,`Statistics are perfect`,`It's a hash join`],1,`Lossy bitmaps.`,'H'],
  ],
});
