/* 5.4 Cost-based optimizer and statistics */
topic('5', { no:'5.4', title:'The cost-based optimizer: statistics, selectivity, cardinality estimates', db:'shop',
idea:`The optimizer never runs your query to choose a plan; it estimates. See the statistics it keeps (row counts, distinct values, most-common values, histograms), how it turns a WHERE into a selectivity, why "independent columns" assumptions go wrong, and how stale stats produce terrible plans.`,
tbTitle:'Statistics for orders.status', stateTitle:'Estimate',
codes:{a:`ANALYZE orders;                 -- refresh statistics (also run by autovacuum)

-- what the planner knows (Postgres pg_stats):
--   reltuples        = 1,000,000 rows
--   n_distinct(status)      = 4
--   most_common_vals        = {delivered, shipped, placed, cancelled}
--   most_common_freqs       = {0.80, 0.12, 0.05, 0.03}
--   histogram_bounds(order_date) = {2023-01-01, 2023-02-14, …}  (equal-count buckets)

SELECT * FROM orders WHERE status = 'cancelled';             -- est 30,000
SELECT * FROM orders WHERE order_date >= '2024-03-01';       -- from histogram
SELECT * FROM orders WHERE city = 'Pune' AND pincode = '411001';
-- independence assumption: sel(city) × sel(pincode)  → far too low!
CREATE STATISTICS s_city_pin (dependencies) ON city, pincode FROM orders;`},
steps:[
{hl:{q:[1]}, g:[G('Cost-based optimizer',['enumerates','candidate plans'],['estimates','rows (cardinality) at every node','hot'],['costs','I/O + CPU from those rows'],['chooses','cheapest estimated plan'],['without running','the query'])],
 say:`A <b>cost-based optimizer</b> picks a plan by estimating, not by trying. For each candidate plan it estimates how many rows flow out of every node (<b>cardinality</b>), turns that into I/O and CPU cost, and keeps the cheapest. Everything depends on those row estimates, which come from <b>statistics</b> gathered by <code>ANALYZE</code>.`},
{hl:{q:[3,4,5,6,7,8]}, tb:[TB('pg_stats (orders.status)',['value','frequency'],[['delivered','0.80'],['shipped','0.12'],['placed','0.05'],['cancelled','0.03']])], g:[G('Per-column statistics',['row count','reltuples'],['n_distinct','number of distinct values'],['MCV list','most common values + frequencies','hot'],['histogram','bucket boundaries for the rest'],['null_frac, correlation','fraction NULL; physical order vs value order'])],
 say:`<code>ANALYZE</code> samples the table and stores, per column: the number of distinct values, a list of <b>most common values</b> with their frequencies, a <b>histogram</b> of the remaining values (equal-count buckets), the NULL fraction, and how well the physical order correlates with the value order (which matters for index scan cost).`},
{hl:{q:[10]}, g:[G('status = \'cancelled\'',['MCV frequency','0.03'],['selectivity','3%'],['estimated rows','1,000,000 × 0.03 = 30,000','hot'],['plan','index scan is attractive (selective)','ok']), G('status = \'delivered\'',['selectivity','80%'],['plan','seq scan','ok'])],
 say:`For <code>status = 'cancelled'</code>, the planner looks up the MCV list: 3% → <b>selectivity</b> 0.03 → estimated 30,000 rows. That's selective enough that an index looks good. For 'delivered' (80%) the same index would be a bad idea and the planner chooses a sequential scan: same query shape, different plan, driven by statistics.`},
{hl:{q:[11]}, g:[G('Range from histogram',['buckets','each holds ~1% of rows (100 buckets)'],['>= 2024-03-01','cut-off 92.5% of the way through the buckets'],['estimate','≈ 7.5% of rows','hot'])],
 say:`For ranges, the planner uses the <b>histogram</b>: with 100 equal-count buckets, each holds ~1% of rows. If the cut-off date falls 92.5% of the way through the buckets, about 7.5% of rows qualify. This is why freshly inserted data beyond the last histogram bound (e.g. "today") is often underestimated until the next ANALYZE.`},
{hl:{q:[12,13,14]}, g:[G('Two predicates',['sel(city = Pune)','0.05'],['sel(pincode = 411001)','0.004'],['planner assumes independence','0.05 × 0.004 = 0.0002 → 200 rows','bad'],['reality','pincode implies city → 0.004 → 4,000 rows','hot'],['fix','extended statistics (dependencies, ndistinct, MCV)','ok'])],
 say:`The classic estimation failure: <b>correlated columns</b>. By default the planner assumes predicates are independent and <b>multiplies</b> selectivities: 5% × 0.4% = 0.02%, about 200 rows. But a pincode determines the city, so the real answer is 4,000, 20× more. Underestimates like this cause nested loops over far too many rows. <code>CREATE STATISTICS … (dependencies)</code> teaches the planner the correlation.`},
{hl:{q:[1]}, g:[G('Stale statistics',['bulk load 5M rows','stats still say 1M','bad'],['symptom','sudden plan change / slow query after a load or migration','bad'],['fix','ANALYZE after bulk changes; autovacuum thresholds','ok'],['other levers','statistics target, extended stats, rewriting, (last resort) hints'])],
 say:`<b>Stale statistics</b> are the other big cause of bad plans: after a bulk load or a big delete, the numbers describe a table that no longer exists. Autovacuum runs ANALYZE eventually; after large batch jobs or migrations, run it explicitly. You can also raise the per-column statistics target for skewed columns.`},
{hl:{}, g:[G('Debugging a bad plan',['1','EXPLAIN ANALYZE: find estimate vs actual gaps (5.2)'],['2','ANALYZE the tables'],['3','correlated predicates → extended statistics'],['4','skew → higher statistics target'],['5','rewrite (CTE, join order) / hints only as a last resort'])],
 say:`<b>Say it:</b> "The optimizer estimates the cardinality of every plan node from statistics (row counts, distinct values, most-common values and histograms) and picks the cheapest plan. Most bad plans come from bad estimates: stale statistics after bulk changes, or correlated columns where multiplying selectivities underestimates rows. I fix them with ANALYZE, extended statistics and higher statistics targets before reaching for hints."`}
],
keep:[`Plan choice = estimated rows → cost. Estimates come from statistics (ANALYZE).`,`Stats: row count, n_distinct, MCVs + frequencies, histograms, NULL fraction, correlation.`,`Selectivity × rows = estimate. Independence assumption multiplies selectivities.`,`Bad plans: stale stats, correlated columns, skew. Fix: ANALYZE, extended stats, stats target.`]}, {
  imp: 'good',
  theory: TH(`A cost-based optimizer estimates how many rows each step of a plan will produce, using statistics about the data, and chooses the plan with the lowest estimated cost.`,
`<p>To plan a route, a GPS needs traffic data. The optimizer's "traffic data" is <b>statistics</b>: how many rows a table has, how many distinct values a column has, which values are common, and how values are distributed. From these it estimates how many rows a filter keeps (<b>selectivity</b>), and from that, how expensive each plan would be.</p>
<p>If the traffic data is old or misleading, the GPS sends you down a jammed road. Same with databases: outdated or naive statistics lead to plans that are orders of magnitude slower.</p>`,
[[`Cardinality`,`Number of rows (estimated) at a plan node.`],[`Selectivity`,`Fraction of rows a predicate keeps.`],[`MCV`,`Most common values with their frequencies.`],[`Histogram`,`Value distribution in equal-count buckets.`],[`ANALYZE`,`Command that refreshes statistics.`],[`Independence assumption`,`Multiplying selectivities of different predicates.`],[`Extended statistics`,`Multi-column statistics capturing correlations.`]],
[`ANALYZE samples rows and stores per-column statistics.`,`For each predicate, the planner computes selectivity from MCVs/histograms.`,`It combines selectivities (multiplying for AND) to estimate rows.`,`It costs alternative plans and picks the cheapest.`],
[`Run ANALYZE after bulk loads and big deletes.`,`Investigate sudden plan regressions by comparing estimates to actuals.`,`Add extended statistics for correlated filters (city + zip, make + model).`],
[`Disabling autovacuum/autoanalyze.`,`Adding hints instead of fixing estimates.`,`Assuming the plan in staging matches production (different data, different stats).`]),
  examples: [
    {lv:'basic', title:'Gather statistics in SQLite', sql:`CREATE INDEX ix_status ON orders(status);
ANALYZE;
SELECT * FROM sqlite_stat1;`, why:`SQLite's <code>sqlite_stat1</code> stores, per index, the row count and average rows per distinct key: the input to its cost model.`},
    {lv:'mid', title:'Compute selectivity yourself', sql:`SELECT status,
       COUNT(*) AS n,
       ROUND(1.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 2) AS selectivity
FROM orders
GROUP BY status
ORDER BY n DESC;`, why:`Exactly what an MCV list stores. 'delivered' (60% here) is unselective; 'cancelled' and 'placed' (10% each) are selective.`},
    {lv:'adv', title:'The independence assumption going wrong', sql:`SELECT
  ROUND(1.0 * SUM(city = 'Pune') / COUNT(*), 3)                          AS sel_city,
  ROUND(1.0 * SUM(joined < '2023-06-01') / COUNT(*), 3)                AS sel_early,
  ROUND((1.0 * SUM(city = 'Pune') / COUNT(*)) * (1.0 * SUM(joined < '2023-06-01') / COUNT(*)), 3) AS assumed_both,
  ROUND(1.0 * SUM(city = 'Pune' AND joined < '2023-06-01') / COUNT(*), 3) AS actual_both
FROM customers;`, why:`Multiplying the two selectivities (what planners assume) underestimates the real combined selectivity because, in this data, early customers are mostly from Pune: correlated columns.`},
  ],
  tips: {
    say:`"The optimizer estimates row counts at each plan node using statistics (distinct counts, most-common values, histograms) and costs alternatives from them. Most bad plans trace back to bad estimates: stale stats after bulk changes, skew, or correlated predicates where the independence assumption underestimates. I fix the estimates with ANALYZE and extended statistics before considering hints."`,
    points:[`Explain selectivity × rows with a number.`,`Give the correlated-columns example.`,`Know that plans can change when data changes.`],
    traps:[`Reaching for hints first.`,`Thinking the optimizer "knows" the data exactly.`],
    qa:[[`A query was fast yesterday and slow today with no code change. Why?`,`Data grew or shifted and statistics changed (or went stale), so the planner picked a different plan. Compare EXPLAIN ANALYZE estimates vs actuals; ANALYZE; check for parameter-dependent generic plans.`],
        [`What does ANALYZE do (Postgres)?`,`Samples table rows and updates pg_statistic: null fraction, distinct counts, MCVs, histograms, correlation. It doesn't rewrite data (unlike VACUUM).`],
        [`How do you fix estimates for WHERE make = 'Tesla' AND model = 'Model 3'?`,`CREATE STATISTICS (dependencies, mcv) ON make, model; ANALYZE. The planner then knows model implies make.`]]
  },
  exercises: [
    {lv:'E', q:`Compute the selectivity of <code>category = 'electronics'</code> on products: a single value <code>sel</code>.`, hint:`COUNT of matches / COUNT(*), as a decimal.`,
     sql:`SELECT 1.0 * SUM(category = 'electronics') / COUNT(*) AS sel FROM products;`},
    {lv:'M', q:`Build an "MCV list" for <code>customers.city</code> (including NULL as its own value): <code>city, freq</code> with freq rounded to 2 decimals, most common first.`, hint:`GROUP BY city, divide by the total.`, ordered:true,
     sql:`SELECT city, ROUND(1.0 * COUNT(*) / (SELECT COUNT(*) FROM customers), 2) AS freq
FROM customers GROUP BY city ORDER BY freq DESC, city;`},
    {lv:'H', q:`A table has 10M rows. Selectivities: country = 'IN' 0.2, state = 'MH' 0.03 (all MH rows are IN), status = 'active' 0.5 (independent). Estimate rows for <code>country='IN' AND state='MH' AND status='active'</code> under the independence assumption and in reality.`, hint:`Multiply vs account for state ⊂ country.`,
     answer:`<p>Assumed: 10M × 0.2 × 0.03 × 0.5 = 30,000. Reality: state implies country, so 10M × 0.03 × 0.5 = 150,000, 5× more. Extended statistics on (country, state) fix the estimate.</p>`},
  ],
  quiz: [
    [`The optimizer picks a plan by…`,[`Running each candidate`,`Estimating costs from statistics`,`Choosing the first index`,`Random choice`],1,`Cost-based estimation.`,'E'],
    [`Selectivity 0.01 on 2M rows estimates…`,[`200 rows`,`20,000 rows`,`2M rows`,`0.01 rows`],1,`2,000,000 × 0.01.`,'E'],
    [`Statistics are refreshed by…`,[`VACUUM FULL only`,`ANALYZE (or autovacuum's autoanalyze)`,`REINDEX`,`Restarting the server`],1,`Samples the table.`,'E'],
    [`An MCV list contains…`,[`Most common values and their frequencies`,`Every distinct value`,`Index pages`,`Query plans`],0,`Used for equality estimates.`,'M'],
    [`Two correlated predicates cause the planner to…`,[`Overestimate`,`Underestimate (it multiplies selectivities)`,`Ignore one`,`Fail`],1,`Independence assumption.`,'M'],
    [`After bulk-loading 10× more rows, plans get worse. First fix?`,[`Add hints`,`ANALYZE the table`,`Drop all indexes`,`Restart`],1,`Stale statistics.`,'M'],
  ],
  quizAdv: [
    [`Why are rows inserted today often underestimated for WHERE created_at > now() - interval '1 hour'?`,[`Time zones`,`The histogram's last bucket ends at the max seen at the last ANALYZE`,`Indexes are missing`,`MVCC hides them`],1,`Out-of-histogram values; frequent ANALYZE helps.`,'H'],
    [`The "correlation" statistic in pg_stats affects…`,[`Join order only`,`Estimated cost of index scans (random vs sequential heap access)`,`Hash join memory`,`Parallelism`],1,`High correlation → index scan reads pages mostly sequentially.`,'H'],
    [`Postgres extended statistic kinds include…`,[`ndistinct, dependencies, mcv`,`btree, hash, gin`,`wal, fsm, vm`,`toast, heap, index`],0,`Multi-column stats.`,'H'],
  ],
});
