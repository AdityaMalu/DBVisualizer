/* 3.5 BCNF, 4NF and when to stop */
topic('3', { no:'3.5', title:'BCNF, 4NF and when to stop normalizing', db:'school',
idea:`3NF isn't the end. See a table that is in 3NF yet still repeats facts (students, courses, tutors), fix it with BCNF, then meet multivalued dependencies and 4NF. Finish with the practical rule for how far to go.`,
tbTitle:'Tables', stateTitle:'Check',
codes:{a:`-- tutoring(student, subject, tutor)
-- rules: each tutor teaches exactly one subject      tutor → subject
--        a student has one tutor per subject           (student, subject) → tutor
-- candidate keys: (student, subject), (student, tutor)

-- BCNF: for every non-trivial FD X → Y, X is a superkey
--   tutor → subject, but tutor is NOT a superkey  → violates BCNF
-- decompose:
--   tutors(tutor, subject)          tutor → subject
--   tutoring(student, tutor)

-- 4NF: no non-trivial multivalued dependencies
-- person_skills_languages(person, skill, language)
--   person ↠ skill, person ↠ language (independent)
-- decompose: person_skills(person, skill), person_languages(person, language)`},
steps:[
{hl:{q:[1,2,3,4]}, tb:[TB('tutoring',['student','subject','tutor'],[['Aditi','Math','Dr. Shah'],['Bilal','Math','Dr. Shah'],['Aditi','Physics','Dr. Rao'],['Carmen','Math','Dr. Kapoor']],{0:'hot',1:'hot'})], g:[G('FDs',['(student, subject) → tutor','a key'],['tutor → subject','each tutor teaches one subject','hot']), G('Candidate keys',['(student, subject)',''],['(student, tutor)',''])],
 say:`A tutoring table. Rules: a student has one tutor per subject, and each tutor teaches exactly one subject. So <code>tutor → subject</code>. Notice "Dr. Shah teaches Math" is stored once per student she tutors. Something is still repeated.`},
{hl:{q:[3,4]}, g:[G('Is it 3NF?',['non-key columns','none! every column is in some candidate key'],['3NF rule','only restricts non-key (non-prime) columns'],['verdict','3NF ✓','ok'])],
 say:`Is it in 3NF? 3NF only complains about <i>non-key</i> columns depending on something other than the key. Here every column belongs to some candidate key (subject is in (student, subject); tutor is in (student, tutor)). So no column is "non-key", and the table is technically in <b>3NF</b>, yet it still has redundancy.`},
{hl:{q:[6,7]}, g:[G('BCNF',['rule','every determinant (left side of a non-trivial FD) is a superkey','hot'],['tutor → subject','tutor alone is not a superkey','bad'],['verdict','violates BCNF','bad'])],
 say:`<b>Boyce–Codd normal form (BCNF)</b> is the stricter version: for every non-trivial dependency X → Y, <b>X must be a superkey</b>. <code>tutor → subject</code> has a determinant that isn't a key, so the table violates BCNF. Anomaly: change Dr. Shah's subject and you must update every student row.`},
{hl:{q:[8,9,10]}, tb:[TB('tutors',['tutor','subject'],[['Dr. Shah','Math'],['Dr. Rao','Physics'],['Dr. Kapoor','Math']],{0:'new',1:'new',2:'new'}), TB('tutoring',['student','tutor'],[['Aditi','Dr. Shah'],['Bilal','Dr. Shah'],['Aditi','Dr. Rao'],['Carmen','Dr. Kapoor']])], g:[G('After BCNF decomposition',['tutor → subject','stored once','ok'],['lost!','(student, subject) → tutor can no longer be checked in one table','bad'])],
 say:`Decompose on the violating FD: <code>tutors(tutor, subject)</code> and <code>tutoring(student, tutor)</code>. Each tutor's subject is stored once. The price: the rule "one tutor per subject per student" now spans two tables, so a simple UNIQUE constraint can't enforce it. That's the famous trade-off: <b>BCNF can lose dependency preservation</b>; 3NF never does.`},
{hl:{q:[12,13,14,15]}, tb:[TB('person_skills_languages',['person','skill','language'],[['Ana','SQL','English'],['Ana','SQL','Hindi'],['Ana','Go','English'],['Ana','Go','Hindi']],{0:'hot',1:'hot',2:'hot',3:'hot'})], g:[G('4NF',['multivalued dependency','person ↠ skill, independent of language'],['effect','every skill × every language','bad'],['fix','person_skills + person_languages','ok'])],
 say:`<b>Fourth normal form (4NF)</b> tackles <b>multivalued dependencies</b>: two independent lists about the same thing in one table. Ana's 2 skills × 2 languages need 4 rows; add a language and you must add a row per skill. Split into person_skills and person_languages. You'll meet this whenever someone puts two unrelated M:N relationships in one junction table.`},
{hl:{}, tb:[], g:[G('How far to go',['OLTP default','3NF (BCNF when it costs nothing)','ok'],['BCNF','when it doesn\'t break an important constraint'],['4NF/5NF','rare in practice; check junction tables'],['analytics','denormalized star schemas (3.6)'])],
 say:`<b>Say it:</b> "BCNF requires every determinant to be a superkey; it's stricter than 3NF, which allows a non-key determinant if the dependent column is part of a key. Decomposing to BCNF can lose dependency preservation, so 3NF is the usual practical target. 4NF removes multivalued dependencies: independent lists stored together, which multiply rows."`}
],
keep:[`BCNF: every non-trivial FD's left side is a superkey. Stricter than 3NF.`,`3NF but not BCNF: overlapping candidate keys + a non-key determinant (tutor → subject).`,`BCNF decomposition is lossless but may not preserve dependencies; 3NF always can.`,`4NF: no independent multivalued facts in one table (skills × languages).`]}, {
  imp: 'good',
  theory: TH(`BCNF tightens 3NF by requiring every determinant to be a key; 4NF removes independent multi-valued facts stored in the same table.`,
`<p>3NF fixes most redundancy, but it has a loophole: it only polices columns that aren't part of any key. When a table has overlapping candidate keys, a column that is part of one key can still depend on something that isn't a key, and facts repeat. BCNF closes that loophole: "if something determines something else, it must be a key".</p>
<p>4NF deals with a different smell: two independent lists jammed into one table, like a person's skills and their languages. Every combination has to be stored, so the table grows like a multiplication table.</p>`,
[[`BCNF`,`For every non-trivial FD X → Y, X is a superkey.`],[`Dependency preservation`,`Every FD can be checked within a single table after decomposition.`],[`Multivalued dependency (MVD)`,`X ↠ Y: the set of Y values for an X is independent of other columns.`],[`4NF`,`BCNF and no non-trivial MVDs.`],[`5NF`,`No join dependencies beyond those implied by keys (rare).`]],
[`List FDs and candidate keys.`,`Find any FD whose determinant isn't a superkey: BCNF violation.`,`Decompose into (X ∪ Y) and (original − Y), repeat.`,`Look for independent multi-valued attributes and split them (4NF).`],
[`Most well-designed OLTP schemas are in BCNF without anyone trying.`,`4NF problems show up as junction tables with three foreign keys that aren't truly a ternary relationship.`,`Knowing the trade-off lets you justify stopping at 3NF.`],
[`Combining unrelated many-to-many relationships into one table.`,`Claiming BCNF is always better without mentioning lost dependency preservation.`,`Spending design time on 5NF in an application schema.`]),
  examples: [
    {lv:'basic', title:'BCNF decomposition in SQL', sql:`CREATE TABLE tutoring (student TEXT, subject TEXT, tutor TEXT, PRIMARY KEY (student, subject));
INSERT INTO tutoring VALUES ('Aditi','Math','Dr. Shah'), ('Bilal','Math','Dr. Shah'),
                            ('Aditi','Physics','Dr. Rao'), ('Carmen','Math','Dr. Kapoor');
CREATE TABLE tutors AS SELECT DISTINCT tutor, subject FROM tutoring;
SELECT * FROM tutors;`, why:`tutor → subject now lives in its own table, once per tutor.`},
    {lv:'mid', title:'Detect a BCNF violation: a non-key determinant', sql:`CREATE TABLE tutoring (student TEXT, subject TEXT, tutor TEXT);
INSERT INTO tutoring VALUES ('Aditi','Math','Dr. Shah'), ('Bilal','Math','Dr. Shah'), ('Aditi','Physics','Dr. Rao');
SELECT tutor, COUNT(DISTINCT subject) AS subjects, COUNT(*) AS rows_repeating_it
FROM tutoring GROUP BY tutor;`, why:`tutor determines subject (1 subject each), yet the fact is repeated per student: the redundancy BCNF removes.`},
    {lv:'adv', title:'4NF: split independent lists', sql:`CREATE TABLE psl (person TEXT, skill TEXT, language TEXT);
INSERT INTO psl VALUES ('Ana','SQL','English'),('Ana','SQL','Hindi'),('Ana','Go','English'),('Ana','Go','Hindi');
CREATE TABLE person_skills    AS SELECT DISTINCT person, skill FROM psl;
CREATE TABLE person_languages AS SELECT DISTINCT person, language FROM psl;
SELECT (SELECT COUNT(*) FROM psl) AS before_rows,
       (SELECT COUNT(*) FROM person_skills) + (SELECT COUNT(*) FROM person_languages) AS after_rows;`, why:`4 rows become 2 + 2. With 10 skills and 5 languages it'd be 50 rows vs 15.`},
  ],
  tips: {
    say:`"BCNF says every determinant must be a superkey, which catches redundancy 3NF allows when a key column depends on a non-key column. The catch is that BCNF decompositions can lose dependency preservation, so I treat 3NF as the practical default. 4NF removes multivalued dependencies, independent lists in one table."`,
    points:[`Have the tutor/subject (or student/course/instructor) example ready.`,`Mention dependency preservation as the reason to stop at 3NF.`,`Recognise 4NF smells in junction tables.`],
    traps:[`Saying 3NF and BCNF are the same thing.`,`Over-engineering: insisting on 5NF in an interview design question.`],
    qa:[[`Example of 3NF but not BCNF?`,`tutoring(student, subject, tutor) with tutor → subject and keys (student, subject), (student, tutor).`],
        [`Is every BCNF table in 3NF?`,`Yes. BCNF is strictly stronger.`],
        [`What's a multivalued dependency?`,`X ↠ Y when, for a given X, the set of Y values is independent of the other columns, e.g. a person's skills are independent of their languages.`]]
  },
  exercises: [
    {lv:'E', q:`In the school data, list each instructor with the number of distinct courses they teach: <code>instructor, courses</code>.`, hint:`GROUP BY instructor.`,
     sql:`SELECT instructor, COUNT(DISTINCT code) AS courses FROM courses GROUP BY instructor;`},
    {lv:'M', q:`R(A, B, C) with FDs AB → C and C → B. Candidate keys? Is R in 3NF? In BCNF? Decompose if needed.`, hint:`Is C a superkey? Is B part of a key?`,
     answer:`<p>Keys: {A, B} and {A, C}. 3NF: yes, because C → B has B as a prime attribute. BCNF: no, C is not a superkey. Decompose into R1(C, B) and R2(A, C). AB → C is no longer checkable in one table (dependency not preserved).</p>`},
    {lv:'M', q:`A junction table <code>course_book_teacher(course, book, teacher)</code> stores which books a course uses and which teachers teach it; books and teachers are independent. What's wrong and how do you fix it?`, hint:`Multivalued dependencies.`,
     answer:`<p>course ↠ book and course ↠ teacher are independent, so every book × teacher combination is stored (4NF violation). Split into course_books(course, book) and course_teachers(course, teacher).</p>`},
  ],
  quiz: [
    [`BCNF requires that…`,[`All columns are atomic`,`Every determinant of a non-trivial FD is a superkey`,`No NULLs`,`Every table has a surrogate key`],1,`Stricter than 3NF.`,'E'],
    [`Every BCNF table is also in 3NF.`,[`True`,`False`,`Only with single-column keys`,`Only without NULLs`],0,`BCNF ⊂ 3NF.`,'E'],
    [`A table is 3NF but not BCNF typically when…`,[`It has no key`,`It has overlapping candidate keys and a non-key determinant`,`It has a repeating group`,`It has a partial dependency`],1,`tutor → subject.`,'M'],
    [`Downside of decomposing to BCNF?`,[`It can be lossy`,`It may not preserve all dependencies`,`It adds repeating groups`,`It breaks 1NF`],1,`Lossless is always achievable; preservation isn't.`,'M'],
    [`4NF deals with…`,[`Transitive dependencies`,`Multivalued dependencies`,`Atomicity`,`Indexes`],1,`Independent lists.`,'E'],
    [`person(skill, language) storing every combination is fixed by…`,[`Adding an index`,`Splitting into person_skills and person_languages`,`A CHECK constraint`,`Denormalizing`],1,`4NF.`,'M'],
  ],
  quizAdv: [
    [`R(A,B,C), AB → C, C → B. Which statement is right?`,[`Not 3NF`,`3NF but not BCNF`,`BCNF`,`Not 1NF`],1,`B is prime, C isn't a superkey.`,'H'],
    [`A 3NF decomposition that is lossless and dependency-preserving…`,[`Doesn't always exist`,`Always exists (synthesis algorithm)`,`Exists only with surrogate keys`,`Is the same as BCNF`],1,`Bernstein's synthesis.`,'H'],
    [`5NF (PJNF) concerns…`,[`Join dependencies not implied by candidate keys`,`NULL handling`,`Temporal data`,`Clustering`],0,`Rare in practice.`,'H'],
  ],
});
