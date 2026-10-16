/* 7.1 Write-ahead logging, checkpoints and crash recovery */
topic('7', { no:'7.1', title:'Write-ahead log (WAL), checkpoints and crash recovery', db:'bank',
idea:`Why COMMIT can be fast and still survive a power cut. Follow a transaction's changes into the in-memory page and the write-ahead log, see COMMIT flush only the log, then pull the plug and watch recovery replay (redo) committed work and discard (undo) uncommitted work from the last checkpoint.`,
dgTitle:'Where the change lives', stateTitle:'Log / recovery', tbTitle:'WAL records',
nodes:{
  tx:{x:60,y:40,label:'transaction',w:110,kind:'actor'},
  bp:{x:240,y:40,label:'buffer pool page\n(dirty, in RAM)',w:160,h:46,kind:'mem'},
  wal:{x:240,y:150,label:'WAL file\n(append-only, fsync)',w:170,h:50,kind:'db'},
  data:{x:440,y:40,label:'data file\n(on disk)',w:120,h:46,kind:'db'}
},
edges:[['tx','bp'],['tx','wal'],['bp','data']],
vb:'0 0 520 200',
codes:{a:`BEGIN;                                         -- T7
UPDATE accounts SET balance = 50 WHERE id = 1;  -- WAL: <T7, page 3, before 100, after 50>
UPDATE accounts SET balance = 300 WHERE id = 2; -- WAL: <T7, page 3, before 250, after 300>
COMMIT;                                         -- WAL: <T7 COMMIT> → fsync → "OK"

-- rule: the log record reaches disk BEFORE the data page it describes
-- data pages are written later (background writer / checkpoint)

CHECKPOINT;   -- flush all dirty pages; note the WAL position (redo start point)

-- crash! on restart:
--   REDO: replay WAL from the last checkpoint (committed AND uncommitted changes)
--   UNDO: roll back transactions that never logged COMMIT`},
steps:[
{hl:{q:[1,2]}, d:{on:['tx','bp','wal'], e:[['tx','bp','modify page','hot'],['tx','wal','append record','hot']]}, tb:[TB('WAL',['LSN','record'],[[101,'T7 page 3: balance 100 → 50']],{0:'new'})], g:[G('Write-ahead logging',['change page','in the buffer pool (RAM) only'],['log record','appended to the WAL buffer','hot'],['LSN','log sequence number, stamped on the page too'])],
 say:`The UPDATE changes Asha's balance in the page <b>in memory</b> (the buffer pool) and appends a <b>log record</b> describing the change (before and after values, or enough to redo/undo it) to the <b>write-ahead log</b>. Each record gets a log sequence number (LSN). The data file on disk isn't touched yet.`},
{hl:{q:[3,4]}, d:{on:['wal'], e:[['tx','wal','COMMIT → fsync','ok']]}, tb:[TB('WAL',['LSN','record'],[[101,'T7 page 3: 100 → 50'],[102,'T7 page 3: 250 → 300'],[103,'T7 COMMIT']],{2:'ok'})], g:[G('COMMIT',['writes','a COMMIT record'],['fsync','WAL to stable storage','hot'],['then','acknowledge the client','ok'],['data pages','still only in RAM!'])], log:['fsync(WAL) → client sees COMMIT OK'],
 say:`At <b>COMMIT</b> the database writes a commit record and <b>fsyncs the WAL</b> to stable storage, then tells the client "OK". That's the durability guarantee. The changed data pages are <i>still only in memory</i>. Why is this fast? The WAL is a sequential append; writing scattered data pages would be random I/O. Group commit batches many transactions' fsyncs into one.`},
{hl:{q:[6,7]}, d:{on:['bp','data'], e:[['bp','data','later: background writer','hot']]}, g:[G('The WAL rule',['log record on disk','before the data page it describes','hot'],['data pages','written lazily (background writer, checkpoints)'],['benefit','random writes deferred and batched','ok'],['also','WAL = replication stream and PITR source (7.2, 8.1)'])],
 say:`The one rule that makes it all work: <b>a page's log records must be on disk before the page itself is written</b> (write-ahead). Data pages are written lazily by a background writer and at checkpoints. The same WAL stream feeds replicas and point-in-time recovery.`},
{hl:{q:[9]}, d:{on:['data','bp'], e:[['bp','data','flush all dirty pages','ok']]}, g:[G('Checkpoint',['flush','all dirty pages to the data files','hot'],['record','checkpoint LSN = where redo will start'],['bounds','recovery time (less WAL to replay)','ok'],['cost','I/O spikes; tune frequency/spreading'])], log:['CHECKPOINT at LSN 103'],
 say:`A <b>checkpoint</b> flushes all dirty pages and records the LSN: everything before it is safely in the data files. Recovery only needs to replay WAL from the last checkpoint, so checkpoints bound <b>recovery time</b>. Frequent checkpoints mean faster recovery but more I/O; databases spread checkpoint writes out to avoid spikes.`},
{hl:{q:[11,12]}, d:{bad:['bp'], on:['wal'], e:[['wal','data','REDO from checkpoint','hot']]}, tb:[TB('WAL after checkpoint',['LSN','record'],[[104,'T8 page 5: 75 → 0'],[105,'T9 page 3: 50 → 40'],[106,'T9 COMMIT']],{0:'bad',1:'ok',2:'ok'})], g:[G('Crash → REDO',['RAM','lost (all dirty pages gone)','bad'],['replay','every record after the checkpoint','hot'],['idempotent','skip if page LSN ≥ record LSN'],['result','database as it was at the crash, incl. uncommitted T8'])], log:['crash!','redo LSN 104..106'],
 say:`Power cut. Everything in RAM is gone. On restart, recovery reads the WAL from the last checkpoint and <b>redoes</b> every change (redo is idempotent: a page whose LSN shows it already has the change is skipped). This "repeats history", bringing the data to exactly the state at the crash, including T8's change, which never committed.`},
{hl:{q:[13]}, d:{ok:['data']}, tb:[TB('after recovery',['transaction','outcome'],[['T7','committed before checkpoint → in data files'],['T9','COMMIT in WAL → redone, kept'],['T8','no COMMIT → undone']],{0:'ok',1:'ok',2:'bad'})], g:[G('UNDO',['transactions without a COMMIT record','rolled back','hot'],['ARIES','analysis → redo → undo (compensation log records)'],['Postgres','no undo phase: MVCC marks T8 aborted, its versions invisible'])], log:['undo T8 → database consistent'],
 say:`Then <b>undo</b>: transactions with no COMMIT record (T8) are rolled back, using the before-images in the log. This is the classic <b>ARIES</b> algorithm (analysis, redo, undo) used by DB2, SQL Server and InnoDB. PostgreSQL skips the undo phase: thanks to MVCC, T8's row versions are simply marked aborted and stay invisible until vacuum.`},
{hl:{}, d:{}, tb:[], g:[G('WAL gives you',['durability','fsync log at commit'],['atomicity','undo/abort uncommitted work'],['fast commits','sequential log writes, lazy page writes','ok'],['replication & PITR','ship/replay the log'])],
 say:`<b>Say it:</b> "With write-ahead logging, every change is first recorded in an append-only log, and the log is flushed to disk at commit before acknowledging, while data pages are written lazily. After a crash, recovery replays the log from the last checkpoint to redo all changes and undoes transactions that never committed. That gives durability and atomicity with fast sequential commits, and the same log drives replication and point-in-time recovery."`}
],
keep:[`WAL rule: log record on disk before the data page; fsync the log at COMMIT.`,`Commit is fast: sequential log append; data pages written later.`,`Checkpoint: flush dirty pages, record redo start point → bounds recovery time.`,`Recovery: redo from checkpoint (repeat history), undo uncommitted (ARIES). Postgres: MVCC instead of undo.`,`WAL also powers replication and PITR.`]}, {
  imp: 'good',
  theory: TH(`A database records every change in an append-only write-ahead log and forces that log to disk at commit, so after a crash it can redo committed work and undo unfinished work.`,
`<p>Writing every changed page to its place on disk at every commit would be slow (random writes everywhere). Instead, the database keeps changed pages in memory and writes a compact description of each change to a log file, which only ever grows at the end: fast sequential writes.</p>
<p>It's like a shop that updates its shelves whenever convenient but writes every sale in a receipt book immediately. If the shop burns down overnight, the receipt book (kept in a safe) is enough to reconstruct the day's sales.</p>`,
[[`WAL / redo log`,`Append-only log of changes.`],[`LSN`,`Log sequence number: position in the log.`],[`fsync`,`Force data to stable storage.`],[`Dirty page`,`Modified in memory, not yet written to disk.`],[`Checkpoint`,`Flush dirty pages; recovery starts here.`],[`Redo`,`Re-apply logged changes.`],[`Undo`,`Reverse changes of uncommitted transactions.`],[`ARIES`,`Classic recovery algorithm: analysis, redo, undo.`],[`Group commit`,`One fsync for several transactions' commits.`]],
[`Each change appends a log record and dirties a page in memory.`,`COMMIT appends a commit record and fsyncs the log.`,`Background writers and checkpoints flush pages later.`,`After a crash: redo from the last checkpoint, then undo uncommitted transactions.`],
[`Tuning checkpoint frequency, WAL size and synchronous_commit.`,`WAL archiving for backups (7.2) and streaming to replicas (8.1).`,`Disks/cloud volumes with honest fsync (no lying write caches).`],
[`Disabling fsync for speed in production (corruption risk on crash).`,`Under-provisioned WAL disks causing commit latency.`,`Checkpoints too frequent (I/O storms) or too rare (long recovery).`]),
  examples: [
    {lv:'basic', title:'SQLite journal mode', sql:`SELECT * FROM pragma_journal_mode();`, why:`SQLite reports <code>delete</code>: its default rollback journal, an undo log of original pages that is deleted after each commit. <code>PRAGMA journal_mode=WAL</code> switches it to write-ahead logging, the approach PostgreSQL, MySQL and SQL Server use.`},
    {lv:'mid', title:'Atomic commit from the user\'s point of view', sql:`BEGIN;
UPDATE accounts SET balance = 50 WHERE id = 1;
UPDATE accounts SET balance = 300 WHERE id = 2;
COMMIT;
SELECT id, balance FROM accounts WHERE id IN (1, 2);`, why:`After COMMIT returns, both changes are durable (logged and fsynced); a crash now can't lose one without the other.`},
    {lv:'adv', title:'Simulate redo/undo from a log', sql:`CREATE TABLE wal (lsn INTEGER, tx TEXT, account INTEGER, before REAL, after REAL, kind TEXT);
INSERT INTO wal VALUES
 (104, 'T8', 4, 0,   75, 'update'),
 (105, 'T9', 1, 100, 90, 'update'),
 (106, 'T9', NULL, NULL, NULL, 'commit');
-- recovery: keep effects of transactions that have a commit record, undo the rest
SELECT w.tx, w.account,
       CASE WHEN EXISTS (SELECT 1 FROM wal c WHERE c.tx = w.tx AND c.kind = 'commit')
            THEN w.after ELSE w.before END AS recovered_balance,
       CASE WHEN EXISTS (SELECT 1 FROM wal c WHERE c.tx = w.tx AND c.kind = 'commit')
            THEN 'redo (committed)' ELSE 'undo (no commit)' END AS action
FROM wal w WHERE w.kind = 'update' ORDER BY w.lsn;`, why:`T9 committed, so its after-image stays; T8 never committed, so its before-image is restored. That's the essence of redo + undo.`},
  ],
  tips: {
    say:`"Write-ahead logging means every change is appended to a log that's flushed to disk at commit before acknowledging, while data pages are written lazily. On a crash, recovery replays the log from the last checkpoint (redo) and rolls back transactions without a commit record (undo). Checkpoints bound recovery time, and the same log feeds replication and point-in-time recovery."`,
    points:[`State the WAL rule precisely (log before page).`,`Explain why commits are fast (sequential, group commit).`,`Mention checkpoints and recovery time trade-off.`],
    traps:[`Saying COMMIT writes the data pages.`,`Saying the database is in memory and "loses data" on crash despite commit.`],
    qa:[[`Why not just write data pages at commit?`,`Random I/O for every touched page on every commit; the log is one sequential write and can batch many commits.`],
        [`What does a checkpoint do and why tune it?`,`Flushes dirty pages and advances the redo start point. More frequent: faster recovery, more I/O; less frequent: smoother I/O, longer recovery.`],
        [`How does Postgres handle undo?`,`It doesn't need a separate undo log: MVCC keeps old versions, and an aborted transaction's new versions are simply invisible and later vacuumed.`]]
  },
  exercises: [
    {lv:'E', q:`Apply a transfer of 40 from Eli (5) to Chen (3) as one atomic transaction and return <code>id, balance</code> for both ordered by id.`, hint:`BEGIN; UPDATE; UPDATE; COMMIT.`, ordered:true,
     sql:`BEGIN;
UPDATE accounts SET balance = balance - 40 WHERE id = 5;
UPDATE accounts SET balance = balance + 40 WHERE id = 3;
COMMIT;
SELECT id, balance FROM accounts WHERE id IN (3, 5) ORDER BY id;`},
    {lv:'M', q:`Using the WAL simulation (create it as in example 3 but add <code>(107, 'T8', NULL, NULL, NULL, 'commit')</code>), return the recovered balance per logged update: <code>tx, account, recovered_balance</code>.`, hint:`Now both transactions committed.`,
     sql:`CREATE TABLE wal (lsn INTEGER, tx TEXT, account INTEGER, before REAL, after REAL, kind TEXT);
INSERT INTO wal VALUES (104, 'T8', 4, 0, 75, 'update'), (105, 'T9', 1, 100, 90, 'update'),
                       (106, 'T9', NULL, NULL, NULL, 'commit'), (107, 'T8', NULL, NULL, NULL, 'commit');
SELECT w.tx, w.account,
       CASE WHEN EXISTS (SELECT 1 FROM wal c WHERE c.tx = w.tx AND c.kind = 'commit') THEN w.after ELSE w.before END AS recovered_balance
FROM wal w WHERE w.kind = 'update';`},
    {lv:'H', q:`A team sets <code>fsync = off</code> on their Postgres primary to speed up writes "because we have replicas". What can go wrong, and what safer knobs exist?`, hint:`Crash consistency vs durability of the last few transactions.`,
     answer:`<p>With fsync off, a crash or power loss can leave data files and WAL inconsistent: <b>corruption</b>, not just lost recent transactions; replicas may have received WAL the primary never persisted, causing divergence. Safer: <code>synchronous_commit = off</code> (may lose the last ~few hundred ms of commits but never corrupts), group commit settings (commit_delay), faster WAL storage, or batching writes in fewer transactions.</p>`},
  ],
  quiz: [
    [`The WAL rule says…`,[`Data pages are written before log records`,`A change's log record must reach disk before the data page`,`The log is optional`,`Checkpoints happen on every commit`],1,`Write-ahead.`,'E'],
    [`At COMMIT the database must flush…`,[`All data pages`,`The WAL up to the commit record`,`Nothing`,`The indexes`],1,`Data pages can wait.`,'E'],
    [`Why are WAL-based commits fast?`,[`They skip durability`,`Log writes are sequential appends (and can be grouped)`,`They use RAM only`,`They compress data`],1,`Random page writes are deferred.`,'M'],
    [`A checkpoint…`,[`Deletes the WAL`,`Flushes dirty pages and sets where recovery's redo starts`,`Commits all transactions`,`Locks the database`],1,`Bounds recovery time.`,'M'],
    [`During recovery, a transaction with no COMMIT record is…`,[`Kept`,`Undone/rolled back`,`Committed automatically`,`Moved to a replica`],1,`Atomicity.`,'E'],
    [`Redo during recovery replays…`,[`Only committed transactions`,`All logged changes since the last checkpoint ("repeat history")`,`Nothing`,`Only DDL`],1,`Then undo removes uncommitted ones (ARIES).`,'H'],
  ],
  quizAdv: [
    [`ARIES recovery phases are…`,[`Parse, plan, execute`,`Analysis, redo, undo`,`Grow, shrink`,`Flush, fsync, ack`],1,`Used by DB2, SQL Server, InnoDB.`,'H'],
    [`Postgres full_page_writes protects against…`,[`Deadlocks`,`Torn pages: a partially written page after a crash`,`Lost updates`,`Replication lag`],1,`First change after a checkpoint logs the whole page.`,'H'],
    [`Redo is idempotent because…`,[`Records are deleted after use`,`Each page stores the LSN of its last change, so already-applied records are skipped`,`Checkpoints prevent it`,`It runs once a day`],1,`Page LSN vs record LSN.`,'H'],
  ],
});
