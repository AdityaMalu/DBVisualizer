/* 2.3 Window functions: running totals, LAG/LEAD, frames */
topic('2', { no:'2.3', title:'Window functions II: running totals, moving averages, LAG / LEAD, frames', db:'shop',
idea:`Add ORDER BY to a window and aggregates become cumulative. Watch the frame slide row by row for a running total and a 3-row moving average, then use LAG and LEAD to compare each row with its neighbours (month-over-month growth).`,
tbTitle:'Monthly revenue', stateTitle:'Frame',
codes:{a:`WITH monthly AS (
  SELECT substr(o.order_date,1,7) AS month, SUM(oi.qty*oi.unit_price) AS revenue
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status <> 'cancelled' GROUP BY month
)
SELECT month, revenue,
  SUM(revenue) OVER (ORDER BY month)                           AS running_total,
  AVG(revenue) OVER (ORDER BY month
                     ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3,
  LAG(revenue)  OVER (ORDER BY month)                          AS prev_month,
  revenue - LAG(revenue) OVER (ORDER BY month)                 AS change,
  LEAD(revenue) OVER (ORDER BY month)                          AS next_month
FROM monthly;`},
steps:[
{hl:{q:[1,2,3,4,5]}, tb:[TB('monthly',['month','revenue'],[['2024-01',1765],['2024-02',610],['2024-03',1740],['2024-04',1300]])],
 say:`First a CTE computes revenue per month (cancelled orders excluded). Four rows. Now we'll add columns that look at <i>other</i> rows: the running total so far, a moving average, and the previous month's value.`},
{hl:{q:[7]}, tb:[TB('running total',['month','revenue','running_total'],[['2024-01',1765,1765],['2024-02',610,2375],['2024-03',1740,4115],['2024-04',1300,5415]],{2:'hot'})], g:[G('SUM(revenue) OVER (ORDER BY month)',['frame for 2024-03','2024-01 … 2024-03','hot'],['default frame with ORDER BY','RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW'])],
 say:`With <code>ORDER BY</code> inside OVER, an aggregate becomes <b>cumulative</b>. The <b>frame</b>, the rows the function sees, defaults to "from the first row up to the current row". For March: 1765 + 610 + 1740 = 4115. That's a <b>running total</b>, impossible with plain GROUP BY.`},
{hl:{q:[8,9]}, tb:[TB('3-month moving average',['month','revenue','moving_avg_3'],[['2024-01',1765,1765],['2024-02',610,1187.5],['2024-03',1740,1371.67],['2024-04',1300,1216.67]],{3:'hot'})], g:[G('ROWS BETWEEN 2 PRECEDING AND CURRENT ROW',['April frame','Feb, Mar, Apr','hot'],['(610+1740+1300)/3','1216.67'],['first rows','smaller frames (1 or 2 rows)'])],
 say:`An explicit frame: <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code> is a window of at most 3 rows that slides down the table, a <b>moving average</b>. Early rows have shorter frames, so January's "average" is just itself. Frames can also look forward (<code>1 FOLLOWING</code>) or span everything (<code>UNBOUNDED</code>).`},
{hl:{q:[10,11]}, tb:[TB('LAG',['month','revenue','prev_month','change'],[['2024-01',1765,null,null],['2024-02',610,1765,-1155],['2024-03',1740,610,1130],['2024-04',1300,1740,-440]],{0:'dim'})], g:[G('LAG(x, n, default)',['previous row\'s value (n back, default 1)','hot'],['first row','NULL (or the default you pass)'])],
 say:`<b>LAG(revenue)</b> fetches the value from the <i>previous</i> row in the window order, so <code>revenue - LAG(revenue)</code> is the month-over-month change. The first row has no predecessor and gets NULL; pass a default like <code>LAG(revenue, 1, 0)</code> if you prefer.`},
{hl:{q:[12]}, tb:[TB('LEAD',['month','revenue','next_month'],[['2024-01',1765,610],['2024-02',610,1740],['2024-03',1740,1300],['2024-04',1300,null]],{3:'dim'})], g:[G('LEAD',['next row\'s value'],['use','time to next event, churn detection'])],
 say:`<b>LEAD</b> looks forward: the next row's value. Classic uses: time between a user's consecutive events, "did they come back?", session boundaries. Add <code>PARTITION BY user_id</code> to keep each user's timeline separate.`},
{hl:{}, tb:[], g:[G('Frames',['ROWS','counts physical rows'],['RANGE','counts by value (ties are peers)','hot'],['default with ORDER BY','RANGE UNBOUNDED PRECEDING → CURRENT ROW'],['gotcha','ties in ORDER BY get the same running total with RANGE','bad']), G('Also',['FIRST_VALUE / LAST_VALUE','first/last in frame'],['NTH_VALUE','n-th in frame'])],
 say:`<b>Say it:</b> "With ORDER BY in the OVER clause, aggregates become cumulative over a frame, by default from the start of the partition to the current row, which gives running totals. ROWS BETWEEN n PRECEDING AND CURRENT ROW gives moving averages. LAG and LEAD read the previous or next row, so period-over-period changes need no self-join." Gotcha: the default frame is RANGE, so rows with equal ORDER BY values share a running total; use ROWS or add a tiebreaker. LAST_VALUE needs an explicit frame to see past the current row.`}
],
keep:[`ORDER BY inside OVER → cumulative aggregate (running total).`,`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW → 3-row moving window.`,`LAG = previous row, LEAD = next row; NULL at the edges unless a default is given.`,`Default frame is RANGE (ties are peers). LAST_VALUE needs ROWS BETWEEN … UNBOUNDED FOLLOWING.`]}, {
  imp: 'must',
  theory: TH(`With ORDER BY and a frame, window functions compute cumulative and sliding values, and LAG/LEAD read neighbouring rows.`,
`<p>Many business questions are about sequences: "revenue so far this year", "7-day average signups", "change since last month", "time since the previous login". Each needs a row to look at other rows that come before or after it.</p>
<p>Picture reading a bank statement with a ruler: the running balance is everything above the ruler; a moving average is a small window you slide down; LAG is glancing at the line just above.</p>`,
[[`Frame`,`The subset of the partition the function sees for the current row.`],[`ROWS`,`Frame measured in physical rows.`],[`RANGE`,`Frame measured by ORDER BY value; equal values are peers.`],[`UNBOUNDED PRECEDING / FOLLOWING`,`From the partition start / to its end.`],[`LAG / LEAD`,`Value from n rows before / after.`],[`FIRST_VALUE / LAST_VALUE`,`First / last value in the frame.`]],
[`Partition and sort the rows.`,`For each row, determine its frame from the frame clause.`,`Compute the aggregate over the frame (engines do this incrementally as the frame slides).`,`LAG/LEAD simply read by offset within the partition.`],
[`Finance: running balances, cumulative revenue.`,`Product analytics: 7-day moving averages, retention, time between events.`,`Ops: detecting spikes by comparing to the previous period.`],
[`Forgetting PARTITION BY user_id, so LAG reads another user's row.`,`Assuming the default frame is ROWS (it's RANGE: ties share values).`,`LAST_VALUE returning the current row because the default frame ends at CURRENT ROW.`]),
  examples: [
    {lv:'basic', title:'Running total of order lines for one order', sql:`SELECT order_id, product_id, qty * unit_price AS amount,
       SUM(qty * unit_price) OVER (PARTITION BY order_id ORDER BY product_id) AS running
FROM order_items
WHERE order_id IN (101, 106, 110);`, why:`PARTITION BY restarts the total for each order.`},
    {lv:'mid', title:'Days since previous login, per customer', sql:`SELECT customer_id, login_date,
       LAG(login_date) OVER (PARTITION BY customer_id ORDER BY login_date) AS prev_login,
       julianday(login_date)
         - julianday(LAG(login_date) OVER (PARTITION BY customer_id ORDER BY login_date)) AS gap_days
FROM logins
ORDER BY customer_id, login_date;`, why:`LAG within each customer's own timeline; the first login per customer has no gap.`},
    {lv:'adv', title:'Each order\'s share of its customer\'s spend, and the customer\'s first order', sql:`WITH order_totals AS (
  SELECT o.id, o.customer_id, o.order_date, SUM(oi.qty * oi.unit_price) AS total
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY o.id
)
SELECT customer_id, id, order_date, total,
       ROUND(100.0 * total / SUM(total) OVER (PARTITION BY customer_id), 1) AS pct_of_customer,
       FIRST_VALUE(id) OVER (PARTITION BY customer_id ORDER BY order_date) AS first_order
FROM order_totals
ORDER BY customer_id, order_date;`, why:`A whole-partition SUM (no ORDER BY, so no frame) next to each row gives percentages; FIRST_VALUE finds the first order in date order.`},
  ],
  tips: {
    say:`"With ORDER BY inside OVER, aggregates become running totals over a frame; ROWS BETWEEN n PRECEDING AND CURRENT ROW gives moving averages; LAG and LEAD read the previous and next rows, so month-over-month change is revenue − LAG(revenue). I always PARTITION BY the entity so timelines don't bleed into each other."`,
    points:[`Know the default frame and the RANGE vs ROWS difference.`,`Use LAG for period-over-period and LEAD for "time to next event".`,`Mention the LAST_VALUE frame gotcha.`],
    traps:[`Self-joining a table to its previous row when LAG does it in one pass.`,`Missing PARTITION BY in per-user calculations.`],
    qa:[[`Month-over-month growth %?`,`<code>100.0 * (rev - LAG(rev) OVER (ORDER BY m)) / LAG(rev) OVER (ORDER BY m)</code>, guarding against division by zero with NULLIF.`],
        [`Running total that resets each year?`,`<code>SUM(x) OVER (PARTITION BY year ORDER BY date)</code>.`],
        [`Why does LAST_VALUE(x) OVER (ORDER BY d) return the current row's x?`,`The default frame ends at CURRENT ROW. Use ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.`]]
  },
  exercises: [
    {lv:'E', q:`Running count of customers by join date: <code>name, joined, members_so_far</code>.`, hint:`COUNT(*) OVER (ORDER BY joined).`,
     sql:`SELECT name, joined, COUNT(*) OVER (ORDER BY joined) AS members_so_far FROM customers;`},
    {lv:'M', q:`For each of customer 1's orders (any status), show <code>id, order_date, prev_date</code> where prev_date is the date of their previous order.`, hint:`LAG(order_date) OVER (ORDER BY order_date) with WHERE customer_id = 1.`,
     sql:`SELECT id, order_date, LAG(order_date) OVER (ORDER BY order_date) AS prev_date
FROM orders WHERE customer_id = 1;`},
    {lv:'H', q:`Daily login counts with a 2-day moving sum (today + yesterday's row): <code>login_date, logins, two_day</code> ordered by date.`, hint:`Aggregate per day in a CTE, then SUM(logins) OVER (ORDER BY login_date ROWS BETWEEN 1 PRECEDING AND CURRENT ROW).`, ordered:true,
     sql:`WITH daily AS (SELECT login_date, COUNT(*) AS logins FROM logins GROUP BY login_date)
SELECT login_date, logins,
       SUM(logins) OVER (ORDER BY login_date ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS two_day
FROM daily ORDER BY login_date;`},
  ],
  quiz: [
    [`SUM(x) OVER (ORDER BY d) computes…`,[`The grand total on every row`,`A running total up to the current row`,`A moving average`,`The previous row's x`],1,`ORDER BY makes it cumulative.`,'E'],
    [`LAG(x) on the first row of a partition returns…`,[`0`,`NULL (unless a default is given)`,`The last row's x`,`An error`],1,`No previous row.`,'E'],
    [`A 7-day moving average over daily rows uses…`,[`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`,`ROWS BETWEEN 7 PRECEDING AND 7 FOLLOWING`,`RANGE UNBOUNDED`,`PARTITION BY 7`],0,`Current + 6 previous = 7 rows.`,'M'],
    [`LEAD(x) returns…`,[`The previous row's x`,`The next row's x`,`The first value`,`The max`],1,`Looks forward.`,'E'],
    [`Per-user time between events requires…`,[`PARTITION BY user_id ORDER BY ts`,`GROUP BY user_id`,`ORDER BY user_id only`,`DISTINCT user_id`],0,`Otherwise LAG crosses users.`,'M'],
    [`SUM(x) OVER (PARTITION BY g) with no ORDER BY gives…`,[`A running total`,`The group total on every row of the group`,`An error`,`x itself`],1,`Frame = whole partition.`,'M'],
  ],
  quizAdv: [
    [`Default frame when ORDER BY is present in OVER?`,[`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`,`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`,`The whole partition`,`Only the current row`],1,`RANGE: rows with equal sort keys are peers and share the value.`,'H'],
    [`Two rows share date d. Running SUM with default RANGE frame shows…`,[`Different values for each`,`The same value (both peers included)`,`NULL for the second`,`An error`],1,`Use ROWS or a tiebreaker for distinct running values.`,'H'],
    [`LAST_VALUE(x) OVER (ORDER BY d) usually returns the current row's x because…`,[`It's buggy`,`The default frame ends at the current row`,`It ignores ORDER BY`,`It requires PARTITION BY`],1,`Extend the frame to UNBOUNDED FOLLOWING.`,'H'],
  ],
});
