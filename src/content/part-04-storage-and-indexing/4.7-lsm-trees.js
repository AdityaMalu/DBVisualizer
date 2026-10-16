/* 4.7 LSM trees */
topic('4', { no:'4.7', title:'LSM trees: memtables, SSTables, compaction (write-optimised storage)', db:'shop',
idea:`How Cassandra, RocksDB, LevelDB and ScyllaDB absorb huge write rates. Writes go to a WAL and an in-memory sorted memtable, which flushes to immutable sorted SSTable files; reads check newest to oldest, bloom filters skip files, and compaction merges files in the background.`,
dgTitle:'LSM tree', stateTitle:'Trade-off', tbTitle:'Contents',
nodes:{
  w:{x:60,y:40,label:'write',w:80,kind:'actor'},
  wal:{x:60,y:140,label:'WAL\n(append)',w:90,h:46,kind:'db'},
  mem:{x:230,y:40,label:'memtable\n(sorted, RAM)',w:150,h:46,kind:'mem'},
  s1:{x:230,y:140,label:'SSTable L0 #2\n(newest)',w:150,h:46},
  s0:{x:410,y:140,label:'SSTable L0 #1',w:140,h:46},
  l1:{x:320,y:230,label:'SSTable L1 (merged)',w:190,h:40}
},
edges:[['w','mem'],['w','wal']],
vb:'0 0 500 260',
codes:{a:`put(k=7, "Ben")     → append to WAL, insert into memtable (sorted)
put(k=3, "Asha")
put(k=7, "Ben M")   → newer version of key 7 (no in-place update)
delete(k=3)         → write a TOMBSTONE for key 3

memtable full       → flush as an immutable, sorted SSTable file (L0)

get(k=7):  memtable → newest SSTable → … → oldest  (stop at first hit)
           bloom filter per SSTable: "definitely not here" → skip file

compaction: merge-sort SSTables, keep newest version, drop tombstones
           → fewer files, less space, faster reads (costs background I/O)`},
steps:[
{hl:{q:[1,2,3]}, d:{hide:['s1','s0','l1'], on:['mem','wal'], e:[['w','mem','insert','hot'],['w','wal','append','hot']]}, tb:[TB('memtable (sorted by key)',['key','value'],[[3,'Asha'],[7,'Ben M']],{1:'new'})], g:[G('Write path',['WAL','sequential append (durability)','ok'],['memtable','in-memory sorted structure (skip list / tree)','ok'],['no read before write','updates are just new versions','ok'],['cost','~one sequential write','ok'])],
 say:`B-trees update pages <i>in place</i>, which means random I/O on every write. A <b>log-structured merge (LSM) tree</b> never updates in place. A write is appended to the <b>WAL</b> (for crash safety) and inserted into an in-memory sorted <b>memtable</b>. Writing key 7 again simply records a newer version. Writes are sequential and cheap.`},
{hl:{q:[4]}, tb:[TB('memtable',['key','value'],[[3,'⟂ tombstone'],[7,'Ben M']],{0:'bad'})], g:[G('Deletes',['tombstone','a marker meaning "deleted"','hot'],['why','older files may still hold key 3'],['removed','during compaction, after it\'s safe'])],
 say:`A <b>delete</b> can't erase the key from older immutable files, so it writes a <b>tombstone</b>: a marker that hides older versions. Lots of tombstones (e.g. queue-like workloads in Cassandra) slow reads until compaction purges them.`},
{hl:{q:[6]}, d:{hide:['s0','l1'], on:['s1'], e:[['mem','s1','flush','hot']]}, tb:[TB('SSTable L0 #2 (immutable, sorted)',['key','value'],[[3,'⟂'],[7,'Ben M']])], g:[G('Flush',['memtable full','written as one sorted file','hot'],['SSTable','Sorted String Table: immutable, sorted, with an index + bloom filter'],['I/O','one big sequential write','ok'])],
 say:`When the memtable fills, it's <b>flushed</b> to disk as an <b>SSTable</b> (sorted string table): an immutable file of sorted key/value pairs plus a sparse index and a <b>bloom filter</b>. Over time, many SSTables pile up at level 0, newest first.`},
{hl:{q:[8,9]}, d:{hide:['l1'], on:['mem','s1','s0'], e:[['mem','s1','miss','hot'],['s1','s0','bloom: no → skip','ok']]}, g:[G('Read path',['check','memtable → newest SSTable → older …'],['first hit wins','it\'s the newest version'],['bloom filter','"definitely not here" → skip the file','ok'],['worst case','key absent → check every level (bloom filters save it)','bad'])], log:['get(7): memtable miss → SSTable #2 hit "Ben M"'],
 say:`A <b>read</b> checks the memtable, then SSTables from newest to oldest, stopping at the first match (the newest version). Checking many files would be slow, so each SSTable has a <b>bloom filter</b>: a tiny probabilistic structure that answers "definitely not here" or "maybe here", letting reads skip most files. Range scans must merge results from several files.`},
{hl:{q:[11,12]}, d:{on:['l1'], e:[['s1','l1','merge','hot'],['s0','l1','merge','hot']]}, tb:[TB('SSTable L1 after compaction',['key','value'],[[7,'Ben M']],{0:'ok'})], g:[G('Compaction',['merge-sort files','keep newest version per key','ok'],['drop','overwritten versions and old tombstones','ok'],['strategies','leveled (read-optimised), size-tiered (write-optimised)'],['cost','background I/O: write amplification','bad'])],
 say:`<b>Compaction</b> runs in the background: merge-sort several SSTables into fewer, larger ones, keeping only the newest version of each key and dropping tombstones that no longer hide anything. Leveled compaction (RocksDB default) keeps reads fast; size-tiered (Cassandra default) minimises write work. The cost is <b>write amplification</b>: the same data is rewritten several times.`},
{hl:{}, d:{}, g:[G('LSM vs B-tree',['writes','LSM: sequential, very high throughput','ok'],['reads','B-tree: one tree descent; LSM: several files + bloom filters'],['space','LSM: compresses well, but old versions until compaction'],['used by','Cassandra, ScyllaDB, RocksDB, LevelDB, HBase, Bigtable, MyRocks'])],
 say:`<b>Say it:</b> "An LSM tree turns random writes into sequential ones: writes go to a WAL and an in-memory sorted memtable, which is flushed as immutable sorted SSTables; reads check memtable then SSTables newest-first, using bloom filters to skip files; background compaction merges files and drops old versions and tombstones. It trades some read and compaction cost for very high write throughput, versus a B-tree's in-place updates and predictable reads."`}
],
keep:[`Write: WAL append + memtable insert. No in-place updates; deletes = tombstones.`,`Memtable full → flush immutable sorted SSTable.`,`Read: memtable → SSTables newest-first; bloom filters skip files.`,`Compaction merges files, drops old versions; costs write amplification.`,`LSM = write-optimised (Cassandra, RocksDB); B-tree = read-optimised, in-place.`]}, {
  imp: 'good',
  theory: TH(`An LSM tree buffers writes in memory and writes them to disk as sorted, immutable files that are merged in the background, giving very high write throughput.`,
`<p>Updating a B-tree means finding the right page and rewriting it: random disk writes. An LSM tree takes the opposite approach, like an accountant who never erases a ledger: new entries are written at the end, and periodically the books are consolidated into a clean summary.</p>
<p>Writes land in memory (the memtable) and an append-only log; when memory fills, the sorted batch is written as a new file. Reads look in the newest places first. Background compaction keeps the number of files under control.</p>`,
[[`Memtable`,`In-memory sorted buffer of recent writes.`],[`SSTable`,`Immutable sorted file of key/value pairs.`],[`Tombstone`,`A deletion marker.`],[`Bloom filter`,`Probabilistic set: "definitely not" or "maybe".`],[`Compaction`,`Merging SSTables, discarding obsolete versions.`],[`Write amplification`,`Bytes written to disk per byte written by the app.`],[`Read amplification`,`Files/pages read per lookup.`]],
[`Append the write to the WAL; insert into the memtable.`,`When full, flush the memtable as a new SSTable.`,`Reads merge memtable and SSTables, newest first, using bloom filters.`,`Compaction periodically merges SSTables into larger ones.`],
[`Cassandra/ScyllaDB for write-heavy time series and event data.`,`RocksDB as the storage engine under Kafka Streams, CockroachDB, TiKV, MyRocks.`,`Tuning compaction strategy and bloom filter sizes is common operational work.`],
[`Delete-heavy workloads creating tombstone storms.`,`Ignoring compaction backlog (disk fills, reads slow down).`,`Expecting LSM reads to be as predictable as B-tree reads.`]),
  examples: [
    {lv:'basic', title:'Simulate a memtable: newest version wins', sql:`CREATE TABLE memtable (k INTEGER, v TEXT, seq INTEGER);
INSERT INTO memtable VALUES (7, 'Ben', 1), (3, 'Asha', 2), (7, 'Ben M', 3);
SELECT k, v FROM memtable m
WHERE seq = (SELECT MAX(seq) FROM memtable WHERE k = m.k)
ORDER BY k;`, why:`No in-place update: key 7 has two versions; reads take the one with the highest sequence number.`},
    {lv:'mid', title:'Read path: memtable first, then SSTables newest-first', sql:`CREATE TABLE store (k INTEGER, v TEXT, seq INTEGER, src TEXT);
INSERT INTO store VALUES
 (3, 'Asha',  1, 'sstable#1'), (7, 'Ben',   2, 'sstable#1'),
 (7, 'Ben M', 5, 'sstable#2'), (3, NULL,    6, 'memtable');   -- NULL = tombstone
SELECT k, v AS value, src AS found_in
FROM store s
WHERE seq = (SELECT MAX(seq) FROM store WHERE k = s.k)
ORDER BY k;`, why:`Key 3's newest entry is a tombstone in the memtable (value NULL = deleted); key 7 is served from the newer SSTable.`},
    {lv:'adv', title:'Compaction: merge, keep newest, drop tombstones', sql:`CREATE TABLE store (k INTEGER, v TEXT, seq INTEGER, src TEXT);
INSERT INTO store VALUES
 (3, 'Asha', 1, 'sst1'), (7, 'Ben', 2, 'sst1'), (9, 'Chen', 3, 'sst1'),
 (7, 'Ben M', 5, 'sst2'), (3, NULL, 6, 'sst2');
CREATE TABLE l1 AS
SELECT k, v, seq FROM store s
WHERE seq = (SELECT MAX(seq) FROM store WHERE k = s.k)
  AND v IS NOT NULL;                       -- tombstone + everything it hides disappear
SELECT (SELECT COUNT(*) FROM store) AS entries_before, (SELECT COUNT(*) FROM l1) AS entries_after;
SELECT * FROM l1 ORDER BY k;`, why:`5 entries across two files compact to 2 live keys. That rewrite is the write amplification LSMs pay for cheap writes.`},
  ],
  tips: {
    say:`"LSM trees make writes sequential: WAL append plus an in-memory sorted memtable, flushed as immutable sorted SSTables. Reads go memtable then SSTables newest-first with bloom filters to skip files, and background compaction merges files and drops old versions and tombstones. Great write throughput, at the cost of read and write amplification, versus B-trees which update in place."`,
    points:[`Explain tombstones and why deletes can hurt reads.`,`Mention bloom filters' "no false negatives" property.`,`Name systems that use LSMs.`],
    traps:[`Saying LSM reads are always slower (cached + bloom filters can be very fast).`,`Forgetting the WAL (memtable alone isn't durable).`],
    qa:[[`Why does Cassandra handle writes so well?`,`Writes are a commit-log append plus a memtable insert; no read-before-write or random page updates. Flushes and compactions are sequential.`],
        [`What is a bloom filter?`,`A bit array with k hash functions: answers "definitely not in the set" or "maybe in it". No false negatives, tunable false positives.`],
        [`Leveled vs size-tiered compaction?`,`Leveled: each level is non-overlapping, so a read checks ~1 file per level; more rewriting. Size-tiered: merges similar-sized files, less write amplification, more files to check and more space temporarily.`]]
  },
  exercises: [
    {lv:'E', q:`Using the memtable simulation from example 1 (create it), return the current value of every key: <code>k, v</code>.`, hint:`Keep the row with MAX(seq) per key.`,
     sql:`CREATE TABLE memtable (k INTEGER, v TEXT, seq INTEGER);
INSERT INTO memtable VALUES (7, 'Ben', 1), (3, 'Asha', 2), (7, 'Ben M', 3);
SELECT k, v FROM memtable m WHERE seq = (SELECT MAX(seq) FROM memtable WHERE k = m.k);`},
    {lv:'M', q:`A workload writes 50k events/s and reads by (device_id, time range), rarely updates, deletes after 30 days. B-tree RDBMS or LSM store? Discuss tombstones for the 30-day deletes.`, hint:`Write rate, access pattern, TTL.`,
     answer:`<p>LSM (e.g. Cassandra/ScyllaDB with partition key device_id and clustering key time) fits: sequential writes, range reads within a partition. For expiry use TTLs with time-window compaction so whole SSTables expire together instead of creating per-row tombstones that slow reads. A B-tree RDBMS could also work with time partitioning and dropping old partitions, but 50k/s sustained writes favour the LSM.</p>`},
    {lv:'H', q:`Explain read amplification in an LSM with 5 levels and why bloom filters change the cost of a lookup for a key that doesn't exist.`, hint:`Without bloom filters, how many files?`,
     answer:`<p>Without filters, a missing key needs a probe of the memtable and at least one file per level (more at L0), each possibly a disk read: ~5+ reads. Bloom filters (kept in memory) answer "definitely not here" for almost all files, so a negative lookup typically costs zero disk reads, and a positive one about one.</p>`},
  ],
  quiz: [
    [`An LSM write goes to…`,[`The right B-tree page, in place`,`A WAL append and the in-memory memtable`,`Every SSTable`,`A bloom filter only`],1,`Sequential and cheap.`,'E'],
    [`SSTables are…`,[`Mutable heap files`,`Immutable sorted files`,`In-memory only`,`Hash tables`],1,`Never modified after writing.`,'E'],
    [`A delete in an LSM tree writes…`,[`Nothing`,`A tombstone`,`Zeros over the old value`,`A new SSTable per key`],1,`Older files may hold the key.`,'E'],
    [`A bloom filter can return…`,[`False negatives`,`"Definitely not present" or "maybe present"`,`Exact counts`,`The value`],1,`No false negatives.`,'M'],
    [`Compaction…`,[`Compresses the WAL`,`Merges SSTables, keeping newest versions and dropping obsolete data`,`Deletes the memtable`,`Rebuilds B-trees`],1,`Background merge.`,'E'],
    [`LSM trees trade…`,[`Write speed for read speed`,`Some read cost and write amplification for high write throughput`,`Durability for speed`,`Nothing`],1,`Write-optimised.`,'M'],
  ],
  quizAdv: [
    [`Why can a Cassandra table used as a queue get slow?`,[`Too many columns`,`Deletes create tombstones that reads must scan past until compaction`,`No indexes`,`WAL is too big`],1,`Tombstone overload.`,'H'],
    [`Leveled compaction guarantees…`,[`No write amplification`,`SSTables within a level (L1+) don't overlap, so reads check about one file per level`,`One file total`,`No tombstones`],1,`More rewriting for better reads.`,'H'],
    [`In RocksDB, what makes point reads cheap despite many files?`,[`Hash partitioning`,`Bloom filters + block cache + leveled layout`,`In-place updates`,`Clustered indexes`],1,`Plus index blocks per SSTable.`,'H'],
  ],
});
