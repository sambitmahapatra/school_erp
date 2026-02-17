import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import StatusPill from "../components/StatusPill";
import { API_BASE, apiGet, apiPost } from "../api/client";
import { formatClassLabel } from "../utils/format";

type ClassItem = { id: number; name: string; grade: number; section: string };
type SubjectItem = { subject_id: number; name: string };
type ExamItem = { id: number; name: string };
type Student = { id: number; first_name: string; last_name: string; roll_no: number | null };

type ClassAnalytics = {
  class: { id: number; name: string };
  exam: { id: number; name: string; start_date: string | null; end_date: string | null };
  subject?: { id: number; name: string } | null;
  summary: {
    average_percent: number | null;
    highest_percent: number | null;
    lowest_percent: number | null;
    pass_count: number;
    fail_count: number;
    absent_count: number;
    missing_count: number;
    total_students: number;
  };
  distribution: Array<{ label: string; count: number }>;
  subject_breakdown: Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>;
  top_performers: Array<{
    student_id: number;
    first_name: string;
    last_name: string;
    roll_no: number | null;
    percent: number | null;
  }>;
  bottom_performers: Array<{
    student_id: number;
    first_name: string;
    last_name: string;
    roll_no: number | null;
    percent: number | null;
  }>;
};

type StudentAnalytics = {
  student: {
    id: number;
    first_name: string;
    last_name: string;
    roll_no: number | null;
    class_id: number;
    class_name: string;
  };
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number | null;
    log: Array<{ date: string; status: string }>;
  };
  marks: {
    overall_percent: number | null;
    exams: Array<{
      exam_id: number;
      exam_name: string;
      start_date: string | null;
      max_total: number;
      obtained_total: number;
      absent_count: number;
      missing_count: number;
      percent: number | null;
    }>;
    subjects: Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>;
    strengths: Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>;
    gaps: Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>;
    absent_exams: Array<{ exam_id: number; exam_name: string; subject_name: string }>;
  };
  trend: { direction: "improving" | "declining" | "steady" | "unknown"; delta: number | null };
  correlation: number | null;
};

