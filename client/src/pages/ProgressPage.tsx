import { useEffect, useState } from "react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { apiGet } from "../api/client";
import { formatClassLabel } from "../utils/format";

type ClassItem = { id: number; name: string; grade: number; section: string };
type Student = { id: number; first_name: string; last_name: string };

type Timeline = {
  marks: Array<{ exam_id: number; subject_id: number; marks_obtained: number; max_marks: number; created_at: string }>;
  attendance: Array<{ date: string; status: string }>;
};

export default function ProgressPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/classes").then((res) => {
      setClasses(res.data);
      if (res.data.length) setClassId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    apiGet<{ data: Student[] }>(`/students?classId=${classId}`).then((res) => {
      setStudents(res.data);
      if (res.data.length) setStudentId(res.data[0].id);
    });
  }, [classId]);

  useEffect(() => {
    if (!studentId) return;
    apiGet<{ data: Timeline }>(`/progress/student/${studentId}`).then((res) => setTimeline(res.data));
  }, [studentId]);

  return (
    <div className="page">
      <PageHeader
        title="Student Progress"
        subtitle="Marks timeline and attendance correlation"
        actions={
          <div className="header-actions">
            <button className="btn btn--ghost">Export Report</button>
            <button className="btn btn--primary">Add Note</button>
          </div>
        }
      />

      <div className="grid grid--two">
        <Card title="Student Overview" subtitle="Context and performance summary">
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
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="summary-grid">
            <div>
              <div className="summary-label">Attendance Records</div>
              <div className="summary-value">{timeline?.attendance.length || 0}</div>
            </div>
            <div>
              <div className="summary-label">Marks Records</div>
              <div className="summary-value">{timeline?.marks.length || 0}</div>
            </div>
            <div>
              <div className="summary-label">Status</div>
              <StatusPill label={timeline ? "Active" : "No data"} tone={timeline ? "success" : "neutral"} />
            </div>
          </div>
        </Card>

        <Card title="Attendance vs Marks" subtitle="Correlation for the selected term">
          <div className="chart-placeholder">Scatter chart</div>
        </Card>
      </div>

      <div className="grid grid--two">
        <Card title="Performance Timeline" subtitle="Exam-wise progression">
          <div className="chart-placeholder">Timeline</div>
        </Card>
        <Card title="Subject Breakdown" subtitle="Strengths and gaps">
          <div className="chart-placeholder">Radar chart</div>
        </Card>
      </div>

      <Card title="Teacher Notes" subtitle="Private notes and follow-ups">
        <textarea className="input" rows={6} placeholder="Add a private note for this student" />
        <div className="inline-actions">
          <button className="btn btn--ghost">Flag for attention</button>
          <button className="btn btn--primary">Save Note</button>
        </div>
      </Card>
    </div>
  );
}
