import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { getDb } from "../db";
import { getClassesForUser } from "../modules/core/core.service";
import { getClassExamAnalytics, getStudentAnalytics } from "../modules/analytics/analytics.service";

const router = Router();

router.get("/class", requireAuth, requirePermission("dashboard.read"), (req, res) => {
  const classId = Number(req.query.classId);
  const examId = Number(req.query.examId);
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;

  if (!classId || !examId) {
    return res.status(400).json({ error: { code: "invalid_params", message: "classId and examId are required" } });
  }

  const isAdmin = req.user.roleNames.includes("admin_teacher");
  const allowed = getClassesForUser(req.user.id, isAdmin).some((c) => c.id === classId);
  if (!allowed) {
    return res.status(403).json({ error: { code: "forbidden", message: "Class not in scope" } });
  }

  const data = getClassExamAnalytics({ classId, examId, subjectId });
  if (!data) {
    return res.status(404).json({ error: { code: "not_found", message: "Exam or class not found" } });
  }

  res.json({ data });
});

router.get("/student", requireAuth, requirePermission("progress.read"), (req, res) => {
  const studentId = Number(req.query.studentId);
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

  if (!studentId) {
    return res.status(400).json({ error: { code: "invalid_params", message: "studentId is required" } });
  }

  const db = getDb();
  const studentRow = db
    .prepare("SELECT id, class_id FROM students WHERE id = ?")
    .get(studentId) as { id: number; class_id: number } | undefined;

  if (!studentRow) {
    return res.status(404).json({ error: { code: "not_found", message: "Student not found" } });
  }

  const isAdmin = req.user.roleNames.includes("admin_teacher");
  const allowed = getClassesForUser(req.user.id, isAdmin).some((c) => c.id === studentRow.class_id);
  if (!allowed) {
    return res.status(403).json({ error: { code: "forbidden", message: "Student not in scope" } });
  }

  const data = getStudentAnalytics({ studentId, startDate, endDate });
  if (!data) {
    return res.status(404).json({ error: { code: "not_found", message: "Student not found" } });
  }

  res.json({ data });
});

export default router;
