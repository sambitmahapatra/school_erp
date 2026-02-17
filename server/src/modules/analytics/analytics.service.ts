import { getDb } from "../../db";
import { getClassAttendanceSummary } from "../attendance/attendance.service";

type StudentPerformance = {
  student_id: number;
  first_name: string;
  last_name: string;
  roll_no: number | null;
  attendance_rate: number | null;
  marks_percent: number | null;
  performance_score: number | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  missing_marks: number;
};

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && !Number.isNaN(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function computeScore(attendance: number | null, marks: number | null) {
  const attendanceWeight = 0.4;
  const marksWeight = 0.6;
  let totalWeight = 0;
  let sum = 0;
  if (attendance !== null) {
    sum += attendance * attendanceWeight;
    totalWeight += attendanceWeight;
  }
  if (marks !== null) {
    sum += marks * marksWeight;
    totalWeight += marksWeight;
  }
  if (!totalWeight) return null;
  return sum / totalWeight;
}

function computeRisk(attendance: number | null, marks: number | null): StudentPerformance["risk_level"] {
  if (attendance === null && marks === null) return "unknown";
  const att = attendance ?? 0;
  const mk = marks ?? 0;
  if (att < 0.75 || mk < 0.4) return "high";
  if (att < 0.85 || mk < 0.6) return "medium";
  return "low";
}

function correlation(pairs: Array<{ attendance: number; marks: number }>) {
  if (pairs.length < 2) return null;
  const meanAttendance = pairs.reduce((sum, p) => sum + p.attendance, 0) / pairs.length;
  const meanMarks = pairs.reduce((sum, p) => sum + p.marks, 0) / pairs.length;
  let numerator = 0;
  let denomAttendance = 0;
  let denomMarks = 0;
  for (const pair of pairs) {
    const a = pair.attendance - meanAttendance;
    const b = pair.marks - meanMarks;
    numerator += a * b;
    denomAttendance += a * a;
    denomMarks += b * b;
  }
  const denom = Math.sqrt(denomAttendance * denomMarks);
  if (!denom) return null;
  return numerator / denom;
}

const PASS_THRESHOLD = 0.4;
const MARKS_BUCKETS = [
  { label: "<40%", min: 0, max: 0.4 },
  { label: "40-60%", min: 0.4, max: 0.6 },
  { label: "60-75%", min: 0.6, max: 0.75 },
  { label: "75-90%", min: 0.75, max: 0.9 },
  { label: "90-100%", min: 0.9, max: 1.01 }
];

function buildDistribution(values: Array<number | null>) {
  const distribution = MARKS_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: values.filter(
      (value) => value !== null && value >= bucket.min && value < bucket.max
    ).length
  }));
  const missing = values.filter((value) => value === null).length;
  if (missing) {
    distribution.push({ label: "No data", count: missing });
  }
  return distribution;
}

function toPercent(numerator: number, denominator: number) {
  if (!denominator) return null;
  return numerator / denominator;
}

