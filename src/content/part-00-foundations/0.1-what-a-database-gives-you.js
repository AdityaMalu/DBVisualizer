/* 0.1 What a database gives you */
topic('0', { no:'0.1', title:'What a database gives you (vs plain files)', db:'shop',
idea:`Two programs keep a shop's stock in a CSV file. Watch a lost update, a half-written file after a crash and a full-file scan, then see which DBMS feature fixes each: transactions, a write-ahead log, indexes, a query language and access control.`,
actors:'Programs', stateTitle:'What we need', logTitle:'What happened',
codes:{a:`# stock.csv  (the "database" is a plain file)
product,qty
laptop,5
phone,3

# app A and app B both sell a laptop at the same moment
A: read stock.csv        -> laptop = 5
B: read stock.csv        -> laptop = 5
A: write laptop = 4      (whole file rewritten)
B: write laptop = 4      (A's sale is lost!)

# crash in the middle of a rewrite -> half a file on disk
# "which products have qty < 2?" -> read every line, every time

-- the same thing with a DBMS
UPDATE stock SET qty = qty - 1 WHERE product = 'laptop';`},
steps:[
{hl:{A:[1,2,3,4]}, th:[['A','NEW:dim','order service'],['B','NEW:dim','admin script']], tb:[TB('stock.csv',['product','qty'],[['laptop',5],['phone',3]])],
 say:`Start with no database at all: the stock lives in a CSV file, and every program opens it, reads it, edits it and writes it back. It works for one user on one machine. Let's add a second program and see what breaks.`},
{hl:{A:[7],B:[8]}, th:[['A','RUN:ok','read laptop = 5'],['B','RUN:ok','read laptop = 5']], log:['A and B both read 5'],
 say:`Two sales arrive at the same moment. A reads the file and sees 5 laptops. Before A writes anything, B reads the same file: also 5. Both now hold a private copy of the data in memory.`},
{hl:{A:[9],B:[10]}, th:[['A','TERM:ok','wrote 4'],['B','TERM:bad','wrote 4 over A']], tb:[TB('stock.csv',['product','qty'],[['laptop',4],['phone',3]],{0:'bad'})], g:[G('Problem 1: concurrency',['two sales','qty should be 3'],['file says','4','bad'],['name','lost update','bad'],['DBMS fix','transactions + locks / MVCC (part 6)','ok'])], log:['A writes 4','B writes 4: one sale vanished'],
 say:`A writes 4. B writes 4 too, overwriting A's change. Two laptops sold, one subtracted: a <b>lost update</b>. Files have no notion of "these steps belong together" or "someone else is changing this row". A DBMS has <b>transactions</b> and <b>concurrency control</b>.`},
{hl:{A:[12]}, th:[['A','BLOCKED:bad','crashed mid-write'],['B','TERM:dim','']], tb:[TB('stock.csv (after crash)',['product','qty'],[['laptop',4],['pho',null]],{1:'bad'})], g:[G('Problem 2: crashes',['power cut during rewrite','half-written file','bad'],['DBMS fix','write-ahead log: redo or undo on restart (part 7)','ok'],['guarantee','atomicity + durability','ok'])], log:['crash: file truncated'],
 say:`Now the power fails halfway through rewriting the file. The last line is garbage. Which sales happened? Nobody knows. A database writes every change to a <b>write-ahead log</b> first, so after a crash it can finish committed work and undo half-done work: <b>atomicity</b> and <b>durability</b>.`},
{hl:{A:[13]}, th:[], g:[G('Problem 3: finding data',['question','qty < 2?'],['file','read and parse every line','bad'],['DBMS fix','indexes + a query optimizer (parts 4, 5)','ok']), G('Problem 4: asking questions',['file','write custom code per question','bad'],['DBMS fix','declarative SQL: say WHAT, not HOW','ok'])],
 say:`Questions get expensive. "Which products are almost out of stock?" means reading the entire file, every time, in code you wrote for that one question. A database lets you <b>declare</b> what you want in SQL; it keeps <b>indexes</b> to find rows without scanning and an <b>optimizer</b> picks how to run the query.`},
{hl:{q:[16]}, th:[['A','RUN:ok','UPDATE …'],['B','WAITING:warn','waits for A\'s row lock']], tb:[TB('stock (table)',['product','qty'],[['laptop',3],['phone',3]],{0:'ok'})], g:[G('DBMS gives you',['data model + schema','tables, types, constraints','ok'],['query language','SQL','ok'],['transactions (ACID)','no lost or half-done work','ok'],['concurrency control','many users at once','ok'],['recovery','survives crashes','ok'],['security','users, roles, grants','ok'])], log:['UPDATE … qty = qty - 1 (twice) → 3'],
 say:`The same sale as one SQL statement: <code>qty = qty - 1</code> is applied <i>inside</i> the database, atomically. The second sale waits for the first one's row lock, then subtracts again: 3. Correct. A <b>DBMS</b> (database management system) is the software that gives you all of this so every application doesn't have to reinvent it.`},
{hl:{}, th:[], tb:[], g:[G('Kinds of databases',['relational (SQL)','PostgreSQL, MySQL, Oracle, SQL Server, SQLite'],['key-value','Redis, DynamoDB'],['document','MongoDB'],['wide-column','Cassandra'],['graph','Neo4j'],['search','Elasticsearch'],['analytics (columnar)','BigQuery, Snowflake, ClickHouse'])],
 say:`<b>Say it:</b> "A database management system stores data durably and lets many users read and change it safely. Compared to files it adds a schema, a query language, indexes, transactions with ACID guarantees, concurrency control, crash recovery and access control." Relational databases are the default choice; parts 8 and 9 cover when to reach for something else.`}
],
keep:[`A DBMS adds: schema, query language, indexes, transactions, concurrency control, crash recovery, security.`,`Lost update: two read-modify-write cycles interleave and one overwrites the other.`,`Do arithmetic inside the database (qty = qty - 1), not read → compute → write in the app.`,`Relational is the default; NoSQL stores trade features for scale or a different data shape.`]}, {
  imp: 'good',
  theory: TH(`A database management system (DBMS) is software that stores data safely and lets many programs query and change it at the same time without corrupting it.`,
`<p>You could keep data in files: a spreadsheet, a CSV, a JSON blob. That works until two people edit at once, the machine crashes mid-save, the file grows to millions of lines, or someone asks a question nobody wrote code for.</p>
<p>A <b>database</b> is the organised collection of data; the <b>DBMS</b> is the program that manages it (PostgreSQL, MySQL, SQLite…). Think of a library with a librarian: you don't walk into the stacks and rearrange shelves yourself; you ask the librarian, who knows where everything is (indexes), makes sure two people don't take the same copy (concurrency control), keeps a ledger of every loan (the log), and only lets members borrow (access control).</p>`,
[[`Database`,`An organised collection of related data.`],[`DBMS`,`The software that stores, queries and protects it.`],[`Schema`,`The declared structure: tables, columns, types, constraints.`],[`Query`,`A request for data, usually written in SQL.`],[`Transaction`,`A group of operations that succeed or fail together.`],[`Data independence`,`Applications use the logical model; the physical layout can change underneath.`]],
[`An application connects to the DBMS (over a socket, or in-process for SQLite).`,`It sends SQL; the DBMS parses it, plans it and executes it against its storage.`,`Changes are logged before being applied, so a crash can be recovered.`,`Concurrency control keeps simultaneous sessions from corrupting each other's work.`],
[`Nearly every backend service keeps its state in a database and stays stateless itself.`,`SQLite is embedded in phones, browsers and apps; PostgreSQL/MySQL run as servers.`,`Choosing the database is one of the hardest-to-reverse decisions in a system.`],
[`Reading a value into the app, changing it and writing it back without a transaction or lock.`,`Treating the database as a dumb file and doing joins and filtering in application code.`,`Picking a NoSQL store "for scale" before you have a scale problem.`]),
  examples: [
    {lv:'basic', title:'Ask a question declaratively', sql:`SELECT name, price
FROM products
WHERE category = 'furniture';`, why:`You say <i>what</i> you want; the database decides how to find it. No parsing, no loops.`},
    {lv:'mid', title:'Change data safely inside the database', sql:`UPDATE products SET price = price * 0.9 WHERE category = 'books';
SELECT name, price FROM products WHERE category = 'books';`, why:`The arithmetic happens in the DBMS, in one statement, so no other session can sneak in between a read and a write.`},
    {lv:'adv', title:'All-or-nothing with a transaction', sql:`BEGIN;
INSERT INTO orders VALUES (111, 4, '2024-04-10', 'placed');
INSERT INTO order_items VALUES (111, 1, 1, 900);
INSERT INTO order_items VALUES (111, 99, 1, 10);   -- product 99 doesn't exist
COMMIT;`, run:false, why:`With foreign keys on, the third insert fails. The application then issues <code>ROLLBACK</code> and the order header disappears too: no half-created order. (Shown without running, because the failing statement is the point.)`},
  ],
  tips: {
    say:`"A DBMS gives durable storage plus a schema, a declarative query language, indexes, ACID transactions, concurrency control, crash recovery and access control. Files give you none of that, so every app would have to reinvent it, badly."`,
    points:[`Name concrete failure modes of files: lost updates, torn writes after a crash, full scans, no access control.`,`Connect each failure to the DBMS feature that fixes it.`,`Mention that relational is the default and NoSQL is a trade-off, not an upgrade.`],
    traps:[`Saying databases are "just faster files".`,`Listing NoSQL as automatically more scalable without mentioning what you give up (joins, transactions, constraints).`],
    qa:[[`What is the difference between a database and a DBMS?`,`The database is the data; the DBMS is the software managing it. People use "database" for both in conversation.`],
        [`What is data independence?`,`Physical independence: you can add an index or change storage without changing queries. Logical independence: views let you change tables without breaking every application.`],
        [`When would you still use plain files?`,`Large immutable blobs (images, videos: store in object storage and keep the path in the DB), append-only logs, or data exchange formats like CSV and Parquet.`]]
  },
  exercises: [
    {lv:'E', q:`List all products cheaper than 100, cheapest first (<code>name, price</code>).`, hint:`WHERE price &lt; 100, ORDER BY price.`, ordered:true,
     sql:`SELECT name, price FROM products WHERE price < 100 ORDER BY price;`},
    {lv:'M', q:`A teammate's sale code does <code>qty = SELECT qty …; qty = qty - 1; UPDATE … SET qty = :qty</code>. Explain the bug and give two fixes.`, hint:`Two requests at the same time.`,
     answer:`<p>Two concurrent requests can both read the same qty and both write qty − 1: a <b>lost update</b>.</p><ul><li>Do it atomically in SQL: <code>UPDATE stock SET qty = qty - 1 WHERE product = ? AND qty &gt; 0</code> and check the affected row count.</li><li>Or lock the row first: <code>SELECT … FOR UPDATE</code> inside a transaction, or use optimistic locking with a version column (6.6).</li></ul>`},
    {lv:'M', q:`Map each problem to the DBMS feature that solves it: (a) power cut during a write, (b) two clerks editing the same record, (c) "find all orders for customer 7" is slow, (d) an intern must not read salaries.`, hint:`Recovery, concurrency, indexing, security.`,
     answer:`<ul><li>(a) write-ahead log + crash recovery (atomicity, durability)</li><li>(b) transactions with locking or MVCC (isolation)</li><li>(c) an index on <code>orders(customer_id)</code></li><li>(d) access control: roles and GRANT/REVOKE, or a view without the salary column</li></ul>`},
  ],
  quiz: [
    [`Two programs read qty = 5, each subtracts 1 and writes back 4. What is this called?`,[`Dirty read`,`Lost update`,`Phantom read`,`Deadlock`],1,`One write overwrote the other.`,'E'],
    [`Which DBMS component lets it recover after a crash?`,[`The query optimizer`,`The write-ahead log`,`The connection pool`,`The B-tree index`],1,`Changes are logged before they're applied, so they can be redone or undone.`,'E'],
    [`What does "declarative" mean for SQL?`,[`You must declare variables first`,`You state what result you want; the DBMS decides how to compute it`,`Every query must declare its indexes`,`Queries run in the order they're declared`],1,`The optimizer picks the execution plan.`,'E'],
    [`Which is NOT a typical DBMS responsibility?`,[`Concurrency control`,`Crash recovery`,`Rendering the UI`,`Access control`],2,`Presentation is the application's job.`,'E'],
    [`Physical data independence means…`,[`Data is stored on a different physical server`,`You can change storage or add indexes without changing queries`,`Each table lives in its own file`,`Applications can bypass the DBMS`],1,`Queries talk to the logical model.`,'M'],
    [`Safest way to decrement stock?`,[`SELECT qty, subtract in Java, UPDATE qty = :new`,`UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0`,`DELETE and re-INSERT the row`,`Cache qty in Redis and write back hourly`],1,`One atomic statement, with a guard against going negative.`,'M'],
  ],
  quizAdv: [
    [`Which component chooses between scanning a table and using an index?`,[`The parser`,`The query optimizer (planner)`,`The buffer pool`,`The WAL writer`],1,`It estimates costs of alternative plans.`,'M'],
    [`SQLite vs PostgreSQL: the key architectural difference?`,[`SQLite can't do transactions`,`SQLite is an embedded library in the app's process; PostgreSQL is a separate server`,`PostgreSQL has no SQL support for joins`,`SQLite stores data only in memory`],1,`SQLite is fully transactional but serverless and single-writer.`,'M'],
    [`An app stores user profiles as JSON files on a shared disk. Under load, profiles occasionally contain half of the old and half of the new data. The core missing guarantee?`,[`Consistency of the cache`,`Atomic writes (no torn writes)`,`Referential integrity`,`Index selectivity`],1,`Readers see a partially written file; a DBMS makes writes atomic and isolated.`,'H'],
  ],
});
