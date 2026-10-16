/* 3.2 Keys: super, candidate, primary, alternate, surrogate, natural, composite */
topic('3', { no:'3.2', title:'Keys: super, candidate, primary, alternate, surrogate, composite', db:'school',
idea:`One employee table, many possible keys. Test column sets for uniqueness, shrink superkeys down to candidate keys, pick a primary key, and weigh natural keys against surrogate ids (and UUIDs).`,
tbTitle:'employees', stateTitle:'Is it a key?',
codes:{a:`-- employees(emp_no, email, ssn, name, dept, phone)

-- superkey:     any column set that is unique per row
--   {emp_no}, {email}, {ssn}, {emp_no, name}, {email, dept}, …
-- candidate key: a MINIMAL superkey (remove any column → not unique)
--   {emp_no}, {email}, {ssn}
-- primary key:  the candidate key you choose
-- alternate:    the other candidate keys (declare UNIQUE)

CREATE TABLE employees (
  id      BIGINT PRIMARY KEY,          -- surrogate key
  emp_no  TEXT   NOT NULL UNIQUE,      -- natural, alternate key
  email   TEXT   NOT NULL UNIQUE,      -- alternate key
  ssn     TEXT   UNIQUE,
  name    TEXT   NOT NULL,
  dept    TEXT
);`},
steps:[
{hl:{q:[1]}, tb:[TB('employees',['emp_no','email','ssn','name','dept'],[['E1','asha@co.com','111','Asha','Eng'],['E2','ben@co.com','222','Ben','Eng'],['E3','asha.k@co.com','333','Asha','Sales']])], g:[G('Unique per row?',['name','no: two Ashas','bad'],['dept','no','bad'],['{name, dept}','yes today… but is it guaranteed?','hot'])],
 say:`A <b>key</b> is a set of columns whose values identify exactly one row. The question isn't "is it unique in today's data?" but "is it unique <b>by the rules of the business</b>?" {name, dept} happens to be unique here, but nothing stops a second Asha joining Engineering, so it isn't a key.`},
{hl:{q:[3,4]}, g:[G('Superkeys',['{emp_no}','✓','ok'],['{emp_no, name}','✓ (emp_no alone already unique)','ok'],['{email, dept}','✓','ok'],['all columns','✓ always a superkey','ok'])],
 say:`A <b>superkey</b> is any set of columns that is guaranteed unique. Adding columns to a superkey keeps it a superkey, so there are lots of them, including "all columns". Most superkeys carry useless extra columns.`},
{hl:{q:[5,6]}, g:[G('Candidate keys (minimal)',['{emp_no}','✓ minimal','ok'],['{email}','✓ minimal','ok'],['{ssn}','✓ minimal (if always present)','ok'],['{emp_no, name}','✗ not minimal: drop name','bad'])],
 say:`A <b>candidate key</b> is a <b>minimal</b> superkey: remove any column and it stops being unique. Here: {emp_no}, {email} and {ssn}. A table can have several candidate keys. Candidate keys matter for normalization (3.3–3.5), where "key" means candidate key.`},
{hl:{q:[7,8,11,12,13]}, g:[G('Choosing',['primary key','one candidate key, chosen','hot'],['alternate keys','the others → UNIQUE constraints','ok'],['PK requirements','unique, NOT NULL, stable, ideally small'],['ssn','sensitive, may be missing → bad PK','bad'])],
 say:`The <b>primary key</b> is the candidate key you pick as the main identifier; the rest are <b>alternate keys</b> and should still be enforced with UNIQUE. A good PK is unique, never NULL, <b>never changes</b>, and is small (it's copied into every foreign key and index). SSN fails: sensitive and possibly missing. Email fails "never changes".`},
{hl:{q:[10,11]}, tb:[TB('employees',['id','emp_no','email','name'],[[1,'E1','asha@co.com','Asha'],[2,'E2','ben@co.com','Ben'],[3,'E3','asha.k@co.com','Asha']],{0:'hot',1:'hot',2:'hot'})], g:[G('Natural vs surrogate',['natural key','emp_no, email, ISBN: meaningful, can change'],['surrogate key','id: generated, meaningless, never changes','hot'],['common practice','surrogate PK + UNIQUE on natural keys','ok'])],
 say:`A <b>natural key</b> has business meaning (emp_no, email, ISBN); a <b>surrogate key</b> is a generated id with no meaning. Business identifiers change (companies renumber employees, people change email), and when a PK changes, every foreign key pointing at it must change too. The common practice: a <b>surrogate primary key plus UNIQUE constraints on natural keys</b>.`},
{hl:{}, tb:[], g:[G('Surrogate key types',['auto-increment / identity / sequence','small, ordered, index-friendly; guessable','ok'],['UUID v4','generate anywhere; random → index churn','bad'],['UUID v7 / ULID / Snowflake','time-ordered and globally unique','ok']), G('Composite key',['(student_id, course_code)','natural for junction tables','ok'],['foreign keys to it','must repeat all columns'])],
 say:`<b>Say it:</b> "A superkey is any unique column set; a candidate key is a minimal one; the primary key is the candidate I choose, and the others become unique constraints. I usually use a surrogate primary key, an identity or time-ordered UUID, and enforce natural keys with UNIQUE, because natural identifiers change. Junction tables use a composite key of their two foreign keys."`}
],
keep:[`Superkey ⊇ candidate key (minimal) → one chosen as primary; others = alternate (UNIQUE).`,`Keys come from business rules, not from today's data.`,`Good PK: unique, NOT NULL, stable, small.`,`Surrogate PK + UNIQUE natural keys. Prefer sequential or time-ordered ids (UUIDv7) over random UUIDv4.`]}, {
  imp: 'must',
  theory: TH(`A key is a set of columns that uniquely identifies a row; candidate keys are the minimal ones, and the primary key is the candidate key chosen as the main identifier.`,
`<p>Think of how a school identifies a student: roll number, email, maybe national ID. Each identifies exactly one student, so each is a <b>candidate key</b>. The school picks one, usually the roll number, as the <b>primary key</b> used everywhere else; the others still must stay unique.</p>
<p>Many systems don't use any business identifier as the primary key at all: they generate an internal number (a <b>surrogate</b>) that never changes, and keep business identifiers as unique columns. That way, when a business rule changes, foreign keys don't.</p>`,
[[`Superkey`,`Any column set that uniquely identifies rows.`],[`Candidate key`,`A minimal superkey.`],[`Primary key`,`The chosen candidate key; NOT NULL, one per table.`],[`Alternate key`,`A candidate key not chosen as PK (enforce UNIQUE).`],[`Natural key`,`A key with business meaning.`],[`Surrogate key`,`A generated identifier without meaning.`],[`Composite key`,`A key made of several columns.`],[`Foreign key`,`A reference to another table's key.`]],
[`List columns that business rules say are unique.`,`Reduce each to a minimal set: candidate keys.`,`Pick a primary key (often a surrogate) and declare the rest UNIQUE.`,`Reference the PK from other tables with foreign keys.`],
[`BIGINT identity or UUIDv7 primary keys; UNIQUE on email/username/sku.`,`Composite PKs on junction tables.`,`Public-facing ids (slugs, random tokens) kept separate from internal PKs to prevent enumeration.`],
[`Using email or phone as a PK.`,`Declaring only the surrogate PK and forgetting UNIQUE on the natural key (duplicates creep in).`,`Random UUIDv4 PKs on huge write-heavy tables (index fragmentation).`,`Treating "unique in current data" as a key.`]),
  examples: [
    {lv:'basic', title:'Is a column a candidate key in the data?', sql:`SELECT COUNT(*) AS rows, COUNT(DISTINCT name) AS distinct_names, COUNT(DISTINCT id) AS distinct_ids
FROM students;`, why:`Data can disprove a key (duplicates) but never prove one: uniqueness must come from the business rule.`},
    {lv:'mid', title:'Composite key on a junction table', sql:`SELECT student_id, course_code, COUNT(*) AS n
FROM enrollments
GROUP BY student_id, course_code
HAVING COUNT(*) > 1;`, why:`Returns no rows: (student_id, course_code) is the primary key, so no pair can repeat. Try inserting a duplicate enrollment to see the PK reject it.`},
    {lv:'adv', title:'Surrogate PK plus natural alternate key', sql:`CREATE TABLE staff (
  id      INTEGER PRIMARY KEY,           -- surrogate
  emp_no  TEXT NOT NULL UNIQUE,          -- natural, alternate key
  email   TEXT NOT NULL UNIQUE
);
INSERT INTO staff (emp_no, email) VALUES ('E1', 'a@co.com'), ('E2', 'b@co.com');
UPDATE staff SET emp_no = 'X-0001' WHERE emp_no = 'E1';   -- renumbering: id unchanged
SELECT * FROM staff;`, why:`The business renumbered an employee; foreign keys pointing at <code>id</code> don't care.`},
  ],
  tips: {
    say:`"A superkey is any unique set of columns, a candidate key is a minimal superkey, and the primary key is the candidate I pick; the others are alternate keys with UNIQUE constraints. I prefer a surrogate primary key, sequential or UUIDv7, with unique constraints on natural keys, because business identifiers change."`,
    points:[`Define all key types crisply, with one example each.`,`Discuss natural vs surrogate with a real reason (renumbering, email changes).`,`Know the UUID trade-off and UUIDv7.`],
    traps:[`Saying a table can have several primary keys.`,`Forgetting that a surrogate PK alone doesn't stop duplicate business records.`],
    qa:[[`Candidate key vs primary key?`,`Every primary key is a candidate key; it's the one chosen as the main identifier. Others remain alternate keys.`],
        [`Should you expose auto-increment ids in URLs?`,`It leaks volume and allows enumeration. Use a separate random public id or UUID, and still check authorization.`],
        [`When is a natural key a good PK?`,`When it's truly immutable, compact and always present: ISO country codes, currency codes, or a composite of FKs in a junction table.`]]
  },
  exercises: [
    {lv:'E', q:`Is <code>name</code> unique among students in this data? Return <code>name, n</code> for any duplicated names (the result may confirm "none"; to make the check meaningful, first insert another student named 'Aditi').`, hint:`INSERT a second Aditi, then GROUP BY name HAVING COUNT(*) &gt; 1.`,
     sql:`INSERT INTO students (name, major, year) VALUES ('Aditi', 'Math', 1);
SELECT name, COUNT(*) AS n FROM students GROUP BY name HAVING COUNT(*) > 1;`},
    {lv:'M', q:`Table <code>flights(airline, flight_no, date, gate, pilot_id)</code>. A flight number is reused daily, each airline has its own numbers, and a pilot flies at most one flight per day. List the candidate keys.`, hint:`What identifies a flight occurrence? What else is unique?`,
     answer:`<ul><li>{airline, flight_no, date}: a flight on a given day.</li><li>{pilot_id, date}: under the "one flight per pilot per day" rule.</li><li>{gate, date} is <b>not</b> a key: a gate serves many flights a day.</li></ul><p>Pick a surrogate <code>id</code> as PK and declare both candidate keys UNIQUE.</p>`},
    {lv:'H', q:`Your users table has a BIGINT identity PK and 2 billion rows; writes are global across regions. Product wants client-generated ids for offline creation. Compare options and recommend one.`, hint:`UUIDv4 vs UUIDv7/ULID vs Snowflake vs keeping identity.`,
     answer:`<ul><li>Identity/sequence: needs a central allocator, doesn't work offline.</li><li>UUIDv4: works offline but random inserts fragment B-tree indexes, 16 bytes everywhere.</li><li>UUIDv7/ULID: offline, globally unique, time-ordered so inserts append to the index end. Recommended.</li><li>Snowflake-style 64-bit ids: compact and ordered but need worker-id coordination, awkward offline.</li></ul><p>Recommend UUIDv7 for new entities, stored as native uuid/16-byte binary, keep the old BIGINT for existing rows or migrate with a mapping column.</p>`},
  ],
  quiz: [
    [`A candidate key is…`,[`Any unique column set`,`A minimal superkey`,`The primary key`,`A foreign key`],1,`Remove a column and it's no longer unique.`,'E'],
    [`How many primary keys per table?`,[`One`,`One per candidate key`,`Unlimited`,`Zero or more`],0,`Possibly composite.`,'E'],
    [`{emp_no, name} where emp_no is unique is…`,[`A candidate key`,`A superkey but not a candidate key`,`Not a key`,`A foreign key`],1,`Not minimal.`,'M'],
    [`Main argument for a surrogate primary key?`,[`It's human-readable`,`It never changes, so foreign keys never need updating`,`It enforces business uniqueness`,`It's required by SQL`],1,`Stability.`,'M'],
    [`Alternate keys should be…`,[`Ignored`,`Declared UNIQUE`,`Declared as foreign keys`,`Indexed only`],1,`Still keys.`,'E'],
    [`Why can't data alone prove a column is a key?`,[`It can`,`Today's data may be unique by accident; keys come from business rules`,`Because of NULLs only`,`Because indexes are missing`],1,`Rules, not samples.`,'M'],
  ],
  quizAdv: [
    [`Random UUIDv4 primary keys in a clustered index (InnoDB) cause…`,[`Better locality`,`Random page inserts, splits and poor cache hit rates`,`Duplicate keys`,`Slower reads only`],1,`Use time-ordered ids.`,'H'],
    [`Prime attribute (normalization) means…`,[`An integer column`,`A column that is part of some candidate key`,`The first column`,`A column with an index`],1,`Used in 2NF/3NF definitions.`,'H'],
    [`A table R(A, B, C) with FDs A→B, B→C, C→A has candidate keys…`,[`{A} only`,`{A}, {B}, {C}`,`{A, B}`,`{A, B, C} only`],1,`Each determines the others.`,'H'],
  ],
});
