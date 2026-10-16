/* 0.3 NULL and three-valued logic */
topic('0', { no:'0.3', title:'NULL and three-valued logic', db:'shop',
idea:`NULL means "unknown", not zero or empty. Step through comparisons, WHERE filters, aggregates and NOT IN to see how TRUE / FALSE / UNKNOWN changes results, and where NULL quietly drops rows.`,
tbTitle:'customers', stateTitle:'Evaluation',
codes:{a:`SELECT name, city FROM customers WHERE city = 'Pune';
SELECT name, city FROM customers WHERE city <> 'Pune';
SELECT name, city FROM customers WHERE city IS NULL;

SELECT NULL = NULL;                -- NULL (unknown), not true!
SELECT COUNT(*), COUNT(city) FROM customers;
SELECT COALESCE(city, 'unknown') FROM customers;

SELECT name FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders WHERE …);   -- NULL trap`},
steps:[
{hl:{q:[1]}, tb:[TB('customers',['id','name','city'],[[1,'Asha','Pune'],[2,'Ben','Mumbai'],[3,'Chen','Pune'],[6,'Farah',null]],{0:'ok',2:'ok'})], g:[G('city = \'Pune\'',['Asha','TRUE','ok'],['Ben','FALSE'],['Chen','TRUE','ok'],['Farah','NULL = \'Pune\' → UNKNOWN','hot'])], log:['= Pune → Asha, Chen'],
 say:`<b>NULL</b> means "value unknown or not applicable". Farah's city is NULL. Comparing anything with NULL doesn't give TRUE or FALSE but a third truth value, <b>UNKNOWN</b>. WHERE keeps a row only if the condition is TRUE, so Farah is out.`},
{hl:{q:[2]}, tb:[TB('customers',['id','name','city'],[[1,'Asha','Pune'],[2,'Ben','Mumbai'],[3,'Chen','Pune'],[6,'Farah',null]],{1:'ok',3:'bad'})], g:[G('city <> \'Pune\'',['Ben','TRUE','ok'],['Farah','UNKNOWN → dropped','bad'])], log:['<> Pune → Ben only (Farah missing!)'],
 say:`Surprise: Farah isn't in the "not Pune" list either. <code>NULL &lt;&gt; 'Pune'</code> is also UNKNOWN. Rows with NULL fall through <i>both</i> a condition and its opposite. If you want them, ask explicitly: <code>city &lt;&gt; 'Pune' OR city IS NULL</code>.`},
{hl:{q:[3,5]}, tb:[TB('customers',['id','name','city'],[[1,'Asha','Pune'],[2,'Ben','Mumbai'],[3,'Chen','Pune'],[6,'Farah',null]],{3:'ok'})], g:[G('Testing for NULL',['city = NULL','UNKNOWN for every row (returns nothing)','bad'],['city IS NULL','TRUE for Farah','ok'],['NULL = NULL','UNKNOWN: two unknowns aren\'t known to be equal'],['IS DISTINCT FROM','NULL-safe comparison (Postgres; <=> in MySQL, IS in SQLite)'])], log:['IS NULL → Farah'],
 say:`To test for NULL use <code>IS NULL</code> / <code>IS NOT NULL</code>. <code>city = NULL</code> is always UNKNOWN, so it returns no rows, ever. Even <code>NULL = NULL</code> is UNKNOWN: two unknown values aren't known to be equal.`},
{hl:{}, g:[G('AND',['TRUE AND UNKNOWN','UNKNOWN'],['FALSE AND UNKNOWN','FALSE','hot']), G('OR',['TRUE OR UNKNOWN','TRUE','hot'],['FALSE OR UNKNOWN','UNKNOWN']), G('NOT',['NOT UNKNOWN','UNKNOWN'])],
 say:`Three-valued logic in one picture. Think of UNKNOWN as "could be either": FALSE AND anything is FALSE, TRUE OR anything is TRUE; otherwise the answer stays UNKNOWN. And <code>NOT UNKNOWN</code> is still UNKNOWN, which is why negating a condition doesn't bring NULL rows back.`},
{hl:{q:[6,7]}, g:[G('Aggregates',['COUNT(*)','7: counts rows','ok'],['COUNT(city)','6: skips NULL','hot'],['AVG(x)','sum of non-NULL / count of non-NULL'],['SUM over only NULLs','NULL, not 0']), G('Fixing display',['COALESCE(city, \'unknown\')','first non-NULL argument','ok'],['NULLIF(a, b)','NULL if a = b (avoid ÷0)'])], log:['COUNT(*) = 7, COUNT(city) = 6'],
 say:`Aggregates <b>ignore NULLs</b>. COUNT(*) counts rows; COUNT(column) counts non-NULL values. AVG divides by the non-NULL count, which changes the average. <code>COALESCE</code> replaces NULL with a default; <code>NULLIF(x, 0)</code> turns a zero divisor into NULL to avoid division errors.`},
{hl:{q:[9,10]}, tb:[TB('subquery returns',['customer_id'],[[1],[2],[null]],{2:'bad'})], g:[G('id NOT IN (1, 2, NULL)',['= id<>1 AND id<>2 AND id<>NULL',''],['id<>NULL','UNKNOWN','bad'],['whole condition','never TRUE → 0 rows','bad'],['fix','NOT EXISTS (…)','ok'])], log:['NOT IN with a NULL in the list → empty result'],
 say:`The most famous NULL bug. <code>x NOT IN (1, 2, NULL)</code> expands to <code>x&lt;&gt;1 AND x&lt;&gt;2 AND x&lt;&gt;NULL</code>. The last part is UNKNOWN, so the whole thing can never be TRUE: <b>zero rows</b>, silently. Use <code>NOT EXISTS</code>, which doesn't have this problem (1.4).`},
{hl:{}, tb:[], g:[G('NULL rules',['comparisons with NULL','UNKNOWN'],['WHERE / ON / HAVING','keep only TRUE'],['CHECK constraints','reject only FALSE (UNKNOWN passes!)','hot'],['GROUP BY / DISTINCT','treat NULLs as one group'],['ORDER BY','NULLs first or last (DB-specific)'],['UNIQUE','most DBs allow many NULLs'])],
 say:`<b>Say it:</b> "NULL means unknown. Comparisons with NULL yield UNKNOWN, and WHERE keeps only TRUE rows, so NULLs vanish from both = and &lt;&gt; filters. Use IS NULL, COALESCE, and NOT EXISTS instead of NOT IN. Aggregates skip NULLs, so COUNT(*) and COUNT(col) differ." Bonus: CHECK constraints only reject FALSE, so a NULL slips through unless the column is NOT NULL.`}
],
keep:[`NULL = unknown. Any comparison with NULL → UNKNOWN; WHERE keeps only TRUE.`,`Use IS NULL / IS NOT NULL, never = NULL.`,`COUNT(*) counts rows; COUNT(col), SUM, AVG skip NULLs.`,`NOT IN (subquery with a NULL) returns nothing: use NOT EXISTS.`,`COALESCE(x, default) for display; NULLIF(x, 0) to avoid ÷0.`]}, {
  imp: 'must',
  theory: TH(`NULL is a marker for a missing or unknown value, and SQL uses three-valued logic (TRUE, FALSE, UNKNOWN) whenever NULL is involved.`,
`<p>Not every value is known when a row is written: a customer may not have given their city, an order may not have shipped yet. SQL stores <b>NULL</b> in those columns. NULL is not 0, not an empty string, not "false": it's "I don't know".</p>
<p>Because the value is unknown, questions about it have unknown answers. Is an unknown city equal to Pune? Maybe. So SQL answers <b>UNKNOWN</b>. A WHERE clause only keeps rows where the answer is definitely TRUE, which is why NULL rows disappear from filters in both directions.</p>`,
[[`NULL`,`Missing/unknown value marker.`],[`UNKNOWN`,`The third truth value, produced by comparisons with NULL.`],[`IS [NOT] NULL`,`The only correct way to test for NULL.`],[`COALESCE(a, b, …)`,`Returns the first non-NULL argument.`],[`NULLIF(a, b)`,`Returns NULL if a = b, else a.`],[`IS DISTINCT FROM`,`NULL-safe inequality (Postgres, SQL standard).`]],
[`A comparison involving NULL evaluates to UNKNOWN.`,`AND/OR/NOT combine TRUE/FALSE/UNKNOWN by three-valued truth tables.`,`WHERE, ON and HAVING keep a row only if the result is TRUE.`,`Aggregates skip NULL inputs; COUNT(*) is the exception.`],
[`Optional fields (middle name, shipped_at, deleted_at) are NULLable columns.`,`Reports use COALESCE to show "unknown" or 0 instead of blanks.`,`Make columns NOT NULL by default and allow NULL only when "unknown" is a real state.`],
[`WHERE col = NULL (always empty).`,`NOT IN against a subquery that can return NULL.`,`AVG over a NULLable column without thinking about what NULL means.`,`Concatenating with NULL: 'a' || NULL is NULL.`,`Assuming a UNIQUE column allows only one NULL (most DBs allow many).`]),
  examples: [
    {lv:'basic', title:'Find missing values', sql:`SELECT name FROM customers WHERE email IS NULL;`, why:`Diya has no email. <code>WHERE email = NULL</code> would return nothing.`},
    {lv:'mid', title:'COUNT(*) vs COUNT(column) and COALESCE', sql:`SELECT COUNT(*) AS customers,
       COUNT(city) AS with_city,
       COUNT(*) - COUNT(city) AS without_city
FROM customers;

SELECT name, COALESCE(city, '(unknown)') AS city FROM customers;`, why:`COUNT(col) skips NULLs. COALESCE gives a display default without changing the data.`},
    {lv:'adv', title:'The NOT IN trap, and the fix', sql:`-- customers who never ordered, if the subquery can contain a NULL:
SELECT name FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders UNION ALL SELECT NULL);

SELECT name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);`, why:`The first query returns <b>no rows</b> because the list contains a NULL (simulated with UNION ALL SELECT NULL; in real life a nullable column does it). NOT EXISTS correctly returns Diya and Farah. Run it and compare the two result sets.`},
  ],
  tips: {
    say:`"NULL means unknown, so comparisons with it give UNKNOWN and WHERE drops those rows. I test with IS NULL, default with COALESCE, avoid NOT IN against nullable subqueries by using NOT EXISTS, and remember aggregates ignore NULLs, so COUNT(*) and COUNT(col) differ."`,
    points:[`Draw the AND/OR truth table with UNKNOWN when asked.`,`Bring up the NOT IN trap yourself: it's a favourite follow-up.`,`Mention that CHECK constraints pass on UNKNOWN, so pair them with NOT NULL.`],
    traps:[`Treating NULL as 0 or ''. (Oracle is the odd one out: it treats '' as NULL.)`,`Writing = NULL.`,`Forgetting that NULL rows vanish from both = and <> filters.`],
    qa:[[`What does <code>SELECT NULL = NULL</code> return?`,`NULL (UNKNOWN), not TRUE. Use IS NULL, or IS NOT DISTINCT FROM for a NULL-safe equality.`],
        [`AVG(bonus) where some bonuses are NULL: what does it compute?`,`The average of the non-NULL bonuses. If NULL should mean 0, use AVG(COALESCE(bonus, 0)).`],
        [`Does GROUP BY put all NULLs in one group?`,`Yes. GROUP BY and DISTINCT treat NULLs as equal to each other, unlike =.`]]
  },
  exercises: [
    {lv:'E', q:`List the names of customers whose city is not Mumbai, <b>including</b> customers with an unknown city.`, hint:`<> alone drops NULLs; add OR … IS NULL.`,
     sql:`SELECT name FROM customers WHERE city <> 'Mumbai' OR city IS NULL;`},
    {lv:'M', q:`For each city, count customers. Show customers with no city under the label <code>'(none)'</code>. Columns: <code>city, n</code>.`, hint:`GROUP BY a COALESCE expression.`,
     sql:`SELECT COALESCE(city, '(none)') AS city, COUNT(*) AS n
FROM customers
GROUP BY COALESCE(city, '(none)');`},
    {lv:'M', q:`Evaluate each expression to TRUE, FALSE or UNKNOWN: (a) <code>NULL &gt; 5</code> (b) <code>NULL OR TRUE</code> (c) <code>NULL AND FALSE</code> (d) <code>NOT (NULL = 1)</code> (e) <code>NULL IS NULL</code>.`, hint:`UNKNOWN behaves like "could be either".`,
     answer:`(a) UNKNOWN (b) TRUE (c) FALSE (d) UNKNOWN (e) TRUE`},
    {lv:'H', q:`Return the names of customers who have no email <b>or</b> share their city with nobody else (a city held by exactly one customer). Customers with a NULL city count as sharing with nobody.`, hint:`Group cities in a subquery; be careful that a NULL city never matches with =.`,
     sql:`SELECT name FROM customers c
WHERE c.email IS NULL
   OR c.city IS NULL
   OR (SELECT COUNT(*) FROM customers d WHERE d.city = c.city) = 1;`},
  ],
  quiz: [
    [`What does <code>WHERE city = NULL</code> return?`,[`Rows where city is NULL`,`No rows`,`All rows`,`An error in every database`],1,`Comparison with NULL is UNKNOWN for every row.`,'E'],
    [`COUNT(*) vs COUNT(email) on a table where 2 of 10 emails are NULL?`,[`10 and 10`,`10 and 8`,`8 and 8`,`8 and 10`],1,`COUNT(column) skips NULLs.`,'E'],
    [`<code>TRUE OR UNKNOWN</code> is…`,[`TRUE`,`FALSE`,`UNKNOWN`,`NULL error`],0,`TRUE OR anything is TRUE.`,'E'],
    [`Why can <code>x NOT IN (SELECT y …)</code> return no rows unexpectedly?`,[`NOT IN doesn't use indexes`,`If the subquery returns a NULL, every comparison becomes UNKNOWN`,`NOT IN removes duplicates`,`Subqueries run before the outer query`],1,`x <> NULL is UNKNOWN, so the AND chain is never TRUE.`,'M'],
    [`Which returns 'n/a' when phone is NULL?`,[`NULLIF(phone, 'n/a')`,`COALESCE(phone, 'n/a')`,`ISNULL(phone) = 'n/a'`,`phone OR 'n/a'`],1,`First non-NULL argument.`,'E'],
    [`A CHECK (age >= 18) constraint and an INSERT with age NULL. Result?`,[`Rejected`,`Accepted: CHECK only rejects FALSE`,`age becomes 18`,`Accepted only in MySQL`],1,`UNKNOWN passes a CHECK; add NOT NULL if needed.`,'M'],
  ],
  quizAdv: [
    [`AVG over salaries (100, 200, NULL) is…`,[`100`,`150`,`NULL`,`300`],1,`Sum 300 ÷ 2 non-NULL values.`,'M'],
    [`In PostgreSQL, a UNIQUE column with two NULLs…`,[`Rejects the second NULL`,`Allows both (NULLs aren't equal), unless declared NULLS NOT DISTINCT`,`Converts them to empty strings`,`Raises a warning`],1,`PG 15 added NULLS NOT DISTINCT.`,'H'],
    [`SUM(amount) over a group whose amounts are all NULL returns…`,[`0`,`NULL`,`An error`,`The row count`],1,`Wrap it: COALESCE(SUM(amount), 0).`,'M'],
  ],
});
