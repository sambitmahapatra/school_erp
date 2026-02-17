import { getDb } from "../../db";

export function getDashboardSummary(input: { userId: number; teacherId?: number | null }) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  let attendanceExpected = 0;
  let attendanceSubmitted = 0;

  if (input.teacherId) {
    attendanceExpected = (db
      .prepare("SELECT COUNT(*) as count FROM teacher_assignments WHERE teacher_id = ? AND is_active = 1")
      .get(input.teacherId) as { count: number }).count;

    attendanceSubmitted = (db
      .prepare(
        "SELECT COUNT(*) as count FROM attendance_sessions WHERE teacher_id = ? AND date = ? AND status = 'submitted'"
      )
      .get(input.teacherId, today) as { count: number }).count;
  }

  const activeYear = db
    .prepare("SELECT id FROM academic_years WHERE is_active = 1 LIMIT 1")
    .get() as { id: number } | undefined;

  let pendingMarks = 0;

  if (activeYear && input.teacherId) {
    const latestExam = db
      .prepare("SELECT id FROM exams WHERE academic_year_id = ? ORDER BY start_date DESC LIMIT 1")
      .get(activeYear.id) as { id: number } | undefined;

    if (latestExam) {
      const assignments = db
        .prepare("SELECT class_id, subject_id FROM teacher_assignments WHERE teacher_id = ? AND is_active = 1")
        .all(input.teacherId) as { class_id: number; subject_id: number | null }[];

      for (const assignment of assignments) {
        const classSubject = assignment.subject_id
          ? (db
              .prepare("SELECT id, is_optional FROM class_subjects WHERE class_id = ? AND subject_id = ?")
              .get(assignment.class_id, assignment.subject_id) as { id: number; is_optional: number } | undefined)
          : undefined;

        const students = classSubject && classSubject.is_optional
          ? (db
              .prepare(
                "SELECT COUNT(*) as count FROM students st LEFT JOIN student_subjects ss ON ss.student_id = st.id AND ss.class_subject_id = ? WHERE st.class_id = ? AND st.status = 'active' AND (ss.is_enrolled IS NULL OR ss.is_enrolled = 1)"
              )
              .get(classSubject.id, assignment.class_id) as { count: number }).count
          : (db
              .prepare("SELECT COUNT(*) as count FROM students WHERE class_id = ? AND status = 'active'")
              .get(assignment.class_id) as { count: number }).count;
        const actual = (db
          .prepare(
            "SELECT COUNT(*) as count FROM marks_entries WHERE exam_id = ? AND class_id = ? AND subject_id = ?"
          )
          .get(latestExam.id, assignment.class_id, assignment.subject_id) as { count: number }).count;
        pendingMarks += Math.max(0, students - actual);
      }
    }
  }

  const upcomingExams = db
    .prepare("SELECT id, name, start_date FROM exams WHERE start_date >= ? ORDER BY start_date ASC LIMIT 5")
    .all(today);

  return {
    attendance: {
      expected: attendanceExpected,
      submitted: attendanceSubmitted,
      pending: Math.max(0, attendanceExpected - attendanceSubmitted)
    },
    pendingMarks,
    upcomingExams
  };
}

export function getDashboardAlerts(teacherId?: number | null) {
  const db = getDb();
  if (!teacherId) return [];

  return db
    .prepare(
      "SELECT st.id as student_id, st.first_name, st.last_name, st.roll_no, c.name as class_name, AVG(CASE WHEN ae.status = 'present' THEN 1.0 ELSE 0.0 END) AS present_rate FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id INNER JOIN students st ON st.id = ae.student_id INNER JOIN classes c ON c.id = st.class_id INNER JOIN teacher_assignments ta ON ta.class_id = st.class_id WHERE ta.teacher_id = ? GROUP BY ae.student_id HAVING present_rate < 0.75 ORDER BY present_rate ASC LIMIT 20"
    )
    .all(teacherId);
}
