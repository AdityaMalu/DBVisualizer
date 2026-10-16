/* 9.4 Wide-column stores (Cassandra): query-first modeling */
topic('9', { no:'9.4', title:'Wide-column stores (Cassandra): partition keys, clustering keys, query-first design', db:'shop',
idea:`Design Cassandra tables the way it wants: start from the queries. See how the partition key picks the node, the clustering key sorts rows inside a partition, why "WHERE on any column" is refused, and how to avoid giant partitions with time buckets.`,
stateTitle:'Key design', tbTitle:'Partitions on disk',
codes:{a:`-- query: "latest messages in a conversation"
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  sent_at         timeuuid,
  sender          text,
  body            text,
  PRIMARY KEY ((conversation_id), sent_at)        -- partition key, clustering key
) WITH CLUSTERING ORDER BY (sent_at DESC);

SELECT * FROM messages_by_conversation
WHERE conversation_id = ? LIMIT 50;              -- one partition, already sorted

SELECT * FROM messages_by_conversation
WHERE sender = 'asha';                           -- ✗ needs ALLOW FILTERING (full scan)

-- second query → second table (denormalize)
CREATE TABLE messages_by_sender (sender text, sent_at timeuuid, conversation_id uuid,
  body text, PRIMARY KEY ((sender), sent_at));

-- huge partitions? bucket by time
PRIMARY KEY ((sensor_id, day), ts)`},
steps:[
{hl:{q:[1]}, g:[G('Query-first modeling',['relational','model entities, then query anything'],['Cassandra','list queries first, one table per query','hot'],['why','data is located by key; no joins, no ad-hoc scans'])],
 say:`In a relational database you model entities and figure out queries later. In <b>Cassandra</b> (and ScyllaDB, Bigtable, DynamoDB) you do the opposite: <b>start from the queries</b>. Each table is designed to answer one query efficiently by reading one partition. Here the query is "latest 50 messages in a conversation".`},
{hl:{q:[2,3,4,5,6,7,8]}, tb:[TB('partition conv-A (on nodes 2, 5, 7)',['sent_at ↓','sender','body'],[['10:05','Ben','see you'],['10:04','Asha','ok!'],['10:01','Ben','lunch?']]), TB('partition conv-B (on nodes 1, 3, 6)',['sent_at ↓','sender','body'],[['09:30','Chen','hi']])], g:[G('PRIMARY KEY ((conversation_id), sent_at)',['partition key','conversation_id → hashed → which nodes (8.4)','hot'],['clustering key','sent_at → sort order inside the partition','hot'],['partition','all rows with the same partition key, stored together'])],
 say:`The <b>primary key</b> has two parts. The <b>partition key</b> (<code>conversation_id</code>) is hashed onto the token ring to decide which nodes store the data (8.4); all rows with that key form one <b>partition</b>, stored together. The <b>clustering key</b> (<code>sent_at</code>) sorts rows inside the partition, here newest first.`},
{hl:{q:[10,11]}, tb:[TB('result',['sent_at','sender','body'],[['10:05','Ben','see you'],['10:04','Asha','ok!'],['10:01','Ben','lunch?']],{0:'ok',1:'ok',2:'ok'})], g:[G('Efficient query',['WHERE partition key = ?','go straight to the replicas'],['already sorted','by clustering key','ok'],['LIMIT 50','read the first 50 rows','ok'],['cost','independent of total data size','ok'])], log:['1 partition read → 50 rows'],
 say:`The query names the partition key, so the coordinator goes straight to the replicas owning that partition and reads the first 50 rows, which are already in the right order. Cost doesn't depend on how many billions of messages exist overall. This is the access pattern Cassandra is built for.`},
{hl:{q:[13,14]}, g:[G('Query by a non-key column',['WHERE sender = \'asha\'','which partitions? all of them','bad'],['Cassandra','refuses unless ALLOW FILTERING (cluster-wide scan)','bad'],['secondary indexes','local per node: still asks every node','bad'],['answer','another table keyed by sender','ok'])],
 say:`Now ask for all of Asha's messages. <code>sender</code> isn't part of the key, so the matching rows could be in every partition on every node. Cassandra refuses unless you add <code>ALLOW FILTERING</code>, which means "scan the cluster". Secondary indexes exist but are local to each node, so they still query every node. The idiomatic answer: another table.`},
{hl:{q:[16,17,18]}, tb:[TB('messages_by_sender (partition asha)',['sent_at','conversation_id','body'],[['10:04','conv-A','ok!']])], g:[G('Denormalize per query',['same message','written to 2 tables','hot'],['writes','cheap in Cassandra (LSM, 4.7)','ok'],['consistency','batch (logged) or app keeps them in sync'],['storage','duplicated, accepted'])],
 say:`<b>Denormalize</b>: write each message to a second table partitioned by sender. Writes are cheap in Cassandra (LSM storage, 4.7), storage is cheap, and each query stays a single-partition read. The application (or a logged batch) keeps the tables in sync. That's the core trade-off of wide-column modeling.`},
{hl:{q:[20,21]}, tb:[TB('partition sizes',['partition key','rows'],[['sensor-9','2,000,000,000 (unbounded!)'],['(sensor-9, 2024-03-06)','86,400'],['(sensor-9, 2024-03-07)','86,400']],{0:'bad',1:'ok',2:'ok'})], g:[G('Partition size',['unbounded partitions','hot spots, slow reads, repair pain','bad'],['guideline','keep partitions ~< 100 MB / ~100k rows'],['bucketing','add day/month to the partition key','ok'],['cost','queries spanning days read several partitions'])],
 say:`Beware <b>unbounded partitions</b>: a sensor writing every second for years puts billions of rows in one partition on the same few nodes. Add a <b>time bucket</b> to the partition key, <code>((sensor_id, day), ts)</code>, so each partition stays bounded; queries over a week read seven partitions. Also avoid "celebrity" partition keys that concentrate traffic.`},
{hl:{}, g:[G('Wide-column checklist',['1','list queries with their filters and sort'],['2','one table per query; partition key = equality filter'],['3','clustering key = sort/range within partition'],['4','bounded partition size (buckets)'],['5','tunable consistency per query (8.8)']), G('Avoid',['ALLOW FILTERING in prod','bad'],['joins / ad-hoc analytics','export to Spark / warehouse'],['read-before-write and deletes-as-queues','tombstones (4.7)'])],
 say:`<b>Say it:</b> "In Cassandra I design from queries: each table serves one query with a partition key that the query filters on by equality, which decides placement, and clustering columns that define sort order within the partition. Queries that don't hit a partition key are refused or scan the cluster, so I denormalize into one table per query, keep partitions bounded with time buckets, and tune consistency per request."`}
],
keep:[`Query-first: one table per query; denormalize.`,`PRIMARY KEY ((partition key), clustering keys): partition → nodes; clustering → sort inside partition.`,`Efficient: WHERE partition key = ? (+ clustering range).`,`Non-key filters need another table (ALLOW FILTERING = cluster scan).`,`Bound partitions with time buckets; avoid hot keys and tombstone-heavy patterns.`]}, {
  imp: 'good',
  theory: TH(`Wide-column stores like Cassandra group rows into partitions by a partition key and sort them by clustering keys, so you design one table per query to make every read a single-partition lookup.`,
`<p>Think of a filing system where each drawer (partition) is chosen by a label you must know in advance (the partition key), and inside the drawer folders are kept in a fixed order (clustering key). Opening the right drawer and reading the first few folders is instant. Looking for something without knowing its drawer means opening every drawer in every building.</p>
<p>So you file the same information in several drawer systems, one for each way you'll need to look it up. Storage is cheap; scanning a cluster isn't.</p>`,
[[`Partition key`,`Determines which nodes store a row (via hashing).`],[`Clustering key`,`Sort order of rows within a partition.`],[`Partition`,`All rows sharing a partition key.`],[`Query-first design`,`Table per access pattern.`],[`ALLOW FILTERING`,`Permits inefficient scans.`],[`Time bucketing`,`Adding a time component to bound partitions.`],[`Tombstone`,`Deletion marker (4.7).`]],
[`List every query: equality filters, ranges, sort.`,`Choose partition key from equality filters; clustering keys from range/sort.`,`Create one table per query, writing data to all relevant tables.`,`Check partition sizes and hot keys; tune consistency levels.`],
[`Messaging, activity feeds, time series, IoT, event logging at massive scale.`,`Multi-data-center deployments with LOCAL_QUORUM.`,`Exporting to Spark/warehouses for analytics.`],
[`Relational-style normalized tables in Cassandra.`,`ALLOW FILTERING in production queries.`,`Unbounded partitions (per user forever, per sensor forever).`,`Using Cassandra as a queue (tombstones).`]),
  examples: [
    {lv:'basic', title:'A partition: all of one key, sorted', sql:`CREATE TABLE messages_by_conversation (conversation_id TEXT, sent_at TEXT, sender TEXT, body TEXT,
  PRIMARY KEY (conversation_id, sent_at)) WITHOUT ROWID;
INSERT INTO messages_by_conversation VALUES
 ('conv-A','10:01','Ben','lunch?'), ('conv-A','10:04','Asha','ok!'), ('conv-A','10:05','Ben','see you'),
 ('conv-B','09:30','Chen','hi');
SELECT sent_at, sender, body FROM messages_by_conversation
WHERE conversation_id = 'conv-A' ORDER BY sent_at DESC LIMIT 50;`, why:`A clustered primary key (WITHOUT ROWID in SQLite) stores each conversation's rows together, sorted: the read is one range seek, like a Cassandra partition read.`},
    {lv:'mid', title:'The second query needs a second table', sql:`CREATE TABLE messages_by_conversation (conversation_id TEXT, sent_at TEXT, sender TEXT, body TEXT,
  PRIMARY KEY (conversation_id, sent_at)) WITHOUT ROWID;
CREATE TABLE messages_by_sender (sender TEXT, sent_at TEXT, conversation_id TEXT, body TEXT,
  PRIMARY KEY (sender, sent_at)) WITHOUT ROWID;
-- the application writes every message to both tables
INSERT INTO messages_by_conversation VALUES ('conv-A','10:04','Asha','ok!');
INSERT INTO messages_by_sender       VALUES ('Asha','10:04','conv-A','ok!');
SELECT * FROM messages_by_sender WHERE sender = 'Asha';`, why:`Same message, two layouts, each answering one query with a single-partition read.`},
    {lv:'adv', title:'Time-bucketed partitions', sql:`CREATE TABLE readings (sensor TEXT, day TEXT, ts TEXT, value REAL,
  PRIMARY KEY (sensor, day, ts)) WITHOUT ROWID;
INSERT INTO readings VALUES ('s9','2024-03-06','23:59:59',21.5), ('s9','2024-03-07','00:00:01',21.4),
                            ('s9','2024-03-07','12:00:00',24.0);
-- partition sizes (one partition = one (sensor, day))
SELECT sensor, day, COUNT(*) AS rows_in_partition FROM readings GROUP BY sensor, day;`, why:`Each (sensor, day) pair is its own bounded partition; a query for one day touches exactly one.`},
  ],
  tips: {
    say:`"Cassandra modeling is query-first: one table per query, with a partition key matching the query's equality filter, which determines node placement, and clustering keys for ordering within the partition. Non-key queries need another denormalized table rather than ALLOW FILTERING. I keep partitions bounded with time buckets, avoid hot keys and delete-heavy patterns, and choose consistency per query."`,
    points:[`Distinguish partition vs clustering key precisely.`,`Explain why ad-hoc filters are refused.`,`Mention partition sizing and time buckets.`],
    traps:[`Designing normalized tables and expecting joins.`,`Using secondary indexes as a general fix.`],
    qa:[[`Design a table for "a user's last 20 notifications".`,`notifications_by_user ((user_id), created_at DESC, notification_id): partition by user, cluster by time descending, LIMIT 20. Consider TTLs to bound size.`],
        [`What's wrong with PRIMARY KEY (date, user_id) for events?`,`All of a day's events go to one partition: a hot spot. Partition by (user_id, day) or a bucket.`],
        [`How do you keep two denormalized tables consistent?`,`Write both in a logged batch (atomic eventually, not isolated), or idempotent dual writes with retries, or derive one from the other via CDC/stream processing.`]]
  },
  exercises: [
    {lv:'E', q:`Model "orders by customer, newest first" with a clustered key table <code>orders_by_customer(customer_id, order_date, order_id)</code>, fill it from orders, and return customer 1's rows newest first: <code>order_date, order_id</code>.`, hint:`PRIMARY KEY (customer_id, order_date, order_id) WITHOUT ROWID; INSERT … SELECT; ORDER BY order_date DESC.`, ordered:true,
     sql:`CREATE TABLE orders_by_customer (customer_id INTEGER, order_date TEXT, order_id INTEGER,
  PRIMARY KEY (customer_id, order_date, order_id)) WITHOUT ROWID;
INSERT INTO orders_by_customer SELECT customer_id, order_date, id FROM orders;
SELECT order_date, order_id FROM orders_by_customer WHERE customer_id = 1 ORDER BY order_date DESC;`},
    {lv:'M', q:`Partition logins by (customer_id, month): build <code>logins_by_month</code> and return partition sizes <code>customer_id, month, n</code>.`, hint:`substr(login_date, 1, 7) as the bucket.`,
     sql:`CREATE TABLE logins_by_month AS SELECT customer_id, substr(login_date, 1, 7) AS month, login_date FROM logins;
SELECT customer_id, month, COUNT(*) AS n FROM logins_by_month GROUP BY customer_id, month;`},
    {lv:'H', q:`Design Cassandra tables for a ride app: (1) a rider's trip history newest first, (2) all trips for a driver on a given day, (3) trips currently in progress in a city. Give primary keys and explain hot-spot risks.`, hint:`Partition per query; bucket where needed.`,
     answer:`<ul><li>(1) trips_by_rider: PRIMARY KEY ((rider_id), started_at DESC, trip_id); maybe bucket by year for heavy users.</li><li>(2) trips_by_driver_day: PRIMARY KEY ((driver_id, day), started_at, trip_id): bounded per day.</li><li>(3) active_trips_by_city: PRIMARY KEY ((city, shard), trip_id) with shard = hash(trip_id) % 16 to avoid one huge hot partition per city; delete or TTL on completion, mindful of tombstones (or keep this in Redis instead).</li></ul>`},
  ],
  quiz: [
    [`In PRIMARY KEY ((a), b), a is…`,[`The clustering key`,`The partition key, deciding which nodes store the row`,`An index`,`Optional`],1,`b orders rows within a.`,'E'],
    [`The clustering key determines…`,[`Which node stores the row`,`The sort order of rows within a partition`,`Replication factor`,`TTL`],1,`Range queries within a partition.`,'E'],
    [`Why does Cassandra reject WHERE on a non-key column by default?`,[`Syntax error`,`It would have to scan every partition on every node`,`Columns are encrypted`,`It's a bug`],1,`ALLOW FILTERING = scan.`,'M'],
    [`The idiomatic way to support a second query pattern is…`,[`A join`,`Another table, denormalized for that query`,`A view only`,`A bigger cluster`],1,`Query-first.`,'E'],
    [`An unbounded partition (sensor_id only) causes…`,[`Nothing`,`Huge partitions on a few nodes: hot spots, slow reads, repair problems`,`Faster writes`,`Data loss`],1,`Bucket by time.`,'M'],
    [`Writes in Cassandra are cheap mainly because of…`,[`B-trees`,`LSM storage: commit log append + memtable`,`Joins`,`Locks`],1,`See 4.7.`,'M'],
  ],
  quizAdv: [
    [`A logged batch writing to two denormalized tables guarantees…`,[`Isolation`,`That all statements eventually apply (atomicity), not isolation`,`Linearizability`,`Nothing`],1,`Use sparingly.`,'H'],
    [`Cassandra secondary indexes are inefficient for high-cardinality columns because…`,[`They don't exist`,`They're local per node, so queries fan out to all nodes`,`They lock tables`,`They need joins`],1,`SAI (storage-attached indexes) improve but don't remove fan-out.`,'H'],
    [`Lightweight transactions (IF NOT EXISTS) in Cassandra use…`,[`2PC`,`Paxos per partition, with several round trips`,`Locks`,`Nothing special`],1,`Linearizable but slow; use sparingly.`,'H'],
  ],
});