export async function getClassAnalytics(input: { classId: number; month?: string }) {
  const db = getDb();
  const classRow = (await db
    .prepare("SELECT id, name FROM classes WHERE id = ?")
    .get(input.classId)) as { id: number; name: string } | undefined;

  if (!classRow) return null;

  const month = input.month || new Date().toISOString().slice(0, 7);
  const attendanceTrend = await getClassAttendanceSummary(input.classId, month);

  const latestExam = (await db
    .prepare(
      "SELECT e.id, e.name, e.start_date FROM exams e INNER JOIN marks_entries me ON me.exam_id = e.id WHERE me.class_id = ? GROUP BY e.id ORDER BY e.start_date DESC LIMIT 1"
    )
    .get(input.classId)) as { id: number; name: string; start_date: string | null } | undefined;

  const subjectAverages = latestExam
    ? ((await db
        .prepare(
          "SELECT sb.id as subject_id, sb.name as subject_name, AVG(CASE WHEN me.is_absent = 1 THEN NULL ELSE me.marks_obtained * 1.0 / me.max_marks END) AS avg_percent FROM marks_entries me INNER JOIN subjects sb ON sb.id = me.subject_id WHERE me.exam_id = ? AND me.class_id = ? GROUP BY sb.id ORDER BY sb.name"
        )
        .all(latestExam.id, input.classId)) as Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>)
    : [];

  const students = (await db
    .prepare(
      "SELECT id, first_name, last_name, roll_no FROM students WHERE class_id = ? AND status = 'active' ORDER BY roll_no, first_name"
    )
    .all(input.classId)) as Array<{ id: number; first_name: string; last_name: string; roll_no: number | null }>;

  const attendanceStats = (await db
    .prepare(
      "SELECT ae.student_id, AVG(CASE WHEN ae.status = 'present' THEN 1.0 ELSE 0.0 END) AS attendance_rate, COUNT(ae.id) AS total_entries FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id WHERE s.class_id = ? GROUP BY ae.student_id"
    )
    .all(input.classId)) as Array<{ student_id: number; attendance_rate: number; total_entries: number }>;

  const attendanceMap = new Map(attendanceStats.map((row) => [row.student_id, row]));

  const marksMap = new Map<
    number,
    { obtained_total: number; max_total: number; missing_count: number }
  >();

  if (latestExam) {
    const marksStats = (await db
      .prepare(
        "SELECT me.student_id, SUM(CASE WHEN me.is_absent = 1 THEN me.max_marks WHEN me.marks_obtained IS NOT NULL THEN me.max_marks ELSE 0 END) AS max_total, SUM(CASE WHEN me.is_absent = 1 THEN 0 WHEN me.marks_obtained IS NOT NULL THEN me.marks_obtained ELSE 0 END) AS obtained_total, SUM(CASE WHEN me.marks_obtained IS NULL AND me.is_absent = 0 THEN 1 ELSE 0 END) AS missing_count FROM marks_entries me WHERE me.exam_id = ? AND me.class_id = ? GROUP BY me.student_id"
      )
      .all(latestExam.id, input.classId)) as Array<{
      student_id: number;
      max_total: number;
      obtained_total: number;
      missing_count: number;
    }>;

    marksStats.forEach((row) => {
      marksMap.set(row.student_id, {
        max_total: row.max_total ?? 0,
        obtained_total: row.obtained_total ?? 0,
        missing_count: row.missing_count ?? 0
      });
    });
  }

  const studentPerformance: StudentPerformance[] = students.map((student) => {
    const attendance = attendanceMap.get(student.id);
    const attendance_rate = attendance ? Number(attendance.attendance_rate) : null;
    const marks = marksMap.get(student.id);
    const marks_percent =
      marks && marks.max_total > 0 ? marks.obtained_total / marks.max_total : null;
    const missing_marks = marks ? marks.missing_count : 0;
    const performance_score = computeScore(attendance_rate, marks_percent);
    const risk_level = computeRisk(attendance_rate, marks_percent);

    return {
      student_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      roll_no: student.roll_no,
      attendance_rate,
      marks_percent,
      performance_score,
      risk_level,
      missing_marks
    };
  });

  const avgAttendance = average(studentPerformance.map((s) => s.attendance_rate));
  const avgMarks = average(studentPerformance.map((s) => s.marks_percent));

  const riskCounts = studentPerformance.reduce(
    (acc, student) => {
      acc[student.risk_level] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0, unknown: 0 }
  );

  const correlationPairs = studentPerformance
    .filter((s) => s.attendance_rate !== null && s.marks_percent !== null)
    .map((s) => ({ attendance: s.attendance_rate as number, marks: s.marks_percent as number }));

  const marksDistribution = buildDistribution(studentPerformance.map((student) => student.marks_percent));

  return {
    class: { id: classRow.id, name: classRow.name },
    month,
    latestExam,
    summary: {
      average_attendance: avgAttendance,
      average_marks: avgMarks,
      correlation: correlation(correlationPairs),
      risk_counts: riskCounts
    },
    attendanceTrend,
    subjectAverages,
    marksDistribution,
    studentPerformance
  };
}

