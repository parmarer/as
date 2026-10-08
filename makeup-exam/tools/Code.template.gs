/**
 * สร้าง Google Form แบบทดสอบซ่อม (สอบแก้) รายวิชา การคิดเชิงคณิตศาสตร์
 *
 * ไฟล์นี้สร้างอัตโนมัติจาก exam_items.json (tools/build_code_gs.py)
 * หากต้องการแก้ข้อสอบ ให้แก้ exam_items.json แล้วสร้างไฟล์ใหม่ หรือแก้ค่าใน EXAM ด้านล่างโดยตรง
 *
 * วิธีใช้
 *   1) เปิด https://script.google.com แล้วเลือก "โปรเจ็กต์ใหม่"
 *   2) ลบโค้ดเดิม แล้ววางโค้ดทั้งหมดในไฟล์นี้
 *   3) เลือกฟังก์ชัน createMakeupExamForm แล้วกด "เรียกใช้" (อนุญาตสิทธิ์เมื่อระบบถาม)
 *   4) ดูลิงก์แบบฟอร์มที่ "บันทึกการดำเนินการ" (Execution log)
 *   5) หลังนักเรียนส่งคำตอบ ให้เรียก gradeShortAnswers() เพื่อตรวจข้อเขียนตอบสั้นอัตโนมัติ
 */

// ---------------------------------------------------------------------------
// การตั้งค่า
// ---------------------------------------------------------------------------
const CONFIG = {
  COLLECT_EMAIL: true,        // เก็บอีเมลผู้ตอบ (ผู้ตอบต้องกรอก/ลงชื่อเข้าใช้ Google)
  ADD_NAME_AND_ID: true,      // เพิ่มช่อง ชื่อ-สกุล และ เลขประจำตัว (บังคับกรอก)
  ADD_FEEDBACK: false,        // true = แสดงเหตุผลเฉลยให้นักเรียนเห็นหลังตรวจ
  SHOW_PROGRESS_BAR: true,    // แสดงแถบความคืบหน้า
  CONFIRMATION_MESSAGE: 'ส่งคำตอบเรียบร้อยแล้ว ขอบคุณที่เข้าสอบ',
};

// ---------------------------------------------------------------------------
// ข้อมูลข้อสอบ (สร้างจาก exam_items.json)
// ---------------------------------------------------------------------------
const EXAM = __EXAM_JSON__;