type ViewMode = "class" | "student";

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function toCsv(rows: string[][]) {
  const escape = (value: string) => {
    if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
      return `"${value.replace(/\"/g, '""')}"`;
    }
    return value;
  };
  return rows.map((row) => row.map((cell) => escape(String(cell))).join(",")).join("\n");
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export default function AnalyticsPage() {
  const [mode, setMode] = useState<ViewMode>("class");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [examId, setExamId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/classes")
      .then((res) => {
        setClasses(res.data);
        if (res.data.length) setClassId(res.data[0].id);
      })
      .catch(() => setClasses([]));

    apiGet<{ data: ExamItem[] }>("/marks/exams")
      .then((res) => {
        setExams(res.data);
        if (res.data.length) setExamId(res.data[0].id);
      })
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    if (!classId) return;
    apiGet<{ data: SubjectItem[] }>(`/classes/${classId}/subjects`)
      .then((res) => {
        setSubjects(res.data);
        if (res.data.length) {
          setSubjectId(res.data[0].subject_id);
        } else {
          setSubjectId(null);
        }
      })
      .catch(() => setSubjects([]));
    apiGet<{ data: Student[] }>(`/students?classId=${classId}`)
      .then((res) => {
        setStudents(res.data);
        if (res.data.length) setStudentId(res.data[0].id);
      })
      .catch(() => setStudents([]));
  }, [classId]);

  useEffect(() => {
    if (mode !== "class" || !classId || !examId) return;
    const params = new URLSearchParams({ classId: String(classId), examId: String(examId) });
    if (subjectId) params.append("subjectId", String(subjectId));
    setLoading(true);
    apiGet<{ data: ClassAnalytics }>(`/analytics/class?${params.toString()}`)
      .then((res) => setClassAnalytics(res.data))
      .catch(() => setClassAnalytics(null))
      .finally(() => setLoading(false));
  }, [mode, classId, examId, subjectId]);

  useEffect(() => {
    if (mode !== "student" || !studentId) return;
    const params = new URLSearchParams({ studentId: String(studentId) });
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    setLoading(true);
    apiGet<{ data: StudentAnalytics }>(`/analytics/student?${params.toString()}`)
      .then((res) => setStudentAnalytics(res.data))
      .catch(() => setStudentAnalytics(null))
      .finally(() => setLoading(false));
  }, [mode, studentId, startDate, endDate]);

  useEffect(() => {
    setNote("");
    setNoteStatus(null);
  }, [studentId, mode]);

  const passRate = useMemo(() => {
    if (!classAnalytics) return null;
    const totalScored = classAnalytics.summary.pass_count + classAnalytics.summary.fail_count;
    if (!totalScored) return null;
    return classAnalytics.summary.pass_count / totalScored;
  }, [classAnalytics]);

  const handleExportMarks = async () => {
    if (!classId || !examId) return;
    const token = localStorage.getItem("erp-token");
    const params = new URLSearchParams({ examId: String(examId), classId: String(classId) });
    if (subjectId) params.append("subjectId", String(subjectId));
    const url = `${API_BASE}/exports/marks?${params.toString()}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "class-marks.csv";
    link.click();
  };

  const handleExportSummary = () => {
    if (!classAnalytics) return;
    downloadCsv("class-summary.csv", [
      ["Class", classAnalytics.class.name],
      ["Exam", classAnalytics.exam.name],
      ["Subject", classAnalytics.subject?.name || "All"],
      ["Average", formatPercent(classAnalytics.summary.average_percent)],
      ["Highest", formatPercent(classAnalytics.summary.highest_percent)],
      ["Lowest", formatPercent(classAnalytics.summary.lowest_percent)],
      ["Pass rate", formatPercent(passRate)],
      ["Absent", String(classAnalytics.summary.absent_count)]
    ]);
  };

  const handleExportStudentReport = () => {
    if (!studentAnalytics) return;
    const rows: string[][] = [
      ["Student", `${studentAnalytics.student.first_name} ${studentAnalytics.student.last_name}`],
      ["Class", studentAnalytics.student.class_name],
      ["Attendance rate", formatPercent(studentAnalytics.attendance.rate)],
      ["Overall marks", formatPercent(studentAnalytics.marks.overall_percent)],
      [""],
      ["Exam", "Date", "Percent", "Obtained", "Max", "Absent", "Missing"]
    ];

    studentAnalytics.marks.exams.forEach((exam) => {
      rows.push([
        exam.exam_name,
        exam.start_date || "TBA",
        formatPercent(exam.percent),
        String(exam.obtained_total),
        String(exam.max_total),
        String(exam.absent_count),
        String(exam.missing_count)
      ]);
    });

    rows.push([""], ["Subject", "Average"]);
    studentAnalytics.marks.subjects.forEach((subject) => {
      rows.push([subject.subject_name, formatPercent(subject.avg_percent)]);
    });

    downloadCsv("student-report.csv", rows);
  };

  const handleSaveNote = async () => {
    if (!studentId || !note.trim()) return;
    setNoteSaving(true);
    setNoteStatus(null);
    try {
      await apiPost("/progress/notes", { studentId, note: note.trim() });
      setNoteStatus("Saved");
      setNote("");
    } catch {
      setNoteStatus("Failed to save");
    } finally {
      setNoteSaving(false);
    }
  };

  const topPerformers = classAnalytics?.top_performers ?? [];
  const bottomPerformers = classAnalytics?.bottom_performers ?? [];
  const attendanceAbsences = studentAnalytics
    ? studentAnalytics.attendance.log.filter((row) => row.status !== "present").slice(-10)
    : [];
  const trendTone =
    studentAnalytics?.trend.direction === "improving"
      ? "success"
      : studentAnalytics?.trend.direction === "declining"
      ? "warning"
      : "default";

  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        subtitle="Interpretation layer for academic performance insights"
        actions={
          <div className="header-actions">
            <button
              className={`btn ${mode === "class" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setMode("class")}
            >
              Class-wise
            </button>
            <button
              className={`btn ${mode === "student" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setMode("student")}
            >
              Student-wise
            </button>
          </div>
        }
      />

      {mode === "class" ? (
        <>
          <Card title="Class Analytics" subtitle="Select exam scope to view performance insights">
            <div className="toolbar">
              <div className="toolbar__group">
                <label className="form-label">Exam</label>
                <select
                  className="input"
                  value={examId ?? ""}
                  onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : null)}
                >
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar__group">
                <label className="form-label">Class</label>
                <select
                  className="input"
                  value={classId ?? ""}
                  onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatClassLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar__group">
                <label className="form-label">Subject (optional)</label>
                <select
                  className="input"
                  value={subjectId ?? ""}
                  onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.subject_id} value={subject.subject_id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar__group toolbar__group--right">
                <StatusPill label={loading ? "Loading" : classAnalytics ? "Updated" : "No data"} tone="info" />
              </div>
            </div>
            <div className="inline-actions">
              <button className="btn btn--ghost btn--sm" onClick={handleExportMarks}>
                Export Marks CSV
              </button>
              <button className="btn btn--secondary btn--sm" onClick={handleExportSummary}>
                Export Summary
              </button>
            </div>
          </Card>

          <div className="grid grid--tiles">
            <StatTile label="Class average" value={formatPercent(classAnalytics?.summary.average_percent ?? null)} meta="" tone="accent" />
            <StatTile label="Highest score" value={formatPercent(classAnalytics?.summary.highest_percent ?? null)} meta="" />
            <StatTile label="Lowest score" value={formatPercent(classAnalytics?.summary.lowest_percent ?? null)} meta="" />
            <StatTile label="Pass rate" value={formatPercent(passRate)} meta={`${classAnalytics?.summary.fail_count ?? 0} fail`} tone="success" />
            <StatTile label="Absentees" value={String(classAnalytics?.summary.absent_count ?? 0)} meta="" tone="warning" />
          </div>

          <div className="grid grid--two">
            <Card title="Top Performers" subtitle="Highest scoring students">
              {topPerformers.length ? (
                <DataTable
                  headers={["Student", "Roll", "Score"]}
                  rows={topPerformers.map((student) => [
                    `${student.first_name} ${student.last_name}`,
                    student.roll_no ?? "-",
                    formatPercent(student.percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No performance data available for this exam.</div>
              )}
            </Card>
            <Card title="Lowest Performers" subtitle="Students needing attention">
              {bottomPerformers.length ? (
                <DataTable
                  headers={["Student", "Roll", "Score"]}
                  rows={bottomPerformers.map((student) => [
                    `${student.first_name} ${student.last_name}`,
                    student.roll_no ?? "-",
                    formatPercent(student.percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No performance data available for this exam.</div>
              )}
            </Card>
          </div>

          <div className="grid grid--two">
            <Card title="Subject Breakdown" subtitle="Average performance by subject">
              {classAnalytics?.subject_breakdown?.length ? (
                <DataTable
                  headers={["Subject", "Average"]}
                  rows={classAnalytics.subject_breakdown.map((subject) => [
                    subject.subject_name,
                    formatPercent(subject.avg_percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">Subject breakdown is available when all subjects are selected.</div>
              )}
            </Card>
            <Card title="Marks Distribution" subtitle="Student score spread">
              {classAnalytics?.distribution?.length ? (
                <DataTable
                  headers={["Range", "Students"]}
                  rows={classAnalytics.distribution.map((bucket) => [bucket.label, String(bucket.count)])}
                  compact
                />
              ) : (
                <div className="callout">No distribution data yet.</div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <>
          <Card title="Student Analytics" subtitle="Select a student and time range">
            <div className="toolbar">
              <div className="toolbar__group">
                <label className="form-label">Class</label>
                <select
                  className="input"
                  value={classId ?? ""}
                  onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatClassLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar__group">
                <label className="form-label">Student</label>
                <select
                  className="input"
                  value={studentId ?? ""}
                  onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : null)}
                >
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar__group">
                <label className="form-label">From</label>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="toolbar__group">
                <label className="form-label">To</label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="toolbar__group toolbar__group--right">
                <StatusPill label={loading ? "Loading" : studentAnalytics ? "Updated" : "No data"} tone="info" />
              </div>
            </div>
            <div className="inline-actions">
              <button className="btn btn--ghost btn--sm" onClick={handleExportStudentReport}>
                Export Report
              </button>
            </div>
          </Card>

          <div className="grid grid--tiles">
            <StatTile label="Attendance" value={formatPercent(studentAnalytics?.attendance.rate ?? null)} meta="" tone="accent" />
            <StatTile label="Overall marks" value={formatPercent(studentAnalytics?.marks.overall_percent ?? null)} meta="" />
            <StatTile
              label="Trend"
              value={studentAnalytics?.trend.direction || "--"}
              meta={studentAnalytics?.trend.delta !== null && studentAnalytics?.trend.delta !== undefined ? formatPercent(studentAnalytics.trend.delta) : ""}
              tone={trendTone}
            />
            <StatTile label="Absences" value={String(studentAnalytics?.attendance.absent ?? 0)} meta="" tone="warning" />
            <StatTile
              label="Correlation"
              value={studentAnalytics?.correlation !== null && studentAnalytics?.correlation !== undefined ? studentAnalytics.correlation.toFixed(2) : "--"}
              meta="Attendance vs marks"
            />
          </div>

          <div className="grid grid--two">
            <Card title="Exam Timeline" subtitle="Exam-wise performance">
              {studentAnalytics?.marks.exams?.length ? (
                <DataTable
                  headers={["Exam", "Date", "Percent", "Obtained", "Absent", "Missing"]}
                  rows={studentAnalytics.marks.exams.map((exam) => [
                    exam.exam_name,
                    exam.start_date || "TBA",
                    formatPercent(exam.percent),
                    `${exam.obtained_total}/${exam.max_total}`,
                    String(exam.absent_count),
                    String(exam.missing_count)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No exam records found for this student.</div>
              )}
            </Card>
            <Card title="Subject Performance" subtitle="Strengths and weak areas">
              {studentAnalytics?.marks.subjects?.length ? (
                <DataTable
                  headers={["Subject", "Average"]}
                  rows={studentAnalytics.marks.subjects.map((subject) => [
                    subject.subject_name,
                    formatPercent(subject.avg_percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No subject data available.</div>
              )}
            </Card>
          </div>

          <div className="grid grid--two">
            <Card title="Strengths" subtitle="Top performing subjects">
              {studentAnalytics?.marks.strengths?.length ? (
                <DataTable
                  headers={["Subject", "Average"]}
                  rows={studentAnalytics.marks.strengths.map((subject) => [
                    subject.subject_name,
                    formatPercent(subject.avg_percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No strengths data yet.</div>
              )}
            </Card>
            <Card title="Weak Areas" subtitle="Subjects needing improvement">
              {studentAnalytics?.marks.gaps?.length ? (
                <DataTable
                  headers={["Subject", "Average"]}
                  rows={studentAnalytics.marks.gaps.map((subject) => [
                    subject.subject_name,
                    formatPercent(subject.avg_percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No gap analysis data yet.</div>
              )}
            </Card>
          </div>

          <div className="grid grid--two">
            <Card title="Attendance Log" subtitle="Recent non-present entries">
              {attendanceAbsences.length ? (
                <DataTable
                  headers={["Date", "Status"]}
                  rows={attendanceAbsences.map((row) => [row.date, row.status])}
                  compact
                />
              ) : (
                <div className="callout">No absence entries recorded in this range.</div>
              )}
            </Card>
            <Card title="Exam Absences" subtitle="Subjects marked absent">
              {studentAnalytics?.marks.absent_exams?.length ? (
                <DataTable
                  headers={["Exam", "Subject"]}
                  rows={studentAnalytics.marks.absent_exams.map((row) => [row.exam_name, row.subject_name])}
                  compact
                />
              ) : (
                <div className="callout">No exam absences recorded.</div>
              )}
            </Card>
          </div>

          <Card title="Academic Notes" subtitle="Private notes for this student">
            <textarea
              className="input"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a private note for this student"
            />
            <div className="inline-actions">
              <button className="btn btn--primary" disabled={noteSaving || !note.trim()} onClick={handleSaveNote}>
                {noteSaving ? "Saving..." : "Save Note"}
              </button>
              {noteStatus ? <span className="status-pill status-pill--info">{noteStatus}</span> : null}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
