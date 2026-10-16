/* 4.1 How rows are stored: pages, heap files, buffer pool, row vs column */
topic('4', { no:'4.1', title:'How data is stored: pages, heap files, the buffer pool', db:'shop',
idea:`Follow a SELECT down to the disk. Rows live in fixed-size pages; pages live in files; a buffer pool caches hot pages in memory. See why a full table scan reads every page, why I/O dominates cost, and how row and column layouts differ.`,
dgTitle:'Storage hierarchy', stateTitle:'Numbers', tbTitle:'Page contents',
nodes:{
  q:{x:70,y:40,label:'query',w:100,kind:'actor'},
  bp:{x:250,y:40,label:'buffer pool\n(RAM)',w:150,h:50,kind:'mem'},
  disk:{x:250,y:170,label:'table file\n(pages on disk)',w:170,h:54,kind:'db'},
  p1:{x:440,y:40,label:'page 1',w:90},
  p2:{x:440,y:100,label:'page 2',w:90},
  p3:{x:440,y:160,label:'page 3',w:90}
},
edges:[['q','bp'],['bp','disk']],
vb:'0 0 500 220',
codes:{a:`-- PostgreSQL: 8 KB pages; MySQL InnoDB: 16 KB pages; SQLite: 4 KB default
SELECT * FROM orders WHERE customer_id = 7;   -- no index → read every page

-- inside one 8 KB heap page (slotted page layout)
-- [ header | slot1 slot2 slot3 → free space ← row3 row2 row1 ]

-- a row's physical address
--   PostgreSQL: ctid = (page, slot)       e.g. (2, 5)
--   InnoDB:     the primary key (rows live inside the PK B+tree, see 4.3)

-- I/O is the cost that matters:
--   RAM ~100 ns · SSD random read ~100 µs · HDD seek ~10 ms`},
steps:[
{hl:{q:[1]}, d:{on:['disk']}, g:[G('Page (block)',['unit of I/O','the DB reads/writes whole pages','hot'],['size','8 KB (Postgres), 16 KB (InnoDB), 4 KB (SQLite)'],['holds','many rows (a 100-byte row → ~80 per 8 KB page)'])],
 say:`A database doesn't read single rows from disk; it reads <b>pages</b> (blocks) of a fixed size, e.g. 8 KB in PostgreSQL. A table is a file made of pages, each holding many rows. Every cost discussion in databases ultimately comes down to "how many pages did we touch?".`},
{hl:{q:[4,5]}, tb:[TB('page 2 (slotted page)',['slot','→ offset','row'],[[1,'8100','(order 104, cust 3, 2024-02-15)'],[2,'8020','(order 105, cust 5, 2024-02-20)'],[3,'7950','(order 106, cust 2, 2024-03-01)']])], g:[G('Slotted page',['header','page metadata, free-space pointers'],['slot array','grows from the front','hot'],['row data','grows from the back'],['why slots','rows can move within the page without changing their address'])],
 say:`Inside a page, a <b>slot array</b> at the front points to rows packed from the back, with free space in between. A row's address is (page, slot): in PostgreSQL that's the <b>ctid</b>. Rows can be compacted within the page while their slot number stays the same, so indexes can keep pointing at (page, slot).`},
{hl:{q:[2]}, d:{on:['q','p1','p2','p3'], e:[['q','bp','read all pages','hot'],['bp','disk','miss → disk','bad']]}, g:[G('Heap file',['rows stored','in no particular order (insertion-ish)'],['find customer 7','no index → read every page','bad'],['name','sequential / full table scan'])], log:['Seq Scan on orders: 3 of 3 pages read'],
 say:`Tables in PostgreSQL are <b>heap files</b>: rows go wherever there's room, in no useful order. To find customer 7's orders without an index, the engine must read <b>every page</b> and check every row: a <b>sequential (full table) scan</b>. Fine for 3 pages; a disaster for 3 million.`},
{hl:{}, d:{on:['bp'], e:[['q','bp','hit (RAM)','ok']]}, g:[G('Buffer pool / shared buffers',['what','RAM cache of pages','hot'],['hit','~100 ns','ok'],['miss','SSD ~100 µs, HDD ~10 ms','bad'],['eviction','LRU / clock sweep'],['dirty pages','changed in RAM, written later (WAL keeps them safe, 7.1)'])], log:['second run: all pages from buffer pool'],
 say:`The <b>buffer pool</b> keeps recently used pages in RAM. A hit costs ~100 ns; a miss to SSD ~1000× more; to a spinning disk ~100,000× more. Modified pages are written back lazily (they're protected by the write-ahead log, 7.1). Sizing this cache to hold your hot data is one of the biggest performance levers.`},
{hl:{q:[11,12]}, g:[G('Row store',['layout','all columns of a row together'],['good for','OLTP: fetch/update whole rows','ok']), G('Column store',['layout','each column stored separately'],['good for','OLAP: SUM(revenue) over billions of rows','ok'],['compression','similar values together → 10× smaller'])],
 say:`Most OLTP databases are <b>row stores</b>: a row's columns sit together on a page, perfect for "load order 104". Analytics engines (9.7) use <b>column stores</b>: each column in its own blocks, so <code>SUM(revenue)</code> reads only the revenue column and compresses it well.`},
{hl:{}, d:{}, g:[G('Takeaways',['cost model','pages read (I/O) dominates'],['without an index','full scan'],['indexes','find pages without scanning (4.2)'],['cache','buffer pool hit ratio'])],
 say:`<b>Say it:</b> "Tables are stored in fixed-size pages; the engine reads whole pages, caches them in a buffer pool, and its cost is dominated by how many pages it must fetch from disk. Without an index, finding rows means scanning every page. Indexes exist to turn that into a handful of page reads."`}
],
keep:[`Unit of I/O = page (8 KB Postgres, 16 KB InnoDB). Cost ≈ pages touched.`,`Heap file: rows in no order; no index → full scan of every page.`,`Buffer pool caches pages in RAM; misses cost ~1000× more.`,`Row store for OLTP, column store for analytics.`]}, {
  imp: 'good',
  theory: TH(`Databases store tables as files of fixed-size pages, cache hot pages in memory, and measure most of their work in pages read from disk.`,
`<p>Disks (even SSDs) are slow compared to memory and are read in blocks, not bytes. So a database groups rows into <b>pages</b> and always reads and writes whole pages. A query's cost is roughly "how many pages had to come from disk".</p>
<p>Think of a library where books (rows) are stored in boxes (pages). Fetching one box from the basement takes minutes; checking a box already on the front desk (the buffer pool) takes seconds. Without a catalogue (an index), finding one book means bringing up every box.</p>`,
[[`Page / block`,`Fixed-size unit of storage and I/O.`],[`Heap file`,`Unordered collection of pages holding a table's rows.`],[`Slotted page`,`Page layout with a slot array pointing to row data.`],[`ctid / RID`,`A row's physical address (page, slot).`],[`Buffer pool`,`In-memory cache of pages.`],[`Sequential scan`,`Reading every page of a table.`],[`Row vs column store`,`Rows together vs each column separately.`]],
[`A query asks the storage engine for rows.`,`The engine computes which pages it needs.`,`Pages already in the buffer pool are used directly; others are read from disk.`,`Rows are extracted from pages; changed pages are marked dirty and flushed later.`],
[`Monitor buffer/cache hit ratio; give the DB enough RAM for its working set.`,`Large table scans on OLTP systems show up as slow queries and I/O spikes.`,`Choose column stores for analytics workloads.`],
[`Assuming a query on a "small" table is free (it may not be cached).`,`Ignoring row width: wide rows mean fewer rows per page, more I/O.`,`Running analytics scans on the OLTP primary, evicting the app's hot pages.`]),
  examples: [
    {lv:'basic', title:'See a full table scan in the plan', sql:`EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE status = 'shipped';`, why:`SQLite reports <code>SCAN orders</code>: no index on status, so every page is read.`},
    {lv:'mid', title:'Primary key lookup vs scan', sql:`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE id = 104;
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3;`, why:`The first is a <code>SEARCH … USING INTEGER PRIMARY KEY</code> (a few pages); the second a <code>SCAN</code>. The runner shows both plans, one result per statement.`},
    {lv:'adv', title:'Page size and page count (SQLite pragmas)', sql:`SELECT * FROM pragma_page_size(), pragma_page_count();`, why:`SQLite's page size (4096 bytes by default) and how many pages this whole small database occupies. In Postgres: <code>SELECT relpages FROM pg_class WHERE relname = 'orders';</code>`},
  ],
  tips: {
    say:`"Data lives in fixed-size pages; the engine reads whole pages and caches them in a buffer pool. Query cost is mostly the number of pages fetched from disk, which is why a full scan on a large table is slow and why indexes, which reduce pages touched, matter so much."`,
    points:[`Quote rough latencies (RAM ns, SSD µs, HDD ms) to show you reason about cost.`,`Mention the buffer pool / cache hit ratio.`,`Contrast row and column layouts.`],
    traps:[`Talking about "rows read" when the real unit is pages.`,`Assuming the OS cache and the DB cache are the same thing (Postgres relies on both).`],
    qa:[[`Why is SELECT * on a wide table slower even with an index?`,`More bytes per row → fewer rows per page → more pages; also no index-only scan and more network transfer.`],
        [`What's a dirty page?`,`A page modified in memory but not yet written to the data file. The WAL makes this safe; checkpoints flush them (7.1).`],
        [`Why does the second run of a query get faster?`,`Its pages are now in the buffer pool (and OS cache): no disk reads.`]]
  },
  exercises: [
    {lv:'E', q:`Show the query plan for finding products in category 'books'. Return the plan (run <code>EXPLAIN QUERY PLAN …</code>).`, hint:`Prefix the SELECT with EXPLAIN QUERY PLAN.`,
     sql:`EXPLAIN QUERY PLAN SELECT * FROM products WHERE category = 'books';`},
    {lv:'M', q:`A table has 10 million rows of 200 bytes each, 8 KB pages, ~90% fill. Roughly how many pages does a full scan read, and how long at 500 MB/s sequential read?`, hint:`rows per page ≈ 8192 × 0.9 / 200.`,
     answer:`<p>≈ 36 rows/page → ~278,000 pages ≈ 2.2 GB. At 500 MB/s that's ~4.5 s of pure I/O (less if cached). An index lookup touching ~4 pages takes well under a millisecond.</p>`},
    {lv:'M', q:`Count rows per table in the shop database in one result: <code>tbl, n</code>.`, hint:`UNION ALL of COUNT(*) per table.`,
     sql:`SELECT 'customers' AS tbl, COUNT(*) AS n FROM customers
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'logins', COUNT(*) FROM logins;`},
  ],
  quiz: [
    [`The basic unit of disk I/O in a database is…`,[`A row`,`A page/block`,`A column`,`A table`],1,`Whole pages are read and written.`,'E'],
    [`Without an index, WHERE customer_id = 7 on a heap table requires…`,[`Reading one page`,`Reading every page (full scan)`,`A hash lookup`,`Reading the WAL`],1,`Rows aren't ordered.`,'E'],
    [`What is the buffer pool?`,[`A pool of DB connections`,`An in-memory cache of data pages`,`A queue of transactions`,`A log file`],1,`Shared buffers in Postgres.`,'E'],
    [`Roughly how much slower is a random SSD read than a RAM access?`,[`2×`,`~1000×`,`1,000,000,000×`,`Same`],1,`~100 ns vs ~100 µs.`,'M'],
    [`A column store is best for…`,[`Fetching one whole customer row`,`Aggregating one column over billions of rows`,`High-rate single-row updates`,`Foreign key checks`],1,`Reads only needed columns.`,'M'],
    [`Postgres page size by default?`,[`4 KB`,`8 KB`,`16 KB`,`1 MB`],1,`InnoDB uses 16 KB.`,'M'],
  ],
  quizAdv: [
    [`Postgres ctid identifies a row by…`,[`Primary key`,`(page number, slot)`,`Transaction id`,`Hash of contents`],1,`Changes when the row is updated (new version).`,'H'],
    [`Why can indexes point to (page, slot) even after rows are compacted within the page?`,[`Rows never move`,`The slot array indirection: the slot number stays, its offset changes`,`Indexes are rebuilt`,`The WAL redirects`],1,`Slotted pages.`,'H'],
    [`A table scan in Postgres evicting the whole buffer cache is mitigated by…`,[`Nothing`,`Ring buffers for large sequential scans`,`Disabling the cache`,`Using hash indexes`],1,`Large scans use a small ring of buffers.`,'H'],
  ],
});
