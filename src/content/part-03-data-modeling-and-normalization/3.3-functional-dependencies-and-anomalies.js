/* 3.3 Functional dependencies and anomalies */
topic('3', { no:'3.3', title:'Functional dependencies and update/insert/delete anomalies', db:'flat',
idea:`Why normalize at all? Take one wide order spreadsheet and trigger all three anomalies: an update that leaves two cities for one customer, an insert that can't happen without a fake order, and a delete that erases a product. Then name the functional dependencies that cause them.`,
tbTitle:'order_sheet', stateTitle:'Dependencies',
codes:{a:`-- order_sheet(order_id, order_date, customer_id, customer_name,
--             customer_city, product_id, product_name, category,
--             qty, unit_price)      key: (order_id, product_id)

-- functional dependencies (X → Y: X determines Y)
order_id              → order_date, customer_id
customer_id           → customer_name, customer_city
product_id            → product_name, category
(order_id, product_id) → qty, unit_price

-- anomalies
UPDATE order_sheet SET customer_city = 'Delhi'
WHERE order_id = 101;                 -- update anomaly
INSERT a new product with no order?   -- insertion anomaly
DELETE FROM order_sheet WHERE order_id = 104;  -- deletion anomaly`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('order_sheet (some columns)',['order_id','customer','city','product','category','qty'],[[101,'Asha','Pune','Laptop','electronics',1],[101,'Asha','Pune','Headphones','electronics',2],[103,'Asha','Pune','Desk','furniture',1],[103,'Asha','Pune','Chair','furniture',2],[104,'Chen','Pune','Novel','books',2],[104,'Chen','Pune','Cookbook','books',1]],{0:'hot',1:'hot',2:'hot',3:'hot'})],
 say:`One wide table, the way data often arrives from a spreadsheet export. Each row is one order line, keyed by (order_id, product_id). Notice how many times "Asha, Pune" is repeated: once per line of every order she ever placed.`},
{hl:{q:[12,13]}, tb:[TB('after UPDATE … WHERE order_id = 101',['order_id','customer','city'],[[101,'Asha','Delhi'],[101,'Asha','Delhi'],[103,'Asha','Pune'],[103,'Asha','Pune']],{0:'bad',1:'bad',2:'bad',3:'bad'})], g:[G('Update anomaly',['Asha moved','updated only some rows'],['now','Asha lives in Delhi AND Pune','bad'],['in real data','Ben is in "Mumbai" and "Mumbay"','bad'])], log:['UPDATE 2 rows: Asha now has two cities'],
 say:`<b>Update anomaly</b>: a fact stored many times must be updated everywhere. Change Asha's city on order 101 only, and the database now claims she lives in two cities. The dataset already contains a real one: Ben is in "Mumbai" on one row and "Mumbay" on another. Which is true?`},
{hl:{q:[14]}, g:[G('Insertion anomaly',['new product "Mug"','no orders yet'],['key needs','an order_id','bad'],['options','fake order row, or NULL in the key (not allowed)','bad'])],
 say:`<b>Insertion anomaly</b>: you can't record one fact without another. A new product "Mug" has no orders, but every row needs an order_id (it's part of the key). You'd have to invent a fake order or leave the product out. The product's existence is trapped inside order data.`},
{hl:{q:[15]}, tb:[TB('after DELETE order 104',['order_id','product','category'],[[104,'Novel','books'],[104,'Cookbook','books']],{0:'dim',1:'dim'})], g:[G('Deletion anomaly',['delete order 104','Cookbook only appeared here'],['lost','the fact that "Cookbook is in books" (and Chen\'s city, if it was her only order)','bad'])], log:['DELETE order 104: Cookbook vanishes from the system'],
 say:`<b>Deletion anomaly</b>: deleting one fact destroys another. Order 104 is the only place the Cookbook appears. Delete the order and the product, its category, and possibly the customer, disappear from the database.`},
{hl:{q:[6,7,8,9]}, g:[G('Functional dependencies',['order_id → date, customer_id','depends on PART of the key','bad'],['product_id → name, category','depends on PART of the key','bad'],['customer_id → name, city','depends on a non-key column','bad'],['(order_id, product_id) → qty, unit_price','depends on the WHOLE key','ok'])],
 say:`The root cause is captured by <b>functional dependencies</b> (FDs). <code>X → Y</code> means: rows that agree on X must agree on Y. Only qty and unit_price depend on the whole key. Customer and product facts depend on <i>part</i> of the key or on another non-key column, so they get repeated, and repetition is what produces anomalies.`},
{hl:{}, tb:[], g:[G('Fix: one table per determinant',['orders(order_id → date, customer_id)','ok'],['customers(customer_id → name, city)','ok'],['products(product_id → name, category)','ok'],['order_items(order_id, product_id → qty, unit_price)','ok'])],
 say:`<b>Say it:</b> "A functional dependency X → Y means X determines Y. When a table stores facts that depend on only part of the key, or on another non-key column, the same fact is repeated, which causes update, insertion and deletion anomalies. Normalization splits the table so each fact is stored once, keyed by what determines it." Next: the normal forms that formalise this.`}
],
keep:[`X → Y: equal X implies equal Y.`,`Update anomaly: same fact in many rows → partial updates → contradictions.`,`Insertion anomaly: can't store one fact without another. Deletion anomaly: deleting one fact loses another.`,`Cause: non-key facts depending on part of the key or on other non-key columns. Fix: decompose.`]}, {
  imp: 'good',
  theory: TH(`A functional dependency says one set of columns determines another; when a table mixes facts with different determinants, the same fact repeats and insert, update and delete anomalies appear.`,
`<p>In a well-designed table, every column describes the thing the key identifies. In a spreadsheet of order lines, the customer's city describes the <i>customer</i>, not the order line, so it gets copied onto every line. Copies drift apart (update anomaly), you can't add a customer before they order (insertion anomaly), and deleting their only order loses their address (deletion anomaly).</p>
<p>Functional dependencies are the precise way to say "describes": <code>customer_id → city</code> means "once you know the customer, the city is fixed".</p>`,
[[`Functional dependency (FD)`,`X → Y: any two rows with the same X have the same Y.`],[`Determinant`,`The left side X of an FD.`],[`Partial dependency`,`A non-key column depends on part of a composite key.`],[`Transitive dependency`,`A non-key column depends on another non-key column.`],[`Update anomaly`,`Inconsistent copies after a partial update.`],[`Insertion / deletion anomaly`,`Can't add, or accidentally lose, an independent fact.`]],
[`List the columns and the business rules.`,`Write down each FD: what determines what.`,`Find the keys (columns that determine everything).`,`Spot partial and transitive dependencies: they are the redundancy.`],
[`Diagnosing messy imports and legacy tables.`,`Explaining in design reviews why a column belongs in another table.`,`Deciding where to denormalise deliberately (3.6) and how to keep copies in sync.`],
[`Reading FDs off sample data instead of business rules.`,`Splitting tables without checking the join gives back the original (lossless join).`,`Forgetting that unit_price on an order line is intentionally a snapshot, not a dependency on product_id.`]),
  examples: [
    {lv:'basic', title:'Spot the redundancy', sql:`SELECT customer_id, customer_name, customer_city, COUNT(*) AS copies
FROM order_sheet
GROUP BY customer_id, customer_name, customer_city
ORDER BY customer_id;`, why:`Each customer's name and city are stored once per order line. Ben appears twice with different spellings of his city.`},
    {lv:'mid', title:'Find FD violations: one customer, many cities', sql:`SELECT customer_id, COUNT(DISTINCT customer_city) AS cities,
       GROUP_CONCAT(DISTINCT customer_city) AS values_seen
FROM order_sheet
GROUP BY customer_id
HAVING COUNT(DISTINCT customer_city) > 1;`, why:`If customer_id → customer_city held, every customer would have exactly one city. Ben breaks it: the update anomaly already happened.`},
    {lv:'adv', title:'Decompose and check the join is lossless', sql:`CREATE TABLE customers AS SELECT DISTINCT customer_id, customer_name FROM order_sheet;
CREATE TABLE products  AS SELECT DISTINCT product_id, product_name, category FROM order_sheet;
CREATE TABLE orders    AS SELECT DISTINCT order_id, order_date, customer_id FROM order_sheet;
CREATE TABLE items     AS SELECT order_id, product_id, qty, unit_price FROM order_sheet;

SELECT COUNT(*) AS rebuilt_rows FROM items i
JOIN orders o    ON o.order_id = i.order_id
JOIN customers c ON c.customer_id = o.customer_id
JOIN products p  ON p.product_id = i.product_id;`, why:`Joining the pieces gives back exactly 10 rows, the same as the sheet: a lossless decomposition. (City is left out here because the data has two values for Ben; you'd clean it first.)`},
  ],
  tips: {
    say:`"Functional dependencies say what determines what. If a table holds facts that depend on part of its key or on another non-key column, those facts repeat, which leads to update, insertion and deletion anomalies. Normalization decomposes the table so each fact lives with the key that determines it."`,
    points:[`Give one concrete example of each anomaly.`,`Use the words partial and transitive dependency.`,`Mention lossless-join decomposition.`],
    traps:[`Calling any duplication an anomaly (some duplication is intentional snapshots, like price at time of order).`,`Deriving FDs from a small sample.`],
    qa:[[`What's a transitive dependency?`,`order_id → customer_id → customer_city: the city depends on the key only through a non-key column.`],
        [`Is storing unit_price on order_items redundant with products.price?`,`No: it's the price at the time of sale, a different fact. The FD is (order_id, product_id) → unit_price.`],
        [`What does lossless join mean?`,`Joining the decomposed tables reproduces exactly the original rows, no more and no less. Guaranteed when the common columns are a key of one of the tables.`]]
  },
  exercises: [
    {lv:'E', q:`List products that appear in the sheet with how many lines mention each: <code>product_id, product_name, lines</code>.`, hint:`GROUP BY product_id, product_name.`,
     sql:`SELECT product_id, product_name, COUNT(*) AS lines FROM order_sheet GROUP BY product_id, product_name;`},
    {lv:'M', q:`Check the FD <code>product_id → category</code>: return any product_id that appears with more than one category (expect none), and then the FD <code>order_id → order_date</code> the same way. Return one combined result with columns <code>fd, id</code>, where you add a deliberately broken row first: <code>INSERT INTO order_sheet VALUES (104,'2024-02-16',3,'Chen','Pune',6,'Lamp','furniture',1,40);</code>`, hint:`Two GROUP BY … HAVING COUNT(DISTINCT …) &gt; 1 queries glued with UNION ALL.`,
     sql:`INSERT INTO order_sheet VALUES (104,'2024-02-16',3,'Chen','Pune',6,'Lamp','furniture',1,40);
SELECT 'product_id -> category' AS fd, product_id AS id FROM order_sheet GROUP BY product_id HAVING COUNT(DISTINCT category) > 1
UNION ALL
SELECT 'order_id -> order_date', order_id FROM order_sheet GROUP BY order_id HAVING COUNT(DISTINCT order_date) > 1;`},
    {lv:'H', q:`For <code>enrollments(student_id, course_code, student_name, course_title, instructor, instructor_office, grade)</code> with key (student_id, course_code): list all FDs and classify each as full, partial or transitive.`, hint:`What does each column really describe?`,
     answer:`<ul><li>(student_id, course_code) → grade: <b>full</b></li><li>student_id → student_name: <b>partial</b></li><li>course_code → course_title, instructor: <b>partial</b></li><li>instructor → instructor_office, so course_code → instructor → instructor_office: <b>transitive</b> (and partial via course_code)</li></ul>`},
  ],
  quiz: [
    [`customer_id → city means…`,[`city determines customer_id`,`rows with the same customer_id have the same city`,`customer_id is unique`,`city is a key`],1,`Equal X ⇒ equal Y.`,'E'],
    [`Changing a customer's city in some rows but not others is…`,[`An insertion anomaly`,`An update anomaly`,`A deletion anomaly`,`A phantom read`],1,`Copies disagree.`,'E'],
    [`Can't add a product until it's ordered: which anomaly?`,[`Update`,`Insertion`,`Deletion`,`None`],1,`The key requires an order.`,'E'],
    [`With key (order_id, product_id), order_id → order_date is a…`,[`Full dependency`,`Partial dependency`,`Transitive dependency`,`Multivalued dependency`],1,`Depends on part of the key.`,'M'],
    [`order_id → customer_id → customer_city: city's dependency on order_id is…`,[`Partial`,`Transitive`,`Trivial`,`Multivalued`],1,`Through a non-key column.`,'M'],
    [`A lossless decomposition guarantees…`,[`Fewer rows`,`Joining the parts recreates exactly the original table`,`No foreign keys needed`,`Faster queries`],1,`No spurious rows.`,'M'],
  ],
  quizAdv: [
    [`A trivial FD is one where…`,[`Y is empty`,`Y ⊆ X (e.g. {a, b} → a)`,`X is a key`,`X has one column`],1,`Always holds.`,'H'],
    [`Armstrong's axioms include…`,[`Reflexivity, augmentation, transitivity`,`Union, intersection, difference`,`Atomicity, consistency, isolation`,`Selection, projection, join`],0,`Used to derive all implied FDs.`,'H'],
    [`R(A, B, C) with the FD A → B. Which split is guaranteed lossless?`,[`R1(A, B) and R2(A, C)`,`R1(A, B) and R2(B, C)`,`R1(A, C) and R2(B, C)`,`R1(A) and R2(B, C)`],0,`The shared column A is a key of R1(A, B) (A → B), so joining on A can't create spurious rows.`,'H'],
  ],
});
