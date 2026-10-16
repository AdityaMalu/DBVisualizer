/* 10.1 Scenario: design an e-commerce schema in an interview */
topic('10', { no:'10.1', title:'Scenario: design the schema for an online store', db:'shop',
idea:`The classic "design the database for X" interview, done step by step: clarify requirements, list entities and relationships, write the tables with keys and constraints, snapshot prices, add indexes from the queries, then discuss growth (partitioning, read replicas, search, caching).`,
dgTitle:'Schema', stateTitle:'Decision',
nodes:{
  cu:{x:70,y:40,label:'customers',w:110},
  ad:{x:70,y:150,label:'addresses',w:110},
  or:{x:250,y:40,label:'orders',w:100},
  oi:{x:250,y:150,label:'order_items',w:120,kind:'lock'},
  pr:{x:430,y:150,label:'products',w:110},
  ca:{x:430,y:40,label:'categories',w:110},
  pa:{x:250,y:250,label:'payments',w:110},
  inv:{x:430,y:250,label:'inventory',w:110}
},
edges:[['ad','cu','N:1'],['or','cu','N:1'],['oi','or','N:1'],['oi','pr','N:1'],['pr','ca','N:1'],['pa','or','N:1'],['inv','pr','1:1']],
vb:'0 0 520 290',
codes:{a:`CREATE TABLE customers (id BIGINT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
                        name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE products  (id BIGINT PRIMARY KEY, sku TEXT NOT NULL UNIQUE,
                        name TEXT NOT NULL, category_id BIGINT REFERENCES categories,
                        price NUMERIC(12,2) NOT NULL CHECK (price >= 0), active BOOLEAN);
CREATE TABLE inventory (product_id BIGINT PRIMARY KEY REFERENCES products,
                        on_hand INT NOT NULL CHECK (on_hand >= 0), reserved INT NOT NULL);
CREATE TABLE orders    (id BIGINT PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers,
                        status TEXT NOT NULL CHECK (status IN ('pending','paid','shipped','cancelled')),
                        total NUMERIC(12,2) NOT NULL, ship_address JSONB NOT NULL,   -- snapshot
                        created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE order_items (order_id BIGINT REFERENCES orders ON DELETE CASCADE,
                        product_id BIGINT REFERENCES products, qty INT NOT NULL CHECK (qty > 0),
                        unit_price NUMERIC(12,2) NOT NULL,                           -- snapshot
                        PRIMARY KEY (order_id, product_id));
CREATE TABLE payments  (id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders,
                        amount NUMERIC(12,2) NOT NULL, status TEXT NOT NULL,
                        idempotency_key TEXT NOT NULL UNIQUE);

CREATE INDEX ON orders (customer_id, created_at DESC);     -- "my orders"
CREATE INDEX ON order_items (product_id);                  -- FK + "who bought X"
CREATE INDEX ON orders (status) WHERE status = 'pending';  -- ops queue`},
steps:[
{hl:{}, d:null, g:[G('Clarify first (out loud)',['scale','orders/day, catalog size, regions'],['features','guest checkout? reviews? multiple sellers? coupons?'],['must be exact','money, stock, order history','hot'],['reads vs writes','browse-heavy; checkout writes'],['out of scope','recommendations, search ranking (separate systems)'])],
 say:`Don't start writing tables. Spend the first minutes <b>clarifying</b>: how many orders per day, how big is the catalog, guest checkout, marketplace or single seller, what must be exact (money, stock, history) and what can be eventually consistent (recommendations, counters). State assumptions explicitly; interviewers grade the reasoning as much as the schema.`},
{hl:{}, d:{}, g:[G('Entities & cardinality',['customer 1:N orders','order 1:N items'],['product 1:N items','M:N orders ⇄ products via order_items','hot'],['product N:1 category',''],['order 1:N payments','retries, partial refunds'],['product 1:1 inventory','separate: hot, frequently updated row'])],
 say:`From the requirements: customers place orders; an order has many lines; each line references a product, making orders ⇄ products a many-to-many resolved by <b>order_items</b> (3.1). Payments are 1:N per order (retries, refunds). Inventory is split from products because it's updated constantly and contended, while product details are read-mostly.`},
{hl:{q:[1,2,3,4,5]}, d:{on:['cu','pr']}, g:[G('Keys & constraints',['surrogate BIGINT PKs','stable ids (3.2)'],['natural keys UNIQUE','email, sku','ok'],['money','NUMERIC, never FLOAT (0.5)','ok'],['CHECKs','price ≥ 0, qty > 0, status enum','ok'],['soft delete','products.active instead of DELETE (referenced by history)'])],
 say:`Tables get surrogate primary keys plus UNIQUE constraints on natural keys (email, SKU). Money is NUMERIC. CHECK constraints encode invariants. Products are never hard-deleted (old orders reference them); an <code>active</code> flag hides them instead (3.7).`},
{hl:{q:[8,9,10,11,12,13,14,15]}, d:{on:['or','oi'], e:[['oi','or','N:1','hot'],['oi','pr','N:1','hot']]}, g:[G('Snapshots (intentional denormalization)',['order_items.unit_price','price at time of sale','hot'],['orders.ship_address','address at time of order','hot'],['why','history must not change when product price or address changes','ok'],['orders.total','denormalized for list pages (3.6), set at checkout'])],
 say:`A subtle but important point: <b>order lines store the unit price at the time of sale</b>, and the order stores a <b>snapshot of the shipping address</b>. If the product price or the customer's address changes later, old orders must still show what was actually charged and where it went. This isn't an update anomaly; it's a different fact (3.3).`},
{hl:{q:[6,7,16,17,18]}, d:{on:['inv','pa'], e:[['inv','pr','1:1','hot'],['pa','or','N:1','hot']]}, g:[G('Correctness under concurrency',['stock','UPDATE inventory SET on_hand = on_hand - :q WHERE product_id = :p AND on_hand >= :q (6.6)','ok'],['payments','idempotency_key UNIQUE → no double charge (10.5)','ok'],['checkout','one transaction: order + items + stock reservation','ok'],['payment provider','outside the DB transaction: saga/outbox (8.6)'])],
 say:`Concurrency-sensitive parts: <b>stock</b> is decremented with a guarded atomic UPDATE (or a reservation) inside the checkout transaction, so two buyers can't take the last unit (6.6, 10.3). <b>Payments</b> carry a unique idempotency key so retries can't double charge (10.5). The external card charge sits outside the database transaction, coordinated with an outbox/saga (8.6).`},
{hl:{q:[20,21,22]}, d:{}, g:[G('Indexes from queries',['my orders, newest first','(customer_id, created_at DESC)','ok'],['order lines by product','(product_id) also covers the FK','ok'],['ops: pending orders','partial index WHERE status = pending','ok'],['catalog browse','(category_id, price), search engine for text (9.6)'])],
 say:`Indexes come from the main queries, not from guessing: "my orders" needs (customer_id, created_at DESC) (4.4); foreign keys get indexes (0.4); a partial index serves the operations queue of pending orders (4.6). Product search goes to a search engine fed by CDC, not LIKE.`},
{hl:{}, d:{}, g:[G('Growth plan',['reads','replicas + cache product pages (8.1, 8.10)'],['big tables','partition orders by month (8.3)'],['analytics','CDC → warehouse star schema (3.6, 9.7)'],['much later','shard by customer_id (co-locates a customer\'s orders)'],['audit','order status history table / events'])],
 say:`<b>Say it:</b> "I'd clarify scale and what must be exact, then model customers, products, orders, order_items as the many-to-many, payments and a separate inventory table. Surrogate keys with unique natural keys, NUMERIC money, CHECK constraints, and price and address snapshots on orders. Stock is decremented atomically and payments are idempotent. Indexes follow the main queries. To grow: cache and replicas for reads, partition orders by time, send analytics to a warehouse, and only then shard by customer."`}
],
keep:[`Clarify scale, features and what must be exact before drawing tables.`,`orders ⇄ products via order_items; inventory separate (hot); payments 1:N with idempotency key.`,`Snapshots: unit_price and shipping address on the order (history must not change).`,`Constraints + NUMERIC money; soft-delete products.`,`Indexes from queries; growth: cache/replicas → partitioning → warehouse → sharding.`]}, {
  imp: 'must',
  theory: TH(`A schema design interview tests whether you can turn vague requirements into correct tables, keys, constraints and indexes, and reason about concurrency and growth.`,
`<p>There's no single right answer; there's a process: clarify requirements, identify entities and relationships, choose keys and constraints, decide where to denormalize deliberately, derive indexes from the queries, and explain how the design survives concurrency and growth.</p>
<p>The most common mistakes are jumping straight into tables without asking questions, forgetting historical facts (prices change!), and ignoring what happens when two customers buy the last item at the same moment.</p>`,
[[`Requirements`,`Functional (features) and non-functional (scale, consistency).`],[`Entity / relationship`,`Things and how they relate (3.1).`],[`Snapshot column`,`A copy of a value as of an event, kept on purpose.`],[`Invariant`,`A rule that must always hold (stock ≥ 0).`],[`Idempotency key`,`Client-supplied id that makes retries safe.`],[`Access pattern`,`A query the system runs often.`]],
[`Clarify requirements and scale; write assumptions down.`,`List entities, relationships and cardinalities.`,`Write tables: keys, types, constraints, snapshots.`,`Derive indexes from the top queries.`,`Walk through concurrency hazards and the growth path.`],
[`The same steps apply to any domain: bookings, ride-hailing, banking, social feeds.`,`Design docs in industry follow this structure.`,`Migrations evolve the schema safely afterwards (10.4).`],
[`No clarifying questions.`,`Prices/addresses referenced live from orders.`,`FLOAT money, no constraints.`,`Hard-deleting products referenced by old orders.`,`Premature sharding/NoSQL.`]),
  examples: [
    {lv:'basic', title:'"My orders" for a customer', sql:`SELECT id, order_date, status
FROM orders
WHERE customer_id = 1
ORDER BY order_date DESC;`, why:`The most common query on this schema; an index on (customer_id, order_date DESC) serves it without sorting.`},
    {lv:'mid', title:'Price snapshot vs current price', sql:`SELECT oi.order_id, p.name, oi.unit_price AS charged, p.price AS current_price,
       p.price - oi.unit_price AS changed_by
FROM order_items oi JOIN products p ON p.id = oi.product_id
WHERE oi.unit_price <> p.price;`, why:`Orders keep what was actually charged. If order_items referenced products.price, these historical orders would silently change.`},
    {lv:'adv', title:'Checkout as one transaction with a guarded stock decrement', sql:`CREATE TABLE inventory (product_id INTEGER PRIMARY KEY REFERENCES products(id),
                        on_hand INTEGER NOT NULL CHECK (on_hand >= 0));
INSERT INTO inventory VALUES (1, 1), (3, 10);
BEGIN;
INSERT INTO orders VALUES (111, 4, '2024-05-01', 'placed');
INSERT INTO order_items VALUES (111, 1, 1, 900), (111, 3, 1, 120);
UPDATE inventory SET on_hand = on_hand - 1 WHERE product_id = 1 AND on_hand >= 1;
UPDATE inventory SET on_hand = on_hand - 1 WHERE product_id = 3 AND on_hand >= 1;
COMMIT;
SELECT * FROM inventory;`, why:`Order, lines and stock change atomically. In application code, check each UPDATE's affected rows and ROLLBACK if any is 0 (out of stock).`},
  ],
  tips: {
    say:`"I'd start by clarifying scale and what must be exact. Then entities: customers, products, categories, orders, order_items as the many-to-many with qty and a unit_price snapshot, payments with an idempotency key, and inventory separated because it's hot. Surrogate keys plus unique natural keys, NUMERIC money, CHECK constraints, soft-delete products. Indexes from the main queries. Concurrency: atomic stock decrement, idempotent payments, outbox for the payment provider. Growth: cache and replicas, partition orders by time, warehouse for analytics, shard by customer last."`,
    points:[`Ask questions before drawing.`,`Mention snapshots and soft deletes unprompted.`,`Cover concurrency (last item, double charge) and the growth path.`],
    traps:[`Designing for "millions of TPS" without being asked.`,`Forgetting order status history / auditability.`],
    qa:[[`How do you handle product prices changing?`,`products.price is the current price; order_items.unit_price snapshots the charged price; optionally a price_history table for analytics.`],
        [`How do you prevent overselling the last item?`,`Guarded atomic decrement (WHERE on_hand >= qty) or reservations with expiry, inside the checkout transaction; for flash sales, see 10.3.`],
        [`How would you support multiple sellers (marketplace)?`,`Add sellers; products/listings belong to a seller; an order may split into per-seller sub-orders/shipments; payouts table; consider sharding by seller or customer.`]]
  },
  exercises: [
    {lv:'E', q:`Total spent per customer on delivered orders, from the line-item snapshots: <code>customer_id, spent</code>.`, hint:`Join orders and order_items; SUM(qty * unit_price).`,
     sql:`SELECT o.customer_id, SUM(oi.qty * oi.unit_price) AS spent
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'delivered'
GROUP BY o.customer_id;`},
    {lv:'M', q:`Products that have never been sold, as ops wants to review them: <code>id, name</code>. (Insert a new product first: <code>(9, 'Mug', 'kitchen', 12)</code>.)`, hint:`NOT EXISTS against order_items.`,
     sql:`INSERT INTO products VALUES (9, 'Mug', 'kitchen', 12);
SELECT p.id, p.name FROM products p
WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id);`},
    {lv:'H', q:`Extend the schema for coupons: a coupon has a code, a percentage or fixed discount, a validity window, a global usage limit and "once per customer". Give the tables and how you enforce the limits under concurrency.`, hint:`Unique constraints and guarded counters.`,
     answer:`<ul><li>coupons(id, code UNIQUE, kind CHECK IN ('pct','fixed'), value, starts_at, ends_at, max_uses, used_count DEFAULT 0, CHECK (used_count &lt;= max_uses)).</li><li>coupon_redemptions(coupon_id, customer_id, order_id, PRIMARY KEY (coupon_id, customer_id)): the PK enforces once per customer.</li><li>At checkout (same transaction): <code>UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND used_count &lt; max_uses AND now() BETWEEN starts_at AND ends_at</code> (0 rows → reject), then INSERT the redemption (unique violation → reject).</li><li>Store the applied discount on the order (snapshot).</li></ul>`},
  ],
  quiz: [
    [`First step in a schema design interview?`,[`Write CREATE TABLE`,`Clarify requirements, scale and what must be exact`,`Pick NoSQL`,`Add indexes`],1,`Assumptions out loud.`,'E'],
    [`Why store unit_price on order_items?`,[`Faster joins`,`Orders must keep the price actually charged even if the product price changes`,`It's required by 3NF`,`To avoid indexes`],1,`Historical fact.`,'E'],
    [`Why separate inventory from products?`,[`3NF requires it`,`Stock is updated constantly and contended; product details are read-mostly`,`To save space`,`For security`],1,`Hot row isolation.`,'M'],
    [`How should old products referenced by orders be removed?`,[`DELETE CASCADE`,`Soft delete (active = false)`,`TRUNCATE`,`Drop the FK`],1,`History stays valid.`,'E'],
    [`Index for "my orders, newest first"?`,[`(created_at)`,`(customer_id, created_at DESC)`,`(status)`,`(id)`],1,`Equality then sort (4.4).`,'M'],
    [`What prevents a double charge on payment retry?`,[`A CHECK`,`A unique idempotency key on payments`,`SERIALIZABLE`,`A trigger`],1,`See 10.5.`,'M'],
  ],
  quizAdv: [
    [`Storing the ship address as a JSON snapshot on orders is…`,[`A normalization error`,`Intentional: the order records where it was shipped, independent of later edits`,`Required for indexes`,`Insecure`],1,`Different fact from current address.`,'H'],
    [`When would you shard this schema, and by what key?`,[`Immediately, by product`,`After caching, replicas and partitioning are exhausted; by customer_id to co-locate a customer's orders`,`By status`,`By date`],1,`Most queries are per customer.`,'H'],
    [`Reserve stock at add-to-cart or at checkout?`,[`Always at add-to-cart`,`Usually at checkout (or short-lived reservations with expiry) to avoid locking stock in abandoned carts`,`Never reserve`,`At shipping`],1,`Business trade-off.`,'H'],
  ],
});
