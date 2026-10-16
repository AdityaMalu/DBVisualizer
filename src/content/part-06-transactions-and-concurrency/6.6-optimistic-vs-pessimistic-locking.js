/* 6.6 Optimistic vs pessimistic concurrency control */
topic('6', { no:'6.6', title:'Optimistic vs pessimistic locking (version columns, FOR UPDATE)', db:'bank',
idea:`Two editors open the same record, both save. Pessimistic locking makes the second one wait up front; optimistic locking lets both work and rejects the stale save with a version check. Compare when each wins, and see the conditional-update pattern that often beats both.`,
actors:'Requests', tbTitle:'accounts (id 1)', stateTitle:'Strategy',
codes:{a:`-- pessimistic: lock first, then read-modify-write
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;    -- others wait here
UPDATE accounts SET balance = :new WHERE id = 1;
COMMIT;

-- optimistic: read with version, write only if unchanged
SELECT balance, version FROM accounts WHERE id = 1;     -- → 100, v1
UPDATE accounts SET balance = :new, version = version + 1
WHERE id = 1 AND version = 1;                           -- 0 rows? someone won
-- JPA: @Version on a field;  Hibernate throws OptimisticLockException

-- often simplest: let the database do the arithmetic
UPDATE accounts SET balance = balance - 30
WHERE id = 1 AND balance >= 30;                         -- 0 rows = insufficient`},
steps:[
{hl:{A:[2,3]}, th:[['A','RUN:ok','holds row lock'],['B','NEW:dim','']], tb:[TB('accounts',['id','balance','version'],[[1,100,1]],{0:'hot'})], g:[G('Pessimistic',['assume conflicts are likely','lock before reading','hot'],['mechanism','SELECT … FOR UPDATE (row X lock)'])],
 say:`<b>Pessimistic locking</b> assumes conflicts are likely, so it prevents them: request A locks the row with <code>SELECT … FOR UPDATE</code> before reading, and keeps the lock until commit.`},
{hl:{A:[4,5],B:[3]}, th:[['A','TERM:ok','wrote 70, committed'],['B','BLOCKED:warn','waited, then read 70']], tb:[TB('accounts',['id','balance','version'],[[1,70,1]],{0:'ok'})], g:[G('Pessimistic',['B','waits for A, then sees fresh data','ok'],['correct','no lost update','ok'],['cost','waiting; lock held across app logic','bad'],['danger','user think-time inside a transaction','bad'])], log:['A commits 70 → B unblocks, reads 70'],
 say:`B's FOR UPDATE waits until A commits, then reads the fresh 70. Correct, but B spent time blocked, and if the transaction spans slow work (or worse, a user staring at a form), locks are held for ages. Pessimistic locking fits short, high-contention critical sections.`},
{hl:{A:[8],B:[8]}, th:[['A','RUN:ok','read 100, v1'],['B','RUN:ok','read 100, v1']], tb:[TB('accounts',['id','balance','version'],[[1,100,1]])], g:[G('Optimistic',['assume conflicts are rare','no locks while working','hot'],['read','remember the version (or updated_at / hash)'],['no waiting','both proceed','ok'])],
 say:`<b>Optimistic locking</b> assumes conflicts are rare. Nobody locks while reading or thinking. Both A and B read the row <i>and its version number</i> (1). This works across HTTP requests too: the version travels to the browser in a hidden field or ETag.`},
{hl:{A:[9,10]}, th:[['A','TERM:ok','UPDATE … WHERE version = 1 → 1 row'],['B','RUN:ok','still working']], tb:[TB('accounts',['id','balance','version'],[[1,70,2]],{0:'ok'})], log:['A: 1 row updated (version 1 → 2)'],
 say:`A saves with <code>WHERE id = 1 AND version = 1</code> and bumps the version to 2. One row matched, so A succeeded. The check and the write are a single atomic statement, so there's no race between them.`},
{hl:{B:[9,10,11]}, th:[['A','TERM:dim',''],['B','TERM:bad','0 rows → conflict']], tb:[TB('accounts',['id','balance','version'],[[1,70,2]],{0:'ok'})], g:[G('Conflict detected',['B\'s WHERE version = 1','matches nothing (now 2)','bad'],['app sees','0 rows updated → OptimisticLockException'],['then','re-read and retry, or ask the user to merge','ok'])], log:['B: 0 rows updated → conflict, retry'],
 say:`B saves with <code>version = 1</code>, but the row is at version 2: <b>0 rows updated</b>. The application treats that as a conflict: reload and retry automatically, or show the user "this record changed, review and save again". JPA's <code>@Version</code> does exactly this and throws OptimisticLockException.`},
{hl:{q:[14,15]}, th:[], tb:[TB('accounts',['id','balance','version'],[[1,40,2]],{0:'ok'})], g:[G('Atomic conditional update',['no read in the app','arithmetic in SQL','ok'],['guard','AND balance >= 30'],['0 rows','insufficient funds'],['best for','counters, balances, stock'])], log:['UPDATE … balance - 30 WHERE balance >= 30 → 1 row'],
 say:`Often the simplest and fastest option: don't read into the app at all. <code>UPDATE … SET balance = balance - 30 WHERE id = 1 AND balance &gt;= 30</code> does the check and the change atomically under a brief row lock. Works for counters, stock levels and balances; the affected-row count tells you whether it succeeded.`},
{hl:{}, th:[], tb:[], g:[G('Choose',['high contention, short critical section','pessimistic (FOR UPDATE)'],['low contention, long think time, web forms','optimistic (version)','ok'],['simple arithmetic on one row','atomic conditional UPDATE','ok'],['hot row with huge contention','redesign: shard counters, queue, batch (10.3)'])],
 say:`<b>Say it:</b> "Pessimistic locking takes a row lock before reading (SELECT FOR UPDATE), so others wait; it suits short, high-contention updates. Optimistic locking reads a version and writes with WHERE version = :v, failing with 0 rows if someone else changed it, then retries; it suits low contention and long user think time and needs no locks held. When the change is simple arithmetic I prefer a single conditional UPDATE."`}
],
keep:[`Pessimistic: lock first (FOR UPDATE); others wait; good for short, contended sections.`,`Optimistic: read version; UPDATE … WHERE version = v; 0 rows = conflict → retry/merge.`,`Optimistic works across HTTP requests (version/ETag), holds no locks.`,`Simple arithmetic: atomic conditional UPDATE (balance = balance - x WHERE balance >= x).`]}, {
  imp: 'must',
  theory: TH(`Pessimistic locking prevents conflicts by locking data before using it; optimistic locking lets work proceed without locks and detects conflicts at write time with a version check.`,
`<p>Two people editing a wiki page: pessimistic is "check out" the page so others can't edit until you're done; optimistic is "everyone edits freely, and whoever saves second gets 'the page changed since you opened it'".</p>
<p>Pessimistic is safer under heavy contention but makes people wait and holds locks. Optimistic is cheap when conflicts are rare, but under heavy contention many saves fail and retry.</p>`,
[[`Pessimistic locking`,`Lock data before reading it for update.`],[`Optimistic locking`,`Detect conflicts at write time using a version.`],[`Version column`,`Integer incremented on every update.`],[`ETag / If-Match`,`HTTP equivalent of a version check.`],[`Conditional update`,`UPDATE … WHERE <expected state>.`],[`Retry loop`,`Re-read and re-apply after a conflict.`]],
[`Pessimistic: BEGIN; SELECT … FOR UPDATE; compute; UPDATE; COMMIT.`,`Optimistic: read row + version; compute; UPDATE … SET version = version + 1 WHERE id = ? AND version = ?.`,`Check affected rows: 1 = success, 0 = conflict.`,`On conflict, retry or surface to the user.`],
[`JPA/Hibernate @Version, Rails lock_version, Django select_for_update.`,`REST APIs with ETag + If-Match returning 412 Precondition Failed.`,`Inventory and wallet updates with atomic conditional UPDATEs.`],
[`Ignoring the affected-row count (silent lost updates).`,`Holding pessimistic locks across user think time.`,`Optimistic locking on a hot row (retry storms).`,`Using timestamps with coarse precision as versions.`]),
  examples: [
    {lv:'basic', title:'Optimistic update succeeds', sql:`UPDATE accounts SET balance = 70, version = version + 1
WHERE id = 1 AND version = 1;
SELECT changes() AS rows_updated, balance, version FROM accounts WHERE id = 1;`, why:`1 row updated; version is now 2.`},
    {lv:'mid', title:'The stale writer loses', sql:`UPDATE accounts SET balance = 70, version = version + 1 WHERE id = 1 AND version = 1;  -- A
UPDATE accounts SET balance = 50, version = version + 1 WHERE id = 1 AND version = 1;  -- B (stale)
SELECT changes() AS rows_updated_by_B, balance, version FROM accounts WHERE id = 1;`, why:`B updated 0 rows: its version 1 is stale. Balance stays 70 instead of being overwritten with 50.`},
    {lv:'adv', title:'Atomic conditional debit with an audit row', sql:`UPDATE accounts SET balance = balance - 120 WHERE id = 1 AND balance >= 120;   -- Asha has 100
INSERT INTO transfers SELECT 6, 1, 2, 120, '2024-03-06 10:00' WHERE changes() = 1;
SELECT (SELECT balance FROM accounts WHERE id = 1) AS asha_balance,
       (SELECT COUNT(*) FROM transfers) AS transfers;`, why:`The debit fails (insufficient funds), so no transfer row is recorded: balance 100, still 5 transfers. In application code you'd check the affected-row count instead of changes().`},
  ],
  tips: {
    say:`"Pessimistic locking locks the row before reading, with SELECT FOR UPDATE, so concurrent writers wait; I use it for short, high-contention critical sections. Optimistic locking reads a version and updates WHERE version matches; zero rows means someone else won, so I retry or ask the user. It's ideal for low contention and web forms because no locks are held. For simple arithmetic, a single conditional UPDATE is best."`,
    points:[`Write the optimistic UPDATE … WHERE version = ? from memory.`,`Mention checking the affected-row count.`,`Choose based on contention and duration.`],
    traps:[`Saying optimistic locking uses database locks.`,`Using optimistic locking on a very hot row without backoff.`],
    qa:[[`How does JPA @Version work?`,`Hibernate adds version = ? to the UPDATE's WHERE and increments it; if 0 rows are updated it throws OptimisticLockException.`],
        [`Optimistic locking across HTTP?`,`Return the version/ETag with the resource; the client sends If-Match; the server updates WHERE version = ? and returns 412 if it fails.`],
        [`When does optimistic locking perform badly?`,`High contention on the same rows: most transactions fail and retry, wasting work. Switch to pessimistic or redesign the hot spot.`]]
  },
  exercises: [
    {lv:'E', q:`Optimistically set Ben's (id 2) balance to 300 assuming version 1, then return <code>balance, version</code> for Ben.`, hint:`UPDATE … SET balance = 300, version = version + 1 WHERE id = 2 AND version = 1.`,
     sql:`UPDATE accounts SET balance = 300, version = version + 1 WHERE id = 2 AND version = 1;
SELECT balance, version FROM accounts WHERE id = 2;`},
    {lv:'M', q:`Simulate two concurrent edits of Chen (id 3) both based on version 1: first sets 90, second sets 60. Return Chen's final <code>balance, version</code>.`, hint:`Two optimistic UPDATEs with WHERE version = 1; only the first matches.`,
     sql:`UPDATE accounts SET balance = 90, version = version + 1 WHERE id = 3 AND version = 1;
UPDATE accounts SET balance = 60, version = version + 1 WHERE id = 3 AND version = 1;
SELECT balance, version FROM accounts WHERE id = 3;`},
    {lv:'H', q:`Choose a strategy for each and justify: (a) a CMS article edited by several journalists over minutes; (b) seat booking for a concert at on-sale time; (c) incrementing a page-view counter; (d) applying interest to every account nightly.`, hint:`Contention, duration, simplicity.`,
     answer:`<ul><li>(a) optimistic (version + "changed since you opened it" merge UI): long think time, rare conflicts.</li><li>(b) atomic conditional UPDATE on the seat row (WHERE status = 'free'), or FOR UPDATE SKIP LOCKED for picking seats: very high contention, short operations.</li><li>(c) atomic increment, or for extreme rates sharded counters / buffered aggregation (10.3).</li><li>(d) a single set-based UPDATE in batches; no per-row app logic needed.</li></ul>`},
  ],
  quiz: [
    [`Pessimistic locking means…`,[`Retrying on conflict`,`Locking data before using it so others wait`,`Never locking`,`Using a NoSQL store`],1,`SELECT … FOR UPDATE.`,'E'],
    [`An optimistic UPDATE returns 0 rows affected. This means…`,[`Success`,`Someone else changed the row (version mismatch) → conflict`,`The table is empty`,`A deadlock`],1,`Reload and retry.`,'E'],
    [`Optimistic locking suits…`,[`High contention on one row`,`Low contention, long think time (web forms)`,`Batch jobs only`,`Read-only workloads`],1,`No locks held.`,'M'],
    [`The version check must be in the UPDATE's WHERE because…`,[`It's faster`,`Check-and-write in one atomic statement avoids a race`,`SQL requires it`,`It creates an index`],1,`Separate SELECT then UPDATE races.`,'M'],
    [`For decrementing stock safely, the simplest correct approach is often…`,[`Read stock in app, write new value`,`UPDATE … SET stock = stock - 1 WHERE id = ? AND stock > 0`,`DELETE and INSERT`,`A cache`],1,`Atomic conditional update.`,'E'],
    [`HTTP equivalent of optimistic locking?`,[`Cookies`,`ETag + If-Match (412 on mismatch)`,`CORS`,`Keep-alive`],1,`Precondition check.`,'M'],
  ],
  quizAdv: [
    [`Under heavy contention, optimistic locking leads to…`,[`Deadlocks`,`Many failed attempts and retries (wasted work)`,`Dirty reads`,`Lost updates`],1,`Switch strategy for hot rows.`,'H'],
    [`Using updated_at (second precision) as the version can fail because…`,[`It's always NULL`,`Two updates within the same second leave the "version" unchanged`,`Timestamps can't be compared`,`It locks rows`],1,`Prefer an integer counter.`,'H'],
    [`Hibernate @Version on an entity with a bulk JPQL UPDATE…`,[`Is checked automatically`,`Bypasses the version check unless you include it yourself`,`Throws immediately`,`Locks the table`],1,`Bulk updates skip entity lifecycle.`,'H'],
  ],
});
