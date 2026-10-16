/* 8.1 Replication: leader-follower, sync vs async, failover */
topic('8', { no:'8.1', title:'Replication: leader–follower, synchronous vs asynchronous, failover', db:'bank',
idea:`One primary takes writes and streams its write-ahead log to replicas. Watch a commit with asynchronous replication return before the replica has it, a synchronous commit wait for an acknowledgement, and a failover that promotes a replica, possibly losing the last few transactions.`,
dgTitle:'Replication topology', stateTitle:'Commit path',
nodes:{
  app:{x:60,y:110,label:'app',w:80,kind:'actor'},
  p:{x:230,y:110,label:'primary\n(leader)',w:120,h:50,kind:'db'},
  r1:{x:430,y:50,label:'replica 1\n(sync)',w:120,h:50,kind:'db'},
  r2:{x:430,y:180,label:'replica 2\n(async)',w:120,h:50,kind:'db'}
},
edges:[['app','p'],['p','r1'],['p','r2']],
vb:'0 0 520 230',
codes:{a:`-- primary: every change goes into the WAL (7.1), which is streamed
-- to replicas that replay it (physical) or apply row changes (logical)

-- async (default): COMMIT returns after the PRIMARY's WAL is durable
synchronous_standby_names = ''                    -- Postgres
-- sync: COMMIT waits until a replica confirms it has the WAL
synchronous_standby_names = 'FIRST 1 (replica1)'
synchronous_commit = remote_apply                 -- or on / remote_write

-- reads can go to replicas (read scaling), writes only to the primary
-- failover: primary dies → promote a replica → repoint clients
SELECT pg_promote();                              -- on the chosen replica`},
steps:[
{hl:{q:[1,2]}, d:{on:['p'], e:[['p','r1','WAL stream',''],['p','r2','WAL stream','']]}, g:[G('Why replicate',['high availability','survive a server/AZ loss','ok'],['read scaling','spread reads over replicas','ok'],['geo latency','replicas near users'],['backups / analytics','run on a replica'])],
 say:`<b>Replication</b> keeps copies of the same data on several machines. In <b>leader–follower</b> (primary–replica) replication, only the primary accepts writes; it streams its write-ahead log to replicas, which replay it. Reasons: survive machine failures, scale reads, serve users from nearby regions, and offload backups and analytics.`},
{hl:{q:[4,5]}, d:{on:['app','p'], e:[['app','p','COMMIT','hot'],['p','app','OK (fast)','ok'],['p','r2','WAL later…','dash']]}, g:[G('Asynchronous',['COMMIT returns when','primary\'s WAL is on disk','ok'],['replica','catches up ms…s later'],['latency','lowest','ok'],['risk','primary dies before shipping → those commits are lost','bad'])], log:['commit acknowledged; replica 2 lag: 120 ms'],
 say:`With <b>asynchronous</b> replication (the default), COMMIT returns as soon as the primary has made the change durable locally; the WAL is shipped to replicas shortly after. Writes are as fast as a single server. The risk: if the primary dies in that gap, the replica never received the last transactions, and failing over loses them.`},
{hl:{q:[6,7,8]}, d:{on:['p','r1'], e:[['app','p','COMMIT','hot'],['p','r1','WAL','hot'],['r1','p','ack','ok'],['p','app','OK (after ack)','ok']]}, g:[G('Synchronous',['COMMIT waits for','a replica\'s acknowledgement','hot'],['data loss on failover','none (for acked commits)','ok'],['latency','+ network round trip','bad'],['availability','if the sync replica is down, writes stall (unless ANY n / fallback)','bad'],['levels','remote_write → on (flushed) → remote_apply (visible)'])], log:['commit waits ~1-2 ms for replica 1'],
 say:`With <b>synchronous</b> replication, COMMIT waits until a replica confirms it has the WAL. An acknowledged commit then exists on two machines, so failover loses nothing. The price: every commit pays a network round trip, and if the synchronous replica is down, writes block. Common compromise: one sync replica in the same region (quorum like <code>ANY 1 (r1, r2)</code>) plus async replicas elsewhere (semi-synchronous).`},
{hl:{q:[10]}, d:{on:['r1','r2'], e:[['app','r1','reads','ok'],['app','r2','reads','ok'],['app','p','writes','hot']]}, g:[G('Read scaling',['writes','primary only'],['reads','any replica','ok'],['catch','replica reads may be stale (lag)','bad'],['next topic','read-your-writes and friends (8.2)'])],
 say:`Replicas can serve <b>reads</b>, which scales read-heavy workloads. Writes still all go through the primary, so replication does not scale writes (that's sharding, 8.3). And replica reads may be <b>stale</b> because of lag, which creates anomalies like "I saved my profile and it shows the old name" (8.2).`},
{hl:{q:[11,12]}, d:{bad:['p'], ok:['r1'], e:[['app','r1','writes now','ok'],['r1','r2','WAL stream','']]}, g:[G('Failover',['detect','health checks / consensus (Patroni, orchestrator, RDS)'],['choose','most up-to-date replica'],['promote','replica becomes primary','hot'],['repoint','DNS / proxy / client config'],['async lag','last commits may be lost','bad'])], log:['primary down → promote replica 1 → clients reconnect'],
 say:`<b>Failover</b>: when the primary dies, a replica is <b>promoted</b> to primary and clients are redirected. Automated tools (Patroni, orchestrator, cloud managed services) detect failure, pick the most up-to-date replica and promote it, typically in seconds to a minute. With async replication, commits the old primary acknowledged but didn't ship are lost.`},
{hl:{}, d:{bad:['p'], on:['r1']}, g:[G('Split brain',['old primary comes back','still thinks it\'s primary','bad'],['two primaries','accept conflicting writes','bad'],['prevention','fencing (STONITH), consensus-based leader election (8.7), quorum'])],
 say:`The scariest failover bug is <b>split brain</b>: the old primary was only unreachable, not dead, and keeps accepting writes while the new primary does too. Two diverging histories. Prevention: <b>fencing</b> (cut off or shut down the old primary), and leader election through a consensus system (8.7) so only one node can hold leadership.`},
{hl:{}, d:{}, g:[G('Other topologies',['multi-leader','writes in several regions; conflict resolution needed','bad'],['leaderless (Dynamo)','quorum reads/writes (8.8)'],['logical replication','row-level change streams, selective tables, CDC'])],
 say:`<b>Say it:</b> "In leader–follower replication the primary takes writes and streams its WAL to replicas. Asynchronous replication keeps commits fast but can lose the last transactions on failover; synchronous waits for a replica's ack, trading latency and availability for zero loss. Replicas scale reads but may be stale, and don't scale writes. Failover promotes a replica, and fencing or consensus prevents split brain."`}
],
keep:[`Leader–follower: writes to primary, WAL streamed to replicas.`,`Async: fast commits, possible data loss on failover. Sync: wait for replica ack, no loss, more latency, writes stall if replica down.`,`Replicas scale reads (stale!), not writes.`,`Failover = promote replica + repoint clients; prevent split brain with fencing/consensus.`]}, {
  imp: 'must',
  theory: TH(`Replication keeps copies of the database on several servers: a primary accepts writes and ships its changes to replicas, which serve reads and can take over if the primary fails.`,
`<p>One server is a single point of failure and has limited capacity. Replication copies every change from a <b>primary</b> to one or more <b>replicas</b>. If the primary dies, a replica can be promoted; meanwhile replicas can answer read queries.</p>
<p>The key design choice is <b>when</b> to tell the client "your write is saved": after the primary alone has it (asynchronous: fast, small risk of loss) or after a replica confirms too (synchronous: safer, slower). It's like sending an important letter: you can drop it in the box and go (async), or wait for the delivery receipt (sync).</p>`,
[[`Primary / leader`,`The node that accepts writes.`],[`Replica / follower / standby`,`Node that applies the primary's changes.`],[`Physical replication`,`Shipping and replaying WAL (byte-level copy).`],[`Logical replication`,`Shipping row-level changes; selective, cross-version.`],[`Replication lag`,`How far a replica is behind.`],[`Synchronous / asynchronous`,`Commit waits / doesn't wait for replica ack.`],[`Failover`,`Promoting a replica when the primary fails.`],[`Split brain`,`Two nodes both acting as primary.`]],
[`The primary writes changes to its WAL.`,`WAL is streamed to replicas, which replay it.`,`Depending on the mode, COMMIT waits for replica acknowledgement.`,`On failure, a replica is promoted and clients are redirected.`],
[`Managed services: multi-AZ standby (sync) + read replicas (async).`,`Routing reads to replicas via proxies (PgBouncer + HAProxy, ProxySQL) or the ORM.`,`Monitoring replication lag and alerting on it.`],
[`Treating replicas as backups (they replicate mistakes).`,`Reading from replicas right after writing (stale reads).`,`Manual failover without fencing (split brain).`,`Long-running queries on replicas causing replication conflicts or lag.`]),
  examples: [
    {lv:'basic', title:'Simulating a replica: copy the primary\'s state', sql:`CREATE TABLE replica_accounts AS SELECT * FROM accounts;      -- initial sync
UPDATE accounts SET balance = balance + 10 WHERE id = 1;           -- write on primary
SELECT 'primary' AS node, balance FROM accounts WHERE id = 1
UNION ALL
SELECT 'replica (not yet applied)', balance FROM replica_accounts WHERE id = 1;`, why:`Until the change is shipped and applied, the replica returns the old value: replication lag.`},
    {lv:'mid', title:'Shipping a change log to the replica', sql:`CREATE TABLE replica_accounts AS SELECT * FROM accounts;
CREATE TABLE wal (lsn INTEGER PRIMARY KEY, id INTEGER, new_balance REAL);
-- primary: change + log record
UPDATE accounts SET balance = 140 WHERE id = 1; INSERT INTO wal VALUES (1, 1, 140);
UPDATE accounts SET balance = 210 WHERE id = 2; INSERT INTO wal VALUES (2, 2, 210);
-- replica: apply log records it hasn't applied yet (here: all)
UPDATE replica_accounts SET balance = (SELECT new_balance FROM wal w WHERE w.id = replica_accounts.id
                                       ORDER BY lsn DESC LIMIT 1)
WHERE id IN (SELECT id FROM wal);
SELECT p.id, p.balance AS primary_balance, r.balance AS replica_balance
FROM accounts p JOIN replica_accounts r ON r.id = p.id WHERE p.id IN (1, 2);`, why:`Replay the log in order and the replica converges to the primary: physical replication in miniature.`},
    {lv:'adv', title:'Measuring lag (Postgres, shown, not run)', sql:`-- on the primary
SELECT client_addr, state, sync_state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS bytes_behind,
       replay_lag
FROM pg_stat_replication;

-- on a replica
SELECT now() - pg_last_xact_replay_timestamp() AS lag;`, run:false, why:`pg_stat_replication shows each replica's mode (sync/async/quorum) and how far behind it is, in bytes and time. Alert on it.`},
  ],
  tips: {
    say:`"In leader–follower replication the primary takes all writes and streams its WAL to replicas. Async keeps writes fast but failover can lose the last commits; sync waits for a replica ack, giving no loss at the cost of latency and write availability, so I usually run one sync or quorum replica nearby plus async ones. Replicas scale reads but can be stale; failover promotes a replica, with fencing to avoid split brain."`,
    points:[`Explain the commit acknowledgement point for sync vs async.`,`Say replication scales reads, not writes.`,`Mention split brain and fencing.`],
    traps:[`"Replicas are backups."`,`Ignoring stale reads when routing reads to replicas.`],
    qa:[[`What happens to writes if the only synchronous replica goes down?`,`Commits block waiting for an ack. Use quorum (ANY 1 of several) or allow fallback to async, accepting the risk.`],
        [`Physical vs logical replication?`,`Physical streams WAL bytes: exact copy, whole cluster, same major version. Logical streams row changes: selective tables, cross-version, can feed other systems, but DDL and sequences need care.`],
        [`How do you make failover safe?`,`Automated detection with consensus (Patroni+etcd), promote the most caught-up replica, fence the old primary, and repoint clients through a stable endpoint.`]]
  },
  exercises: [
    {lv:'E', q:`Create <code>replica_accounts</code> as a copy of accounts, then deposit 100 into Diya (id 4) on the primary only, and return <code>primary_balance, replica_balance</code> for Diya.`, hint:`CREATE TABLE … AS SELECT; UPDATE accounts; select both with subqueries.`,
     sql:`CREATE TABLE replica_accounts AS SELECT * FROM accounts;
UPDATE accounts SET balance = balance + 100 WHERE id = 4;
SELECT (SELECT balance FROM accounts WHERE id = 4) AS primary_balance,
       (SELECT balance FROM replica_accounts WHERE id = 4) AS replica_balance;`},
    {lv:'M', q:`For each scenario pick sync, async, or a mix: (a) payments ledger in one region, (b) global read replicas for a news site, (c) a 3-node cluster that must survive one node failure without data loss and keep accepting writes.`, hint:`Loss tolerance, latency, availability.`,
     answer:`(a) synchronous (or quorum) replica in another AZ: no committed payment may be lost. (b) asynchronous: latency matters, slight staleness is fine. (c) quorum sync (ANY 1 of 2 replicas): one replica can fail and commits still get an ack from the other.`},
    {lv:'H', q:`After an async failover, customers report orders "disappeared" that they had confirmation emails for. Explain the cause and how to reduce or recover from it.`, hint:`Unshipped WAL; old primary's data.`,
     answer:`<p>The old primary acknowledged those commits but hadn't shipped the WAL before it died; the promoted replica never had them. Mitigations: synchronous/quorum replication for critical data; monitor and cap lag (e.g. refuse failover to a replica more than N seconds behind, or wait for the old primary's WAL if the disk survives); after failover, extract the missing transactions from the old primary's WAL/data and reconcile; send emails only after the order is durable on a replica (or via an outbox processed from the new primary).</p>`},
  ],
  quiz: [
    [`In leader–follower replication, writes go to…`,[`Any replica`,`Only the primary`,`All nodes at once`,`The fastest node`],1,`Replicas apply the primary's changes.`,'E'],
    [`Asynchronous replication risk?`,[`Slow commits`,`Losing recently committed transactions if the primary fails before shipping them`,`Dirty reads on the primary`,`Deadlocks`],1,`The acknowledgement gap.`,'E'],
    [`Synchronous replication cost?`,[`Data loss`,`Higher commit latency; writes may stall if the sync replica is down`,`No read scaling`,`Corruption`],1,`Waits for an ack.`,'M'],
    [`Do read replicas increase write capacity?`,[`Yes`,`No: every write still goes through the primary`,`Only with sync`,`Only for inserts`],1,`Sharding scales writes.`,'E'],
    [`Split brain is…`,[`A replica with corrupted data`,`Two nodes both acting as primary and accepting writes`,`A slow failover`,`A network partition between replicas`],1,`Prevent with fencing/consensus.`,'M'],
    [`Reading from a replica right after writing to the primary may…`,[`Fail`,`Return stale data`,`Deadlock`,`Corrupt the replica`],1,`Replication lag (8.2).`,'E'],
  ],
  quizAdv: [
    [`Postgres synchronous_commit = remote_apply guarantees…`,[`Only local flush`,`The change is applied and visible on the sync replica before COMMIT returns`,`Async behaviour`,`Logical replication`],1,`Enables read-your-writes on that replica.`,'H'],
    [`Semi-synchronous replication (MySQL) waits for…`,[`All replicas to apply`,`At least one replica to receive (not necessarily apply) the event`,`Nothing`,`The binlog to be archived`],1,`A middle ground.`,'H'],
    [`Long queries on a Postgres hot standby can…`,[`Never interfere`,`Be cancelled due to replication conflicts, or with hot_standby_feedback cause bloat on the primary`,`Block the primary's writes directly`,`Corrupt WAL`],1,`Trade-off knob.`,'H'],
  ],
});
