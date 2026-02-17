import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import StatusPill from "../components/StatusPill";
import { API_BASE, apiGet, apiPatch, apiPost } from "../api/client";
import { getCsvValue, parseCsv } from "../utils/csv";
import { formatClassLabel } from "../utils/format";

type ClassItem = { id: number; name: string; grade: number; section: string };
type SubjectItem = { subject_id: number; name: string };
type Student = { id: number; admission_no: string; first_name: string; last_name: string; roll_no: number | null };

type Entry = { studentId: number; status: "present" | "absent" | "late" | "excused"; reason?: string };
type ImportSummary = { applied: number; skipped: number; errors: string[] };

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/classes").then((res) => {
      setClasses(res.data);
      if (res.data.length) setClassId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    apiGet<{ data: SubjectItem[] }>(`/classes/${classId}/subjects`).then((res) => {
      setSubjects(res.data);
      if (res.data.length) {
        setSubjectId(res.data[0].subject_id);
      } else {
        setSubjectId(null);
      }
    });
    apiGet<{ data: Student[] }>(`/students?classId=${classId}`).then((res) => {
      setStudents(res.data);
      setEntries(
        res.data.map((student) => ({ studentId: student.id, status: "present" as const, reason: "" }))
      );
      setSessionId(null);
      setImportSummary(null);
    });
  }, [classId]);

  const stats = useMemo(() => {
    const total = students.length;
    const marked = entries.length;
    const absentees = entries.filter((e) => e.status === "absent").length;
    const late = entries.filter((e) => e.status === "late").length;
    return { total, marked, absentees, late };
  }, [students, entries]);

  const updateEntry = (studentId: number, updates: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, ...updates } : e)));
  };

  const ensureSession = async () => {
    if (!classId) return null;
    const params = new URLSearchParams({ date, classId: String(classId) });
    if (subjectId) params.append("subjectId", String(subjectId));
    const existing = await apiGet<{ data: Array<{ id: number }> }>(`/attendance/sessions?${params.toString()}`);
    if (existing.data.length) {
      setSessionId(existing.data[0].id);
      return existing.data[0].id;
    }
    const created = await apiPost<{ data: { id: number } }>("/attendance/sessions", {
      date,
      classId,
      subjectId
    });
    setSessionId(created.data.id);
    return created.data.id;
  };

  const handleSave = async (submit: boolean) => {
    if (!classId) return;
    setSaving(true);
    try {
      const sid = await ensureSession();
      if (!sid) return;
      await apiPost("/attendance/entries/bulk", {
        sessionId: sid,
        entries: entries.map((e) => ({
          studentId: e.studentId,
          status: e.status,
          reason: e.reason || undefined
        }))
      });
      if (submit) {
        await apiPatch(`/attendance/sessions/${sid}`, { status: "submitted" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!classId) return;
    const token = localStorage.getItem("erp-token");
    const params = new URLSearchParams({ date, classId: String(classId) });
    if (subjectId) params.append("subjectId", String(subjectId));
    const url = `${API_BASE}/exports/attendance?${params.toString()}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "attendance.csv";
    link.click();
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportSummary(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (!rows.length) {
        setImportSummary({ applied: 0, skipped: 0, errors: ["No data rows found in CSV."] });
        return;
      }

      const byAdmission = new Map(students.map((s) => [String(s.admission_no).trim(), s]));
      const byRoll = new Map(
        students.filter((s) => s.roll_no !== null).map((s) => [String(s.roll_no), s])
      );

      const updates = new Map<number, Partial<Entry>>();
      const errors: string[] = [];
      let applied = 0;
      let skipped = 0;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const admission = getCsvValue(row, ["admission_no", "admission", "admissionnumber"]);
        const roll = getCsvValue(row, ["roll_no", "roll", "rollnumber"]);
        const student = admission ? byAdmission.get(admission) : roll ? byRoll.get(roll) : undefined;

        if (!student) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Student not found (admission_no/roll_no).`);
          return;
        }

        const statusRaw = getCsvValue(row, ["status", "attendance", "state"]).toLowerCase();
        const status = statusRaw as Entry["status"];
        if (!["present", "absent", "late", "excused"].includes(status)) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Invalid status "${statusRaw || "--"}".`);
          return;
        }

        const reason = getCsvValue(row, ["reason", "remarks", "note"]);
        updates.set(student.id, { status, reason });
        applied += 1;
      });

      setEntries((prev) =>
        prev.map((entry) => {
          const update = updates.get(entry.studentId);
          return update ? { ...entry, ...update } : entry;
        })
      );

      setImportSummary({ applied, skipped, errors });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Attendance"
        subtitle="Daily attendance entry with autosave and audit trail"
        actions={
          <div className="header-actions">
            <button className="btn btn--ghost" onClick={handleExport}>
              Export CSV
            </button>
            <button className="btn btn--ghost" disabled={saving} onClick={() => handleSave(false)}>
              Save Draft
            </button>
            <button className="btn btn--primary" disabled={saving} onClick={() => handleSave(true)}>
              Submit Attendance
            </button>
          </div>
        }
      />

      <div className="grid grid--tiles">
        <StatTile label="Session status" value={sessionId ? "Draft" : "New"} meta="" tone="warning" />
        <StatTile label="Students" value={String(stats.total)} meta="" />
        <StatTile label="Marked" value={String(stats.marked)} meta={`${stats.total - stats.marked} pending`} tone="accent" />
        <StatTile label="Absentees" value={String(stats.absentees)} meta={`${stats.late} late`} />
      </div>

      <Card
        title="Session Details"
        subtitle="Pick class, subject, and date before marking"
        actions={<StatusPill label={sessionId ? "Draft" : "New"} tone="warning" />}
      >
        <div className="toolbar">
          <div className="toolbar__group">
            <label className="form-label">Class</label>
            <select className="input" value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar__group">
            <label className="form-label">Subject</label>
            <select
              className="input"
              value={subjectId ?? ""}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">(None)</option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar__group">
            <label className="form-label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="toolbar__group toolbar__group--right">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setEntries((prev) => prev.map((e) => ({ ...e, status: "present", reason: "" })))}
            >
              Mark All Present
            </button>
          </div>
        </div>
      </Card>

      <Card title="Bulk Upload" subtitle="Upload a CSV to update attendance in bulk">
        <div className="toolbar">
          <div className="toolbar__group">
            <label className="form-label">CSV file</label>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              disabled={importing}
            />
          </div>
          <div className="toolbar__group">
            <label className="form-label">Template</label>
            <button className="btn btn--ghost btn--sm" onClick={handleExport}>
              Download CSV
            </button>
          </div>
          <div className="toolbar__group toolbar__group--right">
            <StatusPill label={importing ? "Importing" : "Ready"} tone="info" />
          </div>
        </div>
        <div className="callout callout--info">
          Expected headers: <strong>admission_no</strong> (or <strong>roll_no</strong>), <strong>status</strong>,{" "}
          <strong>reason</strong>. Use the export as a template.
        </div>
        {importSummary ? (
          <div className={`callout ${importSummary.errors.length ? "callout--warning" : "callout--info"}`}>
            Applied {importSummary.applied} row(s), skipped {importSummary.skipped}.
            {importSummary.errors.length ? ` ${importSummary.errors.slice(0, 3).join(" ")}` : ""}
          </div>
        ) : null}
      </Card>

      <Card title="Students" subtitle="Update status and reason as needed">
        {students.length === 0 ? (
          <div className="callout">No students loaded. Import student data to begin.</div>
        ) : (
          <DataTable
            headers={["Roll", "Student", "Status", "Reason"]}
            rows={students.map((student) => {
              const entry = entries.find((e) => e.studentId === student.id);
              return [
                student.roll_no ?? "-",
                `${student.first_name} ${student.last_name}`,
                <select
                  key={`status-${student.id}`}
                  className="input input--compact"
                  value={entry?.status || "present"}
                  onChange={(e) =>
                    updateEntry(student.id, { status: e.target.value as Entry["status"] })
                  }
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>,
                <input
                  key={`reason-${student.id}`}
                  className="input input--compact"
                  value={entry?.reason || ""}
                  onChange={(e) => updateEntry(student.id, { reason: e.target.value })}
                  placeholder="Optional"
                />
              ];
            })}
          />
        )}
      </Card>
    </div>
  );
}
