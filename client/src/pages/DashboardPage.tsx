import { useEffect, useState } from "react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { apiGet } from "../api/client";
import { formatClassLabel } from "../utils/format";

type Summary = {
  attendance: { expected: number; submitted: number; pending: number };
  pendingMarks: number;
  upcomingExams: Array<{ id: number; name: string; start_date: string }>;
};

type ClassItem = { id: number; name: string; grade: number; section: string };

type AlertRow = {
  student_id: number;
  first_name: string;
  last_name: string;
  roll_no: number;
  class_name: string;
  present_rate: number;
};

type ClassAnalytics = {
  class: { id: number; name: string };
  month: string;
  latestExam?: { id: number; name: string; start_date: string | null };
  summary: {
    average_attendance: number | null;
    average_marks: number | null;
    correlation: number | null;
    risk_counts: { low: number; medium: number; high: number; unknown: number };
  };
  attendanceTrend: Array<{ date: string; present_rate: number }>;
  subjectAverages: Array<{ subject_id: number; subject_name: string; avg_percent: number | null }>;
  marksDistribution: Array<{ label: string; count: number }>;
  studentPerformance: Array<{
    student_id: number;
    first_name: string;
    last_name: string;
    roll_no: number | null;
    attendance_rate: number | null;
    marks_percent: number | null;
    performance_score: number | null;
    risk_level: "low" | "medium" | "high" | "unknown";
    missing_marks: number;
  }>;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    apiGet<{ data: Summary }>("/dashboard/summary")
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
    apiGet<{ data: AlertRow[] }>("/dashboard/alerts")
      .then((res) => setAlerts(res.data))
      .catch(() => setAlerts([]));
  }, []);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/classes")
      .then((res) => {
        setClasses(res.data);
        if (res.data.length) setClassId(res.data[0].id);
      })
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!classId) {
      setAnalytics(null);
      return;
    }
    const params = new URLSearchParams({ classId: String(classId) });
    if (month) params.append("month", month);
    setAnalyticsLoading(true);
    apiGet<{ data: ClassAnalytics }>(`/dashboard/class-analytics?${params.toString()}`)
      .then((res) => setAnalytics(res.data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, [classId, month]);

  const attendanceLabel = summary
    ? `${summary.attendance.submitted} / ${summary.attendance.expected}`
    : "--";

  const formatPercent = (value: number | null) =>
    value === null || Number.isNaN(value) ? "--" : `${Math.round(value * 100)}%`;

  const topPerformers = analytics
    ? [...analytics.studentPerformance]
        .filter((s) => s.performance_score !== null)
        .sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))
        .slice(0, 5)
    : [];

  const needsAttention = analytics
    ? [...analytics.studentPerformance]
        .filter((s) => s.risk_level === "high" || s.risk_level === "medium")
        .sort((a, b) => (a.performance_score ?? 0) - (b.performance_score ?? 0))
        .slice(0, 5)
    : [];

  const correlationValue = analytics?.summary.correlation ?? null;

  return (
    <div className="page">
      <PageHeader
        title="Today View"
        subtitle="Complete your daily academic workflow in minutes"
        actions={
          <div className="header-actions">
            <button className="btn btn--ghost">Export Summary</button>
            <button className="btn btn--primary">Start Attendance</button>
          </div>
        }
      />

      <div className="grid grid--tiles">
        <StatTile
          label="Attendance completion"
          value={attendanceLabel}
          meta={summary ? `${summary.attendance.pending} pending` : ""}
          trend=""
          tone="accent"
        />
        <StatTile
          label="Pending marks"
          value={summary ? String(summary.pendingMarks) : "--"}
          meta={summary?.upcomingExams?.[0]?.name || ""}
          trend=""
          tone="warning"
        />
        <StatTile label="Low attendance" value={alerts.length ? String(alerts.length) : "0"} meta="Students flagged" />
        <StatTile
          label="Upcoming exams"
          value={summary ? String(summary.upcomingExams.length) : "--"}
          meta="Next 14 days"
          tone="success"
        />
      </div>

      <Card title="Class Analytics" subtitle="Performance insights for selected class">
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
            <label className="form-label">Month</label>
            <input
              className="input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="toolbar__group toolbar__group--right">
            <StatusPill label={analyticsLoading ? "Loading" : analytics ? "Updated" : "No data"} tone="info" />
          </div>
        </div>
        <div className="grid grid--tiles">
          <StatTile
            label="Avg attendance"
            value={formatPercent(analytics?.summary.average_attendance ?? null)}
            meta={`${analytics?.summary.risk_counts.high ?? 0} high risk`}
            tone="accent"
          />
          <StatTile
            label="Avg marks"
            value={formatPercent(analytics?.summary.average_marks ?? null)}
            meta={analytics?.latestExam?.name || "Latest exam"}
            tone="success"
          />
          <StatTile
            label="Correlation"
            value={correlationValue !== null ? correlationValue.toFixed(2) : "--"}
            meta="Attendance vs marks"
          />
          <StatTile
            label="At-risk students"
            value={analytics ? String(analytics.summary.risk_counts.high + analytics.summary.risk_counts.medium) : "--"}
            meta={`${analytics?.summary.risk_counts.medium ?? 0} medium`}
            tone="warning"
          />
        </div>
        {analytics?.latestExam ? (
          <div className="callout callout--info">
            Latest exam: <strong>{analytics.latestExam.name}</strong>
          </div>
        ) : null}
      </Card>

      <div className="grid grid--two">
        <Card title="Alerts" subtitle="Auto-detected risks and missing data">
          {alerts.length === 0 ? (
            <div className="callout">No alerts yet. Once attendance and marks are entered, risks will appear here.</div>
          ) : (
            <DataTable
              headers={["Student", "Class", "Attendance"]}
              rows={alerts.map((a) => [
                `${a.first_name} ${a.last_name}`,
                a.class_name,
                <StatusPill
                  key={a.student_id}
                  label={`${Math.round(a.present_rate * 100)}%`}
                  tone={a.present_rate < 0.6 ? "danger" : "warning"}
                />
              ])}
              compact
            />
          )}
        </Card>

        <Card title="Upcoming Exams" subtitle="Next scheduled assessments">
          {summary?.upcomingExams?.length ? (
            <ul className="list">
              {summary.upcomingExams.map((exam) => (
                <li key={exam.id} className="list__item">
                  <div className="list__primary">
                    <div className="list__title">{exam.name}</div>
                    <div className="list__meta">{exam.start_date || "TBA"}</div>
                  </div>
                  <StatusPill label="Scheduled" tone="info" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="callout">No exams scheduled.</div>
          )}
        </Card>
      </div>

      <div className="grid grid--two">
        <Card
          title="Attendance Trend"
          subtitle={
            analytics
              ? `Present rate for ${analytics.class.name} (${analytics.month})`
              : "Daily present rate for assigned classes"
          }
        >
          {analyticsLoading ? (
            <div className="callout callout--info">Loading analytics...</div>
          ) : analytics?.attendanceTrend?.length ? (
            <DataTable
              headers={["Date", "Present rate"]}
              rows={analytics.attendanceTrend.map((row) => [row.date, formatPercent(row.present_rate)])}
              compact
            />
          ) : (
            <div className="callout">No attendance data for the selected month.</div>
          )}
        </Card>
        <Card
          title="Marks Distribution"
          subtitle={analytics?.latestExam ? `Latest exam: ${analytics.latestExam.name}` : "Latest exam performance spread"}
        >
          {analyticsLoading ? (
            <div className="callout callout--info">Loading analytics...</div>
          ) : analytics?.marksDistribution?.length ? (
            <DataTable
              headers={["Bucket", "Students"]}
              rows={analytics.marksDistribution.map((bucket) => [bucket.label, String(bucket.count)])}
              compact
            />
          ) : (
            <div className="callout">No marks data for the selected class.</div>
          )}
        </Card>
      </div>

      <div className="grid grid--two">
        <Card title="Subject Averages" subtitle="Average marks by subject (latest exam)">
          {analyticsLoading ? (
            <div className="callout callout--info">Loading analytics...</div>
          ) : analytics?.subjectAverages?.length ? (
            <DataTable
              headers={["Subject", "Average"]}
              rows={analytics.subjectAverages.map((row) => [row.subject_name, formatPercent(row.avg_percent)])}
              compact
            />
          ) : (
            <div className="callout">No subject averages available yet.</div>
          )}
        </Card>
        <Card title="Student Performance" subtitle="Top performers and students needing attention">
          {!analytics ? (
            <div className="callout">Select a class to view performance insights.</div>
          ) : (
            <>
              <div className="summary-label">Top performers</div>
              {topPerformers.length ? (
                <DataTable
                  headers={["Student", "Attendance", "Marks", "Score"]}
                  rows={topPerformers.map((student) => [
                    `${student.first_name} ${student.last_name}`,
                    formatPercent(student.attendance_rate),
                    formatPercent(student.marks_percent),
                    formatPercent(student.performance_score)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No performance data available yet.</div>
              )}
              <div className="summary-label">Needs attention</div>
              {needsAttention.length ? (
                <DataTable
                  headers={["Student", "Risk", "Attendance", "Marks"]}
                  rows={needsAttention.map((student) => [
                    `${student.first_name} ${student.last_name}`,
                    <StatusPill
                      key={student.student_id}
                      label={student.risk_level}
                      tone={student.risk_level === "high" ? "danger" : "warning"}
                    />,
                    formatPercent(student.attendance_rate),
                    formatPercent(student.marks_percent)
                  ])}
                  compact
                />
              ) : (
                <div className="callout">No students flagged for attention.</div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
