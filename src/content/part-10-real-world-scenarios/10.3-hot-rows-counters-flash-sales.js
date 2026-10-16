/* 10.3 Scenario: hot rows, counters and flash sales */
topic('10', { no:'10.3', title:'Scenario: hot rows — like counters and a 100-unit flash sale', db:'shop',
idea:`Ten thousand users hit one row at once. See why a single counter row serialises every write, how sharded counters and batching spread the load, and how to sell exactly 100 units in a flash sale without overselling or melting the database.`,
actors:'Buyers', stateTitle:'Contention', tbTitle:'Rows',
codes:{a:`-- naive like counter: every like updates the SAME row
UPDATE posts SET likes = likes + 1 WHERE id = 7;      -- row lock → queue of 10k writers

-- sharded counter: N rows per post, pick one at random, sum on read
UPDATE post_likes SET n = n + 1 WHERE post_id = 7 AND shard = floor(random() * 16);
SELECT SUM(n) FROM post_likes WHERE post_id = 7;

-- or buffer: count in Redis (INCR), flush to the DB every few seconds

-- flash sale: exactly 100 units
UPDATE stock SET remaining = remaining - 1
WHERE product_id = 42 AND remaining > 0;             -- 1 row = you got one
-- + Redis DECR gate in front, queue/waiting room, idempotent orders`},
steps:[
{hl:{q:[1,2]}, th:[['u1','RUN:ok','holds row lock'],['u2','BLOCKED:warn','waiting'],['u3','BLOCKED:warn','waiting'],['…u10000','BLOCKED:bad','waiting']], tb:[TB('posts',['id','likes'],[[7,'1,204,551']],{0:'hot'})], g:[G('Hot row',['every writer','same row → same lock','bad'],['throughput','~1 / (lock hold time)','bad'],['symptoms','lock waits, pool exhaustion, timeouts','bad'],['MVCC (Postgres)','also creates a dead tuple per update (6.5)'])],
 say:`A viral post: every like runs <code>UPDATE posts SET likes = likes + 1 WHERE id = 7</code>. Each update is atomic and correct (6.6), but they all need the <b>same row lock</b>, so they execute one at a time. Throughput is capped at roughly 1 / (time the lock is held, including commit/fsync), and waiting requests pile up, exhaust the connection pool and time out. In Postgres each update also leaves a dead row version behind.`},
{hl:{q:[4,5,6]}, th:[['u1','RUN:ok','shard 3'],['u2','RUN:ok','shard 11'],['u3','RUN:ok','shard 0'],['…','RUN:ok','spread over 16 rows']], tb:[TB('post_likes (16 shards)',['post_id','shard','n'],[[7,0,'75,301'],[7,1,'75,288'],[7,'…','…'],[7,15,'75,247']])], g:[G('Sharded counter',['N rows instead of 1','writers pick one at random','ok'],['contention','÷ N','ok'],['read','SUM over N rows (cheap)'],['trade-off','slightly costlier reads; choose N by write rate'])], log:['16 shards → ~16× write throughput'],
 say:`<b>Sharded counter</b>: split the counter into N rows (shards) and have each writer increment a random one. Contention drops by roughly N×; reading the total is a SUM over N small rows. The same trick works in any database (and in Firestore/DynamoDB where per-key write limits exist).`},
{hl:{q:[8]}, th:[], g:[G('Buffer and batch',['INCR in Redis','in-memory, atomic, very fast','ok'],['flush','every few seconds: UPDATE posts SET likes = likes + :delta'],['DB writes','1 per post per flush instead of 1 per like','ok'],['risk','lose a few seconds of likes if Redis dies (acceptable for likes)'])],
 say:`Or <b>buffer</b>: increment in Redis (9.2) and flush the accumulated delta to the database every few seconds. Ten thousand likes become one UPDATE. You may lose a few seconds of likes in a crash, which is fine for a like counter and not fine for money. Matching the consistency requirement to the data is the real skill.`},
{hl:{q:[10,11,12]}, th:[['b1','TERM:ok','got unit 100 → 99'],['b2','TERM:ok','99 → 98'],['b100','TERM:ok','1 → 0'],['b101','TERM:bad','0 rows: sold out']], tb:[TB('stock',['product_id','remaining'],[[42,0]],{0:'ok'})], g:[G('Exactly 100 units',['guarded decrement','WHERE remaining > 0','ok'],['affected rows','1 = success, 0 = sold out','ok'],['never','read stock in the app then write (6.2 lost update)','bad'],['still a hot row','100k buyers queue on one lock','bad'])], log:['100 successful decrements, 99,900 sold out'],
 say:`Flash sale, 100 units, 100,000 buyers. Correctness first: a <b>guarded atomic decrement</b> (<code>WHERE remaining &gt; 0</code>) can never oversell, and the affected-row count says whether you got one (6.6). But it's the hot-row problem again: 100,000 transactions queue on one lock to discover that 99,900 of them are too late.`},
{hl:{q:[13]}, th:[], tb:[], g:[G('Protect the database',['Redis DECR gate','reject buyers after 100 in memory; only winners reach the DB','ok'],['waiting room / queue','admit buyers at a rate the DB can handle','ok'],['pre-split stock','e.g. 10 rows × 10 units (sharded inventory)'],['idempotent orders','retries don\'t create two orders (10.5)','ok'],['reservations','hold for N minutes, release unpaid ones'])],
 say:`So put a cheap gate in front. A Redis <code>DECR</code> on an in-memory counter rejects everyone after the first 100 without touching the database; only the winners run the real transaction (which still guards against overselling, in case Redis and the DB disagree). Add a waiting room or queue to admit traffic at a sustainable rate, idempotency keys so retries don't double-order, and reservations that expire if unpaid.`},
{hl:{}, th:[], g:[G('Patterns for hot spots',['spread','sharded counters / sharded inventory','ok'],['batch','buffer in memory, flush deltas','ok'],['gate','cheap pre-check (Redis) before the DB','ok'],['queue','serialize through a log/queue at a controlled rate','ok'],['avoid','read-modify-write in the app, giant transactions holding the hot lock','bad'])],
 say:`<b>Say it:</b> "A hot row serialises all writers on one lock, so throughput collapses. For counters I shard the row into N rows and sum on read, or buffer increments in Redis and flush deltas, accepting small loss for likes. For a flash sale I keep the database correct with a guarded decrement and check affected rows, but protect it with a Redis gate so only potential winners reach it, a queue or waiting room, idempotent orders and expiring reservations."`}
],
keep:[`Hot row = all writers on one lock → serialized throughput, queues, timeouts.`,`Sharded counter: N rows, random shard on write, SUM on read.`,`Buffer increments (Redis INCR) and flush deltas: fine for likes, not money.`,`Flash sale: guarded decrement (WHERE remaining > 0) + Redis gate + queue + idempotency + reservations.`]}, {
  imp: 'good',
  theory: TH(`When many transactions update the same row, they serialize on its lock; you remove the hot spot by spreading writes over several rows, batching them, or filtering requests before they reach the database.`,
`<p>A single cashier can only serve one customer at a time, however fast they are. A row lock is that cashier. If 10,000 people want the same row, they form a queue. You can add cashiers (shard the counter), collect payments in batches (buffer and flush), or have a bouncer at the door turn people away when the item is sold out (a gate).</p>`,
[[`Hot row / hot key`,`A row or key receiving a disproportionate share of writes.`],[`Lock contention`,`Transactions waiting on the same lock.`],[`Sharded counter`,`A logical counter split across N rows.`],[`Write buffering`,`Accumulating changes in memory and flushing deltas.`],[`Guarded decrement`,`UPDATE … WHERE remaining > 0.`],[`Waiting room`,`Admission control in front of a spike.`]],
[`Detect: lock waits and slow updates on one key.`,`Decide the consistency requirement (exact vs approximate).`,`Spread, batch or gate the writes.`,`Keep the final source of truth correct with atomic guarded updates.`],
[`Like/view counters, rate limits, inventory in flash sales, ticket sales, global sequence counters.`,`Firestore/Spanner guidance on sharded counters and avoiding monotonically increasing hot keys.`,`Queue-based checkouts for ticketing sites.`],
[`Read stock in the app, then write (oversell).`,`One giant transaction holding the hot row while calling a payment provider.`,`Using a single global counter row for id generation.`]),
  examples: [
    {lv:'basic', title:'Guarded decrement: you can\'t oversell', sql:`CREATE TABLE stock (product_id INTEGER PRIMARY KEY, remaining INTEGER NOT NULL CHECK (remaining >= 0));
INSERT INTO stock VALUES (42, 2);
UPDATE stock SET remaining = remaining - 1 WHERE product_id = 42 AND remaining > 0;  -- buyer 1: 1 row
UPDATE stock SET remaining = remaining - 1 WHERE product_id = 42 AND remaining > 0;  -- buyer 2: 1 row
UPDATE stock SET remaining = remaining - 1 WHERE product_id = 42 AND remaining > 0;  -- buyer 3: 0 rows
SELECT changes() AS buyer3_got_one, remaining FROM stock WHERE product_id = 42;`, why:`Buyer 3's UPDATE affects 0 rows: sold out. The CHECK constraint is a second safety net.`},
    {lv:'mid', title:'Sharded counter: write to a random shard, sum on read', sql:`CREATE TABLE post_likes (post_id INTEGER, shard INTEGER, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (post_id, shard));
WITH RECURSIVE s(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM s WHERE i < 7)
INSERT INTO post_likes (post_id, shard) SELECT 7, i FROM s;
-- 200 likes, each sent to a random shard
CREATE TABLE like_events (shard INTEGER);
WITH RECURSIVE l(k) AS (SELECT 1 UNION ALL SELECT k + 1 FROM l WHERE k < 200)
INSERT INTO like_events SELECT abs(random()) % 8 FROM l;
UPDATE post_likes SET n = (SELECT COUNT(*) FROM like_events e WHERE e.shard = post_likes.shard);
SELECT shard, n FROM post_likes ORDER BY shard;
SELECT SUM(n) AS likes, COUNT(*) AS shards FROM post_likes WHERE post_id = 7;`, why:`8 shards, 200 likes: each shard row absorbs roughly 1/8 of the writes (and lock waits); the total is a cheap SUM, always 200. The per-shard split changes on every run.`},
    {lv:'adv', title:'Buffer and flush deltas', sql:`CREATE TABLE buffer (post_id INTEGER, delta INTEGER);           -- stands in for Redis INCR keys
INSERT INTO buffer VALUES (7, 1), (7, 1), (7, 1), (9, 1), (7, 1), (9, 1);
CREATE TABLE posts (id INTEGER PRIMARY KEY, likes INTEGER NOT NULL);
INSERT INTO posts VALUES (7, 1000), (9, 50);
-- periodic flush: one UPDATE per post, then clear the buffer
UPDATE posts SET likes = likes + (SELECT SUM(delta) FROM buffer b WHERE b.post_id = posts.id)
WHERE id IN (SELECT post_id FROM buffer);
DELETE FROM buffer;
SELECT * FROM posts;`, why:`Six likes become two UPDATEs (one per post). At 10k likes/s on one post, that's one UPDATE per flush instead of 10k.`},
  ],
  tips: {
    say:`"A hot row serialises all writers on its lock, so throughput is bounded by lock hold time. For approximate counters I shard the counter into N rows or buffer increments in Redis and flush deltas. For a flash sale I keep correctness in the DB with a guarded decrement and affected-row check, and protect it with a Redis gate, a queue or waiting room, idempotent order creation and expiring reservations."`,
    points:[`Explain why atomic updates are correct but don't scale on one row.`,`Choose the technique by consistency needs.`,`Mention idempotency and reservations for checkout.`],
    traps:[`Proposing read-check-write in the app.`,`Making every like a strongly consistent transaction on one row.`],
    qa:[[`How would you count video views at 50k/s?`,`Buffer in memory/Redis per video (INCR), flush deltas periodically, or stream view events to Kafka and aggregate; exact real-time counts aren't needed.`],
        [`Why not SELECT … FOR UPDATE for the flash sale?`,`It's correct but still serialises everyone on one row; add a gate so only potential winners reach it, or pre-split stock.`],
        [`How do you avoid hot keys in DynamoDB/Cassandra?`,`High-cardinality partition keys, write sharding (key#suffix), and avoiding monotonically increasing keys like timestamps as partition keys.`]]
  },
  exercises: [
    {lv:'E', q:`Create stock for product 7 with 1 unit; two buyers try the guarded decrement. Return the final <code>remaining</code>.`, hint:`Two identical UPDATEs WHERE remaining &gt; 0.`,
     sql:`CREATE TABLE stock (product_id INTEGER PRIMARY KEY, remaining INTEGER NOT NULL);
INSERT INTO stock VALUES (7, 1);
UPDATE stock SET remaining = remaining - 1 WHERE product_id = 7 AND remaining > 0;
UPDATE stock SET remaining = remaining - 1 WHERE product_id = 7 AND remaining > 0;
SELECT remaining FROM stock WHERE product_id = 7;`},
    {lv:'M', q:`Create a 4-shard counter for post 1 with shard values 10, 12, 9, 11 and return the total as <code>likes</code>.`, hint:`Insert 4 rows, SUM(n).`,
     sql:`CREATE TABLE post_likes (post_id INTEGER, shard INTEGER, n INTEGER, PRIMARY KEY (post_id, shard));
INSERT INTO post_likes VALUES (1, 0, 10), (1, 1, 12), (1, 2, 9), (1, 3, 11);
SELECT SUM(n) AS likes FROM post_likes WHERE post_id = 1;`},
    {lv:'H', q:`Design the database side of a concert ticket sale: 5,000 seats, 500,000 users in the first minute, seats are specific (row/number), payment must complete within 10 minutes.`, hint:`Seat rows, reservations with expiry, admission control, SKIP LOCKED.`,
     answer:`<ul><li>seats(event_id, seat_id, status free/held/sold, held_until, order_id) with a row per seat.</li><li>Admission: waiting room/queue lets users in at a rate the system can handle.</li><li>Pick seats: <code>UPDATE seats SET status='held', held_until=now()+10 min, holder=? WHERE event_id=? AND seat_id = ANY(?) AND status='free'</code>; for "best available", <code>SELECT … WHERE status='free' ORDER BY rank LIMIT n FOR UPDATE SKIP LOCKED</code> (6.3).</li><li>Payment: idempotency key; on success set status='sold' WHERE holder matches and held_until &gt; now().</li><li>A job releases expired holds. Cache seat-map reads (stale is fine; the UPDATE is the source of truth).</li></ul>`},
  ],
  quiz: [
    [`Why does a single counter row limit write throughput?`,[`Rows are small`,`All writers serialize on the same row lock`,`Indexes`,`Replication`],1,`Hot row.`,'E'],
    [`A sharded counter…`,[`Uses one row`,`Splits the count across N rows; writes go to one, reads sum all`,`Requires NoSQL`,`Is exact only with SERIALIZABLE`],1,`÷N contention.`,'E'],
    [`Buffering likes in Redis and flushing every 5 s risks…`,[`Overselling`,`Losing a few seconds of likes if Redis crashes`,`Deadlocks`,`Dirty reads in the DB`],1,`Acceptable for likes.`,'M'],
    [`Flash sale correctness in the DB comes from…`,[`Reading stock in the app first`,`A guarded atomic decrement and checking affected rows`,`A bigger cache`,`READ UNCOMMITTED`],1,`WHERE remaining > 0.`,'E'],
    [`Purpose of a Redis DECR gate in front of the DB?`,[`Durability`,`Reject late buyers cheaply so only potential winners hit the database`,`Replication`,`Backups`],1,`Protect the hot row.`,'M'],
    [`Why idempotency keys in a flash sale checkout?`,[`Speed`,`Retries (timeouts, double clicks) must not create two orders`,`Encryption`,`Sharding`],1,`See 10.5.`,'M'],
  ],
  quizAdv: [
    [`In Postgres, a hot row updated 5,000×/s also causes…`,[`Nothing else`,`Rapid dead-tuple creation (bloat) and HOT-chain/vacuum pressure`,`Index-only scans`,`Faster reads`],1,`MVCC cost (6.5).`,'H'],
    [`Choosing N for a sharded counter depends on…`,[`Table size`,`Peak write rate per counter vs per-row write capacity, balanced against read cost`,`Number of columns`,`Isolation level`],1,`Engineering trade-off.`,'H'],
    [`FOR UPDATE SKIP LOCKED helps seat allocation because…`,[`It locks the table`,`Concurrent buyers grab different free seats instead of queuing on the same ones`,`It avoids transactions`,`It's faster than SELECT`],1,`Queue-like allocation (6.3).`,'H'],
  ],
});