export async function getClassExamAnalytics(input: {
  classId: number;
  examId: number;
  subjectId?: number | null;
}) {
  const db = getDb();
  const classRow = (await db
    .prepare("SELECT id, name FROM classes WHERE id = ?")
    .get(input.classId)) as { id: number; name: string } | undefined;
  const examRow = (await db
    .prepare("SELECT id, name, start_date, end_date FROM exams WHERE id = ?")
    .get(input.examId)) as { id: number; name: string; start_date: string | null; end_date: string | null } | undefined;

  if (!classRow || !examRow) return null;

  const subjectRow = input.subjectId
    ? ((await db
        .prepare("SELECT id, name FROM subjects WHERE id = ?")
        .get(input.subjectId)) as { id: number; name: string } | undefined)
    : null;

  const classSubject = input.subjectId
    ? ((await db
        .prepare("SELECT id, is_optional FROM class_subjects WHERE class_id = ? AND subject_id = ?")
        .get(input.classId, input.subjectId)) as { id: number; is_optional: number } | undefined)
    : undefined;

  const optionalFilter =
    classSubject && classSubject.is_optional
      ? "AND NOT EXISTS (SELECT 1 FROM student_subjects ss WHERE ss.student_id = st.id AND ss.class_subject_id = ? AND ss.is_enrolled = 0)"
      : "";

  const subjectClause = input.subjectId ? "AND me.subject_id = ?" : "";
  const params: any[] = [input.examId, input.classId];
  if (input.subjectId) params.push(input.subjectId);
  params.push(input.classId);
  if (classSubject && classSubject.is_optional) params.push(classSubject.id);

  const rows = (await db
    .prepare(
      `SELECT st.id as student_id, st.first_name, st.last_name, st.roll_no,
        COUNT(me.id) as entry_count,
        SUM(me.max_marks) as max_total,
        SUM(CASE WHEN me.is_absent = 1 THEN 0 WHEN me.marks_obtained IS NOT NULL THEN me.marks_obtained ELSE 0 END) as obtained_total,
        SUM(CASE WHEN me.is_absent = 1 THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN me.marks_obtained IS NULL AND me.is_absent = 0 THEN 1 ELSE 0 END) as missing_count
      FROM students st
      LEFT JOIN marks_entries me
        ON me.student_id = st.id
        AND me.exam_id = ?
        AND me.class_id = ?
        ${subjectClause}
      WHERE st.class_id = ? AND st.status = 'active'
      ${optionalFilter}
      GROUP BY st.id
      ORDER BY st.roll_no, st.first_name`
    )
    .all(...params)) as Array<{
    student_id: number;
    first_name: string;
    last_name: string;
    roll_no: number | null;
    entry_count: number;
    max_total: number | null;
    obtained_total: number | null;
    absent_count: number | null;
    missing_count: number | null;
  }>;

  const students = rows.map((row) => {
    const maxTotal = row.max_total ?? 0;
    const obtainedTotal = row.obtained_total ?? 0;
    const entryCount = row.entry_count ?? 0;
    const absentCount = row.absent_count ?? 0;
    const percent = toPercent(obtainedTotal, maxTotal);
    const isAbsent = entryCount > 0 && absentCount === entryCount;
    return {
      student_id: row.student_id,
      first_name: row.first_name,
      last_name: row.last_name,
      roll_no: row.roll_no,
      max_total: maxTotal,
      obtained_total: obtainedTotal,
      missing_count: row.missing_count ?? 0,
      entry_count: entryCount,
      percent,
      is_absent: isAbsent
    };
  });

  const scored = students.filter((student) => student.percent !== null && !student.is_absent);
  const averagePercent = average(scored.map((student) => student.percent));
  const sorted = [...scored].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const highest = sorted[0]?.percent ?? null;
  const lowest = sorted.length ? sorted[sorted.length - 1].percent ?? null : null;

  const passCount = scored.filter((student) => (student.percent ?? 0) >= PASS_THRESHOLD).length;
  const failCount = scored.filter((student) => (student.percent ?? 0) < PASS_THRESHOLD).length;
  const absentCount = students.filter((student) => student.is_absent).length;
  const missingCount = students.filter((student) => student.entry_count === 0).length;

  const topPerformers = sorted.slice(0, 5);
  const bottomPerformers = [...sorted].reverse().slice(0, 5);

  const subjectBreakdown = input.subjectId
    ? []
    : ((await db
        .prepare(
          "SELECT sb.id as subject_id, sb.name as subject_name, AVG(CASE WHEN me.is_absent = 1 THEN NULL WHEN me.marks_obtained IS NOT NULL THEN me.marks_obtained * 1.0 / me.max_marks END) AS avg_percent FROM marks_entries me INNER JOIN subjects sb ON sb.id = me.subject_id WHERE me.exam_id = ? AND me.class_id = ? GROUP BY sb.id ORDER BY sb.name"
        )
        .all(input.examId, input.classId)) as Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>);

  const distribution = buildDistribution(students.map((student) => student.percent));

  return {
    class: classRow,
    exam: examRow,
    subject: subjectRow,
    summary: {
      average_percent: averagePercent,
      highest_percent: highest,
      lowest_percent: lowest,
      pass_count: passCount,
      fail_count: failCount,
      absent_count: absentCount,
      missing_count: missingCount,
      total_students: students.length
    },
    distribution,
    subject_breakdown: subjectBreakdown,
    top_performers: topPerformers,
    bottom_performers: bottomPerformers
  };
}

