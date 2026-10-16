/* 5.3 Join algorithms: nested loop, hash join, merge join */
topic('5', { no:'5.3', title:'Join algorithms: nested loop, hash join, sort-merge join', db:'shop',
idea:`The same JOIN can run three very different ways. Step through a nested loop (great with an index and a small outer side), a hash join (build a hash table on the smaller input, probe with the larger), and a merge join (walk two sorted inputs in lockstep), and see when the optimizer picks each.`,
tbTitle:'Inputs', stateTitle:'Algorithm',
codes:{a:`SELECT c.name, o.id
FROM customers c JOIN orders o ON o.customer_id = c.id;

-- nested loop
for each c in customers:                       -- outer
    for each o in orders where o.customer_id = c.id:   -- inner (index!)
        emit (c, o)

-- hash join
build: H = hash table of customers keyed by id      -- smaller input
probe: for each o in orders: look up H[o.customer_id] → emit

-- merge join
sort customers by id, sort orders by customer_id (or read via index)
walk both lists together, advancing the side with the smaller key`},
steps:[
{hl:{q:[1,2]}, tb:[TB('customers (outer)',['id','name'],[[1,'Asha'],[2,'Ben'],[3,'Chen']]), TB('orders (inner)',['id','customer_id'],[[101,1],[102,2],[103,1],[104,3],[106,2]])], g:[G('Three physical algorithms',['nested loop','pairs via repeated lookups'],['hash join','build + probe a hash table'],['merge join','walk two sorted inputs'],['all','give the same result'])],
 say:`A JOIN in SQL says <i>what</i> to combine; the optimizer chooses <i>how</i>. There are three classic physical join algorithms. They all return the same rows but with very different costs depending on input sizes, available indexes and sort order.`},
{hl:{q:[4,5,6,7]}, tb:[TB('outer: Asha (id 1)',['customer','probe orders WHERE customer_id = 1'],[['Asha','→ 101, 103']],{0:'hot'}), TB('next outer rows',['customer','probe'],[['Ben','→ 102, 106'],['Chen','→ 104']])], g:[G('Nested loop',['cost','|outer| × cost of one inner lookup'],['inner index on customer_id','each probe = an index seek','ok'],['no inner index','|outer| × |inner| row comparisons','bad'],['best when','small outer, indexed inner, or LIMIT'],['only one for','non-equality joins (<, BETWEEN)'])], log:['3 outer rows × 1 index seek each'],
 say:`<b>Nested loop join</b>: for each row of the outer input, look up matching rows in the inner input. With an <b>index on the inner join column</b>, each lookup is a quick seek, so 3 customers cost 3 seeks. Without an index, it compares every pair: O(n × m). It's the best choice when the outer side is small (e.g. after a selective filter) and the only algorithm that handles non-equality conditions.`},
{hl:{q:[9,10]}, tb:[TB('build: hash table on customers.id',['bucket','entries'],[['h(1)','1 → Asha'],['h(2)','2 → Ben'],['h(3)','3 → Chen']],{0:'new',1:'new',2:'new'})], g:[G('Hash join: build',['input','the smaller side (customers)','hot'],['structure','in-memory hash table on the join key'],['memory','work_mem; too big → spill to disk in batches','bad'])],
 say:`<b>Hash join</b>, phase 1 (<b>build</b>): read the smaller input once and put its rows into an in-memory hash table keyed on the join column. If it doesn't fit in memory, the engine partitions both inputs to disk and joins them batch by batch (slower).`},
{hl:{q:[11]}, tb:[TB('probe: stream orders',['order','customer_id','H lookup'],[[101,1,'Asha'],[102,2,'Ben'],[103,1,'Asha'],[104,3,'Chen'],[106,2,'Ben']],{0:'ok',1:'ok',2:'ok',3:'ok',4:'ok'})], g:[G('Hash join: probe',['input','the larger side, streamed once'],['per row','one O(1) hash lookup','ok'],['total','≈ |build| + |probe|','ok'],['needs','equality condition'],['best when','large unsorted inputs, no useful index'])], log:['each input read exactly once'],
 say:`Phase 2 (<b>probe</b>): stream the larger input once; for each order, hash its customer_id and look it up. Each input is read exactly <b>once</b>: cost ≈ |build| + |probe|. Hash joins dominate large, unsorted equi-joins in analytics and big reports, but need an equality condition and memory for the build side.`},
{hl:{q:[13,14,15]}, tb:[TB('customers sorted by id',['id'],[[1],[2],[3]],{0:'hot'}), TB('orders sorted by customer_id',['customer_id','order'],[[1,101],[1,103],[2,102],[2,106],[3,104]],{0:'hot',1:'hot'})], g:[G('Merge join',['inputs','sorted on the join key','hot'],['walk','advance whichever side has the smaller key'],['cost','|A| + |B| if already sorted','ok'],['sort first','+ n log n','bad'],['best when','both inputs come sorted (indexes) or output must be sorted'])],
 say:`<b>Sort-merge join</b>: with both inputs <b>sorted</b> on the join key, walk them together like merging two sorted lists: matching keys are emitted, otherwise advance the side with the smaller key. If both inputs arrive sorted (from indexes or an earlier sort), it's a single linear pass and the output is sorted too. If they must be sorted first, that sort usually dominates the cost.`},
{hl:{}, tb:[], g:[G('Optimizer picks',['tiny outer + indexed inner','nested loop','ok'],['big × big, equality, unsorted','hash join','ok'],['both sorted / ORDER BY on key','merge join','ok'],['non-equality (<, BETWEEN)','nested loop'],['misestimates','wrong choice: e.g. nested loop over 1M "estimated 10" rows','bad'])],
 say:`<b>Say it:</b> "Nested loop probes the inner side once per outer row, which is ideal with a small outer input and an index on the inner key. Hash join builds a hash table on the smaller input and streams the larger one, best for big unsorted equi-joins. Merge join walks two inputs sorted on the key, best when they're already sorted. The optimizer picks by estimated sizes, so bad row estimates lead to bad join choices."`}
],
keep:[`Nested loop: |outer| × lookup cost. Needs an inner index to be fast. Handles any condition.`,`Hash join: build hash on smaller input, probe with larger. ≈ |A| + |B|. Equality only; memory.`,`Merge join: both sorted on key, linear walk; output sorted.`,`Choice depends on estimated sizes, indexes, sort order: misestimates → wrong algorithm.`]}, {
  imp: 'good',
  theory: TH(`Databases execute joins with one of three main algorithms (nested loop, hash join, merge join), chosen by the optimizer according to input sizes, indexes and sort order.`,
`<p>Pairing guests with their reserved tables: you could take each guest and search the list for their name (nested loop, fast if the list is indexed alphabetically), put all reservations into labelled boxes and drop each guest into their box (hash join), or line up both guests and reservations alphabetically and walk down both lines together (merge join).</p>`,
[[`Nested loop join`,`For each outer row, find matching inner rows.`],[`Index nested loop`,`Inner lookups use an index.`],[`Hash join`,`Build a hash table on one input, probe with the other.`],[`Build / probe side`,`Smaller input hashed / larger input streamed.`],[`Merge join`,`Linear merge of two inputs sorted on the key.`],[`Equi-join`,`Join on equality conditions.`],[`Spill`,`Writing hash/sort partitions to disk when memory is short.`]],
[`The optimizer estimates the rows on each side.`,`It considers available indexes and existing sort orders.`,`It costs each algorithm and join order.`,`It picks the cheapest combination; the executor runs it.`],
[`OLTP lookups (one user and their orders) are index nested loops.`,`Reports joining big tables use hash joins.`,`Merge joins appear when both sides are read in index order or sorted anyway.`,`MySQL added hash joins only in 8.0.18; before that, nested loops only.`],
[`Missing index on the inner join column (nested loop becomes O(n×m)).`,`Joining on expressions or mismatched types, disabling indexes and hash joins.`,`Too little work_mem making hash joins spill.`]),
  examples: [
    {lv:'basic', title:'Index nested loop in SQLite', sql:`EXPLAIN QUERY PLAN
SELECT c.name, o.id FROM customers c JOIN orders o ON o.customer_id = c.id;`, why:`SQLite only does nested loops: here it scans one table and looks up the other by primary key for each row.`},
    {lv:'mid', title:'Help the inner side with an index', sql:`CREATE INDEX ix_items_product ON order_items(product_id);
EXPLAIN QUERY PLAN
SELECT p.name, oi.order_id FROM products p JOIN order_items oi ON oi.product_id = p.id
WHERE p.category = 'books';`, why:`Outer: products filtered to books (2 rows). Inner: SEARCH order_items USING INDEX ix_items_product for each, which is the ideal nested-loop shape.`},
    {lv:'adv', title:'A hash join by hand: build and probe', sql:`-- build: a "hash table" of customers keyed by id (a temp table with an index)
CREATE TEMP TABLE h AS SELECT id, name FROM customers;
CREATE INDEX h_id ON h(id);
-- probe: stream orders once and look each up
SELECT o.id AS order_id, h.name
FROM orders o JOIN h ON h.id = o.customer_id
ORDER BY o.id;`, why:`Conceptually what a hash join does: materialise the smaller side into a keyed lookup structure, then stream the larger side once. Real engines hash in memory instead of building a B-tree.`},
  ],
  tips: {
    say:`"Nested loop does one inner lookup per outer row, ideal with a small outer side and an index on the inner key, and it's the only option for non-equality joins. Hash join builds a hash table on the smaller input and probes with the larger, great for big unsorted equi-joins. Merge join walks two key-sorted inputs. The optimizer chooses based on estimated sizes, indexes and order."`,
    points:[`Give the cost intuition for each (n×lookup, n+m, n+m after sorting).`,`Mention memory/spill for hash joins.`,`Tie bad choices to bad estimates.`],
    traps:[`Saying nested loops are always bad.`,`Saying hash joins can do range joins.`],
    qa:[[`When is a nested loop the best join?`,`Small outer input (e.g. 10 rows after a filter) and an index on the inner join column, or a LIMIT that stops early.`],
        [`Which side becomes the build side in a hash join?`,`The smaller estimated input, so the hash table fits in memory.`],
        [`Why might MySQL 5.7 be slow on a big join that Postgres handles fine?`,`5.7 only had nested-loop variants (block nested loop); without the right indexes a large join is O(n×m). 8.0.18+ has hash joins.`]]
  },
  exercises: [
    {lv:'E', q:`Show the plan SQLite picks for joining order_items to products on product_id.`, hint:`EXPLAIN QUERY PLAN with the join.`,
     sql:`EXPLAIN QUERY PLAN SELECT p.name, oi.qty FROM order_items oi JOIN products p ON p.id = oi.product_id;`},
    {lv:'M', q:`Which algorithm would you expect for each, and why? (a) 1 user row joined to their 50 orders with an index on orders.user_id; (b) 50M order lines joined to 2M products, no filter; (c) two tables both read via indexes on the join key and the query has ORDER BY on that key; (d) events JOIN windows ON e.ts BETWEEN w.start AND w.end.`, hint:`Sizes, indexes, sort order, equality.`,
     answer:`(a) index nested loop · (b) hash join (build on products) · (c) merge join · (d) nested loop (non-equality), ideally with an index on ts.`},
    {lv:'H', q:`Return each product with how many order lines reference it, using a join (not a subquery): <code>name, lines</code>, including products with 0 lines.`, hint:`LEFT JOIN order_items, COUNT(oi.order_id).`,
     sql:`SELECT p.name, COUNT(oi.order_id) AS lines
FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name;`},
  ],
  quiz: [
    [`Index nested loop cost is roughly…`,[`|outer| × cost of one index lookup`,`|A| + |B|`,`|A| × |B| always`,`log |A|`],0,`Fast with a small outer side.`,'M'],
    [`In a hash join, the build side is usually…`,[`The larger input`,`The smaller input`,`Always the left table`,`The indexed table`],1,`So the hash table fits in memory.`,'E'],
    [`Merge join requires inputs…`,[`Hashed`,`Sorted on the join key`,`Indexed on every column`,`Smaller than work_mem`],1,`Then a linear walk.`,'E'],
    [`Which algorithm handles WHERE a.ts BETWEEN b.start AND b.end?`,[`Hash join`,`Merge join (equality only)`,`Nested loop`,`None`],2,`Hash needs equality.`,'M'],
    [`A hash join's build side doesn't fit in memory. Result?`,[`Query fails`,`It spills to disk in batches (slower)`,`Switches to merge join at runtime`,`Returns partial results`],1,`Grace/hybrid hash join.`,'M'],
    [`Nested loop without an inner index on 100k × 100k rows…`,[`Fast`,`~10 billion comparisons: very slow`,`Same as hash join`,`Impossible`],1,`O(n × m).`,'E'],
  ],
  quizAdv: [
    [`Why might the optimizer choose a nested loop over a hash join for a big join?`,[`It always does`,`It underestimated the outer side (e.g. estimated 10 rows, got 1M)`,`Hash joins are disabled by default`,`Because of ORDER BY`],1,`Misestimates → bad algorithm.`,'H'],
    [`A merge join's output is…`,[`Unordered`,`Ordered by the join key`,`Ordered by the outer table's PK`,`Random`],1,`Can save a later sort.`,'H'],
    [`Semi-joins (EXISTS) can stop probing after…`,[`Every match`,`The first match per outer row`,`10 matches`,`Never`],1,`That's why EXISTS doesn't duplicate rows.`,'H'],
  ],
});
