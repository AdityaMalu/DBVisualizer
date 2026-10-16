/* 8.3 Partitioning and sharding */
topic('8', { no:'8.3', title:'Partitioning and sharding: range, hash, directory; hot spots and cross-shard queries', db:'shop',
idea:`When one machine can't hold the data or the writes, split it. Compare table partitioning inside one database with sharding across many, then route orders by range, by hash and through a lookup directory, and see the costs: hot spots, resharding and cross-shard queries.`,
dgTitle:'Shards', stateTitle:'Strategy', tbTitle:'Routing',
nodes:{
  app:{x:60,y:110,label:'app / router',w:120,kind:'actor'},
  s0:{x:300,y:30,label:'shard 0',w:120,h:42,kind:'db'},
  s1:{x:300,y:110,label:'shard 1',w:120,h:42,kind:'db'},
  s2:{x:300,y:190,label:'shard 2',w:120,h:42,kind:'db'},
  dir:{x:470,y:110,label:'directory\n(key → shard)',w:130,h:46,kind:'lock'}
},
edges:[['app','s0'],['app','s1'],['app','s2']],
vb:'0 0 540 230',
codes:{a:`-- partitioning inside ONE database (Postgres declarative partitioning)
CREATE TABLE orders (id BIGINT, customer_id BIGINT, created_at DATE, …)
  PARTITION BY RANGE (created_at);
CREATE TABLE orders_2024_03 PARTITION OF orders
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
DROP TABLE orders_2023_01;               -- delete a month instantly

-- sharding ACROSS databases: the app (or a proxy) routes by shard key
range:      customer_id 1–1M → shard 0, 1M–2M → shard 1, …
hash:       shard = hash(customer_id) % 3
directory:  lookup table customer_id → shard (flexible, extra hop)

-- queries WITH the shard key hit one shard; without it, ALL shards
SELECT * FROM orders WHERE customer_id = 42;      -- 1 shard
SELECT * FROM orders WHERE created_at = today;    -- scatter-gather`},
steps:[
{hl:{q:[1,2,3,4,5,6]}, d:null, tb:[TB('orders partitions (one database)',['partition','range'],[['orders_2024_01','Jan'],['orders_2024_02','Feb'],['orders_2024_03','Mar']],{2:'hot'})], g:[G('Partitioning (one DB)',['split','a big table into child tables by key'],['pruning','WHERE created_at in March → only March partition','ok'],['retention','DROP/DETACH old partition instantly','ok'],['limits','still one server\'s CPU, RAM, disk'])],
 say:`<b>Partitioning</b> splits one large table into smaller pieces <i>within the same database</i>, e.g. one partition per month. Queries that filter on the partition key only touch relevant partitions (<b>partition pruning</b>), indexes stay small, and deleting a month of old data becomes <code>DROP TABLE</code> instead of a huge DELETE. It doesn't add hardware, though.`},
{hl:{q:[8]}, d:{hide:['dir'], on:['app','s0','s1','s2']}, g:[G('Sharding (many DBs)',['split data across servers','each shard = independent database','hot'],['scales','writes, storage, and reads','ok'],['shard key','decides where each row lives'],['costs','routing, cross-shard queries, transactions, rebalancing','bad'])],
 say:`<b>Sharding</b> (horizontal partitioning across machines) puts different rows on different database servers, so storage and <b>write throughput</b> scale with the number of shards, which replication alone can't do. Everything hinges on the <b>shard key</b>: the column that decides which shard a row lives on. It's a big step in complexity, so it comes after vertical scaling, read replicas and caching.`},
{hl:{q:[9]}, d:{hide:['dir'], on:['s2'], e:[['app','s2','new customers →','bad']]}, tb:[TB('range sharding by customer_id',['range','shard','load'],[['1 – 1M','0','old, quiet'],['1M – 2M','1','medium'],['2M – …','2','ALL new signups','bad']],{2:'bad'})], g:[G('Range',['pros','range scans on the key stay on one shard','ok'],['pros','easy to split a range'],['cons','sequential keys → hot spot on the last shard','bad'])],
 say:`<b>Range sharding</b> assigns key ranges to shards. Range queries on the key stay local and splitting a big range is easy. But monotonically increasing keys (ids, timestamps) send all new writes to the <b>last shard</b>: a <b>hot spot</b>, while old shards idle.`},
{hl:{q:[10]}, d:{hide:['dir'], on:['s0','s1','s2'], e:[['app','s0','id 3, 6, 9','ok'],['app','s1','id 1, 4, 7','ok'],['app','s2','id 2, 5, 8','ok']]}, tb:[TB('hash sharding: id % 3',['customer_id','shard'],[[1,1],[2,2],[3,0],[4,1],[5,2]])], g:[G('Hash',['pros','even spread, no sequential hot spot','ok'],['cons','range queries hit every shard','bad'],['cons','% N: adding a shard moves almost every key','bad'],['fix','consistent hashing / fixed virtual buckets (8.4)','ok'])],
 say:`<b>Hash sharding</b> sends each key to <code>hash(key) % N</code>. Keys spread evenly, so no sequential hot spot. But ranges are scattered across all shards, and with plain modulo, going from 3 to 4 shards changes the shard of ~75% of keys: a massive data migration. Consistent hashing or a fixed number of virtual buckets solves that (8.4).`},
{hl:{q:[11]}, d:{on:['dir'], e:[['app','dir','where is 42?','hot'],['dir','s1','shard 1','ok']]}, g:[G('Directory / lookup',['table','key (or tenant) → shard'],['pros','move any tenant anytime; isolate big tenants','ok'],['cons','extra lookup (cache it); directory must be HA','bad'])],
 say:`<b>Directory-based sharding</b> keeps a lookup table mapping each key (often a tenant) to a shard. Maximum flexibility: move a noisy tenant to its own shard, rebalance gradually. The cost is an extra lookup per request (cached) and the directory becomes critical infrastructure.`},
{hl:{q:[13,14,15]}, d:{hide:['dir'], on:['s0','s1','s2'], e:[['app','s0','?','hot'],['app','s1','?','hot'],['app','s2','?','hot']]}, g:[G('Query routing',['WHERE customer_id = 42','one shard','ok'],['WHERE created_at = today','scatter-gather to all shards','bad'],['JOIN across shards','app-side or a distributed engine','bad'],['transactions across shards','2PC or sagas (8.6)','bad'],['global UNIQUE','hard: per shard only'])],
 say:`Pick the shard key so that your <b>main queries include it</b>: then each query touches one shard. Queries without it must <b>scatter-gather</b> across all shards. Cross-shard joins, transactions and global unique constraints become hard. Co-locate data that's used together (all of a customer's orders on the customer's shard).`},
{hl:{}, d:{}, g:[G('Choosing a shard key',['high cardinality','many distinct values','ok'],['even load','no celebrity keys, no sequential hot spot','ok'],['in most queries','avoid scatter-gather','ok'],['co-location','related rows together (tenant_id, customer_id)','ok']), G('Before sharding',['vertical scaling, indexes, query fixes'],['read replicas, caching'],['partitioning'],['then: Citus, Vitess, CockroachDB, YugabyteDB…'])],
 say:`<b>Say it:</b> "Partitioning splits a table inside one database for pruning and easy retention; sharding spreads rows across servers to scale storage and writes. Range sharding keeps ranges local but creates hot spots with sequential keys; hash sharding spreads load but scatters ranges and needs consistent hashing to rebalance; directory sharding is flexible at the cost of a lookup. I choose a high-cardinality key that appears in most queries and co-locates related data, and I shard only after exhausting simpler options."`}
],
keep:[`Partitioning = split a table inside one DB (pruning, cheap retention). Sharding = across servers (scales writes).`,`Range: local ranges, hot spots with sequential keys. Hash: even, ranges scatter; modulo resharding moves most keys.`,`Directory: flexible, extra lookup.`,`Shard key: high cardinality, even load, present in most queries, co-locates related data.`,`Costs: scatter-gather, cross-shard joins/transactions, global uniqueness, rebalancing.`]}, {
  imp: 'must',
  theory: TH(`Partitioning splits a large table into pieces; sharding places those pieces on different servers so storage and write load can grow beyond one machine.`,
`<p>A single server has limits: disk size, write throughput, memory. Replication copies the same data everywhere, so it doesn't help with writes. Sharding splits the data so each server owns a slice: customers A–F on one server, G–M on the next, and so on.</p>
<p>It's like a library outgrowing its building: instead of photocopying every book into a second building (replication), you move whole sections to new buildings (sharding). Finding a book is easy if you know its section (the shard key); browsing "all books published in 2024" means visiting every building.</p>`,
[[`Partition`,`A subset of a table's rows, defined by a key.`],[`Partition pruning`,`Skipping partitions that can't match a filter.`],[`Shard`,`A partition living on its own server.`],[`Shard key`,`Column(s) deciding the shard.`],[`Range / hash / directory sharding`,`Ranges of keys / hash of key / lookup table.`],[`Hot spot`,`A shard receiving disproportionate load.`],[`Scatter-gather`,`Query sent to all shards, results merged.`],[`Rebalancing / resharding`,`Moving data when shards are added.`]],
[`Choose a partition/shard key from the access patterns.`,`Route each write to its partition/shard by key.`,`Route reads that include the key to one shard; others fan out.`,`Rebalance by moving ranges/buckets when adding capacity.`],
[`Postgres declarative partitioning for time-series and retention.`,`Multi-tenant SaaS sharded by tenant_id (Citus, Vitess, app-level).`,`DynamoDB/Cassandra partition keys are the same idea built in.`],
[`Sharding before you need to.`,`A shard key absent from most queries (everything scatter-gathers).`,`Low-cardinality or skewed keys (country, celebrity users).`,`Auto-increment ids across shards (collisions) without a global id scheme.`]),
  examples: [
    {lv:'basic', title:'Hash routing: which shard holds each order?', sql:`SELECT id, customer_id, customer_id % 3 AS shard
FROM orders
ORDER BY shard, id;`, why:`Sharding by customer_id keeps all of a customer's orders on one shard (co-location).`},
    {lv:'mid', title:'Load per shard: range vs hash', sql:`SELECT 'range (id < 104 → 0, < 107 → 1, else 2)' AS scheme,
       SUM(id < 104) AS shard0, SUM(id >= 104 AND id < 107) AS shard1, SUM(id >= 107) AS shard2
FROM orders
UNION ALL
SELECT 'hash (id % 3)', SUM(id % 3 = 0), SUM(id % 3 = 1), SUM(id % 3 = 2)
FROM orders;`, why:`Both look balanced on historical ids, but with ranges every <i>new</i> order (id 111, 112, …) lands on shard 2: the hot spot.`},
    {lv:'adv', title:'Resharding cost with modulo: 3 → 4 shards', sql:`WITH RECURSIVE k(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM k WHERE n < 1000)
SELECT SUM(n % 3 <> n % 4) AS keys_moved,
       ROUND(100.0 * SUM(n % 3 <> n % 4) / COUNT(*), 1) AS pct_moved
FROM k;`, why:`About three quarters of all keys change shard when N goes from 3 to 4. Consistent hashing moves only ~1/4 (8.4).`},
  ],
  tips: {
    say:`"First I'd exhaust vertical scaling, indexing, replicas and caching. Partitioning splits a big table inside one database for pruning and cheap retention; sharding spreads rows across servers to scale writes and storage. The shard key matters most: high cardinality, even load, present in most queries and co-locating related data. Range keeps ranges local but hot-spots on sequential keys; hash spreads evenly but needs consistent hashing for rebalancing; directory is flexible but adds a lookup. Cross-shard queries and transactions are the ongoing cost."`,
    points:[`Distinguish partitioning, sharding and replication clearly.`,`Discuss hot spots and how to avoid them (hashing, salting).`,`Mention scatter-gather and cross-shard transactions.`],
    traps:[`Sharding by a low-cardinality column (country).`,`Using created_at as a range shard key for write-heavy data.`],
    qa:[[`Partitioning vs sharding vs replication?`,`Partitioning: split one table into pieces in one DB. Sharding: pieces on different servers. Replication: full copies of the same data on several servers.`],
        [`How would you shard a multi-tenant SaaS?`,`By tenant_id (co-locates each tenant's data; most queries include it), with a directory to move big tenants to dedicated shards.`],
        [`How do you handle a celebrity key (one user with huge traffic)?`,`Split that key further (salting: key#0..key#9), cache its reads, or give it a dedicated shard; aggregate across salts on read.`]]
  },
  exercises: [
    {lv:'E', q:`Assign every customer to one of 2 shards by <code>id % 2</code> and count customers per shard: <code>shard, n</code>.`, hint:`GROUP BY id % 2.`,
     sql:`SELECT id % 2 AS shard, COUNT(*) AS n FROM customers GROUP BY id % 2;`},
    {lv:'M', q:`Sharding orders by <code>customer_id % 3</code>: for each shard, total revenue of non-cancelled orders: <code>shard, revenue</code>. (This is a scatter-gather aggregate: each shard computes its part, the router sums.)`, hint:`Join orders and order_items, group by customer_id % 3.`,
     sql:`SELECT o.customer_id % 3 AS shard, SUM(oi.qty * oi.unit_price) AS revenue
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY o.customer_id % 3;`},
    {lv:'H', q:`Pick a shard key for each and justify: (a) a chat app's messages (reads: "latest messages in conversation X"), (b) IoT readings (writes: 1M/s; reads: "device D last 24h"), (c) an e-commerce orders table (reads: "my orders", admin: "all orders today").`, hint:`Most frequent query, distribution, co-location.`,
     answer:`<ul><li>(a) conversation_id: one shard per conversation's messages; hash it to spread load.</li><li>(b) device_id (hashed), with time as a clustering/sort key within the shard: spreads writes, keeps a device's range together. Not time alone (hot spot).</li><li>(c) customer_id (hashed): "my orders" is single-shard; "all orders today" is a scatter-gather admin query or served from an analytics replica/warehouse.</li></ul>`},
  ],
  quiz: [
    [`Main reason to shard rather than add read replicas?`,[`Read latency`,`To scale writes and storage beyond one server`,`Backups`,`Simpler queries`],1,`Replicas copy everything; writes still hit one primary.`,'E'],
    [`Range sharding on an auto-increment id causes…`,[`Even load`,`A hot spot on the newest shard`,`Data loss`,`Faster joins`],1,`All new rows go to the last range.`,'M'],
    [`Hash sharding's main downside?`,[`Hot spots`,`Range queries must hit all shards; modulo resharding moves most keys`,`Uneven distribution`,`No indexes`],1,`Use consistent hashing.`,'M'],
    [`A query without the shard key must…`,[`Fail`,`Scatter to all shards and merge (scatter-gather)`,`Use the primary`,`Use a cache`],1,`Expensive at scale.`,'E'],
    [`Partition pruning means…`,[`Deleting old partitions`,`Skipping partitions that can't contain matching rows`,`Compressing partitions`,`Splitting partitions`],1,`Based on the partition key in WHERE.`,'E'],
    [`A good shard key has…`,[`Low cardinality`,`High cardinality, even distribution, and appears in most queries`,`Sequential values`,`NULLs`],1,`And co-locates related data.`,'M'],
  ],
  quizAdv: [
    [`Going from 3 to 4 shards with hash % N moves roughly…`,[`1/4 of keys`,`3/4 of keys`,`None`,`All keys`],1,`Consistent hashing moves ~1/N.`,'H'],
    [`Vitess / Citus mainly provide…`,[`Caching`,`Sharding/routing layers for MySQL / Postgres`,`Backups`,`Search`],1,`Distributed query routing, resharding.`,'H'],
    [`Enforcing a globally unique email across user shards sharded by user_id…`,[`Is automatic`,`Needs a separate lookup table/service keyed by email (or shard by email)`,`Is impossible`,`Works with UNIQUE per shard`],1,`Per-shard UNIQUE isn't global.`,'H'],
  ],
});
