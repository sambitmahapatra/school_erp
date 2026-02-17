import { getDb } from "../../db";

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes("\"") || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/\"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

export async function exportStudents(classId?: number) {
  const db = getDb();
  const rows = classId
    ? await db
        .prepare(
          "SELECT st.admission_no, st.first_name, st.last_name, st.roll_no, c.grade, c.section, c.name as class_name FROM students st INNER JOIN classes c ON c.id = st.class_id WHERE st.class_id = ? ORDER BY st.roll_no"
        )
        .all(classId)
    : await db
        .prepare(
          "SELECT st.admission_no, st.first_name, st.last_name, st.roll_no, c.grade, c.section, c.name as class_name FROM students st INNER JOIN classes c ON c.id = st.class_id ORDER BY c.grade, c.section, st.roll_no"
        )
        .all();

  const csv = toCsv(
    ["admission_no", "first_name", "last_name", "roll_no", "grade", "section", "class_name"],
    rows.map((r: any) => [r.admission_no, r.first_name, r.last_name, r.roll_no, r.grade, r.section, r.class_name])
  );

  return { filename: "students.csv", csv };
}

export async function exportAttendance(filters: { date?: string; classId?: number; subjectId?: number }) {
  const db = getDb();
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.date) {
    clauses.push("s.date = ?");
    params.push(filters.date);
  }
  if (filters.classId) {
    clauses.push("s.class_id = ?");
    params.push(filters.classId);
  }
  if (filters.subjectId) {
    clauses.push("s.subject_id = ?");
    params.push(filters.subjectId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await db
    .prepare(
      `SELECT s.date, c.name as class_name, sb.name as subject_name, st.admission_no, st.first_name, st.last_name, ae.status, ae.reason FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id INNER JOIN students st ON st.id = ae.student_id INNER JOIN classes c ON c.id = s.class_id LEFT JOIN subjects sb ON sb.id = s.subject_id ${where} ORDER BY s.date DESC, c.grade, c.section, st.roll_no`
    )
    .all(...params);

  const csv = toCsv(
    ["date", "class", "subject", "admission_no", "first_name", "last_name", "status", "reason"],
    rows.map((r: any) => [r.date, r.class_name, r.subject_name || "", r.admission_no, r.first_name, r.last_name, r.status, r.reason || ""])
  );

  return { filename: "attendance.csv", csv };
}

export async function exportMarks(filters: { examId: number; classId: number; subjectId: number }) {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT e.name as exam_name, e.exam_type, c.name as class_name, sb.name as subject_name,
        st.admission_no, st.first_name, st.last_name, st.roll_no,
        me.max_marks as entry_max_marks, me.marks_obtained, me.is_absent,
        cs.is_optional, ss.is_enrolled, r.max_marks as rule_max_marks
      FROM students st
      INNER JOIN classes c ON c.id = st.class_id
      INNER JOIN exams e ON e.id = ?
      INNER JOIN subjects sb ON sb.id = ?
      LEFT JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = sb.id
      LEFT JOIN student_subjects ss ON ss.student_id = st.id AND ss.class_subject_id = cs.id
      LEFT JOIN class_subject_exam_rules r ON r.class_subject_id = cs.id AND r.exam_type = e.exam_type
      LEFT JOIN marks_entries me
        ON me.student_id = st.id
        AND me.exam_id = e.id
        AND me.class_id = c.id
        AND me.subject_id = sb.id
      WHERE st.class_id = ? AND st.status = 'active'
      ORDER BY st.roll_no`
    )
    .all(filters.examId, filters.subjectId, filters.classId);

  const csv = toCsv(
    ["exam", "class", "subject", "admission_no", "first_name", "last_name", "max_marks", "marks_obtained", "is_absent"],
    rows.map((r: any) => {
      const notApplicable = r.is_optional && r.is_enrolled === 0;
      const maxMarks = r.entry_max_marks ?? r.rule_max_marks ?? "";
      const marksValue = notApplicable ? "NA" : r.marks_obtained ?? "";
      const absentValue = notApplicable ? "" : r.is_absent ? "true" : "false";
      return [
        r.exam_name,
        r.class_name,
        r.subject_name,
        r.admission_no,
        r.first_name,
        r.last_name,
        maxMarks,
        marksValue,
        absentValue
      ];
    })
  );

  return { filename: "marks.csv", csv };
}

export async function exportLeaves(month?: string) {
  const db = getDb();
  const rows = month
    ? await db
        .prepare(
          "SELECT tp.first_name, tp.last_name, lt.name as leave_type, lr.start_date, lr.end_date, lr.status FROM leave_requests lr INNER JOIN teacher_profiles tp ON tp.id = lr.teacher_id INNER JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE substr(lr.start_date, 1, 7) <= ? AND substr(lr.end_date, 1, 7) >= ? ORDER BY lr.start_date DESC"
        )
        .all(month, month)
    : await db
        .prepare(
          "SELECT tp.first_name, tp.last_name, lt.name as leave_type, lr.start_date, lr.end_date, lr.status FROM leave_requests lr INNER JOIN teacher_profiles tp ON tp.id = lr.teacher_id INNER JOIN leave_types lt ON lt.id = lr.leave_type_id ORDER BY lr.start_date DESC"
        )
        .all();

  const csv = toCsv(
    ["first_name", "last_name", "leave_type", "start_date", "end_date", "status"],
    rows.map((r: any) => [r.first_name, r.last_name, r.leave_type, r.start_date, r.end_date, r.status])
  );

  return { filename: "leave.csv", csv };
}
