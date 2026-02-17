import { getDb } from "../../db";

export function getClassesForUser(userId: number, isAdmin: boolean) {
  const db = getDb();
  if (isAdmin) {
    return db.prepare("SELECT * FROM classes ORDER BY grade, name, section").all();
  }
  return db
    .prepare(
      "SELECT DISTINCT c.* FROM classes c INNER JOIN teacher_assignments ta ON ta.class_id = c.id INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id WHERE tp.user_id = ? AND ta.is_active = 1 ORDER BY c.grade, c.name, c.section"
    )
    .all(userId);
}

export function getAcademicYears() {
  const db = getDb();
  return db
    .prepare("SELECT id, name, start_date, end_date, is_active FROM academic_years ORDER BY start_date DESC")
    .all();
}

export function getSubjectsForUser(userId: number, isAdmin: boolean) {
  const db = getDb();
  if (isAdmin) {
    return db.prepare("SELECT * FROM subjects ORDER BY name").all();
  }
  return db
    .prepare(
      "SELECT DISTINCT s.* FROM subjects s INNER JOIN teacher_assignments ta ON ta.subject_id = s.id INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id WHERE tp.user_id = ? AND ta.is_active = 1 ORDER BY s.name"
    )
    .all(userId);
}

export function getStudentsForClass(userId: number, classId: number, isAdmin: boolean) {
  const db = getDb();
  if (!isAdmin) {
    const allowed = db
      .prepare(
        "SELECT 1 FROM teacher_assignments ta INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id WHERE tp.user_id = ? AND ta.class_id = ? AND ta.is_active = 1 LIMIT 1"
      )
      .get(userId, classId);
    if (!allowed) return [];
  }

  return db
    .prepare("SELECT * FROM students WHERE class_id = ? AND status = 'active' ORDER BY roll_no, first_name")
    .all(classId);
}

export function getAssignments(userId: number, isAdmin: boolean) {
  const db = getDb();
  if (isAdmin) {
    return db.prepare("SELECT * FROM teacher_assignments WHERE is_active = 1").all();
  }
  return db
    .prepare(
      "SELECT ta.id, ta.class_id, ta.subject_id, ta.assignment_role FROM teacher_assignments ta INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id WHERE tp.user_id = ? AND ta.is_active = 1"
    )
    .all(userId);
}

const EXAM_TYPES = ["Unit", "Mid", "Final", "Practical"] as const;

function normalizeSubjectCode(name: string) {
  const base = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (base.length >= 4) return base.slice(0, 4);
  if (base.length >= 3) return base;
  return (base + "SUB").slice(0, 3);
}

function generateSubjectCode(name: string, existing: Set<string>) {
  let base = normalizeSubjectCode(name);
  if (!existing.has(base)) return base;
  let counter = 1;
  while (existing.has(`${base}${counter}`)) {
    counter += 1;
  }
  return `${base}${counter}`;
}

export function getClassSubjects(classId: number) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT cs.id as class_subject_id, cs.is_optional, s.id as subject_id, s.name, s.code FROM class_subjects cs INNER JOIN subjects s ON s.id = cs.subject_id WHERE cs.class_id = ? ORDER BY s.name"
    )
    .all(classId) as Array<{
    class_subject_id: number;
    is_optional: number;
    subject_id: number;
    name: string;
    code: string;
  }>;

  const classSubjectIds = rows.map((row) => row.class_subject_id);
  const rulesMap = new Map<number, Record<string, number>>();

  if (classSubjectIds.length) {
    const placeholders = classSubjectIds.map(() => "?").join(",");
    const rules = db
      .prepare(
        `SELECT class_subject_id, exam_type, max_marks FROM class_subject_exam_rules WHERE class_subject_id IN (${placeholders})`
      )
      .all(...classSubjectIds) as Array<{ class_subject_id: number; exam_type: string; max_marks: number }>;

    for (const rule of rules) {
      const current = rulesMap.get(rule.class_subject_id) || {};
      current[rule.exam_type] = rule.max_marks;
      rulesMap.set(rule.class_subject_id, current);
    }
  }

  return rows.map((row) => ({
    class_subject_id: row.class_subject_id,
    subject_id: row.subject_id,
    name: row.name,
    code: row.code,
    is_optional: Boolean(row.is_optional),
    max_marks: rulesMap.get(row.class_subject_id) || {}
  }));
}

export function getClassSubjectMeta(classId: number, subjectId: number) {
  const db = getDb();
  return db
    .prepare("SELECT id, is_optional FROM class_subjects WHERE class_id = ? AND subject_id = ?")
    .get(classId, subjectId) as { id: number; is_optional: number } | undefined;
}

export function upsertClassSubject(input: {
  classId: number;
  subjectName: string;
  subjectCode?: string | null;
  isOptional?: boolean;
  maxMarks?: Partial<Record<(typeof EXAM_TYPES)[number], number>>;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  const classRow = db.prepare("SELECT grade FROM classes WHERE id = ?").get(input.classId) as
    | { grade: number }
    | undefined;
  if (!classRow) {
    throw new Error("Class not found");
  }

  let subject =
    (input.subjectCode
      ? db.prepare("SELECT id, name, code FROM subjects WHERE code = ?").get(input.subjectCode)
      : undefined) ||
    db.prepare("SELECT id, name, code FROM subjects WHERE lower(name) = lower(?) LIMIT 1").get(input.subjectName);

  if (!subject) {
    const existingCodes = new Set(
      (db.prepare("SELECT code FROM subjects").all() as Array<{ code: string }>).map((row) => row.code)
    );
    const code = input.subjectCode?.trim() || generateSubjectCode(input.subjectName, existingCodes);
    const result = db
      .prepare("INSERT INTO subjects (name, code, grade_from, grade_to) VALUES (?, ?, ?, ?)")
      .run(input.subjectName, code, classRow.grade, classRow.grade);
    subject = { id: Number(result.lastInsertRowid), name: input.subjectName, code };
  }

  db.prepare(
    "INSERT OR IGNORE INTO class_subjects (class_id, subject_id, is_optional, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(input.classId, subject.id, input.isOptional ? 1 : 0, now, now);

  db.prepare("UPDATE class_subjects SET is_optional = ?, updated_at = ? WHERE class_id = ? AND subject_id = ?").run(
    input.isOptional ? 1 : 0,
    now,
    input.classId,
    subject.id
  );

  const classSubject = db
    .prepare("SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ?")
    .get(input.classId, subject.id) as { id: number } | undefined;

  if (classSubject && input.maxMarks) {
    for (const examType of EXAM_TYPES) {
      const value = input.maxMarks[examType];
      if (!value || value <= 0) continue;
      db.prepare(
        "INSERT OR REPLACE INTO class_subject_exam_rules (class_subject_id, exam_type, max_marks, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).run(classSubject.id, examType, value, now, now);
    }
  }

  return { classSubjectId: classSubject?.id, subject };
}

export function setStudentSubjectEnrollment(input: {
  studentId: number;
  classSubjectId: number;
  isEnrolled: boolean;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT OR IGNORE INTO student_subjects (student_id, class_subject_id, is_enrolled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(input.studentId, input.classSubjectId, input.isEnrolled ? 1 : 0, now, now);

  db.prepare(
    "UPDATE student_subjects SET is_enrolled = ?, updated_at = ? WHERE student_id = ? AND class_subject_id = ?"
  ).run(input.isEnrolled ? 1 : 0, now, input.studentId, input.classSubjectId);
}
