/* 2.5 Gaps and islands */
topic('2', { no:'2.5', title:'Gaps and islands: streaks and consecutive runs', db:'shop',
idea:`"Longest login streak", "consecutive days", "sessions": the gaps-and-islands trick. Subtract a row number from each date and watch consecutive days collapse onto the same group key, then GROUP BY that key to get each streak.`,
tbTitle:'Asha\'s logins', stateTitle:'Trick',
codes:{a:`WITH numbered AS (
  SELECT customer_id, login_date,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY login_date) AS rn
  FROM logins
),
grouped AS (
  SELECT customer_id, login_date,
         date(login_date, '-' || rn || ' days') AS grp     -- date − rn
  FROM numbered
)
SELECT customer_id, MIN(login_date) AS start_day,
       MAX(login_date) AS end_day, COUNT(*) AS streak
FROM grouped
GROUP BY customer_id, grp
ORDER BY streak DESC;`},
steps:[
{hl:{}, tb:[TB('logins (customer 1)',['login_date'],[['2024-03-01'],['2024-03-02'],['2024-03-03'],['2024-03-05'],['2024-03-06']])], g:[G('Islands',['03-01 → 03-03','streak of 3','hot'],['gap','03-04 missing'],['03-05 → 03-06','streak of 2'])],
 say:`Asha logged in on March 1, 2, 3, skipped the 4th, then came back on the 5th and 6th. Consecutive runs are <b>islands</b>; missing values between them are <b>gaps</b>. Question: what are her streaks, and which is the longest? You can't GROUP BY anything obvious, because nothing in the row says "streak 1".`},
{hl:{q:[1,2,3,4,5]}, tb:[TB('numbered',['login_date','rn'],[['2024-03-01',1],['2024-03-02',2],['2024-03-03',3],['2024-03-05',4],['2024-03-06',5]])], g:[G('Step 1',['ROW_NUMBER per customer','ordered by date','hot'])],
 say:`Step 1: number each customer's logins in date order with ROW_NUMBER. Within an island, the date and the row number both go up by exactly 1 per row. Across a gap, the date jumps by more than 1 but the row number still goes up by 1.`},
{hl:{q:[6,7,8,9,10]}, tb:[TB('grouped',['login_date','rn','date − rn'],[['2024-03-01',1,'2024-02-29'],['2024-03-02',2,'2024-02-29'],['2024-03-03',3,'2024-02-29'],['2024-03-05',4,'2024-03-01'],['2024-03-06',5,'2024-03-01']],{0:'hot',1:'hot',2:'hot',3:'ok',4:'ok'})], g:[G('Step 2: date − rn',['same island','same value (both +1 per row)','hot'],['after a gap','value jumps'],['the value itself','meaningless; only equality matters'])],
 say:`Step 2, the trick: <b>date minus row number</b>. Inside an island both increase together, so the difference is <i>constant</i> (Feb 29 for the first streak, Mar 1 for the second). After a gap the date jumped further than rn, so the difference changes. That constant is a <b>group key for each island</b>. Its actual value doesn't mean anything.`},
{hl:{q:[11,12,13,14,15]}, tb:[TB('streaks (all customers)',['customer_id','start_day','end_day','streak'],[[3,'2024-03-02','2024-03-05',4],[1,'2024-03-01','2024-03-03',3],[1,'2024-03-05','2024-03-06',2],[2,'2024-03-01','2024-03-01',1],[2,'2024-03-03','2024-03-03',1],[5,'2024-03-04','2024-03-04',1]],{0:'ok'})], log:['longest streak: customer 3, 4 days'],
 say:`Step 3: <code>GROUP BY customer_id, grp</code>. Each group is one island: MIN is its start, MAX its end, COUNT its length. Chen (customer 3) has the longest streak, 4 days. Same pattern for integers (consecutive ids, seat numbers): <code>value − ROW_NUMBER()</code>.`},
{hl:{}, tb:[], g:[G('Alternative: LAG flags',['is_start','1 if prev date ≠ date − 1 day'],['island id','running SUM(is_start)'],['handles','sessions with a timeout (gap > 30 min = new session)','ok']), G('Variants',['gaps','LEAD(date) − date > 1 → missing range'],['duplicates per day','DISTINCT dates first, or use DENSE_RANK'])],
 say:`A second approach generalises better: mark a row as the <b>start</b> of a new island when it isn't contiguous with the previous one (via LAG), then a running SUM of those flags numbers the islands. That handles fuzzy rules like "a new session starts after 30 minutes of inactivity". For <b>gaps</b>, compare each row with LEAD.`},
{hl:{}, g:[G('Recipe',['1','ROW_NUMBER() OVER (PARTITION BY entity ORDER BY seq)'],['2','key = seq − rn'],['3','GROUP BY entity, key → MIN, MAX, COUNT'])],
 say:`<b>Say it:</b> "It's gaps and islands. I number the rows per user by date, subtract the row number from the date so consecutive days share the same value, then group by user and that value to get each streak's start, end and length. For session-style rules I'd use LAG to flag starts and a running sum to label islands."`}
],
keep:[`Island key = value − ROW_NUMBER() (dates: date − rn days). Constant within a consecutive run.`,`GROUP BY entity, key → MIN = start, MAX = end, COUNT = length.`,`Duplicates per day break it: DISTINCT first or DENSE_RANK.`,`Alternative: LAG to flag starts + running SUM to number islands (sessionization).`]}, {
  imp: 'good',
  theory: TH(`Gaps-and-islands problems find runs of consecutive values (islands) and the holes between them (gaps), usually by turning "consecutive" into a shared group key.`,
`<p>Streaks (consecutive login days), sessions (clicks less than 30 minutes apart), ranges of free seats, periods a sensor was "on": all are runs of consecutive values. SQL's GROUP BY needs a column that says which run a row belongs to, and that column doesn't exist, so you compute it.</p>
<p>The trick is like comparing two counters that tick together: the calendar date and a simple 1, 2, 3 counter. While you log in every day, their difference stays the same. Skip a day and the calendar jumps ahead, so the difference changes: a new island.</p>`,
[[`Island`,`A maximal run of consecutive values.`],[`Gap`,`Missing values between islands.`],[`Group key`,`value − ROW_NUMBER(), constant within an island.`],[`Start flag`,`1 when a row isn't contiguous with the previous one.`],[`Sessionization`,`Splitting events into sessions by an inactivity timeout.`]],
[`Order rows per entity.`,`Compute a key that is constant within each run (difference trick or running sum of start flags).`,`Group by entity and key.`,`Aggregate: start, end, length.`],
[`Gamification: daily streaks.`,`Analytics: sessions, active periods, outages from heartbeat data.`,`Inventory: contiguous free seats or ID ranges.`],
[`Duplicate days in the input inflating ROW_NUMBER.`,`Forgetting to PARTITION BY the entity.`,`Using integer subtraction on date strings in databases that need date arithmetic.`]),
  examples: [
    {lv:'basic', title:'Mark logins that start a new streak', sql:`SELECT customer_id, login_date,
       CASE WHEN date(login_date, '-1 day') =
                 LAG(login_date) OVER (PARTITION BY customer_id ORDER BY login_date)
            THEN 0 ELSE 1 END AS starts_streak
FROM logins
ORDER BY customer_id, login_date;`, why:`A login starts a streak unless the previous login was exactly yesterday.`},
    {lv:'mid', title:'Number the streaks with a running sum', sql:`WITH flags AS (
  SELECT customer_id, login_date,
         CASE WHEN date(login_date, '-1 day') =
                   LAG(login_date) OVER (PARTITION BY customer_id ORDER BY login_date)
              THEN 0 ELSE 1 END AS s
  FROM logins
)
SELECT customer_id, login_date,
       SUM(s) OVER (PARTITION BY customer_id ORDER BY login_date) AS streak_no
FROM flags
ORDER BY customer_id, login_date;`, why:`Each start flag bumps the counter, so every row of a streak gets the same number: the LAG-based alternative to date − rn.`},
    {lv:'adv', title:'Longest streak per customer', sql:`WITH g AS (
  SELECT customer_id, login_date,
         date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY login_date) || ' days') AS grp
  FROM logins
),
streaks AS (
  SELECT customer_id, COUNT(*) AS len FROM g GROUP BY customer_id, grp
)
SELECT c.name, MAX(s.len) AS longest_streak
FROM streaks s JOIN customers c ON c.id = s.customer_id
GROUP BY c.id, c.name
ORDER BY longest_streak DESC;`, why:`Islands first, then the max length per customer.`},
  ],
  tips: {
    say:`"This is gaps and islands: ROW_NUMBER per user ordered by date, subtract it from the date so each consecutive run shares a key, then GROUP BY user and key for start, end and length. For timeout-based sessions I flag starts with LAG and number them with a running SUM."`,
    points:[`Name the pattern: interviewers love hearing "gaps and islands".`,`Mention deduplicating same-day events first.`,`Offer the LAG + running-sum variant for sessions.`],
    traps:[`Self-joining day to day+1 repeatedly (doesn't find arbitrary-length streaks).`,`Forgetting PARTITION BY user.`],
    qa:[[`Users who logged in 3 consecutive days at least once?`,`Compute islands, then <code>HAVING COUNT(*) &gt;= 3</code>, or check <code>LAG(date, 2)</code> = date − 2 days.`],
        [`Find missing invoice numbers.`,`Gaps: <code>SELECT n + 1 AS gap_start, next_n - 1 AS gap_end FROM (SELECT n, LEAD(n) OVER (ORDER BY n) next_n FROM invoices) t WHERE next_n - n &gt; 1;</code>`],
        [`How do you sessionize clickstream with a 30-minute timeout?`,`LAG(ts) per user; start flag when ts − prev_ts &gt; 30 min or prev is NULL; session_id = running SUM(flag).`]]
  },
  exercises: [
    {lv:'E', q:`For each customer, the number of distinct login days in March 2024: <code>customer_id, days</code>.`, hint:`A warm-up: COUNT(DISTINCT login_date).`,
     sql:`SELECT customer_id, COUNT(DISTINCT login_date) AS days FROM logins
WHERE login_date LIKE '2024-03%' GROUP BY customer_id;`},
    {lv:'M', q:`All streaks of length 2 or more: <code>customer_id, start_day, end_day, len</code>.`, hint:`The date − rn key, GROUP BY customer_id, key, HAVING COUNT(*) &gt;= 2.`,
     sql:`WITH g AS (
  SELECT customer_id, login_date,
         date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY login_date) || ' days') AS grp
  FROM logins
)
SELECT customer_id, MIN(login_date) AS start_day, MAX(login_date) AS end_day, COUNT(*) AS len
FROM g GROUP BY customer_id, grp HAVING COUNT(*) >= 2;`},
    {lv:'H', q:`Gaps in order ids: find ranges of missing ids between the smallest and largest order id after deleting orders 103, 104 and 108 (and their items). Return <code>gap_start, gap_end</code>.`, hint:`Delete first (items, then orders), then LEAD(id) OVER (ORDER BY id) and keep rows where next − id &gt; 1.`,
     sql:`DELETE FROM order_items WHERE order_id IN (103, 104, 108);
DELETE FROM orders WHERE id IN (103, 104, 108);
SELECT id + 1 AS gap_start, next_id - 1 AS gap_end
FROM (SELECT id, LEAD(id) OVER (ORDER BY id) AS next_id FROM orders) t
WHERE next_id - id > 1;`},
  ],
  quiz: [
    [`In gaps-and-islands, an "island" is…`,[`A missing range`,`A maximal run of consecutive values`,`A partition`,`A NULL group`],1,`Gaps are the missing ranges.`,'E'],
    [`Why does date − ROW_NUMBER() identify a streak?`,[`It's always unique`,`Within a consecutive run both increase by 1 per row, so the difference is constant`,`It sorts dates`,`It removes gaps`],1,`A gap changes the difference.`,'M'],
    [`Logins on days 1, 2, 4. date − rn gives…`,[`0, 0, 1`,`0, 0, 0`,`1, 2, 4`,`0, 1, 2`],0,`1−1, 2−2, 4−3.`,'M'],
    [`Two logins on the same day break the trick because…`,[`ROW_NUMBER increases while the date doesn't`,`Dates can't repeat`,`GROUP BY fails`,`LAG returns NULL`],0,`Deduplicate days first or use DENSE_RANK.`,'H'],
    [`To find missing ids, compare each id with…`,[`LAG(id) or LEAD(id)`,`MAX(id)`,`COUNT(*)`,`RANK()`],0,`A jump > 1 is a gap.`,'E'],
    [`Sessionizing clicks with a 30-minute timeout uses…`,[`date − ROW_NUMBER()`,`LAG to flag new sessions + running SUM`,`NTILE(30)`,`GROUP BY minute`],1,`Time gaps aren't uniform steps.`,'M'],
  ],
  quizAdv: [
    [`Using DENSE_RANK instead of ROW_NUMBER in the difference trick with duplicate days…`,[`Breaks it`,`Keeps duplicates in the same island (same rank for the same day)`,`Creates gaps`,`Is equivalent to LAG`],1,`Same date → same rank → same key.`,'H'],
    [`Complexity of the window-based islands query on n rows (with sorting)?`,[`O(n²)`,`O(n log n) for the sort, then linear`,`O(n³)`,`O(1)`],1,`One sort per partition.`,'H'],
    [`Integer sequence 5, 6, 7, 10, 11: value − rn gives…`,[`4,4,4,6,6`,`5,5,5,7,7`,`0,0,0,3,3`,`4,4,4,7,7`],0,`5−1, 6−2, 7−3, 10−4, 11−5.`,'M'],
  ],
});
