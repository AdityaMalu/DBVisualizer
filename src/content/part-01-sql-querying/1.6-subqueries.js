/* 1.6 Subqueries: scalar, IN, correlated, derived tables */
topic('1', { no:'1.6', title:'Subqueries: scalar, list, correlated and derived tables', db:'hr',
idea:`A query inside a query. See a scalar subquery computed once, an IN list, a correlated subquery re-evaluated for every outer row ("above their department's average"), and a derived table in FROM. Then compare with the join rewrite.`,
tbTitle:'Rows', stateTitle:'Subquery',
codes:{a:`-- scalar: one value, computed once
SELECT name, salary FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- list: IN (subquery)
SELECT name FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE location = 'Pune');

-- correlated: depends on the outer row
SELECT e.name, e.salary FROM employees e
WHERE e.salary > (SELECT AVG(x.salary) FROM employees x
                  WHERE x.dept_id = e.dept_id);

-- derived table: a subquery in FROM
SELECT d.name, t.avg_sal
FROM (SELECT dept_id, AVG(salary) AS avg_sal
      FROM employees GROUP BY dept_id) t
JOIN departments d ON d.id = t.dept_id;`},
steps:[
{hl:{q:[2,3]}, g:[G('Scalar subquery',['returns','exactly one row, one column'],['AVG(salary)','125000 (computed once)','hot'],['if it returns 2 rows','runtime error'])], tb:[TB('salary > 125000',['name','salary'],[['Meera',250000],['Arjun',180000],['Kiran',150000],['Priya',160000]],{0:'ok',1:'ok',2:'ok',3:'ok'})], log:['4 employees above the company average'],
 say:`A <b>scalar subquery</b> returns a single value and can be used anywhere a value can. It doesn't depend on the outer row, so the database computes it <b>once</b> (125,000) and compares every row against it.`},
{hl:{q:[6,7]}, tb:[TB('departments in Pune',['id'],[[1],[3]],{0:'hot',1:'hot'}), TB('employees in those',['name','dept_id'],[['Meera',1],['Arjun',1],['Kiran',1],['Lena',1],['Omar',1],['Tom',3],['Uma',3]])], log:['IN (1, 3) → 7 employees'],
 say:`A subquery after <b>IN</b> returns a list (one column, many rows). This is a semi-join (1.4): it can be rewritten as a JOIN or EXISTS, and modern optimizers usually do that for you.`},
{hl:{q:[10,11,12]}, tb:[TB('for each outer row',['name','dept','salary','dept avg','kept?'],[['Meera',1,250000,160000,'yes'],['Arjun',1,180000,160000,'yes'],['Kiran',1,150000,160000,'no'],['Lena',1,110000,160000,'no'],['Priya',2,160000,115000,'yes'],['Ravi',2,90000,115000,'no'],['Tom',3,100000,85000,'yes'],['Uma',3,70000,85000,'no']],{0:'ok',1:'ok',4:'ok',6:'ok'})], g:[G('Correlated',['inner refers to','e.dept_id (outer row)','hot'],['logically','re-evaluated per outer row'],['optimizer','often rewrites to a join / group'])],
 say:`A <b>correlated subquery</b> refers to the outer query (<code>x.dept_id = e.dept_id</code>), so logically it runs once <i>per outer row</i>: for Meera it averages department 1, for Priya department 2. "Above their own department's average" is the classic use. Naively that's O(n²); optimizers often decorrelate it into a join with a grouped subquery.`},
{hl:{q:[15,16,17,18]}, tb:[TB('derived table t',['dept_id','avg_sal'],[[1,160000],[2,115000],[3,85000],[null,60000]],{3:'dim'}), TB('joined to departments',['name','avg_sal'],[['Engineering',160000],['Sales',115000],['HR',85000]])], g:[G('Derived table',['subquery in FROM','must have an alias (t)','hot'],['acts like','a temporary table for this query'],['modern style','a CTE (WITH t AS …), see 2.1'])],
 say:`A subquery in <b>FROM</b> is a <b>derived table</b> (inline view). Aggregate first, then join: that's how you avoid the double counting from 1.3. The NULL dept (Vikram) has no matching department and drops out of the inner join. CTEs (2.1) express the same idea more readably.`},
{hl:{}, tb:[], g:[G('Where subqueries go',['WHERE x > (…)','scalar'],['WHERE x IN (…) / EXISTS (…)','list / existence'],['FROM (…) t','derived table'],['SELECT (…) AS col','scalar per row (careful: per-row cost)']), G('Rewrite as join?',['IN / EXISTS','usually equivalent'],['scalar aggregate per row','join to a grouped derived table'])],
 say:`<b>Say it:</b> "A scalar subquery returns one value, IN/EXISTS subqueries test membership, a derived table is a subquery in FROM, and a correlated subquery references the outer row so it's logically evaluated per row. Many can be rewritten as joins, which is what the optimizer tries to do; I pick whichever is clearest and check the plan if it matters."`}
],
keep:[`Scalar subquery = one value (error if more rows). IN subquery = one column list.`,`Correlated = references the outer row; logically per row.`,`Derived table = subquery in FROM, needs an alias; aggregate-then-join.`,`Most subqueries can be rewritten as joins; optimizers often do it.`]}, {
  imp: 'must',
  theory: TH(`A subquery is a SELECT nested inside another statement, used as a value, a list, a table, or an existence test.`,
`<p>Some questions need an intermediate answer first: "who earns more than <i>the average</i>?" You first compute the average, then compare. A subquery lets you write that in one statement.</p>
<p>A <b>correlated</b> subquery is like asking, for each employee, "what's the average in <i>your</i> department?" The inner question changes with each person, so it's re-asked per row (logically).</p>`,
[[`Scalar subquery`,`Returns one row and one column.`],[`Row/list subquery`,`Returns a column of values for IN, ANY, ALL.`],[`Correlated subquery`,`References columns of the outer query.`],[`Derived table`,`Subquery in FROM with an alias.`],[`Decorrelation`,`Optimizer rewriting a correlated subquery as a join.`]],
[`Uncorrelated subqueries can be evaluated once and reused.`,`Correlated subqueries are logically evaluated per outer row.`,`The optimizer may flatten either into joins or semi-joins.`,`Derived tables are computed (or merged into the outer query) before the outer query uses them.`],
[`"Latest order per customer", "above department average", "rows not in another table".`,`Derived tables to pre-aggregate before joining.`,`Scalar subqueries in SELECT for small lookups (watch the per-row cost).`],
[`A scalar subquery that can return more than one row (runtime error later when data grows).`,`Correlated subqueries in SELECT over large tables without an index (N+1 inside the DB).`,`NOT IN with NULLs (0.3, 1.4).`]),
  examples: [
    {lv:'basic', title:'Who earns the most?', sql:`SELECT name, salary
FROM employees
WHERE salary = (SELECT MAX(salary) FROM employees);`, why:`Scalar subquery computed once. Returns all people tied for the max.`},
    {lv:'mid', title:'Above their department average (correlated)', sql:`SELECT e.name, e.dept_id, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(x.salary) FROM employees x WHERE x.dept_id = e.dept_id)
ORDER BY e.dept_id, e.salary DESC;`, why:`The inner AVG depends on the outer row's department.`},
    {lv:'adv', title:'The same thing as a join to a derived table', sql:`SELECT e.name, e.dept_id, e.salary, ROUND(t.avg_sal) AS dept_avg
FROM employees e
JOIN (SELECT dept_id, AVG(salary) AS avg_sal FROM employees GROUP BY dept_id) t
  ON t.dept_id = e.dept_id
WHERE e.salary > t.avg_sal
ORDER BY e.dept_id, e.salary DESC;`, why:`Decorrelated by hand: averages computed once per department, then joined. Bonus: you can show the average next to each row.`},
  ],
  tips: {
    say:`"Subqueries come in four shapes: scalar values, IN/EXISTS lists, derived tables in FROM, and correlated subqueries that reference the outer row. Correlated ones are logically per-row, so on big tables I make sure they're decorrelated or rewrite them as a join to a grouped derived table or a window function."`,
    points:[`Solve "above department average" three ways: correlated subquery, join to a derived table, window AVG() OVER (PARTITION BY dept).`,`Mention what happens if a scalar subquery returns two rows.`,`Talk about decorrelation as something the optimizer does.`],
    traps:[`Claiming correlated subqueries are always slow (often rewritten).`,`Forgetting the alias on a derived table (an error in Postgres and MySQL).`],
    qa:[[`Rewrite <code>WHERE dept_id IN (SELECT id FROM departments WHERE location='Pune')</code> as a join.`,`<code>SELECT e.* FROM employees e JOIN departments d ON d.id = e.dept_id WHERE d.location = 'Pune';</code> Same result because departments.id is unique; if it weren't, the join could duplicate rows.`],
        [`What's ANY / ALL?`,`<code>salary &gt; ALL (subquery)</code>: greater than every value; <code>&gt; ANY</code>: greater than at least one. &gt; ALL with an empty list is TRUE; with a NULL in the list it can be UNKNOWN.`],
        [`Subquery vs CTE?`,`Same power for non-recursive cases; CTEs name the step and can be referenced several times, which reads better.`]]
  },
  exercises: [
    {lv:'E', q:`Employees hired after Kiran. Return <code>name, hired</code>.`, hint:`Scalar subquery for Kiran's hire date.`,
     sql:`SELECT name, hired FROM employees
WHERE hired > (SELECT hired FROM employees WHERE name = 'Kiran');`},
    {lv:'M', q:`Employees in departments located in Mumbai, using IN with a subquery. Return <code>name</code>.`, hint:`IN (SELECT id FROM departments WHERE location = 'Mumbai').`,
     sql:`SELECT name FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE location = 'Mumbai');`},
    {lv:'H', q:`For each department, the employee(s) with the highest salary. Return <code>dept, name, salary</code> (department name), using a correlated subquery.`, hint:`WHERE e.salary = (SELECT MAX(x.salary) FROM employees x WHERE x.dept_id = e.dept_id).`,
     sql:`SELECT d.name AS dept, e.name, e.salary
FROM employees e
JOIN departments d ON d.id = e.dept_id
WHERE e.salary = (SELECT MAX(x.salary) FROM employees x WHERE x.dept_id = e.dept_id);`},
  ],
  quiz: [
    [`A scalar subquery returns two rows at runtime. Result?`,[`The first row is used`,`An error`,`NULL`,`Both rows are compared`],1,`"more than one row returned by a subquery used as an expression".`,'E'],
    [`What makes a subquery correlated?`,[`It uses GROUP BY`,`It references a column of the outer query`,`It's in the FROM clause`,`It returns many rows`],1,`It depends on the outer row.`,'E'],
    [`A subquery in FROM is called…`,[`A scalar subquery`,`A derived table / inline view`,`A correlated subquery`,`A semi-join`],1,`It needs an alias.`,'E'],
    [`How is an uncorrelated scalar subquery evaluated?`,[`Once`,`Once per outer row`,`Once per group`,`Never: it's inlined as text`],0,`It doesn't depend on the outer row.`,'M'],
    [`<code>salary &gt; ALL (SELECT salary FROM … WHERE dept_id = 2)</code> means…`,[`Greater than at least one salary in dept 2`,`Greater than every salary in dept 2`,`Equal to the max`,`Greater than the average`],1,`ALL = every.`,'M'],
    [`Best rewrite for a slow correlated "above dept average" on a big table?`,[`Add DISTINCT`,`Join to a GROUP BY dept derived table, or AVG() OVER (PARTITION BY dept)`,`Use NOT IN`,`ORDER BY salary`],1,`Compute each average once.`,'M'],
  ],
  quizAdv: [
    [`<code>x &gt; ALL (empty set)</code> evaluates to…`,[`TRUE`,`FALSE`,`UNKNOWN`,`Error`],0,`Vacuous truth.`,'H'],
    [`Postgres CTEs before v12 were always…`,[`Inlined`,`Materialised (an optimisation fence)`,`Recursive`,`Executed in parallel`],1,`v12 inlines non-recursive CTEs used once, unless MATERIALIZED is specified.`,'H'],
    [`A correlated subquery in the SELECT list over 1M rows with no index on the inner filter column likely costs…`,[`O(n)`,`O(n²): a scan per outer row`,`O(log n)`,`O(1)`],1,`Index it or rewrite as a join.`,'H'],
  ],
});
