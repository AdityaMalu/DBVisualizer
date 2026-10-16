/* 9.7 Columnar storage, OLAP warehouses and time-series databases */
topic('9', { no:'9.7', title:'Column stores, data warehouses and time-series databases', db:'shop',
idea:`An analytics query sums one column over a billion rows. See how a row store reads every column of every row while a column store reads one compressed column, why that enables vectorised scans, and how warehouses (BigQuery, Snowflake, ClickHouse) and time-series databases build on it.`,
stateTitle:'Storage layout', tbTitle:'Layout on disk',
codes:{a:`SELECT category, SUM(revenue)
FROM sales                          -- 1 billion rows, 40 columns
WHERE sale_date >= '2024-01-01'
GROUP BY category;

-- row store page:    [id, date, customer, product, category, qty, revenue, … 40 cols] × N rows
-- column store:      date:     [2024-01-01, 2024-01-01, 2024-01-02, …]   (compressed)
--                    category: [books, books, books, furniture, …]        (dictionary + RLE)
--                    revenue:  [15, 30, 120, …]
--  → read 3 of 40 columns, skip blocks by min/max (zone maps), vectorised SUM

-- time-series DBs (TimescaleDB, InfluxDB, ClickHouse, Prometheus):
-- append-mostly, time-partitioned, compression (delta-of-delta, Gorilla),
-- downsampling + retention:  raw 7 days → 1-minute rollups 90 days → 1-hour forever`},
steps:[
{hl:{q:[1,2,3,4]}, g:[G('OLAP query shape',['rows scanned','millions–billions'],['columns used','3 of 40','hot'],['output','a few aggregated rows'],['vs OLTP','few rows, all columns, by key'])],
 say:`Analytical (OLAP) queries look very different from OLTP lookups: they scan huge numbers of rows but touch only a few columns, and return a small aggregated result. "Revenue by category this year" reads date, category and revenue out of a 40-column table.`},
{hl:{q:[6]}, tb:[TB('row store pages',['page','contents'],[['1','row1(all 40 cols) row2(all 40 cols) …'],['2','row81(…) row82(…) …']],{0:'bad',1:'bad'})], g:[G('Row store',['layout','all columns of a row together (4.1)'],['this query reads','all 40 columns of every row','bad'],['wasted I/O','37/40 ≈ 92%','bad'],['great for','OLTP: fetch/update whole rows','ok'])],
 say:`In a <b>row store</b> (Postgres, MySQL), each page holds complete rows. To read three columns you must read pages containing all forty, so over 90% of the I/O is wasted. That's perfect for "load order 104", terrible for scanning a billion rows.`},
{hl:{q:[7,8,9,10]}, tb:[TB('column store files',['column','stored values'],[['sale_date','2024-01-01 ×812, 2024-01-02 ×790, …'],['category','dict{0:books,1:furniture,…} + runs'],['revenue','15, 30, 120, 900, … (packed)']],{0:'ok',1:'ok',2:'ok'})], g:[G('Column store',['layout','each column stored separately','hot'],['read','only the 3 needed columns','ok'],['compression','similar values together: dictionary, run-length, delta (5–10×)','ok'],['zone maps','min/max per block → skip blocks outside the date range','ok'])],
 say:`A <b>column store</b> stores each column separately. The query reads just 3 columns. Values of one column are similar, so they compress extremely well (dictionary encoding for categories, run-length encoding for repeated dates, delta encoding for numbers), often 5–10×. Per-block <b>min/max (zone maps)</b> let the engine skip blocks that can't match the WHERE, like BRIN (4.6).`},
{hl:{q:[10]}, g:[G('Execution',['vectorised','process batches of values with SIMD (5.1)','ok'],['late materialisation','stitch rows only for the final result'],['MPP','split scans across many nodes'],['cost','single-row updates/deletes are expensive','bad'],['loads','batch/append, not row-by-row'])],
 say:`Column engines run <b>vectorised</b>: tight loops over arrays of one column's values, using CPU caches and SIMD, often across many machines (MPP). The trade-off: updating a single row means touching many column files, so column stores prefer batch inserts and are poor at OLTP-style point updates.`},
{hl:{}, g:[G('Warehouses & engines',['BigQuery, Snowflake, Redshift','managed MPP warehouses, separate storage & compute'],['ClickHouse, DuckDB','fast columnar engines (server / embedded)'],['Parquet / ORC','columnar file formats in data lakes'],['pipeline','OLTP → CDC/ETL → warehouse → BI (3.6)'])],
 say:`Modern <b>data warehouses</b> (BigQuery, Snowflake, Redshift) are columnar, massively parallel, and separate cheap storage from elastic compute. ClickHouse and DuckDB bring the same techniques to servers and laptops; Parquet and ORC are columnar <i>file formats</i> for data lakes. Data flows from OLTP databases via CDC/ETL into star schemas (3.6).`},
{hl:{q:[12,13,14]}, tb:[TB('retention / downsampling',['tier','resolution','kept for'],[['raw','1 s','7 days'],['rollup','1 min avg/min/max','90 days'],['rollup','1 h','forever']])], g:[G('Time-series databases',['data','append-only (time, series, value)'],['partition','by time (chunks), drop old chunks'],['compression','delta-of-delta timestamps, XOR floats (Gorilla)','ok'],['features','downsampling, retention, gap filling, time_bucket()'])],
 say:`<b>Time-series databases</b> (TimescaleDB, InfluxDB, Prometheus, ClickHouse) specialise in append-mostly measurements: they partition by time, compress timestamps and values aggressively, and automate <b>retention and downsampling</b>: keep raw data for a week, minute rollups for months, hourly summaries forever.`},
{hl:{}, g:[G('Pick',['transactions, point reads/writes','row store (OLTP)','ok'],['big scans, aggregates','column store / warehouse','ok'],['metrics, IoT, events by time','time-series DB','ok'],['HTAP','both in one (TiDB, SingleStore, AlloyDB columnar engine)'])],
 say:`<b>Say it:</b> "Row stores keep whole rows together, ideal for OLTP point reads and updates. Column stores keep each column separately, so analytical scans read only needed columns, compress them 5–10×, skip blocks with zone maps and run vectorised, which is why warehouses like BigQuery, Snowflake and ClickHouse are columnar, at the cost of slow single-row updates. Time-series databases add time partitioning, compression and retention/downsampling for metrics and events."`}
],
keep:[`OLAP: scan many rows, few columns, aggregate. OLTP: few rows, all columns, by key.`,`Row store reads all columns; column store reads only needed columns.`,`Columnar → compression (dictionary, RLE, delta), zone maps, vectorised execution.`,`Column stores are bad at single-row updates; load in batches.`,`Time-series DBs: time partitioning, compression, retention + downsampling.`]}, {
  imp: 'good',
  theory: TH(`Column-oriented storage keeps each column's values together so analytical queries read only the columns they need, compress them well and process them in fast batches; warehouses and time-series databases are built on it.`,
`<p>A spreadsheet can be stored row by row (like reading each line across) or column by column (reading each column down). If you want the total of one column over a million rows, reading down that single column is far faster than reading every row across all its columns.</p>
<p>Columns also compress beautifully because neighbouring values are similar (the same category repeated, dates in order), so less data moves from disk and the CPU can crunch values in tight loops.</p>`,
[[`Row store`,`All columns of a row stored together.`],[`Column store`,`Each column stored separately.`],[`Dictionary encoding`,`Replace values by small integer codes.`],[`Run-length encoding`,`Store (value, count) runs.`],[`Zone map`,`Min/max per block for skipping.`],[`Vectorised execution`,`Operating on batches of column values.`],[`MPP`,`Massively parallel processing across nodes.`],[`Downsampling`,`Aggregating old time-series data to coarser resolution.`]],
[`Load data in batches; each column is written to its own compressed segments.`,`A query reads only referenced columns.`,`Blocks outside predicates are skipped via zone maps.`,`Vectorised operators aggregate; rows are reassembled only for the output.`],
[`BI dashboards on BigQuery/Snowflake/Redshift; dbt models.`,`ClickHouse for event analytics, logs, product analytics.`,`TimescaleDB/Prometheus for metrics; retention policies.`],
[`Running dashboards on the OLTP primary.`,`Row-by-row inserts into a columnar warehouse.`,`SELECT * in warehouses (reads every column, costs money).`,`Keeping raw high-resolution metrics forever.`]),
  examples: [
    {lv:'basic', title:'An analytics query: few columns, many rows', sql:`SELECT p.category, SUM(oi.qty * oi.unit_price) AS revenue
FROM order_items oi JOIN products p ON p.id = oi.product_id
GROUP BY p.category
ORDER BY revenue DESC;`, why:`Uses 4 columns out of everything in these tables: the shape column stores are built for.`},
    {lv:'mid', title:'Run-length encoding of a sorted column', sql:`WITH col AS (SELECT status FROM orders ORDER BY status)
SELECT status AS value, COUNT(*) AS run_length FROM col GROUP BY status;`, why:`10 values compress to 4 (value, run) pairs once the column is sorted: why column stores sort data and why low-cardinality columns are nearly free.`},
    {lv:'adv', title:'Time-series rollup (downsampling)', sql:`CREATE TABLE metrics (ts TEXT, host TEXT, cpu REAL);
WITH RECURSIVE t(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM t WHERE n < 179)
INSERT INTO metrics
SELECT time('10:00:00', '+' || (n * 20) || ' seconds'), 'web1', 40 + (n % 7) * 5 FROM t;
SELECT substr(ts, 1, 5) AS minute, COUNT(*) AS raw_points,
       ROUND(AVG(cpu), 1) AS avg_cpu, MAX(cpu) AS max_cpu
FROM metrics GROUP BY minute ORDER BY minute LIMIT 5;`, why:`180 raw points (one per 20 s) become one row per minute with avg/max: the rollup you keep long after deleting raw data.`},
  ],
  tips: {
    say:`"Row stores suit OLTP: fetch or update whole rows by key. Column stores suit analytics: queries read only the needed columns, which compress 5–10× with dictionary, run-length and delta encoding, skip blocks via zone maps and run vectorised, so warehouses like BigQuery, Snowflake and ClickHouse are columnar, but single-row updates are expensive. For metrics I'd use a time-series database with time partitioning, compression, retention and downsampling."`,
    points:[`Explain the I/O difference with numbers (3 of 40 columns).`,`Name compression techniques and zone maps.`,`Mention the OLTP → warehouse pipeline (CDC/ETL).`],
    traps:[`Proposing a column store for an OLTP workload.`,`SELECT * in a warehouse.`],
    qa:[[`Why do column stores compress better?`,`Values in one column share type and often repeat or change slowly, so dictionary, RLE and delta encodings shrink them; rows mix types and don't compress as well.`],
        [`Why are updates slow in column stores?`,`A row is spread across many column files/segments; changing it means rewriting or tombstoning in each, so engines favour batch appends and background merges.`],
        [`How do you keep a warehouse up to date?`,`Batch ETL/ELT (hourly/daily) or streaming CDC into the warehouse (Debezium/Kafka/Fivetran), with modeling in dbt.`]]
  },
  exercises: [
    {lv:'E', q:`Revenue per month (non-cancelled): <code>month, revenue</code>.`, hint:`substr(order_date, 1, 7) grouping.`,
     sql:`SELECT substr(o.order_date, 1, 7) AS month, SUM(oi.qty * oi.unit_price) AS revenue
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY month;`},
    {lv:'M', q:`Compute the "dictionary" for products.category as a column store would: <code>code, category</code> with codes 0, 1, 2 in alphabetical order.`, hint:`DENSE_RANK() OVER (ORDER BY category) - 1 on DISTINCT categories.`,
     sql:`SELECT DENSE_RANK() OVER (ORDER BY category) - 1 AS code, category
FROM (SELECT DISTINCT category FROM products);`},
    {lv:'H', q:`Your product analytics runs on the Postgres primary and slows checkout every morning when dashboards refresh. Propose an architecture and explain why it helps.`, hint:`Separate workloads; columnar; CDC.`,
     answer:`<ul><li>Stream changes from Postgres via CDC (Debezium/Kafka or a managed connector) into a columnar warehouse/engine (ClickHouse, BigQuery, Snowflake) modeled as a star schema.</li><li>Dashboards query the warehouse: columnar scans + compression make them fast, and the OLTP primary no longer competes with them for CPU, I/O and buffer cache.</li><li>For near-real-time needs, use materialized rollups/incremental models; for small setups, a read replica + materialized views is an interim step.</li></ul>`},
  ],
  quiz: [
    [`Column stores are best for…`,[`Single-row lookups by key`,`Scanning a few columns over many rows (analytics)`,`High-rate single-row updates`,`Foreign key checks`],1,`OLAP.`,'E'],
    [`Why do column stores compress well?`,[`They use ZIP on rows`,`Values within a column are similar, enabling dictionary/RLE/delta encoding`,`They drop data`,`They store less precision`],1,`Homogeneous data.`,'E'],
    [`A zone map lets the engine…`,[`Join faster`,`Skip blocks whose min/max can't match the filter`,`Update rows`,`Encrypt blocks`],1,`Like BRIN.`,'M'],
    [`Which is NOT typically columnar?`,[`BigQuery`,`ClickHouse`,`Snowflake`,`MySQL InnoDB`],3,`InnoDB is a row store.`,'E'],
    [`Downsampling in time-series DBs means…`,[`Deleting all old data`,`Aggregating old data into coarser time buckets`,`Sampling random rows`,`Compressing indexes`],1,`Keep summaries longer.`,'M'],
    [`A column store's weakness?`,[`Large scans`,`Frequent single-row updates/deletes`,`Compression`,`Aggregations`],1,`Batch loads preferred.`,'M'],
  ],
  quizAdv: [
    [`Late materialisation means…`,[`Loading data late at night`,`Operating on column vectors and reassembling full rows only for final output`,`Lazy index creation`,`Delayed replication`],1,`Saves work on filtered-out rows.`,'H'],
    [`Gorilla compression (Facebook) targets…`,[`Text`,`Time-series timestamps (delta-of-delta) and float values (XOR)`,`Images`,`JSON`],1,`Used by Prometheus-like systems.`,'H'],
    [`Separation of storage and compute (Snowflake/BigQuery) allows…`,[`Lower durability`,`Scaling query compute independently of stored data, paying per use`,`Single-node only`,`OLTP transactions`],1,`Elastic warehouses.`,'H'],
  ],
});
