/* 8.5 CAP theorem and PACELC */
topic('8', { no:'8.5', title:'CAP theorem and PACELC: consistency vs availability under partitions', db:'shop',
idea:`A network cable between two data centres is cut. A user writes in one, another reads in the other. Step through the only two honest choices (refuse, or answer with possibly stale data), see why "pick two of three" is misleading, and how PACELC adds the latency trade-off that exists even without failures.`,
actors:'Clients', dgTitle:'Two replicas, one partition', stateTitle:'Choice',
nodes:{
  c1:{x:60,y:60,label:'client 1',w:90,kind:'actor'},
  c2:{x:460,y:60,label:'client 2',w:90,kind:'actor'},
  n1:{x:150,y:170,label:'node X\n(Mumbai)',w:120,h:50,kind:'db'},
  n2:{x:370,y:170,label:'node Y\n(Frankfurt)',w:120,h:50,kind:'db'}
},
edges:[['c1','n1'],['c2','n2'],['n1','n2','replication','line']],
vb:'0 0 520 230',
codes:{a:`-- C  consistency  (linearizability): every read sees the latest write
-- A  availability: every request to a non-failed node gets a response
-- P  partition tolerance: the system keeps working despite lost messages

-- partitions WILL happen, so during one you choose:
--   CP: refuse (error/timeout) rather than risk a stale/conflicting answer
--   AP: answer anyway; reconcile divergent replicas later

-- PACELC: if Partition → A or C; Else → Latency or Consistency
--   PC/EC: Spanner, CockroachDB, etcd/ZooKeeper, single-leader sync replication
--   PA/EL: Cassandra, DynamoDB (default), Riak, async multi-region
--   tunable: Cassandra / Dynamo quorum settings (8.8), Mongo read/write concerns`},
steps:[
{hl:{q:[1,2,3]}, th:[['client 1','NEW:dim',''],['client 2','NEW:dim','']], d:{e:[['n1','n2','replicating','ok']]}, g:[G('CAP terms (precise)',['C','linearizable: behaves like one copy','hot'],['A','every request to a live node gets a (non-error) answer'],['P','works despite network partitions'])],
 say:`The <b>CAP theorem</b> (Brewer, proved by Gilbert & Lynch) is about a replicated system during a <b>network partition</b>. Its terms are narrow: <b>C</b> means linearizability (8.2), not ACID consistency; <b>A</b> means every request to a non-failed node gets a non-error response; <b>P</b> means the system continues despite dropped messages between nodes. Two replicas, Mumbai and Frankfurt, normally replicate to each other.`},
{hl:{q:[5]}, th:[['client 1','RUN:ok','writes price = 950 to X'],['client 2','NEW:dim','']], d:{bad:[], e:[['c1','n1','write','hot'],['n1','n2','✂ partition','bad dash']]}, g:[G('Partition',['X ↔ Y link','down','bad'],['X','has the new price'],['Y','can\'t learn about it'])], log:['link X–Y down','client 1: price = 950 on X'],
 say:`The link between the data centres fails: a <b>partition</b>. Both nodes are alive, but they can't talk. Client 1 writes the Laptop price 950 to node X. Node Y can't receive it. In real networks partitions aren't optional (cables, switches, misconfigurations, GC pauses that look like partitions), so "P" isn't something you choose to give up.`},
{hl:{q:[6]}, th:[['client 1','TERM:ok',''],['client 2','BLOCKED:warn','read → error / timeout']], d:{bad:['n2'], e:[['c2','n2','read → refuse','bad'],['n1','n2','✂','bad dash']]}, g:[G('CP choice',['Y refuses','can\'t confirm it has the latest value'],['consistency','preserved: nobody reads stale data','ok'],['availability','lost on Y\'s side','bad'],['examples','majority-quorum systems: minority side stops'])], log:['client 2: ERROR: not enough replicas'],
 say:`Client 2 reads the price from node Y. <b>Choice 1, CP</b>: Y refuses (error or timeout) because it can't be sure it has the latest value. Consistency is preserved; availability is lost for clients on Y's side. Consensus-based systems (etcd, ZooKeeper, Spanner, CockroachDB) behave this way: the minority side of a partition stops serving.`},
{hl:{q:[7]}, th:[['client 1','TERM:ok',''],['client 2','TERM:warn','gets 900 (stale)']], d:{ok:['n2'], e:[['c2','n2','read → 900','hot'],['n1','n2','✂','bad dash']]}, g:[G('AP choice',['Y answers','with what it has: 900','hot'],['availability','preserved','ok'],['consistency','violated: stale read','bad'],['writes on both sides','conflicts → resolve later (LWW, CRDTs, merge)'],['examples','Cassandra, DynamoDB, Riak, DNS'])], log:['client 2: price = 900 (stale)'],
 say:`<b>Choice 2, AP</b>: Y answers with what it has, 900. The system stays available but returns stale data; if both sides accept writes, they diverge and must be <b>reconciled</b> after the partition heals (last-write-wins, version vectors, CRDTs, application merge). Dynamo-style stores (Cassandra, DynamoDB, Riak) favour this.`},
{hl:{}, th:[], d:{e:[['n1','n2','healed','ok']]}, g:[G('"Pick 2 of 3" is misleading',['P','not optional in a distributed system','bad'],['the real choice','C or A, only DURING a partition','hot'],['most of the time','no partition: you can have both'],['CA','= a single node (or pretending partitions don\'t happen)'])],
 say:`Why "pick two of three" misleads: you can't opt out of partitions, and when there is <i>no</i> partition you can have both consistency and availability. CAP really says: <b>when a partition happens, a replicated system must choose between consistency and availability</b> for the affected operations. "CA" just means a single node.`},
{hl:{q:[9,10,11,12]}, th:[], d:{e:[['c1','n1','write','hot'],['n1','n2','wait for ack?','hot']]}, g:[G('PACELC',['if Partition','choose A or C'],['Else (normal operation)','choose Latency or Consistency','hot'],['PC/EC','always coordinate: consistent, slower (Spanner)'],['PA/EL','never wait: fast, eventually consistent (Cassandra default)'],['mixed','e.g. sync in-region, async cross-region'])],
 say:`<b>PACELC</b> (Abadi) completes the picture: if there's a <b>P</b>artition, choose <b>A</b> or <b>C</b>; <b>E</b>lse, in normal operation, choose <b>L</b>atency or <b>C</b>onsistency. Even with a healthy network, keeping replicas strongly consistent means waiting for cross-node acknowledgements on every write (and maybe read). That everyday latency cost matters more often than partitions.`},
{hl:{}, th:[], d:{}, g:[G('Choosing per operation',['money, inventory, uniqueness, locks','CP / linearizable','ok'],['carts, likes, feeds, sessions','AP / eventual','ok'],['tunable stores','choose per request (quorums, read concerns)','ok'])],
 say:`<b>Say it:</b> "CAP says that during a network partition a replicated system must choose, per operation, between consistency, meaning linearizable reads, and availability, meaning every live node answers. Partitions aren't optional, so it's really C versus A when one happens. PACELC adds that even without partitions there's a latency versus consistency trade-off. I choose per feature: CP for money and uniqueness, AP for carts, likes and feeds, often with tunable consistency."`}
],
keep:[`CAP: during a partition, choose C (linearizable, may refuse) or A (always answer, may be stale).`,`C in CAP = linearizability, not ACID consistency. P isn't optional.`,`CP: etcd, ZooKeeper, Spanner, CockroachDB. AP: Cassandra, DynamoDB, Riak.`,`PACELC: Else (no partition) → Latency vs Consistency.`,`Choose per operation; many stores are tunable.`]}, {
  imp: 'must',
  theory: TH(`When a network partition splits a replicated system, each side must either refuse requests to stay consistent or keep answering and risk inconsistency; PACELC adds that without partitions you still trade latency for consistency.`,
`<p>Two bank branches keep copies of the same ledger and phone each other after every transaction. One day the phone line is cut. A customer at branch 2 asks for their balance. Branch 2 can say "sorry, I can't confirm your latest balance right now" (consistent but unavailable) or "here's what I have" (available but possibly out of date). There's no third option: that's CAP.</p>
<p>And even on normal days, phoning the other branch before every answer makes each request slower. That's the "else" part of PACELC.</p>`,
[[`Consistency (CAP)`,`Linearizability: reads see the latest write.`],[`Availability (CAP)`,`Every request to a non-failed node gets a non-error response.`],[`Partition tolerance`,`Operating despite lost messages between nodes.`],[`CP system`,`Prefers consistency during partitions.`],[`AP system`,`Prefers availability during partitions.`],[`PACELC`,`Partition → A/C; Else → Latency/Consistency.`],[`Conflict resolution`,`Merging divergent writes (LWW, vector clocks, CRDTs).`]],
[`Nodes replicate updates over the network.`,`A partition prevents coordination.`,`CP: nodes that can't reach a quorum stop serving the affected operations.`,`AP: nodes keep serving; replicas diverge and reconcile after healing.`],
[`Choosing databases per feature in system design interviews.`,`Tuning quorum levels (Cassandra ONE vs QUORUM, DynamoDB eventually vs strongly consistent reads).`,`Designing multi-region systems: local writes (AP) vs global consensus (CP, higher latency).`],
[`"MongoDB is CP, Cassandra is AP" as absolutes (both are configurable).`,`Treating CAP C as ACID C.`,`Ignoring the everyday latency cost (PACELC E).`,`Claiming a distributed system is "CA".`]),
  examples: [
    {lv:'basic', title:'Divergence during a partition (AP)', sql:`CREATE TABLE node_x AS SELECT id, name, price FROM products WHERE id = 1;
CREATE TABLE node_y AS SELECT id, name, price FROM products WHERE id = 1;
UPDATE node_x SET price = 950 WHERE id = 1;            -- write on X; can't reach Y
SELECT 'X' AS node, price FROM node_x UNION ALL SELECT 'Y', price FROM node_y;`, why:`Both nodes answer (available), but they disagree: Y serves a stale price.`},
    {lv:'mid', title:'Reconciling after the partition: last-write-wins', sql:`CREATE TABLE writes (node TEXT, id INTEGER, price REAL, ts TEXT);
INSERT INTO writes VALUES ('X', 1, 950, '2024-03-06 10:00:01'),
                          ('Y', 1, 880, '2024-03-06 10:00:03');   -- both sides accepted a write
SELECT id, price AS winner FROM writes w
WHERE ts = (SELECT MAX(ts) FROM writes WHERE id = w.id);`, why:`Last-write-wins picks 880 and silently discards X's write. Simple, but it loses data (and depends on clocks). CRDTs or app-level merges avoid silent loss.`},
    {lv:'adv', title:'CP behaviour: only the majority side may answer', sql:`CREATE TABLE cluster (node TEXT, side TEXT);
INSERT INTO cluster VALUES ('n1','left'), ('n2','left'), ('n3','right');
SELECT side, COUNT(*) AS nodes,
       CASE WHEN COUNT(*) > (SELECT COUNT(*) FROM cluster) / 2.0 THEN 'serves (has quorum)'
            ELSE 'refuses (no quorum)' END AS behaviour
FROM cluster GROUP BY side;`, why:`A 3-node CP system split 2–1: the side with a majority keeps working; the single node refuses, preserving consistency at the cost of its availability.`},
  ],
  tips: {
    say:`"CAP: during a network partition, a replicated system must choose between consistency, meaning linearizable reads, and availability, meaning every live node responds. Partitions aren't optional, so it's C versus A when one happens. PACELC adds that without partitions you trade latency for consistency. I decide per operation: CP for balances and uniqueness, AP with conflict resolution for carts or likes."`,
    points:[`Define C and A precisely (linearizability; non-error response).`,`Explain why "CA" isn't a real distributed option.`,`Bring in PACELC and tunable consistency.`],
    traps:[`"Pick any two."`,`Confusing CAP C with ACID C.`],
    qa:[[`Is Cassandra AP?`,`By default (consistency ONE) it favours availability; with QUORUM reads and writes it gives stronger guarantees and loses availability when a quorum isn't reachable. It's tunable.`],
        [`What does a CP system do on the minority side of a partition?`,`It stops serving writes (and linearizable reads) for that data, returning errors or timeouts, until the partition heals.`],
        [`Why does PACELC matter more day to day?`,`Partitions are rare; the latency of coordinating replicas on every request is constant. Cross-region synchronous replication adds tens to hundreds of ms per write.`]]
  },
  exercises: [
    {lv:'E', q:`Simulate an AP split: two copies of customer 1's city, update only node X to 'Delhi', return <code>node, city</code> for both.`, hint:`Two CREATE TABLE … AS SELECT copies, UPDATE one, UNION ALL.`,
     sql:`CREATE TABLE node_x AS SELECT id, city FROM customers WHERE id = 1;
CREATE TABLE node_y AS SELECT id, city FROM customers WHERE id = 1;
UPDATE node_x SET city = 'Delhi' WHERE id = 1;
SELECT 'X' AS node, city FROM node_x UNION ALL SELECT 'Y', city FROM node_y;`},
    {lv:'M', q:`A 5-node CP cluster partitions into groups of 3 and 2. Which group can still accept writes? Return <code>side, can_write</code> (1 or 0).`, hint:`Majority = more than half of 5.`,
     sql:`CREATE TABLE cluster (node TEXT, side TEXT);
INSERT INTO cluster VALUES ('n1','a'),('n2','a'),('n3','a'),('n4','b'),('n5','b');
SELECT side, CASE WHEN COUNT(*) > (SELECT COUNT(*) FROM cluster) / 2.0 THEN 1 ELSE 0 END AS can_write
FROM cluster GROUP BY side;`},
    {lv:'H', q:`Design choices for a global e-commerce site during a transatlantic partition: shopping cart, product catalog reads, payment capture, inventory decrement for the last unit. For each say CP or AP and what the user sees.`, hint:`Which ones can tolerate staleness or conflicts?`,
     answer:`<ul><li>Cart: AP (Dynamo-style); merge carts after healing (union of items). User keeps shopping.</li><li>Catalog reads: AP from local replicas; slightly stale prices are acceptable (validate at checkout).</li><li>Payment capture: CP; if the region can't reach the payment ledger's quorum, fail or queue with a clear message; never double-capture (idempotency keys).</li><li>Last-unit inventory: CP (single owner per item/region or reservations); otherwise oversell and compensate (apologise/backorder).</li></ul>`},
  ],
  quiz: [
    [`In CAP, "C" means…`,[`ACID consistency`,`Linearizability: reads see the latest write`,`Constraints hold`,`Caching`],1,`Not ACID's C.`,'E'],
    [`During a partition, a CP system…`,[`Returns possibly stale data`,`Refuses some requests to avoid inconsistency`,`Loses durability`,`Becomes CA`],1,`Minority side stops.`,'E'],
    [`During a partition, an AP system…`,[`Refuses all requests`,`Keeps answering, possibly with stale or conflicting data`,`Guarantees linearizability`,`Shuts down`],1,`Reconciles later.`,'E'],
    [`Why is "CA" not a real option for distributed databases?`,[`It is common`,`Partitions happen regardless; you can't opt out of P`,`CA is illegal`,`CA means cache`],1,`CA ≈ single node.`,'M'],
    [`PACELC's "ELC" refers to…`,[`Encryption, logging, compression`,`Else (no partition): trade Latency vs Consistency`,`Eventual, linear, causal`,`Elections, leaders, consensus`],1,`Everyday trade-off.`,'M'],
    [`Which is typically CP?`,[`Cassandra (consistency ONE)`,`etcd / ZooKeeper`,`DNS`,`A CDN cache`],1,`Consensus-based.`,'E'],
  ],
  quizAdv: [
    [`Last-write-wins conflict resolution can…`,[`Never lose data`,`Silently discard concurrent writes and depends on clock accuracy`,`Guarantee linearizability`,`Only work with CRDTs`],1,`Clock skew picks the wrong winner.`,'H'],
    [`Spanner claims to be "effectively CA" because…`,[`It ignores partitions`,`Google's private network makes partitions very rare; when they happen it chooses C`,`It has no replicas`,`It uses LWW`],1,`Technically CP.`,'H'],
    [`CRDTs allow AP systems to…`,[`Be linearizable`,`Merge concurrent updates deterministically without conflicts (for supported data types)`,`Avoid replication`,`Skip partitions`],1,`Counters, sets, registers…`,'H'],
  ],
});
