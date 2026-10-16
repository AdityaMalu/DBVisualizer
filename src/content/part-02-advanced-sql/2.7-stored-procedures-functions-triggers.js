/* 2.7 Stored procedures, functions and triggers */
topic('2', { no:'2.7', title:'Stored procedures, functions and triggers', db:'shop',
idea:`Code that runs inside the database. Call a stored procedure that moves money in one round trip, then watch a trigger fire automatically on UPDATE to write an audit row, and weigh when logic belongs in the database vs the application.`,
actors:'Who runs it', tbTitle:'Tables', stateTitle:'Mechanics',
codes:{a:`-- PostgreSQL: a function and a procedure
CREATE FUNCTION order_total(p_order INT) RETURNS NUMERIC AS $$
  SELECT SUM(qty * unit_price) FROM order_items WHERE order_id = p_order;
$$ LANGUAGE sql STABLE;

CREATE PROCEDURE transfer(p_from INT, p_to INT, p_amt NUMERIC) AS $$
BEGIN
  UPDATE accounts SET balance = balance - p_amt WHERE id = p_from;
  UPDATE accounts SET balance = balance + p_amt WHERE id = p_to;
END $$ LANGUAGE plpgsql;
CALL transfer(2, 1, 50);

-- a trigger (SQLite syntax): audit every price change
CREATE TRIGGER trg_price_audit AFTER UPDATE OF price ON products
FOR EACH ROW WHEN OLD.price <> NEW.price
BEGIN
  INSERT INTO price_audit (product_id, old_price, new_price, changed_at)
  VALUES (OLD.id, OLD.price, NEW.price, datetime('now'));
END;`},
steps:[
{hl:{app:[2,3,4]}, th:[['app','RUN:ok','SELECT order_total(101)'],['db','RUN:ok','runs the function']], g:[G('Function',['returns','a value (or a table)'],['used in','SELECT, WHERE, indexes (if IMMUTABLE)','hot'],['volatility','IMMUTABLE / STABLE / VOLATILE tells the planner what it may cache'])], log:['order_total(101) → 1120'],
 say:`A <b>user-defined function</b> packages logic that returns a value and can be called inside SQL: <code>SELECT id, order_total(id) FROM orders</code>. Declaring volatility (IMMUTABLE/STABLE/VOLATILE in Postgres) tells the optimizer whether it can cache results or use the function in an index.`},
{hl:{app:[11],db:[6,7,8,9,10]}, th:[['app','WAITING:warn','CALL transfer(2, 1, 50)'],['db','RUN:ok','2 UPDATEs, 1 round trip']], tb:[TB('accounts',['id','owner','balance'],[[1,'Asha',150],[2,'Ben',200]],{0:'hot',1:'hot'})], g:[G('Stored procedure',['invoked with','CALL'],['can','run many statements, loops, control transactions (Postgres 11+)'],['benefit','one network round trip for many statements','ok'])], log:['CALL transfer → done'],
 say:`A <b>stored procedure</b> runs a sequence of statements on the server, invoked with <code>CALL</code>. Two UPDATEs, one round trip from the app, and the logic sits next to the data. Procedures can manage transactions and are popular in banking and in Oracle/SQL Server shops.`},
{hl:{q:[13,14,15,16,17,18,19]}, th:[], tb:[TB('products',['id','name','price'],[[6,'Lamp',40]]), TB('price_audit',['product_id','old_price','new_price'],[])], g:[G('Trigger',['event','AFTER UPDATE OF price ON products'],['granularity','FOR EACH ROW (or per statement)'],['condition','WHEN OLD.price <> NEW.price'],['OLD / NEW','row before / after the change','hot'])],
 say:`A <b>trigger</b> is code the database runs <i>automatically</i> when an event happens on a table: BEFORE or AFTER an INSERT, UPDATE or DELETE, for each row or once per statement. Inside, <code>OLD</code> and <code>NEW</code> are the row before and after the change.`},
{hl:{app:[]}, th:[['app','RUN:ok','UPDATE products SET price = 35 WHERE id = 6'],['db','RUN:ok','fires trg_price_audit']], tb:[TB('products',['id','name','price'],[[6,'Lamp',35]],{0:'hot'}), TB('price_audit',['product_id','old_price','new_price'],[[6,40,35]],{0:'new'})], log:['UPDATE 1 row','trigger: audit row inserted'],
 say:`The app runs a plain UPDATE and knows nothing about auditing. The trigger fires in the same transaction and writes the audit row. If the UPDATE rolls back, so does the audit row. Every writer is covered, even ad-hoc scripts.`},
{hl:{}, th:[], tb:[], g:[G('Good uses',['audit trails / history tables','ok'],['maintaining updated_at','ok'],['enforcing cross-row invariants','ok'],['denormalized counters (carefully)']), G('Costs',['hidden behaviour','"why did this row change?"','bad'],['performance','runs per row, inside the write','bad'],['cascading triggers','hard to reason about','bad'],['testing / versioning','harder than app code'])],
 say:`Triggers are powerful and <b>invisible</b>: the person debugging "why did this row change?" doesn't see them in the app code, they add latency to every write, and triggers that fire other triggers become spaghetti. Keep them for cross-cutting, must-never-be-skipped concerns like auditing.`},
{hl:{}, g:[G('Logic in the DB',['data-intensive logic','fewer round trips','ok'],['invariants every writer must respect','ok'],['harder to scale out','DB CPU is the scarcest resource','bad']), G('Logic in the app',['easy to test, version, deploy','ok'],['scales horizontally','ok'],['risk','other writers bypass it','bad'])],
 say:`<b>Say it:</b> "Functions return values usable in SQL; procedures run multi-statement logic invoked with CALL, saving round trips; triggers run automatically on INSERT/UPDATE/DELETE with access to OLD and NEW rows. I use triggers sparingly, for audit logs or updated_at, and keep business logic mostly in the application, where it's easier to test and scale, unless it's data-heavy or an invariant every writer must obey."`}
],
keep:[`Function: returns a value, usable in SQL. Procedure: CALL, multi-statement, can control transactions.`,`Trigger: auto-runs BEFORE/AFTER INSERT/UPDATE/DELETE; FOR EACH ROW sees OLD/NEW.`,`Triggers run inside the writing transaction: roll back together.`,`Use triggers for audit/updated_at; avoid hidden business logic and trigger chains.`]}, {
  imp: 'good',
  theory: TH(`Stored procedures and functions are code stored and executed inside the database; triggers are such code run automatically when rows change.`,
`<p>Most logic lives in applications, but sometimes it's better next to the data: to avoid many network round trips, or to guarantee a rule runs no matter which program writes. Databases let you store <b>functions</b> (return a value), <b>procedures</b> (do a job) and <b>triggers</b> (react to changes).</p>
<p>A trigger is like a motion-sensor light: nobody flips a switch; the event itself (someone walks in, a row is updated) turns it on. Useful, but surprising if you don't know it's there.</p>`,
[[`Function (UDF)`,`Returns a value; callable in SELECT/WHERE.`],[`Stored procedure`,`Named routine invoked with CALL/EXEC.`],[`Trigger`,`Routine fired by INSERT/UPDATE/DELETE (or DDL).`],[`BEFORE / AFTER`,`Run before the change (can modify NEW) or after it.`],[`FOR EACH ROW / STATEMENT`,`Per affected row or once per statement.`],[`OLD / NEW`,`The row before / after the change.`],[`PL/pgSQL, T-SQL, PL/SQL`,`Procedural languages of Postgres, SQL Server, Oracle.`]],
[`Routines are compiled/stored in the catalog.`,`Functions are evaluated where they appear in a query.`,`CALL runs a procedure on the server.`,`On a matching write, the database runs the trigger inside the same transaction.`],
[`Audit and history tables via triggers.`,`updated_at maintenance via BEFORE UPDATE triggers.`,`Batch jobs as procedures in Oracle/SQL Server-heavy shops.`,`Functional indexes on IMMUTABLE functions (lower(email)).`],
[`Putting complex business rules in triggers nobody knows about.`,`Row-level triggers on bulk loads (millions of executions).`,`Marking a function IMMUTABLE when it isn't (wrong cached results).`,`Procedures that are never under version control.`]),
  examples: [
    {lv:'basic', title:'A trigger that maintains updated_at', sql:`ALTER TABLE products ADD COLUMN updated_at TEXT;
CREATE TRIGGER trg_touch AFTER UPDATE OF price ON products
FOR EACH ROW BEGIN
  UPDATE products SET updated_at = '2024-05-01T10:00' WHERE id = NEW.id;
END;
UPDATE products SET price = 45 WHERE id = 6;
SELECT id, name, price, updated_at FROM products WHERE id = 6;`, why:`The app only changed price; the trigger stamped updated_at (a fixed time here so results are reproducible; real code uses the current time).`},
    {lv:'mid', title:'Audit trail with OLD and NEW', sql:`CREATE TABLE price_audit (product_id INTEGER, old_price REAL, new_price REAL);
CREATE TRIGGER trg_price_audit AFTER UPDATE OF price ON products
FOR EACH ROW WHEN OLD.price <> NEW.price
BEGIN
  INSERT INTO price_audit VALUES (OLD.id, OLD.price, NEW.price);
END;
UPDATE products SET price = price * 1.1 WHERE category = 'books';
UPDATE products SET price = price WHERE id = 1;     -- no real change: WHEN skips it
SELECT * FROM price_audit;`, why:`Two book rows audited; the no-op update on product 1 is filtered by the WHEN clause.`},
    {lv:'adv', title:'A BEFORE trigger that enforces a cross-table rule', sql:`CREATE TRIGGER trg_no_items_on_cancelled BEFORE INSERT ON order_items
FOR EACH ROW
WHEN (SELECT status FROM orders WHERE id = NEW.order_id) = 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'cannot add items to a cancelled order');
END;
INSERT INTO order_items VALUES (105, 6, 1, 40);`, err:true, why:`CHECK constraints can't look at other tables (0.4); a BEFORE trigger can, and aborts the insert. Order 105 is cancelled, so this fails on purpose.`},
  ],
  tips: {
    say:`"Functions return values usable in queries, procedures run multi-step logic on the server with one round trip, and triggers fire automatically on writes with OLD and NEW rows, inside the same transaction. I use triggers for audit trails and updated_at, keep core business logic in the app for testability and scale, and move logic into the DB when it's data-heavy or must apply to every writer."`,
    points:[`Give a balanced DB-vs-app view rather than a dogma.`,`Mention BEFORE vs AFTER and row vs statement triggers.`,`Mention that triggers run in the same transaction (atomic with the write).`],
    traps:[`Recommending triggers for everything (hidden side effects, write latency).`,`Saying stored procedures prevent SQL injection automatically (dynamic SQL inside them can still be injectable).`],
    qa:[[`Function vs procedure?`,`A function returns a value and can be used inside SQL expressions; a procedure is invoked with CALL, may return nothing, and (in Postgres 11+) can COMMIT/ROLLBACK inside.`],
        [`How would you build an audit log?`,`AFTER INSERT/UPDATE/DELETE row triggers writing OLD/NEW (or a JSON diff) plus who/when into an append-only audit table; or CDC from the WAL (8.6) to keep writes fast.`],
        [`Why can triggers hurt bulk loads?`,`Row-level triggers execute once per row; disable them during controlled loads or use statement-level triggers with transition tables.`]]
  },
  exercises: [
    {lv:'E', q:`Create a trigger that, after inserting into <code>orders</code>, inserts a row into a new table <code>order_log(order_id, note)</code> with note <code>'created'</code>. Insert order 111 for customer 4 and return the log.`, hint:`CREATE TABLE order_log …; CREATE TRIGGER … AFTER INSERT ON orders FOR EACH ROW BEGIN INSERT INTO order_log VALUES (NEW.id, 'created'); END;`,
     sql:`CREATE TABLE order_log (order_id INTEGER, note TEXT);
CREATE TRIGGER trg_order_log AFTER INSERT ON orders FOR EACH ROW
BEGIN INSERT INTO order_log VALUES (NEW.id, 'created'); END;
INSERT INTO orders VALUES (111, 4, '2024-05-01', 'placed');
SELECT * FROM order_log;`},
    {lv:'M', q:`Keep a denormalized counter: add <code>order_count INTEGER DEFAULT 0</code> to customers, initialise it from orders, and add a trigger that increments it on every new order. Insert two orders for customer 6 and return <code>id, order_count</code> for customer 6.`, hint:`ALTER TABLE; UPDATE … = (SELECT COUNT(*) …); AFTER INSERT trigger that UPDATEs customers.`,
     sql:`ALTER TABLE customers ADD COLUMN order_count INTEGER DEFAULT 0;
UPDATE customers SET order_count = (SELECT COUNT(*) FROM orders o WHERE o.customer_id = customers.id);
CREATE TRIGGER trg_count AFTER INSERT ON orders FOR EACH ROW
BEGIN UPDATE customers SET order_count = order_count + 1 WHERE id = NEW.customer_id; END;
INSERT INTO orders VALUES (111, 6, '2024-05-01', 'placed'), (112, 6, '2024-05-02', 'placed');
SELECT id, order_count FROM customers WHERE id = 6;`},
    {lv:'H', q:`A teammate proposes moving all pricing rules (discounts, coupons, tax) into stored procedures "for performance". Give a balanced recommendation.`, hint:`Where is the cost? Testing, deploys, scaling, team skills.`,
     answer:`<ul><li>Pricing is CPU-light and rule-heavy: performance gain from avoiding round trips is small compared to cost of maintaining PL/SQL.</li><li>App code is easier to unit test, review, version, feature-flag and deploy gradually; the DB is the hardest component to scale, so don't spend its CPU on business rules.</li><li>Keep in the DB: invariants every writer must respect (constraints), data-heavy set operations, and audit triggers.</li><li>If round trips are the concern, batch queries or use a single well-designed SQL statement instead.</li></ul>`},
  ],
  quiz: [
    [`A trigger runs…`,[`When called with CALL`,`Automatically on a table event like INSERT/UPDATE/DELETE`,`On a schedule`,`Only during backups`],1,`Event-driven.`,'E'],
    [`In a row-level UPDATE trigger, OLD and NEW are…`,[`Old and new tables`,`The row before and after the change`,`Old and new transactions`,`The previous and next rows by id`],1,`INSERT has only NEW; DELETE only OLD.`,'E'],
    [`If the UPDATE that fired an AFTER trigger rolls back, the trigger's audit insert…`,[`Stays`,`Rolls back too (same transaction)`,`Is retried`,`Is logged elsewhere`],1,`Atomic with the triggering statement.`,'M'],
    [`Main benefit of a stored procedure for multi-statement work?`,[`Automatic indexing`,`One network round trip and logic close to the data`,`No locks`,`It's always faster than SQL`],1,`Fewer round trips.`,'E'],
    [`Which can modify the row being inserted before it is written?`,[`AFTER INSERT trigger`,`BEFORE INSERT trigger (changing NEW)`,`A view`,`A CHECK constraint`],1,`BEFORE triggers can change NEW.`,'M'],
    [`A common risk of heavy trigger use?`,[`Faster writes`,`Hidden side effects and slower writes`,`No transactions`,`Data loss on restart`],1,`Invisible to app developers.`,'M'],
  ],
  quizAdv: [
    [`Marking a Postgres function IMMUTABLE when it reads a table…`,[`Is fine`,`Can make the planner cache or index wrong results`,`Speeds up writes`,`Is rejected`],1,`IMMUTABLE must depend only on arguments.`,'H'],
    [`Statement-level triggers with transition tables (Postgres) help bulk operations because…`,[`They skip the WAL`,`They fire once per statement and see all changed rows as a set`,`They run asynchronously`,`They disable constraints`],1,`Set-based instead of per-row.`,'H'],
    [`Can a Postgres FUNCTION (not procedure) COMMIT inside its body?`,[`Yes`,`No: only procedures can manage transactions`,`Only with SECURITY DEFINER`,`Only in plpgsql`],1,`Functions run inside the caller's transaction.`,'H'],
  ],
});
