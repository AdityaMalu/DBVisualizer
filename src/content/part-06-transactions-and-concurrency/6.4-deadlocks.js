/* 6.4 Deadlocks */
topic('6', { no:'6.4', title:'Deadlocks: how they happen, detection, prevention', db:'bank',
idea:`Two transfers lock the same two accounts in opposite order and wait for each other forever. Watch the wait-for graph form a cycle, the database pick a victim and roll it back, and the simple rule (always lock in the same order) that makes this deadlock impossible.`,
actors:'Transactions', dgTitle:'Wait-for graph', stateTitle:'Locks',
nodes:{
  T1:{x:90,y:60,label:'T1\nAsha → Ben',w:120,h:46,kind:'actor'},
  T2:{x:390,y:60,label:'T2\nBen → Asha',w:120,h:46,kind:'actor'},
  r1:{x:90,y:180,label:'row 1 (Asha)',w:120,kind:'lock'},
  r2:{x:390,y:180,label:'row 2 (Ben)',w:120,kind:'lock'}
},
edges:[],
vb:'0 0 480 220',
codes:{a:`-- T1: transfer Asha → Ben
BEGIN;
UPDATE accounts SET balance = balance - 10 WHERE id = 1;   -- locks row 1
UPDATE accounts SET balance = balance + 10 WHERE id = 2;   -- wants row 2

-- T2: transfer Ben → Asha (at the same time)
BEGIN;
UPDATE accounts SET balance = balance - 20 WHERE id = 2;   -- locks row 2
UPDATE accounts SET balance = balance + 20 WHERE id = 1;   -- wants row 1

-- ERROR: deadlock detected (one transaction is rolled back)

-- prevention: lock rows in a global order (lowest id first)
SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;`},
steps:[
{hl:{T1:[2,3]}, th:[['T1','RUN:ok','holds row 1'],['T2','NEW:dim','']], d:{on:['T1','r1'], e:[['r1','T1','held by','ok']]}, g:[G('Locks',['row 1','X: T1','hot'],['row 2','free'])],
 say:`T1 transfers 10 from Asha to Ben. Its first UPDATE locks Asha's row (row 1) exclusively. So far so good.`},
{hl:{T2:[7,8]}, th:[['T1','RUN:ok','holds row 1'],['T2','RUN:ok','holds row 2']], d:{on:['T2','r2'], e:[['r1','T1','held by','ok'],['r2','T2','held by','ok']]}, g:[G('Locks',['row 1','X: T1'],['row 2','X: T2','hot'])],
 say:`At the same moment, T2 transfers 20 from Ben to Asha. Its first UPDATE locks Ben's row (row 2). Each transaction now holds one lock and needs the other's.`},
{hl:{T1:[4]}, th:[['T1','WAITING:warn','wants row 2'],['T2','RUN:ok','holds row 2']], d:{on:['T1'], e:[['r1','T1','held by','ok'],['r2','T2','held by','ok'],['T1','r2','waits for','bad']]}, g:[G('Locks',['row 1','X: T1'],['row 2','X: T2; T1 waiting','bad'])], log:['T1 waits for T2'],
 say:`T1 tries to credit Ben and must wait for T2's lock on row 2. Waiting is normal: T2 will commit eventually… unless T2 is waiting for T1.`},
{hl:{T2:[9]}, th:[['T1','WAITING:bad','wants row 2 (T2)'],['T2','WAITING:bad','wants row 1 (T1)']], d:{bad:['T1','T2'], e:[['r1','T1','held by','ok'],['r2','T2','held by','ok'],['T1','r2','waits for','bad'],['T2','r1','waits for','bad']]}, g:[G('Cycle',['T1 → waits for → T2','bad'],['T2 → waits for → T1','bad'],['neither can proceed','deadlock','bad'])], log:['T2 waits for T1 → cycle!'],
 say:`T2 now tries to credit Asha and waits for T1's lock on row 1. T1 waits for T2, T2 waits for T1: a cycle in the <b>wait-for graph</b>. Neither can ever proceed. This is a <b>deadlock</b>. The four conditions are all present: exclusive locks, hold-and-wait, no preemption, circular wait.`},
{hl:{q:[11]}, th:[['T1','TERM:ok','proceeds and commits'],['T2','TERM:bad','victim: rolled back']], d:{ok:['T1'], dim:['T2'], e:[['r1','T1','held by','ok'],['r2','T1','granted','ok']]}, g:[G('Detection',['deadlock detector','runs after deadlock_timeout (Postgres 1 s) / immediately (InnoDB)'],['finds cycle','picks a victim (e.g. least work done)','hot'],['victim','ERROR: deadlock detected, rolled back','bad'],['app must','retry the victim transaction','ok'])], log:['ERROR: deadlock detected (T2 rolled back)','T1 gets row 2, commits'],
 say:`Databases <b>detect</b> deadlocks by looking for cycles in the wait-for graph (Postgres checks after <code>deadlock_timeout</code>, 1 s by default; InnoDB checks immediately). One transaction is chosen as the <b>victim</b> and rolled back with a deadlock error, which releases its locks so the other can finish. The application must <b>retry</b> the victim.`},
{hl:{q:[13,14]}, th:[['T1','RUN:ok','locks 1 then 2'],['T2','WAITING:warn','locks 1 first: waits, no cycle']], d:{on:['T1'], e:[['r1','T1','held by','ok'],['T2','r1','waits (no cycle)','hot']]}, g:[G('Prevention',['consistent lock order','e.g. ascending id','ok'],['lock everything up front','SELECT … ORDER BY id FOR UPDATE','ok'],['keep transactions short','less overlap','ok'],['lock timeouts','fail fast instead of piling up'])], log:['T2 simply waits for T1, then proceeds'],
 say:`<b>Prevention</b>: make every transaction acquire locks in the <b>same global order</b>, e.g. lowest account id first, regardless of transfer direction. Then T2 asks for row 1 first, waits behind T1, and there's no cycle, just a short queue. Locking all needed rows up front with <code>ORDER BY id FOR UPDATE</code> does exactly that.`},
{hl:{}, th:[], d:null, g:[G('Checklist',['same lock order everywhere','ok'],['short transactions, no network calls inside','ok'],['indexes on FK/filter columns (fewer rows locked)','ok'],['retry on deadlock/serialization errors','ok'],['log & monitor deadlocks','log_lock_waits, SHOW ENGINE INNODB STATUS'])],
 say:`<b>Say it:</b> "A deadlock is a cycle of transactions each waiting for a lock another holds, typically from locking the same rows in different orders. The database detects the cycle in the wait-for graph and rolls back a victim, so the application must retry. I prevent them by acquiring locks in a consistent order, keeping transactions short, and indexing so statements lock fewer rows."`}
],
keep:[`Deadlock = cycle in the wait-for graph (T1 waits for T2 waits for T1).`,`Cause: same resources locked in different orders.`,`DB detects → rolls back a victim → app must retry.`,`Prevent: consistent lock order (ascending id), lock up front, short transactions, good indexes.`]}, {
  imp: 'must',
  theory: TH(`A deadlock happens when transactions wait for each other's locks in a cycle; the database detects it and aborts one, and the fix is to acquire locks in a consistent order.`,
`<p>Two people in a narrow corridor each step aside the same way and block each other forever. In a database: T1 holds lock A and wants B, T2 holds B and wants A. Neither will ever release, because each is waiting to finish.</p>
<p>Databases watch for this by tracking who waits for whom (the <b>wait-for graph</b>). A cycle means deadlock, and the only way out is to cancel one participant.</p>`,
[[`Deadlock`,`Circular wait between transactions.`],[`Wait-for graph`,`Edges from a waiting transaction to the lock holder.`],[`Victim`,`The transaction rolled back to break the cycle.`],[`deadlock_timeout`,`Postgres delay before running detection.`],[`Lock ordering`,`Acquiring locks in a globally agreed order.`],[`Lock timeout`,`Giving up after waiting too long.`]],
[`Each transaction acquires locks as it executes.`,`When a lock is unavailable, it waits; an edge appears in the wait-for graph.`,`The detector finds a cycle and aborts one transaction.`,`The application retries the aborted transaction.`],
[`Payment transfers, inventory updates and batch jobs touching overlapping rows.`,`ORMs flushing updates in different orders across code paths.`,`Retry wrappers around transactions (with backoff) for deadlock/serialization errors.`],
[`Updating rows in request order (A→B vs B→A).`,`Missing indexes making UPDATE/DELETE lock many rows.`,`No retry logic, so deadlocks become user-facing errors.`,`Confusing deadlocks with plain lock waits.`]),
  examples: [
    {lv:'basic', title:'Deadlock-free transfer: lock in id order', sql:`BEGIN;
-- transfer 10 from Ben (2) to Asha (1): touch the lower id first, whatever the direction
UPDATE accounts SET balance = balance + 10 WHERE id = 1;
UPDATE accounts SET balance = balance - 10 WHERE id = 2;
COMMIT;
SELECT id, balance FROM accounts WHERE id IN (1, 2) ORDER BY id;`, why:`Both directions of transfer lock row 1 before row 2, so two concurrent transfers queue instead of deadlocking.`},
    {lv:'mid', title:'Find the order to lock in', sql:`SELECT MIN(from_id, to_id) AS lock_first, MAX(from_id, to_id) AS lock_second, id AS transfer
FROM transfers
ORDER BY id;`, why:`For each transfer, the rows to lock in a consistent order (SQLite's scalar MIN/MAX; LEAST/GREATEST elsewhere).`},
    {lv:'adv', title:'Postgres: lock all rows up front in order (shown, not run)', sql:`BEGIN;
SELECT id FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE;
UPDATE accounts SET balance = balance - $3 WHERE id = $1;
UPDATE accounts SET balance = balance + $3 WHERE id = $2;
COMMIT;`, run:false, why:`ORDER BY id FOR UPDATE acquires both row locks in ascending order before any change, eliminating the circular wait.`},
  ],
  tips: {
    say:`"A deadlock is a cycle where each transaction waits for a lock the other holds, usually from touching the same rows in different orders. The database detects the cycle and rolls back a victim, so the application must retry. I prevent it by locking in a consistent order, for example ascending ids, keeping transactions short and indexing so fewer rows get locked."`,
    points:[`Draw the two-transaction timeline and the wait-for cycle.`,`Name detection + victim + retry.`,`Give lock ordering as the main prevention.`],
    traps:[`Saying deadlocks are a database bug.`,`Increasing timeouts to "fix" deadlocks.`],
    qa:[[`Deadlock vs lock wait?`,`A lock wait resolves when the holder finishes; a deadlock never resolves without aborting someone.`],
        [`How do you investigate deadlocks in production?`,`Postgres logs both queries with log_lock_waits/deadlock messages; MySQL SHOW ENGINE INNODB STATUS shows the latest deadlock. Find the conflicting access order and make it consistent.`],
        [`Can a single row cause a deadlock?`,`Yes, e.g. two transactions holding shared locks on the same row both try to upgrade to exclusive (lock upgrade deadlock).`]]
  },
  exercises: [
    {lv:'E', q:`For every transfer, return <code>id, first, second</code>: the two account ids in the order they should be locked (lower first).`, hint:`MIN(a, b) and MAX(a, b) as scalar functions in SQLite.`,
     sql:`SELECT id, MIN(from_id, to_id) AS first, MAX(from_id, to_id) AS second FROM transfers;`},
    {lv:'M', q:`Three transactions: T1 locks A then B; T2 locks B then C; T3 locks C then A, all interleaved after their first lock. Is there a deadlock? Draw the wait-for graph and give a fix.`, hint:`Follow the waits.`,
     answer:`<p>T1 waits for T2 (B), T2 waits for T3 (C), T3 waits for T1 (A): a 3-cycle, deadlock. Fix: global order A &lt; B &lt; C, so T3 must lock A before C; then T3 waits for T1 without holding C, and the cycle can't form.</p>`},
    {lv:'H', q:`Process all transfers in a deadlock-safe way within one transaction: apply them to account balances (debit from_id, credit to_id), then return all balances <code>id, balance</code> ordered by id. (Single session here, but write it as you would with ordered locking: one UPDATE that touches rows in id order.)`, hint:`Aggregate net change per account and apply with one UPDATE.`, ordered:true,
     sql:`BEGIN;
UPDATE accounts SET balance = balance
  + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_id = accounts.id), 0)
  - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_id = accounts.id), 0);
COMMIT;
SELECT id, balance FROM accounts ORDER BY id;`},
  ],
  quiz: [
    [`A deadlock is…`,[`A slow query`,`A cycle of transactions each waiting for a lock another holds`,`A crashed transaction`,`A full disk`],1,`Circular wait.`,'E'],
    [`Most common cause of deadlocks in apps?`,[`Too many indexes`,`Locking the same rows in different orders`,`Using SELECT`,`Large tables`],1,`A→B vs B→A.`,'E'],
    [`How does the database resolve a deadlock?`,[`Waits forever`,`Rolls back one victim transaction`,`Commits both`,`Restarts the server`],1,`App must retry.`,'E'],
    [`Best prevention technique?`,[`Bigger timeouts`,`Acquire locks in a consistent global order`,`SERIALIZABLE everywhere`,`Disable locking`],1,`Breaks circular wait.`,'M'],
    [`Postgres runs deadlock detection…`,[`Before every lock`,`After waiting deadlock_timeout (default 1 s)`,`Never`,`Only at COMMIT`],1,`Detection is expensive, so it's delayed.`,'H'],
    [`Missing indexes can increase deadlocks because…`,[`They don't`,`UPDATE/DELETE scan and lock more rows than needed`,`Indexes hold locks`,`Statistics go stale`],1,`Smaller lock footprint with good indexes.`,'M'],
  ],
  quizAdv: [
    [`Two transactions hold S locks on the same row and both request X. Result?`,[`Both proceed`,`Lock-upgrade deadlock`,`Dirty read`,`One gets X immediately`],1,`Use FOR UPDATE from the start.`,'H'],
    [`The four Coffman conditions for deadlock are…`,[`Atomicity, consistency, isolation, durability`,`Mutual exclusion, hold and wait, no preemption, circular wait`,`Read, write, commit, abort`,`Grow, shrink, wait, die`],1,`Break any one to prevent deadlock.`,'H'],
    [`Wait-die and wound-wait schemes prevent deadlock by…`,[`Detecting cycles`,`Using transaction timestamps to decide who waits and who aborts, so cycles can't form`,`Locking tables`,`Disabling 2PL`],1,`Prevention instead of detection.`,'H'],
  ],
});
