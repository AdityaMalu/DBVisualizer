/* 6.5 MVCC: multi-version concurrency control */
topic('6', { no:'6.5', title:'MVCC: row versions, snapshots, and VACUUM', db:'bank',
idea:`How PostgreSQL lets readers and writers run without blocking each other. Watch an UPDATE create a new row version stamped with transaction ids, two snapshots see different versions of the same row, and VACUUM clean up dead versions nobody can see any more.`,
actors:'Transactions', tbTitle:'Physical row versions (accounts, id 1)', stateTitle:'Snapshot',
codes:{a:`-- every row version carries:  xmin = txid that created it
--                              xmax = txid that deleted/updated it (or empty)

T100: INSERT INTO accounts VALUES (1, 'Asha', 'PUNE', 100);   COMMIT;
T200: BEGIN;  SELECT balance FROM accounts WHERE id = 1;      -- snapshot S200
T201: BEGIN;  UPDATE accounts SET balance = 70 WHERE id = 1;  -- new version
T200:         SELECT balance FROM accounts WHERE id = 1;      -- still 100
T201: COMMIT;
T202: BEGIN;  SELECT balance FROM accounts WHERE id = 1;      -- 70
-- later, when no snapshot needs the old version:
VACUUM accounts;                                              -- reclaim dead versions`},
steps:[
{hl:{q:[4]}, th:[['T100','TERM:ok','inserted, committed']], tb:[TB('versions',['xmin','xmax','balance','status'],[[100,'',100,'live']],{0:'new'})], g:[G('Version metadata',['xmin','creating transaction id','hot'],['xmax','deleting/updating transaction id (empty = current)'],['visible to a snapshot if','xmin committed before it AND xmax not'])],
 say:`In <b>MVCC</b> (multi-version concurrency control) the database keeps <b>multiple versions</b> of a row. In PostgreSQL each version is stamped with <code>xmin</code>, the id of the transaction that created it, and <code>xmax</code>, the id of the transaction that deleted or replaced it. T100 inserted Asha's row and committed.`},
{hl:{q:[5]}, th:[['T100','TERM:dim',''],['T200','RUN:ok','snapshot S200']], tb:[TB('versions',['xmin','xmax','balance','visible to S200'],[[100,'',100,'yes']],{0:'ok'})], g:[G('Snapshot S200',['records','which transactions had committed when it was taken','hot'],['sees','versions whose xmin committed before it'],['RC vs RR','new snapshot per statement vs per transaction'])],
 say:`T200 starts a report and takes a <b>snapshot</b>: essentially a list of which transaction ids had committed at that instant. A version is visible to the snapshot if its creator committed before the snapshot and its deleter didn't. T200 sees balance 100.`},
{hl:{q:[6]}, th:[['T200','RUN:ok','reading'],['T201','RUN:warn','updating (not committed)']], tb:[TB('versions',['xmin','xmax','balance','status'],[[100,201,100,'old (being replaced)'],[201,'',70,'new, uncommitted']],{0:'hot',1:'new'})], g:[G('UPDATE = new version',['old version','xmax = 201'],['new version','xmin = 201, balance 70','hot'],['no overwrite','old version still on the page'],['writer locks','the row (other writers wait), not readers'])],
 say:`T201 updates the balance. It does <b>not</b> overwrite the row: it marks the old version with <code>xmax = 201</code> and writes a <b>new version</b> with <code>xmin = 201</code>. Other <i>writers</i> of this row will wait for T201's row lock, but readers are not blocked.`},
{hl:{q:[7]}, th:[['T200','RUN:ok','reads 100'],['T201','RUN:warn','not committed']], tb:[TB('versions',['xmin','xmax','balance','visible to S200'],[[100,201,100,'yes (201 not committed)'],[201,'',70,'no']],{0:'ok',1:'dim'})], g:[G('Readers never block',['T200 reads','old version: 100','ok'],['T201 writes','in parallel','ok'],['"readers don\'t block writers,','writers don\'t block readers"','hot'])], log:['T200: 100 (no waiting)'],
 say:`T200 reads again. The new version's creator (201) hasn't committed, and the old version's deleter (201) hasn't committed either, so the old version is still the visible one: <b>100</b>, without waiting. This is MVCC's headline benefit: <b>readers don't block writers and writers don't block readers</b>.`},
{hl:{q:[8,9]}, th:[['T200','RUN:ok','RR: still 100 / RC: 70'],['T201','TERM:ok','committed'],['T202','RUN:ok','reads 70']], tb:[TB('versions',['xmin','xmax','balance','S200 (RR)','S202'],[[100,201,100,'visible','dead to it'],[201,'',70,'invisible','visible']],{0:'hot',1:'ok'})], g:[G('After T201 commits',['T202 (new snapshot)','sees 70','ok'],['T200 at REPEATABLE READ','keeps S200: still 100'],['T200 at READ COMMITTED','next statement takes a new snapshot: 70'])], log:['T202: 70'],
 say:`T201 commits. A new transaction T202 takes a fresh snapshot in which 201 is committed: it sees 70. T200's behaviour depends on its isolation level (6.2): at REPEATABLE READ it keeps its original snapshot and still sees 100; at READ COMMITTED its next statement takes a new snapshot and sees 70. Isolation levels are just snapshot policies.`},
{hl:{q:[10,11]}, th:[['T200','TERM:dim','finished'],['VACUUM','RUN:ok','cleanup']], tb:[TB('versions',['xmin','xmax','balance','status'],[[100,201,100,'dead → space reclaimed'],[201,'',70,'live']],{0:'dim',1:'ok'})], g:[G('VACUUM',['dead version','no running snapshot can see it'],['reclaims','space for reuse (not returned to the OS)','ok'],['autovacuum','runs automatically'],['blocked by','long-running transactions holding old snapshots','bad'],['bloat','tables/indexes grow if vacuum can\'t keep up','bad'])],
 say:`Once no running transaction can possibly see the old version, it's <b>dead</b>. <b>VACUUM</b> (usually autovacuum) reclaims that space for reuse and updates the visibility map (which enables index-only scans, 4.3). A transaction left open for hours holds an old snapshot and prevents cleanup everywhere, causing <b>bloat</b>.`},
{hl:{}, th:[], tb:[], g:[G('MVCC flavours',['PostgreSQL','old + new versions in the table (heap); VACUUM'],['InnoDB / Oracle','update in place, old versions in an undo log; purge thread'],['all','snapshots, non-blocking reads']), G('Costs',['space','old versions until cleanup'],['write amplification','new tuple + index entries (unless HOT)'],['txid wraparound (Postgres)','must freeze old rows: vacuum is mandatory'])],
 say:`<b>Say it:</b> "MVCC keeps multiple versions of each row, each tagged with the transaction that created and deleted it. Every transaction reads from a snapshot, so readers see a consistent committed state without locks and never block writers; writers create new versions and only block other writers of the same row. Old versions are cleaned up later by VACUUM in Postgres or purged from the undo log in InnoDB, so long-running transactions cause bloat."`}
],
keep:[`MVCC: UPDATE writes a new version; old one kept for older snapshots.`,`Postgres: xmin (creator) / xmax (deleter); visibility = committed before my snapshot.`,`Readers don't block writers; writers don't block readers. Writers still block writers (row locks).`,`RC = snapshot per statement; RR = snapshot per transaction.`,`VACUUM/purge removes dead versions; long transactions cause bloat.`]}, {
  imp: 'must',
  theory: TH(`MVCC lets each transaction read a consistent snapshot by keeping several versions of a row, so readers never wait for writers and writers never wait for readers.`,
`<p>Without MVCC, a reader would have to lock a row to make sure nobody changes it mid-read, and writers would have to wait for readers to finish. MVCC avoids that by never overwriting: a write creates a new version, and the old one stays around for anyone who started reading before the change.</p>
<p>It's like a shared document with version history: you keep reading the version that existed when you opened it, while someone else edits and saves a new version. When nobody is looking at the old version any more, it gets deleted.</p>`,
[[`Row version (tuple)`,`One physical copy of a row's data.`],[`xmin / xmax`,`Postgres: creating / deleting transaction ids.`],[`Snapshot`,`The set of transactions considered committed for a reader.`],[`Visibility rules`,`Decide which version a snapshot sees.`],[`Dead tuple`,`A version no snapshot can see.`],[`VACUUM / purge`,`Reclaiming dead versions.`],[`Undo log`,`InnoDB/Oracle storage for old versions.`],[`Bloat`,`Wasted space from dead versions not yet reclaimed.`]],
[`Each transaction gets an id; reads use a snapshot.`,`UPDATE/DELETE mark the old version and (for UPDATE) write a new one.`,`Readers pick the version visible to their snapshot.`,`Background cleanup removes versions no snapshot needs.`],
[`Reports run alongside heavy OLTP writes without blocking them.`,`Monitor autovacuum, dead tuples and table bloat in Postgres.`,`Kill idle-in-transaction sessions (idle_in_transaction_session_timeout).`],
[`Long-running or idle-in-transaction sessions blocking cleanup.`,`High-churn UPDATE patterns on wide rows (lots of new versions).`,`Disabling autovacuum.`,`Assuming MVCC prevents write conflicts (writers still lock).`]),
  examples: [
    {lv:'basic', title:'Snapshot reads inside a transaction (single session)', sql:`BEGIN;
SELECT balance AS before FROM accounts WHERE id = 1;
UPDATE accounts SET balance = 70 WHERE id = 1;
SELECT balance AS inside FROM accounts WHERE id = 1;   -- your own change is visible to you
ROLLBACK;
SELECT balance AS after_rollback FROM accounts WHERE id = 1;`, why:`A transaction sees its own uncommitted version; after ROLLBACK the new version is discarded and 100 remains. Other sessions would have seen 100 the whole time.`},
    {lv:'mid', title:'Modelling versions with xmin/xmax', sql:`CREATE TABLE versions (id INTEGER, balance REAL, xmin INTEGER, xmax INTEGER);
INSERT INTO versions VALUES (1, 100, 100, 201), (1, 70, 201, NULL);
-- which version does a snapshot see, given the set of committed txids?
WITH committed(tx) AS (VALUES (100))            -- snapshot taken before 201 committed
SELECT balance FROM versions
WHERE xmin IN (SELECT tx FROM committed)
  AND (xmax IS NULL OR xmax NOT IN (SELECT tx FROM committed));`, why:`With only 100 committed, the snapshot sees 100. Change the CTE to <code>VALUES (100), (201)</code> and it sees 70: the core of the visibility rule.`},
    {lv:'adv', title:'Postgres: watch versions and dead tuples (shown, not run)', sql:`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1;
UPDATE accounts SET balance = balance + 1 WHERE id = 1;
SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1;   -- new xmin and ctid

SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables WHERE relname = 'accounts';`, run:false, why:`The system columns show a new version after each update (new ctid, new xmin). pg_stat_user_tables shows how many dead tuples are waiting for vacuum.`},
  ],
  tips: {
    say:`"MVCC keeps multiple versions of each row tagged with the creating and deleting transaction, and each transaction reads from a snapshot of committed data. So readers never block writers and writers never block readers; only concurrent writers to the same row conflict. Postgres stores old versions in the table and cleans them with VACUUM; InnoDB keeps them in undo logs. Long-running transactions prevent cleanup and cause bloat."`,
    points:[`Walk through an UPDATE creating a new version and a concurrent reader still seeing the old one.`,`Tie isolation levels to snapshot timing.`,`Mention VACUUM/bloat and long transactions as the operational cost.`],
    traps:[`Saying MVCC means no locks at all.`,`Not knowing the Postgres vs InnoDB storage difference for old versions.`],
    qa:[[`Why do long-running transactions hurt Postgres?`,`Their snapshot may still need old versions, so VACUUM can't remove any dead tuple newer than it, across all tables: bloat, slower scans, and in extreme cases transaction-id wraparound pressure.`],
        [`Does an UPDATE in Postgres modify the row in place?`,`No: it writes a new tuple version (possibly on the same page as a HOT update) and marks the old one with xmax.`],
        [`How do MVCC and isolation levels relate?`,`Isolation levels define when snapshots are taken: per statement (READ COMMITTED) or per transaction (REPEATABLE READ), plus extra checks for SERIALIZABLE.`]]
  },
  exercises: [
    {lv:'E', q:`In a transaction, set Eli's (id 5) balance to 0, read it back, then roll back and return the final balance as <code>balance</code>.`, hint:`BEGIN; UPDATE; SELECT; ROLLBACK; SELECT.`,
     sql:`BEGIN;
UPDATE accounts SET balance = 0 WHERE id = 5;
SELECT balance FROM accounts WHERE id = 5;
ROLLBACK;
SELECT balance FROM accounts WHERE id = 5;`},
    {lv:'M', q:`Using the versions model from example 2, which balance does a snapshot see when transactions 100 and 201 have committed? Return <code>balance</code>.`, hint:`committed(tx) AS (VALUES (100), (201)).`,
     sql:`CREATE TABLE versions (id INTEGER, balance REAL, xmin INTEGER, xmax INTEGER);
INSERT INTO versions VALUES (1, 100, 100, 201), (1, 70, 201, NULL);
WITH committed(tx) AS (VALUES (100), (201))
SELECT balance FROM versions
WHERE xmin IN (SELECT tx FROM committed)
  AND (xmax IS NULL OR xmax NOT IN (SELECT tx FROM committed));`},
    {lv:'H', q:`A Postgres table updated 2,000 times per second doubles in size every week despite constant row count; queries slow down. List likely causes and fixes.`, hint:`Dead tuples, vacuum, long transactions.`,
     answer:`<ul><li>Autovacuum can't keep up: tune per-table autovacuum_vacuum_scale_factor/cost limits so it runs more often and faster.</li><li>Long-running or idle-in-transaction sessions (or a stale replication slot / hot_standby_feedback) hold back the xmin horizon: find them in pg_stat_activity and kill/timeout.</li><li>Non-HOT updates: indexed columns change, or pages are full; consider a lower fillfactor so updates stay on the same page, and drop unused indexes.</li><li>To shrink existing bloat: pg_repack (online) or VACUUM FULL (locks the table).</li></ul>`},
  ],
  quiz: [
    [`In MVCC, an UPDATE…`,[`Overwrites the row in place, locking readers`,`Creates a new row version; old versions remain for older snapshots`,`Deletes the table`,`Waits for all readers`],1,`Versions, not overwrites.`,'E'],
    [`MVCC's main benefit?`,[`Smaller tables`,`Readers don't block writers and writers don't block readers`,`No need for indexes`,`No transactions needed`],1,`Writers still block writers.`,'E'],
    [`In Postgres, xmin is…`,[`The minimum value in a column`,`The id of the transaction that created the row version`,`The oldest snapshot`,`An index`],1,`xmax = deleter.`,'M'],
    [`What does VACUUM do?`,[`Deletes live rows`,`Reclaims space from dead row versions`,`Rebuilds the database`,`Compresses the WAL`],1,`Autovacuum runs it.`,'E'],
    [`A session idle in transaction for 6 hours causes…`,[`Nothing`,`VACUUM can't remove dead versions newer than its snapshot → bloat`,`Deadlocks only`,`Faster queries`],1,`Set idle_in_transaction_session_timeout.`,'M'],
    [`Do two transactions updating the same row block each other under MVCC?`,[`No, never`,`Yes: the second waits for the first's row lock`,`Only in READ UNCOMMITTED`,`Only with indexes`],1,`MVCC is about readers.`,'M'],
  ],
  quizAdv: [
    [`InnoDB stores old row versions…`,[`In the table heap like Postgres`,`In undo logs, reconstructing old versions on demand`,`In the binlog`,`Nowhere`],1,`Purge threads clean them.`,'H'],
    [`Postgres transaction id wraparound is prevented by…`,[`Restarting`,`VACUUM freezing old tuples`,`Indexes`,`Replication`],1,`Anti-wraparound autovacuum is mandatory.`,'H'],
    [`A HOT (heap-only tuple) update requires…`,[`A primary key change`,`No indexed column changes and room on the same page`,`SERIALIZABLE`,`An empty table`],1,`Avoids new index entries.`,'H'],
  ],
});
