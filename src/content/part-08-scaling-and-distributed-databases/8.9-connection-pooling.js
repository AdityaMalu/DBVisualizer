/* 8.9 Connection pooling */
topic('8', { no:'8.9', title:'Connection pooling: why, how big, and PgBouncer modes', db:'shop',
idea:`Opening a database connection is expensive and each one costs server memory. See requests borrow and return connections from a pool, what happens when the pool is exhausted, why a smaller pool is often faster, and how an external pooler (PgBouncer) multiplexes thousands of clients onto a few server connections.`,
actors:'Requests', dgTitle:'App instances, pool, database', stateTitle:'Pool',
nodes:{
  a1:{x:60,y:40,label:'app pod 1',w:100,kind:'actor'},
  a2:{x:60,y:110,label:'app pod 2',w:100,kind:'actor'},
  a3:{x:60,y:180,label:'app pod …50',w:100,kind:'actor'},
  pb:{x:250,y:110,label:'PgBouncer\n(transaction mode)',w:150,h:48,kind:'lock'},
  db:{x:440,y:110,label:'Postgres\n(max_connections)',w:150,h:50,kind:'db'}
},
edges:[['a1','pb'],['a2','pb'],['a3','pb'],['pb','db']],
vb:'0 0 520 220',
codes:{a:`-- without a pool: every request opens a connection
connect (TCP + TLS + auth + backend process fork)  ~ 5–50 ms
query                                              ~ 1 ms
close

-- with a pool (HikariCP, pgx, SQLAlchemy, …)
conn = pool.borrow(timeout = 30s)   -- reuse an open connection
conn.query(…)
pool.return(conn)                   -- ALWAYS, even on errors (try/finally)

-- sizing: connections ≈ (CPU cores × 2) + effective disks   (rule of thumb)
-- 50 pods × 20 connections = 1000 Postgres backends → memory, contention

-- external pooler: PgBouncer pool_mode = transaction
--   1000 client connections → 40 server connections`},
steps:[
{hl:{q:[1,2,3,4]}, th:[['req1','RUN:warn','connecting… 20 ms'],['req2','RUN:warn','connecting… 20 ms']], d:{hide:['pb','a3']}, g:[G('Cost of a connection',['setup','TCP + TLS handshake + auth','bad'],['Postgres','forks a backend process (~5–10 MB each)','bad'],['query itself','often ~1 ms'],['result','setup dominates short requests','bad'])],
 say:`Opening a database connection involves a TCP handshake, TLS, authentication and, in PostgreSQL, forking a whole backend process. That's often 5–50 ms, while the query itself takes 1 ms. Opening a fresh connection per request wastes most of the time and memory.`},
{hl:{q:[6,7,8,9]}, th:[['req1','RUN:ok','borrowed conn 1'],['req2','RUN:ok','borrowed conn 2'],['req3','WAITING:warn','pool empty → waits']], d:{hide:['pb','a3'], e:[['a1','db','pooled','ok'],['a2','db','pooled','ok']]}, g:[G('Pool (size 2)',['conn 1','req1','hot'],['conn 2','req2','hot'],['waiting','req3 (up to timeout)'],['return','in finally, or the pool leaks','bad'])],
 say:`A <b>connection pool</b> keeps a set of open connections. A request <b>borrows</b> one, runs its queries and <b>returns</b> it; the next request reuses it with no setup cost. When all are busy, new requests wait (up to a timeout). Always return connections in a <code>finally</code>/<code>with</code> block: a leaked connection shrinks the pool until everything blocks.`},
{hl:{q:[11]}, th:[['req1','RUN:ok',''],['req2','RUN:ok','']], d:{hide:['pb','a3']}, g:[G('Pool size: smaller is often faster',['DB has','N cores, limited disk I/O'],['200 active connections','context switching, lock and cache contention','bad'],['~2× cores','queries queue in the app instead, finish faster','ok'],['long transactions','hold connections: size for them or fix them'])],
 say:`Counter-intuitive but well established: a <b>smaller pool is often faster</b>. A database with 16 cores can't run 200 queries at once; extra connections just add context switching and contention. A pool of roughly (cores × 2) + disks lets queries queue in the application and finish sooner. If requests hold connections for long (slow transactions, external calls inside transactions), fix that rather than growing the pool.`},
{hl:{q:[12]}, th:[], d:{hide:['pb'], on:['db'], e:[['a1','db','20','bad'],['a2','db','20','bad'],['a3','db','20 × 48','bad']]}, g:[G('Microservices math',['50 pods × pool 20','1000 server connections','bad'],['Postgres','~1000 backend processes: RAM, slower snapshots','bad'],['autoscaling','more pods → more connections → DB falls over','bad'])], log:['FATAL: sorry, too many clients already'],
 say:`Pools live <i>inside</i> each app instance. With 50 pods × 20 connections you get 1,000 server connections; autoscaling adds more. Postgres (process per connection) degrades well before that and eventually refuses with "too many clients". Per-pod pools alone don't bound the total.`},
{hl:{q:[14,15]}, th:[], d:{on:['pb'], e:[['a1','pb','',''],['a2','pb','',''],['a3','pb','',''],['pb','db','40 conns','ok']]}, g:[G('PgBouncer modes',['session','client keeps a server conn for its session (little gain)'],['transaction','server conn only during a transaction','ok'],['statement','per statement (no multi-statement txns)'],['transaction mode caveats','no session state: SET, advisory locks, LISTEN, (old) prepared statements','bad'])],
 say:`An <b>external pooler</b> such as PgBouncer (or RDS Proxy, pgcat, ProxySQL for MySQL) sits between apps and the database. In <b>transaction mode</b> a client gets a real server connection only while a transaction runs, so 1,000 mostly idle client connections share 40 server connections. The catch: session state (SET, temp tables, advisory locks, LISTEN, server-side prepared statements in older versions) doesn't survive across transactions.`},
{hl:{}, th:[], d:{}, g:[G('Checklist',['always pool','ok'],['size small, measure','pool wait time, active vs idle'],['set timeouts','connection, idle, max lifetime'],['return in finally','no leaks'],['short transactions','no network calls inside'],['many instances','external pooler'])],
 say:`<b>Say it:</b> "Connections are expensive to open and each costs server memory, so apps reuse them through a pool. I keep pools small, around twice the database cores, because more concurrent queries only add contention, set acquisition timeouts, and always return connections. With many app instances I put an external pooler like PgBouncer in transaction mode in front of Postgres, being careful with session state."`}
],
keep:[`Opening a connection: TCP/TLS/auth (+ process fork in Postgres) ≫ a simple query.`,`Pool: borrow → use → return (in finally). Waiters time out when exhausted.`,`Smaller pools are often faster (~2 × cores); fix long transactions instead of growing pools.`,`Many pods × pool size can exceed DB limits → external pooler (PgBouncer transaction mode; mind session state).`]}, {
  imp: 'good',
  theory: TH(`A connection pool keeps database connections open and lends them to requests, avoiding expensive connection setup and capping how many queries hit the database at once.`,
`<p>Opening a connection is like making a phone call that needs dialling, verification and a fresh operator assigned each time. A pool keeps a few lines open permanently and hands them out to whoever needs to talk, then takes them back.</p>
<p>The pool also acts as a throttle: if the database can only do 32 things at once, letting 500 requests in simultaneously makes everyone slower. Queueing in the app is cheaper than thrashing in the database.</p>`,
[[`Connection pool`,`Set of reusable open connections.`],[`Borrow / return`,`Take a connection for a unit of work, give it back.`],[`Pool exhaustion`,`All connections busy; callers wait or fail.`],[`Connection leak`,`A connection never returned.`],[`max_connections`,`Server-side connection limit.`],[`External pooler`,`Proxy that multiplexes clients onto fewer server connections (PgBouncer).`],[`Transaction pooling`,`Server connection assigned per transaction.`]],
[`At startup the pool opens a few connections.`,`Requests borrow, use and return connections.`,`If none are free, requests wait up to a timeout.`,`Connections are validated and recycled after a max lifetime.`],
[`HikariCP (Java), pgx/pgxpool (Go), SQLAlchemy pools, Prisma.`,`PgBouncer/RDS Proxy for serverless and many-pod deployments.`,`Dashboards: active/idle/waiting connections, acquire time.`],
[`Huge pools "for throughput".`,`Holding connections during HTTP calls.`,`Forgetting that serverless functions each open their own connections.`,`Using session features through a transaction-mode pooler.`]),
  examples: [
    {lv:'basic', title:'Pool math: total server connections', sql:`SELECT 50 AS pods, 20 AS pool_per_pod, 50 * 20 AS server_connections,
       16 AS db_cores, 16 * 2 AS useful_concurrency;`, why:`1,000 connections for a database that can usefully run ~32 queries at once: most connections would just wait and consume memory.`},
    {lv:'mid', title:'Simulate pool wait time', sql:`CREATE TABLE requests (id INTEGER, arrive_ms INTEGER, work_ms INTEGER);
INSERT INTO requests VALUES (1,0,40),(2,0,40),(3,5,40),(4,10,40),(5,10,40),(6,15,40);
-- pool size 2: request i can start only when one of the earlier requests finished.
-- simple model: each "slot" serves every 2nd request in order
SELECT id, arrive_ms,
       ((id - 1) / 2) * 40 AS start_ms,
       ((id - 1) / 2) * 40 - arrive_ms AS waited_ms
FROM requests ORDER BY id;`, why:`With 2 connections and 40 ms queries, later requests queue. Raising the pool helps only if the database has spare CPU/I/O; otherwise each query just gets slower.`},
    {lv:'adv', title:'Find connection hogs (Postgres, shown, not run)', sql:`SELECT pid, usename, application_name, state,
       now() - xact_start AS in_transaction_for,
       left(query, 60) AS query
FROM pg_stat_activity
WHERE state IN ('active', 'idle in transaction')
ORDER BY xact_start;`, run:false, why:`"idle in transaction" sessions hold a connection (and old snapshots, 6.5) while doing nothing: usually an app forgot to commit or is making a network call mid-transaction.`},
  ],
  tips: {
    say:`"Opening connections is expensive and each one costs database memory, so apps use a pool: borrow, use, return in a finally block. I size pools small, roughly twice the database cores, because extra concurrency only adds contention, and I set acquire timeouts. With many instances or serverless, I add an external pooler like PgBouncer in transaction mode, avoiding session-level state."`,
    points:[`Explain why bigger pools can be slower.`,`Do the pods × pool-size arithmetic.`,`Know PgBouncer modes and their caveats.`],
    traps:[`Setting max pool size to hundreds per instance.`,`Ignoring connection leaks and idle-in-transaction sessions.`],
    qa:[[`Why is Postgres sensitive to many connections?`,`Process per connection (memory), plus per-snapshot work that scales with the number of backends; thousands of connections hurt even if idle.`],
        [`Session vs transaction pooling?`,`Session: a client owns a server connection for its whole session (safe, little sharing). Transaction: shared between transactions (big savings), but session state doesn't persist.`],
        [`Requests time out waiting for a pool connection. What do you check?`,`Slow queries, long or idle transactions holding connections, leaks, external calls inside transactions; only then pool size versus DB capacity.`]]
  },
  exercises: [
    {lv:'E', q:`Compute total server connections for 12 pods with pool size 15, and whether it exceeds max_connections = 150: return <code>total, exceeds</code> (1 or 0).`, hint:`12 * 15, then a CASE.`,
     sql:`SELECT 12 * 15 AS total, CASE WHEN 12 * 15 > 150 THEN 1 ELSE 0 END AS exceeds;`},
    {lv:'M', q:`Using the requests table from example 2, compute each request's wait with pool size 3 (start = ((id − 1) / 3) × 40): <code>id, waited_ms</code>.`, hint:`Integer division in SQLite.`,
     sql:`CREATE TABLE requests (id INTEGER, arrive_ms INTEGER, work_ms INTEGER);
INSERT INTO requests VALUES (1,0,40),(2,0,40),(3,5,40),(4,10,40),(5,10,40),(6,15,40);
SELECT id, MAX(0, ((id - 1) / 3) * 40 - arrive_ms) AS waited_ms FROM requests;`},
    {lv:'H', q:`A serverless API (Lambda) scales to 3,000 concurrent invocations and each opens a Postgres connection. Postgres falls over at peak. Propose a design.`, hint:`Connection multiplexing and limiting concurrency.`,
     answer:`<ul><li>Put RDS Proxy / PgBouncer in transaction mode between functions and Postgres, so thousands of client connections share a bounded server pool.</li><li>Reuse connections across invocations (initialise outside the handler).</li><li>Cap concurrency (reserved concurrency) to what the DB can serve; queue the rest (SQS).</li><li>Keep transactions short; move heavy reads to replicas/caches.</li></ul>`},
  ],
  quiz: [
    [`Main benefit of a connection pool?`,[`Encrypts queries`,`Reuses connections, avoiding expensive setup and bounding concurrency`,`Caches results`,`Replicates data`],1,`Setup costs ≫ query time.`,'E'],
    [`Why can a larger pool make things slower?`,[`It can't`,`More concurrent queries than cores/disks cause contention and context switching`,`Pools use locks`,`Network limits`],1,`Queue in the app instead.`,'M'],
    [`A connection not returned to the pool is…`,[`Recycled automatically`,`Leaked, shrinking the pool until requests block`,`Faster`,`Committed`],1,`Return in finally.`,'E'],
    [`PgBouncer transaction mode lets…`,[`Each client keep a server connection forever`,`Many clients share few server connections, one transaction at a time`,`Queries run without transactions`,`Replication`],1,`Big multiplexing gain.`,'M'],
    [`What breaks under transaction pooling?`,[`Simple SELECTs`,`Session state like SET, advisory locks, LISTEN, temp tables`,`INSERTs`,`Indexes`],1,`State doesn't persist.`,'M'],
    [`50 pods × pool 30 against max_connections 500…`,[`Fine`,`Exceeds the limit at peak (1,500)`,`Uses 30 connections`,`Uses 50 connections`],1,`Bound the total.`,'E'],
  ],
  quizAdv: [
    [`HikariCP's maxLifetime should be…`,[`Infinite`,`A bit shorter than any network/DB idle timeout so connections are recycled before being killed`,`Zero`,`Equal to the query timeout`],1,`Avoids broken connections.`,'H'],
    [`Postgres 14+ improved connection scalability mainly by…`,[`Threads instead of processes`,`Making snapshot computation cheaper with many backends`,`Removing max_connections`,`Built-in pooling`],1,`Still a process per connection.`,'H'],
    [`A pool sized larger than max_connections across instances leads to…`,[`Better throughput`,`Connection errors at peak or idle connections being refused`,`Nothing`,`Deadlocks only`],1,`Plan the total budget.`,'M'],
  ],
});
