/* 5.5 N+1 queries and pagination (OFFSET vs keyset) */
topic('5', { no:'5.5', title:'N+1 queries and pagination: OFFSET vs keyset (seek) pagination', db:'shop',
idea:`Two performance bugs every backend ships at least once. Count the round trips when an ORM loads 50 orders and then their customers one by one, fix it with a join or an IN batch, then watch OFFSET pagination slow down page after page while keyset pagination stays constant.`,
actors:'Round trips', stateTitle:'Cost', tbTitle:'Page',
codes:{a:`-- N+1: one query for the list…
SELECT id, customer_id FROM orders ORDER BY id LIMIT 50;
-- …then one query PER ROW (ORM lazy loading)
SELECT name FROM customers WHERE id = ?;      -- × 50

-- fix 1: one join
SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id
ORDER BY o.id LIMIT 50;
-- fix 2: batch (ORM "eager"/"batch" loading)
SELECT id, name FROM customers WHERE id IN (1, 2, 3, 5, 7);

-- OFFSET pagination: page 1000 reads and throws away 49,950 rows
SELECT * FROM orders ORDER BY order_date DESC, id DESC LIMIT 50 OFFSET 49950;

-- keyset (seek) pagination: continue after the last row seen
SELECT * FROM orders
WHERE (order_date, id) < ('2024-02-15', 104)
ORDER BY order_date DESC, id DESC LIMIT 50;`},
steps:[
{hl:{app:[2,3,4]}, th:[['app','RUN:ok','render order list'],['db','RUN:ok','1 + 50 queries']], g:[G('N+1',['1 query','the list of N orders'],['N queries','one per order to load its customer','bad'],['cost','N × (network round trip + parse + plan + execute)','bad'],['1 ms RTT × 51','≈ 51 ms just waiting','bad'])], log:['SELECT … orders LIMIT 50','SELECT name FROM customers WHERE id = 1','SELECT name FROM customers WHERE id = 2','… 48 more'],
 say:`The <b>N+1 query problem</b>: load a list (1 query), then for each of the N items load a related object with its own query (N queries). ORMs make it easy: <code>order.getCustomer().getName()</code> inside a loop triggers a lazy load per row. Each query is fast, but 51 round trips add up, and with nested relations it becomes N×M.`},
{hl:{app:[6,7,8]}, th:[['app','RUN:ok','1 query'],['db','RUN:ok','join']], g:[G('Fix 1: join',['queries','1','ok'],['ORM','JOIN FETCH / select_related / include','ok'],['watch','one-to-many joins multiply rows (1.3)'])], log:['SELECT o.id, c.name FROM orders o JOIN customers c … LIMIT 50'],
 say:`Fix 1: fetch everything in <b>one query with a join</b>. In ORMs: JPA <code>JOIN FETCH</code> / entity graphs, Django <code>select_related</code>, Rails <code>includes</code>/<code>eager_load</code>. Great for many-to-one; for one-to-many collections, a join multiplies rows, so the second fix is often better.`},
{hl:{app:[10]}, th:[['app','RUN:ok','2 queries'],['db','RUN:ok','IN batch']], g:[G('Fix 2: batch',['queries','2 (list + one IN)','ok'],['ORM','batch fetching, prefetch_related, DataLoader (GraphQL)','ok'],['N','bounded by page size'])], log:['SELECT … orders LIMIT 50','SELECT id, name FROM customers WHERE id IN (1, 2, 3, 5, 7)'],
 say:`Fix 2: <b>batch</b> the related lookups: collect the distinct customer ids from the page and load them with a single <code>IN (…)</code> query, then stitch in the app. Two queries regardless of N. That's Django <code>prefetch_related</code>, Hibernate batch fetching, and GraphQL's DataLoader.`},
{hl:{app:[13]}, th:[], tb:[TB('OFFSET 49950 LIMIT 50',['rows read','rows returned'],[['50,000','50']],{0:'bad'})], g:[G('OFFSET pagination',['page 1','read 50'],['page 100','read 5,000, discard 4,950','bad'],['page 1000','read 50,000, discard 49,950','bad'],['also','rows shift if data changes between pages (duplicates/skips)','bad'])], log:['page 1: 2 ms · page 100: 40 ms · page 1000: 400 ms'],
 say:`<b>OFFSET pagination</b> looks innocent, but the database can't jump to row 49,950: it must produce and <b>discard</b> all preceding rows in order. Cost grows linearly with page number. Worse, if rows are inserted or deleted between requests, items shift and users see duplicates or miss rows.`},
{hl:{app:[16,17,18]}, th:[], tb:[TB('keyset: after (2024-02-15, 104)',['id','order_date'],[[103,'2024-02-02'],[102,'2024-01-09'],[101,'2024-01-05']],{0:'ok',1:'ok',2:'ok'})], g:[G('Keyset / seek pagination',['remember','the last row\'s sort key (date, id)','hot'],['next page','WHERE (date, id) < (last) ORDER BY … LIMIT 50'],['index','(order_date, id) → seek + read 50','ok'],['cost','constant for every page','ok'],['stable','no duplicates/skips on inserts','ok'])], log:['every page: seek + 50 rows ≈ 2 ms'],
 say:`<b>Keyset (seek) pagination</b>: instead of "skip N rows", say "give me rows <i>after</i> the last one I saw". The client sends back the last row's sort key (a cursor), and with an index on (order_date, id) the database seeks straight there and reads 50 rows. Constant cost on page 1 or page 10,000, and stable under concurrent inserts. The sort key must be unique, hence the id tiebreaker.`},
{hl:{}, th:[], tb:[], g:[G('Trade-offs',['OFFSET','jump to arbitrary page numbers; slow deep; unstable'],['keyset','next/previous only (infinite scroll, APIs); fast; stable','ok'],['cursor token','encode (date, id) opaquely, e.g. base64'],['total count','COUNT(*) is itself expensive: estimate or omit'])],
 say:`<b>Say it:</b> "N+1 is one query for a list plus one per item, usually from ORM lazy loading; I fix it with a join or a batched IN query and catch it with query counts in tests. For pagination, OFFSET reads and discards all skipped rows, so deep pages get slow and results shift; keyset pagination filters on the last seen sort key with a matching index, giving constant-time pages. I use keyset for feeds and APIs, OFFSET only for small page-numbered UIs."`}
],
keep:[`N+1 = 1 list query + N per-row queries (ORM lazy loading). Fix: JOIN fetch or batched IN.`,`Detect with query logging / counting in tests.`,`OFFSET k reads k + n rows: cost grows with depth; rows shift between pages.`,`Keyset: WHERE (sort, id) < (last) ORDER BY sort, id LIMIT n + index → constant cost.`]}, {
  imp: 'must',
  theory: TH(`N+1 queries waste round trips by loading related data one row at a time; OFFSET pagination wastes work by reading and discarding skipped rows. Batching and keyset pagination fix them.`,
`<p>N+1 is like buying groceries by making a separate trip to the shop for each item on your list. Each trip is short, but 50 trips take all day. A join (one trip with the whole list) or a batch (two trips) fixes it.</p>
<p>OFFSET pagination is like finding page 1000 of a book by counting every page from the start. Keyset pagination is using a bookmark: you open the book right where you left off.</p>`,
[[`N+1 problem`,`1 query for parents + N queries for children.`],[`Lazy loading`,`ORM loads a relation on first access.`],[`Eager / batch loading`,`Loading relations up front, by join or IN.`],[`OFFSET pagination`,`LIMIT n OFFSET k.`],[`Keyset / seek pagination`,`WHERE sort_key > last_seen ORDER BY sort_key LIMIT n.`],[`Cursor`,`An opaque token encoding the last seen sort key.`],[`Row value comparison`,`(a, b) < (x, y), lexicographic.`]],
[`Log or count queries per request to detect N+1.`,`Replace per-row loads with a join or one batched query.`,`For pagination, order by a unique key (add id as tiebreaker).`,`Return a cursor with the last row's key; next request filters by it.`],
[`APIs (Stripe, Slack, GitHub) use cursor-based pagination.`,`ORM settings: fetch joins, batch sizes, DataLoader in GraphQL.`,`Tests that assert the number of queries per endpoint.`],
[`Looping over entities and touching lazy relations.`,`Deep OFFSET pages in public APIs (also a DoS vector).`,`Keyset pagination on a non-unique sort key without a tiebreaker.`,`Computing an exact COUNT(*) for every page of a huge table.`]),
  examples: [
    {lv:'basic', title:'The N+1 shape vs one join', sql:`-- N+1 would be: SELECT … FROM orders; then for each row: SELECT name FROM customers WHERE id = ?
SELECT o.id, o.order_date, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;`, why:`One round trip instead of 11 for this dataset.`},
    {lv:'mid', title:'Batch loading: one IN query for the page', sql:`-- page of orders
SELECT id, customer_id FROM orders ORDER BY id LIMIT 5;
-- their customers in one go (ids taken from the page above)
SELECT id, name FROM customers WHERE id IN (1, 2, 3, 5);`, why:`Two queries no matter how many rows the page has.`},
    {lv:'adv', title:'Keyset pagination with a row-value comparison', sql:`CREATE INDEX ix_orders_date_id ON orders(order_date, id);
-- page 1
SELECT id, order_date FROM orders ORDER BY order_date DESC, id DESC LIMIT 3;
-- page 2: the last row of page 1 was (2024-03-18, 108)
SELECT id, order_date FROM orders
WHERE (order_date, id) < ('2024-03-18', 108)
ORDER BY order_date DESC, id DESC LIMIT 3;`, why:`Row-value comparison handles ties on order_date correctly. With the index, each page is a seek + 3 rows.`},
  ],
  tips: {
    say:`"N+1 is a list query plus one query per row, typically ORM lazy loading; I fix it with a fetch join or batched IN loading and guard it with query-count assertions. For pagination, OFFSET scans and discards skipped rows and shifts under writes, so for feeds and APIs I use keyset pagination: filter on the last seen (sort key, id) with a matching index for constant-time pages."`,
    points:[`Name ORM-specific fixes (JOIN FETCH, select_related/prefetch_related, includes, DataLoader).`,`Explain why OFFSET is linear and unstable.`,`Mention the unique tiebreaker for keyset.`],
    traps:[`Fixing N+1 with a giant join that multiplies one-to-many rows.`,`Keyset on created_at alone (ties).`],
    qa:[[`How do you detect N+1 in production?`,`APM traces showing many similar queries per request, pg_stat_statements call counts, ORM query logging; in tests, assert max queries per endpoint.`],
        [`Can keyset pagination jump to page 50?`,`Not directly; it supports next/previous. If page numbers are required on huge data, consider approximate counts, search engines, or limiting depth.`],
        [`How do you paginate backwards with keyset?`,`Flip the comparison and ORDER BY, fetch, then reverse in the app.`]]
  },
  exercises: [
    {lv:'E', q:`Replace an N+1 loop with one query: every order line with its product name, <code>order_id, name, qty</code>.`, hint:`Join order_items to products.`,
     sql:`SELECT oi.order_id, p.name, oi.qty FROM order_items oi JOIN products p ON p.id = oi.product_id;`},
    {lv:'M', q:`Keyset page: orders ordered by <code>id</code> ascending, 3 per page. The last id on the previous page was 104. Return the next page: <code>id, order_date</code>.`, hint:`WHERE id &gt; 104 ORDER BY id LIMIT 3.`, ordered:true,
     sql:`SELECT id, order_date FROM orders WHERE id > 104 ORDER BY id LIMIT 3;`},
    {lv:'H', q:`Keyset page ordered by <code>order_date DESC, id DESC</code>, 3 per page. The last row seen was (2024-02-20, 105). Return the next page <code>id, order_date</code>, without using row-value syntax.`, hint:`order_date &lt; d OR (order_date = d AND id &lt; 105).`, ordered:true,
     sql:`SELECT id, order_date FROM orders
WHERE order_date < '2024-02-20' OR (order_date = '2024-02-20' AND id < 105)
ORDER BY order_date DESC, id DESC
LIMIT 3;`},
  ],
  quiz: [
    [`What is the N+1 problem?`,[`N joins in one query`,`One query for a list plus one extra query per item`,`N indexes on a table`,`A deadlock among N transactions`],1,`Usually ORM lazy loading.`,'E'],
    [`Which fixes N+1 for many-to-one relations?`,[`More indexes`,`A fetch join or batched IN query`,`OFFSET`,`Higher isolation`],1,`Fewer round trips.`,'E'],
    [`OFFSET 100000 LIMIT 10 typically…`,[`Reads only 10 rows`,`Reads and discards ~100,000 rows first`,`Is constant time with an index`,`Errors`],1,`Linear in depth.`,'E'],
    [`Keyset pagination requires…`,[`A unique, ordered sort key (add a tiebreaker) and ideally a matching index`,`OFFSET`,`Temporary tables`,`SERIALIZABLE`],0,`WHERE key > last.`,'M'],
    [`Why can OFFSET pages show duplicates?`,[`Bugs in LIMIT`,`Rows inserted/deleted between requests shift positions`,`Indexes are stale`,`Caching`],1,`Keyset is stable.`,'M'],
    [`Keyset pagination's main limitation?`,[`Slow deep pages`,`No direct jump to an arbitrary page number`,`Needs NoSQL`,`Unstable ordering`],1,`Next/previous navigation.`,'M'],
  ],
  quizAdv: [
    [`(a, b) < (x, y) as a row-value comparison means…`,[`a < x AND b < y`,`a < x OR (a = x AND b < y)`,`a + b < x + y`,`Not valid SQL`],1,`Lexicographic.`,'H'],
    [`Hibernate collection join fetch with pagination (setMaxResults) warns "firstResult/maxResults specified with collection fetch; applying in memory". Why?`,[`A bug`,`The join multiplies rows, so SQL LIMIT would cut collections; Hibernate fetches all and pages in memory`,`Missing index`,`Lazy loading`],1,`Use batch fetching or a two-step query.`,'H'],
    [`Exact COUNT(*) on a 500M-row Postgres table for "page 1 of N" is slow because…`,[`COUNT is buggy`,`MVCC means it must check visibility of every row (no stored count)`,`Indexes can't count`,`It locks the table`],1,`Use estimates (pg_class.reltuples) or omit totals.`,'H'],
  ],
});
