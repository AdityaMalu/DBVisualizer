/* 3.4 Normal forms: 1NF, 2NF, 3NF */
topic('3', { no:'3.4', title:'Normalization: 1NF, 2NF, 3NF step by step', db:'flat',
idea:`Normalize a messy order sheet one normal form at a time. Split a list column for 1NF, pull out partial dependencies for 2NF, remove transitive dependencies for 3NF, and end with four clean tables that join back to the original.`,
tbTitle:'Tables', stateTitle:'Rule',
codes:{a:`-- 0NF: one row per order, products in a list
-- orders(order_id, date, customer_id, customer_name, customer_city,
--        products = 'Laptop x1, Headphones x2')

-- 1NF: atomic values, one row per order line
-- order_lines(order_id, product_id, date, customer_id, customer_name,
--             customer_city, product_name, category, qty)

-- 2NF: remove partial dependencies on (order_id, product_id)
-- orders(order_id, date, customer_id, customer_name, customer_city)
-- products(product_id, product_name, category)
-- order_items(order_id, product_id, qty)

-- 3NF: remove transitive dependencies (order_id → customer_id → city)
-- orders(order_id, date, customer_id)
-- customers(customer_id, customer_name, customer_city)`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('0NF: orders',['order_id','customer','city','products'],[[101,'Asha','Pune','Laptop x1, Headphones x2'],[102,'Ben','Mumbai','Phone x1, Novel x3']],{0:'bad',1:'bad'})], g:[G('Problems',['products column','a list inside a cell','bad'],['query "who bought a Novel?"','LIKE \'%Novel%\' (slow, error-prone)','bad'],['change a quantity','string surgery','bad'])],
 say:`<b>Unnormalized</b> data: the products column holds a list. You can't index it, join it, count it or enforce that each product exists. Normalization is a sequence of rules, each removing one kind of redundancy. Each normal form includes the previous one.`},
{hl:{q:[5,6,7]}, tb:[TB('1NF: order_lines',['order_id','product_id','customer','city','product','category','qty'],[[101,1,'Asha','Pune','Laptop','electronics',1],[101,3,'Asha','Pune','Headphones','electronics',2],[102,2,'Ben','Mumbai','Phone','electronics',1],[102,7,'Ben','Mumbai','Novel','books',3]],{0:'new',1:'new',2:'new',3:'new'})], g:[G('1NF',['atomic values','one value per cell','ok'],['no repeating groups','no product1, product2, … columns','ok'],['a key','(order_id, product_id)','ok'])],
 say:`<b>First normal form (1NF)</b>: every cell holds a single atomic value, there are no repeating groups (no product1/product2 columns either), and rows are identified by a key. One row per order line, key (order_id, product_id). Queryable now, but look at the duplication: Asha/Pune and "Laptop/electronics" will repeat on every line.`},
{hl:{q:[9,10,11,12]}, tb:[TB('orders',['order_id','date','customer','city'],[[101,'2024-01-05','Asha','Pune'],[102,'2024-01-09','Ben','Mumbai']],{0:'new',1:'new'}), TB('products',['product_id','name','category'],[[1,'Laptop','electronics'],[3,'Headphones','electronics'],[2,'Phone','electronics'],[7,'Novel','books']],{0:'new',1:'new',2:'new',3:'new'}), TB('order_items',['order_id','product_id','qty'],[[101,1,1],[101,3,2],[102,2,1],[102,7,3]])], g:[G('2NF',['1NF +','every non-key column depends on the WHOLE key','hot'],['moved out','order_id → date, customer…'],['moved out','product_id → name, category'],['only relevant for','composite keys'])],
 say:`<b>Second normal form (2NF)</b>: 1NF, and no non-key column depends on only <i>part</i> of a composite key. Order date and customer depend only on order_id; product name and category only on product_id. Move each group into a table keyed by its determinant. order_items keeps only what depends on the whole key: qty. (A table with a single-column key is automatically in 2NF.)`},
{hl:{q:[14,15,16]}, tb:[TB('orders',['order_id','date','customer_id'],[[101,'2024-01-05',1],[102,'2024-01-09',2]],{0:'new',1:'new'}), TB('customers',['customer_id','name','city'],[[1,'Asha','Pune'],[2,'Ben','Mumbai']],{0:'new',1:'new'})], g:[G('3NF',['2NF +','no non-key column depends on another non-key column','hot'],['found','order_id → customer_id → name, city'],['fix','customers table'],['mnemonic','"the key, the whole key, and nothing but the key"','ok'])],
 say:`<b>Third normal form (3NF)</b>: 2NF, and no <b>transitive</b> dependencies: non-key columns depend on the key directly, not through another non-key column. In orders, name and city depend on customer_id, which is not the key. Pull them into a customers table. The classic mnemonic: every non-key attribute depends on "the key, the whole key, and nothing but the key".`},
{hl:{}, tb:[TB('final schema',['table','key','stores'],[['customers','customer_id','name, city'],['products','product_id','name, category'],['orders','order_id','date, customer_id → customers'],['order_items','(order_id, product_id)','qty (+ unit_price snapshot)']],{0:'ok',1:'ok',2:'ok',3:'ok'})], g:[G('Result',['each fact','stored once','ok'],['anomalies from 3.3','gone','ok'],['joins','recreate the sheet (lossless)'],['cost','more joins for reads'])],
 say:`Four tables, each fact stored once: change Asha's city in one row, add a product with no orders, delete an order without losing the product. Joins reassemble the original sheet. The trade-off is more joins on reads, which is why read-heavy analytics sometimes denormalises on purpose (3.6).`},
{hl:{}, tb:[], g:[G('Cheat sheet',['1NF','atomic values, no repeating groups, has a key'],['2NF','1NF + no partial dependency on a composite key'],['3NF','2NF + no transitive dependency'],['BCNF','every determinant is a candidate key (3.5)'])],
 say:`<b>Say it:</b> "1NF means atomic values and no repeating groups. 2NF removes partial dependencies, where a column depends on only part of a composite key. 3NF removes transitive dependencies, where a non-key column depends on another non-key column. In practice I aim for 3NF in OLTP schemas and denormalise deliberately where reads need it."`}
],
keep:[`1NF: atomic cells, no lists or repeating column groups, a key.`,`2NF: no partial dependency (only matters for composite keys).`,`3NF: no transitive dependency: "the key, the whole key, nothing but the key".`,`Normalize OLTP to 3NF; denormalize deliberately for read-heavy paths.`]}, {
  imp: 'must',
  theory: TH(`Normalization reorganises tables so that each fact is stored exactly once, following a ladder of rules called normal forms (1NF, 2NF, 3NF, BCNF…).`,
`<p>Normal forms are a checklist for "is anything stored twice?". 1NF says each cell holds one value. 2NF says columns must describe the whole key, not part of it. 3NF says columns must describe the key directly, not through another column.</p>
<p>Think of a filing cabinet: you don't photocopy a customer's address into every invoice folder; you keep one customer card and write the customer number on invoices. Normalization is the discipline of finding every "photocopy" and replacing it with a reference.</p>`,
[[`1NF`,`Atomic values, no repeating groups, rows identified by a key.`],[`2NF`,`1NF and no non-key column depends on part of a composite key.`],[`3NF`,`2NF and no non-key column depends on another non-key column.`],[`Partial dependency`,`On part of a composite key.`],[`Transitive dependency`,`A → B → C where B isn't a key.`],[`Decomposition`,`Splitting a table into several that join back losslessly.`]],
[`Make values atomic: one row per item, no lists (1NF).`,`For composite keys, move columns that depend on part of the key to their own table (2NF).`,`Move columns that depend on a non-key column to a table keyed by that column (3NF).`,`Check that joins reproduce the original data and add foreign keys.`],
[`OLTP schemas (orders, users, payments) are normally in 3NF.`,`ORM entity design maps naturally to 3NF tables.`,`Data cleaning: normalising imported spreadsheets before loading them.`],
[`Over-normalising into dozens of tiny tables nobody needs (e.g. a table for "first names").`,`Calling a JSON array column "1NF-compliant".`,`Forgetting that 2NF only matters with composite keys.`,`Treating denormalization as a mistake rather than a documented trade-off.`]),
  examples: [
    {lv:'basic', title:'1NF: the sheet is already one row per order line', sql:`SELECT order_id, product_id, product_name, qty
FROM order_sheet
WHERE order_id = 101;`, why:`Atomic values with a composite key (order_id, product_id). Duplication remains: that's what 2NF/3NF fix.`},
    {lv:'mid', title:'2NF: extract products (depends on part of the key)', sql:`CREATE TABLE products AS
SELECT DISTINCT product_id, product_name, category FROM order_sheet;
SELECT * FROM products ORDER BY product_id;`, why:`product_id → name, category. Each product now appears once.`},
    {lv:'adv', title:'Full decomposition to 3NF and a lossless check', sql:`CREATE TABLE customers AS SELECT customer_id, MIN(customer_name) AS name, MIN(customer_city) AS city
                          FROM order_sheet GROUP BY customer_id;           -- cleans Ben's typo by picking one
CREATE TABLE products  AS SELECT DISTINCT product_id, product_name, category FROM order_sheet;
CREATE TABLE orders    AS SELECT DISTINCT order_id, order_date, customer_id FROM order_sheet;
CREATE TABLE order_items AS SELECT order_id, product_id, qty, unit_price FROM order_sheet;

SELECT o.order_id, c.name, c.city, p.product_name, i.qty
FROM order_items i
JOIN orders o    ON o.order_id = i.order_id
JOIN customers c ON c.customer_id = o.customer_id
JOIN products p  ON p.product_id = i.product_id
ORDER BY o.order_id, p.product_id;`, why:`Four tables in 3NF; the join rebuilds all 10 lines. Ben's inconsistent city had to be resolved once (MIN picks "Mumbai"); in a normalised schema the inconsistency can't come back.`},
  ],
  tips: {
    say:`"1NF: atomic values and no repeating groups. 2NF: no partial dependency on a composite key. 3NF: no transitive dependency, so every non-key column depends on the key, the whole key and nothing but the key. I normalise transactional schemas to 3NF and denormalise only with a reason and a way to keep copies in sync."`,
    points:[`Walk one concrete table through 1NF → 3NF on the whiteboard.`,`State why 2NF is automatic for single-column keys.`,`Close with the trade-off: more joins vs no anomalies.`],
    traps:[`Mixing up 2NF (partial) and 3NF (transitive).`,`Claiming normalization always improves performance.`],
    qa:[[`Is a table with a JSON array column in 1NF?`,`Strictly no if you query inside the array as separate items; modern practice tolerates JSON for genuinely opaque or schemaless data, but anything you filter, join or constrain on should be relational.`],
        [`Give an example of a 3NF violation.`,`employees(id, dept_id, dept_name): id → dept_id → dept_name. Move dept_name to departments.`],
        [`Should zip code → city be split out for 3NF?`,`Technically it's transitive; in practice many teams keep city alongside zip because zips don't map cleanly to cities and the update risk is low. A judgement call; say so.`]]
  },
  exercises: [
    {lv:'E', q:`Extract a <code>customers</code> table in 3NF from the sheet: one row per <code>customer_id</code> with a name. Return <code>customer_id, customer_name</code>.`, hint:`SELECT DISTINCT customer_id, customer_name.`,
     sql:`SELECT DISTINCT customer_id, customer_name FROM order_sheet;`},
    {lv:'M', q:`Build <code>orders(order_id, order_date, customer_id)</code> from the sheet and return it ordered by order_id. Check it has one row per order.`, hint:`DISTINCT on the three columns; each order has one date and customer.`, ordered:true,
     sql:`SELECT DISTINCT order_id, order_date, customer_id FROM order_sheet ORDER BY order_id;`},
    {lv:'M', q:`Normalize <code>employees(emp_id, name, dept_id, dept_name, dept_location, project_ids)</code> where project_ids is '3,7,9'. Give the 3NF tables.`, hint:`Lists → junction table; dept facts → departments.`,
     answer:`<ul><li>employees(emp_id PK, name, dept_id FK)</li><li>departments(dept_id PK, dept_name, dept_location)</li><li>projects(project_id PK, …)</li><li>employee_projects(emp_id FK, project_id FK, PK(emp_id, project_id))</li></ul><p>1NF removes the list, 3NF removes emp_id → dept_id → dept_name/location.</p>`},
    {lv:'H', q:`Revenue per category from the sheet, computed as if from the normalized tables: <code>category, revenue</code>. Then explain in a sentence why the result would be the same before and after normalization.`, hint:`SUM(qty * unit_price) grouped by category.`,
     sql:`SELECT category, SUM(qty * unit_price) AS revenue FROM order_sheet GROUP BY category;`, note:`Normalization is lossless: it reorganises facts without changing them, so any query over the original can be answered by joining the decomposed tables.`},
  ],
  quiz: [
    [`A column holding 'red,green,blue' violates…`,[`1NF`,`2NF`,`3NF`,`BCNF only`],0,`Not atomic.`,'E'],
    [`2NF removes…`,[`Repeating groups`,`Partial dependencies on a composite key`,`Transitive dependencies`,`Multivalued dependencies`],1,`Columns depending on part of the key.`,'E'],
    [`employees(id, dept_id, dept_name): which NF is violated?`,[`1NF`,`2NF`,`3NF`,`None`],2,`id → dept_id → dept_name is transitive.`,'M'],
    [`A table whose primary key is a single column is automatically in…`,[`3NF`,`2NF (if it's in 1NF)`,`BCNF`,`4NF`],1,`No part of the key to depend on.`,'M'],
    [`"The key, the whole key, and nothing but the key" summarises…`,[`1NF`,`1NF through 3NF`,`Indexes`,`ACID`],1,`Key (1NF), whole key (2NF), nothing but (3NF).`,'E'],
    [`Main cost of normalization?`,[`More storage`,`More joins on reads`,`More anomalies`,`No foreign keys`],1,`Writes get simpler; reads join.`,'M'],
  ],
  quizAdv: [
    [`order_items(order_id, product_id, qty, product_name). Normal form?`,[`3NF`,`2NF but not 3NF`,`1NF but not 2NF`,`Not 1NF`],2,`product_name depends on part of the key.`,'H'],
    [`A table can be in 3NF but not BCNF when…`,[`It has a NULL`,`A non-key determinant determines part of a candidate key (overlapping candidate keys)`,`It has a composite key`,`It has more than 5 columns`],1,`See 3.5.`,'H'],
    [`Normalising zip → city into a separate table is…`,[`Always required`,`Technically 3NF-correct, often skipped as a pragmatic choice`,`A 1NF fix`,`Wrong`],1,`Know the rule and the pragmatism.`,'H'],
  ],
});
