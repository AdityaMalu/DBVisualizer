/* 9.6 Full-text search: inverted index, analysis, relevance */
topic('9', { no:'9.6', title:'Full-text search: analyzers, inverted index, relevance (BM25), Elasticsearch', db:'shop',
idea:`Why LIKE '%laptop%' doesn't scale or rank. Run three product descriptions through an analyzer (tokenize, lowercase, stem), build an inverted index of term → documents, answer a query by intersecting posting lists, and rank results with TF-IDF/BM25.`,
stateTitle:'Search pipeline', tbTitle:'Index',
codes:{a:`-- naive: scans every row, no ranking, no stemming
SELECT * FROM products WHERE description LIKE '%laptops%';

-- 1. analyze text: tokenize → lowercase → remove stop words → stem
"Fast Laptops for the Office" → [fast, laptop, office]

-- 2. inverted index: term → posting list (doc ids, positions)
fast   → [d1, d3]        laptop → [d1, d2]        office → [d1]

-- 3. query "fast laptop": look up both lists, merge, score
-- 4. rank by BM25: term frequency × inverse document frequency, length-normalized

-- Postgres: to_tsvector / to_tsquery + GIN index
SELECT title FROM docs WHERE tsv @@ to_tsquery('english', 'fast & laptop')
ORDER BY ts_rank(tsv, to_tsquery('english', 'fast & laptop')) DESC;
-- Elasticsearch: GET /products/_search { "query": { "match": { "description": "fast laptop" } } }`},
steps:[
{hl:{q:[1,2]}, tb:[TB('products.description',['id','description'],[['d1','Fast laptops for the office'],['d2','Gaming laptop with fast GPU and fast SSD'],['d3','Fast charging phone']])], g:[G('LIKE \'%…%\'',['index use','none (leading wildcard, 4.5)','bad'],['"laptops" vs "laptop"','misses plural forms','bad'],['ranking','none: every match is equal','bad'],['typos, synonyms','no','bad'])],
 say:`Search with <code>LIKE '%laptops%'</code> scans every row (no index can serve a leading wildcard), misses "laptop" when you typed "laptops", can't handle typos or synonyms, and returns matches in no meaningful order. Full-text search fixes all four with two ideas: <b>text analysis</b> and an <b>inverted index</b>, plus <b>relevance scoring</b>.`},
{hl:{q:[4,5]}, tb:[TB('analysis',['doc','raw','terms'],[['d1','Fast laptops for the office','fast, laptop, office'],['d2','Gaming laptop with fast GPU and fast SSD','game, laptop, fast, gpu, fast, ssd'],['d3','Fast charging phone','fast, charg, phone']])], g:[G('Analyzer',['tokenize','split into words'],['lowercase','Fast → fast'],['stop words','drop "for", "the", "with"'],['stemming','laptops → laptop, gaming → game','hot'],['same analyzer','applied to the query too'])],
 say:`An <b>analyzer</b> turns text into normalized <b>terms</b>: split into tokens, lowercase, drop stop words ("the", "for"), and <b>stem</b> words to their root (laptops → laptop, gaming → game). The <i>same</i> analyzer runs on the query, so "Laptops" in the query matches "laptop" in a document.`},
{hl:{q:[7,8]}, tb:[TB('inverted index',['term','posting list (doc: count)'],[['fast','d1:1, d2:2, d3:1'],['laptop','d1:1, d2:1'],['office','d1:1'],['game','d2:1'],['gpu','d2:1'],['phone','d3:1']],{0:'hot',1:'hot'})], g:[G('Inverted index',['maps','term → documents containing it (+ counts, positions)','hot'],['like','the index at the back of a book'],['lookup','O(1)-ish per term, no scan','ok'],['positions','enable phrase queries "fast laptop"'])],
 say:`The <b>inverted index</b> maps each term to its <b>posting list</b>: the documents containing it, how often, and at which positions. It's the index at the back of a book. Finding documents with "laptop" is a single lookup, no scan. Positions let you match exact phrases. This is the same structure as Postgres GIN (4.6).`},
{hl:{q:[10]}, tb:[TB('query "fast laptop"',['term','postings'],[['fast','d1, d2, d3'],['laptop','d1, d2'],['AND (intersection)','d1, d2']],{2:'ok'})], g:[G('Query',['analyze the query','[fast, laptop]'],['AND','intersect posting lists (sorted → merge, fast)'],['OR','union, rank by score'],['candidates','d1, d2'])],
 say:`A query is analyzed into terms, each term's posting list is fetched, and lists are combined: intersection for AND (posting lists are sorted, so this is a fast merge, 5.3), union for OR. "fast laptop" with AND gives d1 and d2. Now which comes first?`},
{hl:{q:[11]}, tb:[TB('relevance',['doc','tf(fast)','tf(laptop)','length','score (BM25-ish)'],[['d2','2','1','6 terms','higher'],['d1','1','1','3 terms','high'],['d3','1','0','3 terms','low (OR only)']],{0:'ok',1:'ok'})], g:[G('Scoring',['TF','more occurrences in a doc → more relevant (with saturation)'],['IDF','rarer terms matter more: "laptop" > "fast"','hot'],['length norm','matches in short docs count more'],['BM25','the standard formula (Lucene/Elasticsearch default)'])],
 say:`<b>Relevance</b>: classic TF-IDF/<b>BM25</b> scores a document higher when query terms appear often in it (term frequency, with diminishing returns), when the terms are rare across all documents (inverse document frequency: "laptop" is more informative than "fast", which is everywhere), and adjusts for document length. Real engines add boosts (title over body), freshness and popularity.`},
{hl:{q:[13,14,15,16]}, g:[G('Where to run search',['Postgres tsvector + GIN','good for moderate needs, transactional','ok'],['Elasticsearch / OpenSearch / Solr','scale, analyzers, fuzzy, facets, aggregations','ok'],['sync','DB is source of truth → index via CDC/outbox (8.6)'],['eventual','index lags writes by ~1 s (refresh interval)'])],
 say:`Postgres has built-in full-text search (<code>to_tsvector</code>, <code>@@</code>, GIN indexes, ts_rank), great when search is a feature, not the product. Dedicated engines (Elasticsearch/OpenSearch, Solr, built on Lucene) add rich analyzers, fuzzy matching, synonyms, facets and horizontal scaling. They're usually fed from the database via CDC or an outbox and are <b>near-real-time</b>, not transactional.`},
{hl:{}, g:[G('Remember',['analyze','tokenize, normalize, stem; same for query'],['index','term → postings'],['retrieve','merge posting lists'],['rank','BM25 + business signals'])],
 say:`<b>Say it:</b> "Full-text search analyzes text into normalized terms (tokenizing, lowercasing, removing stop words, stemming), builds an inverted index from each term to the documents containing it, answers queries by merging posting lists, and ranks with BM25, which rewards frequent and rare terms in shorter documents. I'd use Postgres full-text for simple needs and Elasticsearch fed by CDC when search quality and scale matter."`}
],
keep:[`LIKE '%x%': scan, no stemming, no ranking.`,`Analyzer: tokenize → lowercase → stop words → stem (same on query).`,`Inverted index: term → posting list (docs, counts, positions).`,`AND = intersect lists, OR = union; rank with BM25 (TF, IDF, length).`,`Postgres tsvector+GIN vs Elasticsearch (fed by CDC, near-real-time).`]}, {
  imp: 'good',
  theory: TH(`Full-text search breaks text into normalized terms, stores an inverted index from each term to the documents containing it, and ranks matches by relevance.`,
`<p>A book's index lists important words with the pages where they appear; you don't read the whole book to find "photosynthesis". Search engines build exactly that for all documents, after normalizing words so "Running", "runs" and "ran" can match "run".</p>
<p>Finding matches is only half of search; ordering them is the other half. Relevance scoring rewards documents where the query words appear often and are distinctive.</p>`,
[[`Analyzer`,`Pipeline turning text into terms.`],[`Token / term`,`A normalized word.`],[`Stemming / lemmatization`,`Reducing words to a root form.`],[`Stop words`,`Very common words dropped from the index.`],[`Inverted index`,`Term → posting list.`],[`Posting list`,`Documents (and positions) containing a term.`],[`TF-IDF / BM25`,`Relevance scoring formulas.`],[`Near-real-time`,`Newly indexed docs searchable after a short refresh.`]],
[`Analyze each document into terms; add them to posting lists.`,`Analyze the query the same way.`,`Fetch and merge posting lists for the query terms.`,`Score candidates and return the top N.`],
[`Product search, log search (Kibana), site search, autocomplete.`,`Postgres FTS for in-app search on modest data.`,`Keeping Elasticsearch in sync via CDC; reindexing on mapping changes.`],
[`LIKE '%term%' on large tables.`,`Different analyzers at index and query time.`,`Treating the search index as the source of truth.`,`Ignoring language-specific stemming.`]),
  examples: [
    {lv:'basic', title:'The naive way', sql:`SELECT name FROM products WHERE lower(name) LIKE '%book%';`, why:`Finds Novel? No. Cookbook? Yes. It scans every row and can't rank: fine for 8 rows, not for 8 million.`},
    {lv:'mid', title:'Build an inverted index from descriptions', sql:`CREATE TABLE docs (id TEXT, body TEXT);
INSERT INTO docs VALUES ('d1','fast laptop office'), ('d2','game laptop fast gpu fast ssd'), ('d3','fast charg phone');
CREATE TABLE postings AS
WITH RECURSIVE split(id, term, rest) AS (
  SELECT id, '', body || ' ' FROM docs
  UNION ALL
  SELECT id, substr(rest, 1, instr(rest, ' ') - 1), substr(rest, instr(rest, ' ') + 1) FROM split WHERE rest <> ''
)
SELECT term, id, COUNT(*) AS tf FROM split WHERE term <> '' GROUP BY term, id;
SELECT term, GROUP_CONCAT(id || ':' || tf, ', ') AS posting_list FROM postings GROUP BY term ORDER BY term;`, why:`Already-analyzed terms (lowercased, stemmed) are split and grouped into term → (doc, term frequency) posting lists.`},
    {lv:'adv', title:'Rank "fast laptop" with TF-IDF', sql:`CREATE TABLE docs (id TEXT, body TEXT);
INSERT INTO docs VALUES ('d1','fast laptop office'), ('d2','game laptop fast gpu fast ssd'), ('d3','fast charg phone');
CREATE TABLE postings AS
WITH RECURSIVE split(id, term, rest) AS (
  SELECT id, '', body || ' ' FROM docs
  UNION ALL
  SELECT id, substr(rest, 1, instr(rest, ' ') - 1), substr(rest, instr(rest, ' ') + 1) FROM split WHERE rest <> ''
)
SELECT term, id, COUNT(*) AS tf FROM split WHERE term <> '' GROUP BY term, id;
WITH idf AS (
  SELECT term, 1.0 * (SELECT COUNT(*) FROM docs) / COUNT(*) AS idf      -- N / df (real IDF takes a log)
  FROM postings GROUP BY term
)
SELECT p.id, ROUND(SUM(p.tf * i.idf), 3) AS score, COUNT(*) AS terms_matched
FROM postings p JOIN idf i ON i.term = p.term
WHERE p.term IN ('fast', 'laptop')
GROUP BY p.id
ORDER BY terms_matched DESC, score DESC;`, why:`"laptop" (in 2 of 3 docs) gets a higher weight (1.5) than "fast" (in all 3, weight 1). d2 ranks first (fast twice + laptop), then d1; d3 only matches "fast". BM25 adds TF saturation and length normalization on top.`},
  ],
  tips: {
    say:`"Full-text search runs text through an analyzer (tokenize, lowercase, stop words, stem), stores an inverted index from term to posting lists, answers queries by merging posting lists, and ranks with BM25: frequent, rare terms in shorter docs score higher. For simple in-app search I use Postgres tsvector with a GIN index; for heavy search I use Elasticsearch fed by CDC, accepting near-real-time freshness."`,
    points:[`Explain why LIKE fails (scan, no stemming, no ranking).`,`Describe the inverted index and posting-list intersection.`,`Explain IDF intuition.`],
    traps:[`Making Elasticsearch the system of record.`,`Forgetting the query must use the same analyzer.`],
    qa:[[`How does Elasticsearch stay in sync with Postgres?`,`CDC (Debezium) or an outbox stream into an indexing service; periodic full reindex to repair drift; reads accept ~1 s refresh lag.`],
        [`What is IDF?`,`Inverse document frequency: log(N / docs containing the term). Rare terms discriminate better, so they get more weight.`],
        [`How do you support typos?`,`Fuzzy queries (edit distance), n-gram/trigram analyzers, or spelling suggestions; Postgres pg_trgm similarity.`]]
  },
  exercises: [
    {lv:'E', q:`Find products whose name contains "o" case-insensitively, the naive way: <code>name</code>.`, hint:`lower(name) LIKE '%o%'.`,
     sql:`SELECT name FROM products WHERE lower(name) LIKE '%o%';`},
    {lv:'M', q:`Build the postings table for docs d1–d3 (as in example 2) and return the documents matching <b>both</b> "fast" and "laptop": <code>id</code>.`, hint:`GROUP BY id HAVING COUNT(DISTINCT term) = 2 over postings filtered to the two terms.`,
     sql:`CREATE TABLE docs (id TEXT, body TEXT);
INSERT INTO docs VALUES ('d1','fast laptop office'), ('d2','game laptop fast gpu fast ssd'), ('d3','fast charg phone');
CREATE TABLE postings AS
WITH RECURSIVE split(id, term, rest) AS (
  SELECT id, '', body || ' ' FROM docs
  UNION ALL
  SELECT id, substr(rest, 1, instr(rest, ' ') - 1), substr(rest, instr(rest, ' ') + 1) FROM split WHERE rest <> ''
)
SELECT term, id, COUNT(*) AS tf FROM split WHERE term <> '' GROUP BY term, id;
SELECT id FROM postings WHERE term IN ('fast', 'laptop') GROUP BY id HAVING COUNT(DISTINCT term) = 2;`},
    {lv:'H', q:`Design product search for a store with 5M products, typo tolerance, facets (brand, price range), and prices that change every minute. What goes in the DB, what in the search engine, and how do you keep them in sync?`, hint:`Source of truth, CDC, partial updates, freshness.`,
     answer:`<ul><li>Postgres is the source of truth; Elasticsearch/OpenSearch holds a denormalized search document per product (title, description, brand, category, attributes, price, stock flag).</li><li>Sync via CDC (Debezium → Kafka → indexer) with idempotent upserts by product id; nightly/weekly reindex to fix drift.</li><li>Frequently changing fields (price, stock): partial updates, or fetch live price from the DB/cache for the top results at render time.</li><li>Typos: fuzzy match / n-grams; facets: keyword fields + aggregations; ranking: BM25 + boosts (popularity, availability).</li></ul>`},
  ],
  quiz: [
    [`Why doesn't LIKE '%term%' scale?`,[`It's not SQL`,`It can't use a B-tree index (leading wildcard), so it scans; and it doesn't rank`,`It's case-sensitive`,`It returns NULL`],1,`See 4.5.`,'E'],
    [`An inverted index maps…`,[`Documents → terms`,`Terms → documents containing them`,`Rows → pages`,`Keys → values`],1,`Posting lists.`,'E'],
    [`Stemming turns "laptops" into…`,[`"LAPTOPS"`,`"laptop"`,`"lap"`,`"laptopss"`],1,`Root form.`,'E'],
    [`IDF gives more weight to…`,[`Common terms`,`Rare terms`,`Long documents`,`Stop words`],1,`Rare terms discriminate.`,'M'],
    [`An AND query across two terms is answered by…`,[`Scanning all docs`,`Intersecting their posting lists`,`Hashing documents`,`Sorting by date`],1,`Merge of sorted lists.`,'M'],
    [`Elasticsearch is usually…`,[`The system of record`,`A near-real-time search index fed from the primary database`,`Strongly consistent with the DB`,`A cache for sessions`],1,`Sync via CDC.`,'M'],
  ],
  quizAdv: [
    [`BM25 improves on raw TF-IDF mainly by…`,[`Ignoring IDF`,`Saturating term frequency and normalizing by document length`,`Using positions only`,`Random scoring`],1,`Parameters k1 and b.`,'H'],
    [`Postgres GIN on a tsvector column stores…`,[`Document → terms`,`Lexeme → list of row ids (an inverted index)`,`A B-tree on text`,`Bloom filters`],1,`Same idea as Lucene.`,'H'],
    [`Phrase queries ("fast laptop") need…`,[`Only document ids`,`Term positions in posting lists`,`Stop words`,`Stemming disabled`],1,`Check adjacency.`,'H'],
  ],
});
