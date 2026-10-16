/* 6.1 ACID */
topic('6', { no:'6.1', title:'Transactions and ACID', db:'bank',
idea:`Move 50 from Ben to Asha and break it every way possible: crash between the two updates, violate a constraint, let another transaction peek in the middle, pull the plug after COMMIT. Each letter of ACID is the guarantee that saves you from one of these.`,
actors:'Transactions', tbTitle:'accounts', stateTitle:'Guarantee',
codes:{a:`BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;   -- Ben
UPDATE accounts SET balance = balance + 50 WHERE id = 1;   -- Asha
COMMIT;

-- A  atomicity:   both updates or neither (crash → ROLLBACK)
-- C  consistency: constraints hold before and after (balance >= 0)
-- I  isolation:   others never see "money in flight"
-- D  durability:  after COMMIT returns, it survives a crash`},
steps:[
{hl:{T1:[1,2,3,4]}, th:[['T1','NEW:dim','transfer 50 Ben → Asha']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',100],[2,'Ben',250]])], g:[G('Invariant',['total money','350','hot'],['must hold','before and after every transfer'])],
 say:`A <b>transaction</b> is a group of statements the database treats as one logical unit. A transfer is two updates; the business invariant is that money is neither created nor destroyed: Asha + Ben = 350. Let's see what can go wrong without transaction guarantees.`},
{hl:{T1:[2]}, th:[['T1','RUN:ok','debited Ben']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',100],[2,'Ben',200]],{1:'hot'})], g:[G('Mid-transaction',['total right now','300','bad'],['50','"in flight"'])],
 say:`After the first UPDATE, Ben has been debited but Asha not yet credited. The total is 300: 50 is "in flight". This intermediate state must never become permanent, and ideally no one else should ever see it.`},
{hl:{T1:[2,6]}, th:[['T1','BLOCKED:bad','server crashes here']], tb:[TB('accounts after restart',['id','owner','balance'],[[1,'Asha',100],[2,'Ben',250]],{1:'ok'})], g:[G('A: Atomicity',['crash mid-transaction','uncommitted changes undone on recovery','ok'],['explicit ROLLBACK','same effect'],['mechanism','undo info / MVCC versions + WAL (7.1)'])], log:['crash → recovery rolls back T1 → Ben 250 again'],
 say:`<b>Atomicity</b>: all or nothing. If the server crashes between the two updates (or the app calls ROLLBACK, or a statement fails), the database undoes the partial work. After restart Ben has 250 again. "Atomic" here means indivisible as a unit of failure, not a unit of concurrency.`},
{hl:{T1:[2,7]}, th:[['T1','RUN:warn','debit 300 from Ben (has 250)']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',100],[2,'Ben',-50]],{1:'bad'})], g:[G('C: Consistency',['CHECK (balance >= 0)','violated → statement fails','ok'],['database\'s part','constraints, FKs, triggers'],['app\'s part','business invariants it alone knows (total money)'])], log:['CHECK constraint failed: balance >= 0 → transaction rolled back'],
 say:`<b>Consistency</b>: a transaction takes the database from one valid state to another. The database enforces what you declare (CHECK, foreign keys, unique keys): debiting 300 from Ben would make his balance negative, so it fails. Invariants the database doesn't know about ("total money is constant") are the application's job; the C in ACID is partly a promise you make, not just one the database keeps.`},
{hl:{T1:[2],T2:[]}, th:[['T1','RUN:ok','debited Ben, not committed'],['T2','RUN:ok','SELECT SUM(balance)']], tb:[TB('what T2 sees',['owner','balance'],[['Asha',100],['Ben',250]],{1:'ok'})], g:[G('I: Isolation',['T2 reads during T1','sees committed values only','ok'],['total for T2','350, never 300','ok'],['how strong?','isolation levels (6.2)'])], log:['T2: SUM = 350'],
 say:`<b>Isolation</b>: concurrent transactions don't see each other's half-done work. While T1 is between its updates, a report T2 summing balances sees the last committed values, 350, not the in-flight 300. Full isolation (as if transactions ran one at a time) is expensive, so databases offer <b>isolation levels</b> that trade some anomalies for speed; that's the next topic.`},
{hl:{T1:[3,4,9]}, th:[['T1','TERM:ok','COMMIT returned'],['T2','TERM:dim','']], tb:[TB('accounts (on disk)',['id','owner','balance'],[[1,'Asha',150],[2,'Ben',200]],{0:'ok',1:'ok'})], g:[G('D: Durability',['COMMIT returns','change is in the WAL on disk (fsync)','ok'],['power cut 1 ms later','still there after restart','ok'],['replication','durable on replicas too? (sync vs async, 8.1)'])], log:['COMMIT → WAL flushed → client told "OK"'],
 say:`<b>Durability</b>: once COMMIT returns successfully, the change survives crashes and power loss. The database guarantees this by writing the change to its write-ahead log and flushing it to stable storage <i>before</i> acknowledging the commit (7.1). Settings like <code>synchronous_commit = off</code> trade this away for speed.`},
{hl:{}, th:[], tb:[], g:[G('ACID',['Atomicity','all or nothing'],['Consistency','valid state → valid state'],['Isolation','no interference between concurrent transactions'],['Durability','committed = permanent']), G('Also know',['autocommit','each statement is its own transaction by default'],['BASE','NoSQL alternative: basically available, soft state, eventual consistency (8.5)'])],
 say:`<b>Say it:</b> "A transaction groups operations into one unit with ACID guarantees: atomicity, all or nothing even on crash; consistency, constraints hold before and after; isolation, concurrent transactions don't see each other's partial work, with the strength set by the isolation level; and durability, once committed it survives crashes because it's in the write-ahead log." Remember that most drivers run in autocommit mode: without BEGIN, each statement is its own transaction.`}
],
keep:[`Atomicity: all or nothing (crash/ROLLBACK undo partial work).`,`Consistency: constraints hold before and after (app owns non-declared invariants).`,`Isolation: concurrent transactions don't see partial work; strength = isolation level.`,`Durability: COMMIT returned ⇒ in the WAL on disk ⇒ survives crashes.`,`Autocommit: no BEGIN = one statement per transaction.`]}, {
  imp: 'must',
  theory: TH(`A transaction is a group of database operations that succeeds or fails as a unit, and ACID names its four guarantees: atomicity, consistency, isolation and durability.`,
`<p>Real-world actions often need several database changes: transfer money (debit + credit), place an order (order + lines + stock). If only some of them happen, data becomes wrong. A <b>transaction</b> wraps them so they behave as one indivisible action.</p>
<p>Think of a bank teller who writes a transfer on a slip and only stamps it "done" at the end: if anything goes wrong before the stamp, the slip is torn up (atomicity); slips that would overdraw an account are rejected (consistency); other tellers can't read a half-written slip (isolation); and once stamped, it's filed in a fireproof cabinet (durability).</p>`,
[[`Transaction`,`A unit of work: BEGIN … COMMIT/ROLLBACK.`],[`Atomicity`,`All operations take effect, or none do.`],[`Consistency`,`Each transaction preserves declared constraints and invariants.`],[`Isolation`,`Concurrent transactions don't interfere (to a chosen degree).`],[`Durability`,`Committed changes survive crashes.`],[`Autocommit`,`Each statement commits on its own unless a transaction is opened.`],[`Savepoint`,`A point inside a transaction you can roll back to.`]],
[`BEGIN starts a transaction (or the driver does).`,`Statements run; changes are logged and visible only to this transaction.`,`COMMIT makes them durable and visible; ROLLBACK discards them.`,`On crash, recovery redoes committed and undoes uncommitted work.`],
[`@Transactional (Spring), atomic blocks (Django), transaction blocks in every ORM.`,`Keep transactions short: they hold locks and connections.`,`Retry transactions that fail with serialization or deadlock errors.`],
[`Calling external services (HTTP, email) inside a transaction.`,`Long transactions holding locks (and in Postgres, blocking VACUUM).`,`Assuming autocommit when the framework opened a transaction, or vice versa.`,`Believing the database alone guarantees business-level consistency.`]),
  examples: [
    {lv:'basic', title:'A transfer as one transaction', sql:`BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;
UPDATE accounts SET balance = balance + 50 WHERE id = 1;
COMMIT;
SELECT id, owner, balance FROM accounts WHERE id IN (1, 2);`, why:`Asha 150, Ben 200, total unchanged.`},
    {lv:'mid', title:'ROLLBACK undoes everything since BEGIN', sql:`BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;
UPDATE accounts SET balance = balance + 50 WHERE id = 1;
ROLLBACK;
SELECT id, owner, balance FROM accounts WHERE id IN (1, 2);`, why:`Balances unchanged: atomicity via explicit rollback.`},
    {lv:'adv', title:'Consistency: a constraint stops an overdraft', sql:`UPDATE accounts SET balance = balance - 300 WHERE id = 2;`, err:true, why:`<code>CHECK (balance &gt;= 0)</code> rejects it. In a multi-statement transaction the application would then ROLLBACK the whole transfer.`},
  ],
  tips: {
    say:`"A transaction groups operations into one unit. Atomicity: all or nothing, even across crashes. Consistency: it moves the database between valid states, enforced by constraints plus application logic. Isolation: concurrent transactions don't see each other's partial work, to the degree the isolation level specifies. Durability: once committed, the change is in the write-ahead log and survives crashes."`,
    points:[`Give one failure scenario per letter.`,`Say that C is partly the application's responsibility.`,`Mention that isolation has levels (bridge to 6.2) and durability relies on the WAL (7.1).`],
    traps:[`Confusing ACID consistency with CAP consistency (8.5).`,`Saying atomicity means "no concurrency issues".`],
    qa:[[`ACID consistency vs CAP consistency?`,`ACID C: transactions preserve integrity constraints. CAP C: linearizability, every read sees the latest write across replicas. Unrelated concepts sharing a word.`],
        [`How does a database achieve atomicity and durability?`,`Write-ahead logging: changes are logged before data pages; on recovery, committed work is redone and uncommitted work undone (7.1, 7.2).`],
        [`Why shouldn't you call a payment API inside a DB transaction?`,`The transaction holds locks and a connection while waiting on the network; and the external call can't be rolled back. Use the outbox pattern or a saga (8.6).`]]
  },
  exercises: [
    {lv:'E', q:`Transfer 25 from Eli (5) to Diya (4) in one transaction, then return <code>id, balance</code> for both, ordered by id.`, hint:`BEGIN; two UPDATEs; COMMIT; SELECT.`, ordered:true,
     sql:`BEGIN;
UPDATE accounts SET balance = balance - 25 WHERE id = 5;
UPDATE accounts SET balance = balance + 25 WHERE id = 4;
COMMIT;
SELECT id, balance FROM accounts WHERE id IN (4, 5) ORDER BY id;`},
    {lv:'M', q:`Record the transfer in <code>transfers</code> too (id 6, from 5 to 4, amount 25, ts '2024-03-05 10:00') inside the same transaction, then return the total of all balances as <code>total</code>.`, hint:`Three statements between BEGIN and COMMIT. The total must stay 925.`,
     sql:`BEGIN;
UPDATE accounts SET balance = balance - 25 WHERE id = 5;
UPDATE accounts SET balance = balance + 25 WHERE id = 4;
INSERT INTO transfers VALUES (6, 5, 4, 25, '2024-03-05 10:00');
COMMIT;
SELECT SUM(balance) AS total FROM accounts;`},
    {lv:'H', q:`For each ACID property, describe a concrete production bug that happens if it's missing, using an e-commerce checkout (create order, reserve stock, charge card).`, hint:`One bug per letter.`,
     answer:`<ul><li><b>A</b>: crash after the order row but before stock reservation → order exists with no stock held, oversold later.</li><li><b>C</b>: no CHECK on stock ≥ 0 → concurrent reservations drive stock negative.</li><li><b>I</b>: a reporting query sees the order but not its lines → revenue dashboards undercount; or two checkouts both read stock = 1 and both reserve.</li><li><b>D</b>: commit acknowledged, power fails, order gone → customer charged for an order that doesn't exist.</li></ul><p>And the card charge itself is outside the DB transaction: use an idempotent payment call plus an outbox/saga.</p>`},
  ],
  quiz: [
    [`Atomicity guarantees…`,[`Transactions run one at a time`,`All of a transaction's changes happen or none do`,`Data is never lost after commit`,`Constraints are checked`],1,`All or nothing.`,'E'],
    [`Durability is typically implemented with…`,[`Indexes`,`A write-ahead log flushed before COMMIT returns`,`Replication only`,`Caching`],1,`WAL + fsync.`,'E'],
    [`Isolation means…`,[`Each transaction has its own server`,`Concurrent transactions don't see each other's partial work (to a degree)`,`No locks are used`,`Only one user at a time`],1,`Strength = isolation level.`,'E'],
    [`A CHECK constraint failing during a transaction relates to…`,[`Atomicity`,`Consistency`,`Isolation`,`Durability`],1,`Valid state to valid state.`,'E'],
    [`In autocommit mode, an UPDATE…`,[`Waits for an explicit COMMIT`,`Commits immediately on its own`,`Is rolled back at disconnect`,`Is buffered`],1,`Each statement is a transaction.`,'M'],
    [`ACID "C" vs CAP "C"…`,[`Same thing`,`Different: integrity constraints vs linearizable reads across replicas`,`CAP C is stronger ACID C`,`Both mean durability`],1,`Common interview trap.`,'M'],
  ],
  quizAdv: [
    [`Postgres synchronous_commit = off risks…`,[`Corruption`,`Losing the last few hundred ms of committed transactions on a crash (no corruption)`,`Dirty reads`,`Deadlocks`],1,`Trades durability for latency.`,'H'],
    [`A transaction holding locks while waiting on a slow HTTP call causes…`,[`Nothing`,`Lock contention, connection pool exhaustion and possibly cascading timeouts`,`Data loss`,`Dirty reads`],1,`Keep transactions short.`,'H'],
    [`Which ACID property is the database least able to guarantee on its own?`,[`Atomicity`,`Consistency (business invariants not declared as constraints)`,`Isolation`,`Durability`],1,`The app must preserve invariants.`,'M'],
  ],
});
