import fs from "fs";
import { parse } from "csv-parse/sync";
import { getDb, initDb } from "./index";

async function main() {
  const [, , type, filePath] = process.argv;

  if (!type || !filePath) {
    console.error("Usage: npm run db:import -- <type> <csvPath>");
    console.error("Types: classes, subjects, students, exams, marks, leave-types");
    process.exitCode = 1;
    return;
  }

  await initDb();
  const db = getDb();
  const now = new Date().toISOString();

  function loadCsv(path: string) {
    const content = fs.readFileSync(path, "utf-8").replace(/^\uFEFF/, "");
    return parse(content, { columns: true, skip_empty_lines: true, trim: true });
  }

  function normalize(value: unknown) {
    return String(value || "").trim();
  }

  async function ensureAcademicYear(name: string, startDate?: string, endDate?: string) {
    const existing = (await db.prepare("SELECT id FROM academic_years WHERE name = ?").get(name)) as
      | { id: number }
      | undefined;
    if (existing) {
      const hasActive = await db.prepare("SELECT 1 FROM academic_years WHERE is_active = 1 LIMIT 1").get();
      if (!hasActive) {
        await db.prepare("UPDATE academic_years SET is_active = 1 WHERE id = ?").run(existing.id);
      }
      return existing.id;
    }
    const start = startDate || `${new Date().getFullYear()}-04-01`;
    const end = endDate || `${new Date().getFullYear() + 1}-03-31`;
    const hasActive = await db.prepare("SELECT 1 FROM academic_years WHERE is_active = 1 LIMIT 1").get();
    const result = await db
      .prepare("INSERT INTO academic_years (name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)")
      .run(name, start, end, hasActive ? 0 : 1);
    return Number(result.lastInsertRowid);
  }

  async function getActiveYearId() {
    const active = (await db.prepare("SELECT id FROM academic_years WHERE is_active = 1").get()) as
      | { id: number }
      | undefined;
    return active?.id ?? null;
  }

  if (type === "classes") {
    const rows = loadCsv(filePath);
    for (const row of rows) {
      const yearName = row.academic_year || row.academicYear || row.year;
      if (!yearName) continue;
      const yearId = await ensureAcademicYear(yearName, row.year_start, row.year_end);
      await db
        .prepare("INSERT OR IGNORE INTO classes (grade, section, name, academic_year_id) VALUES (?, ?, ?, ?)")
        .run(Number(row.grade), row.section, row.name || `Class ${row.grade}${row.section}`, yearId);
    }
    console.log(`Imported classes: ${rows.length}`);
    return;
  }

  if (type === "subjects") {
    const rows = loadCsv(filePath);
    for (const row of rows) {
      await db
        .prepare("INSERT OR IGNORE INTO subjects (name, code, grade_from, grade_to) VALUES (?, ?, ?, ?)")
        .run(row.name, row.code, Number(row.grade_from), Number(row.grade_to));
    }
    console.log(`Imported subjects: ${rows.length}`);
    return;
  }

  if (type === "students") {
    const rows = loadCsv(filePath);
    const activeYearId = await getActiveYearId();
    if (!activeYearId) {
      console.error("No active academic year. Create one or import classes with an active year first.");
      process.exitCode = 1;
      return;
    }
    for (const row of rows) {
      const className = normalize(row.class_name || row.stream || row.class);
      const gradeValue = Number(row.class_grade || row.grade);
      const sectionValue = normalize(row.section);

      let classRow: { id: number; name: string } | undefined;

      if (className) {
        classRow = (await db
          .prepare("SELECT id, name FROM classes WHERE grade = ? AND section = ? AND name = ? AND academic_year_id = ?")
          .get(gradeValue, sectionValue, className, activeYearId)) as { id: number; name: string } | undefined;
      } else {
        const matches = (await db
          .prepare("SELECT id, name FROM classes WHERE grade = ? AND section = ? AND academic_year_id = ?")
          .all(gradeValue, sectionValue, activeYearId)) as Array<{ id: number; name: string }>;
        if (matches.length === 1) {
          classRow = matches[0];
        } else {
          console.warn(`Class not found or ambiguous for grade ${gradeValue} section ${sectionValue}. Include class_name.`);
          continue;
        }
      }

      if (!classRow) {
        console.warn(`Class not found for grade ${gradeValue} section ${sectionValue} ${className ? `(${className})` : ""}`);
        continue;
      }

      await db
        .prepare(
          "INSERT OR IGNORE INTO students (admission_no, first_name, last_name, class_id, roll_no, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          row.admission_no,
          row.first_name,
          row.last_name,
          classRow.id,
          row.roll_no ? Number(row.roll_no) : null,
          row.status || "active",
          now,
          now
        );
    }
    console.log(`Imported students: ${rows.length}`);
    return;
  }

  if (type === "exams") {
    const rows = loadCsv(filePath);
    for (const row of rows) {
      const yearName = row.academic_year || row.academicYear || row.year;
      const yearId = yearName ? await ensureAcademicYear(yearName, row.year_start, row.year_end) : await getActiveYearId();
      if (!yearId) continue;
      await db
        .prepare(
          "INSERT OR IGNORE INTO exams (academic_year_id, term_id, name, exam_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(yearId, null, row.name, row.exam_type || row.type || "Exam", row.start_date || null, row.end_date || null);
    }
    console.log(`Imported exams: ${rows.length}`);
    return;
  }

  if (type === "marks") {
    const rows = loadCsv(filePath);
    const activeYearId = await getActiveYearId();
    for (const row of rows) {
      const exam = (await db.prepare("SELECT id FROM exams WHERE name = ?").get(row.exam_name)) as
        | { id: number }
        | undefined;
      const subject = (await db.prepare("SELECT id FROM subjects WHERE code = ?").get(row.subject_code)) as
        | { id: number }
        | undefined;

      const className = normalize(row.class_name || row.stream || row.class);
      const gradeValue = Number(row.class_grade || row.grade);
      const sectionValue = normalize(row.section);

      let classRow: { id: number; name: string } | undefined;

      if (className) {
        classRow = (await db
          .prepare("SELECT id, name FROM classes WHERE grade = ? AND section = ? AND name = ? AND academic_year_id = ?")
          .get(gradeValue, sectionValue, className, activeYearId)) as { id: number; name: string } | undefined;
      } else {
        const matches = (await db
          .prepare("SELECT id, name FROM classes WHERE grade = ? AND section = ? AND academic_year_id = ?")
          .all(gradeValue, sectionValue, activeYearId)) as Array<{ id: number; name: string }>;
        if (matches.length === 1) {
          classRow = matches[0];
        } else {
          console.warn(`Class not found or ambiguous for grade ${gradeValue} section ${sectionValue}. Include class_name.`);
          continue;
        }
      }

      const student = (await db.prepare("SELECT id FROM students WHERE admission_no = ?").get(row.admission_no)) as
        | { id: number }
        | undefined;
      if (!exam || !subject || !classRow || !student) {
        console.warn(`Skipping marks row. Missing exam/subject/class/student for ${row.admission_no}`);
        continue;
      }
      const isAbsent =
        String(row.is_absent || "")
          .toLowerCase()
          .trim() === "true" ||
        String(row.is_absent || "")
          .toLowerCase()
          .trim() === "1" ||
        String(row.is_absent || "")
          .toLowerCase()
          .trim() === "yes";

      await db
        .prepare(
          "INSERT OR IGNORE INTO marks_entries (exam_id, component_id, class_id, subject_id, student_id, teacher_id, max_marks, marks_obtained, is_absent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          exam.id,
          null,
          classRow.id,
          subject.id,
          student.id,
          row.teacher_id ? Number(row.teacher_id) : null,
          Number(row.max_marks),
          row.marks_obtained !== undefined && row.marks_obtained !== "" ? Number(row.marks_obtained) : null,
          isAbsent ? 1 : 0,
          now,
          now
        );
    }
    console.log(`Imported marks rows: ${rows.length}`);
    return;
  }

  if (type === "leave-types") {
    const rows = loadCsv(filePath);
    for (const row of rows) {
      await db.prepare("INSERT OR IGNORE INTO leave_types (name, default_balance) VALUES (?, ?)").run(
        row.name,
        Number(row.default_balance || 0)
      );
    }
    console.log(`Imported leave types: ${rows.length}`);
    return;
  }

  console.error(`Unknown type: ${type}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
