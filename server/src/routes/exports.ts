import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { exportAttendance, exportLeaves, exportMarks, exportStudents } from "../modules/exports/exports.service";

const router = Router();

function sendCsv(res: any, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.send(csv);
}

router.get("/students", requireAuth, requirePermission("dashboard.read"), (req, res) => {
  const classId = req.query.classId ? Number(req.query.classId) : undefined;
  const { filename, csv } = exportStudents(classId);
  sendCsv(res, filename, csv);
});

router.get("/attendance", requireAuth, requirePermission("attendance.read"), (req, res) => {
  const date = req.query.date as string | undefined;
  const classId = req.query.classId ? Number(req.query.classId) : undefined;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
  const { filename, csv } = exportAttendance({ date, classId, subjectId });
  sendCsv(res, filename, csv);
});

router.get("/marks", requireAuth, requirePermission("marks.read"), (req, res) => {
  const examId = Number(req.query.examId);
  const classId = Number(req.query.classId);
  const subjectId = Number(req.query.subjectId);
  const { filename, csv } = exportMarks({ examId, classId, subjectId });
  sendCsv(res, filename, csv);
});

router.get("/leave", requireAuth, requirePermission("leave.read"), (req, res) => {
  const month = req.query.month as string | undefined;
  const { filename, csv } = exportLeaves(month);
  sendCsv(res, filename, csv);
});

export default router;
