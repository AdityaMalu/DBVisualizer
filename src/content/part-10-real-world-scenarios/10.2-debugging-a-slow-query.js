/* 10.2 Scenario: debugging a slow query in production */
topic('10', { no:'10.2', title:'Scenario: "the orders page takes 8 seconds" — debugging a slow query', db:'shop',
idea:`A production incident, end to end. Find the guilty query with pg_stat_statements, read its plan, spot the missing composite index and the misestimate, fix it without locking the table, verify, and add guardrails so it doesn't come back.`,
actors:'On-call', stateTitle:'Investigation', tbTitle:'Evidence',
codes:{a:`-- 1. which queries cost the most in total?
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;

-- 2. the culprit (from the ORM)
SELECT * FROM orders
WHERE customer_id = $1 AND status <> 'cancelled'
ORDER BY created_at DESC LIMIT 20;

-- 3. its plan
EXPLAIN (ANALYZE, BUFFERS) SELECT …;
--  Limit → Sort (top-N) → Seq Scan on orders (rows=48M, Filter: customer_id = 42 …)

-- 4. fix: an index matching filter + sort, built without blocking writes
CREATE INDEX CONCURRENTLY ix_orders_cust_created
  ON orders (customer_id, created_at DESC);

-- 5. verify: Index Scan using ix_orders_cust_created … actual time=0.08 ms`},
steps:[
{hl:{}, th:[['you','RUN:warn','paged: p95 latency 8 s']], g:[G('Triage first',['is it one endpoint or everything?','orders page only'],['did something change?','deploy? data growth? new traffic?'],['DB health','CPU 95%, I/O high, lock waits low','hot'],['mitigate if burning','rate-limit, roll back the deploy, kill runaway queries'])],
 say:`The alert: the orders page p95 is 8 seconds. Before optimising anything, <b>triage</b>: is it one endpoint or the whole app? Did something change (a deploy, a data import, a traffic spike)? What does the database look like: CPU, I/O, lock waits, connection pool? Here: database CPU and disk I/O are pegged, lock waits are low, so a query is doing too much work rather than waiting on others.`},
{hl:{q:[1,2,3]}, tb:[TB('pg_stat_statements',['query','calls','mean ms','total %'],[['SELECT * FROM orders WHERE customer_id = $1 …','120k/h','2900','71%'],['UPDATE inventory …','40k/h','3','4%'],['SELECT … FROM products WHERE id = $1','900k/h','0.2','2%']],{0:'bad'})], g:[G('Find the query',['pg_stat_statements','aggregated stats per normalized query','hot'],['sort by total time','biggest overall impact, not just slowest'],['MySQL','performance_schema / slow query log'])],
 say:`<b>pg_stat_statements</b> aggregates execution stats per normalized query. Sort by <b>total</b> time: one query, fetching a customer's recent orders, consumes 71% of database time at 2.9 s per call. (Sorting by mean time alone can point at a rare report that doesn't matter.)`},
{hl:{q:[5,6,7,8]}, g:[G('The query',['filter','customer_id = $1 AND status <> cancelled'],['sort','created_at DESC'],['limit','20'],['existing indexes','orders(id) PK, orders(status), orders(created_at)'],['question','why not use one?'])],
 say:`The query comes from the ORM: a customer's 20 most recent non-cancelled orders. Existing indexes: the primary key, one on status and one on created_at. None starts with <code>customer_id</code>, so none can seek to "customer 42's orders" (4.4).`},
{hl:{q:[10,11,12]}, tb:[TB('plan highlights',['node','estimate','actual'],[['Seq Scan on orders','rows=120','rows=48,000,000 read'],['Rows Removed by Filter','—','47,999,880'],['Sort (top-N heapsort)','','120 rows'],['Buffers','','read=1.9M pages']],{0:'bad',1:'bad',3:'bad'})], g:[G('Plan says',['Seq Scan','reads 48M rows to keep 120','bad'],['status index','not selective (95% not cancelled) → unused','ok'],['created_at index','would walk all customers\' orders newest-first','bad'],['I/O','1.9M pages, mostly from disk','bad'])],
 say:`<code>EXPLAIN (ANALYZE, BUFFERS)</code> (5.2) shows a <b>sequential scan of 48M rows</b> discarding all but 120, then a top-N sort. The status index is useless (95% of orders aren't cancelled, 4.5), and walking the created_at index would visit everyone's orders newest-first. The table grew past what fits in memory, which is why it got slow "suddenly".`},
{hl:{q:[14,15,16]}, g:[G('The fix',['index','(customer_id, created_at DESC): equality, then sort column (4.4)','ok'],['status filter','checked on the few index rows (or add to INCLUDE / partial index)'],['CONCURRENTLY','builds without blocking writes (slower, can\'t run in a transaction)','hot'],['plain CREATE INDEX','blocks writes on orders for minutes → outage','bad'])],
 say:`The fix is an index matching the access pattern: <b>equality column first, then the sort column</b>. Postgres can then seek to customer 42 and read entries already ordered by created_at, stopping after 20. Build it with <code>CREATE INDEX CONCURRENTLY</code>: a plain CREATE INDEX would block all writes to orders for the minutes it takes on 48M rows, turning a slow page into an outage (10.4).`},
{hl:{q:[18]}, th:[['you','TERM:ok','p95 back to 35 ms']], tb:[TB('after',['node','actual'],[['Limit','20 rows'],['Index Scan using ix_orders_cust_created','0.08 ms, 23 rows read'],['Buffers','hit=6']],{1:'ok',2:'ok'})], log:['2900 ms → 0.08 ms; DB CPU 95% → 30%'],
 say:`Verify with EXPLAIN ANALYZE: an index scan reading 23 entries in 0.08 ms instead of 48M rows. Database CPU drops from 95% to 30%, which also speeds up every other query. Then check that the old <code>orders(status)</code> and <code>orders(created_at)</code> indexes are still used (pg_stat_user_indexes); unused indexes only slow writes.`},
{hl:{}, th:[], tb:[], g:[G('Prevent recurrence',['slow query log / auto_explain','see plans of slow queries'],['dashboards','top queries by total time'],['load test with prod-sized data','plans differ on small data'],['review ORM queries','N+1, SELECT *, missing indexes (5.5)'],['migration lint','CONCURRENTLY, no long locks (10.4)'])],
 say:`<b>Say it:</b> "Triage first: scope, recent changes, database saturation versus lock waits. Find the query that consumes the most total time with pg_stat_statements, read EXPLAIN ANALYZE comparing estimated and actual rows, and look for scans discarding most rows, sorts and nested-loop blowups. Here a composite index on the filter then sort column, built CONCURRENTLY, fixed it; I verify with the plan and metrics, drop unused indexes, and add slow-query logging and prod-sized load tests."`}
],
keep:[`Triage: one endpoint or all? What changed? CPU/I/O vs lock waits vs pool exhaustion.`,`pg_stat_statements: sort by total time.`,`EXPLAIN (ANALYZE, BUFFERS): rows read vs returned, estimate vs actual, sorts, loops.`,`Fix with an index matching equality → sort; CREATE INDEX CONCURRENTLY in prod.`,`Verify, remove unused indexes, add guardrails (auto_explain, dashboards, prod-sized tests).`]}, {
  imp: 'must',
  theory: TH(`Debugging a slow query is a repeatable process: triage the symptom, find the queries consuming the most time, read their execution plans, fix the root cause (often an index or a rewrite) safely, and verify.`,
`<p>Slow pages are usually caused by one or two queries doing far more work than necessary, typically because data grew and a plan that was fine on small tables now scans millions of rows. Guessing wastes time; measuring finds the culprit quickly.</p>
<p>The fix must also be safe in production: building an index the wrong way can lock a busy table and turn a slowdown into an outage.</p>`,
[[`pg_stat_statements`,`Postgres extension aggregating per-query stats.`],[`Slow query log`,`Log of statements above a time threshold.`],[`auto_explain`,`Logs plans of slow queries automatically.`],[`EXPLAIN (ANALYZE, BUFFERS)`,`Actual plan with timing and I/O (5.2).`],[`CREATE INDEX CONCURRENTLY`,`Builds an index without blocking writes.`],[`p95 / p99`,`Latency percentiles.`]],
[`Triage scope and recent changes; check DB saturation and waits.`,`Rank queries by total time.`,`Read the plan; compare estimated vs actual rows.`,`Apply the smallest safe fix (index, rewrite, stats), deployed safely.`,`Verify and add monitoring.`],
[`Incident response for latency regressions.`,`Weekly review of top queries.`,`Code review checks for ORM-generated queries.`],
[`Optimising the query that "looks slow" instead of the one with the most total time.`,`Testing plans on small dev databases.`,`Creating indexes with blocking DDL in production.`,`Adding indexes without removing unused ones.`]),
  examples: [
    {lv:'basic', title:'Reproduce the plan: scan + temp sort', sql:`EXPLAIN QUERY PLAN
SELECT * FROM orders
WHERE customer_id = 1 AND status <> 'cancelled'
ORDER BY order_date DESC LIMIT 20;`, why:`SCAN orders + USE TEMP B-TREE FOR ORDER BY: every row read, then sorted.`},
    {lv:'mid', title:'Apply the fix and compare', sql:`CREATE INDEX ix_orders_cust_date ON orders (customer_id, order_date DESC);
EXPLAIN QUERY PLAN
SELECT * FROM orders
WHERE customer_id = 1 AND status <> 'cancelled'
ORDER BY order_date DESC LIMIT 20;`, why:`SEARCH orders USING INDEX ix_orders_cust_date (customer_id=?) and no temp sort: the index delivers rows in order.`},
    {lv:'adv', title:'Find unused or redundant indexes (Postgres, shown, not run)', sql:`SELECT s.relname AS table, s.indexrelname AS index, s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique
ORDER BY pg_relation_size(s.indexrelid) DESC;`, run:false, why:`Indexes never scanned since stats reset (and not enforcing uniqueness) cost write time and memory for nothing; review and drop them (on all replicas' workloads too).`},
  ],
  tips: {
    say:`"I'd triage first: scope, what changed, and whether the database is saturated or waiting on locks. Then pg_stat_statements sorted by total time to find the culprit, EXPLAIN ANALYZE to see why, looking for scans discarding most rows, misestimates and sorts. Typical fix: a composite index matching equality then sort columns, built CONCURRENTLY. Then verify with the plan and metrics and add guardrails."`,
    points:[`Show a structured method, not guesses.`,`Mention safe deployment of the fix (CONCURRENTLY / online DDL).`,`Close with prevention.`],
    traps:[`"Add more RAM / a bigger instance" as the first answer.`,`Adding an index on every column in the WHERE separately.`],
    qa:[[`The query is fast in staging but slow in prod. Why?`,`Different data volume and distribution, different statistics, cold caches, different parameters (skew), concurrency/locks. Test with prod-like data and compare plans.`],
        [`CPU is low but queries are slow. What next?`,`Look at waits: lock contention (pg_locks, blocking chains), I/O latency, connection pool exhaustion, network.`],
        [`How do you add an index to a 500M-row table in MySQL without downtime?`,`Online DDL (ALGORITHM=INPLACE, LOCK=NONE) or gh-ost/pt-online-schema-change; schedule off-peak and watch replication lag.`]]
  },
  exercises: [
    {lv:'E', q:`Show the plan for "customer 3's orders, newest first".`, hint:`EXPLAIN QUERY PLAN with ORDER BY order_date DESC.`,
     sql:`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3 ORDER BY order_date DESC;`},
    {lv:'M', q:`Create the index that removes both the scan and the temp sort for that query, named <code>ix_fix</code>, and show the new plan.`, hint:`(customer_id, order_date DESC).`,
     sql:`CREATE INDEX ix_fix ON orders (customer_id, order_date DESC);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3 ORDER BY order_date DESC;`},
    {lv:'H', q:`After a deploy, a dashboard query went from 200 ms to 40 s. EXPLAIN shows a nested loop with loops=2,000,000 and the outer node estimated 50 rows. The deploy added a filter <code>AND region = 'EU' AND country = 'DE'</code>. Diagnose and fix.`, hint:`Correlated predicates, misestimates (5.4).`,
     answer:`<p>region and country are correlated (DE implies EU); the planner multiplies selectivities and underestimates the outer side (50 vs 2M), choosing a nested loop. Fix the estimate: <code>CREATE STATISTICS … (dependencies) ON region, country FROM t; ANALYZE t;</code> so it picks a hash join; or drop the redundant region predicate; verify with EXPLAIN ANALYZE.</p>`},
  ],
  quiz: [
    [`First thing to do when paged for latency?`,[`Add indexes everywhere`,`Triage: scope, recent changes, DB saturation vs waits`,`Restart the database`,`Upgrade hardware`],1,`Method before action.`,'E'],
    [`Which ranking finds the query with the biggest impact?`,[`Slowest single execution`,`Total execution time across calls`,`Number of joins`,`Query length`],1,`Mean × calls.`,'M'],
    [`A plan reads 48M rows to return 20. Most likely fix?`,[`More RAM`,`An index matching the filter and sort`,`VACUUM FULL`,`Lower isolation`],1,`Access path problem.`,'E'],
    [`Why CREATE INDEX CONCURRENTLY in production?`,[`Faster build`,`It doesn't block writes during the build`,`It uses less disk`,`It's required for composite indexes`],1,`Plain CREATE INDEX blocks writes.`,'M'],
    [`An index on status (95% 'active') isn't used for status <> 'cancelled'. Why?`,[`Bug`,`Low selectivity: a scan is cheaper`,`Wrong type`,`Index corrupt`],1,`See 4.5.`,'M'],
    [`After fixing, you should also…`,[`Nothing`,`Verify with the plan/metrics and remove indexes that are now unused`,`Disable autovacuum`,`Raise max_connections`],1,`Close the loop.`,'E'],
  ],
  quizAdv: [
    [`CREATE INDEX CONCURRENTLY fails halfway. Result?`,[`No trace`,`An INVALID index remains: drop it and retry`,`Table corrupted`,`Index usable`],1,`Check pg_index.indisvalid.`,'H'],
    [`pg_stat_statements groups queries by…`,[`Exact text`,`Normalized query (constants replaced by placeholders)`,`User`,`Table`],1,`$1, $2…`,'H'],
    [`auto_explain.log_min_duration helps because…`,[`It speeds queries`,`It logs actual plans of slow queries in production as they happen`,`It creates indexes`,`It disables seq scans`],1,`Plans from real data.`,'H'],
  ],
});
