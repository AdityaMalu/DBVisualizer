/* 8.10 Caching in front of a database */
topic('8', { no:'8.10', title:'Caching: cache-aside, write-through, invalidation, stampedes', db:'shop',
idea:`Put Redis in front of the database. Step through a cache miss and hit (cache-aside), the race that leaves stale data after an update, write-through and write-behind, TTLs, and the thundering herd when a hot key expires, with the fixes for each.`,
actors:'Requests', dgTitle:'App, cache, database', stateTitle:'Cache', tbTitle:'Cache contents',
nodes:{
  app:{x:70,y:110,label:'app',w:90,kind:'actor'},
  cache:{x:270,y:40,label:'Redis cache',w:140,h:44,kind:'mem'},
  db:{x:270,y:180,label:'database',w:140,h:48,kind:'db'}
},
edges:[['app','cache'],['app','db']],
vb:'0 0 460 230',
codes:{a:`-- cache-aside (lazy loading): the most common pattern
v = cache.get("product:1")
if v is None:                                  -- miss
    v = db.query("SELECT … FROM products WHERE id = 1")
    cache.set("product:1", v, ttl = 300)
return v

-- on update: write the DB, then DELETE the cache key (don't SET it)
db.execute("UPDATE products SET price = 950 WHERE id = 1")
cache.delete("product:1")

-- write-through: write cache and DB together on every write
-- write-behind:  write cache now, flush to DB asynchronously (risk of loss)

-- stampede protection: one rebuild per key (lock / single-flight),
-- stale-while-revalidate, jittered TTLs, early probabilistic refresh`},
steps:[
{hl:{q:[2,3,4,5,6]}, th:[['req1','RUN:warn','cache miss → DB']], d:{e:[['app','cache','GET → miss','bad'],['app','db','SELECT','hot'],['app','cache','SET ttl 300','ok']]}, tb:[TB('cache',['key','value','ttl'],[['product:1','{Laptop, 900}','300 s']],{0:'new'})], g:[G('Cache-aside (lazy)',['read','cache first; on miss load from DB and populate','hot'],['only caches','what\'s actually requested','ok'],['first request','pays the DB cost'],['cache down','app still works (slower)','ok'])],
 say:`<b>Cache-aside</b> (lazy loading): the app checks the cache; on a <b>miss</b> it reads the database and stores the result in the cache with a TTL. Only data that's actually requested gets cached, and if the cache dies the app still works, just slower. This is the default pattern with Redis or Memcached.`},
{hl:{q:[2,6]}, th:[['req2','RUN:ok','cache hit (0.3 ms)']], d:{e:[['app','cache','GET → hit','ok']]}, g:[G('Hit',['latency','~0.3 ms vs ~5 ms DB','ok'],['DB load','removed for this read','ok'],['hit ratio','what you monitor'],['memory','LRU/LFU eviction when full'])], log:['hit ratio 95% → DB sees 1 in 20 reads'],
 say:`The next request is a <b>hit</b>: served from memory in a fraction of a millisecond without touching the database. With a 95% hit ratio, the database sees only one read in twenty. When memory fills up, the cache evicts keys (LRU/LFU).`},
{hl:{q:[9,10]}, th:[['writer','TERM:ok','UPDATE price = 950; DEL key']], d:{e:[['app','db','UPDATE','hot'],['app','cache','DEL product:1','ok']]}, tb:[TB('cache',['key','value'],[['product:1','(deleted)']],{0:'dim'})], g:[G('Invalidation',['update DB first','then DELETE the key','ok'],['next read','misses and reloads fresh data','ok'],['why delete, not set','avoids writing a value computed from stale reads'],['"two hard things"','cache invalidation and naming things'])],
 say:`On update: write the database, then <b>delete</b> the cache key, so the next read reloads fresh data. Deleting is safer than setting the new value from the writer, which can race with other writers. Forgetting to invalidate (or a crash between the two steps) leaves stale data until the TTL expires, which is why every cached key should still have a TTL as a safety net.`},
{hl:{q:[3,4,5]}, th:[['reader','RUN:warn','read 900 from DB (slow)'],['writer','TERM:ok','set 950 + DEL key'],['reader ','TERM:bad','SETs stale 900']], d:{e:[['app','cache','SET stale','bad']]}, tb:[TB('cache',['key','value'],[['product:1','{Laptop, 900} (stale!)']],{0:'bad'})], g:[G('The race',['1','reader misses, reads 900 from DB'],['2','writer updates to 950, deletes key'],['3','reader SETs 900 into cache','bad'],['stale until TTL','bad']), G('Mitigations',['short TTLs','ok'],['delayed double delete','delete again ~1 s later'],['versioned values / CDC-driven invalidation','ok'])],
 say:`Even cache-aside has a race: a slow reader loads 900 from the DB, the writer then updates to 950 and deletes the key, and finally the slow reader writes its stale 900 into the cache. It stays wrong until the TTL. Mitigations: short TTLs, deleting again shortly after the write, versioned values, or driving invalidations from the database's change stream (CDC).`},
{hl:{q:[12,13]}, th:[], d:{e:[['app','cache','write','hot'],['cache','db','sync (through) / async (behind)','hot']]}, g:[G('Write-through',['write','cache and DB synchronously'],['reads','always warm, fresh-ish','ok'],['cost','write latency; caches data nobody reads','bad']), G('Write-behind (write-back)',['write','cache now, DB later in batches'],['fast writes','ok'],['risk','cache crash loses writes','bad'])],
 say:`Other write strategies: <b>write-through</b> updates cache and database together on every write, so the cache is always populated (at the cost of write latency and caching data that may never be read). <b>Write-behind</b> writes to the cache and flushes to the database asynchronously: very fast, but a cache crash loses acknowledged writes, so it's used only where that's acceptable (counters, metrics).`},
{hl:{q:[15,16]}, th:[['req1..req500','BLOCKED:bad','all miss at once → DB']], d:{bad:['db'], e:[['app','db','500 identical queries','bad']]}, g:[G('Cache stampede (thundering herd)',['hot key expires','hundreds of misses at the same instant','bad'],['all rebuild','DB overload, cascading failure','bad']), G('Fixes',['single-flight / lock per key','one rebuild, others wait','ok'],['stale-while-revalidate','serve old value while refreshing','ok'],['TTL jitter','keys don\'t expire together','ok'],['probabilistic early refresh','refresh before expiry','ok'])], log:['key expired: 500 requests hit the DB'],
 say:`The <b>cache stampede</b>: a very hot key expires and hundreds of concurrent requests miss at the same moment, all running the same expensive query, and the database falls over. Fixes: let only one request rebuild the key (a per-key lock or single-flight) while others wait or get the old value (<b>stale-while-revalidate</b>), add random <b>jitter</b> to TTLs so keys don't expire together, or refresh hot keys early.`},
{hl:{}, th:[], d:{}, g:[G('Also consider',['what to cache','hot, expensive, tolerant of staleness'],['negative caching','cache "not found" (short TTL)'],['key design','namespaces, versions (v2:product:1)'],['consistency','caches are eventually consistent by nature'],['local + distributed','in-process LRU + Redis'])],
 say:`<b>Say it:</b> "I default to cache-aside: read the cache, on a miss load from the database and set it with a TTL; on writes update the database then delete the key. Every key gets a TTL as a safety net because invalidation races exist. Write-through keeps the cache warm at a write-latency cost; write-behind is fast but can lose data. For hot keys I prevent stampedes with single-flight rebuilds, stale-while-revalidate and TTL jitter, and I only cache data that can tolerate brief staleness."`}
],
keep:[`Cache-aside: get → miss → DB → set with TTL. Writes: update DB, then DELETE key.`,`Always set TTLs: invalidation can race (stale reader re-populates).`,`Write-through: sync to both (warm cache, slower writes). Write-behind: async DB flush (fast, can lose data).`,`Stampede fixes: single-flight lock, stale-while-revalidate, TTL jitter, early refresh.`]}, {
  imp: 'must',
  theory: TH(`A cache keeps copies of frequently read data in fast memory in front of the database; the hard parts are keeping it fresh (invalidation) and protecting the database when popular entries expire.`,
`<p>A cache is the sticky note on your monitor with a phone number you call often: much faster than looking it up in the directory every time. But if the number changes and you don't update the note, you call the wrong person (stale data).</p>
<p>Databases answer queries in milliseconds; an in-memory cache like Redis answers in a fraction of that and absorbs read traffic, so the database handles fewer, more important queries.</p>`,
[[`Cache hit / miss`,`Found in cache / not found.`],[`Hit ratio`,`Hits ÷ total lookups.`],[`TTL`,`Time to live: automatic expiry.`],[`Cache-aside`,`App loads into cache on miss.`],[`Write-through`,`Writes go to cache and DB synchronously.`],[`Write-behind`,`Writes go to cache; DB updated asynchronously.`],[`Invalidation`,`Removing/refreshing entries after data changes.`],[`Stampede`,`Many concurrent misses for the same key.`]],
[`Read: check cache; on miss load from DB and populate.`,`Write: update the DB, invalidate (delete) the key.`,`TTLs bound staleness; eviction frees memory.`,`Hot keys get stampede protection.`],
[`Redis/Memcached for sessions, product pages, computed aggregates.`,`CDNs cache whole HTTP responses at the edge.`,`Debezium/CDC-driven invalidation for strict freshness needs.`],
[`No TTLs ("we always invalidate").`,`Caching data that must be strongly consistent (balances).`,`Setting the cache from writers instead of deleting.`,`Synchronized expiries causing stampedes.`]),
  examples: [
    {lv:'basic', title:'Cache-aside with a cache table', sql:`CREATE TABLE cache (k TEXT PRIMARY KEY, v TEXT, expires_at INTEGER);
-- miss: load from DB and populate (now = 1000, ttl = 300)
INSERT INTO cache SELECT 'product:1', name || ':' || price, 1000 + 300 FROM products WHERE id = 1;
-- hit
SELECT v FROM cache WHERE k = 'product:1' AND expires_at > 1100;`, why:`The second read is served from the cache table, no products lookup needed (while not expired).`},
    {lv:'mid', title:'Invalidate on update', sql:`CREATE TABLE cache (k TEXT PRIMARY KEY, v TEXT, expires_at INTEGER);
INSERT INTO cache VALUES ('product:1', 'Laptop:900', 1300);
UPDATE products SET price = 950 WHERE id = 1;            -- 1. write the DB
DELETE FROM cache WHERE k = 'product:1';                 -- 2. delete the key
-- next read misses and reloads fresh data
INSERT INTO cache SELECT 'product:1', name || ':' || price, 1400 FROM products WHERE id = 1;
SELECT v FROM cache WHERE k = 'product:1';`, why:`Update-then-delete keeps the cache from serving 900 after the price changed.`},
    {lv:'adv', title:'TTL jitter spreads expiries', sql:`WITH RECURSIVE k(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM k WHERE n < 10)
SELECT 'product:' || n AS key,
       300 AS fixed_ttl,
       300 + (abs(random()) % 60) AS jittered_ttl
FROM k;`, why:`With a fixed TTL, keys cached together expire together (a stampede); a random 0–59 s jitter spreads the reloads out. (Values change on every run.)`},
  ],
  tips: {
    say:`"Default is cache-aside: read cache, on miss load from the DB and set with a TTL; on writes update the DB then delete the key. TTLs are a safety net because invalidation can race. Write-through keeps the cache warm but slows writes, write-behind is fast but risks loss. For hot keys I prevent stampedes with single-flight rebuilds, stale-while-revalidate and TTL jitter. I don't cache data that must be strongly consistent."`,
    points:[`Explain why delete beats set on writes.`,`Describe the stale-reader race.`,`Name stampede mitigations.`],
    traps:[`"Just cache everything."`,`Caching balances or inventory as the source of truth.`],
    qa:[[`Cache-aside vs write-through?`,`Cache-aside populates lazily on reads (only hot data, cache can fail open); write-through writes cache and DB together on every write (always warm, more write latency and cache churn).`],
        [`How do you prevent a cache stampede?`,`Single-flight/mutex per key so one request rebuilds, serve stale while revalidating, jitter TTLs, refresh hot keys early, and rate-limit DB fallbacks.`],
        [`How do you keep cache and DB consistent?`,`You can't make it strictly consistent cheaply; bound staleness with TTLs, invalidate after writes (ideally from CDC), use versioned keys, and avoid caching data that needs linearizable reads.`]]
  },
  exercises: [
    {lv:'E', q:`Create a cache table, cache the Phone (id 2) as <code>'Phone:600'</code> with expiry 1300, then read it at time 1200: return <code>v</code>.`, hint:`INSERT then SELECT … WHERE expires_at &gt; 1200.`,
     sql:`CREATE TABLE cache (k TEXT PRIMARY KEY, v TEXT, expires_at INTEGER);
INSERT INTO cache VALUES ('product:2', 'Phone:600', 1300);
SELECT v FROM cache WHERE k = 'product:2' AND expires_at > 1200;`},
    {lv:'M', q:`Compute the hit ratio from a request log: 8 hits and 2 misses for product:1, 1 hit and 4 misses for product:2. Return <code>k, hit_ratio</code> rounded to 2 decimals.`, hint:`Store (k, hit 1/0) rows and AVG(hit).`,
     sql:`CREATE TABLE lookups (k TEXT, hit INTEGER);
INSERT INTO lookups VALUES ('product:1',1),('product:1',1),('product:1',1),('product:1',1),('product:1',1),('product:1',1),('product:1',1),('product:1',1),('product:1',0),('product:1',0),
                           ('product:2',1),('product:2',0),('product:2',0),('product:2',0),('product:2',0);
SELECT k, ROUND(AVG(hit), 2) AS hit_ratio FROM lookups GROUP BY k;`},
    {lv:'H', q:`A homepage widget runs a 2-second aggregate query, cached in Redis with TTL 60 s. Every minute the DB CPU spikes to 100% and the site slows. Diagnose and fix.`, hint:`Stampede on expiry.`,
     answer:`<p>Cache stampede: when the key expires, every concurrent homepage request misses and runs the 2 s query. Fixes: single-flight lock (SET NX on a lock key; others serve the stale value), stale-while-revalidate with a background refresher that recomputes before expiry, TTL jitter, or precompute the aggregate on a schedule / in a materialized view (2.6) and never compute it on the request path.</p>`},
  ],
  quiz: [
    [`In cache-aside, on a cache miss the app…`,[`Returns an error`,`Reads from the DB and populates the cache`,`Waits for the cache to fill itself`,`Writes to the DB`],1,`Lazy loading.`,'E'],
    [`After updating the DB, the safest cache action is usually…`,[`SET the new value`,`DELETE the key`,`Nothing`,`FLUSHALL`],1,`Avoids racing writers.`,'M'],
    [`Why set a TTL even when you invalidate on writes?`,[`Required by Redis`,`Safety net against missed invalidations and races`,`Faster reads`,`Saves CPU`],1,`Bounds staleness.`,'M'],
    [`Write-behind caching risks…`,[`Slow writes`,`Losing writes acknowledged by the cache if it crashes before flushing`,`Stale reads only`,`Deadlocks`],1,`Async durability.`,'M'],
    [`A cache stampede is…`,[`Too many keys`,`Many concurrent misses for one hot key overwhelming the DB`,`Memory fragmentation`,`Replication lag`],1,`Thundering herd.`,'E'],
    [`Which mitigates stampedes?`,[`Longer queries`,`Single-flight rebuild + stale-while-revalidate + TTL jitter`,`Disabling TTLs`,`More replicas only`],1,`One rebuild per key.`,'E'],
  ],
  quizAdv: [
    [`Negative caching means…`,[`Caching errors forever`,`Caching "not found" results (briefly) to protect the DB from repeated misses`,`Deleting keys`,`Caching negative numbers`],1,`Also blocks key-enumeration attacks hitting the DB.`,'H'],
    [`Why is a write-then-delete invalidation still racy?`,[`It isn't`,`A slow reader that loaded old data before the write can repopulate the cache after the delete`,`Redis reorders commands`,`TTLs don't work`],1,`Hence TTLs/double delete/CDC.`,'H'],
    [`Redis eviction policy allkeys-lfu evicts…`,[`Oldest keys`,`Least frequently used keys`,`Random keys`,`Keys with TTL only`],1,`Good for skewed popularity.`,'H'],
  ],
});
