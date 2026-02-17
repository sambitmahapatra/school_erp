import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { apiDelete, apiGet, apiPost } from "../api/client";
import { formatClassLabel } from "../utils/format";

type ClassItem = { id: number; name: string; grade: number; section: string };
type ClassSubjectItem = {
  class_subject_id: number;
  subject_id: number;
  name: string;
  code?: string | null;
  is_optional: boolean;
  max_marks: Record<string, number>;
};
type AcademicYear = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: number;
};
type ExamItem = {
  id: number;
  name: string;
  exam_type: string;
  start_date?: string | null;
  end_date?: string | null;
};

type ImportError = { row: number; message: string };

type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
};

type ClearResult = {
  scope: "attendance" | "marks" | "students";
  counts: {
    attendanceSessions?: number;
    attendanceEntries?: number;
    attendanceAudit?: number;
    marksEntries?: number;
    notes?: number;
    students?: number;
  };
};

type MeResponse = {
  data: {
    user: { id: number; email?: string; firstName?: string; lastName?: string };
    scope: { roles: string[] };
  };
};

const EXAM_TYPES = ["Unit", "Mid", "Final", "Practical"] as const;

export default function DataAdminPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<ClearResult | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [maxMarks, setMaxMarks] = useState<Record<string, string>>({
    Unit: "",
    Mid: "",
    Final: "",
    Practical: ""
  });
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState<number | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [examName, setExamName] = useState("");
  const [examType, setExamType] = useState<(typeof EXAM_TYPES)[number]>("Unit");
  const [examStartDate, setExamStartDate] = useState("");
  const [examEndDate, setExamEndDate] = useState("");
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examDeletingId, setExamDeletingId] = useState<number | null>(null);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/classes").then((res) => {
      setClasses(res.data);
      if (res.data.length) setClassId(res.data[0].id);
    });
    apiGet<MeResponse>("/auth/me")
      .then((res) => setIsAdmin(res.data.scope.roles.includes("admin_teacher")))
      .catch(() => setIsAdmin(false));
    apiGet<{ data: AcademicYear[] }>("/academic-years")
      .then((res) => {
        setAcademicYears(res.data);
        const active = res.data.find((year) => year.is_active === 1) || res.data[0];
        if (active) setAcademicYearId(active.id);
      })
      .catch(() => setAcademicYears([]));
  }, []);

  useEffect(() => {
    if (!classId) {
      setClassSubjects([]);
      return;
    }
    apiGet<{ data: ClassSubjectItem[] }>(`/classes/${classId}/subjects`)
      .then((res) => setClassSubjects(res.data))
      .catch(() => setClassSubjects([]));
  }, [classId]);

  useEffect(() => {
    if (!academicYearId) {
      setExams([]);
      return;
    }
    apiGet<{ data: ExamItem[] }>(`/marks/exams?yearId=${academicYearId}`)
      .then((res) => setExams(res.data))
      .catch(() => setExams([]));
  }, [academicYearId]);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) || null, [classes, classId]);

  const templateCsv = useMemo(() => {
    const grade = selectedClass?.grade ?? 1;
    const section = selectedClass?.section ?? "A";
    const className = selectedClass?.name ?? "Science";
    return (
      "admission_no,first_name,last_name,class_grade,section,class_name,roll_no,status\n" +
      `S${grade}${section}001,First,Student,${grade},${section},${className},1,active\n`
    );
  }, [selectedClass]);

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    const suffix = selectedClass ? `${selectedClass.grade}${selectedClass.section}` : "template";
    link.download = `students-${suffix}.csv`;
    link.click();
  };

  const handleImport = async () => {
    if (!file || !classId) {
      setImportError("Select a class and CSV file to import.");
      return;
    }
    setImportError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const csv = await file.text();
      const res = await apiPost<{ data: ImportResult }>("/data/import/students", {
        classId,
        mode,
        csv
      });
      setImportResult(res.data);
    } catch (err: any) {
      setImportError(err?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async (scope: "attendance" | "marks" | "students") => {
    if (!classId) {
      setClearError("Select a class to clear data.");
      return;
    }

    const labelMap = {
      attendance: "attendance sessions",
      marks: "marks",
      students: "student master list (and all linked data)"
    };

    const confirmed = window.confirm(`This will clear ${labelMap[scope]} for the selected class. Continue?`);
    if (!confirmed) return;

    setClearError(null);
    setClearResult(null);
    setClearing(true);
    try {
      const res = await apiPost<{ data: ClearResult }>(`/data/classes/${classId}/clear`, { scope });
      setClearResult(res.data);
    } catch (err: any) {
      setClearError(err?.message || "Clear request failed");
    } finally {
      setClearing(false);
    }
  };

  const handleAddSubject = async () => {
    if (!classId) {
      setSubjectError("Select a class first.");
      return;
    }
    if (!subjectName.trim()) {
      setSubjectError("Subject name is required.");
      return;
    }
    setSubjectError(null);
    setSubjectSaving(true);
    try {
      const payloadMaxMarks: Record<string, number> = {};
      Object.entries(maxMarks).forEach(([key, value]) => {
        const parsed = Number(value);
        if (!Number.isNaN(parsed) && parsed > 0) {
          payloadMaxMarks[key] = parsed;
        }
      });

      await apiPost(`/classes/${classId}/subjects`, {
        subjectName: subjectName.trim(),
        subjectCode: subjectCode.trim() || null,
        isOptional,
        maxMarks: payloadMaxMarks
      });

      const refreshed = await apiGet<{ data: ClassSubjectItem[] }>(`/classes/${classId}/subjects`);
      setClassSubjects(refreshed.data);
      setSubjectName("");
      setSubjectCode("");
      setIsOptional(false);
      setMaxMarks({ Unit: "", Mid: "", Final: "", Practical: "" });
    } catch (err: any) {
      setSubjectError(err?.message || "Failed to save subject.");
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleAddExam = async () => {
    if (!academicYearId) {
      setExamError("Select an academic year first.");
      return;
    }
    if (!examName.trim()) {
      setExamError("Exam name is required.");
      return;
    }
    setExamError(null);
    setExamSaving(true);
    try {
      await apiPost("/marks/exams", {
        academicYearId,
        name: examName.trim(),
        examType,
        startDate: examStartDate || undefined,
        endDate: examEndDate || undefined
      });
      const refreshed = await apiGet<{ data: ExamItem[] }>(`/marks/exams?yearId=${academicYearId}`);
      setExams(refreshed.data);
      setExamName("");
      setExamStartDate("");
      setExamEndDate("");
      setExamType("Unit");
    } catch (err: any) {
      setExamError(err?.message || "Failed to save exam.");
    } finally {
      setExamSaving(false);
    }
  };

  const handleDeleteExam = async (examId: number) => {
    if (!academicYearId) return;
    const confirmed = window.confirm("Delete this exam? This cannot be undone.");
    if (!confirmed) return;
    setExamError(null);
    setExamDeletingId(examId);
    try {
      await apiDelete(`/marks/exams/${examId}`);
      const refreshed = await apiGet<{ data: ExamItem[] }>(`/marks/exams?yearId=${academicYearId}`);
      setExams(refreshed.data);
    } catch (err: any) {
      setExamError(err?.message || "Failed to delete exam.");
    } finally {
      setExamDeletingId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Data Administration" subtitle="Import and manage student master data" />

      <div className="grid grid--two">
        <Card title="Import Student Master" subtitle="Upload CSV for the selected class and set the master roster">
          <div className="form-grid">
            <div>
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
            <div>
              <label className="form-label">Import mode</label>
              <select className="input" value={mode} onChange={(e) => setMode(e.target.value as "append" | "replace")}>
                <option value="append">Append / Update</option>
                <option value="replace">Replace master list</option>
              </select>
            </div>
            <div>
              <label className="form-label">CSV file</label>
              <input
                className="input"
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="form-label">Template</label>
              <button className="btn btn--ghost" type="button" onClick={downloadTemplate}>
                Download Template
              </button>
            </div>
          </div>
          <div className="inline-actions">
            <button className="btn btn--primary" disabled={importing} onClick={handleImport}>
              {importing ? "Importing..." : "Import CSV"}
            </button>
            <StatusPill label={mode === "replace" ? "Replace" : "Append"} tone={mode === "replace" ? "warning" : "info"} />
          </div>
          {importError ? <div className="callout callout--warning">{importError}</div> : null}
          {importResult ? (
            <div className="callout">
              Imported {importResult.inserted} new, updated {importResult.updated}, skipped {importResult.skipped}.
              {importResult.errors.length ? (
                <div style={{ marginTop: "8px" }}>
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={`${err.row}-${idx}`}>Row {err.row}: {err.message}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card title="Data Reset" subtitle="Clear existing data for the selected class">
          <div className="form-grid">
            <div>
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
            <div>
              <label className="form-label">Permission</label>
              <div className="input" style={{ display: "flex", alignItems: "center" }}>
                {isAdmin ? "Admin access" : "Standard access"}
              </div>
            </div>
          </div>
          <div className="inline-actions">
            <button className="btn btn--ghost" disabled={!isAdmin || clearing} onClick={() => handleClear("attendance")}>
              Clear Attendance
            </button>
            <button className="btn btn--ghost" disabled={!isAdmin || clearing} onClick={() => handleClear("marks")}>
              Clear Marks
            </button>
            <button className="btn btn--secondary" disabled={!isAdmin || clearing} onClick={() => handleClear("students")}>
              Clear Student Master
            </button>
          </div>
          {!isAdmin ? (
            <div className="callout callout--info">Admin permission required to clear data.</div>
          ) : null}
          {clearError ? <div className="callout callout--warning">{clearError}</div> : null}
          {clearResult ? (
            <div className="callout">
              Cleared {clearResult.scope}. Summary: {Object.entries(clearResult.counts)
                .map(([key, value]) => `${key}=${value}`)
                .join(", ")}
            </div>
          ) : null}
        </Card>
      </div>

      <Card title="Exam Setup" subtitle="Create exams for the academic year">
        <div className="form-grid">
          <div>
            <label className="form-label">Academic year</label>
            <select
              className="input"
              value={academicYearId ?? ""}
              onChange={(e) => setAcademicYearId(e.target.value ? Number(e.target.value) : null)}
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Exam name</label>
            <input
              className="input"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="e.g. Mid Term"
            />
          </div>
          <div>
            <label className="form-label">Exam type</label>
            <select className="input" value={examType} onChange={(e) => setExamType(e.target.value as any)}>
              {EXAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Start date</label>
            <input
              className="input"
              type="date"
              value={examStartDate}
              onChange={(e) => setExamStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">End date</label>
            <input
              className="input"
              type="date"
              value={examEndDate}
              onChange={(e) => setExamEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="inline-actions">
          <button className="btn btn--primary" disabled={!isAdmin || examSaving} onClick={handleAddExam}>
            {examSaving ? "Saving..." : "Add Exam"}
          </button>
          {!isAdmin ? (
            <div className="callout callout--info">Admin permission required to manage exams.</div>
          ) : null}
        </div>
        {examError ? <div className="callout callout--warning">{examError}</div> : null}

        <div style={{ marginTop: "16px" }}>
          {exams.length ? (
            <DataTable
              headers={["Exam", "Type", "Start", "End", "Actions"]}
              rows={exams.map((exam) => [
                exam.name,
                exam.exam_type,
                exam.start_date || "-",
                exam.end_date || "-",
                <button
                  key={`delete-${exam.id}`}
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleDeleteExam(exam.id)}
                  disabled={!isAdmin || examDeletingId === exam.id}
                >
                  {examDeletingId === exam.id ? "Deleting..." : "Delete"}
                </button>
              ])}
              compact
            />
          ) : (
            <div className="callout">No exams configured for this academic year.</div>
          )}
        </div>
      </Card>

      <Card title="Class Subjects & Max Marks" subtitle="Configure subjects, optional flags, and exam-wise max marks">
        <div className="form-grid">
          <div>
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
          <div>
            <label className="form-label">Subject name</label>
            <input
              className="input"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Physics"
            />
          </div>
          <div>
            <label className="form-label">Subject code (optional)</label>
            <input
              className="input"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder="e.g. PHY"
            />
          </div>
          <div>
            <label className="form-label">Optional</label>
            <div className="input" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={isOptional}
                onChange={(e) => setIsOptional(e.target.checked)}
              />
              <span>{isOptional ? "Optional subject" : "Compulsory subject"}</span>
            </div>
          </div>
          {["Unit", "Mid", "Final", "Practical"].map((examType) => (
            <div key={examType}>
              <label className="form-label">{examType} max marks</label>
              <input
                className="input"
                type="number"
                value={maxMarks[examType]}
                onChange={(e) => setMaxMarks((prev) => ({ ...prev, [examType]: e.target.value }))}
                placeholder="e.g. 100"
              />
            </div>
          ))}
        </div>
        <div className="inline-actions">
          <button className="btn btn--primary" disabled={!isAdmin || subjectSaving} onClick={handleAddSubject}>
            {subjectSaving ? "Saving..." : "Add / Update Subject"}
          </button>
          {!isAdmin ? (
            <div className="callout callout--info">Admin permission required to manage class subjects.</div>
          ) : null}
        </div>
        {subjectError ? <div className="callout callout--warning">{subjectError}</div> : null}

        <div style={{ marginTop: "16px" }}>
          {classSubjects.length ? (
            <DataTable
              headers={["Subject", "Optional", "Unit", "Mid", "Final", "Practical"]}
              rows={classSubjects.map((subject) => [
                subject.name,
                subject.is_optional ? "Yes" : "No",
                subject.max_marks?.Unit ?? "-",
                subject.max_marks?.Mid ?? "-",
                subject.max_marks?.Final ?? "-",
                subject.max_marks?.Practical ?? "-"
              ])}
              compact
            />
          ) : (
            <div className="callout">No subjects configured for this class yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
