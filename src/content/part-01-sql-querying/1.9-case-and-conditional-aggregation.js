/* 1.9 CASE expressions and conditional aggregation */
topic('1', { no:'1.9', title:'CASE expressions, conditional aggregation and pivots', db:'shop',
idea:`CASE is SQL's if/else. Label rows into buckets, sort by a custom order, and then put CASE inside SUM/COUNT to turn rows into columns: a pivot that answers "orders per status per month" in one pass.`,
tbTitle:'Rows', stateTitle:'CASE',
codes:{a:`SELECT name, price,
       CASE
         WHEN price >= 500 THEN 'premium'
         WHEN price >= 100 THEN 'mid'
         ELSE 'budget'
       END AS tier
FROM products;

SELECT substr(order_date, 1, 7) AS month,
       COUNT(*)                                          AS total,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
FROM orders
GROUP BY month;`},
steps:[
{hl:{q:[1,2,3,4,5,6,7]}, tb:[TB('tiers',['name','price','tier'],[['Laptop',900,'premium'],['Phone',600,'premium'],['Desk',250,'mid'],['Chair',150,'mid'],['Headphones',120,'mid'],['Lamp',40,'budget'],['Cookbook',30,'budget'],['Novel',15,'budget']])], g:[G('Searched CASE',['WHEN conditions','checked top to bottom','hot'],['first TRUE wins','Laptop matches the first WHEN only'],['ELSE','default; missing ELSE → NULL'])],
 say:`A <b>CASE expression</b> returns a value based on conditions, checked <b>top to bottom; the first TRUE wins</b>. That's why the order of WHENs matters: put 'premium' (≥ 500) before 'mid' (≥ 100). Without ELSE, unmatched rows get NULL.`},
{hl:{q:[3,4]}, g:[G('Two forms',['searched','CASE WHEN price >= 500 THEN …'],['simple','CASE status WHEN \'placed\' THEN 1 WHEN … END'],['simple form','compares with =, so it can\'t match NULL','bad']), G('Anywhere a value goes',['SELECT','labels'],['ORDER BY','custom sort order','hot'],['WHERE / JOIN','conditional logic'],['UPDATE SET','conditional updates'])],
 say:`Two flavours: <b>searched</b> (any condition per WHEN) and <b>simple</b> (compare one expression to values). CASE is an expression, so it works anywhere a value does: e.g. <code>ORDER BY CASE status WHEN 'placed' THEN 1 WHEN 'shipped' THEN 2 ELSE 3 END</code> for a business order that isn't alphabetical.`},
{hl:{q:[9,10,11,12,13,14]}, tb:[TB('orders by month (raw)',['month','status'],[['2024-02','shipped'],['2024-02','delivered'],['2024-02','cancelled'],['2024-03','delivered'],['2024-03','placed'],['2024-03','delivered'],['2024-03','shipped']])], g:[G('Conditional aggregation',['CASE inside SUM','1 if the row qualifies, else 0','hot'],['one pass','all counts in a single scan','ok'])],
 say:`Now the powerful trick: <b>CASE inside an aggregate</b>. For each row, <code>CASE WHEN status = 'delivered' THEN 1 ELSE 0 END</code> is 1 or 0; SUM adds them up per group. Each SUM becomes a column, so one GROUP BY produces several counts at once.`},
{hl:{q:[9,10,11,12,13,14]}, tb:[TB('pivot',['month','total','delivered','cancelled'],[['2024-01',2,2,0],['2024-02',3,1,1],['2024-03',4,2,0],['2024-04',1,1,0]],{1:'hot'})], g:[G('Pivot',['rows → columns','status values became columns'],['Postgres','COUNT(*) FILTER (WHERE status = …)'],['also','SUM(CASE WHEN … THEN amount END) for sums'])], log:['one scan, four months, three counts each'],
 say:`Rows became columns: a <b>pivot</b>. This is how dashboards compute "total vs delivered vs cancelled" in one query instead of three. Postgres has a neater spelling, <code>COUNT(*) FILTER (WHERE status = 'delivered')</code>. For sums, put the amount in THEN and leave out ELSE (NULLs are ignored).`},
{hl:{}, tb:[], g:[G('Handy relatives',['COALESCE(a, b)','first non-NULL'],['NULLIF(a, b)','NULL if equal (safe division)'],['GREATEST / LEAST','max/min of arguments (MAX()/MIN() in SQLite)'],['IIF / IF','shorthand in SQL Server / MySQL'])],
 say:`<b>Say it:</b> "CASE is SQL's if/else, evaluated top to bottom with the first true branch winning and NULL if nothing matches and there's no ELSE. Putting CASE inside SUM or COUNT gives conditional aggregation, which pivots rows into columns in a single scan, for example counts per status per month."`}
],
keep:[`CASE: first TRUE WHEN wins; no ELSE → NULL. Order WHENs from most to least specific.`,`Simple CASE uses =, so it can't match NULL.`,`SUM(CASE WHEN cond THEN 1 ELSE 0 END) = conditional count. Pivot in one scan.`,`Postgres: COUNT(*) FILTER (WHERE …).`]}, {
  imp: 'good',
  theory: TH(`CASE returns a value chosen by conditions, and wrapping CASE inside aggregates lets one query count or sum different subsets side by side.`,
`<p>CASE is the if/else of SQL. It lets you label rows ("premium", "budget"), translate codes into words, choose a custom sort order or compute a value differently per row.</p>
<p>Conditional aggregation is like having several tally counters while walking past each row once: for every order you click the "delivered" counter or the "cancelled" counter. At the end, each counter is a column.</p>`,
[[`Searched CASE`,`CASE WHEN cond THEN v … ELSE d END.`],[`Simple CASE`,`CASE expr WHEN value THEN v … END.`],[`Conditional aggregation`,`An aggregate over a CASE expression.`],[`Pivot`,`Turning row values into columns.`],[`FILTER clause`,`Postgres/SQL standard: agg(...) FILTER (WHERE cond).`]],
[`For each row, evaluate WHEN conditions in order.`,`Return the first matching THEN, else ELSE (or NULL).`,`Inside an aggregate, the CASE result is aggregated per group.`],
[`Status dashboards, cohort tables, funnel conversion counts.`,`Bucketing values (age bands, price tiers) for reports.`,`Custom ORDER BY (priority order).`],
[`Overlapping WHENs in the wrong order.`,`Forgetting ELSE and getting NULLs.`,`Using COUNT(CASE … THEN 0 END): COUNT counts the 0s too. Use SUM, or THEN 1 without ELSE.`]),
  examples: [
    {lv:'basic', title:'Translate codes into labels', sql:`SELECT id,
       CASE status
         WHEN 'placed'    THEN 'Waiting to ship'
         WHEN 'shipped'   THEN 'On the way'
         WHEN 'delivered' THEN 'Done'
         ELSE 'Cancelled'
       END AS label
FROM orders;`, why:`Simple CASE: compares status to each value.`},
    {lv:'mid', title:'Custom sort order', sql:`SELECT id, status, order_date
FROM orders
ORDER BY CASE status WHEN 'placed' THEN 1 WHEN 'shipped' THEN 2
                     WHEN 'delivered' THEN 3 ELSE 4 END,
         order_date;`, why:`Business priority instead of alphabetical order.`},
    {lv:'adv', title:'Revenue pivot: categories as columns, per month', sql:`SELECT substr(o.order_date, 1, 7) AS month,
       SUM(CASE WHEN p.category = 'electronics' THEN oi.qty * oi.unit_price END) AS electronics,
       SUM(CASE WHEN p.category = 'furniture'   THEN oi.qty * oi.unit_price END) AS furniture,
       SUM(CASE WHEN p.category = 'books'       THEN oi.qty * oi.unit_price END) AS books,
       SUM(oi.qty * oi.unit_price) AS total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
WHERE o.status <> 'cancelled'
GROUP BY month
ORDER BY month;`, why:`No ELSE, so non-matching lines contribute NULL, which SUM ignores. A month with no books shows NULL; wrap in COALESCE(…, 0) for display.`},
  ],
  tips: {
    say:`"CASE is SQL's if/else: first true branch wins, NULL if none and no ELSE. The real power is conditional aggregation, SUM or COUNT over a CASE, which pivots rows into columns in one scan, for example status counts per month."`,
    points:[`Reach for conditional aggregation when asked for several counts in one query.`,`Know the Postgres FILTER clause.`,`Point out the COUNT(CASE … ELSE 0) bug.`],
    traps:[`Writing three separate queries (or subqueries) where one conditional aggregate works.`,`Simple CASE with WHEN NULL (never matches).`],
    qa:[[`Count delivered and cancelled orders per customer in one query.`,`<code>SELECT customer_id, SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END), SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) FROM orders GROUP BY customer_id;</code>`],
        [`How do you avoid division by zero?`,`<code>a / NULLIF(b, 0)</code> returns NULL instead of an error; or CASE WHEN b = 0 THEN NULL ELSE a / b END.`],
        [`Does SQL have a PIVOT operator?`,`SQL Server and Oracle do; Postgres has crosstab() in tablefunc. Conditional aggregation works everywhere.`]]
  },
  exercises: [
    {lv:'E', q:`Label each customer as <code>'early'</code> if they joined before 2023-06-01, otherwise <code>'recent'</code>. Return <code>name, cohort</code>.`, hint:`CASE WHEN joined &lt; '2023-06-01' THEN … ELSE … END.`,
     sql:`SELECT name, CASE WHEN joined < '2023-06-01' THEN 'early' ELSE 'recent' END AS cohort
FROM customers;`},
    {lv:'M', q:`Per customer who ordered: <code>customer_id, delivered, open</code>, where open counts placed + shipped orders.`, hint:`Two SUM(CASE …) columns, GROUP BY customer_id.`,
     sql:`SELECT customer_id,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status IN ('placed', 'shipped') THEN 1 ELSE 0 END) AS open
FROM orders
GROUP BY customer_id;`},
    {lv:'H', q:`Cancellation rate per month as a percentage with one decimal: <code>month, orders, cancel_pct</code>.`, hint:`100.0 * SUM(CASE … cancelled …) / COUNT(*), ROUND(…, 1). Use 100.0 to avoid integer division.`,
     sql:`SELECT substr(order_date, 1, 7) AS month,
       COUNT(*) AS orders,
       ROUND(100.0 * SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cancel_pct
FROM orders
GROUP BY month;`},
  ],
  quiz: [
    [`CASE with no matching WHEN and no ELSE returns…`,[`0`,`''`,`NULL`,`An error`],2,`ELSE defaults to NULL.`,'E'],
    [`price = 900 with WHEN price >= 100 THEN 'mid' WHEN price >= 500 THEN 'premium' gives…`,[`'premium'`,`'mid'`,`both`,`NULL`],1,`First TRUE branch wins: order WHENs carefully.`,'E'],
    [`Conditional aggregation means…`,[`Aggregating only indexed columns`,`An aggregate over a CASE expression, e.g. SUM(CASE WHEN … THEN 1 ELSE 0 END)`,`HAVING with CASE`,`GROUP BY CASE`],1,`Several filtered counts in one pass.`,'M'],
    [`COUNT(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) counts…`,[`Paid rows`,`All rows (0 is not NULL)`,`Unpaid rows`,`Nothing`],1,`Use SUM, or drop the ELSE.`,'M'],
    [`<code>CASE x WHEN NULL THEN 'none' END</code> for x NULL returns…`,[`'none'`,`NULL`,`Error`,`'x'`],1,`Simple CASE uses =; use WHEN x IS NULL.`,'M'],
    [`Safe ratio a/b when b can be 0?`,[`a / b`,`a / NULLIF(b, 0)`,`a / COALESCE(b, 0)`,`a / ABS(b)`],1,`Division by NULL → NULL.`,'E'],
  ],
  quizAdv: [
    [`Postgres equivalent of SUM(CASE WHEN s='x' THEN 1 ELSE 0 END)?`,[`COUNT(s='x')`,`COUNT(*) FILTER (WHERE s = 'x')`,`COUNTIF(s='x')`,`SUM(s='x')::int only`],1,`SQL:2003 FILTER clause.`,'H'],
    [`In SQLite/MySQL, SUM(status = 'x') works because…`,[`It's a special aggregate`,`Booleans are integers 0/1`,`It's an index trick`,`It doesn't`],1,`Postgres needs a cast.`,'H'],
    [`Integer division trap: SUM(…)/COUNT(*) with integer inputs in Postgres returns…`,[`A decimal`,`An integer (truncated)`,`NULL`,`An error`],1,`Multiply by 100.0 or cast.`,'M'],
  ],
});
