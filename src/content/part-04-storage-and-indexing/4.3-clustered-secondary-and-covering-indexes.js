/* 4.3 Clustered vs secondary indexes, covering indexes */
topic('4', { no:'4.3', title:'Clustered vs secondary indexes, covering and index-only scans', db:'shop',
idea:`Where do the rows actually live? Compare InnoDB, where the table IS the primary-key B+ tree and secondary indexes store the PK, with PostgreSQL heaps where every index points at (page, slot). Then remove the extra lookup entirely with a covering index.`,
dgTitle:'Index lookup path', stateTitle:'Lookup cost',
nodes:{
  sec:{x:90,y:50,label:'secondary index\n(email)',w:150,h:46},
  pk:{x:300,y:50,label:'clustered PK tree\n(id → full row)',w:170,h:46,kind:'lock'},
  heap:{x:300,y:170,label:'heap pages\n(rows, unordered)',w:170,h:46,kind:'db'},
  pgix:{x:90,y:170,label:'index (email)\n→ ctid',w:150,h:46},
  cov:{x:510,y:110,label:'covering index\n(customer_id, status)',w:170,h:46}
},
edges:[],
vb:'0 0 600 220',
codes:{a:`-- MySQL InnoDB: the table is clustered on the primary key
SELECT * FROM customers WHERE email = 'ben@mail.com';
--   secondary index (email) → primary key 2 → clustered tree → row

-- PostgreSQL: heap table, every index stores the row's ctid
--   index (email) → ctid (page 0, slot 2) → heap page → row

-- covering index: everything the query needs is in the index
CREATE INDEX ix_orders_cust_status ON orders(customer_id, status);
SELECT status FROM orders WHERE customer_id = 1;   -- index-only scan
-- Postgres:   CREATE INDEX … ON orders(customer_id) INCLUDE (status);
-- SQL Server: CREATE INDEX … ON orders(customer_id) INCLUDE (status);`},
steps:[
{hl:{q:[1]}, d:{hide:['heap','pgix','cov'], on:['pk']}, g:[G('Clustered index',['what','rows stored IN the index leaves, sorted by key','hot'],['InnoDB, SQL Server, Oracle IOT','the table is the PK B+ tree'],['how many','one per table (rows can only be sorted one way)'],['bonus','range scans by PK read contiguous pages','ok'])],
 say:`A <b>clustered index</b> stores the actual rows in its leaves, in key order. In MySQL InnoDB the table <i>is</i> the primary key's B+ tree. There can be only one, because rows can be physically ordered only one way. Range queries on the primary key read neighbouring pages.`},
{hl:{q:[2,3]}, d:{hide:['heap','pgix','cov'], on:['sec','pk'], e:[['sec','pk','PK = 2','hot']]}, g:[G('InnoDB secondary lookup',['1','search email index → finds PK 2'],['2','search clustered tree by PK 2 → row','hot'],['cost','two B+ tree descents'],['leaf entries','(email, primary key), not a physical address'])], log:['email index → PK 2 → clustered index → row'],
 say:`A <b>secondary index</b> in InnoDB stores (indexed column, primary key). Finding Ben by email descends the email index to get PK 2, then descends the clustered tree to fetch the row: a <b>double lookup</b>. That's why InnoDB primary keys should be short: every secondary index entry contains a copy of it.`},
{hl:{q:[5,6]}, d:{hide:['sec','pk','cov'], on:['pgix','heap'], e:[['pgix','heap','ctid (0,2)','hot']]}, g:[G('Postgres (heap table)',['every index','secondary-like: stores ctid (page, slot)'],['lookup','index → heap page','hot'],['no clustered index','CLUSTER reorders once, not maintained'],['update moves row','new ctid → indexes updated (unless HOT)'])], log:['email index → ctid (0,2) → heap page 0'],
 say:`PostgreSQL has no clustered indexes: rows live in an unordered <b>heap</b> (4.1), and every index, including the primary key, stores the row's physical address (ctid). A lookup is index → heap page. The <code>CLUSTER</code> command sorts the heap once but doesn't maintain the order afterwards.`},
{hl:{q:[9,10]}, d:{hide:['sec','pk','pgix'], on:['cov'], e:[]}, g:[G('Covering index',['query needs','customer_id (filter) + status (output)'],['index has','both columns','ok'],['result','index-only scan: never touches the table','ok'],['Postgres caveat','visibility map must say the page is all-visible (VACUUM)'])], log:['index-only scan: 0 table pages read'],
 say:`A <b>covering index</b> contains every column the query needs, so the engine answers from the index alone: an <b>index-only scan</b>, skipping the table lookup entirely. This is one of the biggest wins for hot queries. In Postgres it also requires the visibility map to mark pages all-visible, which VACUUM maintains (6.5).`},
{hl:{q:[11,12]}, d:{hide:['sec','pk','pgix'], on:['cov']}, g:[G('INCLUDE columns',['key columns','searchable, sorted'],['INCLUDE columns','stored in leaves only, not searchable','hot'],['why','cover a query without bloating the tree\'s upper levels or the uniqueness key'],['support','Postgres 11+, SQL Server'])],
 say:`<b>INCLUDE</b> adds payload columns to the leaves only: they make the index covering without being part of the search key. Useful with a UNIQUE index (<code>UNIQUE (email) INCLUDE (name)</code>) where you can't add name to the key without changing what's unique.`},
{hl:{}, d:{e:[['sec','pk','InnoDB',''],['pgix','heap','Postgres','']]}, g:[G('Cost of a lookup',['heap / secondary','index descent + table page per row'],['clustered by PK','one descent; ranges contiguous','ok'],['covering','index only','ok'],['many matching rows via secondary','random table reads: a scan may be cheaper','bad'])],
 say:`<b>Say it:</b> "A clustered index stores the rows themselves in key order, one per table, as in InnoDB. Secondary indexes point to the row, via the primary key in InnoDB or the physical ctid in Postgres, so they need an extra lookup. A covering index includes every column the query needs, enabling an index-only scan with no table access." When a secondary index matches many rows, the random table reads add up and the optimizer may prefer a full scan (4.5).`}
],
keep:[`Clustered = rows in the index leaves, sorted by key; one per table (InnoDB PK).`,`InnoDB secondary → PK → clustered tree (double lookup). Keep PKs short.`,`Postgres: heap + every index stores ctid; no maintained clustering.`,`Covering index → index-only scan. INCLUDE adds non-key payload columns.`]}, {
  imp: 'must',
  theory: TH(`A clustered index stores the table's rows in index order; secondary indexes store pointers to rows; a covering index holds every column a query needs so the table isn't touched at all.`,
`<p>Think of a dictionary: the words <i>are</i> the content and they're in alphabetical order, so the dictionary is "clustered" on the word. A textbook's back index is "secondary": it gives you page numbers, and you still flip to the page. If the back index also printed the one fact you wanted next to each term, you'd never open the page: that's a <b>covering</b> index.</p>`,
[[`Clustered index`,`Leaves contain the rows; table ordered by the key.`],[`Secondary (non-clustered) index`,`Leaves contain keys + row locators.`],[`Row locator`,`Primary key (InnoDB) or physical address (Postgres ctid, SQL Server RID).`],[`Covering index`,`Contains all columns a query reads.`],[`Index-only scan`,`Answering a query from the index without the table.`],[`INCLUDE`,`Non-key columns stored only in leaves.`],[`Bookmark / key lookup`,`The extra fetch from index to table.`]],
[`Search the index for matching keys.`,`If the index covers the query, return from the index.`,`Otherwise, follow each locator to the table (PK descent or heap page).`,`Return rows.`],
[`Choose a short, monotonically increasing PK for InnoDB.`,`Make the top few queries covering (composite or INCLUDE).`,`Look for "Key Lookup"/"Heap Fetches" in plans as the cost of non-covering indexes.`],
[`Wide or random PKs in InnoDB (bloats every secondary index, fragments the table).`,`Adding many INCLUDE columns until indexes rival the table in size.`,`Expecting index-only scans in Postgres on tables that are never vacuumed.`]),
  examples: [
    {lv:'basic', title:'Rowid tables in SQLite are clustered on the rowid', sql:`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE id BETWEEN 103 AND 106;`, why:`<code>INTEGER PRIMARY KEY</code> is the rowid: SQLite stores rows in a B-tree keyed by it, so this is a range search on the clustered key.`},
    {lv:'mid', title:'A covering index: no table access', sql:`CREATE INDEX ix_orders_cust_status ON orders(customer_id, status);
EXPLAIN QUERY PLAN SELECT status FROM orders WHERE customer_id = 1;`, why:`SQLite reports <code>USING COVERING INDEX</code>: both the filter and the output column are in the index.`},
    {lv:'adv', title:'Same index, not covering once you ask for more', sql:`CREATE INDEX ix_orders_cust_status ON orders(customer_id, status);
EXPLAIN QUERY PLAN SELECT status, order_date FROM orders WHERE customer_id = 1;`, why:`order_date isn't in the index, so the plan says <code>USING INDEX</code> (not COVERING): each match needs a table lookup. Adding order_date to the index would cover it again.`},
  ],
  tips: {
    say:`"A clustered index stores the rows in key order, one per table; InnoDB clusters on the primary key, so secondary indexes store the PK and need a second lookup. Postgres uses heaps and every index points at a physical ctid. For hot queries I make the index covering, with composite keys or INCLUDE, to get index-only scans."`,
    points:[`Explain the InnoDB double lookup and why short PKs matter.`,`Know Postgres has no maintained clustered index.`,`Recognise covering-index opportunities in a query.`],
    traps:[`"A table can have several clustered indexes."`,`Assuming the PK is clustered in every database (not in Postgres).`],
    qa:[[`Clustered vs non-clustered index?`,`Clustered: leaves are the rows, one per table, defines physical order. Non-clustered: leaves hold keys and row locators; many per table.`],
        [`Why are random UUID PKs bad in InnoDB specifically?`,`The PK is the clustered index, so random keys scatter row inserts across the table (splits, fragmentation), and the 16-byte key is copied into every secondary index.`],
        [`When does a covering index stop helping?`,`When the query needs a column not in it, or (Postgres) when pages aren't all-visible and heap checks are still needed.`]]
  },
  exercises: [
    {lv:'E', q:`Create <code>ix_items_order_qty</code> on <code>order_items(order_id, qty)</code> and show the plan for <code>SELECT qty FROM order_items WHERE order_id = 101</code>.`, hint:`Expect a covering index… or the PK, whichever SQLite prefers. Just run it and look.`,
     sql:`CREATE INDEX ix_items_order_qty ON order_items(order_id, qty);
EXPLAIN QUERY PLAN SELECT qty FROM order_items WHERE order_id = 101;`},
    {lv:'M', q:`Make this query use a covering index: <code>SELECT name FROM customers WHERE city = 'Pune'</code>. Create an index named <code>ix_cust_city_name</code> and return the plan.`, hint:`Put both columns in the index: (city, name).`,
     sql:`CREATE INDEX ix_cust_city_name ON customers(city, name);
EXPLAIN QUERY PLAN SELECT name FROM customers WHERE city = 'Pune';`},
    {lv:'H', q:`InnoDB table <code>events(id CHAR(36) UUID PK, user_id, type, created_at, payload JSON)</code> with 5 secondary indexes, 2B rows, write-heavy. List the problems and your fixes.`, hint:`Clustered PK width and randomness.`,
     answer:`<ul><li>Random 36-char UUID PK → random inserts into the clustered tree (page splits, fragmentation, poor buffer pool locality).</li><li>Each of 5 secondary indexes stores the 36-byte PK per entry → huge indexes.</li><li>Fix: BIGINT auto-increment or 16-byte binary UUIDv7 PK (time-ordered); keep the public UUID as a separate UNIQUE column if needed.</li><li>Drop unused secondary indexes; make hot queries covering; consider partitioning by created_at (8.3).</li></ul>`},
  ],
  quiz: [
    [`How many clustered indexes can a table have?`,[`One`,`Two`,`One per column`,`Unlimited`],0,`Rows have one physical order.`,'E'],
    [`In InnoDB, a secondary index leaf stores…`,[`The full row`,`The indexed columns + the primary key`,`A physical page address`,`Nothing`],1,`Then the clustered tree is searched.`,'M'],
    [`An index-only scan happens when…`,[`The table is empty`,`The index contains every column the query needs`,`The index is clustered`,`There's no WHERE clause`],1,`Covering index.`,'E'],
    [`PostgreSQL tables are stored as…`,[`Clustered PK B-trees`,`Heaps; indexes point to ctids`,`LSM trees`,`Column stores`],1,`CLUSTER reorders once only.`,'M'],
    [`INCLUDE columns in an index are…`,[`Part of the search key`,`Stored in leaves only, to cover queries`,`Hashed`,`Unique`],1,`Payload, not key.`,'M'],
    [`Why keep InnoDB primary keys short?`,[`Faster DDL`,`They're copied into every secondary index entry`,`InnoDB limits PK length to 8 bytes`,`For replication`],1,`Index size and cache efficiency.`,'M'],
  ],
  quizAdv: [
    [`Postgres index-only scans still visit the heap when…`,[`Never`,`The visibility map doesn't mark the page all-visible`,`The index is unique`,`work_mem is low`],1,`VACUUM keeps the map current.`,'H'],
    [`A HOT update in Postgres avoids…`,[`WAL writes`,`Updating indexes, when no indexed column changes and the new version fits on the same page`,`Locks`,`Visibility checks`],1,`Heap-only tuple.`,'H'],
    [`SQL Server heap table (no clustered index) secondary indexes store…`,[`The PK`,`A RID (file, page, slot)`,`Nothing`,`The full row`],1,`Like Postgres ctid.`,'H'],
  ],
});
