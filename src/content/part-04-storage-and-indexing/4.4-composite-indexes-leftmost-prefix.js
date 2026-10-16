/* 4.4 Composite indexes and the leftmost-prefix rule */
topic('4', { no:'4.4', title:'Composite indexes and the leftmost-prefix rule', db:'shop',
idea:`An index on (a, b, c) is sorted like a phone book: by last name, then first name. See which WHERE clauses can use it, why a range on the first column stops the rest from helping, and how to order columns: equality first, then range, then sort.`,
tbTitle:'Index entries (customer_id, order_date, status)', stateTitle:'Can the index be used?',
codes:{a:`CREATE INDEX ix_o ON orders(customer_id, order_date, status);

WHERE customer_id = 1                                   -- ✓ prefix (a)
WHERE customer_id = 1 AND order_date >= '2024-02-01'    -- ✓ (a, b)
WHERE customer_id = 1 AND order_date = '2024-03-18'
  AND status = 'delivered'                              -- ✓ (a, b, c)
WHERE order_date = '2024-03-18'                         -- ✗ skips a
WHERE customer_id = 1 AND status = 'delivered'          -- ~ a only, c filtered
WHERE customer_id > 1 AND order_date = '2024-03-01'     -- ~ range on a stops b
ORDER BY customer_id, order_date                        -- ✓ no sort needed

-- rule of thumb: equality columns → range column → ORDER BY columns`},
steps:[
{hl:{q:[1]}, tb:[TB('ix_o (sorted)',['customer_id','order_date','status'],[[1,'2024-01-05','delivered'],[1,'2024-02-02','shipped'],[1,'2024-03-18','delivered'],[2,'2024-01-09','delivered'],[2,'2024-03-01','delivered'],[3,'2024-02-15','delivered'],[3,'2024-03-03','placed'],[5,'2024-02-20','cancelled'],[5,'2024-04-02','delivered'],[7,'2024-03-21','shipped']])], g:[G('Composite index',['sorted by','customer_id, then order_date, then status','hot'],['like','a phone book: last name, first name'])],
 say:`A <b>composite (multi-column) index</b> sorts entries by the first column, then by the second within equal firsts, then the third. Exactly like a phone book sorted by last name, then first name. Everything about which queries it helps follows from that ordering.`},
{hl:{q:[3,4]}, tb:[TB('customer_id = 1 AND order_date >= 2024-02-01',['customer_id','order_date','status'],[[1,'2024-01-05','delivered'],[1,'2024-02-02','shipped'],[1,'2024-03-18','delivered'],[2,'2024-01-09','delivered']],{1:'ok',2:'ok',0:'dim',3:'dim'})], g:[G('Leftmost prefix',['(a)','✓ contiguous block','ok'],['(a, b)','✓ contiguous within a','ok'],['(a, b, c)','✓','ok'])], log:['seek to (1, 2024-02-01), read until customer_id ≠ 1'],
 say:`Any <b>leftmost prefix</b> of the index columns gives a contiguous slice: customer 1's entries are together, and within them dates are sorted, so "customer 1 since February" is one seek plus a short scan. That works for (a), (a, b) and (a, b, c).`},
{hl:{q:[7]}, tb:[TB('order_date = 2024-03-18 (skipping customer_id)',['customer_id','order_date'],[[1,'2024-03-18'],[2,'2024-03-01'],[3,'2024-03-03'],[7,'2024-03-21']],{0:'hot'})], g:[G('Skipping the first column',['matches','scattered across every customer','bad'],['index seek','impossible','bad'],['fallback','full scan, or full index scan'],['exception','skip scan (Oracle, MySQL 8, Postgres 18) when a has few values'])],
 say:`Filtering only on <b>order_date</b> can't seek: dates are sorted only <i>within</i> each customer, so matches are scattered. Like finding everyone named "Ben" in a phone book sorted by last name. Some engines do a <b>skip scan</b> (jump customer by customer) when the first column has few distinct values; otherwise you need an index starting with order_date.`},
{hl:{q:[8]}, g:[G('a = 1 AND c = delivered',['seek on','customer_id = 1','ok'],['status','checked on each entry (not a seek)','hot'],['still good?','yes if customer 1 has few rows'])],
 say:`Equality on a and c but not b: the index seeks to customer 1, then checks status on each of that customer's entries. The gap (no condition on b) means status can't narrow the seek, but it's still filtered <i>inside the index</i> without touching the table, which is decent.`},
{hl:{q:[9]}, tb:[TB('customer_id > 1 AND order_date = 2024-03-01',['customer_id','order_date'],[[2,'2024-01-09'],[2,'2024-03-01'],[3,'2024-02-15'],[3,'2024-03-03'],[5,'2024-02-20'],[5,'2024-04-02'],[7,'2024-03-21']],{1:'ok'})], g:[G('Range on an early column',['a > 1','range scan from customer 2 onward'],['b = …','can\'t seek inside a range of a','bad'],['fix','index (order_date, customer_id): equality first','ok'])],
 say:`A <b>range on an earlier column stops later columns from helping the seek</b>. With <code>customer_id &gt; 1</code>, the index scans every entry from customer 2 onward and checks the date on each. Reordering the index as (order_date, customer_id) turns this into a precise seek: equality first, range second.`},
{hl:{q:[10,12]}, g:[G('ORDER BY',['ORDER BY a, b','index order = sort order, no sort step','ok'],['WHERE a = 1 ORDER BY b','also no sort','ok'],['ORDER BY b','needs a sort','bad']), G('Column order rule',['1','equality-filtered columns'],['2','one range column'],['3','ORDER BY / covering columns'],['selectivity?','secondary to the rule above'])],
 say:`Indexes also provide order: <code>WHERE customer_id = 1 ORDER BY order_date</code> reads already sorted entries with no sort step. <b>Say it:</b> "A composite index helps queries that constrain a leftmost prefix of its columns. I order columns by equality predicates first, then at most one range, then ORDER BY or covering columns, because after a range the remaining columns can't be used for seeking."`}
],
keep:[`Index (a, b, c) works for a; a, b; a, b, c. Not for b or c alone (except skip scan).`,`A range on a column stops the seek for columns after it.`,`Order columns: equality → range → ORDER BY/covering.`,`(a, b) makes a separate index on (a) redundant; one on (b) is not.`]}, {
  imp: 'must',
  theory: TH(`A composite index is sorted by its first column, then the next, so it only helps queries that constrain a leftmost prefix of its columns.`,
`<p>A phone book sorted by (last name, first name) makes it easy to find "Sharma", or "Sharma, Priya", but useless for "everyone named Priya". That's the <b>leftmost-prefix rule</b>. The order of columns in a composite index is therefore a design decision, driven by your queries.</p>
<p>A range ("last names starting with S") still uses the book, but within that range first names aren't sorted globally anymore, so they can't narrow the search; they can only be checked one by one.</p>`,
[[`Composite index`,`An index over several columns, sorted lexicographically.`],[`Leftmost prefix`,`The first k columns of the index.`],[`Seek`,`Jumping directly to the start of matching entries.`],[`Index filter`,`Checking a condition on index entries without seeking.`],[`Skip scan`,`Seeking once per distinct value of a skipped leading column.`],[`Redundant index`,`An index that is a prefix of another.`]],
[`The optimizer matches WHERE predicates to index columns from left to right.`,`Equality on each leading column narrows the seek.`,`The first range column ends the seekable prefix.`,`Remaining predicates on index columns are filtered in the index; others need table rows.`],
[`Design indexes from the actual query list, e.g. (tenant_id, created_at) for "a tenant's latest items".`,`Drop indexes made redundant by a wider composite index.`,`Use EXPLAIN to confirm which prefix is used.`],
[`Indexing each column separately and hoping the DB combines them.`,`Putting a low-cardinality range column first.`,`Dozens of overlapping composite indexes.`]),
  examples: [
    {lv:'basic', title:'Prefix used', sql:`CREATE INDEX ix_o ON orders(customer_id, order_date);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1 AND order_date >= '2024-02-01';`, why:`<code>SEARCH orders USING INDEX ix_o (customer_id=? AND order_date&gt;?)</code>: both columns used.`},
    {lv:'mid', title:'Skipping the first column', sql:`CREATE INDEX ix_o ON orders(customer_id, order_date);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE order_date = '2024-03-18';`, why:`<code>SCAN orders</code>: the index can't seek on order_date alone. (SQLite can skip-scan after ANALYZE when the leading column has few values.)`},
    {lv:'adv', title:'Equality + ORDER BY without a sort', sql:`CREATE INDEX ix_o ON orders(customer_id, order_date);
EXPLAIN QUERY PLAN SELECT id, order_date FROM orders WHERE customer_id = 1 ORDER BY order_date DESC;
EXPLAIN QUERY PLAN SELECT id, order_date FROM orders WHERE customer_id > 1 ORDER BY order_date;`, why:`First plan: index seek, no "USE TEMP B-TREE FOR ORDER BY". Second: the range on customer_id means dates aren't globally sorted, so a temp sort appears.`},
  ],
  tips: {
    say:`"A composite index is sorted by its first column, then the next, so it serves queries constraining a leftmost prefix. I put equality columns first, then one range column, then columns used for ORDER BY or covering, because a range ends the seekable prefix."`,
    points:[`Use the phone-book analogy.`,`Mention that (a, b) makes (a) redundant.`,`Know skip scan exists but don't rely on it.`],
    traps:[`Claiming column order doesn't matter.`,`Always putting the "most selective" column first regardless of equality vs range.`],
    qa:[[`Index on (a, b): does WHERE b = ? use it?`,`Not for a seek (except skip scan); it may do a full index scan if the index covers the query.`],
        [`Index for <code>WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 20</code>?`,`(tenant_id, status, created_at): two equalities then the sort column, giving a seek that returns rows already ordered and stops after 20.`],
        [`Two single-column indexes vs one composite?`,`The DB may combine single indexes with a bitmap AND, but a composite on the right order is usually much cheaper for queries that always filter both.`]]
  },
  exercises: [
    {lv:'E', q:`Create <code>ix_items</code> on <code>order_items(product_id, qty)</code> and show the plan for <code>SELECT order_id FROM order_items WHERE product_id = 3 AND qty &gt;= 1</code>.`, hint:`CREATE INDEX then EXPLAIN QUERY PLAN.`,
     sql:`CREATE INDEX ix_items ON order_items(product_id, qty);
EXPLAIN QUERY PLAN SELECT order_id FROM order_items WHERE product_id = 3 AND qty >= 1;`},
    {lv:'M', q:`For each query, say whether index (a, b, c) can seek, filter only, or not help: (1) a = 1 AND b = 2 (2) b = 2 AND c = 3 (3) a = 1 AND c = 3 (4) a &gt; 1 AND b = 2 (5) a = 1 ORDER BY b.`, hint:`Leftmost prefix; ranges stop the seek.`,
     answer:`(1) seek on a, b · (2) no seek (skip scan at best) · (3) seek on a, filter c in the index · (4) range seek on a, b filtered · (5) seek on a, results already ordered by b.`},
    {lv:'H', q:`Design one index for: <code>SELECT id, status FROM orders WHERE customer_id = ? AND order_date &gt;= ? ORDER BY order_date</code>. Create it as <code>ix_best</code> and show the plan for customer 1 from 2024-02-01.`, hint:`Equality, then range/sort column, then the extra output column to cover.`,
     sql:`CREATE INDEX ix_best ON orders(customer_id, order_date, status);
EXPLAIN QUERY PLAN SELECT id, status FROM orders WHERE customer_id = 1 AND order_date >= '2024-02-01' ORDER BY order_date;`},
  ],
  quiz: [
    [`Index (a, b). Which WHERE can seek using it?`,[`b = 1`,`a = 1`,`b > 1`,`None`],1,`Leftmost prefix.`,'E'],
    [`Index (last_name, first_name) is most like…`,[`A hash table`,`A phone book`,`A heap`,`A queue`],1,`Sorted by last, then first.`,'E'],
    [`With index (a, b), WHERE a > 5 AND b = 3…`,[`Seeks on both a and b`,`Range on a; b is filtered entry by entry`,`Can't use the index at all`,`Seeks on b only`],1,`A range ends the seekable prefix.`,'M'],
    [`Best index for WHERE status = ? AND created_at > ?`,[`(created_at, status)`,`(status, created_at)`,`(status) only`,`(created_at) only`],1,`Equality first, range second.`,'M'],
    [`Given index (a, b), an index on (a) alone is…`,[`Required`,`Usually redundant`,`Faster for everything`,`Needed for ORDER BY a`],1,`(a, b) already serves a-only queries.`,'M'],
    [`WHERE a = 1 ORDER BY b with index (a, b) needs a sort?`,[`Yes`,`No: entries for a = 1 are already ordered by b`,`Only with LIMIT`,`Only for DESC`],1,`Index order provides sort order.`,'E'],
  ],
  quizAdv: [
    [`Skip scan lets index (a, b) serve WHERE b = ? when…`,[`a is unique`,`a has few distinct values, so the engine seeks once per a value`,`b is indexed separately`,`Never`],1,`Oracle, MySQL 8.0.13+, SQLite (with stats), Postgres 18.`,'H'],
    [`Index (a, b) and WHERE a IN (1, 2, 3) AND b = 5…`,[`Can't use b`,`Can seek three times on (a, b)`,`Full scan`,`Uses only b`],1,`IN on a is a small set of equalities.`,'H'],
    [`ORDER BY a ASC, b DESC with index (a ASC, b ASC)…`,[`Fully satisfied`,`Not directly satisfied (mixed directions) unless the DB supports per-column direction or backward scans by group`,`Always an error`,`Uses a hash`],1,`Create (a ASC, b DESC) if needed.`,'H'],
  ],
});
