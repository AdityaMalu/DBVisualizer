/* 3.6 Denormalization, OLTP vs OLAP, star schema */
topic('3', { no:'3.6', title:'Denormalization, OLTP vs OLAP, star and snowflake schemas', db:'shop',
idea:`Normalized schemas make writes safe; analytics wants fast scans over few joins. See a deliberate denormalization (a stored order total), its consistency cost, and how a warehouse reshapes the shop into a star schema: one fact table surrounded by dimensions.`,
dgTitle:'Star schema', stateTitle:'Trade-off', tbTitle:'Tables',
nodes:{
  fact:{x:240,y:130,label:'fact_sales\nqty, revenue',w:150,h:52,kind:'lock'},
  dd:{x:240,y:30,label:'dim_date',w:110},
  dc:{x:430,y:130,label:'dim_customer',w:130},
  dp:{x:50,y:130,label:'dim_product',w:120},
  ds:{x:240,y:230,label:'dim_store',w:110},
  dcat:{x:50,y:230,label:'dim_category',w:120}
},
edges:[['fact','dd'],['fact','dc'],['fact','dp'],['fact','ds']],
vb:'0 0 500 260',
codes:{a:`-- OLTP (3NF): orders → order_items → products → …
-- Denormalized column for a hot read path:
ALTER TABLE orders ADD COLUMN total NUMERIC;   -- copy of SUM(order_items)
-- must be kept in sync: same transaction / trigger / recompute job

-- OLAP star schema (data warehouse)
CREATE TABLE fact_sales (
  date_key INT, customer_key INT, product_key INT, store_key INT,
  qty INT, revenue NUMERIC                         -- measures
);
CREATE TABLE dim_product (product_key INT PRIMARY KEY,
  name TEXT, category TEXT, brand TEXT);           -- denormalized dimension

SELECT d.month, p.category, SUM(f.revenue)
FROM fact_sales f
JOIN dim_date d    ON d.date_key = f.date_key
JOIN dim_product p ON p.product_key = f.product_key
GROUP BY d.month, p.category;`},
steps:[
{hl:{q:[1]}, d:null, g:[G('OLTP (transactional)',['workload','many small reads/writes by key','hot'],['examples','place order, update profile'],['schema','normalized (3NF)','ok'],['optimise for','correctness of writes, low latency'])],
 say:`<b>OLTP</b> (online transaction processing) is your app's database: thousands of small, concurrent reads and writes touching a few rows by key. Normalization (3.4) is ideal here: each write touches one place and anomalies are impossible.`},
{hl:{q:[2,3,4]}, tb:[TB('orders (denormalized total)',['id','customer_id','status','total'],[[101,1,'delivered',1120],[102,2,'delivered',645],[103,1,'shipped',550]],{0:'hot',1:'hot',2:'hot'})], g:[G('Denormalization',['what','store a derived/copied value','hot'],['why','skip a join or aggregate on a hot path','ok'],['cost','must stay in sync with order_items','bad'],['sync options','same transaction, trigger, async job, CDC'])],
 say:`<b>Denormalization</b> deliberately stores redundant data to speed up reads: here, the order total, so the order list page doesn't sum order_items for every row. You now own the job of keeping it correct: update it in the same transaction as the items, with a trigger, or recompute asynchronously and accept brief staleness.`},
{hl:{}, g:[G('OLAP (analytical)',['workload','few huge queries scanning millions of rows','hot'],['examples','revenue by month by category'],['schema','denormalized star/snowflake','ok'],['storage','columnar (9.7)'],['data','loaded by ETL/ELT, mostly append-only'])],
 say:`<b>OLAP</b> (online analytical processing) is the opposite workload: analysts asking "revenue by month by category for 3 years". Queries scan and aggregate huge numbers of rows; writes are bulk loads. Running these on the OLTP database slows the app, so data is copied into a <b>data warehouse</b> with a schema designed for reading.`},
{hl:{q:[6,7,8,9,10]}, d:{on:['fact'], hide:['dcat']}, g:[G('Fact table',['one row per event','a sale line, a click, a payment','hot'],['foreign keys','to each dimension'],['measures','numbers to aggregate: qty, revenue'],['size','huge (billions of rows)'])],
 say:`A <b>star schema</b> has a central <b>fact table</b>: one row per business event (a sale line) with foreign keys to dimensions and numeric <b>measures</b> to aggregate. It's long and narrow, and the grain ("one row per order line per day") must be stated precisely.`},
{hl:{q:[11,12]}, d:{hide:['dcat'], on:['dd','dc','dp','ds'], e:[['fact','dd','','hot'],['fact','dc','','hot'],['fact','dp','','hot'],['fact','ds','','hot']]}, g:[G('Dimensions',['describe the context','who, what, when, where'],['denormalized','category and brand inline on dim_product','hot'],['dim_date','year, quarter, month, weekday, holiday…'],['slowly changing (SCD)','keep history of changes (type 2)'])],
 say:`Around it sit <b>dimension tables</b>: who (customer), what (product), when (date), where (store). Dimensions are deliberately <b>denormalized</b>: category and brand sit right on dim_product, so a report needs one join per dimension, never a chain. A date dimension precomputes month, quarter, weekday and holidays.`},
{hl:{q:[14,15,16,17,18]}, d:{hide:['dcat'], on:['fact','dd','dp'], e:[['fact','dd','','ok'],['fact','dp','','ok']]}, g:[G('Star query',['joins','fact → each needed dimension (one hop)','ok'],['filter + group','on dimension attributes'],['aggregate','measures from the fact'])],
 say:`A typical star query: join the fact to the dimensions you need, filter and group by dimension attributes, aggregate the measures. Every join is one hop from the fact, which optimizers and columnar engines handle extremely well.`},
{hl:{}, d:{on:['dcat'], e:[['dp','dcat','normalized','hot']]}, g:[G('Snowflake schema',['dimensions normalized','dim_product → dim_category'],['saves','a little storage'],['costs','more joins, slower and harder queries','bad'],['usual advice','prefer star','ok'])],
 say:`<b>Say it:</b> "OLTP serves many small transactions and is normalized for write correctness; OLAP serves large analytical scans and uses denormalized star schemas: a fact table of events with measures, joined one hop to dimension tables. A snowflake schema normalizes the dimensions, saving space at the cost of more joins. In OLTP I denormalize only specific hot reads, with a clear plan to keep the copy in sync."`}
],
keep:[`OLTP: small concurrent transactions, normalized. OLAP: big scans/aggregates, star schema, columnar.`,`Denormalization = deliberate redundancy for reads; you must keep copies in sync.`,`Star: fact table (events + measures + FKs) + denormalized dimensions (who/what/when/where).`,`Snowflake = normalized dimensions: more joins. State the fact table's grain.`]}, {
  imp: 'good',
  theory: TH(`Transactional systems normalize to keep writes correct; analytical systems denormalize into star schemas so huge read queries need few joins.`,
`<p>A shop's checkout and its yearly sales report want opposite things. Checkout writes one order at a time and must never corrupt data: normalized tables. The report reads every order from three years: it wants data pre-joined, in as few tables as possible.</p>
<p>A <b>star schema</b> looks like a star: a big table of events in the middle (sales) and small descriptive tables around it (date, customer, product, store). Every question becomes "join the middle to a few points of the star, group, sum".</p>`,
[[`OLTP`,`Online transaction processing: the app's operational DB.`],[`OLAP`,`Online analytical processing: reporting and analytics.`],[`Denormalization`,`Intentional redundancy to speed up reads.`],[`Fact table`,`Events with measures and dimension keys.`],[`Dimension table`,`Descriptive context (who/what/when/where).`],[`Grain`,`What one fact row represents.`],[`Snowflake schema`,`Star with normalized dimensions.`],[`SCD type 2`,`Slowly changing dimension: new row per change with validity dates.`]],
[`Keep the OLTP database normalized.`,`Copy data to a warehouse via ETL/ELT or CDC.`,`Model facts at a clear grain and dimensions around them.`,`Analysts query the warehouse; dashboards don't touch production.`],
[`Warehouses: Snowflake, BigQuery, Redshift, ClickHouse with dbt models.`,`Denormalized counters and totals in OLTP for list pages.`,`Read models in CQRS: a separate denormalized view per screen.`],
[`Running heavy analytics on the production primary.`,`Denormalizing without a sync strategy (silent drift).`,`Fact tables with mixed grain (order rows and line rows together).`,`Overwriting dimension attributes when history matters (use SCD2).`]),
  examples: [
    {lv:'basic', title:'The normalized read the denormalized column replaces', sql:`SELECT o.id, o.status, SUM(oi.qty * oi.unit_price) AS total
FROM orders o JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.status
ORDER BY o.id;`, why:`Every order list page would run this aggregate. Storing <code>orders.total</code> avoids it.`},
    {lv:'mid', title:'Add a denormalized total and keep it in sync', sql:`ALTER TABLE orders ADD COLUMN total REAL;
UPDATE orders SET total = (SELECT SUM(qty * unit_price) FROM order_items oi WHERE oi.order_id = orders.id);

CREATE TRIGGER trg_total AFTER INSERT ON order_items FOR EACH ROW BEGIN
  UPDATE orders SET total = COALESCE(total, 0) + NEW.qty * NEW.unit_price WHERE id = NEW.order_id;
END;
INSERT INTO order_items VALUES (101, 6, 1, 40);
SELECT id, total FROM orders WHERE id IN (101, 102);`, why:`Backfill once, then a trigger keeps the copy correct on insert (a full solution also handles UPDATE and DELETE of items).`},
    {lv:'adv', title:'Build a tiny star schema and query it', sql:`CREATE TABLE dim_product AS SELECT id AS product_key, name, category FROM products;
CREATE TABLE dim_date AS
  SELECT DISTINCT order_date AS date_key, substr(order_date,1,7) AS month, substr(order_date,1,4) AS year FROM orders;
CREATE TABLE fact_sales AS
  SELECT o.order_date AS date_key, o.customer_id AS customer_key, oi.product_id AS product_key,
         oi.qty, oi.qty * oi.unit_price AS revenue
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status <> 'cancelled';

SELECT d.month, p.category, SUM(f.revenue) AS revenue
FROM fact_sales f
JOIN dim_date d    ON d.date_key = f.date_key
JOIN dim_product p ON p.product_key = f.product_key
GROUP BY d.month, p.category
ORDER BY d.month, revenue DESC;`, why:`Grain: one fact row per order line. Each dimension is one hop away.`},
  ],
  tips: {
    say:`"OLTP is normalized for safe, concurrent small writes; OLAP is denormalized for large scans, typically a star schema with a fact table at a clear grain and one-hop dimensions, stored in a columnar warehouse fed by ETL or CDC. Inside OLTP I denormalize only specific hot reads and always define how the copy stays in sync."`,
    points:[`Contrast workloads first (query shape, concurrency, data volume), then schemas.`,`State a grain when designing a fact table.`,`Name sync strategies for denormalized data.`],
    traps:[`"Denormalization is bad design" (it's a trade-off).`,`Putting analytics on the OLTP primary.`],
    qa:[[`When would you denormalize in an OLTP system?`,`A hot read needs data from several tables or an aggregate (order totals, comment counts) and the write path can keep the copy in sync cheaply; or for a read model/cache.`],
        [`Star vs snowflake?`,`Star: denormalized dimensions, fewer joins, simpler and usually faster. Snowflake: normalized dimensions, less redundancy, more joins.`],
        [`What's an SCD type 2?`,`A dimension that keeps history: a change inserts a new row with valid_from/valid_to and a current flag, so old facts keep pointing at the old attributes.`]]
  },
  exercises: [
    {lv:'E', q:`Compute what a denormalized <code>customers.lifetime_value</code> column would hold: <code>customer_id, ltv</code> over non-cancelled orders.`, hint:`Join orders and items, SUM per customer.`,
     sql:`SELECT o.customer_id, SUM(oi.qty * oi.unit_price) AS ltv
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY o.customer_id;`},
    {lv:'M', q:`Design a star schema for a ride-hailing company's trips (fare, distance, duration, rating). State the grain, the fact table and at least four dimensions.`, hint:`Who, what, when, where.`,
     answer:`<p>Grain: one row per completed trip. fact_trips(trip_id, date_key, time_key, rider_key, driver_key, pickup_zone_key, dropoff_zone_key, vehicle_type_key, fare, distance_km, duration_min, rating). Dimensions: dim_date, dim_time (hour, peak flag), dim_rider, dim_driver (SCD2 for rating tier/city changes), dim_zone (city, area), dim_vehicle_type.</p>`},
    {lv:'H', q:`Using the shop data as a star (fact = order lines of non-cancelled orders), revenue per customer city per category: <code>city, category, revenue</code>, ignoring customers without a city.`, hint:`orders + order_items as the fact, customers and products as dimensions.`,
     sql:`SELECT c.city, p.category, SUM(oi.qty * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o    ON o.id = oi.order_id AND o.status <> 'cancelled'
JOIN customers c ON c.id = o.customer_id
JOIN products p  ON p.id = oi.product_id
WHERE c.city IS NOT NULL
GROUP BY c.city, p.category;`},
  ],
  quiz: [
    [`OLTP workloads are mostly…`,[`Few huge scans`,`Many small reads and writes by key`,`Batch loads`,`Graph traversals`],1,`Transactional.`,'E'],
    [`A star schema's central table is the…`,[`Dimension table`,`Fact table`,`Junction table`,`Lookup table`],1,`Events and measures.`,'E'],
    [`Measures are…`,[`Descriptive text attributes`,`Numeric values you aggregate (qty, revenue)`,`Primary keys`,`Indexes`],1,`Live in the fact table.`,'E'],
    [`Main risk of denormalization?`,[`Slower reads`,`Copies getting out of sync`,`Too few joins`,`No indexes`],1,`You must maintain consistency.`,'E'],
    [`Snowflake vs star?`,[`Snowflake normalizes dimensions (more joins)`,`Snowflake has no fact table`,`Star normalizes dimensions`,`They're identical`],0,`Star is usually preferred.`,'M'],
    [`"One row per order line per day" is a statement of…`,[`Cardinality`,`Grain`,`Isolation`,`Selectivity`],1,`Define it first.`,'M'],
  ],
  quizAdv: [
    [`SCD type 2 handles a customer moving city by…`,[`Overwriting the city`,`Adding a new dimension row with validity dates; old facts keep the old key`,`Deleting old facts`,`Adding a column per city`],1,`History preserved.`,'H'],
    [`Why are star schemas paired with columnar storage?`,[`Columnar is required for joins`,`Analytic queries read few columns of many rows; columnar reads only those columns and compresses well`,`Row stores can't aggregate`,`Columnar is faster for single-row lookups`],1,`See 9.7.`,'H'],
    [`A degenerate dimension is…`,[`A dimension with no rows`,`A dimension key kept in the fact table with no dimension table (e.g. order number)`,`A corrupted dimension`,`A snowflaked dimension`],1,`Useful for grouping lines of the same order.`,'H'],
  ],
});
