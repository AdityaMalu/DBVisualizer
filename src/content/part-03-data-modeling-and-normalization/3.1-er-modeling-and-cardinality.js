/* 3.1 ER modeling and cardinality */
topic('3', { no:'3.1', title:'ER modeling: entities, relationships, cardinality', db:'school',
idea:`Turn a plain-English requirement into an entity-relationship diagram and then into tables. See how 1:1, 1:N and M:N relationships map to foreign keys and junction tables, and where optional vs mandatory participation shows up.`,
dgTitle:'ER diagram', stateTitle:'Mapping to tables',
nodes:{
  stu:{x:80,y:60,label:'Student',w:110},
  enr:{x:240,y:60,label:'Enrollment',w:120,kind:'lock'},
  crs:{x:400,y:60,label:'Course',w:110},
  ins:{x:400,y:170,label:'Instructor',w:120},
  dep:{x:200,y:170,label:'Department',w:130},
  off:{x:400,y:270,label:'Office',w:110}
},
edges:[['stu','enr'],['crs','enr'],['ins','crs'],['ins','dep'],['ins','off']],
vb:'0 0 480 300',
codes:{a:`-- "Students enroll in many courses; a course has many students.
--  Each course is taught by exactly one instructor.
--  An instructor belongs to one department and may have one office."

CREATE TABLE departments (id INT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE instructors (
  id       INT PRIMARY KEY,
  name     TEXT NOT NULL,
  dept_id  INT NOT NULL REFERENCES departments(id)        -- N:1, mandatory
);
CREATE TABLE offices (
  instructor_id INT PRIMARY KEY REFERENCES instructors(id), -- 1:1
  room          TEXT NOT NULL
);
CREATE TABLE courses (
  code          TEXT PRIMARY KEY,
  instructor_id INT NOT NULL REFERENCES instructors(id)    -- N:1
);
CREATE TABLE enrollments (                                 -- M:N
  student_id  INT REFERENCES students(id),
  course_code TEXT REFERENCES courses(code),
  grade       TEXT,                                        -- attribute of the relationship
  PRIMARY KEY (student_id, course_code)
);`},
steps:[
{hl:{q:[1,2,3]}, d:{hide:['enr','ins','dep','off'], on:['stu','crs']}, g:[G('Find the nouns',['Student, Course, Instructor, Department, Office','entities','hot'],['verbs','enroll, teach, belong to, have','relationships'])],
 say:`Data modeling starts with words, not tables. The <b>nouns</b> in the requirement become <b>entities</b> (Student, Course, Instructor, Department, Office); the <b>verbs</b> become <b>relationships</b> (enroll, teach, belongs to, has). An <b>ER diagram</b> draws them before any SQL is written.`},
{hl:{q:[15,16,17,18]}, d:{hide:['enr','dep','off'], on:['ins','crs'], e:[['ins','crs','teaches 1 : N','hot']]}, g:[G('1 : N',['one instructor','teaches many courses'],['each course','has exactly one instructor'],['mapping','FK on the MANY side: courses.instructor_id','hot'])],
 say:`<b>One-to-many (1:N)</b>: an instructor teaches many courses, each course has one instructor. Rule: the <b>foreign key goes on the "many" side</b> (<code>courses.instructor_id</code>). Putting a list of courses on the instructor row would break first normal form (3.4).`},
{hl:{q:[6,7,8,9,10]}, d:{hide:['enr','off'], on:['ins','dep'], e:[['ins','dep','belongs to N : 1','hot']]}, g:[G('Participation',['instructor must have a department','mandatory → NOT NULL FK','hot'],['department may have no instructors','optional on that side'])],
 say:`<b>Participation</b> (optionality) is part of cardinality. "Every instructor belongs to a department" makes the FK <code>NOT NULL</code>. "A department may have no instructors yet" needs nothing special. Crow's-foot notation draws this with a bar (exactly one) or a circle (zero or more).`},
{hl:{q:[11,12,13,14]}, d:{hide:['enr'], on:['ins','off'], e:[['ins','off','has 1 : 0..1','hot']]}, g:[G('1 : 1',['instructor ↔ office','at most one each'],['mapping','FK + UNIQUE (here the FK is also the PK)','hot'],['alternative','merge into one table with nullable columns'])],
 say:`<b>One-to-one (1:1)</b>: an instructor has at most one office. Map it with a foreign key that is also <b>UNIQUE</b>, here by making it the primary key of <code>offices</code>. Often you can simply merge 1:1 entities into one table; split them when the optional part is large, rarely used or has different access rules.`},
{hl:{q:[19,20,21,22,23,24]}, d:{on:['enr'], e:[['stu','enr','1 : N','hot'],['crs','enr','1 : N','hot']]}, g:[G('M : N',['students ↔ courses','many on both sides'],['mapping','junction (associative) table','hot'],['its key','(student_id, course_code)'],['relationship attributes','grade lives here'])],
 say:`<b>Many-to-many (M:N)</b> can't be expressed with a single foreign key. It becomes a <b>junction table</b> with two foreign keys, turning one M:N into two 1:N. Attributes of the relationship itself, like the grade, belong on the junction table: a grade isn't a property of the student or the course alone.`},
{hl:{}, d:{}, g:[G('Cardinality → tables',['1 : N','FK on the N side'],['1 : 1','FK + UNIQUE, or merge'],['M : N','junction table with 2 FKs'],['mandatory','NOT NULL FK'],['recursive (employee → manager)','FK to the same table'])],
 say:`<b>Say it:</b> "I identify entities from nouns and relationships from verbs, then decide cardinality and optionality. 1:N puts the foreign key on the many side, 1:1 uses a unique foreign key or a merged table, M:N becomes a junction table whose primary key is the pair of foreign keys and which holds the relationship's own attributes. Mandatory participation becomes NOT NULL."`}
],
keep:[`Nouns → entities, verbs → relationships. Decide cardinality AND optionality.`,`1:N → FK on the many side. 1:1 → FK + UNIQUE (or merge). M:N → junction table.`,`Relationship attributes (grade, quantity, role) live on the junction table.`,`Mandatory → NOT NULL FK. Recursive → FK to the same table.`]}, {
  imp: 'must',
  theory: TH(`Entity-relationship modeling describes what things exist (entities), how they relate (relationships) and how many of each can be related (cardinality), before turning it all into tables.`,
`<p>Before building a house you draw a plan. An <b>ER diagram</b> is the plan for a database: boxes for things you store (entities), lines for how they relate, and marks on the lines for "one" or "many" and "required" or "optional".</p>
<p>Getting cardinality right is what makes the schema correct. If you think "a course has one instructor" but co-teaching exists, you've built a 1:N where reality is M:N, and that's painful to fix after go-live. So interviewers probe your assumptions.</p>`,
[[`Entity`,`A thing you store data about (becomes a table).`],[`Attribute`,`A property of an entity (becomes a column).`],[`Relationship`,`An association between entities.`],[`Cardinality`,`1:1, 1:N, M:N.`],[`Participation`,`Whether an entity must take part (mandatory) or may (optional).`],[`Junction table`,`Resolves M:N into two 1:N relationships.`],[`Weak entity`,`Identified only together with its owner (order line within an order).`]],
[`List entities and their attributes from the requirements.`,`Draw relationships and decide cardinality and optionality for each end.`,`Map to tables: FKs, unique FKs, junction tables.`,`Pick keys and constraints; normalise (3.4).`],
[`Design reviews for new features start with an ER sketch.`,`ORMs mirror it: @ManyToOne, @OneToMany, @ManyToMany (with a join table).`,`System design interviews: "design the schema for X" is ER modeling out loud.`],
[`Modeling M:N as a comma-separated column.`,`Putting the FK on the wrong side of a 1:N.`,`Hard-coding 1:1 when the business will soon need 1:N (addresses, phone numbers).`,`Forgetting attributes that belong to the relationship.`]),
  examples: [
    {lv:'basic', title:'1:N in action', sql:`SELECT c.instructor, COUNT(*) AS courses
FROM courses c
GROUP BY c.instructor;`, why:`In this dataset the instructor is a name column on courses: the "many" side holds the reference. Dr. Iyer and Dr. Shah each teach two courses.`},
    {lv:'mid', title:'M:N through the junction table', sql:`SELECT c.title, COUNT(e.student_id) AS students
FROM courses c
LEFT JOIN enrollments e ON e.course_code = c.code
GROUP BY c.code, c.title
ORDER BY students DESC;`, why:`enrollments resolves students ↔ courses. LEFT JOIN keeps courses with no students.`},
    {lv:'adv', title:'Normalise the instructor out into its own entity', sql:`CREATE TABLE instructors (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
INSERT INTO instructors (name) SELECT DISTINCT instructor FROM courses;
ALTER TABLE courses ADD COLUMN instructor_id INTEGER REFERENCES instructors(id);
UPDATE courses SET instructor_id = (SELECT id FROM instructors i WHERE i.name = courses.instructor);
SELECT c.code, c.title, i.id AS instructor_id, i.name
FROM courses c JOIN instructors i ON i.id = c.instructor_id;`, why:`A migration from "name copied on every course" to a real Instructor entity with a 1:N foreign key, the typical refactor when an attribute turns out to be an entity.`},
  ],
  tips: {
    say:`"I pull entities from nouns and relationships from verbs, confirm cardinality and optionality with the interviewer, then map: foreign key on the many side for 1:N, a unique FK or merged table for 1:1, and a junction table for M:N that also holds the relationship's attributes."`,
    points:[`Ask cardinality questions out loud ("can a course have two instructors?").`,`Draw the junction table and its composite key for M:N.`,`Point out relationship attributes (grade, quantity, role).`],
    traps:[`Arrays/CSV columns for M:N.`,`Assuming 1:1 for things that become 1:N (addresses).`],
    qa:[[`How do you model users following users?`,`A self-referencing M:N: follows(follower_id FK users, followee_id FK users, created_at, PRIMARY KEY (follower_id, followee_id)), plus an index on (followee_id).`],
        [`Where does the quantity go in orders and products?`,`On the junction table order_items(order_id, product_id, qty, unit_price): it belongs to the pair.`],
        [`When would you split a 1:1 into two tables?`,`Large or rarely read columns (blobs, profile details), different security, or optional data present for few rows.`]]
  },
  exercises: [
    {lv:'E', q:`For each student, list the courses they take with the instructor: <code>name, code, instructor</code>.`, hint:`students → enrollments → courses.`,
     sql:`SELECT s.name, c.code, c.instructor
FROM students s
JOIN enrollments e ON e.student_id = s.id
JOIN courses c ON c.code = e.course_code;`},
    {lv:'M', q:`Model a library: books have one or more authors; members borrow copies of books; a copy is borrowed by at most one member at a time; we keep borrowing history. List tables with keys and cardinalities.`, hint:`Book vs physical copy; authorship is M:N; loans are history.`,
     answer:`<ul><li><code>books(id PK, title, isbn UNIQUE)</code></li><li><code>authors(id PK, name)</code>, <code>book_authors(book_id FK, author_id FK, PK(book_id, author_id))</code>: M:N</li><li><code>copies(id PK, book_id FK NOT NULL)</code>: book 1:N copies</li><li><code>members(id PK, name, email UNIQUE)</code></li><li><code>loans(id PK, copy_id FK, member_id FK, borrowed_at, returned_at NULL)</code>: history; "at most one active loan per copy" via a partial unique index on copy_id WHERE returned_at IS NULL.</li></ul>`},
    {lv:'H', q:`Instructors teaching students in more than one major. Return <code>instructor, majors</code> (count of distinct non-NULL majors among their enrolled students).`, hint:`Join courses → enrollments → students, COUNT(DISTINCT major), HAVING &gt; 1.`,
     sql:`SELECT c.instructor, COUNT(DISTINCT s.major) AS majors
FROM courses c
JOIN enrollments e ON e.course_code = c.code
JOIN students s ON s.id = e.student_id
GROUP BY c.instructor
HAVING COUNT(DISTINCT s.major) > 1;`},
  ],
  quiz: [
    [`In a 1:N relationship, the foreign key goes…`,[`On the "one" side`,`On the "many" side`,`In a junction table`,`On both sides`],1,`courses.instructor_id.`,'E'],
    [`An M:N relationship is implemented with…`,[`A foreign key on one side`,`A junction table with two foreign keys`,`An array column`,`A 1:1 table`],1,`Two 1:N relationships.`,'E'],
    [`How is a 1:1 typically enforced?`,[`A foreign key with a UNIQUE constraint (or as the PK)`,`Two foreign keys`,`A CHECK constraint`,`It can't be`],0,`At most one match on each side.`,'M'],
    [`Where does "grade" go for students ↔ courses?`,[`students`,`courses`,`enrollments (the junction table)`,`a separate grades table with no keys`],2,`It describes the pair.`,'E'],
    [`"Every order must have a customer" translates to…`,[`A UNIQUE customer_id`,`orders.customer_id NOT NULL with an FK`,`A junction table`,`A CHECK on customers`],1,`Mandatory participation.`,'M'],
    [`An employee's manager is another employee. This is…`,[`An M:N`,`A recursive (self-referencing) 1:N`,`A 1:1`,`A weak entity`],1,`FK to the same table.`,'E'],
  ],
  quizAdv: [
    [`A weak entity is…`,[`One with few columns`,`One identified only together with its owner's key (e.g. order line number within an order)`,`An optional entity`,`A view`],1,`Its PK includes the owner's PK.`,'H'],
    [`Enforce "a copy has at most one active loan" with history kept in loans:`,[`UNIQUE(copy_id)`,`A partial unique index on copy_id WHERE returned_at IS NULL`,`A trigger only`,`It can't be enforced`],1,`Postgres/SQLite support partial indexes.`,'H'],
    [`Ternary relationship (supplier supplies part to project) is best stored as…`,[`Three 1:N FKs on parts`,`One junction table with three FKs`,`Three separate junction tables (always equivalent)`,`A JSON column`],1,`Pairwise tables can lose information.`,'H'],
  ],
});
