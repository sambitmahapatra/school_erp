import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/async-handler";
import { getClassAnalytics } from "../modules/analytics/analytics.service";
import { getClassesForUser } from "../modules/core/core.service";
import { getDashboardAlerts, getDashboardSummary } from "../modules/dashboard/dashboard.service";

const router = Router();

router.get("/summary", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const data = await getDashboardSummary({ userId: req.user.id, teacherId: req.user.teacherId });
  res.json({ data });
}));

router.get("/alerts", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const data = await getDashboardAlerts(req.user.teacherId);
  res.json({ data });
}));

router.get("/upcoming-exams", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const data = (await getDashboardSummary({ userId: req.user.id, teacherId: req.user.teacherId })).upcomingExams;
  res.json({ data });
}));

router.get("/class-analytics", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const classId = Number(req.query.classId);
  const month = req.query.month ? String(req.query.month) : undefined;
  if (!classId) {
    return res.status(400).json({ error: { code: "invalid_class", message: "Invalid class id" } });
  }
  const isAdmin = req.user.roleNames.includes("admin_teacher");
  const allowed = (await getClassesForUser(req.user.id, isAdmin)).some((c) => c.id === classId);
  if (!allowed) {
    return res.status(403).json({ error: { code: "forbidden", message: "Class not in scope" } });
  }
  const data = await getClassAnalytics({ classId, month });
  if (!data) {
    return res.status(404).json({ error: { code: "not_found", message: "Class not found" } });
  }
  res.json({ data });
}));

export default router;
