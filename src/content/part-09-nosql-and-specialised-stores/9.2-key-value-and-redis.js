/* 9.2 Key-value stores and Redis */
topic('9', { no:'9.2', title:'Key-value stores and Redis: data structures, TTLs, persistence', db:'shop',
idea:`Redis is a key-value store whose values are data structures. Use strings for counters and caches, hashes for objects, sorted sets for leaderboards, lists/streams for queues, and TTLs for expiry; then see how a single-threaded in-memory server stays durable (RDB, AOF) and what it is not good for.`,
stateTitle:'Structure', tbTitle:'Keys',
codes:{a:`SET product:1 '{"name":"Laptop","price":900}' EX 300   # string + TTL
INCR page:home:views                                       # atomic counter
SET lock:order:42 worker7 NX PX 30000                      # simple lock

HSET user:1 name Asha city Pune                            # hash (object)
HINCRBY user:1 orders 1

ZADD leaderboard 2270 asha 1300 eli 940 chen               # sorted set
ZREVRANGE leaderboard 0 2 WITHSCORES                       # top 3

LPUSH jobs '{"id":1}'      BRPOP jobs 0                    # list as queue
XADD events * type order_created id 111                    # stream (log)

SADD tags:post:7 sql redis      SINTER tags:post:7 tags:post:9   # sets

# persistence: RDB snapshots and/or AOF (append-only file, fsync everysec)`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('keys',['key','type','value','ttl'],[['product:1','string','{"name":"Laptop",…}','300 s'],['page:home:views','string','18342','—'],['lock:order:42','string','worker7','30 s']],{1:'hot'})], g:[G('Strings',['cache values','JSON / serialized objects with EX (TTL)'],['INCR / INCRBY','atomic counters (no read-modify-write race)','ok'],['SET … NX PX','set if absent + expiry: a basic lock / dedupe key'])],
 say:`<b>Redis</b> keeps everything in memory, keyed by strings, and operations are atomic because commands run one at a time on a single thread. The simplest values are <b>strings</b>: cached JSON with a TTL, atomic counters (<code>INCR</code> never loses an update), and <code>SET … NX PX</code> for "set only if absent, expire in 30 s", the building block of locks and idempotency keys.`},
{hl:{q:[5,6]}, tb:[TB('user:1 (hash)',['field','value'],[['name','Asha'],['city','Pune'],['orders','4']],{2:'hot'})], g:[G('Hashes',['object with fields','HGET / HSET single fields'],['memory','compact for small objects','ok'],['HINCRBY','atomic field counters'])],
 say:`<b>Hashes</b> store an object as field → value pairs, so you can read or update one field without rewriting the whole object, and increment numeric fields atomically.`},
{hl:{q:[8,9]}, tb:[TB('leaderboard (sorted set)',['rank','member','score'],[[1,'asha',2270],[2,'eli',1300],[3,'chen',940]],{0:'ok',1:'ok',2:'ok'})], g:[G('Sorted sets',['member + score','kept sorted (skip list)','hot'],['ZADD / ZINCRBY','O(log n) updates'],['ZREVRANGE 0 9','top 10 in O(log n + 10)','ok'],['uses','leaderboards, priority queues, time-ordered indexes, rate limiting windows'])],
 say:`<b>Sorted sets</b> keep members ordered by score. Updating a score is O(log n) and "top 10" is a range read, so real-time leaderboards that would need a sort over millions of rows in SQL become trivial. Also used for sliding-window rate limits (score = timestamp) and delayed job queues.`},
{hl:{q:[11,12]}, g:[G('Lists',['LPUSH + BRPOP','simple blocking queue'],['risk','popped message lost if the worker crashes','bad']), G('Streams',['XADD / XREADGROUP','append-only log with consumer groups','ok'],['acks','XACK; pending entries can be reclaimed','ok'],['like','a small Kafka'])],
 say:`<b>Lists</b> make simple queues (<code>LPUSH</code> to enqueue, blocking <code>BRPOP</code> to dequeue), but a popped job is gone if the worker crashes. <b>Streams</b> are an append-only log with consumer groups and acknowledgements, much closer to Kafka, so unprocessed messages can be re-delivered.`},
{hl:{q:[14]}, g:[G('Sets',['unique members','SADD / SISMEMBER O(1)'],['set algebra','SINTER / SUNION / SDIFF'],['uses','tags, "who liked", dedupe']), G('Also',['HyperLogLog','approximate distinct counts in 12 KB'],['Bitmaps','per-user daily flags'],['Geo','radius queries'],['Pub/Sub','fire-and-forget messaging'])],
 say:`<b>Sets</b> hold unique members with O(1) membership checks and set algebra (common tags, mutual friends). Specialised types round it out: HyperLogLog counts distinct visitors approximately in 12 KB, bitmaps store per-day flags compactly, geo sets answer "within 5 km".`},
{hl:{q:[16]}, g:[G('Durability',['RDB','periodic snapshots: fast restart, lose minutes','bad'],['AOF','log every write; fsync everysec → lose ≤ 1 s','ok'],['replication','async replicas; failover via Sentinel / Cluster'],['so','great cache/primary for ephemeral data; think twice for money'])],
 say:`Being in-memory doesn't mean volatile: Redis can persist with <b>RDB</b> snapshots (compact, but you lose writes since the last snapshot) and/or an <b>AOF</b> append-only log (fsync every second: lose at most ~1 s). Replication is asynchronous, so failover can lose recent writes. Treat it as a fast data-structure server, not as your financial system of record.`},
{hl:{}, g:[G('Good for',['caching, sessions, rate limits, leaderboards, counters, locks, queues','ok']), G('Not for',['data bigger than RAM (cost)','bad'],['ad-hoc queries / joins','bad'],['strong multi-key transactions across shards','bad'])],
 say:`<b>Say it:</b> "Redis is an in-memory key-value store whose values are data structures: strings for caches, counters and NX locks, hashes for objects, sorted sets for leaderboards and rate limits, lists and streams for queues, sets for membership. Commands are atomic because execution is single-threaded. Persistence via RDB snapshots or AOF and async replication make it durable enough for many uses, but I keep the system of record in a database."`}
],
keep:[`Key → data structure, in memory, single-threaded atomic commands.`,`Strings (cache, INCR counters, SET NX PX locks), hashes (objects), sorted sets (leaderboards, rate limits), lists/streams (queues), sets (membership).`,`TTL via EX/PX/EXPIRE.`,`Persistence: RDB snapshots and/or AOF (fsync everysec ≈ lose ≤ 1 s); async replication.`,`Not for: data > RAM, ad-hoc queries, financial source of truth.`]}, {
  imp: 'good',
  theory: TH(`A key-value store retrieves values by key; Redis extends this with in-memory data structures (strings, hashes, lists, sets, sorted sets, streams) manipulated by atomic commands.`,
`<p>A key-value store is a giant dictionary: give it a key, get a value. It can't answer questions about values, but it answers "what's at this key?" in microseconds and scales easily.</p>
<p>Redis makes the values smarter: instead of opaque blobs you get counters you can increment, sorted collections you can rank, queues you can pop. Because it runs commands one at a time in memory, each command is atomic without locks.</p>`,
[[`Key-value store`,`Lookup by key only.`],[`TTL`,`Automatic expiry of a key.`],[`Sorted set (ZSET)`,`Members ordered by score.`],[`Stream`,`Append-only log with consumer groups.`],[`RDB / AOF`,`Snapshot / append-only persistence.`],[`Redis Cluster`,`Sharding across 16,384 hash slots (8.4).`],[`Sentinel`,`Monitoring and automatic failover.`]],
[`Client sends a command for a key.`,`Redis executes it atomically in memory.`,`Writes are optionally logged (AOF) and snapshotted (RDB).`,`Replicas receive changes asynchronously.`],
[`Caching database results and HTTP responses (8.10).`,`Rate limiting with INCR + EXPIRE or sorted-set windows.`,`Leaderboards, session stores, distributed locks (with care), job queues.`],
[`Using KEYS * in production (blocks the server).`,`Storing huge values/collections (latency spikes).`,`Relying on a single-instance lock for correctness-critical work (use fencing tokens).`,`Forgetting TTLs and running out of memory.`]),
  examples: [
    {lv:'basic', title:'An atomic counter, SQL edition', sql:`CREATE TABLE kv (k TEXT PRIMARY KEY, v INTEGER);
INSERT INTO kv VALUES ('page:home:views', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1;
INSERT INTO kv VALUES ('page:home:views', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1;
INSERT INTO kv VALUES ('page:home:views', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1;
SELECT * FROM kv;`, why:`What Redis <code>INCR</code> does in one command: create-or-increment atomically. Value 3.`},
    {lv:'mid', title:'A leaderboard (what ZADD/ZREVRANGE give you)', sql:`SELECT c.name AS member, SUM(oi.qty * oi.unit_price) AS score,
       RANK() OVER (ORDER BY SUM(oi.qty * oi.unit_price) DESC) AS rank
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status <> 'cancelled'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id
ORDER BY score DESC LIMIT 3;`, why:`In SQL this aggregates and sorts every time; a Redis sorted set keeps it sorted incrementally (ZINCRBY on each purchase, then ZREVRANGE 0 2).`},
    {lv:'adv', title:'Fixed-window rate limiter', sql:`CREATE TABLE rate (k TEXT PRIMARY KEY, n INTEGER, window_start INTEGER);
-- each request at time t (seconds) for user 1, limit 3 per 60 s window
INSERT INTO rate VALUES ('rl:user:1:' || (100 / 60), 1, (100 / 60) * 60) ON CONFLICT(k) DO UPDATE SET n = n + 1;
INSERT INTO rate VALUES ('rl:user:1:' || (110 / 60), 1, (110 / 60) * 60) ON CONFLICT(k) DO UPDATE SET n = n + 1;
INSERT INTO rate VALUES ('rl:user:1:' || (115 / 60), 1, (115 / 60) * 60) ON CONFLICT(k) DO UPDATE SET n = n + 1;
INSERT INTO rate VALUES ('rl:user:1:' || (118 / 60), 1, (118 / 60) * 60) ON CONFLICT(k) DO UPDATE SET n = n + 1;
SELECT k, n, CASE WHEN n > 3 THEN 'reject' ELSE 'allow' END AS decision FROM rate;`, why:`In Redis: <code>INCR rl:user:1:{window}</code> + <code>EXPIRE … 60</code>; reject when the count exceeds the limit. The 4th request in the window is rejected.`},
  ],
  tips: {
    say:`"Redis is an in-memory key-value store with data structures and atomic single-threaded commands. I use strings for caching with TTLs, INCR for counters and rate limits, SET NX PX for idempotency keys and simple locks, hashes for objects, sorted sets for leaderboards, and streams for durable queues. It persists via RDB/AOF and replicates asynchronously, so it's great as a cache and fast state store, not as the system of record for critical data."`,
    points:[`Map each data structure to a use case.`,`Explain why commands are atomic (single thread).`,`Know persistence and replication trade-offs.`],
    traps:[`Calling Redis "just a cache".`,`Using a single-node Redis lock for correctness without fencing.`],
    qa:[[`How would you build a rate limiter with Redis?`,`Fixed window: INCR key-per-window + EXPIRE; reject over limit. Sliding window: sorted set of timestamps (ZADD, ZREMRANGEBYSCORE, ZCARD) in a MULTI/Lua script.`],
        [`How do you implement a leaderboard?`,`Sorted set: ZINCRBY on score changes, ZREVRANGE for top N, ZREVRANK for a user's rank: all O(log n).`],
        [`Is Redis durable?`,`Configurable: AOF with fsync everysec loses at most ~1 s on crash; RDB-only loses since the last snapshot; async replication can lose recent writes on failover.`]]
  },
  exercises: [
    {lv:'E', q:`Using a kv table, increment <code>'cart:7:items'</code> twice (create-or-increment) and return its value <code>v</code>.`, hint:`INSERT … ON CONFLICT DO UPDATE SET v = v + 1, twice.`,
     sql:`CREATE TABLE kv (k TEXT PRIMARY KEY, v INTEGER);
INSERT INTO kv VALUES ('cart:7:items', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1;
INSERT INTO kv VALUES ('cart:7:items', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1;
SELECT v FROM kv WHERE k = 'cart:7:items';`},
    {lv:'M', q:`Implement "SET NX" (set only if absent) for an idempotency key: try to insert <code>'idem:pay:abc'</code> twice with INSERT OR IGNORE and return how many rows exist for it as <code>n</code>.`, hint:`The second insert is ignored.`,
     sql:`CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT);
INSERT OR IGNORE INTO kv VALUES ('idem:pay:abc', 'processing');
INSERT OR IGNORE INTO kv VALUES ('idem:pay:abc', 'processing');
SELECT COUNT(*) AS n FROM kv WHERE k = 'idem:pay:abc';`},
    {lv:'H', q:`Pick the Redis structure and commands for: (a) "online now" users with expiry, (b) top 100 players, (c) unique visitors per day (approximate), (d) a background job queue that survives worker crashes, (e) 10 requests/minute per API key.`, hint:`Strings, sorted sets, HyperLogLog, streams, INCR.`,
     answer:`(a) per-user key with SET … EX 60 refreshed by heartbeats (or a sorted set by last-seen timestamp) · (b) sorted set: ZINCRBY / ZREVRANGE 0 99 · (c) HyperLogLog: PFADD visitors:2024-03-06 user, PFCOUNT · (d) stream with consumer group: XADD, XREADGROUP, XACK, XAUTOCLAIM for stuck entries · (e) INCR ratelimit:{key}:{minute} + EXPIRE 60, reject when &gt; 10.`},
  ],
  quiz: [
    [`Why are Redis commands atomic?`,[`They use row locks`,`Commands execute one at a time on a single thread`,`They use 2PC`,`They aren't`],1,`No interleaving within a command.`,'M'],
    [`Best structure for a real-time leaderboard?`,[`List`,`Sorted set`,`String`,`Bitmap`],1,`ZADD/ZREVRANGE.`,'E'],
    [`SET key value NX PX 30000 means…`,[`Set always, expire in 30 s`,`Set only if the key doesn't exist, expire in 30 s`,`Set if exists`,`Increment by 30000`],1,`Locks/idempotency.`,'M'],
    [`AOF with fsync everysec can lose about…`,[`Nothing`,`Up to ~1 second of writes`,`Everything`,`One day`],1,`Durability trade-off.`,'M'],
    [`Redis is a poor fit for…`,[`Session storage`,`Ad-hoc queries over large datasets bigger than RAM`,`Counters`,`Rate limiting`],1,`In-memory key-value.`,'E'],
    [`Which structure approximates distinct counts in tiny memory?`,[`Set`,`HyperLogLog`,`Hash`,`List`],1,`~12 KB, ~0.8% error.`,'M'],
  ],
  quizAdv: [
    [`Why is KEYS * dangerous in production?`,[`It deletes keys`,`It scans all keys in one blocking command, stalling the single-threaded server`,`It's deprecated`,`It requires auth`],1,`Use SCAN.`,'H'],
    [`Redlock / single-instance locks need fencing tokens because…`,[`Redis is slow`,`A paused client can believe it still holds an expired lock and write after another client acquired it`,`Locks never expire`,`Keys collide`],1,`Kleppmann's critique.`,'H'],
    [`Redis Cluster multi-key commands require…`,[`Nothing`,`All keys in the same hash slot (use hash tags {user:1})`,`Transactions`,`A proxy`],1,`Cross-slot operations are rejected.`,'H'],
  ],
});
