# DB Concepts Stepper

Step-by-step visual walkthroughs of database concepts, from SQL basics to distributed systems. Each step highlights the query, shows the tables, sessions, locks or diagrams it changes, and explains what's happening. Every topic also has theory, examples that build from simple to complex, interview tips, exercises you can run, and a quiz.

| Part | Topics |
|---|---|
| 0. Foundations | what a DBMS gives you, the relational model, NULL and three-valued logic, constraints, SQL sublanguages and data types |
| 1. SQL querying | SELECT/WHERE/ORDER BY/LIMIT, logical order of execution, joins, self/semi/anti joins, GROUP BY/HAVING, subqueries, set operations, INSERT/UPDATE/DELETE/UPSERT, CASE and pivots |
| 2. Advanced SQL | CTEs and recursive queries, window functions (ranking, running totals, LAG/LEAD, frames), classic interview problems, gaps and islands, views and materialized views, procedures/functions/triggers |
| 3. Data modeling and normalization | ER modeling and cardinality, keys, functional dependencies and anomalies, 1NF–3NF, BCNF/4NF, denormalization and star schemas, modeling patterns (soft delete, history, polymorphism, EAV, JSON) |
| 4. Storage and indexing | pages and the buffer pool, B+ trees, clustered/covering indexes, composite indexes, sargability, hash/bitmap/GIN/BRIN/partial indexes, LSM trees |
| 5. Query processing and optimization | life of a query, reading EXPLAIN, join algorithms, the cost-based optimizer and statistics, N+1 and keyset pagination |
| 6. Transactions and concurrency | ACID, isolation levels and anomalies, locking and 2PL, deadlocks, MVCC, optimistic vs pessimistic locking, write skew and SERIALIZABLE |
| 7. Recovery and durability | WAL, checkpoints and crash recovery, backups, PITR, RPO/RTO |
| 8. Scaling and distributed databases | replication, replication lag and consistency models, partitioning and sharding, consistent hashing, CAP/PACELC, 2PC/sagas/outbox, Raft, quorums, connection pooling, caching |
| 9. NoSQL and specialised stores | SQL vs NoSQL, Redis, document databases, Cassandra, graph databases, full-text search, column stores and time-series databases |
| 10. Real-world scenarios | designing an e-commerce schema, debugging a slow query, hot rows and flash sales, zero-downtime migrations, idempotency and double charges |

That's 71 topics. Every topic page has these sections, in this order:

1. **Theory: start here**: the idea in one sentence, a plain-language explanation with an analogy, key terms, how it works, how it shows up in real projects, and common mistakes.
2. **Visual walkthrough**: step through it (← → keys, or Play). It highlights the code and shows tables, sessions/transactions, diagrams (B+ trees, hash rings, replication, wait-for graphs, …) and key facts.
3. **Examples: simple → complex**: at least three per topic, tagged Basic, Intermediate or Advanced. You can edit and run them against a real SQLite database in your browser.
4. **Interview tips**: a 30-second answer, what interviewers listen for, traps and red flags, and likely follow-up questions with answers that stay hidden until you open them.
5. **Exercises**: at least three per topic. SQL exercises are **checked automatically**: your query's result is compared with the reference solution, and you're told why it doesn't match (wrong number of columns or rows, wrong order, different values). Design exercises come with a model answer. Hints and solutions stay hidden until you ask for them. The site remembers which exercises you've finished.
6. **Quiz**: each try draws questions from a hidden bank for the topic (Core and Advanced sets, levels Easy/Medium/Hard), with the answer order shuffled. Your best scores are kept in the browser.

In total: 214 examples, 223 exercises and 642 quiz questions. Every topic is tagged must-know, good to know, or beyond interviews; the **Interview focus** filter shows only the topics you need.

Examples and exercises run against four small datasets: `shop` (customers, products, orders, order items, logins), `hr` (departments, employees with managers), `bank` (accounts, transfers) and `school` (students, courses, enrollments). There's also `flat`, a denormalized spreadsheet used for the normalization topics. You can view each dataset's schema and peek at its tables from the page.

## Development

```
src/
  index.html                 page shell; the build inlines styles and scripts here
  styles/                    tokens, layout, theory, stepper, study, quiz, responsive
  engine/                    registry, model, dom, diagrams, focus, sidebar, theory, quiz,
                             sqlrun (SQLite runner), study (examples/tips/exercises), stepper, main
  content/
    parts.js                 part numbers and titles
    datasets.js              the SQLite datasets
    part-06-transactions-and-concurrency/
      6.4-deadlocks.js       one file per topic
scripts/
  build.mjs                  bundles src/ into dist/index.html and copies sql.js to dist/vendor/
  check-content.mjs          validates every topic and runs all example/exercise SQL in SQLite
tests/site.spec.js           Playwright end-to-end tests (desktop and mobile)
```

Each topic file holds everything about that topic:

```js
topic('6', { no:'6.4', title:'…', idea:`…`, db:'bank', codes:{a:`…`}, steps:[…], keep:[…] }, {
  imp: 'must',                                   // must | good | extra
  theory:    TH(one, intro, terms, steps, practice, mistakes),
  examples:  [ {lv:'basic'|'mid'|'adv', title, sql, why, db?, run?, err?}, … ],  // ≥ 3, simple → complex
  tips:      { say, points:[…], traps:[…], qa:[[question, answer], …] },
  exercises: [ {lv:'E'|'M'|'H', q, hint, sql?, ordered?, answer?}, … ],          // ≥ 3
  quiz:      [ [question, [a, b, c, d], answerIndex, why, 'E'|'M'|'H'], … ],    // ≥ 3
  quizAdv:   [ … ],                                                             // ≥ 2
});
```

To add a topic, create `src/content/part-NN-…/<no>-<slug>.js`. The build finds it and orders topics by number.

`npm run check` validates structure, highlighted line numbers, quiz banks and study material. It also runs every example and every exercise solution against its dataset in SQLite. Examples marked `err:true` must fail, and exercise solutions must return rows so that answers can be auto-checked.

```sh
npm ci                     # once
npm run dev                # rebuild dist/ on every change; open dist/index.html
npm run check              # validate content and run all SQL
npm test                   # check + build + end-to-end tests
```

The SQL runner is [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly). It loads from `dist/vendor/` the first time you run a query, so the page stays light until then and works offline. GitHub Actions runs the checks, the build and the end-to-end tests on every push and pull request. Pushes to `main` deploy `dist/` to GitHub Pages.
