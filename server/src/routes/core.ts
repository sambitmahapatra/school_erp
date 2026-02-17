import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/async-handler";
import {
  getAssignments,
  getAcademicYears,
  getClassesForUser,
  getClassSubjects,
  getStudentsForClass,
  getSubjectsForUser,
  upsertClassSubject
} from "../modules/core/core.service";

const router = Router();

router.get("/classes", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const isAdmin = req.user.roleNames.includes("admin_teacher");
  res.json({ data: await getClassesForUser(req.user.id, isAdmin) });
}));

router.get("/academic-years", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (_req, res) => {
  res.json({ data: await getAcademicYears() });
}));

router.get("/subjects", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const isAdmin = req.user.roleNames.includes("admin_teacher");
  res.json({ data: await getSubjectsForUser(req.user.id, isAdmin) });
}));

router.get("/classes/:classId/subjects", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  if (!classId) {
    return res.status(400).json({ error: { code: "invalid_params", message: "classId is required" } });
  }
  res.json({ data: await getClassSubjects(classId) });
}));

router.post("/classes/:classId/subjects", requireAuth, requirePermission("admin.read"), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const { subjectName, subjectCode, isOptional, maxMarks } = req.body as {
    subjectName: string;
    subjectCode?: string | null;
    isOptional?: boolean;
    maxMarks?: Record<string, number>;
  };

  if (!classId || !subjectName) {
    return res
      .status(400)
      .json({ error: { code: "invalid_params", message: "classId and subjectName are required" } });
  }

  try {
    const result = await upsertClassSubject({
      classId,
      subjectName,
      subjectCode: subjectCode || null,
      isOptional: Boolean(isOptional),
      maxMarks
    });
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: "invalid_request", message: err?.message || "Failed to save subject" } });
  }
}));

router.get("/students", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const classId = Number(req.query.classId);
  const isAdmin = req.user.roleNames.includes("admin_teacher");
  res.json({ data: await getStudentsForClass(req.user.id, classId, isAdmin) });
}));

router.get("/assignments", requireAuth, requirePermission("dashboard.read"), asyncHandler(async (req, res) => {
  const isAdmin = req.user.roleNames.includes("admin_teacher");
  res.json({ data: await getAssignments(req.user.id, isAdmin) });
}));

export default router;
