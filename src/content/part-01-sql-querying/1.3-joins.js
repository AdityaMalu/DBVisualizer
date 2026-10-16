/* 1.3 Joins */
topic('1', { no:'1.3', title:'Joins: inner, left, right, full, cross', db:'shop',
idea:`Two small tables, one join at a time. Watch which rows match, which get NULL-padded and which disappear, and why a LEFT JOIN with a filter in the wrong place silently becomes an INNER JOIN.`,
tbTitle:'Tables and join result', logTitle:'Result size',
codes:{a:`-- customers(id, name)           orders(id, customer_id, total)
SELECT c.name, o.id AS order_id
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;

SELECT c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;

SELECT c.name, o.id AS order_id
FROM customers c
FULL OUTER JOIN orders o ON o.customer_id = c.id;

SELECT c.name, o.id
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'delivered';      -- turns the LEFT JOIN into an INNER JOIN!`},
steps:[
{hl:{q:[1]}, tb:[TB('customers',['id','name'],[[1,'Asha'],[2,'Ben'],[3,'Chen']]), TB('orders',['id','customer_id'],[[101,1],[102,1],[103,2],[104,9]])],
 say:`A <b>join</b> combines rows from two tables using a condition. Here: 3 customers and 4 orders. Notice the edge cases on purpose: Asha has two orders, Chen has none, and order 104 points to customer 9, who doesn't exist (an orphan, as if there were no foreign key).`},
{hl:{q:[2,3,4]}, tb:[TB('customers',['id','name'],[[1,'Asha'],[2,'Ben'],[3,'Chen']],{0:'ok',1:'ok',2:'dim'}), TB('orders',['id','customer_id'],[[101,1],[102,1],[103,2],[104,9]],{0:'ok',1:'ok',2:'ok',3:'dim'}), TB('INNER JOIN result',['name','order_id'],[['Asha',101],['Asha',102],['Ben',103]],{0:'new',1:'new',2:'new'})], log:['INNER JOIN → 3 rows'],
 say:`<b>INNER JOIN</b> keeps only pairs where the ON condition is true. Conceptually: try every customer against every order, keep the matches. Asha appears <b>twice</b> (one row per matching order). Chen (no orders) and order 104 (no customer) both <b>vanish</b>.`},
{hl:{q:[6,7,8]}, tb:[TB('customers',['id','name'],[[1,'Asha'],[2,'Ben'],[3,'Chen']],{0:'ok',1:'ok',2:'hot'}), TB('orders',['id','customer_id'],[[101,1],[102,1],[103,2],[104,9]],{3:'dim'}), TB('LEFT JOIN result',['name','order_id'],[['Asha',101],['Asha',102],['Ben',103],['Chen',null]],{3:'hot'})], log:['LEFT JOIN → 4 rows (Chen padded with NULL)'],
 say:`<b>LEFT (OUTER) JOIN</b> keeps <i>every</i> row of the left table. When nothing matches, the right side's columns are filled with <b>NULL</b>. Chen now appears with <code>order_id = NULL</code>. That's how you answer "customers <i>and</i> their orders, including those with none". RIGHT JOIN is the mirror image; most people just swap the tables and use LEFT.`},
{hl:{q:[10,11,12]}, tb:[TB('FULL OUTER JOIN result',['name','order_id'],[['Asha',101],['Asha',102],['Ben',103],['Chen',null],[null,104]],{3:'hot',4:'hot'})], log:['FULL OUTER JOIN → 5 rows'],
 say:`<b>FULL OUTER JOIN</b> keeps unmatched rows from <i>both</i> sides: Chen with a NULL order, and order 104 with a NULL name. Useful for reconciliation ("what's in A but not B, and vice versa"). MySQL doesn't support it; emulate with LEFT JOIN UNION RIGHT JOIN. SQLite supports it since 3.39.`},
{hl:{q:[2,3]}, tb:[TB('CROSS JOIN: every pair',['customer','order'],[['Asha',101],['Asha',102],['Asha',103],['Asha',104],['Ben',101],['…','…'],['Chen',104]])], g:[G('Row counts',['customers','3'],['orders','4'],['CROSS JOIN','3 × 4 = 12','hot'])], log:['CROSS JOIN → 12 rows'],
 say:`A <b>CROSS JOIN</b> (Cartesian product) pairs every row with every row: 3 × 4 = 12. Every other join is "cross join, then keep rows where ON is true", which is the mental model (not how the engine actually executes it; see 5.3). Forgetting a join condition gives you an accidental cross join and an exploding row count.`},
{hl:{q:[14,15,16]}, tb:[TB('LEFT JOIN + WHERE on the right table',['name','order_id','status'],[['Asha',101,'delivered'],['Asha',102,'shipped'],['Ben',103,'delivered'],['Chen',null,null]],{1:'dim',3:'bad'})], g:[G('Why Chen disappears',['o.status for Chen','NULL'],['NULL = \'delivered\'','UNKNOWN → row filtered','bad'],['fix','move the filter into ON','ok'])], log:['LEFT JOIN … WHERE o.status = … → Chen lost'],
 say:`The classic bug. WHERE runs <b>after</b> the join. Chen's padded row has <code>status = NULL</code>, and <code>NULL = 'delivered'</code> is not true, so WHERE throws Chen away: your LEFT JOIN now behaves like an INNER JOIN. Fix: put conditions on the right table <b>in the ON clause</b>: <code>LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'</code>.`},
{hl:{}, tb:[], g:[G('Pick the join',['only matching pairs','INNER JOIN','ok'],['all of left, matches if any','LEFT JOIN','ok'],['all of both','FULL OUTER JOIN'],['every combination','CROSS JOIN'],['rows WITHOUT a match','LEFT JOIN … WHERE right.id IS NULL (anti-join)','hot'])],
 say:`<b>Say it:</b> "An inner join returns only matching rows; a left join keeps all left rows and NULL-pads missing matches; a full join keeps unmatched rows from both sides. One-to-many joins multiply rows, so aggregates after a join can double count. Filters on the optional side of an outer join belong in ON, not WHERE."`}
],
keep:[`INNER = matches only. LEFT = all left rows + NULLs. FULL = all rows from both. CROSS = every pair (n × m).`,`A one-to-many join repeats the "one" side: SUM after a join can double count.`,`Filtering the right table of a LEFT JOIN in WHERE turns it into an INNER JOIN; put it in ON.`,`"Rows with no match" = LEFT JOIN … WHERE right.key IS NULL, or NOT EXISTS.`]}, {
  imp: 'must',
  theory: TH(`A join builds result rows by pairing rows from two tables wherever a condition holds; outer joins also keep rows that found no partner.`,
`<p>Relational databases split data into separate tables so each fact is stored once: customers in one table, orders in another, linked by <code>orders.customer_id</code>. To answer real questions ("which customer placed this order?") you have to put them back together. That's a <b>join</b>.</p>
<p>Think of two stacks of cards. An <b>inner join</b> lays out each customer card next to each order card that belongs to it; cards with no partner are left out. A <b>left join</b> also lays out lonely customer cards, with a blank (NULL) where the order would go. A <b>full join</b> keeps lonely cards from both stacks. A <b>cross join</b> pairs every card with every card.</p>`,
[[`ON condition`,`The rule that decides which row pairs match, usually foreign key = primary key.`],[`INNER JOIN`,`Only row pairs where ON is true.`],[`LEFT / RIGHT OUTER JOIN`,`All rows of one side, NULL-padded when there is no match.`],[`FULL OUTER JOIN`,`All rows of both sides.`],[`CROSS JOIN`,`Cartesian product, n × m rows.`],[`Self join`,`A table joined to itself, e.g. employee to manager (see 1.4).`],[`Anti-join`,`Rows of A with no match in B.`]],
[`Start from the FROM table.`,`For each JOIN, pair rows using the ON condition (conceptually cross join, then filter).`,`For outer joins, add back unmatched rows with NULLs on the missing side.`,`Then WHERE filters the combined rows, GROUP BY groups them, SELECT picks columns.`],
[`Almost every API endpoint that shows related data runs a join (or an ORM generates one).`,`Reports: LEFT JOIN so entities with zero activity still show up with 0.`,`Data quality: FULL JOIN or anti-joins to find orphans and mismatches.`],
[`Putting a right-table filter in WHERE after a LEFT JOIN.`,`Summing amounts after joining a one-to-many relation (double counting).`,`Forgetting the ON condition (accidental Cartesian product).`,`Joining on columns with different types or collations, which can stop index use.`]),
  examples: [
    {lv:'basic', title:'Each order with its customer name', sql:`SELECT o.id, o.order_date, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;`, why:`<code>JOIN</code> means <code>INNER JOIN</code>. Every order has a customer (it's a NOT NULL foreign key), so all 10 orders come back.`},
    {lv:'mid', title:'All customers with their order count, including zero', sql:`SELECT c.name, COUNT(o.id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY orders DESC, c.name;`, why:`LEFT JOIN keeps customers with no orders (Diya, Farah). <code>COUNT(o.id)</code> counts only non-NULL ids, so they get 0. <code>COUNT(*)</code> would wrongly give 1.`},
    {lv:'mid', title:'Customers who never ordered (anti-join)', sql:`SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;`, why:`Here the IS NULL test in WHERE is intentional: keep only the padded rows. <code>NOT EXISTS</code> expresses the same thing (see 1.4).`},
    {lv:'adv', title:'Revenue per customer from delivered orders only, keeping everyone', sql:`SELECT c.name,
       COALESCE(SUM(oi.qty * oi.unit_price), 0) AS delivered_revenue
FROM customers c
LEFT JOIN orders o
       ON o.customer_id = c.id AND o.status = 'delivered'
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name
ORDER BY delivered_revenue DESC;`, why:`The status filter is in the <b>ON</b> clause, so customers with no delivered orders still appear (with 0). Move it to WHERE and they vanish. Three tables, two LEFT JOINs, aggregated after joining down to line-item grain.`},
  ],
  tips: {
    say:`"Inner join returns matching pairs; left join keeps every left row and fills NULLs where nothing matches; full join keeps unmatched rows from both sides; cross join is the Cartesian product. I watch for row multiplication on one-to-many joins and keep outer-join filters in the ON clause."`,
    points:[`Draw two tiny tables with an unmatched row on each side and walk through each join type: it shows you really understand NULL padding.`,`Mention that a one-to-many join multiplies rows, and how you avoid double counting (aggregate before joining, or COUNT(DISTINCT …)).`,`Know the anti-join patterns: LEFT JOIN … IS NULL, NOT EXISTS, and why NOT IN is risky with NULLs.`,`Know that MySQL lacks FULL OUTER JOIN and how to emulate it.`],
    traps:[`Saying LEFT JOIN "returns all rows from both tables".`,`Filtering the right table in WHERE after a LEFT JOIN and not noticing it became an inner join.`,`Claiming a join "loops over every pair": that's the logical model, not how hash or merge joins execute.`],
    qa:[[`How many rows can <code>A INNER JOIN B</code> return?`,`Anywhere from 0 to |A| × |B|. With a primary-key/foreign-key join from the "many" side, it's at most the number of rows on the many side.`],
        [`What is the difference between ON and WHERE in an outer join?`,`ON decides which rows match (unmatched left rows are still kept and padded). WHERE filters the joined result afterwards, so it can remove the padded rows. For inner joins they are equivalent.`],
        [`How would you find orders whose customer no longer exists?`,`<code>SELECT o.* FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE c.id IS NULL;</code>, and then add a foreign key so it can't happen again.`]]
  },
  exercises: [
    {lv:'E', q:`List every order line as <code>order_id, product name, qty</code> for order 101 and 102. Order by order_id, then product name.`, hint:`Join <code>order_items</code> to <code>products</code> on product_id, filter order_id IN (101, 102).`, ordered:true,
     sql:`SELECT oi.order_id, p.name, oi.qty
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE oi.order_id IN (101, 102)
ORDER BY oi.order_id, p.name;`},
    {lv:'M', q:`Show every product and how many units of it were ever ordered (<code>name, units</code>), including products never ordered (0).`, hint:`Start from products, LEFT JOIN order_items, and wrap the SUM in COALESCE.`,
     sql:`SELECT p.name, COALESCE(SUM(oi.qty), 0) AS units
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name;`},
    {lv:'M', q:`Which customers have <b>never</b> had an order shipped or delivered? Return their names. (Customers with only placed/cancelled orders, or with no orders, count.)`, hint:`Anti-join against orders filtered to those two statuses; keep the status filter in ON.`,
     sql:`SELECT c.name
FROM customers c
LEFT JOIN orders o
  ON o.customer_id = c.id AND o.status IN ('shipped', 'delivered')
WHERE o.id IS NULL;`},
    {lv:'H', q:`For each city (ignore customers with no city), show <code>city, customers, orders</code>: number of customers and number of orders placed by customers in that city. Watch out for double counting.`, hint:`One customer can have many orders, so COUNT(c.id) after the join counts orders, not customers. Use COUNT(DISTINCT …).`,
     sql:`SELECT c.city, COUNT(DISTINCT c.id) AS customers, COUNT(o.id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.city IS NOT NULL
GROUP BY c.city;`},
  ],
  quiz: [
    [`customers has 3 rows, orders has 4. What does <code>customers CROSS JOIN orders</code> return?`,[`7 rows`,`12 rows`,`4 rows`,`3 rows`],1,`A Cartesian product has n × m rows.`,'E'],
    [`A customer with no orders appears in which join with orders?`,[`INNER JOIN only`,`LEFT JOIN (customers on the left) with NULL order columns`,`Neither INNER nor LEFT JOIN`,`Only CROSS JOIN`],1,`LEFT JOIN keeps every left row and NULL-pads the missing side.`,'E'],
    [`<code>customers c LEFT JOIN orders o ON … WHERE o.status = 'paid'</code>: what happens to customers with no orders?`,[`They appear with NULL status`,`They are removed, because NULL = 'paid' is not true`,`The query errors`,`They appear with status 'paid'`],1,`WHERE runs after the join and filters out padded rows; put the condition in ON to keep them.`,'M'],
    [`Asha has 2 orders with 3 items each. After joining customers → orders → order_items, how many rows does Asha have?`,[`1`,`2`,`3`,`6`],3,`Each join multiplies rows along one-to-many relationships.`,'M'],
    [`Which query finds customers with no orders?`,[`SELECT * FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL`,`SELECT * FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL`,`SELECT * FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.id IS NULL`,`SELECT * FROM customers c CROSS JOIN orders o WHERE o.customer_id <> c.id`],1,`An inner join never produces NULL order ids; the ON variant keeps every customer.`,'M'],
    [`Which database does NOT support FULL OUTER JOIN natively?`,[`PostgreSQL`,`MySQL`,`SQL Server`,`Oracle`],1,`MySQL needs LEFT JOIN … UNION … RIGHT JOIN.`,'E'],
    [`For an INNER JOIN, is a condition in ON equivalent to the same condition in WHERE?`,[`Yes, the result is the same`,`No, WHERE keeps unmatched rows`,`No, ON is evaluated after GROUP BY`,`Only if the column is indexed`],0,`Only outer joins treat ON and WHERE differently.`,'M'],
    [`A RIGHT JOIN B is the same as:`,[`A LEFT JOIN B`,`B LEFT JOIN A (with columns in a different order)`,`A FULL JOIN B`,`A INNER JOIN B`],1,`Most teams avoid RIGHT JOIN and write it as a LEFT JOIN with the tables swapped.`,'E'],
  ],
  quizAdv: [
    [`You SUM(payment.amount) after joining orders → items → payments, and totals are too high. Most likely cause?`,[`Floating-point rounding`,`Fan-out: items and payments both multiply rows per order`,`A missing index on payments`,`NULL amounts being counted as zero`],1,`Two independent one-to-many joins produce a mini Cartesian product per order. Aggregate each side first, then join.`,'H'],
    [`orders (10 rows, customer_id NOT NULL with a foreign key) INNER JOIN customers (7 rows) ON c.id = o.customer_id. How many rows?`,[`Exactly 10`,`Up to 70`,`Exactly 7`,`Between 7 and 10`],0,`Each order matches exactly one customer via the primary key, so the join keeps the many side's row count.`,'H'],
    [`<code>LEFT JOIN b ON b.a_id = a.id AND a.active = 1</code> (a condition on the LEFT table in ON). Inactive rows of a are…`,[`Filtered out`,`Kept, with NULL b columns`,`Cause an error`,`Kept, matched to every b`],1,`ON never removes left rows of a LEFT JOIN; it only decides whether they match. Filter the left table in WHERE.`,'H'],
    [`Emulating FULL OUTER JOIN in MySQL with <code>LEFT JOIN … UNION ALL RIGHT JOIN …</code> has what problem?`,[`It can't return NULLs`,`Matched rows appear twice; use UNION, or UNION ALL with the right half restricted to unmatched rows`,`RIGHT JOIN isn't supported in MySQL`,`It's always slower than a cross join`],1,`Both halves contain the matched pairs.`,'H'],
  ],
});
