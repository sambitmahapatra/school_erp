import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/async-handler";
import {
  addComponent,
  bulkUpsertMarks,
  createExam,
  deleteExam,
  getClassPerformance,
  getMarks,
  getStudentPerformance,
  listComponents,
  listExams
} from "../modules/marks/marks.service";

const router = Router();

router.get("/exams", requireAuth, requirePermission("marks.read"), asyncHandler(async (req, res) => {
  const yearId = req.query.yearId ? Number(req.query.yearId) : undefined;
  const exams = await listExams(yearId);
  res.json({ data: exams });
}));

const examSchema = z.object({
  academicYearId: z.number(),
  termId: z.number().optional(),
  name: z.string().min(1),
  examType: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

router.post(
  "/exams",
  requireAuth,
  requirePermission("marks.write"),
  validateBody(examSchema),
  asyncHandler(async (req, res) => {
    const id = await createExam({ ...req.body, createdBy: req.user.id });
    res.json({ data: { id } });
  })
);

router.delete("/exams/:id", requireAuth, requirePermission("admin.read"), asyncHandler(async (req, res) => {
  const examId = Number(req.params.id);
  if (!examId) {
    return res.status(400).json({ error: { code: "invalid_params", message: "Exam id is required." } });
  }
  try {
    await deleteExam(examId);
    res.json({ data: { ok: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: "invalid_request", message: err?.message || "Failed to delete exam" } });
  }
}));

router.get("/exams/:id/components", requireAuth, requirePermission("marks.read"), asyncHandler(async (req, res) => {
  const examId = Number(req.params.id);
  const components = await listComponents(examId);
  res.json({ data: components });
}));

const componentSchema = z.object({
  name: z.string().min(1),
  maxMarks: z.number().min(1),
  weight: z.number().optional()
});

router.post(
  "/exams/:id/components",
  requireAuth,
  requirePermission("marks.write"),
  validateBody(componentSchema),
  asyncHandler(async (req, res) => {
    const examId = Number(req.params.id);
    const id = await addComponent({ examId, ...req.body });
    res.json({ data: { id } });
  })
);

const bulkSchema = z.object({
  examId: z.number(),
  componentId: z.number().optional(),
  classId: z.number(),
  subjectId: z.number(),
  entries: z.array(
    z.object({
      studentId: z.number(),
      maxMarks: z.number(),
      marksObtained: z.number().optional(),
      isAbsent: z.boolean().optional(),
      isNotApplicable: z.boolean().optional()
    })
  )
});

router.post(
  "/bulk",
  requireAuth,
  requirePermission("marks.write"),
  validateBody(bulkSchema),
  asyncHandler(async (req, res) => {
    if (!req.user.teacherId) {
      return res.status(400).json({ error: { code: "invalid_state", message: "Teacher profile missing" } });
    }
    const { examId, componentId, classId, subjectId, entries } = req.body as any;
    try {
      await bulkUpsertMarks({
        examId,
        componentId: componentId || null,
        classId,
        subjectId,
        teacherId: req.user.teacherId,
        entries
      });
      res.json({ data: { ok: true } });
    } catch (err: any) {
      res.status(400).json({ error: { code: "invalid_request", message: err?.message || "Failed to save marks" } });
    }
  })
);

router.get("/list", requireAuth, requirePermission("marks.read"), asyncHandler(async (req, res) => {
  const examId = Number(req.query.examId);
  const classId = Number(req.query.classId);
  const subjectId = Number(req.query.subjectId);
  const data = await getMarks({ examId, classId, subjectId });
  res.json({ data });
}));

router.get("/analytics/class", requireAuth, requirePermission("marks.read"), asyncHandler(async (req, res) => {
  const examId = Number(req.query.examId);
  const classId = Number(req.query.classId);
  const data = await getClassPerformance(examId, classId);
  res.json({ data });
}));

router.get("/analytics/student/:studentId", requireAuth, requirePermission("marks.read"), asyncHandler(async (req, res) => {
  const studentId = Number(req.params.studentId);
  const data = await getStudentPerformance(studentId);
  res.json({ data });
}));

export default router;
