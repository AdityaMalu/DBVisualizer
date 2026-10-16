/* 1.5 GROUP BY, aggregates, HAVING */
topic('1', { no:'1.5', title:'GROUP BY, aggregates and HAVING', db:'shop',
idea:`Watch rows fall into buckets, each bucket collapse into one row, and aggregates compute per bucket. Then see the "column must appear in GROUP BY" error, COUNT(DISTINCT), grouping by two columns and filtering groups with HAVING.`,
tbTitle:'Rows and groups', stateTitle:'Aggregates',
codes:{a:`SELECT category,
       COUNT(*)        AS products,
       MIN(price)      AS cheapest,
       MAX(price)      AS priciest,
       AVG(price)      AS avg_price,
       SUM(price)      AS total
FROM products
GROUP BY category
HAVING COUNT(*) >= 3;

SELECT category, name, MAX(price)    -- ✗ which name?
FROM products GROUP BY category;`},
steps:[
{hl:{q:[7]}, tb:[TB('products',['name','category','price'],[['Laptop','electronics',900],['Phone','electronics',600],['Headphones','electronics',120],['Desk','furniture',250],['Chair','furniture',150],['Lamp','furniture',40],['Novel','books',15],['Cookbook','books',30]])],
 say:`An <b>aggregate</b> turns many values into one: COUNT, SUM, AVG, MIN, MAX. Without GROUP BY, the whole table is one group (e.g. <code>SELECT COUNT(*) FROM products</code> → 8). GROUP BY splits rows into many groups first.`},
{hl:{q:[8]}, tb:[TB('group electronics',['name','price'],[['Laptop',900],['Phone',600],['Headphones',120]]), TB('group furniture',['name','price'],[['Desk',250],['Chair',150],['Lamp',40]]), TB('group books',['name','price'],[['Novel',15],['Cookbook',30]])], g:[G('GROUP BY category',['groups','3'],['one output row per','distinct category value','hot'])],
 say:`<b>GROUP BY category</b> sorts the rows into buckets, one per distinct category. Each bucket will become exactly one output row. (The engine may use sorting or a hash table to do this.)`},
{hl:{q:[1,2,3,4,5,6]}, tb:[TB('one row per group',['category','products','cheapest','priciest','avg_price','total'],[['electronics',3,120,900,540,1620],['furniture',3,40,250,146.67,440],['books',2,15,30,22.5,45]],{0:'new',1:'new',2:'new'})], g:[G('Per group',['COUNT(*)','rows in the bucket'],['MIN / MAX','smallest / largest'],['AVG','SUM ÷ COUNT of non-NULLs'],['SUM','total'])],
 say:`Each aggregate is computed per bucket. The output has one row per group with the group key (<code>category</code>) and the aggregate values. Remember from 0.3: aggregates skip NULLs, and COUNT(col) differs from COUNT(*) when NULLs exist.`},
{hl:{q:[9]}, tb:[TB('HAVING COUNT(*) >= 3',['category','products','total'],[['electronics',3,1620],['furniture',3,440],['books',2,45]],{2:'dim'})], log:['HAVING removes books (2 products)'],
 say:`<b>HAVING</b> filters groups using aggregates. Books has only 2 products and is dropped. WHERE couldn't do this: it runs before groups exist (1.2).`},
{hl:{q:[11,12]}, tb:[TB('furniture group',['name','price'],[['Desk',250],['Chair',150],['Lamp',40]],{0:'hot',1:'hot',2:'hot'})], g:[G('Error',['name','not grouped, not aggregated','bad'],['which name?','Desk? Chair? Lamp?','bad'],['Postgres / SQL Server','error','ok'],['MySQL (old modes) / SQLite','picks one silently','bad'])],
 say:`The famous error: "column <code>name</code> must appear in the GROUP BY clause or be used in an aggregate". A group has three names; which one should the row show? Strict databases refuse. MySQL with ONLY_FULL_GROUP_BY off and SQLite return <i>some</i> value, which looks right in testing and is wrong in production. To get "the product with the max price per category", use a window function (2.2) or a join.`},
{hl:{}, tb:[], g:[G('More aggregates',['COUNT(DISTINCT x)','distinct non-NULL values'],['string_agg / GROUP_CONCAT','join strings in a group'],['GROUP BY a, b','one group per (a, b) combination'],['ROLLUP / CUBE','subtotals and grand totals (Postgres, MySQL, SQL Server)'])],
 say:`<b>Say it:</b> "GROUP BY partitions rows into groups and returns one row per group; the SELECT list may contain only grouping columns and aggregates. WHERE filters rows before grouping, HAVING filters groups after. COUNT(*) counts rows, COUNT(col) counts non-NULLs, COUNT(DISTINCT col) counts distinct values."`}
],
keep:[`One output row per group. SELECT only group keys + aggregates.`,`WHERE before grouping, HAVING after.`,`COUNT(*) vs COUNT(col) vs COUNT(DISTINCT col).`,`"Row with the max per group" isn't a GROUP BY job: use a window function or a join.`]}, {
  imp: 'must',
  theory: TH(`GROUP BY splits rows into groups that share the same values, and aggregate functions summarise each group into a single row.`,
`<p>Questions like "how many orders per city?" or "average price per category?" need you to bucket rows and summarise each bucket. That's GROUP BY plus aggregates.</p>
<p>Picture sorting receipts into envelopes by month, then writing the total on each envelope. You can write the month (the group key) and totals, counts or averages on the envelope, but not "the item name": there are many receipts inside.</p>`,
[[`Aggregate`,`COUNT, SUM, AVG, MIN, MAX and friends.`],[`Group key`,`The column(s) listed in GROUP BY.`],[`HAVING`,`Filter on groups, can use aggregates.`],[`COUNT(DISTINCT x)`,`Number of distinct non-NULL x values.`],[`ROLLUP`,`Adds subtotal and grand-total rows.`]],
[`Rows pass WHERE.`,`They're bucketed by the GROUP BY key (hash or sort).`,`Aggregates are computed per bucket.`,`HAVING removes buckets; SELECT outputs one row per bucket.`],
[`Dashboards: revenue per day, signups per country, errors per service.`,`Data quality: GROUP BY key HAVING COUNT(*) &gt; 1 to find duplicates.`,`Pre-aggregated summary tables for fast reports.`],
[`Selecting a non-grouped column (error or silently random value).`,`Using HAVING for row filters.`,`AVG on integer columns in databases that do integer division (cast first).`,`Double counting after a one-to-many join (aggregate first, then join).`]),
  examples: [
    {lv:'basic', title:'Orders per status', sql:`SELECT status, COUNT(*) AS n
FROM orders
GROUP BY status
ORDER BY n DESC;`, why:`One row per distinct status.`},
    {lv:'mid', title:'Revenue per category, delivered orders only', sql:`SELECT p.category,
       SUM(oi.qty * oi.unit_price) AS revenue,
       COUNT(DISTINCT o.id)       AS orders
FROM order_items oi
JOIN orders o   ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'delivered'
GROUP BY p.category
ORDER BY revenue DESC;`, why:`COUNT(DISTINCT o.id) counts orders, not lines: an order with two electronics lines counts once for electronics.`},
    {lv:'adv', title:'Monthly revenue with a grand total (ROLLUP by hand)', sql:`SELECT substr(o.order_date, 1, 7) AS month,
       SUM(oi.qty * oi.unit_price)   AS revenue
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY month
UNION ALL
SELECT 'TOTAL', SUM(oi.qty * oi.unit_price)
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
ORDER BY month;`, why:`SQLite has no ROLLUP, so the total is a second query glued on with UNION ALL. In Postgres/MySQL: <code>GROUP BY ROLLUP(month)</code>. Grouping by an expression (the year-month prefix) is common for time series.`},
  ],
  tips: {
    say:`"GROUP BY buckets rows by a key and returns one row per bucket, so the SELECT may only contain keys and aggregates. WHERE filters rows before grouping and HAVING filters groups after. I use COUNT(DISTINCT) after joins to avoid double counting."`,
    points:[`Explain the "must appear in GROUP BY" error in terms of "which value would you pick?".`,`Know the duplicate-finder pattern: GROUP BY … HAVING COUNT(*) &gt; 1.`,`Mention that MySQL's lenient mode is a bug factory.`],
    traps:[`Answering "max per group with its name" with GROUP BY name.`,`Using COUNT(*) where NULLs should be excluded.`],
    qa:[[`Find duplicate emails.`,`<code>SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) &gt; 1;</code> (consider lower(email)).`],
        [`Can you GROUP BY a column you don't SELECT?`,`Yes. The reverse (selecting an ungrouped column) is the error.`],
        [`What's the difference between COUNT(1) and COUNT(*)?`,`None in practice; both count rows. COUNT(col) is different (skips NULLs).`]]
  },
  exercises: [
    {lv:'E', q:`How many customers per city (ignore unknown city)? <code>city, customers</code>.`, hint:`WHERE city IS NOT NULL, GROUP BY city.`,
     sql:`SELECT city, COUNT(*) AS customers FROM customers WHERE city IS NOT NULL GROUP BY city;`},
    {lv:'M', q:`For each customer who ordered, total quantity of items bought across non-cancelled orders. <code>customer_id, items</code>.`, hint:`Join orders and order_items, filter status, SUM(qty).`,
     sql:`SELECT o.customer_id, SUM(oi.qty) AS items
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY o.customer_id;`},
    {lv:'M', q:`Product categories where the average order-line unit price is above 100. Return <code>category, avg_unit_price</code>.`, hint:`Join order_items to products; HAVING AVG(...) &gt; 100.`,
     sql:`SELECT p.category, AVG(oi.unit_price) AS avg_unit_price
FROM order_items oi JOIN products p ON p.id = oi.product_id
GROUP BY p.category
HAVING AVG(oi.unit_price) > 100;`},
    {lv:'H', q:`Customers who bought from <b>at least two different categories</b> (any status except cancelled). Return <code>name, categories</code>.`, hint:`COUNT(DISTINCT p.category) per customer, HAVING &gt;= 2.`,
     sql:`SELECT c.name, COUNT(DISTINCT p.category) AS categories
FROM customers c
JOIN orders o       ON o.customer_id = c.id AND o.status <> 'cancelled'
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
GROUP BY c.id, c.name
HAVING COUNT(DISTINCT p.category) >= 2;`},
  ],
  quiz: [
    [`How many rows does <code>SELECT category, COUNT(*) FROM products GROUP BY category</code> return?`,[`One per product`,`One per distinct category`,`One`,`Depends on COUNT`],1,`One row per group.`,'E'],
    [`Which can appear in SELECT with GROUP BY category?`,[`name`,`category and aggregates`,`Any column`,`Only aggregates`],1,`Group keys and aggregates.`,'E'],
    [`Find categories with more than 2 products: the condition goes in…`,[`WHERE COUNT(*) > 2`,`HAVING COUNT(*) > 2`,`GROUP BY COUNT(*) > 2`,`ORDER BY`],1,`Group filter.`,'E'],
    [`COUNT(DISTINCT customer_id) on orders gives…`,[`Number of orders`,`Number of customers who ordered`,`Number of NULLs`,`Always 1`],1,`Distinct non-NULL ids.`,'E'],
    [`After joining orders to order_items, COUNT(*) per customer counts…`,[`Orders`,`Order lines`,`Customers`,`Products`],1,`The join is at line grain; use COUNT(DISTINCT o.id) for orders.`,'M'],
    [`AVG(x) where x has values 10, NULL, 20 returns…`,[`10`,`15`,`NULL`,`30`],1,`NULL is skipped.`,'M'],
  ],
  quizAdv: [
    [`In PostgreSQL, <code>SELECT d.id, d.name, COUNT(*) FROM departments d JOIN employees e … GROUP BY d.id</code> works if…`,[`Never`,`d.id is the primary key: name is functionally dependent on it`,`name is indexed`,`COUNT is replaced by SUM`],1,`Postgres allows columns functionally dependent on a grouped PK.`,'H'],
    [`GROUP BY ROLLUP(year, month) produces…`,[`Only (year, month) groups`,`(year, month) groups, per-year subtotals and a grand total`,`All combinations including month alone`,`A pivot table`],1,`CUBE also adds month-only subtotals.`,'H'],
    [`Hash aggregation vs sort aggregation: when is sort aggregation attractive?`,[`Never`,`When input is already sorted by the group key (e.g. from an index) or memory is tight`,`Only for COUNT(*)`,`When there are few rows`],1,`Hash aggregation needs memory for all groups.`,'H'],
  ],
});
