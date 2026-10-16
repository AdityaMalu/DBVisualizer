/* 6.3 Locks: shared/exclusive, row/table, SELECT FOR UPDATE, two-phase locking */
topic('6', { no:'6.3', title:'Locking: shared vs exclusive, row vs table, FOR UPDATE, two-phase locking', db:'bank',
idea:`Watch the lock table as two transactions compete for one account row. See which lock modes are compatible, how SELECT … FOR UPDATE serialises a read-modify-write, what SKIP LOCKED does for job queues, and why two-phase locking holds locks until commit.`,
actors:'Transactions', stateTitle:'Lock table', tbTitle:'accounts',
codes:{a:`-- T1
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;   -- X lock on row 1
UPDATE accounts SET balance = balance - 30 WHERE id = 1;
COMMIT;                                                  -- locks released

-- T2 (at the same time)
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;   -- waits for T1
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
COMMIT;

-- job queue: take the next free job without waiting on others
SELECT id FROM jobs WHERE status = 'new'
ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED;`},
steps:[
{hl:{}, th:[['T1','NEW:dim',''],['T2','NEW:dim','']], g:[G('Lock modes',['S (shared)','for reading; many holders at once'],['X (exclusive)','for writing; one holder, blocks S and X','hot']), G('Compatibility',['S + S','✓ compatible','ok'],['S + X','✗ wait','bad'],['X + X','✗ wait','bad'])],
 say:`<b>Locks</b> coordinate concurrent access. A <b>shared (S)</b> lock lets many transactions read the same item; an <b>exclusive (X)</b> lock gives one transaction the right to write it and blocks everyone else's S and X locks. In MVCC databases (6.5) plain reads don't take S locks at all, so readers and writers don't block each other; locks matter mostly between writers.`},
{hl:{T1:[2,3]}, th:[['T1','RUN:ok','holds X on row 1'],['T2','NEW:dim','']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',100]],{0:'hot'})], g:[G('Locks',['row 1','X held by T1','hot'],['waiters','none'])],
 say:`T1 runs <code>SELECT … FOR UPDATE</code>: it reads Asha's balance and takes an <b>exclusive row lock</b>, announcing "I'm going to change this row". Ordinary SELECTs from other transactions still read the last committed version without waiting (MVCC).`},
{hl:{T2:[8,9]}, th:[['T1','RUN:ok','holds X on row 1'],['T2','BLOCKED:bad','waits for row 1']], g:[G('Locks',['row 1','X held by T1','hot'],['waiters','T2 wants X','bad'])], log:['T2 blocked on row 1'],
 say:`T2 tries the same <code>FOR UPDATE</code> on row 1 and <b>waits</b>. This is exactly what we want for a read-modify-write: T2 can't read a balance that T1 is about to change. Without FOR UPDATE both would read 100 and one withdrawal would be lost (6.2).`},
{hl:{T1:[4,5]}, th:[['T1','TERM:ok','committed, locks released'],['T2','RUN:ok','gets X, reads 70']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',70]],{0:'ok'})], g:[G('Two-phase locking (2PL)',['growing phase','acquire locks as needed'],['shrinking phase','release (strict 2PL: all at COMMIT/ROLLBACK)','hot'],['guarantees','conflict-serializable schedules'])], log:['T1 COMMIT → T2 wakes up, reads 70'],
 say:`T1 updates and commits; only then are its locks released, and T2 wakes up reading 70 (not 100). Holding locks until the end is <b>strict two-phase locking</b>: a transaction acquires locks as it goes (growing phase) and releases them all at commit (shrinking phase). It guarantees serializable outcomes for the data it locks, at the cost of waiting, and makes <b>deadlocks</b> possible (6.4).`},
{hl:{T2:[10,11]}, th:[['T1','TERM:dim',''],['T2','TERM:ok','balance 20']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',20]],{0:'ok'})], g:[G('Granularity',['row locks','fine-grained, high concurrency','ok'],['page / table locks','coarse, cheap to manage, block more'],['lock escalation','many row locks → one table lock (SQL Server)'],['intention locks','IS/IX on the table signal row locks inside'])], log:['both withdrawals applied: 100 − 30 − 50 = 20'],
 say:`Both withdrawals applied: 20. Lock <b>granularity</b> matters: row locks allow high concurrency; table locks are coarse. Databases also place <b>intention locks</b> on the table (IX = "someone holds X locks on rows inside") so a request for a whole-table lock can be checked quickly. Some engines escalate many row locks into one table lock.`},
{hl:{q:[14,15]}, th:[['W1','RUN:ok','took job 1'],['W2','RUN:ok','skipped 1, took job 2']], tb:[TB('jobs',['id','status','locked by'],[[1,'new','W1'],[2,'new','W2'],[3,'new','']],{0:'hot',1:'hot'})], g:[G('Lock options',['NOWAIT','fail immediately if locked'],['SKIP LOCKED','skip locked rows','ok'],['use','work queues: many workers, no contention','ok'],['also','FOR SHARE (S row lock), lock_timeout'])],
 say:`Two useful variants. <code>NOWAIT</code> errors instead of waiting. <code>SKIP LOCKED</code> silently skips rows other transactions have locked, which turns a table into an efficient <b>job queue</b>: each worker grabs the next unlocked job without blocking the others.`},
{hl:{}, th:[], tb:[], g:[G('Watch out',['long transactions','hold locks → queues of waiters','bad'],['DDL','ALTER TABLE takes strong table locks (10.4)','bad'],['lock waits','pg_locks / performance_schema.data_locks'])],
 say:`<b>Say it:</b> "Shared locks allow concurrent readers, exclusive locks give one writer sole access, and they conflict. Databases lock rows for writes and hold locks until commit under strict two-phase locking, which guarantees serializable conflicts but can cause waits and deadlocks. For read-modify-write I use SELECT … FOR UPDATE, and for job queues FOR UPDATE SKIP LOCKED. I keep transactions short so locks are held briefly."`}
],
keep:[`S (shared) compatible with S; X (exclusive) conflicts with everything.`,`MVCC: plain reads take no locks; writers lock rows.`,`SELECT … FOR UPDATE = lock the row for a safe read-modify-write.`,`Strict 2PL: acquire as you go, release all at COMMIT → serializable, but waits/deadlocks.`,`SKIP LOCKED for queues; NOWAIT to fail fast. Keep transactions short.`]}, {
  imp: 'must',
  theory: TH(`Locks stop concurrent transactions from making conflicting changes: shared locks for reading, exclusive locks for writing, usually held until the transaction ends (two-phase locking).`,
`<p>A lock is a "reserved" sign on a piece of data. Several people can read the same document at once (shared lock), but only one can edit it, and while they edit, others must wait (exclusive lock).</p>
<p>Two-phase locking adds a rule: during a transaction you can keep taking locks, but you don't give any back until you're done. That prevents others from seeing or changing your intermediate state, which is what makes concurrent transactions behave as if they ran one after another.</p>`,
[[`Shared lock (S)`,`Read lock; compatible with other S locks.`],[`Exclusive lock (X)`,`Write lock; incompatible with all others.`],[`Row / table lock`,`Lock granularity.`],[`Intention lock (IS/IX)`,`Table-level marker for row locks inside.`],[`Two-phase locking`,`Growing phase then shrinking phase; strict 2PL releases at commit.`],[`SELECT … FOR UPDATE`,`Read and X-lock rows.`],[`SKIP LOCKED / NOWAIT`,`Skip locked rows / fail instead of waiting.`]],
[`A writer requests an X lock on the rows it changes.`,`If another transaction holds a conflicting lock, it waits (or times out).`,`Locks accumulate during the transaction.`,`COMMIT/ROLLBACK releases them all; waiters proceed.`],
[`FOR UPDATE in checkout/inventory/wallet flows.`,`Queues on Postgres with FOR UPDATE SKIP LOCKED (e.g. background job libraries).`,`Monitoring lock waits and blocking chains during incidents.`],
[`Locking rows in inconsistent order (deadlocks).`,`Holding locks during network calls.`,`Running migrations that take table locks on busy tables.`,`FOR UPDATE on huge ranges, effectively locking the table.`]),
  examples: [
    {lv:'basic', title:'Read-modify-write inside one transaction', sql:`BEGIN IMMEDIATE;               -- SQLite: take the write lock up front
SELECT balance FROM accounts WHERE id = 1;
UPDATE accounts SET balance = balance - 30 WHERE id = 1;
COMMIT;
SELECT id, balance FROM accounts WHERE id = 1;`, why:`SQLite locks the whole database for writing (BEGIN IMMEDIATE), the coarse-grained version of Postgres's row-level <code>SELECT … FOR UPDATE</code>.`},
    {lv:'mid', title:'A job queue table', sql:`CREATE TABLE jobs (id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'new', worker TEXT);
INSERT INTO jobs (id) VALUES (1), (2), (3);
-- worker W1 claims the next job atomically (Postgres would add FOR UPDATE SKIP LOCKED)
UPDATE jobs SET status = 'running', worker = 'W1'
WHERE id = (SELECT id FROM jobs WHERE status = 'new' ORDER BY id LIMIT 1);
UPDATE jobs SET status = 'running', worker = 'W2'
WHERE id = (SELECT id FROM jobs WHERE status = 'new' ORDER BY id LIMIT 1);
SELECT * FROM jobs;`, why:`Each claim is one atomic UPDATE. In Postgres with many concurrent workers, the inner SELECT uses FOR UPDATE SKIP LOCKED so workers don't queue behind each other.`},
    {lv:'adv', title:'Postgres: claim a batch with SKIP LOCKED (shown, not run)', sql:`WITH next AS (
  SELECT id FROM jobs
  WHERE status = 'new'
  ORDER BY id
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
UPDATE jobs j SET status = 'running', worker = $1
FROM next WHERE j.id = next.id
RETURNING j.id;`, run:false, why:`The standard Postgres queue pattern: lock up to 10 free jobs, skip ones other workers hold, mark them running, return their ids, all in one statement.`},
  ],
  tips: {
    say:`"Shared locks allow concurrent reads, exclusive locks give sole write access. Under strict two-phase locking a transaction holds its locks until commit, giving serializable conflicts at the cost of waiting and possible deadlocks. With MVCC, plain reads don't lock, so I use SELECT FOR UPDATE for read-modify-write, SKIP LOCKED for job queues, and I keep transactions short."`,
    points:[`Draw the S/X compatibility matrix.`,`Explain 2PL's growing/shrinking phases.`,`Show FOR UPDATE fixing the lost update.`],
    traps:[`Saying SELECTs block writers in Postgres/InnoDB (not with MVCC consistent reads).`,`Forgetting that locks are released only at commit.`],
    qa:[[`What's the difference between FOR UPDATE and FOR SHARE?`,`FOR UPDATE takes an exclusive row lock (blocks other FOR UPDATE/UPDATE/DELETE); FOR SHARE allows other FOR SHARE but blocks writers.`],
        [`What are intention locks?`,`Table-level IS/IX locks that say "some rows in this table are S/X-locked", so a table-level lock request can be checked without scanning row locks.`],
        [`How do you implement a reliable job queue in Postgres?`,`SELECT … FOR UPDATE SKIP LOCKED LIMIT n in a transaction, mark jobs running, commit; handle crashes with timeouts/heartbeats to requeue.`]]
  },
  exercises: [
    {lv:'E', q:`In one transaction, withdraw 20 from Ben (id 2) and deposit it to Chen (id 3); return both balances <code>id, balance</code> ordered by id.`, hint:`BEGIN; UPDATE; UPDATE; COMMIT; SELECT.`, ordered:true,
     sql:`BEGIN;
UPDATE accounts SET balance = balance - 20 WHERE id = 2;
UPDATE accounts SET balance = balance + 20 WHERE id = 3;
COMMIT;
SELECT id, balance FROM accounts WHERE id IN (2, 3) ORDER BY id;`},
    {lv:'M', q:`T1 holds an S lock on row 5. For each request, say granted or waits: (a) T2 S on row 5, (b) T2 X on row 5, (c) T2 X on row 6, (d) T2 wants a table-level S lock while T1 holds IX on the table.`, hint:`Compatibility matrix; intention locks.`,
     answer:`(a) granted (S+S) · (b) waits (S vs X) · (c) granted (different row) · (d) waits: S (table) conflicts with IX, because some row in the table is being written.`},
    {lv:'H', q:`Using a jobs table, claim the next two 'new' jobs for worker 'W9' in two atomic statements, then return <code>id, worker</code> of running jobs.`, hint:`Create jobs (ids 1–4), then two UPDATE … WHERE id = (SELECT … LIMIT 1).`,
     sql:`CREATE TABLE jobs (id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'new', worker TEXT);
INSERT INTO jobs (id) VALUES (1), (2), (3), (4);
UPDATE jobs SET status = 'running', worker = 'W9' WHERE id = (SELECT id FROM jobs WHERE status = 'new' ORDER BY id LIMIT 1);
UPDATE jobs SET status = 'running', worker = 'W9' WHERE id = (SELECT id FROM jobs WHERE status = 'new' ORDER BY id LIMIT 1);
SELECT id, worker FROM jobs WHERE status = 'running';`},
  ],
  quiz: [
    [`Shared and exclusive locks on the same row are…`,[`Compatible`,`Incompatible: one must wait`,`Merged`,`Ignored with MVCC`],1,`X conflicts with everything.`,'E'],
    [`In strict two-phase locking, locks are released…`,[`After each statement`,`At COMMIT/ROLLBACK`,`Every second`,`When memory is low`],1,`End of transaction.`,'M'],
    [`SELECT … FOR UPDATE is used to…`,[`Speed up reads`,`Lock rows you intend to modify, preventing concurrent conflicting writes`,`Create an index`,`Avoid transactions`],1,`Safe read-modify-write.`,'E'],
    [`FOR UPDATE SKIP LOCKED is ideal for…`,[`Reports`,`Job queues with many workers`,`Schema migrations`,`Backups`],1,`Workers don't block each other.`,'M'],
    [`In Postgres, does a plain SELECT block a concurrent UPDATE of the same row?`,[`Yes`,`No: MVCC readers don't take row locks`,`Only in SERIALIZABLE`,`Only with an index`],1,`Readers and writers don't block each other.`,'M'],
    [`Main cost of 2PL?`,[`Data loss`,`Waiting and the possibility of deadlocks`,`Dirty reads`,`More disk`],1,`See 6.4.`,'E'],
  ],
  quizAdv: [
    [`Intention-exclusive (IX) on a table means…`,[`The table is exclusively locked`,`Some rows in it are (or will be) X-locked`,`No one can read it`,`An index is being built`],1,`Speeds up table-lock conflict checks.`,'H'],
    [`InnoDB next-key/gap locks exist to…`,[`Speed up inserts`,`Prevent phantoms for locking reads by locking index gaps`,`Replace MVCC`,`Avoid deadlocks`],1,`Can cause surprising waits on inserts.`,'H'],
    [`Lock escalation (SQL Server) converts…`,[`Table locks into row locks`,`Many row/page locks into one table lock to save memory`,`S into X`,`Deadlocks into timeouts`],1,`Can reduce concurrency suddenly.`,'H'],
  ],
});
