/* 6.7 Write skew and SERIALIZABLE (SSI) */
topic('6', { no:'6.7', title:'Write skew and SERIALIZABLE (snapshot isolation is not enough)', db:'hr',
idea:`Two on-call doctors each check "someone else is on call" and both go off duty. No row was written twice, every read was consistent, and the invariant still broke. See why snapshot isolation allows this write skew and how SERIALIZABLE (SSI) or explicit locking prevents it.`,
actors:'Transactions', tbTitle:'on_call', stateTitle:'What each sees',
codes:{a:`-- invariant: at least one doctor on call
CREATE TABLE on_call (doctor TEXT PRIMARY KEY, on_duty BOOLEAN);
-- Alice and Bob are on call

-- T1 (Alice)                               -- T2 (Bob), concurrently
BEGIN ISOLATION LEVEL REPEATABLE READ;      BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM on_call                SELECT count(*) FROM on_call
WHERE on_duty;            -- 2              WHERE on_duty;            -- 2
UPDATE on_call SET on_duty = false          UPDATE on_call SET on_duty = false
WHERE doctor = 'Alice';                     WHERE doctor = 'Bob';
COMMIT;                                     COMMIT;
-- result: nobody on call!

-- fixes
BEGIN ISOLATION LEVEL SERIALIZABLE;          -- one of them gets a serialization error
SELECT … FROM on_call WHERE on_duty FOR UPDATE;   -- lock the rows you read
-- or materialise the conflict: a single row both must update (e.g. shift.version)`},
steps:[
{hl:{q:[1,2,3]}, th:[['T1','NEW:dim','Alice wants off'],['T2','NEW:dim','Bob wants off']], tb:[TB('on_call',['doctor','on_duty'],[['Alice','true'],['Bob','true']])], g:[G('Invariant',['at least one doctor on duty','hot'],['enforced by','application logic (a check, then a write)'])],
 say:`A hospital rule: at least one doctor must be on call. It's enforced in application code: "if more than one doctor is on duty, I may go off duty". Alice and Bob are both on call and both feel unwell at the same moment.`},
{hl:{T1:[6,7,8],T2:[6,7,8]}, th:[['T1','RUN:ok','sees 2 on duty'],['T2','RUN:ok','sees 2 on duty']], g:[G('Snapshots',['T1 sees','Alice ✓ Bob ✓ → 2'],['T2 sees','Alice ✓ Bob ✓ → 2'],['both conclude','"safe to leave"','hot'])],
 say:`Both transactions run at REPEATABLE READ (snapshot isolation). Each counts on-duty doctors in its own snapshot and sees 2. Each concludes the other will stay. Both reads were perfectly consistent.`},
{hl:{T1:[9,10,11],T2:[9,10,11]}, th:[['T1','TERM:ok','Alice off, committed'],['T2','TERM:ok','Bob off, committed']], tb:[TB('on_call',['doctor','on_duty'],[['Alice','false'],['Bob','false']],{0:'bad',1:'bad'})], g:[G('No write-write conflict',['T1 wrote','Alice\'s row'],['T2 wrote','Bob\'s row'],['snapshot isolation checks','only same-row conflicts → none','bad'],['invariant','broken: 0 on call','bad'])], log:['both commit → nobody on call'],
 say:`T1 updates Alice's row, T2 updates Bob's row. They wrote <b>different rows</b>, so there's no write-write conflict for snapshot isolation to detect, and both commit. Now nobody is on call. This is <b>write skew</b>: two transactions read overlapping data, make decisions based on it, and write disjoint rows, jointly breaking an invariant. No serial order of T1 and T2 could produce this result.`},
{hl:{q:[14,15]}, th:[['T1','TERM:ok','committed'],['T2','TERM:bad','ERROR: could not serialize access']], tb:[TB('on_call',['doctor','on_duty'],[['Alice','false'],['Bob','true']],{0:'ok',1:'ok'})], g:[G('SERIALIZABLE (Postgres SSI)',['tracks','read-write dependencies between concurrent transactions'],['detects','dangerous cycle T1 →rw T2 →rw T1','hot'],['aborts','one transaction','ok'],['app','retries T2: now sees 1 on duty → refuses','ok'])], log:['T2: serialization failure → retry → "you are the last one"'],
 say:`At <b>SERIALIZABLE</b>, PostgreSQL uses <b>Serializable Snapshot Isolation (SSI)</b>: it tracks which transactions read data that others wrote. T1 read what T2 wrote and T2 read what T1 wrote, a dangerous cycle, so one of them fails with a <b>serialization error</b>. The app retries it; the retry sees only one doctor on duty and refuses. Other databases implement SERIALIZABLE with strict 2PL and range locks instead.`},
{hl:{q:[16]}, th:[['T1','RUN:ok','locked Alice + Bob rows'],['T2','BLOCKED:warn','waits for T1']], g:[G('Explicit locking',['SELECT … WHERE on_duty FOR UPDATE','locks the rows the decision depends on','ok'],['T2','waits, then re-reads → 1 on duty','ok'],['limitation','can\'t lock rows that don\'t exist yet (phantoms)','bad'],['then','materialise the conflict: lock a parent row (shift)','ok'])],
 say:`Alternative at lower isolation: <b>lock the rows you read</b> with <code>FOR UPDATE</code>, turning the read-only dependency into a lock conflict. T2 waits for T1, then sees just one doctor on duty. It doesn't work when the decision depends on rows that <i>don't exist yet</i> (e.g. "no booking overlaps this slot"); then you <b>materialise the conflict</b> by having both transactions update a common row (the shift, the room) or use an exclusion constraint.`},
{hl:{}, th:[], tb:[], g:[G('Where write skew hides',['on-call / minimum staffing','ok'],['double-booking a room or seat (insert-based)'],['usernames claimed via "check then insert" (use UNIQUE!)'],['spending limits across several accounts'],['game: two players taking the last item'])],
 say:`<b>Say it:</b> "Write skew happens when two transactions read the same data, each decide based on it, and write different rows, so snapshot isolation sees no conflict but the combined result violates an invariant. SERIALIZABLE prevents it, in Postgres via SSI which aborts one transaction so the app must retry. At lower levels I lock the rows the decision depends on with FOR UPDATE, materialise the conflict on a shared row, or use a constraint like UNIQUE or EXCLUDE."`}
],
keep:[`Write skew: read overlapping data, write different rows → invariant broken; no same-row conflict.`,`Snapshot isolation (Postgres RR, Oracle "serializable") allows it.`,`SERIALIZABLE (Postgres SSI) detects rw-dependency cycles → aborts one → retry.`,`Alternatives: FOR UPDATE on rows read; materialise the conflict on a shared row; UNIQUE/EXCLUDE constraints.`]}, {
  imp: 'good',
  theory: TH(`Write skew is an anomaly where concurrent transactions each read the same data and write different rows, together breaking a rule neither broke alone; only serializable isolation or explicit locking prevents it.`,
`<p>Snapshot isolation feels safe: every transaction sees a consistent picture and two transactions can't overwrite the same row. But consistent pictures can be <i>outdated</i>. If two people each look at the same picture ("there are two of us on call") and act on it at the same moment, they can both make choices that are only safe if the other doesn't.</p>
<p>SERIALIZABLE guarantees the result equals <i>some</i> one-at-a-time order of the transactions. In any serial order, the second doctor would have seen the first one leave.</p>`,
[[`Write skew`,`Two transactions read a shared premise and write disjoint rows, breaking an invariant.`],[`Snapshot isolation`,`Each transaction reads a fixed snapshot; only same-row write conflicts are detected.`],[`Serializable`,`Results equal some serial execution.`],[`SSI`,`Serializable Snapshot Isolation: detects rw-antidependency cycles.`],[`Serialization failure`,`The error telling you to retry (SQLSTATE 40001).`],[`Materialising the conflict`,`Making transactions update a common row so they conflict.`]],
[`Each transaction reads a premise (count, sum, absence of a row).`,`Each writes based on it, to different rows.`,`Snapshot isolation finds no write-write conflict: both commit.`,`SSI tracks rw-dependencies and aborts one transaction when a cycle could break serializability.`],
[`Bookings, staffing rules, limits across rows.`,`Postgres SERIALIZABLE with a generic retry loop is a valid design for complex invariants.`,`Exclusion constraints (Postgres EXCLUDE USING gist) for non-overlapping time ranges.`],
[`Believing REPEATABLE READ is "basically serializable".`,`Using SERIALIZABLE without retry logic.`,`"Check then insert" uniqueness without a UNIQUE constraint.`]),
  examples: [
    {lv:'basic', title:'The invariant check every transaction runs', sql:`CREATE TABLE on_call (doctor TEXT PRIMARY KEY, on_duty INTEGER);
INSERT INTO on_call VALUES ('Alice', 1), ('Bob', 1);
SELECT COUNT(*) AS on_duty FROM on_call WHERE on_duty = 1;`, why:`Both doctors run this check, see 2, and decide it's safe to leave.`},
    {lv:'mid', title:'Guard the write with the invariant itself', sql:`CREATE TABLE on_call (doctor TEXT PRIMARY KEY, on_duty INTEGER);
INSERT INTO on_call VALUES ('Alice', 1), ('Bob', 1);
-- each "go off duty" is one statement that re-checks the invariant at write time
UPDATE on_call SET on_duty = 0
WHERE doctor = 'Alice' AND (SELECT COUNT(*) FROM on_call WHERE on_duty = 1) > 1;
UPDATE on_call SET on_duty = 0
WHERE doctor = 'Bob'   AND (SELECT COUNT(*) FROM on_call WHERE on_duty = 1) > 1;
SELECT * FROM on_call;`, why:`Sequentially, Bob's update finds only 1 on duty and changes nothing. Under real concurrency at READ COMMITTED this alone is still racy; combine it with FOR UPDATE on the rows read, a shared lock row, or SERIALIZABLE.`},
    {lv:'adv', title:'Materialise the conflict with a shared row (version bump)', sql:`CREATE TABLE shift (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
CREATE TABLE on_call (doctor TEXT PRIMARY KEY, on_duty INTEGER, shift_id INTEGER);
INSERT INTO shift VALUES (1, 1);
INSERT INTO on_call VALUES ('Alice', 1, 1), ('Bob', 1, 1);
-- both read shift version 1 and 2 on duty; each must bump the SAME shift row
UPDATE shift SET version = version + 1 WHERE id = 1 AND version = 1;          -- Alice: 1 row
UPDATE on_call SET on_duty = 0 WHERE doctor = 'Alice' AND changes() = 1;
UPDATE shift SET version = version + 1 WHERE id = 1 AND version = 1;          -- Bob: 0 rows (stale)
UPDATE on_call SET on_duty = 0 WHERE doctor = 'Bob' AND changes() = 1;
SELECT * FROM on_call;`, why:`Because both transactions now write the same shift row with an optimistic version check, the second one fails and must re-read: write skew turned into an ordinary write-write conflict.`},
  ],
  tips: {
    say:`"Write skew is when two transactions read the same premise and write different rows, so snapshot isolation sees no conflict but the invariant breaks, like two on-call doctors both going off duty. SERIALIZABLE prevents it; Postgres uses SSI and aborts one transaction, so I retry on serialization failures. Otherwise I lock the rows the decision depends on, materialise the conflict on a shared row, or use constraints."`,
    points:[`Tell the doctors story crisply.`,`Explain why snapshot isolation misses it (disjoint writes).`,`Offer three fixes and mention retries.`],
    traps:[`Claiming REPEATABLE READ prevents it.`,`Forgetting that FOR UPDATE can't lock rows that don't exist yet.`],
    qa:[[`Is Oracle's SERIALIZABLE truly serializable?`,`No: it's snapshot isolation and allows write skew. Postgres SERIALIZABLE (9.1+) is truly serializable via SSI.`],
        [`How do you prevent double-booking a meeting room?`,`An exclusion constraint on (room, time range) with &&, or a unique slot table, or lock the room row (materialised conflict), or SERIALIZABLE.`],
        [`What should the app do on SQLSTATE 40001?`,`Roll back and re-run the whole transaction (with a retry limit and backoff); the retry will see the other transaction's committed effects.`]]
  },
  exercises: [
    {lv:'E', q:`Invariant: "every department with employees has a manager-level person (title containing Head, Manager or Lead, or the CTO)". First hire <code>(12, 'Zoe', 4, NULL, 'Paralegal', 80000, '2024-01-01')</code> into Legal, then return the departments violating the invariant: <code>dept_id</code>.`, hint:`GROUP BY dept_id HAVING SUM(CASE WHEN title LIKE … THEN 1 ELSE 0 END) = 0.`,
     sql:`INSERT INTO employees VALUES (12, 'Zoe', 4, NULL, 'Paralegal', 80000, '2024-01-01');
SELECT dept_id FROM employees
WHERE dept_id IS NOT NULL
GROUP BY dept_id
HAVING SUM(CASE WHEN title LIKE '%Head%' OR title LIKE '%Manager%' OR title LIKE '%Lead%' OR title = 'CTO' THEN 1 ELSE 0 END) = 0;`},
    {lv:'M', q:`Is it write skew, a lost update, or neither? (a) Two transactions both increment the same counter from 5 to 6. (b) Two users both book the last seat by inserting a booking after checking COUNT(*) &lt; capacity. (c) Two transactions withdraw from two different accounts of the same customer, each checking the combined balance ≥ 0.`, hint:`Same row vs different rows.`,
     answer:`(a) lost update (same row) · (b) write skew via phantom inserts (different new rows) · (c) write skew (different rows, shared invariant).`},
    {lv:'H', q:`Design "a room can't have overlapping bookings" so it's safe under concurrency in Postgres. Give two approaches.`, hint:`Constraints vs locks.`,
     answer:`<ul><li><b>Exclusion constraint</b>: <code>CREATE EXTENSION btree_gist; ALTER TABLE bookings ADD CONSTRAINT no_overlap EXCLUDE USING gist (room_id WITH =, during WITH &amp;&amp;);</code> The database rejects the second overlapping insert regardless of isolation level.</li><li><b>Materialised conflict</b>: in each booking transaction, <code>SELECT … FROM rooms WHERE id = ? FOR UPDATE</code> first, then check overlaps and insert; concurrent bookings of the same room serialise on the room row.</li><li>(Or run at SERIALIZABLE with retries.)</li></ul>`},
  ],
  quiz: [
    [`Write skew involves two transactions that…`,[`Update the same row`,`Read overlapping data and write different rows`,`Read uncommitted data`,`Deadlock`],1,`Disjoint writes, shared premise.`,'M'],
    [`Why doesn't snapshot isolation catch write skew?`,[`It doesn't use snapshots`,`It only detects conflicts when two transactions write the same row`,`It ignores commits`,`It locks too much`],1,`No write-write conflict here.`,'M'],
    [`Which level prevents write skew?`,[`READ COMMITTED`,`REPEATABLE READ (snapshot)`,`SERIALIZABLE`,`READ UNCOMMITTED`],2,`True serializability.`,'E'],
    [`Postgres SERIALIZABLE uses…`,[`Table locks`,`Serializable Snapshot Isolation (tracking rw-dependencies)`,`No checks`,`Two-phase commit`],1,`Aborts on dangerous cycles.`,'M'],
    [`At SERIALIZABLE, the application must…`,[`Do nothing extra`,`Retry transactions that fail with serialization errors`,`Disable indexes`,`Use NOLOCK hints`],1,`SQLSTATE 40001.`,'E'],
    [`"Materialising the conflict" means…`,[`Creating a materialized view`,`Making competing transactions update a shared row so they conflict`,`Logging conflicts`,`Using a bigger server`],1,`Turns write skew into a write-write conflict.`,'H'],
  ],
  quizAdv: [
    [`Why can't SELECT … FOR UPDATE alone prevent double-booking via inserts?`,[`It can`,`There's no existing row to lock for a booking that doesn't exist yet (phantom)`,`It locks too much`,`It's ignored in RR`],1,`Lock a parent row or use a constraint.`,'H'],
    [`Oracle's SERIALIZABLE level is actually…`,[`Strict 2PL`,`Snapshot isolation (allows write skew)`,`READ COMMITTED`,`SSI`],1,`A famous gotcha.`,'H'],
    [`SSI can produce false positives, meaning…`,[`Data corruption`,`Aborting transactions that wouldn't actually have caused an anomaly`,`Missing real anomalies`,`Deadlocks`],1,`Retries cost throughput.`,'H'],
  ],
});
