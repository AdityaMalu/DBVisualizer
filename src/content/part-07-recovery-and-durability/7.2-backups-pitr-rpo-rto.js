/* 7.2 Backups, point-in-time recovery, RPO and RTO */
topic('7', { no:'7.2', title:'Backups and point-in-time recovery (RPO, RTO)', db:'bank',
idea:`Someone runs DELETE without WHERE at 14:32. Replicas faithfully delete too. See how logical dumps, physical base backups and archived WAL let you restore to 14:31:59, and how RPO and RTO turn "we have backups" into a real recovery plan.`,
dgTitle:'Backup timeline', stateTitle:'Recovery plan',
nodes:{
  base:{x:70,y:60,label:'base backup\nSun 02:00',w:130,h:46,kind:'db'},
  w1:{x:220,y:60,label:'WAL Mon',w:90},
  w2:{x:320,y:60,label:'WAL Tue',w:90},
  w3:{x:430,y:60,label:'WAL Wed\n…14:31:59 | 14:32',w:140,h:46},
  bad:{x:430,y:160,label:'DELETE FROM accounts\nWed 14:32',w:170,h:46},
  rest:{x:180,y:160,label:'restored DB\n(as of 14:31:59)',w:160,h:46,kind:'db'}
},
edges:[['base','w1'],['w1','w2'],['w2','w3']],
vb:'0 0 540 210',
codes:{a:`-- logical backup: SQL/data dump (portable, slow to restore at scale)
pg_dump -Fc bank > bank.dump            mysqldump --single-transaction bank

-- physical backup: copy of data files + WAL (fast restore, same major version)
pg_basebackup -D /backups/base -X stream
archive_command = 'cp %p /archive/%f'   -- continuous WAL archiving

-- point-in-time recovery (PITR)
-- 1. restore the base backup   2. replay archived WAL up to a target
recovery_target_time = '2024-03-06 14:31:59'

-- test it! A backup you haven't restored is a hope, not a backup.`},
steps:[
{hl:{q:[1,2]}, d:null, g:[G('Logical backup',['what','SQL statements / data export'],['tools','pg_dump, mysqldump'],['pros','portable across versions, selective (one table)','ok'],['cons','slow restore for big DBs (rebuild indexes); point-in-time of the dump only','bad'],['consistency','single snapshot (--single-transaction)'])],
 say:`A <b>logical backup</b> exports data as SQL or a portable format. It's great for small databases, migrations between versions and restoring one table, but restoring a multi-terabyte database means re-inserting every row and rebuilding every index: hours or days. And it only captures one moment, the time of the dump.`},
{hl:{q:[4,5,6]}, d:{on:['base','w1','w2','w3'], e:[['base','w1','','ok'],['w1','w2','','ok'],['w2','w3','','ok']]}, g:[G('Physical backup + WAL archive',['base backup','copy of data files (online, consistent with WAL)','hot'],['WAL archiving','every WAL segment copied off the server','hot'],['restore','copy files back: fast'],['together','any point in time since the base backup','ok'])],
 say:`A <b>physical backup</b> copies the database files themselves (taken online, made consistent by the WAL). Combined with <b>continuous WAL archiving</b>, where every WAL segment is shipped to safe storage, you can reconstruct the database at <i>any moment</i> after the base backup by replaying the log (7.1). Managed services (RDS, Cloud SQL) do exactly this behind "restore to point in time".`},
{hl:{}, d:{bad:['bad'], e:[['base','w1','',''],['w1','w2','',''],['w2','w3','',''],['w3','bad','','bad']]}, g:[G('The disaster',['DELETE FROM accounts','no WHERE','bad'],['replicas','apply it within ms','bad'],['lesson','replication ≠ backup','hot'])], log:['Wed 14:32 DELETE FROM accounts → replicas too'],
 say:`Wednesday 14:32: someone runs <code>DELETE FROM accounts</code> without a WHERE. Every replica applies it a few milliseconds later. <b>Replication is not a backup</b>: it protects against hardware failure, not against mistakes, bugs or ransomware. You need copies that go back in time.`},
{hl:{q:[8,9,10]}, d:{ok:['rest'], e:[['base','rest','1. restore','ok'],['w3','rest','2. replay to 14:31:59','ok']]}, g:[G('PITR',['restore','Sunday base backup'],['replay','archived WAL Mon → Wed 14:31:59','hot'],['stop','just before the bad transaction'],['then','copy the lost rows back, or promote this copy'])], log:['restored to 14:31:59: accounts intact'],
 say:`<b>Point-in-time recovery</b>: restore Sunday's base backup to a new server, replay archived WAL through Monday, Tuesday and Wednesday, and <b>stop at 14:31:59</b>, one second before the mistake. Then either export the lost rows and re-insert them into production, or promote the restored copy. Delayed replicas (e.g. 1 hour behind) offer a faster variant.`},
{hl:{}, d:null, g:[G('RPO: Recovery Point Objective',['question','how much data can we lose?'],['nightly dump only','up to 24 h','bad'],['WAL archiving','seconds–minutes','ok'],['sync replica','~0 for hardware loss'])],
 say:`Two numbers make a backup strategy concrete. <b>RPO</b> (recovery point objective): how much data, measured in time, you can afford to lose. Nightly dumps alone mean up to 24 hours of lost orders. Continuous WAL archiving brings it down to seconds or minutes; synchronous replicas to near zero for hardware failure.`},
{hl:{}, d:null, g:[G('RTO: Recovery Time Objective',['question','how long can we be down?'],['restore 5 TB from dump','days','bad'],['physical restore + WAL replay','hours (replay speed matters)'],['failover to replica','seconds–minutes (hardware failures)','ok'],['delayed replica / snapshots','minutes for logical errors'])],
 say:`<b>RTO</b> (recovery time objective): how long you can be down. Restoring 5 TB from a logical dump could take days; a physical restore plus WAL replay takes hours (weekly base backups mean a lot of WAL to replay, so take them more often); failing over to a replica takes seconds but only helps with hardware failure.`},
{hl:{q:[12]}, d:null, g:[G('Strategy checklist',['3-2-1','3 copies, 2 media, 1 off-site (immutable)','ok'],['physical + WAL archive','PITR'],['logical dumps','portability / single tables'],['encrypt + restrict access',''],['restore drills','regularly, timed against RTO','hot'],['monitor','backup age, WAL archive lag, failures'])],
 say:`<b>Say it:</b> "Replication protects against hardware failure, backups against everything else. I combine physical base backups with continuous WAL archiving for point-in-time recovery, plus logical dumps for portability, stored off-site and immutable. The design is driven by RPO, how much data we can lose, and RTO, how long we can be down, and it's only real if we regularly test restores."`}
],
keep:[`Replication ≠ backup (mistakes replicate instantly).`,`Logical (pg_dump): portable, slow restore. Physical (base backup) + WAL archive: fast restore + PITR.`,`PITR = restore base backup, replay WAL to a target time just before the incident.`,`RPO = max data loss; RTO = max downtime. Test restores regularly.`]}, {
  imp: 'good',
  theory: TH(`Backups let you recover from data loss and mistakes; combining a physical base backup with archived write-ahead logs lets you restore the database to any moment, and RPO/RTO define how much loss and downtime are acceptable.`,
`<p>Disks fail, people delete the wrong rows, bugs corrupt data, attackers encrypt servers. Replicas copy everything instantly, including the mistakes, so they don't help with the last three. Backups are copies from the <i>past</i>.</p>
<p>A base backup is a photo of the database at one moment; the archived WAL is a video of every change since. Photo + video lets you reconstruct any instant: that's point-in-time recovery.</p>`,
[[`Logical backup`,`Export of data/schema as SQL or portable files.`],[`Physical backup`,`Copy of the database's data files.`],[`Base backup`,`The physical backup PITR starts from.`],[`WAL archiving`,`Continuously copying WAL segments to safe storage.`],[`PITR`,`Restoring to a chosen timestamp/LSN by replaying WAL.`],[`RPO`,`Recovery point objective: acceptable data loss window.`],[`RTO`,`Recovery time objective: acceptable downtime.`],[`Delayed replica`,`A replica that applies WAL with a deliberate lag.`]],
[`Take periodic base backups (online).`,`Archive every WAL segment continuously.`,`To recover: restore the base backup, replay WAL up to the target, open the database.`,`Rehearse restores and measure them against RTO.`],
[`Managed DBs: automated backups + PITR window (e.g. 7–35 days).`,`pgBackRest, Barman, WAL-G for Postgres; Percona XtraBackup + binlogs for MySQL.`,`Immutable/object-lock storage against ransomware.`],
[`Never testing restores.`,`Keeping backups in the same account/region as production only.`,`Only nightly dumps for a business that can't lose a day of orders.`,`Not monitoring WAL archive failures (a gap breaks PITR).`]),
  examples: [
    {lv:'basic', title:'A logical "dump" of one table', sql:`SELECT 'INSERT INTO accounts VALUES (' || id || ', ''' || owner || ''', ''' || branch || ''', ' || balance || ', ' || version || ');' AS dump_line
FROM accounts ORDER BY id;`, why:`What a logical backup is: statements that recreate the data. Portable and readable, but restoring billions of these is slow.`},
    {lv:'mid', title:'Snapshot before a risky change, restore after a mistake', sql:`CREATE TABLE transfers_backup AS SELECT * FROM transfers;  -- poor man's backup
DELETE FROM transfers;                                       -- oops, no WHERE
INSERT INTO transfers SELECT * FROM transfers_backup;        -- restore
SELECT COUNT(*) AS restored_rows FROM transfers;`, why:`A table copy before a risky manual change is a cheap safety net (and a good habit), though not a substitute for real backups.`},
    {lv:'adv', title:'Point-in-time reconstruction from a change log', sql:`CREATE TABLE changes (ts TEXT, account INTEGER, delta REAL);
INSERT INTO changes VALUES ('2024-03-06 09:00', 1, -20), ('2024-03-06 12:00', 1, 50),
                           ('2024-03-06 14:32', 1, -9999);              -- the bad change
-- base backup balance was 100; replay changes up to the target time
SELECT 100 + COALESCE(SUM(delta), 0) AS balance_at_14_31_59
FROM changes WHERE ts <= '2024-03-06 14:31:59';`, why:`Base state + replay of logged changes up to a target time = PITR in miniature: 100 − 20 + 50 = 130, excluding the 14:32 disaster.`},
  ],
  tips: {
    say:`"Replication handles hardware failure but replicates mistakes, so I also keep physical base backups with continuous WAL archiving for point-in-time recovery, plus logical dumps for portability, off-site and immutable. I size it by RPO and RTO, and I regularly restore to prove it works."`,
    points:[`Say "replication is not a backup" early.`,`Define RPO and RTO with numbers.`,`Mention restore testing and monitoring archive gaps.`],
    traps:[`Equating snapshots on the same disk with backups.`,`Ignoring restore time for large logical dumps.`],
    qa:[[`Someone dropped a table an hour ago. How do you recover?`,`PITR to a new instance just before the DROP (restore base backup + replay WAL to the timestamp), export the table, import it into production. Or use a delayed replica if one exists.`],
        [`Logical vs physical backup?`,`Logical: SQL/data export, portable across versions, selective, slow restore. Physical: file-level copy, fast restore, same major version, enables PITR with WAL.`],
        [`How do you reduce RTO for a 10 TB database?`,`Frequent base backups (less WAL to replay), parallel restore tools, storage snapshots, warm standby replicas, and practised runbooks.`]]
  },
  exercises: [
    {lv:'E', q:`Make a backup copy of transfers, delete all transfers, restore them from the copy, and return the count as <code>n</code>.`, hint:`CREATE TABLE … AS SELECT; DELETE; INSERT … SELECT.`,
     sql:`CREATE TABLE transfers_bak AS SELECT * FROM transfers;
DELETE FROM transfers;
INSERT INTO transfers SELECT * FROM transfers_bak;
SELECT COUNT(*) AS n FROM transfers;`},
    {lv:'M', q:`Reconstruct every account's balance as of '2024-03-02 23:59' from a base snapshot where all balances are as in the accounts table <b>minus</b> the effect of all transfers (i.e., treat today's accounts as the result of applying all transfers). Return <code>id, balance_then</code>.`, hint:`balance_then = balance − (incoming after cutoff) + (outgoing after cutoff).`,
     sql:`SELECT a.id,
       a.balance
         - COALESCE((SELECT SUM(amount) FROM transfers t WHERE t.to_id = a.id AND t.ts > '2024-03-02 23:59'), 0)
         + COALESCE((SELECT SUM(amount) FROM transfers t WHERE t.from_id = a.id AND t.ts > '2024-03-02 23:59'), 0) AS balance_then
FROM accounts a;`},
    {lv:'H', q:`Define a backup strategy for an e-commerce Postgres database (2 TB, RPO 5 minutes, RTO 1 hour, must survive region loss and ransomware).`, hint:`Base backups, WAL archive, replicas, storage, testing.`,
     answer:`<ul><li>Continuous WAL archiving (pgBackRest/WAL-G) to object storage in another region with object lock (immutable) → RPO ≈ minutes (archive_timeout ≤ 60 s).</li><li>Daily full + hourly incremental/differential base backups so WAL replay stays short → restore + replay within the hour (parallel restore, fast storage).</li><li>Hot standby in-region for hardware failure (RTO seconds), cross-region async replica or restore capability for region loss.</li><li>Separate credentials/accounts for backup storage; encryption.</li><li>Monthly timed restore drills; alerts on backup age and archive failures.</li></ul>`},
  ],
  quiz: [
    [`Why isn't a replica a backup?`,[`Replicas are slower`,`Mistakes and deletes replicate to it instantly`,`Replicas can't be read`,`They have no indexes`],1,`It protects against hardware failure only.`,'E'],
    [`PITR requires…`,[`Only nightly dumps`,`A base backup plus continuous WAL archive`,`A replica`,`A materialized view`],1,`Replay WAL to a target time.`,'E'],
    [`RPO measures…`,[`Downtime`,`Maximum acceptable data loss (time window)`,`Query speed`,`Replication lag`],1,`Recovery point.`,'E'],
    [`RTO measures…`,[`Maximum acceptable downtime`,`Data loss`,`Disk usage`,`Index size`],0,`Recovery time.`,'E'],
    [`Main drawback of logical dumps for large databases?`,[`Not portable`,`Slow restore (re-insert + rebuild indexes) and only one point in time`,`Can't be compressed`,`Need superuser`],1,`Fine for small DBs or single tables.`,'M'],
    [`A backup you have never restored is…`,[`Fine`,`Unverified: it may not work when needed`,`Faster`,`Encrypted`],1,`Test restores regularly.`,'E'],
  ],
  quizAdv: [
    [`A gap in the archived WAL sequence means…`,[`Nothing`,`PITR can't proceed past the gap`,`Faster restores`,`The base backup is invalid`],1,`Monitor archiving.`,'H'],
    [`A delayed replica (e.g. recovery_min_apply_delay = 1h) helps with…`,[`Hardware failure only`,`Quickly recovering from logical mistakes made within the delay window`,`Read scaling`,`Reducing WAL size`],1,`Pause it, recover data, done.`,'H'],
    [`pg_dump consistency for a busy database comes from…`,[`Locking all tables exclusively`,`Running in one REPEATABLE READ snapshot`,`Stopping writes`,`Copying files`],1,`MVCC snapshot.`,'H'],
  ],
});
