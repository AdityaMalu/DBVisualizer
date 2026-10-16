/* 2.1 CTEs and recursive queries */
topic('2', { no:'2.1', title:'CTEs (WITH) and recursive queries', db:'hr',
idea:`Name intermediate results with WITH so a complex query reads top to bottom. Then watch a recursive CTE walk an org chart level by level: anchor row, recursive step, stop when no new rows appear.`,
tbTitle:'Working table', stateTitle:'Recursion',
codes:{a:`WITH dept_avg AS (                      -- a named step
  SELECT dept_id, AVG(salary) AS avg_sal
  FROM employees GROUP BY dept_id
)
SELECT e.name, e.salary, d.avg_sal
FROM employees e JOIN dept_avg d ON d.dept_id = e.dept_id
WHERE e.salary > d.avg_sal;

WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS depth          -- anchor
  FROM employees WHERE manager_id IS NULL AND id = 1
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.depth + 1   -- recursive step
  FROM employees e JOIN chain c ON e.manager_id = c.id
)
SELECT * FROM chain ORDER BY depth;`},
steps:[
{hl:{q:[1,2,3,4,5,6,7]}, tb:[TB('dept_avg (CTE)',['dept_id','avg_sal'],[[1,160000],[2,115000],[3,85000],[null,60000]],{0:'new',1:'new',2:'new',3:'new'})], g:[G('CTE',['WITH name AS (…)','a named subquery','hot'],['scope','this one statement only'],['why','read top-down, reuse a step, test pieces'])],
 say:`A <b>Common Table Expression</b> (CTE) names a subquery with <code>WITH name AS (…)</code> so the main query can use it like a table. It's the same power as a derived table (1.6) but reads top to bottom, can be referenced several times, and lets you build a complex query in small, testable steps.`},
{hl:{q:[9,10,11]}, tb:[TB('chain after anchor',['id','name','manager_id','depth'],[[1,'Meera',null,0]],{0:'new'})], g:[G('Recursive CTE',['anchor member','starting rows (run once)','hot'],['UNION ALL',''],['recursive member','refers to the CTE itself'])],
 say:`A <b>recursive CTE</b> walks hierarchies and graphs. It has two parts joined by UNION ALL. The <b>anchor</b> runs once and seeds the result: the CEO, Meera, at depth 0.`},
{hl:{q:[13,14]}, tb:[TB('iteration 1: reports of depth 0',['id','name','manager_id','depth'],[[2,'Arjun',1,1],[6,'Priya',1,1],[9,'Tom',1,1]],{0:'new',1:'new',2:'new'})], g:[G('Iteration 1',['input','rows found in the previous round (Meera)'],['join','e.manager_id = c.id'],['new rows','3','hot'])],
 say:`The <b>recursive member</b> joins employees to the rows produced in the <i>previous</i> round: whose manager is Meera? Arjun, Priya and Tom, at depth 1. These new rows are appended to the result and become the input of the next round.`},
{hl:{q:[13,14]}, tb:[TB('iteration 2: reports of depth 1',['id','name','manager_id','depth'],[[3,'Kiran',2,2],[4,'Lena',2,2],[5,'Omar',2,2],[7,'Ravi',6,2],[8,'Sara',6,2],[10,'Uma',9,2]],{0:'new',1:'new',2:'new',3:'new',4:'new',5:'new'})], log:['round 2 → 6 rows'],
 say:`Round 2 uses only the depth-1 rows as input and finds their reports at depth 2. The CTE keeps going round by round, like a breadth-first search.`},
{hl:{q:[16]}, tb:[TB('iteration 3',['id','name','manager_id','depth'],[]), TB('final chain',['name','depth'],[['Meera',0],['Arjun',1],['Priya',1],['Tom',1],['Kiran',2],['Lena',2],['Omar',2],['Ravi',2],['Sara',2],['Uma',2]])], g:[G('Termination',['round 3','no new rows → stop','ok'],['cycle in data?','infinite loop unless you guard','bad'],['guards','depth < N, or track a path and skip visited ids'])], log:['round 3 → 0 rows: done'],
 say:`Round 3 finds nobody reporting to depth-2 people, so the recursion <b>stops</b>. If the data had a cycle (A manages B manages A), it would never stop: guard with a depth limit or by carrying a path and refusing to revisit an id. Vikram (no manager, not the CEO) isn't in Meera's tree.`},
{hl:{}, tb:[], g:[G('Use recursive CTEs for',['org charts / reporting chains','down or up the tree'],['category trees, BOMs','parts of parts'],['graph reachability','friends of friends, routes'],['series generation','dates 1..N to fill gaps'])],
 say:`<b>Say it:</b> "A CTE names a subquery so complex queries read as steps. A recursive CTE has an anchor that seeds the result and a recursive member that joins back to the previous round's rows, repeating until no new rows appear; I guard against cycles with a depth limit or a visited path. It's how SQL walks trees and graphs like org charts or category hierarchies."`}
],
keep:[`WITH name AS (…) = a named, readable subquery for one statement.`,`Recursive CTE = anchor UNION ALL recursive member that joins to the CTE.`,`Each round sees only the previous round's new rows; stops when none.`,`Guard against cycles: depth limit or visited path.`]}, {
  imp: 'must',
  theory: TH(`A CTE gives a subquery a name for one statement; a recursive CTE repeatedly joins its own latest rows to walk hierarchies and graphs.`,
`<p>Long queries with nested subqueries read inside-out. A CTE lets you write them as a recipe: "first compute department averages, then compare each employee to them". Each WITH step has a name, like a temporary table that only lives for this query.</p>
<p>A recursive CTE is like asking "who reports to Meera?", then "who reports to <i>those</i> people?", and so on until nobody is left. Each round only asks about the people found in the previous round.</p>`,
[[`CTE`,`WITH name AS (subquery), usable in the following query.`],[`Anchor member`,`The non-recursive part that seeds the result.`],[`Recursive member`,`The part that references the CTE itself.`],[`Fixpoint`,`The round where no new rows are produced; recursion stops.`],[`MATERIALIZED`,`Postgres hint to compute a CTE once instead of inlining it.`]],
[`Evaluate the anchor; its rows form the first "working table".`,`Run the recursive member against the working table; new rows are added to the result and become the next working table.`,`Repeat until the recursive member returns no rows.`,`Run the main query against all accumulated rows.`],
[`Org charts, comment threads, folder trees, category hierarchies.`,`Bill of materials (parts containing parts).`,`Generating date series to fill gaps in time-series reports.`,`Breaking a scary 200-line report into named steps.`],
[`Missing cycle guards on graph data.`,`Using UNION instead of UNION ALL by accident (extra dedup cost; sometimes intended to stop cycles).`,`Assuming CTEs are always materialised (or always inlined): it depends on the database and version.`]),
  examples: [
    {lv:'basic', title:'A CTE as a named step', sql:`WITH big_earners AS (
  SELECT name, dept_id, salary FROM employees WHERE salary >= 150000
)
SELECT b.name, d.name AS dept, b.salary
FROM big_earners b LEFT JOIN departments d ON d.id = b.dept_id
ORDER BY b.salary DESC;`, why:`Same as a derived table, but named and readable.`},
    {lv:'mid', title:'Generate a series: every day in early March', sql:`WITH RECURSIVE days(d) AS (
  SELECT '2024-03-01'
  UNION ALL
  SELECT date(d, '+1 day') FROM days WHERE d < '2024-03-07'
)
SELECT d FROM days;`, why:`The WHERE in the recursive member is the stop condition. Joining a series like this to sparse data fills missing days with zeros (try it in exercise 3).`, db:'shop'},
    {lv:'adv', title:'Full reporting path for every employee', sql:`WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, name AS path, 0 AS depth
  FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.path || ' > ' || e.name, c.depth + 1
  FROM employees e JOIN chain c ON e.manager_id = c.id
  WHERE c.depth < 10                                -- cycle/runaway guard
)
SELECT depth, path FROM chain ORDER BY path;`, why:`Carrying a path string shows each person's chain of command and sorts the result like a tree. The depth guard stops runaway recursion.`},
  ],
  tips: {
    say:`"CTEs name intermediate steps so complex SQL reads top-down. A recursive CTE has an anchor and a recursive member joined by UNION ALL; each round joins the previous round's rows until nothing new appears. I use it for hierarchies like org charts, always with a depth or visited-path guard for cycles."`,
    points:[`Write the employee hierarchy query from memory: it's the canonical recursive CTE question.`,`Explain the round-by-round evaluation (working table), not just the syntax.`,`Mention cycle detection (Postgres 14 has a CYCLE clause).`],
    traps:[`Saying the recursive member sees all previous rows (it sees only the last round's).`,`Forgetting RECURSIVE (required in Postgres, MySQL, SQLite).`],
    qa:[[`Find all reports (direct and indirect) of manager X.`,`Anchor: employees WHERE manager_id = X; recursive: join employees e ON e.manager_id = chain.id.`],
        [`Find all managers above employee Y (walk up).`,`Anchor: Y's row; recursive: JOIN employees m ON m.id = chain.manager_id.`],
        [`CTE vs temp table?`,`A CTE lives for one statement and may be inlined by the optimizer; a temp table persists for the session, can be indexed and reused across statements.`]]
  },
  exercises: [
    {lv:'E', q:`Using a CTE <code>sales_team</code> for employees in department 2, return their <code>name, salary</code> ordered by salary descending.`, hint:`WITH sales_team AS (SELECT … WHERE dept_id = 2) SELECT … FROM sales_team ORDER BY …`, ordered:true,
     sql:`WITH sales_team AS (SELECT name, salary FROM employees WHERE dept_id = 2)
SELECT name, salary FROM sales_team ORDER BY salary DESC;`},
    {lv:'M', q:`Everyone who reports to Arjun directly or indirectly. Return <code>name</code>.`, hint:`Anchor: manager_id = Arjun's id (2). Recursive: employees whose manager is in the CTE.`,
     sql:`WITH RECURSIVE r AS (
  SELECT id, name FROM employees WHERE manager_id = 2
  UNION ALL
  SELECT e.id, e.name FROM employees e JOIN r ON e.manager_id = r.id
)
SELECT name FROM r;`},
    {lv:'H', q:`Daily logins for 2024-03-01 to 2024-03-07, <b>including days with zero logins</b>. Return <code>day, logins</code> ordered by day.`, hint:`Generate the days with a recursive CTE, LEFT JOIN logins, COUNT(l.customer_id).`, ordered:true, db:'shop',
     sql:`WITH RECURSIVE days(day) AS (
  SELECT '2024-03-01'
  UNION ALL
  SELECT date(day, '+1 day') FROM days WHERE day < '2024-03-07'
)
SELECT d.day, COUNT(l.customer_id) AS logins
FROM days d
LEFT JOIN logins l ON l.login_date = d.day
GROUP BY d.day
ORDER BY d.day;`},
    {lv:'H', q:`The chain of managers <b>above</b> Uma, nearest first. Return <code>name, level</code> (1 = direct manager).`, hint:`Walk up: anchor is Uma's manager; recursive member joins employees m ON m.id = chain.manager_id.`, ordered:true,
     sql:`WITH RECURSIVE up AS (
  SELECT m.id, m.name, m.manager_id, 1 AS level
  FROM employees m WHERE m.id = (SELECT manager_id FROM employees WHERE name = 'Uma')
  UNION ALL
  SELECT m.id, m.name, m.manager_id, up.level + 1
  FROM employees m JOIN up ON m.id = up.manager_id
)
SELECT name, level FROM up ORDER BY level;`},
  ],
  quiz: [
    [`A CTE is defined with…`,[`CREATE VIEW`,`WITH name AS (…)`,`DECLARE CURSOR`,`TEMP TABLE`],1,`It lives for one statement.`,'E'],
    [`The two parts of a recursive CTE are…`,[`SELECT and FROM`,`Anchor member and recursive member, joined by UNION ALL`,`Base table and index`,`Parent and child views`],1,`The anchor seeds; the recursive member repeats.`,'E'],
    [`When does a recursive CTE stop?`,[`After 100 rounds always`,`When the recursive member produces no new rows`,`When the anchor returns NULL`,`At the first duplicate`],1,`Fixpoint.`,'E'],
    [`What can make a recursive CTE run forever?`,[`An index`,`A cycle in the data with no guard`,`ORDER BY`,`UNION ALL`],1,`Add a depth limit or visited-path check.`,'M'],
    [`In each round the recursive member joins against…`,[`All rows produced so far`,`Only the rows produced in the previous round`,`The base table only`,`The anchor only`],1,`The working table.`,'H'],
    [`Main advantage of a CTE over a nested subquery?`,[`Always faster`,`Readability and reuse within the statement`,`Persists across sessions`,`Can be indexed`],1,`Performance depends on the planner.`,'E'],
  ],
  quizAdv: [
    [`Postgres 12+ with a non-recursive CTE referenced once…`,[`Always materialises it`,`Inlines it into the main query unless MATERIALIZED is specified`,`Errors`,`Runs it in parallel`],1,`Older versions always materialised (an optimisation fence).`,'H'],
    [`Using UNION instead of UNION ALL in a recursive CTE…`,[`Is a syntax error`,`Removes duplicate rows each round, which can stop simple cycles but costs dedup work`,`Doubles the rows`,`Disables recursion`],1,`Works when the repeated rows are identical.`,'H'],
    [`Walking "up" from an employee to the CEO, the recursive join is…`,[`e.manager_id = chain.id`,`m.id = chain.manager_id`,`m.dept_id = chain.dept_id`,`chain.id = chain.manager_id`],1,`Follow the pointer from child to parent.`,'M'],
  ],
});
