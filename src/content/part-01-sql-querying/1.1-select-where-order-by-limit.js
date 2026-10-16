/* 1.1 SELECT, WHERE, ORDER BY, LIMIT */
topic('1', { no:'1.1', title:'SELECT, WHERE, ORDER BY, LIMIT', db:'shop',
idea:`Build one query clause by clause: pick columns, compute expressions, filter rows with AND/OR/IN/BETWEEN/LIKE, sort, and take the top rows. Watch the result table shrink and reorder at every step.`,
tbTitle:'Result so far', stateTitle:'Clause',
codes:{a:`SELECT *
FROM products;

SELECT name, price, price * 1.18 AS price_with_tax
FROM products
WHERE category = 'electronics' OR price < 50
  AND name LIKE 'C%'
ORDER BY price DESC
LIMIT 3;

SELECT DISTINCT category FROM products;`},
steps:[
{hl:{q:[1,2]}, tb:[TB('products',['id','name','category','price'],[[1,'Laptop','electronics',900],[2,'Phone','electronics',600],[3,'Headphones','electronics',120],[4,'Desk','furniture',250],[5,'Chair','furniture',150],[6,'Lamp','furniture',40],[7,'Novel','books',15],[8,'Cookbook','books',30]])],
 say:`<code>SELECT * FROM products</code> returns every column of every row. Handy for exploring, but in application code list the columns you need: <code>*</code> breaks when columns are added, sends more data over the network, and prevents index-only scans.`},
{hl:{q:[4,5]}, tb:[TB('projection',['name','price','price_with_tax'],[['Laptop',900,1062],['Phone',600,708],['Headphones',120,141.6],['Desk',250,295],['Chair',150,177],['Lamp',40,47.2],['Novel',15,17.7],['Cookbook',30,35.4]])], g:[G('SELECT list',['columns','name, price'],['expression','price * 1.18'],['alias','AS price_with_tax','hot'])],
 say:`The SELECT list chooses columns (<b>projection</b>) and can compute new ones. <code>AS</code> gives an expression a name, the <b>alias</b>. The table itself is unchanged; this is just the shape of the output.`},
{hl:{q:[6,7]}, tb:[TB('WHERE (as written)',['name','category','price','kept?'],[['Laptop','electronics',900,'yes'],['Phone','electronics',600,'yes'],['Headphones','electronics',120,'yes'],['Desk','furniture',250,'no'],['Chair','furniture',150,'no'],['Lamp','furniture',40,'no'],['Novel','books',15,'no'],['Cookbook','books',30,'yes']],{0:'ok',1:'ok',2:'ok',7:'ok'})], g:[G('Precedence',['AND binds tighter than OR','hot'],['reads as','cat = elec OR (price < 50 AND name LIKE \'C%\')'],['so','Cookbook (30, C…) is kept'])],
 say:`<b>WHERE</b> filters rows before anything is sorted or limited. Trap: <b>AND binds tighter than OR</b>, so this reads as "electronics, <i>or</i> (cheap <i>and</i> starts with C)". Cookbook sneaks in. When mixing AND and OR, always add parentheses so the intent is explicit.`},
{hl:{q:[8]}, tb:[TB('sorted',['name','price'],[['Laptop',900],['Phone',600],['Headphones',120],['Cookbook',30]])], g:[G('ORDER BY',['DESC','largest first'],['ties','order among equals is undefined'],['tiebreaker','ORDER BY price DESC, id','ok'],['NULLs','first or last depending on the DB'])],
 say:`<b>ORDER BY</b> sorts the result; DESC for descending. Without it the order is undefined, even if it "always comes back sorted" in testing. If two rows can tie, add a unique tiebreaker column so pagination is stable.`},
{hl:{q:[9]}, tb:[TB('LIMIT 3',['name','price'],[['Laptop',900],['Phone',600],['Headphones',120]],{0:'ok',1:'ok',2:'ok'})], g:[G('Top-N',['LIMIT n','Postgres, MySQL, SQLite'],['FETCH FIRST n ROWS ONLY','SQL standard, Oracle 12c+'],['TOP n','SQL Server'],['OFFSET k','skip k rows (see 5.5 for why it gets slow)'])],
 say:`<b>LIMIT</b> keeps the first N rows <i>after</i> sorting, which gives a "top N" query. Without ORDER BY, LIMIT returns an arbitrary N rows. Different databases spell it differently.`},
{hl:{q:[11]}, tb:[TB('DISTINCT category',['category'],[['electronics'],['furniture'],['books']])], g:[G('Filters you\'ll use',['IN (\'a\',\'b\')','membership'],['BETWEEN 10 AND 50','inclusive range'],['LIKE \'C%\'','% any chars, _ one char'],['IS NULL','missing values (0.3)'],['DISTINCT','remove duplicate rows'])],
 say:`<b>DISTINCT</b> removes duplicate result rows. Other everyday predicates: <code>IN</code> for lists, <code>BETWEEN</code> for inclusive ranges, <code>LIKE</code> with <code>%</code> (any characters) and <code>_</code> (one character). A leading-wildcard LIKE ('%top') can't use a normal index.`},
{hl:{}, tb:[], g:[G('Recipe',['FROM','which table'],['WHERE','which rows'],['SELECT','which columns / expressions'],['ORDER BY','in what order'],['LIMIT','how many'])],
 say:`<b>Say it:</b> "FROM picks the source, WHERE filters rows, SELECT projects columns and computes expressions, ORDER BY sorts, LIMIT takes the top rows. I always parenthesise mixed AND/OR, always pair LIMIT with ORDER BY, and avoid SELECT * in application code." The next topic shows the order in which these clauses actually run.`}
],
keep:[`AND binds tighter than OR: parenthesise.`,`No ORDER BY = no guaranteed order. LIMIT without ORDER BY = arbitrary rows.`,`Add a unique tiebreaker to ORDER BY for stable pages.`,`Avoid SELECT * in app code. LIKE '%x' can't use a B-tree index.`]}, {
  imp: 'must',
  theory: TH(`A SELECT query names a source table, filters its rows, chooses and computes columns, then optionally sorts and limits the result.`,
`<p>SQL reads almost like English: <i>select</i> these columns <i>from</i> this table <i>where</i> this is true, <i>order by</i> this, and give me only the first few. You describe the result; the database figures out how to produce it.</p>
<p>Picture a stack of index cards (rows). WHERE pulls out the cards you care about, SELECT copies only some fields from each card (and can compute new ones), ORDER BY sorts the pile, LIMIT keeps the top few.</p>`,
[[`Projection`,`Choosing columns (the SELECT list).`],[`Selection / predicate`,`A condition that filters rows (WHERE).`],[`Alias`,`A new name for a column or table (AS).`],[`DISTINCT`,`Removes duplicate rows from the result.`],[`LIMIT / OFFSET`,`Take N rows / skip K rows.`],[`Wildcards`,`In LIKE: % any sequence, _ exactly one character.`]],
[`FROM identifies the table.`,`WHERE keeps rows whose condition is TRUE.`,`SELECT evaluates expressions for each remaining row.`,`ORDER BY sorts, LIMIT cuts.`],
[`List pages: WHERE for filters, ORDER BY for sorting, LIMIT/OFFSET or keyset for pagination.`,`Search boxes often start as LIKE '%term%' and later move to full-text search (9.6).`,`Prepared statements with parameters (WHERE id = ?) prevent SQL injection.`],
[`Concatenating user input into SQL (injection).`,`Mixing AND/OR without parentheses.`,`Relying on default order.`,`Using SELECT * then reading columns by position.`]),
  examples: [
    {lv:'basic', title:'Filter and sort', sql:`SELECT name, price
FROM products
WHERE category = 'furniture'
ORDER BY price;`, why:`Furniture only, cheapest first.`},
    {lv:'mid', title:'IN, BETWEEN, LIKE and a computed column', sql:`SELECT name, category, price, ROUND(price * 0.9, 2) AS sale_price
FROM products
WHERE category IN ('books', 'furniture')
  AND price BETWEEN 20 AND 200
  AND name LIKE '%a%'
ORDER BY sale_price DESC;`, why:`BETWEEN is inclusive. LIKE '%a%' means "contains a". You can ORDER BY an alias.`},
    {lv:'adv', title:'Top 3 most recent non-cancelled orders, stable order', sql:`SELECT id, customer_id, order_date, status
FROM orders
WHERE status <> 'cancelled'
ORDER BY order_date DESC, id DESC
LIMIT 3;`, why:`The <code>id</code> tiebreaker makes the order deterministic even if two orders share a date; essential when paginating.`},
  ],
  tips: {
    say:`"WHERE filters rows, SELECT shapes columns, ORDER BY sorts, LIMIT cuts. I parenthesise mixed AND/OR, always pair LIMIT with a deterministic ORDER BY, and use parameters rather than string concatenation."`,
    points:[`Mention operator precedence unprompted when your WHERE mixes AND and OR.`,`Explain why SELECT * is a smell (network, index-only scans, brittle code).`,`Know the LIMIT spellings across databases.`],
    traps:[`Assuming rows come back in insertion or id order.`,`Forgetting LIKE is case-sensitive in Postgres (use ILIKE or lower()).`],
    qa:[[`How do you get the 3 most expensive products?`,`<code>ORDER BY price DESC LIMIT 3</code>; add a tiebreaker if ties matter, or use DENSE_RANK if "top 3 prices" should include ties (2.2).`],
        [`What's SQL injection and how do you prevent it?`,`User input concatenated into SQL becomes code ("' OR 1=1 --"). Use parameterised queries/prepared statements; never build SQL with string concatenation.`],
        [`Is <code>WHERE price BETWEEN 10 AND 20</code> inclusive?`,`Yes, both ends. For timestamps prefer <code>ts &gt;= a AND ts &lt; b</code> (half-open) to avoid missing the last day's times.`]]
  },
  exercises: [
    {lv:'E', q:`Customers who joined in 2023, oldest member first: <code>name, joined</code>.`, hint:`Dates are ISO text, so they compare correctly as strings; use a half-open range.`, ordered:true,
     sql:`SELECT name, joined FROM customers
WHERE joined >= '2023-01-01' AND joined < '2024-01-01'
ORDER BY joined;`},
    {lv:'M', q:`Products that are electronics costing more than 500, or books of any price. Return <code>name, category, price</code>, most expensive first.`, hint:`Parentheses around the electronics condition make the intent clear.`, ordered:true,
     sql:`SELECT name, category, price FROM products
WHERE (category = 'electronics' AND price > 500) OR category = 'books'
ORDER BY price DESC;`},
    {lv:'M', q:`The 2nd and 3rd most expensive products (<code>name, price</code>), using LIMIT and OFFSET.`, hint:`OFFSET 1 skips the first row.`, ordered:true,
     sql:`SELECT name, price FROM products ORDER BY price DESC LIMIT 2 OFFSET 1;`},
    {lv:'H', q:`Distinct cities of customers who have an email, alphabetical, excluding unknown cities.`, hint:`Two IS NOT NULL tests plus DISTINCT.`, ordered:true,
     sql:`SELECT DISTINCT city FROM customers
WHERE email IS NOT NULL AND city IS NOT NULL
ORDER BY city;`},
  ],
  quiz: [
    [`<code>WHERE a = 1 OR b = 2 AND c = 3</code> is evaluated as…`,[`(a = 1 OR b = 2) AND c = 3`,`a = 1 OR (b = 2 AND c = 3)`,`Left to right`,`An error`],1,`AND has higher precedence than OR.`,'M'],
    [`A query without ORDER BY returns rows…`,[`In primary key order`,`In insertion order`,`In no guaranteed order`,`Alphabetically`],2,`It depends on the plan.`,'E'],
    [`<code>LIKE 'a_c'</code> matches…`,[`'abc'`,`'ac'`,`'abbc'`,`'xabc'`],0,`_ is exactly one character.`,'E'],
    [`<code>BETWEEN 10 AND 20</code> includes…`,[`10 to 20 inclusive`,`11 to 19`,`10 to 19`,`11 to 20`],0,`Both ends inclusive.`,'E'],
    [`Why can LIMIT without ORDER BY be a bug?`,[`It's not allowed`,`Which rows you get is arbitrary and can change`,`It always returns the newest rows`,`It disables indexes`],1,`Pair LIMIT with a deterministic ORDER BY.`,'E'],
    [`SQL injection is best prevented by…`,[`Escaping quotes by hand`,`Parameterised queries / prepared statements`,`Using LIKE instead of =`,`Running queries as admin`],1,`Parameters are never parsed as SQL.`,'M'],
  ],
  quizAdv: [
    [`Paginating with <code>ORDER BY created_at LIMIT 20 OFFSET 40</code> shows duplicates across pages. Likely cause?`,[`OFFSET is buggy`,`created_at isn't unique, so ties are ordered differently per query`,`LIMIT must come before OFFSET`,`Indexes are missing`],1,`Add a unique tiebreaker: ORDER BY created_at, id.`,'H'],
    [`Why can <code>WHERE name LIKE '%phone'</code> not use a B-tree index on name?`,[`B-trees can't store text`,`The index is sorted by leading characters, and the pattern has no fixed prefix`,`LIKE always scans`,`It can if the table is small`],1,`Prefix patterns ('phone%') can use it; consider trigram or reverse indexes.`,'H'],
    [`SELECT DISTINCT a, b returns rows unique on…`,[`a only`,`b only`,`the combination (a, b)`,`the first selected column`],2,`DISTINCT applies to the whole row.`,'M'],
  ],
});
