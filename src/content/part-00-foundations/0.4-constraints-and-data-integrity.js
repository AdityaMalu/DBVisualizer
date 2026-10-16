/* 0.4 Constraints and data integrity */
topic('0', { no:'0.4', title:'Constraints: keys, NOT NULL, UNIQUE, CHECK, foreign keys', db:'shop',
idea:`Bad data is cheapest to stop at the door. Fire five broken INSERTs at a table and watch which constraint rejects each one, then see what ON DELETE CASCADE, RESTRICT and SET NULL do to child rows.`,
tbTitle:'Tables', stateTitle:'Constraint check', logTitle:'Database says',
codes:{a:`CREATE TABLE products (
  id     INTEGER PRIMARY KEY,
  sku    TEXT NOT NULL UNIQUE,
  price  REAL NOT NULL CHECK (price >= 0)
);
CREATE TABLE reviews (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL
              REFERENCES products(id) ON DELETE CASCADE,
  stars       INTEGER CHECK (stars BETWEEN 1 AND 5)
);

INSERT INTO products VALUES (1, 'LAP-1', 900);     -- ok
INSERT INTO products VALUES (1, 'PHN-1', 600);     -- duplicate id
INSERT INTO products VALUES (2, 'LAP-1', 600);     -- duplicate sku
INSERT INTO products VALUES (3, NULL, 50);         -- sku missing
INSERT INTO products VALUES (4, 'DSK-1', -10);     -- negative price
INSERT INTO reviews  VALUES (10, 99, 5);           -- no product 99
DELETE FROM products WHERE id = 1;                 -- reviews?`},
steps:[
{hl:{q:[1,2,3,4,5]}, tb:[TB('products',['id','sku','price'],[])], g:[G('Declared rules',['PRIMARY KEY (id)','unique + not null'],['sku NOT NULL UNIQUE','required, no duplicates'],['CHECK (price >= 0)','row-level rule'])],
 say:`<b>Constraints</b> are rules the database enforces on every write, no matter which application, script or intern does the writing. Application validation is nice for error messages; constraints are what actually guarantee the data is valid.`},
{hl:{q:[13]}, tb:[TB('products',['id','sku','price'],[[1,'LAP-1',900]],{0:'new'})], log:['INSERT 1 LAP-1 900 → ok'],
 say:`A valid row goes in. Now let's attack it.`},
{hl:{q:[14]}, g:[G('PRIMARY KEY',['id = 1','already exists','bad'])], log:['UNIQUE constraint failed: products.id'],
 say:`Same id again: the <b>primary key</b> rejects it. A primary key is implemented with a unique index, so this check is a fast index lookup, not a table scan.`},
{hl:{q:[15,16]}, g:[G('UNIQUE (sku)',['LAP-1','already exists','bad']), G('NOT NULL (sku)',['NULL','required column','bad'])], log:['UNIQUE constraint failed: products.sku','NOT NULL constraint failed: products.sku'],
 say:`A different id with an existing SKU fails <b>UNIQUE</b>: a table can have many unique constraints but one primary key. A missing SKU fails <b>NOT NULL</b>. Remember from 0.3: UNIQUE alone would allow several NULLs, which is why "required and unique" needs both.`},
{hl:{q:[17]}, g:[G('CHECK (price >= 0)',['-10 >= 0','FALSE → rejected','bad'],['NULL >= 0','UNKNOWN → would pass!','hot'])], log:['CHECK constraint failed: price >= 0'],
 say:`<b>CHECK</b> evaluates a boolean expression on the row. -10 fails. Careful: CHECK only rejects FALSE, so a NULL price would pass. That's why price is also NOT NULL.`},
{hl:{q:[6,7,8,9,10,18]}, tb:[TB('products',['id','sku','price'],[[1,'LAP-1',900]]), TB('reviews',['id','product_id','stars'],[[10,99,5]],{0:'bad'})], g:[G('FOREIGN KEY',['product 99','doesn\'t exist','bad'],['guarantees','every review points at a real product','ok'])], log:['FOREIGN KEY constraint failed'],
 say:`A <b>foreign key</b> says every <code>reviews.product_id</code> must exist in <code>products.id</code> (referential integrity). Product 99 doesn't, so the insert fails. No orphans. Tip: index the foreign key column, because deletes on the parent must look up children.`},
{hl:{q:[8,19]}, tb:[TB('products',['id','sku','price'],[[1,'LAP-1',900]],{0:'dim'}), TB('reviews',['id','product_id','stars'],[[11,1,4],[12,1,5]],{0:'dim',1:'dim'})], g:[G('ON DELETE …',['CASCADE','delete the reviews too','hot'],['RESTRICT / NO ACTION','refuse to delete the product'],['SET NULL','keep reviews, product_id = NULL'],['SET DEFAULT','set to the column default'])], log:['DELETE product 1 → 2 reviews deleted by cascade'],
 say:`What happens to children when the parent goes? You choose. <b>CASCADE</b> deletes them too (fine for reviews, dangerous for invoices). <b>RESTRICT/NO ACTION</b> (the default) refuses the delete. <b>SET NULL</b> keeps children but orphans them on purpose. ON UPDATE has the same options.`},
{hl:{}, tb:[], g:[G('Integrity toolbox',['entity integrity','PRIMARY KEY'],['domain integrity','types, NOT NULL, CHECK'],['uniqueness','UNIQUE (also composite)'],['referential integrity','FOREIGN KEY + ON DELETE'],['complex rules','triggers or EXCLUDE (Postgres)'])],
 say:`<b>Say it:</b> "Constraints push data rules into the database so they hold for every writer: primary keys identify rows, NOT NULL and CHECK restrict values, UNIQUE prevents duplicates, and foreign keys keep references valid, with ON DELETE deciding what happens to children. I still validate in the app for friendly errors, but the constraint is the real guarantee."`}
],
keep:[`PK = UNIQUE + NOT NULL, one per table. UNIQUE can be many and allows NULLs.`,`CHECK rejects only FALSE: NULL passes unless the column is NOT NULL.`,`FK: child values must exist in the parent. ON DELETE CASCADE / RESTRICT / SET NULL.`,`Index foreign key columns. Unique constraints are your last line of defence against duplicate inserts.`]}, {
  imp: 'must',
  theory: TH(`Constraints are rules declared in the schema that the database checks on every insert, update and delete, so invalid data can't get in no matter who writes it.`,
`<p>Applications have bugs, scripts skip validation, and two requests can race. If "every order belongs to a real customer" only lives in application code, sooner or later a row will break it. A <b>constraint</b> moves the rule into the database, which rejects the write with an error.</p>
<p>Think of constraints as the bouncer at the door: the app's form validation is the sign on the wall ("over 18 only"), the constraint is the person actually checking IDs.</p>`,
[[`PRIMARY KEY`,`Unique, non-NULL row identifier; one per table.`],[`UNIQUE`,`No two rows share the value (or value combination).`],[`NOT NULL`,`A value is required.`],[`CHECK`,`An expression every row must not violate.`],[`FOREIGN KEY`,`Values must exist in the referenced key.`],[`ON DELETE CASCADE`,`Deleting a parent deletes its children.`],[`DEFERRABLE`,`Check at COMMIT instead of per statement (Postgres, Oracle).`]],
[`On each write, the DBMS evaluates the constraints touching the changed rows.`,`Uniqueness and keys are checked via unique indexes.`,`Foreign keys look up the parent on insert, and the children on parent delete/update.`,`Any violation aborts the statement with an error; inside a transaction you can roll back.`],
[`Unique constraints make inserts idempotent (catch the duplicate-key error and treat it as success).`,`CHECK constraints document business rules right in the schema.`,`Foreign keys with CASCADE for owned data (order → order lines), RESTRICT for referenced data (customer ← orders).`],
[`Skipping foreign keys "for speed" and then writing orphan-cleanup jobs.`,`Forgetting to index FK columns, making parent deletes scan the child table.`,`CASCADE on data that must be kept for audits.`,`Relying on "check, then insert" in the app instead of a unique constraint (race condition).`]),
  examples: [
    {lv:'basic', title:'A constraint in action', sql:`INSERT INTO products VALUES (9, 'Mug', 'kitchen', -5);`, err:true, why:`The <code>CHECK (price &gt;= 0)</code> on products rejects the row. Run it to see the error message.`},
    {lv:'mid', title:'Foreign keys reject orphans', sql:`INSERT INTO orders VALUES (200, 42, '2024-05-01', 'placed');`, err:true, why:`There is no customer 42, so the foreign key on <code>orders.customer_id</code> rejects the order.`},
    {lv:'adv', title:'Design with constraints: an inventory table', sql:`CREATE TABLE inventory (
  product_id  INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  on_hand     INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved    INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  CHECK (reserved <= on_hand)
);
INSERT INTO inventory VALUES (1, 5, 2);
UPDATE inventory SET reserved = reserved + 4 WHERE product_id = 1;  -- 6 > 5: rejected`, err:true, why:`A table-level CHECK compares two columns. Overselling becomes impossible no matter which service does the update: the database refuses.`},
  ],
  tips: {
    say:`"I put invariants in the schema: primary keys, NOT NULL, UNIQUE, CHECK and foreign keys with a deliberate ON DELETE action. App validation gives nice errors, but only constraints hold under races and for every writer."`,
    points:[`Explain the race in "SELECT to check, then INSERT" and why a unique constraint fixes it.`,`Know the ON DELETE options and when CASCADE is dangerous.`,`Mention indexing foreign keys.`,`Know that CHECK passes NULL.`],
    traps:[`Saying UNIQUE and PRIMARY KEY are identical (NULLs, count per table, clustering in InnoDB).`,`Claiming foreign keys are always too slow for production.`],
    qa:[[`Primary key vs unique key?`,`One primary key per table, never NULL, often the clustered index (InnoDB). Many unique keys allowed, usually NULLable (and multiple NULLs are allowed).`],
        [`Two users register with the same email at the same instant. How do you prevent duplicates?`,`A UNIQUE constraint on email (ideally on a normalised lower-case value). The second insert fails; catch the error and return "email taken". An app-level check alone races.`],
        [`What are deferrable constraints?`,`Constraints checked at COMMIT rather than per statement, useful when swapping values or inserting rows that reference each other.`]]
  },
  exercises: [
    {lv:'E', q:`Before adding a UNIQUE constraint you must find existing duplicates. Practise on cities: return <code>city, n</code> for every city shared by more than one customer.`, hint:`GROUP BY city HAVING COUNT(*) &gt; 1.`,
     sql:`SELECT city, COUNT(*) AS n
FROM customers
GROUP BY city
HAVING COUNT(*) > 1;`},
    {lv:'M', q:`Choose an ON DELETE action for each and justify: (a) order_items → orders (b) orders → customers (c) employees.manager_id → employees (d) comments → posts in a forum.`, hint:`Is the child "owned" by the parent? Must it survive for audits?`,
     answer:`<ul><li>(a) CASCADE: lines are part of the order.</li><li>(b) RESTRICT: orders are financial records; deactivate customers instead of deleting.</li><li>(c) SET NULL: when a manager leaves, reports stay and are reassigned later.</li><li>(d) CASCADE or soft delete, depending on whether moderation needs history.</li></ul>`},
    {lv:'H', q:`Some order lines were sold below the product's current list price. List <code>order_id, product name, unit_price, price</code> for them, as the data a new CHECK-like rule would flag.`, hint:`Cross-table rules can't be CHECK constraints; find them with a join.`,
     sql:`SELECT oi.order_id, p.name, oi.unit_price, p.price
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE oi.unit_price < p.price;`},
  ],
  quiz: [
    [`How many primary keys can a table have?`,[`One (possibly over several columns)`,`One per column`,`As many as unique constraints`,`None if it has a UNIQUE column`],0,`A composite PK is still one key.`,'E'],
    [`Which constraint stops a review from pointing at a deleted product?`,[`CHECK`,`UNIQUE`,`FOREIGN KEY`,`NOT NULL`],2,`Referential integrity.`,'E'],
    [`ON DELETE CASCADE on order_items → orders means deleting an order…`,[`Fails if it has items`,`Deletes its items too`,`Sets items' order_id to NULL`,`Archives the items`],1,`Children follow the parent.`,'E'],
    [`Why is "SELECT to check the email is free, then INSERT" not enough?`,[`SELECT is slow`,`Two requests can both pass the check before either inserts`,`INSERT ignores SELECT results`,`Emails are case-sensitive`],1,`A race; the unique constraint is atomic.`,'M'],
    [`Which value passes <code>CHECK (qty &gt; 0)</code>?`,[`0`,`-1`,`NULL`,`None of these`],2,`UNKNOWN isn't FALSE, so it passes.`,'M'],
    [`Why index a foreign key column?`,[`It's required by the SQL standard`,`Joins and parent deletes/updates look up children by it`,`It makes the constraint deferrable`,`It prevents NULLs`],1,`Otherwise each parent delete scans the child table.`,'M'],
  ],
  quizAdv: [
    [`In PostgreSQL, swapping two rows' unique values in one transaction fails mid-way. What helps?`,[`ON DELETE CASCADE`,`DEFERRABLE INITIALLY DEFERRED unique constraint`,`A CHECK constraint`,`Dropping the index during the update`],1,`Checked at commit, when the swap is complete.`,'H'],
    [`Can a CHECK constraint compare against another table (e.g. order total ≤ customer credit)?`,[`Yes, any subquery is allowed`,`Not in most databases; use a trigger, FK or app logic`,`Only with ON DELETE CASCADE`,`Only in SQLite`],1,`CHECK sees only the current row.`,'H'],
    [`InnoDB without a declared primary key…`,[`Refuses to create the table`,`Uses the first NOT NULL UNIQUE index, or a hidden 6-byte row id, as the clustered key`,`Stores rows unordered in a heap`,`Uses the first column`],1,`InnoDB tables are always clustered.`,'H'],
  ],
});
