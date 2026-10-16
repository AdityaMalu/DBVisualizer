/* 4.2 B+ tree indexes */
topic('4', { no:'4.2', title:'B+ tree indexes: search, range scan, insert and split', db:'shop',
idea:`The data structure behind almost every database index. Walk root → internal → leaf to find one key in 3 page reads, follow leaf links for a range query, then insert into a full leaf and watch it split and push a key up.`,
dgTitle:'B+ tree on orders(amount)', stateTitle:'Cost',
nodes:{
  r:{x:300,y:30,label:'40',w:70},
  iL:{x:150,y:110,label:'15 | 25',w:100},
  iR:{x:465,y:110,label:'60 | 80',w:100},
  l1:{x:40,y:205,label:'5 10',w:74},
  l2:{x:125,y:205,label:'15 20',w:74},
  l3:{x:210,y:205,label:'25 30 35',w:80},
  l3b:{x:295,y:205,label:'32 35',w:74},
  l4:{x:380,y:205,label:'40 50',w:74},
  l5:{x:465,y:205,label:'60 70',w:74},
  l6:{x:550,y:205,label:'80 90',w:74}
},
edges:[['r','iL'],['r','iR'],['iL','l1'],['iL','l2'],['iL','l3'],['iL','l3b'],['iR','l4'],['iR','l5'],['iR','l6']],
vb:'0 0 600 240',
codes:{a:`CREATE INDEX ix_amount ON orders(amount);

-- point lookup: root → internal → leaf
SELECT * FROM orders WHERE amount = 70;

-- range scan: find the first leaf, then follow leaf links →
SELECT * FROM orders WHERE amount BETWEEN 20 AND 50;

-- insert into a full leaf → split
INSERT INTO orders (…, amount) VALUES (…, 32);

-- leaf entries: (key, pointer to the row)  e.g. (70, page 812 slot 4)
-- internal entries: separator keys + child page pointers`},
steps:[
{hl:{q:[1]}, d:{hide:['l3b']}, g:[G('B+ tree',['balanced','every leaf at the same depth','hot'],['nodes','one page each'],['leaves','all keys, sorted, linked left → right'],['internal nodes','only separator keys + child pointers'])],
 say:`A <b>B+ tree</b> keeps keys <b>sorted</b> in a shallow, balanced tree of pages. Leaves hold every key with a pointer to its row and are linked to their neighbours. Internal nodes hold only <b>separator keys</b> that steer the search. Here: keys from 5 to 90, at most 3 per leaf (real pages hold hundreds).`},
{hl:{q:[4]}, d:{hide:['l3b'], on:['r','iR','l5'], e:[['r','iR','70 ≥ 40','hot'],['iR','l5','60 ≤ 70 < 80','hot']]}, g:[G('Find 70',['root','70 ≥ 40 → go right'],['internal','60 ≤ 70 < 80 → middle child'],['leaf','70 found → row pointer','ok'],['pages read','3 (= tree height)','ok'])], log:['root → internal → leaf: 3 page reads'],
 say:`<b>Point lookup</b> for 70: at the root, 70 ≥ 40, go right. In the internal node, 70 is between 60 and 80, take the middle child. The leaf contains 70 and a pointer to the row (e.g. page 812, slot 4). <b>Pages read = height of the tree</b>, here 3, versus every page for a full scan.`},
{hl:{}, d:{hide:['l3b']}, g:[G('Why so shallow',['fanout','~200-500 children per 8 KB page','hot'],['height 3','~500³ ≈ 125 million keys'],['height 4','~60 billion keys'],['top levels','almost always cached in RAM','ok'])], log:['100M rows → ~3-4 levels → 1-2 disk reads'],
 say:`Why is this so fast? Each internal page holds hundreds of separator keys, so the tree's <b>fanout</b> is huge: 3 levels index ~100 million rows, 4 levels tens of billions. The root and internal levels stay hot in the buffer pool, so a lookup typically costs 1–2 real disk reads. That's logarithmic search with a very large base.`},
{hl:{q:[7]}, d:{hide:['l3b'], on:['l2','l3','l4'], e:[['iL','l2','find 20','hot'],['l2','l3','','ok'],['l3','l4','next leaf →','ok']]}, g:[G('Range 20 … 50',['descend once','to the leaf containing 20'],['then','walk leaf links right until > 50','ok'],['returns','20, 25, 30, 35, 40, 50 in sorted order'],['also serves','ORDER BY amount, MIN/MAX','ok'])], log:['1 descent + 3 leaves'],
 say:`<b>Range scan</b> (BETWEEN 20 AND 50): descend once to the leaf containing 20, then follow the <b>leaf links</b> to the right, reading keys in order until passing 50. Because leaves are sorted and chained, the same structure serves <code>ORDER BY amount</code>, <code>MIN</code>/<code>MAX</code> and prefix searches without sorting. A hash index can't do any of that (4.6).`},
{hl:{q:[10]}, d:{on:['l3','l3b','iL'], labels:{l3:'25 30',iL:'15 | 25 | 32'}, e:[['iL','l3b','new child','ok']]}, g:[G('Insert 32',['target leaf','25 30 35 is full','bad'],['split','25 30 | 32 35','hot'],['push up','separator 32 into the parent','hot'],['parent full too?','split recursively; a root split grows the tree by one level'])], log:['leaf split: 1 page → 2 pages, parent updated'],
 say:`<b>Insert 32</b>: it belongs in leaf [25 30 35], which is full. The leaf <b>splits</b> into two half-full leaves [25 30] and [32 35], and the separator 32 is <b>pushed up</b> into the parent. If the parent is full, it splits too; if the root splits, the tree gains a level. That's how the tree stays balanced: it grows at the top, never unevenly at the bottom.`},
{hl:{}, d:{labels:{l3:'25 30',iL:'15 | 25 | 32'}}, g:[G('Costs',['lookup','O(log n) page reads'],['range','O(log n + matches)'],['insert/update/delete','also maintain every index','bad'],['random keys','splits all over the tree, fragmentation'],['sequential keys','append at the right edge','ok'])],
 say:`<b>Say it:</b> "A B+ tree is a balanced, high-fanout tree of pages with all keys sorted in linked leaves. A lookup reads one page per level, typically 3–4 for millions of rows; range queries descend once and then scan leaves in order, which also gives sorted output. Inserts may split pages, keeping the tree balanced. The trade-off is that every write must maintain every index."`}
],
keep:[`B+ tree: balanced, sorted; internal = separators, leaves = keys + row pointers, linked.`,`Lookup = tree height page reads (3–4 for ~100M rows thanks to huge fanout).`,`Range/ORDER BY: descend once, walk leaf links.`,`Full leaf → split + push separator up; root split grows height. Indexes cost writes.`]}, {
  imp: 'must',
  theory: TH(`A B+ tree index keeps keys sorted in a shallow balanced tree of pages, so finding a key or a range takes a handful of page reads instead of a full scan.`,
`<p>An index is like the index at the back of a textbook: sorted terms with page numbers, so you jump to the right page instead of reading the whole book. A B+ tree is that index organised as a tree: the top level tells you which section to look in, the next level which sub-section, and the bottom level (leaves) lists every key with its row location.</p>
<p>Because each level fans out to hundreds of children, even a huge table needs only 3 or 4 levels, and the top levels sit in memory. Leaves are linked like a chain, so once you find the start of a range you just walk along.</p>`,
[[`Root / internal node`,`Pages of separator keys and child pointers.`],[`Leaf node`,`Sorted keys with row pointers (or rows, in a clustered index).`],[`Fanout`,`Children per internal node; hundreds per page.`],[`Height`,`Levels from root to leaf; equals pages read per lookup.`],[`Page split`,`A full node divides in two and pushes a separator up.`],[`Leaf chain`,`Sibling pointers enabling range scans.`],[`Fill factor`,`How full pages are kept, leaving room for inserts.`]],
[`Search: compare the key with separators at each level and follow the matching child.`,`At the leaf, find the key and its row pointer.`,`Range: continue along leaf links.`,`Insert: add to the leaf; if full, split and push up a separator, recursively.`],
[`Every PRIMARY KEY and UNIQUE constraint is backed by a B-tree index.`,`Index the columns in WHERE, JOIN and ORDER BY of hot queries.`,`Time-ordered keys append to the right edge, keeping inserts cheap.`],
[`Indexing every column (each index slows writes and uses memory).`,`Random UUIDv4 keys causing splits everywhere.`,`Expecting an index to help a query that reads most of the table.`]),
  examples: [
    {lv:'basic', title:'Create an index and watch the plan change', sql:`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3;
CREATE INDEX ix_orders_customer ON orders(customer_id);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3;`, why:`Before: <code>SCAN orders</code>. After: <code>SEARCH orders USING INDEX ix_orders_customer (customer_id=?)</code>.`},
    {lv:'mid', title:'One index serves equality, ranges and ORDER BY', sql:`CREATE INDEX ix_products_price ON products(price);
EXPLAIN QUERY PLAN SELECT name FROM products WHERE price BETWEEN 30 AND 200 ORDER BY price;`, why:`<code>SEARCH … USING INDEX ix_products_price (price&gt;? AND price&lt;?)</code> and no separate sort step: leaves are already in price order.`},
    {lv:'adv', title:'MIN/MAX straight from the edge of the tree', sql:`CREATE INDEX ix_orders_date ON orders(order_date);
EXPLAIN QUERY PLAN SELECT MAX(order_date) FROM orders;
SELECT MAX(order_date) AS latest FROM orders;`, why:`The plan uses the index: the max is the right-most leaf entry, one descent, no scan.`},
  ],
  tips: {
    say:`"A B+ tree is a balanced, high-fanout tree where leaves hold all keys in sorted order with row pointers and are linked together. Lookups cost one page per level, three or four for hundreds of millions of rows; range queries descend once and walk the leaves, which also gives sorted output for ORDER BY. The price is write amplification: every insert updates every index and may split pages."`,
    points:[`Explain why height stays small (fanout) with numbers.`,`Distinguish B-tree from B+ tree (data only in leaves, linked leaves).`,`Mention write cost and page splits.`],
    traps:[`"Indexes make every query faster."`,`Calling it a binary tree.`],
    qa:[[`B-tree vs B+ tree?`,`A B-tree stores keys and data in internal nodes too; a B+ tree keeps data only in leaves and links them, giving higher fanout and efficient range scans. Databases use B+ trees (often just called B-trees).`],
        [`Why not a binary search tree?`,`Fanout 2 means ~27 levels for 100M keys: 27 random page reads. A B+ tree needs 3–4.`],
        [`What happens to an index when you insert a random key?`,`It goes into some leaf in the middle; if full, the page splits. Random keys spread splits and cache misses across the tree; sequential keys append at the right edge.`]]
  },
  exercises: [
    {lv:'E', q:`Create an index named <code>ix_customers_city</code> on <code>customers(city)</code> and show the plan for <code>SELECT name FROM customers WHERE city = 'Pune'</code>.`, hint:`CREATE INDEX …; EXPLAIN QUERY PLAN SELECT …`,
     sql:`CREATE INDEX ix_customers_city ON customers(city);
EXPLAIN QUERY PLAN SELECT name FROM customers WHERE city = 'Pune';`},
    {lv:'M', q:`An index has fanout 300 and its leaves hold 200 keys each. How many levels are needed for 1 billion keys? How many disk reads per lookup if the top two levels are cached?`, hint:`Leaves = 10⁹ / 200; then divide by 300 per level.`,
     answer:`<p>Leaves: 5,000,000. Level above: 16,667. Above: 56. Root: 1. So 4 levels (root, 56, 16,667, 5M leaves). With root and the 56-node level cached, a lookup reads ~2 pages from disk (internal + leaf), plus the heap page for the row.</p>`},
    {lv:'H', q:`Create an index named <code>ix_items_product</code> on <code>order_items(product_id)</code> and show the plan for counting lines of product 3.`, hint:`EXPLAIN QUERY PLAN SELECT COUNT(*) FROM order_items WHERE product_id = 3.`,
     sql:`CREATE INDEX ix_items_product ON order_items(product_id);
EXPLAIN QUERY PLAN SELECT COUNT(*) FROM order_items WHERE product_id = 3;`},
  ],
  quiz: [
    [`In a B+ tree, row pointers (or rows) are stored in…`,[`Only the root`,`Only the leaves`,`Every node`,`A separate hash table`],1,`Internal nodes hold separators only.`,'E'],
    [`A point lookup costs about…`,[`One page per tree level`,`One page per row in the table`,`Always exactly one page`,`log₂(n) pages`],0,`Height ~3–4.`,'E'],
    [`Why can a B+ tree serve range queries efficiently?`,[`It hashes ranges`,`Leaves are sorted and linked`,`It stores ranges in the root`,`It caches results`],1,`Descend once, then walk.`,'E'],
    [`What happens when inserting into a full leaf?`,[`The insert fails`,`The leaf splits and a separator is pushed to the parent`,`The tree is rebuilt`,`The key goes to an overflow file`],1,`Keeps the tree balanced.`,'M'],
    [`Why are B+ trees only 3–4 levels for 100M rows?`,[`Rows are small`,`High fanout: hundreds of children per page`,`They're binary`,`They store only 1000 keys`],1,`Height ≈ log_fanout(n).`,'M'],
    [`Downside of many indexes on a table?`,[`Slower reads`,`Every write must update every index`,`They make tables read-only`,`They break foreign keys`],1,`Write amplification + memory.`,'E'],
  ],
  quizAdv: [
    [`Inserting monotonically increasing keys into a B+ tree…`,[`Causes splits all over the tree`,`Appends at the rightmost leaf; databases often split 90/10 to keep pages full`,`Is impossible`,`Requires a rebuild`],1,`Right-edge inserts are cheap (but can be a hotspot under high concurrency).`,'H'],
    [`Fill factor below 100% on an index helps…`,[`Reads`,`Inserts/updates in the middle, by leaving room and reducing splits`,`Compression`,`Replication`],1,`Trade space for fewer splits.`,'H'],
    [`Postgres B-tree deduplication (v13+) improves…`,[`Unique indexes only`,`Indexes with many duplicate keys, by storing a key once with a list of row pointers`,`Hash joins`,`WAL size only`],1,`Smaller indexes.`,'H'],
  ],
});
