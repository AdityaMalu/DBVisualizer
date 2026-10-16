/* 8.8 Quorums and leaderless replication (N, W, R) */
topic('8', { no:'8.8', title:'Leaderless replication and quorums: N, W, R; read repair, hinted handoff', db:'shop',
idea:`Dynamo-style databases have no leader: clients write to several replicas and read from several. See why W + R > N makes a read overlap the latest write, how version numbers pick the newest value, and how read repair, hinted handoff and anti-entropy heal replicas.`,
actors:'Client', dgTitle:'N = 3 replicas', stateTitle:'Quorum', tbTitle:'Replica contents',
nodes:{
  c:{x:70,y:115,label:'client /\ncoordinator',w:120,h:46,kind:'actor'},
  r1:{x:330,y:40,label:'replica 1',w:120,h:42,kind:'db'},
  r2:{x:330,y:115,label:'replica 2',w:120,h:42,kind:'db'},
  r3:{x:330,y:190,label:'replica 3',w:120,h:42,kind:'db'}
},
edges:[],
vb:'0 0 460 230',
codes:{a:`N = 3   replicas per key
W = 2   write succeeds when 2 replicas acknowledge
R = 2   read waits for 2 replicas, returns the newest version

W + R > N   →  every read set overlaps every write set
             (2 + 2 > 3: at least one replica has the latest write)

-- Cassandra
INSERT … USING CONSISTENCY QUORUM;     SELECT … CONSISTENCY QUORUM;
-- ONE/ONE: fastest, may read stale     ALL: one node down → failure

-- healing
read repair:     reader sees an older version → writes the newest back
hinted handoff:  replica down → another node keeps a "hint", replays later
anti-entropy:    background Merkle-tree comparison between replicas`},
steps:[
{hl:{q:[1,2,3]}, th:[['client','RUN:ok','write price = 950 (v2)']], d:{on:['c'], e:[['c','r1','write v2','hot'],['c','r2','write v2','hot'],['c','r3','write v2','bad dash']]}, tb:[TB('replicas',['replica','version','price'],[['1','v2',950],['2','v2',950],['3','v1 (missed the write)',900]],{0:'ok',1:'ok',2:'bad'})], g:[G('Write with W = 2',['sent to','all 3 replicas'],['acks from','1 and 2 → success','ok'],['replica 3','was briefly down: still v1','bad'],['no leader','any replica accepts writes'])],
 say:`In <b>leaderless</b> (Dynamo-style) replication there's no primary: the client (or a coordinator node) sends each write to all <b>N</b> replicas of the key and considers it successful once <b>W</b> acknowledge. Here N = 3, W = 2. Replica 3 was briefly unreachable and missed the write: it still has the old price (version 1).`},
{hl:{q:[5,6]}, th:[['client','RUN:ok','read with R = 2']], d:{on:['c'], e:[['c','r2','read','hot'],['c','r3','read','hot'],['r2','c','v2: 950','ok'],['r3','c','v1: 900','bad']]}, g:[G('Read with R = 2',['asks','replicas 2 and 3'],['gets','v2 (950) and v1 (900)'],['returns','highest version: 950','ok'],['why it works','W + R = 4 > N = 3 → overlap','hot'])], log:['read: {v2: 950, v1: 900} → 950'],
 say:`A read asks <b>R</b> replicas and returns the value with the newest version. Even if it happens to ask stale replica 3, the other replica it asks must have the write, because <b>W + R &gt; N</b>: any 2 replicas that acknowledged the write and any 2 replicas the read asks must share at least one. That overlap is the whole trick.`},
{hl:{q:[8,9,10]}, th:[], d:{on:['c'], e:[['c','r3','R=1 read','bad']]}, g:[G('Tuning',['W=1, R=1','fastest; may read stale (1 + 1 ≤ 3)','bad'],['QUORUM/QUORUM','2 + 2 > 3: overlap','ok'],['W=N (ALL)','one node down → writes fail','bad'],['write-heavy','lower W, higher R'],['read-heavy','higher W, lower R'])],
 say:`N, W and R are knobs, often per request. ONE/ONE (W = R = 1) is fastest and most available but can return stale data. QUORUM/QUORUM gives overlap while tolerating one replica down. ALL makes any single failure block the operation. Even with W + R &gt; N, edge cases (sloppy quorums, concurrent writes, failed writes that partially landed) mean it's not linearizable without extra care.`},
{hl:{q:[13]}, th:[], d:{on:['r3'], e:[['c','r3','write back v2','ok']]}, tb:[TB('replicas',['replica','version','price'],[['1','v2',950],['2','v2',950],['3','v2 (repaired)',950]],{2:'ok'})], g:[G('Read repair',['reader noticed','replica 3 returned v1'],['fix','write v2 back to replica 3','ok'],['good for','frequently read keys'],['rarely read keys','stay stale → need anti-entropy'])], log:['read repair: replica 3 → v2'],
 say:`<b>Read repair</b>: since the read saw replica 3 return an older version, the coordinator writes the newest value back to it. Frequently read keys heal themselves this way. Keys that are rarely read could stay stale for a long time, which is why there are other mechanisms.`},
{hl:{q:[14]}, th:[], d:{bad:['r3'], on:['r2'], e:[['c','r1','write','ok'],['c','r2','write + hint for 3','hot']]}, g:[G('Hinted handoff',['replica 3 down during a write','another node stores the write + a hint'],['when 3 returns','hint is replayed to it','ok'],['sloppy quorum','counting stand-in nodes toward W: more available, weaker guarantee','bad'])],
 say:`<b>Hinted handoff</b>: if replica 3 is down during a write, another node temporarily stores the write with a "hint" saying who it's really for, and hands it over when replica 3 comes back. Counting such stand-ins toward W (a <b>sloppy quorum</b>) keeps writes available during failures, at the price of the overlap guarantee.`},
{hl:{q:[15]}, th:[], d:{e:[['r1','r2','Merkle compare','ok'],['r2','r3','Merkle compare','ok']]}, g:[G('Anti-entropy',['background process','compare replicas with Merkle trees (hash trees)'],['efficient','only differing key ranges are exchanged','ok'],['catches','everything read repair missed'],['Cassandra','nodetool repair'])],
 say:`<b>Anti-entropy</b> runs in the background: replicas compare <b>Merkle trees</b> (trees of hashes over key ranges) so they can find differences without shipping all data, then sync just the differing ranges. In Cassandra this is <code>nodetool repair</code>, which operators must run regularly.`},
{hl:{}, th:[], d:{}, g:[G('Concurrent writes',['two clients write the same key at once','siblings / conflict'],['last-write-wins','by timestamp (can lose data)','bad'],['version vectors','detect concurrency; app or CRDT merges','ok']), G('Used by',['Cassandra, ScyllaDB','tunable consistency'],['Riak, Voldemort','Dynamo family'],['DynamoDB','Dynamo-inspired, but with leaders per partition today'])],
 say:`<b>Say it:</b> "Leaderless systems write to N replicas and succeed after W acks, and read from R replicas, returning the newest version. With W + R > N every read overlaps the latest write; lower W or R trades consistency for latency and availability. Replicas converge through read repair, hinted handoff and anti-entropy with Merkle trees, and concurrent writes are resolved with last-write-wins or version vectors."`}
],
keep:[`N replicas; write OK after W acks; read waits for R replies and takes the newest version.`,`W + R > N ⇒ read and write sets overlap (QUORUM/QUORUM with N = 3: 2 + 2 > 3).`,`ONE/ONE: fast, may be stale. ALL: any failure blocks.`,`Healing: read repair, hinted handoff (sloppy quorum), anti-entropy (Merkle trees).`,`Concurrent writes: LWW (lossy) or version vectors/CRDTs.`]}, {
  imp: 'good',
  theory: TH(`In leaderless replication every replica accepts writes; choosing how many replicas must confirm a write (W) and answer a read (R) out of N decides how fresh reads are and how many failures are tolerated.`,
`<p>Imagine three notebooks holding the same phone list. To update a number you must write it in at least two notebooks; to look one up you check at least two notebooks and trust the most recent entry. Because any two notebooks you write in and any two you read from share at least one, you always find the latest number.</p>
<p>That's a quorum: W + R &gt; N guarantees overlap. Lower numbers are faster and survive more failures but may give old answers.</p>`,
[[`Leaderless replication`,`Any replica accepts reads and writes.`],[`N, W, R`,`Replicas, write acks required, read replies required.`],[`Quorum`,`Enough nodes for read and write sets to overlap.`],[`Read repair`,`Fixing stale replicas noticed during reads.`],[`Hinted handoff`,`Temporarily storing writes for an unavailable replica.`],[`Sloppy quorum`,`Accepting writes on stand-in nodes outside the key's replica set.`],[`Anti-entropy / Merkle tree`,`Background replica comparison using hash trees.`],[`Version vector`,`Per-replica counters detecting concurrent writes.`]],
[`Coordinator sends the write to N replicas; waits for W acks.`,`Reads query R replicas; return the newest version.`,`Stale replicas are healed by read repair, hints and anti-entropy.`,`Conflicting concurrent versions are merged or resolved.`],
[`Cassandra consistency levels (ONE, QUORUM, LOCAL_QUORUM, ALL).`,`Multi-DC: LOCAL_QUORUM for latency, EACH_QUORUM for stronger guarantees.`,`Running regular repairs; monitoring hints.`],
[`ONE/ONE where users need read-your-writes.`,`Never running repair, so rarely read data stays inconsistent.`,`Relying on LWW with skewed clocks.`,`Assuming quorums give linearizability.`]),
  examples: [
    {lv:'basic', title:'Quorum read: take the newest version', sql:`CREATE TABLE replica_values (replica INTEGER, version INTEGER, price REAL);
INSERT INTO replica_values VALUES (1, 2, 950), (2, 2, 950), (3, 1, 900);
-- read with R = 2 from replicas 2 and 3
SELECT price FROM replica_values
WHERE replica IN (2, 3)
ORDER BY version DESC LIMIT 1;`, why:`Replica 3 is stale, but replica 2 has version 2: the read returns 950.`},
    {lv:'mid', title:'Which (W, R) settings guarantee overlap for N = 3?', sql:`WITH RECURSIVE v(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM v WHERE x < 3)
SELECT w.x AS W, r.x AS R, CASE WHEN w.x + r.x > 3 THEN 'overlap (fresh reads)' ELSE 'may read stale' END AS guarantee,
       3 - w.x AS write_failures_tolerated, 3 - r.x AS read_failures_tolerated
FROM v w CROSS JOIN v r
ORDER BY W, R;`, why:`The full trade-off table: overlap requires W + R ≥ 4; each extra ack costs one tolerated failure.`},
    {lv:'adv', title:'Read repair: bring stale replicas up to the newest version', sql:`CREATE TABLE replica_values (replica INTEGER, version INTEGER, price REAL);
INSERT INTO replica_values VALUES (1, 2, 950), (2, 2, 950), (3, 1, 900);
UPDATE replica_values
SET version = (SELECT MAX(version) FROM replica_values),
    price   = (SELECT price FROM replica_values ORDER BY version DESC LIMIT 1)
WHERE version < (SELECT MAX(version) FROM replica_values);
SELECT * FROM replica_values ORDER BY replica;`, why:`The stale replica receives the newest version: all three now agree.`},
  ],
  tips: {
    say:`"In leaderless replication, writes go to N replicas and succeed after W acks; reads ask R replicas and return the newest version. If W + R > N, reads overlap the latest write, for example QUORUM/QUORUM with N = 3. Lower W or R improves latency and availability at the cost of stale reads. Replicas heal through read repair, hinted handoff and anti-entropy, and concurrent writes need last-write-wins or version vectors."`,
    points:[`Explain the overlap argument for W + R > N.`,`Discuss per-request tuning and failure tolerance.`,`Name the three healing mechanisms.`],
    traps:[`Claiming quorums make the system linearizable.`,`Forgetting sloppy quorums weaken the guarantee.`],
    qa:[[`N = 3: what does QUORUM mean and how many failures does it tolerate?`,`2 of 3 replicas; it tolerates one replica being down for both reads and writes.`],
        [`Why can quorum reads still be stale?`,`Sloppy quorums, a write that failed overall but landed on some replicas, concurrent writes with LWW and clock skew, or a replica restored from an old backup.`],
        [`What's LOCAL_QUORUM in Cassandra?`,`A quorum of replicas in the local data centre only: low latency, consistent within the DC, cross-DC replication stays async.`]]
  },
  exercises: [
    {lv:'E', q:`Replicas hold (replica 1: v3 = 'red'), (2: v2 = 'blue'), (3: v3 = 'red'). A read with R = 2 asks replicas 1 and 2. Return the value it returns: <code>value</code>.`, hint:`Highest version among the asked replicas.`,
     sql:`CREATE TABLE rv (replica INTEGER, version INTEGER, value TEXT);
INSERT INTO rv VALUES (1, 3, 'red'), (2, 2, 'blue'), (3, 3, 'red');
SELECT value FROM rv WHERE replica IN (1, 2) ORDER BY version DESC LIMIT 1;`},
    {lv:'M', q:`For N = 5, list every (W, R) pair with W + R &gt; N and W ≤ R: <code>W, R</code>.`, hint:`Cross join 1..5 with itself and filter.`,
     sql:`WITH RECURSIVE v(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM v WHERE x < 5)
SELECT w.x AS W, r.x AS R FROM v w CROSS JOIN v r WHERE w.x + r.x > 5 AND w.x <= r.x;`},
    {lv:'H', q:`A Cassandra cluster (RF = 3) uses ONE for writes and ONE for reads. Users complain their profile edits sometimes "don't stick". Explain and propose two fixes with trade-offs.`, hint:`W + R vs N.`,
     answer:`<p>W + R = 2 ≤ 3, so a read can hit a replica that hasn't received the write yet. Fixes: QUORUM/QUORUM (2 + 2 &gt; 3): consistent reads at higher latency, tolerates one replica down; or write ONE / read ALL (1 + 3 &gt; 3): fast writes, but any replica down breaks reads; or keep ONE/ONE but route a user's reads to the same coordinator and use LOCAL_QUORUM for profile data only.</p>`},
  ],
  quiz: [
    [`With N = 3, W = 2, R = 2, reads see the latest write because…`,[`There's a leader`,`W + R > N, so read and write sets overlap`,`Writes are synchronous to all`,`Clocks are synchronized`],1,`Overlap argument.`,'E'],
    [`N = 3, W = 1, R = 1 means…`,[`Always consistent`,`Fast and available, but reads may be stale`,`Writes fail if one node is down`,`Linearizable`],1,`1 + 1 ≤ 3.`,'E'],
    [`Read repair…`,[`Rebuilds indexes`,`Writes the newest value back to replicas that returned stale data during a read`,`Repairs disks`,`Deletes tombstones`],1,`Heals frequently read keys.`,'M'],
    [`Hinted handoff…`,[`Moves leadership`,`Stores writes for an unavailable replica on another node and replays them later`,`Encrypts hints`,`Is a read optimisation`],1,`With sloppy quorums.`,'M'],
    [`Anti-entropy uses…`,[`B-trees`,`Merkle trees to find differing ranges efficiently`,`Bloom filters only`,`Consensus`],1,`nodetool repair.`,'M'],
    [`W = N (ALL) means…`,[`Highest availability`,`Any single replica failure makes writes fail`,`No consistency`,`R must be N`],1,`Availability cost.`,'E'],
  ],
  quizAdv: [
    [`A sloppy quorum…`,[`Is stricter than a quorum`,`Counts writes on stand-in nodes outside the replica set toward W, improving availability but losing guaranteed overlap`,`Requires consensus`,`Disables hinted handoff`],1,`Dynamo trade-off.`,'H'],
    [`Version vectors help by…`,[`Ordering by wall clock`,`Detecting whether two versions are concurrent or one supersedes the other`,`Compressing data`,`Electing leaders`],1,`Then merge siblings.`,'H'],
    [`Is a leaderless system with W + R > N linearizable?`,[`Always`,`Not necessarily: concurrent and partially failed writes can still produce non-linearizable reads`,`Only with R = 1`,`Only for counters`],1,`Needs extra mechanisms (e.g. synchronous read repair).`,'H'],
  ],
});
