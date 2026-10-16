/* 1.8 Modifying data: INSERT, UPDATE, DELETE, UPSERT, RETURNING */
topic('1', { no:'1.8', title:'Changing data: INSERT, UPDATE, DELETE, UPSERT, RETURNING', db:'shop',
idea:`Insert rows (one, many, and from a SELECT), update with expressions and a subquery, delete safely, then do an atomic "insert or update" with ON CONFLICT and read back generated values with RETURNING.`,
tbTitle:'products', stateTitle:'Statement',
codes:{a:`INSERT INTO products (id, name, category, price)
VALUES (9, 'Mug', 'kitchen', 12);

UPDATE products
SET price = price * 1.10
WHERE category = 'furniture';

DELETE FROM products WHERE id = 9;
-- DELETE FROM products;          ← no WHERE = every row

INSERT INTO products (id, name, category, price)
VALUES (6, 'Lamp', 'furniture', 35)
ON CONFLICT (id) DO UPDATE SET price = excluded.price
RETURNING id, name, price;`},
steps:[
{hl:{q:[1,2]}, tb:[TB('products',['id','name','category','price'],[[4,'Desk','furniture',250],[5,'Chair','furniture',150],[6,'Lamp','furniture',40],[9,'Mug','kitchen',12]],{3:'new'})], g:[G('INSERT',['list the columns','safer than relying on column order','ok'],['multi-row','VALUES (…), (…), (…)'],['from a query','INSERT INTO t SELECT …'])], log:['INSERT 1 row'],
 say:`<b>INSERT</b> adds rows. Always name the target columns: if someone later adds or reorders a column, an INSERT without a column list breaks or, worse, puts values in the wrong columns. Many rows at once: <code>VALUES (…), (…)</code>, far faster than one statement per row.`},
{hl:{q:[4,5,6]}, tb:[TB('products',['id','name','category','price'],[[4,'Desk','furniture',275],[5,'Chair','furniture',165],[6,'Lamp','furniture',44],[9,'Mug','kitchen',12]],{0:'hot',1:'hot',2:'hot'})], g:[G('UPDATE',['SET col = expression','can reference the old value','hot'],['WHERE','which rows; missing = all rows','bad'],['atomic per row','price = price * 1.10 can\'t lose updates'])], log:['UPDATE 3 rows'],
 say:`<b>UPDATE</b> changes columns of the rows matching WHERE. The new value can be an expression over the old one (<code>price * 1.10</code>), computed inside the database, so concurrent updates don't overwrite each other (0.1). Always check the affected row count.`},
{hl:{q:[8,9]}, tb:[TB('products',['id','name','category','price'],[[4,'Desk','furniture',275],[5,'Chair','furniture',165],[6,'Lamp','furniture',44],[9,'Mug','kitchen',12]],{3:'dim'})], g:[G('DELETE',['DELETE … WHERE id = 9','one row'],['DELETE without WHERE','every row!','bad'],['habit','run the WHERE as a SELECT first','ok'],['or','BEGIN; DELETE …; check count; COMMIT','ok'])], log:['DELETE 1 row'],
 say:`<b>DELETE</b> removes matching rows. Forgetting WHERE deletes everything, the most famous production accident in SQL. Habits that save you: run the same WHERE as a SELECT first, wrap risky changes in a transaction and check the row count before COMMIT, and many teams prefer soft deletes (10.x).`},
{hl:{q:[11,12,13]}, tb:[TB('products',['id','name','category','price'],[[4,'Desk','furniture',275],[5,'Chair','furniture',165],[6,'Lamp','furniture',35]],{2:'hot'})], g:[G('UPSERT',['try INSERT id 6','conflict on PK','hot'],['ON CONFLICT (id) DO UPDATE','update instead','ok'],['excluded.price','the value you tried to insert'],['DO NOTHING','ignore duplicates'])], log:['conflict on id 6 → updated price to 35'],
 say:`An <b>upsert</b> is "insert, or update if it already exists", done atomically. Postgres and SQLite: <code>ON CONFLICT (key) DO UPDATE SET … = excluded.…</code>; MySQL: <code>ON DUPLICATE KEY UPDATE</code>; standard: <code>MERGE</code>. It relies on a unique constraint. The "SELECT, then INSERT or UPDATE" alternative races between the two steps.`},
{hl:{q:[14]}, tb:[TB('RETURNING id, name, price',['id','name','price'],[[6,'Lamp',35]],{0:'new'})], g:[G('RETURNING',['returns','the affected rows after the change','hot'],['use','get generated ids, defaults, new values'],['saves','a second round trip / race'],['support','Postgres, SQLite 3.35+, MariaDB; SQL Server: OUTPUT'])],
 say:`<b>RETURNING</b> hands back the rows the statement changed, including generated ids and defaults, in the same round trip. No need to INSERT and then SELECT "the last id" (which can race).`},
{hl:{}, tb:[], g:[G('Bulk and safety',['INSERT … SELECT','copy/transform in the DB'],['UPDATE … FROM / JOIN','update from another table'],['batch big deletes','DELETE … WHERE id IN (SELECT … LIMIT 1000) in a loop','ok'],['TRUNCATE','empty a table fast (0.5)'])],
 say:`<b>Say it:</b> "INSERT with an explicit column list and multi-row VALUES; UPDATE and DELETE always with a WHERE I've tested as a SELECT; atomic upserts with ON CONFLICT or MERGE backed by a unique constraint; RETURNING to get generated values without a second query. Huge updates and deletes go in batches to keep transactions and locks short."`}
],
keep:[`Name the columns in INSERT. Multi-row VALUES for bulk.`,`UPDATE/DELETE without WHERE hit every row: test the WHERE as a SELECT first.`,`Upsert = INSERT … ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE / MERGE (needs a unique key).`,`RETURNING gets ids and new values in one round trip. Batch large changes.`]}, {
  imp: 'good',
  theory: TH(`INSERT adds rows, UPDATE changes them, DELETE removes them, and an upsert inserts or updates atomically depending on whether the key already exists.`,
`<p>These are the write side of SQL (DML). Each statement works on a <i>set</i> of rows chosen by a WHERE clause, so a single UPDATE can change one row or a million.</p>
<p>Upsert is the "save" button of databases: if the record exists, overwrite it; otherwise create it. Doing it in one atomic statement matters because two requests doing "check, then insert" at the same time would both see "doesn't exist" and both insert.</p>`,
[[`INSERT … VALUES`,`Add literal rows.`],[`INSERT … SELECT`,`Add rows produced by a query.`],[`UPDATE … SET … WHERE`,`Change matching rows.`],[`DELETE … WHERE`,`Remove matching rows.`],[`Upsert`,`Insert or update on key conflict.`],[`RETURNING`,`Return the affected rows.`],[`Affected rows`,`How many rows a statement changed; check it.`]],
[`The statement finds target rows (like a SELECT with the same WHERE).`,`It checks constraints and takes row locks.`,`It writes new row versions and logs them (WAL).`,`It reports the affected row count (and RETURNING rows).`],
[`Idempotent APIs use upserts keyed by a client-supplied id.`,`Data migrations use INSERT … SELECT and batched UPDATEs.`,`ORMs generate these statements; know what SQL they emit.`],
[`DELETE/UPDATE without WHERE.`,`One INSERT per row in a loop (N round trips).`,`Updating millions of rows in one transaction (long locks, replication lag).`,`Read-then-write upserts in application code.`]),
  examples: [
    {lv:'basic', title:'Insert several rows at once', sql:`INSERT INTO products (id, name, category, price) VALUES
  (9,  'Mug',    'kitchen', 12),
  (10, 'Kettle', 'kitchen', 35);
SELECT * FROM products WHERE category = 'kitchen';`, why:`One statement, one round trip.`},
    {lv:'mid', title:'Update using a subquery', sql:`UPDATE customers
SET city = 'Pune (VIP)'
WHERE id IN (SELECT customer_id FROM orders
             GROUP BY customer_id HAVING COUNT(*) >= 3);
SELECT id, name, city FROM customers;`, why:`Asha has 3 orders and is tagged. The subquery picks the target rows.`},
    {lv:'adv', title:'Upsert a daily counter and return the new value', sql:`CREATE TABLE page_views (page TEXT, day TEXT, views INTEGER NOT NULL,
                         PRIMARY KEY (page, day));
INSERT INTO page_views VALUES ('/home', '2024-03-01', 1)
  ON CONFLICT (page, day) DO UPDATE SET views = views + 1;
INSERT INTO page_views VALUES ('/home', '2024-03-01', 1)
  ON CONFLICT (page, day) DO UPDATE SET views = views + 1
  RETURNING page, day, views;`, why:`The first insert creates the row, the second hits the conflict and increments. Atomic, no race, and RETURNING gives the current count.`},
  ],
  tips: {
    say:`"For writes I name columns, batch rows, test WHERE clauses as SELECTs and check affected counts. Upserts go through ON CONFLICT or MERGE on a unique key so they're atomic, and RETURNING gives me generated ids in the same round trip."`,
    points:[`Explain why read-then-write upsert races and the unique key fixes it.`,`Mention batching large updates/deletes to limit lock time and WAL/replication spikes.`,`Know the dialect names: ON CONFLICT, ON DUPLICATE KEY UPDATE, MERGE.`],
    traps:[`MySQL's REPLACE INTO is delete + insert: it fires delete triggers and can cascade-delete children.`,`MERGE in some databases isn't safe against concurrent inserts without the right isolation or locking.`],
    qa:[[`How do you delete 50 million old rows without hurting production?`,`Batch it (e.g. 5–10k rows per transaction, by primary key range), throttle, run off-peak; or partition by time and drop old partitions (8.3).`],
        [`How do you get the id of a row you just inserted?`,`RETURNING id (Postgres/SQLite), OUTPUT (SQL Server), LAST_INSERT_ID() per connection (MySQL). Never SELECT MAX(id).`],
        [`What does ON CONFLICT DO NOTHING give you?`,`Idempotent inserts: retries or duplicates are silently ignored; check the affected count (0 = already existed).`]]
  },
  exercises: [
    {lv:'E', q:`Mark every 'placed' order as 'shipped', then return <code>id, status</code> of all orders that are now shipped.`, hint:`UPDATE … WHERE status = 'placed'; then SELECT.`,
     sql:`UPDATE orders SET status = 'shipped' WHERE status = 'placed';
SELECT id, status FROM orders WHERE status = 'shipped';`},
    {lv:'M', q:`Delete cancelled orders. Their order_items must go first (foreign keys are on). Then return the remaining order count as <code>n</code>.`, hint:`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status = 'cancelled'), then the orders.`,
     sql:`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status = 'cancelled');
DELETE FROM orders WHERE status = 'cancelled';
SELECT COUNT(*) AS n FROM orders;`},
    {lv:'H', q:`Create <code>product_stats(product_id PRIMARY KEY, units INTEGER)</code> and fill it with total units sold per product using <code>INSERT … SELECT</code>. Then upsert: add 5 more units for product 1 with ON CONFLICT. Return the full table ordered by product_id.`, hint:`INSERT INTO product_stats SELECT product_id, SUM(qty) FROM order_items GROUP BY product_id; then INSERT VALUES (1, 5) ON CONFLICT DO UPDATE SET units = units + excluded.units.`, ordered:true,
     sql:`CREATE TABLE product_stats (product_id INTEGER PRIMARY KEY, units INTEGER NOT NULL);
INSERT INTO product_stats SELECT product_id, SUM(qty) FROM order_items GROUP BY product_id;
INSERT INTO product_stats VALUES (1, 5)
  ON CONFLICT (product_id) DO UPDATE SET units = units + excluded.units;
SELECT * FROM product_stats ORDER BY product_id;`},
  ],
  quiz: [
    [`<code>UPDATE products SET price = 0;</code> affects…`,[`No rows`,`One row`,`Every row`,`It's a syntax error`],2,`No WHERE = all rows.`,'E'],
    [`Why list columns in INSERT?`,[`Required by SQL`,`Protects against column order changes and makes intent explicit`,`Faster parsing`,`Enables RETURNING`],1,`Schema evolution safety.`,'E'],
    [`What does an upsert need to detect "already exists"?`,[`An index on any column`,`A unique constraint or primary key on the conflict columns`,`A trigger`,`SERIALIZABLE isolation`],1,`The conflict target.`,'M'],
    [`In <code>ON CONFLICT … DO UPDATE SET price = excluded.price</code>, excluded refers to…`,[`The existing row`,`The row you tried to insert`,`Deleted rows`,`The previous transaction`],1,`MySQL uses VALUES(price) / new alias.`,'M'],
    [`Best way to get an auto-generated id in Postgres?`,[`SELECT MAX(id) after insert`,`INSERT … RETURNING id`,`A second query by name`,`currval of a random sequence`],1,`Same round trip, no race.`,'E'],
    [`Deleting 50M rows in one statement in production risks…`,[`Nothing`,`Long locks, huge WAL/replication lag, bloat`,`Faster vacuums`,`Index corruption`],1,`Batch it, or drop partitions.`,'M'],
  ],
  quizAdv: [
    [`MySQL REPLACE INTO on a duplicate key does…`,[`An in-place update`,`A delete then an insert (triggers fire, cascades may run)`,`Nothing`,`An error`],1,`Prefer INSERT … ON DUPLICATE KEY UPDATE.`,'H'],
    [`"SELECT; if none INSERT else UPDATE" in READ COMMITTED with two concurrent requests can…`,[`Never fail`,`Both see no row and both insert (duplicate or unique violation)`,`Deadlock always`,`Lose the SELECT`],1,`Use the unique constraint + ON CONFLICT.`,'H'],
    [`Postgres UPDATE physically…`,[`Overwrites the row in place`,`Writes a new row version; the old one is cleaned up later by VACUUM`,`Deletes and re-inserts in another table`,`Writes only to the WAL`],1,`MVCC (6.5); updates create bloat.`,'H'],
  ],
});
