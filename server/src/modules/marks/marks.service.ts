import { getDb } from "../../db";
import { logActivity } from "../activity";
import { getClassSubjectMeta, setStudentSubjectEnrollment } from "../core/core.service";

export async function listExams(yearId?: number) {
  const db = getDb();
  if (yearId) {
    return db.prepare("SELECT * FROM exams WHERE academic_year_id = ? ORDER BY start_date DESC").all(yearId);
  }
  return db.prepare("SELECT * FROM exams ORDER BY start_date DESC").all();
}

export async function createExam(input: {
  academicYearId: number;
  termId?: number | null;
  name: string;
  examType: string;
  startDate?: string | null;
  endDate?: string | null;
  createdBy?: number;
}) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO exams (academic_year_id, term_id, name, exam_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const result = await stmt.run(
    input.academicYearId,
    input.termId || null,
    input.name,
    input.examType,
    input.startDate || null,
    input.endDate || null
  );
  if (input.createdBy) {
    await logActivity(input.createdBy, "exam.create", "exam", Number(result.lastInsertRowid));
  }
  return Number(result.lastInsertRowid);
}

export async function listComponents(examId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM exam_components WHERE exam_id = ?").all(examId);
}

export async function addComponent(input: { examId: number; name: string; maxMarks: number; weight?: number }) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO exam_components (exam_id, name, max_marks, weight) VALUES (?, ?, ?, ?)"
  );
  const result = await stmt.run(input.examId, input.name, input.maxMarks, input.weight ?? 1.0);
  return Number(result.lastInsertRowid);
}

export async function deleteExam(examId: number) {
  const db = getDb();
  const usage = (await db.prepare("SELECT COUNT(*) as count FROM marks_entries WHERE exam_id = ?").get(examId)) as
    | { count: number }
    | undefined;
  if (usage && usage.count > 0) {
    throw new Error("Cannot delete exam with existing marks.");
  }

  await db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM exam_components WHERE exam_id = ?").run(examId);
    await tx.prepare("DELETE FROM exams WHERE id = ?").run(examId);
  });
}

export async function bulkUpsertMarks(input: {
  examId: number;
  componentId?: number | null;
  classId: number;
  subjectId: number;
  teacherId: number;
  entries: Array<{
    studentId: number;
    maxMarks: number;
    marksObtained?: number | null;
    isAbsent?: boolean;
    isNotApplicable?: boolean;
  }>;
}) {
  const db = getDb();
  const classSubject = await getClassSubjectMeta(input.classId, input.subjectId);
  if (!classSubject) {
    throw new Error("Subject is not assigned to this class.");
  }
  const isOptional = Boolean(classSubject.is_optional);
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const selectStmt = tx.prepare(
      "SELECT id FROM marks_entries WHERE exam_id = ? AND component_id IS ? AND class_id = ? AND subject_id = ? AND student_id = ?"
    );
    const insertStmt = tx.prepare(
      "INSERT INTO marks_entries (exam_id, component_id, class_id, subject_id, student_id, teacher_id, max_marks, marks_obtained, is_absent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const updateStmt = tx.prepare(
      "UPDATE marks_entries SET max_marks = ?, marks_obtained = ?, is_absent = ?, updated_at = ? WHERE id = ?"
    );
    const deleteStmt = tx.prepare(
      "DELETE FROM marks_entries WHERE exam_id = ? AND component_id IS ? AND class_id = ? AND subject_id = ? AND student_id = ?"
    );
    for (const entry of input.entries) {
      if (entry.isNotApplicable) {
        if (isOptional) {
          await setStudentSubjectEnrollment({
            studentId: entry.studentId,
            classSubjectId: classSubject.id,
            isEnrolled: false
          });
          await deleteStmt.run(
            input.examId,
            input.componentId || null,
            input.classId,
            input.subjectId,
            entry.studentId
          );
        }
        continue;
      }

      if (isOptional) {
        await setStudentSubjectEnrollment({
          studentId: entry.studentId,
          classSubjectId: classSubject.id,
          isEnrolled: true
        });
      }

      const existing = (await selectStmt.get(
        input.examId,
        input.componentId || null,
        input.classId,
        input.subjectId,
        entry.studentId
      )) as { id: number } | undefined;

      if (!existing) {
        await insertStmt.run(
          input.examId,
          input.componentId || null,
          input.classId,
          input.subjectId,
          entry.studentId,
          input.teacherId,
          entry.maxMarks,
          entry.marksObtained ?? null,
          entry.isAbsent ? 1 : 0,
          now,
          now
        );
      } else {
        await updateStmt.run(
          entry.maxMarks,
          entry.marksObtained ?? null,
          entry.isAbsent ? 1 : 0,
          now,
          existing.id
        );
      }
    }
  });
}

export async function getMarks(filters: { examId: number; classId: number; subjectId: number }) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM marks_entries WHERE exam_id = ? AND class_id = ? AND subject_id = ? ORDER BY student_id")
    .all(filters.examId, filters.classId, filters.subjectId);
}

export async function getClassPerformance(examId: number, classId: number) {
  const db = getDb();
  return db
    .prepare(
      "SELECT subject_id, AVG(CASE WHEN is_absent = 1 THEN NULL ELSE marks_obtained END) AS avg_marks FROM marks_entries WHERE exam_id = ? AND class_id = ? GROUP BY subject_id"
    )
    .all(examId, classId);
}

export async function getStudentPerformance(studentId: number) {
  const db = getDb();
  return db
    .prepare(
      "SELECT exam_id, subject_id, marks_obtained, max_marks FROM marks_entries WHERE student_id = ? ORDER BY exam_id"
    )
    .all(studentId);
}
