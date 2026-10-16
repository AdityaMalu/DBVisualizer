/* 2.2 Window functions: ranking */
topic('2', { no:'2.2', title:'Window functions I: OVER, PARTITION BY, ROW_NUMBER, RANK, DENSE_RANK', db:'hr',
idea:`Unlike GROUP BY, a window function keeps every row and adds a value computed over a "window" of related rows. Watch PARTITION BY split employees by department, ORDER BY rank them, and see how ROW_NUMBER, RANK and DENSE_RANK disagree on ties.`,
tbTitle:'Rows with window values', stateTitle:'Window',
codes:{a:`SELECT name, dept_id, salary,
       ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn,
       RANK()       OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS drnk,
       AVG(salary)  OVER (PARTITION BY dept_id)                     AS dept_avg
FROM employees
WHERE dept_id = 1;

-- top 2 earners per department
SELECT * FROM (
  SELECT name, dept_id, salary,
         DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS r
  FROM employees
) t
WHERE r <= 2;`},
steps:[
{hl:{q:[6,7]}, tb:[TB('Engineering (dept 1)',['name','salary'],[['Meera',250000],['Arjun',180000],['Kiran',150000],['Lena',110000],['Omar',110000]])], g:[G('GROUP BY vs window',['GROUP BY','collapses rows: 1 row per group'],['window function','keeps every row, adds a column','hot'])],
 say:`A <b>window function</b> computes a value over a set of rows related to the current row (its <i>window</i>) but, unlike GROUP BY, <b>doesn't collapse rows</b>. Every employee stays; we add columns. The syntax is <code>function() OVER (…)</code>.`},
{hl:{q:[5]}, tb:[TB('AVG(salary) OVER (PARTITION BY dept_id)',['name','salary','dept_avg'],[['Meera',250000,160000],['Arjun',180000,160000],['Kiran',150000,160000],['Lena',110000,160000],['Omar',110000,160000]])], g:[G('OVER (PARTITION BY dept_id)',['partition','rows with the same dept_id','hot'],['AVG','computed per partition, repeated on each row'])],
 say:`<code>PARTITION BY dept_id</code> splits rows into partitions (like GROUP BY, but without collapsing). <code>AVG(salary) OVER (PARTITION BY dept_id)</code> puts the department average <i>next to every row</i>. Now "salary minus department average" is a simple expression, no self-join or subquery needed.`},
{hl:{q:[2]}, tb:[TB('ROW_NUMBER',['name','salary','rn'],[['Meera',250000,1],['Arjun',180000,2],['Kiran',150000,3],['Lena',110000,4],['Omar',110000,5]],{3:'hot',4:'hot'})], g:[G('ROW_NUMBER',['always','1, 2, 3, 4, 5 (unique)'],['ties','broken arbitrarily: Lena or Omar could be 4','bad'],['fix','add a tiebreaker to ORDER BY (…, id)'])],
 say:`<code>ORDER BY salary DESC</code> inside OVER sorts rows within each partition. <b>ROW_NUMBER()</b> numbers them 1, 2, 3… with no gaps and no ties. Lena and Omar earn the same, so who gets 4 is arbitrary unless you add a tiebreaker like <code>, id</code>. Use ROW_NUMBER when you need exactly one row per position (dedup, pagination).`},
{hl:{q:[3,4]}, tb:[TB('RANK vs DENSE_RANK',['name','salary','rn','rnk','drnk'],[['Meera',250000,1,1,1],['Arjun',180000,2,2,2],['Kiran',150000,3,3,3],['Lena',110000,4,4,4],['Omar',110000,5,4,4]],{3:'hot',4:'hot'})], g:[G('Ties',['RANK','ties share a rank, then a gap: 1,2,3,4,4,6'],['DENSE_RANK','ties share a rank, no gap: 1,2,3,4,4,5','hot'],['ROW_NUMBER','never ties'])],
 say:`<b>RANK()</b> gives ties the same rank and then <i>skips</i> (like Olympic medals: two golds, no silver). <b>DENSE_RANK()</b> gives ties the same rank with <i>no gap</i>. Lena and Omar are both 4 in each; the next person would be 6 with RANK and 5 with DENSE_RANK.`},
{hl:{q:[9,10,11,12,13,14,15]}, tb:[TB('top 2 per department',['name','dept_id','salary','r'],[['Meera',1,250000,1],['Arjun',1,180000,2],['Priya',2,160000,1],['Sara',2,95000,2],['Tom',3,100000,1],['Uma',3,70000,2],['Vikram',null,60000,1]],{6:'dim'})], g:[G('Top-N per group',['rank in a subquery / CTE','window runs in SELECT phase'],['filter outside','WHERE r <= 2','hot'],['ties included?','DENSE_RANK/RANK yes, ROW_NUMBER no'])],
 say:`The killer use case: <b>top N per group</b>. Window functions run in the SELECT phase (1.2), so you compute the rank in a subquery or CTE and filter outside. With DENSE_RANK, tied salaries are all included; with ROW_NUMBER you get exactly N rows per department. (NULL dept_id forms its own partition: Vikram.)`},
{hl:{}, tb:[], g:[G('Other ranking functions',['NTILE(4)','split into quartiles'],['PERCENT_RANK()','relative rank 0..1'],['CUME_DIST()','fraction of rows ≤ current'])],
 say:`<b>Say it:</b> "A window function computes over a set of rows related to the current row without collapsing them. PARTITION BY defines the groups, ORDER BY the order within them. ROW_NUMBER is unique, RANK leaves gaps after ties, DENSE_RANK doesn't. For top-N per group I rank in a CTE and filter outside, because window functions are evaluated after WHERE."`}
],
keep:[`Window function = value over related rows, rows NOT collapsed. f() OVER (PARTITION BY … ORDER BY …).`,`ROW_NUMBER: 1,2,3,4,5. RANK: 1,2,3,4,4,6. DENSE_RANK: 1,2,3,4,4,5.`,`Top-N per group: rank in a CTE/subquery, filter WHERE r <= N outside.`,`Add a tiebreaker to ORDER BY for deterministic ROW_NUMBER.`]}, {
  imp: 'must',
  theory: TH(`A window function calculates a value for each row from a set of related rows (its window), without merging those rows the way GROUP BY does.`,
`<p>GROUP BY answers "what's the average per department?" but loses the individual rows. Often you want both: each employee <i>and</i> their department's average, or each employee <i>and</i> their rank within the department. Window functions do exactly that.</p>
<p>Imagine a class photo where each student holds a card with their rank in their own section. Nobody leaves the photo (no collapsing); the card is computed by looking at the other students in the same section (the partition), ordered by marks.</p>`,
[[`OVER (…)`,`Turns a function into a window function.`],[`PARTITION BY`,`Splits rows into independent windows.`],[`ORDER BY (in OVER)`,`Order within each partition; needed for ranking and running totals.`],[`ROW_NUMBER`,`Unique sequential number.`],[`RANK`,`Ties share rank; gaps after.`],[`DENSE_RANK`,`Ties share rank; no gaps.`],[`NTILE(n)`,`Bucket number 1..n.`]],
[`The query runs FROM/WHERE/GROUP BY/HAVING as usual.`,`Rows are partitioned and sorted per the OVER clause.`,`The function is computed for each row over its window.`,`ORDER BY/LIMIT of the outer query apply afterwards.`],
[`Leaderboards, "top 3 products per category", "latest event per user".`,`Deduplication: keep ROW_NUMBER() = 1 per key, delete the rest.`,`Showing a row next to its group total or average.`],
[`Trying to filter on a window function in WHERE.`,`Using ROW_NUMBER for "top 3 salaries" when ties should count (use DENSE_RANK).`,`Non-deterministic ROW_NUMBER without a tiebreaker.`]),
  examples: [
    {lv:'basic', title:'Rank everyone by salary', sql:`SELECT name, salary,
       RANK() OVER (ORDER BY salary DESC) AS company_rank
FROM employees;`, why:`No PARTITION BY: the whole table is one window. Lena and Omar tie.`},
    {lv:'mid', title:'Salary vs department average', sql:`SELECT name, dept_id, salary,
       ROUND(AVG(salary) OVER (PARTITION BY dept_id)) AS dept_avg,
       salary - ROUND(AVG(salary) OVER (PARTITION BY dept_id)) AS diff
FROM employees
WHERE dept_id IS NOT NULL
ORDER BY dept_id, diff DESC;`, why:`The same problem as 1.6 with no subquery: the average sits next to each row.`},
    {lv:'adv', title:'Latest order per customer (dedupe pattern)', sql:`WITH ranked AS (
  SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id
                                 ORDER BY order_date DESC, id DESC) AS rn
  FROM orders o
)
SELECT customer_id, id AS latest_order, order_date, status
FROM ranked
WHERE rn = 1
ORDER BY customer_id;`, why:`"Latest X per Y" in one pass. The same pattern deletes duplicates: keep rn = 1, delete rn &gt; 1.`, db:'shop'},
  ],
  tips: {
    say:`"Window functions compute over related rows without collapsing them: f() OVER (PARTITION BY … ORDER BY …). ROW_NUMBER is unique, RANK leaves gaps on ties, DENSE_RANK doesn't. For top-N or latest-per-group I compute the rank in a CTE and filter outside."`,
    points:[`Write the top-N-per-group query fluently; it's asked constantly.`,`Explain the tie behaviour with a tiny example (100, 90, 90, 80).`,`Mention the dedup pattern with ROW_NUMBER.`],
    traps:[`Putting ROW_NUMBER() in WHERE.`,`Using GROUP BY to fetch "the row with the max" (loses other columns).`],
    qa:[[`Scores 100, 90, 90, 80: ROW_NUMBER, RANK, DENSE_RANK?`,`ROW_NUMBER 1,2,3,4 · RANK 1,2,2,4 · DENSE_RANK 1,2,2,3.`],
        [`How do you delete duplicate rows keeping one?`,`<code>DELETE FROM t WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) rn FROM t) x WHERE rn &gt; 1);</code>`],
        [`Window function vs GROUP BY?`,`GROUP BY returns one row per group; a window function returns every input row with an extra computed column.`]]
  },
  exercises: [
    {lv:'E', q:`Number employees by hire date (earliest = 1) across the company: <code>name, hired, n</code>.`, hint:`ROW_NUMBER() OVER (ORDER BY hired).`,
     sql:`SELECT name, hired, ROW_NUMBER() OVER (ORDER BY hired) AS n FROM employees;`},
    {lv:'M', q:`The most recently hired employee in each department (ignore NULL dept). Return <code>dept_id, name, hired</code>.`, hint:`ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY hired DESC) in a CTE, keep rn = 1.`,
     sql:`WITH r AS (
  SELECT dept_id, name, hired,
         ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY hired DESC) AS rn
  FROM employees WHERE dept_id IS NOT NULL
)
SELECT dept_id, name, hired FROM r WHERE rn = 1;`},
    {lv:'H', q:`The <b>second highest distinct salary</b> in each department, with everyone who earns it. Return <code>dept_id, name, salary</code>.`, hint:`DENSE_RANK so ties at the top don't push the second salary out.`,
     sql:`WITH r AS (
  SELECT dept_id, name, salary,
         DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dr
  FROM employees WHERE dept_id IS NOT NULL
)
SELECT dept_id, name, salary FROM r WHERE dr = 2;`},
    {lv:'H', q:`Split all employees into salary quartiles (1 = highest paid). Return <code>name, salary, quartile</code>.`, hint:`NTILE(4) OVER (ORDER BY salary DESC).`,
     sql:`SELECT name, salary, NTILE(4) OVER (ORDER BY salary DESC, id) AS quartile FROM employees;`},
  ],
  quiz: [
    [`How is a window function different from GROUP BY?`,[`It's faster`,`It keeps every row and adds a computed column`,`It can't use aggregates`,`It needs an index`],1,`No collapsing.`,'E'],
    [`Scores 100, 90, 90, 80. RANK gives…`,[`1,2,3,4`,`1,2,2,3`,`1,2,2,4`,`1,1,2,3`],2,`Gap after ties.`,'E'],
    [`Same scores, DENSE_RANK gives…`,[`1,2,2,3`,`1,2,2,4`,`1,2,3,4`,`1,1,1,2`],0,`No gaps.`,'E'],
    [`What does PARTITION BY do?`,[`Physically partitions the table`,`Splits rows into independent windows for the function`,`Sorts the output`,`Removes duplicates`],1,`Like GROUP BY without collapsing.`,'E'],
    [`Why can't you write WHERE ROW_NUMBER() OVER (…) = 1?`,[`Syntax limitation of ROW_NUMBER only`,`Window functions are computed after WHERE (SELECT phase)`,`It needs HAVING`,`It can't be compared to integers`],1,`Wrap it in a CTE.`,'M'],
    [`For "top 3 salaries per dept, include ties", use…`,[`ROW_NUMBER`,`DENSE_RANK (or RANK)`,`NTILE`,`COUNT`],1,`ROW_NUMBER would cut ties arbitrarily.`,'M'],
  ],
  quizAdv: [
    [`ROW_NUMBER() OVER (ORDER BY salary) with tied salaries is…`,[`Deterministic`,`Non-deterministic among ties unless ORDER BY has a unique tiebreaker`,`An error`,`Always ordered by id`],1,`Add , id.`,'H'],
    [`Can a window function be used inside an aggregate (SUM(ROW_NUMBER() OVER …))?`,[`Yes, directly`,`No: nest it in a subquery first`,`Only in SQLite`,`Only with PARTITION BY`],1,`Windows are computed after aggregation.`,'H'],
    [`Index helping <code>ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)</code>?`,[`(order_date)`,`(customer_id, order_date DESC)`,`(status)`,`None can help`],1,`Rows arrive pre-sorted, avoiding a sort.`,'H'],
  ],
});
