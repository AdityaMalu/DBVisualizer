/* 1.4 Self joins, semi-joins and anti-joins */
topic('1', { no:'1.4', title:'Self joins, semi-joins (EXISTS) and anti-joins (NOT EXISTS)', db:'hr',
idea:`Join a table to itself to pair employees with their managers, then ask "does a matching row exist?" with EXISTS and "does none exist?" with NOT EXISTS, and see exactly why NOT IN breaks when a NULL shows up.`,
tbTitle:'Rows', stateTitle:'Evaluation',
codes:{a:`-- self join: employee → manager (same table, two aliases)
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;

-- semi-join: departments that have at least one employee
SELECT d.name FROM departments d
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);

-- anti-join: departments with no employees
SELECT d.name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);

-- the NOT IN trap (Vikram has dept_id NULL)
SELECT d.name FROM departments d
WHERE d.id NOT IN (SELECT dept_id FROM employees);   -- 0 rows!`},
steps:[
{hl:{q:[2,3,4]}, tb:[TB('employees e',['id','name','manager_id'],[[1,'Meera',null],[2,'Arjun',1],[3,'Kiran',2],[6,'Priya',1],[7,'Ravi',6]]), TB('employees m (same table)',['id','name'],[[1,'Meera'],[2,'Arjun'],[6,'Priya']])], g:[G('Self join',['one table, two roles','alias e = employee, m = manager','hot'],['ON','m.id = e.manager_id'])],
 say:`A <b>self join</b> joins a table to itself. The trick is aliases: <code>e</code> plays the employee, <code>m</code> plays the manager, and the ON condition links an employee's <code>manager_id</code> to the manager's <code>id</code>. It's the same table read twice.`},
{hl:{q:[2,3,4]}, tb:[TB('result',['employee','manager'],[['Meera',null],['Arjun','Meera'],['Kiran','Arjun'],['Priya','Meera'],['Ravi','Priya']],{0:'hot'})], log:['LEFT JOIN keeps Meera (the CTO has no manager)'],
 say:`With a LEFT JOIN the CTO, Meera, stays in the result with a NULL manager. An INNER JOIN would drop her. Self joins also find pairs within a table: "employees in the same department earning the same salary", "flights that connect".`},
{hl:{q:[7,8]}, tb:[TB('departments',['id','name'],[[1,'Engineering'],[2,'Sales'],[3,'HR'],[4,'Legal']],{0:'ok',1:'ok',2:'ok',3:'dim'})], g:[G('EXISTS (semi-join)',['question','is there at least one matching row?'],['stops at','the first match','ok'],['duplicates','never multiplies rows (unlike JOIN)','ok'],['SELECT 1','the select list is ignored'])], log:['EXISTS → Engineering, Sales, HR'],
 say:`<b>EXISTS</b> asks a yes/no question per outer row: does the subquery return any row? It's a <b>semi-join</b>: each department appears at most once, however many employees match, and the engine can stop at the first match. A plain JOIN would repeat Engineering five times and need DISTINCT.`},
{hl:{q:[11,12]}, tb:[TB('departments',['id','name'],[[1,'Engineering'],[2,'Sales'],[3,'HR'],[4,'Legal']],{3:'ok'})], log:['NOT EXISTS → Legal'],
 say:`<b>NOT EXISTS</b> is the <b>anti-join</b>: keep outer rows with <i>no</i> match. Legal has no employees. Equivalent forms: <code>LEFT JOIN … WHERE e.id IS NULL</code>. Both handle NULLs correctly.`},
{hl:{q:[15,16]}, tb:[TB('SELECT dept_id FROM employees',['dept_id'],[[1],[1],[2],[3],[null]],{4:'bad'})], g:[G('d.id NOT IN (1,1,2,3,NULL)',['for Legal (4)','4<>1 AND 4<>2 AND 4<>3 AND 4<>NULL'],['4 <> NULL','UNKNOWN','bad'],['result','UNKNOWN → row dropped → 0 rows','bad'])], log:['NOT IN → 0 rows, because Vikram\'s dept_id is NULL'],
 say:`Now the trap. Vikram the contractor has <code>dept_id = NULL</code>. <code>NOT IN</code> compares against every value, including NULL, which makes the condition UNKNOWN for every department. Result: <b>no rows</b>, not "Legal". NOT EXISTS ignores NULLs because <code>e.dept_id = d.id</code> is simply not TRUE for them.`},
{hl:{}, tb:[], g:[G('Choose',['"has at least one"','EXISTS / IN (both fine)','ok'],['"has none"','NOT EXISTS or LEFT JOIN … IS NULL','ok'],['NOT IN','only if the subquery column is NOT NULL','bad'],['performance','modern optimizers plan EXISTS/IN/JOIN similarly'])],
 say:`<b>Say it:</b> "A self join uses two aliases of the same table, like employee to manager. For existence I use EXISTS, a semi-join that never duplicates rows. For 'no match' I use NOT EXISTS or LEFT JOIN … IS NULL, never NOT IN over a nullable column, because one NULL makes NOT IN return nothing."`}
],
keep:[`Self join = same table, two aliases (employee e, manager m).`,`EXISTS = semi-join: at most one output row per outer row; stops at first match.`,`NOT EXISTS / LEFT JOIN … IS NULL = anti-join.`,`NOT IN + a NULL in the subquery = zero rows. Prefer NOT EXISTS.`]}, {
  imp: 'must',
  theory: TH(`A self join relates rows of the same table to each other; a semi-join keeps rows that have a match elsewhere, and an anti-join keeps rows that have none.`,
`<p>Some relationships live inside one table: an employee's manager is another employee. To query it you read the table twice under two names (aliases) and join them: a <b>self join</b>.</p>
<p>Often you don't want the matching rows, just to know whether they exist: "customers who ordered", "products never sold". <b>EXISTS</b> (semi-join) and <b>NOT EXISTS</b> (anti-join) answer exactly that, like asking a librarian "do you have any book by this author?" without borrowing the books.</p>`,
[[`Self join`,`A table joined with itself using two aliases.`],[`Semi-join`,`Rows of A with at least one match in B; A's rows are not duplicated.`],[`Anti-join`,`Rows of A with no match in B.`],[`Correlated subquery`,`A subquery that refers to the outer row (e.dept_id = d.id).`],[`EXISTS`,`TRUE if the subquery returns any row.`]],
[`For each outer row, the subquery is (logically) evaluated with that row's values.`,`EXISTS returns TRUE on the first match.`,`NOT EXISTS returns TRUE when no row matches.`,`Optimizers turn these into semi/anti hash or merge joins rather than looping.`],
[`Org charts, referral chains, "users who follow each other" (self joins).`,`"Users with at least one order in the last 30 days" (EXISTS).`,`Data cleanup: "files with no owning record" (NOT EXISTS).`],
[`Using JOIN + DISTINCT for existence checks (extra work, risk of wrong counts).`,`NOT IN over nullable columns.`,`Forgetting the correlation in an EXISTS subquery (then it's TRUE for every row).`]),
  examples: [
    {lv:'basic', title:'Who reports to whom', sql:`SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY manager, employee;`, why:`Two aliases of one table. LEFT JOIN keeps people without a manager.`},
    {lv:'mid', title:'Employees earning more than their manager', sql:`SELECT e.name, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;`, why:`A classic interview question. Here nobody qualifies; change a salary with UPDATE first to see a hit, e.g. <code>UPDATE employees SET salary = 200000 WHERE id = 3;</code> before the SELECT.`},
    {lv:'adv', title:'Managers (semi-join) vs individual contributors (anti-join)', sql:`SELECT name, 'manager' AS kind FROM employees m
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = m.id)
UNION ALL
SELECT name, 'individual contributor' FROM employees m
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = m.id)
ORDER BY kind, name;`, why:`The same correlated subquery, once with EXISTS and once with NOT EXISTS, splits the table into two disjoint sets.`},
  ],
  tips: {
    say:`"Self joins use two aliases of the same table. For 'has at least one' I use EXISTS, which never duplicates outer rows; for 'has none' I use NOT EXISTS or a LEFT JOIN … IS NULL. I avoid NOT IN on nullable columns because a single NULL empties the result."`,
    points:[`"Employees earning more than their manager" is a top-10 SQL interview question: self join on manager_id.`,`Explain why EXISTS beats JOIN + DISTINCT for existence.`,`Raise the NOT IN / NULL trap yourself.`],
    traps:[`Using INNER JOIN for the manager lookup and silently losing the CEO.`,`Claiming EXISTS is always faster than IN: modern optimizers usually produce the same plan.`],
    qa:[[`Find employees who earn more than their manager.`,`<code>SELECT e.name FROM employees e JOIN employees m ON m.id = e.manager_id WHERE e.salary &gt; m.salary;</code>`],
        [`IN vs EXISTS: which is faster?`,`Usually the same plan today (both become semi-joins). Historically EXISTS was better for large correlated subqueries; the real difference is NOT IN vs NOT EXISTS with NULLs.`],
        [`How do you find pairs of employees in the same department without listing each pair twice?`,`Self join with <code>a.dept_id = b.dept_id AND a.id &lt; b.id</code>; the &lt; removes mirror pairs and self-pairs.`]]
  },
  exercises: [
    {lv:'E', q:`List each employee's name with their manager's title, only for people who have a manager. Columns: <code>name, manager_title</code>.`, hint:`INNER self join on manager_id.`,
     sql:`SELECT e.name, m.title AS manager_title
FROM employees e
JOIN employees m ON m.id = e.manager_id;`},
    {lv:'M', q:`Departments that have at least one employee earning 150000 or more. Return department <code>name</code>.`, hint:`EXISTS with a correlated subquery that also filters on salary.`,
     sql:`SELECT d.name FROM departments d
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id AND e.salary >= 150000);`},
    {lv:'M', q:`Pairs of employees in the same department with the same salary. Return <code>a, b</code> (names), each pair once.`, hint:`Self join on dept_id and salary, and a.id &lt; b.id.`,
     sql:`SELECT a.name AS a, b.name AS b
FROM employees a
JOIN employees b ON b.dept_id = a.dept_id AND b.salary = a.salary AND a.id < b.id;`},
    {lv:'H', q:`Employees who manage nobody <b>and</b> whose department has no one hired after them. Return <code>name</code>. (Ignore people without a department.)`, hint:`Two NOT EXISTS conditions: one on manager_id, one on dept_id and hired.`,
     sql:`SELECT e.name FROM employees e
WHERE e.dept_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM employees n WHERE n.dept_id = e.dept_id AND n.hired > e.hired);`},
  ],
  quiz: [
    [`What makes a self join possible?`,[`A special SELF JOIN keyword`,`Two different aliases for the same table`,`A recursive CTE`,`A foreign key to another table`],1,`e and m are two "copies" of employees.`,'E'],
    [`Why LEFT JOIN when listing employees with managers?`,[`It's faster`,`So employees without a manager (the CEO) still appear`,`To remove duplicates`,`INNER JOIN can't join a table to itself`],1,`NULL-padded manager columns.`,'E'],
    [`EXISTS returns TRUE when…`,[`The subquery returns at least one row`,`The subquery returns exactly one row`,`The subquery's first column is TRUE`,`No NULLs are found`],0,`The select list doesn't matter.`,'E'],
    [`<code>WHERE id NOT IN (SELECT dept_id FROM employees)</code> returns 0 rows. Most likely cause?`,[`No index`,`A NULL dept_id in the subquery`,`Duplicates in the subquery`,`NOT IN is deprecated`],1,`x <> NULL is UNKNOWN.`,'M'],
    [`Semi-join vs inner join for "departments with employees"?`,[`Same rows, no duplicates with the semi-join`,`Semi-join returns more rows`,`Inner join can't do it`,`Semi-join needs DISTINCT`],0,`JOIN repeats a department per employee.`,'M'],
    [`To list each same-department pair once, add…`,[`a.id <> b.id`,`a.id < b.id`,`DISTINCT`,`GROUP BY a.id`],1,`<> still lists (A,B) and (B,A).`,'M'],
  ],
  quizAdv: [
    [`A correlated EXISTS subquery is written without the correlation (no e.dept_id = d.id). Effect?`,[`Error`,`Returns every outer row if employees is non-empty`,`Returns no rows`,`Same result, slower`],1,`The subquery no longer depends on the outer row.`,'H'],
    [`How do modern optimizers usually execute NOT EXISTS?`,[`A nested loop per outer row, always`,`As an anti-join (hash or merge), possibly with an index`,`By materialising a cross join`,`By converting it to NOT IN`],1,`Semi/anti-join operators.`,'H'],
    [`Postgres rewrites <code>NOT IN (subquery)</code> into an efficient anti-join…`,[`Always`,`Rarely, because NULL semantics make it non-equivalent unless it can prove no NULLs`,`Only with an index`,`Only in SERIALIZABLE`],1,`Another reason to prefer NOT EXISTS.`,'H'],
  ],
});
