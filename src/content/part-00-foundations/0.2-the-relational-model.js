/* 0.2 The relational model */
topic('0', { no:'0.2', title:'The relational model: tables, rows, keys', db:'school',
idea:`Build a tiny university database from a messy spreadsheet. See how a table is a relation, why each row needs a key, and how foreign keys link tables instead of copying data.`,
tbTitle:'Tables', stateTitle:'Vocabulary',
codes:{a:`-- one big spreadsheet: every enrollment repeats student and course data
-- student | major | course | title     | instructor | grade

CREATE TABLE students (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  major  TEXT
);
CREATE TABLE courses (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  instructor  TEXT NOT NULL
);
CREATE TABLE enrollments (
  student_id   INTEGER REFERENCES students(id),
  course_code  TEXT    REFERENCES courses(code),
  grade        TEXT,
  PRIMARY KEY (student_id, course_code)
);`},
steps:[
{hl:{q:[1,2]}, tb:[TB('spreadsheet',['student','major','course','title','instructor','grade'],[['Aditi','CS','CS101','Intro to Programming','Dr. Rao','A'],['Aditi','CS','CS201','Databases','Dr. Iyer','B'],['Bilal','CS','CS201','Databases','Dr. Iyer','A'],['Carmen','Math','CS101','Intro to Programing','Dr. Rao','C']],{3:'bad'})],
 say:`Data usually starts life as one big sheet. Every enrollment repeats the student's major and the course's title and instructor. Spot the problem in the last row: "Programing" is misspelled. The same fact is stored many times, so copies can drift apart.`},
{hl:{q:[4,5,6,7,8]}, tb:[TB('students',['id','name','major'],[[1,'Aditi','CS'],[2,'Bilal','CS'],[3,'Carmen','Math']],{0:'new',1:'new',2:'new'})], g:[G('Vocabulary',['relation','table','hot'],['tuple','row'],['attribute','column'],['domain','the type of values a column allows'],['degree / cardinality','number of columns / rows'])],
 say:`The relational model (E. F. Codd, 1970) says: store each kind of thing in its own <b>relation</b> (table). A relation is a <b>set of tuples</b> (rows) with named, typed <b>attributes</b> (columns). Set means: no duplicate rows and no inherent row order. That's why SQL needs ORDER BY to guarantee an order.`},
{hl:{q:[5]}, tb:[TB('students',['id','name','major'],[[1,'Aditi','CS'],[2,'Bilal','CS'],[3,'Carmen','Math']],{0:'hot'})], g:[G('Keys',['primary key','id: unique, never NULL','hot'],['why','identifies exactly one row'],['candidate key','any minimal unique column set'],['surrogate key','an artificial id with no business meaning'])],
 say:`Every row needs a <b>primary key</b>: a column (or set of columns) whose value is unique and never NULL, so you can point at exactly one row. Names aren't safe: two students can both be called Aditi. A generated <code>id</code> is a <b>surrogate key</b>. Section 3.2 covers all the key types.`},
{hl:{q:[9,10,11,12,13]}, tb:[TB('students',['id','name','major'],[[1,'Aditi','CS'],[2,'Bilal','CS'],[3,'Carmen','Math']]), TB('courses',['code','title','instructor'],[['CS101','Intro to Programming','Dr. Rao'],['CS201','Databases','Dr. Iyer']],{0:'new',1:'new'})],
 say:`Courses get their own table, keyed by <code>code</code> (a <b>natural key</b>: it already exists in the real world). Now "Intro to Programming" is stored <b>once</b>. Fix a typo in one place and every enrollment sees the fix.`},
{hl:{q:[14,15,16,17,18,19]}, tb:[TB('enrollments',['student_id','course_code','grade'],[[1,'CS101','A'],[1,'CS201','B'],[2,'CS201','A'],[3,'CS101','C']],{0:'new',1:'new',2:'new',3:'new'})], g:[G('Linking tables',['foreign key','enrollments.student_id → students.id','hot'],['composite primary key','(student_id, course_code)'],['many-to-many','students ⇄ courses via enrollments'])],
 say:`The relationship itself becomes a table. <code>enrollments</code> holds just the two <b>foreign keys</b> and the grade. A foreign key is a column whose values must exist as a key in another table, so you can't enroll student 99. The pair (student_id, course_code) is the <b>composite primary key</b>: a student can take each course once.`},
{hl:{}, tb:[TB('JOIN rebuilds the original view',['name','title','grade'],[['Aditi','Intro to Programming','A'],['Aditi','Databases','B'],['Bilal','Databases','A'],['Carmen','Intro to Programming','C']],{3:'ok'})], log:['SELECT s.name, c.title, e.grade FROM enrollments e JOIN students s … JOIN courses c …'],
 say:`Nothing is lost: a <b>join</b> recombines the tables into the spreadsheet view on demand, now with the corrected title everywhere. Splitting data into relations and joining it back is the heart of relational databases. Part 3 formalises <i>how</i> to split (normalization).`},
{hl:{}, tb:[], g:[G('Codd\'s big ideas',['data as relations','tables of rows and columns'],['logical ≠ physical','queries never mention files or pointers','hot'],['set-based operations','select, project, join, union…'],['integrity rules','entity (PK) and referential (FK) integrity'])],
 say:`<b>Say it:</b> "In the relational model data lives in tables of rows and typed columns; each row is identified by a primary key and tables reference each other through foreign keys rather than copying data. Queries operate on whole sets, and the physical storage is hidden behind the logical model."`}
],
keep:[`Relation = table, tuple = row, attribute = column. A relation is a set: no duplicates, no order.`,`Primary key: unique + not NULL, identifies one row. Foreign key: must match a key in another table.`,`Store each fact once; rebuild combined views with joins.`,`Many-to-many needs a junction table with two foreign keys.`]}, {
  imp: 'must',
  theory: TH(`In the relational model, data lives in tables; each row is identified by a key, and tables refer to each other through keys instead of copying data.`,
`<p>A <b>table</b> (relation) describes one kind of thing: students, courses. Each <b>row</b> is one thing, each <b>column</b> one property with a fixed type. A <b>primary key</b> uniquely identifies each row, the way a roll number identifies a student.</p>
<p>Relationships are expressed with <b>foreign keys</b>: <code>enrollments.student_id</code> stores a student's id rather than their name and major. It's like writing a page number in an index instead of photocopying the page: one source of truth, and everything else points at it.</p>`,
[[`Relation / table`,`A set of rows with the same columns.`],[`Tuple / row`,`One record.`],[`Attribute / column`,`A named, typed property.`],[`Domain`,`The set of allowed values for a column.`],[`Primary key`,`Unique, non-NULL identifier of a row.`],[`Foreign key`,`A column referencing a key in another (or the same) table.`],[`Schema`,`The definition of tables, columns, types and constraints.`]],
[`Identify the entities (students, courses) and give each a table.`,`Pick a primary key for each table.`,`Express relationships with foreign keys; many-to-many gets its own junction table.`,`Query by joining tables back together.`],
[`Every ORM entity maps to a table with an id; associations map to foreign keys.`,`Schemas are versioned with migrations (Flyway, Liquibase, Alembic, Rails…).`,`Foreign keys catch bugs early: orphaned rows are rejected at write time.`],
[`Using names or emails as primary keys (they change and aren't unique).`,`Storing lists in a column ("CS101,CS201") instead of a junction table.`,`Relying on row order without ORDER BY.`,`Skipping foreign keys "for performance" and ending up with orphans.`]),
  examples: [
    {lv:'basic', title:'Look at one table', sql:`SELECT * FROM students;`, why:`Each row is one student; <code>id</code> is the primary key. Femi has no major yet (NULL).`},
    {lv:'mid', title:'Follow a foreign key with a join', sql:`SELECT s.name, e.course_code, e.grade
FROM enrollments e
JOIN students s ON s.id = e.student_id
ORDER BY s.name;`, why:`<code>enrollments.student_id</code> points at <code>students.id</code>; the join follows the pointer.`},
    {lv:'adv', title:'Rebuild the spreadsheet from three tables', sql:`SELECT s.name, s.major, c.code, c.title, c.instructor, e.grade
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses  c ON c.code = e.course_code
ORDER BY s.name, c.code;`, why:`A many-to-many relationship resolved through the junction table. Every course title is stored once but shows on every row.`},
  ],
  tips: {
    say:`"Relational databases store each entity in its own table with a primary key, link tables with foreign keys, and recombine them with joins. That keeps each fact in one place, so updates can't create inconsistent copies."`,
    points:[`Use the terms correctly: relation, tuple, attribute, primary key, foreign key, junction table.`,`Explain why duplication is dangerous (update anomalies) before anyone asks.`,`Show many-to-many with a junction table and a composite key.`],
    traps:[`Saying tables have a natural row order.`,`Using a mutable natural key (email, phone) as the primary key without discussing the trade-off.`],
    qa:[[`Why is a relation called a set, and what does it imply?`,`No duplicate rows and no order. In SQL tables can contain duplicates unless you declare a key, and result order is undefined without ORDER BY.`],
        [`How do you model students and courses?`,`Two entity tables plus enrollments(student_id FK, course_code FK, grade) with PRIMARY KEY (student_id, course_code).`],
        [`Can a foreign key reference the same table?`,`Yes: employees.manager_id → employees.id. That's a self-referencing (recursive) relationship.`]]
  },
  exercises: [
    {lv:'E', q:`List the courses taught by Dr. Iyer (<code>code, title</code>).`, hint:`Filter courses on instructor.`,
     sql:`SELECT code, title FROM courses WHERE instructor = 'Dr. Iyer';`},
    {lv:'M', q:`For each student, show <code>name</code> and how many courses they are enrolled in, including students with none.`, hint:`LEFT JOIN enrollments and COUNT a column from enrollments.`,
     sql:`SELECT s.name, COUNT(e.course_code) AS courses
FROM students s
LEFT JOIN enrollments e ON e.student_id = s.id
GROUP BY s.id, s.name;`},
    {lv:'M', q:`A product team wants to store a user's "favourite tags" as a comma-separated string in <code>users.tags</code>. Explain what goes wrong and design the relational alternative.`, hint:`How would you find all users with tag "sql"? Rename a tag?`,
     answer:`<p>Comma lists break the model: you can't index or join them, "find users with tag X" needs LIKE '%x%' (slow and wrong for partial matches), renaming a tag means rewriting strings, and nothing enforces valid tags.</p><p>Use <code>tags(id, name UNIQUE)</code> and a junction table <code>user_tags(user_id FK, tag_id FK, PRIMARY KEY(user_id, tag_id))</code>.</p>`},
    {lv:'H', q:`Which students share at least one course with Aditi? Return their names (not Aditi).`, hint:`Self-join enrollments on course_code.`,
     sql:`SELECT DISTINCT s.name
FROM enrollments a
JOIN enrollments b ON b.course_code = a.course_code AND b.student_id <> a.student_id
JOIN students s ON s.id = b.student_id
WHERE a.student_id = (SELECT id FROM students WHERE name = 'Aditi');`},
  ],
  quiz: [
    [`In relational terms, a row is a…`,[`Relation`,`Tuple`,`Domain`,`Attribute`],1,`Relation = table, attribute = column.`,'E'],
    [`A primary key must be…`,[`Unique and not NULL`,`Unique, NULL allowed once`,`Numeric`,`The first column`],0,`It identifies exactly one row.`,'E'],
    [`How do you model a many-to-many relationship?`,[`A comma-separated column`,`A junction table with two foreign keys`,`Two foreign keys pointing at each other`,`Duplicating rows in both tables`],1,`E.g. enrollments(student_id, course_code).`,'E'],
    [`Without ORDER BY, the order of rows returned is…`,[`Insertion order`,`Primary key order`,`Undefined; it can change`,`Alphabetical`],2,`Relations are sets; the engine returns whatever order its plan produces.`,'M'],
    [`What does a foreign key enforce?`,[`That the column is unique`,`That each value exists as a key in the referenced table`,`That the column is indexed`,`That the column is never updated`],1,`Referential integrity.`,'E'],
    [`Why not store the course title in every enrollment row?`,[`It's slower to read`,`Copies can disagree after an update (update anomaly)`,`SQL forbids it`,`Text columns can't be joined`],1,`One fact, one place.`,'M'],
  ],
  quizAdv: [
    [`Codd's "logical/physical independence" means queries…`,[`Run on any hardware`,`Never refer to how data is physically stored or accessed`,`Must be compiled before running`,`Can't use indexes`],1,`Indexes and storage can change without changing queries.`,'M'],
    [`A SQL table without any key can contain duplicate rows. Strictly, it is then a…`,[`Relation`,`Bag (multiset), not a relation`,`View`,`Domain`],1,`SQL tables are bags; relational theory's relations are sets.`,'H'],
    [`enrollments has PRIMARY KEY (student_id, course_code). Which insert fails?`,[`(1,'CS301','A') when (1,'CS101') exists`,`(1,'CS101','B') when (1,'CS101','A') exists`,`(7,'CS101',NULL) when student 7 exists`,`(2,'MA101','A') when (1,'MA101') exists`],1,`Same key pair twice.`,'M'],
  ],
});
