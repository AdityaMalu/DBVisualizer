/* ---------- content registry: parts, datasets and topics register here.
   The engine reads PARTS, DATASETS and the per-topic STUDY material (theory, examples, tips, exercises, quizzes). ---------- */
const PARTS = [];
const DATASETS = {};
const QUIZ = {}, QUIZ_ADV = {}, THEORY = {}, IMP = {}, EXAMPLES = {}, TIPS = {}, EXERCISES = {};

function part(no, title) { PARTS.push({ no, title, topics: [] }); }

/* dataset(name, title, sql): a small SQLite database that examples and exercises run against.
   Every run starts from a fresh copy, so nothing a reader does can break the next run. */
function dataset(name, title, sql) { DATASETS[name] = { name, title, sql }; }

/* topic(partNo, walkthrough, study)
   walkthrough: { no, title, idea, codes, steps, keep, db?, ... } drives the stepper.
     db: the default dataset for this topic's examples and exercises.
   study: {
     imp: 'must'|'good'|'extra',
     theory:    TH(...),
     examples:  [ {lv:'basic'|'mid'|'adv', title, sql, why, db?, run?, err?} ]   simple → complex; runnable when a dataset applies;
                                                                         err: the example demonstrates an error
     tips:      { say, points:[…], traps:[…], qa:[[question, answer], …] }
     exercises: [ {lv:'E'|'M'|'H', q, hint, sql?, ordered?, answer?, db?} ]  sql = checked against the reader's query; answer = written solution
     quiz:      [ [question, [a, b, c, d], answerIndex, why, 'E'|'M'|'H'], … ]   at least 3
     quizAdv:   [ … ]                                                            at least 2
   } */
function topic(partNo, walk, study = {}) {
  const p = PARTS.find(x => x.no === partNo);
  if (!p) throw new Error(`Topic ${walk.no}: unknown part ${partNo}`);
  p.topics.push(walk);
  if (study.imp) IMP[walk.no] = study.imp;
  if (study.theory) THEORY[walk.no] = study.theory;
  EXAMPLES[walk.no] = study.examples || [];
  TIPS[walk.no] = study.tips || null;
  EXERCISES[walk.no] = study.exercises || [];
  QUIZ[walk.no] = study.quiz || [];
  QUIZ_ADV[walk.no] = study.quizAdv || [];
}

/* ---------- helpers for building step state ---------- */
const G = (t, ...r) => ({ t, r });
const C = (k, c, f) => ({ k, c, f });
/* TB(title, columns, rows, flags): a table snapshot. flags maps a row index to hot | ok | bad | dim | new. */
const TB = (t, cols, rows, f = {}) => ({ t, cols, rows, f });

/* ---------- theory: a from-zero explanation per topic.
   TH(one-line idea, intro html, [[term, meaning]], [how it works steps], [in real projects], [common mistakes]) ---------- */
const TH = (one, intro, terms, steps, practice, mistakes) => ({one, intro, terms, steps, practice, mistakes});
