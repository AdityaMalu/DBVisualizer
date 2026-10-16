/* 8.2 Replication lag and consistency models */
topic('8', { no:'8.2', title:'Replication lag and consistency models: read-your-writes, monotonic reads, eventual, strong', db:'shop',
idea:`Reads from lagging replicas create user-visible weirdness. Step through three anomalies (your own update vanishes, time goes backwards, an answer appears before its question) and the consistency guarantee that fixes each, up to linearizability.`,
actors:'Who', dgTitle:'Primary and replicas', stateTitle:'Guarantee',
nodes:{
  u:{x:60,y:110,label:'user',w:80,kind:'actor'},
  p:{x:250,y:40,label:'primary',w:110,h:46,kind:'db'},
  r1:{x:250,y:180,label:'replica A\n(lag 10 ms)',w:130,h:46,kind:'db'},
  r2:{x:440,y:180,label:'replica B\n(lag 5 s)',w:130,h:46,kind:'db'}
},
edges:[['p','r1'],['p','r2']],
vb:'0 0 520 230',
codes:{a:`-- 1. write to the primary
UPDATE customers SET city = 'Delhi' WHERE id = 1;

-- 2. next request reads from a lagging replica
SELECT city FROM customers WHERE id = 1;     -- 'Pune'  ← my change vanished!

-- fixes for read-your-writes
--   read from the primary for N seconds after a user writes
--   or track the write's LSN and read only from replicas that have it
--   or route the user's session to one replica (sticky) + wait for LSN

-- consistency models (weak → strong)
-- eventual → monotonic reads → read-your-writes → consistent prefix
--        → causal → linearizable (strong)`},
steps:[
{hl:{q:[1,2]}, th:[['user','RUN:ok','changes city to Delhi']], d:{on:['u','p'], e:[['u','p','write','hot']]}, g:[G('Eventual consistency',['promise','if writes stop, replicas eventually converge'],['says nothing about','what you read in the meantime','bad'])],
 say:`With asynchronous replicas the system is <b>eventually consistent</b>: if writes stopped, all replicas would eventually hold the same data. That's a weak promise: it says nothing about what a reader sees <i>now</i>. Asha changes her city to Delhi on the primary.`},
{hl:{q:[4,5]}, th:[['user','RUN:bad','sees Pune again!']], d:{on:['r2'], e:[['u','r2','read','bad'],['p','r2','5 s behind','dash']]}, g:[G('Anomaly 1',['read-your-writes violated','bad'],['user sees','their own update undone'],['cause','read routed to a lagging replica'])], log:['saved "Delhi" → page reload shows "Pune"'],
 say:`Her next page load is routed to replica B, 5 seconds behind: it still says Pune. From the user's view, her save was lost. The guarantee she needs is <b>read-your-writes</b> (read-after-write consistency): a user always sees their own writes.`},
{hl:{q:[7,8,9,10]}, th:[['user','RUN:ok','sees Delhi']], d:{on:['p','r1'], e:[['u','p','read (recent writer)','ok']]}, g:[G('Read-your-writes fixes',['recent writer → primary','e.g. for 10 s after a write','ok'],['LSN token','replica must have replayed ≥ the write\'s LSN','ok'],['sync replica','remote_apply (8.1)'],['scope','per user/session, not global'])],
 say:`Fixes: route a user's reads to the primary for a short window after they write; or remember the write's position in the log (LSN, GTID) and only read from a replica that has replayed at least that far; or use synchronous apply on the replica serving them. It's a per-user guarantee: other users may still see the old city for a while, which is usually fine.`},
{hl:{}, th:[['user','RUN:bad','sees 3 comments, then 2']], d:{on:['r1','r2'], e:[['u','r1','read 1: new','ok'],['u','r2','read 2: older','bad']]}, g:[G('Anomaly 2',['monotonic reads violated','bad'],['first read','replica A (up to date): 3 comments'],['refresh','replica B (behind): 2 comments'],['fix','stick each user to one replica (e.g. hash of user id)','ok'])],
 say:`Anomaly 2: a user refreshes a page twice; the first read hits up-to-date replica A (3 comments), the second hits lagging replica B (2 comments). Data <b>moved backwards in time</b>. <b>Monotonic reads</b> guarantees that once you've seen a state, you never see an older one; the usual fix is to route each user to the same replica.`},
{hl:{}, th:[['Mr. Poons','RUN:ok','"How far into the future can you see?"'],['Mrs. Cake','RUN:ok','"About ten seconds"']], d:{on:['r2']}, g:[G('Anomaly 3',['consistent prefix violated','bad'],['observer sees','the answer before the question'],['cause','writes on different partitions replicate at different speeds'],['fix','causally related writes to the same partition / causal consistency','ok'])],
 say:`Anomaly 3 (from <i>Designing Data-Intensive Applications</i>): an observer sees Mrs. Cake's answer before Mr. Poons's question, because the two writes live on different partitions that replicate at different speeds. <b>Consistent prefix reads</b> guarantee you see writes in an order that makes sense; <b>causal consistency</b> generalises it: if B depends on A, nobody sees B without A.`},
{hl:{q:[12,13,14]}, th:[], d:{}, g:[G('Consistency ladder',['eventual','converges someday'],['monotonic reads','no going back in time'],['read-your-writes','see your own writes'],['consistent prefix / causal','cause before effect'],['linearizable (strong)','behaves like one copy; reads see the latest committed write','hot'])],
 say:`<b>Linearizability</b> (strong consistency) is the top of the ladder: the system behaves as if there were a single copy of the data, so every read returns the latest completed write, for everyone. It needs coordination (reading from the leader, quorum or consensus) and therefore costs latency and availability during network partitions (CAP, 8.5).`},
{hl:{}, th:[], d:null, g:[G('Practical choices',['user profile, settings','read-your-writes','ok'],['feeds, comments','monotonic reads + eventual'],['chat / threads','causal'],['balances, inventory, uniqueness, locks','linearizable (primary / consensus)','ok'])],
 say:`<b>Say it:</b> "Async replicas are eventually consistent, which shows up as anomalies: users not seeing their own writes, data going back in time, or effects before causes. I pick guarantees per feature: read-your-writes by routing recent writers to the primary or waiting for the write's LSN on the replica; monotonic reads with sticky replicas; causal ordering by keeping related writes together; and linearizable reads from the leader for things like balances and uniqueness."`}
],
keep:[`Eventual: converges eventually; no promise about current reads.`,`Read-your-writes: route recent writers to primary or wait for their LSN on the replica.`,`Monotonic reads: sticky replica per user. Consistent prefix/causal: cause before effect.`,`Linearizable = single-copy behaviour; needs leader/quorum; costs latency/availability.`]}, {
  imp: 'good',
  theory: TH(`When reads go to replicas that lag behind, users can observe stale or out-of-order data; consistency models name exactly which of these anomalies a system rules out.`,
`<p>Replicas apply changes a little after the primary. Most of the time nobody notices; but a user who just changed something and immediately reads from a lagging replica will see the old value. Consistency models are precise promises about what reads can return: from "eventually everything agrees" to "it behaves exactly like a single copy".</p>
<p>Stronger promises need more coordination between servers, so they cost latency. The art is choosing the weakest promise each feature can live with.</p>`,
[[`Replication lag`,`Delay between a write on the primary and its visibility on a replica.`],[`Eventual consistency`,`Replicas converge if writes stop.`],[`Read-your-writes`,`A user always sees their own earlier writes.`],[`Monotonic reads`,`A user never sees older data after newer data.`],[`Consistent prefix`,`Writes are seen in an order respecting causality.`],[`Causal consistency`,`Causally related operations seen in order by everyone.`],[`Linearizability`,`Every operation appears atomic at a single point in time; reads see the latest write.`]],
[`Writes go to the leader; replicas apply them asynchronously.`,`Readers hit different replicas with different lag.`,`Session-level techniques (primary routing, LSN waits, stickiness) give per-user guarantees.`,`Linearizable reads need the leader or a quorum/consensus read.`],
[`"Read from primary after write" flags in ORMs/proxies (e.g. Rails' automatic role switching).`,`Waiting for a replica to reach an LSN/GTID before reading.`,`Product decisions: which screens tolerate staleness.`],
[`Load balancing reads randomly across replicas with different lag.`,`Showing a user stale data right after their own action.`,`Using replicas for checks that need fresh data (uniqueness, balance checks).`]),
  examples: [
    {lv:'basic', title:'A stale read from a replica', sql:`CREATE TABLE replica_b AS SELECT * FROM customers;          -- replica B (lagging)
UPDATE customers SET city = 'Delhi' WHERE id = 1;            -- write on primary
SELECT 'primary' AS read_from, city FROM customers WHERE id = 1
UNION ALL
SELECT 'replica B', city FROM replica_b WHERE id = 1;`, why:`The write is on the primary; replica B hasn't applied it: a read-your-writes violation if the user is routed there.`},
    {lv:'mid', title:'LSN-based routing: only read from replicas that caught up', sql:`CREATE TABLE replicas (name TEXT, replayed_lsn INTEGER);
INSERT INTO replicas VALUES ('A', 1050), ('B', 990), ('C', 1100);
-- the user's last write was at LSN 1040: which replicas may serve their read?
SELECT name FROM replicas WHERE replayed_lsn >= 1040 ORDER BY name;`, why:`Replicas A and C have replayed past the write; B would show stale data. Postgres exposes pg_last_wal_replay_lsn() for exactly this.`},
    {lv:'adv', title:'Sticky replicas for monotonic reads', sql:`CREATE TABLE replicas (idx INTEGER, name TEXT);
INSERT INTO replicas VALUES (0, 'A'), (1, 'B'), (2, 'C');
-- route every customer to the same replica: hash(customer_id) mod 3
SELECT c.id, c.name, r.name AS replica
FROM customers c JOIN replicas r ON r.idx = c.id % 3
ORDER BY c.id;`, why:`Each user always reads from the same replica, so their view never jumps backwards (unless that replica fails over).`},
  ],
  tips: {
    say:`"Async replicas give eventual consistency, which surfaces as anomalies: users not seeing their own writes, data jumping back in time, effects before causes. I pick per-feature guarantees: read-your-writes by routing recent writers to the primary or waiting on the replica for the write's LSN; monotonic reads with sticky replicas; causal ordering by keeping related data together; and strongly consistent reads from the leader for balances and uniqueness."`,
    points:[`Name each anomaly with a user-facing example.`,`Give a concrete technique for each guarantee.`,`Connect linearizability to CAP.`],
    traps:[`Saying "eventual consistency" means "consistent within a second".`,`Fixing read-your-writes by sending all reads to the primary (kills read scaling).`],
    qa:[[`How do you implement read-your-writes with read replicas?`,`After a write, store its LSN/GTID (or a timestamp) in the session; route that user's reads to replicas that have replayed past it, or to the primary for a short window.`],
        [`Linearizability vs serializability?`,`Linearizability: single-object recency (reads see the latest write, real-time order). Serializability: transaction isolation (result equals some serial order). Strict serializability = both.`],
        [`Which features can tolerate eventual consistency?`,`Like counts, feeds, recommendations, analytics. Not: balances, inventory reservations, uniqueness checks, permissions changes.`]]
  },
  exercises: [
    {lv:'E', q:`Simulate replica lag: copy products into <code>replica_products</code>, raise the Laptop price to 950 on the primary, and return <code>primary_price, replica_price</code> for the Laptop.`, hint:`CREATE TABLE … AS SELECT; UPDATE products; two scalar subqueries.`,
     sql:`CREATE TABLE replica_products AS SELECT * FROM products;
UPDATE products SET price = 950 WHERE name = 'Laptop';
SELECT (SELECT price FROM products WHERE name = 'Laptop') AS primary_price,
       (SELECT price FROM replica_products WHERE name = 'Laptop') AS replica_price;`},
    {lv:'M', q:`Replicas A (LSN 500), B (LSN 720), C (LSN 640). A user's last write was at LSN 650. Return the replicas allowed to serve them: <code>name</code>.`, hint:`replayed_lsn &gt;= 650.`,
     sql:`CREATE TABLE replicas (name TEXT, replayed_lsn INTEGER);
INSERT INTO replicas VALUES ('A', 500), ('B', 720), ('C', 640);
SELECT name FROM replicas WHERE replayed_lsn >= 650;`},
    {lv:'H', q:`For each feature choose the weakest acceptable guarantee: (a) "edit profile then view it", (b) comment thread replies, (c) "like" counter, (d) checking a username is free at signup, (e) bank balance before withdrawal.`, hint:`Eventual, monotonic, read-your-writes, causal, linearizable.`,
     answer:`(a) read-your-writes · (b) causal (replies after the comments they answer) · (c) eventual (maybe monotonic) · (d) linearizable, really a UNIQUE constraint on the primary · (e) linearizable / transactional on the primary.`},
  ],
  quiz: [
    [`Eventual consistency guarantees…`,[`Reads always see the latest write`,`Replicas converge if writes stop`,`Monotonic reads`,`Causality`],1,`Weakest common guarantee.`,'E'],
    [`A user updates their profile and the next page shows the old data. Violated guarantee?`,[`Monotonic reads`,`Read-your-writes`,`Linearizability only`,`Durability`],1,`Their own write.`,'E'],
    [`Seeing 3 comments then 2 on refresh violates…`,[`Read-your-writes`,`Monotonic reads`,`Atomicity`,`Isolation`],1,`Time went backwards.`,'M'],
    [`A common fix for monotonic reads?`,[`Read from random replicas`,`Stick each user to one replica`,`Disable replication`,`Use UNION`],1,`Same replica, non-decreasing state.`,'M'],
    [`Linearizability means…`,[`Transactions are serializable`,`The system behaves like a single copy: reads see the latest completed write`,`Data is eventually consistent`,`Writes are batched`],1,`Strong consistency.`,'M'],
    [`Seeing an answer before its question violates…`,[`Consistent prefix / causal consistency`,`Durability`,`Read-your-writes`,`Atomicity`],0,`Cause before effect.`,'M'],
  ],
  quizAdv: [
    [`Strict serializability is…`,[`Serializability only`,`Serializability + linearizability (real-time order)`,`Eventual consistency`,`Snapshot isolation`],1,`What Spanner offers.`,'H'],
    [`Why does reading from the leader not always give linearizable reads in Raft-based systems?`,[`It always does`,`A deposed leader may not know it lost leadership; it needs a quorum check or lease`,`Leaders don't store data`,`Reads go to followers`],1,`ReadIndex / leader leases.`,'H'],
    [`Waiting for a replica to reach the client's write LSN provides…`,[`Linearizability for all users`,`Read-your-writes for that client`,`Monotonic reads for all users`,`Durability`],1,`Session guarantee.`,'H'],
  ],
});
