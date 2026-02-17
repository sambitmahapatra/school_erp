import { getDb } from "../../db";
import { logActivity } from "../activity";

export type AttendanceEntryInput = {
  studentId: number;
  status: string;
  reason?: string | null;
};

export async function listSessions(filters: { date?: string; classId?: number; subjectId?: number }) {
  const db = getDb();
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.date) {
    clauses.push("date = ?");
    params.push(filters.date);
  }
  if (filters.classId) {
    clauses.push("class_id = ?");
    params.push(filters.classId);
  }
  if (filters.subjectId) {
    clauses.push("subject_id = ?");
    params.push(filters.subjectId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM attendance_sessions ${where} ORDER BY date DESC`).all(...params);
}

export async function createSession(input: {
  date: string;
  classId: number;
  subjectId?: number | null;
  teacherId: number;
  userId: number;
}) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO attendance_sessions (date, class_id, subject_id, teacher_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)"
  );
  const now = new Date().toISOString();
  const result = await stmt.run(input.date, input.classId, input.subjectId || null, input.teacherId, now, now);
  await logActivity(input.userId, "attendance.session.create", "attendance_session", Number(result.lastInsertRowid));
  return Number(result.lastInsertRowid);
}

export async function updateSessionStatus(sessionId: number, status: "draft" | "submitted") {
  const db = getDb();
  const now = new Date().toISOString();
  await db.prepare("UPDATE attendance_sessions SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now,
    sessionId
  );
}

export async function bulkUpsertEntries(input: {
  sessionId: number;
  entries: AttendanceEntryInput[];
  updatedBy: number;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const selectStmt = tx.prepare("SELECT id, status FROM attendance_entries WHERE session_id = ? AND student_id = ?");
    const insertStmt = tx.prepare(
      "INSERT INTO attendance_entries (session_id, student_id, status, reason, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const updateStmt = tx.prepare(
      "UPDATE attendance_entries SET status = ?, reason = ?, updated_by = ?, updated_at = ? WHERE id = ?"
    );
    const auditStmt = tx.prepare(
      "INSERT INTO attendance_audit (entry_id, old_status, new_status, reason, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)"
    );

    for (const entry of input.entries) {
      const existing = (await selectStmt.get(input.sessionId, entry.studentId)) as
        | { id: number; status: string }
        | undefined;

      if (!existing) {
        await insertStmt.run(
          input.sessionId,
          entry.studentId,
          entry.status,
          entry.reason || null,
          input.updatedBy,
          now
        );
        continue;
      }

      if (existing.status !== entry.status) {
        await auditStmt.run(existing.id, existing.status, entry.status, entry.reason || null, input.updatedBy, now);
      }

      await updateStmt.run(entry.status, entry.reason || null, input.updatedBy, now, existing.id);
    }
  });
}

export async function getClassAttendanceSummary(classId: number, month: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT date, AVG(CASE WHEN ae.status = 'present' THEN 1.0 ELSE 0.0 END) AS present_rate FROM attendance_sessions s INNER JOIN attendance_entries ae ON ae.session_id = s.id WHERE s.class_id = ? AND substr(s.date, 1, 7) = ? GROUP BY date ORDER BY date"
    )
    .all(classId, month);
}

export async function getStudentAttendanceHistory(studentId: number) {
  const db = getDb();
  return db
    .prepare(
      "SELECT s.date, ae.status FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id WHERE ae.student_id = ? ORDER BY s.date"
    )
    .all(studentId);
}

export async function updateEntry(entryId: number, input: { status: string; reason?: string | null; updatedBy: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = (await db.prepare("SELECT id, status FROM attendance_entries WHERE id = ?").get(entryId)) as
    | { id: number; status: string }
    | undefined;

  if (!existing) return;

  if (existing.status !== input.status) {
    await db
      .prepare(
        "INSERT INTO attendance_audit (entry_id, old_status, new_status, reason, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(existing.id, existing.status, input.status, input.reason || null, input.updatedBy, now);
  }

  await db
    .prepare("UPDATE attendance_entries SET status = ?, reason = ?, updated_by = ?, updated_at = ? WHERE id = ?")
    .run(input.status, input.reason || null, input.updatedBy, now, entryId);
}
