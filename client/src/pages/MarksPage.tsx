import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import StatusPill from "../components/StatusPill";
import { API_BASE, apiGet, apiPost } from "../api/client";
import { getCsvValue, parseCsv, parseCsvBoolean, parseCsvNumber } from "../utils/csv";
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
type ExamItem = { id: number; name: string; exam_type: string };
type Student = { id: number; admission_no: string; first_name: string; last_name: string; roll_no: number | null };

type MarkEntry = { studentId: number; marks: string; isAbsent: boolean; isNotApplicable: boolean };
type ImportSummary = { applied: number; skipped: number; savedGroups?: number; errors: string[] };

export default function MarksPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [examId, setExamId] = useState<number | null>(null);
  const [maxMarks, setMaxMarks] = useState<number>(20);
  const [entries, setEntries] = useState<MarkEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/classes").then((res) => {
      setClasses(res.data);
      if (res.data.length) setClassId(res.data[0].id);
    });
    apiGet<{ data: ExamItem[] }>("/marks/exams").then((res) => {
      setExams(res.data);
      if (res.data.length) setExamId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    apiGet<{ data: ClassSubjectItem[] }>(`/classes/${classId}/subjects`).then((res) => {
      setClassSubjects(res.data);
      if (res.data.length) {
        setSubjectId(res.data[0].subject_id);
      } else {
        setSubjectId(null);
      }
    });
    apiGet<{ data: Student[] }>(`/students?classId=${classId}`).then((res) => {
      setStudents(res.data);
      setEntries(
        res.data.map((student) => ({ studentId: student.id, marks: "", isAbsent: false, isNotApplicable: false }))
      );
      setImportSummary(null);
    });
  }, [classId]);

  const stats = useMemo(() => {
    const total = students.length;
    const completed = entries.filter((e) => e.marks !== "" || e.isAbsent || e.isNotApplicable).length;
    return { total, completed };
  }, [students, entries]);

  const selectedSubject = useMemo(
    () => classSubjects.find((s) => s.subject_id === subjectId) || null,
    [classSubjects, subjectId]
  );
  const selectedExam = useMemo(() => exams.find((e) => e.id === examId) || null, [exams, examId]);
  const allowNotApplicable = Boolean(selectedSubject?.is_optional);
  const fixedMaxMarks =
    selectedExam && selectedSubject ? selectedSubject.max_marks?.[selectedExam.exam_type] : null;

  useEffect(() => {
    if (!selectedExam || !selectedSubject) return;
    const nextMax = selectedSubject.max_marks?.[selectedExam.exam_type];
    if (nextMax && nextMax !== maxMarks) {
      setMaxMarks(nextMax);
    }
  }, [selectedExam, selectedSubject, maxMarks]);

  const updateEntry = (studentId: number, updates: Partial<MarkEntry>) => {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, ...updates } : e)));
  };

  const handleSave = async () => {
    if (!examId || !classId || !subjectId) return;
    setSaving(true);
    try {
      await apiPost("/marks/bulk", {
        examId,
        classId,
        subjectId,
        entries: entries.map((e) => ({
          studentId: e.studentId,
          maxMarks,
          marksObtained: e.marks === "" ? undefined : Number(e.marks),
          isAbsent: e.isAbsent,
          isNotApplicable: e.isNotApplicable
        }))
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!examId || !classId || !subjectId) return;
    const token = localStorage.getItem("erp-token");
    const url = `${API_BASE}/exports/marks?examId=${examId}&classId=${classId}&subjectId=${subjectId}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "marks.csv";
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

      const isNotApplicableValue = (value: string) => {
        const normalized = value.trim().toLowerCase();
        return normalized === "na" || normalized === "n/a" || normalized === "not applicable";
      };

      if (!rows.length) {
        setImportSummary({ applied: 0, skipped: 0, errors: ["No data rows found in CSV."] });
        return;
      }

      const normalize = (value: string) => value.trim().toLowerCase();
      const classByName = new Map<string, ClassItem>();
      classes.forEach((c) => {
        classByName.set(normalize(c.name), c);
        classByName.set(normalize(formatClassLabel(c)), c);
      });
      const subjectByName = new Map(classSubjects.map((s) => [normalize(s.name), s]));
      const subjectByCode = new Map(
        classSubjects.filter((s) => s.code).map((s) => [normalize(s.code as string), s])
      );
      const examByName = new Map(exams.map((e) => [normalize(e.name), e]));
      const byAdmission = new Map(students.map((s) => [String(s.admission_no).trim(), s]));
      const byRoll = new Map(
        students.filter((s) => s.roll_no !== null).map((s) => [String(s.roll_no), s])
      );

      const updates = new Map<number, Partial<MarkEntry>>();
      const groupedEntries = new Map<
        string,
        {
          examId: number;
          subjectId: number;
          classId: number;
          entries: Array<{
            studentId: number;
            maxMarks: number;
            marksObtained?: number;
            isAbsent?: boolean;
            isNotApplicable?: boolean;
          }>;
        }
      >();
      const errors: string[] = [];
      const maxValues = new Set<number>();
      let applied = 0;
      let skipped = 0;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const classRaw = getCsvValue(row, ["class", "class_name", "classid", "class_id"]);
        let rowClassId = classId ?? null;
        if (classRaw) {
          const classIdCandidate = Number(classRaw);
          if (!Number.isNaN(classIdCandidate) && String(classIdCandidate) === classRaw.trim()) {
            rowClassId = classIdCandidate;
          } else {
            rowClassId = classByName.get(normalize(classRaw))?.id ?? null;
          }
        }

        if (!rowClassId || (classId && rowClassId !== classId)) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Class mismatch or missing class.`);
          return;
        }

        const examRaw = getCsvValue(row, ["exam", "exam_name", "examid", "exam_id"]);
        let rowExamId = examId ?? null;
        if (examRaw) {
          const examIdCandidate = Number(examRaw);
          if (!Number.isNaN(examIdCandidate) && String(examIdCandidate) === examRaw.trim()) {
            rowExamId = examIdCandidate;
          } else {
            rowExamId = examByName.get(normalize(examRaw))?.id ?? null;
          }
        }

        const subjectRaw = getCsvValue(row, [
          "subject",
          "subject_name",
          "subjectcode",
          "subject_code",
          "subjectid",
          "subject_id"
        ]);
        let rowSubjectId = subjectId ?? null;
        if (subjectRaw) {
          const subjectIdCandidate = Number(subjectRaw);
          if (!Number.isNaN(subjectIdCandidate) && String(subjectIdCandidate) === subjectRaw.trim()) {
            rowSubjectId = subjectIdCandidate;
          } else {
            rowSubjectId =
              subjectByCode.get(normalize(subjectRaw))?.subject_id ??
              subjectByName.get(normalize(subjectRaw))?.subject_id ??
              null;
          }
        }

        if (!rowExamId || !rowSubjectId) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Missing exam or subject.`);
          return;
        }

        const admission = getCsvValue(row, ["admission_no", "admission", "admissionnumber"]);
        const roll = getCsvValue(row, ["roll_no", "roll", "rollnumber"]);
        const student = admission ? byAdmission.get(admission) : roll ? byRoll.get(roll) : undefined;

        if (!student) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Student not found (admission_no/roll_no).`);
          return;
        }

        const maxValue = parseCsvNumber(getCsvValue(row, ["max_marks", "max"]));
        if (maxValue !== null) {
          maxValues.add(maxValue);
        }

        const absentRaw = getCsvValue(row, ["is_absent", "absent", "absent_flag"]);
        const marksRaw = getCsvValue(row, ["marks_obtained", "marks", "score"]);

        if ((marksRaw && isNotApplicableValue(marksRaw)) || (absentRaw && isNotApplicableValue(absentRaw))) {
          if (rowExamId === examId && rowSubjectId === subjectId) {
            updates.set(student.id, { marks: "", isAbsent: false, isNotApplicable: true });
          }
          const groupKey = `${rowExamId}:${rowSubjectId}:${rowClassId}`;
          const group = groupedEntries.get(groupKey) ?? {
            examId: rowExamId,
            subjectId: rowSubjectId,
            classId: rowClassId,
            entries: []
          };
          group.entries.push({
            studentId: student.id,
            maxMarks: maxValue ?? maxMarks,
            isNotApplicable: true
          });
          groupedEntries.set(groupKey, group);
          applied += 1;
          return;
        }

        const isAbsent = parseCsvBoolean(absentRaw);
        if (absentRaw && isAbsent === null) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Invalid is_absent value "${absentRaw}".`);
          return;
        }

        if (isAbsent) {
          if (rowExamId === examId && rowSubjectId === subjectId) {
            updates.set(student.id, { marks: "", isAbsent: true, isNotApplicable: false });
          }
          const groupKey = `${rowExamId}:${rowSubjectId}:${rowClassId}`;
          const group = groupedEntries.get(groupKey) ?? {
            examId: rowExamId,
            subjectId: rowSubjectId,
            classId: rowClassId,
            entries: []
          };
          group.entries.push({
            studentId: student.id,
            maxMarks: maxValue ?? maxMarks,
            isAbsent: true
          });
          groupedEntries.set(groupKey, group);
          applied += 1;
          return;
        }

        if (!marksRaw) {
          skipped += 1;
          return;
        }

        const marksValue = parseCsvNumber(marksRaw);
        if (marksValue === null) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Invalid marks "${marksRaw}".`);
          return;
        }

        const cap = maxValue ?? maxMarks;
        if (cap && marksValue > cap) {
          skipped += 1;
          errors.push(`Row ${rowNumber}: Marks ${marksValue} exceed max ${cap}.`);
          return;
        }

        if (rowExamId === examId && rowSubjectId === subjectId) {
          updates.set(student.id, { marks: String(marksValue), isAbsent: false, isNotApplicable: false });
        }
        const groupKey = `${rowExamId}:${rowSubjectId}:${rowClassId}`;
        const group = groupedEntries.get(groupKey) ?? {
          examId: rowExamId,
          subjectId: rowSubjectId,
          classId: rowClassId,
          entries: []
        };
        group.entries.push({
          studentId: student.id,
          maxMarks: cap || maxMarks,
          marksObtained: marksValue,
          isAbsent: false
        });
        groupedEntries.set(groupKey, group);
        applied += 1;
      });

      if (maxValues.size === 1 && examId && subjectId && classId) {
        setMaxMarks(Array.from(maxValues)[0]);
      }

      setEntries((prev) =>
        prev.map((entry) => {
          const update = updates.get(entry.studentId);
          return update ? { ...entry, ...update } : entry;
        })
      );

      const currentGroupKey = examId && subjectId && classId ? `${examId}:${subjectId}:${classId}` : null;
      const hasOtherGroups =
        !currentGroupKey ||
        groupedEntries.size > 1 ||
        (groupedEntries.size === 1 && currentGroupKey && !groupedEntries.has(currentGroupKey));

      if (hasOtherGroups) {
        let savedGroups = 0;
        for (const group of groupedEntries.values()) {
          try {
            await apiPost("/marks/bulk", {
              examId: group.examId,
              classId: group.classId,
              subjectId: group.subjectId,
              entries: group.entries
            });
            savedGroups += 1;
          } catch {
            errors.push(`Failed to save group exam ${group.examId} subject ${group.subjectId}.`);
          }
        }
        setImportSummary({ applied, skipped, savedGroups, errors });
      } else {
        setImportSummary({ applied, skipped, errors });
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Marks Entry"
        subtitle="Bulk entry with validation and auto-calculation"
        actions={
          <div className="header-actions">
            <button className="btn btn--ghost" onClick={handleExport}>
              Export CSV
            </button>
            <button className="btn btn--primary" disabled={saving} onClick={handleSave}>
              Save Marks
            </button>
          </div>
        }
      />

      <div className="grid grid--tiles">
        <StatTile label="Completion" value={stats.total ? `${stats.completed}/${stats.total}` : "0"} meta="" tone="accent" />
        <StatTile label="Max marks" value={String(maxMarks)} meta="" />
        <StatTile label="Absentees" value={String(entries.filter((e) => e.isAbsent).length)} meta="" tone="warning" />
        <StatTile label="Data quality" value={stats.total ? "Ready" : "--"} meta="" tone="success" />
      </div>

      <Card title="Exam Scope" subtitle="Select exam, class, and subject">
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
            <label className="form-label">Subject</label>
            <select
              className="input"
              value={subjectId ?? ""}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
            >
              {classSubjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar__group">
            <label className="form-label">Max Marks</label>
            <input
              className="input"
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
              disabled={Boolean(fixedMaxMarks)}
            />
          </div>
          <div className="toolbar__group toolbar__group--right">
            <StatusPill label={saving ? "Saving" : "Ready"} tone="info" />
          </div>
        </div>
        {classId && classSubjects.length === 0 ? (
          <div className="callout">No subjects configured for this class. Add subjects in Data Tools first.</div>
        ) : null}
      </Card>

      <Card title="Bulk Upload" subtitle="Upload a CSV to update marks in bulk">
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
          Expected headers: <strong>admission_no</strong> (or <strong>roll_no</strong>),{" "}
          <strong>marks_obtained</strong>, <strong>is_absent</strong>, <strong>max_marks</strong> (optional). Optional
          scope columns: <strong>exam</strong>, <strong>subject</strong>, <strong>class</strong>. Multi-subject uploads
          are saved automatically. Use the export as a template. For optional subjects, set{" "}
          <strong>marks_obtained</strong> to <strong>NA</strong> when a student does not take the subject.
        </div>
        {importSummary ? (
          <div className={`callout ${importSummary.errors.length ? "callout--warning" : "callout--info"}`}>
            Applied {importSummary.applied} row(s), skipped {importSummary.skipped}.
            {importSummary.savedGroups !== undefined ? ` Saved ${importSummary.savedGroups} group(s).` : ""}
            {importSummary.errors.length ? ` ${importSummary.errors.slice(0, 3).join(" ")}` : ""}
          </div>
        ) : null}
      </Card>

      <Card title="Marks Entry" subtitle="Enter marks or mark absent">
        {students.length === 0 ? (
          <div className="callout">No students loaded. Import student data to begin.</div>
        ) : (
          <DataTable
            headers={["Roll", "Student", "Marks", "Status"]}
            rows={students.map((student) => {
              const entry = entries.find((e) => e.studentId === student.id);
              return [
                student.roll_no ?? "-",
                `${student.first_name} ${student.last_name}`,
                <input
                  key={`marks-${student.id}`}
                  className="input input--compact"
                  value={entry?.marks || ""}
                  disabled={entry?.isAbsent || entry?.isNotApplicable}
                  onChange={(e) =>
                    updateEntry(student.id, {
                      marks: e.target.value,
                      isAbsent: false,
                      isNotApplicable: false
                    })
                  }
                  placeholder="--"
                />,
                <select
                  key={`status-${student.id}`}
                  className="input input--compact"
                  value={entry?.isNotApplicable ? "na" : entry?.isAbsent ? "absent" : "present"}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "na") {
                      updateEntry(student.id, { marks: "", isAbsent: false, isNotApplicable: true });
                      return;
                    }
                    updateEntry(student.id, {
                      marks: value === "absent" ? "" : entry?.marks || "",
                      isAbsent: value === "absent",
                      isNotApplicable: false
                    });
                  }}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  {allowNotApplicable ? <option value="na">NA</option> : null}
                </select>
              ];
            })}
          />
        )}
      </Card>
    </div>
  );
}
