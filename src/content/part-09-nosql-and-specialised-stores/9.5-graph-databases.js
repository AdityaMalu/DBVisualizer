/* 9.5 Graph databases */
topic('9', { no:'9.5', title:'Graph databases: nodes, relationships, traversals (Cypher vs SQL)', db:'hr',
idea:`"Friends of friends who aren't already my friends" in SQL needs self-joins that multiply with every hop. Model the same data as a property graph, write the traversal in Cypher, and see why index-free adjacency keeps multi-hop queries fast, plus when a recursive CTE is enough.`,
dgTitle:'Social graph', stateTitle:'Traversal', tbTitle:'Edges table (relational)',
nodes:{
  asha:{x:80,y:60,label:'Asha',w:80,kind:'actor'},
  ben:{x:240,y:40,label:'Ben',w:80,kind:'actor'},
  chen:{x:240,y:160,label:'Chen',w:80,kind:'actor'},
  diya:{x:410,y:40,label:'Diya',w:80,kind:'actor'},
  eli:{x:410,y:160,label:'Eli',w:80,kind:'actor'},
  farah:{x:540,y:100,label:'Farah',w:80,kind:'actor'}
},
edges:[['asha','ben','FOLLOWS'],['asha','chen','FOLLOWS'],['ben','diya','FOLLOWS'],['chen','eli','FOLLOWS'],['chen','diya','FOLLOWS'],['diya','farah','FOLLOWS']],
vb:'0 0 600 210',
codes:{a:`// Cypher (Neo4j): friends-of-friends Asha doesn't follow yet
MATCH (me:Person {name: 'Asha'})-[:FOLLOWS]->()-[:FOLLOWS]->(fof)
WHERE fof <> me AND NOT (me)-[:FOLLOWS]->(fof)
RETURN fof.name, count(*) AS mutual ORDER BY mutual DESC;

-- SQL: one self-join per hop
SELECT f2.followee, COUNT(*) AS mutual
FROM follows f1
JOIN follows f2 ON f2.follower = f1.followee
WHERE f1.follower = 'Asha' AND f2.followee <> 'Asha'
  AND f2.followee NOT IN (SELECT followee FROM follows WHERE follower = 'Asha')
GROUP BY f2.followee;

// variable-length paths: shortest connection
MATCH p = shortestPath((a:Person {name:'Asha'})-[:FOLLOWS*..6]->(b:Person {name:'Farah'}))
RETURN length(p);`},
steps:[
{hl:{}, d:{}, tb:[TB('follows',['follower','followee'],[['Asha','Ben'],['Asha','Chen'],['Ben','Diya'],['Chen','Eli'],['Chen','Diya'],['Diya','Farah']])], g:[G('Property graph',['nodes','entities with labels + properties (Person {name})'],['relationships','typed, directed, with properties (FOLLOWS {since})','hot'],['relational equivalent','an edges table (follower, followee)'])],
 say:`A <b>property graph</b> has <b>nodes</b> (people) and <b>relationships</b> (FOLLOWS) as first-class, typed, directed records that can carry properties. Relationally, the same data is an edges table with two foreign keys. Both can answer graph questions; the difference shows as queries get deeper.`},
{hl:{q:[2,3,4]}, d:{on:['asha','diya','eli'], e:[['asha','ben','','hot'],['asha','chen','','hot'],['ben','diya','','ok'],['chen','diya','','ok'],['chen','eli','','ok']]}, g:[G('Friends of friends',['hop 1','Ben, Chen'],['hop 2','Diya (via Ben and Chen), Eli'],['result','Diya (2 mutual), Eli (1)','ok'])], log:['Diya: 2 mutual, Eli: 1 mutual'],
 say:`"People Asha might know": follow FOLLOWS twice and exclude people she already follows. In <b>Cypher</b> the pattern reads like the drawing: <code>(me)-[:FOLLOWS]->()-[:FOLLOWS]->(fof)</code>. Diya is reachable through both Ben and Chen (2 mutual), Eli through Chen.`},
{hl:{q:[6,7,8,9,10,11,12]}, d:{on:['asha','diya','eli']}, g:[G('Same query in SQL',['one self-join per hop','follows f1 JOIN follows f2'],['2 hops','fine','ok'],['5 hops','5 self-joins, intermediate results explode','bad'],['variable depth','recursive CTE (2.1)'])],
 say:`The same question in SQL is a self-join per hop. Two hops is perfectly fine with an index on <code>follows(follower)</code>. But each extra hop adds a join, intermediate results grow multiplicatively, and "any depth up to 6" needs a recursive CTE. Still very doable for moderate graphs.`},
{hl:{}, d:{on:['chen'], e:[['chen','eli','pointer','ok'],['chen','diya','pointer','ok']]}, g:[G('Index-free adjacency',['each node stores','direct pointers to its relationships','hot'],['hop cost','follow a pointer: O(1) per edge','ok'],['vs relational','an index lookup per hop: O(log n)'],['matters for','deep, many-hop traversals on big graphs'])],
 say:`Why graph databases are faster for deep traversals: <b>index-free adjacency</b>. Each node physically links to its relationships, so moving to a neighbour is following a pointer, cost proportional to the edges you touch, not to the size of the whole graph. A relational engine does an index lookup per hop, which adds up over many hops and many starting points.`},
{hl:{q:[14,15,16]}, d:{on:['asha','farah'], e:[['asha','chen','','ok'],['chen','diya','','ok'],['diya','farah','','ok']]}, g:[G('Path queries',['shortestPath','built in'],['Asha → Farah','Asha → Chen → Diya → Farah = 3 hops','ok'],['also','PageRank, community detection, recommendation via algorithm libraries'])], log:['shortest path length: 3'],
 say:`Graph query languages make path questions first-class: <code>shortestPath</code>, variable-length patterns <code>*..6</code>, plus libraries of graph algorithms (PageRank, community detection, similarity). Typical use cases: fraud rings, recommendations, network/IT dependency analysis, knowledge graphs, access-control graphs.`},
{hl:{}, d:{}, g:[G('When to use a graph DB',['deep or variable-depth traversals','ok'],['relationship-heavy queries are the core product','ok']), G('When not',['mostly tabular data, aggregations','relational / columnar'],['shallow 1–2 hop queries','SQL with indexes is fine'],['massive scale-out writes','harder to shard graphs'])],
 say:`<b>Say it:</b> "Graph databases store nodes and typed relationships as first-class records with index-free adjacency, so traversals cost proportional to the edges visited. They shine for deep or variable-depth queries like friends-of-friends, shortest paths or fraud rings, expressed naturally in Cypher. For shallow relationships SQL joins or recursive CTEs are fine, and graph databases are harder to shard and weaker for bulk aggregation."`}
],
keep:[`Property graph: nodes + typed, directed relationships with properties.`,`Cypher patterns: (a)-[:REL]->(b); variable length *..n; shortestPath.`,`SQL: one self-join per hop; recursive CTE for variable depth.`,`Index-free adjacency: hop = pointer follow → fast deep traversals.`,`Use for deep/variable traversals (recommendations, fraud, networks); not for tabular aggregates.`]}, {
  imp: 'extra',
  theory: TH(`Graph databases store entities and their relationships directly as nodes and edges, making queries that hop across many relationships fast and natural to express.`,
`<p>Some questions are all about connections: "who are my friends' friends?", "how is this account connected to known fraudsters?", "which services depend on this database?". In tables, each hop is a join; in a graph database, each hop is following a link that's already stored with the node.</p>
<p>It's the difference between looking up each person's friends in an index card box (one search per hop) and holding a map where each person is physically connected by strings to their friends (just follow the string).</p>`,
[[`Node`,`An entity (vertex) with labels and properties.`],[`Relationship / edge`,`A typed, directed connection with properties.`],[`Property graph`,`Model with properties on nodes and edges.`],[`Traversal`,`Walking edges from node to node.`],[`Cypher / Gremlin`,`Graph query languages.`],[`Index-free adjacency`,`Nodes store direct references to their edges.`],[`RDF / triple store`,`Subject–predicate–object model (SPARQL).`]],
[`Find starting nodes (via an index on a property).`,`Expand along matching relationships hop by hop.`,`Filter and aggregate along the paths.`,`Return nodes, relationships or paths.`],
[`Recommendations ("customers who bought X also bought Y").`,`Fraud detection: shared devices, cards, addresses forming rings.`,`Knowledge graphs, IAM permission graphs, network topology.`],
[`Using a graph DB for plain tabular CRUD.`,`Unbounded variable-length traversals (*) on dense graphs: explosion.`,`Ignoring super-nodes (celebrities with millions of edges).`]),
  examples: [
    {lv:'basic', title:'Edges as a table: direct reports', sql:`SELECT m.name AS manager, e.name AS reports_to_them
FROM employees e JOIN employees m ON m.id = e.manager_id
ORDER BY manager, reports_to_them;`, why:`The org chart is a graph (MANAGES edges). One hop = one self-join.`},
    {lv:'mid', title:'Two hops: skip-level reports', sql:`SELECT top.name AS skip_level_manager, e.name AS employee
FROM employees e
JOIN employees mid ON mid.id = e.manager_id
JOIN employees top ON top.id = mid.manager_id
ORDER BY top.name, e.name;`, why:`Two hops, two self-joins. Cypher: <code>(top)&lt;-[:REPORTS_TO]-()&lt;-[:REPORTS_TO]-(e)</code>.`},
    {lv:'adv', title:'Variable depth with a recursive CTE (path + depth)', sql:`WITH RECURSIVE reach(id, name, depth, path) AS (
  SELECT id, name, 0, name FROM employees WHERE name = 'Meera'
  UNION ALL
  SELECT e.id, e.name, r.depth + 1, r.path || ' → ' || e.name
  FROM employees e JOIN reach r ON e.manager_id = r.id
  WHERE r.depth < 6
)
SELECT depth, path FROM reach WHERE name = 'Uma';`, why:`Path from Meera down to Uma at any depth: the SQL equivalent of a variable-length pattern <code>*..6</code>.`},
  ],
  tips: {
    say:`"Graph databases model nodes and typed relationships directly, with index-free adjacency so each hop is a pointer follow. That makes deep or variable-depth queries like friends-of-friends, shortest paths and fraud rings fast and natural in Cypher. For one or two hops, SQL self-joins or recursive CTEs work fine, and I'd keep tabular, aggregation-heavy data relational."`,
    points:[`Write both the Cypher pattern and the SQL self-join.`,`Explain index-free adjacency.`,`Give realistic use cases and limits (super-nodes, sharding).`],
    traps:[`"Graph DBs are always faster at joins."`,`Unbounded variable-length paths.`],
    qa:[[`How would you find mutual friends in SQL?`,`Join follows on followee with both users as followers: <code>SELECT a.followee FROM follows a JOIN follows b ON a.followee = b.followee WHERE a.follower = 'X' AND b.follower = 'Y';</code>`],
        [`What's a super-node and why is it a problem?`,`A node with millions of edges (a celebrity). Traversals through it explode; mitigate with relationship-type/direction filters, sampling, or modeling changes.`],
        [`Property graph vs RDF?`,`Property graphs (Neo4j) put properties on nodes and edges; RDF stores triples and is geared to linked data and ontologies (SPARQL).`]]
  },
  exercises: [
    {lv:'E', q:`Using a follows table (Asha→Ben, Asha→Chen, Ben→Diya, Chen→Eli, Chen→Diya, Diya→Farah), return who Chen follows: <code>followee</code>.`, hint:`Create and fill the table, then filter.`,
     sql:`CREATE TABLE follows (follower TEXT, followee TEXT);
INSERT INTO follows VALUES ('Asha','Ben'),('Asha','Chen'),('Ben','Diya'),('Chen','Eli'),('Chen','Diya'),('Diya','Farah');
SELECT followee FROM follows WHERE follower = 'Chen';`},
    {lv:'M', q:`Friends-of-friends for Asha that she doesn't already follow, with mutual counts: <code>followee, mutual</code>.`, hint:`The SQL from the code panel.`,
     sql:`CREATE TABLE follows (follower TEXT, followee TEXT);
INSERT INTO follows VALUES ('Asha','Ben'),('Asha','Chen'),('Ben','Diya'),('Chen','Eli'),('Chen','Diya'),('Diya','Farah');
SELECT f2.followee, COUNT(*) AS mutual
FROM follows f1 JOIN follows f2 ON f2.follower = f1.followee
WHERE f1.follower = 'Asha' AND f2.followee <> 'Asha'
  AND f2.followee NOT IN (SELECT followee FROM follows WHERE follower = 'Asha')
GROUP BY f2.followee;`},
    {lv:'H', q:`Shortest number of hops from Asha to Farah using a recursive CTE: return <code>hops</code>.`, hint:`Recursive walk with depth; MIN(depth) where node = 'Farah'; limit depth to avoid cycles.`,
     sql:`CREATE TABLE follows (follower TEXT, followee TEXT);
INSERT INTO follows VALUES ('Asha','Ben'),('Asha','Chen'),('Ben','Diya'),('Chen','Eli'),('Chen','Diya'),('Diya','Farah');
WITH RECURSIVE walk(node, depth) AS (
  SELECT 'Asha', 0
  UNION ALL
  SELECT f.followee, w.depth + 1 FROM follows f JOIN walk w ON f.follower = w.node WHERE w.depth < 6
)
SELECT MIN(depth) AS hops FROM walk WHERE node = 'Farah';`},
  ],
  quiz: [
    [`In a property graph, relationships…`,[`Are stored only as foreign keys`,`Are first-class records with a type, direction and properties`,`Can't have properties`,`Are computed at query time`],1,`FOLLOWS {since: …}.`,'E'],
    [`Index-free adjacency means…`,[`No indexes exist`,`Nodes store direct references to their relationships, so each hop is a pointer follow`,`Edges are hashed`,`Joins use indexes`],1,`Cost ∝ edges touched.`,'M'],
    [`A 4-hop traversal in SQL typically needs…`,[`One join`,`Four self-joins (or a recursive CTE)`,`A UNION`,`A view`],1,`One join per hop.`,'E'],
    [`Neo4j's query language is…`,[`SQL`,`Cypher`,`CQL`,`MQL`],1,`Pattern matching with ASCII-art arrows.`,'E'],
    [`Graph databases are a strong fit for…`,[`Monthly revenue reports`,`Fraud rings, recommendations, shortest paths`,`Key-value caching`,`Bulk log storage`],1,`Relationship-centric queries.`,'E'],
    [`A super-node is…`,[`A powerful server`,`A node with an enormous number of relationships, which makes traversals through it expensive`,`The root node`,`A cluster leader`],1,`Celebrity problem.`,'M'],
  ],
  quizAdv: [
    [`Why are graphs hard to shard?`,[`They're small`,`Traversals cross partition boundaries; minimizing cut edges is NP-hard in general`,`No primary keys`,`Graphs are immutable`],1,`Network hops per traversal step.`,'H'],
    [`Cypher pattern (a)-[:FOLLOWS*1..3]->(b) means…`,[`Exactly 3 hops`,`Paths of 1 to 3 FOLLOWS hops`,`3 relationship types`,`Undirected`],1,`Variable length.`,'H'],
    [`SQL:2023 added…`,[`Graph storage`,`SQL/PGQ: property-graph queries (GRAPH_TABLE / MATCH) over relational tables`,`Cypher`,`Nothing graph-related`],1,`Graph queries in SQL.`,'H'],
  ],
});