// ---------------------------------------------------------------------------
// ฟังก์ชันหลัก: สร้างแบบฟอร์ม
// ---------------------------------------------------------------------------
function createMakeupExamForm() {
  validateExam_(EXAM);

  const totalPoints = totalPoints_(EXAM);
  const form = FormApp.create(EXAM.title);

  form.setDescription(buildDescription_(EXAM, totalPoints));
  form.setIsQuiz(true);
  form.setShuffleQuestions(false);
  form.setProgressBar(CONFIG.SHOW_PROGRESS_BAR);
  form.setConfirmationMessage(CONFIG.CONFIRMATION_MESSAGE);
  form.setAllowResponseEdits(false);
  if (CONFIG.COLLECT_EMAIL) {
    form.setCollectEmail(true);
  }

  if (CONFIG.ADD_NAME_AND_ID) {
    form.addTextItem().setTitle('ชื่อ-สกุล').setRequired(true);
    form.addTextItem().setTitle('เลขประจำตัว').setRequired(true);
  }

  // ตอนที่ 1: ปรนัยแบบเลือกตอบ (จัดกลุ่มตามหัวข้อ)
  const topicName = {};
  EXAM.topics.forEach(function (t) { topicName[t.id] = t.name; });

  form.addSectionHeaderItem()
      .setTitle('ตอนที่ 1 ปรนัยแบบเลือกตอบ (' + EXAM.mcq.length + ' ข้อ ข้อละ 1 คะแนน)')
      .setHelpText('เลือกคำตอบที่ถูกต้องที่สุดเพียง 1 คำตอบ');

  let currentTopic = null;
  EXAM.mcq.forEach(function (q, idx) {
    if (q.topic !== currentTopic) {
      currentTopic = q.topic;
      const num = currentTopic.replace(/\D/g, '');
      form.addSectionHeaderItem().setTitle('หัวข้อ ' + num + ': ' + topicName[currentTopic]);
    }
    addChoiceQuestion_(form, q);
  });

  // ตอนที่ 2: เขียนตอบสั้น
  form.addSectionHeaderItem()
      .setTitle('ตอนที่ 2 เขียนตอบสั้น (' + EXAM.short.length + ' ข้อ)')
      .setHelpText('พิมพ์คำตอบเป็นตัวเลขเท่านั้น (ไม่ต้องใส่หน่วย)');

  EXAM.short.forEach(function (s) {
    addShortQuestion_(form, s);
  });

  PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());

  Logger.log('สร้างแบบฟอร์มเรียบร้อย: %s ข้อเลือกตอบ + %s ข้อเขียนตอบสั้น = %s คะแนน',
             EXAM.mcq.length, EXAM.short.length, totalPoints);
  Logger.log('ลิงก์แก้ไข (สำหรับผู้สอน): %s', form.getEditUrl());
  Logger.log('ลิงก์ให้นักเรียนตอบ: %s', form.getPublishedUrl());
  Logger.log('ข้อควรตรวจในหน้า Settings > Quizzes: ตั้ง "Release grade" ตามต้องการ');
  return form.getEditUrl();
}

// ---------------------------------------------------------------------------
// ตรวจข้อเขียนตอบสั้นอัตโนมัติ (เรียกหลังมีผู้ส่งคำตอบ)
// ---------------------------------------------------------------------------
function gradeShortAnswers() {
  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) {
    throw new Error('ไม่พบ FORM_ID กรุณารัน createMakeupExamForm() ก่อน');
  }
  const form = FormApp.openById(formId);

  const byTitle = {};
  EXAM.short.forEach(function (s) { byTitle[questionTitle_(s)] = s; });

  const responses = form.getResponses();
  let graded = 0;
  let failed = 0;

  responses.forEach(function (fr) {
    fr.getItemResponses().forEach(function (ir) {
      const spec = byTitle[ir.getItem().getTitle()];
      if (!spec) { return; }
      const given = parseNumber_(ir.getResponse());
      const correct = spec.acceptedAnswers.some(function (a) {
        return given !== null && Math.abs(parseNumber_(a) - given) < 1e-9;
      });
      try {
        ir.setScore(correct ? spec.points : 0);
        fr.withItemGrade(ir);
        graded++;
      } catch (e) {
        failed++;
        Logger.log('ให้คะแนนไม่สำเร็จ (%s): %s', spec.no, e);
      }
    });
  });

  if (graded > 0) {
    form.submitGrades(responses);
  }
  Logger.log('ตรวจข้อเขียนตอบสั้นแล้ว %s คำตอบ (ไม่สำเร็จ %s) จากผู้ส่ง %s ราย',
             graded, failed, responses.length);
}

// ---------------------------------------------------------------------------
// ฟังก์ชันช่วย
// ---------------------------------------------------------------------------
function questionTitle_(q) {
  return q.no + '. ' + q.q;
}

function addChoiceQuestion_(form, q) {
  const item = form.addMultipleChoiceItem();
  item.setTitle(questionTitle_(q));
  item.setChoices(q.options.map(function (text, i) {
    return item.createChoice(text, i === q.answerIndex);
  }));
  item.setPoints(q.points);
  item.setRequired(true);
  if (CONFIG.ADD_FEEDBACK && q.rationale) {
    const fb = FormApp.createFeedback().setText(q.rationale).build();
    item.setFeedbackForCorrect(fb);
    item.setFeedbackForIncorrect(fb);
  }
  return item;
}

