/* 0.5 SQL sublanguages and data types */
topic('0', { no:'0.5', title:'SQL sublanguages (DDL, DML, DCL, TCL) and data types', db:'shop',
idea:`One short session that touches all four families of SQL: define a table, fill it, control who can see it, and wrap changes in a transaction. Along the way, pick data types that won't bite you later (money, dates, text).`,
stateTitle:'Which family?', tbTitle:'Table',
codes:{a:`-- DDL: data definition (structure)
CREATE TABLE payments (
  id          BIGINT PRIMARY KEY,
  amount      NUMERIC(12,2) NOT NULL,      -- money: exact decimal
  currency    CHAR(3) NOT NULL,
  paid_at     TIMESTAMP WITH TIME ZONE,
  note        VARCHAR(200)
);
ALTER TABLE payments ADD COLUMN method TEXT;

-- DML: data manipulation (rows)
INSERT INTO payments (id, amount, currency) VALUES (1, 19.99, 'EUR');
UPDATE payments SET method = 'card' WHERE id = 1;
SELECT * FROM payments;

-- DCL: data control (permissions)
GRANT SELECT ON payments TO reporting;
REVOKE UPDATE ON payments FROM intern;

-- TCL: transaction control
BEGIN;  DELETE FROM payments WHERE id = 1;  ROLLBACK;`},
steps:[
{hl:{q:[1,2,3,4,5,6,7,8]}, g:[G('DDL',['CREATE / ALTER / DROP / TRUNCATE','define and change structure','hot'],['auto-commit','in MySQL/Oracle DDL commits implicitly'],['Postgres','DDL is transactional (can roll back)','ok'])],
 say:`SQL is several languages in one. <b>DDL</b> (Data Definition Language) creates and changes <i>structure</i>: tables, columns, indexes, views. Choosing column types is a DDL decision that is expensive to change later, so let's look closely.`},
{hl:{q:[4]}, g:[G('Money',['FLOAT / DOUBLE','binary fractions: 0.1 + 0.2 = 0.30000000000000004','bad'],['NUMERIC(12,2) / DECIMAL','exact decimal arithmetic','ok'],['or integer cents','BIGINT amount_cents','ok'])], log:['0.1 + 0.2 in FLOAT → 0.30000000000000004'],
 say:`Never store money in FLOAT/DOUBLE: they're binary approximations, and rounding errors accumulate across sums. Use <code>NUMERIC/DECIMAL(precision, scale)</code> or store integer cents. <code>NUMERIC(12,2)</code> means up to 12 digits, 2 after the point.`},
{hl:{q:[5,6,7]}, g:[G('Text',['CHAR(n)','fixed length, padded; codes like EUR'],['VARCHAR(n)','variable, with a limit'],['TEXT','variable, no limit (Postgres: same speed as VARCHAR)']), G('Time',['DATE','day only'],['TIMESTAMP','date + time, no zone'],['TIMESTAMPTZ','an instant; store in UTC','ok'])],
 say:`Strings: <code>CHAR(n)</code> for fixed codes, <code>VARCHAR(n)</code>/<code>TEXT</code> for the rest. Time: store <b>instants</b> as timestamp-with-time-zone (normalised to UTC) and convert at display time. A bare TIMESTAMP is ambiguous once servers or users span time zones.`},
{hl:{q:[9]}, g:[G('ALTER TABLE',['ADD COLUMN (nullable)','usually instant (metadata only)','ok'],['ADD COLUMN NOT NULL DEFAULT','instant in PG 11+, MySQL 8 INSTANT'],['change a column type','may rewrite the whole table and lock it','bad'])],
 say:`<code>ALTER TABLE</code> evolves the schema. Adding a nullable column is cheap; changing a type can rewrite every row under a lock. In production, schema changes are scripted as versioned <b>migrations</b> and planned for zero downtime (10.4).`},
{hl:{q:[11,12,13,14]}, tb:[TB('payments',['id','amount','currency','paid_at','note','method'],[[1,'19.99','EUR',null,null,'card']],{0:'new'})], g:[G('DML',['INSERT','add rows'],['UPDATE','change rows'],['DELETE','remove rows'],['SELECT','read rows (sometimes called DQL)','hot'],['MERGE / UPSERT','insert or update'])],
 say:`<b>DML</b> (Data Manipulation Language) works on <i>rows</i>: INSERT, UPDATE, DELETE, and SELECT (some books split SELECT out as DQL, Data Query Language). Unlike DDL, DML always runs inside a transaction, explicit or implicit.`},
{hl:{q:[16,17,18]}, g:[G('DCL',['GRANT privilege ON object TO role','allow'],['REVOKE … FROM …','take away'],['least privilege','apps get only what they need','ok'],['roles','group privileges, assign roles to users'])],
 say:`<b>DCL</b> (Data Control Language) manages permissions. Good practice: the application's DB user can SELECT/INSERT/UPDATE its own tables but not DROP them; analysts get read-only access, maybe through views that hide sensitive columns.`},
{hl:{q:[20,21]}, tb:[TB('payments',['id','amount','currency','paid_at','note','method'],[[1,'19.99','EUR',null,null,'card']],{0:'ok'})], g:[G('TCL',['BEGIN / START TRANSACTION','open'],['COMMIT','make permanent'],['ROLLBACK','undo everything since BEGIN','hot'],['SAVEPOINT s / ROLLBACK TO s','partial undo'])], log:['DELETE → 1 row','ROLLBACK → row is back'],
 say:`<b>TCL</b> (Transaction Control Language) groups statements: BEGIN, COMMIT, ROLLBACK, SAVEPOINT. The DELETE is undone by ROLLBACK, so the row is still there. Part 6 explains what transactions guarantee.`},
{hl:{}, tb:[], g:[G('DELETE vs TRUNCATE vs DROP',['DELETE','DML: removes chosen rows, logged per row, fires triggers'],['TRUNCATE','DDL: empties the table fast, resets storage'],['DROP','DDL: removes the table itself'])],
 say:`<b>Say it:</b> "DDL defines structure (CREATE, ALTER, DROP, TRUNCATE), DML changes and reads rows (INSERT, UPDATE, DELETE, SELECT), DCL manages permissions (GRANT, REVOKE), TCL controls transactions (COMMIT, ROLLBACK, SAVEPOINT). DELETE removes rows one by one and can be filtered and rolled back; TRUNCATE empties the whole table quickly; DROP removes the table."`}
],
keep:[`DDL: CREATE ALTER DROP TRUNCATE. DML: SELECT INSERT UPDATE DELETE. DCL: GRANT REVOKE. TCL: COMMIT ROLLBACK SAVEPOINT.`,`Money: NUMERIC/DECIMAL or integer cents, never FLOAT.`,`Store instants as timestamptz in UTC.`,`DELETE (rows, WHERE, triggers) vs TRUNCATE (all rows, fast) vs DROP (table gone).`]}, {
  imp: 'good',
  theory: TH(`SQL commands fall into four families: defining structure (DDL), working with rows (DML), managing permissions (DCL) and controlling transactions (TCL); and every column needs a deliberately chosen data type.`,
`<p>If a database were a filing cabinet: <b>DDL</b> builds the drawers and labels the folders, <b>DML</b> puts papers in and takes them out, <b>DCL</b> hands out keys to the drawers, and <b>TCL</b> is the "undo until I say done" button.</p>
<p>Types matter because the database enforces them and optimises around them. A number stored as text sorts wrongly ("10" &lt; "9"), money stored as float drifts, and a date stored as text can't use date arithmetic.</p>`,
[[`DDL`,`CREATE, ALTER, DROP, TRUNCATE, RENAME.`],[`DML`,`SELECT, INSERT, UPDATE, DELETE, MERGE.`],[`DCL`,`GRANT, REVOKE.`],[`TCL`,`BEGIN, COMMIT, ROLLBACK, SAVEPOINT.`],[`NUMERIC(p, s)`,`Exact decimal with p digits, s after the point.`],[`TIMESTAMPTZ`,`An absolute instant, stored normalised to UTC.`],[`Migration`,`A versioned script that changes the schema.`]],
[`Design tables with DDL, choosing the narrowest type that fits the domain.`,`Load and change data with DML inside transactions.`,`Grant each role only the privileges it needs.`,`Evolve the schema with migrations, never by hand in production.`],
[`Migration tools (Flyway, Liquibase, Alembic, Prisma) run DDL in order and record the version.`,`App users rarely have DDL rights in production.`,`UUID vs BIGINT ids, JSON columns and enums are common design debates.`],
[`FLOAT for money.`,`Storing dates or numbers as strings.`,`VARCHAR(255) everywhere without thinking about the domain.`,`Running TRUNCATE thinking it's like DELETE (no WHERE; in many DBs not rollback-able, doesn't fire row triggers).`]),
  examples: [
    {lv:'basic', title:'DDL + DML in one go', sql:`CREATE TABLE coupons (code TEXT PRIMARY KEY, pct INTEGER CHECK (pct BETWEEN 1 AND 90));
INSERT INTO coupons VALUES ('SPRING10', 10), ('VIP25', 25);
SELECT * FROM coupons;`, why:`Define structure, insert rows, read them back.`},
    {lv:'mid', title:'Why types matter: text vs number sorting', sql:`SELECT v FROM (SELECT '10' AS v UNION ALL SELECT '9' UNION ALL SELECT '100') ORDER BY v;
SELECT v FROM (SELECT 10 AS v UNION ALL SELECT 9 UNION ALL SELECT 100) ORDER BY v;`, why:`As text, '10' &lt; '100' &lt; '9' (character by character). As numbers: 9, 10, 100.`},
    {lv:'adv', title:'Transactions with a savepoint', sql:`BEGIN;
UPDATE products SET price = price + 10 WHERE category = 'books';
SAVEPOINT before_furniture;
UPDATE products SET price = 0 WHERE category = 'furniture';   -- oops
ROLLBACK TO before_furniture;
COMMIT;
SELECT category, name, price FROM products ORDER BY category, name;`, why:`Books got +10; the accidental furniture update was undone by ROLLBACK TO SAVEPOINT; COMMIT kept the rest.`},
  ],
  tips: {
    say:`"DDL changes structure, DML changes and reads data, DCL manages privileges, TCL controls transactions. For types I use exact decimals for money, timestamptz in UTC for instants, and the narrowest type that fits, because types are constraints too."`,
    points:[`Classify TRUNCATE correctly (DDL) and contrast it with DELETE.`,`Volunteer the money-as-float bug.`,`Mention migrations and least privilege.`],
    traps:[`Saying TRUNCATE can take a WHERE clause.`,`Claiming DDL is always transactional (true in Postgres, not in MySQL/Oracle).`],
    qa:[[`DELETE vs TRUNCATE vs DROP?`,`DELETE removes selected rows, is fully logged, fires triggers, can be rolled back. TRUNCATE removes all rows quickly by deallocating storage and resets identity in some DBs. DROP removes the table definition and data.`],
        [`UUID or BIGINT primary key?`,`BIGINT: smaller, sequential, index-friendly. UUID: generate anywhere, no enumeration, merge-friendly; prefer time-ordered UUIDv7 to avoid random index inserts.`],
        [`How do you store prices in multiple currencies?`,`amount NUMERIC(19,4) (or minor units BIGINT) plus currency CHAR(3) ISO code; never mix currencies in one SUM without conversion.`]]
  },
  exercises: [
    {lv:'E', q:`Classify each statement as DDL, DML, DCL or TCL: <code>CREATE INDEX</code>, <code>MERGE</code>, <code>SAVEPOINT</code>, <code>TRUNCATE</code>, <code>REVOKE</code>, <code>SELECT</code>.`, hint:`Structure, rows, permissions, transactions.`,
     answer:`CREATE INDEX: DDL · MERGE: DML · SAVEPOINT: TCL · TRUNCATE: DDL · REVOKE: DCL · SELECT: DML (or DQL).`},
    {lv:'M', q:`Inside one transaction, give every electronics product a 5% discount, then show <code>name, price</code> for electronics, most expensive first.`, hint:`BEGIN; UPDATE …; COMMIT; then SELECT … ORDER BY price DESC. The checker compares the last result.`, ordered:true,
     sql:`BEGIN;
UPDATE products SET price = price * 0.95 WHERE category = 'electronics';
COMMIT;
SELECT name, price FROM products WHERE category = 'electronics' ORDER BY price DESC;`},
    {lv:'H', q:`Pick types for a <code>bookings</code> table: id, hotel code (always 5 letters), guest email, check-in day, check-out day, total price in the hotel's currency, currency, created moment. Write the CREATE TABLE with sensible constraints.`, hint:`DATE vs TIMESTAMPTZ; a CHECK linking two columns.`,
     answer:`<pre class="sql">CREATE TABLE bookings (
  id          BIGINT PRIMARY KEY,
  hotel_code  CHAR(5) NOT NULL,
  guest_email VARCHAR(320) NOT NULL,
  check_in    DATE NOT NULL,
  check_out   DATE NOT NULL,
  total       NUMERIC(12,2) NOT NULL CHECK (total &gt;= 0),
  currency    CHAR(3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out &gt; check_in)
);</pre><p>Stays are calendar days in the hotel's local sense, so DATE; creation is an instant, so TIMESTAMPTZ.</p>`},
  ],
  quiz: [
    [`TRUNCATE belongs to…`,[`DML`,`DDL`,`DCL`,`TCL`],1,`It changes storage, not individual rows.`,'E'],
    [`GRANT and REVOKE are…`,[`DDL`,`DML`,`DCL`,`TCL`],2,`Data control.`,'E'],
    [`Best type for an account balance?`,[`FLOAT`,`DOUBLE`,`NUMERIC(19,4) or integer minor units`,`VARCHAR`],2,`Exact arithmetic.`,'E'],
    [`ROLLBACK TO SAVEPOINT s…`,[`Ends the transaction`,`Undoes changes after s and keeps the transaction open`,`Commits up to s`,`Deletes the savepoint only`],1,`Partial rollback.`,'M'],
    [`Which can take a WHERE clause?`,[`TRUNCATE`,`DROP`,`DELETE`,`CREATE`],2,`TRUNCATE empties the whole table.`,'E'],
    [`Storing an instant for users in many time zones, the safest choice is…`,[`TIMESTAMP without time zone in local time`,`TIMESTAMPTZ (UTC internally)`,`A VARCHAR like '2024-03-01 10:00'`,`Two columns: date and time`],1,`Convert to local time at display.`,'M'],
  ],
  quizAdv: [
    [`In PostgreSQL you run CREATE TABLE then ROLLBACK in one transaction. The table…`,[`Exists`,`Does not exist: DDL is transactional in Postgres`,`Exists but is empty`,`Is corrupted`],1,`MySQL would have implicitly committed.`,'H'],
    [`Random UUIDv4 primary keys in a B-tree cause…`,[`No difference from sequential ids`,`Inserts scattered across the index: more page splits and cache misses`,`Uniqueness violations`,`Slower deletes only`],1,`Time-ordered UUIDv7 / ULID fixes most of it.`,'H'],
    [`MySQL's ALTER TABLE … ALGORITHM=INSTANT lets you…`,[`Change any column type instantly`,`Add (and in 8.0.29+, drop) columns via metadata only, without copying the table`,`Skip writing the binlog`,`Create indexes with no I/O`],1,`Type changes still usually rebuild the table.`,'H'],
  ],
});
