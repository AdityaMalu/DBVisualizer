/* 8.4 Consistent hashing */
topic('8', { no:'8.4', title:'Consistent hashing: the hash ring, adding nodes, virtual nodes', db:'shop',
idea:`hash(key) % N reshuffles almost every key when N changes. Place nodes and keys on a ring instead: each key belongs to the next node clockwise. Add a node and only its neighbour's keys move; remove one and only its keys move; add virtual nodes to even out the load.`,
dgTitle:'Hash ring (0 at the top, clockwise)', stateTitle:'Ownership', tbTitle:'Keys',
nodes:{
  A:{x:220,y:40,label:'A',w:46,h:30,kind:'db'},
  B:{x:315,y:205,label:'B',w:46,h:30,kind:'db'},
  C:{x:125,y:205,label:'C',w:46,h:30,kind:'db'},
  D:{x:315,y:95,label:'D',w:46,h:30,kind:'db'},
  k1:{x:268,y:52,label:'k1',w:34,h:22,kind:'circle',fs:11},
  k2:{x:340,y:150,label:'k2',w:34,h:22,kind:'circle',fs:11},
  k3:{x:262,y:250,label:'k3',w:34,h:22,kind:'circle',fs:11},
  k4:{x:175,y:252,label:'k4',w:34,h:22,kind:'circle',fs:11},
  k5:{x:110,y:95,label:'k5',w:34,h:22,kind:'circle',fs:11}
},
edges:[],
ring:{cx:220,cy:150,r:110},
vb:'0 0 440 290',
codes:{a:`-- naive: shard = hash(key) % N        (N: 3 → 4 moves ~75% of keys)

-- consistent hashing
ring positions: hash(node) and hash(key) in the same space [0, 2^32)
owner(key)    = first node clockwise from hash(key)

add node D    → takes keys between its predecessor and itself
remove node B → B's keys go to the next node clockwise
moved keys    ≈ K / N   (not ~K)

-- virtual nodes: each physical node appears at many ring positions
A#0, A#1, … A#99   → smoother load, faster even rebalancing

-- used by: DynamoDB, Cassandra (tokens / vnodes), Riak, memcached clients,
--          load balancers (Maglev), CDNs`},
steps:[
{hl:{q:[1]}, d:{hide:['D','k1','k2','k3','k4','k5'], on:['A','B','C']}, tb:[TB('hash % N',['key','% 3','% 4','moves?'],[['k1',1,0,'yes'],['k2',2,2,'no'],['k3',0,3,'yes'],['k4',1,1,'no'],['k5',2,1,'yes']],{0:'bad',2:'bad',4:'bad'})], g:[G('The modulo problem',['N = 3 → 4','~75% of keys change node','bad'],['for a cache','mass misses → stampede on the DB','bad'],['for a database','move most of the data','bad'])],
 say:`With <code>hash(key) % N</code>, a key's node depends on N. Add one server (3 → 4) and about three quarters of keys map somewhere else. For a cache cluster that's a sudden wave of misses hammering the database; for a sharded database it means moving most of the data.`},
{hl:{q:[3,4,5]}, d:{hide:['D','k1','k2','k3','k4','k5'], on:['A','B','C']}, g:[G('The ring',['hash space','0 … 2³²−1 wrapped into a circle'],['nodes','placed at hash(node name)','hot'],['A','0°'],['B','120°'],['C','240°'])],
 say:`<b>Consistent hashing</b> maps both <b>nodes</b> and <b>keys</b> into the same hash space, drawn as a ring. Each node sits at the position of its own hash: A at the top, B and C a third of the way round each.`},
{hl:{q:[5]}, d:{hide:['D'], e:[['k1','B','','ok'],['k2','B','','ok'],['k3','C','','ok'],['k4','C','','ok'],['k5','A','','ok']]}, tb:[TB('ownership',['key','position','owner'],[['k1','30°','B'],['k2','90°','B'],['k3','150°','C'],['k4','200°','C'],['k5','300°','A']])], g:[G('Rule',['owner(key)','first node clockwise','hot'],['B owns','(0°, 120°]'],['C owns','(120°, 240°]'],['A owns','(240°, 360°]'])],
 say:`A key belongs to the <b>first node clockwise</b> from its position. k1 (30°) and k2 (90°) go to B; k3 and k4 to C; k5 (300°) wraps around to A. Each node owns the arc between its predecessor and itself.`},
{hl:{q:[7,9]}, d:{on:['D'], e:[['k1','D','moved','hot'],['k2','B','','ok'],['k3','C','','ok'],['k4','C','','ok'],['k5','A','','ok']]}, tb:[TB('after adding D at 60°',['key','owner before','owner after'],[['k1','B','D'],['k2','B','B'],['k3','C','C'],['k4','C','C'],['k5','A','A']],{0:'hot'})], g:[G('Add a node',['D at 60°','takes the arc (0°, 60°] from B'],['keys moved','only k1','ok'],['in general','≈ K / N keys move','ok'])], log:['add D: 1 of 5 keys moved (modulo would move ~4)'],
 say:`Add node D at 60°. It takes over only the arc between its predecessor (A at 0°) and itself, which used to belong to B. Only <b>k1</b> moves. In general about <b>K/N</b> keys move instead of nearly all of them, and only from one neighbour.`},
{hl:{q:[8]}, d:{hide:['B'], e:[['k1','D','','ok'],['k2','C','moved','hot'],['k3','C','','ok'],['k4','C','','ok'],['k5','A','','ok']]}, tb:[TB('after removing B',['key','owner'],[['k1','D'],['k2','C'],['k3','C'],['k4','C'],['k5','A']],{1:'hot'})], g:[G('Remove a node',['B fails or is removed',''],['its keys','go to the next node clockwise (C)','hot'],['other keys','untouched','ok'],['downside','C now owns a huge arc: uneven','bad'])], log:['remove B: only B\'s keys moved, all to C'],
 say:`Remove B (it failed). Only B's keys move, all to the next node clockwise, C. Everyone else is untouched. But notice the downside: C now owns almost half the ring and all of B's load landed on a single node.`},
{hl:{q:[11,12]}, d:{e:[['k1','D','','ok'],['k2','B','','ok'],['k3','C','','ok'],['k4','C','','ok'],['k5','A','','ok']]}, g:[G('Virtual nodes',['each server','many positions (A#0…A#99)','hot'],['load','many small arcs → evens out','ok'],['node leaves','its load spreads over all others','ok'],['heterogeneous servers','more vnodes for bigger machines','ok'])],
 say:`<b>Virtual nodes</b> fix the unevenness: each physical server is placed at many points on the ring (A#0 … A#99). Each owns many small arcs, so load is balanced statistically, and when a server leaves, its many small arcs are absorbed by <i>all</i> the others rather than one neighbour. Bigger machines simply get more virtual nodes.`},
{hl:{q:[14,15]}, d:{}, g:[G('Where it\'s used',['Dynamo / Cassandra / Riak','partitioning data across nodes'],['distributed caches','memcached/Redis clients'],['load balancing','sticky routing (Maglev, Envoy ring hash)']), G('Also',['replicas','store on the next R nodes clockwise (8.8)'],['alternative','fixed number of slots, e.g. Redis Cluster 16384 hash slots'])],
 say:`<b>Say it:</b> "Consistent hashing places nodes and keys on a hash ring; each key belongs to the next node clockwise. Adding or removing a node moves only the keys in one arc, about K/N, instead of reshuffling everything as hash mod N does. Virtual nodes give each server many ring positions for even load and spread a failed node's keys across the cluster. Dynamo-style databases and cache clients use it; Redis Cluster uses a similar idea with a fixed 16,384 hash slots."`}
],
keep:[`hash % N: changing N moves ~all keys.`,`Ring: nodes and keys hashed into one space; key → first node clockwise.`,`Add/remove a node: only one arc moves (≈ K/N keys).`,`Virtual nodes: many positions per server → even load, failed node's keys spread widely.`,`Used by Dynamo, Cassandra, Riak, cache clients; Redis Cluster uses fixed hash slots.`]}, {
  imp: 'must',
  theory: TH(`Consistent hashing assigns keys to nodes on a circular hash space so that adding or removing a node only moves the keys next to it, instead of reshuffling almost everything.`,
`<p>Imagine seats around a round table and guests (keys) standing around it: each guest sits at the next seat clockwise. Add a seat and only the guests standing just before it move; remove one and only its guests move to the next seat. With "guest number mod number of seats", adding a seat would make nearly everyone change seats.</p>
<p>Because some seats would get far more guests than others by chance, each real seat is given many positions around the table (virtual nodes), which evens things out.</p>`,
[[`Hash ring`,`The hash output space arranged as a circle.`],[`Token / position`,`Where a node sits on the ring.`],[`Ownership`,`A node owns keys between its predecessor and itself.`],[`Virtual node (vnode)`,`One of many ring positions belonging to a physical node.`],[`Rebalancing`,`Moving keys when membership changes.`],[`Hash slots`,`A fixed number of buckets mapped to nodes (Redis Cluster).`]],
[`Hash each node (or vnode) to a ring position.`,`Hash each key; walk clockwise to the first node.`,`On join, the new node takes keys from its successor's arc.`,`On leave, its keys go to its successor(s).`],
[`Distributed caches (avoid mass misses when scaling).`,`Dynamo-style databases place data and replicas this way.`,`Load balancers route a user consistently to the same backend.`],
[`Too few virtual nodes → skewed load.`,`Using modulo hashing for a cache tier that autoscales.`,`Forgetting replication: keys also live on the next nodes clockwise.`]),
  examples: [
    {lv:'basic', title:'Owner = first node clockwise', sql:`CREATE TABLE ring_nodes (node TEXT, pos INTEGER);
INSERT INTO ring_nodes VALUES ('A', 0), ('B', 120), ('C', 240);
CREATE TABLE keys (k TEXT, pos INTEGER);
INSERT INTO keys VALUES ('k1', 30), ('k2', 90), ('k3', 150), ('k4', 200), ('k5', 300);
SELECT k.k, k.pos,
       COALESCE((SELECT node FROM ring_nodes n WHERE n.pos >= k.pos ORDER BY n.pos LIMIT 1),
                (SELECT node FROM ring_nodes ORDER BY pos LIMIT 1)) AS owner   -- wrap around
FROM keys k ORDER BY k.pos;`, why:`The COALESCE handles wrap-around: k5 at 300° has no node after it, so it goes to the first node, A.`},
    {lv:'mid', title:'Add a node: count moved keys', sql:`CREATE TABLE ring_nodes (node TEXT, pos INTEGER);
INSERT INTO ring_nodes VALUES ('A', 0), ('B', 120), ('C', 240);
CREATE TABLE keys (k TEXT, pos INTEGER);
WITH RECURSIVE s(n) AS (SELECT 0 UNION ALL SELECT n + 7 FROM s WHERE n < 355)
INSERT INTO keys SELECT 'k' || n, n FROM s;
CREATE TABLE before AS
  SELECT k, COALESCE((SELECT node FROM ring_nodes n WHERE n.pos >= keys.pos ORDER BY n.pos LIMIT 1), 'A') AS owner FROM keys;
INSERT INTO ring_nodes VALUES ('D', 60);
SELECT COUNT(*) AS keys, SUM(b.owner <> COALESCE((SELECT node FROM ring_nodes n WHERE n.pos >= k.pos ORDER BY n.pos LIMIT 1), 'A')) AS moved
FROM keys k JOIN before b ON b.k = k.k;`, why:`Only keys in D's new arc (just after A, up to 60°) move: roughly a sixth, all from B.`},
    {lv:'adv', title:'Virtual nodes even out the load', sql:`CREATE TABLE vnodes (node TEXT, pos INTEGER);
-- 4 positions per physical node instead of 1
INSERT INTO vnodes VALUES ('A',0),('A',95),('A',185),('A',275),
                          ('B',30),('B',120),('B',215),('B',300),
                          ('C',60),('C',150),('C',245),('C',330);
WITH RECURSIVE s(p) AS (SELECT 0 UNION ALL SELECT p + 1 FROM s WHERE p < 359)
SELECT owner, COUNT(*) AS positions_owned FROM (
  SELECT COALESCE((SELECT node FROM vnodes v WHERE v.pos >= s.p ORDER BY v.pos LIMIT 1),
                  (SELECT node FROM vnodes ORDER BY pos LIMIT 1)) AS owner
  FROM s)
GROUP BY owner ORDER BY owner;`, why:`Each physical node owns many small arcs; totals come out close to 120° each. Remove B's four vnodes and its load splits between A and C instead of all going to one neighbour.`},
  ],
  tips: {
    say:`"Consistent hashing puts nodes and keys on a hash ring and assigns each key to the next node clockwise. When a node joins or leaves, only the keys in its arc move, about K/N, instead of nearly all keys with hash mod N. Virtual nodes give each server many positions for balanced load and spread a failed node's keys across the cluster. It's used in Dynamo, Cassandra and cache clients."`,
    points:[`Start from why modulo is bad (resharding, cache stampede).`,`Draw the ring and walk a key clockwise.`,`Mention virtual nodes and replicas on successors.`],
    traps:[`Forgetting wrap-around.`,`Claiming consistent hashing guarantees perfectly even load without vnodes.`],
    qa:[[`How many keys move when adding the 11th node to 10?`,`About 1/11 of keys (those in the new node's arcs), versus ~10/11 with modulo.`],
        [`Why virtual nodes?`,`With few positions, arcs are uneven; many vnodes per server average it out and let a failed server's load spread to many nodes. They also let you weight bigger servers.`],
        [`How does Redis Cluster differ?`,`It uses 16,384 fixed hash slots (CRC16(key) mod 16384) assigned to nodes; resharding moves slots, achieving the same "move only a fraction" property.`]]
  },
  exercises: [
    {lv:'E', q:`With nodes A(0), B(120), C(240), which node owns a key at position 250? Return <code>owner</code>.`, hint:`First node with pos ≥ 250, else wrap to the first.`,
     sql:`CREATE TABLE ring_nodes (node TEXT, pos INTEGER);
INSERT INTO ring_nodes VALUES ('A', 0), ('B', 120), ('C', 240);
SELECT COALESCE((SELECT node FROM ring_nodes WHERE pos >= 250 ORDER BY pos LIMIT 1),
                (SELECT node FROM ring_nodes ORDER BY pos LIMIT 1)) AS owner;`},
    {lv:'M', q:`Using the walkthrough's keys and nodes (A 0, B 120, C 240; keys k1 30, k2 90, k3 150, k4 200, k5 300), remove B and return each key's new owner: <code>k, owner</code>.`, hint:`Delete B, then apply the clockwise rule with wrap-around.`,
     sql:`CREATE TABLE ring_nodes (node TEXT, pos INTEGER);
INSERT INTO ring_nodes VALUES ('A', 0), ('B', 120), ('C', 240);
CREATE TABLE keys (k TEXT, pos INTEGER);
INSERT INTO keys VALUES ('k1', 30), ('k2', 90), ('k3', 150), ('k4', 200), ('k5', 300);
DELETE FROM ring_nodes WHERE node = 'B';
SELECT k.k, COALESCE((SELECT node FROM ring_nodes n WHERE n.pos >= k.pos ORDER BY n.pos LIMIT 1),
                     (SELECT node FROM ring_nodes ORDER BY pos LIMIT 1)) AS owner
FROM keys k;`},
    {lv:'H', q:`A memcached cluster of 10 nodes uses <code>hash(key) % 10</code>. During a traffic spike an 11th node is added and the database falls over. Explain why and redesign.`, hint:`Cache miss storm.`,
     answer:`<p>Modulo remapped ~90% of keys to different nodes, so almost every lookup missed at once and all traffic hit the database (a cache stampede). Use a consistent-hashing client (ketama) with virtual nodes so only ~1/11 of keys remap; add capacity before peaks; add request coalescing / stale-while-revalidate to protect the DB during warm-up (8.10).</p>`},
  ],
  quiz: [
    [`With hash % N, going from 4 to 5 nodes remaps about…`,[`1/5 of keys`,`4/5 of keys`,`None`,`Exactly half`],1,`Most keys move.`,'E'],
    [`In consistent hashing, a key belongs to…`,[`The node with the same hash`,`The first node clockwise from the key's position`,`A random node`,`The least loaded node`],1,`With wrap-around.`,'E'],
    [`Adding a node moves keys from…`,[`All nodes`,`Only its successor's arc`,`No node`,`The previous node only after restart`],1,`About K/N keys.`,'M'],
    [`Virtual nodes are used to…`,[`Encrypt keys`,`Balance load and spread a failed node's keys across many nodes`,`Replace replication`,`Reduce memory`],1,`Many positions per server.`,'M'],
    [`Which system uses consistent hashing for data placement?`,[`SQLite`,`Cassandra / DynamoDB`,`Postgres (single node)`,`Excel`],1,`Dynamo-style.`,'E'],
    [`Without virtual nodes, removing a node sends its load to…`,[`All remaining nodes evenly`,`Its single successor on the ring`,`The coordinator`,`Nowhere`],1,`Hence vnodes.`,'M'],
  ],
  quizAdv: [
    [`Redis Cluster maps keys using…`,[`A ring with vnodes`,`CRC16(key) mod 16384 hash slots assigned to nodes`,`Range sharding`,`A directory service`],1,`Slots move during resharding.`,'H'],
    [`Replicas in Dynamo-style rings are typically placed…`,[`Randomly`,`On the next N−1 distinct physical nodes clockwise`,`On the same node`,`In a separate ring`],1,`The preference list.`,'H'],
    [`Jump consistent hash and rendezvous (HRW) hashing are…`,[`Encryption schemes`,`Alternative algorithms with the same minimal-movement property`,`Load balancer protocols`,`Index types`],1,`Different trade-offs (no vnodes needed for HRW).`,'H'],
  ],
});