export async function getStudentAnalytics(input: { studentId: number; startDate?: string; endDate?: string }) {
  const db = getDb();
  const student = (await db
    .prepare(
      "SELECT st.id, st.first_name, st.last_name, st.roll_no, st.class_id, c.name as class_name FROM students st INNER JOIN classes c ON c.id = st.class_id WHERE st.id = ?"
    )
    .get(input.studentId)) as
    | { id: number; first_name: string; last_name: string; roll_no: number | null; class_id: number; class_name: string }
    | undefined;

  if (!student) return null;

  const attendanceClauses = ["ae.student_id = ?"];
  const attendanceParams: any[] = [input.studentId];
  if (input.startDate) {
    attendanceClauses.push("s.date >= ?");
    attendanceParams.push(input.startDate);
  }
  if (input.endDate) {
    attendanceClauses.push("s.date <= ?");
    attendanceParams.push(input.endDate);
  }

  const attendanceRows = (await db
    .prepare(
      `SELECT s.date, ae.status FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id WHERE ${attendanceClauses.join(
        " AND "
      )} ORDER BY s.date`
    )
    .all(...attendanceParams)) as Array<{ date: string; status: string }>;

  const attendanceCounts = attendanceRows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "present") acc.present += 1;
      if (row.status === "absent") acc.absent += 1;
      if (row.status === "late") acc.late += 1;
      if (row.status === "excused") acc.excused += 1;
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
  );

  const attendanceRate = attendanceCounts.total
    ? attendanceCounts.present / attendanceCounts.total
    : null;

  const marksClauses = ["me.student_id = ?"];
  const marksParams: any[] = [input.studentId];
  if (input.startDate) {
    marksClauses.push("e.start_date >= ?");
    marksParams.push(input.startDate);
  }
  if (input.endDate) {
    marksClauses.push("e.start_date <= ?");
    marksParams.push(input.endDate);
  }

  const marksRows = (await db
    .prepare(
      `SELECT e.id as exam_id, e.name as exam_name, e.start_date, sb.id as subject_id, sb.name as subject_name, me.max_marks, me.marks_obtained, me.is_absent
       FROM marks_entries me
       INNER JOIN exams e ON e.id = me.exam_id
       INNER JOIN subjects sb ON sb.id = me.subject_id
       WHERE ${marksClauses.join(" AND ")}
       ORDER BY e.start_date, sb.name`
    )
    .all(...marksParams)) as Array<{
    exam_id: number;
    exam_name: string;
    start_date: string | null;
    subject_id: number;
    subject_name: string;
    max_marks: number;
    marks_obtained: number | null;
    is_absent: number;
  }>;

  const examMap = new Map<
    number,
    {
      exam_id: number;
      exam_name: string;
      start_date: string | null;
      max_total: number;
      obtained_total: number;
      absent_count: number;
      missing_count: number;
    }
  >();

  const subjectMap = new Map<
    number,
    { subject_id: number; subject_name: string; max_total: number; obtained_total: number }
  >();

  const absentExams: Array<{ exam_id: number; exam_name: string; subject_name: string }> = [];

  for (const row of marksRows) {
    const exam = examMap.get(row.exam_id) || {
      exam_id: row.exam_id,
      exam_name: row.exam_name,
      start_date: row.start_date,
      max_total: 0,
      obtained_total: 0,
      absent_count: 0,
      missing_count: 0
    };

    if (row.is_absent) {
      exam.absent_count += 1;
      exam.max_total += row.max_marks;
      absentExams.push({
        exam_id: row.exam_id,
        exam_name: row.exam_name,
        subject_name: row.subject_name
      });
    } else if (row.marks_obtained !== null) {
      exam.max_total += row.max_marks;
      exam.obtained_total += row.marks_obtained;
    } else {
      exam.missing_count += 1;
    }

    examMap.set(row.exam_id, exam);

    const subject = subjectMap.get(row.subject_id) || {
      subject_id: row.subject_id,
      subject_name: row.subject_name,
      max_total: 0,
      obtained_total: 0
    };

    if (row.is_absent) {
      subject.max_total += row.max_marks;
    } else if (row.marks_obtained !== null) {
      subject.max_total += row.max_marks;
      subject.obtained_total += row.marks_obtained;
    }

    subjectMap.set(row.subject_id, subject);
  }

  const exams = Array.from(examMap.values())
    .map((exam) => ({
      ...exam,
      percent: toPercent(exam.obtained_total, exam.max_total)
    }))
    .sort((a, b) => {
      if (!a.start_date && !b.start_date) return a.exam_id - b.exam_id;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    });

  const subjectBreakdown = Array.from(subjectMap.values()).map((subject) => ({
    ...subject,
    avg_percent: toPercent(subject.obtained_total, subject.max_total)
  }));

  const sortedSubjects = [...subjectBreakdown].sort(
    (a, b) => (b.avg_percent ?? 0) - (a.avg_percent ?? 0)
  );

  const strengths = sortedSubjects.slice(0, 3);
  const gaps = [...sortedSubjects].reverse().slice(0, 3);

  const overallPercent = average(exams.map((exam) => exam.percent));

  const trendBase = exams.filter((exam) => exam.percent !== null);
  let trend = { direction: "unknown" as "improving" | "declining" | "steady" | "unknown", delta: null as number | null };
  if (trendBase.length >= 2) {
    const last = trendBase[trendBase.length - 1].percent ?? 0;
    const prev = trendBase[trendBase.length - 2].percent ?? 0;
    const delta = last - prev;
    if (Math.abs(delta) < 0.02) {
      trend = { direction: "steady", delta };
    } else if (delta > 0) {
      trend = { direction: "improving", delta };
    } else {
      trend = { direction: "declining", delta };
    }
  }

  const correlationPairs: Array<{ attendance: number; marks: number }> = [];

  for (const exam of exams) {
    if (!exam.start_date || exam.percent === null) continue;
    const month = exam.start_date.slice(0, 7);
    const attendanceRateRow = (await db
      .prepare(
        "SELECT AVG(CASE WHEN ae.status = 'present' THEN 1.0 ELSE 0.0 END) AS present_rate FROM attendance_entries ae INNER JOIN attendance_sessions s ON s.id = ae.session_id WHERE ae.student_id = ? AND substr(s.date, 1, 7) = ?"
      )
      .get(input.studentId, month)) as { present_rate: number | null } | undefined;
    if (attendanceRateRow && attendanceRateRow.present_rate !== null) {
      correlationPairs.push({
        attendance: attendanceRateRow.present_rate,
        marks: exam.percent
      });
    }
  }

  return {
    student,
    attendance: {
      ...attendanceCounts,
      rate: attendanceRate,
      log: attendanceRows
    },
    marks: {
      overall_percent: overallPercent,
      exams,
      subjects: subjectBreakdown,
      strengths,
      gaps,
      absent_exams: absentExams
    },
    trend,
    correlation: correlation(correlationPairs)
  };
}
