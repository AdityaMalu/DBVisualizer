/* 10.4 Scenario: zero-downtime schema migrations */
topic('10', { no:'10.4', title:'Scenario: zero-downtime schema migrations (expand → migrate → contract)', db:'shop',
idea:`Rename customers.name to full_name on a busy production table without breaking running code or locking the table. Step through why a plain ALTER can cause an outage, then the expand/migrate/contract dance: add, dual-write, backfill in batches, switch reads, and only then drop.`,
actors:'Deploys', stateTitle:'Migration step', tbTitle:'customers',
codes:{a:`-- ✗ one-shot: old app instances still read "name" → errors during the deploy
ALTER TABLE customers RENAME COLUMN name TO full_name;

-- ✓ expand / migrate / contract
-- 1. EXPAND: add the new column (nullable, no default rewrite)
ALTER TABLE customers ADD COLUMN full_name TEXT;
-- 2. deploy app v2: write BOTH columns, still read name
-- 3. BACKFILL in batches (short transactions, throttled)
UPDATE customers SET full_name = name
WHERE full_name IS NULL AND id BETWEEN :lo AND :hi;
-- 4. deploy app v3: read full_name (write both)
-- 5. add constraints safely (NOT NULL via CHECK … NOT VALID, then VALIDATE)
-- 6. deploy app v4: stop writing name
-- 7. CONTRACT: drop the old column
ALTER TABLE customers DROP COLUMN name;

-- lock safety: SET lock_timeout = '2s'; CREATE INDEX CONCURRENTLY …`},
steps:[
{hl:{q:[1,2]}, th:[['app v1 (old pods)','BLOCKED:bad','SELECT name → ERROR'],['app v2 (new pods)','RUN:ok','SELECT full_name']], tb:[TB('customers',['id','full_name'],[[1,'Asha'],[2,'Ben']])], g:[G('Why one-shot changes break',['rolling deploys','old and new code run at the same time','hot'],['rename/drop','old code fails immediately','bad'],['some ALTERs','take ACCESS EXCLUSIVE locks / rewrite the table','bad'],['lock queue','one waiting ALTER blocks every query behind it','bad'])],
 say:`In production, deploys are rolling: for minutes, old and new versions of the app run side by side. Rename the column in one step and every old instance starts failing. Some ALTERs also take an exclusive lock or rewrite the whole table; worse, an ALTER waiting for its lock blocks <i>every</i> query queued behind it. Schema changes must be compatible with both the old and the new code.`},
{hl:{q:[4,5,6]}, th:[['app v1','RUN:ok','reads/writes name'],['migration','TERM:ok','ADD COLUMN full_name']], tb:[TB('customers',['id','name','full_name'],[[1,'Asha',null],[2,'Ben',null]],{0:'new',1:'new'})], g:[G('1. Expand',['add the new column','nullable, no volatile default','ok'],['cost','metadata-only in Postgres 11+ / MySQL 8 INSTANT','ok'],['old code','unaffected','ok'],['lock_timeout','fail fast instead of queueing behind long queries','ok'])],
 say:`<b>Expand</b>: add the new column alongside the old one. Adding a nullable column (or one with a constant default in modern Postgres/MySQL) is a quick metadata change. Old code ignores it. Set a short <code>lock_timeout</code> so the migration gives up rather than blocking traffic if it can't get its brief lock.`},
{hl:{q:[7]}, th:[['app v2','RUN:ok','writes name AND full_name; reads name']], tb:[TB('customers',['id','name','full_name'],[[1,'Asha',null],[2,'Ben',null],[8,'Hana','Hana']],{2:'new'})], g:[G('2. Dual write',['new/updated rows','fill both columns','ok'],['reads','still from the old column'],['alternative','trigger that copies name → full_name'])],
 say:`Deploy app v2, which <b>writes both</b> columns but still reads the old one. From now on, every new or updated row has full_name filled in. (A database trigger can do the dual write instead of application code.) Rolling back is trivial at this point: v1 still works.`},
{hl:{q:[8,9,10]}, th:[['backfill job','RUN:ok','batch 1 … 1000 of 50,000']], tb:[TB('customers',['id','name','full_name'],[[1,'Asha','Asha'],[2,'Ben','Ben'],[8,'Hana','Hana']],{0:'ok',1:'ok'})], g:[G('3. Backfill in batches',['small batches','e.g. 1–10k rows per transaction','ok'],['why','short locks, bounded WAL, replicas keep up','ok'],['throttle','sleep between batches; watch replication lag'],['idempotent','WHERE full_name IS NULL: safe to rerun','ok'])], log:['backfilled 50M rows in 5,000 batches over 2 h'],
 say:`<b>Backfill</b> existing rows in small batches by primary-key range: each transaction is short (brief row locks, bounded WAL, replicas don't fall behind), and the job is idempotent (<code>WHERE full_name IS NULL</code>) so it can be paused and resumed. One giant UPDATE of 50M rows would hold locks for ages, bloat the table and lag every replica.`},
{hl:{q:[11,12]}, th:[['app v3','RUN:ok','reads full_name, writes both']], g:[G('4–5. Switch reads, add constraints',['reads','now from full_name','hot'],['verify','no NULLs left; compare samples'],['NOT NULL safely','ADD CONSTRAINT … CHECK (full_name IS NOT NULL) NOT VALID; then VALIDATE (no long lock)','ok'],['indexes','CREATE INDEX CONCURRENTLY','ok'])],
 say:`Once the backfill is verified, deploy v3 that <b>reads the new column</b> (still writing both, so rolling back to v2 stays safe). Add constraints without long locks: in Postgres, add a CHECK as <code>NOT VALID</code> (instant) and <code>VALIDATE</code> it separately (scans without blocking writes); build indexes CONCURRENTLY.`},
{hl:{q:[13,14,15]}, th:[['app v4','RUN:ok','only full_name'],['migration','TERM:ok','DROP COLUMN name']], tb:[TB('customers',['id','full_name'],[[1,'Asha'],[2,'Ben'],[8,'Hana']],{0:'ok',1:'ok',2:'ok'})], g:[G('6–7. Contract',['stop writing old column','deploy v4'],['wait','until no running code references it'],['drop','metadata change (space reclaimed later)'],['now','the rename is done, zero downtime','ok'])],
 say:`Deploy v4, which no longer touches <code>name</code>. After confirming nothing references it (including reports, ETL jobs, replicas' consumers), <b>contract</b>: drop the old column. The rename is complete and at no point were users affected. Every step was backward compatible and individually reversible.`},
{hl:{q:[17]}, th:[], tb:[], g:[G('Rules',['every step compatible with N and N−1 app versions','ok'],['never rewrite/lock big tables inline','use online tools','ok'],['lock_timeout + retries','ok'],['batches + throttling for data changes','ok'],['tools','gh-ost / pt-osc (MySQL), pg-osc, Flyway/Liquibase for versioning'])],
 say:`<b>Say it:</b> "I use expand/migrate/contract so every step is compatible with both the old and new app versions running during a rolling deploy: add the new column, dual-write, backfill in small throttled batches, switch reads, add constraints with NOT VALID then VALIDATE and indexes CONCURRENTLY, stop writing the old column, and only then drop it. I set lock_timeout so DDL never queues behind long queries, and use online schema change tools for table rewrites."`}
],
keep:[`Rolling deploys = old + new code at once → each schema step must be backward compatible.`,`Expand (add) → dual-write → backfill in batches → switch reads → contract (drop).`,`Avoid long locks/rewrites: lock_timeout, CONCURRENTLY, NOT VALID + VALIDATE, online schema change tools.`,`Backfills: small, idempotent, throttled batches; watch replication lag.`]}, {
  imp: 'good',
  theory: TH(`Zero-downtime migrations change a live schema in small backward-compatible steps (expand, migrate, contract) so that old and new application versions keep working and no step holds long locks.`,
`<p>Renovating a shop while it stays open: you don't close the old entrance before the new one works. You build the new entrance (expand), guide customers through both for a while (dual write), move the stock (backfill), switch the signs (switch reads), and only then brick up the old door (contract).</p>
<p>The database adds two extra hazards: some schema changes lock tables or rewrite every row, and large data updates in one transaction strain locks, logs and replicas. Each step must be small and safe.</p>`,
[[`Rolling deploy`,`Old and new app versions run simultaneously during rollout.`],[`Expand / contract`,`Add new structures first; remove old ones last.`],[`Dual write`,`Writing both old and new representations.`],[`Backfill`,`Populating new structures for existing rows.`],[`lock_timeout`,`Max time a statement waits for a lock.`],[`NOT VALID / VALIDATE`,`Add a constraint now, check existing rows later without blocking writes (Postgres).`],[`Online schema change`,`Tools (gh-ost, pt-osc) that copy a table in the background and swap.`]],
[`Plan the change as a sequence of compatible steps.`,`Expand the schema; deploy code that writes both.`,`Backfill in batches; verify.`,`Switch reads; add constraints/indexes online.`,`Stop old writes; contract.`],
[`Column renames, type changes, splitting tables, adding NOT NULL columns, adding foreign keys.`,`Flyway/Liquibase/Alembic migrations reviewed for locking behaviour.`,`Feature flags controlling read/write switches.`],
[`Renaming or dropping columns in the same deploy as the code change.`,`Adding a column with a volatile default or changing a type that rewrites the table.`,`One huge backfill UPDATE.`,`Migrations without lock_timeout queueing behind long transactions.`]),
  examples: [
    {lv:'basic', title:'Expand: add the new column', sql:`ALTER TABLE customers ADD COLUMN full_name TEXT;
SELECT id, name, full_name FROM customers ORDER BY id LIMIT 3;`, why:`Old code keeps using name; full_name is empty for now.`},
    {lv:'mid', title:'Dual write with a trigger, then batch backfill', sql:`ALTER TABLE customers ADD COLUMN full_name TEXT;
CREATE TRIGGER trg_dual_write AFTER UPDATE OF name ON customers FOR EACH ROW
BEGIN UPDATE customers SET full_name = NEW.name WHERE id = NEW.id; END;
-- backfill batch 1 (ids 1–3), batch 2 (ids 4–7): short transactions, idempotent
UPDATE customers SET full_name = name WHERE full_name IS NULL AND id BETWEEN 1 AND 3;
UPDATE customers SET full_name = name WHERE full_name IS NULL AND id BETWEEN 4 AND 7;
UPDATE customers SET name = 'Asha K' WHERE id = 1;          -- a live write during migration
SELECT id, name, full_name FROM customers ORDER BY id;`, why:`Backfill covers existing rows; the trigger keeps full_name in sync for writes that happen meanwhile (Asha's rename).`},
    {lv:'adv', title:'Contract: rebuild without the old column (SQLite-style)', sql:`ALTER TABLE customers ADD COLUMN full_name TEXT;
UPDATE customers SET full_name = name;
ALTER TABLE customers DROP COLUMN name;          -- SQLite 3.35+ supports DROP COLUMN
SELECT * FROM customers ORDER BY id LIMIT 3;`, why:`Only after every reader and writer has moved to full_name. Postgres DROP COLUMN is metadata-only; MySQL may rebuild the table (use online DDL).`},
  ],
  tips: {
    say:`"Because rolling deploys run old and new code together, I make each schema step backward compatible: expand by adding the new column, dual-write, backfill in small throttled idempotent batches, switch reads, add constraints with NOT VALID then VALIDATE and indexes CONCURRENTLY, stop writing the old column, then drop it. Every DDL runs with a short lock_timeout, and table rewrites go through online schema change tools."`,
    points:[`Explain why a direct rename breaks rolling deploys.`,`Describe the lock-queue hazard.`,`Mention batching and replication lag for backfills.`],
    traps:[`"Just run ALTER TABLE during a maintenance window" for a 24/7 service.`,`Backfilling 100M rows in one UPDATE.`],
    qa:[[`How do you add a NOT NULL column with a default to a huge table?`,`Modern Postgres (11+) and MySQL 8 handle constant defaults as metadata. Otherwise: add nullable, backfill in batches, then add NOT NULL via CHECK NOT VALID + VALIDATE (Postgres) or online DDL.`],
        [`Why can a quick ALTER cause an outage?`,`It needs a brief ACCESS EXCLUSIVE lock; if a long query holds a conflicting lock, the ALTER waits, and every new query queues behind the ALTER. lock_timeout prevents the pile-up.`],
        [`How do you change a column's type safely?`,`Add a new column of the new type, dual-write, backfill, switch reads, drop the old one (same as a rename).`]]
  },
  exercises: [
    {lv:'E', q:`Expand step: add <code>phone TEXT</code> to customers and return <code>id, phone</code> for the first two customers.`, hint:`ALTER TABLE … ADD COLUMN.`,
     sql:`ALTER TABLE customers ADD COLUMN phone TEXT;
SELECT id, phone FROM customers ORDER BY id LIMIT 2;`},
    {lv:'M', q:`Backfill a new <code>email_lower</code> column in two batches (ids 1–4, then 5–7) and return how many rows are still NULL as <code>remaining</code> (should be the customers with NULL email).`, hint:`UPDATE … SET email_lower = lower(email) WHERE email_lower IS NULL AND id BETWEEN …`,
     sql:`ALTER TABLE customers ADD COLUMN email_lower TEXT;
UPDATE customers SET email_lower = lower(email) WHERE email_lower IS NULL AND id BETWEEN 1 AND 4;
UPDATE customers SET email_lower = lower(email) WHERE email_lower IS NULL AND id BETWEEN 5 AND 7;
SELECT COUNT(*) AS remaining FROM customers WHERE email_lower IS NULL;`},
    {lv:'H', q:`Plan a zero-downtime split of <code>users.address</code> (free text) into a new <code>addresses</code> table (user_id FK, line1, city, zip) for a 200M-row table with rolling deploys. List the steps and the rollback point at each.`, hint:`Expand, dual-write, backfill, switch reads, contract.`,
     answer:`<ol><li>Create addresses table + index on user_id (CONCURRENTLY) — rollback: drop it.</li><li>Deploy v2: on address write, also upsert into addresses (or trigger); reads from users.address — rollback: deploy v1.</li><li>Backfill: parse users.address into addresses in batches of 5k by id, throttled, idempotent (ON CONFLICT DO NOTHING) — pause/resume anytime.</li><li>Verify counts and samples; fix parse failures.</li><li>Deploy v3: read from addresses (feature flag), still dual-write — rollback: flip the flag.</li><li>Deploy v4: stop writing users.address — rollback: v3.</li><li>After a safe period and checking ETL/reports: DROP COLUMN users.address.</li></ol>`},
  ],
  quiz: [
    [`Why does renaming a column in one deploy break things?`,[`Renames are slow`,`During a rolling deploy, old app instances still use the old name`,`Indexes are lost`,`It's not SQL`],1,`Old + new code coexist.`,'E'],
    [`Correct order of expand/contract?`,[`Drop old, add new`,`Add new → dual-write → backfill → switch reads → stop old writes → drop old`,`Backfill → add → drop`,`Rename then fix`],1,`Each step compatible.`,'E'],
    [`Why backfill in small batches?`,[`SQL limits`,`Short transactions: brief locks, bounded WAL, replicas keep up`,`Faster overall`,`Indexes require it`],1,`Throttle too.`,'M'],
    [`lock_timeout on migrations prevents…`,[`Deadlocks`,`A waiting ALTER from blocking all queries queued behind it`,`Replication lag`,`Data loss`],1,`Fail fast, retry.`,'M'],
    [`Adding NOT NULL to a big Postgres table without a long lock:`,[`ALTER COLUMN SET NOT NULL directly`,`CHECK (col IS NOT NULL) NOT VALID, then VALIDATE CONSTRAINT`,`DROP and recreate`,`TRUNCATE first`],1,`VALIDATE doesn't block writes.`,'H'],
    [`Building an index on a busy Postgres table:`,[`CREATE INDEX`,`CREATE INDEX CONCURRENTLY`,`REINDEX`,`VACUUM`],1,`No write blocking.`,'E'],
  ],
  quizAdv: [
    [`MySQL table rewrites without blocking writes typically use…`,[`TRUNCATE`,`gh-ost or pt-online-schema-change (shadow table + triggers/binlog, then swap)`,`Replication only`,`LOCK TABLES`],1,`Or native online DDL when supported.`,'H'],
    [`Why keep dual writes through the "switch reads" step?`,[`Performance`,`So you can roll back to the previous version without losing data`,`Required by SQL`,`To save storage`],1,`Reversibility.`,'H'],
    [`In Postgres 11+, which ADD COLUMN default forces a full table rewrite?`,[`DEFAULT 0`,`DEFAULT 'active'`,`DEFAULT now()`,`DEFAULT clock_timestamp()`],3,`Constants and stable expressions like now() are evaluated once and stored as metadata; a volatile function needs a different value per row, so every row is rewritten.`,'H'],
  ],
});
