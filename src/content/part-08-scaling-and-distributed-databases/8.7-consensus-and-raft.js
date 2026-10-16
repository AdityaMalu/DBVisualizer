/* 8.7 Consensus and leader election (Raft) */
topic('8', { no:'8.7', title:'Consensus and leader election: Raft in five steps', db:'shop',
idea:`How do five servers agree on one leader and one ordered log even when some crash? Watch a Raft election (terms, votes, majority), log replication that commits once a majority has an entry, and why a partitioned old leader can't do damage.`,
actors:'Nodes', dgTitle:'5-node Raft cluster', stateTitle:'Raft state', tbTitle:'Logs',
nodes:{
  n1:{x:250,y:30,label:'n1',w:70,h:36,kind:'db'},
  n2:{x:420,y:100,label:'n2',w:70,h:36,kind:'db'},
  n3:{x:360,y:205,label:'n3',w:70,h:36,kind:'db'},
  n4:{x:140,y:205,label:'n4',w:70,h:36,kind:'db'},
  n5:{x:80,y:100,label:'n5',w:70,h:36,kind:'db'}
},
edges:[],
vb:'0 0 500 240',
codes:{a:`state per node: currentTerm, votedFor, log[], role ∈ {follower, candidate, leader}

1. election timeout (random 150–300 ms) with no heartbeat
   → follower becomes candidate, term++, votes for itself, RequestVote to all
2. a node grants its vote if: term ≥ its own, hasn't voted this term,
   and the candidate's log is at least as up to date
3. majority of votes (3 of 5) → leader; sends heartbeats (AppendEntries)

4. client write → leader appends to its log → AppendEntries to followers
   entry COMMITTED once stored on a majority → apply to state machine → reply

5. partition: old leader in the minority can't reach a majority
   → can't commit anything; majority side elects a new leader (higher term)

used by: etcd (Kubernetes), Consul, CockroachDB, TiKV, Kafka KRaft, MongoDB (Raft-like)`},
steps:[
{hl:{q:[1]}, th:[['n1','RUN:ok','follower, term 1'],['n2','RUN:ok','follower'],['n3','RUN:ok','follower'],['n4','RUN:ok','follower'],['n5','RUN:ok','follower']], d:{}, g:[G('Why consensus',['goal','all nodes agree on the same ordered log of commands','hot'],['tolerates','f failures with 2f+1 nodes (5 → 2)'],['used for','leader election, config, replicated state machines'],['safety','never two different committed values'])],
 say:`<b>Consensus</b> lets a group of machines agree on a sequence of values (a replicated log) even if some fail. If every node applies the same log in the same order, they all end up in the same state: a <b>replicated state machine</b>. <b>Raft</b> was designed to be understandable. With 5 nodes it tolerates 2 failures, because any decision needs a <b>majority</b> (3).`},
{hl:{q:[3,4]}, th:[['n1','BLOCKED:bad','leader crashed'],['n2','RUN:warn','candidate, term 2'],['n3','RUN:ok','follower'],['n4','RUN:ok','follower'],['n5','RUN:ok','follower']], d:{bad:['n1'], on:['n2'], e:[['n2','n3','RequestVote t2','hot'],['n2','n4','RequestVote t2','hot'],['n2','n5','RequestVote t2','hot']]}, g:[G('Election',['trigger','no heartbeat within a random timeout'],['candidate','term = 2, votes for itself'],['random timeouts','make split votes unlikely','ok'])], log:['n1 silent → n2 times out first → candidate in term 2'],
 say:`The leader n1 crashes and its heartbeats stop. Each follower waits a <b>randomised election timeout</b>; n2's fires first. It becomes a <b>candidate</b>, increments the <b>term</b> (a logical clock for leadership epochs) to 2, votes for itself and asks everyone else for votes.`},
{hl:{q:[5,6,7]}, th:[['n1','BLOCKED:bad','down'],['n2','RUN:ok','LEADER term 2'],['n3','RUN:ok','voted n2'],['n4','RUN:ok','voted n2'],['n5','RUN:ok','follower']], d:{bad:['n1'], ok:['n2'], e:[['n3','n2','vote','ok'],['n4','n2','vote','ok']]}, g:[G('Votes',['n2 (self) + n3 + n4','3 of 5 = majority','ok'],['one vote per term','per node'],['log check','refuse candidates with older logs'],['result','at most one leader per term','hot'])], log:['n2 elected leader for term 2 (3 votes)'],
 say:`n3 and n4 grant their votes: each node votes at most once per term, and only for candidates whose log is at least as up to date as its own (so a leader always has every committed entry). With 3 of 5 votes n2 becomes <b>leader</b> for term 2 and starts sending heartbeats. Because a majority is needed and majorities overlap, there can be <b>at most one leader per term</b>.`},
{hl:{q:[9,10]}, th:[['n2','RUN:ok','leader: append x=5'],['n3','RUN:ok','stored'],['n4','RUN:ok','stored'],['n5','RUN:warn','slow']], d:{bad:['n1'], ok:['n2','n3','n4'], e:[['n2','n3','AppendEntries','hot'],['n2','n4','AppendEntries','hot'],['n2','n5','AppendEntries','hot']]}, tb:[TB('logs (index: term, cmd)',['node','1','2'],[['n2 (leader)','1: x=3','2: x=5'],['n3','1: x=3','2: x=5'],['n4','1: x=3','2: x=5'],['n5','1: x=3','—']],{0:'ok',1:'ok',2:'ok',3:'dim'})], g:[G('Commit rule',['entry stored on','n2, n3, n4 = majority','ok'],['committed','apply to state machine, reply to client','ok'],['n5','catches up later'])], log:['x=5 committed at index 2 (3/5 have it)'],
 say:`A client asks the leader to write <code>x = 5</code>. The leader appends it to its log and sends <b>AppendEntries</b> to followers. Once the entry is stored on a <b>majority</b> (n2, n3, n4), it's <b>committed</b>: the leader applies it and answers the client. Slow n5 will catch up; committed entries are never lost because any future leader must have them (thanks to the voting rule).`},
{hl:{q:[12,13]}, th:[['n1','RUN:warn','back, thinks it leads (term 1)'],['n2','RUN:ok','leader term 2']], d:{on:['n1'], ok:['n2','n3','n4'], e:[['n1','n5','AppendEntries t1','bad dash']]}, g:[G('Stale leader',['n1 in minority','reaches only n5','bad'],['can\'t get a majority','its writes never commit','ok'],['sees term 2','steps down to follower','ok'],['clients','must talk to the real leader'])], log:['n1 (term 1) cannot commit; learns term 2 → steps down'],
 say:`Now the old leader n1 comes back but is partitioned with only n5. It still believes it leads term 1 and accepts a client write, but it can never get that entry onto a majority, so it <b>never commits</b> and the client gets no success. As soon as n1 hears from anyone in term 2, it steps down. This is how consensus prevents split brain (8.1).`},
{hl:{q:[15]}, th:[], d:{}, g:[G('Costs and uses',['writes','one round trip to a majority'],['cluster size','3 or 5 (more = slower writes)'],['cross-region','majority latency = slow'],['typical use','metadata, leader election, config, distributed DB replication (per range)'])],
 say:`<b>Say it:</b> "Consensus lets a cluster agree on one ordered log despite failures; Raft does it with a leader elected by majority vote per term, using randomised timeouts and a rule that voters only pick candidates with up-to-date logs. The leader replicates entries, and an entry is committed once a majority stores it, so any two majorities overlap and committed data survives. A partitioned old leader can't commit. With 2f+1 nodes it tolerates f failures, and it underpins etcd, Consul and distributed SQL databases."`}
],
keep:[`Consensus = agree on one ordered log; replicated state machine.`,`2f+1 nodes tolerate f failures; decisions need a majority.`,`Raft election: random timeout → candidate, term++, majority votes → leader (≤1 leader per term).`,`Commit = stored on a majority; voters reject stale logs, so committed entries survive.`,`Minority-side old leader can't commit → no split brain. Used by etcd, Consul, CockroachDB, KRaft.`]}, {
  imp: 'extra',
  theory: TH(`Consensus algorithms like Raft and Paxos let a group of servers agree on a single ordered log of decisions despite crashes, by requiring a majority for every decision.`,
`<p>A committee needs decisions that stay valid even if some members leave. Rule: a decision counts only if a majority approves it, and only one chair (leader) at a time may propose decisions. Because any two majorities share at least one member, a new chair always learns about previously approved decisions.</p>
<p>Raft turns this into a protocol: nodes elect a leader for a numbered "term", the leader proposes log entries, and an entry is final once a majority stores it.</p>`,
[[`Consensus`,`Agreement on values despite failures.`],[`Replicated state machine`,`Nodes apply the same log in the same order.`],[`Term`,`Raft's leadership epoch number.`],[`Leader / follower / candidate`,`Raft roles.`],[`Quorum / majority`,`More than half the nodes.`],[`AppendEntries / RequestVote`,`Raft's two RPCs.`],[`Committed entry`,`Stored on a majority; never lost.`]],
[`Followers expect heartbeats; on timeout one becomes a candidate.`,`Candidates gather votes; a majority makes a leader for that term.`,`The leader appends client commands and replicates them.`,`Entries on a majority are committed and applied; lagging nodes catch up.`],
[`etcd (Kubernetes' brain), Consul, ZooKeeper (Zab).`,`CockroachDB/TiKV/YugabyteDB: one Raft group per data range.`,`Kafka KRaft for metadata; Patroni uses etcd/Consul to elect the Postgres primary.`],
[`Even-sized clusters (4 tolerates no more failures than 3).`,`Spreading a Raft group across far regions without accounting for latency.`,`Using consensus for high-volume data when a simpler replication scheme would do.`]),
  examples: [
    {lv:'basic', title:'Who wins an election? Count votes', sql:`CREATE TABLE votes (term INTEGER, voter TEXT, candidate TEXT);
INSERT INTO votes VALUES (2,'n2','n2'), (2,'n3','n2'), (2,'n4','n2'), (2,'n5','n5');
SELECT candidate, COUNT(*) AS votes,
       CASE WHEN COUNT(*) > 5 / 2.0 THEN 'leader' ELSE 'not elected' END AS outcome
FROM votes WHERE term = 2 GROUP BY candidate;`, why:`n2 has 3 of 5 votes, a majority: leader for term 2. n5 voted for itself but lost.`},
    {lv:'mid', title:'Which log entries are committed?', sql:`CREATE TABLE replicated (idx INTEGER, node TEXT);
INSERT INTO replicated VALUES (1,'n1'),(1,'n2'),(1,'n3'),(1,'n4'),(1,'n5'),
                              (2,'n2'),(2,'n3'),(2,'n4'),
                              (3,'n2'),(3,'n3');
SELECT idx, COUNT(*) AS copies,
       CASE WHEN COUNT(*) >= 3 THEN 'committed' ELSE 'not yet' END AS status
FROM replicated GROUP BY idx ORDER BY idx;`, why:`Entries 1 and 2 are on a majority (≥ 3 of 5): committed. Entry 3 is only on 2 nodes: not committed yet.`},
    {lv:'adv', title:'Failure tolerance by cluster size', sql:`WITH RECURSIVE sizes(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM sizes WHERE n < 7)
SELECT n AS nodes, n / 2 + 1 AS majority, n - (n / 2 + 1) AS failures_tolerated
FROM sizes;`, why:`4 nodes tolerate 1 failure, the same as 3, but need more votes per write. That's why clusters are odd-sized: 3 or 5.`},
  ],
  tips: {
    say:`"Raft elects a single leader per term by majority vote, with randomised timeouts to avoid split votes and a rule that voters only choose candidates whose logs are at least as up to date. The leader replicates log entries, which are committed once stored on a majority, so any future leader has them. 2f+1 nodes tolerate f failures, and a partitioned minority can't commit, preventing split brain."`,
    points:[`Explain terms, majority voting and the up-to-date log check.`,`Explain the commit rule and why committed entries survive.`,`Name real users (etcd, CockroachDB, KRaft).`],
    traps:[`Saying more nodes always means more availability (even sizes, latency).`,`Confusing consensus with 2PC (different problems).`],
    qa:[[`Why use an odd number of nodes?`,`Majority of 2f+1 tolerates f failures; adding one node to make it even raises the quorum size without tolerating more failures.`],
        [`Consensus vs two-phase commit?`,`Consensus: replicas agree on one value/log and tolerate minority failures. 2PC: different participants (each owning different data) agree to commit; any one failing blocks it. Distributed DBs combine them.`],
        [`What prevents two leaders in Raft?`,`Each node votes once per term and a leader needs a majority; two majorities intersect, so only one candidate can win a term. Older-term leaders step down when they see a higher term.`]]
  },
  exercises: [
    {lv:'E', q:`Count votes for term 3 where n1→n3, n2→n3, n3→n3, n4→n5, n5→n5. Return <code>candidate, votes</code>.`, hint:`GROUP BY candidate.`,
     sql:`CREATE TABLE votes (term INTEGER, voter TEXT, candidate TEXT);
INSERT INTO votes VALUES (3,'n1','n3'),(3,'n2','n3'),(3,'n3','n3'),(3,'n4','n5'),(3,'n5','n5');
SELECT candidate, COUNT(*) AS votes FROM votes WHERE term = 3 GROUP BY candidate;`},
    {lv:'M', q:`In a 7-node cluster, entries are replicated as: idx 1 on 7 nodes, idx 2 on 4, idx 3 on 3. Return the committed indexes: <code>idx</code>.`, hint:`Majority of 7 is 4.`,
     sql:`CREATE TABLE replicated (idx INTEGER, copies INTEGER);
INSERT INTO replicated VALUES (1, 7), (2, 4), (3, 3);
SELECT idx FROM replicated WHERE copies >= 7 / 2 + 1;`},
    {lv:'H', q:`A 5-node etcd cluster spans 3 regions as 2 + 2 + 1. One region with 2 nodes goes offline. Can the cluster still write? What if it were 3 + 1 + 1 and the 3-node region failed? Recommend a layout.`, hint:`Count the survivors against the majority (3).`,
     answer:`<p>2+2+1 losing a 2-node region leaves 3 of 5: still a majority, writes continue. 3+1+1 losing the 3-node region leaves 2 of 5: no majority, cluster unavailable for writes. Spread nodes so no single region holds a majority, e.g. 2+2+1 (or 1+1+1 for 3 nodes), accepting cross-region write latency.</p>`},
  ],
  quiz: [
    [`A 5-node Raft cluster tolerates how many failed nodes?`,[`1`,`2`,`3`,`4`],1,`Needs 3 alive for a majority.`,'E'],
    [`An entry is committed in Raft when…`,[`The leader writes it`,`A majority of nodes have stored it`,`All nodes have stored it`,`The client acks`],1,`Majority replication.`,'E'],
    [`What triggers a Raft election?`,[`A client request`,`A follower's election timeout without hearing from a leader`,`A full log`,`Every second`],1,`Randomised timeouts.`,'M'],
    [`Why are election timeouts randomised?`,[`Security`,`To make simultaneous candidacies (split votes) unlikely`,`To save power`,`To balance load`],1,`One node usually times out first.`,'M'],
    [`An old leader partitioned with a minority…`,[`Keeps committing writes`,`Can't commit because it can't reach a majority`,`Corrupts data`,`Becomes leader of a new cluster`],1,`No split brain.`,'M'],
    [`Which system uses Raft?`,[`etcd`,`Memcached`,`SQLite`,`Redis (standalone)`],0,`Also Consul, CockroachDB, TiKV.`,'E'],
  ],
  quizAdv: [
    [`Raft voters reject a candidate whose log is…`,[`Longer`,`Less up to date (lower last term, or same term and shorter)`,`On another region`,`Empty only`],1,`Election restriction ensures leader completeness.`,'H'],
    [`Raft's term number serves as…`,[`A wall clock`,`A logical clock identifying leadership epochs; stale leaders detect higher terms and step down`,`A log index`,`A checksum`],1,`Like Paxos ballots.`,'H'],
    [`Why can't a leader count an entry from an earlier term as committed just because it's on a majority?`,[`It can`,`Raft only commits earlier-term entries indirectly by committing a current-term entry after them (Figure 8 scenario)`,`Entries expire`,`Terms are irrelevant`],1,`Subtle safety rule.`,'H'],
  ],
});
