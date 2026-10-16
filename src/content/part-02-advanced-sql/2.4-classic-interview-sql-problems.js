/* 2.4 Classic interview SQL problems */
topic('2', { no:'2.4', title:'Classic interview SQL: Nth highest, duplicates, top-N per group, running balance', db:'hr',
idea:`The questions every SQL interview recycles, solved step by step: the Nth highest salary (three ways, and which one handles ties and "no such row"), finding and deleting duplicates, top-N per group, and employees who out-earn their manager.`,
tbTitle:'Working rows', stateTitle:'Approach',
codes:{a:`-- 1) 2nd highest DISTINCT salary, NULL if none
SELECT MAX(salary) FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- 2) Nth highest (N = 3) with DENSE_RANK
SELECT DISTINCT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS r
  FROM employees) t
WHERE r = 3;

-- 3) Nth highest with LIMIT/OFFSET
SELECT DISTINCT salary FROM employees
ORDER BY salary DESC LIMIT 1 OFFSET 2;

-- 4) duplicates: same salary in the same department
SELECT dept_id, salary, COUNT(*) FROM employees
GROUP BY dept_id, salary HAVING COUNT(*) > 1;`},
steps:[
{hl:{q:[1,2,3]}, tb:[TB('distinct salaries, high → low',['salary'],[[250000],[180000],[160000],[150000],[110000],[100000],[95000],[90000],[70000],[60000]],{1:'ok'})], g:[G('Approach 1: MAX below MAX',['inner','MAX = 250000'],['outer','MAX of the rest = 180000','ok'],['only 1 distinct salary?','MAX of nothing = NULL','ok'],['generalises to N?','no: nesting gets ugly','bad'])], log:['2nd highest = 180000'],
 say:`"Find the second highest salary." The neat answer: the max of everything below the max. It naturally handles ties (two people on 250k still give 180k) and returns <b>NULL</b> when there's no second salary, which interviewers often ask about. But it doesn't generalise to N.`},
{hl:{q:[5,6,7,8,9]}, tb:[TB('DENSE_RANK over salary',['salary','r'],[[250000,1],[180000,2],[160000,3],[150000,4],[110000,5],[110000,5],[100000,6]],{2:'ok'})], g:[G('Approach 2: DENSE_RANK',['ties','share a rank, no gaps','ok'],['Nth highest','WHERE r = N','ok'],['N too large','empty result (wrap in MAX(...) to get NULL)'])], log:['3rd highest = 160000'],
 say:`For any N, rank the salaries with <b>DENSE_RANK</b> and keep rank N. DENSE_RANK is the right choice because "3rd highest salary" means 3rd distinct value; RANK would skip numbers after ties and ROW_NUMBER would count the two 110k rows separately.`},
{hl:{q:[11,12,13]}, g:[G('Approach 3: LIMIT/OFFSET',['DISTINCT first','or ties shift the offset','hot'],['OFFSET N-1','skip the top N-1'],['portable?','LIMIT/OFFSET varies by DB'],['N too large','empty result'])], log:['DISTINCT … LIMIT 1 OFFSET 2 → 160000'],
 say:`<b>LIMIT 1 OFFSET N-1</b> over the <b>distinct</b> salaries also works and is the easiest to read. Without DISTINCT, duplicate salaries would occupy several offsets and give the wrong answer. For an empty-result-to-NULL, wrap it: <code>SELECT (SELECT … LIMIT 1 OFFSET 2)</code>.`},
{hl:{q:[15,16,17]}, tb:[TB('GROUP BY dept_id, salary HAVING COUNT(*) > 1',['dept_id','salary','count'],[[1,110000,2]],{0:'hot'})], g:[G('Find duplicates',['group by the "should be unique" columns',''],['HAVING COUNT(*) > 1','groups with more than one row','hot'])], log:['Lena and Omar share 110000 in dept 1'],
 say:`<b>Finding duplicates</b>: group by the columns that should be unique and keep groups with COUNT(*) &gt; 1. To see the actual rows, join back or use <code>COUNT(*) OVER (PARTITION BY …)</code>.`},
{hl:{}, tb:[TB('delete duplicates, keep the lowest id',['id','name','dept_id','salary','rn'],[[4,'Lena',1,110000,1],[5,'Omar',1,110000,2]],{1:'bad'})], g:[G('Delete duplicates',['rank rows within each duplicate group','ROW_NUMBER() OVER (PARTITION BY key ORDER BY id)'],['delete','rn > 1','bad'],['then','add a UNIQUE constraint so it can\'t recur','ok'])],
 say:`<b>Deleting duplicates but keeping one</b>: number rows within each duplicate group with ROW_NUMBER (ordered by id or created_at to decide which survives) and delete those with rn &gt; 1. Then add a unique constraint, otherwise you'll be back next month.`},
{hl:{}, tb:[], g:[G('Pattern map',['Nth highest','DENSE_RANK = N / DISTINCT … OFFSET'],['top N per group','DENSE_RANK in CTE, filter ≤ N (2.2)'],['dupes','GROUP BY … HAVING COUNT(*) > 1'],['delete dupes','ROW_NUMBER > 1'],['earns > manager','self join (1.4)'],['running total','SUM() OVER (ORDER BY …) (2.3)'],['consecutive days','gaps and islands (2.5)'])],
 say:`<b>Say it:</b> clarify first ("distinct salaries? what if there's no Nth? ties?"), then pick the tool: subquery for the 2nd highest, DENSE_RANK for the Nth, GROUP BY HAVING for duplicates, ROW_NUMBER to delete them, window functions for top-N per group and running totals. Clarifying ties and empty results out loud is half the score.`}
],
keep:[`2nd highest: MAX(salary) WHERE salary < MAX(salary) (NULL if none).`,`Nth highest: DENSE_RANK() = N, or DISTINCT … ORDER BY … LIMIT 1 OFFSET N-1.`,`Duplicates: GROUP BY key HAVING COUNT(*) > 1. Delete: ROW_NUMBER() … > 1, then add UNIQUE.`,`Always ask: distinct values? ties? what if it doesn't exist?`]}, {
  imp: 'must',
  theory: TH(`A small set of patterns (ranking, grouping with HAVING, self joins and window aggregates) solves most SQL interview questions; the skill is recognising which pattern fits and handling ties and empty results.`,
`<p>Interviewers reuse a handful of problems because each tests one idea: Nth highest tests ranking and ties, duplicates test GROUP BY/HAVING, "earns more than manager" tests self joins, running totals test window functions.</p>
<p>Before writing anything, ask the clarifying questions an engineer would: are we ranking distinct values? what should happen when there are ties, or when N is larger than the number of rows? Those edge cases are usually what separates answers.</p>`,
[[`Nth highest`,`The N-th distinct value in descending order.`],[`Duplicate`,`Two rows equal on columns that should be unique.`],[`Top-N per group`,`Best N rows within each partition.`],[`Edge case`,`Ties, NULLs, empty results, N too large.`]],
[`Restate the problem and clarify ties/NULL/empty behaviour.`,`Pick the pattern (ranking, grouping, self join, window).`,`Write it on a tiny example and walk through the edge cases.`,`Mention performance (indexes) and alternatives.`],
[`Leaderboards and "top sellers per region" reports.`,`Data cleanup jobs: find and remove duplicates before adding a constraint.`,`Payroll and HR analytics queries.`],
[`ROW_NUMBER for Nth highest (ties break it).`,`LIMIT/OFFSET without DISTINCT.`,`Deleting duplicates without deciding which copy to keep.`,`Not saying what happens when no Nth value exists.`]),
  examples: [
    {lv:'basic', title:'Second highest salary', sql:`SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);`, why:`Returns NULL if everyone earns the same.`},
    {lv:'mid', title:'Nth highest with a parameter-like CTE', sql:`WITH params(n) AS (SELECT 5),
ranked AS (
  SELECT DISTINCT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS r
  FROM employees
)
SELECT (SELECT salary FROM ranked, params WHERE r = n) AS nth_highest;`, why:`The outer scalar SELECT turns "no such rank" into NULL instead of an empty result. Change 5 to 50 to see it.`},
    {lv:'adv', title:'Find, then delete duplicates, keeping the earliest hire', sql:`CREATE TABLE people AS SELECT * FROM employees;
INSERT INTO people (id, name, dept_id, manager_id, title, salary, hired)
SELECT id + 100, name, dept_id, manager_id, title, salary, '2024-01-01' FROM employees WHERE id IN (3, 7);

DELETE FROM people WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY hired, id) AS rn
    FROM people) t
  WHERE rn > 1);

SELECT name, COUNT(*) AS copies FROM people GROUP BY name HAVING COUNT(*) > 1;`, why:`We create duplicate Kirans and Ravis, delete every copy but the earliest hired, and the final check returns no rows. (Empty result = success.)`},
  ],
  tips: {
    say:`"I'd clarify whether we rank distinct values and what to return if N doesn't exist. Then: DENSE_RANK in a subquery and filter rank N, or DISTINCT ORDER BY DESC LIMIT 1 OFFSET N−1, wrapped in a scalar subquery to return NULL when it's missing."`,
    points:[`Ask the edge-case questions before coding.`,`Give two solutions and compare them (portability, ties, readability).`,`For duplicates, mention adding a UNIQUE constraint afterwards.`],
    traps:[`ROW_NUMBER for Nth highest.`,`Forgetting DISTINCT with OFFSET.`,`Using a correlated COUNT(DISTINCT) solution without mentioning it's O(n²).`],
    qa:[[`Nth highest without window functions or LIMIT?`,`<code>SELECT DISTINCT salary FROM employees e WHERE N-1 = (SELECT COUNT(DISTINCT salary) FROM employees x WHERE x.salary &gt; e.salary);</code> Correct but O(n²).`],
        [`Department with the highest total salary?`,`<code>SELECT dept_id, SUM(salary) s FROM employees GROUP BY dept_id ORDER BY s DESC LIMIT 1;</code> (ties: use RANK).`],
        [`Employees who earn more than the average of their department?`,`Correlated subquery, join to a grouped derived table, or AVG() OVER (PARTITION BY dept_id) in a CTE (1.6, 2.2).`]]
  },
  exercises: [
    {lv:'E', q:`The <b>lowest</b> salary in the company and everyone earning it: <code>name, salary</code>.`, hint:`WHERE salary = (SELECT MIN(salary) …).`,
     sql:`SELECT name, salary FROM employees WHERE salary = (SELECT MIN(salary) FROM employees);`},
    {lv:'M', q:`The 4th highest distinct salary, as a single column <code>salary</code>.`, hint:`DENSE_RANK = 4, or DISTINCT … LIMIT 1 OFFSET 3.`,
     sql:`SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 3;`},
    {lv:'M', q:`Departments whose total salary bill is the highest (handle ties). Return <code>dept_id, total</code>.`, hint:`Group, then compare with the MAX of the grouped totals.`,
     sql:`WITH t AS (SELECT dept_id, SUM(salary) AS total FROM employees WHERE dept_id IS NOT NULL GROUP BY dept_id)
SELECT dept_id, total FROM t WHERE total = (SELECT MAX(total) FROM t);`},
    {lv:'H', q:`"Record highs": employees whose salary is the highest among everyone in their department hired up to and including their own hire date. Return <code>dept_id, name, hired, salary</code>.`, hint:`MAX(salary) OVER (PARTITION BY dept_id ORDER BY hired) is the running max; keep rows where salary equals it.`,
     sql:`WITH r AS (
  SELECT dept_id, name, hired, salary,
         MAX(salary) OVER (PARTITION BY dept_id ORDER BY hired) AS running_max
  FROM employees WHERE dept_id IS NOT NULL
)
SELECT dept_id, name, hired, salary FROM r WHERE salary = running_max;`},
  ],
  quiz: [
    [`Salaries 300, 300, 200, 100. "Second highest salary" is usually…`,[`300`,`200`,`100`,`NULL`],1,`Distinct values: 300, 200, 100.`,'E'],
    [`Which function is right for Nth highest distinct salary?`,[`ROW_NUMBER`,`RANK`,`DENSE_RANK`,`NTILE`],2,`No gaps after ties.`,'M'],
    [`<code>SELECT salary FROM e ORDER BY salary DESC LIMIT 1 OFFSET 1</code> on 300, 300, 200 returns…`,[`200`,`300`,`NULL`,`Error`],1,`Without DISTINCT the duplicate 300 occupies offset 1.`,'M'],
    [`MAX(salary) WHERE salary < (SELECT MAX(salary) …) when all salaries are equal returns…`,[`That salary`,`NULL`,`0`,`An error`],1,`MAX over no rows is NULL.`,'M'],
    [`Find duplicate emails…`,[`SELECT DISTINCT email`,`GROUP BY email HAVING COUNT(*) > 1`,`WHERE COUNT(email) > 1`,`ORDER BY email`],1,`Groups with more than one row.`,'E'],
    [`To delete duplicates keeping one copy…`,[`DELETE … WHERE COUNT(*) > 1`,`ROW_NUMBER() OVER (PARTITION BY key ORDER BY id), delete rn > 1`,`DISTINCT then TRUNCATE`,`DELETE with LIMIT 1`],1,`Deterministic survivor.`,'M'],
  ],
  quizAdv: [
    [`The correlated "N-1 = COUNT(DISTINCT salary greater than mine)" solution is…`,[`O(n)`,`O(n²) without help from the optimizer`,`Wrong for ties`,`Not valid SQL`],1,`Correct but slow on big tables.`,'H'],
    [`Return NULL (not empty) when the Nth salary doesn't exist:`,[`Add WHERE salary IS NULL`,`Wrap the query in a scalar subquery: SELECT (SELECT … LIMIT 1 OFFSET N-1)`,`Use COALESCE on the table`,`Use RIGHT JOIN`],1,`A scalar subquery with no rows yields NULL.`,'H'],
    [`Deleting duplicates on a 500M-row table in production, best approach?`,[`One big DELETE`,`Batch by key range, or build a deduped copy and swap; then add the unique index`,`TRUNCATE`,`Disable WAL`],1,`Keep transactions short.`,'H'],
  ],
});
