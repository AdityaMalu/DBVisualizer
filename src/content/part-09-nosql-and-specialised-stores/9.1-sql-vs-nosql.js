/* 9.1 SQL vs NoSQL: choosing a database */
topic('9', { no:'9.1', title:'SQL vs NoSQL: data models and how to choose', db:'shop',
idea:`One shop, five data models. See the same order stored relationally, as a document, as key-value pairs, as wide-column rows and as a graph, and the questions that decide which one fits: access patterns, relationships, consistency needs and scale.`,
stateTitle:'Model', tbTitle:'Same order, different shapes',
codes:{a:`-- relational: normalized tables + joins + transactions
orders(id, customer_id, …)  order_items(order_id, product_id, qty, …)

// document (MongoDB): the aggregate in one JSON document
{ _id: 101, customer: {id: 1, name: "Asha"},
  items: [{sku: "LAPTOP", qty: 1, price: 900}, {sku: "HEADPH", qty: 2, price: 110}] }

# key-value (Redis / DynamoDB): opaque value by key
GET order:101        →  "<serialized order>"

-- wide-column (Cassandra): table designed per query, partitioned by key
orders_by_customer (customer_id, order_date, order_id, total)  PRIMARY KEY ((customer_id), order_date)

// graph (Neo4j): nodes + relationships
(:Customer {name:"Asha"})-[:PLACED]->(:Order {id:101})-[:CONTAINS {qty:1}]->(:Product {name:"Laptop"})`},
steps:[
{hl:{q:[1,2]}, tb:[TB('relational',['table','rows for order 101'],[['orders','1'],['order_items','2'],['customers / products','referenced']])], g:[G('Relational (SQL)',['model','tables, rows, foreign keys'],['strengths','ad-hoc queries, joins, constraints, ACID','ok'],['schema','on write (enforced)'],['scaling','vertical + replicas; sharding is work'])],
 say:`<b>Relational</b> databases store normalized tables and join them at query time. Strengths: any question can be asked later with SQL, integrity is enforced with constraints, and multi-row transactions are ACID. It's the right default for most business data. Horizontal write scaling takes extra work (8.3).`},
{hl:{q:[4,5,6]}, tb:[TB('document',['_id','customer','items'],[[101,'{id 1, Asha}','[Laptop ×1, Headphones ×2]']],{0:'new'})], g:[G('Document (MongoDB, Couchbase)',['model','JSON-like documents, nested','hot'],['fits','aggregates read and written as a whole (an order with its lines)','ok'],['schema','flexible (on read)'],['weak at','many-to-many, cross-document joins'],['transactions','single-document atomic; multi-doc supported (with costs)'])],
 say:`A <b>document</b> database stores the whole aggregate (an order with its items and a customer snapshot) as one JSON document. One read fetches everything the order page needs, and the schema can vary per document. It gets awkward when data is highly connected (many-to-many) or needs joins across documents.`},
{hl:{q:[8,9]}, tb:[TB('key-value',['key','value'],[['order:101','<blob>'],['session:ab12','{user: 1, cart: …}'],['rate:ip:1.2.3.4','17']])], g:[G('Key-value (Redis, DynamoDB, etcd)',['model','key → value, lookup by key only'],['strengths','very fast, simple, scales horizontally','ok'],['weak at','queries by anything but the key','bad'],['used for','caches, sessions, counters, rate limits, feature flags'])],
 say:`<b>Key-value</b> stores map a key to a value and do almost nothing else: get, put, delete (Redis adds data structures, 9.2). They're extremely fast and easy to scale, perfect for caches, sessions and counters, and useless for "find all orders over 500".`},
{hl:{q:[11,12]}, tb:[TB('orders_by_customer (partition = customer 1)',['customer_id','order_date','order_id'],[[1,'2024-03-18',108],[1,'2024-02-02',103],[1,'2024-01-05',101]])], g:[G('Wide-column (Cassandra, ScyllaDB, Bigtable, HBase)',['model','partition key → sorted rows'],['design','one table per query (denormalized)','hot'],['strengths','huge write throughput, multi-DC, linear scale','ok'],['weak at','ad-hoc queries, joins, aggregations','bad'])],
 say:`<b>Wide-column</b> stores (Cassandra, ScyllaDB, Bigtable) group rows by a partition key and keep them sorted inside the partition. You design a table <b>per query</b> ("orders by customer, newest first") and duplicate data across tables. They handle massive write volumes across data centres, but you can't ask questions you didn't design for (9.4).`},
{hl:{q:[14,15]}, tb:[TB('graph',['node','edge','node'],[['Customer Asha','PLACED','Order 101'],['Order 101','CONTAINS','Laptop'],['Asha','FOLLOWS','Ben']])], g:[G('Graph (Neo4j, Neptune)',['model','nodes + typed relationships with properties'],['strengths','multi-hop traversals: friends-of-friends, paths, fraud rings','ok'],['weak at','bulk aggregations, sharding','bad'])],
 say:`<b>Graph</b> databases store nodes and relationships as first-class citizens, so queries that hop through many relationships ("customers who bought what my friends bought", shortest paths, fraud rings) stay fast where SQL would need many self-joins or recursive CTEs (9.5).`},
{hl:{}, tb:[], g:[G('How to choose',['access patterns','known & key-based → NoSQL fits; ad-hoc → SQL'],['relationships','many joins / M:N → relational or graph'],['consistency','multi-row invariants, money → ACID SQL','ok'],['scale','writes beyond one node → sharded SQL or wide-column'],['shape','variable nested data → document / JSONB'],['team & ops','what you can run well']), G('Polyglot persistence',['use several','Postgres + Redis + Elasticsearch is common'])],
 say:`<b>Say it:</b> "NoSQL isn't one thing: key-value, document, wide-column and graph models each trade query flexibility and transactions for a specific strength. I start from access patterns, relationships and consistency needs: relational for general business data with joins and ACID, key-value for caches and sessions, documents for self-contained aggregates, wide-column for massive write-heavy time-ordered data, graph for deep relationships, often several together. Modern Postgres with JSONB covers many 'document' needs too."`}
],
keep:[`Relational: joins, constraints, ACID, ad-hoc SQL. Default for business data.`,`Document: aggregate per document, flexible schema; weak at M:N joins.`,`Key-value: get/put by key; caches, sessions, counters.`,`Wide-column: partition + sorted rows; table per query; huge writes.`,`Graph: multi-hop relationship queries.`,`Choose by access patterns, relationships, consistency, scale; polyglot is normal.`]}, {
  imp: 'must',
  theory: TH(`"NoSQL" covers several non-relational data models (key-value, document, wide-column, graph), each optimised for particular access patterns at the cost of the relational model's flexibility and guarantees.`,
`<p>Relational databases are a general-purpose toolbox: any question, strong guarantees, but scaling writes across many machines takes effort. NoSQL databases are specialised tools: they shape the data around how it will be read and written, which lets them scale out easily or answer certain queries very fast, but you give up some flexibility (joins, ad-hoc queries) or guarantees (multi-row transactions).</p>
<p>The choice isn't "old vs new"; it's matching the data model to the problem. Many systems use several.</p>`,
[[`Key-value store`,`Value looked up by key only.`],[`Document store`,`Nested JSON-like documents, queried by fields.`],[`Wide-column store`,`Rows grouped by partition key and sorted by clustering keys.`],[`Graph database`,`Nodes and relationships, optimised for traversals.`],[`Schema-on-write / on-read`,`Enforced at write time / interpreted at read time.`],[`Aggregate`,`A cluster of data treated as a unit (an order with its lines).`],[`Polyglot persistence`,`Using different stores for different needs.`]],
[`List the main queries and write patterns, with volumes.`,`Identify relationships and invariants (what must be atomic).`,`Pick the model that serves the main access patterns natively.`,`Add specialised stores (cache, search) for secondary needs.`],
[`Postgres as system of record, Redis for caching/sessions, Elasticsearch for search, a warehouse for analytics.`,`DynamoDB/Cassandra for very high-scale, key-based workloads.`,`Neo4j for recommendations or fraud detection.`],
[`Choosing NoSQL "for scale" without a scale problem.`,`Using a document DB for highly relational data and reinventing joins in app code.`,`Ignoring that many NoSQL stores have weaker transactions/consistency by default.`,`Not knowing your queries before designing a Cassandra/DynamoDB schema.`]),
  examples: [
    {lv:'basic', title:'Relational: the order assembled by joins', sql:`SELECT o.id, c.name AS customer, p.name AS product, oi.qty, oi.unit_price
FROM orders o
JOIN customers c   ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p    ON p.id = oi.product_id
WHERE o.id = 101;`, why:`Normalized data recombined at read time: three joins for one order.`},
    {lv:'mid', title:'Document shape from relational data (JSON)', sql:`SELECT json_object(
         '_id', o.id,
         'customer', json_object('id', c.id, 'name', c.name),
         'items', (SELECT json_group_array(json_object('product', p.name, 'qty', oi.qty, 'price', oi.unit_price))
                   FROM order_items oi JOIN products p ON p.id = oi.product_id
                   WHERE oi.order_id = o.id)
       ) AS document
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE o.id = 101;`, why:`What a document database would store: the whole aggregate, pre-joined, in one value.`},
    {lv:'adv', title:'Wide-column style: a table designed for one query', sql:`CREATE TABLE orders_by_customer AS
SELECT o.customer_id, o.order_date, o.id AS order_id,
       (SELECT SUM(qty * unit_price) FROM order_items WHERE order_id = o.id) AS total
FROM orders o;
CREATE INDEX ix_obc ON orders_by_customer(customer_id, order_date DESC);
SELECT order_date, order_id, total FROM orders_by_customer
WHERE customer_id = 1 ORDER BY order_date DESC;`, why:`Denormalized, keyed and sorted for exactly one access pattern ("a customer's orders, newest first"), which is how Cassandra tables are designed.`},
  ],
  tips: {
    say:`"I choose by access patterns, relationships and consistency needs rather than hype. Relational is my default for business data that needs joins, constraints and transactions. Key-value for caches and sessions, documents for self-contained aggregates with flexible shape, wide-column for huge write-heavy key-based workloads, graph for deep relationship queries, and I'm comfortable combining them."`,
    points:[`Classify the four NoSQL families with one use case each.`,`Mention trade-offs: joins, transactions, ad-hoc queries.`,`Note Postgres JSONB as a middle ground.`],
    traps:[`"NoSQL scales, SQL doesn't."`,`Picking MongoDB for a highly relational domain without discussing joins.`],
    qa:[[`When would you choose MongoDB over Postgres?`,`Self-contained documents with varying shape, read/written as a unit, with little cross-document joining, and a team comfortable with its consistency/transaction model. Postgres + JSONB often covers this too.`],
        [`Why can't you just add a WHERE on any column in Cassandra?`,`Data is partitioned and sorted by the primary key; queries must target a partition (and clustering prefix) or scan the whole cluster. You model tables around queries.`],
        [`What is polyglot persistence?`,`Using multiple data stores, each for what it's best at, e.g. Postgres (system of record), Redis (cache), Elasticsearch (search), S3 + warehouse (analytics).`]]
  },
  exercises: [
    {lv:'E', q:`Produce a key-value style view: one row per order with key <code>'order:' || id</code> and value <code>status</code>. Return <code>k, v</code>.`, hint:`String concatenation with ||.`,
     sql:`SELECT 'order:' || id AS k, status AS v FROM orders;`},
    {lv:'M', q:`Build the document for customer 3: <code>{"name": …, "orders": [order ids]}</code> as a single column <code>doc</code>.`, hint:`json_object + json_group_array over a subquery.`,
     sql:`SELECT json_object('name', c.name,
                   'orders', (SELECT json_group_array(o.id) FROM orders o WHERE o.customer_id = c.id)) AS doc
FROM customers c WHERE c.id = 3;`},
    {lv:'H', q:`Pick a primary store (and any secondary stores) for: (a) a social network's follow graph and "people you may know", (b) a URL shortener at 100k reads/s, (c) a bank's ledger, (d) IoT sensor readings at 2M writes/s, (e) a product catalog with category-specific attributes and full-text search.`, hint:`Match the access pattern.`,
     answer:`(a) graph DB (or sharded SQL adjacency lists + precomputed recommendations) · (b) key-value (DynamoDB/Redis) with a cache/CDN · (c) relational ACID (Postgres/Oracle), append-only ledger tables · (d) wide-column or time-series DB (Cassandra/ScyllaDB/TimescaleDB/ClickHouse) · (e) Postgres with JSONB for attributes + Elasticsearch/OpenSearch for search.`},
  ],
  quiz: [
    [`Which model is best for "friends of friends who like X"?`,[`Key-value`,`Graph`,`Column store`,`Blob storage`],1,`Multi-hop traversals.`,'E'],
    [`A key-value store is weak at…`,[`Lookups by key`,`Queries by attributes other than the key`,`Caching`,`Session storage`],1,`Get/put by key only.`,'E'],
    [`In Cassandra you typically design…`,[`One normalized schema`,`One table per query pattern (denormalized)`,`Tables with joins`,`Only key-value pairs`],1,`Query-first modeling.`,'M'],
    [`Document databases fit best when…`,[`Data is highly relational with many joins`,`Data forms self-contained aggregates read/written as a unit`,`You need multi-table ACID constantly`,`You need graph traversals`],1,`An order with its lines.`,'E'],
    [`Strongest reason to choose a relational DB?`,[`Hype`,`Ad-hoc queries, joins, constraints and ACID transactions over related data`,`Unlimited write scale`,`No schema`],1,`General-purpose default.`,'E'],
    [`Polyglot persistence means…`,[`Writing SQL in many languages`,`Using several data stores, each for its strengths`,`Multi-master replication`,`Sharding`],1,`E.g. Postgres + Redis + Elasticsearch.`,'M'],
  ],
  quizAdv: [
    [`Schema-on-read means…`,[`No schema exists`,`Structure is interpreted when reading; the app must handle varying shapes`,`Schema enforced on write`,`Indexes are optional`],1,`Flexibility moves validation into code.`,'H'],
    [`DynamoDB single-table design aims to…`,[`Normalize data`,`Serve multiple entity types and access patterns from one table via composite keys and GSIs`,`Use joins`,`Avoid partition keys`],1,`Query-first modeling.`,'H'],
    [`Why can document stores struggle with many-to-many relationships?`,[`They can't store arrays`,`No efficient joins: you either duplicate data (and keep copies in sync) or do multiple queries in the app`,`Documents are too small`,`They lack indexes`],1,`Relational or graph models fit better.`,'H'],
  ],
});
