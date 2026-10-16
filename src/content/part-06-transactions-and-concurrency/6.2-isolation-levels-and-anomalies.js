/* 6.2 Isolation levels and read anomalies */
topic('6', { no:'6.2', title:'Isolation levels: dirty reads, non-repeatable reads, phantoms, lost updates', db:'bank',
idea:`Three transactions interleave on one accounts table. Step through each anomaly as it appears, see which isolation level prevents it, and learn what PostgreSQL and MySQL actually do at each level (and their defaults).`,
actors:'Transactions', tbTitle:'What T1 sees', stateTitle:'Per isolation level',
codes:{a:`-- account 1 (Asha): balance 100, branch PUNE (3 PUNE accounts)
T1: BEGIN;
T1: SELECT balance FROM accounts WHERE id = 1;                -- read A
T2: BEGIN; UPDATE accounts SET balance = 50 WHERE id = 1;
T1: SELECT balance FROM accounts WHERE id = 1;                -- read B (T2 uncommitted)
T2: COMMIT;
T1: SELECT balance FROM accounts WHERE id = 1;                -- read C (T2 committed)
T3: INSERT INTO accounts VALUES (9, 'Ivy', 'PUNE', 70); COMMIT;
T1: SELECT count(*) FROM accounts WHERE branch = 'PUNE';      -- read D
T1: COMMIT;

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;   -- per transaction`},
steps:[
{hl:{T1:[2,3]}, th:[['T1','RUN:ok','report: reads several times'],['T2','NEW:dim','updates Asha'],['T3','NEW:dim','opens an account']], tb:[TB('read A',['level','balance'],[['every level',100]])], g:[G('Isolation levels (weakest → strongest)',['READ UNCOMMITTED',''],['READ COMMITTED',''],['REPEATABLE READ',''],['SERIALIZABLE','as if transactions ran one at a time','hot'])],
 say:`Perfect isolation (<b>serializable</b>: the result equals some one-at-a-time order) costs concurrency, so SQL defines four <b>isolation levels</b>, each allowing fewer <b>anomalies</b>. T1 is a report that reads the same data several times. First read: 100 at every level.`},
{hl:{T2:[4],T1:[5]}, th:[['T1','RUN:ok',''],['T2','RUN:warn','updated, NOT committed'],['T3','NEW:dim','']], tb:[TB('read B',['level','balance'],[['READ UNCOMMITTED','50 → dirty read'],['READ COMMITTED','100'],['REPEATABLE READ','100'],['SERIALIZABLE','100']],{0:'bad',1:'ok',2:'ok',3:'ok'})], log:['dirty read possible only at READ UNCOMMITTED'],
 say:`<b>Dirty read</b>: T2 changed the balance to 50 but hasn't committed. At READ UNCOMMITTED T1 can see 50. If T2 then rolls back, T1 acted on a value that never existed. Every other level prevents this. PostgreSQL doesn't even implement READ UNCOMMITTED: it silently runs READ COMMITTED.`},
{hl:{T2:[6],T1:[7]}, th:[['T1','RUN:ok',''],['T2','TERM:ok','committed'],['T3','NEW:dim','']], tb:[TB('read C',['level','balance'],[['READ COMMITTED','50 → non-repeatable read'],['REPEATABLE READ','100 (snapshot)'],['SERIALIZABLE','100']],{0:'bad',1:'ok',2:'ok'})], log:['same query, same transaction, different answer at READ COMMITTED'],
 say:`T2 commits. At <b>READ COMMITTED</b>, each <i>statement</i> sees the latest committed data, so T1's third read returns 50: the same query in the same transaction changed its answer, a <b>non-repeatable read</b>. At <b>REPEATABLE READ</b> T1 keeps reading the snapshot taken at its first read, so it still sees 100.`},
{hl:{T3:[8],T1:[9]}, th:[['T1','RUN:ok',''],['T2','TERM:ok',''],['T3','TERM:ok','inserted + committed']], tb:[TB('read D: PUNE count',['level','count'],[['READ COMMITTED','4 → phantom'],['REPEATABLE READ (SQL standard)','may be 4'],['REPEATABLE READ (Postgres, InnoDB plain SELECT)','3 (snapshot)'],['SERIALIZABLE','3']],{0:'bad',1:'hot',2:'ok',3:'ok'})], log:['phantom: a new row appears in a repeated range query'],
 say:`A <b>phantom</b> is a row that appears (or disappears) when a <i>range</i> query is repeated, because another transaction inserted it. The SQL standard allows phantoms at REPEATABLE READ, but snapshot-based implementations (PostgreSQL, InnoDB consistent reads) don't show them to plain SELECTs. SERIALIZABLE forbids them everywhere.`},
{hl:{}, th:[['T1','RUN:ok','read 100, will write 100 − 10'],['T2','RUN:ok','read 100, will write 100 − 20']], tb:[TB('lost update',['step','balance'],[['T1 reads',100],['T2 reads',100],['T1 writes 90 & commits',90],['T2 writes 80 & commits',80]],{3:'bad'})], g:[G('Lost update (read-modify-write)',['READ COMMITTED','happens','bad'],['REPEATABLE READ (Postgres)','T2 aborts: "could not serialize"','ok'],['REPEATABLE READ (MySQL)','happens! (writes use latest data)','bad'],['fix anywhere','UPDATE … SET balance = balance - 20, FOR UPDATE, or version column (6.6)','ok'])],
 say:`The anomaly that bites real apps most: the <b>lost update</b>. Both read 100 in the app, both write back their own result; T1's withdrawal vanishes. Postgres REPEATABLE READ detects it and aborts T2, but MySQL REPEATABLE READ does <i>not</i>, and READ COMMITTED never does. Fix it with an atomic <code>UPDATE … SET balance = balance - 20</code>, a row lock (<code>SELECT … FOR UPDATE</code>) or optimistic locking (6.6).`},
{hl:{q:[12]}, th:[], tb:[TB('anomalies by level (SQL standard)',['level','dirty','non-repeatable','phantom'],[['READ UNCOMMITTED','yes','yes','yes'],['READ COMMITTED','no','yes','yes'],['REPEATABLE READ','no','no','yes'],['SERIALIZABLE','no','no','no']])], g:[G('Defaults',['PostgreSQL, Oracle, SQL Server','READ COMMITTED'],['MySQL InnoDB','REPEATABLE READ','hot']), G('Higher levels cost',['serialization failures','app must retry','bad'],['more locking or aborts','less throughput'])],
 say:`<b>Say it:</b> "Isolation levels trade anomalies for concurrency. READ COMMITTED prevents dirty reads; REPEATABLE READ also gives a stable snapshot so re-reads don't change; SERIALIZABLE behaves as if transactions ran one at a time. PostgreSQL defaults to READ COMMITTED, MySQL to REPEATABLE READ. Higher levels may abort transactions with serialization errors, so the app must retry. Most apps stay at READ COMMITTED and protect read-modify-write with atomic updates, row locks or version checks."`}
],
keep:[`Dirty read (uncommitted data) · non-repeatable read (row changes) · phantom (new rows in a range) · lost update.`,`RU < RC (Postgres/Oracle/SQL Server default) < RR (MySQL default) < SERIALIZABLE.`,`Snapshot RR (Postgres/InnoDB) hides phantoms from plain reads; MySQL RR still allows lost updates.`,`Higher levels → serialization failures → retry. Protect read-modify-write explicitly.`]}, {
  imp: 'must',
  theory: TH(`The isolation level decides how much concurrent transactions can see of each other's changes; weaker levels allow specific anomalies in exchange for more concurrency.`,
`<p>Imagine several accountants working on the same ledger at once. Fully isolating them (one at a time) is safe but slow. Isolation levels let them work in parallel while ruling out certain kinds of confusion: reading numbers someone is still writing (dirty read), seeing a number change while you work (non-repeatable read), or new entries appearing in your list (phantom).</p>
<p>Modern databases implement most levels with <b>snapshots</b> (MVCC, 6.5): READ COMMITTED takes a fresh snapshot per statement; REPEATABLE READ keeps one snapshot for the whole transaction.</p>`,
[[`Dirty read`,`Reading another transaction's uncommitted change.`],[`Non-repeatable read`,`Re-reading a row gives a different value.`],[`Phantom read`,`Re-running a range query returns different rows.`],[`Lost update`,`Two read-modify-write cycles; one overwrites the other.`],[`Write skew`,`Two transactions read overlapping data and write different rows, breaking an invariant (6.7).`],[`Snapshot`,`A consistent view of committed data as of a point in time.`],[`Serialization failure`,`Abort raised to preserve a high isolation guarantee.`]],
[`BEGIN starts the transaction at the session's level (or SET TRANSACTION …).`,`Reads see data according to the level's snapshot rules.`,`Writes lock rows; conflicting writers wait.`,`At RR/SERIALIZABLE the DB may abort a transaction that would violate the guarantee; the app retries.`],
[`Keep the default (often READ COMMITTED) and protect hot read-modify-write paths explicitly.`,`Use REPEATABLE READ for consistent multi-query reports.`,`Use SERIALIZABLE for complex invariants, with a retry loop.`],
[`Assuming @Transactional prevents lost updates.`,`Not knowing your database's default level or its implementation quirks.`,`Using SERIALIZABLE without retry logic.`]),
  examples: [
    {lv:'basic', title:'Atomic update: immune to lost updates at any level', sql:`UPDATE accounts SET balance = balance - 10 WHERE id = 1;
UPDATE accounts SET balance = balance - 20 WHERE id = 1;
SELECT id, balance FROM accounts WHERE id = 1;`, why:`Each UPDATE reads and writes the current value inside the database under a row lock; both withdrawals apply: 100 → 70.`},
    {lv:'mid', title:'Simulating the lost update in application code', sql:`-- both "requests" read the balance first
CREATE TEMP TABLE app AS SELECT balance AS t1_read, balance AS t2_read FROM accounts WHERE id = 1;
-- T1 writes its computed value, then T2 writes its own
UPDATE accounts SET balance = (SELECT t1_read - 10 FROM app) WHERE id = 1;
UPDATE accounts SET balance = (SELECT t2_read - 20 FROM app) WHERE id = 1;
SELECT id, balance FROM accounts WHERE id = 1;`, why:`Final balance 80, not 70: T1's withdrawal of 10 was overwritten. That's what happens when an app reads, computes and writes back a value under READ COMMITTED.`},
    {lv:'adv', title:'Guarded write: the version check makes the second write fail', sql:`-- both read (balance 100, version 1)
UPDATE accounts SET balance = 90, version = version + 1 WHERE id = 1 AND version = 1;  -- T1: 1 row
UPDATE accounts SET balance = 80, version = version + 1 WHERE id = 1 AND version = 1;  -- T2: 0 rows!
SELECT id, balance, version FROM accounts WHERE id = 1;`, why:`T2's UPDATE matches nothing because the version moved on; the app sees "0 rows updated", re-reads and retries. This is optimistic locking (6.6).`},
  ],
  tips: {
    say:`"Isolation levels trade anomalies for concurrency. READ COMMITTED prevents dirty reads, REPEATABLE READ prevents non-repeatable reads with a transaction-wide snapshot, SERIALIZABLE prevents everything including write skew. Postgres defaults to READ COMMITTED, MySQL to REPEATABLE READ. Higher levels can abort with serialization errors, so the app retries. For read-modify-write I use atomic updates, SELECT FOR UPDATE or version columns rather than relying on the level."`,
    points:[`Define each anomaly with a two-transaction timeline.`,`Know defaults and the Postgres/MySQL differences.`,`Bring up the lost update even if not asked.`],
    traps:[`Claiming REPEATABLE READ prevents lost updates in MySQL.`,`Saying higher isolation is free.`],
    qa:[[`Which level does your database use by default?`,`PostgreSQL, Oracle, SQL Server: READ COMMITTED. MySQL InnoDB: REPEATABLE READ.`],
        [`How does Postgres implement REPEATABLE READ?`,`Snapshot isolation: one snapshot at the first statement; updating a row changed by a concurrent committed transaction raises "could not serialize access due to concurrent update".`],
        [`Is READ COMMITTED enough for a bank transfer?`,`Yes if the transfer uses atomic UPDATE … SET balance = balance - x WHERE balance &gt;= x and checks affected rows; not if it reads balances into the app and writes computed values.`]]
  },
  exercises: [
    {lv:'E', q:`Withdraw 30 from Asha only if she has at least 30, atomically, then return <code>id, balance</code> for Asha.`, hint:`UPDATE … SET balance = balance - 30 WHERE id = 1 AND balance &gt;= 30.`,
     sql:`UPDATE accounts SET balance = balance - 30 WHERE id = 1 AND balance >= 30;
SELECT id, balance FROM accounts WHERE id = 1;`},
    {lv:'M', q:`Which anomaly is it? (a) A report sums balances twice in one transaction and gets different totals because a transfer committed in between. (b) A query shows a balance that later "never existed" because the writer rolled back. (c) A count of PUNE accounts goes from 3 to 4 within one transaction. (d) Two deposits; only one is reflected.`, hint:`Dirty, non-repeatable, phantom, lost update.`,
     answer:`(a) non-repeatable read (or a phantom, if rows were added) · (b) dirty read · (c) phantom · (d) lost update.`},
    {lv:'H', q:`Implement a safe "withdraw 80 from Diya (id 4)" that must fail when funds are insufficient, and record a transfer only if the withdrawal succeeded. Diya has 0. Return the count of transfers (should remain 5) as <code>n</code>.`, hint:`Guarded UPDATE, then INSERT … SELECT … WHERE changes() = 1 (SQLite) / check affected rows in the app.`,
     sql:`UPDATE accounts SET balance = balance - 80 WHERE id = 4 AND balance >= 80;
INSERT INTO transfers SELECT 6, 4, 1, 80, '2024-03-06 09:00' WHERE changes() = 1;
SELECT COUNT(*) AS n FROM transfers;`},
  ],
  quiz: [
    [`A dirty read is…`,[`Reading a row deleted and committed`,`Reading another transaction's uncommitted change`,`Reading the same row twice and getting different values`,`Reading from a stale replica`],1,`Only READ UNCOMMITTED allows it.`,'E'],
    [`Under READ COMMITTED, T1 reads, T2 updates and commits, T1 reads again. T1 sees…`,[`The old value`,`The new value (non-repeatable read)`,`An error`,`It blocks until T1 commits`],1,`Fresh snapshot per statement.`,'M'],
    [`PostgreSQL's default isolation level?`,[`READ UNCOMMITTED`,`READ COMMITTED`,`REPEATABLE READ`,`SERIALIZABLE`],1,`MySQL InnoDB: REPEATABLE READ.`,'E'],
    [`A phantom read is…`,[`A NULL value appearing`,`New rows appearing when a range query is repeated`,`A deleted table`,`A dirty write`],1,`Range-level anomaly.`,'E'],
    [`Higher isolation levels typically cost…`,[`Nothing`,`More blocking or aborted transactions that must be retried`,`More disk space only`,`Lower durability`],1,`Concurrency trade-off.`,'M'],
    [`Two transactions read 100 and each write 100 − x. Name?`,[`Phantom`,`Lost update`,`Dirty read`,`Deadlock`],1,`Read-modify-write race.`,'E'],
  ],
  quizAdv: [
    [`MySQL InnoDB REPEATABLE READ and the lost update (read in app, write back):`,[`Prevented with an error`,`Not prevented: UPDATE uses the latest committed row, so the second write overwrites`,`Prevented by gap locks`,`Impossible in InnoDB`],1,`Postgres RR aborts instead.`,'H'],
    [`Postgres REPEATABLE READ: T2 updates a row that T1 (concurrent, committed) already changed. T2…`,[`Overwrites silently`,`Fails with "could not serialize access due to concurrent update"`,`Deadlocks`,`Waits forever`],1,`Snapshot isolation first-updater-wins.`,'H'],
    [`Which anomaly can snapshot isolation (Postgres RR) still allow?`,[`Dirty read`,`Non-repeatable read`,`Write skew`,`Lost update`],2,`Needs SERIALIZABLE (6.7).`,'H'],
  ],
});
