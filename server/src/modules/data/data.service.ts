import { parse } from "csv-parse/sync";
import { getDb } from "../../db";
import { logActivity } from "../activity";

export type StudentImportMode = "append" | "replace";

export type ImportError = {
  row: number;
  message: string;
};

export type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
};

export type ClearScope = "attendance" | "marks" | "students";

export type ClearResult = {
  scope: ClearScope;
  counts: {
    attendanceSessions?: number;
    attendanceEntries?: number;
    attendanceAudit?: number;
    marksEntries?: number;
    notes?: number;
    students?: number;
  };
};

type StudentRow = {
  rowNumber: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  class_grade: number;
  section: string;
  class_name?: string;
  roll_no?: number | null;
  status: string;
};

function normalizeSection(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeName(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function parseCsv(csv: string) {
  const clean = csv.replace(/^\uFEFF/, "");
  return parse(clean, { columns: true, skip_empty_lines: true, trim: true });
}

async function clearAttendance(db: ReturnType<typeof getDb>, classId: number) {
  const audit = (await db
    .prepare(
      "DELETE FROM attendance_audit WHERE entry_id IN (SELECT id FROM attendance_entries WHERE session_id IN (SELECT id FROM attendance_sessions WHERE class_id = ?))"
    )
    .run(classId)).changes;
  const entries = (await db
    .prepare("DELETE FROM attendance_entries WHERE session_id IN (SELECT id FROM attendance_sessions WHERE class_id = ?)")
    .run(classId)).changes;
  const sessions = (await db.prepare("DELETE FROM attendance_sessions WHERE class_id = ?").run(classId)).changes;
  return { audit: audit ?? 0, entries: entries ?? 0, sessions: sessions ?? 0 };
}

async function clearMarks(db: ReturnType<typeof getDb>, classId: number) {
  const marks = (await db.prepare("DELETE FROM marks_entries WHERE class_id = ?").run(classId)).changes;
  return { marks: marks ?? 0 };
}

async function clearNotes(db: ReturnType<typeof getDb>, classId: number) {
  const notes = (await db
    .prepare("DELETE FROM teacher_notes WHERE student_id IN (SELECT id FROM students WHERE class_id = ?)")
    .run(classId)).changes;
  return { notes: notes ?? 0 };
}

async function clearStudents(db: ReturnType<typeof getDb>, classId: number) {
  const attendance = await clearAttendance(db, classId);
  const marks = await clearMarks(db, classId);
  const notes = await clearNotes(db, classId);
  await db.prepare("DELETE FROM student_subjects WHERE student_id IN (SELECT id FROM students WHERE class_id = ?)").run(
    classId
  );
  const students = (await db.prepare("DELETE FROM students WHERE class_id = ?").run(classId)).changes;
  return {
    attendance,
    marks,
    notes,
    students: students ?? 0
  };
}

export async function importStudentsFromCsv(
  userId: number,
  classId: number,
  csv: string,
  mode: StudentImportMode
): Promise<ImportResult> {
  const db = getDb();
  const classRow = (await db
    .prepare("SELECT id, grade, section, name FROM classes WHERE id = ?")
    .get(classId)) as { id: number; grade: number; section: string; name: string } | undefined;

  if (!classRow) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, message: "Class not found." }]
    };
  }

  const rawRows = parseCsv(csv) as Record<string, string>[];
  const errors: ImportError[] = [];
  const rows: StudentRow[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // header row is 1
    const admission = String(row.admission_no || "").trim();
    const firstName = String(row.first_name || "").trim();
    const lastName = String(row.last_name || "").trim();
    const gradeValue = Number(row.class_grade || row.grade);
    const sectionValue = normalizeSection(row.section);
    const className = String(row.class_name || row.stream || row.class || "").trim();
    const rollValue = row.roll_no !== undefined && row.roll_no !== "" ? Number(row.roll_no) : null;
    const statusValue = String(row.status || "active").trim() || "active";

    if (!admission) {
      errors.push({ row: rowNumber, message: "Missing admission_no" });
      return;
    }
    if (!firstName || !lastName) {
      errors.push({ row: rowNumber, message: "Missing first_name or last_name" });
      return;
    }
    if (!gradeValue || Number.isNaN(gradeValue)) {
      errors.push({ row: rowNumber, message: "Missing or invalid class_grade" });
      return;
    }
    if (!sectionValue) {
      errors.push({ row: rowNumber, message: "Missing section" });
      return;
    }

    if (gradeValue !== classRow.grade || sectionValue !== normalizeSection(classRow.section)) {
      errors.push({
        row: rowNumber,
        message: `Class mismatch. Expected ${classRow.grade}${normalizeSection(classRow.section)} ${classRow.name}`
      });
      return;
    }

    if (className && normalizeName(className) !== normalizeName(classRow.name)) {
      errors.push({
        row: rowNumber,
        message: `Class stream mismatch. Expected ${classRow.name}`
      });
      return;
    }

    rows.push({
      rowNumber,
      admission_no: admission,
      first_name: firstName,
      last_name: lastName,
      class_grade: gradeValue,
      section: sectionValue,
      class_name: className || undefined,
      roll_no: rollValue,
      status: statusValue
    });
  });

  if (!rows.length) {
    return { inserted: 0, updated: 0, skipped: rawRows.length, errors };
  }

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    if (mode === "replace") {
      await clearStudents(tx, classId);
    }

    for (const row of rows) {
      const existing = (await tx
        .prepare("SELECT id, class_id FROM students WHERE admission_no = ?")
        .get(row.admission_no)) as { id: number; class_id: number } | undefined;

      if (existing && existing.class_id !== classId) {
        errors.push({
          row: row.rowNumber,
          message: `Admission no ${row.admission_no} already exists in another class.`
        });
        skipped += 1;
        continue;
      }

      if (existing) {
        await tx
          .prepare(
            "UPDATE students SET first_name = ?, last_name = ?, roll_no = ?, status = ?, updated_at = ? WHERE id = ?"
          )
          .run(row.first_name, row.last_name, row.roll_no ?? null, row.status, now, existing.id);
        updated += 1;
        continue;
      }

      await tx
        .prepare(
          "INSERT INTO students (admission_no, first_name, last_name, class_id, roll_no, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(row.admission_no, row.first_name, row.last_name, classId, row.roll_no ?? null, row.status, now, now);
      inserted += 1;
    }
  });

  await logActivity(userId, "students.import", "class", classId, `mode=${mode}; inserted=${inserted}; updated=${updated}`);

  return { inserted, updated, skipped, errors };
}

export async function clearClassData(userId: number, classId: number, scope: ClearScope): Promise<ClearResult> {
  const db = getDb();
  const counts: ClearResult["counts"] = {};

  await db.transaction(async (tx) => {
    if (scope === "attendance") {
      const attendance = await clearAttendance(tx, classId);
      counts.attendanceAudit = attendance.audit;
      counts.attendanceEntries = attendance.entries;
      counts.attendanceSessions = attendance.sessions;
      return;
    }

    if (scope === "marks") {
      const marks = await clearMarks(tx, classId);
      counts.marksEntries = marks.marks;
      return;
    }

    const attendance = await clearAttendance(tx, classId);
    const marks = await clearMarks(tx, classId);
    const notes = await clearNotes(tx, classId);
    const students = (await tx.prepare("DELETE FROM students WHERE class_id = ?").run(classId)).changes;

    counts.attendanceAudit = attendance.audit;
    counts.attendanceEntries = attendance.entries;
    counts.attendanceSessions = attendance.sessions;
    counts.marksEntries = marks.marks;
    counts.notes = notes.notes;
    counts.students = students ?? 0;
  });

  await logActivity(userId, `data.clear.${scope}`, "class", classId);

  return { scope, counts };
}