function addShortQuestion_(form, s) {
  const item = form.addTextItem();
  item.setTitle(questionTitle_(s));
  item.setHelpText('(' + s.points + ' คะแนน) ตอบเป็นตัวเลขเท่านั้น');
  item.setRequired(true);
  item.setValidation(FormApp.createTextValidation()
      .setHelpText('กรุณาตอบเป็นตัวเลข')
      .requireNumber()
      .build());
  // Apps Script รุ่นที่รองรับจะกำหนดคะแนนได้; รุ่นที่ไม่รองรับจะข้ามไป (ใช้ gradeShortAnswers แทน)
  if (typeof item.setPoints === 'function') {
    item.setPoints(s.points);
  }
  return item;
}

function totalPoints_(exam) {
  const sum = function (arr) {
    return arr.reduce(function (acc, q) { return acc + q.points; }, 0);
  };
  return sum(exam.mcq) + sum(exam.short);
}

function buildDescription_(exam, total) {
  const mcqPts = exam.mcq.reduce(function (a, q) { return a + q.points; }, 0);
  const shortPts = exam.short.reduce(function (a, q) { return a + q.points; }, 0);
  return [
    'รายวิชา การคิดเชิงคณิตศาสตร์ ภาคเรียนที่ 1 ปีการศึกษา 2569',
    '',
    'คำชี้แจง',
    '1. แบบทดสอบมี 2 ตอน คะแนนเต็ม ' + total + ' คะแนน',
    '2. ตอนที่ 1 ปรนัยแบบเลือกตอบ ' + exam.mcq.length + ' ข้อ (' + mcqPts + ' คะแนน) เลือกคำตอบที่ถูกต้องที่สุดเพียง 1 คำตอบ',
    '3. ตอนที่ 2 เขียนตอบสั้น ' + exam.short.length + ' ข้อ (' + shortPts + ' คะแนน) พิมพ์คำตอบเป็นตัวเลข',
    '4. ตอบทุกข้อ และตรวจสอบคำตอบก่อนกดส่ง',
  ].join('\n');
}

// รองรับเลขไทย และเครื่องหมายจุลภาคเป็นจุดทศนิยม
function parseNumber_(value) {
  if (value === null || value === undefined) { return null; }
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  const s = String(value).trim().replace(/[๐-๙]/g, function (c) {
    return String(thaiDigits.indexOf(c));
  }).replace(',', '.');
  if (s === '' || isNaN(Number(s))) { return null; }
  return Number(s);
}

// ตรวจความถูกต้องของข้อมูลก่อนสร้างแบบฟอร์ม
function validateExam_(exam) {
  const errors = [];
  exam.mcq.forEach(function (q) {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push('ข้อ ' + q.no + ': ต้องมี 4 ตัวเลือก');
      return;
    }
    if (!(q.answerIndex >= 0 && q.answerIndex < q.options.length)) {
      errors.push('ข้อ ' + q.no + ': answerIndex ไม่ถูกต้อง');
    }
    if (new Set(q.options).size !== q.options.length) {
      errors.push('ข้อ ' + q.no + ': มีตัวเลือกซ้ำกัน');
    }
    if (!(q.points > 0)) {
      errors.push('ข้อ ' + q.no + ': คะแนนต้องมากกว่า 0');
    }
  });
  exam.short.forEach(function (s) {
    if (!Array.isArray(s.acceptedAnswers) || s.acceptedAnswers.length === 0) {
      errors.push('ข้อ ' + s.no + ': ไม่มีเฉลย');
    } else if (s.acceptedAnswers.some(function (a) { return parseNumber_(a) === null; })) {
      errors.push('ข้อ ' + s.no + ': เฉลยต้องเป็นตัวเลข');
    }
  });
  if (errors.length > 0) {
    throw new Error('ข้อมูลข้อสอบไม่ถูกต้อง:\n' + errors.join('\n'));
  }
}
