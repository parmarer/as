// Runs Code.gs against a minimal in-memory mock of Apps Script's FormApp.
// This checks the script's own logic (structure, scoring, answer key, grading helper).
// It does NOT prove behaviour on real Google servers.
//   node tests/mock_formapp_test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
const exam = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'exam_items.json'), 'utf8'));

const props = {};
const logs = [];
let lastForm = null;

function chain(target, setters) {
  setters.forEach((name) => {
    target[name] = function (v) { target['_' + name] = v; return target; };
  });
  return target;
}

function makeItem(type) {
  const item = chain({ type }, ['setTitle', 'setHelpText', 'setRequired', 'setPoints',
    'setValidation', 'setFeedbackForCorrect', 'setFeedbackForIncorrect', 'setChoices']);
  item.createChoice = (value, correct) => ({ value, correct: !!correct });
  item.getTitle = () => item._setTitle;
  return item;
}

function makeForm(title) {
  const form = chain({ title, items: [], responses: [], submitted: null },
    ['setDescription', 'setIsQuiz', 'setShuffleQuestions', 'setProgressBar',
      'setConfirmationMessage', 'setAllowResponseEdits', 'setCollectEmail']);
  ['addTextItem', 'addMultipleChoiceItem', 'addSectionHeaderItem'].forEach((fn) => {
    const type = { addTextItem: 'TEXT', addMultipleChoiceItem: 'MC', addSectionHeaderItem: 'HEADER' }[fn];
    form[fn] = () => { const it = makeItem(type); form.items.push(it); return it; };
  });
  form.getId = () => 'FORM123';
  form.getEditUrl = () => 'https://docs.google.com/forms/d/FORM123/edit';
  form.getPublishedUrl = () => 'https://docs.google.com/forms/d/e/FORM123/viewform';
  form.getResponses = () => form.responses;
  form.submitGrades = (r) => { form.submitted = r; };
  return form;
}

const context = {
  Logger: { log: (...a) => logs.push(a.join(' ')) },
  PropertiesService: { getScriptProperties: () => ({
    setProperty: (k, v) => { props[k] = v; },
    getProperty: (k) => props[k] || null,
  }) },
  FormApp: {
    create: (t) => (lastForm = makeForm(t)),
    openById: () => lastForm,
    createFeedback: () => ({ setText(t) { this.t = t; return this; }, build() { return { text: this.t }; } }),
    createTextValidation: () => ({
      setHelpText(t) { this.h = t; return this; },
      requireNumber() { this.n = true; return this; },
      build() { return { helpText: this.h, number: this.n }; },
    }),
  },
};
vm.createContext(context);
vm.runInContext(code, context, { filename: 'Code.gs' });

// ---- 1) create form ----
const url = vm.runInContext('createMakeupExamForm()', context);
const f = lastForm;
assert.strictEqual(url, 'https://docs.google.com/forms/d/FORM123/edit');
assert.strictEqual(f._setIsQuiz, true);
assert.strictEqual(f._setShuffleQuestions, false);
assert.strictEqual(props.FORM_ID, 'FORM123');

const mc = f.items.filter((i) => i.type === 'MC');
const tx = f.items.filter((i) => i.type === 'TEXT');
assert.strictEqual(mc.length, 24, 'MCQ count');
assert.strictEqual(tx.length, 2 + 3, 'name + id + 3 short answers');
assert.strictEqual(tx[0]._setTitle, 'ชื่อ-สกุล');
assert.strictEqual(tx[0]._setRequired, true);

let total = 0;
mc.forEach((it, i) => {
  const q = exam.mcq[i];
  assert.ok(it._setTitle.startsWith(`${i + 1}. `), 'title numbering ' + (i + 1));
  const ch = it._setChoices;
  assert.strictEqual(ch.length, 4);
  assert.strictEqual(JSON.stringify(Array.from(ch, (c) => c.value)), JSON.stringify(q.options), 'options ' + (i + 1));
  assert.strictEqual(ch.filter((c) => c.correct).length, 1, 'one key ' + (i + 1));
  assert.strictEqual(ch.findIndex((c) => c.correct), q.answerIndex, 'key position ' + (i + 1));
  assert.strictEqual(it._setPoints, 1);
  assert.strictEqual(it._setRequired, true);
  assert.strictEqual(it._setFeedbackForCorrect, undefined, 'feedback off by default');
  total += it._setPoints;
});
const shortItems = tx.slice(2);
shortItems.forEach((it, j) => {
  assert.strictEqual(it._setPoints, 2);
  assert.ok(it._setValidation.number);
  total += it._setPoints;
});
assert.strictEqual(total, 30, 'total points');

const headers = f.items.filter((i) => i.type === 'HEADER').map((i) => i._setTitle);
assert.strictEqual(headers.length, 2 + 6, 'two parts + six topic headers');

// ---- 2) validation guard ----
assert.throws(() => {
  const bad = JSON.parse(JSON.stringify(exam));
  bad.mcq[0].options[1] = bad.mcq[0].options[0];
  vm.runInContext('validateExam_(' + JSON.stringify(bad) + ')', context);
}, /ตัวเลือกซ้ำ/);

// ---- 3) grading helper ----
function resp(titleNo, answer) {
  const title = shortItems[titleNo]._setTitle;
  const ir = { score: null, getItem: () => ({ getTitle: () => title }), getResponse: () => answer,
    setScore(s) { this.score = s; return this; } };
  return ir;
}
const fr1 = { irs: [resp(0, '19'), resp(1, '39'), resp(2, '0.08')] };
const fr2 = { irs: [resp(0, '19.5'), resp(1, '๓๙'), resp(2, '.08')] };
const fr3 = { irs: [resp(0, 'abc'), resp(1, '39,0'), resp(2, '0,09')] };
[fr1, fr2, fr3].forEach((fr) => {
  fr.getItemResponses = () => fr.irs;
  fr.withItemGrade = () => fr;
});
f.responses = [fr1, fr2, fr3];
vm.runInContext('gradeShortAnswers()', context);
assert.strictEqual(fr1.irs.map((i) => i.score).join(), '2,2,2');
assert.strictEqual(fr2.irs.map((i) => i.score).join(), '0,2,2');
assert.strictEqual(fr3.irs.map((i) => i.score).join(), '0,2,0');
assert.strictEqual(f.submitted.length, 3);

console.log('All mock checks passed:',
  `${mc.length} MCQ, ${shortItems.length} short, ${headers.length} headers, total ${total} points`);
