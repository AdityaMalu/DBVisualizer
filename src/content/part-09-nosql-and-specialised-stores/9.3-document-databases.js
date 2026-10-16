/* 9.3 Document databases (MongoDB) */
topic('9', { no:'9.3', title:'Document databases: embedding vs referencing, indexes, aggregation (MongoDB)', db:'shop',
idea:`Model a blog in MongoDB. Embed comments inside posts and see one read fetch everything; watch the document grow unbounded and switch to references; query nested fields with indexes, and run an aggregation pipeline that groups like SQL's GROUP BY.`,
stateTitle:'Design rule', tbTitle:'Documents',
codes:{a:`// embed: data read together, bounded, owned by the parent
db.posts.insertOne({
  _id: 7, title: "Indexes 101", author: { id: 1, name: "Asha" },
  tags: ["sql", "indexes"],
  comments: [ { by: "Ben", text: "Great!" }, { by: "Chen", text: "Thanks" } ]
})

// reference: unbounded or shared data lives in its own collection
db.comments.insertOne({ post_id: 7, by: "Ben", text: "Great!", at: ISODate() })

// query nested fields / arrays, with indexes
db.posts.createIndex({ tags: 1 })                       // multikey index
db.posts.find({ tags: "sql", "author.name": "Asha" })

// aggregation pipeline ≈ WHERE → GROUP BY → ORDER BY
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $group: { _id: "$customer_id", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } }, { $limit: 3 }
])`},
steps:[
{hl:{q:[2,3,4,5,6]}, tb:[TB('posts (one document)',['field','value'],[['_id',7],['title','Indexes 101'],['author','{id: 1, name: Asha}'],['tags','["sql","indexes"]'],['comments','[{Ben…}, {Chen…}]']])], g:[G('Document model',['unit','a JSON/BSON document (≤ 16 MB in MongoDB)'],['collection','group of documents, no fixed schema'],['embedding','nest related data inside','hot'],['one read','post + author + tags + comments','ok'])],
 say:`A <b>document database</b> stores self-contained JSON-like documents in collections. Here a blog post <b>embeds</b> its author summary, tags and comments. Rendering the post page is a single read by _id: no joins, data already shaped like the API response. Documents in a collection don't have to share a schema.`},
{hl:{q:[5]}, tb:[TB('post 7 over time',['comments','document size'],[[2,'1 KB'],[5000,'1.2 MB'],[60000,'> 16 MB → write fails']],{2:'bad'})], g:[G('When embedding hurts',['unbounded arrays','document grows forever','bad'],['16 MB limit','hard ceiling','bad'],['every update','rewrites a big document'],['shared data','author name copied into every post → update anomaly (3.3)','bad'])],
 say:`Embedding has limits. A viral post with 60,000 comments outgrows the 16 MB document limit, and every new comment rewrites an ever-larger document. And the author's name is <b>copied</b> into every post: if Asha renames herself, every post must be updated (the same update anomaly normalization avoids).`},
{hl:{q:[8,9]}, tb:[TB('comments (own collection)',['_id','post_id','by','text'],[['c1',7,'Ben','Great!'],['c2',7,'Chen','Thanks']],{0:'new',1:'new'})], g:[G('Referencing',['store','post_id in each comment'],['read','2 queries, or $lookup (a join)'],['good for','unbounded, independently accessed or shared data','ok']), G('Rule of thumb',['embed','1:few, read together, owned','ok'],['reference','1:many/unbounded, M:N, shared','ok'])],
 say:`<b>Referencing</b> puts comments in their own collection with a <code>post_id</code>, like a foreign key. Reading a post with comments now takes two queries (or a <code>$lookup</code>, Mongo's join). Rule of thumb: <b>embed</b> one-to-few data that's read with the parent and owned by it; <b>reference</b> unbounded, many-to-many or shared data. Design around your queries.`},
{hl:{q:[11,12,13]}, g:[G('Indexes on documents',['single / compound','like B-trees in SQL (4.2)'],['multikey','one entry per array element: tags','hot'],['nested fields','"author.name"'],['no index','collection scan (COLLSCAN)','bad'])],
 say:`Indexes work like in SQL: B-trees on fields, including <b>nested fields</b> (<code>author.name</code>) and arrays (a <b>multikey</b> index has one entry per tag). The leftmost-prefix rule applies to compound indexes too (4.4), and without an index a query scans the whole collection.`},
{hl:{q:[15,16,17,18,19,20]}, tb:[TB('pipeline result',['_id (customer)','total'],[[1,1720],[5,1300],[2,845]])], g:[G('Aggregation pipeline',['$match','WHERE'],['$group','GROUP BY + aggregates','hot'],['$sort / $limit','ORDER BY / LIMIT'],['$lookup','LEFT JOIN'],['$unwind','one row per array element'])],
 say:`For analytics, MongoDB has the <b>aggregation pipeline</b>: a list of stages that transform documents, which maps neatly onto SQL: <code>$match</code> = WHERE, <code>$group</code> = GROUP BY, <code>$sort</code>/<code>$limit</code>, <code>$lookup</code> = LEFT JOIN, <code>$unwind</code> flattens arrays.`},
{hl:{}, g:[G('Transactions & consistency',['single document','always atomic','ok'],['multi-document','ACID transactions since 4.0 (costlier)'],['writeConcern majority','durable on a majority'],['readConcern majority / linearizable','avoid reading rolled-back data'])],
 say:`<b>Say it:</b> "Document databases store self-contained JSON documents, so data read together can be embedded and fetched in one read, with a flexible schema. I embed one-to-few, owned data and reference unbounded or shared data, watching the document size limit and update anomalies from duplication. Queries use B-tree indexes on nested fields and arrays, and the aggregation pipeline covers GROUP BY-style analytics. Single-document writes are atomic; multi-document transactions exist but cost more."`}
],
keep:[`Embed 1:few owned data read with the parent; reference unbounded/M:N/shared data.`,`Watch unbounded arrays (16 MB limit) and duplicated fields (update anomalies).`,`Indexes: compound, nested fields, multikey arrays; no index → COLLSCAN.`,`Aggregation: $match/$group/$sort/$lookup/$unwind ≈ WHERE/GROUP BY/ORDER BY/JOIN.`,`Single-document atomicity; multi-doc transactions cost more.`]}, {
  imp: 'good',
  theory: TH(`A document database stores data as nested JSON-like documents; the key design decision is what to embed in a document and what to reference from elsewhere.`,
`<p>Relational design asks "what are the entities?"; document design asks "what does the application read and write together?". If a page always shows an order with its items, store them together in one document, and the page is one read.</p>
<p>The trade-offs mirror normalization: embedding duplicates data and can grow documents without bound; referencing avoids that but needs extra queries or joins. MongoDB, Couchbase, Firestore and DynamoDB items (as documents) all work this way, and Postgres JSONB lets you mix both styles.</p>`,
[[`Document`,`A JSON/BSON object with nested fields and arrays.`],[`Collection`,`Group of documents (like a table without fixed schema).`],[`Embedding`,`Nesting related data inside a document.`],[`Referencing`,`Storing ids that point to other documents.`],[`Multikey index`,`Index entry per array element.`],[`Aggregation pipeline`,`Stages that filter, group and reshape documents.`],[`$lookup`,`Join between collections.`]],
[`List the application's queries and their shapes.`,`Embed data that is read together and bounded; reference the rest.`,`Index the fields used in filters and sorts.`,`Use the pipeline for aggregation; transactions only when necessary.`],
[`Product catalogs with varying attributes; content management; user profiles.`,`Event and log data with flexible payloads.`,`Postgres JSONB as a "document column" inside a relational schema.`],
[`Unbounded embedded arrays (comments, logs).`,`Duplicating mutable shared data without a sync plan.`,`Modeling a highly relational domain in documents and doing joins in app code.`,`Missing indexes: silent collection scans.`]),
  examples: [
    {lv:'basic', title:'Store and read a document (SQLite JSON)', sql:`CREATE TABLE posts (id INTEGER PRIMARY KEY, doc TEXT CHECK (json_valid(doc)));
INSERT INTO posts VALUES (7, '{"title":"Indexes 101","author":{"id":1,"name":"Asha"},"tags":["sql","indexes"],"comments":[{"by":"Ben","text":"Great!"},{"by":"Chen","text":"Thanks"}]}');
SELECT json_extract(doc, '$.title') AS title,
       json_extract(doc, '$.author.name') AS author,
       json_array_length(doc, '$.comments') AS comments
FROM posts WHERE id = 7;`, why:`Nested fields read with paths, the same way MongoDB's "author.name" works.`},
    {lv:'mid', title:'Query inside arrays (find posts tagged sql)', sql:`CREATE TABLE posts (id INTEGER PRIMARY KEY, doc TEXT);
INSERT INTO posts VALUES
 (7, '{"title":"Indexes 101","tags":["sql","indexes"]}'),
 (8, '{"title":"Redis tips","tags":["redis","cache"]}'),
 (9, '{"title":"Joins","tags":["sql"]}');
SELECT p.id, json_extract(p.doc, '$.title') AS title
FROM posts p, json_each(p.doc, '$.tags') t
WHERE t.value = 'sql';`, why:`<code>json_each</code> unwinds the array (like <code>$unwind</code>); Mongo would answer <code>find({tags: "sql"})</code> via a multikey index.`},
    {lv:'adv', title:'Aggregation pipeline in SQL terms', sql:`SELECT o.customer_id AS _id, SUM(oi.qty * oi.unit_price) AS total     -- $group
FROM orders o JOIN order_items oi ON oi.order_id = o.id                  -- ($lookup)
WHERE o.status = 'delivered'                                              -- $match
GROUP BY o.customer_id
ORDER BY total DESC                                                       -- $sort
LIMIT 3;                                                                  -- $limit`, why:`Each pipeline stage has a SQL counterpart; the logical order (match → group → sort → limit) is the same as 1.2.`},
  ],
  tips: {
    say:`"In a document database I model around access patterns: embed one-to-few data that's read and owned with the parent, reference unbounded or shared data, and index nested fields and arrays. I watch for unbounded arrays and duplicated fields, use the aggregation pipeline for analytics, and remember single-document writes are atomic while multi-document transactions are costlier."`,
    points:[`State the embed vs reference rule with examples.`,`Mention the 16 MB limit and update anomalies.`,`Map the aggregation pipeline to SQL.`],
    traps:[`"Schemaless means no design needed."`,`Embedding everything.`],
    qa:[[`How would you model users and orders in MongoDB?`,`Users and orders as separate collections (orders reference user_id, unbounded); embed order line items inside each order (bounded, read together); maybe embed a user snapshot (name, address at order time) intentionally.`],
        [`What's a multikey index?`,`An index on an array field with one entry per element, so queries matching any element use the index.`],
        [`Does MongoDB support transactions?`,`Single-document operations are atomic; multi-document ACID transactions exist since 4.0 (replica sets) and 4.2 (sharded), with performance costs; design so most writes touch one document.`]]
  },
  exercises: [
    {lv:'E', q:`Create a <code>posts</code> table with a JSON doc for post 1 <code>{"title":"Hello","likes":5}</code> and return its likes as <code>likes</code>.`, hint:`json_extract(doc, '$.likes').`,
     sql:`CREATE TABLE posts (id INTEGER PRIMARY KEY, doc TEXT);
INSERT INTO posts VALUES (1, '{"title":"Hello","likes":5}');
SELECT json_extract(doc, '$.likes') AS likes FROM posts WHERE id = 1;`},
    {lv:'M', q:`Turn each order into a document with embedded items: <code>id, doc</code> where doc is <code>{"status": …, "items": [{"product_id": …, "qty": …}]}</code>, for orders 101 and 102.`, hint:`json_object + json_group_array in a correlated subquery.`,
     sql:`SELECT o.id,
       json_object('status', o.status,
                   'items', (SELECT json_group_array(json_object('product_id', oi.product_id, 'qty', oi.qty))
                             FROM order_items oi WHERE oi.order_id = o.id)) AS doc
FROM orders o WHERE o.id IN (101, 102);`},
    {lv:'H', q:`Design MongoDB collections for a Q&A site (questions, answers, votes, users, tags). Say what you embed, what you reference, and which indexes you create.`, hint:`Bounded vs unbounded; read patterns.`,
     answer:`<ul><li><b>questions</b>: title, body, tags[] (embedded, bounded), author snapshot {id, name}, answer_count, score. Indexes: {tags: 1, score: -1}, {author.id: 1, created_at: -1}, text index on title/body.</li><li><b>answers</b>: separate collection (unbounded per question) with question_id, author snapshot, score. Index {question_id: 1, score: -1}.</li><li><b>votes</b>: separate, {user_id, target_id} unique index to prevent double voting; counters updated with $inc on the target.</li><li><b>users</b>: profile; reputation updated with $inc. Author renames update snapshots asynchronously (or accept stale names).</li></ul>`},
  ],
  quiz: [
    [`When should you embed data in a document?`,[`Always`,`When it's one-to-few, owned by the parent and read together`,`When it's unbounded`,`When it's shared across many documents`],1,`Otherwise reference.`,'E'],
    [`Main risk of embedding comments in a post document?`,[`Slower reads`,`Unbounded growth (16 MB limit) and rewriting large documents`,`No indexes`,`No JSON support`],1,`Reference unbounded data.`,'M'],
    [`A multikey index in MongoDB indexes…`,[`Multiple collections`,`Each element of an array field`,`Only keys`,`Two databases`],1,`Queries on any element use it.`,'M'],
    [`$group in an aggregation pipeline corresponds to SQL's…`,[`WHERE`,`GROUP BY`,`JOIN`,`ORDER BY`],1,`$match = WHERE.`,'E'],
    [`$lookup corresponds to…`,[`A LEFT JOIN`,`A UNION`,`An index`,`A trigger`],0,`Join between collections.`,'E'],
    [`In MongoDB, a single-document update is…`,[`Not atomic`,`Atomic`,`Atomic only with transactions`,`Eventually consistent only`],1,`Even with nested fields.`,'M'],
  ],
  quizAdv: [
    [`Duplicating the author's name in every post leads to…`,[`Nothing`,`An update anomaly when the name changes (must update many documents)`,`Faster writes`,`Index corruption`],1,`Same as 3.3.`,'H'],
    [`MongoDB writeConcern: "majority" ensures…`,[`Faster writes`,`The write is acknowledged after a majority of replica set members have it (survives failover)`,`Linearizable reads`,`No indexes are used`],1,`Durability across failover.`,'H'],
    [`Postgres JSONB vs a document DB: an advantage of JSONB is…`,[`No indexes`,`Mixing relational columns, joins, constraints and ACID with flexible JSON fields`,`No SQL`,`Unlimited document size`],1,`Hybrid modeling.`,'H'],
  ],
});
