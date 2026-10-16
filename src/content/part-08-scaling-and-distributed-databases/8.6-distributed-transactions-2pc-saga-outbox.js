/* 8.6 Distributed transactions: two-phase commit, sagas, outbox */
topic('8', { no:'8.6', title:'Distributed transactions: two-phase commit, sagas, transactional outbox', db:'shop',
idea:`An order spans two databases: orders and payments. Run two-phase commit (prepare, then commit) and watch it block when the coordinator dies; then do it the microservices way, with a saga of local transactions and compensations, and an outbox that makes "save + publish event" atomic.`,
actors:'Participants', dgTitle:'Coordinator and participants', stateTitle:'Protocol', tbTitle:'Outbox',
nodes:{
  co:{x:250,y:40,label:'coordinator',w:130,kind:'actor'},
  a:{x:110,y:170,label:'orders DB',w:120,h:46,kind:'db'},
  b:{x:390,y:170,label:'payments DB',w:130,h:46,kind:'db'}
},
edges:[['co','a'],['co','b']],
vb:'0 0 500 220',
codes:{a:`-- two-phase commit (2PC)
phase 1 PREPARE:  coordinator → all: "can you commit?"
                  each participant writes everything durably, holds locks, votes YES/NO
phase 2 COMMIT:   all YES → "commit" to all;  any NO → "abort" to all
-- Postgres: PREPARE TRANSACTION 'tx42';  COMMIT PREPARED 'tx42';

-- saga: a sequence of LOCAL transactions + compensations
1. orders:    create order (PENDING)          ↩ cancel order
2. payments:  charge card                     ↩ refund
3. inventory: reserve stock   ✗ out of stock  → run compensations backwards

-- transactional outbox: state change + event in ONE local transaction
BEGIN;
INSERT INTO orders …;
INSERT INTO outbox (event) VALUES ('OrderCreated {id: 111}');
COMMIT;            -- a relay (poller or CDC) publishes outbox rows to Kafka`},
steps:[
{hl:{q:[1]}, th:[['orders','NEW:dim',''],['payments','NEW:dim','']], d:{on:['a','b']}, g:[G('The problem',['one business action','writes to 2 databases'],['local transactions','each atomic on its own'],['need','both commit or neither','hot'],['naive: commit A then B','crash in between → inconsistent','bad'])],
 say:`Placing an order writes to the orders database and the payments database. Each has its own ACID transactions, but nothing makes them commit <i>together</i>. Commit orders, crash before payments commits, and you have an order without a payment. That's the <b>distributed transaction</b> problem.`},
{hl:{q:[2,3]}, th:[['orders','WAITING:warn','prepared, locks held'],['payments','WAITING:warn','prepared, locks held']], d:{on:['co'], e:[['co','a','PREPARE','hot'],['co','b','PREPARE','hot'],['a','co','YES','ok'],['b','co','YES','ok']]}, g:[G('Phase 1: prepare',['participant','writes all changes + a PREPARED record durably','hot'],['promise','"I can commit no matter what, if you tell me to"'],['locks','kept until phase 2','bad'],['vote','YES / NO'])],
 say:`<b>Two-phase commit</b>, phase 1: the coordinator asks every participant to <b>prepare</b>. Each one does all the work, makes it durable, keeps its locks, and votes YES, which is a promise: "if you say commit, I will commit, even after a crash". Any participant can vote NO.`},
{hl:{q:[4,5]}, th:[['orders','TERM:ok','committed'],['payments','TERM:ok','committed']], d:{on:['co'], e:[['co','a','COMMIT','ok'],['co','b','COMMIT','ok']]}, g:[G('Phase 2: commit / abort',['all YES','coordinator logs COMMIT, tells everyone','ok'],['any NO / timeout','ABORT to everyone'],['atomic','across databases','ok'])], log:['all YES → COMMIT'],
 say:`Phase 2: if everyone voted YES, the coordinator durably records the decision COMMIT and tells all participants; otherwise ABORT. Now both databases commit or neither does. XA transactions (Java EE, MySQL XA) and Postgres <code>PREPARE TRANSACTION</code> implement this.`},
{hl:{q:[2,3]}, th:[['orders','BLOCKED:bad','prepared… waiting forever'],['payments','BLOCKED:bad','prepared… waiting forever']], d:{bad:['co'], e:[['co','a','?','bad dash'],['co','b','?','bad dash']]}, g:[G('2PC weakness',['coordinator crashes after prepare','participants are "in doubt"','bad'],['they can\'t decide alone','holding locks until it returns','bad'],['availability','blocked','bad'],['in practice','rare across microservices; used inside distributed DBs with consensus'])], log:['coordinator down: participants blocked with locks held'],
 say:`The catch: if the coordinator crashes <b>after</b> participants voted YES, they're <b>in doubt</b>. They promised to obey and can't decide alone, so they wait, holding locks, possibly for a long time. 2PC is a <b>blocking</b> protocol, adds round trips to every transaction, and needs all participants to support it. Distributed databases (Spanner, CockroachDB) make the coordinator itself replicated via consensus; across microservices it's usually avoided.`},
{hl:{q:[7,8,9,10]}, th:[['orders','TERM:ok','order PENDING → CANCELLED'],['payments','TERM:ok','charged → refunded'],['inventory','TERM:bad','out of stock']], d:null, g:[G('Saga',['steps','local transactions, each committed immediately'],['failure','run compensating actions in reverse','hot'],['consistency','eventual; intermediate states visible (PENDING)'],['coordination','orchestration (central workflow) or choreography (events)'],['compensations','must be idempotent; some actions can\'t be undone (emails)','bad'])], log:['reserve stock failed → refund → cancel order'],
 say:`A <b>saga</b> replaces one big atomic transaction with a sequence of <b>local</b> transactions, each with a <b>compensating action</b>. Create the order (PENDING), charge the card, reserve stock; when reserving fails, run compensations backwards: refund, cancel. No locks across services, no blocking; but intermediate states are visible and consistency is <b>eventual</b>, so design states like PENDING explicitly.`},
{hl:{q:[12,13,14,15,16]}, th:[], d:null, tb:[TB('outbox',['id','event','published'],[[1,'OrderCreated {id: 111}','no']],{0:'new'})], g:[G('Dual-write problem',['save to DB, then publish to Kafka','crash between → lost event','bad'],['publish, then save','crash → event for nothing','bad']), G('Transactional outbox',['event row in the same local transaction','atomic with the change','ok'],['relay','poll outbox or CDC (Debezium) → broker','ok'],['delivery','at least once → consumers idempotent'])],
 say:`Sagas and event-driven systems hit the <b>dual-write problem</b>: "save the order and publish OrderCreated" are two systems; a crash in between loses or invents an event. The <b>transactional outbox</b> fixes it: write the event into an <code>outbox</code> table in the <i>same local transaction</i> as the order. A relay (a poller or change-data-capture like Debezium) publishes outbox rows to the broker. Delivery is at-least-once, so consumers must be idempotent (10.5).`},
{hl:{}, th:[], d:null, tb:[], g:[G('Choose',['inside one DB','just a local transaction','ok'],['distributed SQL DB','built-in 2PC + consensus (transparent)','ok'],['across services','saga + outbox + idempotency','ok'],['avoid','XA across heterogeneous services in hot paths','bad'])],
 say:`<b>Say it:</b> "Two-phase commit gets atomicity across databases with a prepare phase, where participants durably promise, and a commit phase; but it's blocking if the coordinator fails and it holds locks across systems. Across microservices I use sagas: local transactions with compensating actions, orchestrated or choreographed, accepting eventual consistency. And I use a transactional outbox so a state change and its event are written atomically, with idempotent consumers."`}
],
keep:[`2PC: prepare (durable promise, locks held, vote) → commit/abort. Atomic across DBs.`,`2PC is blocking if the coordinator dies after prepare; costly; needs all participants' support.`,`Saga: local transactions + compensations in reverse; eventual consistency; orchestration or choreography.`,`Outbox: write event in the same local transaction; relay/CDC publishes; consumers idempotent.`]}, {
  imp: 'good',
  theory: TH(`When one business operation spans several databases or services, two-phase commit can make it atomic at the cost of blocking, while sagas and the outbox pattern trade atomicity for availability with compensations and reliable events.`,
`<p>A wedding ceremony is two-phase commit: the officiant asks each party "do you?" (prepare), and only when both say yes declares them married (commit). If the officiant faints after both said yes, everyone stands there unsure: that's 2PC blocking.</p>
<p>A trip booking is a saga: book the flight, then the hotel, then the car; if the car fails, cancel the hotel and the flight. Each booking is final on its own, and failures are handled by explicit undo steps.</p>`,
[[`Distributed transaction`,`One logical transaction across several resources.`],[`Two-phase commit (2PC)`,`Prepare/vote, then commit/abort.`],[`Coordinator / participant`,`The decider / the resources.`],[`In-doubt transaction`,`Prepared but waiting for the decision.`],[`Saga`,`Sequence of local transactions with compensations.`],[`Orchestration / choreography`,`Central workflow / services react to events.`],[`Transactional outbox`,`Store events in the same DB transaction as the state change.`],[`CDC`,`Change data capture: streaming DB changes (e.g. Debezium).`]],
[`2PC: coordinator sends PREPARE; participants persist and vote.`,`Coordinator logs the decision and sends COMMIT/ABORT.`,`Saga: execute step i; on failure, run compensations for steps i−1…1.`,`Outbox: commit state + event; relay publishes; consumers dedupe.`],
[`Distributed SQL (Spanner, CockroachDB, YugabyteDB) use 2PC internally with consensus-replicated coordinators.`,`Microservices: sagas via Temporal/Camunda (orchestration) or Kafka events (choreography).`,`Outbox + Debezium is a standard pattern for reliable events.`],
[`Calling another service's API inside a local DB transaction and assuming atomicity.`,`Publishing events directly after commit (dual write).`,`Non-idempotent compensations or consumers.`,`Forgetting that saga intermediate states are visible to users.`]),
  examples: [
    {lv:'basic', title:'The outbox: state and event in one transaction', sql:`CREATE TABLE outbox (id INTEGER PRIMARY KEY, event TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0);
BEGIN;
INSERT INTO orders VALUES (111, 4, '2024-05-01', 'placed');
INSERT INTO outbox (event) VALUES ('{"type":"OrderCreated","order_id":111}');
COMMIT;
SELECT * FROM outbox;`, why:`Both rows commit together or not at all: no lost or phantom events.`},
    {lv:'mid', title:'The relay: publish and mark, at least once', sql:`CREATE TABLE outbox (id INTEGER PRIMARY KEY, event TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0);
INSERT INTO outbox (event) VALUES ('OrderCreated 111'), ('OrderCreated 112');
-- relay loop: read unpublished in order, send to the broker, then mark
SELECT id, event FROM outbox WHERE published = 0 ORDER BY id;
UPDATE outbox SET published = 1 WHERE id IN (1, 2);
SELECT COUNT(*) AS still_pending FROM outbox WHERE published = 0;`, why:`If the relay crashes after sending but before marking, it resends: at-least-once delivery, so consumers deduplicate by event id.`},
    {lv:'adv', title:'A saga with compensations', sql:`CREATE TABLE saga_log (step INTEGER, action TEXT, status TEXT);
INSERT INTO orders VALUES (111, 4, '2024-05-01', 'placed');        INSERT INTO saga_log VALUES (1, 'create order', 'done');
INSERT INTO saga_log VALUES (2, 'charge card', 'done');
INSERT INTO saga_log VALUES (3, 'reserve stock', 'failed');
-- compensate completed steps in reverse order
INSERT INTO saga_log VALUES (2, 'refund card', 'compensated');
UPDATE orders SET status = 'cancelled' WHERE id = 111;              INSERT INTO saga_log VALUES (1, 'cancel order', 'compensated');
SELECT * FROM saga_log;
SELECT id, status FROM orders WHERE id = 111;`, why:`Each step commits locally; the failure at step 3 triggers compensations for steps 2 and 1. The order ends "cancelled", not deleted: sagas leave an auditable trail.`},
  ],
  tips: {
    say:`"Two-phase commit gives atomicity across databases: participants prepare and durably promise, then the coordinator commits or aborts everyone. It's blocking if the coordinator fails after prepare and holds locks across systems, so across microservices I use sagas, local transactions with compensating actions, plus a transactional outbox so state changes and events are atomic, with idempotent consumers."`,
    points:[`Explain the "in doubt" blocking scenario.`,`Contrast orchestration vs choreography.`,`Name the dual-write problem and the outbox fix.`],
    traps:[`Proposing 2PC across third-party APIs (they don't support prepare).`,`Forgetting idempotency for at-least-once delivery.`],
    qa:[[`Why is 2PC called blocking?`,`After voting YES, a participant can't unilaterally commit or abort; if the coordinator is down it must wait, holding locks.`],
        [`Orchestration vs choreography?`,`Orchestration: a central coordinator (workflow engine) calls each step and compensations: clear, observable. Choreography: services react to each other's events: decoupled, but the flow is implicit and harder to trace.`],
        [`How do you guarantee an event is published when a row is saved?`,`Transactional outbox: insert the event in the same transaction; a relay or CDC publishes it; consumers dedupe by event id.`]]
  },
  exercises: [
    {lv:'E', q:`Create an outbox table and, in one transaction, cancel order 107 and record an <code>'OrderCancelled 107'</code> event. Return the outbox events: <code>event</code>.`, hint:`BEGIN; UPDATE orders …; INSERT INTO outbox …; COMMIT.`,
     sql:`CREATE TABLE outbox (id INTEGER PRIMARY KEY, event TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0);
BEGIN;
UPDATE orders SET status = 'cancelled' WHERE id = 107;
INSERT INTO outbox (event) VALUES ('OrderCancelled 107');
COMMIT;
SELECT event FROM outbox;`},
    {lv:'M', q:`A consumer receives events at least once. Make processing idempotent: create <code>processed(event_id PRIMARY KEY)</code>, "process" events 1, 2, 1 (duplicate) by inserting with OR IGNORE, and return how many distinct events were processed as <code>n</code>.`, hint:`INSERT OR IGNORE INTO processed VALUES (…).`,
     sql:`CREATE TABLE processed (event_id INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO processed VALUES (1);
INSERT OR IGNORE INTO processed VALUES (2);
INSERT OR IGNORE INTO processed VALUES (1);
SELECT COUNT(*) AS n FROM processed;`},
    {lv:'H', q:`Design the checkout saga for: create order, reserve inventory, charge payment, send confirmation email. Give the order of steps, each compensation, and where you'd put the step that can't be undone.`, hint:`Put irreversible and least-likely-to-fail steps last.`,
     answer:`<ol><li>Create order (PENDING) — compensation: mark CANCELLED.</li><li>Reserve inventory (with expiry) — compensation: release reservation.</li><li>Charge payment (idempotency key) — compensation: refund.</li><li>Mark order CONFIRMED, then send email via outbox — email is irreversible, so it goes last, only after everything succeeded.</li></ol><p>Orchestrate with a workflow engine or a state machine persisted in the orders DB; every step and compensation is idempotent and retried.</p>`},
  ],
  quiz: [
    [`2PC phase 1 is…`,[`Commit`,`Prepare/vote: participants durably promise they can commit`,`Rollback`,`Replication`],1,`Then commit/abort.`,'E'],
    [`2PC's main weakness?`,[`Can't abort`,`Participants block (holding locks) if the coordinator fails after prepare`,`No atomicity`,`Requires NoSQL`],1,`In-doubt transactions.`,'M'],
    [`A saga handles failure by…`,[`Rolling back a global transaction`,`Running compensating local transactions in reverse`,`Retrying forever`,`Locking all services`],1,`Eventual consistency.`,'E'],
    [`The transactional outbox solves…`,[`Deadlocks`,`The dual-write problem between the DB and the message broker`,`Slow queries`,`Replication lag`],1,`State + event atomically.`,'M'],
    [`Outbox relays deliver events…`,[`Exactly once by magic`,`At least once, so consumers must be idempotent`,`At most once`,`Never in order`],1,`Dedupe by event id.`,'M'],
    [`Where should an irreversible step (sending email) go in a saga?`,[`First`,`Last, after the steps that can fail`,`In parallel with everything`,`Inside 2PC`],1,`Can't compensate it.`,'M'],
  ],
  quizAdv: [
    [`Three-phase commit (3PC) aims to…`,[`Add durability`,`Reduce blocking by adding a pre-commit phase (but assumes bounded network delays)`,`Replace sagas`,`Speed up commits`],1,`Rarely used in practice.`,'H'],
    [`Spanner/CockroachDB make 2PC non-blocking by…`,[`Skipping prepare`,`Replicating coordinator and participant state with Paxos/Raft`,`Using LWW`,`Using sagas`],1,`A failed coordinator's state survives.`,'H'],
    [`Saga isolation problem: another request sees an order "charged but not yet stock-reserved". Mitigation?`,[`Ignore it`,`Semantic locks/states (PENDING), commutative updates, or reordering steps`,`2PC`,`Bigger timeouts`],1,`Sagas lack isolation.`,'H'],
  ],
});
