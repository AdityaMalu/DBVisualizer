/* 2.6 Views and materialized views */
topic('2', { no:'2.6', title:'Views and materialized views', db:'shop',
idea:`A view is a saved query that behaves like a table; a materialized view is a saved result. Watch a view re-run its query on every read (always fresh), while a materialized view answers instantly but goes stale until it is refreshed.`,
tbTitle:'Data', stateTitle:'View vs materialized',
codes:{a:`CREATE VIEW customer_revenue AS
SELECT c.id, c.name, SUM(oi.qty * oi.unit_price) AS revenue
FROM customers c
JOIN orders o       ON o.customer_id = c.id AND o.status <> 'cancelled'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name;

SELECT * FROM customer_revenue WHERE revenue > 1000;   -- runs the query

-- PostgreSQL
CREATE MATERIALIZED VIEW customer_revenue_mv AS SELECT … ;
SELECT * FROM customer_revenue_mv;                     -- reads stored rows
REFRESH MATERIALIZED VIEW CONCURRENTLY customer_revenue_mv;`},
steps:[
{hl:{q:[1,2,3,4,5,6]}, g:[G('CREATE VIEW',['stores','the query text, not the rows','hot'],['acts like','a read-only table (usually)'],['cost','zero storage'])],
 say:`A <b>view</b> is a named, stored SELECT. Creating it stores only the query definition. Queries can then use <code>customer_revenue</code> as if it were a table, hiding a three-table join with aggregation behind a simple name.`},
{hl:{q:[8]}, tb:[TB('SELECT … FROM customer_revenue WHERE revenue > 1000',['id','name','revenue'],[[1,'Asha',2270],[5,'Eli',1300]],{0:'ok',1:'ok'})], g:[G('On every read',['view is expanded','query text substituted in','hot'],['optimizer','can push WHERE into the view'],['freshness','always current','ok'],['speed','as slow as the underlying query','bad'])],
 say:`When you query a view, the database <b>substitutes its definition</b> (view expansion / inlining) and optimises the combined query. Results are always fresh, but the join and aggregation run every single time. A view is about <b>abstraction and security</b>, not speed.`},
{hl:{}, g:[G('Why views',['simplify','hide complex joins'],['security','grant SELECT on the view, not the table; hide salary columns','ok'],['stable interface','rename/split tables underneath'],['row-level filtering','WHERE tenant_id = current_tenant']), G('Updatable views',['simple single-table views','INSERT/UPDATE allowed'],['joins / GROUP BY','read-only (or INSTEAD OF triggers)'],['WITH CHECK OPTION','reject writes the view couldn\'t see'])],
 say:`Views shine as an <b>interface</b>: analysts get a view without the salary column; apps keep reading <code>customers_v</code> while you refactor the tables underneath. Simple single-table views are even updatable; views with joins or aggregates are read-only unless you add INSTEAD OF triggers.`},
{hl:{q:[11,12]}, tb:[TB('customer_revenue_mv (stored rows)',['id','name','revenue'],[[1,'Asha',2270],[2,'Ben',845],[3,'Chen',940],[5,'Eli',1300],[7,'Gopal',60]],{0:'new',1:'new',2:'new',3:'new',4:'new'})], g:[G('MATERIALIZED VIEW',['stores','the result rows','hot'],['read','fast: just a table scan / index','ok'],['indexable','yes','ok'],['freshness','as of the last refresh','bad'])],
 say:`A <b>materialized view</b> runs the query once and <b>stores the result</b> like a table. Reads are fast and you can index it. It's a cache managed by the database: perfect for dashboards and expensive aggregations that don't need to be up to the second.`},
{hl:{}, tb:[TB('customer_revenue_mv (stale)',['id','name','revenue'],[[1,'Asha',2270],[2,'Ben',845]],{0:'bad'}), TB('reality after a new 900 order for Asha',['id','name','revenue'],[[1,'Asha',3170]],{0:'ok'})], g:[G('Staleness',['new order inserted','MV still says 2270','bad'],['view would say','3170','ok'])], log:['INSERT order for Asha → MV unchanged'],
 say:`The catch: it goes <b>stale</b>. A new order for Asha doesn't change the stored rows. Until someone refreshes it, the materialized view keeps showing old numbers. That's a deliberate trade: freshness for speed.`},
{hl:{q:[13]}, tb:[TB('after REFRESH',['id','name','revenue'],[[1,'Asha',3170],[2,'Ben',845]],{0:'ok'})], g:[G('Refreshing',['REFRESH MATERIALIZED VIEW','recompute; blocks readers (Postgres)'],['… CONCURRENTLY','readers keep old rows; needs a unique index','ok'],['schedule','cron / after ETL'],['incremental','Oracle fast refresh, SQL Server indexed views, streaming systems'])], log:['REFRESH → 3170'],
 say:`<code>REFRESH MATERIALIZED VIEW</code> recomputes the whole thing. In Postgres plain refresh locks out readers; <code>CONCURRENTLY</code> builds the new version alongside (needs a unique index) and swaps it in. Some databases maintain materialized results <b>incrementally</b> (Oracle fast refresh, SQL Server indexed views).`},
{hl:{}, tb:[], g:[G('Choose',['always-fresh abstraction / security','VIEW','ok'],['expensive aggregate, staleness OK','MATERIALIZED VIEW','ok'],['must be fresh AND fast','summary table maintained by triggers/app, or incremental MV'])],
 say:`<b>Say it:</b> "A view is a stored query, expanded at read time: always fresh, no storage, used for abstraction and security. A materialized view stores the result: fast and indexable but stale until refreshed, so it fits dashboards and heavy aggregates where a few minutes' lag is fine."`}
],
keep:[`View = stored query; re-runs every read; always fresh; no speed-up by itself.`,`Materialized view = stored result; fast, indexable; stale until REFRESH.`,`Views for abstraction/security (hide columns, stable interface).`,`Postgres: REFRESH … CONCURRENTLY needs a unique index, doesn't block readers.`]}, {
  imp: 'good',
  theory: TH(`A view is a saved query that looks like a table; a materialized view saves the query's result so reads are fast, at the cost of freshness.`,
`<p>A view is like a saved search in your email: it doesn't copy any emails, it just remembers the filter, so opening it always shows the current matches. A materialized view is like exporting the search results to a spreadsheet: instant to open, but it won't show emails that arrive later until you export again.</p>`,
[[`View`,`A named SELECT stored in the catalog.`],[`View expansion`,`Replacing the view name with its definition during planning.`],[`Materialized view`,`A view whose result is stored on disk.`],[`Refresh`,`Recomputing a materialized view.`],[`Updatable view`,`A view you can INSERT/UPDATE through.`],[`WITH CHECK OPTION`,`Rejects writes through a view that the view wouldn't show.`]],
[`CREATE VIEW stores the definition.`,`A query on the view is rewritten with the definition inlined and optimised as a whole.`,`CREATE MATERIALIZED VIEW runs the query and stores rows.`,`REFRESH re-runs it and replaces the rows.`],
[`Reporting layers and BI tools read from views.`,`Row-level security and column hiding via views.`,`Materialized views for leaderboards, daily stats, search facets.`],
[`Expecting a plain view to make a slow query fast.`,`Stacking views on views until nobody knows what a query costs.`,`Forgetting to schedule materialized view refreshes.`,`Refreshing a big MV without CONCURRENTLY during peak traffic.`]),
  examples: [
    {lv:'basic', title:'A view hiding a join', sql:`CREATE VIEW order_summary AS
SELECT o.id, c.name AS customer, o.order_date, o.status
FROM orders o JOIN customers c ON c.id = o.customer_id;

SELECT * FROM order_summary WHERE status = 'delivered';`, why:`Callers don't need to know the join.`},
    {lv:'mid', title:'A view is always fresh', sql:`CREATE VIEW cat_counts AS SELECT category, COUNT(*) AS n FROM products GROUP BY category;
SELECT * FROM cat_counts;
INSERT INTO products VALUES (9, 'Mug', 'kitchen', 12);
SELECT * FROM cat_counts;`, why:`The second read includes kitchen: the view re-ran its query.`},
    {lv:'adv', title:'Simulating a materialized view (SQLite has none)', sql:`CREATE TABLE cat_counts_mv AS SELECT category, COUNT(*) AS n FROM products GROUP BY category;
INSERT INTO products VALUES (9, 'Mug', 'kitchen', 12);
SELECT 'stale' AS state, * FROM cat_counts_mv;

-- "refresh": recompute and replace in one transaction
BEGIN;
DELETE FROM cat_counts_mv;
INSERT INTO cat_counts_mv SELECT category, COUNT(*) FROM products GROUP BY category;
COMMIT;
SELECT 'refreshed' AS state, * FROM cat_counts_mv;`, why:`A table filled from a query is what a materialized view is under the hood. Run it: the first result lacks kitchen, the second has it.`},
  ],
  tips: {
    say:`"A view stores a query and is expanded at read time, so it's always fresh and good for abstraction and security, but not faster. A materialized view stores the result, so reads are fast and indexable, but it's stale until refreshed; I use it for heavy aggregates where some lag is acceptable."`,
    points:[`Lead with the freshness vs speed trade-off.`,`Mention security use: grant on views, hide columns.`,`Know REFRESH CONCURRENTLY and its unique-index requirement.`],
    traps:[`"Views cache results" (plain views don't).`,`Ignoring refresh cost and scheduling.`],
    qa:[[`When would you use a materialized view over a cache like Redis?`,`When the data and the aggregation live in the DB, staleness is acceptable, and you want SQL access plus indexes without extra infrastructure.`],
        [`Can you index a view?`,`Not a plain view (indexes go on base tables). Materialized views, yes. SQL Server's indexed views are materialized and kept in sync.`],
        [`How do you keep a summary always fresh?`,`Triggers or application code updating a summary table in the same transaction, incremental MVs, or a streaming pipeline (CDC).`]]
  },
  exercises: [
    {lv:'E', q:`Create a view <code>cheap_products</code> with products under 50, then select <code>name, price</code> from it.`, hint:`CREATE VIEW … AS SELECT …; SELECT … FROM cheap_products;`,
     sql:`CREATE VIEW cheap_products AS SELECT * FROM products WHERE price < 50;
SELECT name, price FROM cheap_products;`},
    {lv:'M', q:`Create a view <code>customer_orders</code> with <code>customer_id, name, orders</code> (count of non-cancelled orders, 0 for none), then query customers from it with 0 orders.`, hint:`LEFT JOIN with the status filter in ON.`,
     sql:`CREATE VIEW customer_orders AS
SELECT c.id AS customer_id, c.name, COUNT(o.id) AS orders
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status <> 'cancelled'
GROUP BY c.id, c.name;
SELECT * FROM customer_orders WHERE orders = 0;`},
    {lv:'H', q:`Your dashboard query takes 40 seconds and runs on every page load. Data changes every few seconds but the dashboard can be 5 minutes stale. Design the solution, including refresh and failure modes.`, hint:`Materialized view + schedule + concurrency.`,
     answer:`<ul><li>Create a materialized view (or summary table) with exactly the dashboard's aggregates, plus a unique index.</li><li>Refresh every 5 minutes with <code>REFRESH MATERIALIZED VIEW CONCURRENTLY</code> so readers aren't blocked; skip a cycle if the previous refresh is still running (advisory lock).</li><li>Show "last updated at" on the dashboard (store the refresh time).</li><li>If refresh is too slow, make it incremental: aggregate only new rows since a watermark into a summary table.</li><li>Monitor refresh duration and failures; alert if data is older than e.g. 15 minutes.</li></ul>`},
  ],
  quiz: [
    [`A plain view stores…`,[`The result rows`,`The query definition`,`An index`,`A copy of each base table`],1,`Re-evaluated on each use.`,'E'],
    [`A materialized view's main drawback?`,[`Slow reads`,`Staleness until refreshed`,`Can't be queried with WHERE`,`Can't contain joins`],1,`Speed for freshness.`,'E'],
    [`Main reasons to use a plain view?`,[`Speed`,`Abstraction and security (hiding columns/joins)`,`Lower storage`,`Automatic indexing`],1,`It doesn't cache.`,'E'],
    [`REFRESH MATERIALIZED VIEW CONCURRENTLY in Postgres requires…`,[`SERIALIZABLE isolation`,`A unique index on the materialized view`,`No indexes`,`Superuser`],1,`To diff old and new rows.`,'M'],
    [`A view with GROUP BY is usually…`,[`Updatable`,`Read-only (unless INSTEAD OF triggers)`,`Materialized automatically`,`Invalid`],1,`Can't map an update to base rows.`,'M'],
    [`WITH CHECK OPTION on a view…`,[`Validates SQL syntax`,`Rejects inserts/updates that would produce rows the view can't see`,`Refreshes it`,`Adds a CHECK constraint to the base table`],1,`E.g. a view WHERE region = 'EU'.`,'M'],
  ],
  quizAdv: [
    [`SQL Server indexed views differ from Postgres materialized views because…`,[`They can't be indexed`,`They are maintained synchronously on every base-table change`,`They're always stale`,`They're read from the WAL`],1,`Write cost, always fresh.`,'H'],
    [`Querying a view with WHERE id = 5: does the filter reach the base table index?`,[`Never`,`Usually: the view is inlined and the predicate pushed down`,`Only for materialized views`,`Only with hints`],1,`Unless the view has constructs that block pushdown (e.g. LIMIT, some window functions).`,'H'],
    [`Stacking many views on top of each other can hurt because…`,[`Views use memory`,`Hidden joins and duplicated work end up in every query; plans get hard to reason about`,`Views expire`,`They disable the optimizer`],1,`Abstraction has a cost.`,'M'],
  ],
});
