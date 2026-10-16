/* 4.6 Other index types: hash, bitmap, inverted (GIN), GiST, BRIN, partial */
topic('4', { no:'4.6', title:'Beyond B-trees: hash, bitmap, inverted (GIN), BRIN and partial indexes', db:'shop',
idea:`Different questions need different structures. See a hash index answer equality in one probe but fail at ranges, a bitmap combine low-cardinality filters with AND/OR, an inverted index find documents by word, a BRIN index summarise huge append-only tables, and a partial index cover only the rows you query.`,
stateTitle:'Structure', tbTitle:'Index contents',
codes:{a:`-- hash: equality only
CREATE INDEX ix_h ON sessions USING hash (token);      -- Postgres
WHERE token = 'abc'     ✓       WHERE token > 'abc'  ✗

-- bitmap (Oracle; Postgres builds bitmaps on the fly)
-- status=delivered: 1 1 0 1 0 1 0 1 0 1
-- city=Pune:        1 0 1 1 0 0 1 1 0 0   → AND → rows 1, 4, 8

-- inverted index (GIN): word/key → list of rows
CREATE INDEX ix_tags ON posts USING gin (tags);         -- arrays, jsonb, tsvector
WHERE tags @> ARRAY['sql']

-- BRIN: min/max per block range, tiny, for naturally ordered data
CREATE INDEX ix_ts ON events USING brin (created_at);

-- partial: only the rows you query
CREATE INDEX ix_open ON orders(customer_id) WHERE status = 'placed';`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('hash buckets',['bucket','entries'],[['h(\'abc\') = 7','abc → row 12'],['h(\'xyz\') = 2','xyz → row 40'],['h(\'abd\') = 13','abd → row 5']])], g:[G('Hash index',['lookup','hash the key → bucket: O(1)','ok'],['ranges / ORDER BY / prefix','impossible: hashing destroys order','bad'],['used for','exact-match keys (tokens, ids)'],['in practice','B-tree is nearly as fast and more versatile'])],
 say:`A <b>hash index</b> maps <code>hash(key)</code> to a bucket, so equality lookup is one probe. But hashing scatters neighbouring keys ('abc' and 'abd' land far apart), so it can't do ranges, sorting or prefix searches. Hash indexes also power in-memory stores and hash joins (5.3). In most SQL databases a B-tree is the default because it's nearly as fast for equality and does everything else too.`},
{hl:{q:[5,6,7]}, tb:[TB('bitmaps (1 bit per row)',['predicate','rows 1-10'],[['status = delivered','1 1 0 1 0 1 0 1 0 1'],['city = Pune','1 0 1 1 0 0 1 1 0 0'],['AND','1 0 0 1 0 0 0 1 0 0']],{2:'ok'})], g:[G('Bitmap index',['one bitmap per distinct value','great for low cardinality','ok'],['AND / OR / NOT','fast bitwise ops','ok'],['heavy concurrent writes','bad: locks large bitmap chunks (Oracle)','bad'],['used in','data warehouses'])],
 say:`A <b>bitmap index</b> keeps, for each distinct value, a bit per row. Combining filters becomes bitwise AND/OR over compressed bitmaps, which is extremely fast for low-cardinality columns (status, country, gender) in analytics. They're bad for write-heavy OLTP. Postgres doesn't store bitmap indexes but builds bitmaps from B-trees at query time ("BitmapAnd").`},
{hl:{q:[9,10,11]}, tb:[TB('inverted index (GIN on tags)',['key','posting list (rows)'],[['sql','2, 7, 9, 31'],['postgres','7, 31'],['index','2, 9']],{0:'hot'})], g:[G('Inverted index',['maps','each element/word → rows containing it','hot'],['answers','"which rows contain X?"','ok'],['for','arrays, jsonb, full-text (tsvector), trigrams'],['cost','slower writes (many entries per row)'])],
 say:`An <b>inverted index</b> flips the direction: instead of row → values, it stores value → rows. Postgres <b>GIN</b> indexes arrays, jsonb keys and full-text documents this way, so "posts tagged sql" or "documents containing 'database'" are fast. It's the same idea search engines use (9.6). Writes cost more because one row creates many index entries.`},
{hl:{q:[13,14]}, tb:[TB('BRIN summaries',['block range','min created_at','max created_at'],[['pages 0-127','2024-01-01','2024-01-03'],['pages 128-255','2024-01-03','2024-01-06'],['pages 256-383','2024-01-06','2024-01-09']],{1:'hot'})], g:[G('BRIN (block range index)',['stores','min/max per range of pages'],['size','tiny (KBs for TBs of data)','ok'],['works when','values correlate with physical order (append-only time series)','hot'],['query','skip ranges whose min/max can\'t match'])],
 say:`A <b>BRIN</b> index stores just the min and max value for each range of pages. If data is physically ordered (append-only logs by time), a query for one day can skip every range whose [min, max] doesn't overlap. It's thousands of times smaller than a B-tree, but useless if values are randomly placed. GiST/SP-GiST (geometry, ranges, nearest-neighbour) round out Postgres's toolbox.`},
{hl:{q:[16,17]}, tb:[TB('ix_open contains only',['customer_id','row'],[[3,'107']],{0:'ok'})], g:[G('Partial index',['indexes','only rows WHERE status = \'placed\'','ok'],['size','tiny if few rows are open','ok'],['query must imply','the same WHERE condition'],['also','partial UNIQUE (one active row per key, 3.7)'])],
 say:`A <b>partial index</b> includes only rows matching a condition. If 1% of orders are open and the app constantly queries open orders, index just those: smaller, faster, cheaper to maintain. Partial <b>unique</b> indexes enforce rules like "one active subscription per user". Postgres and SQLite support them; SQL Server calls them filtered indexes.`},
{hl:{}, tb:[], g:[G('Pick the structure',['equality, ranges, sort (default)','B-tree','ok'],['equality only, huge keys','hash'],['low-cardinality analytics filters','bitmap'],['"contains" for arrays/json/text','GIN / inverted'],['geometry, ranges, kNN','GiST / SP-GiST'],['huge append-only, ordered','BRIN'],['hot subset of rows','partial'])],
 say:`<b>Say it:</b> "B-trees are the default because they handle equality, ranges and ordering. Hash indexes do equality only. Bitmap indexes shine for low-cardinality filters in analytics. Inverted indexes like GIN map elements or words to rows for containment and full-text search. BRIN keeps min/max per block range for huge naturally ordered tables. Partial indexes cover just the rows you query."`}
],
keep:[`Hash: O(1) equality, no ranges/sort.`,`Bitmap: bit per row per value; fast AND/OR; low cardinality; analytics.`,`Inverted (GIN): value → rows; arrays, jsonb, full-text.`,`BRIN: min/max per block range; tiny; needs physical ordering.`,`Partial: index only the rows matching a WHERE.`]}, {
  imp: 'good',
  theory: TH(`Besides B-trees, databases offer specialised index structures (hash, bitmap, inverted, spatial, block-range, partial), each fast for a particular kind of question.`,
`<p>A B-tree is like an alphabetical index: great for "find X" and "everything from X to Y". But some questions don't fit: "which documents contain this word?" (an inverted index, like a book's word index), "rows where status is shipped AND city is Pune" across millions of rows (bitmaps), "events from last Tuesday in a 5 TB append-only log" (block-range summaries).</p>`,
[[`Hash index`,`Buckets by hash of the key; equality only.`],[`Bitmap index`,`A bit vector per distinct value.`],[`Inverted index / GIN`,`Element or term → list of rows.`],[`GiST`,`Generalised search tree for geometric and range types.`],[`BRIN`,`Block range index: min/max per page range.`],[`Partial / filtered index`,`Index over a subset of rows.`],[`Expression index`,`Index over a computed value (4.5).`]],
[`Identify the query shape (equality, range, containment, spatial, time-ordered).`,`Pick the structure that answers it without scanning.`,`Consider write cost and size.`,`Verify with EXPLAIN.`],
[`GIN on jsonb columns and tags arrays; tsvector full-text search.`,`BRIN on time-series/event tables with hundreds of millions of rows.`,`Partial indexes for "active"/"pending" rows; partial unique for soft deletes.`,`Bitmap indexes in Oracle data warehouses.`],
[`Hash index for a range query.`,`Bitmap indexes on OLTP tables with concurrent updates.`,`BRIN on randomly ordered data.`,`GIN on very write-heavy columns without considering fastupdate/pending list costs.`]),
  examples: [
    {lv:'basic', title:'Partial index: only open orders', sql:`CREATE INDEX ix_open ON orders(customer_id) WHERE status = 'placed';
EXPLAIN QUERY PLAN SELECT id FROM orders WHERE status = 'placed' AND customer_id = 3;`, why:`The query implies the index's WHERE, so the small partial index is used.`},
    {lv:'mid', title:'Partial index not applicable', sql:`CREATE INDEX ix_open ON orders(customer_id) WHERE status = 'placed';
EXPLAIN QUERY PLAN SELECT id FROM orders WHERE customer_id = 3;`, why:`Without <code>status = 'placed'</code> in the query, the partial index could miss rows, so it can't be used: SCAN.`},
    {lv:'adv', title:'An inverted index by hand', sql:`CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);
INSERT INTO posts VALUES (1, 'indexes make sql fast'), (2, 'sql joins explained'), (3, 'fast caching');
-- build term → post postings with a recursive split on spaces
CREATE TABLE postings AS
WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', title || ' ' FROM posts
  UNION ALL
  SELECT id, substr(rest, 1, instr(rest, ' ') - 1), substr(rest, instr(rest, ' ') + 1)
  FROM split WHERE rest <> ''
)
SELECT word, id FROM split WHERE word <> '';
CREATE INDEX ix_postings ON postings(word);
SELECT word, GROUP_CONCAT(id) AS posts FROM postings WHERE word IN ('sql', 'fast') GROUP BY word;`, why:`term → list of documents: exactly what GIN and search engines store (with compression, positions and ranking on top).`},
  ],
  tips: {
    say:`"B-trees are the default since they handle equality, ranges and sorting. I'd use hash for pure equality on big keys, GIN/inverted for arrays, JSON and full-text containment, BRIN for huge append-only time-ordered tables, bitmap indexes for low-cardinality analytics filters, and partial indexes when queries target a small subset of rows."`,
    points:[`Match each index type to a query shape.`,`Know why hash can't do ranges.`,`Mention partial unique indexes for business rules.`],
    traps:[`Bitmap indexes on high-write OLTP tables.`,`BRIN on unordered data.`],
    qa:[[`Hash vs B-tree index?`,`Hash: O(1) equality only. B-tree: O(log n) equality plus ranges, ordering and prefixes; usually the better default.`],
        [`How would you index a jsonb column queried with @&gt;?`,`A GIN index (jsonb_ops or jsonb_path_ops for smaller, containment-only).`],
        [`What is BRIN good for?`,`Very large tables where the indexed value correlates with physical order (timestamps on append-only logs): tiny index, skips irrelevant block ranges.`]]
  },
  exercises: [
    {lv:'E', q:`Create a partial index <code>ix_cancelled</code> on <code>orders(order_date)</code> for cancelled orders, and show the plan for <code>SELECT id FROM orders WHERE status = 'cancelled' AND order_date &gt;= '2024-01-01'</code>.`, hint:`CREATE INDEX … WHERE status = 'cancelled'.`,
     sql:`CREATE INDEX ix_cancelled ON orders(order_date) WHERE status = 'cancelled';
EXPLAIN QUERY PLAN SELECT id FROM orders WHERE status = 'cancelled' AND order_date >= '2024-01-01';`},
    {lv:'M', q:`Pick an index type for each and say why: (a) session token lookups, (b) "articles containing 'postgres'", (c) 3 TB click log queried by time range, (d) "users with an active subscription" (2% of rows), (e) store locator "within 5 km".`, hint:`Match query shape to structure.`,
     answer:`(a) hash or B-tree (equality) · (b) inverted/full-text (GIN tsvector) · (c) BRIN on timestamp (or partitioning) · (d) partial index WHERE active · (e) GiST/SP-GiST spatial index (PostGIS).`},
    {lv:'H', q:`Enforce "at most one open (placed) order per customer" with a partial unique index named <code>ux_one_open</code>, then return the open-order count per customer: <code>customer_id, n</code>. Afterwards, try <code>INSERT INTO orders VALUES (120, 3, '2024-05-01', 'placed');</code> with Run to see the index reject it.`, hint:`CREATE UNIQUE INDEX … ON orders(customer_id) WHERE status = 'placed'.`,
     sql:`CREATE UNIQUE INDEX ux_one_open ON orders(customer_id) WHERE status = 'placed';
SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'placed' GROUP BY customer_id;`},
  ],
  quiz: [
    [`A hash index can answer…`,[`WHERE x > 5`,`WHERE x = 5`,`ORDER BY x`,`WHERE x LIKE 'a%'`],1,`Equality only.`,'E'],
    [`Bitmap indexes suit…`,[`High-cardinality, write-heavy columns`,`Low-cardinality columns in read-mostly analytics`,`Primary keys`,`Full-text search`],1,`Bitwise AND/OR.`,'E'],
    [`GIN / inverted index maps…`,[`Row → values`,`Value/term → rows containing it`,`Page → min/max`,`Key → bucket`],1,`Containment queries.`,'E'],
    [`BRIN works well when…`,[`Values are random`,`Values correlate with physical row order (e.g. append-only timestamps)`,`The table is tiny`,`Columns are text`],1,`Min/max per block range.`,'M'],
    [`A partial index on orders WHERE status = 'placed' is used by…`,[`Any query on orders`,`Queries whose WHERE implies status = 'placed'`,`Only UPDATEs`,`Only joins`],1,`Otherwise it might miss rows.`,'M'],
    [`Why is B-tree the default index type?`,[`Smallest`,`Handles equality, ranges, sorting and prefixes`,`Fastest writes`,`Only one supported`],1,`Versatile.`,'E'],
  ],
  quizAdv: [
    [`Postgres "BitmapAnd" in a plan means…`,[`A stored bitmap index`,`Two index scans produced in-memory bitmaps that were ANDed`,`A bitwise column`,`A hash join`],1,`Postgres builds bitmaps on the fly.`,'H'],
    [`jsonb_path_ops vs jsonb_ops GIN operator class?`,[`Same`,`path_ops is smaller and faster but supports only containment (@>) queries`,`path_ops supports more operators`,`ops is for arrays only`],1,`Trade-off of flexibility vs size.`,'H'],
    [`Why are Oracle bitmap indexes bad for OLTP?`,[`They're slow to read`,`Updating one row can lock a range of rows covered by the same bitmap segment, killing concurrency`,`They can't be dropped`,`They store NULLs`],1,`Lock granularity.`,'H'],
  ],
});
