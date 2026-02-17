import { getDb } from "../../db";

export async function getStudentTimeline(studentId: number) {
  const db = getDb();
  const marks = await db
    .prepare(
      "SELECT exam_id, subject_id, marks_obtained, max_marks, created_at FROM marks_entries WHERE student_id = ? ORDER BY created_at"
    )
    .all(studentId);
  const attendance = await db
    .prepare(
      "SELECT s.date, ae.status FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id WHERE ae.student_id = ? ORDER BY s.date"
    )
    .all(studentId);

  return { marks, attendance };
}

export async function addNote(input: { teacherId: number; studentId: number; note: string; isFlagged?: boolean }) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      "INSERT INTO teacher_notes (teacher_id, student_id, note, is_flagged, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(input.teacherId, input.studentId, input.note, input.isFlagged ? 1 : 0, now, now);
  return Number(result.lastInsertRowid);
}

export async function updateNote(noteId: number, input: { note: string; isFlagged?: boolean }) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.prepare("UPDATE teacher_notes SET note = ?, is_flagged = ?, updated_at = ? WHERE id = ?").run(
    input.note,
    input.isFlagged ? 1 : 0,
    now,
    noteId
  );
}
