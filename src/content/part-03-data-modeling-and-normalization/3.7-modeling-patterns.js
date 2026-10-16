/* 3.7 Modeling patterns: soft delete, history, polymorphic associations, EAV, JSON */
topic('3', { no:'3.7', title:'Modeling patterns: soft delete, history tables, polymorphism, EAV, JSON', db:'shop',
idea:`Recurring design questions with no single right answer. Compare soft vs hard deletes, keep history with a validity range, model "comments on posts or photos" three ways, and see when EAV or a JSON column is the pragmatic choice.`,
tbTitle:'Tables', stateTitle:'Trade-offs',
codes:{a:`-- soft delete
ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMP;   -- NULL = active
CREATE UNIQUE INDEX ux_email_active ON customers(email) WHERE deleted_at IS NULL;

-- history (SCD2-style)
CREATE TABLE price_history (product_id INT, price NUMERIC,
  valid_from TIMESTAMP, valid_to TIMESTAMP);             -- NULL valid_to = current

-- polymorphic: comments on posts OR photos
-- (a) comments(id, target_type, target_id)          no FK possible
-- (b) comments(id, post_id NULL, photo_id NULL,     real FKs + CHECK exactly one
--      CHECK ((post_id IS NULL) <> (photo_id IS NULL)))
-- (c) commentable(id) ← posts(id), photos(id)       shared supertype table

-- EAV vs JSON for flexible attributes
-- attributes(entity_id, name, value)                 every value is text
-- products.specs JSON                                 index paths you query`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('customers',['id','name','email','deleted_at'],[[2,'Ben','ben@mail.com',null],[5,'Eli','eli@mail.com','2024-04-01'],[8,'Eli2','eli@mail.com',null]],{1:'dim'})], g:[G('Soft delete',['how','deleted_at timestamp instead of DELETE'],['pros','undo, audit, FKs stay valid','ok'],['cons','every query must filter; uniqueness gets tricky','bad'],['fix uniqueness','partial unique index WHERE deleted_at IS NULL','ok'])],
 say:`<b>Soft delete</b>: mark rows deleted (<code>deleted_at</code>) instead of removing them. You get undo, an audit trail and no broken references. The cost: every query must add <code>WHERE deleted_at IS NULL</code> (views or ORM scopes help), and a plain UNIQUE on email would block a new account reusing a deleted one's email, so use a <b>partial unique index</b> on active rows only. Also plan for real deletion when privacy laws require it.`},
{hl:{q:[5,6,7]}, tb:[TB('price_history',['product_id','price','valid_from','valid_to'],[[1,950,'2023-01-01','2024-01-01'],[1,900,'2024-01-01',null]],{1:'ok'})], g:[G('History table',['current row','valid_to IS NULL','ok'],['as-of query','WHERE ts >= valid_from AND (valid_to IS NULL OR ts < valid_to)'],['alternatives','audit log table, temporal tables (SQL:2011, SQL Server, MariaDB)'])],
 say:`<b>History</b>: instead of overwriting a price, close the current row (set valid_to) and insert a new one. Now "what was the price on 2023-06-01?" is a simple range query. SQL Server and MariaDB have built-in <b>system-versioned temporal tables</b> that do this automatically.`},
{hl:{q:[9,10]}, tb:[TB('comments (a) generic',['id','target_type','target_id','body'],[[1,'post',10,'nice'],[2,'photo',7,'wow'],[3,'post',999,'orphan!']],{2:'bad'})], g:[G('(a) type + id columns',['flexible','one table for any target','ok'],['no foreign key','can point at nothing','bad'],['joins','CASE or UNION per type'],['used by','Rails/Laravel polymorphic associations'])],
 say:`<b>Polymorphic associations</b>: comments can belong to a post <i>or</i> a photo. Option (a), popular in ORMs: <code>target_type</code> + <code>target_id</code>. Flexible, but the database can't enforce a foreign key, so orphans like comment 3 slip in.`},
{hl:{q:[11,12,13]}, g:[G('(b) one nullable FK per target',['real FKs','integrity enforced','ok'],['CHECK','exactly one is set'],['adding a target type','new column + migration'],['good for','a small, stable set of targets','ok']), G('(c) supertype table',['commentable(id)','posts and photos share ids from it'],['comments.commentable_id','single real FK','ok'],['cost','extra table and insert'])],
 say:`Option (b): one nullable foreign key per target plus a CHECK that exactly one is set: real integrity, fine for a few target types. Option (c): a shared <b>supertype</b> table (<code>commentable</code>) whose id posts and photos reuse, so comments have one real FK. Separate tables (post_comments, photo_comments) are a fourth, simple option.`},
{hl:{q:[15,16,17]}, tb:[TB('EAV: attributes',['entity_id','name','value'],[[1,'ram_gb','16'],[1,'cpu','M3'],[2,'color','black'],[2,'ram_gb','sixteen']],{3:'bad'})], g:[G('EAV',['flexible','any attribute, no migrations','ok'],['every value is text','no types, no constraints','bad'],['queries','one self-join per attribute','bad']), G('JSON column',['flexible','schemaless document per row','ok'],['indexable','expression/GIN indexes on paths'],['validation','CHECK json_valid / schemas'],['rule','promote hot fields to real columns','ok'])],
 say:`<b>Flexible attributes</b> (product specs differ per category). <b>EAV</b> (entity-attribute-value) stores one row per attribute: infinitely flexible, but everything is text ("sixteen"), there are no constraints, and filtering on three attributes means three self-joins. A <b>JSON column</b> (Postgres jsonb, MySQL JSON) is usually the better modern choice: one document per row, indexable paths, and you promote frequently filtered fields to real columns.`},
{hl:{}, tb:[], g:[G('Rules of thumb',['deletes','soft delete when you need undo/audit; partial unique indexes','ok'],['history','validity ranges or temporal tables'],['polymorphism','prefer real FKs (nullable FKs or supertype)'],['flexible data','JSON for the long tail; columns for what you query'])],
 say:`<b>Say it:</b> "Soft deletes trade query complexity for recoverability, so I use partial unique indexes and views. For history I use validity ranges or temporal tables. For polymorphic relations I prefer designs that keep real foreign keys, and for flexible attributes a JSON column with indexed paths beats EAV, while anything frequently filtered becomes a real column."`}
],
keep:[`Soft delete: deleted_at + filter everywhere + partial unique index on active rows.`,`History: valid_from/valid_to (NULL = current) or system-versioned temporal tables.`,`Polymorphic type+id can't have FKs; prefer nullable FKs + CHECK, or a supertype table.`,`EAV loses types and constraints; prefer JSON for the long tail, real columns for hot fields.`]}, {
  imp: 'good',
  theory: TH(`Some modeling needs (recoverable deletes, history, "belongs to one of several things", flexible attributes) come up in every system and have well-known patterns with clear trade-offs.`,
`<p>Textbook normalization tells you how to avoid redundancy, but not how to undo a delete, answer "what was true last month?", attach comments to different kinds of things, or store attributes that vary per product. These patterns are the toolbox for those questions.</p>
<p>The common thread is a trade-off between flexibility and the database's ability to protect you: the more generic the design (type+id, EAV), the fewer constraints the database can enforce.</p>`,
[[`Soft delete`,`Flagging rows as deleted instead of removing them.`],[`Partial index`,`An index (or unique index) over a subset of rows.`],[`Temporal table`,`A table that automatically keeps row history with validity periods.`],[`Polymorphic association`,`A reference that can point to rows of different tables.`],[`Supertype/subtype`,`A shared parent table whose id subtypes reuse.`],[`EAV`,`Entity-attribute-value: attributes as rows.`],[`JSON column`,`A semi-structured document stored in a column.`]],
[`Identify the requirement (undo? audit? flexibility?).`,`Pick the pattern that keeps the most constraints enforceable.`,`Add supporting indexes/views (partial unique index, current-row view).`,`Document the convention so every query follows it.`],
[`deleted_at on user-facing entities; hard delete + archive for GDPR erasure.`,`Price and status history for analytics and disputes.`,`Rails/Django polymorphic comments, tags, attachments.`,`Product catalogs with jsonb specs and GIN indexes.`],
[`Forgetting deleted_at filters (deleted data reappears).`,`EAV for core business fields.`,`Polymorphic type+id with no cleanup of orphans.`,`Putting everything in JSON and losing types, constraints and statistics.`]),
  examples: [
    {lv:'basic', title:'Soft delete with a view for active rows', sql:`ALTER TABLE customers ADD COLUMN deleted_at TEXT;
UPDATE customers SET deleted_at = '2024-04-01' WHERE id = 4;
CREATE VIEW active_customers AS SELECT * FROM customers WHERE deleted_at IS NULL;
SELECT id, name FROM active_customers;`, why:`Diya is "deleted" but her row (and any references) remain. Queries use the view.`},
    {lv:'mid', title:'Partial unique index: reuse an email after soft delete', sql:`ALTER TABLE customers ADD COLUMN deleted_at TEXT;
CREATE TABLE c2 AS SELECT id, name, email, deleted_at FROM customers;
CREATE UNIQUE INDEX ux_active_email ON c2(email) WHERE deleted_at IS NULL;
UPDATE c2 SET deleted_at = '2024-04-01' WHERE id = 2;                -- Ben leaves
INSERT INTO c2 (id, name, email) VALUES (20, 'Ben again', 'ben@mail.com');  -- allowed
SELECT * FROM c2 WHERE email = 'ben@mail.com';`, why:`Uniqueness applies only to active rows, so a new account can reuse the address.`},
    {lv:'adv', title:'JSON specs with an indexed path', sql:`ALTER TABLE products ADD COLUMN specs TEXT CHECK (specs IS NULL OR json_valid(specs));
UPDATE products SET specs = '{"ram_gb": 16, "cpu": "M3"}' WHERE id = 1;
UPDATE products SET specs = '{"ram_gb": 8, "screen": 6.1}' WHERE id = 2;
CREATE INDEX ix_ram ON products (json_extract(specs, '$.ram_gb'));
SELECT name, json_extract(specs, '$.ram_gb') AS ram
FROM products
WHERE json_extract(specs, '$.ram_gb') >= 8
ORDER BY ram DESC;`, why:`Typed JSON values, validated with a CHECK, filtered through an expression index. Postgres would use jsonb with a GIN or expression index.`},
  ],
  tips: {
    say:`"For deletes I weigh recoverability against query complexity: soft deletes with a partial unique index and a view of active rows. History goes in validity-ranged rows or temporal tables. For polymorphic relations I keep real foreign keys where possible, and for flexible attributes I use JSON with indexed paths rather than EAV, promoting hot fields to columns."`,
    points:[`Always mention the unique-constraint problem with soft deletes.`,`Explain why type+id polymorphism can't use foreign keys.`,`Know at least one way to index JSON.`],
    traps:[`Recommending EAV as a general-purpose design.`,`Forgetting GDPR/erasure when proposing soft deletes everywhere.`],
    qa:[[`Soft delete vs hard delete?`,`Soft: undo, audit, preserved references, but every query filters and tables grow. Hard: simpler, required for erasure; archive first if you need history.`],
        [`How would you answer "what was the price on date X"?`,`A history table with valid_from/valid_to: WHERE X &gt;= valid_from AND (valid_to IS NULL OR X &lt; valid_to).`],
        [`When is JSON the wrong choice?`,`When you filter, join, aggregate or constrain on the fields regularly, or need referential integrity: use columns.`]]
  },
  exercises: [
    {lv:'E', q:`Simulate soft delete: add <code>deleted_at</code> to products, mark Lamp (id 6) deleted, and return the names of active products.`, hint:`ALTER, UPDATE, SELECT … WHERE deleted_at IS NULL.`,
     sql:`ALTER TABLE products ADD COLUMN deleted_at TEXT;
UPDATE products SET deleted_at = '2024-04-01' WHERE id = 6;
SELECT name FROM products WHERE deleted_at IS NULL;`},
    {lv:'M', q:`Create <code>price_history(product_id, price, valid_from, valid_to)</code> with rows: product 1 at 950 from 2023-01-01 to 2024-01-01, and 900 from 2024-01-01 (current). Return the price of product 1 as of 2023-06-15 as <code>price</code>.`, hint:`Range condition with a NULL valid_to.`,
     sql:`CREATE TABLE price_history (product_id INTEGER, price REAL, valid_from TEXT, valid_to TEXT);
INSERT INTO price_history VALUES (1, 950, '2023-01-01', '2024-01-01'), (1, 900, '2024-01-01', NULL);
SELECT price FROM price_history
WHERE product_id = 1 AND '2023-06-15' >= valid_from AND (valid_to IS NULL OR '2023-06-15' < valid_to);`},
    {lv:'H', q:`Design attachments that can belong to an order, a customer or a product (and maybe more types later). Compare two designs and pick one.`, hint:`Integrity vs flexibility.`,
     answer:`<ul><li>(a) attachments(id, owner_type, owner_id, url): flexible, new types free, but no FK; needs cleanup jobs and app-level checks.</li><li>(b) attachments(id, url) + order_attachments(order_id FK, attachment_id FK), customer_attachments(…), product_attachments(…): real FKs and cascades; a new owner type is one small junction table.</li></ul><p>Pick (b) when integrity matters and types change rarely; (a) for a generic platform feature with many owner types, plus periodic orphan checks.</p>`},
  ],
  quiz: [
    [`Main downside of soft deletes?`,[`Data loss`,`Every query must filter deleted rows; unique constraints need care`,`Breaks foreign keys`,`Can't be undone`],1,`Use views/scopes and partial indexes.`,'E'],
    [`Reusing a soft-deleted user's email requires…`,[`Dropping the unique constraint`,`A partial unique index on active rows`,`Hard delete only`,`A trigger`],1,`UNIQUE … WHERE deleted_at IS NULL.`,'M'],
    [`target_type + target_id polymorphic columns can't…`,[`Be indexed`,`Have a real foreign key`,`Be joined`,`Store integers`],1,`The FK target varies.`,'E'],
    [`EAV's biggest weakness?`,[`Too many tables`,`No types/constraints and painful multi-attribute queries`,`Can't store text`,`Needs JSON`],1,`Everything is a string row.`,'M'],
    [`A current row in a validity-range history table has…`,[`valid_from NULL`,`valid_to NULL (or a far-future date)`,`deleted_at set`,`No product_id`],1,`Open-ended range.`,'E'],
    [`When should a field inside a JSON column become a real column?`,[`Never`,`When it's frequently filtered, joined, aggregated or constrained`,`When it's a string`,`When the JSON is large`],1,`Promote hot fields.`,'M'],
  ],
  quizAdv: [
    [`System-versioned temporal tables (SQL:2011) automatically…`,[`Compress old rows`,`Keep a history of every row version with system time periods`,`Replicate data`,`Delete old rows`],1,`FOR SYSTEM_TIME AS OF queries.`,'H'],
    [`Postgres index type typically used for jsonb containment queries (@&gt;)?`,[`B-tree`,`GIN`,`Hash`,`BRIN`],1,`Inverted index over keys/values.`,'H'],
    [`CHECK ((post_id IS NULL) &lt;&gt; (photo_id IS NULL)) ensures…`,[`Both are set`,`Exactly one is set`,`Neither is set`,`They're equal`],1,`XOR of nullness.`,'H'],
  ],
});
