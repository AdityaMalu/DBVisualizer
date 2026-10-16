/* 5.1 Life of a query */
topic('5', { no:'5.1', title:'Life of a query: parse, rewrite, plan, execute', db:'shop',
idea:`Follow one SQL string from the client to the result rows: connection and parsing, semantic analysis, rewriting (views, subqueries), the optimizer choosing a plan, and the executor pulling rows through a tree of operators.`,
dgTitle:'Query pipeline', stateTitle:'Stage',
nodes:{
  c:{x:50,y:40,label:'client',w:80,kind:'actor'},
  p:{x:170,y:40,label:'parser',w:90},
  a:{x:290,y:40,label:'analyzer',w:100},
  r:{x:410,y:40,label:'rewriter',w:90},
  o:{x:410,y:140,label:'optimizer',w:110},
  e:{x:250,y:140,label:'executor',w:100},
  s:{x:90,y:140,label:'storage /\nbuffer pool',w:120,h:46,kind:'db'}
},
edges:[['c','p'],['p','a'],['a','r'],['r','o'],['o','e'],['e','s']],
vb:'0 0 480 190',
codes:{a:`SELECT c.name, SUM(oi.qty * oi.unit_price) AS spent
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE c.city = 'Pune'
GROUP BY c.name;

-- plan the executor runs (a tree, rows flow upward):
-- HashAggregate (group by name)
--   └─ Hash Join (oi.order_id = o.id)
--        ├─ Seq Scan order_items
--        └─ Hash
--             └─ Nested Loop (o.customer_id = c.id)
--                  ├─ Index Scan customers (city = 'Pune')
--                  └─ Index Scan orders (customer_id = c.id)`},
steps:[
{hl:{q:[1,2,3,4,5,6]}, d:{on:['c','p'], e:[['c','p','SQL text','hot']]}, g:[G('Parse',['input','a string'],['lexer + parser','tokens → syntax tree','hot'],['catches','syntax errors ("near FORM")'],['prepared statements','parse/plan once, execute many'])],
 say:`The client sends a plain <b>string</b> over its connection. The <b>parser</b> tokenises it and builds a syntax tree according to SQL grammar. Typos like <code>FORM</code> fail here. With prepared statements, parsing (and often planning) happens once and later executions reuse it.`},
{hl:{q:[2,3,4]}, d:{on:['a'], e:[['p','a','parse tree','hot']]}, g:[G('Analyze (bind)',['resolve names','tables, columns, functions exist?'],['check types','city = \'Pune\' is TEXT = TEXT','ok'],['permissions','may this user read these tables?'],['catches','"column does not exist"'])],
 say:`The <b>analyzer</b> (binder) looks names up in the catalog: does <code>customers</code> exist, which table does <code>name</code> belong to, are the types compatible, does the user have privileges? Errors like "column does not exist" or "ambiguous column" come from this stage.`},
{hl:{}, d:{on:['r'], e:[['a','r','query tree','hot']]}, g:[G('Rewrite',['expand views','replace a view name with its query (2.6)'],['flatten subqueries','IN/EXISTS → semi-joins'],['simplify','constant folding, predicate pushdown'],['apply rules','row-level security policies'])],
 say:`The <b>rewriter</b> transforms the query into an equivalent but more optimisable form: views are expanded, many subqueries are flattened into joins, constant expressions are pre-computed and filters are pushed as close to the tables as possible.`},
{hl:{q:[8,9,10,11,12,13,14,15]}, d:{on:['o'], e:[['r','o','','hot']]}, g:[G('Optimize',['choices','access path per table, join order, join algorithm'],['search space','n! join orders for n tables'],['cost model','estimated rows × I/O + CPU (5.4)','hot'],['output','a physical plan tree'])],
 say:`The <b>optimizer</b> (planner) is the brain. For each table it considers scans vs indexes; for joins, every order and algorithm (nested loop, hash, merge). It estimates the cost of alternatives from statistics and picks the cheapest. Three tables already have 6 join orders; the planner prunes the search space with dynamic programming or heuristics.`},
{hl:{q:[8,9,10,11,12,13,14,15]}, d:{on:['e','s'], e:[['o','e','plan','hot'],['e','s','get pages','hot']]}, g:[G('Execute',['model','iterator / volcano: each operator asks its child for the next row','hot'],['pipelining','rows flow up without materialising everything'],['blocking operators','sort, hash build, aggregate need all input first'],['alternatives','vectorised (batches) and compiled (JIT) execution'])], log:['Pune customers → their orders → items → hash → aggregate'],
 say:`The <b>executor</b> runs the plan tree. In the classic <b>iterator (volcano)</b> model each operator implements <code>next()</code>: the aggregate asks the hash join for a row, which asks its inputs, down to the scans that read pages from the buffer pool. Rows stream upward; operators like sort and hash build must consume all their input first. Analytical engines process batches of rows (vectorised) or compile plans to machine code.`},
{hl:{}, d:{}, g:[G('Where time goes',['parse/plan','µs–ms (cache with prepared statements)'],['execute','usually dominant: I/O and data volume'],['network','round trips and result size'],['locks','waiting on other transactions (part 6)'])],
 say:`<b>Say it:</b> "The server parses the SQL into a tree, binds names against the catalog and checks permissions, rewrites it (views, subquery flattening, pushdown), the cost-based optimizer picks a physical plan from alternatives using statistics, and the executor runs that operator tree, pulling rows from storage through the buffer pool. EXPLAIN shows the chosen plan, which is where performance work starts."`}
],
keep:[`Parse → analyze/bind → rewrite → optimize → execute.`,`Optimizer chooses access paths, join order and join algorithms by estimated cost.`,`Executor = tree of operators pulling rows (iterator model); sort/hash/aggregate are blocking.`,`Prepared statements skip repeated parsing/planning. EXPLAIN shows the plan.`]}, {
  imp: 'good',
  theory: TH(`A SQL statement goes through parsing, semantic analysis, rewriting, cost-based optimization into a physical plan, and finally execution by a tree of operators.`,
`<p>SQL says <i>what</i> you want; the database has to work out <i>how</i>. That's like telling a travel agent "get me to Mumbai by Friday" and letting them compare flights, trains and routes. The optimizer is the travel agent: it lists possible plans, estimates the cost of each, and picks the cheapest.</p>
<p>The plan is a tree of small operators (scan, filter, join, aggregate, sort). Each pulls rows from the operators below it, like a relay passing items up a line.</p>`,
[[`Parser`,`Turns SQL text into a syntax tree.`],[`Analyzer / binder`,`Resolves names and types against the catalog.`],[`Rewriter`,`Applies view expansion and equivalence transformations.`],[`Optimizer / planner`,`Chooses a physical plan by estimated cost.`],[`Physical plan`,`Tree of operators: scans, joins, sorts, aggregates.`],[`Executor`,`Runs the plan.`],[`Iterator model`,`Operators expose open/next/close.`]],
[`Receive SQL; parse into a tree.`,`Bind names, check types and permissions.`,`Rewrite: views, subqueries, simplifications.`,`Enumerate plans and estimate costs; pick the cheapest.`,`Execute the operator tree and stream rows back.`],
[`Prepared statements / connection-level plan caches reduce latency for repeated queries.`,`EXPLAIN (ANALYZE) is the main tool for performance work.`,`Understanding pipelines vs blocking operators explains memory spills (sort/hash to disk).`],
[`Thinking the database executes SQL clause by clause as written.`,`Ignoring planning time for very complex queries (many joins).`,`Generic plans for prepared statements going bad on skewed data.`]),
  examples: [
    {lv:'basic', title:'A syntax error (parser)', sql:`SELECT name FORM customers;`, err:true, why:`The parser fails before anything touches data.`},
    {lv:'mid', title:'A binding error (analyzer)', sql:`SELECT nmae FROM customers;`, err:true, why:`Syntax is fine; the analyzer can't find column <code>nmae</code> in the catalog.`},
    {lv:'adv', title:'The chosen plan for a three-table join', sql:`EXPLAIN QUERY PLAN
SELECT c.name, SUM(oi.qty * oi.unit_price) AS spent
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE c.city = 'Pune'
GROUP BY c.name;`, why:`SQLite's planner picks a join order and access paths (scan, PK lookups, automatic indexes) and adds a temp B-tree for GROUP BY. Postgres would show costs and row estimates too (5.2).`},
  ],
  tips: {
    say:`"SQL is parsed into a tree, bound against the catalog, rewritten (views, subquery flattening, pushdown), then the cost-based optimizer enumerates access paths, join orders and algorithms using statistics and picks the cheapest. The executor runs that operator tree, pulling rows from the buffer pool."`,
    points:[`Name the stages in order and what errors each catches.`,`Mention the iterator model and blocking operators.`,`Connect to EXPLAIN as the practical window into the optimizer.`],
    traps:[`Describing execution as following the written clause order.`,`Forgetting that the optimizer relies on statistics (5.4).`],
    qa:[[`What's the benefit of prepared statements?`,`Parse/plan reuse (lower latency) and safety against SQL injection, since parameters are sent separately from the SQL text.`],
        [`What's a blocking operator?`,`One that must consume all its input before producing output: sort, hash table build, most aggregates. They may spill to disk if memory is short.`],
        [`Why might the same query get a different plan tomorrow?`,`Statistics changed (data grew or skewed), a new index exists, configuration changed, or a parameter value led to a different estimate.`]]
  },
  exercises: [
    {lv:'E', q:`Show the plan SQLite chooses for <code>SELECT * FROM orders WHERE customer_id = 1</code>.`, hint:`EXPLAIN QUERY PLAN …`,
     sql:`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;`},
    {lv:'M', q:`For each error, name the stage that raises it: (a) "syntax error at or near FROM", (b) "permission denied for table salaries", (c) "deadlock detected", (d) "column reference id is ambiguous", (e) "out of memory during sort".`, hint:`Parser, analyzer, executor (and lock manager).`,
     answer:`(a) parser · (b) analyzer/permission check · (c) execution (lock manager) · (d) analyzer · (e) executor (sort operator).`},
    {lv:'H', q:`Return Pune customers' spend as in the walkthrough: <code>name, spent</code>.`, hint:`The query from the code panel.`,
     sql:`SELECT c.name, SUM(oi.qty * oi.unit_price) AS spent
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE c.city = 'Pune'
GROUP BY c.name;`},
  ],
  quiz: [
    [`Which stage chooses between an index scan and a full scan?`,[`Parser`,`Analyzer`,`Optimizer`,`Executor`],2,`Cost-based choice.`,'E'],
    [`"column does not exist" is raised by…`,[`The parser`,`The analyzer/binder`,`The optimizer`,`The storage engine`],1,`Name resolution against the catalog.`,'M'],
    [`In the iterator (volcano) model, operators…`,[`Push all rows at once`,`Expose next() and pull rows from their children`,`Run in separate processes`,`Use only indexes`],1,`Rows flow upward.`,'M'],
    [`Which operator is blocking?`,[`Filter`,`Projection`,`Sort`,`Index scan`],2,`Needs all input first.`,'E'],
    [`Prepared statements mainly help by…`,[`Caching result rows`,`Reusing parsing/planning and separating parameters from SQL`,`Skipping transactions`,`Disabling locks`],1,`Also prevents injection.`,'E'],
    [`View expansion happens in…`,[`The rewriter`,`The executor`,`The buffer pool`,`The WAL`],0,`Replace the view name with its definition.`,'M'],
  ],
  quizAdv: [
    [`Postgres prepared statements may switch to a "generic plan" after 5 executions. Risk?`,[`None`,`A plan good on average but bad for skewed parameter values`,`Syntax errors`,`Lost updates`],1,`plan_cache_mode can force custom plans.`,'H'],
    [`Vectorised execution improves on the iterator model by…`,[`Using more indexes`,`Processing batches of values per call, reducing per-row overhead and using CPU caches/SIMD`,`Skipping the optimizer`,`Running only in memory`],1,`Used by DuckDB, ClickHouse, Snowflake.`,'H'],
    [`Why do planners limit exhaustive join-order search (e.g. Postgres GEQO beyond ~12 tables)?`,[`Licensing`,`The number of join orders grows factorially`,`Disk space`,`Statistics are unavailable`],1,`Heuristics/genetic search kick in.`,'H'],
  ],
});
